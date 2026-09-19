using Microsoft.Extensions.Logging;
using Our.Umbraco.ContentDashboard.ViewModels;
using Umbraco.Cms.Api.Common.ViewModels.Pagination;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Cache;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Persistence.Querying;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Infrastructure.Persistence.SqlSyntax;
using Umbraco.Cms.Infrastructure.Scoping;
using UmbConstants = Umbraco.Cms.Core.Constants;

namespace Our.Umbraco.ContentDashboard.Services;

/// <inheritdoc />
public sealed class ContentOwnershipService : IContentOwnershipService
{
    /// <summary>
    ///     Guids are written into the <c>IN (...)</c> clause of a single statement, so cap how many go in
    ///     at once to stay well clear of provider parameter limits (SQL Server allows 2100).
    /// </summary>
    private const int TransferBatchSize = 500;

    private readonly AppCaches _appCaches;
    private readonly IAuditService _auditService;
    private readonly IContentService _contentService;
    private readonly ILanguageService _languageService;
    private readonly ILogger<ContentOwnershipService> _logger;
    private readonly IScopeProvider _scopeProvider;
    private readonly IUserIdKeyResolver _userIdKeyResolver;
    private readonly IUserService _userService;

    public ContentOwnershipService(
        IScopeProvider scopeProvider,
        IContentService contentService,
        IUserService userService,
        IUserIdKeyResolver userIdKeyResolver,
        ILanguageService languageService,
        IAuditService auditService,
        AppCaches appCaches,
        ILogger<ContentOwnershipService> logger)
    {
        _scopeProvider = scopeProvider;
        _contentService = contentService;
        _userService = userService;
        _userIdKeyResolver = userIdKeyResolver;
        _languageService = languageService;
        _auditService = auditService;
        _appCaches = appCaches;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<PagedViewModel<OwnedDocumentResponseModel>> GetOwnedDocumentsAsync(
        Guid ownerKey,
        int skip,
        int take,
        OwnedDocumentSortField sortField,
        SortDirection direction,
        CancellationToken cancellationToken = default)
    {
        Attempt<int> ownerIdAttempt = await _userIdKeyResolver.TryGetAsync(ownerKey);
        if (ownerIdAttempt.Success is false)
        {
            return PagedViewModel<OwnedDocumentResponseModel>.Empty();
        }

        int ownerId = ownerIdAttempt.Result;
        (long pageIndex, int pageSize) = ToPaging(skip, take);

        // CreatorId is mapped to NodeDto.UserId by Umbraco's ContentMapper, so this filter - and the
        // Name/UpdateDate ordering below - are applied in SQL rather than in memory.
        IQuery<IContent> filter = _scopeProvider.CreateQuery<IContent>().Where(x => x.CreatorId == ownerId);

        // Descendants of the content root exclude the recycle bin, which lives under a different root.
        IEnumerable<IContent> documents = _contentService.GetPagedDescendants(
            UmbConstants.System.Root,
            pageIndex,
            pageSize,
            out long total,
            filter,
            Ordering.By(SortFieldToOrderBy(sortField), ToDirection(direction)));

        DocumentOwnerModel owner = await BuildOwnerAsync(ownerId, cancellationToken);

        return new PagedViewModel<OwnedDocumentResponseModel>
        {
            Total = total,
            Items = documents.Select(document => MapDocument(document, owner)).ToArray(),
        };
    }

    /// <inheritdoc />
    public async Task<PagedViewModel<ScheduledDocumentResponseModel>> GetScheduledDocumentsAsync(
        Guid? ownerKey,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        int? ownerId = null;
        if (ownerKey.HasValue)
        {
            Attempt<int> ownerIdAttempt = await _userIdKeyResolver.TryGetAsync(ownerKey.Value);
            if (ownerIdAttempt.Success is false)
            {
                return PagedViewModel<ScheduledDocumentResponseModel>.Empty();
            }

            ownerId = ownerIdAttempt.Result;
        }

        (long pageIndex, int pageSize) = ToPaging(skip, take);

        NPoco.Page<ScheduledDocumentDto> page;
        using (IScope scope = _scopeProvider.CreateScope(autoComplete: true))
        {
            ISqlSyntaxProvider syntax = scope.SqlContext.SqlSyntax;
            string schedule = syntax.GetQuotedTableName(UmbConstants.DatabaseSchema.Tables.ContentSchedule);
            string node = syntax.GetQuotedTableName(UmbConstants.DatabaseSchema.Tables.Node);

            var args = new List<object> { UmbConstants.ObjectTypes.Document, false, DateTime.UtcNow };
            var ownerClause = string.Empty;
            if (ownerId.HasValue)
            {
                ownerClause = $"  AND n.{syntax.GetQuotedColumnName("nodeUser")} = @{args.Count}";
                args.Add(ownerId.Value);
            }

            // Umbraco's own GetContentForRelease/GetContentForExpiration return *overdue* schedules for the
            // background publishing job, so they cannot answer "what is coming up" - hence the direct query.
            // umbracoNode.text already holds the node name, so no content-version join is needed.
            var sql = $"""
                       SELECT n.{syntax.GetQuotedColumnName("uniqueId")} AS DocumentKey,
                              n.{syntax.GetQuotedColumnName("text")} AS Name,
                              n.{syntax.GetQuotedColumnName("nodeUser")} AS OwnerId,
                              s.{syntax.GetQuotedColumnName("date")} AS Date,
                              s.{syntax.GetQuotedColumnName("action")} AS Action,
                              s.{syntax.GetQuotedColumnName("languageId")} AS LanguageId
                       FROM {schedule} s
                       INNER JOIN {node} n ON n.{syntax.GetQuotedColumnName("id")} = s.{syntax.GetQuotedColumnName("nodeId")}
                       WHERE n.{syntax.GetQuotedColumnName("nodeObjectType")} = @0
                         AND n.{syntax.GetQuotedColumnName("trashed")} = @1
                         AND s.{syntax.GetQuotedColumnName("date")} > @2
                       {ownerClause}
                       ORDER BY s.{syntax.GetQuotedColumnName("date")} ASC
                       """;

            page = scope.Database.Page<ScheduledDocumentDto>(
                pageIndex + 1, // NPoco pages are 1-based, Umbraco's page indexes are 0-based
                pageSize,
                sql,
                args.ToArray());
        }

        IReadOnlyDictionary<int, DocumentOwnerModel> owners =
            await BuildOwnersAsync(page.Items.Select(item => item.OwnerId), cancellationToken);
        IReadOnlyDictionary<int, string> isoCodes = await BuildIsoCodesAsync();

        return new PagedViewModel<ScheduledDocumentResponseModel>
        {
            Total = page.TotalItems,
            Items = page.Items.Select(item => new ScheduledDocumentResponseModel
            {
                Id = item.DocumentKey,
                Name = item.Name ?? string.Empty,
                Action = ParseScheduleAction(item.Action),
                Date = new DateTimeOffset(DateTime.SpecifyKind(item.Date, DateTimeKind.Utc)),
                Culture = item.LanguageId.HasValue && isoCodes.TryGetValue(item.LanguageId.Value, out string? iso)
                    ? iso
                    : null,
                Owner = owners.GetValueOrDefault(item.OwnerId),
            }).ToArray(),
        };
    }

    /// <inheritdoc />
    public async Task<IEnumerable<ContentOwnerResponseModel>> GetOwnersAsync(
        CancellationToken cancellationToken = default)
    {
        List<OwnerCountDto> counts;
        using (IScope scope = _scopeProvider.CreateScope(autoComplete: true))
        {
            ISqlSyntaxProvider syntax = scope.SqlContext.SqlSyntax;
            string node = syntax.GetQuotedTableName(UmbConstants.DatabaseSchema.Tables.Node);
            string nodeUser = syntax.GetQuotedColumnName("nodeUser");

            var sql = $"""
                       SELECT n.{nodeUser} AS OwnerId, COUNT(*) AS DocumentCount
                       FROM {node} n
                       WHERE n.{syntax.GetQuotedColumnName("nodeObjectType")} = @0
                         AND n.{syntax.GetQuotedColumnName("trashed")} = @1
                         AND n.{nodeUser} IS NOT NULL
                       GROUP BY n.{nodeUser}
                       """;

            counts = scope.Database.Fetch<OwnerCountDto>(sql, UmbConstants.ObjectTypes.Document, false);
        }

        cancellationToken.ThrowIfCancellationRequested();

        IUser[] users = _userService.GetUsersById(counts.Select(c => c.OwnerId).ToArray())?.ToArray() ?? [];
        Dictionary<int, IUser> usersById = users.ToDictionary(user => user.Id);

        return counts
            .Where(count => usersById.ContainsKey(count.OwnerId))
            .Select(count =>
            {
                IUser user = usersById[count.OwnerId];
                return new ContentOwnerResponseModel
                {
                    Id = user.Key,
                    Name = user.Name ?? user.Username,
                    Email = user.Email,
                    DocumentCount = count.DocumentCount,
                };
            })
            .OrderByDescending(owner => owner.DocumentCount)
            .ThenBy(owner => owner.Name)
            .ToArray();
    }

    /// <inheritdoc />
    public async Task<int> TransferOwnershipAsync(
        IEnumerable<Guid> documentKeys,
        Guid newOwnerKey,
        Guid performingUserKey)
    {
        Guid[] keys = documentKeys.Distinct().ToArray();
        if (keys.Length == 0)
        {
            return 0;
        }

        int newOwnerId = await _userIdKeyResolver.GetAsync(newOwnerKey);

        var affected = 0;
        using (IScope scope = _scopeProvider.CreateScope())
        {
            ISqlSyntaxProvider syntax = scope.SqlContext.SqlSyntax;
            string node = syntax.GetQuotedTableName(UmbConstants.DatabaseSchema.Tables.Node);

            // Deliberately a direct write rather than IContentService.Save: Save() stamps UpdateDate and
            // WriterId, which would make every transferred page look freshly edited and destroy the
            // "how old is this page" signal the dashboard exists to show.
            var sql = $"""
                       UPDATE {node}
                       SET {syntax.GetQuotedColumnName("nodeUser")} = @0
                       WHERE {syntax.GetQuotedColumnName("nodeObjectType")} = @1
                         AND {syntax.GetQuotedColumnName("uniqueId")} IN (@2)
                       """;

            foreach (Guid[] batch in keys.Chunk(TransferBatchSize))
            {
                affected += scope.Database.Execute(sql, newOwnerId, UmbConstants.ObjectTypes.Document, batch);
            }

            scope.Complete();
        }

        await AfterTransferAsync(affected, performingUserKey,
            $"Transferred ownership of {affected} document(s) to user {newOwnerKey}.");

        return affected;
    }

    /// <inheritdoc />
    public async Task<int> TransferAllOwnershipAsync(Guid fromUserKey, Guid toUserKey, Guid performingUserKey)
    {
        if (fromUserKey == toUserKey)
        {
            return 0;
        }

        int fromUserId = await _userIdKeyResolver.GetAsync(fromUserKey);
        int toUserId = await _userIdKeyResolver.GetAsync(toUserKey);

        int affected;
        using (IScope scope = _scopeProvider.CreateScope())
        {
            ISqlSyntaxProvider syntax = scope.SqlContext.SqlSyntax;
            string node = syntax.GetQuotedTableName(UmbConstants.DatabaseSchema.Tables.Node);
            string nodeUser = syntax.GetQuotedColumnName("nodeUser");

            var sql = $"""
                       UPDATE {node}
                       SET {nodeUser} = @0
                       WHERE {syntax.GetQuotedColumnName("nodeObjectType")} = @1
                         AND {nodeUser} = @2
                       """;

            affected = scope.Database.Execute(sql, toUserId, UmbConstants.ObjectTypes.Document, fromUserId);
            scope.Complete();
        }

        await AfterTransferAsync(affected, performingUserKey,
            $"Transferred ownership of all {affected} document(s) from user {fromUserKey} to user {toUserKey}.");

        return affected;
    }

    /// <summary>
    ///     Invalidates the cached <see cref="IContent" /> instances that still carry the old creator, and
    ///     records what happened in the audit trail.
    /// </summary>
    /// <remarks>
    ///     The cache clear is local to this server. On a load-balanced setup other servers keep serving the
    ///     previous owner until their own cache expires or the app recycles.
    /// </remarks>
    private async Task AfterTransferAsync(int affected, Guid performingUserKey, string comment)
    {
        if (affected == 0)
        {
            return;
        }

        _appCaches.IsolatedCaches.ClearCache<IContent>();

        try
        {
            await _auditService.AddAsync(
                AuditType.Custom,
                performingUserKey,
                UmbConstants.System.Root,
                UmbracoObjectTypes.Document.GetName(),
                comment);
        }
        catch (Exception exception)
        {
            // An audit failure must not roll back a transfer that already succeeded.
            _logger.LogWarning(exception, "Could not write an audit entry for a content ownership transfer.");
        }
    }

    private static (long PageIndex, int PageSize) ToPaging(int skip, int take)
    {
        int pageSize = take < 1 ? 1 : take;
        long pageIndex = skip < 1 ? 0 : skip / pageSize;
        return (pageIndex, pageSize);
    }

    private static string SortFieldToOrderBy(OwnedDocumentSortField sortField) => sortField switch
    {
        OwnedDocumentSortField.Name => "Name",
        _ => "UpdateDate",
    };

    private static Direction ToDirection(SortDirection direction) =>
        direction == SortDirection.Descending ? Direction.Descending : Direction.Ascending;

    private static ScheduleAction ParseScheduleAction(string? action) =>
        string.Equals(action, nameof(ContentScheduleAction.Expire), StringComparison.OrdinalIgnoreCase)
            ? ScheduleAction.Unpublish
            : ScheduleAction.Publish;

    private static OwnedDocumentResponseModel MapDocument(IContent document, DocumentOwnerModel? owner) =>
        new()
        {
            Id = document.Key,
            Name = document.Name ?? string.Empty,
            ContentTypeAlias = document.ContentType.Alias,
            Icon = document.ContentType.Icon,
            Published = document.Published,
            Edited = document.Edited,
            UpdateDate = new DateTimeOffset(document.UpdateDate.ToUniversalTime(), TimeSpan.Zero),
            CreateDate = new DateTimeOffset(document.CreateDate.ToUniversalTime(), TimeSpan.Zero),
            Owner = owner,
        };

    private async Task<DocumentOwnerModel> BuildOwnerAsync(int ownerId, CancellationToken cancellationToken)
    {
        IReadOnlyDictionary<int, DocumentOwnerModel> owners = await BuildOwnersAsync([ownerId], cancellationToken);
        return owners.GetValueOrDefault(ownerId) ?? new DocumentOwnerModel { Name = "Unknown user" };
    }

    private Task<IReadOnlyDictionary<int, DocumentOwnerModel>> BuildOwnersAsync(
        IEnumerable<int> ownerIds,
        CancellationToken cancellationToken)
    {
        int[] ids = ownerIds.Distinct().ToArray();
        if (ids.Length == 0)
        {
            return Task.FromResult<IReadOnlyDictionary<int, DocumentOwnerModel>>(
                new Dictionary<int, DocumentOwnerModel>());
        }

        cancellationToken.ThrowIfCancellationRequested();

        IReadOnlyDictionary<int, DocumentOwnerModel> owners = (_userService.GetUsersById(ids) ?? [])
            .ToDictionary(
                user => user.Id,
                user => new DocumentOwnerModel { Id = user.Key, Name = user.Name ?? user.Username });

        return Task.FromResult(owners);
    }

    private async Task<IReadOnlyDictionary<int, string>> BuildIsoCodesAsync()
    {
        IEnumerable<ILanguage> languages = await _languageService.GetAllAsync();
        return languages.ToDictionary(language => language.Id, language => language.IsoCode);
    }

    /// <summary>Row shape for the pending-schedule query.</summary>
    private sealed class ScheduledDocumentDto
    {
        public Guid DocumentKey { get; set; }

        public string? Name { get; set; }

        public int OwnerId { get; set; }

        public DateTime Date { get; set; }

        public string? Action { get; set; }

        public int? LanguageId { get; set; }
    }

    /// <summary>Row shape for the owner-count query.</summary>
    private sealed class OwnerCountDto
    {
        public int OwnerId { get; set; }

        public int DocumentCount { get; set; }
    }
}

using Our.Umbraco.ContentDashboard.ViewModels;
using Umbraco.Cms.Api.Common.ViewModels.Pagination;

namespace Our.Umbraco.ContentDashboard.Services;

/// <summary>
///     Reads and reassigns document ownership. "Owner" maps onto Umbraco's built-in creator
///     (<c>umbracoNode.nodeUser</c>, surfaced as "Created by" on a document's Info tab).
/// </summary>
public interface IContentOwnershipService
{
    /// <summary>
    ///     Gets a page of the documents owned by <paramref name="ownerKey" />, excluding the recycle bin.
    /// </summary>
    Task<PagedViewModel<OwnedDocumentResponseModel>> GetOwnedDocumentsAsync(
        Guid ownerKey,
        int skip,
        int take,
        OwnedDocumentSortField sortField,
        SortDirection direction,
        CancellationToken cancellationToken = default);

    /// <summary>
    ///     Gets a page of pending (future) publish/unpublish schedules, optionally limited to one owner.
    /// </summary>
    Task<PagedViewModel<ScheduledDocumentResponseModel>> GetScheduledDocumentsAsync(
        Guid? ownerKey,
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    /// <summary>
    ///     Gets every user that owns at least one document, with their document count.
    /// </summary>
    Task<IEnumerable<ContentOwnerResponseModel>> GetOwnersAsync(CancellationToken cancellationToken = default);

    /// <summary>
    ///     Moves the given documents to a new owner. Returns the number of documents actually changed.
    /// </summary>
    Task<int> TransferOwnershipAsync(IEnumerable<Guid> documentKeys, Guid newOwnerKey, Guid performingUserKey);

    /// <summary>
    ///     Moves every document owned by <paramref name="fromUserKey" /> to <paramref name="toUserKey" />.
    ///     Returns the number of documents actually changed.
    /// </summary>
    Task<int> TransferAllOwnershipAsync(Guid fromUserKey, Guid toUserKey, Guid performingUserKey);
}

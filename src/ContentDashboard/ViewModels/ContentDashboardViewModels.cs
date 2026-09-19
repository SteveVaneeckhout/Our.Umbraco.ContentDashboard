using System.Text.Json.Serialization;

namespace Our.Umbraco.ContentDashboard.ViewModels;

/// <summary>
///     The field an owned-document listing can be sorted by.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<OwnedDocumentSortField>))]
public enum OwnedDocumentSortField
{
    /// <summary>Sort alphabetically by document name.</summary>
    Name,

    /// <summary>Sort by when the document was last saved ("how old is this page").</summary>
    UpdateDate,
}

/// <summary>
///     Sort direction for an owned-document listing.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<SortDirection>))]
public enum SortDirection
{
    Ascending,
    Descending,
}

/// <summary>
///     Whether a schedule entry will publish or unpublish the document when it fires.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<ScheduleAction>))]
public enum ScheduleAction
{
    /// <summary>The document will be published (Umbraco's "Release" action).</summary>
    Publish,

    /// <summary>The document will be unpublished (Umbraco's "Expire" action).</summary>
    Unpublish,
}

/// <summary>
///     The backoffice user a document is owned by. Ownership is Umbraco's built-in creator.
/// </summary>
public class DocumentOwnerModel
{
    /// <summary>The owner's user key, or null when the creator no longer exists.</summary>
    public Guid? Id { get; set; }

    public string Name { get; set; } = string.Empty;
}

/// <summary>
///     A document in the "My Content" listing.
/// </summary>
public class OwnedDocumentResponseModel
{
    public required Guid Id { get; set; }

    public required string Name { get; set; }

    public required string ContentTypeAlias { get; set; }

    public string? Icon { get; set; }

    public required bool Published { get; set; }

    /// <summary>True when the document has unpublished changes.</summary>
    public required bool Edited { get; set; }

    public required DateTimeOffset UpdateDate { get; set; }

    public required DateTimeOffset CreateDate { get; set; }

    public DocumentOwnerModel? Owner { get; set; }
}

/// <summary>
///     A pending publish/unpublish schedule entry.
/// </summary>
public class ScheduledDocumentResponseModel
{
    public required Guid Id { get; set; }

    public required string Name { get; set; }

    public required ScheduleAction Action { get; set; }

    /// <summary>When the schedule fires, in UTC.</summary>
    public required DateTimeOffset Date { get; set; }

    /// <summary>The culture the schedule applies to, or null for invariant documents.</summary>
    public string? Culture { get; set; }

    public DocumentOwnerModel? Owner { get; set; }
}

/// <summary>
///     A backoffice user together with the number of documents they own.
/// </summary>
public class ContentOwnerResponseModel
{
    public required Guid Id { get; set; }

    public required string Name { get; set; }

    public string? Email { get; set; }

    public required int DocumentCount { get; set; }
}

/// <summary>
///     Request to move specific documents to a new owner.
/// </summary>
public class TransferOwnershipRequestModel
{
    public required Guid[] DocumentIds { get; set; }

    public required Guid NewOwnerId { get; set; }
}

/// <summary>
///     Request to move every document owned by one user to another user.
/// </summary>
public class TransferAllOwnershipRequestModel
{
    public required Guid FromUserId { get; set; }

    public required Guid ToUserId { get; set; }
}

/// <summary>
///     The outcome of an ownership transfer.
/// </summary>
public class TransferOwnershipResponseModel
{
    /// <summary>How many documents changed owner.</summary>
    public required int AffectedCount { get; set; }
}

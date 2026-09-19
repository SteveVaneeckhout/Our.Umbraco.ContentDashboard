using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Our.Umbraco.ContentDashboard.Services;
using Our.Umbraco.ContentDashboard.ViewModels;
using Umbraco.Cms.Api.Common.ViewModels.Pagination;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Security;
using Umbraco.Cms.Web.Common.Authorization;

namespace Our.Umbraco.ContentDashboard.Controllers;

/// <summary>
///     Backs the Content Dashboard: who owns which pages, what is scheduled, and reassigning ownership.
/// </summary>
[ApiVersion("1.0")]
[ApiExplorerSettings(GroupName = "ContentDashboard")]
public class ContentDashboardApiController : ContentDashboardApiControllerBase
{
    private const int MaxTake = 500;

    private readonly IBackOfficeSecurityAccessor _backOfficeSecurityAccessor;
    private readonly IContentOwnershipService _contentOwnershipService;

    public ContentDashboardApiController(
        IBackOfficeSecurityAccessor backOfficeSecurityAccessor,
        IContentOwnershipService contentOwnershipService)
    {
        _backOfficeSecurityAccessor = backOfficeSecurityAccessor;
        _contentOwnershipService = contentOwnershipService;
    }

    /// <summary>
    ///     Lists the documents owned by a user, defaulting to the current user.
    /// </summary>
    [HttpGet("documents")]
    [ProducesResponseType<PagedViewModel<OwnedDocumentResponseModel>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedViewModel<OwnedDocumentResponseModel>>> Documents(
        CancellationToken cancellationToken,
        Guid? ownerId = null,
        int skip = 0,
        int take = 50,
        OwnedDocumentSortField orderBy = OwnedDocumentSortField.UpdateDate,
        SortDirection direction = SortDirection.Descending)
    {
        Guid? currentUserKey = CurrentUserKey();
        if (currentUserKey is null)
        {
            return Unauthorized();
        }

        return await _contentOwnershipService.GetOwnedDocumentsAsync(
            ownerId ?? currentUserKey.Value,
            skip,
            ClampTake(take),
            orderBy,
            direction,
            cancellationToken);
    }

    /// <summary>
    ///     Lists pending publish/unpublish schedules for a user's documents, defaulting to the current user.
    ///     Pass <c>allOwners=true</c> to see schedules across every owner.
    /// </summary>
    [HttpGet("scheduled")]
    [ProducesResponseType<PagedViewModel<ScheduledDocumentResponseModel>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedViewModel<ScheduledDocumentResponseModel>>> Scheduled(
        CancellationToken cancellationToken,
        Guid? ownerId = null,
        bool allOwners = false,
        int skip = 0,
        int take = 50)
    {
        Guid? currentUserKey = CurrentUserKey();
        if (currentUserKey is null)
        {
            return Unauthorized();
        }

        Guid? owner = allOwners ? null : ownerId ?? currentUserKey.Value;

        return await _contentOwnershipService.GetScheduledDocumentsAsync(
            owner,
            skip,
            ClampTake(take),
            cancellationToken);
    }

    /// <summary>
    ///     Lists every user that owns at least one document, with their document count.
    /// </summary>
    [HttpGet("owners")]
    [ProducesResponseType<IEnumerable<ContentOwnerResponseModel>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ContentOwnerResponseModel>>> Owners(
        CancellationToken cancellationToken)
        => Ok(await _contentOwnershipService.GetOwnersAsync(cancellationToken));

    /// <summary>
    ///     Moves specific documents to a new owner.
    /// </summary>
    [HttpPost("transfer")]
    [ProducesResponseType<TransferOwnershipResponseModel>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<TransferOwnershipResponseModel>> Transfer(
        TransferOwnershipRequestModel request)
    {
        Guid? currentUserKey = CurrentUserKey();
        if (currentUserKey is null)
        {
            return Unauthorized();
        }

        if (request.DocumentIds.Length == 0)
        {
            return BadRequest("At least one document must be selected.");
        }

        int affected = await _contentOwnershipService.TransferOwnershipAsync(
            request.DocumentIds,
            request.NewOwnerId,
            currentUserKey.Value);

        return new TransferOwnershipResponseModel { AffectedCount = affected };
    }

    /// <summary>
    ///     Moves every document owned by one user to another user. Administrators only - this is how
    ///     a departing editor's content gets handed over.
    /// </summary>
    [HttpPost("transfer-all")]
    [Authorize(Policy = AuthorizationPolicies.RequireAdminAccess)]
    [ProducesResponseType<TransferOwnershipResponseModel>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<TransferOwnershipResponseModel>> TransferAll(
        TransferAllOwnershipRequestModel request)
    {
        Guid? currentUserKey = CurrentUserKey();
        if (currentUserKey is null)
        {
            return Unauthorized();
        }

        if (request.FromUserId == request.ToUserId)
        {
            return BadRequest("The source and target user must be different.");
        }

        int affected = await _contentOwnershipService.TransferAllOwnershipAsync(
            request.FromUserId,
            request.ToUserId,
            currentUserKey.Value);

        return new TransferOwnershipResponseModel { AffectedCount = affected };
    }

    private static int ClampTake(int take) => take switch
    {
        < 1 => 1,
        > MaxTake => MaxTake,
        _ => take,
    };

    private Guid? CurrentUserKey()
    {
        IUser? currentUser = _backOfficeSecurityAccessor.BackOfficeSecurity?.CurrentUser;
        return currentUser?.Key;
    }
}

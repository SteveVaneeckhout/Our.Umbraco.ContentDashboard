using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Api.Common.Attributes;
using Umbraco.Cms.Api.Common.Filters;
using Umbraco.Cms.Web.Common.Authorization;
using Umbraco.Cms.Web.Common.Routing;
using UmbConstants = Umbraco.Cms.Core.Constants;

namespace Our.Umbraco.ContentDashboard.Controllers
{
    [ApiController]
    [BackOfficeRoute("contentdashboard/api/v{version:apiVersion}")]
    [Authorize(Policy = AuthorizationPolicies.SectionAccessContent)]
    [MapToApi(Constants.ApiName)]
    [JsonOptionsName(UmbConstants.JsonOptionsNames.BackOffice)]
    public class ContentDashboardApiControllerBase : ControllerBase
    {
    }
}

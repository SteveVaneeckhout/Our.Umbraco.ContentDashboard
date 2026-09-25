using Asp.Versioning;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Our.Umbraco.ContentDashboard.Services;
using Swashbuckle.AspNetCore.SwaggerGen;
using Umbraco.Cms.Api.Common.OpenApi;
using Umbraco.Cms.Api.Management.OpenApi;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace Our.Umbraco.ContentDashboard.Composers;

public class ContentDashboardApiComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services.AddScoped<IContentOwnershipService, ContentOwnershipService>();

        builder.Services.AddSingleton<IOperationIdHandler, ContentDashboardOperationIdHandler>();

        // Umbraco 17 generates OpenAPI with Swashbuckle; the document is served at
        // /umbraco/swagger/contentdashboard/swagger.json. See
        // https://docs.umbraco.com/umbraco-cms/17.latest/tutorials/creating-a-backoffice-api
        builder.Services.Configure<SwaggerGenOptions>(options =>
        {
            options.SwaggerDoc(Constants.ApiName, new OpenApiInfo
            {
                Title = "Content Dashboard Backoffice API",
                Version = "1.0",
            });

            options.OperationFilter<ContentDashboardOperationSecurityFilter>();
        });
    }

    /// <summary>Marks every operation in this package's document as requiring backoffice authentication.</summary>
    public class ContentDashboardOperationSecurityFilter : BackOfficeSecurityRequirementsOperationFilterBase
    {
        protected override string ApiName => Constants.ApiName;
    }

    /// <summary>
    ///     Names operations HTTP method + action (<c>GetOwners</c>, <c>PostTransferAll</c>), which is what
    ///     the generated TypeScript client's function names (<c>getOwners</c>, <c>postTransferAll</c>) are
    ///     derived from. The Umbraco 18 line gets the same names from its own OpenAPI generator, so the
    ///     client stays identical across both lines.
    /// </summary>
    public class ContentDashboardOperationIdHandler : OperationIdHandler
    {
        public ContentDashboardOperationIdHandler(IOptions<ApiVersioningOptions> apiVersioningOptions)
            : base(apiVersioningOptions)
        {
        }

        protected override bool CanHandle(
            ApiDescription apiDescription,
            ControllerActionDescriptor controllerActionDescriptor)
            => controllerActionDescriptor.ControllerTypeInfo.Namespace?.StartsWith(
                "Our.Umbraco.ContentDashboard.Controllers",
                StringComparison.Ordinal) is true;

        public override string Handle(ApiDescription apiDescription)
        {
            string method = apiDescription.HttpMethod ?? "Get";
            return $"{char.ToUpperInvariant(method[0])}{method[1..].ToLowerInvariant()}"
                   + apiDescription.ActionDescriptor.RouteValues["action"];
        }
    }
}

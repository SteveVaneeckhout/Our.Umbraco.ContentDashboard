# AGENTS.md

Notes for anyone - human or otherwise - working in this repository. Everything here was paid for
once already; none of it is guesswork.

## What this is

`Our.Umbraco.ContentDashboard`: an Umbraco 17 LTS backoffice package, content ownership and scheduling dashboards. It is published to NuGet and
listed on the Umbraco Marketplace, so the public surface and the README are part of the product.

```
src/Cms/            the Umbraco host. A development harness, never shipped (IsPackable=false).
src/ContentDashboard/ the package
scripts/            tooling outside the build
docs/               architecture, development, upgrading
```

## Branches

`main` follows the latest Umbraco. Each supported LTS gets a long-lived `v<major>/main` branch -
currently `v17/main`, for Umbraco 17 - and the **package major matches the Umbraco major** (18.x
from `main`, 17.x from `v17/main`), all under the one NuGet ID.

- Work on an LTS branch in its **own worktree**
  (`git worktree add ../Our.Umbraco.ContentDashboard-v17 v17/main`). The SQLite database,
  `node_modules`, `wwwroot` and `bin/obj` are gitignored, so a plain checkout would share them, and
  an older Umbraco cannot boot on a database the newer one has migrated. Both sites use port 44366,
  so only one runs at a time.
- **Release order matters.** `dotnet add package` takes the highest stable version and NuGet only
  *warns* (NU1608) when its dependencies do not fit, so an LTS release must never be the highest
  version on NuGet - `main` must always have released a higher major first. Publish LTS GitHub
  Releases with *Set as latest release* unticked.
- A fix that applies to both lines is **cherry-picked** across. Never merge the branches into each
  other: the port itself would come along with the fix.

**This is the `v17/main` branch.** What differs from `main` is deliberately small: the version pins,
the OpenAPI composer (Umbraco 17 still uses Swashbuckle - see *OpenAPI* below), the uSync folder
name, and the docs. The service, the controllers and the client source are the same code.

Inside `src/ContentDashboard/`:

```
  Composers/    DI registration and the package's OpenAPI document
  Controllers/  the backoffice API
  Services/     ContentOwnershipService - every read and write
  ViewModels/   request/response models
  Client/       TypeScript + Vite source for the backoffice UI
    src/lang/   the UI dictionaries, one file per language
  wwwroot/      Vite output, served at /App_Plugins/ContentDashboard (generated, NOT committed)
```

## Running it

```bash
dotnet run --project src/Cms
```

Backoffice at **https://localhost:44366/umbraco**, admin `hello@example.com`, password in
`src/Cms/appsettings.json`. The configured application URL is
`https://testsite1.127.0.0.1.nip.io:44366/`, which is the host the single uSync domain binds to.
Everything secret in this repository is deliberately public - it is a throwaway local harness.

On first boot the site creates a SQLite database, installs unattended, and imports `src/Cms/uSync/v17`.

**A running site holds the package DLL open**, so stop it before `dotnet build`:
`Get-Process -Name Cms | Stop-Process -Force`.

## Build, test, format

```bash
dotnet build Our.Umbraco.ContentDashboard.slnx -p:BuildClient=false
dotnet format Our.Umbraco.ContentDashboard.slnx --verify-no-changes
```

- **Tests are MSTest on Microsoft.Testing.Platform.** The .NET 10 SDK refuses to run MTP projects
  through the legacy VSTest target, so `global.json` carries
  `"test": { "runner": "Microsoft.Testing.Platform" }`. It is **not** `dotnet.config`, which looks
  plausible and does nothing. In this mode a project is `dotnet test --project <path>`, not
  positional, and `dotnet test A.csproj B.csproj` is rejected outright.
- Porting assertions from xUnit: `Assert.AreEqual(expected, actual, x)` takes a **delta**, where
  xUnit's third argument was a *decimal-place count* - carrying a `10` across turns a tight assertion
  into "within ±10". `Assert.AreEqual` compares collections by **reference**; use
  `CollectionAssert.AreEqual`. `Assert.Contains`/`DoesNotContain` do keep xUnit's
  `(substring, value)` order, unlike `StringAssert.Contains(value, substring)`.
- `dotnet format --verify-no-changes` is a CI gate. `.gitattributes` normalises the working tree to
  LF; without that it fails on line endings alone.
- `-p:BuildClient=false` skips the MSBuild target that shells out to npm. **That target only fires
  when the bundle is missing**, so it will happily reuse a stale `wwwroot` - which is exactly how
  source maps once shipped inside a release package. CI builds the client explicitly, then passes
  this flag everywhere.

## Dependencies

This package depends on nothing that is not published by **Microsoft or Umbraco**, and that is a
deliberate constraint, not an accident. Before adding a package, check whether the .NET SDK or
Umbraco already covers it. SourceLink, for instance, needs no PackageReference - it is in the SDK.

## Namespaces

The root namespace is `Our.Umbraco.ContentDashboard`, which **shadows the global `Umbraco` namespace**. Inside
it, a fully-qualified `Umbraco.Cms.Core.Constants` resolves `Umbraco` to `Our.Umbraco` and fails
with `CS0246: The type or namespace name 'Cms' does not exist in the namespace 'Our.Umbraco'`. The
same applies to XML `cref` attributes, which fail as `CS1574`.

Use a file-scoped alias - `using UmbConstants = Umbraco.Cms.Core.Constants;` - which sits outside the
namespace and resolves globally. These references are usually fully qualified in the first place
because each package declares its own `Constants` class that shadows Umbraco's, so the alias fixes
both problems at once. For crefs, import the namespace and use the simple type name.

Deliberately **not** renamed, and not to be renamed: `App_Plugins/ContentDashboard`, the bundle aliases,
`umbraco-package.json`'s `id`, and `Constants.ApiName` (`"contentdashboard"`, which is both the OpenAPI
document name and the route prefix `/umbraco/contentdashboard/api/v1/…`).

## Client workflow

```bash
cd src/ContentDashboard/Client
npm install            # NOT --legacy-peer-deps
npm run build          # or: npm run watch
npm run generate-client   # regenerate src/api from the live OpenAPI doc (site must be running)
```

- **`npm install`, never `--legacy-peer-deps`.** Umbraco's docs suggest that flag, but it skips the
  peers (`lit`, `@umbraco-ui/uui`, `rxjs`) the TypeScript build needs for types. Without them you
  get a wall of "module has no exported member" errors.
- **Bump `version` in `Client/public/umbraco-package.json` on every client change.** Umbraco uses it
  as the cache-buster (`?umb__rnd=`); leave it and the browser serves the old bundle.
- **Static web assets are baked at build time.** After `npm run build`, new chunks are only served
  once the site is rebuilt and restarted.

Import rules: templating from `@umbraco-cms/backoffice/external/lit` (`@umbraco-cms/backoffice/lit`
does not exist; bare `lit` bundles a second copy and breaks reactive-element identity), elements
extend `UmbLitElement` from `@umbraco-cms/backoffice/lit-element`, and
`rollupOptions.external: [/^@umbraco/]` must stay - the backoffice resolves those specifiers through
the import map it serves at `/umbraco/backoffice/umbraco-package.json`.

## Localization

**No user-facing string belongs in a template.** Text comes from `Client/src/lang/en.ts` via
`this.localize.term(...)`, manifest labels are `"#area_key"`, and dates and numbers go through
`this.localize.date/number/relativeTime` - plain `Intl` follows the *browser* language, not the
backoffice one.

Two guards fail the build rather than the UI: `npm run build` runs `scripts/check-lang.mjs`, which
rejects a key `en.ts` does not define, and every non-English file is typed
`Translation<ContentDashboardLocalizations>` so a missing key is a `tsc` error. Never translate `en.ts` in
place, and never give it a regional culture like `en-us` - `en` is Umbraco's default and acts as the
per-key fallback.

## OpenAPI

**Umbraco 17 generates OpenAPI with Swashbuckle**; Umbraco 18 replaced it with
Microsoft.AspNetCore.OpenApi, which is why `ContentDashboardApiComposer` is the one file that really
differs between the branches. The document is at `/umbraco/swagger/contentdashboard/swagger.json`
(OpenAPI 3.0), not `/umbraco/openapi/contentdashboard.json`.

- **Operation IDs are named HTTP method + action** (`GetOwners`, `PostTransferAll`) by
  `ContentDashboardOperationIdHandler`. hey-api derives the client's function names from them, and
  that scheme reproduces exactly the names `main`'s generator gives (`getOwners`,
  `postTransferAll`), so `Client/src` needs no changes between the branches. The 17 extension
  template's `{action}`-only handler would rename every function.
- **Swashbuckle is used transitively**, through `Umbraco.Cms.Api.Management`. The 17 template
  references `Swashbuckle.AspNetCore` directly; this package does not, because of the
  Microsoft-or-Umbraco dependency rule above.
- Swashbuckle marks request bodies optional, so the regenerated client types `body?:` rather than
  `body:`. Harmless, but it is why `src/api` differs from `main`'s.
- `TransferAll`'s explicit `[ProducesResponseType(StatusCodes.Status403Forbidden)]` does **not**
  break the document on 17 (verified on 17.7.0). On `main` the `401`/`403` duplicate-key trap is real;
  see that branch's AGENTS.md before copying such an attribute across.

## What matters in this package

- **Ownership is `umbracoNode.nodeUser`** - Umbraco's built-in creator, shown as *Created by*.
  There is no parallel bookkeeping.
- **Transfers deliberately bypass `IContentService.Save`.** `Save` stamps `UpdateDate` and
  `WriterId`, which would make every transferred page look freshly edited and destroy the "how old
  is this page" signal the My Content tab exists to show. `ContentOwnershipService` writes the
  column directly inside an Umbraco scope, filtered on `nodeObjectType = Document`, then clears the
  cached `IContent` instances.
- That cache clear is **local to one server**. In a load-balanced setup the others show the previous
  owner until their cache expires.
- **Pickers must be routed modals.** `UmbModalManagerContext` force-closes every modal whose
  `router` is null whenever a `navigationsuccess` event fires, and a picker built on
  `umb-collection` contains a router that fires exactly that event while initialising. A plain
  `umbOpenModal` picker visibly flashes and closes. Use `UmbModalRouteRegistrationController` - see
  `registerUserPicker` in `Client/src/dashboards/shared.ts`. Corollary: never open a confirm modal
  from a picker's `onSubmit`; confirm first, then pick.

## The fixture

67 documents, all created by the unattended admin, so *My Content* is populated on a fresh
clone. Two deliberate future schedules keep *Scheduled* non-empty: **Acrobat** publishes 2026-12-01,
**Alton Towers** unpublishes 2026-11-15.

`src/Cms/uSync/v17` was re-exported from scratch, so it contains no delete tombstones and matches the
database exactly. A plain uSync Export **adds and updates files but never removes stale ones**, which
is how a domain pointing at a long-deleted node survived in the original export - empty the folder
first if you want a clean one.

## Verifying a change

The Chrome extension is not installed here. Use the Playwright browsers from another project:

```bash
PLAYWRIGHT_BROWSERS_PATH="C:/Users/zippy/AppData/Local/ms-playwright" node script.mjs
```

Install `playwright` (the library only) into a scratch directory with
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. Playwright's CSS engine **pierces open shadow roots**, so
ordinary selectors work against the backoffice. Log in at `#username-input` (type `text`, not
`email`) and `#password-input`, submit `#umb-login-button`, and wait for the form explicitly -
`isVisible()` does not wait and returns false before the page has rendered.

To call the API from a logged-in Playwright page without an API user, `fetch` from the page with
the header `Authorization: Bearer [redacted]` - literally that. The backoffice keeps its tokens in
HttpOnly cookies (`__Host-umbAccessToken`) and sends that placeholder, which the server swaps for
the cookie; a `fetch` without it gets a 401. Verified on 17.7.0.

For server-side checks, get a token with the `.env` client credentials against
`POST /umbraco/management/api/v1/security/back-office/token` (`grant_type=client_credentials`).
**A fresh clone has no API user** - uSync does not export users, so create one in the backoffice
first.

For database assertions the site runs on SQLite and there is no `sqlite3` CLI on this machine. Use a
file-based C# script - `dotnet run q.cs` with `#:package Microsoft.Data.Sqlite@10.0.10` on the first
line - and **stop the site first**, because it holds the file and a WAL. Note that file-based apps
disable reflection-based JSON by default; add
`#:property JsonSerializerIsReflectionEnabledByDefault=true` if you need it. Do not put such a script
under `src/Cms/`: the SDK globs it into the project and the build fails with
`CS9298: '#:' directives can be only used in file-based programs`.

**The Bash tool mangles backslashes and can inject control characters into heredocs.** `\\`
collapses to `\` even inside a quoted heredoc. Anything with awkward escaping should go through a
file write instead. Use forward slashes for Windows paths - .NET accepts them.

## Releasing

Version lives in `Directory.Build.props`. A published GitHub Release whose tag is the version
(`v1.0.0`, or `v1.0.0-rc.1` marked pre-release) triggers `.github/workflows/release.yml`, which
packs with `-p:Version=` from the tag and pushes to NuGet using **trusted publishing** - an OIDC
exchange, no API key. The nuget.org policy is keyed on the workflow **file name**, so `release.yml`
must not be renamed. Bump `Client/public/umbraco-package.json` too, and add to `CHANGELOG.md`.

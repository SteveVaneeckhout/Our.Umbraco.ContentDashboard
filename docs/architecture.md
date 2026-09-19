# Content Dashboard

> How this package works, and why. For getting it running locally see
> [development.md](development.md); for what it does for an editor see the
> [README](https://github.com/SteveVaneeckhout/Our.Umbraco.ContentDashboard#readme). Paths below are relative to `src/ContentDashboard/` unless stated otherwise.


A backoffice package for Umbraco 18 that helps a team of content editors keep track of who is
responsible for what. It adds three tabs to the **Content** section:

| Tab | Who sees it | What it does |
| --- | --- | --- |
| **My Content** | everyone with Content access | Every page you own, sortable by name or last-edited date, with the publish status of each. Select rows to claim them or hand them to someone else. |
| **Scheduled** | everyone with Content access | Your pages with a pending publish or unpublish date, soonest first. |
| **Ownership** | administrators only | Every user that owns content, with counts, and a one-click hand-over of everything a departing editor owned. |

Administrators also get an **Owner** filter on the first two tabs so they can look at anyone's list.

## What "owner" means

Umbraco has no separate owner concept, so this package treats the built-in **creator**
(`umbracoNode.nodeUser`, shown as *Created by* on a page's Info tab) as the owner. Transferring
ownership rewrites that field, and the change is immediately visible in the core Umbraco UI.

Transfers deliberately **do not** go through `IContentService.Save`. `Save` stamps `UpdateDate` and
`WriterId`, which would make every transferred page look freshly edited and destroy the
"how old is this page" signal that the My Content tab exists to show. Instead
`ContentOwnershipService` writes `umbracoNode.nodeUser` directly inside an Umbraco scope, filtered on
`nodeObjectType = Document` so nothing but documents can ever be touched, and then clears the
cached `IContent` instances.

**Known limitation:** that cache clear is local to the server that handled the request. In a
load-balanced setup the other servers keep showing the previous owner until their cache expires or
the app recycles.

## Layout

```
ContentDashboard/
  Composers/    DI registration and the package's OpenAPI document
  Controllers/  the backoffice API (see below)
  Services/     ContentOwnershipService - all reads and writes
  ViewModels/   request/response models
  Client/       TypeScript + Vite source for the backoffice UI
    src/lang/   the UI dictionaries, one file per language
  wwwroot/      Vite output, served at /App_Plugins/ContentDashboard (generated, not committed)
```

`StaticWebAssetBasePath` is `/`, so `wwwroot/App_Plugins/ContentDashboard/umbraco-package.json`
is served at `/App_Plugins/ContentDashboard/umbraco-package.json`, where Umbraco discovers it.

## API

All routes are under `/umbraco/contentdashboard/api/v1/` and require Content section access.

| Route | Purpose |
| --- | --- |
| `GET documents` | `ownerId`, `skip`, `take`, `orderBy` (`Name`/`UpdateDate`), `direction` |
| `GET scheduled` | `ownerId`, `allOwners`, `skip`, `take` |
| `GET owners` | every user owning ≥1 document, with counts |
| `POST transfer` | `{ documentIds, newOwnerId }` |
| `POST transfer-all` | `{ fromUserId, toUserId }` — **administrators only** |

`ownerId` defaults to the calling user. Browsable at `/umbraco/openapi` (document
`contentdashboard`).

## Working on the client

```bash
cd Client
npm install          # NOT --legacy-peer-deps: the TypeScript build needs lit/uui/rxjs, which are peers
npm run watch        # rebuild on change
npm run build        # one-off build
npm run generate-client   # regenerate src/api from the live OpenAPI doc (site must be running)
```

Two things to remember:

- Run `npm run generate-client` whenever a controller signature or view model changes. It reads
  `https://localhost:44366/umbraco/openapi/contentdashboard.json`, so the site has to be running.
- Bump `version` in `Client/public/umbraco-package.json` when you ship a change. Umbraco uses it as
  the cache-busting key (`?umb__rnd=`), so browsers keep serving the old bundle until it changes.

`dotnet build` runs the client build automatically **only** when the bundle is missing, so a fresh
clone works. Pass `-p:BuildClient=false` to skip that.

### Translating

All three dashboards are localized. `Client/src/lang/en.ts` is the source of truth; every other
language is a copy of it with the values translated, registered by a `type: "localization"` manifest
in `lang/manifest.ts`. Adding a language is those two edits and nothing else — no C# and no manifest
JSON. English (`en`) is Umbraco's default culture, so it is loaded whatever the editor's language is
and acts as the per-key fallback; never translate `en.ts` in place, and never give it a regional
culture like `en-us`, which would *not* be loaded alongside another language and would break the
fallback.

Two guards keep a translation honest, and both fail the build rather than the UI:

- Every non-English file is typed `Translation<ContentDashboardLocalizations>`, so a missing key is a
  `tsc` error instead of a string that silently renders in English.
- `npm run build` runs `scripts/check-lang.mjs` first, which fails if an element or a manifest
  references a `contentDashboard*` key that `en.ts` does not define. `tsc` cannot catch that, because
  `localize.term()` takes a plain string.

Dates and counts go through `this.localize` (`utils/format.ts` takes the controller, not a locale
string) so they follow the *backoffice* language. Reaching for `Intl` directly formats against the
browser's language instead, which is routinely a different one and shows no sign of having happened.

Counts are function entries (`(count: number) => …`) rather than an `(s)` suffix, so a language with
different plural rules can express them.

Nothing this package returns from C# is user-facing prose — the API's two `BadRequest` strings are
guards for states the UI cannot reach — so there is no server-side resource file here, unlike
ErrorDashboard and TrueCopy.

### Gotcha: pickers must be routed modals

`UmbModalManagerContext` force-closes every modal whose `router` is `null` whenever a
`navigationsuccess` event fires. The user picker embeds an `umb-collection`, whose own router fires
exactly that event while it initialises — so opening the picker with a plain `umbOpenModal` makes it
close itself a fraction of a second after opening (it visibly flashes). `registerUserPicker` in
`src/dashboards/shared.ts` therefore registers it through `UmbModalRouteRegistrationController`,
which gives the modal a router and a URL.

The same trap applies to ordering: the Ownership tab asks for confirmation *before* opening the
picker, because a confirm modal opened from the picker's `onSubmit` would be killed by the
navigation that closes the picker.

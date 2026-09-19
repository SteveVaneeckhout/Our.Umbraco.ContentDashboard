# Content Dashboard for Umbraco

[![NuGet](https://img.shields.io/nuget/v/Our.Umbraco.ContentDashboard?logo=nuget)](https://www.nuget.org/packages/Our.Umbraco.ContentDashboard)
[![Downloads](https://img.shields.io/nuget/dt/Our.Umbraco.ContentDashboard?logo=nuget)](https://www.nuget.org/packages/Our.Umbraco.ContentDashboard)
[![Umbraco 18](https://img.shields.io/badge/Umbraco-18-3544B1?logo=umbraco)](https://umbraco.com)
[![MIT](https://img.shields.io/badge/license-MIT-green)](https://github.com/SteveVaneeckhout/Our.Umbraco.ContentDashboard/blob/main/LICENSE)

**Who is responsible for which pages, and what is about to change.**

On a site with more than a couple of editors, two questions come up constantly and Umbraco answers
neither directly: *which pages am I responsible for?* and *who looked after all of this before they
left?* Content Dashboard adds three tabs to the **Content** section that answer both.

![The My Content tab: every page you own, with its type, publish status and how long since it was edited](https://raw.githubusercontent.com/SteveVaneeckhout/Our.Umbraco.ContentDashboard/main/docs/img/my-content.png)

*Every page you own, newest edits first. Administrators get the **Owner** filter as well, so they can
look at anyone's list — or select rows and hand them over.*

![The Scheduled tab: pending publish and unpublish dates, soonest first](https://raw.githubusercontent.com/SteveVaneeckhout/Our.Umbraco.ContentDashboard/main/docs/img/scheduled.png)

*Anything with a pending publish or unpublish date, soonest first, so a release never arrives
unnoticed.*

## Requirements

- Umbraco **18.x** (this package is deliberately pinned to `[18.2.0,19.0.0)`)
- .NET 10

## Install

```bash
dotnet add package Our.Umbraco.ContentDashboard
```

No configuration and nothing to register. Build, run, and open the Content section.

## What you get

| Tab | Who sees it | What it does |
| --- | --- | --- |
| **My Content** | everyone with Content access | Every page you own, sortable by name or last-edited date, with each page's publish status. Select rows to claim them, or hand them to someone else. |
| **Scheduled** | everyone with Content access | Your pages with a pending publish or unpublish date, soonest first — so a release date never arrives unnoticed. |
| **Ownership** | administrators only | Every user who owns content, with counts, and a one-click hand-over of everything a departing editor owned. |

Administrators also get an **Owner** filter on the first two tabs, so they can look at anyone's list.

## What "owner" means

Umbraco has no separate owner concept, so this package treats the built-in **creator** — the
*Created by* field on a page's Info tab — as the owner. Transferring ownership rewrites that field,
and the change is immediately visible in the standard Umbraco UI. There is no parallel bookkeeping
to drift out of step.

Transfers deliberately **do not** touch the page's *last edited* date or its writer. Going through
Umbraco's normal save would stamp both, which would make every transferred page look freshly edited
and destroy the "how stale is this page?" signal that the My Content tab exists to show. So a
transfer changes ownership and nothing else.

Every transfer is written to the Umbraco audit log.

## Known limitations

- **Load balancing.** After a transfer, the cache clear is local to the server that handled the
  request. Other servers keep showing the previous owner until their cache expires or the app
  recycles.
- **Ownership is the creator field.** If your editorial process already means something different by
  "created by", this package will mean that too.
- The package is **consume-only** — it has no configuration and no extension points.

## Localization

The whole UI is localized and ships with English and Dutch. Adding a language is one TypeScript
file: see [docs/architecture.md](https://github.com/SteveVaneeckhout/Our.Umbraco.ContentDashboard/blob/main/docs/architecture.md#translating). Dates and counts follow the
*backoffice* language, not the browser's.

## Documentation

- [Development setup](https://github.com/SteveVaneeckhout/Our.Umbraco.ContentDashboard/blob/main/docs/development.md) — clone, run, and work on the package
- [How it works](https://github.com/SteveVaneeckhout/Our.Umbraco.ContentDashboard/blob/main/docs/architecture.md) — the design decisions behind it
- [Changelog](https://github.com/SteveVaneeckhout/Our.Umbraco.ContentDashboard/blob/main/CHANGELOG.md)

## License

MIT. See [LICENSE](https://github.com/SteveVaneeckhout/Our.Umbraco.ContentDashboard/blob/main/LICENSE).

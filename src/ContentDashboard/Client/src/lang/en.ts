/**
 * Language Alias: en
 * Language Int Name: English
 * Language Local Name: English
 * Language Culture: en
 *
 * The source of truth for every user-facing string in this package, and the per-key fallback for
 * every other language: culture `en` is Umbraco's `UMB_DEFAULT_LOCALIZATION_CULTURE`, so the
 * registry loads it whatever the backoffice is set to. Never translate this file - copy it.
 *
 * One area per dashboard, plus a `Shared` area for the text that genuinely appears on more than one
 * of them. Every area is prefixed with the package name, because Umbraco flattens areas into a
 * single `area_key` namespace shared with core and with every other installed package.
 */
import type { UmbLocalizationDictionary } from "@umbraco-cms/backoffice/localization-api";

const en = {
  contentDashboardShared: {
    /** A document saved without a name. Parenthesised so it reads as a placeholder, not a title. */
    untitled: "(Untitled)",

    owner: "Owner",
    columnName: "Name",
    filterByOwner: "Filter by owner",

    /** How a user reads in the owner filter: their name, then how many pages they own. */
    ownerOption: (name: string, count: number) => `${name} (${count})`,
    me: "Me",

    transferredHeadline: "Ownership transferred",
    transferredMessage: (count: number) =>
      count === 1 ? "1 page moved to its new owner." : `${count} pages moved to their new owner.`,
  },

  contentDashboardMyContent: {
    // Used for both the dashboard tab and the box headline, which are deliberately the same words.
    label: "My Content",
    description: "Pages you own, newest edits first",

    columnType: "Type",
    columnStatus: "Status",
    columnLastEdited: "Last edited",

    selectedCount: (count: number) => `${count} selected`,
    assignToMe: "Assign to me",
    changeOwner: "Change owner…",
    totalPages: (count: number) => (count === 1 ? "1 page" : `${count} pages`),

    empty: "No pages are owned by this user.",

    statusDraft: "Draft",
    statusPendingChanges: "Pending changes",
    statusPublished: "Published",
  },

  contentDashboardScheduled: {
    label: "Scheduled",
    description: "Pending publish and unpublish dates, soonest first",

    columnAction: "What happens",
    columnWhen: "When",
    columnCulture: "Culture",

    actionPublish: "Publish",
    actionUnpublish: "Unpublish",

    /** Shown in the Culture column for a schedule that applies to every culture. */
    allCultures: "All",
    /** The owner filter's "no filter" option. */
    everyone: "Everyone",

    upcomingChanges: (count: number) =>
      count === 1 ? "1 upcoming change" : `${count} upcoming changes`,

    empty: "Nothing is scheduled to publish or unpublish.",
  },

  contentDashboardOwnership: {
    label: "Ownership",
    description: "Hand a departing editor's pages to someone else",
    note: "Transferring reassigns every page a user owns. It does not change when those pages were last edited.",

    columnEmail: "Email",
    columnPagesOwned: "Pages owned",

    refresh: "Refresh",
    transferAll: "Transfer all…",

    confirmHeadline: "Transfer all content?",
    confirmContent: (count: number, name: string) =>
      count === 1
        ? `The 1 page owned by ${name} will be handed to the user you pick next. This cannot be undone in one step.`
        : `All ${count} pages owned by ${name} will be handed to the user you pick next. This cannot be undone in one step.`,
    confirmLabel: "Choose new owner…",

    nothingToDoHeadline: "Nothing to do",
    nothingToDoMessage: "That is already the current owner.",

    empty: "No content is owned by anyone yet.",
  },
} as const;

export default en satisfies UmbLocalizationDictionary;

/** The shape every other language file must match. See `types.ts`. */
export type ContentDashboardLocalizations = typeof en;

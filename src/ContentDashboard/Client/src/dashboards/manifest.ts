const contentSectionCondition = {
  alias: "Umb.Condition.SectionAlias",
  match: "Umb.Section.Content",
} as const;

// Umbraco renders every dashboard registered against a section as a tab, so three manifests
// give three tabs without any routing of our own. Higher weight sorts first.
// Core runs meta.label through localize.string(), so a #-prefixed key resolves like any other term.
export const manifests: Array<UmbExtensionManifest> = [
  {
    name: "Content Dashboard My Content",
    alias: "ContentDashboard.MyContent",
    type: "dashboard",
    js: () => import("./my-content.element.js"),
    weight: 100,
    meta: {
      label: "#contentDashboardMyContent_label",
      pathname: "my-content",
    },
    conditions: [contentSectionCondition],
  },
  {
    name: "Content Dashboard Scheduled",
    alias: "ContentDashboard.Scheduled",
    type: "dashboard",
    js: () => import("./scheduled.element.js"),
    weight: 90,
    meta: {
      label: "#contentDashboardScheduled_label",
      pathname: "scheduled",
    },
    conditions: [contentSectionCondition],
  },
  {
    name: "Content Dashboard Ownership",
    alias: "ContentDashboard.Ownership",
    type: "dashboard",
    js: () => import("./ownership.element.js"),
    weight: 80,
    meta: {
      label: "#contentDashboardOwnership_label",
      pathname: "ownership",
    },
    // Bulk reassignment is destructive, so non-admins never see the tab. The
    // transfer-all endpoint enforces the same rule server-side.
    conditions: [contentSectionCondition, { alias: "Umb.Condition.CurrentUser.IsAdmin" }],
  },
];

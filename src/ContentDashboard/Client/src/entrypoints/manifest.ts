export const manifests: Array<UmbExtensionManifest> = [
  {
    name: "Content Dashboard Entrypoint",
    alias: "ContentDashboard.Entrypoint",
    type: "backofficeEntryPoint",
    js: () => import("./entrypoint.js"),
  },
];

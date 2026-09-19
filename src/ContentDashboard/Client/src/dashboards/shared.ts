import { css } from "@umbraco-cms/backoffice/external/lit";
import { UMB_USER_COLLECTION_ALIAS, UMB_USER_PICKER_MODAL } from "@umbraco-cms/backoffice/user";
import { UmbModalRouteRegistrationController } from "@umbraco-cms/backoffice/router";
import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";

/** How many rows each dashboard requests per page. */
export const PAGE_SIZE = 50;

/**
 * Registers the core user picker as a *routed* modal and returns the registration.
 *
 * It has to be routed. `UmbModalManagerContext` force-closes every modal whose `router` is null
 * whenever a `navigationsuccess` event fires, and the user picker contains an `umb-collection`
 * whose own router fires exactly that event as it initialises - so a modal opened with a plain
 * `umbOpenModal` closes itself a moment after opening. Registering a route gives the modal a
 * router, which also makes it survive a browser back/forward.
 *
 * @param host the element the modal belongs to
 * @param paths extra path segments, e.g. `':fromUserId'`, readable from `onSetup` params
 * @param onPicked called with the chosen user's unique, plus the route params
 */
export function registerUserPicker(
  host: UmbControllerHost,
  paths: string,
  onPicked: (unique: string, params: Record<string, string>) => void,
) {
  let routeParams: Record<string, string> = {};

  return new UmbModalRouteRegistrationController(host, UMB_USER_PICKER_MODAL)
    .addAdditionalPath(paths)
    .onSetup((params) => {
      routeParams = params as Record<string, string>;
      return {
        data: { multiple: false, collection: { alias: UMB_USER_COLLECTION_ALIAS } },
        value: { selection: [] },
      };
    })
    .onSubmit((value) => {
      const unique = value?.selection?.find((entry): entry is string => !!entry);
      if (unique) onPicked(unique, routeParams);
    });
}

/**
 * Layout shared by all three Content Dashboard tabs.
 *
 * Structured like the Examine management dashboard: the uui-box keeps its default padding and the
 * table sits inside that padding rather than bleeding to the container edges. The scroll container
 * is what keeps a wide table from pushing the box out at narrow widths.
 */
export const sharedDashboardStyles = css`
  :host {
    display: block;
    padding: var(--uui-size-layout-1);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--uui-size-space-3);
    margin-bottom: var(--uui-size-space-5);
  }

  .toolbar .spacer {
    flex: 1 1 auto;
  }

  .toolbar label {
    font-size: var(--uui-type-small-size);
    color: var(--uui-color-text-alt);
  }

  .table-container {
    display: flex;
    align-items: flex-start;
  }

  .table-container uui-scroll-container {
    flex: 1;
    max-width: 100%;
    overflow-x: auto;
  }

  umb-table {
    display: block;
  }

  .state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--uui-size-space-3);
    padding: var(--uui-size-layout-2) 0;
    color: var(--uui-color-text-alt);
    text-align: center;
  }

  .footer {
    display: flex;
    justify-content: center;
    margin-top: var(--uui-size-space-5);
  }

  .muted {
    color: var(--uui-color-text-alt);
  }

  .count {
    font-variant-numeric: tabular-nums;
  }
`;

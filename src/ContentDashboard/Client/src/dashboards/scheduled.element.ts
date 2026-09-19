import { getOwners, getScheduled } from "../api/index.js";
import type { ContentOwnerResponseModel, ScheduledDocumentResponseModel } from "../api/index.js";
import { formatAbsolute, formatRelative } from "../utils/format.js";
import { PAGE_SIZE, sharedDashboardStyles } from "./shared.js";
import { css, customElement, html, nothing, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { tryExecute } from "@umbraco-cms/backoffice/resources";
import { UMB_CURRENT_USER_CONTEXT } from "@umbraco-cms/backoffice/current-user";
import { UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN } from "@umbraco-cms/backoffice/document";
import type { UmbTableColumn, UmbTableConfig, UmbTableItem } from "@umbraco-cms/backoffice/components";

/** Sentinel value for the "everyone" option in the owner filter. */
const ALL_OWNERS = "__all__";

@customElement("content-dashboard-scheduled")
export class ContentDashboardScheduledElement extends UmbLitElement {
  @state() private _schedules: Array<ScheduledDocumentResponseModel> = [];
  @state() private _total = 0;
  @state() private _page = 1;
  @state() private _loading = true;

  /** Either a user unique, or ALL_OWNERS. Undefined until the current user resolves. */
  @state() private _ownerFilter?: string;
  @state() private _currentUserUnique?: string;
  @state() private _isAdmin = false;
  @state() private _owners: Array<ContentOwnerResponseModel> = [];

  constructor() {
    super();

    this.consumeContext(UMB_CURRENT_USER_CONTEXT, (context) => {
      this.observe(
        context?.currentUser,
        (currentUser) => {
          if (!currentUser) return;
          this._isAdmin = currentUser.isAdmin;
          this._currentUserUnique = currentUser.unique;
          this._ownerFilter ??= currentUser.unique;
          this.#loadSchedules();
          if (this._isAdmin) this.#loadOwners();
        },
        "_contentDashboardScheduledCurrentUser",
      );
    });
  }

  async #loadSchedules() {
    if (!this._ownerFilter) return;

    this._loading = true;

    const allOwners = this._ownerFilter === ALL_OWNERS;
    const { data } = await tryExecute(
      this,
      getScheduled({
        query: {
          allOwners,
          ownerId: allOwners ? undefined : this._ownerFilter,
          skip: (this._page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        },
      }),
      { disableNotifications: false },
    );

    this._schedules = data?.items ?? [];
    this._total = data?.total ?? 0;
    this._loading = false;
  }

  async #loadOwners() {
    const { data } = await tryExecute(this, getOwners());
    this._owners = data ?? [];
  }

  #onOwnerFilterChange = (event: Event) => {
    this._ownerFilter = (event.target as HTMLSelectElement).value;
    this._page = 1;
    this.#loadSchedules();
  };

  #onPageChange = (event: Event) => {
    this._page = (event.target as HTMLElement & { current: number }).current;
    this.#loadSchedules();
  };

  get #tableConfig(): UmbTableConfig {
    return { allowSelection: false };
  }

  get #tableColumns(): Array<UmbTableColumn> {
    const columns: Array<UmbTableColumn> = [
      { name: this.localize.term("contentDashboardShared_columnName"), alias: "name" },
      { name: this.localize.term("contentDashboardScheduled_columnAction"), alias: "action" },
      { name: this.localize.term("contentDashboardScheduled_columnWhen"), alias: "date" },
      { name: this.localize.term("contentDashboardScheduled_columnCulture"), alias: "culture" },
    ];

    if (this._ownerFilter === ALL_OWNERS) {
      columns.push({ name: this.localize.term("contentDashboardShared_owner"), alias: "owner" });
    }

    return columns;
  }

  get #tableItems(): Array<UmbTableItem> {
    return this._schedules.map((schedule, index) => ({
      // A document can hold both a publish and an unpublish schedule, so the document id
      // alone is not unique across rows.
      id: `${schedule.id}-${schedule.action}-${index}`,
      icon: "icon-alarm-clock",
      data: [
        {
          columnAlias: "name",
          value: html`<uui-button
            compact
            look="default"
            href=${UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN.generateAbsolute({ unique: schedule.id })}
            label=${schedule.name || this.localize.term("contentDashboardShared_untitled")}></uui-button>`,
        },
        {
          columnAlias: "action",
          value:
            schedule.action === "Unpublish"
              ? html`<uui-tag color="warning" look="secondary"
                  >${this.localize.term("contentDashboardScheduled_actionUnpublish")}</uui-tag
                >`
              : html`<uui-tag color="positive" look="secondary"
                  >${this.localize.term("contentDashboardScheduled_actionPublish")}</uui-tag
                >`,
        },
        {
          columnAlias: "date",
          value: html`<span title=${formatAbsolute(this.localize, schedule.date)}>
            ${formatAbsolute(this.localize, schedule.date)}
            <span class="muted">(${formatRelative(this.localize, schedule.date)})</span>
          </span>`,
        },
        {
          columnAlias: "culture",
          value: html`<span class="muted"
            >${schedule.culture ?? this.localize.term("contentDashboardScheduled_allCultures")}</span
          >`,
        },
        {
          columnAlias: "owner",
          value: html`<span class="muted">${schedule.owner?.name ?? "—"}</span>`,
        },
      ],
    }));
  }

  #renderToolbar() {
    return html`
      <div class="toolbar">
        ${this._isAdmin ? this.#renderOwnerFilter() : nothing}
        <span class="spacer"></span>
        <span class="muted count"
          >${this.localize.term("contentDashboardScheduled_upcomingChanges", this._total)}</span
        >
      </div>
    `;
  }

  #renderOwnerFilter() {
    const owners = this._owners.map((owner) => ({
      name: this.localize.term("contentDashboardShared_ownerOption", owner.name, owner.documentCount),
      value: owner.id,
      selected: owner.id === this._ownerFilter,
    }));

    // /owners only lists users who own something, so an admin owning nothing would otherwise
    // have no option matching the filter and the select would show someone else's name.
    if (this._currentUserUnique && !owners.some((option) => option.value === this._currentUserUnique)) {
      owners.unshift({
        name: this.localize.term(
          "contentDashboardShared_ownerOption",
          this.localize.term("contentDashboardShared_me"),
          0,
        ),
        value: this._currentUserUnique,
        selected: this._ownerFilter === this._currentUserUnique,
      });
    }

    const options = [
      {
        name: this.localize.term("contentDashboardScheduled_everyone"),
        value: ALL_OWNERS,
        selected: this._ownerFilter === ALL_OWNERS,
      },
      ...owners,
    ];

    return html`
      <label for="scheduled-owner-filter">${this.localize.term("contentDashboardShared_owner")}</label>
      <uui-select
        id="scheduled-owner-filter"
        label=${this.localize.term("contentDashboardShared_filterByOwner")}
        .value=${this._ownerFilter ?? ""}
        .options=${options}
        @change=${this.#onOwnerFilterChange}></uui-select>
    `;
  }

  #renderBody() {
    if (this._loading) {
      return html`<div class="state"><uui-loader></uui-loader></div>`;
    }

    if (!this._schedules.length) {
      return html`<div class="state">
        <span>${this.localize.term("contentDashboardScheduled_empty")}</span>
      </div>`;
    }

    return html`
      <div class="table-container">
        <uui-scroll-container>
          <umb-table
            .config=${this.#tableConfig}
            .columns=${this.#tableColumns}
            .items=${this.#tableItems}></umb-table>
        </uui-scroll-container>
      </div>
    `;
  }

  #renderPagination() {
    const totalPages = Math.ceil(this._total / PAGE_SIZE);
    if (totalPages <= 1) return nothing;

    return html`<div class="footer">
      <uui-pagination
        .current=${this._page}
        .total=${totalPages}
        @change=${this.#onPageChange}></uui-pagination>
    </div>`;
  }

  override render() {
    return html`
      <uui-box headline=${this.localize.term("contentDashboardScheduled_label")}>
        <div slot="header-actions" class="muted">
          ${this.localize.term("contentDashboardScheduled_description")}
        </div>
        ${this.#renderToolbar()} ${this.#renderBody()} ${this.#renderPagination()}
      </uui-box>
    `;
  }

  static override styles = [
    UmbTextStyles,
    sharedDashboardStyles,
    css`
      uui-select {
        min-width: 220px;
      }
    `,
  ];
}

export default ContentDashboardScheduledElement;

declare global {
  interface HTMLElementTagNameMap {
    "content-dashboard-scheduled": ContentDashboardScheduledElement;
  }
}

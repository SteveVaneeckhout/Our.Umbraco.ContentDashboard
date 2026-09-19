import { getDocuments, getOwners, postTransfer } from "../api/index.js";
import type {
  ContentOwnerResponseModel,
  OwnedDocumentResponseModel,
  OwnedDocumentSortField,
  SortDirection,
} from "../api/index.js";
import { formatAbsolute, formatRelative } from "../utils/format.js";
import { PAGE_SIZE, registerUserPicker, sharedDashboardStyles } from "./shared.js";
import { css, customElement, html, nothing, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { tryExecute } from "@umbraco-cms/backoffice/resources";
import { UMB_CURRENT_USER_CONTEXT } from "@umbraco-cms/backoffice/current-user";
import { UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN } from "@umbraco-cms/backoffice/document";
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";
import type {
  UmbTableColumn,
  UmbTableConfig,
  UmbTableElement,
  UmbTableItem,
} from "@umbraco-cms/backoffice/components";

/** Maps a table column alias onto the sort field the API understands. */
const SORT_FIELD_BY_ALIAS: Record<string, OwnedDocumentSortField> = {
  name: "Name",
  updateDate: "UpdateDate",
};

@customElement("content-dashboard-my-content")
export class ContentDashboardMyContentElement extends UmbLitElement {
  @state() private _documents: Array<OwnedDocumentResponseModel> = [];
  @state() private _total = 0;
  @state() private _page = 1;
  @state() private _orderingColumn = "updateDate";
  @state() private _orderingDesc = true;
  @state() private _selection: Array<string> = [];
  @state() private _loading = true;

  /** The owner whose content is listed. Undefined until the current user resolves. */
  @state() private _ownerUnique?: string;
  @state() private _currentUserUnique?: string;
  @state() private _isAdmin = false;
  @state() private _owners: Array<ContentOwnerResponseModel> = [];

  #notificationContext?: typeof UMB_NOTIFICATION_CONTEXT.TYPE;
  #userPicker;

  constructor() {
    super();

    this.#userPicker = registerUserPicker(this, "change-owner", (unique) => this.#transferTo(unique));

    this.consumeContext(UMB_NOTIFICATION_CONTEXT, (context) => {
      this.#notificationContext = context;
    });

    this.consumeContext(UMB_CURRENT_USER_CONTEXT, (context) => {
      this.observe(
        context?.currentUser,
        (currentUser) => {
          if (!currentUser) return;
          this._currentUserUnique = currentUser.unique;
          this._isAdmin = currentUser.isAdmin;
          // Only default the filter the first time - don't stomp on a filter the editor chose.
          this._ownerUnique ??= currentUser.unique;
          this.#loadDocuments();
          if (this._isAdmin) this.#loadOwners();
        },
        "_contentDashboardCurrentUser",
      );
    });
  }

  async #loadDocuments() {
    if (!this._ownerUnique) return;

    this._loading = true;

    const { data } = await tryExecute(
      this,
      getDocuments({
        query: {
          ownerId: this._ownerUnique,
          skip: (this._page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          orderBy: SORT_FIELD_BY_ALIAS[this._orderingColumn] ?? "UpdateDate",
          direction: (this._orderingDesc ? "Descending" : "Ascending") satisfies SortDirection,
        },
      }),
      { disableNotifications: false },
    );

    this._documents = data?.items ?? [];
    this._total = data?.total ?? 0;
    this._selection = [];
    this._loading = false;
  }

  async #loadOwners() {
    const { data } = await tryExecute(this, getOwners());
    this._owners = data ?? [];
  }

  async #transferTo(newOwnerId: string) {
    const documentIds = [...this._selection];
    if (!documentIds.length) return;

    const { data } = await tryExecute(
      this,
      postTransfer({ body: { documentIds, newOwnerId } }),
      { disableNotifications: false },
    );

    if (!data) return;

    this.#notificationContext?.peek("positive", {
      data: {
        headline: this.localize.term("contentDashboardShared_transferredHeadline"),
        message: this.localize.term("contentDashboardShared_transferredMessage", data.affectedCount),
      },
    });

    // Ownership counts feed the admin filter, so they are stale too.
    if (this._isAdmin) this.#loadOwners();
    await this.#loadDocuments();
  }

  #onAssignToMe = () => {
    if (this._currentUserUnique) this.#transferTo(this._currentUserUnique);
  };

  #onAssignToOther = () => {
    this.#userPicker.open({});
  };

  #onOwnerFilterChange = (event: Event) => {
    const value = (event.target as HTMLSelectElement).value;
    this._ownerUnique = value || this._currentUserUnique;
    this._page = 1;
    this.#loadDocuments();
  };

  #onOrdered = (event: Event) => {
    const table = event.target as UmbTableElement;
    this._orderingColumn = table.orderingColumn;
    this._orderingDesc = table.orderingDesc;
    this._page = 1;
    this.#loadDocuments();
  };

  #onSelectionChange = (event: Event) => {
    this._selection = [...(event.target as UmbTableElement).selection];
  };

  #onPageChange = (event: Event) => {
    this._page = (event.target as HTMLElement & { current: number }).current;
    this.#loadDocuments();
  };

  get #tableConfig(): UmbTableConfig {
    return { allowSelection: true, allowSelectAll: true };
  }

  get #tableColumns(): Array<UmbTableColumn> {
    return [
      { name: this.localize.term("contentDashboardShared_columnName"), alias: "name", allowSorting: true },
      { name: this.localize.term("contentDashboardMyContent_columnType"), alias: "contentTypeAlias" },
      { name: this.localize.term("contentDashboardMyContent_columnStatus"), alias: "status" },
      {
        name: this.localize.term("contentDashboardMyContent_columnLastEdited"),
        alias: "updateDate",
        allowSorting: true,
      },
    ];
  }

  get #tableItems(): Array<UmbTableItem> {
    return this._documents.map((document) => ({
      id: document.id,
      icon: document.icon ?? "icon-document",
      data: [
        {
          columnAlias: "name",
          value: html`<uui-button
            compact
            look="default"
            href=${UMB_EDIT_DOCUMENT_WORKSPACE_PATH_PATTERN.generateAbsolute({ unique: document.id })}
            label=${document.name || this.localize.term("contentDashboardShared_untitled")}></uui-button>`,
        },
        { columnAlias: "contentTypeAlias", value: html`<span class="muted">${document.contentTypeAlias}</span>` },
        { columnAlias: "status", value: this.#renderStatus(document) },
        {
          columnAlias: "updateDate",
          value: html`<span title=${formatAbsolute(this.localize, document.updateDate)}>
            ${formatRelative(this.localize, document.updateDate)}
          </span>`,
        },
      ],
    }));
  }

  #renderToolbar() {
    const selected = this._selection.length;

    return html`
      <div class="toolbar">
        ${this._isAdmin ? this.#renderOwnerFilter() : nothing}
        <span class="spacer"></span>
        ${selected
          ? html`<span class="muted count"
                >${this.localize.term("contentDashboardMyContent_selectedCount", selected)}</span
              >
              <uui-button
                look="secondary"
                label=${this.localize.term("contentDashboardMyContent_assignToMe")}
                @click=${this.#onAssignToMe}></uui-button>
              <uui-button
                look="primary"
                color="positive"
                label=${this.localize.term("contentDashboardMyContent_changeOwner")}
                @click=${this.#onAssignToOther}></uui-button>`
          : html`<span class="muted count"
              >${this.localize.term("contentDashboardMyContent_totalPages", this._total)}</span
            >`}
      </div>
    `;
  }

  #renderOwnerFilter() {
    const options = this._owners.map((owner) => ({
      name: this.localize.term("contentDashboardShared_ownerOption", owner.name, owner.documentCount),
      value: owner.id,
      selected: owner.id === this._ownerUnique,
    }));

    // /owners only lists users who own something, so an admin owning nothing would otherwise
    // have no option matching the filter and the select would show someone else's name.
    if (this._currentUserUnique && !options.some((option) => option.value === this._currentUserUnique)) {
      options.unshift({
        name: this.localize.term(
          "contentDashboardShared_ownerOption",
          this.localize.term("contentDashboardShared_me"),
          0,
        ),
        value: this._currentUserUnique,
        selected: this._ownerUnique === this._currentUserUnique,
      });
    }

    return html`
      <label for="owner-filter">${this.localize.term("contentDashboardShared_owner")}</label>
      <uui-select
        id="owner-filter"
        label=${this.localize.term("contentDashboardShared_filterByOwner")}
        .value=${this._ownerUnique ?? ""}
        .options=${options}
        @change=${this.#onOwnerFilterChange}></uui-select>
    `;
  }

  #renderBody() {
    if (this._loading) {
      return html`<div class="state"><uui-loader></uui-loader></div>`;
    }

    if (!this._documents.length) {
      return html`<div class="state">
        <span>${this.localize.term("contentDashboardMyContent_empty")}</span>
      </div>`;
    }

    return html`
      <div class="table-container">
        <uui-scroll-container>
          <umb-table
            .config=${this.#tableConfig}
            .columns=${this.#tableColumns}
            .items=${this.#tableItems}
            .selection=${this._selection}
            .orderingColumn=${this._orderingColumn}
            .orderingDesc=${this._orderingDesc}
            @ordered=${this.#onOrdered}
            @selected=${this.#onSelectionChange}
            @deselected=${this.#onSelectionChange}></umb-table>
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
      <uui-box headline=${this.localize.term("contentDashboardMyContent_label")}>
        <div slot="header-actions" class="muted">
          ${this.localize.term("contentDashboardMyContent_description")}
        </div>
        ${this.#renderToolbar()} ${this.#renderBody()} ${this.#renderPagination()}
      </uui-box>
    `;
  }

  /**
   * A method rather than a module-level function, because a status tag is text and text needs the
   * element's localization controller.
   */
  #renderStatus(document: OwnedDocumentResponseModel) {
    if (!document.published) {
      return html`<uui-tag color="danger" look="secondary"
        >${this.localize.term("contentDashboardMyContent_statusDraft")}</uui-tag
      >`;
    }

    return document.edited
      ? html`<uui-tag color="warning" look="secondary"
          >${this.localize.term("contentDashboardMyContent_statusPendingChanges")}</uui-tag
        >`
      : html`<uui-tag color="positive" look="secondary"
          >${this.localize.term("contentDashboardMyContent_statusPublished")}</uui-tag
        >`;
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

export default ContentDashboardMyContentElement;

declare global {
  interface HTMLElementTagNameMap {
    "content-dashboard-my-content": ContentDashboardMyContentElement;
  }
}

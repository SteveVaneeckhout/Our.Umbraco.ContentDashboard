import { getOwners, postTransferAll } from "../api/index.js";
import type { ContentOwnerResponseModel } from "../api/index.js";
import { registerUserPicker, sharedDashboardStyles } from "./shared.js";
import { css, customElement, html, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { tryExecute } from "@umbraco-cms/backoffice/resources";
import { umbConfirmModal } from "@umbraco-cms/backoffice/modal";
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";
import type { UmbTableColumn, UmbTableConfig, UmbTableItem } from "@umbraco-cms/backoffice/components";

@customElement("content-dashboard-ownership")
export class ContentDashboardOwnershipElement extends UmbLitElement {
  @state() private _owners: Array<ContentOwnerResponseModel> = [];
  @state() private _loading = true;

  #notificationContext?: typeof UMB_NOTIFICATION_CONTEXT.TYPE;
  #userPicker;

  constructor() {
    super();

    // The departing user travels in the route, so the picker survives a refresh mid-flow.
    this.#userPicker = registerUserPicker(this, ":fromUserId", (toUserId, params) =>
      this.#transferAll(params.fromUserId, toUserId),
    );

    this.consumeContext(UMB_NOTIFICATION_CONTEXT, (context) => {
      this.#notificationContext = context;
    });
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#loadOwners();
  }

  async #loadOwners() {
    this._loading = true;
    const { data } = await tryExecute(this, getOwners(), { disableNotifications: false });
    this._owners = data ?? [];
    this._loading = false;
  }

  async #onTransferAll(owner: ContentOwnerResponseModel) {
    // Confirm before the picker rather than after it: the picker is a routed modal, so submitting
    // it triggers a navigation, and a confirm opened in that same moment would be closed again by
    // the modal manager. Asking first is also the safer order for a destructive bulk action.
    const confirmed = await umbConfirmModal(this, {
      headline: this.localize.term("contentDashboardOwnership_confirmHeadline"),
      content: this.localize.term(
        "contentDashboardOwnership_confirmContent",
        owner.documentCount,
        owner.name,
      ),
      confirmLabel: this.localize.term("contentDashboardOwnership_confirmLabel"),
      color: "danger",
    })
      .then(() => true)
      .catch(() => false);

    if (!confirmed) return;

    this.#userPicker.open({ fromUserId: owner.id });
  }

  async #transferAll(fromUserId: string, toUserId: string) {
    if (fromUserId === toUserId) {
      this.#notificationContext?.peek("warning", {
        data: {
          headline: this.localize.term("contentDashboardOwnership_nothingToDoHeadline"),
          message: this.localize.term("contentDashboardOwnership_nothingToDoMessage"),
        },
      });
      return;
    }

    const { data } = await tryExecute(this, postTransferAll({ body: { fromUserId, toUserId } }), {
      disableNotifications: false,
    });

    if (!data) return;

    this.#notificationContext?.peek("positive", {
      data: {
        headline: this.localize.term("contentDashboardShared_transferredHeadline"),
        message: this.localize.term("contentDashboardShared_transferredMessage", data.affectedCount),
      },
    });

    await this.#loadOwners();
  }

  get #tableConfig(): UmbTableConfig {
    return { allowSelection: false };
  }

  get #tableColumns(): Array<UmbTableColumn> {
    return [
      { name: this.localize.term("contentDashboardShared_owner"), alias: "name" },
      { name: this.localize.term("contentDashboardOwnership_columnEmail"), alias: "email" },
      {
        name: this.localize.term("contentDashboardOwnership_columnPagesOwned"),
        alias: "documentCount",
        align: "right",
      },
      // Deliberately unlabelled - the actions column needs no heading, so there is nothing to translate.
      { name: "", alias: "actions", align: "right" },
    ];
  }

  get #tableItems(): Array<UmbTableItem> {
    return this._owners.map((owner) => ({
      id: owner.id,
      icon: "icon-user",
      data: [
        { columnAlias: "name", value: owner.name },
        { columnAlias: "email", value: html`<span class="muted">${owner.email ?? "—"}</span>` },
        {
          columnAlias: "documentCount",
          value: html`<span class="count">${this.localize.number(owner.documentCount)}</span>`,
        },
        {
          columnAlias: "actions",
          value: html`<uui-button
            look="secondary"
            compact
            label=${this.localize.term("contentDashboardOwnership_transferAll")}
            @click=${() => this.#onTransferAll(owner)}></uui-button>`,
        },
      ],
    }));
  }

  #renderBody() {
    if (this._loading) {
      return html`<div class="state"><uui-loader></uui-loader></div>`;
    }

    if (!this._owners.length) {
      return html`<div class="state">
        <span>${this.localize.term("contentDashboardOwnership_empty")}</span>
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

  override render() {
    return html`
      <uui-box headline=${this.localize.term("contentDashboardOwnership_label")}>
        <div slot="header-actions" class="muted">
          ${this.localize.term("contentDashboardOwnership_description")}
        </div>
        <div class="toolbar">
          <span class="muted">${this.localize.term("contentDashboardOwnership_note")}</span>
          <span class="spacer"></span>
          <uui-button
            look="secondary"
            compact
            label=${this.localize.term("contentDashboardOwnership_refresh")}
            @click=${this.#loadOwners}></uui-button>
        </div>
        ${this.#renderBody()}
      </uui-box>
    `;
  }

  static override styles = [
    UmbTextStyles,
    sharedDashboardStyles,
    css`
      .toolbar span.muted {
        max-width: 60ch;
      }
    `,
  ];
}

export default ContentDashboardOwnershipElement;

declare global {
  interface HTMLElementTagNameMap {
    "content-dashboard-ownership": ContentDashboardOwnershipElement;
  }
}

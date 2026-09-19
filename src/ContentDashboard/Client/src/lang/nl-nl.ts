/**
 * Language Alias: nl-nl
 * Language Int Name: Dutch (NL)
 * Language Local Name: Nederlands (NL)
 * Language Culture: nl-NL
 *
 * Typed as `Translation<ContentDashboardLocalizations>`, so leaving a key out of this file is a
 * build error rather than a silent fall back to English.
 */
import type { UmbLocalizationDictionary } from "@umbraco-cms/backoffice/localization-api";
import type { ContentDashboardLocalizations } from "./en.js";
import type { Translation } from "./types.js";

const nl: Translation<ContentDashboardLocalizations> = {
  contentDashboardShared: {
    untitled: "(Naamloos)",

    owner: "Eigenaar",
    columnName: "Naam",
    filterByOwner: "Filter op eigenaar",

    ownerOption: (name: string, count: number) => `${name} (${count})`,
    me: "Ik",

    transferredHeadline: "Eigendom overgedragen",
    transferredMessage: (count: number) =>
      count === 1
        ? "1 pagina is naar de nieuwe eigenaar verplaatst."
        : `${count} pagina's zijn naar hun nieuwe eigenaar verplaatst.`,
  },

  contentDashboardMyContent: {
    label: "Mijn inhoud",
    description: "Pagina's die je bezit, laatst bewerkt eerst",

    columnType: "Type",
    columnStatus: "Status",
    columnLastEdited: "Laatst bewerkt",

    selectedCount: (count: number) => `${count} geselecteerd`,
    assignToMe: "Aan mij toewijzen",
    changeOwner: "Eigenaar wijzigen…",
    totalPages: (count: number) => (count === 1 ? "1 pagina" : `${count} pagina's`),

    empty: "Deze gebruiker bezit geen pagina's.",

    statusDraft: "Concept",
    statusPendingChanges: "Openstaande wijzigingen",
    statusPublished: "Gepubliceerd",
  },

  contentDashboardScheduled: {
    label: "Ingepland",
    description: "Geplande publicatie- en depublicatiedatums, eerstvolgende eerst",

    columnAction: "Wat er gebeurt",
    columnWhen: "Wanneer",
    columnCulture: "Taal",

    actionPublish: "Publiceren",
    actionUnpublish: "Depubliceren",

    allCultures: "Alle",
    everyone: "Iedereen",

    upcomingChanges: (count: number) =>
      count === 1 ? "1 komende wijziging" : `${count} komende wijzigingen`,

    empty: "Er staat niets ingepland om te publiceren of te depubliceren.",
  },

  contentDashboardOwnership: {
    label: "Eigendom",
    description: "Draag de pagina's van een vertrekkende redacteur over aan iemand anders",
    note: "Overdragen wijst elke pagina die een gebruiker bezit opnieuw toe. Het verandert niets aan wanneer die pagina's voor het laatst zijn bewerkt.",

    columnEmail: "E-mail",
    columnPagesOwned: "Pagina's in bezit",

    refresh: "Vernieuwen",
    transferAll: "Alles overdragen…",

    confirmHeadline: "Alle inhoud overdragen?",
    confirmContent: (count: number, name: string) =>
      count === 1
        ? `De ene pagina van ${name} wordt overgedragen aan de gebruiker die je hierna kiest. Dit kan niet in één stap ongedaan worden gemaakt.`
        : `Alle ${count} pagina's van ${name} worden overgedragen aan de gebruiker die je hierna kiest. Dit kan niet in één stap ongedaan worden gemaakt.`,
    confirmLabel: "Nieuwe eigenaar kiezen…",

    nothingToDoHeadline: "Niets te doen",
    nothingToDoMessage: "Dat is al de huidige eigenaar.",

    empty: "Nog niemand bezit inhoud.",
  },
};

export default nl satisfies UmbLocalizationDictionary;

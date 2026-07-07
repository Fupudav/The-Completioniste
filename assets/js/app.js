import { HLTB_TIMES, HLTB_UPDATED_AT } from "../data/hltb-times.js";
import { RAW_CATALOG } from "../data/catalog.js";
import { SCOPE_LABELS } from "./constants.js";
import { hydrateCatalog } from "./catalog.js";
import { createDefaultFilters } from "./filters.js";
import {
  createBackup,
  createBaseState,
  ensureProgress,
  getProgress,
  loadState,
  restoreBackup,
  saveState
} from "./state.js";
import { escapeAttr, escapeHtml } from "./utils.js";
import { renderApp } from "./render.js";
import {
  addCustomGame,
  exportData,
  fillScopeSelects,
  importData,
  openEditGameDialog,
  openGameDialog,
  resetData,
  saveGameEdits
} from "./dialogs.js";
import { registerServiceWorker } from "./pwa.js";

const app = {
  state: loadState(),
  catalog: [],
  allGames: [],
  filters: createDefaultFilters(),
  activeTab: "sagas"
};

const refs = {
  statGrid: document.querySelector("#statGrid"),
  genreBars: document.querySelector("#genreBars"),
  nextList: document.querySelector("#nextList"),
  overallMeter: document.querySelector("#overallMeter"),
  overallValue: document.querySelector("#overallValue"),
  tabButtons: document.querySelectorAll("[data-tab]"),
  views: document.querySelectorAll("[data-view]"),
  sagaList: document.querySelector("#sagaList"),
  flatGameList: document.querySelector("#flatGameList"),
  flatCatalogMeta: document.querySelector("#flatCatalogMeta"),
  statsDashboard: document.querySelector("#statsDashboard"),
  catalogMeta: document.querySelector("#catalogMeta"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  scopeFilter: document.querySelector("#scopeFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  hideDone: document.querySelector("#hideDone"),
  hideUpcoming: document.querySelector("#hideUpcoming"),
  onlyOwned: document.querySelector("#onlyOwned"),
  onlyNext: document.querySelector("#onlyNext"),
  exportBtn: document.querySelector("#exportBtn"),
  importFile: document.querySelector("#importFile"),
  resetBtn: document.querySelector("#resetBtn"),
  addGameBtn: document.querySelector("#addGameBtn"),
  collapseBtn: document.querySelector("#collapseBtn"),
  settingsAddGameBtn: document.querySelector("#settingsAddGameBtn"),
  settingsExportBtn: document.querySelector("#settingsExportBtn"),
  settingsCollapseBtn: document.querySelector("#settingsCollapseBtn"),
  settingsResetBtn: document.querySelector("#settingsResetBtn"),
  settingsBackupBtn: document.querySelector("#settingsBackupBtn"),
  backupList: document.querySelector("#backupList"),
  backupMeta: document.querySelector("#backupMeta"),
  diagnosticsPanel: document.querySelector("#diagnosticsPanel"),
  gameDialog: document.querySelector("#gameDialog"),
  gameForm: document.querySelector("#gameForm"),
  closeDialogBtn: document.querySelector("#closeDialogBtn"),
  cancelDialogBtn: document.querySelector("#cancelDialogBtn"),
  newCategory: document.querySelector("#newCategory"),
  newSaga: document.querySelector("#newSaga"),
  newTitle: document.querySelector("#newTitle"),
  newYear: document.querySelector("#newYear"),
  newScope: document.querySelector("#newScope"),
  editDialog: document.querySelector("#editGameDialog"),
  editGameForm: document.querySelector("#editGameForm"),
  closeEditDialogBtn: document.querySelector("#closeEditDialogBtn"),
  cancelEditDialogBtn: document.querySelector("#cancelEditDialogBtn"),
  editGameId: document.querySelector("#editGameId"),
  editTitle: document.querySelector("#editTitle"),
  editYear: document.querySelector("#editYear"),
  editScope: document.querySelector("#editScope"),
  editPlatforms: document.querySelector("#editPlatforms"),
  editCoverUrl: document.querySelector("#editCoverUrl"),
  editHltbMain: document.querySelector("#editHltbMain"),
  editHltbExtra: document.querySelector("#editHltbExtra"),
  editHltbComplete: document.querySelector("#editHltbComplete"),
  editHltbId: document.querySelector("#editHltbId"),
  categoryList: document.querySelector("#categoryList"),
  sagaDatalist: document.querySelector("#sagaDatalist")
};

init();

function init() {
  refreshCatalog();
  bindEvents();
  registerServiceWorker();
}

function getContext() {
  return {
    ...app,
    refs,
    hltbTimes: HLTB_TIMES,
    hltbUpdatedAt: HLTB_UPDATED_AT,
    persist,
    refreshCatalog,
    replaceState
  };
}

function persist(options = {}) {
  saveState(app.state, localStorage, options);
}

function replaceState(nextState = createBaseState()) {
  app.state = nextState;
}

function refreshCatalog() {
  const hydrated = hydrateCatalog(RAW_CATALOG, app.state, HLTB_TIMES);
  app.catalog = hydrated.catalog;
  app.allGames = hydrated.allGames;
  hydrateControls();
  render();
}

function hydrateControls() {
  const categories = ["all", ...app.catalog.map((item) => item.category)];
  refs.categoryFilter.innerHTML = categories.map((category) => (
    `<option value="${escapeAttr(category)}">${category === "all" ? "Tous" : escapeHtml(category)}</option>`
  )).join("");

  refs.scopeFilter.innerHTML = Object.entries(SCOPE_LABELS).map(([value, label]) => (
    `<option value="${value}">${label}</option>`
  )).join("");

  fillScopeSelects(refs);

  refs.categoryList.innerHTML = app.catalog.map((item) => `<option value="${escapeAttr(item.category)}"></option>`).join("");
  refs.sagaDatalist.innerHTML = [...new Set(app.allGames.map((game) => game.saga))]
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((saga) => `<option value="${escapeAttr(saga)}"></option>`)
    .join("");
}

function bindEvents() {
  refs.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  refs.searchInput.addEventListener("input", () => {
    app.filters.search = refs.searchInput.value.trim().toLowerCase();
    render();
  });

  refs.categoryFilter.addEventListener("change", () => {
    app.filters.category = refs.categoryFilter.value;
    render();
  });

  refs.statusFilter.addEventListener("change", () => {
    app.filters.status = refs.statusFilter.value;
    render();
  });

  refs.scopeFilter.addEventListener("change", () => {
    app.filters.scope = refs.scopeFilter.value;
    render();
  });

  refs.sortSelect.addEventListener("change", () => {
    app.filters.sort = refs.sortSelect.value;
    render();
  });

  for (const [key, ref] of [["hideDone", refs.hideDone], ["hideUpcoming", refs.hideUpcoming], ["onlyOwned", refs.onlyOwned], ["onlyNext", refs.onlyNext]]) {
    ref.addEventListener("change", () => {
      app.filters[key] = ref.checked;
      render();
    });
  }

  refs.sagaList.addEventListener("click", handleCatalogClick);
  refs.sagaList.addEventListener("change", handleCatalogChange);
  refs.sagaList.addEventListener("input", handleCatalogInput);
  refs.flatGameList.addEventListener("click", handleCatalogClick);
  refs.flatGameList.addEventListener("change", handleCatalogChange);
  refs.flatGameList.addEventListener("input", handleCatalogInput);
  refs.backupList?.addEventListener("click", handleBackupClick);

  refs.exportBtn.addEventListener("click", () => exportData(getContext()));
  refs.importFile.addEventListener("change", (event) => importData(event, getContext()));
  refs.resetBtn.addEventListener("click", () => resetData(getContext()));
  refs.addGameBtn.addEventListener("click", () => openGameDialog(getContext()));
  refs.settingsAddGameBtn.addEventListener("click", () => openGameDialog(getContext()));
  refs.settingsExportBtn.addEventListener("click", () => exportData(getContext()));
  refs.settingsResetBtn.addEventListener("click", () => resetData(getContext()));
  refs.settingsCollapseBtn.addEventListener("click", toggleVisibleSagas);
  refs.settingsBackupBtn?.addEventListener("click", () => {
    createBackup(localStorage, app.state, "manual");
    render();
  });
  refs.closeDialogBtn.addEventListener("click", () => refs.gameDialog.close());
  refs.cancelDialogBtn.addEventListener("click", () => refs.gameDialog.close());
  refs.gameForm.addEventListener("submit", (event) => addCustomGame(event, getContext()));
  refs.closeEditDialogBtn.addEventListener("click", () => refs.editDialog.close());
  refs.cancelEditDialogBtn.addEventListener("click", () => refs.editDialog.close());
  refs.editGameForm.addEventListener("submit", (event) => saveGameEdits(event, getContext()));

  refs.collapseBtn.addEventListener("click", toggleVisibleSagas);
}

function handleCatalogClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const gameId = button.dataset.gameId;
  const sagaName = button.dataset.saga;

  if (action === "toggle-saga") {
    const current = app.state.collapsed[sagaName] ?? true;
    app.state.collapsed[sagaName] = !current;
    persist();
    render();
    return;
  }

  if (action === "edit-game") {
    openEditGameDialog(gameId, getContext());
    return;
  }

  if (action === "completion") {
    const entry = ensureProgress(app.state, gameId);
    entry.completion = button.dataset.completion;
    if (entry.completion !== "none" && ["todo", "paused"].includes(entry.status)) entry.status = "done";
    if (entry.completion === "none" && entry.status === "done") entry.status = "todo";
    persist();
    render();
    return;
  }

  if (action === "favorite") {
    const entry = ensureProgress(app.state, gameId);
    entry.favorite = !entry.favorite;
    persist();
    render();
    return;
  }

  if (action === "next") {
    const entry = ensureProgress(app.state, gameId);
    entry.next = !entry.next;
    persist();
    render();
    return;
  }

  if (action === "batch-story" || action === "batch-hundred" || action === "batch-reset") {
    const games = app.allGames.filter((game) => game.saga === sagaName);
    if (action === "batch-reset" && !confirm(`Réinitialiser la saga ${sagaName} ?`)) return;
    for (const game of games) {
      if (action === "batch-reset") {
        delete app.state.progress[game.id];
      } else {
        const entry = ensureProgress(app.state, game.id);
        entry.status = "done";
        entry.completion = action === "batch-story" ? "story" : "hundred";
      }
    }
    persist();
    render();
  }
}

function handleCatalogChange(event) {
  const target = event.target;
  const gameId = target.dataset.gameId;
  if (!gameId) return;

  const entry = ensureProgress(app.state, gameId);
  if (target.dataset.field === "status") {
    entry.status = target.value;
    if (entry.status === "done" && entry.completion === "none") entry.completion = "story";
  }

  if (target.dataset.field === "priority") entry.priority = target.value;
  if (target.dataset.field === "platform") entry.platform = target.value;
  if (target.dataset.field === "owned") entry.owned = target.checked;
  if (target.dataset.field === "hours") entry.hours = target.value;
  if (target.dataset.field === "rating") entry.rating = target.value;
  if (target.dataset.field === "notes") entry.notes = target.value;

  persist();
  if (["status", "priority", "owned"].includes(target.dataset.field)) render();
}

function handleCatalogInput(event) {
  const target = event.target;
  const gameId = target.dataset.gameId;
  if (!gameId) return;
  const field = target.dataset.field;
  if (!["platform", "hours", "rating", "notes"].includes(field)) return;
  const entry = ensureProgress(app.state, gameId);
  entry[field] = target.value;
  persist();
}

function handleBackupClick(event) {
  const button = event.target.closest("button[data-action='restore-backup']");
  if (!button) return;
  if (!confirm("Restaurer cette sauvegarde locale ?")) return;
  replaceState(restoreBackup(localStorage, button.dataset.backupId));
  persist({ backup: false });
  refreshCatalog();
}

function setActiveTab(tab) {
  app.activeTab = tab || "sagas";
  refs.tabButtons.forEach((button) => {
    const active = button.dataset.tab === app.activeTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  refs.views.forEach((view) => {
    view.classList.toggle("active", view.dataset.view === app.activeTab);
  });
  render();
}

function toggleVisibleSagas() {
  const visibleSagas = app.catalog.flatMap((category) => category.sagas).filter((saga) => saga.games.length);
  const shouldCollapse = visibleSagas.some((saga) => !(app.state.collapsed[saga.name] ?? true));
  for (const saga of visibleSagas) app.state.collapsed[saga.name] = shouldCollapse;
  persist();
  render();
}

function render() {
  renderApp(getContext());
}

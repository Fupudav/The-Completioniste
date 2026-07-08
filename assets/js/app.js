import { HLTB_TIMES, HLTB_UPDATED_AT } from "../data/hltb-times.js";
import { RAW_CATALOG } from "../data/catalog.js";
import { SCOPE_LABELS } from "./constants.js";
import { hydrateCatalog } from "./catalog.js";
import { createDefaultFilters, getNextBacklogGame } from "./filters.js";
import {
  createBackup,
  createBaseState,
  createExportPayload,
  createProfile,
  ensureProgress,
  getProgress,
  loadState,
  migrateState,
  recordHistory,
  restoreBackup,
  saveState,
  setActiveProfile,
  touchProgress
} from "./state.js";
import { applyTemporalDefaults } from "./timeline.js";
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

let toastTimer = null;

const refs = {
  statGrid: document.querySelector("#statGrid"),
  genreBars: document.querySelector("#genreBars"),
  nextList: document.querySelector("#nextList"),
  overallMeter: document.querySelector("#overallMeter"),
  overallValue: document.querySelector("#overallValue"),
  continueBtn: document.querySelector("#continueBtn"),
  playingBtn: document.querySelector("#playingBtn"),
  tabButtons: document.querySelectorAll("[data-tab]"),
  views: document.querySelectorAll("[data-view]"),
  sagaList: document.querySelector("#sagaList"),
  flatGameList: document.querySelector("#flatGameList"),
  flatCatalogMeta: document.querySelector("#flatCatalogMeta"),
  backlogSummary: document.querySelector("#backlogSummary"),
  backlogList: document.querySelector("#backlogList"),
  timelinePanel: document.querySelector("#timelinePanel"),
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
  activeFilters: document.querySelector("#activeFilters"),
  exportBtn: document.querySelector("#exportBtn"),
  importFile: document.querySelector("#importFile"),
  resetBtn: document.querySelector("#resetBtn"),
  addGameBtn: document.querySelector("#addGameBtn"),
  collapseBtn: document.querySelector("#collapseBtn"),
  settingsAddGameBtn: document.querySelector("#settingsAddGameBtn"),
  settingsExportBtn: document.querySelector("#settingsExportBtn"),
  copySyncBtn: document.querySelector("#copySyncBtn"),
  settingsCollapseBtn: document.querySelector("#settingsCollapseBtn"),
  settingsResetBtn: document.querySelector("#settingsResetBtn"),
  settingsBackupBtn: document.querySelector("#settingsBackupBtn"),
  profileSelect: document.querySelector("#profileSelect"),
  profileAddBtn: document.querySelector("#profileAddBtn"),
  backupList: document.querySelector("#backupList"),
  backupMeta: document.querySelector("#backupMeta"),
  historyList: document.querySelector("#historyList"),
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
  sagaDatalist: document.querySelector("#sagaDatalist"),
  toastRegion: document.querySelector("#toastRegion")
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
    replaceState,
    recordHistory: addHistory,
    touchGame,
    createUndoSnapshot,
    showUndo
  };
}

function persist(options = {}) {
  saveState(app.state, localStorage, options);
}

function replaceState(nextState = createBaseState()) {
  app.state = migrateState(nextState);
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
  syncFilterControls();
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
  refs.activeFilters?.addEventListener("click", handleActiveFiltersClick);
  refs.backupList?.addEventListener("click", handleBackupClick);
  refs.continueBtn?.addEventListener("click", openNextBacklog);
  refs.playingBtn?.addEventListener("click", showPlayingGames);

  refs.exportBtn.addEventListener("click", () => exportData(getContext()));
  refs.importFile.addEventListener("change", (event) => importData(event, getContext()));
  refs.resetBtn.addEventListener("click", () => resetData(getContext()));
  refs.addGameBtn.addEventListener("click", () => openGameDialog(getContext()));
  refs.settingsAddGameBtn.addEventListener("click", () => openGameDialog(getContext()));
  refs.settingsExportBtn.addEventListener("click", () => exportData(getContext()));
  refs.copySyncBtn?.addEventListener("click", copySyncPayload);
  refs.settingsResetBtn.addEventListener("click", () => resetData(getContext()));
  refs.settingsCollapseBtn.addEventListener("click", toggleVisibleSagas);
  refs.settingsBackupBtn?.addEventListener("click", () => {
    createBackup(localStorage, app.state, "manual");
    showToast("Snapshot local créé");
    render();
  });
  refs.profileSelect?.addEventListener("change", () => {
    setActiveProfile(app.state, refs.profileSelect.value);
    persist({ backup: false });
    refreshCatalog();
    showToast(`Profil actif : ${refs.profileSelect.options[refs.profileSelect.selectedIndex]?.text || "profil"}`);
  });
  refs.profileAddBtn?.addEventListener("click", addProfile);
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
    const game = findGame(gameId);
    const entry = ensureProgress(app.state, gameId);
    entry.completion = button.dataset.completion;
    if (entry.completion !== "none" && ["todo", "paused"].includes(entry.status)) entry.status = "done";
    if (entry.completion === "none" && entry.status === "done") entry.status = "todo";
    applyTemporalDefaults(entry, "completion");
    applyTemporalDefaults(entry, "status");
    touchGame(gameId);
    addHistory({
      type: "completion",
      label: `Completion mise à jour : ${game?.title || gameId}`,
      gameId,
      saga: game?.saga || ""
    });
    persist();
    render();
    return;
  }

  if (action === "favorite") {
    const game = findGame(gameId);
    const entry = ensureProgress(app.state, gameId);
    entry.favorite = !entry.favorite;
    touchGame(gameId);
    addHistory({
      type: "favorite",
      label: `${entry.favorite ? "Favori ajouté" : "Favori retiré"} : ${game?.title || gameId}`,
      gameId,
      saga: game?.saga || ""
    });
    persist();
    render();
    return;
  }

  if (action === "next") {
    const game = findGame(gameId);
    const entry = ensureProgress(app.state, gameId);
    entry.next = !entry.next;
    touchGame(gameId);
    addHistory({
      type: "next",
      label: `${entry.next ? "Cible ajoutée" : "Cible retirée"} : ${game?.title || gameId}`,
      gameId,
      saga: game?.saga || ""
    });
    persist();
    render();
    return;
  }

  if (action === "pin-saga") {
    const pinned = new Set(app.state.pinnedSagas || []);
    if (pinned.has(sagaName)) pinned.delete(sagaName);
    else pinned.add(sagaName);
    app.state.pinnedSagas.length = 0;
    app.state.pinnedSagas.push(...pinned);
    addHistory({
      type: "pin",
      label: `${pinned.has(sagaName) ? "Saga épinglée" : "Saga désépinglée"} : ${sagaName}`,
      saga: sagaName
    });
    persist();
    render();
    return;
  }

  if (action === "session-today") {
    const game = findGame(gameId);
    const entry = ensureProgress(app.state, gameId);
    const today = new Date().toISOString().slice(0, 10);
    entry.lastSessionDate = today;
    if (entry.status === "todo") entry.status = "playing";
    applyTemporalDefaults(entry, "status");
    touchGame(gameId);
    addHistory({
      type: "session",
      label: `Session notée : ${game?.title || gameId}`,
      gameId,
      saga: game?.saga || "",
      detail: today
    });
    persist();
    render();
    return;
  }

  if (action === "batch-story" || action === "batch-hundred" || action === "batch-reset") {
    const snapshot = createUndoSnapshot();
    const games = app.allGames.filter((game) => game.saga === sagaName);
    if (action === "batch-reset" && !confirm(`Réinitialiser la saga ${sagaName} ?`)) return;
    for (const game of games) {
      if (action === "batch-reset") {
        delete app.state.progress[game.id];
      } else {
        const entry = ensureProgress(app.state, game.id);
        entry.status = "done";
        entry.completion = action === "batch-story" ? "story" : "hundred";
        applyTemporalDefaults(entry, "status");
        applyTemporalDefaults(entry, "completion");
        touchGame(game.id);
      }
    }
    addHistory({
      type: "batch",
      label: action === "batch-reset"
        ? `Saga réinitialisée : ${sagaName}`
        : `${action === "batch-story" ? "Tout histoire" : "Tout 100%"} : ${sagaName}`,
      saga: sagaName,
      detail: `${games.length} jeux`
    });
    persist();
    render();
    showUndo(action === "batch-reset" ? "Saga réinitialisée" : "Saga mise à jour", snapshot);
  }
}

function handleCatalogChange(event) {
  const target = event.target;
  const gameId = target.dataset.gameId;
  if (!gameId) return;

  const field = target.dataset.field;
  const game = findGame(gameId);
  const entry = ensureProgress(app.state, gameId);
  if (field === "status") {
    entry.status = target.value;
    if (entry.status === "done" && entry.completion === "none") entry.completion = "story";
    applyTemporalDefaults(entry, "status");
  }

  if (field === "priority") entry.priority = target.value;
  if (field === "target") entry.target = target.value;
  if (field === "platform") entry.platform = target.value;
  if (field === "ownedPlatform") entry.ownedPlatform = target.value;
  if (field === "edition") entry.edition = target.value;
  if (field === "dlcCompletion") entry.dlcCompletion = target.value;
  if (field === "dlcNotes") entry.dlcNotes = target.value;
  if (field === "owned") entry.owned = target.checked;
  if (field === "hours") entry.hours = target.value;
  if (field === "rating") entry.rating = target.value;
  if (field === "notes") entry.notes = target.value;
  if (["startDate", "finishDate", "hundredDate", "abandonedDate", "lastSessionDate"].includes(field)) entry[field] = target.value;
  touchGame(gameId);
  addHistory({
    type: field || "change",
    label: `Jeu modifié : ${game?.title || gameId}`,
    gameId,
    saga: game?.saga || "",
    detail: fieldLabel(field)
  });

  persist();
  if (["status", "priority", "owned", "target", "dlcCompletion", "startDate", "finishDate", "hundredDate", "abandonedDate", "lastSessionDate"].includes(field)) render();
}

function handleCatalogInput(event) {
  const target = event.target;
  const gameId = target.dataset.gameId;
  if (!gameId) return;
  const field = target.dataset.field;
  if (!["platform", "ownedPlatform", "edition", "hours", "rating", "notes", "dlcNotes"].includes(field)) return;
  const entry = ensureProgress(app.state, gameId);
  entry[field] = target.value;
  touchGame(gameId);
  persist();
}

function handleBackupClick(event) {
  const button = event.target.closest("button[data-action='restore-backup']");
  if (!button) return;
  if (!confirm("Restaurer cette sauvegarde locale ?")) return;
  replaceState(restoreBackup(localStorage, button.dataset.backupId));
  persist({ backup: false });
  refreshCatalog();
  showToast("Sauvegarde restaurée");
}

function handleActiveFiltersClick(event) {
  const button = event.target.closest("button[data-action='reset-filters']");
  if (!button) return;
  resetFilters();
}

function openNextBacklog() {
  const game = getNextBacklogGame(app.allGames, app.state);
  if (!game) {
    showToast("Aucune cible disponible pour le moment");
    return;
  }
  app.filters = createDefaultFilters();
  app.filters.search = game.title.toLowerCase();
  syncFilterControls();
  setActiveTab("games");
  showToast(`Prochaine cible : ${game.title}`);
}

function showPlayingGames() {
  app.filters = createDefaultFilters();
  app.filters.status = "playing";
  syncFilterControls();
  setActiveTab("games");
  showToast("Jeux en cours affichés");
}

function resetFilters() {
  app.filters = createDefaultFilters();
  syncFilterControls();
  render();
  showToast("Filtres réinitialisés");
}

function addProfile() {
  const name = prompt("Nom du nouveau profil", "Steam Deck");
  if (!name?.trim()) return;
  createProfile(app.state, name);
  persist({ backup: false });
  refreshCatalog();
  showToast(`Profil créé : ${name.trim()}`);
}

async function copySyncPayload() {
  const payload = JSON.stringify(createExportPayload(app.state), null, 2);
  try {
    await navigator.clipboard.writeText(payload);
    showToast("Sauvegarde de synchronisation copiée");
  } catch {
    exportData(getContext());
    showToast("Clipboard indisponible, export JSON lancé");
  }
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

function syncFilterControls() {
  refs.searchInput.value = app.filters.search;
  refs.categoryFilter.value = app.filters.category;
  refs.statusFilter.value = app.filters.status;
  refs.scopeFilter.value = app.filters.scope;
  refs.sortSelect.value = app.filters.sort;
  refs.hideDone.checked = app.filters.hideDone;
  refs.hideUpcoming.checked = app.filters.hideUpcoming;
  refs.onlyOwned.checked = app.filters.onlyOwned;
  refs.onlyNext.checked = app.filters.onlyNext;
}

function renderQuickActions() {
  if (!refs.continueBtn) return;
  const game = getNextBacklogGame(app.allGames, app.state);
  const label = refs.continueBtn.querySelector("span");
  if (label) label.textContent = game ? `Continuer : ${game.title}` : "Continuer mon backlog";
  refs.continueBtn.disabled = !game;
}

function createUndoSnapshot() {
  return migrateState(JSON.parse(JSON.stringify(app.state)));
}

function showUndo(message, snapshot) {
  showToast(message, {
    actionLabel: "Annuler",
    duration: 10000,
    onAction: () => {
      replaceState(snapshot);
      persist({ backup: false });
      refreshCatalog();
      showToast("Action annulée");
    }
  });
}

function showToast(message, options = {}) {
  if (!refs.toastRegion) return;
  if (toastTimer) clearTimeout(toastTimer);
  refs.toastRegion.innerHTML = `
    <div class="toast">
      <span>${escapeHtml(message)}</span>
      ${options.actionLabel ? `<button class="btn small" type="button" data-toast-action>${escapeHtml(options.actionLabel)}</button>` : ""}
    </div>
  `;
  const actionButton = refs.toastRegion.querySelector("[data-toast-action]");
  actionButton?.addEventListener("click", () => {
    refs.toastRegion.innerHTML = "";
    options.onAction?.();
  });
  toastTimer = setTimeout(() => {
    refs.toastRegion.innerHTML = "";
  }, options.duration || 6000);
}

function addHistory(item) {
  recordHistory(app.state, item);
}

function touchGame(gameId) {
  touchProgress(app.state, gameId);
}

function findGame(gameId) {
  return app.allGames.find((game) => game.id === gameId);
}

function fieldLabel(field) {
  return {
    status: "Statut",
    priority: "Priorité",
    target: "Objectif",
    platform: "Plateforme",
    ownedPlatform: "Plateforme possédée",
    edition: "Édition",
    dlcCompletion: "DLC",
    dlcNotes: "Notes DLC",
    owned: "Possédé",
    hours: "Heures",
    rating: "Note",
    notes: "Notes",
    startDate: "Commencé le",
    finishDate: "Terminé le",
    hundredDate: "100% le",
    abandonedDate: "Abandonné le",
    lastSessionDate: "Dernière session"
  }[field] || field || "";
}

function render() {
  renderApp(getContext());
  renderQuickActions();
}

const STORAGE_KEY = "completion-saga-tracker-v1";

const STATUS_LABELS = {
  todo: "À faire",
  playing: "En cours",
  paused: "En pause",
  done: "Terminé",
  dropped: "Abandonné"
};

const COMPLETION = {
  none: { label: "0", score: 0, long: "Non commencé" },
  story: { label: "Histoire", score: 55, long: "Histoire principale" },
  side: { label: "Annexes", score: 80, long: "Histoire + annexes" },
  hundred: { label: "100%", score: 100, long: "Completion totale" }
};

const SCOPE_LABELS = {
  all: "Tous",
  principal: "Principal",
  "spin-off": "Spin-off",
  remake: "Remake",
  remaster: "Remaster",
  extension: "Extension",
  collection: "Collection",
  mobile: "Mobile",
  upcoming: "À venir"
};

const HLTB_UPDATED_AT = window.TC_HLTB_UPDATED_AT;
const HLTB_TIMES = window.TC_HLTB_TIMES || {};
const RAW_CATALOG = window.TC_RAW_CATALOG || [];

const state = loadState();
let catalog = [];
let allGames = [];
let filters = {
  search: "",
  category: "all",
  status: "all",
  scope: "all",
  sort: "catalog",
  hideDone: false,
  hideUpcoming: false,
  onlyOwned: false,
  onlyNext: false
};
let activeTab = "sagas";

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
  hydrateCatalog();
  hydrateControls();
  bindEvents();
  render();
}

function loadState() {
  const base = {
    progress: {},
    custom: [],
    collapsed: {},
    overrides: {},
    savedAt: null
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    return { ...base, ...JSON.parse(raw) };
  } catch {
    return base;
  }
}

function saveState() {
  state.savedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hydrateCatalog() {
  const parsed = RAW_CATALOG.map((categoryBlock, categoryIndex) => ({
    category: categoryBlock.category,
    order: categoryIndex,
    sagas: categoryBlock.sagas.map((saga, sagaIndex) => ({
      category: categoryBlock.category,
      name: saga.name,
      order: sagaIndex,
      games: parseGames(saga.games, categoryBlock.category, saga.name, sagaIndex)
    }))
  }));

  for (const custom of state.custom) {
    const categoryName = custom.category || "Catalogue personnel";
    let category = parsed.find((item) => item.category === categoryName);
    if (!category) {
      category = { category: categoryName, order: parsed.length, sagas: [] };
      parsed.push(category);
    }

    let saga = category.sagas.find((item) => item.name.toLowerCase() === custom.saga.toLowerCase());
    if (!saga) {
      saga = { category: categoryName, name: custom.saga, order: category.sagas.length, games: [] };
      category.sagas.push(saga);
    }

    const game = normalizeGame(custom, categoryName, saga.name, saga.order, saga.games.length, true);
    saga.games.push(game);
  }

  catalog = parsed;
  allGames = catalog.flatMap((category) => category.sagas.flatMap((saga) => saga.games));
}

function parseGames(block, category, saga, sagaIndex) {
  return block.trim().split("\n").filter(Boolean).map((line, index) => {
    const [title, year = "", scope = "principal", platforms = ""] = line.split("|").map((part) => part.trim());
    return normalizeGame({ title, year, scope, platforms }, category, saga, sagaIndex, index, false);
  });
}

function normalizeGame(game, category, saga, sagaIndex, gameIndex, custom) {
  const title = game.title.trim();
  const year = String(game.year || "TBA").trim();
  const scope = game.scope || "principal";
  const id = game.id || slugify(`${category}-${saga}-${title}-${year}-${scope}-${gameIndex}`);
  const override = state.overrides?.[id] || {};
  const platforms = game.platforms || "";
  const baseHltb = HLTB_TIMES[id] || null;
  const hltbOverride = override.hltb || {};
  const hasHltbOverride = Object.keys(hltbOverride).length > 0;
  const hltb = (baseHltb || hasHltbOverride)
    ? {
        hltbId: "",
        name: title,
        main: 0,
        extra: 0,
        complete: 0,
        mainCount: 0,
        extraCount: 0,
        completeCount: 0,
        ...(baseHltb || {}),
        ...hltbOverride,
        hltbId: hltbOverride.hltbId || baseHltb?.hltbId || "",
        name: hltbOverride.name || baseHltb?.name || title
      }
    : null;
  return {
    id,
    baseTitle: title,
    baseYear: year,
    baseScope: scope,
    basePlatforms: platforms,
    title: override.title || title,
    year: override.year || year,
    scope: override.scope || scope,
    platforms: override.platforms ?? platforms,
    coverUrl: override.coverUrl || game.coverUrl || "",
    category,
    saga,
    custom,
    hltb,
    hltbCustom: hasHltbOverride,
    order: gameIndex,
    sagaIndex
  };
}

function hydrateControls() {
  const categories = ["all", ...catalog.map((item) => item.category)];
  refs.categoryFilter.innerHTML = categories.map((category) => (
    `<option value="${escapeAttr(category)}">${category === "all" ? "Tous" : escapeHtml(category)}</option>`
  )).join("");

  refs.scopeFilter.innerHTML = Object.entries(SCOPE_LABELS).map(([value, label]) => (
    `<option value="${value}">${label}</option>`
  )).join("");

  refs.newScope.innerHTML = Object.entries(SCOPE_LABELS)
    .filter(([value]) => value !== "all")
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");

  refs.editScope.innerHTML = refs.newScope.innerHTML;

  refs.categoryList.innerHTML = catalog.map((item) => `<option value="${escapeAttr(item.category)}"></option>`).join("");
  refs.sagaDatalist.innerHTML = [...new Set(allGames.map((game) => game.saga))]
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((saga) => `<option value="${escapeAttr(saga)}"></option>`)
    .join("");
}

function bindEvents() {
  refs.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  refs.searchInput.addEventListener("input", () => {
    filters.search = refs.searchInput.value.trim().toLowerCase();
    render();
  });

  refs.categoryFilter.addEventListener("change", () => {
    filters.category = refs.categoryFilter.value;
    render();
  });

  refs.statusFilter.addEventListener("change", () => {
    filters.status = refs.statusFilter.value;
    render();
  });

  refs.scopeFilter.addEventListener("change", () => {
    filters.scope = refs.scopeFilter.value;
    render();
  });

  refs.sortSelect.addEventListener("change", () => {
    filters.sort = refs.sortSelect.value;
    render();
  });

  for (const [key, ref] of [["hideDone", refs.hideDone], ["hideUpcoming", refs.hideUpcoming], ["onlyOwned", refs.onlyOwned], ["onlyNext", refs.onlyNext]]) {
    ref.addEventListener("change", () => {
      filters[key] = ref.checked;
      render();
    });
  }

  refs.sagaList.addEventListener("click", handleCatalogClick);
  refs.sagaList.addEventListener("change", handleCatalogChange);
  refs.sagaList.addEventListener("input", handleCatalogInput);
  refs.flatGameList.addEventListener("click", handleCatalogClick);
  refs.flatGameList.addEventListener("change", handleCatalogChange);
  refs.flatGameList.addEventListener("input", handleCatalogInput);

  refs.exportBtn.addEventListener("click", exportData);
  refs.importFile.addEventListener("change", importData);
  refs.resetBtn.addEventListener("click", resetData);
  refs.addGameBtn.addEventListener("click", openGameDialog);
  refs.settingsAddGameBtn.addEventListener("click", openGameDialog);
  refs.settingsExportBtn.addEventListener("click", exportData);
  refs.settingsResetBtn.addEventListener("click", resetData);
  refs.settingsCollapseBtn.addEventListener("click", toggleVisibleSagas);
  refs.closeDialogBtn.addEventListener("click", () => refs.gameDialog.close());
  refs.cancelDialogBtn.addEventListener("click", () => refs.gameDialog.close());
  refs.gameForm.addEventListener("submit", addCustomGame);
  refs.closeEditDialogBtn.addEventListener("click", () => refs.editDialog.close());
  refs.cancelEditDialogBtn.addEventListener("click", () => refs.editDialog.close());
  refs.editGameForm.addEventListener("submit", saveGameEdits);

  refs.collapseBtn.addEventListener("click", toggleVisibleSagas);
}

function handleCatalogClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const gameId = button.dataset.gameId;
  const sagaName = button.dataset.saga;

  if (action === "toggle-saga") {
    const current = state.collapsed[sagaName] ?? true;
    state.collapsed[sagaName] = !current;
    saveState();
    render();
    return;
  }

  if (action === "edit-game") {
    openEditGameDialog(gameId);
    return;
  }

  if (action === "completion") {
    const entry = ensureProgress(gameId);
    entry.completion = button.dataset.completion;
    if (entry.completion !== "none" && ["todo", "paused"].includes(entry.status)) entry.status = "done";
    if (entry.completion === "none" && entry.status === "done") entry.status = "todo";
    saveState();
    render();
    return;
  }

  if (action === "favorite") {
    const entry = ensureProgress(gameId);
    entry.favorite = !entry.favorite;
    saveState();
    render();
    return;
  }

  if (action === "next") {
    const entry = ensureProgress(gameId);
    entry.next = !entry.next;
    saveState();
    render();
    return;
  }

  if (action === "batch-story" || action === "batch-hundred" || action === "batch-reset") {
    const games = allGames.filter((game) => game.saga === sagaName);
    if (action === "batch-reset" && !confirm(`Réinitialiser la saga ${sagaName} ?`)) return;
    for (const game of games) {
      if (action === "batch-reset") {
        delete state.progress[game.id];
      } else {
        const entry = ensureProgress(game.id);
        entry.status = "done";
        entry.completion = action === "batch-story" ? "story" : "hundred";
      }
    }
    saveState();
    render();
  }
}

function handleCatalogChange(event) {
  const target = event.target;
  const gameId = target.dataset.gameId;
  if (!gameId) return;

  const entry = ensureProgress(gameId);
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

  saveState();
  if (["status", "priority", "owned"].includes(target.dataset.field)) render();
}

function handleCatalogInput(event) {
  const target = event.target;
  const gameId = target.dataset.gameId;
  if (!gameId) return;
  const field = target.dataset.field;
  if (!["platform", "hours", "rating", "notes"].includes(field)) return;
  const entry = ensureProgress(gameId);
  entry[field] = target.value;
  saveState();
}

function render() {
  const visibleSagas = getVisibleSagas();
  renderStats();
  renderSidebar();
  renderCatalog(visibleSagas);
  renderFlatGames(visibleSagas);
  renderStatsDashboard();
}

function setActiveTab(tab) {
  activeTab = tab || "sagas";
  refs.tabButtons.forEach((button) => {
    const active = button.dataset.tab === activeTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  refs.views.forEach((view) => {
    view.classList.toggle("active", view.dataset.view === activeTab);
  });
  render();
}

function toggleVisibleSagas() {
  const visibleSagas = getVisibleSagas();
  const shouldCollapse = visibleSagas.some((saga) => !(state.collapsed[saga.name] ?? true));
  for (const saga of visibleSagas) state.collapsed[saga.name] = shouldCollapse;
  saveState();
  render();
}

function getVisibleGames(visibleSagas = getVisibleSagas()) {
  return visibleSagas.flatMap((saga) => saga.games);
}

function getVisibleSagas() {
  const query = filters.search;
  const sagaBlocks = catalog.flatMap((category) => category.sagas.map((saga) => {
    const games = saga.games.filter((game) => {
      const entry = getProgress(game.id);
      const status = entry.status;
      const haystack = [
        game.title,
        game.year,
        game.scope,
        game.platforms,
        game.saga,
        game.category,
        entry.notes || "",
        acronym(game.title),
        acronym(game.saga),
        acronym(game.category)
      ].join(" ").toLowerCase();
      if (filters.category !== "all" && game.category !== filters.category) return false;
      if (filters.status !== "all" && status !== filters.status) return false;
      if (filters.scope !== "all" && game.scope !== filters.scope) return false;
      if (filters.hideDone && status === "done") return false;
      if (filters.hideUpcoming && game.scope === "upcoming") return false;
      if (filters.onlyOwned && !entry.owned) return false;
      if (filters.onlyNext && !entry.next) return false;
      if (query && !haystack.includes(query)) return false;
      return true;
    });
    return { ...saga, games, stats: getSagaStats(saga.games) };
  })).filter((saga) => saga.games.length > 0);

  const sorted = [...sagaBlocks];
  if (filters.sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  if (filters.sort === "progressAsc") sorted.sort((a, b) => a.stats.average - b.stats.average);
  if (filters.sort === "progressDesc") sorted.sort((a, b) => b.stats.average - a.stats.average);
  if (filters.sort === "year") sorted.sort((a, b) => firstYear(a.games) - firstYear(b.games));
  if (filters.sort === "hltbDesc") sorted.sort((a, b) => getSagaHltbSeconds(b) - getSagaHltbSeconds(a));
  if (filters.sort === "hltbAsc") sorted.sort((a, b) => getSagaHltbSeconds(a) - getSagaHltbSeconds(b));
  return sorted;
}

function renderStats() {
  const actionable = allGames.filter((game) => game.scope !== "upcoming");
  const stats = getGameStats(actionable);
  const hltbStats = getHltbStats(actionable);
  refs.overallMeter.style.setProperty("--overall", `${stats.average}%`);
  refs.overallValue.textContent = `${stats.average}%`;

  refs.statGrid.innerHTML = [
    statTemplate(`${stats.done}/${stats.total}`, "terminés"),
    statTemplate(`${stats.hundred}`, "à 100%"),
    statTemplate(`${stats.playing}`, "en cours"),
    statTemplate(`${stats.hours}`, "heures notées"),
    statTemplate(formatHoursShort(hltbStats.remainingComplete), "restant 100% HLTB"),
    statTemplate(formatHoursShort(hltbStats.totalComplete), "catalogue 100% HLTB")
  ].join("");
}

function renderSidebar() {
  const categories = catalog.map((category) => {
    const games = category.sagas.flatMap((saga) => saga.games).filter((game) => game.scope !== "upcoming");
    return {
      name: category.category,
      stats: getGameStats(games)
    };
  }).sort((a, b) => b.stats.average - a.stats.average).slice(0, 6);

  refs.genreBars.innerHTML = categories.map((item) => `
    <div class="mini-bar">
      <div class="mini-bar-label"><span>${escapeHtml(item.name)}</span><strong>${item.stats.average}%</strong></div>
      <div class="track"><i style="--value:${item.stats.average}%"></i></div>
    </div>
  `).join("");

  const nextItems = allGames
    .filter((game) => getProgress(game.id).next)
    .slice(0, 8);

  refs.nextList.innerHTML = nextItems.length
    ? nextItems.map((game) => `<div class="next-item">${escapeHtml(game.title)}<span>${escapeHtml(game.saga)} · ${escapeHtml(game.year)}</span></div>`).join("")
    : `<div class="next-item">Aucune cible sélectionnée<span>Utilise le repère dans une ligne de jeu.</span></div>`;
}

function renderCatalog(visibleSagas) {
  const visibleGames = visibleSagas.flatMap((saga) => saga.games);
  const hltbVisible = visibleGames.filter((game) => game.hltb).length;
  refs.catalogMeta.textContent = `${visibleGames.length} jeux affichés · ${allGames.length} au catalogue · ${hltbVisible} avec HLTB`;

  if (!visibleSagas.length) {
    refs.sagaList.innerHTML = `<div class="empty">Aucun jeu ne correspond aux filtres actifs.</div>`;
    return;
  }

  refs.sagaList.innerHTML = visibleSagas.map((saga) => sagaTemplate(saga)).join("");
}

function sagaTemplate(saga) {
  const allSagaGames = allGames.filter((game) => game.saga === saga.name);
  const stats = getSagaStats(allSagaGames);
  const shown = saga.games.length;
  const defaultCollapsed = filters.search ? false : true;
  const collapsed = state.collapsed[saga.name] ?? defaultCollapsed;
  const scopeCounts = Object.entries(countBy(allSagaGames, "scope"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return `
    <article class="saga-card ${collapsed ? "collapsed" : ""}">
      <button class="saga-head" type="button" data-action="toggle-saga" data-saga="${escapeAttr(saga.name)}" aria-expanded="${!collapsed}">
        <div class="saga-title">
          <strong>${escapeHtml(saga.name)}</strong>
          <div class="chips">
            <span class="chip"><i></i>${escapeHtml(saga.category)}</span>
            <span class="chip">${stats.done}/${stats.total} terminés</span>
            ${scopeCounts.map(([scope, count]) => `<span class="chip ${escapeAttr(scope)}"><i></i>${SCOPE_LABELS[scope] || scope} · ${count}</span>`).join("")}
          </div>
        </div>
        <div class="saga-progress">
          <span><b>${stats.average}%</b><em>${shown} affichés</em></span>
          <div class="progress-track"><i style="--value:${stats.average}%"></i></div>
        </div>
        <span class="collapse-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        </span>
      </button>
      ${collapsed ? "" : `
      <div class="saga-body">
        <div class="saga-tools">
          <button class="btn" type="button" data-action="batch-story" data-saga="${escapeAttr(saga.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>
            Tout histoire
          </button>
          <button class="btn" type="button" data-action="batch-hundred" data-saga="${escapeAttr(saga.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"></path><path d="M2 12h20"></path><path d="m4.9 4.9 14.2 14.2"></path><path d="m19.1 4.9-14.2 14.2"></path></svg>
            Tout 100%
          </button>
          <button class="btn warning" type="button" data-action="batch-reset" data-saga="${escapeAttr(saga.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 15h10l1-15"></path></svg>
            Reset saga
          </button>
        </div>
        <div class="games">
          ${saga.games.map((game) => gameTemplate(game)).join("")}
        </div>
      </div>
      `}
    </article>
  `;
}


function renderFlatGames(visibleSagas) {
  const games = getVisibleGames(visibleSagas);
  refs.flatCatalogMeta.textContent = `${games.length} jeux`;
  if (activeTab !== "games") {
    refs.flatGameList.innerHTML = "";
    return;
  }
  refs.flatGameList.innerHTML = games.length
    ? games.map((game) => gameTemplate(game)).join("")
    : `<div class="empty">Aucun jeu ne correspond aux filtres actifs.</div>`;
}

function renderStatsDashboard() {
  const actionable = allGames.filter((game) => game.scope !== "upcoming");
  const stats = getGameStats(actionable);
  const hltbStats = getHltbStats(actionable);
  const categories = catalog.map((category) => {
    const games = category.sagas.flatMap((saga) => saga.games).filter((game) => game.scope !== "upcoming");
    return { name: category.category, stats: getGameStats(games) };
  }).sort((a, b) => b.stats.average - a.stats.average);
  const statusCounts = Object.entries(STATUS_LABELS).map(([status, label]) => ({
    label,
    count: actionable.filter((game) => getProgress(game.id).status === status).length
  }));

  refs.statsDashboard.innerHTML = `
    <section class="view-panel">
      <div class="dashboard-cards">
        ${dashboardCard(`${stats.done}/${stats.total}`, "Jeux terminés")}
        ${dashboardCard(stats.hundred, "Completions 100%")}
        ${dashboardCard(stats.playing, "Jeux en cours")}
        ${dashboardCard(`${stats.average}%`, "Progression moyenne")}
        ${dashboardCard(formatHoursShort(hltbStats.remainingComplete), "Restant HLTB 100%")}
        ${dashboardCard(formatHoursShort(hltbStats.totalComplete), "Catalogue HLTB 100%")}
        ${dashboardCard(stats.hours, "Heures notées")}
        ${dashboardCard(allGames.length, "Jeux au catalogue")}
      </div>
    </section>
    <section class="view-panel">
      <div class="panel-head">
        <div>
          <h3>Progression par genre</h3>
          <p>${categories.length} genres suivis</p>
        </div>
      </div>
      <div class="stat-bars">
        ${categories.map((item) => statBar(item.name, item.stats.average)).join("")}
      </div>
    </section>
    <section class="view-panel">
      <div class="panel-head">
        <div>
          <h3>Répartition des statuts</h3>
          <p>${actionable.length} jeux hors sorties à venir</p>
        </div>
      </div>
      <div class="dashboard-cards">
        ${statusCounts.map((item) => dashboardCard(item.count, item.label)).join("")}
      </div>
    </section>
  `;
}

function dashboardCard(value, label) {
  return `<div class="dashboard-card"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

function statBar(label, value) {
  return `
    <div class="stat-bar">
      <strong>${escapeHtml(label)}</strong>
      <div class="progress-track"><i style="--value:${value}%"></i></div>
      <span>${value}%</span>
    </div>
  `;
}

function hltbTimeTemplate(game) {
  const hltb = game.hltb;
  if (!hltb) return `<div class="hltb-times empty"><span>HLTB n/d</span></div>`;
  const votes = (hltb.mainCount || 0) + (hltb.extraCount || 0) + (hltb.completeCount || 0);
  const confidence = votes < 5 ? " low-confidence" : "";
  const hltbBadge = hltb.hltbId
    ? `<a href="https://howlongtobeat.com/game/${escapeAttr(hltb.hltbId)}" target="_blank" rel="noreferrer">HLTB</a>`
    : `<span>HLTB</span>`;
  return `
    <div class="hltb-times${confidence}" title="Données HowLongToBeat, mises à jour le ${HLTB_UPDATED_AT}">
      ${hltbBadge}
      <span>Hist. ${formatHltbTime(hltb.main)}</span>
      <span>Ann. ${formatHltbTime(hltb.extra)}</span>
      <span>100% ${formatHltbTime(hltb.complete)}</span>
      ${game.hltbCustom ? `<span>Perso</span>` : ""}
      ${votes ? `<span>${votes} votes</span>` : ""}
    </div>
  `;
}

function getHltbStats(games) {
  return games.reduce((acc, game) => {
    const complete = getBestHltbSeconds(game);
    if (!complete) return acc;
    acc.totalComplete += complete;
    acc.remainingComplete += getRemainingHltbSeconds(game);
    acc.withTimes += 1;
    return acc;
  }, { totalComplete: 0, remainingComplete: 0, withTimes: 0 });
}

function getRemainingHltbSeconds(game) {
  const hltb = game.hltb;
  if (!hltb) return 0;
  const entry = getProgress(game.id);
  const complete = getBestHltbSeconds(game);
  if (!complete || entry.completion === "hundred" || entry.status === "done" && entry.completion === "hundred") return 0;
  if (entry.completion === "side") return Math.max(0, complete - (hltb.extra || hltb.main || 0));
  if (entry.completion === "story") return Math.max(0, complete - (hltb.main || 0));
  return complete;
}

function getBestHltbSeconds(game) {
  const hltb = game.hltb;
  if (!hltb) return 0;
  return hltb.complete || hltb.extra || hltb.main || 0;
}

function getSagaHltbSeconds(saga) {
  return saga.games.reduce((sum, game) => sum + getBestHltbSeconds(game), 0);
}

function formatHltbTime(seconds) {
  if (!seconds) return "n/d";
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.max(1, Math.round(seconds / 60))} min`;
  const rounded = Math.round(hours * 2) / 2;
  return `${rounded.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
}

function formatHoursShort(seconds) {
  if (!seconds) return "0 h";
  const hours = Math.round(seconds / 3600);
  return `${hours.toLocaleString("fr-FR")} h`;
}

function secondsToHoursInput(seconds) {
  if (!seconds) return "";
  const rounded = Math.round((seconds / 3600) * 4) / 4;
  return String(rounded);
}

function hoursInputToSeconds(value) {
  const normalized = String(value || "").trim().replace(",", ".");
  if (!normalized) return 0;
  const hours = Number.parseFloat(normalized);
  return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 3600) : 0;
}

function gameTemplate(game) {
  const entry = getProgress(game.id);
  const override = state.overrides?.[game.id];
  const initials = game.title.split(/\s+/).slice(0, 2).map((word) => word[0] || "").join("").toUpperCase();
  const cover = game.coverUrl
    ? `<img class="cover-thumb" src="${escapeAttr(game.coverUrl)}" alt="" loading="lazy">`
    : `<div class="cover-placeholder" aria-hidden="true">${escapeHtml(initials || "TC")}</div>`;
  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => (
    `<option value="${value}" ${entry.status === value ? "selected" : ""}>${label}</option>`
  )).join("");
  const completionButtons = Object.entries(COMPLETION).map(([value, item]) => (
    `<button type="button" class="${entry.completion === value ? "active" : ""}" data-action="completion" data-completion="${value}" data-game-id="${game.id}" title="${item.long}">${item.label}</button>`
  )).join("");

  return `
    <div class="game-row" data-status="${entry.status}">
      <div class="game-main">
        <div class="game-cover">${cover}</div>
        <div class="game-copy">
          <div class="game-title-line">
            <strong>${escapeHtml(game.title)}</strong>
            <span class="game-year">${escapeHtml(game.year)}</span>
          </div>
          <div class="game-meta">
            <span class="chip ${escapeAttr(game.scope)}"><i></i>${SCOPE_LABELS[game.scope] || game.scope}</span>
            ${game.platforms ? `<span class="chip">${escapeHtml(game.platforms)}</span>` : ""}
            ${override ? `<span class="chip"><i style="--chip:#475aa8"></i>Modifié</span>` : ""}
            ${entry.favorite ? `<span class="chip"><i style="--chip:#ca7a23"></i>Favori</span>` : ""}
            ${entry.next ? `<span class="chip"><i style="--chip:#a94442"></i>Cible</span>` : ""}
          </div>
          ${hltbTimeTemplate(game)}
        </div>
      </div>
      <select class="status-select" data-field="status" data-game-id="${game.id}" aria-label="Statut de ${escapeAttr(game.title)}">
        ${statusOptions}
      </select>
      <div class="completion-tabs" aria-label="Completion de ${escapeAttr(game.title)}">
        ${completionButtons}
      </div>
      <div class="game-side">
        <select class="priority-select" data-field="priority" data-game-id="${game.id}" aria-label="Priorité de ${escapeAttr(game.title)}">
          <option value="normal" ${entry.priority === "normal" ? "selected" : ""}>Priorité normale</option>
          <option value="high" ${entry.priority === "high" ? "selected" : ""}>Prioritaire</option>
          <option value="low" ${entry.priority === "low" ? "selected" : ""}>Plus tard</option>
        </select>
        <div class="icon-actions">
          <button class="icon-btn ${entry.favorite ? "active" : ""}" type="button" data-action="favorite" data-game-id="${game.id}" title="Favori" aria-label="Favori">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.3 18.2 21l-1.6-7 5.4-4.7-7.1-.6L12 2 9.1 8.7 2 9.3 7.4 14 5.8 21Z"></path></svg>
          </button>
          <button class="icon-btn ${entry.next ? "active" : ""}" type="button" data-action="next" data-game-id="${game.id}" title="Prochaine cible" aria-label="Prochaine cible">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5"></path><path d="M4 5h12l-2 4 2 4H4"></path></svg>
          </button>
          <button class="icon-btn" type="button" data-action="edit-game" data-game-id="${game.id}" title="Modifier la fiche" aria-label="Modifier la fiche">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
          </button>
        </div>
      </div>
      <details class="game-details">
        <summary>Détails perso</summary>
        <div class="detail-grid">
          <label class="toggle"><input type="checkbox" data-field="owned" data-game-id="${game.id}" ${entry.owned ? "checked" : ""}> Possédé</label>
          <div class="field">
            <label>Heures</label>
            <input class="small-input" type="number" min="0" step="1" data-field="hours" data-game-id="${game.id}" value="${escapeAttr(entry.hours)}">
          </div>
          <div class="field">
            <label>Note / 10</label>
            <input class="small-input" type="number" min="0" max="10" step=".5" data-field="rating" data-game-id="${game.id}" value="${escapeAttr(entry.rating)}">
          </div>
          <div class="field">
            <label>Plateforme jouée</label>
            <input class="small-input" data-field="platform" data-game-id="${game.id}" value="${escapeAttr(entry.platform)}" placeholder="Steam, PS5, Switch...">
          </div>
          <div class="field" style="grid-column:1 / -1">
            <label>Notes</label>
            <textarea data-field="notes" data-game-id="${game.id}" placeholder="DLC restants, succès manquants, build, sauvegarde...">${escapeHtml(entry.notes)}</textarea>
          </div>
        </div>
      </details>
    </div>
  `;
}

function getProgress(id) {
  const entry = state.progress[id];
  return {
    status: "todo",
    completion: "none",
    favorite: false,
    next: false,
    owned: false,
    priority: "normal",
    platform: "",
    hours: "",
    rating: "",
    notes: "",
    ...entry
  };
}

function ensureProgress(id) {
  state.progress[id] = getProgress(id);
  return state.progress[id];
}

function getGameStats(games) {
  const total = games.length;
  const progressValues = games.map((game) => COMPLETION[getProgress(game.id).completion]?.score || 0);
  const average = total ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / total) : 0;
  const done = games.filter((game) => getProgress(game.id).status === "done").length;
  const hundred = games.filter((game) => getProgress(game.id).completion === "hundred").length;
  const playing = games.filter((game) => getProgress(game.id).status === "playing").length;
  const hours = games.reduce((sum, game) => sum + Number(getProgress(game.id).hours || 0), 0);
  return { total, average, done, hundred, playing, hours };
}

function getSagaStats(games) {
  return getGameStats(games.filter((game) => game.scope !== "upcoming"));
}

function statTemplate(value, label) {
  return `<div class="stat"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function firstYear(games) {
  const years = games.map((game) => Number.parseInt(game.year, 10)).filter(Number.isFinite);
  return years.length ? Math.min(...years) : 9999;
}


function openEditGameDialog(gameId) {
  const game = allGames.find((item) => item.id === gameId);
  if (!game) return;
  refs.editGameId.value = game.id;
  refs.editTitle.value = game.title;
  refs.editYear.value = game.year;
  refs.editScope.value = game.scope;
  refs.editPlatforms.value = game.platforms;
  refs.editCoverUrl.value = game.coverUrl || "";
  refs.editHltbMain.value = secondsToHoursInput(game.hltb?.main);
  refs.editHltbExtra.value = secondsToHoursInput(game.hltb?.extra);
  refs.editHltbComplete.value = secondsToHoursInput(game.hltb?.complete);
  refs.editHltbId.value = game.hltb?.hltbId || "";
  refs.editDialog.showModal();
  refs.editTitle.focus();
}

function saveGameEdits(event) {
  event.preventDefault();
  const gameId = refs.editGameId.value;
  const game = allGames.find((item) => item.id === gameId);
  if (!game) return;
  const hltbOverride = {
    hltbId: refs.editHltbId.value.trim(),
    main: hoursInputToSeconds(refs.editHltbMain.value),
    extra: hoursInputToSeconds(refs.editHltbExtra.value),
    complete: hoursInputToSeconds(refs.editHltbComplete.value)
  };
  const baseHltb = HLTB_TIMES[gameId] || null;
  const hltbHasValue = Boolean(hltbOverride.hltbId || hltbOverride.main || hltbOverride.extra || hltbOverride.complete);
  const hltbChanged = baseHltb
    ? hltbOverride.hltbId !== String(baseHltb.hltbId || "")
      || hltbOverride.main !== (baseHltb.main || 0)
      || hltbOverride.extra !== (baseHltb.extra || 0)
      || hltbOverride.complete !== (baseHltb.complete || 0)
    : hltbHasValue;
  const gameOverride = {
    title: refs.editTitle.value.trim() || game.baseTitle || game.title,
    year: refs.editYear.value.trim() || game.baseYear || game.year,
    scope: refs.editScope.value || game.baseScope || game.scope,
    platforms: refs.editPlatforms.value.trim(),
    coverUrl: refs.editCoverUrl.value.trim()
  };
  if (hltbChanged) gameOverride.hltb = hltbOverride;
  state.overrides[gameId] = gameOverride;
  saveState();
  refs.editDialog.close();
  hydrateCatalog();
  hydrateControls();
  render();
}

function openGameDialog() {
  refs.gameForm.reset();
  refs.newCategory.value = filters.category !== "all" ? filters.category : "Catalogue personnel";
  refs.newScope.value = "principal";
  refs.gameDialog.showModal();
  refs.newSaga.focus();
}

function addCustomGame(event) {
  event.preventDefault();
  const custom = {
    id: `custom-${Date.now()}`,
    category: refs.newCategory.value.trim() || "Catalogue personnel",
    saga: refs.newSaga.value.trim(),
    title: refs.newTitle.value.trim(),
    year: refs.newYear.value.trim() || "TBA",
    scope: refs.newScope.value,
    platforms: "Perso"
  };

  if (!custom.saga || !custom.title) return;
  state.custom.push(custom);
  saveState();
  refs.gameDialog.close();
  hydrateCatalog();
  hydrateControls();
  render();
}

function exportData() {
  const payload = {
    app: "completion-saga-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `completion-sagas-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const imported = parsed.state || parsed;
      if (!imported || typeof imported !== "object") throw new Error("Format invalide");
      state.progress = imported.progress || {};
      state.custom = imported.custom || [];
      state.collapsed = imported.collapsed || {};
      state.overrides = imported.overrides || {};
      saveState();
      hydrateCatalog();
      hydrateControls();
      render();
    } catch (error) {
      alert("Import impossible : fichier JSON invalide.");
    } finally {
      refs.importFile.value = "";
    }
  };
  reader.readAsText(file);
}

function resetData() {
  if (!confirm("Effacer toute la progression, les notes et les jeux ajoutés ?")) return;
  state.progress = {};
  state.custom = [];
  state.collapsed = {};
  state.overrides = {};
  saveState();
  hydrateCatalog();
  hydrateControls();
  render();
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function acronym(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toLowerCase();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}

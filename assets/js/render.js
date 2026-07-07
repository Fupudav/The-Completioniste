import { DEFAULT_FILTERS, SCOPE_LABELS, SORT_LABELS, STATUS_LABELS } from "./constants.js";
import { getProfiles, getProgress, listBackups } from "./state.js";
import { escapeHtml, formatHoursShort } from "./utils.js";
import { getGameStats, getHltbStats } from "./stats.js";
import {
  backupListTemplate,
  dashboardCard,
  diagnosticsTemplate,
  gameTemplate,
  historyListTemplate,
  sagaTemplate,
  statBar,
  statTemplate
} from "./templates.js";
import { buildDiagnostics } from "./diagnostics.js";
import { getNextBacklogGame, getVisibleGames, getVisibleSagas, sortGames } from "./filters.js";

export function renderApp(context) {
  const visibleSagas = getVisibleSagas(context.catalog, context.filters, context.state);
  renderStats(context);
  renderSidebar(context);
  renderActiveFilters(context);
  renderCatalog(context, visibleSagas);
  renderFlatGames(context, visibleSagas);
  renderStatsDashboard(context);
  renderProfiles(context);
  renderHistory(context);
  renderBackups(context);
  renderDiagnostics(context);
}

export function renderStats(context) {
  const { allGames, refs, state } = context;
  const actionable = allGames.filter((game) => game.scope !== "upcoming");
  const stats = getGameStats(actionable, state);
  const hltbStats = getHltbStats(actionable, state);
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

export function renderSidebar(context) {
  const { catalog, refs, state } = context;
  const categories = catalog.map((category) => {
    const games = category.sagas.flatMap((saga) => saga.games).filter((game) => game.scope !== "upcoming");
    return {
      name: category.category,
      stats: getGameStats(games, state)
    };
  }).sort((a, b) => b.stats.average - a.stats.average).slice(0, 6);

  refs.genreBars.innerHTML = categories.map((item) => `
    <div class="mini-bar">
      <div class="mini-bar-label"><span>${escapeHtml(item.name)}</span><strong>${item.stats.average}%</strong></div>
      <div class="track"><i style="--value:${item.stats.average}%"></i></div>
    </div>
  `).join("");

  const suggested = getNextBacklogGame(context.allGames, state);
  const nextItems = context.allGames
    .filter((game) => getProgress(state, game.id).next)
    .filter((game, index, items) => items.findIndex((item) => item.id === game.id) === index)
    .slice(0, 7);
  const sidebarItems = suggested && !nextItems.some((game) => game.id === suggested.id)
    ? [suggested, ...nextItems]
    : nextItems;

  refs.nextList.innerHTML = sidebarItems.length
    ? sidebarItems.map((game, index) => `<div class="next-item">${escapeHtml(game.title)}<span>${index === 0 && game.id === suggested?.id ? "Suggestion auto" : "Cible"} · ${escapeHtml(game.saga)} · ${escapeHtml(game.year)}</span></div>`).join("")
    : `<div class="next-item">Aucune cible disponible<span>Ajoute une priorité, une cible ou un jeu en cours.</span></div>`;
}

export function renderActiveFilters(context) {
  const { filters, refs } = context;
  if (!refs.activeFilters) return;
  const chips = [];
  if (filters.search) chips.push(`Recherche: ${filters.search}`);
  if (filters.category !== "all") chips.push(`Genre: ${filters.category}`);
  if (filters.status !== "all") chips.push(`Statut: ${STATUS_LABELS[filters.status] || filters.status}`);
  if (filters.scope !== "all") chips.push(`Type: ${SCOPE_LABELS[filters.scope] || filters.scope}`);
  if (filters.sort !== DEFAULT_FILTERS.sort) chips.push(`Tri: ${SORT_LABELS[filters.sort] || filters.sort}`);
  if (filters.hideDone) chips.push("Masque terminés");
  if (filters.hideUpcoming) chips.push("Masque à venir");
  if (filters.onlyOwned) chips.push("Possédés");
  if (filters.onlyNext) chips.push("Cibles");

  refs.activeFilters.innerHTML = chips.length
    ? `
      <div class="active-filter-chips">
        ${chips.map((label) => `<span class="filter-chip">${escapeHtml(label)}</span>`).join("")}
      </div>
      <button class="btn small" type="button" data-action="reset-filters">Réinitialiser les filtres</button>
    `
    : `<span class="active-filter-empty">Aucun filtre actif · catalogue complet visible</span>`;
}

export function renderCatalog(context, visibleSagas) {
  const { allGames, refs } = context;
  const visibleGames = visibleSagas.flatMap((saga) => saga.games);
  const hltbVisible = visibleGames.filter((game) => game.hltb).length;
  refs.catalogMeta.textContent = `${visibleGames.length} jeux affichés · ${allGames.length} au catalogue · ${hltbVisible} avec HLTB`;

  if (!visibleSagas.length) {
    refs.sagaList.innerHTML = `<div class="empty">Aucun jeu ne correspond aux filtres actifs.</div>`;
    return;
  }

  refs.sagaList.innerHTML = visibleSagas.map((saga) => sagaTemplate(saga, context)).join("");
}

export function renderFlatGames(context, visibleSagas) {
  const games = sortGames(getVisibleGames(visibleSagas), context.filters, context.state);
  context.refs.flatCatalogMeta.textContent = `${games.length} jeux`;
  if (context.activeTab !== "games") {
    context.refs.flatGameList.innerHTML = "";
    return;
  }
  context.refs.flatGameList.innerHTML = games.length
    ? games.map((game) => gameTemplate(game, context)).join("")
    : `<div class="empty">Aucun jeu ne correspond aux filtres actifs.</div>`;
}

export function renderProfiles(context) {
  const { refs, state } = context;
  if (!refs.profileSelect) return;
  refs.profileSelect.innerHTML = getProfiles(state).map((profile) => (
    `<option value="${profile.id}" ${profile.id === state.activeProfileId ? "selected" : ""}>${escapeHtml(profile.name)}</option>`
  )).join("");
}

export function renderHistory(context) {
  if (!context.refs.historyList) return;
  context.refs.historyList.innerHTML = historyListTemplate(context.state.history);
}

export function renderStatsDashboard(context) {
  const { allGames, catalog, refs, state } = context;
  const actionable = allGames.filter((game) => game.scope !== "upcoming");
  const stats = getGameStats(actionable, state);
  const hltbStats = getHltbStats(actionable, state);
  const categories = catalog.map((category) => {
    const games = category.sagas.flatMap((saga) => saga.games).filter((game) => game.scope !== "upcoming");
    return { name: category.category, stats: getGameStats(games, state) };
  }).sort((a, b) => b.stats.average - a.stats.average);
  const statusCounts = Object.entries(STATUS_LABELS).map(([status, label]) => ({
    label,
    count: actionable.filter((game) => getProgress(state, game.id).status === status).length
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

export function renderBackups(context) {
  if (!context.refs.backupList) return;
  const backups = listBackups(localStorage);
  context.refs.backupList.innerHTML = backupListTemplate(backups);
  context.refs.backupMeta.textContent = `${backups.length} sauvegarde${backups.length > 1 ? "s" : ""}`;
}

export function renderDiagnostics(context) {
  if (!context.refs.diagnosticsPanel) return;
  const groups = buildDiagnostics(context.catalog, context.allGames, context.hltbTimes);
  context.refs.diagnosticsPanel.innerHTML = diagnosticsTemplate(groups);
}

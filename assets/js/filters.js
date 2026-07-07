import { DEFAULT_FILTERS } from "./constants.js";
import { getProgress } from "./state.js";
import { acronym } from "./utils.js";
import { firstYear } from "./catalog.js";
import { getRemainingHltbSeconds, getSagaHltbSeconds, getSagaStats } from "./stats.js";

export function createDefaultFilters() {
  return { ...DEFAULT_FILTERS };
}

export function getVisibleGames(visibleSagas) {
  return visibleSagas.flatMap((saga) => saga.games);
}

export function getVisibleSagas(catalog, filters, state) {
  const query = filters.search;
  const sagaBlocks = catalog.flatMap((category) => category.sagas.map((saga) => {
    const games = sortGames(saga.games.filter((game) => gameMatchesFilters(game, filters, state, query)), filters, state);
    return { ...saga, games, stats: getSagaStats(saga.games, state) };
  })).filter((saga) => saga.games.length > 0);

  const sorted = [...sagaBlocks];
  sorted.sort((a, b) => pinnedScore(state, b.name) - pinnedScore(state, a.name));
  if (filters.sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  if (filters.sort === "progressAsc") sorted.sort((a, b) => a.stats.average - b.stats.average);
  if (filters.sort === "progressDesc") sorted.sort((a, b) => b.stats.average - a.stats.average);
  if (filters.sort === "year") sorted.sort((a, b) => firstYear(a.games) - firstYear(b.games));
  if (filters.sort === "hltbDesc") sorted.sort((a, b) => getSagaHltbSeconds(b) - getSagaHltbSeconds(a));
  if (filters.sort === "hltbAsc") sorted.sort((a, b) => getSagaHltbSeconds(a) - getSagaHltbSeconds(b));
  if (filters.sort === "priority") sorted.sort((a, b) => sagaPriorityScore(b, state) - sagaPriorityScore(a, state));
  if (filters.sort === "hltbRemaining") sorted.sort((a, b) => sagaRemainingSeconds(b, state) - sagaRemainingSeconds(a, state));
  if (filters.sort === "lastUpdated") sorted.sort((a, b) => sagaLastUpdated(b, state) - sagaLastUpdated(a, state));
  sorted.sort((a, b) => pinnedScore(state, b.name) - pinnedScore(state, a.name));
  return sorted;
}

export function sortGames(games, filters, state) {
  const sorted = [...games];
  if (filters.sort === "name") sorted.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  if (filters.sort === "year") sorted.sort((a, b) => firstYear([a]) - firstYear([b]));
  if (filters.sort === "hltbDesc") sorted.sort((a, b) => (b.hltb?.complete || 0) - (a.hltb?.complete || 0));
  if (filters.sort === "hltbAsc") sorted.sort((a, b) => (a.hltb?.complete || 0) - (b.hltb?.complete || 0));
  if (filters.sort === "priority") sorted.sort((a, b) => gamePriorityScore(b, state) - gamePriorityScore(a, state));
  if (filters.sort === "hltbRemaining") sorted.sort((a, b) => getRemainingHltbSeconds(b, state) - getRemainingHltbSeconds(a, state));
  if (filters.sort === "lastUpdated") sorted.sort((a, b) => gameLastUpdated(b, state) - gameLastUpdated(a, state));
  return sorted;
}

export function getNextBacklogGame(games, state) {
  return games
    .filter((game) => game.scope !== "upcoming")
    .map((game) => ({ game, score: nextBacklogScore(game, state) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.game.title.localeCompare(b.game.title, "fr"))[0]?.game || null;
}

function gameMatchesFilters(game, filters, state, query) {
  const entry = getProgress(state, game.id);
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
}

function pinnedScore(state, sagaName) {
  return state.pinnedSagas?.includes(sagaName) ? 1 : 0;
}

function gamePriorityScore(game, state) {
  const entry = getProgress(state, game.id);
  const priority = { high: 3, normal: 2, low: 1 }[entry.priority] || 2;
  return priority + (entry.next ? 4 : 0) + (entry.favorite ? 1 : 0);
}

function sagaPriorityScore(saga, state) {
  return Math.max(0, ...saga.games.map((game) => gamePriorityScore(game, state)));
}

function gameLastUpdated(game, state) {
  return Date.parse(getProgress(state, game.id).updatedAt || "") || 0;
}

function sagaLastUpdated(saga, state) {
  return Math.max(0, ...saga.games.map((game) => gameLastUpdated(game, state)));
}

function sagaRemainingSeconds(saga, state) {
  return saga.games.reduce((sum, game) => sum + getRemainingHltbSeconds(game, state), 0);
}

function nextBacklogScore(game, state) {
  const entry = getProgress(state, game.id);
  if (entry.status === "done" || entry.status === "dropped" || entry.completion === "hundred") return 0;
  const remainingHours = getRemainingHltbSeconds(game, state) / 3600;
  const priority = { high: 300, normal: 160, low: 50 }[entry.priority] || 160;
  const status = { playing: 500, paused: 180, todo: 120 }[entry.status] || 0;
  const timeFit = remainingHours ? Math.max(0, 180 - Math.min(remainingHours, 180)) : 40;
  return priority
    + status
    + timeFit
    + (entry.next ? 900 : 0)
    + (entry.favorite ? 80 : 0)
    + (entry.owned ? 90 : 0);
}

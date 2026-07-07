import { DEFAULT_FILTERS } from "./constants.js";
import { getProgress } from "./state.js";
import { acronym } from "./utils.js";
import { firstYear } from "./catalog.js";
import { getSagaHltbSeconds, getSagaStats } from "./stats.js";

export function createDefaultFilters() {
  return { ...DEFAULT_FILTERS };
}

export function getVisibleGames(visibleSagas) {
  return visibleSagas.flatMap((saga) => saga.games);
}

export function getVisibleSagas(catalog, filters, state) {
  const query = filters.search;
  const sagaBlocks = catalog.flatMap((category) => category.sagas.map((saga) => {
    const games = saga.games.filter((game) => {
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
    });
    return { ...saga, games, stats: getSagaStats(saga.games, state) };
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

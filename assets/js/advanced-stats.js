import { getProgress } from "./state.js";
import { getGameStats, getHltbStats, getRealisticRemainingHltbSeconds } from "./stats.js";

export function buildAdvancedStats(catalog, games, state) {
  const actionable = games.filter((game) => game.scope !== "upcoming");
  return {
    byPlatform: groupByPlatform(actionable, state),
    byGenre: groupByGenre(catalog, state),
    byDecade: groupByDecade(actionable, state),
    remainingByGenre: groupRemainingByGenre(catalog, state),
    totals: {
      ...getGameStats(actionable, state),
      ...getHltbStats(actionable, state),
      ownedNotStarted: actionable.filter((game) => {
        const entry = getProgress(state, game.id);
        return entry.owned && entry.status === "todo" && entry.completion === "none";
      }).length
    }
  };
}

function groupByPlatform(games, state) {
  const groups = new Map();
  for (const game of games) {
    const entry = getProgress(state, game.id);
    const platforms = splitPlatforms(entry.platform || entry.ownedPlatform || "Non renseignée");
    for (const platform of platforms) addGame(groups, platform, game, state);
  }
  return sortGroups(groups);
}

function groupByGenre(catalog, state) {
  const groups = new Map();
  for (const category of catalog) {
    const games = category.sagas.flatMap((saga) => saga.games).filter((game) => game.scope !== "upcoming");
    groups.set(category.category, {
      label: category.category,
      games,
      stats: getGameStats(games, state),
      remaining: getHltbStats(games, state).remainingTarget
    });
  }
  return sortGroups(groups);
}

function groupByDecade(games, state) {
  const groups = new Map();
  for (const game of games) addGame(groups, getDecadeLabel(game.year), game, state);
  return sortGroups(groups, "label");
}

function groupRemainingByGenre(catalog, state) {
  return groupByGenre(catalog, state)
    .map((group) => ({ ...group, remaining: group.games.reduce((sum, game) => sum + getRealisticRemainingHltbSeconds(game, state), 0) }))
    .sort((a, b) => b.remaining - a.remaining);
}

function addGame(groups, label, game, state) {
  const group = groups.get(label) || { label, games: [] };
  group.games.push(game);
  group.stats = getGameStats(group.games, state);
  group.remaining = getHltbStats(group.games, state).remainingTarget;
  groups.set(label, group);
}

function sortGroups(groups, mode = "progress") {
  const items = [...groups.values()];
  if (mode === "label") return items.sort((a, b) => a.label.localeCompare(b.label, "fr"));
  return items.sort((a, b) => b.stats.total - a.stats.total || a.label.localeCompare(b.label, "fr"));
}

function getDecadeLabel(year) {
  const parsed = Number.parseInt(year, 10);
  if (!Number.isFinite(parsed)) return "Date inconnue";
  return `${Math.floor(parsed / 10) * 10}s`;
}

function splitPlatforms(value) {
  const parts = String(value || "")
    .split(/[,/;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : ["Non renseignée"];
}

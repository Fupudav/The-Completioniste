import { getProgress } from "./state.js";
import { getRealisticRemainingHltbSeconds, getTargetHltbSeconds } from "./stats.js";

const PRIORITY_SCORE = { high: 300, normal: 160, low: 50 };
const STATUS_SCORE = { playing: 500, paused: 180, todo: 120 };

export function getBacklogItems(games, state, options = {}) {
  const items = games
    .filter((game) => game.scope !== "upcoming")
    .map((game) => {
      const entry = getProgress(state, game.id);
      const remaining = getRealisticRemainingHltbSeconds(game, state);
      const target = getTargetHltbSeconds(game, state);
      const ownedNotStarted = entry.owned && entry.status === "todo" && entry.completion === "none";
      const score = getBacklogScore(game, state, remaining, ownedNotStarted);
      return { game, entry, remaining, target, ownedNotStarted, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.remaining - b.remaining || a.game.title.localeCompare(b.game.title, "fr"));

  return options.limit ? items.slice(0, options.limit) : items;
}

export function getOwnedNotStarted(games, state) {
  return games
    .filter((game) => game.scope !== "upcoming")
    .filter((game) => {
      const entry = getProgress(state, game.id);
      return entry.owned && entry.status === "todo" && entry.completion === "none";
    });
}

export function getBacklogSummary(games, state) {
  const items = getBacklogItems(games, state);
  return {
    total: items.length,
    ownedNotStarted: items.filter((item) => item.ownedNotStarted).length,
    highPriority: items.filter((item) => item.entry.priority === "high").length,
    remaining: items.reduce((sum, item) => sum + item.remaining, 0)
  };
}

export function getBacklogScore(game, state, remainingSeconds = 0, ownedNotStarted = false) {
  const entry = getProgress(state, game.id);
  if (entry.status === "dropped" || isTargetReached(entry)) return 0;
  const remainingHours = remainingSeconds / 3600;
  const timeFit = remainingHours ? Math.max(0, 180 - Math.min(remainingHours, 180)) : 40;
  return (PRIORITY_SCORE[entry.priority] || PRIORITY_SCORE.normal)
    + (STATUS_SCORE[entry.status] || 0)
    + timeFit
    + (entry.next ? 900 : 0)
    + (entry.favorite ? 80 : 0)
    + (entry.owned ? 90 : 0)
    + (ownedNotStarted ? 120 : 0);
}

function isTargetReached(entry) {
  const rank = { none: 0, story: 1, side: 2, hundred: 3 };
  const target = entry.target || "hundred";
  return (rank[entry.completion] || 0) >= (rank[target] || rank.hundred);
}

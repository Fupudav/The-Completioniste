import { COMPLETION } from "./constants.js";
import { getProgress } from "./state.js";

export function getGameStats(games, state) {
  const total = games.length;
  const progressValues = games.map((game) => COMPLETION[getProgress(state, game.id).completion]?.score || 0);
  const average = total ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / total) : 0;
  const done = games.filter((game) => getProgress(state, game.id).status === "done").length;
  const hundred = games.filter((game) => getProgress(state, game.id).completion === "hundred").length;
  const playing = games.filter((game) => getProgress(state, game.id).status === "playing").length;
  const hours = games.reduce((sum, game) => sum + Number(getProgress(state, game.id).hours || 0), 0);
  return { total, average, done, hundred, playing, hours };
}

export function getSagaStats(games, state) {
  return getGameStats(games.filter((game) => game.scope !== "upcoming"), state);
}

export function getHltbStats(games, state) {
  return games.reduce((acc, game) => {
    const complete = getBestHltbSeconds(game);
    if (!complete) return acc;
    acc.totalComplete += complete;
    acc.remainingComplete += getRemainingHltbSeconds(game, state);
    acc.withTimes += 1;
    return acc;
  }, { totalComplete: 0, remainingComplete: 0, withTimes: 0 });
}

export function getRemainingHltbSeconds(game, state) {
  const hltb = game.hltb;
  if (!hltb) return 0;
  const entry = getProgress(state, game.id);
  const complete = getBestHltbSeconds(game);
  if (!complete || entry.completion === "hundred" || entry.status === "done" && entry.completion === "hundred") return 0;
  if (entry.completion === "side") return Math.max(0, complete - (hltb.extra || hltb.main || 0));
  if (entry.completion === "story") return Math.max(0, complete - (hltb.main || 0));
  return complete;
}

export function getBestHltbSeconds(game) {
  const hltb = game.hltb;
  if (!hltb) return 0;
  return hltb.complete || hltb.extra || hltb.main || 0;
}

export function getSagaHltbSeconds(saga) {
  return saga.games.reduce((sum, game) => sum + getBestHltbSeconds(game), 0);
}

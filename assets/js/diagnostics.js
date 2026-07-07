import { isKnownScope } from "./catalog.js";

export function buildDiagnostics(catalog, allGames, hltbTimes) {
  const gameIds = new Set(allGames.map((game) => game.id));
  const byId = groupBy(allGames, (game) => game.id);
  const bySagaTitle = groupBy(allGames, (game) => `${game.saga}::${game.title}::${game.year}`.toLowerCase());

  const emptySagas = catalog.flatMap((category) => category.sagas
    .filter((saga) => saga.games.length === 0)
    .map((saga) => `${category.category} / ${saga.name}`));
  const missingHltb = allGames
    .filter((game) => game.scope !== "upcoming" && !game.hltb)
    .map((game) => `${game.saga} - ${game.title}`);
  const duplicateIds = Object.entries(byId)
    .filter(([, games]) => games.length > 1)
    .map(([id, games]) => `${id} (${games.length})`);
  const duplicateTitles = Object.entries(bySagaTitle)
    .filter(([, games]) => games.length > 1)
    .map(([, games]) => `${games[0].saga} - ${games[0].title} (${games.length})`);
  const invalidEntries = allGames
    .filter((game) => !game.title || !game.year || !isKnownScope(game.scope))
    .map((game) => `${game.saga} - ${game.title || "Sans titre"}`);
  const orphanHltb = Object.keys(hltbTimes)
    .filter((id) => !gameIds.has(id));

  return [
    diagnosticGroup("Jeux sans HLTB", missingHltb, "warning"),
    diagnosticGroup("IDs dupliqués", duplicateIds, "danger"),
    diagnosticGroup("Doublons titre/année dans une saga", duplicateTitles, "warning"),
    diagnosticGroup("Sagas vides", emptySagas, "info"),
    diagnosticGroup("Entrées incohérentes", invalidEntries, "danger"),
    diagnosticGroup("HLTB orphelins", orphanHltb, "info")
  ];
}

function diagnosticGroup(title, items, level) {
  return {
    title,
    level,
    count: items.length,
    items: items.slice(0, 8)
  };
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {});
}

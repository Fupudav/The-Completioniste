import { SCOPE_LABELS } from "./constants.js";
import { slugify } from "./utils.js";

export function hydrateCatalog(rawCatalog, state, hltbTimes) {
  const parsed = rawCatalog.map((categoryBlock, categoryIndex) => ({
    category: categoryBlock.category,
    order: categoryIndex,
    sagas: categoryBlock.sagas.map((saga, sagaIndex) => ({
      category: categoryBlock.category,
      name: saga.name,
      order: sagaIndex,
      games: parseGames(saga.games, categoryBlock.category, saga.name, sagaIndex, state, hltbTimes)
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

    saga.games.push(normalizeGame(custom, categoryName, saga.name, saga.order, saga.games.length, true, state, hltbTimes));
  }

  const allGames = parsed.flatMap((category) => category.sagas.flatMap((saga) => saga.games));
  return { catalog: parsed, allGames };
}

export function parseGames(block, category, saga, sagaIndex, state = { overrides: {} }, hltbTimes = {}) {
  return block.trim().split("\n").filter(Boolean).map((line, index) => {
    const [title, year = "", scope = "principal", platforms = ""] = line.split("|").map((part) => part.trim());
    return normalizeGame({ title, year, scope, platforms }, category, saga, sagaIndex, index, false, state, hltbTimes);
  });
}

export function normalizeGame(game, category, saga, sagaIndex, gameIndex, custom, state = { overrides: {} }, hltbTimes = {}) {
  const title = game.title.trim();
  const year = String(game.year || "TBA").trim();
  const scope = game.scope || "principal";
  const id = game.id || slugify(`${category}-${saga}-${title}-${year}-${scope}-${gameIndex}`);
  const override = state.overrides?.[id] || {};
  const platforms = game.platforms || "";
  const baseHltb = hltbTimes[id] || null;
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

export function firstYear(games) {
  const years = games.map((game) => Number.parseInt(game.year, 10)).filter(Number.isFinite);
  return years.length ? Math.min(...years) : 9999;
}

export function isKnownScope(scope) {
  return Boolean(SCOPE_LABELS[scope]);
}

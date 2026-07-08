import test from "node:test";
import assert from "node:assert/strict";
import { acronym, hoursInputToSeconds, slugify } from "../assets/js/utils.js";
import { hydrateCatalog, parseGames } from "../assets/js/catalog.js";
import { buildDiagnostics } from "../assets/js/diagnostics.js";
import { getBacklogItems } from "../assets/js/backlog.js";
import { buildAdvancedStats } from "../assets/js/advanced-stats.js";
import { applyTemporalDefaults, getTimelineEvents } from "../assets/js/timeline.js";
import { getRealisticRemainingHltbSeconds } from "../assets/js/stats.js";
import { sagaTemplate } from "../assets/js/templates.js";
import {
  createBackup,
  createExportPayload,
  createProfile,
  createStateChecksum,
  importStatePayload,
  listBackups,
  migrateState,
  recordHistory,
  restoreBackup,
  saveState,
  setActiveProfile
} from "../assets/js/state.js";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }
}

test("slugify and acronym normalize game labels", () => {
  assert.equal(slugify("Crime / Monde ouvert - Grand Theft Auto VI"), "crime-monde-ouvert-grand-theft-auto-vi");
  assert.equal(acronym("Grand Theft Auto"), "gta");
  assert.equal(acronym("The Elder Scrolls"), "tes");
});

test("hours input parser accepts French decimal commas", () => {
  assert.equal(hoursInputToSeconds("1,5"), 5400);
  assert.equal(hoursInputToSeconds("2.25"), 8100);
  assert.equal(hoursInputToSeconds(""), 0);
});

test("catalog parsing builds normalized games", () => {
  const games = parseGames("Game A|2001|principal|PC\nGame B|TBA|spin-off|Switch", "Test", "Saga", 0);
  assert.equal(games.length, 2);
  assert.equal(games[0].id, "test-saga-game-a-2001-principal-0");
  assert.equal(games[1].scope, "spin-off");
});

test("catalog hydration applies title and HLTB overrides", () => {
  const raw = [{ category: "Test", sagas: [{ name: "Grand Theft Auto", games: "Grand Theft Auto|1997|principal|PC" }] }];
  const id = "test-grand-theft-auto-grand-theft-auto-1997-principal-0";
  const state = migrateState({
    overrides: {
      [id]: {
        title: "GTA",
        hltb: { hltbId: "42", main: 7200, extra: 10800, complete: 14400 }
      }
    }
  });
  const hltbTimes = { [id]: { hltbId: 1, name: "Grand Theft Auto", main: 3600, extra: 7200, complete: 10800 } };
  const { allGames } = hydrateCatalog(raw, state, hltbTimes);

  assert.equal(allGames[0].title, "GTA");
  assert.equal(allGames[0].hltb.main, 7200);
  assert.equal(allGames[0].hltbCustom, true);
});

test("state migration, export, import and backups preserve progress", () => {
  const storage = new MemoryStorage();
  const state = migrateState({ progress: { game: { status: "done", completion: "story" } } });
  assert.equal(state.version, 4);
  assert.equal(state.activeProfileId, "default");

  saveState(state, storage, { backup: false });
  const payload = createExportPayload(state);
  assert.equal(payload.checksum, createStateChecksum(payload.state));
  const imported = importStatePayload(payload);
  assert.equal(imported.progress.game.status, "done");

  createBackup(storage, imported, "manual", new Date("2026-07-07T10:00:00.000Z"));
  const backups = listBackups(storage);
  assert.equal(backups.length, 1);
  assert.equal(backups[0].stateVersion, 4);
  assert.match(backups[0].checksum, /^fnv1a-/);
  const restored = restoreBackup(storage, backups[0].id);
  assert.equal(restored.progress.game.completion, "story");
});

test("profiles keep separate progress and history", () => {
  const state = migrateState({ progress: { game: { status: "done" } } });
  createProfile(state, "Steam Deck");
  state.progress.game = { status: "playing" };
  recordHistory(state, { label: "Steam Deck change" }, new Date("2026-07-07T10:00:00.000Z"));

  assert.equal(state.progress.game.status, "playing");
  assert.equal(state.history.length, 1);

  setActiveProfile(state, "default");
  assert.equal(state.progress.game.status, "done");
  assert.equal(state.history.length, 0);
});

test("backlog ranks owned high priority games and realistic HLTB target", () => {
  const games = [
    { id: "short", title: "Short Game", saga: "Saga", category: "RPG", year: "2001", scope: "principal", hltb: { main: 3600, extra: 7200, complete: 10800 } },
    { id: "long", title: "Long Game", saga: "Saga", category: "RPG", year: "2002", scope: "principal", hltb: { main: 36000, extra: 72000, complete: 108000 } }
  ];
  const state = migrateState({
    progress: {
      short: { owned: true, priority: "high", target: "story", status: "todo", completion: "none" },
      long: { owned: false, priority: "normal", target: "hundred", status: "todo", completion: "none" }
    }
  });

  const items = getBacklogItems(games, state);
  assert.equal(items[0].game.id, "short");
  assert.equal(items[0].ownedNotStarted, true);
  assert.equal(getRealisticRemainingHltbSeconds(games[0], state), 3600);
});

test("timeline derives temporal events from progress dates", () => {
  const state = migrateState({ progress: { game: { status: "playing", completion: "none" } } });
  const entry = state.progress.game;
  applyTemporalDefaults(entry, "status", new Date("2026-07-08T10:00:00.000Z"));
  entry.lastSessionDate = "2026-07-09";

  const events = getTimelineEvents([{ id: "game", title: "Game", saga: "Saga", category: "Test", year: "2020", scope: "principal" }], state);
  assert.equal(events[0].type, "session");
  assert.equal(events.some((event) => event.type === "started"), true);
});

test("advanced stats group by platform, decade and remaining genre time", () => {
  const catalog = [{
    category: "RPG",
    sagas: [{
      name: "Saga",
      games: [
        { id: "game", title: "Game", saga: "Saga", category: "RPG", year: "1997", scope: "principal", hltb: { main: 3600, extra: 7200, complete: 10800 } }
      ]
    }]
  }];
  const state = migrateState({ progress: { game: { platform: "Steam Deck", target: "side", completion: "story" } } });
  const stats = buildAdvancedStats(catalog, catalog[0].sagas[0].games, state);

  assert.equal(stats.byPlatform[0].label, "Steam Deck");
  assert.equal(stats.byDecade[0].label, "1990s");
  assert.equal(stats.remainingByGenre[0].remaining, 3600);
});


test("saga template only renders games when saga is expanded", () => {
  const saga = {
    name: "Saga",
    games: [
      { id: "game", title: "Game", saga: "Saga", category: "RPG", year: "1997", scope: "principal", hltb: null, platforms: "" }
    ]
  };
  const state = migrateState();
  const context = {
    allGames: saga.games,
    filters: { search: "game" },
    state,
    hltbUpdatedAt: "2026-07-08"
  };

  assert.equal(sagaTemplate(saga, context).includes("game-row"), false);
  state.collapsed.Saga = false;
  assert.equal(sagaTemplate(saga, context).includes("game-row"), true);
});
test("diagnostics detect missing HLTB and duplicate ids", () => {
  const raw = [{ category: "Test", sagas: [{ name: "Saga", games: "Game A|2001|principal|PC\nGame A|2001|principal|PC" }] }];
  const state = migrateState();
  const { catalog, allGames } = hydrateCatalog(raw, state, {});
  allGames[1].id = allGames[0].id;

  const diagnostics = buildDiagnostics(catalog, allGames, {});
  assert.equal(diagnostics.find((group) => group.title === "Jeux sans HLTB").count, 2);
  assert.equal(diagnostics.find((group) => group.title === "IDs dupliqués").count, 1);
});

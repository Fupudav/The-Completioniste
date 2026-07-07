import test from "node:test";
import assert from "node:assert/strict";
import { acronym, hoursInputToSeconds, slugify } from "../assets/js/utils.js";
import { hydrateCatalog, parseGames } from "../assets/js/catalog.js";
import { buildDiagnostics } from "../assets/js/diagnostics.js";
import {
  createBackup,
  createExportPayload,
  createProfile,
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
  assert.equal(state.version, 3);
  assert.equal(state.activeProfileId, "default");

  saveState(state, storage, { backup: false });
  const payload = createExportPayload(state);
  const imported = importStatePayload(payload);
  assert.equal(imported.progress.game.status, "done");

  createBackup(storage, imported, "manual", new Date("2026-07-07T10:00:00.000Z"));
  const backups = listBackups(storage);
  assert.equal(backups.length, 1);
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

test("diagnostics detect missing HLTB and duplicate ids", () => {
  const raw = [{ category: "Test", sagas: [{ name: "Saga", games: "Game A|2001|principal|PC\nGame A|2001|principal|PC" }] }];
  const state = migrateState();
  const { catalog, allGames } = hydrateCatalog(raw, state, {});
  allGames[1].id = allGames[0].id;

  const diagnostics = buildDiagnostics(catalog, allGames, {});
  assert.equal(diagnostics.find((group) => group.title === "Jeux sans HLTB").count, 2);
  assert.equal(diagnostics.find((group) => group.title === "IDs dupliqués").count, 1);
});

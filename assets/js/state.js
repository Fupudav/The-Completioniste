import {
  BACKUP_STORAGE_KEY,
  DEFAULT_PROFILE_ID,
  DEFAULT_PROFILE_NAME,
  DEFAULT_PROGRESS,
  HISTORY_LIMIT,
  MAX_BACKUPS,
  STATE_VERSION,
  STORAGE_KEY
} from "./constants.js";
import { slugify } from "./utils.js";

export function createProfileState(input = {}, fallbackId = DEFAULT_PROFILE_ID) {
  const id = String(input.id || fallbackId || DEFAULT_PROFILE_ID);
  return {
    id,
    name: String(input.name || (id === DEFAULT_PROFILE_ID ? DEFAULT_PROFILE_NAME : id)),
    progress: input.progress && typeof input.progress === "object" ? input.progress : {},
    custom: Array.isArray(input.custom) ? input.custom : [],
    collapsed: input.collapsed && typeof input.collapsed === "object" ? input.collapsed : {},
    overrides: input.overrides && typeof input.overrides === "object" ? input.overrides : {},
    pinnedSagas: Array.isArray(input.pinnedSagas) ? input.pinnedSagas : [],
    history: Array.isArray(input.history) ? input.history.slice(0, HISTORY_LIMIT) : []
  };
}

export function createBaseState() {
  return attachActiveProfile({
    version: STATE_VERSION,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: {
      [DEFAULT_PROFILE_ID]: createProfileState({ id: DEFAULT_PROFILE_ID, name: DEFAULT_PROFILE_NAME })
    },
    savedAt: null
  });
}

export function migrateState(input = {}) {
  const base = createBaseState();
  if (!input || typeof input !== "object") return base;

  const profileEntries = input.profiles && typeof input.profiles === "object"
    ? Object.entries(input.profiles)
    : [];
  const profiles = profileEntries.reduce((acc, [id, profile]) => {
    acc[id] = createProfileState(profile, id);
    return acc;
  }, {});

  if (!Object.keys(profiles).length) {
    profiles[DEFAULT_PROFILE_ID] = createProfileState({
      id: DEFAULT_PROFILE_ID,
      name: DEFAULT_PROFILE_NAME,
      progress: input.progress,
      custom: input.custom,
      collapsed: input.collapsed,
      overrides: input.overrides,
      pinnedSagas: input.pinnedSagas,
      history: input.history
    });
  }

  const firstProfileId = Object.keys(profiles)[0] || DEFAULT_PROFILE_ID;
  const activeProfileId = profiles[input.activeProfileId] ? input.activeProfileId : firstProfileId;

  return attachActiveProfile({
    ...base,
    ...input,
    version: STATE_VERSION,
    profiles,
    activeProfileId,
    savedAt: input.savedAt || null
  });
}

export function loadState(storage = localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? migrateState(JSON.parse(raw)) : createBaseState();
  } catch {
    return createBaseState();
  }
}

export function saveState(state, storage = localStorage, options = {}) {
  attachActiveProfile(state);
  state.version = STATE_VERSION;
  state.savedAt = new Date().toISOString();
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (options.backup !== false) createBackup(storage, state, "auto");
}

export function getProgress(state, id) {
  attachActiveProfile(state);
  const entry = state.progress[id];
  return {
    ...DEFAULT_PROGRESS,
    ...entry
  };
}

export function ensureProgress(state, id) {
  attachActiveProfile(state);
  state.progress[id] = getProgress(state, id);
  return state.progress[id];
}

export function touchProgress(state, id, date = new Date()) {
  const entry = ensureProgress(state, id);
  entry.updatedAt = date.toISOString();
  return entry;
}

export function getProfiles(state) {
  attachActiveProfile(state);
  return Object.values(state.profiles);
}

export function getActiveProfile(state) {
  attachActiveProfile(state);
  return state.profiles[state.activeProfileId];
}

export function setActiveProfile(state, profileId) {
  if (!state.profiles?.[profileId]) return getActiveProfile(state);
  state.activeProfileId = profileId;
  return getActiveProfile(state);
}

export function createProfile(state, name = "") {
  attachActiveProfile(state);
  const label = String(name || "").trim() || `Profil ${Object.keys(state.profiles).length + 1}`;
  const baseId = slugify(label) || `profile-${Date.now()}`;
  let id = baseId;
  let index = 2;
  while (state.profiles[id]) {
    id = `${baseId}-${index}`;
    index += 1;
  }
  state.profiles[id] = createProfileState({ id, name: label }, id);
  state.activeProfileId = id;
  return getActiveProfile(state);
}

export function recordHistory(state, item, date = new Date()) {
  const profile = getActiveProfile(state);
  const entry = {
    id: `${date.toISOString()}-${Math.random().toString(36).slice(2, 8)}`,
    at: date.toISOString(),
    type: item.type || "update",
    label: item.label || "Modification",
    gameId: item.gameId || "",
    saga: item.saga || "",
    detail: item.detail || ""
  };
  profile.history = [entry, ...profile.history].slice(0, HISTORY_LIMIT);
  attachActiveProfile(state);
  return entry;
}

export function createExportPayload(state) {
  return {
    app: "completion-saga-tracker",
    version: STATE_VERSION,
    exportedAt: new Date().toISOString(),
    state: migrateState(state)
  };
}

export function importStatePayload(payload) {
  const imported = payload?.state || payload;
  if (!imported || typeof imported !== "object") throw new Error("Format invalide");
  return migrateState(imported);
}

export function listBackups(storage = localStorage) {
  try {
    const raw = storage.getItem(BACKUP_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createBackup(storage = localStorage, state, reason = "manual", date = new Date()) {
  const backups = listBackups(storage);
  const day = date.toISOString().slice(0, 10);
  if (reason === "auto" && backups.some((backup) => backup.reason === "auto" && backup.day === day)) return backups;

  const backup = {
    id: `${date.toISOString()}-${reason}`,
    day,
    reason,
    createdAt: date.toISOString(),
    savedAt: state.savedAt || null,
    state: migrateState(state)
  };

  const next = [backup, ...backups]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, MAX_BACKUPS);
  storage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function restoreBackup(storage = localStorage, backupId) {
  const backup = listBackups(storage).find((item) => item.id === backupId);
  if (!backup) throw new Error("Sauvegarde introuvable");
  return migrateState(backup.state);
}

function attachActiveProfile(state) {
  if (!state || typeof state !== "object") return state;
  if (!state.profiles || typeof state.profiles !== "object") {
    state.profiles = {
      [DEFAULT_PROFILE_ID]: createProfileState({
        id: DEFAULT_PROFILE_ID,
        name: DEFAULT_PROFILE_NAME,
        progress: state.progress,
        custom: state.custom,
        collapsed: state.collapsed,
        overrides: state.overrides,
        pinnedSagas: state.pinnedSagas,
        history: state.history
      })
    };
  }

  for (const [id, profile] of Object.entries(state.profiles)) {
    state.profiles[id] = createProfileState(profile, id);
  }

  if (!state.activeProfileId || !state.profiles[state.activeProfileId]) {
    state.activeProfileId = Object.keys(state.profiles)[0] || DEFAULT_PROFILE_ID;
  }

  if (!state.profiles[state.activeProfileId]) {
    state.profiles[state.activeProfileId] = createProfileState({
      id: state.activeProfileId,
      name: DEFAULT_PROFILE_NAME
    }, state.activeProfileId);
  }

  const profile = state.profiles[state.activeProfileId];
  state.progress = profile.progress;
  state.custom = profile.custom;
  state.collapsed = profile.collapsed;
  state.overrides = profile.overrides;
  state.pinnedSagas = profile.pinnedSagas;
  state.history = profile.history;
  return state;
}

import { BACKUP_STORAGE_KEY, DEFAULT_PROGRESS, MAX_BACKUPS, STATE_VERSION, STORAGE_KEY } from "./constants.js";

export function createBaseState() {
  return {
    version: STATE_VERSION,
    progress: {},
    custom: [],
    collapsed: {},
    overrides: {},
    savedAt: null
  };
}

export function migrateState(input = {}) {
  const base = createBaseState();
  if (!input || typeof input !== "object") return base;

  return {
    ...base,
    ...input,
    version: STATE_VERSION,
    progress: input.progress && typeof input.progress === "object" ? input.progress : {},
    custom: Array.isArray(input.custom) ? input.custom : [],
    collapsed: input.collapsed && typeof input.collapsed === "object" ? input.collapsed : {},
    overrides: input.overrides && typeof input.overrides === "object" ? input.overrides : {}
  };
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
  state.version = STATE_VERSION;
  state.savedAt = new Date().toISOString();
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (options.backup !== false) createBackup(storage, state, "auto");
}

export function getProgress(state, id) {
  const entry = state.progress[id];
  return {
    ...DEFAULT_PROGRESS,
    ...entry
  };
}

export function ensureProgress(state, id) {
  state.progress[id] = getProgress(state, id);
  return state.progress[id];
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

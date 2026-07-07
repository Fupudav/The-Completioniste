export const STORAGE_KEY = "completion-saga-tracker-v1";
export const BACKUP_STORAGE_KEY = "completion-saga-tracker-backups-v1";
export const STATE_VERSION = 3;
export const MAX_BACKUPS = 12;
export const DEFAULT_PROFILE_ID = "default";
export const DEFAULT_PROFILE_NAME = "Moi";
export const HISTORY_LIMIT = 60;

export const STATUS_LABELS = {
  todo: "À faire",
  playing: "En cours",
  paused: "En pause",
  done: "Terminé",
  dropped: "Abandonné"
};

export const COMPLETION = {
  none: { label: "0", score: 0, long: "Non commencé" },
  story: { label: "Histoire", score: 55, long: "Histoire principale" },
  side: { label: "Annexes", score: 80, long: "Histoire + annexes" },
  hundred: { label: "100%", score: 100, long: "Completion totale" }
};

export const SCOPE_LABELS = {
  all: "Tous",
  principal: "Principal",
  "spin-off": "Spin-off",
  remake: "Remake",
  remaster: "Remaster",
  extension: "Extension",
  collection: "Collection",
  mobile: "Mobile",
  upcoming: "À venir"
};

export const SORT_LABELS = {
  catalog: "Catalogue",
  progressAsc: "Progression basse",
  progressDesc: "Progression haute",
  name: "Nom",
  year: "Année",
  hltbDesc: "Durée 100% haute",
  hltbAsc: "Durée 100% basse",
  priority: "Priorité",
  hltbRemaining: "Temps restant",
  lastUpdated: "Dernière modification"
};

export const DEFAULT_FILTERS = {
  search: "",
  category: "all",
  status: "all",
  scope: "all",
  sort: "catalog",
  hideDone: false,
  hideUpcoming: false,
  onlyOwned: false,
  onlyNext: false
};

export const DEFAULT_PROGRESS = {
  status: "todo",
  completion: "none",
  favorite: false,
  next: false,
  owned: false,
  priority: "normal",
  platform: "",
  hours: "",
  rating: "",
  notes: "",
  updatedAt: ""
};

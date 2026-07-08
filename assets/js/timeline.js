import { COMPLETION, STATUS_LABELS } from "./constants.js";
import { getProgress } from "./state.js";

const TIMELINE_FIELDS = [
  ["lastSessionDate", "session", "Dernière session"],
  ["hundredDate", "hundred", "100%"],
  ["finishDate", "done", "Terminé"],
  ["abandonedDate", "dropped", "Abandonné"],
  ["startDate", "started", "Commencé"]
];

export function getTimelineEvents(games, state, options = {}) {
  const gameEvents = games.flatMap((game) => {
    const entry = getProgress(state, game.id);
    return TIMELINE_FIELDS
      .filter(([field]) => entry[field])
      .map(([field, type, label]) => ({
        id: `${game.id}-${field}`,
        at: entry[field],
        type,
        label,
        title: game.title,
        saga: game.saga,
        detail: getTimelineDetail(entry, field)
      }));
  });

  const historyEvents = (state.history || []).map((item) => ({
    id: item.id,
    at: item.at,
    type: item.type || "history",
    label: item.label || "Modification",
    title: "",
    saga: item.saga || "",
    detail: item.detail || ""
  }));

  const events = [...gameEvents, ...historyEvents]
    .filter((item) => item.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return options.limit ? events.slice(0, options.limit) : events;
}

export function applyTemporalDefaults(entry, field, date = new Date()) {
  const today = date.toISOString().slice(0, 10);
  if (field === "status" && entry.status === "playing" && !entry.startDate) entry.startDate = today;
  if (field === "status" && entry.status === "done" && !entry.finishDate) entry.finishDate = today;
  if (field === "status" && entry.status === "dropped" && !entry.abandonedDate) entry.abandonedDate = today;
  if (field === "completion" && entry.completion === "hundred" && !entry.hundredDate) entry.hundredDate = today;
  return entry;
}

function getTimelineDetail(entry, field) {
  if (field === "hundredDate") return COMPLETION.hundred.long;
  if (field === "finishDate") return COMPLETION[entry.completion]?.long || STATUS_LABELS.done;
  if (field === "abandonedDate") return STATUS_LABELS.dropped;
  if (field === "startDate") return STATUS_LABELS.playing;
  return "";
}

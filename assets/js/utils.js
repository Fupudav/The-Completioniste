export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function acronym(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toLowerCase();
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeAttr(value = "") {
  return escapeHtml(value);
}

export function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

export function formatHltbTime(seconds) {
  if (!seconds) return "n/d";
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.max(1, Math.round(seconds / 60))} min`;
  const rounded = Math.round(hours * 2) / 2;
  return `${rounded.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
}

export function formatHoursShort(seconds) {
  if (!seconds) return "0 h";
  const hours = Math.round(seconds / 3600);
  return `${hours.toLocaleString("fr-FR")} h`;
}

export function secondsToHoursInput(seconds) {
  if (!seconds) return "";
  const rounded = Math.round((seconds / 3600) * 4) / 4;
  return String(rounded);
}

export function hoursInputToSeconds(value) {
  const normalized = String(value || "").trim().replace(",", ".");
  if (!normalized) return 0;
  const hours = Number.parseFloat(normalized);
  return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 3600) : 0;
}

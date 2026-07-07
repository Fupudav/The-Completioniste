import { SCOPE_LABELS } from "./constants.js";
import { importStatePayload, createExportPayload } from "./state.js";
import { hoursInputToSeconds, secondsToHoursInput } from "./utils.js";

export function openGameDialog(context) {
  const { filters, refs } = context;
  refs.gameForm.reset();
  refs.newCategory.value = filters.category !== "all" ? filters.category : "Catalogue personnel";
  refs.newScope.value = "principal";
  refs.gameDialog.showModal();
  refs.newSaga.focus();
}

export function addCustomGame(event, context) {
  event.preventDefault();
  const { refs, state } = context;
  const custom = {
    id: `custom-${Date.now()}`,
    category: refs.newCategory.value.trim() || "Catalogue personnel",
    saga: refs.newSaga.value.trim(),
    title: refs.newTitle.value.trim(),
    year: refs.newYear.value.trim() || "TBA",
    scope: refs.newScope.value,
    platforms: "Perso"
  };

  if (!custom.saga || !custom.title) return;
  state.custom.push(custom);
  context.recordHistory?.({
    type: "custom",
    label: `Jeu ajouté : ${custom.title}`,
    saga: custom.saga
  });
  context.persist();
  refs.gameDialog.close();
  context.refreshCatalog();
}

export function openEditGameDialog(gameId, context) {
  const { allGames, refs } = context;
  const game = allGames.find((item) => item.id === gameId);
  if (!game) return;
  refs.editGameId.value = game.id;
  refs.editTitle.value = game.title;
  refs.editYear.value = game.year;
  refs.editScope.value = game.scope;
  refs.editPlatforms.value = game.platforms;
  refs.editCoverUrl.value = game.coverUrl || "";
  refs.editHltbMain.value = secondsToHoursInput(game.hltb?.main);
  refs.editHltbExtra.value = secondsToHoursInput(game.hltb?.extra);
  refs.editHltbComplete.value = secondsToHoursInput(game.hltb?.complete);
  refs.editHltbId.value = game.hltb?.hltbId || "";
  refs.editDialog.showModal();
  refs.editTitle.focus();
}

export function saveGameEdits(event, context) {
  event.preventDefault();
  const { allGames, hltbTimes, refs, state } = context;
  const gameId = refs.editGameId.value;
  const game = allGames.find((item) => item.id === gameId);
  if (!game) return;

  const hltbOverride = {
    hltbId: refs.editHltbId.value.trim(),
    main: hoursInputToSeconds(refs.editHltbMain.value),
    extra: hoursInputToSeconds(refs.editHltbExtra.value),
    complete: hoursInputToSeconds(refs.editHltbComplete.value)
  };
  const baseHltb = hltbTimes[gameId] || null;
  const hltbHasValue = Boolean(hltbOverride.hltbId || hltbOverride.main || hltbOverride.extra || hltbOverride.complete);
  const hltbChanged = baseHltb
    ? hltbOverride.hltbId !== String(baseHltb.hltbId || "")
      || hltbOverride.main !== (baseHltb.main || 0)
      || hltbOverride.extra !== (baseHltb.extra || 0)
      || hltbOverride.complete !== (baseHltb.complete || 0)
    : hltbHasValue;
  const gameOverride = {
    title: refs.editTitle.value.trim() || game.baseTitle || game.title,
    year: refs.editYear.value.trim() || game.baseYear || game.year,
    scope: refs.editScope.value || game.baseScope || game.scope,
    platforms: refs.editPlatforms.value.trim(),
    coverUrl: refs.editCoverUrl.value.trim()
  };
  if (hltbChanged) gameOverride.hltb = hltbOverride;
  state.overrides[gameId] = gameOverride;
  context.touchGame?.(gameId);
  context.recordHistory?.({
    type: "edit",
    label: `Fiche modifiée : ${game.title}`,
    gameId,
    saga: game.saga,
    detail: hltbChanged ? "Fiche + HLTB" : "Fiche"
  });

  context.persist();
  refs.editDialog.close();
  context.refreshCatalog();
}

export function exportData(context) {
  const payload = createExportPayload(context.state);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `completion-sagas-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function importData(event, context) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      context.replaceState(importStatePayload(JSON.parse(String(reader.result))));
      context.persist({ backup: false });
      context.refreshCatalog();
    } catch {
      alert("Import impossible : fichier JSON invalide.");
    } finally {
      context.refs.importFile.value = "";
    }
  };
  reader.readAsText(file);
}

export function resetData(context) {
  if (!confirm("Effacer toute la progression, les notes et les jeux ajoutés ?")) return;
  const snapshot = context.createUndoSnapshot?.();
  context.replaceState();
  context.persist({ backup: false });
  context.refreshCatalog();
  if (snapshot) context.showUndo?.("Progression réinitialisée", snapshot);
}

export function fillScopeSelects(refs) {
  const options = Object.entries(SCOPE_LABELS)
    .filter(([value]) => value !== "all")
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
  refs.newScope.innerHTML = options;
  refs.editScope.innerHTML = options;
}

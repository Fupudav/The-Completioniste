import { COMPLETION, DLC_LABELS, SCOPE_LABELS, STATUS_LABELS, TARGET_LABELS } from "./constants.js";
import { getProgress } from "./state.js";
import { countBy, escapeAttr, escapeHtml, formatHltbTime } from "./utils.js";
import { getSagaStats } from "./stats.js";

export function statTemplate(value, label) {
  return `<div class="stat"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

export function sagaTemplate(saga, context) {
  const { allGames, filters, state } = context;
  const allSagaGames = allGames.filter((game) => game.saga === saga.name);
  const stats = getSagaStats(allSagaGames, state);
  const shown = saga.games.length;
  const defaultCollapsed = filters.search ? false : true;
  const collapsed = state.collapsed[saga.name] ?? defaultCollapsed;
  const pinned = state.pinnedSagas?.includes(saga.name);
  const scopeCounts = Object.entries(countBy(allSagaGames, "scope"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return `
    <article class="saga-card ${collapsed ? "collapsed" : ""} ${pinned ? "pinned" : ""}">
      <button class="saga-head" type="button" data-action="toggle-saga" data-saga="${escapeAttr(saga.name)}" aria-expanded="${!collapsed}">
        <div class="saga-title">
          <strong>${escapeHtml(saga.name)}</strong>
          <div class="chips">
            ${pinned ? `<span class="chip"><i style="--chip:#ca7a23"></i>Épinglée</span>` : ""}
            <span class="chip"><i></i>${escapeHtml(saga.category)}</span>
            <span class="chip">${stats.done}/${stats.total} terminés</span>
            ${scopeCounts.map(([scope, count]) => `<span class="chip ${escapeAttr(scope)}"><i></i>${SCOPE_LABELS[scope] || scope} · ${count}</span>`).join("")}
          </div>
        </div>
        <div class="saga-progress">
          <span><b>${stats.average}%</b><em>${shown} affichés</em></span>
          <div class="progress-track"><i style="--value:${stats.average}%"></i></div>
        </div>
        <span class="collapse-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        </span>
      </button>
      ${collapsed ? "" : `
      <div class="saga-body">
        <div class="saga-tools">
          <button class="btn" type="button" data-action="pin-saga" data-saga="${escapeAttr(saga.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5"></path><path d="M5 17h14"></path><path d="m8 17 1-9-2-5h10l-2 5 1 9"></path></svg>
            ${pinned ? "Désépingler" : "Épingler"}
          </button>
          <button class="btn" type="button" data-action="batch-story" data-saga="${escapeAttr(saga.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>
            Tout histoire
          </button>
          <button class="btn" type="button" data-action="batch-hundred" data-saga="${escapeAttr(saga.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"></path><path d="M2 12h20"></path><path d="m4.9 4.9 14.2 14.2"></path><path d="m19.1 4.9-14.2 14.2"></path></svg>
            Tout 100%
          </button>
          <button class="btn warning" type="button" data-action="batch-reset" data-saga="${escapeAttr(saga.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 15h10l1-15"></path></svg>
            Reset saga
          </button>
        </div>
        <div class="games">
          ${saga.games.map((game) => gameTemplate(game, context)).join("")}
        </div>
      </div>
      `}
    </article>
  `;
}

export function gameTemplate(game, context) {
  const { state } = context;
  const entry = getProgress(state, game.id);
  const override = state.overrides?.[game.id];
  const initials = game.title.split(/\s+/).slice(0, 2).map((word) => word[0] || "").join("").toUpperCase();
  const cover = game.coverUrl
    ? `<img class="cover-thumb" src="${escapeAttr(game.coverUrl)}" alt="" loading="lazy">`
    : `<div class="cover-placeholder" aria-hidden="true">${escapeHtml(initials || "TC")}</div>`;
  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => (
    `<option value="${value}" ${entry.status === value ? "selected" : ""}>${label}</option>`
  )).join("");
  const completionButtons = Object.entries(COMPLETION).map(([value, item]) => (
    `<button type="button" class="${entry.completion === value ? "active" : ""}" data-action="completion" data-completion="${value}" data-game-id="${game.id}" title="${item.long}">${item.label}</button>`
  )).join("");
  const targetOptions = Object.entries(TARGET_LABELS).map(([value, label]) => (
    `<option value="${value}" ${entry.target === value ? "selected" : ""}>Objectif ${label}</option>`
  )).join("");
  const dlcOptions = Object.entries(DLC_LABELS).map(([value, label]) => (
    `<option value="${value}" ${entry.dlcCompletion === value ? "selected" : ""}>${label}</option>`
  )).join("");

  return `
    <div class="game-row" data-status="${entry.status}">
      <div class="game-main">
        <div class="game-cover">${cover}</div>
        <div class="game-copy">
          <div class="game-title-line">
            <strong>${escapeHtml(game.title)}</strong>
            <span class="game-year">${escapeHtml(game.year)}</span>
          </div>
          <div class="game-meta">
            <span class="chip ${escapeAttr(game.scope)}"><i></i>${SCOPE_LABELS[game.scope] || game.scope}</span>
            ${game.platforms ? `<span class="chip">${escapeHtml(game.platforms)}</span>` : ""}
            ${override ? `<span class="chip"><i style="--chip:#475aa8"></i>Modifié</span>` : ""}
            ${entry.favorite ? `<span class="chip"><i style="--chip:#ca7a23"></i>Favori</span>` : ""}
            ${entry.next ? `<span class="chip"><i style="--chip:#a94442"></i>Cible</span>` : ""}
            ${entry.owned && entry.status === "todo" && entry.completion === "none" ? `<span class="chip"><i style="--chip:#6d7a39"></i>Possédé non lancé</span>` : ""}
            ${entry.edition ? `<span class="chip">${escapeHtml(entry.edition)}</span>` : ""}
          </div>
          ${hltbTimeTemplate(game, context)}
        </div>
      </div>
      <select class="status-select" data-field="status" data-game-id="${game.id}" aria-label="Statut de ${escapeAttr(game.title)}">
        ${statusOptions}
      </select>
      <div class="completion-tabs" aria-label="Completion de ${escapeAttr(game.title)}">
        ${completionButtons}
      </div>
      <div class="game-side">
        <select class="priority-select" data-field="priority" data-game-id="${game.id}" aria-label="Priorité de ${escapeAttr(game.title)}">
          <option value="normal" ${entry.priority === "normal" ? "selected" : ""}>Priorité normale</option>
          <option value="high" ${entry.priority === "high" ? "selected" : ""}>Prioritaire</option>
          <option value="low" ${entry.priority === "low" ? "selected" : ""}>Plus tard</option>
        </select>
        <div class="icon-actions">
          <button class="icon-btn ${entry.favorite ? "active" : ""}" type="button" data-action="favorite" data-game-id="${game.id}" title="Favori" aria-label="Favori">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.3 18.2 21l-1.6-7 5.4-4.7-7.1-.6L12 2 9.1 8.7 2 9.3 7.4 14 5.8 21Z"></path></svg>
          </button>
          <button class="icon-btn ${entry.next ? "active" : ""}" type="button" data-action="next" data-game-id="${game.id}" title="Prochaine cible" aria-label="Prochaine cible">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5"></path><path d="M4 5h12l-2 4 2 4H4"></path></svg>
          </button>
          <button class="icon-btn" type="button" data-action="edit-game" data-game-id="${game.id}" title="Modifier la fiche" aria-label="Modifier la fiche">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
          </button>
        </div>
      </div>
      <details class="game-details">
        <summary>Détails perso</summary>
        <div class="detail-grid">
          <label class="toggle"><input type="checkbox" data-field="owned" data-game-id="${game.id}" ${entry.owned ? "checked" : ""}> Possédé</label>
          <div class="field">
            <label>Objectif</label>
            <select class="small-input" data-field="target" data-game-id="${game.id}">${targetOptions}</select>
          </div>
          <div class="field">
            <label>Plateforme possédée</label>
            <input class="small-input" data-field="ownedPlatform" data-game-id="${game.id}" value="${escapeAttr(entry.ownedPlatform)}" placeholder="PS5, Steam Deck...">
          </div>
          <div class="field">
            <label>Édition</label>
            <input class="small-input" data-field="edition" data-game-id="${game.id}" value="${escapeAttr(entry.edition)}" placeholder="Complete, GOTY, Director's Cut...">
          </div>
          <div class="field">
            <label>Heures</label>
            <input class="small-input" type="number" min="0" step="1" data-field="hours" data-game-id="${game.id}" value="${escapeAttr(entry.hours)}">
          </div>
          <div class="field">
            <label>Note / 10</label>
            <input class="small-input" type="number" min="0" max="10" step=".5" data-field="rating" data-game-id="${game.id}" value="${escapeAttr(entry.rating)}">
          </div>
          <div class="field">
            <label>Plateforme jouée</label>
            <input class="small-input" data-field="platform" data-game-id="${game.id}" value="${escapeAttr(entry.platform)}" placeholder="Steam, PS5, Switch...">
          </div>
          <div class="field">
            <label>DLC</label>
            <select class="small-input" data-field="dlcCompletion" data-game-id="${game.id}">${dlcOptions}</select>
          </div>
          <div class="field">
            <label>Commencé le</label>
            <input class="small-input" type="date" data-field="startDate" data-game-id="${game.id}" value="${escapeAttr(entry.startDate)}">
          </div>
          <div class="field">
            <label>Dernière session</label>
            <input class="small-input" type="date" data-field="lastSessionDate" data-game-id="${game.id}" value="${escapeAttr(entry.lastSessionDate)}">
          </div>
          <button class="btn small" type="button" data-action="session-today" data-game-id="${game.id}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4"></path><path d="M16 2v4"></path><path d="M3 10h18"></path><path d="M5 4h14v18H5z"></path></svg>
            Session aujourd'hui
          </button>
          <div class="field">
            <label>Terminé le</label>
            <input class="small-input" type="date" data-field="finishDate" data-game-id="${game.id}" value="${escapeAttr(entry.finishDate)}">
          </div>
          <div class="field">
            <label>100% le</label>
            <input class="small-input" type="date" data-field="hundredDate" data-game-id="${game.id}" value="${escapeAttr(entry.hundredDate)}">
          </div>
          <div class="field">
            <label>Abandonné le</label>
            <input class="small-input" type="date" data-field="abandonedDate" data-game-id="${game.id}" value="${escapeAttr(entry.abandonedDate)}">
          </div>
          <div class="field" style="grid-column:1 / -1">
            <label>DLC / éditions</label>
            <textarea data-field="dlcNotes" data-game-id="${game.id}" placeholder="DLC inclus, passes saisonniers, édition possédée par plateforme...">${escapeHtml(entry.dlcNotes)}</textarea>
          </div>
          <div class="field" style="grid-column:1 / -1">
            <label>Notes</label>
            <textarea data-field="notes" data-game-id="${game.id}" placeholder="DLC restants, succès manquants, build, sauvegarde...">${escapeHtml(entry.notes)}</textarea>
          </div>
        </div>
      </details>
    </div>
  `;
}

export function hltbTimeTemplate(game, context) {
  const { hltbUpdatedAt } = context;
  const hltb = game.hltb;
  if (!hltb) return `<div class="hltb-times empty"><span>HLTB n/d</span></div>`;
  const votes = (hltb.mainCount || 0) + (hltb.extraCount || 0) + (hltb.completeCount || 0);
  const confidence = votes < 5 ? " low-confidence" : "";
  const hltbBadge = hltb.hltbId
    ? `<a href="https://howlongtobeat.com/game/${escapeAttr(hltb.hltbId)}" target="_blank" rel="noreferrer">HLTB</a>`
    : `<span>HLTB</span>`;
  return `
    <div class="hltb-times${confidence}" title="Données HowLongToBeat, mises à jour le ${hltbUpdatedAt}">
      ${hltbBadge}
      <span>Hist. ${formatHltbTime(hltb.main)}</span>
      <span>Ann. ${formatHltbTime(hltb.extra)}</span>
      <span>100% ${formatHltbTime(hltb.complete)}</span>
      ${game.hltbCustom ? `<span>Perso</span>` : ""}
      ${votes ? `<span>${votes} votes</span>` : ""}
    </div>
  `;
}

export function dashboardCard(value, label) {
  return `<div class="dashboard-card"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

export function statBar(label, value) {
  return `
    <div class="stat-bar">
      <strong>${escapeHtml(label)}</strong>
      <div class="progress-track"><i style="--value:${value}%"></i></div>
      <span>${value}%</span>
    </div>
  `;
}

export function backupListTemplate(backups) {
  if (!backups.length) {
    return `<div class="empty small">Aucune sauvegarde locale datée pour le moment.</div>`;
  }
  return backups.map((backup) => `
    <div class="backup-item">
      <div>
        <strong>${escapeHtml(new Date(backup.createdAt).toLocaleString("fr-FR"))}</strong>
        <span>${backup.reason === "auto" ? "Automatique" : "Manuelle"} · état ${escapeHtml(backup.savedAt || "n/d")} · v${escapeHtml(backup.stateVersion || "legacy")} · ${escapeHtml(String(backup.profileCount || 1))} profil${Number(backup.profileCount || 1) > 1 ? "s" : ""}${backup.checksum ? ` · ${escapeHtml(backup.checksum.slice(0, 14))}` : ""}</span>
      </div>
      <button class="btn" type="button" data-action="restore-backup" data-backup-id="${escapeAttr(backup.id)}">Restaurer</button>
    </div>
  `).join("");
}

export function historyListTemplate(history = []) {
  if (!history.length) {
    return `<div class="empty small">Aucune modification enregistrée pour ce profil.</div>`;
  }
  return history.slice(0, 20).map((item) => `
    <div class="history-item">
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(new Date(item.at).toLocaleString("fr-FR"))}${item.detail ? ` · ${escapeHtml(item.detail)}` : ""}</span>
      </div>
      ${item.saga ? `<span class="chip">${escapeHtml(item.saga)}</span>` : ""}
    </div>
  `).join("");
}

export function backlogListTemplate(items = []) {
  if (!items.length) {
    return `<div class="empty small">Aucune cible de backlog disponible.</div>`;
  }
  return items.map((item) => `
    <article class="backlog-item">
      <div>
        <strong>${escapeHtml(item.game.title)}</strong>
        <span>${escapeHtml(item.game.saga)} · ${escapeHtml(item.game.year)} · ${TARGET_LABELS[item.entry.target] || "100%"}</span>
        <div class="chips">
          <span class="chip"><i></i>${escapeHtml(item.game.category)}</span>
          <span class="chip">${item.entry.priority === "high" ? "Prioritaire" : item.entry.priority === "low" ? "Plus tard" : "Normal"}</span>
          ${item.ownedNotStarted ? `<span class="chip"><i style="--chip:#6d7a39"></i>Possédé non lancé</span>` : ""}
          ${item.entry.ownedPlatform ? `<span class="chip">${escapeHtml(item.entry.ownedPlatform)}</span>` : ""}
        </div>
      </div>
      <div class="backlog-metrics">
        <span>${formatHltbTime(item.remaining)} restant</span>
        <strong>${formatHltbTime(item.target)}</strong>
      </div>
    </article>
  `).join("");
}

export function timelineListTemplate(events = []) {
  if (!events.length) {
    return `<div class="empty small">Aucun événement temporel pour ce profil.</div>`;
  }
  return events.map((event) => `
    <div class="timeline-item ${escapeAttr(event.type)}">
      <time>${escapeHtml(formatDate(event.at))}</time>
      <div>
        <strong>${escapeHtml(event.title || event.label)}</strong>
        <span>${event.title ? `${escapeHtml(event.label)} · ` : ""}${escapeHtml(event.saga || "Profil")}${event.detail ? ` · ${escapeHtml(event.detail)}` : ""}</span>
      </div>
    </div>
  `).join("");
}

export function metricListTemplate(items = [], valueFormatter = (value) => `${value}%`) {
  if (!items.length) return `<div class="empty small">Aucune donnée disponible.</div>`;
  const max = Math.max(1, ...items.map((item) => item.value || 0));
  return items.map((item) => `
    <div class="metric-row">
      <strong>${escapeHtml(item.label)}</strong>
      <div class="progress-track"><i style="--value:${Math.round(((item.value || 0) / max) * 100)}%"></i></div>
      <span>${escapeHtml(valueFormatter(item.value, item))}</span>
    </div>
  `).join("");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("fr-FR");
}

export function diagnosticsTemplate(groups) {
  return groups.map((group) => `
    <div class="diagnostic-item ${escapeAttr(group.level)}">
      <div class="diagnostic-head">
        <strong>${escapeHtml(group.title)}</strong>
        <span>${group.count}</span>
      </div>
      ${group.items.length ? `<ul>${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>Rien à signaler.</p>`}
    </div>
  `).join("");
}

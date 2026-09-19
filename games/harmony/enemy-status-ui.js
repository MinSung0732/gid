const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function activeStatuses(entity, definitions) {
  return Object.entries(entity?.statuses || {})
    .filter(([id, status]) => definitions[id] && Number(status?.stacks) > 0)
    .map(([id, status]) => ({ id, status, definition: definitions[id] }));
}

export function enemyStatusVisibleLimit(enemyCount = 1) {
  const count = Math.max(1, Math.floor(Number(enemyCount) || 1));
  if (count >= 3) return 2;
  if (count === 2) return 3;
  return 4;
}

function statusBody(status, definition) {
  const stacks = Math.max(0, Math.floor(Number(status?.stacks) || 0)),
    turns = Math.max(0, Math.floor(Number(status?.turns) || 0)),
    lines = [
      status?.description || definition.description || "상태 효과",
      `현재 ${stacks} / 최대 ${definition.maxStacks}중첩`,
    ];
  if (turns > 0) lines.push(`남은 ${turns} / 최대 ${definition.maxTurns}턴`);
  return lines.join(" · ");
}

function compactChip({ id, status, definition }) {
  const stacks = Math.max(0, Math.floor(Number(status?.stacks) || 0)),
    body = statusBody(status, definition),
    name = definition.name || id;
  return `<button type="button" class="status-chip enemy-status-compact status-${escapeHtml(definition.kind)}" data-status-id="${escapeHtml(id)}" data-status-tip-ready="1" data-status-tip-name="${escapeHtml(name)}" data-status-tip-body="${escapeHtml(body)}" aria-label="${escapeHtml(`${name} ${stacks}중첩. ${body}`)}" style="--status-color:${escapeHtml(definition.color)}"><span aria-hidden="true">${escapeHtml(definition.icon)}</span><b>${stacks}</b></button>`;
}

function overflowChip(hidden) {
  const body = hidden
    .map(({ status, definition, id }) => {
      const stacks = Math.max(0, Math.floor(Number(status?.stacks) || 0)),
        turns = Math.max(0, Math.floor(Number(status?.turns) || 0)),
        name = definition.name || id;
      return `${name} ${stacks}${turns > 0 ? ` · ${turns}턴` : ""} — ${status?.description || definition.description || "상태 효과"}`;
    })
    .join("\n");
  return `<button type="button" class="status-chip enemy-status-overflow" data-status-tip-ready="1" data-status-tip-name="추가 상태 ${hidden.length}개" data-status-tip-body="${escapeHtml(body)}" aria-label="추가 상태 ${hidden.length}개"><b>+${hidden.length}</b></button>`;
}

export function enemyStatusSummaryHtml(entity, definitions, enemyCount = 1, label = "적 상태") {
  const entries = activeStatuses(entity, definitions);
  if (!entries.length) return "";
  const limit = enemyStatusVisibleLimit(enemyCount),
    visible = entries.slice(0, limit),
    hidden = entries.slice(limit);
  return `<span class="enemy-status-summary" aria-label="${escapeHtml(label)}">${visible.map(compactChip).join("")}${hidden.length ? overflowChip(hidden) : ""}</span>`;
}

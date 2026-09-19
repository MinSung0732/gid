const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function plannedPlayerStatuses(intent, definitions) {
  return Object.entries(intent?.applyPlayer || {})
    .map(([id, amount]) => {
      const definition = definitions[id],
        stacks = Math.max(
          0,
          Number(typeof amount === "object" ? amount?.stacks : amount) || 0,
        ),
        turns = Math.max(
          0,
          Number(typeof amount === "object" ? amount?.turns : 0) || 0,
        );
      if (!definition || stacks <= 0) return null;
      return {
        id,
        definition,
        stacks,
        turns,
        name: definition.name || id,
        description: amount?.description || definition.description || "상태 효과",
      };
    })
    .filter(Boolean);
}

function effectLabel({ name, stacks, turns }) {
  return `${name} ${stacks}중첩${turns > 0 ? ` · ${turns}턴` : ""}`;
}

function effectChip(effect) {
  const { id, definition, stacks, turns, name, description } = effect,
    label = effectLabel(effect),
    turnsHtml = turns > 0 ? `<em>${turns}턴</em>` : "";
  return `<span class="intent-effect-chip status-${escapeHtml(definition.kind)}" data-intent-status-id="${escapeHtml(id)}" style="--status-color:${escapeHtml(definition.color)}" title="${escapeHtml(`플레이어에게 ${label} 부여 · ${description}`)}" aria-label="${escapeHtml(`플레이어에게 ${label} 부여`)}"><i aria-hidden="true">${escapeHtml(definition.icon)}</i><b>${escapeHtml(name)}</b><strong>${stacks}</strong>${turnsHtml}</span>`;
}

export function enemyIntentPlayerEffectsHtml(
  intent,
  definitions,
  { maxVisible = 2 } = {},
) {
  const entries = plannedPlayerStatuses(intent, definitions);
  if (!entries.length) return "";

  const limit = Math.max(1, Math.floor(Number(maxVisible) || 2)),
    visible = entries.slice(0, limit),
    hidden = entries.slice(limit),
    chips = visible.map(effectChip);

  if (hidden.length) {
    const hiddenText = hidden.map(effectLabel).join(" · ");
    chips.push(
      `<span class="intent-effect-chip intent-effect-more" title="${escapeHtml(`플레이어에게 ${hiddenText} 부여`)}" aria-label="추가 상태 ${hidden.length}개: ${escapeHtml(hiddenText)}"><strong>+${hidden.length}</strong></span>`,
    );
  }

  return `<span class="intent-effect-row" aria-label="플레이어에게 부여 예정 상태">${chips.join("")}</span>`;
}

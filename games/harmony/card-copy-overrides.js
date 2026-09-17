function stripHtml(value = "") {
  return String(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function emphasized(text) {
  return String(text).replace(
    /([+-]?\d+(?:\.\d+)?%?|×\d+(?:\.\d+)?)/g,
    "<b>$1</b>",
  );
}

function markupRow(text) {
  const length = [...stripHtml(text).replace(/\s/g, "")].length,
    density = length >= 15 ? " card-summary-row-tight" : length >= 11 ? " card-summary-row-dense" : "";
  return `<span class="card-summary-row${density}">${emphasized(text)}</span>`;
}

function rowObject(key, text) {
  return {
    key,
    text,
    value: emphasized(text),
    label: key,
    result: text,
  };
}

function specialRows(engine, card) {
  const c = engine.cardDefinition(card);
  if (card.id === "burst_spatial_diffusion") {
    const multiplier = c.burstMultiplier ?? 3.2;
    return [
      "흡수 전량 → 전체 ×" + multiplier + " 피해",
      "적 행동 -1",
      "흡수 40+ → 전체 기절 +1",
    ];
  }
  if (card.id === "contact_pure_absorb_overload")
    return ["흡수 " + c.requiredAbsorb + " → 피해 " + c.attack];
  return null;
}

function normalizedPolicyRows(engine, card, baseRows = []) {
  const c = engine.cardDefinition(card),
    limit = c.tier === 4 ? 4 : 3,
    rows = baseRows.map((entry) => ({ ...entry }));
  let changed = false;

  if (c.target === "all") {
    for (const entry of rows) {
      if (entry.key !== "direct-status" || entry.text.startsWith("전체 ")) continue;
      entry.text = "전체 " + entry.text;
      entry.value = emphasized(entry.text);
      entry.result = entry.text;
      changed = true;
    }
  }

  if (c.applyWeak && !rows.some((entry) => entry.text.includes("약화"))) {
    rows.push(rowObject("apply-weak", "약화 +" + c.applyWeak));
    changed = true;
  }

  if (c.absorbFromDamage && !rows.some((entry) => entry.key === "damage-to-absorb")) {
    rows.push(
      rowObject(
        "damage-to-absorb",
        "가한 피해 " + Math.round(c.absorbFromDamage * 100) + "% → 흡수",
      ),
    );
    changed = true;
  }

  return { rows: rows.slice(0, limit), changed };
}

function legacyConditionalDetail(engine, card, detail) {
  const definition = engine.cardDefinition(card);
  if (!definition?.applyEnemyIfPreAttackStatus && !definition?.burnProcCount)
    return detail;

  let plain = stripHtml(detail);
  if (definition.burnProcCount) {
    const burning = definition.applyEnemy?.burning;
    if (burning != null) {
      const amount = typeof burning === "object"
        ? burning.stacks ?? burning.value ?? 1
        : burning;
      plain = plain.replace(
        new RegExp(`연소를\\s*${amount}중첩\\s*적용합니다\\.?`),
        `연소 +${amount}.`,
      );
    }
  }
  return plain;
}

export function applyCardCopyOverrides(options, presentation) {
  const { engine } = options;

  function compactCardEffectSummary(card, comparisonCard = null) {
    if (card?.id === "impurity")
      return presentation.compactCardEffectSummary(card, comparisonCard);

    const hardcoded = specialRows(engine, card),
      base = presentation.compactCardEffectSummary(card, comparisonCard),
      normalized = hardcoded
        ? { rows: hardcoded.map((text, index) => rowObject(`override-${index}`, text)), changed: true }
        : normalizedPolicyRows(engine, card, base?.rows || []);
    if (!normalized.changed) return base;

    const summaryRows = normalized.rows.map((entry) => markupRow(entry.text)).join(""),
      detail = cardEffectText(card, true);
    return {
      symbols: base?.symbols || "",
      body: `<span class="card-effect-main card-effect-compact">${summaryRows}</span><span class="card-effect-tooltip" role="tooltip">${detail}</span>`,
      rows: normalized.rows,
    };
  }

  function cardEffectText(card, expanded = false) {
    if (expanded) {
      const detail = presentation.cardEffectText(card, true);
      return card?.id === "impurity"
        ? detail
        : legacyConditionalDetail(engine, card, detail);
    }
    if (card?.id === "impurity") return presentation.cardEffectText(card, expanded);
    const hardcoded = specialRows(engine, card);
    if (hardcoded) return hardcoded.join(" · ");
    const base = presentation.compactCardEffectSummary(card),
      normalized = normalizedPolicyRows(engine, card, base?.rows || []);
    return normalized.changed
      ? normalized.rows.map((entry) => entry.text).join(" · ")
      : presentation.cardEffectText(card, false);
  }

  function cardHtml(card, index = null, interaction = null, comparisonCard = null) {
    const rendered = presentation.cardHtml(card, index, interaction, comparisonCard);
    if (card?.id === "impurity") return rendered;
    const compact = compactCardEffectSummary(card, comparisonCard);
    if (!compact) return rendered;
    return rendered.replace(
      /<span class="card-effects">[\s\S]*<\/span><\/button>$/,
      `<span class="card-effects">${compact.body}</span></button>`,
    );
  }

  return {
    ...presentation,
    cardEffectText,
    compactCardEffectSummary,
    cardHtml,
  };
}

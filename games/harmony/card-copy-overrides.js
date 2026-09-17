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

function specialRows(engine, card) {
  const c = engine.cardDefinition(card);
  if (card.id === "burst_spatial_diffusion") {
    const multiplier = c.burstMultiplier ?? 3.2;
    return [
      `흡수 전량 → 전체 ×${multiplier} 피해`,
      "적 행동 -1",
      "흡수 40+ → 전체 기절 +1",
    ];
  }
  if (card.id === "contact_pure_absorb_overload")
    return [`흡수 ${c.requiredAbsorb} → 피해 ${c.attack}`];
  return null;
}

export function applyCardCopyOverrides(options, presentation) {
  const { engine } = options;

  function compactCardEffectSummary(card, comparisonCard = null) {
    const rows = specialRows(engine, card);
    if (!rows) return presentation.compactCardEffectSummary(card, comparisonCard);
    const base = presentation.compactCardEffectSummary(card, comparisonCard),
      summaryRows = rows.map(markupRow).join(""),
      detail = presentation.cardEffectText(card, true);
    return {
      symbols: base?.symbols || "",
      body: `<span class="card-effect-main card-effect-compact">${summaryRows}</span><span class="card-effect-tooltip" role="tooltip">${detail}</span>`,
      rows: rows.map((text, index) => ({
        key: `override-${index}`,
        text,
        value: emphasized(text),
        label: `override-${index}`,
        result: text,
      })),
    };
  }

  function cardEffectText(card, expanded = false) {
    const rows = specialRows(engine, card);
    if (!rows || expanded) return presentation.cardEffectText(card, expanded);
    return rows.join(" · ");
  }

  function cardHtml(card, index = null, interaction = null, comparisonCard = null) {
    const rendered = presentation.cardHtml(card, index, interaction, comparisonCard),
      rows = specialRows(engine, card);
    if (!rows) return rendered;
    const compact = compactCardEffectSummary(card, comparisonCard);
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

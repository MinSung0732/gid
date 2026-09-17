import { STATUS_DEFINITIONS } from "./statuses.js";
import { formatStatusKeywords } from "./status-text.js";

function stripHtml(value = "") {
  return String(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function emphasized(text) {
  return String(text).replace(
    /([+-]?\d+(?:\.\d+)?%?|×\d+(?:\.\d+)?)/g,
    "<b>$1</b>",
  );
}

function markupRow(text, changed = false) {
  const length = [...stripHtml(text).replace(/\s/g, "")].length,
    density = length >= 15 ? " card-summary-row-tight" : length >= 11 ? " card-summary-row-dense" : "";
  return `<span class="card-summary-row${density}${changed ? " card-summary-row-upgraded" : ""}">${emphasized(text)}</span>`;
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

function pushSummaryRow(rows, key, text) {
  if (!text || rows.some((entry) => entry.key === key || entry.text === text)) return;
  rows.push(rowObject(key, text));
}

function collectAppliedStatusIds(c) {
  const ids = [],
    add = (id) => {
      if (id && !ids.includes(id)) ids.push(id);
    },
    addMap = (map) => Object.keys(map || {}).forEach(add);

  addMap(c.applyEnemy);
  addMap(c.applyPlayer);
  addMap(c.applyEnemyAfterAttack);
  addMap(c.onHitApplyEnemy);
  addMap(c.absorbThresholdApplyAllEnemy);
  addMap(c.thresholdApplyAllEnemy);
  addMap(c.thornsApplyAttacker);
  Object.values(c.conditionalEnemyIntent || {}).forEach(addMap);
  addMap(c.applyEnemyIfPreAttackStatus?.apply);
  if (c.chanceStatusOnHit?.id) add(c.chanceStatusOnHit.id);
  if (c.applyWeak || c.weakOnHit) add("weak");
  if (c.thorns) add("thorns");
  if (c.discardAttackBurn) add("burning");
  if (c.stunOrDisarmBossTurns) {
    add("stun");
    add("disarm");
  }
  if (c.id === "burst_spatial_diffusion") add("stun");

  return ids;
}

function simplifiedSummaryRows(options, card) {
  const { engine, getRun } = options,
    statusDefinitions = options.statusDefinitions || STATUS_DEFINITIONS,
    c = engine.cardDefinition(card),
    level = card.level || 0,
    up = c.upgrades ? 0 : level * 3,
    run = getRun?.(),
    attackStat = run ? engine.power(run, "attack") : 0,
    defenseStat = run ? engine.power(run, "defense") : 0,
    rows = [];

  if (c.attack) {
    const hitText = c.hits > 1 ? ` ×${c.hits}` : "";
    pushSummaryRow(rows, "damage", `피해 ${c.attack + up + attackStat}${hitText}`);
  } else if (c.burst || c.weight) {
    pushSummaryRow(rows, "damage", "피해");
  }

  if (c.heal)
    pushSummaryRow(rows, "heal", `회복 ${c.heal + up}`);
  else if (c.missingHpHealRatio)
    pushSummaryRow(rows, "heal", "회복");

  if (c.shield)
    pushSummaryRow(rows, "shield", `방어막 ${c.shield + up + defenseStat}`);
  if (c.turnDamageReduction)
    pushSummaryRow(rows, "damage-reduction", `피해 경감 ${c.turnDamageReduction}`);
  if (c.draw)
    pushSummaryRow(rows, "draw", `드로우 ${c.draw}`);
  if (c.discard)
    pushSummaryRow(rows, "discard", `버리기 ${c.discard}`);
  if (c.randomDiscard)
    pushSummaryRow(rows, "random-discard", `무작위 버리기 ${c.randomDiscard}`);

  if (c.absorb || c.absorbFromDamage || c.absorbAmplifyRatio || c.absorbBooster || c.resonanceConsumeMax)
    pushSummaryRow(rows, "absorb", "흡수");

  for (const id of collectAppliedStatusIds(c)) {
    const name = statusDefinitions[id]?.name || id;
    pushSummaryRow(rows, `status-${id}`, name);
  }

  if (c.bypassShield || c.thresholdBypassShield || c.ailmentBurstMultiplier || c.globalAilmentBurstMultiplier || c.resonanceChainSplashPerStack)
    pushSummaryRow(rows, "pierce", "관통");
  if (c.target === "all" && (c.attack || c.burst || c.weight))
    pushSummaryRow(rows, "area", "광역");
  if (c.randomEachHit)
    pushSummaryRow(rows, "ricochet", "도탄");
  if (c.oil)
    pushSummaryRow(rows, "oil", "오일");
  if (c.cleanse || c.cleanseAilmentStacks)
    pushSummaryRow(rows, "cleanse", "정화");
  if (c.retainShield)
    pushSummaryRow(rows, "retain-shield", "방어막 유지");
  if (c.shieldCounter || c.shieldScalingAttack)
    pushSummaryRow(rows, "shield-counter", "방어막 반격");
  if (c.shieldSurvivalHeal)
    pushSummaryRow(rows, "survival-heal", "회복 보너스");
  if (c.comboHealThreshold || c.comboContactBonus)
    pushSummaryRow(rows, "combo-bonus", "콤보 보너스");
  if (c.harmonyHealShield || c.stagedRefund === "harmonyCompletedByCard")
    pushSummaryRow(rows, "harmony-bonus", "HARMONY 보너스");
  if (c.overhealShieldRatio || c.resonanceCoverBonus)
    pushSummaryRow(rows, "shield-bonus", "방어막 보너스");
  if (c.shieldDamageMultiplier)
    pushSummaryRow(rows, "shield-damage-bonus", "방어막 피해 보너스");
  if (c.amplifyAilments || c.extendDecayStatuses)
    pushSummaryRow(rows, "ailment-bonus", "상태이상 강화");
  if (c.shieldScaling || c.battleContactBonus || c.turnDamageBonus || c.handDamageBonus || c.firstTurnOrFullHpMultiplier || Object.keys(c.bonusPerStatus || {}).length || c.consumeResonance || c.absorbBonusRatio || c.absorbCost || c.executeRatio || c.ailmentBurstMultiplier || c.globalAilmentBurstMultiplier || c.discardCostDamage || c.resonanceDamagePerStack || c.resonanceChainConsumeAll || c.resonanceChainSplashPerStack)
    pushSummaryRow(rows, "damage-bonus", "피해 보너스");
  if (c.hitsPerCardThisTurn)
    pushSummaryRow(rows, "hit-bonus", "연타 보너스");
  if (c.burnProcCount)
    pushSummaryRow(rows, "burn-proc", "연소 발동");
  if (c.preventAbsorbDecay)
    pushSummaryRow(rows, "absorb-decay", "흡수 감쇄 방지");
  if (c.reduceOilCost)
    pushSummaryRow(rows, "oil-cost", "오일 비용 감소");
  if (c.refundOnBreak || c.refundOnKill || c.discardTierAp || c.refundAbsorbThreshold || (c.stagedRefund && c.stagedRefund !== "harmonyCompletedByCard") || c.stagedDiscardRefundBaseCost)
    pushSummaryRow(rows, "ap-refund", "AP 환급");
  if (c.drawOnBreak || c.drawOnKill || c.stagedRefund === "fifthCardOnce")
    pushSummaryRow(rows, "conditional-draw", "드로우");
  if (c.searchDrawCard)
    pushSummaryRow(rows, "search", "카드 서치");
  if (c.maxHpOnKill)
    pushSummaryRow(rows, "max-hp", "최대 체력 증가");
  if (c.purgeImpurity)
    pushSummaryRow(rows, "purge-impurity", "불순물 소멸");
  if (c.resonanceSutureConsume)
    pushSummaryRow(rows, "resonance-heal", "회복 보너스");

  if (!rows.length)
    pushSummaryRow(rows, "effect", "효과");
  return rows;
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

function restoreRuntimeModifier(options, card, detail) {
  const { engine, getRun, getStarted } = options,
    run = getRun?.();
  if (!getStarted?.() || run?.phase !== "battle" || !run.battle || /card-value-modifier/.test(detail))
    return detail;

  const c = engine.cardDefinition(card),
    level = card.level || 0,
    up = c.upgrades ? 0 : level * 3,
    target = run.battle.enemies?.[run.battle.selectedTarget];
  let kind = null, raw = null;
  if (c.attack) {
    kind = "attack";
    raw = c.attack + up + engine.power(run, "attack");
  } else if (c.heal) {
    kind = "heal";
    raw = c.heal + up;
  } else if (c.shield) {
    kind = "shield";
    raw = c.shield + up + engine.power(run, "defense");
  }
  if (!kind || !Number.isFinite(raw)) return detail;

  const breakdown = engine.cardStatusValueBreakdown?.(run, raw, kind, target),
    delta = breakdown?.delta || 0;
  if (!delta) return detail;
  const modifier = `<span class="card-value-modifier ${delta > 0 ? "positive" : "negative"}">(${delta > 0 ? "+" : ""}${delta})</span>`;
  return detail.replace(
    /(<b class="semantic-gain">[^<]+)(<\/b>)/,
    `$1${modifier}$2`,
  );
}


export function applyCardCopyOverrides(options, presentation) {
  const { engine } = options;

  function compactCardEffectSummary(card, comparisonCard = null) {
    if (card?.id === "impurity")
      return presentation.compactCardEffectSummary(card, comparisonCard);

    const rows = simplifiedSummaryRows(options, card),
      comparison = comparisonCard ? simplifiedSummaryRows(options, comparisonCard) : [],
      comparisonByKey = new Map(comparison.map((entry) => [entry.key, entry.result])),
      summaryRows = rows
        .map((entry) => markupRow(
          entry.text,
          Boolean(comparisonCard) && comparisonByKey.get(entry.key) !== entry.result,
        ))
        .join(""),
      detail = cardEffectText(card, true),
      base = presentation.compactCardEffectSummary(card, comparisonCard);
    return {
      symbols: base?.symbols || "",
      body: `<span class="card-effect-main card-effect-compact">${summaryRows}</span><span class="card-effect-tooltip" role="tooltip">${detail}</span>`,
      rows,
    };
  }

  function cardEffectText(card, expanded = false) {
    if (expanded) {
      const detail = presentation.cardEffectText(card, true);
      if (card?.id === "impurity") return detail;
      const conditional = legacyConditionalDetail(engine, card, detail),
        finalized = typeof conditional === "string" && !conditional.includes("<")
          ? conditional
          : restoreRuntimeModifier(options, card, conditional);
      return formatStatusKeywords(finalized, options.statusDefinitions || STATUS_DEFINITIONS);
    }
    if (card?.id === "impurity") return presentation.cardEffectText(card, expanded);
    return simplifiedSummaryRows(options, card).map((entry) => entry.text).join(" · ");
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

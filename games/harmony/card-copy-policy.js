const SUMMARY_LIMIT = 3;
const LEGENDARY_SUMMARY_LIMIT = 4;

function stripHtml(value = "") {
  return String(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function emphasized(text) {
  return escapeHtml(text).replace(
    /([+-]?\d+(?:\.\d+)?%?|×\d+(?:\.\d+)?)/g,
    "<b>$1</b>",
  );
}

function row(key, text, priority = 50) {
  return {
    key,
    text,
    priority,
    value: emphasized(text),
    label: key,
    result: text,
  };
}

function amountValue(amount) {
  return typeof amount === "object"
    ? amount.stacks ?? amount.value ?? 1
    : amount;
}

function amountTurns(amount) {
  return typeof amount === "object" ? amount.turns : null;
}

function statusName(statusDefinitions, id) {
  return statusDefinitions[id]?.name || id;
}

function statusCompact(statusDefinitions, id, amount) {
  const value = amountValue(amount),
    turns = amountTurns(amount),
    name = statusName(statusDefinitions, id);
  return `${name} +${value}${turns ? ` · ${turns}턴` : ""}`;
}

function statusMapCompact(statusDefinitions, map = {}) {
  return Object.entries(map)
    .map(([id, amount]) => statusCompact(statusDefinitions, id, amount))
    .join(" · ");
}

function cardValue(engine, getRun, raw, kind) {
  const run = getRun?.();
  if (!run?.battle || !Number.isFinite(raw)) return `${raw}`;
  const target = run.battle.enemies?.[run.battle.selectedTarget];
  const breakdown = engine.cardStatusValueBreakdown?.(run, raw, kind, target);
  if (!breakdown || !breakdown.delta) return `${raw}`;
  return `${raw} (${breakdown.delta > 0 ? "+" : ""}${breakdown.delta})`;
}

function addCandidate(list, key, text, priority = 50) {
  if (!text || list.some((entry) => entry.key === key || entry.text === text)) return;
  list.push(row(key, text, priority));
}

function directStatusText(c, statusDefinitions) {
  const enemy = statusMapCompact(statusDefinitions, c.applyEnemy),
    player = statusMapCompact(statusDefinitions, c.applyPlayer),
    after = statusMapCompact(statusDefinitions, c.applyEnemyAfterAttack),
    parts = [];
  if (enemy) parts.push(enemy);
  if (player) parts.push(`자신 ${player}`);
  if (after) parts.push(after);
  return parts.join(" · ");
}

function stagedRefundText(c) {
  switch (c.stagedRefund) {
    case "paidContactBefore": return "선행 유료 접촉 → AP +1";
    case "ailmentTypes2": return "상태 2종+ → AP +1";
    case "shield12Before": return "방어막 12+ → AP +1";
    case "regenerationBefore": return "재생 보유 → AP +1";
    case "harmonyCompletedByCard": return "HARMONY 완료 → AP +1";
    case "hand6Before": return "손패 6+ → AP +1";
    case "targetBleed4Before": return "출혈 4+ → AP +1";
    case "ailmentTypes3": return "상태 3종+ → AP +2";
    case "fifthCardOnce": return "5번째+ 카드 → AP+2 · 드로우1";
    default: return "";
  }
}

function buildSummaryRows({ engine, statusDefinitions, getRun }, card) {
  const c = engine.cardDefinition(card),
    level = card.level || 0,
    up = c.upgrades ? 0 : level * 3,
    run = getRun?.(),
    attackStat = run ? engine.power(run, "attack") : 0,
    defenseStat = run ? engine.power(run, "defense") : 0,
    candidates = [];

  const basic = [];
  if (c.attack) {
    const attack = c.attack + up + attackStat,
      hitText = c.hits > 1 ? ` ×${c.hits}` : "",
      targetText = c.target === "all" ? "전체 " : "",
      randomText = c.randomEachHit ? " · 무작위" : "",
      pierceText = c.bypassShield ? " · 관통" : "",
      shieldMultiplier = c.shieldDamageMultiplier ? ` · 방어막 ×${c.shieldDamageMultiplier}` : "";
    basic.push(`${targetText}피해 ${cardValue(engine, getRun, attack, "attack")}${hitText}${randomText}${pierceText}${shieldMultiplier}`);
  } else if (c.burst) {
    const multiplier = c.burstMultiplier ?? (card.level > 0 ? 4.5 : 3.2),
      targetText = c.target === "all" ? "전체 " : "";
    basic.push(`흡수 전량 → ${targetText}×${multiplier} 피해`);
  } else if (c.weight) {
    basic.push("방어막 전량 → 피해");
  }
  if (c.heal)
    basic.push(`회복 +${cardValue(engine, getRun, c.heal + up, "heal")}`);
  if (c.missingHpHealRatio)
    basic.push(`잃은 체력 ${Math.round(c.missingHpHealRatio * 100)}% 회복 · 최소${c.minimumHeal || 0}`);
  if (c.shield)
    basic.push(`방어막 +${cardValue(engine, getRun, c.shield + up + defenseStat, "shield")}`);
  if (c.absorb) basic.push(`흡수 +${c.absorb + up}`);
  if (c.draw) basic.push(`드로우${c.draw}`);
  if (basic.length) {
    const first = basic.slice(0, 2).join(" · ");
    addCandidate(candidates, "base", first, 0);
    if (basic.length > 2) addCandidate(candidates, "base-extra", basic.slice(2).join(" · "), 3);
  }

  const directStatuses = directStatusText(c, statusDefinitions);
  if (directStatuses) addCandidate(candidates, "direct-status", directStatuses, 8);

  if (c.refundOnBreak || c.drawOnBreak) {
    const effects = [];
    if (c.refundOnBreak) effects.push(`AP+${c.refundOnBreak}`);
    if (c.drawOnBreak) effects.push(`드로우${c.drawOnBreak}`);
    addCandidate(candidates, "break", `방어막 파괴 → ${effects.join(" · ")}`, 5);
  }
  if (c.refundOnKill || c.drawOnKill || c.maxHpOnKill) {
    const effects = [];
    if (c.refundOnKill) effects.push(`AP+${c.refundOnKill}`);
    if (c.drawOnKill) effects.push(`드로우${c.drawOnKill}`);
    if (c.maxHpOnKill) effects.push(`최대 HP +${c.maxHpOnKill}`);
    addCandidate(candidates, "kill", `처치 → ${effects.join(" · ")}`, 5);
  }
  if (c.comboContactBonus)
    addCandidate(candidates, "combo-contact", `선행 접촉 → 피해 +${c.comboContactBonus}`, 10);
  if (c.shieldScaling)
    addCandidate(candidates, "shield-scaling", `방어막 ${Math.round(c.shieldScaling * 100)}% 추가 피해`, 10);
  if (c.battleContactBonus)
    addCandidate(candidates, "battle-contact", `이전 접촉 1장당 타격 +${c.battleContactBonus}`, 10);
  if (c.turnDamageBonus)
    addCandidate(candidates, "turn-scaling", `현재 턴수 ×${c.turnDamageBonus} 추가 피해`, 10);
  if (c.handDamageBonus)
    addCandidate(candidates, "hand-scaling", `손패 1장당 +${c.handDamageBonus}`, 10);
  if (c.firstTurnOrFullHpMultiplier)
    addCandidate(candidates, "opening-mult", `1턴째 또는 HP100% → 피해 ×${c.firstTurnOrFullHpMultiplier}`, 10);

  const perStatus = Object.entries(c.bonusPerStatus || {});
  if (perStatus.length) {
    const names = perStatus.map(([id]) => statusName(statusDefinitions, id)).join("·"),
      values = [...new Set(perStatus.map(([, value]) => value))];
    addCandidate(
      candidates,
      "status-scaling",
      values.length === 1
        ? `${names} 1당 +${values[0]} 피해`
        : perStatus.map(([id, value]) => `${statusName(statusDefinitions, id)} 1당 +${value}`).join(" · "),
      10,
    );
  }

  if (c.consumeResonance)
    addCandidate(candidates, "consume-resonance", `잔향 전량 → 1당 +${c.consumeResonance} 피해`, 7);
  if (c.absorbBonusRatio)
    addCandidate(candidates, "absorb-bonus", `현재 흡수 ${Math.round(c.absorbBonusRatio * 100)}% 추가 피해`, 10);
  if (c.requiredAbsorb)
    addCandidate(candidates, "required-absorb", `흡수 ${c.requiredAbsorb} → 피해 ${c.attack + up + attackStat}`, 4);
  if (c.absorbCost)
    addCandidate(candidates, "absorb-cost", `흡수 ${c.absorbCost}+ → 피해 ${c.fueledAttack}`, 6);
  if (c.executeRatio)
    addCandidate(candidates, "execute", `HP≤${Math.round(c.executeRatio * 100)}%${c.executeNonBoss ? " 비보스" : ""} → 피해 ×${c.executeMultiplier || (c.executeAttack && c.attack ? Number((c.executeAttack / c.attack).toFixed(2)) : 1)}`, 7);

  if (c.shieldThreshold) {
    const effects = [];
    if (c.thresholdBypassShield) effects.push("관통");
    if (c.thresholdApplyAllEnemy)
      effects.push(`전체 ${statusMapCompact(statusDefinitions, c.thresholdApplyAllEnemy)}`);
    addCandidate(candidates, "shield-threshold", `방어막 ${c.shieldThreshold}+ → ${effects.join(" · ")}`, 6);
  }
  if (c.onHitCount && c.onHitApplyEnemy)
    addCandidate(candidates, "hit-threshold", `${c.onHitCount}타+ → ${statusMapCompact(statusDefinitions, c.onHitApplyEnemy)}`, 7);
  if (c.ailmentBurstMultiplier)
    addCandidate(candidates, "ailment-burst", `상태합 ×${c.ailmentBurstMultiplier} 관통 피해`, 6);
  if (c.amplifyAilments)
    addCandidate(candidates, "ailment-amplify", `상태 ×${c.amplifyAilments}`, 7);
  if (c.globalAilmentBurstMultiplier)
    addCandidate(candidates, "global-ailment-burst", `전체 상태합 ×${c.globalAilmentBurstMultiplier} 관통 피해`, 6);
  if (c.extendDecayStatuses)
    addCandidate(candidates, "decay-delay", `중독·부식 감소 ${c.extendDecayStatuses}회 지연`, 15);
  if (c.hitsPerCardThisTurn)
    addCandidate(candidates, "hits-per-card", `이전 카드당 +${c.hitsPerCardThisTurn}타 (최대${c.maxHits})`, 5);
  if (c.chanceStatusOnHit)
    addCandidate(candidates, "chance-status", `적중 ${Math.round(c.chanceStatusOnHit.chance * 100)}% → ${statusCompact(statusDefinitions, c.chanceStatusOnHit.id, c.chanceStatusOnHit.amount)}`, 7);
  if (c.stunOrDisarmBossTurns)
    addCandidate(candidates, "boss-control", `기절 +1 · 보스 저항 → 무장해제 ${c.stunOrDisarmBossTurns}턴`, 6);
  if (c.burnProcCount)
    addCandidate(candidates, "burn-proc", `기존 연소 최대 ${c.burnProcCount}회 발동`, 9);
  if (c.applyEnemyIfPreAttackStatus) {
    const required = statusName(statusDefinitions, c.applyEnemyIfPreAttackStatus.statusId),
      applied = statusMapCompact(statusDefinitions, c.applyEnemyIfPreAttackStatus.apply);
    addCandidate(candidates, "pre-status", `${required} 대상 → ${applied}`, 7);
  }

  if (c.discard) addCandidate(candidates, "discard", `선택 버리기${c.discard}`, 12);
  if (c.randomDiscard) addCandidate(candidates, "random-discard", `무작위 버리기${c.randomDiscard}`, 12);
  if (c.discardTierAp)
    addCandidate(candidates, "discard-tier-ap", `T1+ 버림 → AP +${c.discardTierAp}`, 7);
  if (c.discardAttackBurn)
    addCandidate(candidates, "discard-attack-burn", `공격 카드 버림 → 연소 +${c.discardAttackBurn}`, 7);
  if (c.discardCostDamage)
    addCandidate(candidates, "discard-cost-damage", `버린 카드 AP 1당 +${c.discardCostDamage} 피해`, 7);

  if (c.refundAbsorbThreshold)
    addCandidate(candidates, "absorb-refund", `흡수 ${c.refundAbsorbThreshold}+ → AP +1`, 7);
  if (c.absorbStatusThreshold && c.absorbThresholdApplyAllEnemy)
    addCandidate(candidates, "absorb-threshold-status", `흡수 ${c.absorbStatusThreshold}+ → 전체 ${statusMapCompact(statusDefinitions, c.absorbThresholdApplyAllEnemy)}`, 7);
  if (c.absorbAmplifyRatio)
    addCandidate(candidates, "absorb-amplify", `흡수 ${c.absorbAmplifyThreshold}+ → 현재 흡수 +${Math.round(c.absorbAmplifyRatio * 100)}%`, 7);
  if (c.absorbBooster)
    addCandidate(candidates, "absorb-booster", `다음 2장 흡수 +${c.absorbBooster}`, 11);
  if (c.preventAbsorbDecay)
    addCandidate(candidates, "absorb-decay", "이번 턴 흡수 감쇄 무효", 11);
  if (c.reduceOilCost)
    addCandidate(candidates, "oil-cost", `이번 턴 오일 AP -${c.reduceOilCost}`, 9);
  if (c.searchDrawCard)
    addCandidate(candidates, "search", `「${cardsName(c.searchDrawCard, arguments[0]?.cards)}」 서치1`, 9);

  if (c.retainShield)
    addCandidate(candidates, "retain-shield", `잔여 방어막 ${Math.round(c.retainShield * 100)}% 유지`, 9);
  if (c.turnDamageReduction)
    addCandidate(candidates, "damage-reduction", `이번 턴 피해 경감 ${c.turnDamageReduction}`, 9);
  if (c.shieldCounter || c.shieldScalingAttack)
    addCandidate(candidates, "shield-counter", `현재 방어막 ${Math.round((c.shieldCounter || c.shieldScalingAttack) * 100)}% 반격`, 9);
  if (c.shieldSurvivalHeal)
    addCandidate(candidates, "shield-survive-heal", `방어막 유지 → 회복 +${c.shieldSurvivalHeal}`, 9);
  if (c.thorns)
    addCandidate(candidates, "thorns", `가시 +${c.thorns}`, 14);
  if (c.thornsApplyAttacker)
    addCandidate(candidates, "thorns-apply", `가시 반격 → ${statusMapCompact(statusDefinitions, c.thornsApplyAttacker)}`, 8);
  if (c.cleanse)
    addCandidate(candidates, "cleanse", `해로운 상태 ${c.cleanse === "all" ? "전부" : `${c.cleanse}개`} 정화`, 10);
  if (c.purgeImpurity)
    addCandidate(candidates, "purge-impurity", `불순물 ${c.purgeImpurity === Infinity ? "전부" : `${c.purgeImpurity}장`} 소멸`, 9);

  for (const [intent, statuses] of Object.entries(c.conditionalEnemyIntent || {})) {
    const label = intent === "attack" ? "공격 준비 적" : `${intent} 적`;
    addCandidate(candidates, `intent-${intent}`, `${label} → ${statusMapCompact(statusDefinitions, statuses)}`, 7);
  }

  if (c.comboHealThreshold)
    addCandidate(candidates, "combo-heal", `${c.comboHealThreshold}번째+ 카드 → 회복 ×${c.comboHealMultiplier}`, 7);
  if (c.harmonyHealShield)
    addCandidate(candidates, "harmony-heal-shield", "HARMONY 완료 → 회복량만큼 방어막", 7);
  if (c.overhealShieldRatio)
    addCandidate(candidates, "overheal", `초과 회복 ${Math.round(c.overhealShieldRatio * 100)}% → 방어막`, 8);
  if (c.cleanseAilmentStacks)
    addCandidate(candidates, "cleanse-ailments", `4종 상태 각각 -${c.cleanseAilmentStacks}`, 9);

  const stagedRefund = stagedRefundText(c);
  if (stagedRefund) addCandidate(candidates, "staged-refund", stagedRefund, 4);
  if (c.stagedDiscardRefundBaseCost)
    addCandidate(candidates, "staged-discard-refund", `기본 AP ${c.stagedDiscardRefundBaseCost}+ 버림 → AP +1`, 5);

  if (c.resonanceCoverBonus)
    addCandidate(candidates, "res-cover", `적 잔향 3+ → 방어막 +${c.resonanceCoverBonus}`, 6);
  if (c.resonanceSutureConsume)
    addCandidate(candidates, "res-suture", `최고 잔향 2+ → 잔향 ${c.resonanceSutureConsume} 소비 · 회복 +${c.resonanceSutureBonus}`, 6);
  if (c.resonanceConsumeMax)
    addCandidate(candidates, "res-condense", `잔향 최대${c.resonanceConsumeMax} 소비 → 1당 흡수 +${c.resonanceAbsorbPerStack}`, 6);
  if (c.resonanceDamagePerStack)
    addCandidate(candidates, "res-damage", `잔향 1당 +${c.resonanceDamagePerStack} 피해 (최대+${c.resonanceDamageCap})`, 6);
  if (c.resonanceChainConsumeAll)
    addCandidate(candidates, "res-chain", `잔향 전량 → 1당 +${c.resonanceChainPerStack} 피해 (최대${c.resonanceChainCap})`, 4);
  if (c.resonanceChainSplashPerStack)
    addCandidate(candidates, "res-chain-splash", `소비 잔향 1당 전체 +${c.resonanceChainSplashPerStack} 관통 · 잔향 +${c.resonanceChainSplashAdd}`, 5);

  if (!candidates.length)
    addCandidate(candidates, "fallback", stripHtml(arguments[0]?.base?.cardEffectText?.(card, false) || "효과"), 99);

  const limit = c.tier === 4 ? LEGENDARY_SUMMARY_LIMIT : SUMMARY_LIMIT;
  return candidates
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .slice(0, limit)
    .map(({ index, priority, ...entry }) => entry);
}

function cardsName(id, cards) {
  return cards?.[id]?.name || "지정 카드";
}

function extractBaseDetail(base, card) {
  const compact = base.compactCardEffectSummary?.(card),
    body = compact?.body || "",
    match = body.match(/<span class="card-effect-tooltip" role="tooltip">([\s\S]*)<\/span>$/);
  if (match?.[1]) return match[1].trim();
  return base.cardEffectText?.(card, true) || "";
}

function canonicalExtraDetails({ engine, statusDefinitions }, card) {
  const c = engine.cardDefinition(card),
    sentences = [];
  if (c.stagedRefund) {
    const detail = {
      paidContactBefore: "이번 턴 이 카드보다 먼저 실제 AP를 지불한 접촉 공격 카드가 있었다면 AP를 1 환급받습니다.",
      ailmentTypes2: "공격 직전 대상에게 연소·중독·부식·출혈 중 서로 다른 상태가 2종 이상 있으면 AP를 1 환급받습니다.",
      shield12Before: "카드 사용 직전 방어막이 12 이상이면 AP를 1 환급받습니다.",
      regenerationBefore: "카드 사용 직전 재생이 1중첩 이상이면 AP를 1 환급받습니다.",
      harmonyCompletedByCard: "이 카드로 HARMONY!를 완성하면 AP를 1 환급받습니다.",
      hand6Before: "카드 사용 직전 이 카드를 포함한 손패가 6장 이상이면 AP를 1 환급받습니다.",
      targetBleed4Before: "공격 직전 대상의 출혈이 4중첩 이상이면 AP를 1 환급받습니다.",
      ailmentTypes3: "공격 직전 대상에게 연소·중독·부식·출혈 중 서로 다른 상태가 3종 이상 있으면 AP를 2 환급받습니다.",
      fifthCardOnce: "이번 턴 5번째 이후에 사용하는 카드라면 AP를 2 환급받고 카드 1장을 뽑습니다. 이 효과는 턴당 1회만 발동합니다.",
    }[c.stagedRefund];
    if (detail) sentences.push(detail);
  }
  if (c.stagedDiscardRefundBaseCost)
    sentences.push(`이 카드로 버린 카드의 기본 AP가 ${c.stagedDiscardRefundBaseCost} 이상이면 AP를 1 환급받습니다. 일시적인 비용 감소는 기본 AP 판정에 영향을 주지 않습니다.`);
  if (c.resonanceCoverBonus)
    sentences.push(`살아있는 적 중 잔향이 3중첩 이상인 적이 하나라도 있으면 방어막을 ${c.resonanceCoverBonus} 추가로 얻습니다.`);
  if (c.resonanceSutureConsume)
    sentences.push(`살아있는 적 중 잔향이 가장 높은 적의 잔향이 2 이상이면 잔향 ${c.resonanceSutureConsume}중첩을 소비하고 회복량이 ${c.resonanceSutureBonus} 증가합니다.`);
  if (c.resonanceConsumeMax)
    sentences.push(`대상의 잔향을 최대 ${c.resonanceConsumeMax}중첩까지 소비하고 실제 소비한 잔향 1중첩마다 흡수를 ${c.resonanceAbsorbPerStack} 추가로 얻습니다.`);
  if (c.resonanceDamagePerStack)
    sentences.push(`대상의 잔향 1중첩마다 피해가 ${c.resonanceDamagePerStack} 증가하며 최대 ${c.resonanceDamageCap}중첩까지 계산합니다. 잔향은 소비하지 않습니다.`);
  if (c.resonanceChainConsumeAll)
    sentences.push(`대상의 잔향을 전부 소비합니다. 주 대상 피해는 실제 소비량을 최대 ${c.resonanceChainCap}중첩까지 계산해 1중첩당 ${c.resonanceChainPerStack} 증가합니다.`);
  if (c.resonanceChainSplashPerStack)
    sentences.push(`주 대상 처리 후 다른 살아있는 적에게 계산된 잔향 1중첩당 ${c.resonanceChainSplashPerStack}의 관통 피해를 주고, 살아남은 적에게 잔향 ${c.resonanceChainSplashAdd}중첩을 적용합니다.`);
  return sentences;
}

function mergeOwnedDetails(detail, extra = []) {
  return [detail, ...extra]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function compactRowMarkup(entry, changed = false) {
  const length = [...stripHtml(entry.value).replace(/\s/g, "")].length,
    density = length >= 15 ? " card-summary-row-tight" : length >= 11 ? " card-summary-row-dense" : "";
  return `<span class="card-summary-row${density}${changed ? " card-summary-row-upgraded" : ""}">${entry.value}</span>`;
}

export function applyCardCopyPolicy(options, base) {
  const context = { ...options, base };

  function cardEffectText(card, expanded = false) {
    if (card?.id === "impurity") return base.cardEffectText(card, expanded);
    const rows = buildSummaryRows(context, card);
    if (!expanded) return rows.map((entry) => entry.text).join(" · ");
    return mergeOwnedDetails(
      extractBaseDetail(base, card),
      canonicalExtraDetails(context, card),
    );
  }

  function compactCardEffectSummary(card, comparisonCard = null) {
    if (card?.id === "impurity") return null;
    const rows = buildSummaryRows(context, card),
      comparison = comparisonCard ? buildSummaryRows(context, comparisonCard) : [],
      comparisonByKey = new Map(comparison.map((entry) => [entry.key, entry.result])),
      summaryRows = rows
        .map((entry) => compactRowMarkup(
          entry,
          Boolean(comparisonCard) && comparisonByKey.get(entry.key) !== entry.result,
        ))
        .join(""),
      detail = cardEffectText(card, true),
      baseCompact = base.compactCardEffectSummary?.(card, comparisonCard);
    return {
      symbols: baseCompact?.symbols || "",
      body: `<span class="card-effect-main card-effect-compact">${summaryRows}</span><span class="card-effect-tooltip" role="tooltip">${detail}</span>`,
      rows,
    };
  }

  function cardHtml(card, index = null, interaction = null, comparisonCard = null) {
    const rendered = base.cardHtml(card, index, interaction, comparisonCard);
    if (card?.id === "impurity") return rendered;
    const compact = compactCardEffectSummary(card, comparisonCard);
    return rendered.replace(
      /<span class="card-effects">[\s\S]*<\/span><\/button>$/,
      `<span class="card-effects">${compact.body}</span></button>`,
    );
  }

  return {
    ...base,
    cardEffectText,
    compactCardEffectSummary,
    cardHtml,
  };
}

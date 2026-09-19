import { DETAIL_TERM_REGISTRY } from "./card-semantic-text.js";

export const CARD_EFFECT_UI = Object.freeze({
  heal: { icon: "✚", color: DETAIL_TERM_REGISTRY.heal.color },
  cleanse: { icon: "✧", color: DETAIL_TERM_REGISTRY.cleanse.color },
  discard: { icon: "↘", color: DETAIL_TERM_REGISTRY.discard.color },
  draw: { icon: "↥", color: DETAIL_TERM_REGISTRY.draw.color },
  absorb: { color: DETAIL_TERM_REGISTRY.absorb.color },
  oil: { color: DETAIL_TERM_REGISTRY.oil.color },
});

export function createCardPresentation({
  engine,
  cards,
  statusDefinitions,
  getRun,
  getStarted,
  tierStars,
}) {
  function statusAmountText(id, amount) {
    const value =
      typeof amount === "object" ? (amount.stacks ?? amount.value ?? 1) : amount;
    const selectors =
      typeof amount === "object"
        ? [
            ...(amount.notes || []).map((note) => note.toUpperCase()),
            ...(amount.cardTypes || []).map(
              (type) =>
                ({
                  attack: "공격 카드",
                  defense: "방어 카드",
                  oil: "오일 카드",
                  effect: "기능 카드",
                })[type] || type,
            ),
            ...(amount.cardIds || []).map(
              (cardId) => cards[cardId]?.name || cardId,
            ),
          ]
        : [];
    return `${statusDefinitions[id].name} +${value}${selectors.length ? ` (${selectors.join("·")})` : ""}`;
  }
  function appliedStatusText(c) {
    return [
      ...Object.entries(c.applyPlayer || {}),
      ...Object.entries(c.applyEnemy || {}),
    ]
      .map(([id, amount]) => statusAmountText(id, amount))
      .join(" · ");
  }
  function cardValueWithStatusModifier(base, kind) {
      const run = getRun();
    if (!getStarted() || run?.phase !== "battle" || !run.battle) return `${base}`;
    const target = run.battle.enemies?.[run.battle.selectedTarget],
      { delta } = engine.cardStatusValueBreakdown(run, base, kind, target);
    return `${base}${delta ? `<span class="card-value-modifier ${delta > 0 ? "positive" : "negative"}">(${delta > 0 ? "+" : ""}${delta})</span>` : ""}`;
  }
  function cardEffectText(card, expanded = false) {
      const run = getRun();
    const c = engine.cardDefinition(card),
      level = card.level || 0,
      up = c.upgrades ? 0 : level * 3,
      attack = run ? engine.power(run, "attack") : 0,
      defense = run ? engine.power(run, "defense") : 0,
      lines = [],
      effectLineKeys = new Map(),
      addEffectLine = (effectKey, text) => {
        lines.push(text);
        effectLineKeys.set(text, effectKey);
      };
    if (c.attack)
      lines.push(
        `피해 ${cardValueWithStatusModifier(c.attack + up + attack, "attack")}${c.hits ? ` × ${c.hits}회` : ""}`,
      );
    else if (c.burst)
      lines.push(`흡수 전부 ×${c.burstMultiplier ?? 8 + level} 피해`);
    else if (c.weight)
      lines.push(`방어막을 모두 소모해 방어막 수치 + 공격력 ${attack} 피해`);
    else if (c.heal) lines.push(`체력 +${cardValueWithStatusModifier(c.heal + up, "heal")}`);
    else if (c.shield) lines.push(`방어막 +${cardValueWithStatusModifier(c.shield + up + defense, "shield")}`);
    else if (c.missingHpHealRatio) lines.push(`잃은 체력의 ${Math.round(c.missingHpHealRatio * 100)}% 회복 · 최소 ${c.minimumHeal}`);
    else if (c.absorb) lines.push(`흡수 +${c.absorb + up}`);
    else if (c.draw) addEffectLine("draw", `카드 +${c.draw}`);
    else if (card.id === "impurity") lines.push("AP 1 · 전투 중 소멸");
    if ((c.shield || c.attack || c.heal) && c.absorb) lines.push(`흡수 +${c.absorb + up}`);
    if (c.heal && c.shield) lines.push(`방어막 +${cardValueWithStatusModifier(c.shield + up + defense, "shield")}`);
    if (c.comboHealThreshold) lines.push(`이 카드를 포함해 이번 턴 ${c.comboHealThreshold}장 이상 사용 시 회복 ×${c.comboHealMultiplier}`);
    if (c.harmonyHealShield) lines.push("이번 턴 하모니를 완성했다면 회복량만큼 방어막 획득");
    if (c.overhealShieldRatio) lines.push(`초과 회복량의 ${Math.round(c.overhealShieldRatio * 100)}%를 방어막으로 전환`);
    if (c.cleanseAilmentStacks) lines.push(`연소·부식·중독·출혈 각각 ${c.cleanseAilmentStacks}중첩 제거`);
    if (c.attack && c.shield) lines.push(`공격 후 방어막 +${cardValueWithStatusModifier(c.shield + up + defense, "shield")}`);
    if (c.shieldDamageMultiplier) lines.push(`방어막 피해 ×${c.shieldDamageMultiplier}`);
    if (c.bypassShield) lines.push("적 방어막 관통");
    if (c.battleContactBonus) lines.push(`이번 전투에서 앞서 사용한 접촉 카드 1장당 타격마다 피해 +${c.battleContactBonus}`);
    if (c.shieldThreshold) lines.push(`방어막 ${c.shieldThreshold} 이상이면 적 방어막 관통 · 모든 적 무장 해제 1턴`);
    if (c.onHitCount) lines.push(`${c.onHitCount}타 이상 적중 시 ${Object.entries(c.onHitApplyEnemy || {}).map(([id, amount]) => statusAmountText(id, amount)).join(" · ")}`);
    if (c.ailmentBurstMultiplier) lines.push(`대상의 연소·중독·출혈·부식 합계 ×${c.ailmentBurstMultiplier} 관통 절대 피해`);
    if (c.amplifyAilments) lines.push(`피해 후 대상의 상태이상 중첩 ×${c.amplifyAilments}`);
    if (c.applyEnemyAfterAttack) lines.push(Object.entries(c.applyEnemyAfterAttack).map(([id, amount]) => statusAmountText(id, amount)).join(" · "));
    if (c.turnDamageBonus) lines.push(`현재 전투 턴수 ×${c.turnDamageBonus} 추가 피해`);
    if (c.handDamageBonus) lines.push(`현재 손패 1장당 피해 +${c.handDamageBonus}`);
    if (c.randomEachHit) addEffectLine("randomEachHit", `매 타격마다 무작위 적에게 도탄`);
    if (c.firstTurnOrFullHpMultiplier) lines.push(`전투 1턴째 또는 대상 체력 100%일 때 피해 ×${c.firstTurnOrFullHpMultiplier}`);
    if (c.absorbFromDamage) lines.push(`가한 피해의 ${Math.round(c.absorbFromDamage * 100)}%만큼 흡수 획득`);
    if (c.globalAilmentBurstMultiplier) lines.push(`모든 적의 연소·중독·출혈·부식 합계 ×${c.globalAilmentBurstMultiplier} 추가 광역 관통 피해`);
    if (c.extendDecayStatuses) lines.push(`중독·부식 자연 감소 ${c.extendDecayStatuses}회 지연`);
    if (c.hitsPerCardThisTurn) lines.push(`이번 턴 앞서 사용한 카드마다 타수 +${c.hitsPerCardThisTurn} · 최대 ${c.maxHits}타`);
    if (c.chanceStatusOnHit) lines.push(`적중마다 ${Math.round(c.chanceStatusOnHit.chance * 100)}% 확률로 ${statusAmountText(c.chanceStatusOnHit.id, c.chanceStatusOnHit.amount)}`);
    if (c.stunOrDisarmBossTurns) lines.push(`기절 1턴 · 보스의 기절 저항 시 무장 해제 ${c.stunOrDisarmBossTurns}턴`);
    if (c.drawOnBreak) addEffectLine("drawOnBreak", `방어막 파괴 시 카드 ${c.drawOnBreak}장 드로우`);
    if (c.randomDiscard) lines.push(`손패 ${c.randomDiscard}장 무작위 버리기`);
    if (c.discardTierAp) lines.push(`1티어 이상 카드 버리면 AP +${c.discardTierAp} · 불순물 제외`);
    const requiredAbsorb = run && typeof engine.requiredAbsorbForCard === "function"
      ? engine.requiredAbsorbForCard(run, card)
      : Math.max(0, Math.round(Number(c.requiredAbsorb) || 0));
    if (requiredAbsorb > 0)
      lines.push(`흡수 ${requiredAbsorb} 소모 · 흡수가 부족시 사용 불가`);
    if (c.weakOnHit) lines.push(`적중마다 약화 누적 · 총 ${c.weakOnHit}`);
    if (c.burnProcCount) lines.push(`기존 연소를 최대 ${c.burnProcCount}회 발동`);
    if (c.applyEnemyIfPreAttackStatus) {
      const required = statusDefinitions[c.applyEnemyIfPreAttackStatus.statusId]?.name || c.applyEnemyIfPreAttackStatus.statusId;
      lines.push(`공격 직전 대상이 ${required} 상태였다면 ${Object.entries(c.applyEnemyIfPreAttackStatus.apply || {}).map(([id, amount]) => statusAmountText(id, amount)).join(" · ")} 추가`);
    }
    if (c.maxHpOnKill) lines.push(`이 공격으로 처치 시 최대 체력 영구 +${c.maxHpOnKill}`);
    if (c.discardAttackBurn) lines.push(`공격 카드 버리면 대상에게 연소 ${c.discardAttackBurn}`);
    if (c.discardCostDamage) lines.push(`버린 카드 기본 비용 1 AP당 비접촉 추가 피해 ${c.discardCostDamage}`);
    if (c.discardedGainShield)
      lines.push(`이 카드가 실제 버려지면 방어막 +${c.discardedGainShield}`);
    if (c.discardedDrawOne)
      lines.push(`이 카드가 실제 버려지면 카드 ${c.discardedDrawOne}장 드로우`);
    if (c.discardedExtraDrawChance)
      lines.push(`실제 버리기 시 ${Math.round(c.discardedExtraDrawChance * 100)}% 확률로 카드 1장 추가 드로우`);
    if (c.discardedRandomBurn)
      lines.push(`이 카드가 실제 버려지면 무작위 생존 적 연소 +${c.discardedRandomBurn}`);
    if (c.augmentDiscardShield || c.augmentDiscardAbsorb) {
      const rewards = [
        c.augmentDiscardShield ? `방어막 +${c.augmentDiscardShield}` : "",
        c.augmentDiscardAbsorb ? `흡수 +${c.augmentDiscardAbsorb}` : "",
      ].filter(Boolean).join(" · ");
      lines.push(`선택해 버린 카드의 기본 AP가 ${c.augmentDiscardMinBaseAp || 0} 이상이면 ${rewards}`);
    }
    if (c.refundAbsorbThreshold) lines.push(`흡수 ${c.refundAbsorbThreshold} 이상에서 사용시 AP 1 환급`);
    if (c.absorbStatusThreshold && c.absorbThresholdApplyAllEnemy) {
      const statuses = Object.entries(c.absorbThresholdApplyAllEnemy)
        .map(([id, amount]) => `${statusDefinitions[id]?.name || id} ${amount}`)
        .join(" · ");
      lines.push(`흡수 획득 후 ${c.absorbStatusThreshold} 이상이면 모든 적에게 ${statuses} 부여`);
    }
    if (card.id === "burst_spatial_diffusion")
      lines.push("흡수 40 이상에서 사용시 모든 적에게 기절 1중첩 적용");
    if (c.absorbCost) lines.push(`흡수 ${c.absorbCost} 이상이면 자동 소진 후 추가 피해 +${c.fueledAttack - (c.attack || 0)}`);
    if (c.executeRatio) {
      const executeMultiplier = c.executeMultiplier || (c.executeAttack && c.attack ? c.executeAttack / c.attack : 1);
      lines.push(`체력 ${Math.round(c.executeRatio * 100)}% 이하인${c.executeNonBoss ? " 비보스" : ""} 대상에게 추가 피해 ×${Number(executeMultiplier.toFixed(2))}`);
    }
    if (c.refundOnKill) lines.push(`처치 시 AP +${c.refundOnKill}`);
    if (c.drawOnKill) addEffectLine("drawOnKill", `처치 시 카드 ${c.drawOnKill}장 드로우`);
    if ((c.shield || c.absorb || c.attack) && c.draw) addEffectLine("draw", `카드 ${c.draw}장 드로우`);
    if (c.preventAbsorbDecay) lines.push("이번 턴 종료 시 흡수 감쇄 무효화");
    if (c.searchDrawCard) addEffectLine("searchDrawCard", `뽑을 카드 더미에서 ${cards[c.searchDrawCard].name} 1장 서치 · 손패가 가득 차면 유지`);
    if (c.absorbAmplifyRatio) lines.push(`기본 흡수 획득 후 ${c.absorbAmplifyThreshold} 이상이면 현재 흡수의 ${Math.round(c.absorbAmplifyRatio * 100)}% 추가 획득`);
    if (c.absorbBooster) addEffectLine("absorbBooster", `이번 턴 다음 카드 2장 · 흡수 획득 +${c.absorbBooster}`);
    if (c.reduceOilCost) addEffectLine("reduceOilCost", `이번 턴 손패의 모든 오일 카드 비용 ${c.reduceOilCost} 감소 · 최소 0`);
    if (c.retainShield) lines.push(`다음 턴 방어막 ${Math.round(c.retainShield * 100)}% 유지`);
    if (c.cleanse) lines.push(`해로운 상태이상 ${c.cleanse === "all" ? "전부" : `${c.cleanse}개`} 정화`);
    if (c.turnDamageReduction) lines.push(`이번 턴 받는 모든 피해 ${c.turnDamageReduction} 경감`);
    if (c.shieldCounter) lines.push(`방어막 획득 후 현재 방어막 ${Math.round(c.shieldCounter * 100)}% 접촉 피해 · 소모 없음`);
    if (c.shieldScalingAttack) lines.push(`방어막 획득 후 현재 방어막 ${Math.round(c.shieldScalingAttack * 100)}% 접촉 피해 · 소모 없음`);
    if (c.shieldSurvivalHeal) lines.push(`방어막이 깨지지 않고 턴을 마치면 체력 +${c.shieldSurvivalHeal}`);
    if (c.thorns) lines.push(`가시 +${c.thorns}`);
    if (c.thornsApplyAttacker) lines.push(`가시 반격 시 공격자에게 ${Object.entries(c.thornsApplyAttacker).map(([id, amount]) => statusAmountText(id, amount)).join(" · ")}`);
    if (c.discard) lines.push("손패 1장 선택 버리기");
    if (c.applyWeak) lines.push(`적 약화 ${c.applyWeak}`);
    if (c.oil) lines.push("오일 발동");
    if (c.target === "all") addEffectLine("targeting", "적 대상을 광역으로 공격합니다");
    if (c.target === "random") addEffectLine("targeting", "무작위 생존 적 대상");
    if (c.shieldScaling)
      lines.push(
        `현재 방어막 ${Math.round(c.shieldScaling * 100)}% 추가 피해 · 방어막 소모 없음`,
      );
    if (c.refundOnBreak) lines.push(`방어막 파괴 시 AP +${c.refundOnBreak}`);
    if (c.comboContactBonus)
      lines.push(`선행 접촉 카드 사용 시 피해 +${c.comboContactBonus}`);
    for (const [id, amount] of Object.entries(c.bonusPerStatus || {}))
      lines.push(`${statusDefinitions[id]?.name || id} 중첩당 피해 +${amount}`);
    if (c.consumeResonance)
      lines.push(`잔향 전량 소비 · 중첩당 피해 +${c.consumeResonance}`);
    if (c.absorbBonusRatio)
      lines.push(
        c.absorbBonusRatio === 1
          ? "현재 흡수량만큼 추가 피해 · 흡수 소모 없음"
          : `현재 흡수량의 ${Math.round(c.absorbBonusRatio * 100)}% 추가 피해 · 흡수 소모 없음`,
      );
    for (const [intent, statuses] of Object.entries(
      c.conditionalEnemyIntent || {},
    ))
      for (const [id, amount] of Object.entries(statuses))
        addEffectLine(
          "conditionalEnemyIntent",
          `${intent === "attack" ? "공격 준비 중인 적에게" : `${intent} 행동을 준비 중인 적에게`} ${statusAmountText(id, amount)}`,
        );
    if (c.purgeImpurity) lines.push(c.purgeImpurity === Infinity ? "손패의 불순물 전부 소멸" : `손패의 불순물 ${c.purgeImpurity}장 소멸`);
    if (c.burst) lines.push("적 행동 -1회");
    if (card.id === "impurity") lines.push("카드 1장 드로우");
    for (const [target, map] of [
      ["player", c.applyPlayer || {}],
      ["enemy", c.applyEnemy || {}],
    ])
      for (const [id, amount] of Object.entries(map))
        addEffectLine(`status:${target}:${id}`, statusAmountText(id, amount));
    if (expanded === "entries")
      return lines.map((text) => ({
        effectKey: effectLineKeys.get(text) || null,
        text,
      }));
    if (expanded) return lines.join(" · ");
    const visibleTextLength = lines
        .join("")
        .replace(/<[^>]*>/g, "")
        .length,
      condensed = lines.length > 2 || visibleTextLength > 34,
      visible = condensed
        ? [lines[0], "자세한 효과 보기"]
        : lines,
      body = visible
        .map(
          (line, index) =>
            `<span class="${index ? "card-effect-extra" : "card-effect-main"}${condensed && index === visible.length - 1 ? " card-effect-more" : ""}">${line}</span>`,
        )
        .join("");
    return condensed
      ? `${body}<span class="card-effect-tooltip" role="tooltip">${lines.join("<br>")}</span>`
      : body;
  }
  function semanticRuleMarkup(text) {
    let markup = text.replace(
      /([+-]?\d+(?:\.\d+)?%?)(턴|중첩|회|장|AP)?/g,
      (match, value, unit = "", offset) => {
        const before = text.slice(Math.max(0, offset - 18), offset),
          after = text.slice(offset + match.length, offset + match.length + 18),
          discardLoss = unit === "장" && /버리/.test(after),
          resourceLoss = /(?:흡수|방어막)\s*$/.test(before) && /(?:소모|소진)/.test(after),
          selfDamageLoss = /(?:플레이어|자신)/.test(before) && /피해/.test(after),
          costLoss = /비용/.test(before) && /증가/.test(after),
          valueClass = discardLoss || resourceLoss || selfDamageLoss || costLoss
            ? "semantic-loss"
            : "semantic-gain";
        return `<b class="${valueClass}">${value}${unit}</b>`;
      },
    );
    for (const status of Object.values(statusDefinitions))
      markup = markup.replaceAll(
        status.name,
        `<span class="detail-status" style="--detail-status-color:${status.color}">${status.name}</span>`,
      );
    markup = markup
      .replaceAll("모든 적", "__DETAIL_ALL_ENEMIES__")
      .replaceAll("방어막 관통", "__DETAIL_PIERCE__")
      .replaceAll("완전 관통", "__DETAIL_FULL_PIERCE__")
      .replaceAll("도탄", "__DETAIL_RICOCHET__")
      .replaceAll("광역", "__DETAIL_AOE__")
      .replaceAll("방어막", '<span class="detail-shield">방어막</span>')
      .replaceAll("흡수", '<span class="detail-absorb">흡수</span>')
      .replaceAll("오일", '<span class="detail-oil">오일</span>')
      .replaceAll("__DETAIL_PIERCE__", '<span class="detail-pierce">방어막 관통</span>')
      .replaceAll("__DETAIL_FULL_PIERCE__", '<span class="detail-pierce">완전 관통</span>')
      .replaceAll("__DETAIL_RICOCHET__", '<span class="detail-ricochet">도탄</span>')
      .replaceAll("__DETAIL_AOE__", '<span class="detail-aoe">광역</span>')
      .replaceAll("__DETAIL_ALL_ENEMIES__", '<span class="detail-aoe">모든 적</span>');
    return markup;
  }
  function completeSemanticRule(text) {
    const clean = text.replace(/<[^>]*>/g, "").trim();
    if (!clean || clean === "플레이어 자신 대상" || clean.includes("소모 없음")) return "";
    if (clean === "흡수가 부족시 사용 불가")
      return `${semanticRuleMarkup("흡수가 부족시")} 사용불가합니다.`;
    if (clean === "연소를 소모하지 않습니다")
      return `${semanticRuleMarkup(clean)}.`;
    if (clean === "적 대상을 광역으로 공격합니다")
      return `${semanticRuleMarkup(clean)}.`;
    if (clean === "불순물 제외")
      return "위 효과는 불순물 카드 제외입니다.";
    if (/^흡수 40 이상에서 사용시 모든 적에게 기절 1중첩 적용$/.test(clean))
      return `${semanticRuleMarkup(clean)}합니다.`;
    if (/[.!?]$/.test(clean)) return semanticRuleMarkup(clean);
    return `${semanticRuleMarkup(clean)} 효과가 적용됩니다.`;
  }
  function cardSummaryPlainText(value) {
    return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }
  function compactCardSummaryRowData(value) {
    const boldStart = value.indexOf("<b"),
      boldContentStart = boldStart < 0 ? -1 : value.indexOf(">", boldStart),
      visibleText = cardSummaryPlainText(value),
      label = boldStart < 0
        ? visibleText
        : cardSummaryPlainText(value.slice(0, boldStart)),
      result = boldContentStart < 0
        ? visibleText
        : cardSummaryPlainText(value.slice(boldContentStart + 1)),
      visibleLength = [...visibleText.replace(/\s/g, "")].length,
      density = visibleLength >= 11
        ? " card-summary-row-tight"
        : visibleLength >= 9
          ? " card-summary-row-dense"
          : "";
    return { value, density, label, result };
  }
  function compactCardSummaryRow(row, changed = false) {
    return `<span class="card-summary-row${row.density}${changed ? " card-summary-row-upgraded" : ""}">${row.value}</span>`;
  }
  function compactCardEffectSummary(card, comparisonCard = null) {
      const run = getRun();
    const c = engine.cardDefinition(card);
    const isTierOneContactAttack =
        c.tier === 1 &&
        (c.category || (c.attack || c.burst || c.weight ? "attack" : null)) ===
          "attack" &&
        c.attackPattern === "contact",
      isDualStatusTestCard = c.id === "contact_steel_pierce";
    if (c.id === "impurity") return null;
    const level = card.level || 0,
      up = c.upgrades ? 0 : level * 3,
      attack = run ? engine.power(run, "attack") : 0,
      defense = run ? engine.power(run, "defense") : 0,
      mainValues = [],
      directStatuses = [
        ...Object.entries(c.applyEnemy || {}).map(([id, amount]) => ({
          id,
          amount,
          target: "enemy",
        })),
        ...Object.entries(c.applyPlayer || {}).map(([id, amount]) => ({
          id,
          amount,
          target: "player",
        })),
      ],
      referencedStatusIds = [
        ...Object.keys(c.bonusPerStatus || {}),
        ...(c.consumeResonance ? ["resonance"] : []),
        ...(c.burnProcCount ? ["burning"] : []),
        ...(c.applyEnemyIfPreAttackStatus ? [c.applyEnemyIfPreAttackStatus.statusId, ...Object.keys(c.applyEnemyIfPreAttackStatus.apply || {})] : []),
        ...((c.ailmentBurstMultiplier || c.globalAilmentBurstMultiplier || c.amplifyAilments)
          ? ["burning", "poison", "bleed", "corrosion"]
          : []),
      ],
      statuses = [
        ...directStatuses,
        ...Object.entries(c.applyEnemyAfterAttack || {}).map(([id, amount]) => ({
          id,
          amount,
          target: "enemy",
        })),
        ...Object.entries(c.onHitApplyEnemy || {}).map(([id, amount]) => ({
          id,
          amount,
          target: "enemy",
        })),
        ...Object.entries(c.absorbThresholdApplyAllEnemy || {}).map(
          ([id, amount]) => ({ id, amount, target: "enemy" }),
        ),
        ...Object.entries(c.thornsApplyAttacker || {}).map(([id, amount]) => ({
          id,
          amount,
          target: "enemy",
        })),
        ...Object.values(c.conditionalEnemyIntent || {}).flatMap((statusMap) =>
          Object.entries(statusMap).map(([id, amount]) => ({
            id,
            amount,
            target: "enemy",
          })),
        ),
        ...(c.chanceStatusOnHit
          ? [
              {
                id: c.chanceStatusOnHit.id,
                amount: c.chanceStatusOnHit.amount,
                target: "enemy",
              },
            ]
          : []),
        ...(c.applyWeak || c.weakOnHit
          ? [
              {
                id: "weak",
                amount: c.applyWeak || c.weakOnHit,
                target: "enemy",
              },
            ]
          : []),
        ...(c.stunOrDisarmBossTurns
          ? [
              { id: "stun", amount: 1, target: "enemy" },
              {
                id: "disarm",
                amount: { stacks: 1, turns: c.stunOrDisarmBossTurns },
                target: "enemy",
              },
            ]
          : []),
        ...(c.id === "burst_spatial_diffusion"
          ? [{ id: "stun", amount: 1, target: "enemy" }]
          : []),
      ],
      symbolStatuses = [
          ...statuses,
          ...(c.thorns ? [{ id: "thorns", amount: c.thorns, target: "player" }] : []),
          ...referencedStatusIds.map((id) => ({ id, amount: null, target: "reference" })),
        ]
        .filter(({ id }, index, list) => list.findIndex((entry) => entry.id === id) === index),
      isAttackCard = Boolean(c.attack || c.burst || c.weight),
    isDefenseCard = c.category === "defense",
    isHealCard = c.category === "heal",
    drawAmount = c.draw || c.drawOnBreak || c.drawOnKill || (c.searchDrawCard ? 1 : 0),
    drawLabel = c.searchDrawCard
      ? `${cards[c.searchDrawCard]?.name || "지정 카드"} 1장 서치`
      : c.drawOnBreak
        ? `방어막 파괴 시 카드 ${c.drawOnBreak}장 드로우`
        : c.drawOnKill
          ? `처치 시 카드 ${c.drawOnKill}장 드로우`
          : c.draw
            ? `카드 ${c.draw}장 드로우`
            : "",
    effectSymbols = symbolStatuses
        .map(({ id, amount, target }) => {
          const definition = statusDefinitions[id];
          if (!definition) return "";
          const label = target === "reference" ? `${definition.name} 참조` : `${target === "player" ? "자신에게 " : ""}${statusAmountText(id, amount)}`;
          return `<em class="card-effect-symbol target-${target}" style="--card-status-color:${definition.color}" title="${label}" aria-label="${label}">${definition.icon}</em>`;
        })
        .join("") + [
        isAttackCard && c.target === "all"
          ? `<em class="card-effect-symbol" style="--card-status-color:#e7b65f" title="광역 공격" aria-label="광역 공격">◎</em>`
          : isAttackCard && c.target !== "random"
            ? `<em class="card-effect-symbol" style="--card-status-color:#d2b28b" title="단일 대상 공격" aria-label="단일 대상 공격">⌖</em>`
            : "",
        isAttackCard && (c.bypassShield || c.thresholdBypassShield)
          ? `<em class="card-effect-symbol" style="--card-status-color:#78c8e8" title="방어막 관통" aria-label="방어막 관통">⟐</em>`
          : "",
        isAttackCard && c.turnDamageBonus
          ? `<em class="card-effect-symbol" style="--card-status-color:#b49ae8" title="턴수 비례 피해" aria-label="턴수 비례 피해">◷</em>`
          : "",
        isAttackCard && c.randomEachHit
          ? `<em class="card-effect-symbol" style="--card-status-color:#e18bd1" title="도탄" aria-label="도탄">↝</em>`
          : "",
        c.hits > 1
          ? `<em class="card-effect-symbol" style="--card-status-color:#e59a7f" title="연타 ${c.hits}회" aria-label="연타 ${c.hits}회">⋙</em>`
          : "",
        c.shieldScaling
          ? `<em class="card-effect-symbol" style="--card-status-color:#8fcbd4" title="현재 방어막의 ${Math.round(c.shieldScaling * 100)}%만큼 추가 피해" aria-label="방어막 비례 추가 피해 ${Math.round(c.shieldScaling * 100)}퍼센트">⬡</em>`
          : "",
        c.heal || c.missingHpHealRatio
        ? `<em class="card-effect-symbol" style="--card-status-color:${CARD_EFFECT_UI.heal.color}" title="${c.heal ? `체력 회복 +${c.heal + up}` : `잃은 체력 ${Math.round(c.missingHpHealRatio * 100)}% 회복`}" aria-label="${c.heal ? `체력 회복 ${c.heal + up}` : `잃은 체력 ${Math.round(c.missingHpHealRatio * 100)}퍼센트 회복`}">${CARD_EFFECT_UI.heal.icon}</em>`
        : "",
      c.cleanse || c.cleanseAilmentStacks
        ? `<em class="card-effect-symbol" style="--card-status-color:${CARD_EFFECT_UI.cleanse.color}" title="${c.cleanseAilmentStacks ? `연소·부식·중독·출혈 각각 ${c.cleanseAilmentStacks}중첩 정화` : `상태 정화 ${c.cleanse === "all" ? "전부" : `${c.cleanse}개`}`}" aria-label="${c.cleanseAilmentStacks ? `연소·부식·중독·출혈 각각 ${c.cleanseAilmentStacks}중첩 정화` : `상태 정화 ${c.cleanse === "all" ? "전부" : `${c.cleanse}개`}`}">${CARD_EFFECT_UI.cleanse.icon}</em>`
        : "",
      drawAmount
        ? `<em class="card-effect-symbol" style="--card-status-color:${CARD_EFFECT_UI.draw.color}" title="${drawLabel}" aria-label="${drawLabel}">${CARD_EFFECT_UI.draw.icon}</em>`
        : "",
      c.discard || c.randomDiscard
        ? `<em class="card-effect-symbol" style="--card-status-color:${CARD_EFFECT_UI.discard.color}" title="${c.randomDiscard ? `무작위 카드 버리기 ${c.randomDiscard}장` : `카드 버리기 ${c.discard}장`}" aria-label="${c.randomDiscard ? `무작위 카드 버리기 ${c.randomDiscard}장` : `카드 버리기 ${c.discard}장`}">${CARD_EFFECT_UI.discard.icon}</em>`
        : "",
    ].join(""),
    targetLabel = c.target === "all"
      ? "모든 적"
      : c.target === "random" || c.randomEachHit
        ? "무작위 적"
        : "대상",
      targetMarkup = c.target === "all"
        ? `<span class="detail-aoe">${targetLabel}</span>`
        : `<span class="detail-target">${targetLabel}</span>`,
      randomEachHitPrefix = c.randomEachHit ? "매 타격마다 새로 고른 " : "",
      damageText = c.hits
        ? `<b class="semantic-gain">${c.attack + up + attack}</b>씩 <b class="semantic-gain">${c.hits}회</b>`
        : `<b class="semantic-gain">${c.attack + up + attack}</b>`,
      statusSentences = directStatuses.map(({ id, amount, target }) => {
        const definition = statusDefinitions[id],
          value = typeof amount === "object" ? amount.stacks ?? amount.value ?? 1 : amount,
          turns = typeof amount === "object" ? amount.turns : null,
          beneficial =
            (target === "player" && definition?.kind === "buff") ||
            (target === "enemy" && definition?.kind !== "buff"),
          valueClass = beneficial ? "semantic-gain" : "semantic-loss";
        if (!definition) return "";
        const lastCode = definition.name.charCodeAt(definition.name.length - 1),
          objectParticle = lastCode >= 0xac00 && lastCode <= 0xd7a3 && (lastCode - 0xac00) % 28 === 0 ? "를" : "을";
        const targetPrefix = isDefenseCard
        ? target === "player"
          ? "자신에게 "
          : c.target === "all"
            ? "모든 적에게 "
            : "대상에게 "
        : "";
      return `<span class="detail-status-clause" style="--detail-status-color:${definition.color}">${targetPrefix}<span class="detail-status">${definition.name}</span>${objectParticle} ${turns ? `<b class="${valueClass}">${turns}턴 동안</b> ` : ""}<b class="${valueClass}">${value}중첩</b> 적용합니다${!isDefenseCard && target === "player" ? " (자신)" : ""}</span>.`;
      }).filter(Boolean),
      extraSentences = [];
    if (c.attack)
      mainValues.push(`피해 <b>${cardValueWithStatusModifier(c.attack + up + attack, "attack")}</b>`);
    else if (c.burst)
      mainValues.push(`흡수 비례 피해 <b>×${c.burstMultiplier ?? 8 + level}</b>`);
    else if (c.weight)
      mainValues.push(`방어막 소모 <b>전량</b>`);
    if (c.shield)
      mainValues.push(`방어막 <b>+${cardValueWithStatusModifier(c.shield + up + defense, "shield")}</b>`);
    if (c.heal)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.heal.color}">회복</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.heal.color}">+${cardValueWithStatusModifier(c.heal + up, "heal")}</b>`);
  if (c.missingHpHealRatio) {
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.heal.color}">잃은 체력 회복</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.heal.color}">${Math.round(c.missingHpHealRatio * 100)}%</b>`);
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.heal.color}">최소 회복</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.heal.color}">${c.minimumHeal || 0}</b>`);
  }
    if (c.absorb) mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.absorb.color}">흡수</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.absorb.color}">+${c.absorb + up}</b>`);
    if (c.draw)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.draw.color}">카드</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.draw.color}">+${c.draw}</b>`);
  if (c.drawOnBreak)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.draw.color}">파괴 시 카드</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.draw.color}">+${c.drawOnBreak}</b>`);
  if (c.drawOnKill)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.draw.color}">처치 시 카드</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.draw.color}">+${c.drawOnKill}</b>`);
  if (c.searchDrawCard)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.draw.color}">서치 카드</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.draw.color}">+1</b>`);
    for (const { id, amount, target } of statuses) {
      const definition = statusDefinitions[id],
        value = typeof amount === "object" ? amount.stacks ?? amount.value ?? 1 : amount;
      if (!definition) continue;
      const thornsTriggered =
          isDefenseCard &&
          Object.prototype.hasOwnProperty.call(c.thornsApplyAttacker || {}, id),
        conditionalIntent = isDefenseCard
          ? Object.entries(c.conditionalEnemyIntent || {}).find(([, applied]) =>
              Object.prototype.hasOwnProperty.call(applied, id),
            )?.[0]
          : null,
        directStatus = directStatuses.some(
          (entry) => entry.id === id && entry.target === target,
        ),
        targetPrefix = target === "player"
          ? "자신 "
          : thornsTriggered
            ? "가시 반격 "
            : conditionalIntent === "attack"
              ? "공격 적 "
              : conditionalIntent
                ? `${conditionalIntent} 적 `
                : directStatus && c.target === "all"
                  ? "모든 적 "
                  : "";
      mainValues.push(`<span class="card-summary-status card-summary-applied-status" style="--summary-row-color:${definition.color}">${targetPrefix}${definition.name}</span><b class="card-summary-status card-summary-applied-status" style="--summary-row-color:${definition.color}">+${value}</b>`);
    }
    if (c.hits > 1)
      mainValues.push(`<span class="card-summary-special">연타</span><b class="card-summary-special">${c.hits}회</b>`);
    if (c.shieldScaling)
      mainValues.push(`<span class="card-summary-shield">방어막 비례</span><b class="card-summary-shield">${Math.round(c.shieldScaling * 100)}%</b>`);
    if (isDefenseCard && c.retainShield)
      mainValues.push(`<span class="card-summary-shield">방어막 보존</span><b class="card-summary-shield">${Math.round(c.retainShield * 100)}%</b>`);
    if (c.cleanse)
      mainValues.push(`<span class="card-summary-status" style="--summary-row-color:#74c9bd">정화</span><b class="card-summary-status" style="--summary-row-color:#74c9bd">${c.cleanse === "all" ? "전부" : `${c.cleanse}개`}</b>`);
    if (isDefenseCard && c.turnDamageReduction)
      mainValues.push(`<span class="card-summary-shield">피해 경감</span><b class="card-summary-shield">+${c.turnDamageReduction}</b>`);
    if (isDefenseCard && (c.shieldCounter || c.shieldScalingAttack)) {
      const counterRatio = c.shieldCounter || c.shieldScalingAttack;
      mainValues.push(`<span class="card-summary-shield">방어막 반격</span><b class="card-summary-shield">${Math.round(counterRatio * 100)}%</b>`);
    }
    if (isDefenseCard && c.shieldSurvivalHeal)
      mainValues.push(`<span class="card-summary-shield">유지 회복</span><b class="card-summary-shield">+${c.shieldSurvivalHeal}</b>`);
    if (c.thorns)
      mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${statusDefinitions.thorns.color}">가시</span><b class="card-summary-status" style="--summary-row-color:${statusDefinitions.thorns.color}">+${c.thorns}</b>`);
    if (c.discard)
      mainValues.push(`<span class="card-summary-status" style="--summary-row-color:#d78972">선택 버리기</span><b class="card-summary-status" style="--summary-row-color:#d78972">${c.discard}장</b>`);
    if (c.randomDiscard)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.discard.color}">무작위 버리기</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.discard.color}">${c.randomDiscard}장</b>`);
  if (c.discardedGainShield)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.discard.color}">버림→방어막</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.discard.color}">+${c.discardedGainShield}</b>`);
  if (c.discardedDrawOne)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.draw.color}">버림→드로우</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.draw.color}">+${c.discardedDrawOne}</b>`);
  if (c.discardedExtraDrawChance)
    mainValues.push(`<span class="card-summary-special">추가 드로우</span><b class="card-summary-special">${Math.round(c.discardedExtraDrawChance * 100)}%</b>`);
  if (c.discardedRandomBurn)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${statusDefinitions.burning.color}">버림→연소</span><b class="card-summary-status" style="--summary-row-color:${statusDefinitions.burning.color}">+${c.discardedRandomBurn}</b>`);
  if (c.augmentDiscardShield)
    mainValues.push(`<span class="card-summary-shield">기본 AP ${c.augmentDiscardMinBaseAp || 0}+ 버림</span><b class="card-summary-shield">방어막 +${c.augmentDiscardShield}</b>`);
  if (c.augmentDiscardAbsorb)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.absorb.color}">기본 AP ${c.augmentDiscardMinBaseAp || 0}+ 버림</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.absorb.color}">흡수 +${c.augmentDiscardAbsorb}</b>`);
  if (c.preventAbsorbDecay)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.absorb.color}">흡수 감쇄</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.absorb.color}">무효</b>`);
  if (c.absorbBooster)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.absorb.color}">다음 2장 흡수</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.absorb.color}">+${c.absorbBooster}</b>`);
  if (c.absorbAmplifyRatio)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.absorb.color}">흡수 ${c.absorbAmplifyThreshold}+</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.absorb.color}">+${Math.round(c.absorbAmplifyRatio * 100)}%</b>`);
  if (c.absorbFromDamage)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.absorb.color}">피해→흡수</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.absorb.color}">${Math.round(c.absorbFromDamage * 100)}%</b>`);
  if (c.refundAbsorbThreshold)
    mainValues.push(`<span class="card-summary-special">흡수 ${c.refundAbsorbThreshold}+</span><b class="card-summary-special">AP +1</b>`);
  if (c.reduceOilCost)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.oil.color}">오일 비용</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.oil.color}">-${c.reduceOilCost}</b>`);
  if (isHealCard && c.comboHealThreshold)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.heal.color}">${c.comboHealThreshold}장+ 회복</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.heal.color}">×${c.comboHealMultiplier}</b>`);
  if (isHealCard && c.harmonyHealShield)
    mainValues.push(`<span class="card-summary-shield">하모니 방어막</span><b class="card-summary-shield">회복량</b>`);
  if (isHealCard && c.overhealShieldRatio)
    mainValues.push(`<span class="card-summary-shield">초과회복→방어막</span><b class="card-summary-shield">${Math.round(c.overhealShieldRatio * 100)}%</b>`);
  if (isHealCard && c.cleanseAilmentStacks)
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.cleanse.color}">상태이상 정화</span><b class="card-summary-status" style="--summary-row-color:${CARD_EFFECT_UI.cleanse.color}">-${c.cleanseAilmentStacks}씩</b>`);
    if (isDefenseCard && c.purgeImpurity)
      mainValues.push(`<span class="card-summary-special">불순물 소멸</span><b class="card-summary-special">${c.purgeImpurity === Infinity ? "전부" : `${c.purgeImpurity}장`}</b>`);
    if (c.oil) extraSentences.push(`<span class="detail-oil">오일</span>을 발동합니다.`);
  if (c.drawOnBreak)
    extraSentences.push(`이 카드로 대상의 방어막을 파괴하면 <span class="detail-draw">카드</span>를 <b class="semantic-gain">${c.drawOnBreak}장</b> 뽑습니다.`);
  if (c.drawOnKill)
    extraSentences.push(`이 카드로 적을 처치하면 <span class="detail-draw">카드</span>를 <b class="semantic-gain">${c.drawOnKill}장</b> 뽑습니다.`);
  if (c.searchDrawCard)
    extraSentences.push(`뽑을 카드 더미에서 <span class="detail-draw">${cards[c.searchDrawCard]?.name || "지정 카드"}</span> <b class="semantic-gain">1장</b>을 찾아 손패로 가져옵니다. 손패가 가득 차 있으면 카드는 뽑을 카드 더미에 남습니다.`);
  if (c.preventAbsorbDecay)
    extraSentences.push(`이번 턴 종료 시 발생하는 <span class="detail-absorb">흡수 감쇄</span>를 한 번 무효화합니다.`);
  if (c.absorbAmplifyRatio)
    extraSentences.push(`기본 <span class="detail-absorb">흡수</span>를 얻은 뒤 총 흡수가 <b class="semantic-gain">${c.absorbAmplifyThreshold} 이상</b>이면 현재 흡수의 <b class="semantic-gain">${Math.round(c.absorbAmplifyRatio * 100)}%</b>를 추가로 얻습니다.`);
  if (c.absorbBooster)
    extraSentences.push(`이번 턴 다음 <b class="semantic-gain">2장</b>의 카드가 얻는 <span class="detail-absorb">흡수</span>를 각각 <b class="semantic-gain">${c.absorbBooster}</b> 증가시킵니다.`);
  if (c.reduceOilCost)
    extraSentences.push(`이번 턴 손패의 모든 <span class="detail-oil">오일</span> 카드 AP 비용을 <b class="semantic-gain">${c.reduceOilCost}</b> 낮춥니다. 비용은 0 아래로 내려가지 않습니다.`);
  if (c.refundAbsorbThreshold)
    extraSentences.push(`<span class="detail-absorb">흡수</span>가 <b class="semantic-gain">${c.refundAbsorbThreshold} 이상</b>인 상태에서 사용하면 AP를 <b class="semantic-gain">1</b> 환급받습니다.`);
  if (c.absorbFromDamage)
    extraSentences.push(`이 카드로 가한 피해의 <b class="semantic-gain">${Math.round(c.absorbFromDamage * 100)}%</b>만큼 <span class="detail-absorb">흡수</span>를 얻습니다.`);
  if (c.absorbStatusThreshold && c.absorbThresholdApplyAllEnemy)
    for (const [id, amount] of Object.entries(c.absorbThresholdApplyAllEnemy)) {
      const definition = statusDefinitions[id], value = typeof amount === "object" ? amount.stacks ?? amount.value ?? 1 : amount, turns = typeof amount === "object" ? amount.turns : null;
      if (!definition) continue;
      extraSentences.push(`<span class="detail-absorb">흡수</span>를 얻은 뒤 총 흡수가 <b class="semantic-gain">${c.absorbStatusThreshold} 이상</b>이면 모든 적에게 <span class="detail-status" style="--detail-status-color:${definition.color}">${definition.name}</span>을 ${turns ? `<b class="semantic-gain">${turns}턴 동안</b> ` : ""}<b class="semantic-gain">${value}중첩</b> 적용합니다.`);
    }
  if (c.missingHpHealRatio)
    extraSentences.push(`플레이어가 잃은 체력의 <b class="semantic-gain">${Math.round(c.missingHpHealRatio * 100)}%</b>를 <span class="detail-status" style="--detail-status-color:${CARD_EFFECT_UI.heal.color}">회복</span>하며, 회복량은 최소 <b class="semantic-gain">${c.minimumHeal || 0}</b>입니다.`);
  if (isHealCard && c.comboHealThreshold)
    extraSentences.push(`이 카드를 포함해 이번 턴 사용한 카드가 <b class="semantic-gain">${c.comboHealThreshold}장 이상</b>이면 이 카드의 회복량을 <b class="semantic-gain">${c.comboHealMultiplier}배</b>로 적용합니다.`);
  if (isHealCard && c.harmonyHealShield)
    extraSentences.push(`이번 턴 이미 하모니를 완성했다면 실제 회복량과 같은 수치의 <span class="detail-shield">방어막</span>을 추가로 얻습니다.`);
  if (isHealCard && c.overhealShieldRatio)
    extraSentences.push(`최대 체력을 넘는 초과 회복량의 <b class="semantic-gain">${Math.round(c.overhealShieldRatio * 100)}%</b>를 <span class="detail-shield">방어막</span>으로 전환합니다.`);
  if (isHealCard && c.cleanseAilmentStacks)
    extraSentences.push(`<span class="detail-status" style="--detail-status-color:${CARD_EFFECT_UI.cleanse.color}">연소·부식·중독·출혈</span>을 각각 <b class="semantic-gain">${c.cleanseAilmentStacks}중첩</b> 제거합니다.`);
    if (c.shieldScaling)
      extraSentences.push(`현재 <span class="detail-shield">방어막</span>의 <b class="semantic-gain">${Math.round(c.shieldScaling * 100)}%</b>만큼 추가 피해를 주며 <span class="detail-shield">방어막</span>은 소모하지 않습니다.`);
    if (c.absorbBonusRatio)
      extraSentences.push(`현재 <span class="detail-absorb">흡수</span>의 <b class="semantic-gain">${Math.round(c.absorbBonusRatio * 100)}%</b>만큼 추가 피해를 주며 <span class="detail-absorb">흡수</span>는 소모하지 않습니다.`);
    if (isDefenseCard && c.retainShield)
      extraSentences.push(`턴 종료 시 현재 <span class="detail-shield">방어막</span>의 <b class="semantic-gain">${Math.round(c.retainShield * 100)}%</b>를 다음 턴까지 유지합니다.`);
    if (c.cleanse)
      extraSentences.push(`플레이어의 해로운 상태이상을 ${c.cleanse === "all" ? '<b class="semantic-gain">전부</b>' : `<b class="semantic-gain">${c.cleanse}개</b>`} <span class="detail-status" style="--detail-status-color:#74c9bd">정화</span>합니다.`);
    if (isDefenseCard && c.turnDamageReduction)
      extraSentences.push(`이번 턴 플레이어가 받는 모든 피해를 <b class="semantic-gain">${c.turnDamageReduction}</b>만큼 경감합니다.`);
    if (isDefenseCard && (c.shieldCounter || c.shieldScalingAttack)) {
      const counterRatio = c.shieldCounter || c.shieldScalingAttack,
        counterPattern = c.shieldCounter ? "contact" : c.attackPattern || "contact",
        counterPatternLabel = counterPattern === "nonContact" ? "비접촉 피해" : "접촉 피해";
      extraSentences.push(`<span class="detail-shield">방어막</span>을 얻은 뒤 현재 방어막의 <b class="semantic-gain">${Math.round(counterRatio * 100)}%</b>만큼 대상에게 <span class="detail-pattern detail-pattern-${counterPattern}">${counterPatternLabel}</span>를 주며 방어막은 소모하지 않습니다.`);
    }
    if (isDefenseCard && c.shieldSurvivalHeal)
      extraSentences.push(`적의 행동이 끝날 때까지 <span class="detail-shield">방어막</span>이 남아 있으면 체력을 <b class="semantic-gain">${c.shieldSurvivalHeal}</b> 회복합니다.`);
    if (c.thorns)
      extraSentences.push(`자신에게 <span class="detail-status" style="--detail-status-color:${statusDefinitions.thorns.color}">가시</span>를 <b class="semantic-gain">${c.thorns}중첩</b> 적용합니다.`);
    if (isDefenseCard && c.thornsApplyAttacker)
      for (const [id, amount] of Object.entries(c.thornsApplyAttacker)) {
        const definition = statusDefinitions[id],
          value = typeof amount === "object" ? amount.stacks ?? amount.value ?? 1 : amount,
          turns = typeof amount === "object" ? amount.turns : null;
        if (!definition) continue;
        extraSentences.push(`가시 반격이 발생하면 공격자에게 <span class="detail-status" style="--detail-status-color:${definition.color}">${definition.name}</span>을 ${turns ? `<b class="semantic-gain">${turns}턴 동안</b> ` : ""}<b class="semantic-gain">${value}중첩</b> 적용합니다.`);
      }
    if (isDefenseCard && c.applyWeak) {
      const definition = statusDefinitions.weak;
      extraSentences.push(`대상에게 <span class="detail-status" style="--detail-status-color:${definition.color}">${definition.name}</span>을 <b class="semantic-gain">${c.applyWeak}중첩</b> 적용합니다.`);
    }
    if (c.conditionalEnemyIntent)
      for (const [intent, statusMap] of Object.entries(c.conditionalEnemyIntent))
        for (const [id, amount] of Object.entries(statusMap)) {
          const definition = statusDefinitions[id],
            value = typeof amount === "object" ? amount.stacks ?? amount.value ?? 1 : amount,
            turns = typeof amount === "object" ? amount.turns : null,
            intentLabel = intent === "attack" ? "공격을" : `${intent} 행동을`;
          if (!definition) continue;
          extraSentences.push(`${intentLabel} 준비 중인 적에게 <span class="detail-status" style="--detail-status-color:${definition.color}">${definition.name}</span>를 ${turns ? `<b class="semantic-gain">${turns}턴 동안</b> ` : ""}<b class="semantic-gain">${value}중첩</b> 적용합니다.`);
        }
    if (c.discard)
      extraSentences.push(`손패에서 카드 <b class="semantic-loss">${c.discard}장</b>을 선택해 <span class="detail-status" style="--detail-status-color:#d78972">버립니다</span>.`);
    if (c.randomDiscard)
      extraSentences.push(`손패에서 카드 <b class="semantic-loss">${c.randomDiscard}장</b>을 무작위로 <span class="detail-status" style="--detail-status-color:#d78972">버립니다</span>.`);
    if (c.discardedGainShield)
      extraSentences.push(`이 카드가 카드/증강 효과로 손패에서 실제 버려지면 <span class="detail-shield">방어막</span>을 <b class="semantic-gain">${c.discardedGainShield}</b> 얻습니다. 정상 사용 후 버린 카드 더미로 이동하는 것은 이 조건에 포함되지 않습니다.`);
    if (c.discardedDrawOne) {
      extraSentences.push(`이 카드가 카드/증강 효과로 손패에서 실제 버려지면 <span class="detail-draw">카드</span>를 <b class="semantic-gain">${c.discardedDrawOne}장</b> 뽑습니다.`);
      if (c.discardedExtraDrawChance)
        extraSentences.push(`같은 버리기 이벤트에서 <b class="semantic-gain">${Math.round(c.discardedExtraDrawChance * 100)}%</b> 확률로 카드 <b class="semantic-gain">1장</b>을 추가로 뽑습니다.`);
    }
    if (c.discardedRandomBurn)
      extraSentences.push(`이 카드가 실제 버려진 시점의 생존 적 중 1명을 무작위로 골라 <span class="detail-status" style="--detail-status-color:${statusDefinitions.burning.color}">연소</span>를 <b class="semantic-gain">${c.discardedRandomBurn}중첩</b> 적용합니다.`);
    if (c.augmentDiscardShield || c.augmentDiscardAbsorb) {
      const discardRewards = [
        c.augmentDiscardShield
          ? `<span class="detail-shield">방어막</span> <b class="semantic-gain">+${c.augmentDiscardShield}</b>`
          : "",
        c.augmentDiscardAbsorb
          ? `<span class="detail-absorb">흡수</span> <b class="semantic-gain">+${c.augmentDiscardAbsorb}</b>`
          : "",
      ].filter(Boolean).join(" · ");
      extraSentences.push(`이 카드가 선택하게 한 실제 버리기에서 버린 카드의 <b>원본 기본 AP</b>가 <b class="semantic-gain">${c.augmentDiscardMinBaseAp || 0} 이상</b>이면 ${discardRewards}를 얻습니다. 임시 할인이나 0 AP 변환은 이 판정에 영향을 주지 않습니다.`);
    }
    const originalPatternForDetail =
        c.attackPattern || (c.attack || c.burst || c.weight ? "contact" : null),
      effectivePatternForDetail =
        run?.battle && originalPatternForDetail &&
        typeof engine.effectiveCardAttackPattern === "function"
          ? engine.effectiveCardAttackPattern(run, c)
          : originalPatternForDetail;
    if (
      originalPatternForDetail &&
      effectivePatternForDetail &&
      originalPatternForDetail !== effectivePatternForDetail
    )
      extraSentences.push(`원본 공격방식은 <b>${originalPatternForDetail === "contact" ? "접촉" : "비접촉"}</b>이며, 현재 전투 판정은 <b class="semantic-gain">${effectivePatternForDetail === "contact" ? "접촉" : "비접촉"} (반전)</b>입니다.`);
    if (
      run?.battle &&
      card.id !== "impurity" &&
      typeof engine.isEffectiveImpurityCard === "function" &&
      engine.isEffectiveImpurityCard(run, card)
    )
      extraSentences.push(`현재 이 카드는 <b class="semantic-gain">불순물 판정</b> 트리거의 대상이지만, 실제 불순물 카드로 바뀐 것은 아닙니다.`);
    if (isDefenseCard && c.purgeImpurity)
      extraSentences.push(`손패의 불순물을 ${c.purgeImpurity === Infinity ? '<b class="semantic-gain">전부</b>' : `<b class="semantic-gain">${c.purgeImpurity}장</b>`} 소멸시킵니다.`);
    if (!mainValues.length)
      mainValues.push(cardEffectText(card, true).split(" · ")[0]);
    const attackPatternLabel = c.attackPattern === "nonContact" ? "비접촉 피해" : "접촉 피해",
      primarySentences = [];
    if (c.attack)
      primarySentences.push(`${randomEachHitPrefix}${targetMarkup}에게 <span class="detail-pattern detail-pattern-${c.attackPattern || "contact"}">${attackPatternLabel}</span>를 ${damageText} 입힙니다.`);
    else if (c.burst)
      primarySentences.push(`<span class="detail-absorb">흡수</span>를 전부 소모하여 현재 흡수의 <b class="semantic-gain">${c.burstMultiplier ?? 8 + level}배</b>만큼 피해를 입힙니다.`);
    else if (c.weight)
      primarySentences.push(`현재 <span class="detail-shield">방어막</span>을 모두 소모하고, 방어막 수치와 공격력을 합한 만큼 대상에게 피해를 입힙니다.`);
    if (c.shield)
      primarySentences.push(`플레이어가 <span class="detail-shield">방어막</span>을 <b class="semantic-gain">${c.shield + up + defense}</b> 얻습니다.`);
    if (c.heal)
      primarySentences.push(`플레이어의 체력을 <b class="semantic-gain">${c.heal + up}</b> <span class="detail-status" style="--detail-status-color:#82d49a">회복</span>합니다.`);
    if (c.absorb)
      primarySentences.push(`<span class="detail-absorb">흡수</span>를 <b class="semantic-gain">${c.absorb + up}</b> 얻습니다.`);
    if (c.draw)
      primarySentences.push(`<span class="detail-draw">카드</span>를 <b class="semantic-gain">${c.draw}장</b> 뽑습니다.`);
    const representedStatusNames = new Set(
        directStatuses.map(({ id }) => statusDefinitions[id]?.name).filter(Boolean),
      ),
      expandedRules = cardEffectText(card, true)
        .split(" · ")
        .map((rule) => rule.replace(/<[^>]*>/g, "").trim())
        .filter(Boolean),
      remainingRules = expandedRules.filter((rule, index) => {
        if (index === 0 && (c.attack || c.burst || c.weight || c.heal || c.shield || c.absorb || c.draw)) return false;
        if (rule.includes("소모 없음")) return false;
        if (c.absorb && /^흡수 \+/.test(rule)) return false;
        if (c.shield && /^방어막 \+/.test(rule)) return false;
        if (c.heal && /^체력 \+/.test(rule)) return false;
        if (c.draw && /^카드 \+/.test(rule)) return false;
      if (c.missingHpHealRatio && (/^잃은 체력의/.test(rule) || /^최소 \d+/.test(rule))) return false;
      if (c.drawOnBreak && /^방어막 파괴 시 카드/.test(rule)) return false;
      if (c.drawOnKill && /^처치 시 카드/.test(rule)) return false;
      if (c.searchDrawCard && /^뽑을 카드 더미에서/.test(rule)) return false;
      if (c.preventAbsorbDecay && /^이번 턴 종료 시 흡수 감쇄/.test(rule)) return false;
      if (c.absorbAmplifyRatio && /^기본 흡수 획득 후/.test(rule)) return false;
      if (c.absorbBooster && /^이번 턴 다음 카드 2장/.test(rule)) return false;
      if (c.reduceOilCost && /^이번 턴 손패의 모든 오일 카드 비용/.test(rule)) return false;
      if (c.refundAbsorbThreshold && /^흡수 \d+ 이상에서 사용시 AP/.test(rule)) return false;
      if (c.absorbStatusThreshold && /^흡수 획득 후 \d+ 이상이면 모든 적에게/.test(rule)) return false;
      if (c.absorbFromDamage && /^가한 피해의/.test(rule)) return false;
      if (c.comboHealThreshold && /^이 카드를 포함해 이번 턴/.test(rule)) return false;
      if (c.harmonyHealShield && /^이번 턴 하모니를 완성했다면/.test(rule)) return false;
      if (c.overhealShieldRatio && /^초과 회복량의/.test(rule)) return false;
      if (c.cleanseAilmentStacks && /^연소·부식·중독·출혈 각각/.test(rule)) return false;
        if (c.oil && rule === "오일 발동") return false;
        if (c.shieldScaling && /^현재 방어막/.test(rule)) return false;
        if (c.shieldScaling && rule === "방어막 소모 없음") return false;
        if (c.absorbBonusRatio && /^현재 흡수/.test(rule)) return false;
        if (c.absorbBonusRatio && rule === "흡수 소모 없음") return false;
        if (c.target === "all" && rule === "적 대상을 광역으로 공격합니다") return false;
      if (isDefenseCard && c.retainShield && /^다음 턴 방어막/.test(rule)) return false;
      if (c.cleanse && /^해로운 상태이상/.test(rule)) return false;
      if (isDefenseCard && c.turnDamageReduction && /^이번 턴 받는 모든 피해/.test(rule)) return false;
      if (isDefenseCard && (c.shieldCounter || c.shieldScalingAttack) && /^방어막 획득 후 현재 방어막/.test(rule)) return false;
      if (isDefenseCard && c.shieldSurvivalHeal && /^방어막이 깨지지 않고/.test(rule)) return false;
      if (c.thorns && /^가시 \+/.test(rule)) return false;
      if (isDefenseCard && c.thornsApplyAttacker && /^가시 반격 시/.test(rule)) return false;
      if (isDefenseCard && c.applyWeak && /^적 약화/.test(rule)) return false;
      if (isDefenseCard && c.conditionalEnemyIntent && /(?:공격 준비 중인 적에게|행동을 준비 중인 적에게)/.test(rule)) return false;
      if (c.discard && /^손패 \d+장 선택 버리기/.test(rule)) return false;
        if (c.randomDiscard && /^손패 \d+장 무작위 버리기/.test(rule)) return false;
      if (c.discardedGainShield && /^이 카드가 실제 버려지면 방어막 \+/.test(rule)) return false;
      if (c.discardedDrawOne && /^이 카드가 실제 버려지면 카드 \d+장 드로우/.test(rule)) return false;
      if (c.discardedExtraDrawChance && /^실제 버리기 시 \d+% 확률로 카드 1장 추가 드로우/.test(rule)) return false;
      if (c.discardedRandomBurn && /^이 카드가 실제 버려지면 무작위 생존 적 연소 \+/.test(rule)) return false;
      if (
        (c.augmentDiscardShield || c.augmentDiscardAbsorb) &&
        (
          /^선택해 버린 카드의 기본 AP가/.test(rule) ||
          (c.augmentDiscardShield && rule === `방어막 +${c.augmentDiscardShield}`) ||
          (c.augmentDiscardAbsorb && rule === `흡수 +${c.augmentDiscardAbsorb}`)
        )
      ) return false;
      if (isDefenseCard && c.purgeImpurity && /^손패의 불순물/.test(rule)) return false;
        return ![...representedStatusNames].some((name) => rule.startsWith(`${name} +`));
      }),
      detail = [
        ...primarySentences,
        ...statusSentences,
        ...extraSentences,
        ...remainingRules.map(completeSemanticRule),
      ].filter(Boolean).join(" ");
    const rows = mainValues.map(compactCardSummaryRowData),
      comparisonRows = comparisonCard
        ? compactCardEffectSummary(comparisonCard)?.rows || []
        : [],
      comparisonRowsByLabel = new Map();
    for (const row of comparisonRows) {
      if (!comparisonRowsByLabel.has(row.label)) comparisonRowsByLabel.set(row.label, []);
      comparisonRowsByLabel.get(row.label).push(row);
    }
    const summaryRows = rows.map((row) => {
      const candidates = comparisonRowsByLabel.get(row.label),
        comparisonRow = candidates?.shift(),
        changed = Boolean(comparisonCard) && (!comparisonRow || comparisonRow.result !== row.result);
      return compactCardSummaryRow(row, changed);
    }).join("");
    return {
      symbols: effectSymbols
        ? `<span class="card-effect-symbols">${effectSymbols}</span>`
        : "",
      body: `<span class="card-effect-main card-effect-compact">${summaryRows}</span><span class="card-effect-tooltip" role="tooltip">${detail}</span>`,
      rows,
    };
  }
  function cardHtml(card, index = null, interaction = null, comparisonCard = null) {
      const run = getRun();
    const c = cards[card.id],
      effectiveCard = engine.cardDefinition(card),
      comparisonDefinition = comparisonCard ? engine.cardDefinition(comparisonCard) : null,
      tier = Math.min(4, Math.max(1, Number(c.tier) || 1)),
      cardNote = card.note || c.note,
      price = run?.battle ? engine.cost(run, card) : effectiveCard.cost,
      priceChanged = Boolean(comparisonDefinition) && comparisonDefinition.cost !== effectiveCard.cost,
      runtimePriceChanged = Boolean(run?.battle) && price !== effectiveCard.cost,
      type =
        c.attack || c.burst || c.weight
          ? "attack"
          : c.category === "heal"
            ? "healing"
          : c.shield
            ? "defense"
            : c.heal
              ? "healing"
              : "effect",
      choosingDiscard = index !== null && run?.battle?.pendingDiscard,
      disabled = index !== null && (choosingDiscard ? !engine.canDiscard(run, card) : !engine.canPlay(run, card)),
      unavailableReason = disabled
        ? choosingDiscard
          ? engine.cardDiscardBlockReason(run, card)
          : engine.cardPlayBlockReason(run, card)
        : null,
      apAvailabilityClass = index !== null && !choosingDiscard
        ? disabled
          ? " card-ap-unavailable"
          : " card-ap-available"
        : "",
      apValue = `<span class="card-ap-value${apAvailabilityClass}${priceChanged ? " card-upgrade-value-changed" : ""}${runtimePriceChanged ? " card-runtime-value-changed" : ""}"${runtimePriceChanged ? ` title="카드 자체 AP ${effectiveCard.cost} · 현재 최종 비용 ${price} AP"` : ""}>${price}${runtimePriceChanged ? `<small class="card-ap-original" aria-label="카드 자체 AP ${effectiveCard.cost}">←${effectiveCard.cost}</small>` : ""}</span>`,
      originalPattern =
        c.attackPattern || (c.attack || c.burst || c.weight ? "contact" : null),
      pattern =
        run?.battle && originalPattern &&
        typeof engine.effectiveCardAttackPattern === "function"
          ? engine.effectiveCardAttackPattern(run, effectiveCard)
          : originalPattern,
      patternChanged = Boolean(originalPattern && pattern && originalPattern !== pattern),
      patternBadge = pattern
        ? `<em class="attack-pattern pattern-${pattern}${patternChanged ? " pattern-inverted" : ""}"${patternChanged ? ` title="원본: ${originalPattern === "contact" ? "접촉" : "비접촉"} · 현재 판정: ${pattern === "contact" ? "접촉" : "비접촉"} (반전)"` : ""}>${pattern === "contact" ? "접촉" : "비접촉"}${patternChanged ? " ↺" : ""}</em>`
        : "",
      effectiveImpurity =
        Boolean(run?.battle) &&
        card.id !== "impurity" &&
        typeof engine.isEffectiveImpurityCard === "function" &&
        engine.isEffectiveImpurityCard(run, card),
      impurityBadge = effectiveImpurity
        ? `<em class="attack-pattern classification-impurity-effective" title="현재 판정: 불순물 트리거 대상 · 실제 불순물 카드는 아님">불순물 판정</em>`
        : "",
      oilBadge = c.oil
        ? `<em class="attack-pattern classification-oil" title="오일 카드" aria-label="오일 카드">◉</em>`
        : "",
      category = c.category || (c.attack || c.burst || c.weight ? "attack" : c.shield || c.heal ? "defense" : c.absorb ? "absorb" : "effect"),
      icon = {
        attack: `<svg viewBox="0 0 24 24"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6m-3 3 4 4m-1 1 2-2M14.5 6.5 18 3h3v3L9.5 17.5M5 14l-2 2 5 5 2-2"/></svg>`,
        defense: `<svg viewBox="0 0 40 40"><path d="M20 5l12 5v9c0 8-4.8 13-12 17-7.2-4-12-9-12-17v-9z"/></svg>`,
        absorb: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="11"/><circle cx="20" cy="20" r="7"/></svg>`,
        heal: `<svg viewBox="0 0 40 40"><path d="M16 6h8v10h10v8H24v10h-8V24H6v-8h10z"/></svg>`,
        effect: `<svg viewBox="0 0 40 40"><path d="M20 6l3.6 10.4L34 20l-10.4 3.6L20 34l-3.6-10.4L6 20l10.4-3.6z"/></svg>`,
      }[category],
      interactionAttributes = interaction
        ? `data-action="${interaction.action}" data-card="${interaction.card}" aria-label="${interaction.ariaLabel}"${interaction.optionId === undefined ? "" : ` data-option="${interaction.optionId}"`}${interaction.index === undefined ? "" : ` data-index="${interaction.index}"`}${interaction.replaceIndex === undefined ? "" : ` data-replace-index="${interaction.replaceIndex}"`}`
        : index === null
          ? ""
          : `data-action="${choosingDiscard ? "discard-choice" : "play"}" data-index="${index}"`,
      compactEffect = compactCardEffectSummary(card, comparisonCard),
      handDetailTooltip = index !== null && compactEffect === null
        ? `<span class="card-effect-tooltip" role="tooltip">${cardEffectText(card, true)}</span>`
        : "";
   return `<button class="card${index === null ? "" : " hand-card-visual"} card-type-${type} card-category-${category} note-${cardNote} card-tier-${tier}${compactEffect !== null ? " card-compact-status" : ""}${card.id === "impurity" ? " card-impurity" : ""}${interaction?.className ? ` ${interaction.className}` : ""}" ${interactionAttributes} ${disabled ? 'aria-disabled="true"' : ""}><span class="card-top"><b${choosingDiscard ? ' class="card-discard-action"' : ""}>${choosingDiscard ? "버리기" : `${apValue} AP`}</b>${card.id === "impurity" ? "" : tierStars(tier, "card-tier-stars")}<span class="card-meta"><small>${card.id === "impurity" ? "불순물" : `${{ top: "TOP", middle: "MIDDLE", base: "BASE", none: "NONE" }[cardNote]} · T${tier}`}</small>${patternBadge}${impurityBadge}${oilBadge}</span></span><span class="card-symbol" aria-hidden="true">${icon}</span>${unavailableReason ? `<span class="card-unavailable-reason" role="tooltip">${unavailableReason}</span>` : ""}<strong>${c.name}${card.level ? ` +${card.level}` : ""}</strong>${compactEffect?.symbols || ""}<span class="card-effects">${compactEffect?.body ?? cardEffectText(card)}${handDetailTooltip}</span></button>`;
  }

  return {
    statusAmountText,
    cardEffectText,
    compactCardEffectSummary,
    cardHtml,
  };
}

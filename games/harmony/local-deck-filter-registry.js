import { deriveCardMechanics } from "./card-mechanics.js?v=20260920-2";

const hasValue = (record, key) => {
  const value = record?.[key];
  if (value === undefined || value === null || value === false || value === 0) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

const hasAny = (record, keys) => keys.some((key) => hasValue(record, key));
const option = (id, label, icon = "") => ({ id, label, icon });
const section = (id, label, options, selectionMode = "all") => ({ id, label, options, selectionMode });
const group = (id, label, sections, defaultOpen = false) => ({ id, label, sections, defaultOpen });

const CARD_MECHANIC_OPTIONS = Object.freeze({
  attack: [
    option("attack-multi-hit", "연타", "⋙"),
    option("attack-shield-pierce", "관통", "⟐"),
    option("attack-shield-reference", "방어막 참조", "⬡"),
    option("attack-shield-break", "방어막 파괴", "◇"),
    option("attack-execute", "처형", "†"),
    option("attack-turn-scaling", "턴 비례", "◷"),
    option("attack-hand-scaling", "손패 비례", "▤"),
    option("attack-status-scaling", "상태 비례", "△"),
    option("attack-ailment-burst", "상태 폭발·증폭", "✹"),
    option("attack-conditional", "조건부 강화", "◆"),
    option("attack-kill-trigger", "처치 연계", "☠"),
  ],
  defense: [
    option("defense-shield", "방어막", "◇"),
    option("defense-retain", "방어막 유지", "▣"),
    option("defense-reduction", "피해 감소", "▽"),
    option("defense-counter", "반격", "↺"),
    option("defense-thorns", "가시", "✦"),
  ],
  absorb: [
    option("absorb-gain", "흡수 획득", "◉"),
    option("absorb-amplify", "흡수 증폭", "⊕"),
    option("absorb-retain", "감쇄 방지", "∞"),
    option("absorb-threshold", "임계값", "△"),
    option("absorb-reference", "소비·참조", "◎"),
  ],
  heal: [
    option("heal-direct", "일반 회복", "✚"),
    option("heal-missing-hp", "잃은 HP 비례", "♡"),
    option("heal-regeneration", "재생", "♻"),
    option("heal-conditional", "조건부 회복", "◆"),
  ],
});

const CARD_RESOURCE_OPTIONS = Object.freeze([
  option("resource-ap", "AP", "A"),
  option("resource-absorb", "흡수", "◉"),
  option("resource-oil", "오일", "●"),
  option("resource-draw", "드로우", "+"),
  option("resource-discard", "버리기", "−"),
  option("resource-shield", "방어막", "◇"),
  option("resource-heal", "회복", "✚"),
  option("resource-cleanse", "정화", "✧"),
  option("resource-harmony", "HARMONY", "♫"),
  option("resource-resonance", "잔향", "≈"),
  option("resource-search", "카드 서치", "⌕"),
  option("resource-cost", "비용 감소", "↓"),
]);

function collectStatusIds(card) {
  return new Set(
    [...deriveCardMechanics(card)]
      .filter((tag) => tag.startsWith("status:"))
      .map((tag) => tag.slice("status:".length)),
  );
}

export function classifyCard(card, statusDefinitions = {}) {
  const tags = new Set(),
    mechanics = deriveCardMechanics(card);
  if (Number.isFinite(card?.tier)) tags.add(`tier-${card.tier}`);
  if (card?.note) tags.add(`note-${card.note}`);
  if (card?.attackPattern) tags.add(`attack-${card.attackPattern}`);

  if (mechanics.has("target:all")) tags.add("target-all");
  else if (mechanics.has("target:ricochet")) tags.add("target-random");
  else tags.add("target-single");

  const rules = [
    ["attack-shield-break", ["drawOnBreak", "refundOnBreak", "shieldDamageMultiplier"]],
    ["attack-execute", ["executeAttack", "executeMultiplier", "executeNonBoss", "executeRatio"]],
    ["attack-hand-scaling", ["handDamageBonus", "hitsPerCardThisTurn"]],
    ["attack-status-scaling", ["bonusPerStatus", "resonanceDamagePerStack", "resonanceChainPerStack"]],
    ["attack-ailment-burst", ["ailmentBurstMultiplier", "globalAilmentBurstMultiplier", "amplifyAilments", "burnProcCount"]],
    ["attack-conditional", ["firstTurnOrFullHpMultiplier", "requiredAbsorb", "conditionalEnemyIntent", "applyEnemyIfPreAttackStatus", "shieldThreshold"]],
    ["attack-kill-trigger", ["drawOnKill", "refundOnKill", "maxHpOnKill"]],
    ["defense-shield", ["shield"]],
    ["defense-retain", ["retainShield"]],
    ["defense-reduction", ["turnDamageReduction"]],
    ["defense-counter", ["shieldCounter"]],
    ["defense-thorns", ["thorns", "thornsApplyAttacker"]],
    ["absorb-gain", ["absorb", "absorbFromDamage", "absorbBooster"]],
    ["absorb-amplify", ["absorbAmplifyRatio"]],
    ["absorb-retain", ["preventAbsorbDecay"]],
    ["absorb-threshold", ["absorbAmplifyThreshold", "absorbStatusThreshold", "refundAbsorbThreshold"]],
    ["absorb-reference", ["absorbCost", "requiredAbsorb", "resonanceAbsorbPerStack", "resonanceConsumeMax"]],
    ["heal-direct", ["heal", "minimumHeal"]],
    ["heal-missing-hp", ["missingHpHealRatio"]],
    ["heal-regeneration", []],
    ["heal-conditional", ["comboHealMultiplier", "comboHealThreshold", "overhealShieldRatio", "harmonyHealShield", "resonanceSutureBonus"]],
    ["resource-ap", ["discardTierAp", "refundOnBreak", "refundOnKill", "refundAbsorbThreshold", "stagedRefund", "augmentDiscardMinBaseAp"]],
    ["resource-absorb", ["absorb", "absorbCost", "absorbFromDamage", "absorbBooster", "absorbAmplifyRatio", "refundAbsorbThreshold", "requiredAbsorb"]],
    ["resource-oil", ["oil", "reduceOilCost"]],
    ["resource-draw", ["draw", "drawOnBreak", "drawOnKill", "discardedDrawOne", "discardedExtraDrawChance"]],
    ["resource-discard", ["discard", "randomDiscard", "discardCostDamage", "augmentDiscardAbsorb", "augmentDiscardShield"]],
    ["resource-shield", ["shield", "discardedGainShield", "augmentDiscardShield", "overhealShieldRatio", "harmonyHealShield"]],
    ["resource-heal", ["heal", "missingHpHealRatio", "shieldSurvivalHeal", "minimumHeal"]],
    ["resource-cleanse", ["cleanse", "cleanseAilmentStacks", "purgeImpurity"]],
    ["resource-harmony", ["harmonyHealShield"]],
    ["resource-resonance", ["consumeResonance", "resonanceChainConsumeAll", "resonanceAbsorbPerStack", "resonanceConsumeMax", "resonanceSutureConsume"]],
    ["resource-search", ["searchDrawCard"]],
    ["resource-cost", ["reduceOilCost"]],
  ];
  for (const [tag, keys] of rules) if (hasAny(card, keys)) tags.add(tag);

  if (mechanics.has("multiHit")) tags.add("attack-multi-hit");
  if (mechanics.has("shieldPierce")) tags.add("attack-shield-pierce");
  if (mechanics.has("turnScaling")) tags.add("attack-turn-scaling");
  if (mechanics.has("shieldScaling")) tags.add("attack-shield-reference");
  if (mechanics.has("oil")) tags.add("resource-oil");
  if (mechanics.has("draw")) tags.add("resource-draw");
  if (mechanics.has("discard")) tags.add("resource-discard");
  if (mechanics.has("heal")) tags.add("resource-heal");
  if (mechanics.has("cleanse")) tags.add("resource-cleanse");
  if (card?.applyPlayer?.regeneration) {
    tags.add("heal-regeneration");
    tags.add("resource-heal");
  }

  for (const id of collectStatusIds(card))
    if (statusDefinitions[id]) tags.add(`status-${id}`);
  return tags;
}

const ITEM_EFFECT_GROUPS = Object.freeze({
  attack: new Set([
    "attack", "baseAttack", "contactAttack", "nonContactAttack", "topAttack", "burningAttack", "corrosionAttack", "harmonyAttack",
    "baseDamage", "aoeNonContactBonus", "aoeNonContactStunChance", "bleedHitBonus", "burningBonus", "burningDamageBonus", "burningMultiplier",
    "bypassShieldAmplify", "comboContact", "contactBleed", "contactBypass", "contactFourHitsBonus", "contactIgnite", "contactIgniteT2",
    "corrosionDoubleTick", "corrosionTickDamage", "endTurnShieldAttack", "executeThreshold", "firstNonContactBonus", "heavyContactTrueDamage",
    "highAbsorbAttack", "harmonyAoeTrueDamage", "harmonyEchoDamage", "multiHitDamageBonus", "nonContactAilmentBonus", "nonContactKillSupernova",
    "resonanceFirstNonContactAdd", "resonanceCoreNonContactAdd", "contactCostUp", "nonContactEnemyShield", "enemyCardMirror",
    "oilAttack", "poisonDeathDetonate", "poisonSpread", "resonanceConsumeDamageBonus", "spatialDiffusionMultiplier", "thornsDamageBonus",
    "thornsNovaMultiplier", "topZeroCostBonus", "zeroCostBonus", "dealRandomNoncontactDamageOnDraw", "firstStrikeBonus", "firstTurnContact",
    "splitDirectCardAttackIntoHits", "absorbSpendAoeDamage", "hitDamagePenalty", "multiHitDamagePenalty", "enemyAttackBuff",
  ]),
  defense: new Set([
    "defense", "openingShield", "baseNextShield", "blockCorrosion", "contactShield", "contactThorns", "diamondShieldImmunity", "discardImpurityShield",
    "firstExtraDrawShield", "guardBonusT2", "lowHpDefense", "oilShield", "oilShieldT2", "perfectShieldRetain", "permanentProtection",
    "regenShield", "regenShieldT2", "reshuffleRefundShield", "resonanceFirstHitShield", "retainedShield", "shieldBreakRefund", "shieldHit",
    "shieldRetainPercent", "thornsAmplifyRatio", "thornsCorrode", "thornsOnGuard", "topShield", "turn1Shield", "absorbSpillShield",
    "firstDiscardShield", "firstHitBlock", "largeHandFirstUseShield", "permanentShieldRetain", "startCombatThornsAndShield", "thornsFlat1",
    "endTurnShieldHalfLoss", "enemyShieldOnAttack", "hitShieldExtraLoss", "shieldCapLimit", "topNoteShieldHalf", "turnStartShieldLoss", "zeroShieldLock",
    "overflow", "overflowT2", "overflowT3", "firstGuardCostUp", "nonContactEnemyShield",
  ]),
  heal: new Set([
    "incomingHeal", "battleEndHeal", "regen", "absorbCostHeal", "bleedLeech", "contactBleedHeal", "middleHeal", "middleRegenBoost",
    "nonContactLeechAbsorb", "reviveOnFatal", "eternalDew", "essenceHeart", "restSiteOverheal", "reviveFullHpOncePerRun", "overflow", "overflowT2", "overflowT3",
    "consumeBurnEnemyHeal", "healAbsorbLoss", "enemyLeechAmount",
  ]),
  absorb: new Set([
    "absorb", "absorbBonus", "openingAbsorb", "absorbChainRefund", "absorbCostHeal", "absorbDecayGuard", "absorbOnEnd", "absorbSpendAoeDamage",
    "absorbSpillShield", "blockedDamageToAbsorb", "discardAbsorb", "firstImpurityUseAbsorb", "highAbsorbAttack", "highCostDiscardAbsorb",
    "infiniteAbsorbDecayImmunity", "maxAbsorbCapBonus", "nonContactAbsorb", "nonContactLeechAbsorb", "oilAbsorbRatio", "thirdExtraDrawAbsorb",
    "absorbDecaySoftener", "absorbGainFlat1", "fullHandFailedDrawAbsorb", "primordial", "turnStartAbsorb", "absorbCardSelfCorrosion",
    "absorbDecayBonus", "endTurnAbsorbZeroReset", "extraAbsorbDecay", "healAbsorbLoss",
  ]),
  health: new Set(["maxHp", "incomingHeal", "battleEndHeal", "regen", "reviveOnFatal", "reviveFullHpOncePerRun", "cardHpCost", "fiveTurnsDeathLimit", "hitPermanentMaxHpLoss", "zeroCostSelfDamage"]),
  economy: new Set([
    "goldBonus", "goldLumpSum", "chestExtraGold", "fleeBonusGold", "labCostDiscount", "shopAllDiscount", "shopCardDiscount", "shopRerollDiscount",
    "treasureRoomCardDuplication", "enterRoomGoldLoss", "goldDebt", "shopCostTriple", "shopPriceMultiplier", "victoryGoldPenalty",
  ]),
  harmony: new Set([
    "harmonyAttack", "harmonyAoeTrueDamage", "harmonyBonus", "harmonyDebuffStorm", "harmonyEchoDamage", "harmonyReplayBothCards",
    "harmonyReplayCard", "anyThreeCardsHarmony", "harmonyOrb", "harmonyWeakAll", "harmonyDamagePenalty", "harmonySelfVulnerable",
  ]),
  ap: new Set([
    "chanceFullApRefund", "fourthCardRefund", "turn1ExtraAp", "eighthCardRefundDraw", "fifthImpurityUseApDraw", "turnBaseAp", "apCap",
    "bossEliteTurn1Ap", "impurityApRefund", "impurityDrawApChance", "thirdDiscardRecoverFree", "everyTwoCardsApLoss", "thirdCardZeroAp", "turnStartApPenalty", "zeroCostTax",
    "thirdExtraDrawNextCardDiscount", "freeActiveCardsThisTurnChance", "firstGuardCostUp", "contactCostUp", "heavyTurnNextApLoss",
  ]),
  draw: new Set([
    "discardDraw", "discardImpurityDrawChance", "eighthCardRefundDraw", "extraDrawRandomResonance", "firstHighCostDiscardDrawTwo", "handRetain",
    "resonanceConsumeRefundDraw", "sixthCardDrawTwo", "draw", "turn1Draw", "turn1DrawChance", "reshuffleDiscardShieldDraw", "fixedDrawTwoCards", "turn1DrawPenalty",
    "thirdExtraDrawNextCardDiscount",
  ]),
  discard: new Set([
    "discardAbsorb", "discardDraw", "discardImpurityDrawChance", "discardImpurityShield", "firstHighCostDiscardDrawTwo", "highCostDiscardAbsorb",
    "secondDiscardNextCardDiscount", "thirdDiscardBurnAll", "firstDiscardShield", "thirdDiscardRecoverFree", "discardSelfDamage", "oilDiscardChance",
  ]),
  oil: new Set(["freeOilCardEachTurn", "oilAbsorbRatio", "oilAttack", "oilSearchAndDiscount", "oilShield", "oilShieldT2", "firstOilCardFree", "oilCardSelfDamage", "oilDiscardChance"]),
  impurity: new Set([
    "discardImpurityDrawChance", "discardImpurityShield", "fifthImpurityUseApDraw", "firstImpurityUseAbsorb", "firstImpurityUseCorrosion",
    "thirdImpurityUsePoisonAll", "firstImpurityDrawShield", "impurityApRefund", "impurityDrawApChance", "impurityDrawPush", "impurityHandBoostFirstTwoCards",
    "impurityUseRandomEffect", "purifyImpurity", "repeatImpurityRandomEffectOnce", "treatAllActiveCardsAsImpurity", "drawImpurityChance", "endTurnAddImpurity", "startWithImpurity",
  ]),
  status: new Set([
    "bleedHitBonus", "bleedLeech", "bleedTriggerShield", "burningBonus", "burningDamageBonus", "burningMultiplier", "cleanseOnLowHp",
    "contactBleed", "contactBleedHeal", "contactIgnite", "contactIgniteT2", "corrosionDoubleTick", "corrosionShieldDamage", "corrosionTickDamage",
    "extendDecayStatuses", "firstNonContactVulnerable", "nonContactPoison", "nonContactWeak", "nonContactWeakT2", "poisonDeathDetonate",
    "poisonSpread", "thornsCorrode", "combatStartBurn1", "harmonyWeakAll", "startCombatBurnAll", "burningBackfireRatio", "consumeBurnEnemyHeal",
    "burningStackBonusChance", "resonanceTransferOnKill", "resonanceFirstNonContactAdd", "resonanceCoreNonContactAdd",
    "contactSelfBleed", "doubleIncomingDebuffs", "enemyBleedMirror", "heavyCardSelfWeak", "harmonySelfVulnerable", "nonContactSelfBurn", "shieldBreakEnemyRegen",
  ]),
  deck: new Set([
    "deckSize", "handSize", "draw", "autoUpgradeBasicStrike", "cardTransformReroll", "discountFirstTwoExtraDrawnCards", "handRetain",
    "reduceHighCostCard", "secondDiscardNextCardDiscount", "sixthCardDrawTwo", "oilSearchAndDiscount", "rareCardChance", "turn1Draw",
    "invertCardAttackType", "potionSlot", "handSizePenalty", "lockRandomCardTurn", "forceRandomTarget", "fixedDrawTwoCards",
    "freeActiveCardsThisTurnChance", "thirdExtraDrawNextCardDiscount", "enemyCardMirror",
  ]),
  journey: new Set([
    "battleEndHeal", "cardTransformReroll", "chestExtraGold", "fleeBonusGold", "labCostDiscount", "potionSlot", "rareCardChance", "restSiteOverheal",
    "roomClearTorch", "shopAllDiscount", "shopCardDiscount", "shopRerollDiscount", "treasureRoomCardDuplication", "enterRoomGoldLoss", "shopCostTriple",
    "shopPriceMultiplier", "victoryGoldPenalty",
  ]),
  special: new Set([
    "reviveOnFatal", "extraTurnOncePerBattle", "reviveFullHpOncePerRun", "turnTimerIndicator", "bossEnrageTurnAdvance", "buffNullifyChance",
    "fiveTurnsDeathLimit", "hitInstaDeathChance", "lockRandomCardTurn", "forceRandomTarget", "freeActiveCardsThisTurnChance", "enemyCardMirror",
  ]),
});

export function classifyItem(item) {
  const tags = new Set();
  if (Number.isFinite(item?.tier)) tags.add(`tier-${item.tier}`);
  if (!item?.effect) return tags;
  for (const [tag, effects] of Object.entries(ITEM_EFFECT_GROUPS))
    if (effects.has(item.effect)) tags.add(`item-${tag}`);
  if (["openingShield", "openingAbsorb", "turn1Shield", "turn1ExtraAp", "startCombatBurnAll", "startCombatThornsAndShield", "combatStartBurn1", "turn1Draw", "turn1DrawChance"].includes(item.effect))
    tags.add("item-opening");
  if (["contactAttack", "comboContact", "contactBleed", "contactBypass", "contactFourHitsBonus", "contactIgnite", "contactIgniteT2", "contactShield", "contactThorns", "firstTurnContact", "contactCostUp"].includes(item.effect))
    tags.add("item-contact");
  if (["nonContactAttack", "aoeNonContactBonus", "aoeNonContactStunChance", "firstNonContactBonus", "firstNonContactVulnerable", "nonContactAbsorb", "nonContactAilmentBonus", "nonContactKillSupernova", "nonContactLeechAbsorb", "nonContactPoison", "nonContactWeak", "nonContactWeakT2", "dealRandomNoncontactDamageOnDraw", "resonanceFirstNonContactAdd", "resonanceCoreNonContactAdd", "nonContactEnemyShield"].includes(item.effect))
    tags.add("item-non-contact");
  return tags;
}

const TIER_OPTIONS = [1, 2, 3, 4].map((tier) => option(`tier-${tier}`, `${tier}티어`));
const ITEM_TIER_OPTIONS = [0, 1, 2, 3, 4].map((tier) => option(`tier-${tier}`, `${tier}티어`));
const NOTE_OPTIONS = [option("note-top", "TOP"), option("note-middle", "MIDDLE"), option("note-base", "BASE")];
const ATTACK_PATTERN_OPTIONS = [option("attack-contact", "접촉"), option("attack-nonContact", "비접촉")];
const TARGET_OPTIONS = [option("target-single", "단일", "⌖"), option("target-all", "광역", "◎"), option("target-random", "무작위·도탄", "↝")];

const cardDefinitions = {
  attack: [
    group("basic", "기본 필터", [section("tier", "티어", TIER_OPTIONS, "any"), section("note", "노트", NOTE_OPTIONS, "any"), section("attack-mode", "공격 방식", ATTACK_PATTERN_OPTIONS, "any")], true),
    group("target", "대상", [section("target", "대상", TARGET_OPTIONS, "any")]),
    group("mechanics", "공격 특성", [section("attack-mechanics", "특성", CARD_MECHANIC_OPTIONS.attack)]),
    group("resources", "자원 · 연계", [section("attack-resources", "연계", CARD_RESOURCE_OPTIONS)]),
  ],
  defense: [
    group("basic", "기본 필터", [section("tier", "티어", TIER_OPTIONS, "any"), section("note", "노트", NOTE_OPTIONS, "any")], true),
    group("mechanics", "방어 방식", [section("defense-mechanics", "방어", CARD_MECHANIC_OPTIONS.defense)]),
    group("resources", "보조 효과", [section("defense-resources", "보조", CARD_RESOURCE_OPTIONS)]),
  ],
  absorb: [
    group("basic", "기본 필터", [section("tier", "티어", TIER_OPTIONS, "any"), section("note", "노트", NOTE_OPTIONS, "any")], true),
    group("mechanics", "흡수", [section("absorb-mechanics", "흡수", CARD_MECHANIC_OPTIONS.absorb)]),
    group("resources", "카드 · 자원", [section("absorb-resources", "연계", CARD_RESOURCE_OPTIONS)]),
  ],
  heal: [
    group("basic", "기본 필터", [section("tier", "티어", TIER_OPTIONS, "any"), section("note", "노트", NOTE_OPTIONS, "any")], true),
    group("mechanics", "회복 방식", [section("heal-mechanics", "회복", CARD_MECHANIC_OPTIONS.heal)]),
    group("resources", "방어 · 자원", [section("heal-resources", "연계", CARD_RESOURCE_OPTIONS)]),
  ],
};

const itemOption = (tag, label) => option(`item-${tag}`, label);
const itemDefinitions = {
  stat: [
    group("basic", "기본 필터", [section("tier", "티어", ITEM_TIER_OPTIONS, "any")], true),
    group("impact", "영향 영역", [section("stat-impact", "영향", [itemOption("attack", "공격"), itemOption("defense", "방어"), itemOption("heal", "회복"), itemOption("absorb", "흡수"), itemOption("health", "체력"), itemOption("economy", "경제"), itemOption("harmony", "HARMONY")])]),
    group("detail", "세부", [section("stat-detail", "세부", [itemOption("contact", "접촉"), itemOption("non-contact", "비접촉"), itemOption("opening", "전투 시작")])]),
  ],
  trait: [
    group("basic", "기본 필터", [section("tier", "티어", ITEM_TIER_OPTIONS, "any")], true),
    group("combat", "공격 · 방어", [section("trait-combat", "전투", [itemOption("attack", "공격"), itemOption("contact", "접촉"), itemOption("non-contact", "비접촉"), itemOption("defense", "방어"), itemOption("heal", "회복")])]),
    group("resources", "자원", [section("trait-resources", "자원", [itemOption("ap", "AP"), itemOption("absorb", "흡수"), itemOption("oil", "오일")])]),
    group("cards", "카드 조작", [section("trait-cards", "카드", [itemOption("draw", "드로우"), itemOption("discard", "버리기"), itemOption("deck", "덱·손패")])]),
    group("status", "상태", [section("trait-status", "상태", [itemOption("status", "상태이상")])]),
    group("system", "시스템", [section("trait-system", "시스템", [itemOption("harmony", "HARMONY"), itemOption("impurity", "불순물"), itemOption("special", "특수")])]),
  ],
  relic: [
    group("basic", "기본 필터", [section("tier", "티어", ITEM_TIER_OPTIONS, "any")], true),
    group("combat", "전투", [section("relic-combat", "전투", [itemOption("attack", "공격"), itemOption("defense", "방어"), itemOption("heal", "회복"), itemOption("absorb", "흡수"), itemOption("status", "상태"), itemOption("harmony", "HARMONY")])]),
    group("resources", "카드 · 자원", [section("relic-resources", "자원", [itemOption("deck", "덱·손패"), itemOption("draw", "드로우"), itemOption("discard", "버리기"), itemOption("ap", "AP"), itemOption("oil", "오일")])]),
    group("journey", "여정", [section("relic-journey", "여정", [itemOption("economy", "경제"), itemOption("journey", "상점·보물·휴식")])]),
    group("special", "특수", [section("relic-special", "특수", [itemOption("impurity", "불순물"), itemOption("special", "부활·추가 턴")])]),
  ],
  curse: [
    group("basic", "기본 필터", [section("tier", "티어", ITEM_TIER_OPTIONS, "any")], true),
    group("impact", "영향 영역", [section("curse-impact", "영향", [itemOption("attack", "공격"), itemOption("defense", "방어"), itemOption("heal", "회복"), itemOption("health", "체력"), itemOption("absorb", "흡수"), itemOption("economy", "경제")])]),
    group("resources", "카드 · 자원", [section("curse-resources", "자원", [itemOption("deck", "덱·손패"), itemOption("draw", "드로우"), itemOption("discard", "버리기"), itemOption("ap", "AP"), itemOption("oil", "오일")])]),
    group("system", "상태 · 시스템", [section("curse-system", "시스템", [itemOption("status", "상태이상"), itemOption("harmony", "HARMONY"), itemOption("impurity", "불순물"), itemOption("special", "특수")])]),
  ],
};

function withAvailableOptions(groups, records, classify) {
  const tagged = records.map((record) => ({ record, tags: classify(record) }));
  return groups.map((definition) => ({
    ...definition,
    sections: definition.sections.map((entry) => ({
      ...entry,
      options: entry.options
        .map((entryOption) => ({ ...entryOption, count: tagged.filter(({ tags }) => tags.has(entryOption.id)).length }))
        .filter((entryOption) => entryOption.count > 0),
    })).filter((entry) => entry.options.length),
  })).filter((definition) => definition.sections.length);
}

export function buildCardFilterRegistry(cards, statusDefinitions, cardCategory, { omitRedundantTier = false } = {}) {
  const result = {};
  for (const category of Object.keys(cardDefinitions)) {
    const categoryCards = Object.values(cards).filter((card) => card.id !== "impurity" && cardCategory(card) === category);
    const statuses = Object.entries(statusDefinitions)
      .map(([id, definition]) => option(`status-${id}`, definition.name, definition.icon))
      .filter((entry) => categoryCards.some((card) => classifyCard(card, statusDefinitions).has(entry.id)));
    const definitions = statuses.length
      ? [...cardDefinitions[category], group("statuses", "상태이상", [section(`${category}-statuses`, "상태", statuses)])]
      : cardDefinitions[category];
    const available = withAvailableOptions(definitions, categoryCards, (card) => classifyCard(card, statusDefinitions));
    result[category] = omitRedundantTier
      ? available.map((entry) => ({
        ...entry,
        sections: entry.sections.filter((entrySection) => entrySection.id !== "tier" || entrySection.options.length > 1),
      })).filter((entry) => entry.sections.length)
      : available;
  }
  return result;
}

export function buildItemFilterRegistry(items) {
  const result = {};
  for (const [kind, definitions] of Object.entries(itemDefinitions)) {
    const categoryItems = Object.values(items).filter((item) => item.kind === kind);
    result[kind] = withAvailableOptions(definitions, categoryItems, classifyItem);
  }
  return result;
}

export function createFilterState(groups) {
  return {
    selected: Object.fromEntries(groups.flatMap((entry) => entry.sections.map((entrySection) => [entrySection.id, new Set()]))),
    expanded: new Set(groups.filter((entry) => entry.defaultOpen).map((entry) => entry.id)),
    panelOpen: false,
  };
}

export function matchesFilterState(tags, groups, state) {
  return groups.every((entry) => entry.sections.every((entrySection) => {
    const selected = state.selected[entrySection.id];
    if (!selected?.size) return true;
    return entrySection.selectionMode === "any"
      ? [...selected].some((tag) => tags.has(tag))
      : [...selected].every((tag) => tags.has(tag));
  }));
}

export function selectedCount(groupDefinition, state) {
  return groupDefinition.sections.reduce((total, entry) => total + (state.selected[entry.id]?.size || 0), 0);
}

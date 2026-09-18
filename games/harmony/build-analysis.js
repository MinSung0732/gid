import { CARDS, ITEMS } from "./data.js?v=20260918-1";
import { HIDDEN_SYNERGIES } from "./synergies.js?v=20260918-1";

export const BUILD_META = Object.freeze({
  contact: { label: "접촉 연계", icon: "⚔" },
  noncontact: { label: "비접촉", icon: "✦" },
  absorb: { label: "흡수", icon: "◆" },
  "absorb-burst": { label: "흡수 버스트", icon: "◆" },
  shield: { label: "방어막", icon: "⬡" },
  heal: { label: "회복", icon: "♥" },
  oil: { label: "오일", icon: "◈" },
  status: { label: "상태이상", icon: "▼" },
  harmony: { label: "하모니 순환", icon: "◇" },
});

const ITEM_EFFECT_SUPPORT = Object.freeze({
  contact: new Set([
    "contactIgnite",
    "contactBleed",
    "contactShield",
    "comboContact",
    "firstTurnContact",
    "retainedBonusDamage",
  ]),
  noncontact: new Set([
    "nonContactPoison",
    "firstNonContactBonus",
    "nonContactAbsorb",
    "nonContactWeak",
  ]),
  absorb: new Set([
    "absorbOnEnd",
    "absorbSpillShield",
    "nonContactAbsorb",
    "absorbCostHeal",
    "highAbsorbAttack",
    "absorbChainRefund",
    "absorbDecaySoftener",
    "absorbGainFlat1",
    "openingAbsorb",
  ]),
  shield: new Set([
    "shieldHit",
    "thornsOnGuard",
    "retainedShield",
    "thornsCorrode",
    "shieldRetainPercent",
    "openingShield",
    "oilShield",
    "regenShield",
  ]),
  heal: new Set([
    "overflow",
    "lowHpDefense",
    "regenShield",
    "absorbCostHeal",
    "battleEndHeal",
    "middleHeal",
    "oilHeal",
  ]),
  oil: new Set([
    "oilShield",
    "oilAttack",
    "oilAbsorbRatio",
    "reduceOilCost",
    "oilHeal",
  ]),
  status: new Set([
    "burningBonus",
    "corrosionTickDamage",
    "bleedLeech",
    "poisonSpread",
    "contactIgnite",
    "contactBleed",
    "nonContactPoison",
    "nonContactWeak",
  ]),
  harmony: new Set([
    "topShield",
    "middleHeal",
    "baseDamage",
    "harmonyBonus",
    "harmonyEchoDamage",
    "harmonyAoeTrueDamage",
    "harmonyDebuffStorm",
    "harmonyWeakAll",
    "harmonyReplayBothCards",
    "harmonyReplayCard",
  ]),
});

const SYNERGY_BUILD_SUPPORT = Object.freeze({
  novice_pestle: ["contact"],
  pressurized_airflow: ["noncontact", "status"],
  morning_chamomile: ["heal", "shield"],
  hardened_wax_seal: ["shield"],
  brass_scales_funnel: ["absorb"],
  grand_trinity: ["harmony"],
  diamond_bastion: ["shield"],
  supercritical_void: ["absorb", "absorb-burst", "status"],
  dew_petals: ["oil", "heal"],
  sealed_impact: ["shield", "contact"],
});

const STATUS_APPLICATION_FIELDS = [
  "applyEnemy",
  "applyEnemyAfterAttack",
  "onHitApplyEnemy",
  "conditionalEnemyIntent",
  "absorbThresholdApplyAllEnemy",
];
const STATUS_INTERACTION_FIELDS = [
  "chanceStatusOnHit",
  "bonusPerStatus",
  "consumeResonance",
  "burnProcCount",
  "applyEnemyIfPreAttackStatus",
  "ailmentBurstMultiplier",
  "globalAilmentBurstMultiplier",
  "amplifyAilments",
  "thornsApplyAttacker",
  "applyWeak",
  "weakOnHit",
  "stunOrDisarmBossTurns",
];
const ABSORB_INTERACTION_FIELDS = [
  "requiredAbsorb",
  "absorbCost",
  "absorbBonusRatio",
  "absorbFromDamage",
  "absorbAmplifyRatio",
  "absorbBooster",
  "preventAbsorbDecay",
  "refundAbsorbThreshold",
  "absorbStatusThreshold",
  "absorbThresholdApplyAllEnemy",
  "burstMultiplier",
];
const SHIELD_INTERACTION_FIELDS = [
  "shieldScaling",
  "weight",
  "shieldCounter",
  "shieldScalingAttack",
  "shieldSurvivalHeal",
  "thorns",
  "shieldDamageMultiplier",
  "shieldThreshold",
  "retainShield",
];
const HEAL_INTERACTION_FIELDS = [
  "missingHpHealRatio",
  "comboHealThreshold",
  "harmonyHealShield",
  "overhealShieldRatio",
  "shieldSurvivalHeal",
];
const CONTACT_INTERACTION_FIELDS = ["comboContactBonus", "battleContactBonus"];

function hasStructuredValue(value) {
  if (value == null || value === false || value === 0 || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object")
    return Object.values(value).some((entry) => hasStructuredValue(entry));
  return true;
}

function hasAnyField(definition, fields) {
  return fields.some((field) => hasStructuredValue(definition?.[field]));
}

function synergyProgresses(run) {
  const owned = new Set(Array.isArray(run?.inventory) ? run.inventory : []);
  return Object.values(HIDDEN_SYNERGIES).map((synergy) => {
    const ownedCount = synergy.requires.filter((id) => owned.has(id)).length,
      total = synergy.requires.length;
    return { ...synergy, ownedCount, total, active: total > 0 && ownedCount === total };
  });
}

function createCandidate(id) {
  return {
    id,
    label: BUILD_META[id].label,
    icon: BUILD_META[id].icon,
    score: 0,
    cardCount: 0,
    advancedCount: 0,
    itemCount: 0,
    synergyCount: 0,
    reasons: [],
    detail: "",
    qualified: false,
  };
}

function scoreCandidate(candidate) {
  candidate.score =
    candidate.cardCount +
    candidate.advancedCount * 2 +
    candidate.itemCount * 2 +
    candidate.synergyCount * 3;
  return candidate;
}

export function cardBuildIds(cardOrDefinition) {
  const definition = typeof cardOrDefinition === "string"
      ? CARDS[cardOrDefinition]
      : cardOrDefinition,
    ids = new Set();
  if (!definition) return ids;

  const attack = Boolean(definition.attack || definition.burst || definition.weight),
    pattern = definition.attackPattern || (attack ? "contact" : null),
    contactAdvanced = hasAnyField(definition, CONTACT_INTERACTION_FIELDS),
    absorbProducer = Number(definition.absorb || 0) > 0,
    absorbInteraction = hasAnyField(definition, ABSORB_INTERACTION_FIELDS),
    shieldProducer = Number(definition.shield || 0) > 0,
    shieldInteraction = hasAnyField(definition, SHIELD_INTERACTION_FIELDS),
    healProducer = Number(definition.heal || 0) > 0,
    healInteraction = hasAnyField(definition, HEAL_INTERACTION_FIELDS),
    oilCard = Boolean(definition.oil),
    statusApplication = hasAnyField(definition, STATUS_APPLICATION_FIELDS),
    statusInteraction = hasAnyField(definition, STATUS_INTERACTION_FIELDS),
    harmonyInteraction = Object.keys(definition).some(
      (key) => key.toLowerCase().includes("harmony") && hasStructuredValue(definition[key]),
    );

  if ((attack && pattern === "contact") || contactAdvanced) ids.add("contact");
  if (
    (attack && pattern === "nonContact") ||
    (pattern === "nonContact" && (statusApplication || statusInteraction || absorbInteraction))
  )
    ids.add("noncontact");
  if (absorbProducer || absorbInteraction) ids.add("absorb");
  if ((absorbProducer || absorbInteraction) && definition.burst) ids.add("absorb-burst");
  if (shieldProducer || shieldInteraction) ids.add("shield");
  if (healProducer || healInteraction) ids.add("heal");
  if (oilCard) ids.add("oil");
  if (statusApplication || statusInteraction) ids.add("status");
  if (harmonyInteraction) ids.add("harmony");
  return ids;
}

export function analyzeBuild(run, { resolveCard = null } = {}) {
  const candidates = Object.fromEntries(
      Object.keys(BUILD_META).map((id) => [id, createCandidate(id)]),
    ),
    notes = { top: 0, middle: 0, base: 0 },
    synergyProgress = synergyProgresses(run),
    active = synergyProgress.filter((synergy) => synergy.active),
    deck = Array.isArray(run?.deck) ? run.deck : [],
    inventory = Array.isArray(run?.inventory) ? run.inventory : [];

  let absorbCards = 0,
    absorbConsumers = 0,
    burstCards = 0;

  for (const held of deck) {
    let definition = null;
    if (typeof resolveCard === "function") {
      try {
        definition = resolveCard(held);
      } catch {}
    }
    definition ||= CARDS[held?.id];
    if (!definition) continue;

    const note = held.note || definition.note;
    if (Object.hasOwn(notes, note)) notes[note] += 1;

    const attack = Boolean(definition.attack || definition.burst || definition.weight),
      pattern = definition.attackPattern || (attack ? "contact" : null),
      contactAdvanced = hasAnyField(definition, CONTACT_INTERACTION_FIELDS),
      absorbProducer = Number(definition.absorb || 0) > 0,
      absorbInteraction = hasAnyField(definition, ABSORB_INTERACTION_FIELDS),
      shieldProducer = Number(definition.shield || 0) > 0,
      shieldInteraction = hasAnyField(definition, SHIELD_INTERACTION_FIELDS),
      healProducer = Number(definition.heal || 0) > 0,
      healInteraction = hasAnyField(definition, HEAL_INTERACTION_FIELDS),
      oilCard = Boolean(definition.oil),
      statusApplication = hasAnyField(definition, STATUS_APPLICATION_FIELDS),
      statusInteraction = hasAnyField(definition, STATUS_INTERACTION_FIELDS),
      harmonyInteraction = Object.keys(definition).some(
        (key) => key.toLowerCase().includes("harmony") && hasStructuredValue(definition[key]),
      );

    if (attack && pattern === "contact") candidates.contact.cardCount += 1;
    if (contactAdvanced) candidates.contact.advancedCount += 1;

    if (attack && pattern === "nonContact") candidates.noncontact.cardCount += 1;
    if (
      pattern === "nonContact" &&
      (statusApplication || statusInteraction || absorbInteraction)
    )
      candidates.noncontact.advancedCount += 1;

    if (absorbProducer) {
      absorbCards += 1;
      candidates.absorb.cardCount += 1;
      candidates["absorb-burst"].cardCount += 1;
    }
    if (absorbInteraction) {
      absorbConsumers += 1;
      candidates.absorb.advancedCount += 1;
      candidates["absorb-burst"].advancedCount += 1;
    }
    if (definition.burst) burstCards += 1;

    if (shieldProducer) candidates.shield.cardCount += 1;
    if (shieldInteraction) candidates.shield.advancedCount += 1;

    if (healProducer) candidates.heal.cardCount += 1;
    if (healInteraction) candidates.heal.advancedCount += 1;

    if (oilCard) candidates.oil.cardCount += 1;

    if (statusApplication) candidates.status.cardCount += 1;
    if (statusInteraction) candidates.status.advancedCount += 1;

    if (harmonyInteraction) candidates.harmony.advancedCount += 1;
  }

  for (const id of inventory) {
    const effect = ITEMS[id]?.effect;
    if (!effect) continue;
    for (const [buildId, effects] of Object.entries(ITEM_EFFECT_SUPPORT))
      if (effects.has(effect)) candidates[buildId].itemCount += 1;
  }

  for (const synergy of active) {
    for (const buildId of SYNERGY_BUILD_SUPPORT[synergy.id] || [])
      candidates[buildId].synergyCount += 1;
  }

  for (const candidate of Object.values(candidates)) scoreCandidate(candidate);

  const support = (candidate) =>
    candidate.advancedCount + candidate.itemCount + candidate.synergyCount;

  candidates.contact.qualified =
    candidates.contact.cardCount >= 3 && support(candidates.contact) >= 2;
  candidates.noncontact.qualified =
    candidates.noncontact.cardCount >= 4 && support(candidates.noncontact) >= 1;
  candidates.absorb.qualified =
    absorbCards >= 2 && support(candidates.absorb) >= 1;
  candidates["absorb-burst"].qualified =
    absorbCards >= 2 && burstCards >= 1 && absorbConsumers >= 1;
  candidates.shield.qualified =
    candidates.shield.cardCount >= 2 && support(candidates.shield) >= 2;
  candidates.heal.qualified =
    candidates.heal.cardCount >= 2 && support(candidates.heal) >= 1;
  candidates.oil.qualified =
    candidates.oil.cardCount >= 2 &&
    candidates.oil.itemCount + candidates.oil.synergyCount >= 1;
  candidates.status.qualified =
    candidates.status.cardCount >= 2 && support(candidates.status) >= 1;

  const noteValues = Object.values(notes),
    noteMin = Math.min(...noteValues),
    noteMax = Math.max(...noteValues),
    harmonySupport = support(candidates.harmony);
  candidates.harmony.cardCount = noteValues.reduce((sum, value) => sum + value, 0);
  candidates.harmony.score =
    Math.max(0, noteMin * 2 - (noteMax - noteMin)) +
    candidates.harmony.advancedCount * 2 +
    candidates.harmony.itemCount * 2 +
    candidates.harmony.synergyCount * 3;
  candidates.harmony.qualified =
    noteMin >= 2 && noteMax - noteMin <= 2 && harmonySupport >= 1;

  if (candidates["absorb-burst"].qualified) candidates.absorb.qualified = false;

  const details = {
    contact: `접촉 ${candidates.contact.cardCount} · 연계 ${candidates.contact.advancedCount}`,
    noncontact: `비접촉 ${candidates.noncontact.cardCount} · 연계 ${candidates.noncontact.advancedCount}`,
    absorb: `흡수 ${absorbCards} · 연계 ${candidates.absorb.advancedCount}`,
    "absorb-burst": `흡수 ${absorbCards} · Burst ${burstCards}`,
    shield: `방어막 ${candidates.shield.cardCount} · 활용 ${candidates.shield.advancedCount}`,
    heal: `회복 ${candidates.heal.cardCount} · 연계 ${candidates.heal.advancedCount}`,
    oil: `오일 ${candidates.oil.cardCount} · 지원 ${candidates.oil.itemCount + candidates.oil.synergyCount}`,
    status: `상태 ${candidates.status.cardCount} · 연계 ${candidates.status.advancedCount}`,
    harmony: `TOP ${notes.top} · MID ${notes.middle} · BASE ${notes.base}`,
  };

  for (const candidate of Object.values(candidates)) {
    candidate.detail = details[candidate.id];
    if (candidate.cardCount)
      candidate.reasons.push(
        candidate.id === "harmony"
          ? details.harmony
          : `관련 카드 ${candidate.cardCount}장`,
      );
    if (candidate.advancedCount)
      candidate.reasons.push(`구조화 연계 ${candidate.advancedCount}개`);
    if (candidate.itemCount)
      candidate.reasons.push(`관련 특성·유물 ${candidate.itemCount}개`);
    if (candidate.synergyCount)
      candidate.reasons.push(`관련 활성 시너지 ${candidate.synergyCount}개`);
    if (candidate.id === "absorb-burst" && burstCards)
      candidate.reasons.splice(1, 0, `Burst 카드 ${burstCards}장`);
  }

  const qualified = Object.values(candidates)
      .filter((candidate) => candidate.qualified)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.synergyCount - a.synergyCount ||
          b.advancedCount - a.advancedCount,
      ),
    primary = qualified[0] || null,
    secondaryCandidate = qualified[1] || null,
    secondary =
      primary &&
      secondaryCandidate &&
      secondaryCandidate.score >= Math.max(5, Math.floor(primary.score * 0.7))
        ? secondaryCandidate
        : null,
    mixed = Boolean(primary && secondary && Math.abs(primary.score - secondary.score) <= 1);

  return {
    mode: !primary ? "forming" : mixed ? "mixed" : "defined",
    primary,
    secondary,
    candidates,
    notes,
    activeSynergies: active,
    synergyProgress,
  };
}

export function cardAffinityWeight(
  run,
  cardOrDefinition,
  {
    primaryWeight = 1.5,
    secondaryWeight = 1.2,
  } = {},
) {
  const profile = analyzeBuild(run);
  if (!profile.primary) return 1;
  const ids = cardBuildIds(cardOrDefinition);
  if (ids.has(profile.primary.id)) return primaryWeight;
  if (profile.secondary && ids.has(profile.secondary.id)) return secondaryWeight;
  return 1;
}

const AILMENT_STATUS_IDS = Object.freeze([
  "burning",
  "poison",
  "bleed",
  "corrosion",
]);

const STATUS_MAP_FIELDS = Object.freeze([
  "applyEnemy",
  "applyPlayer",
  "applyEnemyAfterAttack",
  "onHitApplyEnemy",
  "absorbThresholdApplyAllEnemy",
  "thresholdApplyAllEnemy",
  "thornsApplyAttacker",
]);

const STAGED_REFUND_STATUS_IDS = Object.freeze({
  ailmentTypes2: AILMENT_STATUS_IDS,
  ailmentTypes3: AILMENT_STATUS_IDS,
  regenerationBefore: ["regeneration"],
  targetBleed4Before: ["bleed"],
});

function hasValue(value) {
  if (Array.isArray(value)) return value.some((entry) => hasValue(entry));
  if (value && typeof value === "object")
    return Object.keys(value).length > 0;
  return Boolean(value);
}

function addStatus(tags, id) {
  if (typeof id === "string" && id) tags.add(`status:${id}`);
}

function addStatusMap(tags, map) {
  for (const id of Object.keys(map || {})) addStatus(tags, id);
}

function addAilments(tags) {
  AILMENT_STATUS_IDS.forEach((id) => addStatus(tags, id));
}

export function deriveCardMechanics(card = {}) {
  const tags = new Set();

  for (const field of STATUS_MAP_FIELDS) addStatusMap(tags, card[field]);

  for (const statuses of Object.values(card.conditionalEnemyIntent || {}))
    addStatusMap(tags, statuses);

  for (const id of Object.keys(card.bonusPerStatus || {})) addStatus(tags, id);

  if (card.chanceStatusOnHit?.id) addStatus(tags, card.chanceStatusOnHit.id);
  if (card.applyWeak || card.weakOnHit) addStatus(tags, "weak");
  if (card.thorns) addStatus(tags, "thorns");
  if (card.stunOrDisarmBossTurns) {
    addStatus(tags, "stun");
    addStatus(tags, "disarm");
  }

  if (card.applyEnemyIfPreAttackStatus) {
    addStatus(tags, card.applyEnemyIfPreAttackStatus.statusId);
    addStatusMap(tags, card.applyEnemyIfPreAttackStatus.apply);
  }

  if (card.consumeResonance) addStatus(tags, "resonance");
  if (card.burnProcCount) addStatus(tags, "burning");
  if (card.discardAttackBurn || card.discardedRandomBurn)
    addStatus(tags, "burning");

  if (
    card.ailmentBurstMultiplier ||
    card.globalAilmentBurstMultiplier ||
    card.amplifyAilments ||
    card.cleanseAilmentStacks
  )
    addAilments(tags);

  if (card.extendDecayStatuses) {
    addStatus(tags, "poison");
    addStatus(tags, "corrosion");
  }

  // Burst cards share the runtime rule: consuming 40+ absorb stuns living targets.
  if (card.burst) addStatus(tags, "stun");

  // The staged active-card registry encodes status conditions in stagedRefund.
  for (const id of STAGED_REFUND_STATUS_IDS[card.stagedRefund] || [])
    addStatus(tags, id);

  // Staged resonance cards use dedicated gameplay fields. Any such field means
  // the card reads, consumes, preserves, transfers, or applies resonance.
  if (
    Object.entries(card).some(
      ([key, value]) => key.startsWith("resonance") && hasValue(value),
    )
  )
    addStatus(tags, "resonance");

  if (card.target === "all") {
    tags.add("target:all");
    tags.add("area");
  } else if (card.randomEachHit || card.target === "random") {
    tags.add("target:ricochet");
    tags.add("ricochet");
  } else if (card.target !== "self") {
    tags.add("target:single");
  }

  if ((card.hits || 1) > 1 || card.randomEachHit) tags.add("multiHit");
  if (card.bypassShield || card.thresholdBypassShield)
    tags.add("shieldPierce");
  if (card.turnDamageBonus) tags.add("turnScaling");
  if (card.shieldScaling || card.shieldScalingAttack || card.shieldCounter)
    tags.add("shieldScaling");
  if (card.oil) tags.add("oil");
  if (card.draw || card.drawOnBreak || card.drawOnKill || card.searchDrawCard)
    tags.add("draw");
  if (card.discard || card.randomDiscard) tags.add("discard");
  if (card.heal) tags.add("heal");
  if (card.cleanse || card.cleanseAilmentStacks) tags.add("cleanse");
  if (card.purgeImpurity) tags.add("impurity");

  return tags;
}

export function cardStatusMechanicIds(card = {}) {
  return [...deriveCardMechanics(card)]
    .filter((tag) => tag.startsWith("status:"))
    .map((tag) => tag.slice("status:".length));
}

export { AILMENT_STATUS_IDS };

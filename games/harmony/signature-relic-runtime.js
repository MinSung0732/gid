import * as S from "./statuses.js";

const IDS = Object.freeze({
  primordialPipette: "relic_primordial_pipette",
  essenceHeart: "relic_essence_heart",
  harmonyOrb: "relic_harmony_orb",
});

function owns(state, id) {
  return Boolean(state?.inventory?.includes(id));
}

function passivesEnabled(state) {
  return !S.restricted(state, "passives");
}

function active(state, id) {
  return owns(state, id) && passivesEnabled(state);
}

function relic(items, id) {
  return items?.[id] || {};
}

function absorbCap(Core, state) {
  return Math.min(150, 100 + Core.power(state, "maxAbsorbCapBonus"));
}

function gainAbsorb(Core, state, amount) {
  const battle = state?.battle;
  if (!battle || amount <= 0) return 0;
  const before = Number(battle.absorb) || 0;
  battle.absorb = Math.min(
    absorbCap(Core, state),
    Math.max(-50, before + Math.max(0, Math.round(amount))),
  );
  const gained = Math.max(0, battle.absorb - before);
  if (gained > 0)
    state._absorbFeedback = (Number(state._absorbFeedback) || 0) + gained;
  return gained;
}

function healingFeedback(state) {
  return Math.max(0, Number(state?._healingFeedback) || 0);
}

function ensureEssenceTurn(battle) {
  if (!battle) return;
  if (battle._essenceHeartTurn === battle.turn) return;
  battle._essenceHeartTurn = battle.turn;
  battle._essenceHeartAbsorbGained = 0;
}

export function applyEssenceHeartHealing(Core, items, state, healingBefore = 0) {
  const battle = state?.battle;
  if (!battle || !active(state, IDS.essenceHeart)) return 0;
  const restored = Math.max(0, healingFeedback(state) - Math.max(0, Number(healingBefore) || 0));
  if (restored <= 0) return 0;
  ensureEssenceTurn(battle);
  const item = relic(items, IDS.essenceHeart),
    ratio = Number.isFinite(item.healToAbsorbRatio) ? item.healToAbsorbRatio : 0.5,
    turnCap = Math.max(0, Number.isFinite(item.healToAbsorbTurnCap) ? item.healToAbsorbTurnCap : 10),
    already = Math.max(0, Number(battle._essenceHeartAbsorbGained) || 0),
    remaining = Math.max(0, turnCap - already),
    requested = Math.min(remaining, Math.max(0, Math.round(restored * ratio))),
    gained = gainAbsorb(Core, state, requested);
  battle._essenceHeartAbsorbGained = already + gained;
  return gained;
}

function noteOf(card, definition) {
  return card?.note || definition?.note || "none";
}

function harmonyWouldComplete(Core, state, card) {
  const battle = state?.battle;
  if (!battle || !card || S.sealBlocksNoteGain(state) || S.sealBlocksHarmony(state)) return false;
  const definition = Core.cardDefinition(card),
    notes = [...(battle.notes || []), { ...card, note: noteOf(card, definition) }].slice(-3);
  if (notes.length !== 3) return false;
  if (Core.power(state, "anyThreeCardsHarmony")) return true;
  return notes.map((played) => played.note).join(",") === "top,middle,base";
}

function harmonyBoostDelta(Core, items, state, card) {
  if (!active(state, IDS.harmonyOrb) || !harmonyWouldComplete(Core, state, card)) return 0;
  const item = relic(items, IDS.harmonyOrb),
    ratio = Number.isFinite(item.harmonyEffectBonusRatio) ? item.harmonyEffectBonusRatio : 0.5,
    base = Core.resolveHarmonyEffect(state, card)?.amount || 0,
    boosted = Math.max(0, Math.round(base * (1 + ratio)));
  return Math.max(0, boosted - base);
}

function withTemporaryHarmonyBonus(state, amount, callback) {
  if (!amount) return callback();
  state.eventPowers ??= {};
  const before = Number(state.eventPowers.harmonyBonus) || 0;
  state.eventPowers.harmonyBonus = before + amount;
  try {
    return callback();
  } finally {
    if (before) state.eventPowers.harmonyBonus = before;
    else delete state.eventPowers.harmonyBonus;
  }
}

export function harmonyOrbDiscountReady(state) {
  return Boolean(
    state?.battle?._harmonyOrbDiscountReady &&
      active(state, IDS.harmonyOrb),
  );
}

function discountAmount(items) {
  const item = relic(items, IDS.harmonyOrb);
  return Math.max(0, Math.floor(Number(item.nextCardApDiscount) || 1));
}

function withTemporaryCardDiscount(card, amount, callback) {
  if (!card || card.id === "impurity" || amount <= 0) return callback();
  const before = Number(card.costReduction) || 0;
  card.costReduction = before + amount;
  try {
    return callback();
  } finally {
    if (before) card.costReduction = before;
    else delete card.costReduction;
  }
}

export function signatureCost(Core, items, state, card) {
  const base = Core.cost(state, card);
  if (!harmonyOrbDiscountReady(state) || card?.id === "impurity") return base;
  return Math.max(0, base - discountAmount(items));
}

export function signatureCardPlayBlockReason(Core, items, state, card) {
  if (!harmonyOrbDiscountReady(state) || card?.id === "impurity")
    return Core.cardPlayBlockReason(state, card);
  return withTemporaryCardDiscount(card, discountAmount(items), () =>
    Core.cardPlayBlockReason(state, card),
  );
}

export function signatureCanPlay(Core, items, state, card) {
  return signatureCardPlayBlockReason(Core, items, state, card) === null;
}

function expectedAbsorbSpend(Core, state, card) {
  const battle = state?.battle;
  if (!battle || !card) return 0;
  const definition = Core.cardDefinition(card);
  let available = Math.max(0, Number(battle.absorb) || 0),
    spent = 0;
  const required = Core.requiredAbsorbForCard(state, card);
  if (required) {
    if (available < required) return 0;
    available -= required;
    spent += required;
  }
  const fueledCost = Math.max(0, Number(definition.absorbCost) || 0);
  if (fueledCost && available >= fueledCost) {
    available -= fueledCost;
    spent += fueledCost;
  }
  if (definition.burst) spent += available;
  return spent;
}

function refundPrimordialPipette(Core, items, state, spent) {
  if (spent <= 0 || !active(state, IDS.primordialPipette)) return 0;
  const item = relic(items, IDS.primordialPipette),
    ratio = Number.isFinite(item.absorbRefundRatio) ? item.absorbRefundRatio : 0.3,
    cap = Math.max(0, Number.isFinite(item.absorbRefundCap) ? item.absorbRefundCap : 10),
    amount = Math.min(cap, Math.max(0, Math.round(spent * ratio)));
  return gainAbsorb(Core, state, amount);
}

function combineCoreWithSignatureHooks(Core, items, signatureState) {
  return {
    ...Core,
    play(state, index, meta, hooks = null) {
      const card = state?.battle?.hand?.[index],
        spent = expectedAbsorbSpend(Core, state, card);
      return Core.play(state, index, meta, {
        beforeEffect(context) {
          return hooks?.beforeEffect?.(context) ?? null;
        },
        afterEffect(context) {
          hooks?.afterEffect?.(context);
          if (!signatureState.confusionTriggered)
            refundPrimordialPipette(Core, items, state, spent);
        },
        cleanupEffect(context) {
          hooks?.cleanupEffect?.(context);
        },
      });
    },
  };
}

export function playWithSignatureRelics({
  Core,
  items,
  state,
  index,
  meta,
  playBase,
}) {
  const battle = state?.battle,
    card = battle?.hand?.[index];
  if (!battle || !card) return playBase(Core, state, index, meta);

  const discountReadyBefore = harmonyOrbDiscountReady(state),
    discount = discountReadyBefore ? discountAmount(items) : 0,
    harmoniesBefore = Number(battle.harmoniesThisTurn) || 0,
    healingBefore = healingFeedback(state),
    controlBefore = state._controlFeedback,
    harmonyBonus = harmonyBoostDelta(Core, items, state, card),
    signatureState = { confusionTriggered: false },
    CoreWithHooks = combineCoreWithSignatureHooks(Core, items, signatureState),
    run = () => withTemporaryCardDiscount(card, discount, () =>
      playBase(CoreWithHooks, state, index, meta),
    );

  const result = withTemporaryHarmonyBonus(state, harmonyBonus, run);
  const controlChanged = state._controlFeedback !== controlBefore;
  signatureState.confusionTriggered = controlChanged && state._controlFeedback?.statusId === "confusion";

  if (!result) return result;
  if (discountReadyBefore) battle._harmonyOrbDiscountReady = false;
  applyEssenceHeartHealing(Core, items, state, healingBefore);
  if (
    active(state, IDS.harmonyOrb) &&
    (Number(battle.harmoniesThisTurn) || 0) > harmoniesBefore
  )
    battle._harmonyOrbDiscountReady = true;
  return result;
}

export function withEssenceHeartHealing(Core, items, state, callback) {
  const before = healingFeedback(state),
    result = callback();
  applyEssenceHeartHealing(Core, items, state, before);
  return result;
}

export function signaturePotion(Core, items, state) {
  return withEssenceHeartHealing(Core, items, state, () => Core.potion(state));
}

export function signatureRelicIds() {
  return { ...IDS };
}

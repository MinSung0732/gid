import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { CARDS, ITEMS } from "../games/harmony/data.js";
import { NEW_AUGMENT_IDS } from "../games/harmony/augment-pack-20260918.js";
import { HIDDEN_SYNERGIES } from "../games/harmony/synergies.js";
import {
  augmentCardCost,
  consumeAugmentCardCostState,
  effectiveAttackPattern,
  isEffectiveImpurity,
  onAugmentActualDiscard,
  onAugmentCardUsed,
  onAugmentCardUseStart,
  onAugmentDrawSuccess,
  onAugmentFailedDraw,
  onAugmentReshuffle,
  onAugmentTurnStart,
  pendingAugmentRecoveryCards,
  recoverAugmentDiscard,
  resetAugmentTurnState,
} from "../games/harmony/augment-event-runtime.js";

const triggered = new Set();
const nonTriggered = new Set();
const markTrigger = (...ids) => ids.forEach((id) => triggered.add(id));
const markNonTrigger = (...ids) => ids.forEach((id) => nonTriggered.add(id));

function mockState(inventory = [], {
  hand = [],
  discard = [],
  enemies = 2,
  turn = 2,
} = {}) {
  return {
    inventory: [...inventory],
    battle: {
      turn,
      ap: 3,
      shield: 0,
      absorb: 0,
      hand: hand.map((card) => typeof card === "string" ? { id: card, level: 0 } : card),
      draw: [],
      discard: discard.map((card) => typeof card === "string" ? { id: card, level: 0 } : card),
      exhaust: [],
      enemies: Array.from({ length: enemies }, (_, index) => ({
        name: `Mock Enemy ${index + 1}`,
        hp: 100,
        maxHp: 100,
        shield: 0,
        statuses: {},
        intent: { type: "attack", value: 1 },
      })),
    },
  };
}

function mockApi(randoms = []) {
  const records = {
    shield: [],
    absorb: [],
    ap: [],
    damage: [],
    statuses: [],
    draws: [],
    logs: [],
  };
  let randomIndex = 0;
  const api = {
    random() {
      const value = randoms[randomIndex] ?? 0.99;
      randomIndex++;
      return value;
    },
    livingEnemies(battle) {
      return (battle?.enemies || []).filter((enemy) => enemy.hp > 0);
    },
    gainShield(state, amount) {
      const value = Math.max(0, Math.floor(Number(amount) || 0));
      state.battle.shield += value;
      records.shield.push(value);
      return value;
    },
    gainAbsorb(state, amount) {
      const value = Math.max(0, Math.floor(Number(amount) || 0));
      state.battle.absorb += value;
      records.absorb.push(value);
      return value;
    },
    gainAp(state, amount) {
      const value = Math.max(0, Math.floor(Number(amount) || 0));
      state.battle.ap += value;
      records.ap.push(value);
      return value;
    },
    attackPower() {
      return 2;
    },
    dealEnemyDamage(state, enemy, amount, options = {}) {
      const dealt = Math.max(0, Math.floor(Number(amount) || 0));
      enemy.hp = Math.max(0, enemy.hp - dealt);
      records.damage.push({ enemy, amount: dealt, options });
      return { damage: dealt, blocked: 0 };
    },
    applyEnemyStatus(state, enemy, id, amount) {
      const value = Math.max(0, Math.floor(Number(amount) || 0));
      enemy.statuses[id] ??= { stacks: 0 };
      enemy.statuses[id].stacks += value;
      records.statuses.push({ enemy, id, amount: value });
      return value;
    },
    drawCards(state, amount, turnStart = false) {
      records.draws.push({ amount, turnStart });
      return amount;
    },
    log(state, message) {
      records.logs.push(message);
    },
  };
  return { api, records };
}

function actualDiscard(state, card, {
  sourceEffect = null,
  randoms = [],
} = {}) {
  state.battle.discard.push(card);
  const { api, records } = mockApi(randoms);
  onAugmentActualDiscard(
    state,
    card,
    E.cardDefinition(card),
    sourceEffect,
    CARDS,
    ITEMS,
    api,
  );
  return records;
}

function useCardEvent(state, card, randoms = []) {
  const { api, records } = mockApi(randoms);
  onAugmentCardUsed(state, card, CARDS, ITEMS, api);
  return records;
}

function makeRun(handIds, {
  enemyCount = 1,
  seed = 7101,
  levels = [],
} = {}) {
  const meta = E.freshMeta();
  const seedDeck = Array.from(
    { length: 10 },
    (_, index) => handIds[index % handIds.length],
  );
  const state = E.newRun(seed, seedDeck, meta);
  state.route = Array(12).fill("combat");
  state.route[11] = "boss";
  state.resolvedRooms[0] = "battle";
  E.enter(state, meta);
  assert.equal(state.phase, "battle");
  const template = structuredClone(state.battle.enemies[0]);
  state.battle.enemies = Array.from({ length: enemyCount }, (_, index) => ({
    ...structuredClone(template),
    name: `QA Enemy ${index + 1}`,
    hp: 200,
    maxHp: 200,
    shield: 0,
    statuses: S.createStatuses(),
    intent: { type: "attack", value: 1 },
  }));
  E.attachEnemyAliases(state.battle);
  state.battle.selectedTarget = 0;
  state.battle.ap = 8;
  state.battle.hand = handIds.map((id, index) => ({
    id,
    level: levels[index] || 0,
  }));
  state.battle.draw = Array.from(
    { length: 12 },
    () => ({ id: "guard_resonance_cover", level: 0 }),
  );
  state.battle.discard = [];
  state.battle.exhaust = [];
  state.battle.pendingDiscard = 0;
  state.battle.discardEffects = [];
  state.battle.cardsPlayedThisTurn = 0;
  state.battle.nonContactCardsPlayedThisTurn = 0;
  state.battle.contactCardsPlayedThisTurn = 0;
  state.battle.harmoniesThisTurn = 0;
  state.battle.notes = [];
  state._enemyHitFeedback = [];
  state._damageFeedback = [];
  state._statusProcFeedback = [];
  return { state, meta };
}

const enemy = (state, index = 0) => state.battle.enemies[index];

// 1. Unstable Perpetual Engine: one turn-start roll, final AP0, no trigger otherwise.
{
  const id = "relic_turn_zero_ap_chance";
  const state = mockState([id], { hand: ["noncontact_ignitable_waste_blotter"] });
  let pair = mockApi([0.119]);
  onAugmentTurnStart(state, ITEMS, pair.api);
  assert.equal(state.battle._augmentAllCardsFreeTurn, state.battle.turn);
  assert.equal(augmentCardCost(state, state.battle.hand[0], 3), 0);
  assert.match(pair.records.logs[0], /모든 액티브 카드/);
  markTrigger(id);

  const off = mockState([id], { hand: ["noncontact_ignitable_waste_blotter"] });
  pair = mockApi([0.12]);
  onAugmentTurnStart(off, ITEMS, pair.api);
  assert.equal(off.battle._augmentAllCardsFreeTurn, undefined);
  assert.equal(augmentCardCost(off, off.battle.hand[0], 3), 3);
  markNonTrigger(id);
}

// 3-9, 12, 27, 33. Draw event family.
{
  const id = "relic_automatic_fragrance_sprayer";
  let state = mockState([id]);
  let pair = mockApi([0]);
  onAugmentDrawSuccess(state, { id: "guard_resonance_cover", level: 0 }, "turnStart", CARDS, ITEMS, pair.api);
  assert.equal(pair.records.damage.length, 1);
  assert.equal(pair.records.damage[0].amount, 3);
  assert.equal(pair.records.damage[0].options.attackPattern, "nonContact");
  assert.equal(pair.records.damage[0].options.fx.source, "relic");
  markTrigger(id);

  state = mockState([id]);
  pair = mockApi([0]);
  onAugmentDrawSuccess(state, { id: "guard_resonance_cover", level: 0 }, "opening", CARDS, ITEMS, pair.api);
  assert.equal(pair.records.damage.length, 0);
  markNonTrigger(id);
}
{
  const id = "trait_hygroscopic_scent_strip";
  let state = mockState([id, id]);
  let pair = mockApi();
  onAugmentDrawSuccess(state, { id: "guard_resonance_cover", level: 0 }, "extra", CARDS, ITEMS, pair.api);
  assert.equal(state.battle.shield, 8);
  markTrigger(id);

  state = mockState([id, id]);
  pair = mockApi();
  onAugmentDrawSuccess(state, { id: "guard_resonance_cover", level: 0 }, "turnStart", CARDS, ITEMS, pair.api);
  assert.equal(state.battle.shield, 0);
  markNonTrigger(id);
}
{
  const id = "trait_scentline_recovery_tube";
  let state = mockState([id, id]);
  let pair = mockApi();
  for (let i = 0; i < 3; i++)
    onAugmentDrawSuccess(state, { id: "guard_resonance_cover", level: 0 }, "extra", CARDS, ITEMS, pair.api);
  assert.equal(state.battle.absorb, 8);
  markTrigger(id);

  state = mockState([id, id]);
  pair = mockApi();
  for (let i = 0; i < 2; i++)
    onAugmentDrawSuccess(state, { id: "guard_resonance_cover", level: 0 }, "extra", CARDS, ITEMS, pair.api);
  assert.equal(state.battle.absorb, 0);
  markNonTrigger(id);
}
{
  const id = "trait_resonance_index";
  let state = mockState([id, id]);
  let pair = mockApi([0, 0, 0, 0]);
  for (let i = 0; i < 4; i++)
    onAugmentDrawSuccess(state, { id: "guard_resonance_cover", level: 0 }, "extra", CARDS, ITEMS, pair.api);
  const resonanceEvents = pair.records.statuses.filter((event) => event.id === "resonance");
  assert.equal(resonanceEvents.length, 3);
  assert.ok(resonanceEvents.every((event) => event.amount === 2));
  markTrigger(id);

  state = mockState([id, id]);
  pair = mockApi([0]);
  onAugmentDrawSuccess(state, { id: "guard_resonance_cover", level: 0 }, "opening", CARDS, ITEMS, pair.api);
  assert.equal(pair.records.statuses.length, 0);
  markNonTrigger(id);
}
{
  const id = "trait_chain_scenting_catalyst";
  let state = mockState([id, id]);
  let pair = mockApi();
  for (let i = 0; i < 3; i++)
    onAugmentDrawSuccess(state, { id: "guard_resonance_cover", level: 0 }, "extra", CARDS, ITEMS, pair.api);
  assert.equal(state.battle._augmentNextCardDiscount, 2);
  assert.equal(augmentCardCost(state, { id: "guard_resonance_cover" }, 3), 1);
  markTrigger(id);

  state = mockState([id, id]);
  pair = mockApi();
  for (let i = 0; i < 2; i++)
    onAugmentDrawSuccess(state, { id: "guard_resonance_cover", level: 0 }, "extra", CARDS, ITEMS, pair.api);
  assert.equal(state.battle._augmentNextCardDiscount, 0);
  markNonTrigger(id);
}
{
  const id = "relic_overflow_fragrance_recovery_tube";
  let state = mockState([id]);
  let pair = mockApi();
  for (let i = 0; i < 4; i++)
    onAugmentFailedDraw(state, "handLimit", ITEMS, pair.api);
  assert.equal(state.battle.absorb, 9, "failed-draw absorb must cap at +9 per turn");
  markTrigger(id);

  state = mockState([id]);
  pair = mockApi();
  onAugmentFailedDraw(state, "emptyDeck", ITEMS, pair.api);
  assert.equal(state.battle.absorb, 0);
  markNonTrigger(id);
}
{
  const id = "relic_fractional_cost_reducer";
  let state = mockState([id]);
  let pair = mockApi();
  const cards = [
    { id: "guard_resonance_cover", level: 0 },
    { id: "guard_resonance_cover", level: 0 },
    { id: "guard_resonance_cover", level: 0 },
  ];
  for (const card of cards)
    onAugmentDrawSuccess(state, card, "extra", CARDS, ITEMS, pair.api);
  assert.equal(cards[0]._augmentTempCostReduction, 1);
  assert.equal(cards[1]._augmentTempCostReduction, 1);
  assert.equal(cards[2]._augmentTempCostReduction, undefined);
  assert.equal(augmentCardCost(state, cards[0], 2), 1);
  consumeAugmentCardCostState(state, cards[0]);
  assert.equal(cards[0]._augmentTempCostReduction, undefined);
  markTrigger(id);

  state = mockState([id]);
  pair = mockApi();
  const opening = { id: "guard_resonance_cover", level: 0 };
  onAugmentDrawSuccess(state, opening, "turnStart", CARDS, ITEMS, pair.api);
  assert.equal(opening._augmentTempCostReduction, undefined);
  markNonTrigger(id);
}
{
  const id = "relic_cloudy_filter_clip";
  let state = mockState([id]);
  let pair = mockApi();
  onAugmentDrawSuccess(state, { id: "impurity", level: 0 }, "turnStart", CARDS, ITEMS, pair.api);
  assert.equal(state.battle.shield, 3);
  markTrigger(id);

  state = mockState([id]);
  pair = mockApi();
  onAugmentDrawSuccess(state, { id: "impurity", level: 0 }, "opening", CARDS, ITEMS, pair.api);
  assert.equal(state.battle.shield, 0);
  markNonTrigger(id);
}
{
  const id = "relic_backflow_filter_distiller";
  let state = mockState([id]);
  let pair = mockApi([0.1]);
  onAugmentDrawSuccess(state, { id: "impurity", level: 0 }, "turnStart", CARDS, ITEMS, pair.api);
  assert.deepEqual(pair.records.ap, [1]);
  markTrigger(id);

  state = mockState([id]);
  pair = mockApi([0.1]);
  onAugmentDrawSuccess(state, { id: "impurity", level: 0 }, "opening", CARDS, ITEMS, pair.api);
  assert.deepEqual(pair.records.ap, []);
  markNonTrigger(id);
}

// 6 and 34. Card-use start.
{
  const id = "relic_saturated_scent_clip";
  let state = mockState([id], { hand: Array(5).fill("guard_resonance_cover") });
  let pair = mockApi();
  onAugmentCardUseStart(state, { id: "guard_resonance_cover", level: 0 }, CARDS, ITEMS, pair.api, { handCountBefore: 6 });
  assert.equal(state.battle.shield, 3);
  markTrigger(id);

  state = mockState([id], { hand: Array(4).fill("guard_resonance_cover") });
  pair = mockApi();
  onAugmentCardUseStart(state, { id: "guard_resonance_cover", level: 0 }, CARDS, ITEMS, pair.api, { handCountBefore: 5 });
  assert.equal(state.battle.shield, 0);
  markNonTrigger(id);
}
{
  const id = "relic_sediment_concentrator";
  let state = mockState(
    [id, "relic_contaminated_perfumery_essence"],
    { hand: ["guard_resonance_cover", "guard_resonance_cover"] },
  );
  let pair = mockApi();
  let result = onAugmentCardUseStart(
    state,
    { id: "noncontact_broken_scent_sample", level: 0 },
    CARDS,
    ITEMS,
    pair.api,
    { handCountBefore: 3 },
  );
  assert.equal(result.resourceMultiplier, 1.25);
  markTrigger(id);

  state = mockState([id], { hand: ["guard_resonance_cover", "guard_resonance_cover"] });
  pair = mockApi();
  result = onAugmentCardUseStart(
    state,
    { id: "noncontact_broken_scent_sample", level: 0 },
    CARDS,
    ITEMS,
    pair.api,
    { handCountBefore: 3 },
  );
  assert.equal(result.resourceMultiplier, 1);
  markNonTrigger(id);
}

// 10, 13, 26, 28, 30, 32, 35, 36. Card-used event family.
{
  const id = "trait_high_speed_perfumery_loop";
  let state = mockState([id]);
  let records;
  for (let i = 0; i < 6; i++) records = useCardEvent(state, { id: "guard_resonance_cover", level: 0 });
  assert.deepEqual(records.draws, [{ amount: 2, turnStart: false }]);
  markTrigger(id);

  state = mockState([id]);
  for (let i = 0; i < 5; i++) records = useCardEvent(state, { id: "guard_resonance_cover", level: 0 });
  assert.deepEqual(records.draws, []);
  markNonTrigger(id);
}
{
  const id = "trait_hypercycle_fragrance_engine";
  let state = mockState([id]);
  let records;
  for (let i = 0; i < 8; i++) records = useCardEvent(state, { id: "guard_resonance_cover", level: 0 });
  assert.deepEqual(records.ap, [2]);
  assert.deepEqual(records.draws, [{ amount: 2, turnStart: false }]);
  markTrigger(id);

  state = mockState([id]);
  for (let i = 0; i < 7; i++) records = useCardEvent(state, { id: "guard_resonance_cover", level: 0 });
  assert.deepEqual(records.ap, []);
  markNonTrigger(id);
}
{
  const id = "trait_sediment_reaction_membrane";
  let state = mockState([id, id, id]);
  let records = useCardEvent(state, { id: "impurity", level: 0 });
  assert.deepEqual(records.absorb, [6]);
  markTrigger(id);

  state = mockState([id, id, id]);
  records = useCardEvent(state, { id: "guard_resonance_cover", level: 0 });
  assert.deepEqual(records.absorb, []);
  markNonTrigger(id);
}
{
  const id = "relic_impurity_reaction_roulette";
  let state = mockState([id]);
  let records = useCardEvent(state, { id: "impurity", level: 0 }, [0, 0]);
  assert.equal(records.damage.length, 1);
  assert.equal(records.damage[0].amount, 4);
  assert.equal(records.damage[0].options.fx.source, "relic");
  assert.equal(records.damage[0].options.fx.impurityRandomEffect, true);
  markTrigger(id);

  state = mockState([id]);
  records = useCardEvent(state, { id: "guard_resonance_cover", level: 0 }, [0, 0]);
  assert.equal(records.damage.length, 0);
  assert.equal(records.shield.length, 0);
  assert.equal(records.absorb.length, 0);
  assert.equal(records.statuses.length, 0);
  markNonTrigger(id);
}
{
  const id = "trait_contamination_catalyst_tube";
  let state = mockState([id, id]);
  let records = useCardEvent(state, { id: "impurity", level: 0 }, [0]);
  const corrosion = records.statuses.filter((event) => event.id === "corrosion");
  assert.equal(corrosion.length, 1);
  assert.equal(corrosion[0].amount, 2);
  markTrigger(id);

  state = mockState([id, id]);
  records = useCardEvent(state, { id: "guard_resonance_cover", level: 0 }, [0]);
  assert.equal(records.statuses.length, 0);
  markNonTrigger(id);
}
{
  const id = "trait_contamination_critical_reaction";
  let state = mockState([id]);
  let records;
  for (let i = 0; i < 3; i++) records = useCardEvent(state, { id: "impurity", level: 0 });
  const poison = records.statuses.filter((event) => event.id === "poison");
  assert.equal(poison.length, state.battle.enemies.length);
  assert.ok(poison.every((event) => event.amount === 2));
  markTrigger(id);

  state = mockState([id]);
  for (let i = 0; i < 2; i++) records = useCardEvent(state, { id: "impurity", level: 0 });
  assert.equal(records.statuses.length, 0);
  markNonTrigger(id);
}
{
  const roulette = "relic_impurity_reaction_roulette";
  const id = "relic_turbid_distillation_core";
  let state = mockState([roulette, id]);
  let pair = mockApi([0, 0, 0.21]);
  onAugmentCardUsed(state, { id: "impurity", level: 0 }, CARDS, ITEMS, pair.api);
  const randomEffects =
    pair.records.damage.length +
    pair.records.shield.length +
    pair.records.absorb.length +
    pair.records.statuses.length;
  assert.equal(randomEffects, 2, "Turbid Core must add exactly one independent roulette effect");
  assert.equal(pair.records.damage[0].options.fx.parentSource, null);
  markTrigger(id);

  state = mockState([id]);
  pair = mockApi([0, 0]);
  onAugmentCardUsed(state, { id: "impurity", level: 0 }, CARDS, ITEMS, pair.api);
  assert.equal(
    pair.records.damage.length +
      pair.records.shield.length +
      pair.records.absorb.length +
      pair.records.statuses.length,
    0,
  );
  markNonTrigger(id);
}
{
  const id = "trait_complete_contamination_adaptation";
  let state = mockState([id]);
  let records;
  for (let i = 0; i < 5; i++) records = useCardEvent(state, { id: "impurity", level: 0 });
  assert.deepEqual(records.ap, [2]);
  assert.deepEqual(records.draws, [{ amount: 2, turnStart: false }]);
  markTrigger(id);

  state = mockState([id]);
  for (let i = 0; i < 4; i++) records = useCardEvent(state, { id: "impurity", level: 0 });
  assert.deepEqual(records.ap, []);
  markNonTrigger(id);
}

// 11 and 22. Actual reshuffle family.
{
  const id = "trait_recirculation_distillation_plate";
  let state = mockState([id]);
  let pair = mockApi();
  onAugmentReshuffle(state, ITEMS, pair.api);
  assert.deepEqual(pair.records.ap, [1]);
  assert.deepEqual(pair.records.shield, [6]);
  markTrigger(id);

  state = mockState([id]);
  state.battle._augmentReshufflesThisCombat = 2;
  pair = mockApi();
  onAugmentReshuffle(state, ITEMS, pair.api);
  assert.deepEqual(pair.records.ap, []);
  assert.deepEqual(pair.records.shield, []);
  markNonTrigger(id);
}
{
  const id = "relic_waste_fragrance_separation_funnel";
  let state = mockState([id]);
  let pair = mockApi();
  onAugmentReshuffle(state, ITEMS, pair.api);
  assert.deepEqual(pair.records.shield, [8]);
  assert.deepEqual(pair.records.draws, [{ amount: 1, turnStart: false }]);
  markTrigger(id);

  state = mockState([id]);
  state.battle._augmentReshufflesThisCombat = 2;
  pair = mockApi();
  onAugmentReshuffle(state, ITEMS, pair.api);
  assert.deepEqual(pair.records.shield, []);
  assert.deepEqual(pair.records.draws, []);
  markNonTrigger(id);
}

// 18-23, 25, 31. Actual discard family.
{
  const id = "trait_selective_disposal_valve";
  let state = mockState([id]);
  actualDiscard(state, { id: "guard_resonance_cover", level: 0 });
  assert.equal(state.battle._augmentNextCardDiscount, 0);
  actualDiscard(state, { id: "guard_resonance_cover", level: 0 });
  assert.equal(state.battle._augmentNextCardDiscount, 1);
  markTrigger(id);

  state = mockState([id]);
  actualDiscard(state, { id: "guard_resonance_cover", level: 0 });
  assert.equal(state.battle._augmentNextCardDiscount, 0);
  markNonTrigger(id);
}
{
  const id = "trait_high_concentration_disposal_sorter";
  let state = mockState([id, id]);
  let records = actualDiscard(state, { id: "contact_bloodflow_rhythm_pierce", level: 0 });
  assert.deepEqual(records.absorb, [6]);
  markTrigger(id);

  state = mockState([id, id]);
  records = actualDiscard(state, { id: "guard_resonance_cover", level: 0 });
  assert.deepEqual(records.absorb, []);
  markNonTrigger(id);
}
{
  const id = "trait_waste_fragrance_chain_reaction";
  let state = mockState([id]);
  let records;
  for (let i = 0; i < 3; i++)
    records = actualDiscard(state, { id: "guard_resonance_cover", level: 0 });
  const burns = records.statuses.filter((event) => event.id === "burning");
  assert.equal(burns.length, state.battle.enemies.length);
  assert.ok(burns.every((event) => event.amount === 3));
  markTrigger(id);

  state = mockState([id]);
  for (let i = 0; i < 2; i++)
    records = actualDiscard(state, { id: "guard_resonance_cover", level: 0 });
  assert.equal(records.statuses.length, 0);
  markNonTrigger(id);
}
{
  const id = "trait_high_pressure_decomposition_catalyst";
  let state = mockState([id]);
  let records = actualDiscard(state, { id: "contact_bloodflow_rhythm_pierce", level: 0 });
  assert.deepEqual(records.draws, [{ amount: 2, turnStart: false }]);
  markTrigger(id);

  state = mockState([id]);
  records = actualDiscard(state, { id: "guard_resonance_cover", level: 0 });
  assert.deepEqual(records.draws, []);
  markNonTrigger(id);
}
{
  const id = "relic_lossless_redistiller";
  let state = mockState([id]);
  for (const card of [
    { id: "guard_resonance_cover", level: 0 },
    { id: "contact_bloodflow_rhythm_pierce", level: 0 },
    { id: "noncontact_broken_scent_sample", level: 0 },
  ])
    actualDiscard(state, card);
  const candidates = pendingAugmentRecoveryCards(state);
  assert.equal(candidates.length, 3);
  const selected = candidates[1];
  const recovered = recoverAugmentDiscard(state, selected._augmentInstanceId);
  assert.equal(recovered, selected);
  assert.ok(state.battle.hand.includes(selected));
  assert.equal(augmentCardCost(state, selected, 3), 0);
  assert.equal(state.battle.pendingAugmentRecovery, null);
  markTrigger(id);

  state = mockState([id]);
  actualDiscard(state, { id: "guard_resonance_cover", level: 0 });
  actualDiscard(state, { id: "guard_resonance_cover", level: 0 });
  assert.equal(state.battle.pendingAugmentRecovery, undefined);
  markNonTrigger(id);
}
{
  const id = "trait_altered_scent_strip";
  let state = mockState([id, id, id, "relic_contaminated_perfumery_essence"]);
  let records = actualDiscard(state, { id: "guard_resonance_cover", level: 0 });
  assert.deepEqual(records.shield, [6]);
  markTrigger(id);

  state = mockState([id, id, id]);
  records = actualDiscard(state, { id: "guard_resonance_cover", level: 0 });
  assert.deepEqual(records.shield, []);
  markNonTrigger(id);
}
{
  const id = "trait_turbid_waste_reclaimer";
  let state = mockState([id, id, "relic_contaminated_perfumery_essence"]);
  let records = actualDiscard(
    state,
    { id: "guard_resonance_cover", level: 0 },
    { randoms: [0] },
  );
  assert.deepEqual(records.draws, [{ amount: 1, turnStart: false }]);
  markTrigger(id);

  state = mockState([id, id]);
  records = actualDiscard(
    state,
    { id: "guard_resonance_cover", level: 0 },
    { randoms: [0] },
  );
  assert.deepEqual(records.draws, []);
  markNonTrigger(id);
}

// 24 and 29. Classification-only augments.
{
  const id = "relic_phase_crossing_lens";
  const state = { inventory: [id] };
  assert.equal(
    effectiveAttackPattern(state, CARDS.contact_glass_dropper_strike, "cardDirectAttack"),
    "nonContact",
  );
  assert.equal(
    effectiveAttackPattern(state, CARDS.noncontact_broken_scent_sample, "cardDirectAttack"),
    "contact",
  );
  markTrigger(id);
  assert.equal(
    effectiveAttackPattern(state, CARDS.contact_glass_dropper_strike, "relicDamage"),
    "contact",
  );
  markNonTrigger(id);
}
{
  const id = "relic_contaminated_perfumery_essence";
  const normal = { id: "guard_resonance_cover", level: 0 };
  assert.equal(isEffectiveImpurity({ inventory: [id] }, normal, CARDS), true);
  markTrigger(id);
  assert.equal(isEffectiveImpurity({ inventory: [] }, normal, CARDS), false);
  assert.equal(normal.id, "guard_resonance_cover", "effective impurity must not mutate physical identity");
  markNonTrigger(id);
}

// 14-17. New cards through the actual engine discard/play path.
{
  const id = "noncontact_broken_scent_sample";
  let { state, meta } = makeRun([id]);
  state.battle.pendingDiscard = 1;
  state.battle.discardEffects = [{}];
  assert.equal(E.discardFromHand(state, 0, meta), true);
  assert.equal(state.battle.shield, 5);
  markTrigger(id);

  ({ state, meta } = makeRun([id]));
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(state.battle.shield, 0, "normal use must not count as actual discard");
  markNonTrigger(id);
}
{
  const id = "absorb_volatile_residue";
  let { state, meta } = makeRun([id]);
  state.battle.pendingDiscard = 1;
  state.battle.discardEffects = [{}];
  state.battle.draw = [{ id: "guard_resonance_cover", level: 0 }];
  assert.equal(E.discardFromHand(state, 0, meta), true);
  assert.equal(state.battle.hand.length, 1, "actual discard must draw one card");
  markTrigger(id);

  ({ state, meta } = makeRun([id]));
  state.battle.draw = [];
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(state.battle.absorb, 2);
  assert.equal(state.battle.hand.length, 0, "normal use must not trigger discard draw");
  markNonTrigger(id);
}
{
  const id = "noncontact_ignitable_waste_blotter";
  let { state, meta } = makeRun([id]);
  state.battle.pendingDiscard = 1;
  state.battle.discardEffects = [{}];
  assert.equal(E.discardFromHand(state, 0, meta), true);
  assert.equal(S.stacks(enemy(state), "burning"), 3);
  markTrigger(id);

  ({ state, meta } = makeRun([id]));
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(S.stacks(enemy(state), "burning"), 0, "normal use must not trigger discarded burn");
  markNonTrigger(id);
}
{
  const id = "cycle_redistillation_recovery_fluid";
  let { state, meta } = makeRun(
    [id, "contact_bloodflow_rhythm_pierce"],
    { levels: [2, 0] },
  );
  state.battle.draw = [
    { id: "guard_resonance_cover", level: 0 },
    { id: "guard_resonance_cover", level: 0 },
  ];
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(state.battle.pendingDiscard, 1);
  const highCostIndex = state.battle.hand.findIndex(
    (card) => card.id === "contact_bloodflow_rhythm_pierce",
  );
  assert.ok(highCostIndex >= 0);
  assert.equal(E.discardFromHand(state, highCostIndex, meta), true);
  assert.equal(state.battle.shield, 6);
  assert.equal(state.battle.absorb, 2);
  markTrigger(id);

  ({ state, meta } = makeRun(
    [id, "guard_resonance_cover"],
    { levels: [2, 0] },
  ));
  state.battle.draw = [
    { id: "guard_resonance_cover", level: 0 },
    { id: "guard_resonance_cover", level: 0 },
  ];
  assert.equal(E.play(state, 0, meta), true);
  const lowCostIndex = state.battle.hand.findIndex(
    (card) => card.id === "guard_resonance_cover",
  );
  assert.ok(lowCostIndex >= 0);
  assert.equal(E.discardFromHand(state, lowCostIndex, meta), true);
  assert.equal(state.battle.shield, 0);
  assert.equal(state.battle.absorb, 0);
  markNonTrigger(id);
}

// 2. Spectral Striker: modifier once -> 1xN logical hits, each status proc real,
// fixed target stops on death, non-card direct damage excluded.
{
  const id = "relic_spectral_striker";
  let { state, meta } = makeRun(["noncontact_broken_scent_sample"]);
  state.inventory.push(id);
  S.applyStatus(enemy(state), "burning", 3);
  const hpBefore = enemy(state).hp;
  assert.equal(E.play(state, 0, meta), true);
  const directHits = (state._enemyHitFeedback || []).filter(
    (hit) => !hit.statusId && hit.attackPattern === "nonContact",
  );
  assert.equal(directHits.length, 1, "Spectral presentation should aggregate one original hit");
  assert.equal(directHits[0].fx?.hitCount, 3);
  assert.equal(directHits[0].fx?.multiHit, true);
  assert.equal(S.stacks(enemy(state), "burning"), 0, "each logical hit must proc one burning stack");
  assert.equal(hpBefore - enemy(state).hp, 6, "3 direct + 3 burning proc damage");
  markTrigger(id);

  ({ state } = makeRun(["noncontact_broken_scent_sample"]));
  state.inventory.push(id);
  state._enemyHitFeedback = [];
  E.dealEnemyDamage(state, enemy(state), 4, {
    direct: true,
    attackPattern: "nonContact",
    fx: { source: "relic", sourceId: "qa" },
  });
  const relicHits = state._enemyHitFeedback.filter((hit) => !hit.statusId);
  assert.equal(relicHits.length, 1);
  assert.notEqual(relicHits[0].fx?.spectral, true, "non-card damage must not split");
  markNonTrigger(id);
}
{
  const id = "relic_spectral_striker";
  const multi = Object.values(CARDS).find(
    (card) => card.id !== "impurity" && card.attack && (card.hits || 1) >= 2 && !card.randomEachHit,
  );
  assert.ok(multi, "need a fixed-target multihit card for Spectral regression");
  const { state, meta } = makeRun([multi.id]);
  state.inventory.push(id);
  enemy(state).hp = 2;
  enemy(state).maxHp = 2;
  state._enemyHitFeedback = [];
  E.play(state, 0, meta);
  const directHits = state._enemyHitFeedback.filter((hit) => !hit.statusId);
  assert.equal(enemy(state).hp, 0);
  assert.equal(directHits.length, 1, "fixed target death must stop remaining original hits");
  assert.equal(state.battle.cardsPlayedThisTurn, 1, "logical hits must not multiply card-use count");
}

// Spectral modifier-once coverage: attack modifier, burning-target modifier,
 // natural multi-hit, randomEachHit and Phase Lens + discardCostDamage.
{
  const id = "relic_spectral_striker";
  let { state, meta } = makeRun(["noncontact_broken_scent_sample"]);
  state.inventory.push(id);
  state.eventPowers = { attack: 2 };
  E.play(state, 0, meta);
  let hit = state._enemyHitFeedback.find((event) => !event.statusId);
  assert.equal(hit.fx?.hitCount, 5, "attack modifier must be calculated once before Spectral split");
  assert.equal(hit.damage + hit.blocked, 5);

  ({ state, meta } = makeRun(["noncontact_broken_scent_sample"]));
  state.inventory.push(id, ...HIDDEN_SYNERGIES.pressurized_airflow.requires);
  S.applyStatus(enemy(state), "burning", 3);
  E.play(state, 0, meta);
  hit = state._enemyHitFeedback.find((event) => !event.statusId);
  assert.equal(hit.fx?.hitCount, 4, "burning-target +25% direct modifier must apply before Spectral split");
  assert.equal(hit.damage + hit.blocked, 4);
}
{
  const id = "relic_spectral_striker",
    multi = Object.values(CARDS).find(
      (card) =>
        card.id !== "impurity" &&
        card.attack &&
        (card.hits || 1) >= 2 &&
        !card.randomEachHit &&
        card.target !== "all",
    );
  assert.ok(multi, "need natural fixed-target multi-hit card");
  const { state, meta } = makeRun([multi.id]);
  state.inventory.push(id);
  E.play(state, 0, meta);
  const hits = state._enemyHitFeedback.filter(
    (event) => !event.statusId && event.fx?.spectral,
  );
  assert.equal(hits.length, multi.hits || 1, "each natural original hit must produce one aggregated Spectral presentation");
  assert.ok(hits.every((event) => event.fx?.hitCount >= 1));
  assert.equal(state.battle.cardsPlayedThisTurn, 1);
}
{
  const id = "relic_spectral_striker";
  const { state, meta } = makeRun(
    ["noncontact_perpetual_storm"],
    { enemyCount: 3, seed: 7117 },
  );
  state.inventory.push(id);
  E.play(state, 0, meta);
  const hits = state._enemyHitFeedback.filter(
    (event) => !event.statusId && event.fx?.spectral,
  );
  assert.equal(hits.length, 8, "randomEachHit must preserve eight original hit events");
  assert.ok(
    hits.every(
      (event) =>
        Number.isInteger(event.targetIndex) &&
        event.fx?.hitCount >= 1,
    ),
    "each original random hit chooses one target and keeps it for its logical split",
  );
  assert.equal(state.battle.cardsPlayedThisTurn, 1);
}
{
  const spectral = "relic_spectral_striker",
    lens = "relic_phase_crossing_lens";
  let { state, meta } = makeRun(["noncontact_broken_scent_sample"]);
  state.inventory.push(spectral, lens);
  E.play(state, 0, meta);
  let hit = state._enemyHitFeedback.find((event) => !event.statusId);
  assert.equal(hit.attackPattern, "contact");
  assert.equal(hit.fx?.hitCount, 3);
  assert.equal(state.battle.contactCardsPlayedThisTurn, 1);

  ({ state, meta } = makeRun([
    "noncontact_diffusing_mist",
    "contact_bloodflow_rhythm_pierce",
    "guard_resonance_cover",
  ]));
  state.inventory.push(
    spectral,
    lens,
    "relic_sediment_concentrator",
    "relic_contaminated_perfumery_essence",
  );
  E.play(state, 0, meta);
  assert.equal(state.battle.pendingDiscard, 1);
  const feedbackBeforeDiscard = state._enemyHitFeedback.length,
    discardIndex = state.battle.hand.findIndex(
      (card) => card.id === "contact_bloodflow_rhythm_pierce",
    );
  assert.ok(discardIndex >= 0);
  E.discardFromHand(state, discardIndex, meta);
  const discardHit = state._enemyHitFeedback
    .slice(feedbackBeforeDiscard)
    .find((event) => !event.statusId);
  assert.ok(discardHit, "discardCostDamage must emit card-direct hit feedback");
  assert.equal(discardHit.attackPattern, "contact", "Phase Lens must invert discardCostDamage from its source card");
  assert.equal(discardHit.fx?.spectral, true);
  assert.equal(
    discardHit.fx?.hitCount,
    10,
    "base AP2 × costDamage4 = 8, then Sediment final ×1.25 = 10 before Spectral split",
  );
}
{
  const id = "relic_spectral_striker";
  const { state } = makeRun(["noncontact_broken_scent_sample"]);
  state.inventory.push(id);
  state._enemyHitFeedback = [];
  E.dealEnemyDamage(state, enemy(state), 5, {
    direct: false,
    bypassShield: true,
    statusId: "poison",
  });
  const dot = state._enemyHitFeedback.find((event) => event.statusId === "poison");
  assert.ok(dot);
  assert.notEqual(dot.fx?.spectral, true, "DOT/status damage must never be Spectral-split");
}

// Phase Lens actual engine path: counters and hit feedback follow effective pattern.
{
  const id = "relic_phase_crossing_lens";
  let { state, meta } = makeRun(["noncontact_broken_scent_sample"]);
  state.inventory.push(id);
  E.play(state, 0, meta);
  const direct = state._enemyHitFeedback.find((hit) => !hit.statusId);
  assert.equal(direct.attackPattern, "contact");
  assert.equal(state.battle.contactCardsPlayedThisTurn, 1);
  assert.equal(state.battle.nonContactCardsPlayedThisTurn, 0);

  ({ state, meta } = makeRun(["noncontact_broken_scent_sample"]));
  E.play(state, 0, meta);
  const normal = state._enemyHitFeedback.find((hit) => !hit.statusId);
  assert.equal(normal.attackPattern, "nonContact");
  assert.equal(state.battle.contactCardsPlayedThisTurn, 0);
  assert.equal(state.battle.nonContactCardsPlayedThisTurn, 1);
}

// 34. Sediment Concentrator through actual engine final-value math.
{
  const id = "relic_sediment_concentrator";
  const essence = "relic_contaminated_perfumery_essence";
  let { state, meta } = makeRun(
    [
      "noncontact_broken_scent_sample",
      "guard_resonance_cover",
      "guard_resonance_cover",
    ],
  );
  state.inventory.push(id, essence);
  state.eventPowers = { attack: 2 };
  const hpBefore = enemy(state).hp;
  E.play(state, 0, meta);
  assert.equal(hpBefore - enemy(state).hp, 6, "final direct damage 5 × 1.25 must floor to 6");

  ({ state, meta } = makeRun(
    [
      "absorb_volatile_residue",
      "guard_resonance_cover",
      "guard_resonance_cover",
    ],
    { levels: [2, 0, 0] },
  ));
  state.inventory.push(id, essence);
  E.play(state, 0, meta);
  assert.equal(state.battle.absorb, 5, "final absorb 4 × 1.25 must floor to 5");

  const guardId = "guard_resonance_cover";
  let baseline = makeRun([guardId, guardId, guardId]);
  baseline.state.inventory.push(essence);
  E.play(baseline.state, 0, baseline.meta);
  const baseShield = baseline.state.battle.shield;
  let boosted = makeRun([guardId, guardId, guardId]);
  boosted.state.inventory.push(id, essence);
  E.play(boosted.state, 0, boosted.meta);
  assert.equal(
    boosted.state.battle.shield,
    Math.floor(baseShield * 1.25),
    "shield multiplier must apply after existing shield modifiers",
  );
}

// AP pipeline: upgraded AP, instance discount, recovered AP0, turn-wide AP0,
// actual paid-AP refund cannot refund a zero-paid card.
{
  const upgraded = { id: "noncontact_ignitable_waste_blotter", level: 2 };
  let { state, meta } = makeRun([upgraded.id], { levels: [2] });
  assert.equal(E.cost(state, state.battle.hand[0]), 0, "upgrade AP reduction must reach final cost");
  state.eventPowers = { chanceFullApRefund: 1 };
  const before = state.battle.ap;
  E.play(state, 0, meta);
  assert.equal(state.battle.ap, before, "0-paid card must not create AP through refund");

  ({ state } = makeRun(["contact_bloodflow_rhythm_pierce"]));
  const instance = state.battle.hand[0];
  instance._augmentTempCostReduction = 1;
  instance._augmentTempCostTurn = state.battle.turn;
  const discounted = E.cost(state, instance);
  assert.equal(discounted, Math.max(0, E.cardDefinition(instance).cost - 1));

  instance._augmentFreeTurn = state.battle.turn;
  assert.equal(E.cost(state, instance), 0);
  delete instance._augmentFreeTurn;
  state.battle._augmentAllCardsFreeTurn = state.battle.turn;
  assert.equal(E.cost(state, instance), 0);
}

// Turn reset removes temporary instance modifiers and per-turn flags, but keeps
// combat reshuffle count.
{
  const state = mockState([], {
    hand: [{ id: "guard_resonance_cover", level: 0, _augmentTempCostReduction: 1, _augmentTempCostTurn: 2 }],
    discard: [{ id: "guard_resonance_cover", level: 0, _augmentFreeTurn: 2 }],
  });
  state.battle._augmentReshufflesThisCombat = 1;
  state.battle.pendingAugmentRecovery = { turn: 2, instanceIds: [1] };
  resetAugmentTurnState(state);
  assert.equal(state.battle.hand[0]._augmentTempCostReduction, undefined);
  assert.equal(state.battle.discard[0]._augmentFreeTurn, undefined);
  assert.equal(state.battle.pendingAugmentRecovery, null);
  assert.equal(state.battle._augmentReshufflesThisCombat, 1);
}

// Recursive combinations terminate: roulette+core is exactly two outcomes,
// recovered cards do not re-arm third-discard recovery in the same turn,
// draw-event counters cap their own triggers.
{
  const roulette = "relic_impurity_reaction_roulette";
  const core = "relic_turbid_distillation_core";
  const state = mockState([roulette, core]);
  const pair = mockApi([0, 0, 0, 0]);
  onAugmentCardUsed(state, { id: "impurity", level: 0 }, CARDS, ITEMS, pair.api);
  assert.equal(pair.records.damage.length, 2);

  const losslessState = mockState(["relic_lossless_redistiller"]);
  for (const id of ["guard_resonance_cover", "contact_bloodflow_rhythm_pierce", "noncontact_broken_scent_sample"])
    actualDiscard(losslessState, { id, level: 0 });
  const choice = pendingAugmentRecoveryCards(losslessState)[0];
  recoverAugmentDiscard(losslessState, choice._augmentInstanceId);
  losslessState.battle.hand.splice(losslessState.battle.hand.indexOf(choice), 1);
  actualDiscard(losslessState, choice);
  assert.equal(losslessState.battle.pendingAugmentRecovery, null, "re-discard must not re-arm lossless recovery");
}

for (const id of NEW_AUGMENT_IDS) {
  assert.ok(triggered.has(id), `missing positive trigger coverage: ${id}`);
  assert.ok(nonTriggered.has(id), `missing non-trigger coverage: ${id}`);
}

console.log("PASS Harmony augment runtime: all 36 IDs have trigger/non-trigger coverage; draw/discard/AP/impurity/Phase Lens/Spectral/Sediment/recursion contracts verified.");

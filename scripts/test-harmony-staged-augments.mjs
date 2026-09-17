import assert from "node:assert/strict";
import * as S from "../games/harmony/statuses.js";

const data = await import("../games/harmony/data.js");
const staged = await import("../games/harmony/staged-augments.js");
const originalCardIds = new Set(Object.keys(data.CARDS));
const originalItemIds = new Set(Object.keys(data.ITEMS));
const stagedCardIds = Object.keys(staged.STAGED_AUGMENT_CARDS);
const stagedItemIds = Object.keys(staged.STAGED_AUGMENT_ITEMS);

assert.equal(stagedCardIds.length, 16);
assert.equal(stagedItemIds.length, 6);
assert.equal(new Set([...stagedCardIds, ...stagedItemIds]).size, 22, "all staged IDs must be unique");
assert.deepEqual(stagedCardIds.filter((id) => originalCardIds.has(id)), [], "staged card IDs must not collide with main");
assert.deepEqual(stagedItemIds.filter((id) => originalItemIds.has(id)), [], "staged item IDs must not collide with main");

const E = await import("../games/harmony/engine.js");
const { CARDS, ITEMS } = data;
const maxCopiesByTier = { 1: 4, 2: 3, 3: 2, 4: 1 };

for (const id of stagedCardIds) {
  const card = CARDS[id];
  assert.ok(card, `missing staged card: ${id}`);
  assert.equal(card.id, id, `staged card id mismatch: ${id}`);
  assert.ok(card.tier >= 1 && card.tier <= 4, `invalid tier: ${id}`);
  assert.equal(card.maxCopies, maxCopiesByTier[card.tier], `new-card copy cap mismatch: ${id}`);
  assert.equal(E.cardMaxCopies(id), maxCopiesByTier[card.tier], `engine copy cap mismatch: ${id}`);
}
for (const id of stagedItemIds) {
  const item = ITEMS[id];
  assert.ok(item, `missing staged item: ${id}`);
  assert.equal(item.id, id, `staged item id mismatch: ${id}`);
  assert.ok(["trait", "relic"].includes(item.kind), `invalid staged item kind: ${id}`);
}

function makeRun(handIds, { enemyCount = 1, seed = 113 } = {}) {
  const meta = E.freshMeta();
  const deck = Array.from({ length: 10 }, (_, index) => handIds[index % handIds.length]);
  const state = E.newRun(seed, deck, meta);
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
    intent: { type: "attack", amount: 1 },
  }));
  E.attachEnemyAliases(state.battle);
  state.battle.selectedTarget = 0;
  state.battle.ap = 8;
  state.battle.hand = handIds.map((id) => ({ id, level: 0 }));
  state.battle.draw = Array.from({ length: 12 }, () => ({ id: "guard_resonance_cover", level: 0 }));
  state.battle.discard = [];
  state.battle.exhaust = [];
  state.battle.pendingDiscard = 0;
  state.battle.cardsPlayedThisTurn = 0;
  state.battle.nonContactCardsPlayedThisTurn = 0;
  state.battle.contactCardsPlayedThisTurn = 0;
  state.battle.harmoniesThisTurn = 0;
  state.battle.notes = [];
  state._enemyHitFeedback = [];
  delete state._controlFeedback;
  return { state, meta };
}
const enemy = (state, index = 0) => state.battle.enemies[index];
const add = (entity, id, amount) => S.applyStatus(entity, id, amount);

// Actual paid AP + pre-play state refund contracts.
{
  const { state, meta } = makeRun(["contact_scentline_rewind", "contact_scentline_rewind"]);
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(state.battle.ap, 7);
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(state.battle.ap, 7, "second paid contact should refund from pre-play paid-contact state");
}
{
  const { state, meta } = makeRun(["contact_scentline_rewind", "contact_scentline_rewind"]);
  state.battle.hand[0].costReduction = 99;
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(state.battle.ap, 7, "zero-paid contact must not arm paid-contact refund");
}
{
  const { state, meta } = makeRun(["noncontact_compound_vapor_recovery"]);
  add(enemy(state), "burning", 1);
  add(enemy(state), "poison", 1);
  E.play(state, 0, meta);
  assert.equal(state.battle.ap, 8, "two ailment types should be read before the attack resolves");
}
{
  const { state, meta } = makeRun(["guard_wax_recoil_coating"]);
  state.battle.shield = 12;
  E.play(state, 0, meta);
  assert.equal(state.battle.ap, 8, "shield refund must use pre-play shield");
}
{
  const { state, meta } = makeRun(["heal_regenerative_inhalation"]);
  state.hp = 60;
  add(state, "regeneration", 1);
  E.play(state, 0, meta);
  assert.equal(state.battle.ap, 8, "regeneration refund must use pre-play stacks");
}
{
  const ids = ["noncontact_supersaturated_tray_spray", ...Array(5).fill("guard_resonance_cover")];
  const { state, meta } = makeRun(ids);
  E.play(state, 0, meta);
  assert.equal(state.battle.ap, 8, "hand-size refund must include the current card in pre-play hand");
}
{
  const { state, meta } = makeRun(["contact_bloodflow_rhythm_pierce"]);
  add(enemy(state), "bleed", 4);
  E.play(state, 0, meta);
  assert.equal(state.battle.ap, 7, "bleed threshold must be captured before multi-hit bleed consumption");
}
{
  const { state, meta } = makeRun(["noncontact_compound_toxic_reignition"]);
  add(enemy(state), "burning", 1);
  add(enemy(state), "poison", 1);
  add(enemy(state), "corrosion", 1);
  E.play(state, 0, meta);
  assert.equal(state.battle.ap, 8, "three ailment types should refund 2 AP");
}
{
  const { state, meta } = makeRun(["guard_triad_note_stopper"]);
  state.battle.notes = [
    { id: "qa-top", level: 0, note: "top" },
    { id: "qa-mid", level: 0, note: "middle" },
  ];
  E.play(state, 0, meta);
  assert.equal(state.battle.harmoniesThisTurn, 1);
  assert.equal(state.battle.ap, 8, "refund should detect HARMONY completed by this card");
}

// Discard refund uses definition base AP, not current reduced AP.
{
  const { state, meta } = makeRun(["guard_discard_solvent_recovery", "contact_bloodflow_rhythm_pierce"]);
  state.battle.hand[1].costReduction = 99;
  E.play(state, 0, meta);
  assert.equal(state.battle.pendingDiscard, 1);
  E.discardFromHand(state, 0, meta);
  assert.equal(state.battle.ap, 8, "discarded base-cost 2 card should refund even when temporarily discounted");
}

// Partial resonance consumption.
{
  const { state, meta } = makeRun(["heal_resonance_suture"]);
  state.hp = 50;
  add(enemy(state), "resonance", 3);
  E.play(state, 0, meta);
  assert.equal(S.stacks(enemy(state), "resonance"), 1);
  assert.equal(state.hp, 58);
}
{
  const { state, meta } = makeRun(["absorb_resonance_condensation"]);
  state.battle.absorb = 0;
  add(enemy(state), "resonance", 6);
  E.play(state, 0, meta);
  assert.equal(S.stacks(enemy(state), "resonance"), 2);
  assert.equal(state.battle.absorb, 14);
}

// Chain Collapse exact ordering and actual-consumed math.
{
  const { state, meta } = makeRun(["noncontact_resonance_chain_collapse"], { enemyCount: 3 });
  state.inventory.push("trait_inverse_phase_amplifier", "trait_critical_discharge_meter");
  add(enemy(state, 0), "resonance", 12);
  enemy(state, 1).shield = 99;
  enemy(state, 2).shield = 99;
  E.play(state, 0, meta);
  assert.equal(S.stacks(enemy(state, 0), "resonance"), 0);
  assert.equal(enemy(state, 0).hp, 135, "20 + min(12,10)*4 + min(12,5)*1 = 65 primary damage");
  assert.equal(enemy(state, 1).hp, 180);
  assert.equal(enemy(state, 2).hp, 180);
  assert.equal(enemy(state, 1).shield, 99, "splash must pierce shield");
  assert.equal(enemy(state, 2).shield, 99, "splash must pierce shield");
  assert.equal(S.stacks(enemy(state, 1), "resonance"), 2);
  assert.equal(S.stacks(enemy(state, 2), "resonance"), 2);
  assert.equal(state.battle.ap, 7, "critical discharge should refund 1 AP once from actual 12-stack consumption");
  assert.equal(state.battle._stagedCriticalDischarge, true);
  const hits = state._enemyHitFeedback.filter((hit) => hit.targetIndex != null);
  const mainIndex = hits.findIndex((hit) => hit.targetIndex === 0 && !hit.statusId);
  const splashIndexes = [1, 2].map((targetIndex) =>
    hits.findIndex((hit) => hit.targetIndex === targetIndex && hit.statusId === "resonanceChainSplash"),
  );
  assert.ok(mainIndex >= 0 && splashIndexes.every((hitIndex) => hitIndex > mainIndex), "primary hit must precede splash hits");
}
{
  const { state, meta } = makeRun(["noncontact_resonance_chain_collapse"], { enemyCount: 2 });
  state.battle.hand[0].level = 1;
  add(enemy(state), "resonance", 12);
  E.play(state, 0, meta);
  assert.equal(enemy(state).hp, 124, "upgrade: 26 + min(12,10)*5 = 76 primary damage");
  assert.equal(enemy(state, 1).hp, 180, "splash remains min(12,10)*2");
}

// Resonance traits/relics and turn-once behavior.
{
  const { state, meta } = makeRun(["noncontact_compound_vapor_recovery", "noncontact_compound_vapor_recovery"]);
  state.inventory.push("trait_resonance_ignition_coil", "trait_resonance_ignition_coil");
  E.play(state, 0, meta);
  assert.equal(S.stacks(enemy(state), "resonance"), 2);
  E.play(state, 0, meta);
  assert.equal(S.stacks(enemy(state), "resonance"), 2, "first non-contact trait must be once per turn");
}
{
  const { state, meta } = makeRun(["contact_resonance_piercing_needle", "contact_resonance_piercing_needle"]);
  state.inventory.push("trait_resonance_buffer_field", "trait_resonance_buffer_field");
  add(enemy(state), "resonance", 1);
  E.play(state, 0, meta);
  assert.equal(state.battle.shield, 6);
  E.play(state, 0, meta);
  assert.equal(state.battle.shield, 6, "resonance buffer must be once per turn");
}
{
  const { state, meta } = makeRun(["contact_resonance_piercing_needle"], { enemyCount: 2 });
  state.inventory.push("relic_resonance_capture_flask");
  enemy(state, 0).hp = 1;
  add(enemy(state, 0), "resonance", 4);
  E.play(state, 0, meta);
  assert.equal(enemy(state, 0).hp, 0);
  assert.equal(S.stacks(enemy(state, 1), "resonance"), 4, "capture flask transfers remaining resonance on death");
}
for (const [before, after] of [[4, 5], [5, 7]]) {
  const { state, meta } = makeRun(["noncontact_compound_vapor_recovery"]);
  state.inventory.push("relic_permanent_resonance_core");
  add(enemy(state), "resonance", before);
  E.play(state, 0, meta);
  assert.equal(S.stacks(enemy(state), "resonance"), after, `permanent core threshold mismatch from ${before}`);
}

// Existing passives restriction must suppress staged traits/relics.
{
  const { state, meta } = makeRun(["noncontact_compound_vapor_recovery"]);
  state.inventory.push("trait_resonance_ignition_coil", "relic_permanent_resonance_core");
  add(state, "silence", { stacks: 1, turns: 1 });
  E.play(state, 0, meta);
  assert.equal(S.stacks(enemy(state), "resonance"), 0);
}

// Actual live item reward profiles must be able to roll every staged trait/relic.
{
  const seen = new Set();
  for (let seed = 1; seed <= 25000 && seen.size < stagedItemIds.length; seed++) {
    const meta = E.freshMeta();
    const state = E.newRun(seed, ["guard_resonance_cover"], meta);
    for (const room of ["golden", "elite", "boss"]) {
      const id = E.rollLoot(state, room, meta);
      if (stagedItemIds.includes(id)) seen.add(id);
    }
  }
  assert.deepEqual(stagedItemIds.filter((id) => !seen.has(id)), [], "every staged item must be reachable from live reward profiles");
}

// Actual combat reward generation must be able to offer every staged active card.
{
  const seen = new Set();
  for (let seed = 1; seed <= 12000 && seen.size < stagedCardIds.length; seed++) {
    const meta = E.freshMeta();
    const state = E.newRun(seed, Array(10).fill("contact_glass_dropper_strike"), meta);
    state.route = Array(12).fill("combat");
    state.route[11] = "boss";
    state.resolvedRooms[0] = "battle";
    E.enter(state, meta);
    state.battle.enemies = [state.battle.enemies[0]];
    E.attachEnemyAliases(state.battle);
    state.battle.enemies[0].hp = 1;
    state.battle.enemies[0].maxHp = 1;
    state.battle.enemies[0].shield = 0;
    state.battle.ap = 8;
    state.battle.hand = [{ id: "contact_glass_dropper_strike", level: 0 }];
    E.play(state, 0, meta);
    const offer = E.currentRewardOffer(state);
    for (const option of offer?.options || []) {
      if (option.type === "card" && stagedCardIds.includes(option.id)) seen.add(option.id);
    }
  }
  assert.deepEqual(stagedCardIds.filter((id) => !seen.has(id)), [], "every staged active card must be reachable from combat rewards");
}

// Existing global T2 fallback remains intentionally unchanged in this integration.
assert.equal(E.cardMaxCopies({ tier: 2 }), 2);
for (const id of stagedCardIds.filter((id) => CARDS[id].tier === 2)) assert.equal(CARDS[id].maxCopies, 3);

console.log("PASS Harmony staged augments: 22 unique IDs, copy caps, pre-state refunds, resonance ordering, reward reachability and passive restrictions.");

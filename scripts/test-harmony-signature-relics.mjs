import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { ITEMS } from "../games/harmony/data.js";
import * as S from "../games/harmony/statuses.js";

for (const [id, expected] of [
  ["relic_primordial_pipette", "30%"],
  ["relic_essence_heart", "50%"],
  ["relic_harmony_orb", "HARMONY! 효과량 +50%"],
]) {
  assert.ok(ITEMS[id]?.signatureOnly, `${id} must remain signature-only`);
  assert.ok(ITEMS[id].description.includes(expected), `${id} should expose the implemented effect in its description`);
}

function makeRun(handIds, seed = 913) {
  const meta = E.freshMeta();
  const deck = Array.from({ length: 10 }, (_, index) => handIds[index % handIds.length]);
  const state = E.newRun(seed, deck, meta);
  state.route = Array(12).fill("combat");
  state.route[11] = "boss";
  state.resolvedRooms[0] = "battle";
  E.enter(state, meta);
  assert.equal(state.phase, "battle");
  state.battle.ap = 8;
  state.battle.hand = handIds.map((id) => ({ id, level: 0 }));
  state.battle.draw = Array.from({ length: 12 }, () => ({ id: "guard_paraffin_seal", level: 0 }));
  state.battle.discard = [];
  state.battle.exhaust = [];
  state.battle.pendingDiscard = 0;
  state.battle.cardsPlayedThisTurn = 0;
  state.battle.harmoniesThisTurn = 0;
  state.battle.notes = [];
  state.battle.absorb = 0;
  state.battle.shield = 0;
  state.statuses = S.createStatuses();
  delete state._controlFeedback;
  return { state, meta };
}

// 원초의 피펫: partial consumption refunds 30% of actual spend.
{
  const { state, meta } = makeRun(["contact_pure_absorb_overload"]);
  state.inventory.push("relic_primordial_pipette");
  state.battle.absorb = 20;
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(state.battle.absorb, 6, "20 absorb spend should refund 6");
}

// 원초의 피펫: full Burst consumption is capped at 10 refund.
{
  const { state, meta } = makeRun(["burst_spatial_diffusion"]);
  state.inventory.push("relic_primordial_pipette");
  state.battle.absorb = 40;
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(state.battle.absorb, 10, "40 absorb spend should refund at the 10 cap");
}

// 에센스 심장: actual HP restored, not printed heal, converts to absorb.
{
  const { state, meta } = makeRun(["heal_soothing_balm_distillate"]);
  state.inventory.push("relic_essence_heart");
  state.hp = 50;
  state.maxHp = 80;
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(state.hp, 62);
  // The card itself grants absorb 6; actual heal 12 grants another 6.
  assert.equal(state.battle.absorb, 12);
}

// 에센스 심장: per-turn conversion is capped at 10 and resets on a new turn.
{
  const { state, meta } = makeRun([
    "heal_soothing_balm_distillate",
    "heal_soothing_balm_distillate",
  ]);
  state.inventory.push("relic_essence_heart");
  state.hp = 30;
  state.maxHp = 80;
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(E.play(state, 0, meta), true);
  // Two cards add 12 base absorb; healing conversion would be 12 without the cap.
  assert.equal(state.battle.absorb, 22, "Essence Heart healing conversion must stop at 10 per turn");

  state.battle.turn += 1;
  state.battle.ap = 8;
  state.hp = 30;
  state.battle.hand = [{ id: "heal_soothing_balm_distillate", level: 0 }];
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(state.battle.absorb, 34, "Essence Heart cap must reset when battle.turn changes");
}

// 조화의 구체: Harmony effect is +50% and the following normal card costs 1 less.
{
  const { state, meta } = makeRun([
    "guard_paraffin_seal",
    "contact_glass_dropper_strike",
  ]);
  state.inventory.push("relic_harmony_orb");
  state.battle.notes = [
    { id: "qa-top", level: 0, note: "top" },
    { id: "qa-middle", level: 0, note: "middle" },
  ];
  const finishingCard = state.battle.hand[0],
    unboosted = E.resolveHarmonyEffect(state, finishingCard).amount;
  assert.equal(E.play(state, 0, meta), true);
  const harmony = state._harmonyFeedback?.at(-1);
  assert.ok(harmony, "Harmony feedback should be emitted");
  assert.equal(harmony.amount, Math.round(unboosted * 1.5));
  assert.equal(E.cost(state, state.battle.hand[0]), 0, "next card should receive -1 AP cost");
  assert.equal(E.play(state, 0, meta), true);
  assert.equal(state.battle._harmonyOrbDiscountReady, false, "discount should be consumed by the next card");
}

console.log("Harmony signature relic tests passed");

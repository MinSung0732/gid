import assert from "node:assert/strict";
import { CARDS } from "../games/harmony/data.js";
import * as E from "../games/harmony/engine.js";
import { stacks, turns } from "../games/harmony/statuses.js";

const ids = [
  "heal_aloe_salve", "heal_chamomile_infusion", "heal_herbal_compress",
  "heal_clarifying_lavender", "heal_soothing_balm_distillate",
  "heal_vital_sap_concoction", "heal_celestial_ambrosia",
  "heal_phoenix_aroma_salve", "heal_primordial_dew_elixir",
  "heal_miracle_transmutation",
];
assert.ok(ids.every((id) => CARDS[id]?.category === "heal"));
assert.deepEqual(ids.map((id) => CARDS[id].tier), [1, 1, 1, 2, 2, 2, 3, 3, 4, 4]);
assert.deepEqual(ids.map((id) => CARDS[id].note), ["top", "middle", "base", "top", "middle", "base", "middle", "base", "top", "base"]);

const combat = (id, level = 0, seed = 100) => {
  const run = E.newRun(seed), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.ap = 10;
  run.battle.hand = [{ id, level }];
  return { run, meta };
};
const play = ({ run, meta }) => E.play(run, 0, meta);

for (const id of ids) {
  const state = combat(id);
  state.run.hp = state.run.maxHp;
  assert.equal(E.canPlay(state.run, state.run.battle.hand[0]), false, `${id} is disabled at full health`);
  assert.equal(play(state), false, `${id} cannot be consumed at full health`);
  assert.equal(state.run.battle.hand.length, 1);
}

for (const [level, expected] of [5, 7, 9, 11].entries()) {
  const state = combat("heal_aloe_salve", level);
  state.run.hp = 40;
  play(state);
  assert.equal(state.run.hp, 40 + expected);
}

{
  const state = combat("heal_chamomile_infusion", 3);
  state.run.hp = 40;
  play(state);
  assert.equal(state.run.hp, 50);
  assert.equal(state.run.battle.shield, 8);
}
{
  const state = combat("heal_herbal_compress", 0);
  state.run.hp = 40;
  state.run.battle.draw = [{ id: "heal_aloe_salve", level: 0 }];
  delete state.run._drawFeedback;
  delete state.run._shuffleFeedback;
  play(state);
  assert.equal(state.run.hp, 43);
  assert.equal(state.run.battle.hand.length, 1);
  assert.equal(state.run._drawFeedback, 1, "card-effect draws emit draw feedback");
  assert.equal(state.run._shuffleFeedback, undefined, "a nonempty draw pile is not shuffled");
}
{
  const state = combat("heal_herbal_compress", 0);
  state.run.hp = 40;
  state.run.battle.draw = [];
  state.run.battle.discard = [{ id: "heal_aloe_salve", level: 0 }];
  delete state.run._drawFeedback;
  delete state.run._shuffleFeedback;
  play(state);
  assert.equal(state.run._drawFeedback, 1, "a recycled card still emits draw feedback");
  assert.equal(state.run._shuffleFeedback, 1, "recycling the discard pile emits shuffle feedback");
}
{
  const state = combat("heal_clarifying_lavender", 0);
  state.run.hp = 40;
  for (const id of ["burning", "corrosion", "poison", "bleed"])
    E.addStatus(state.run, "player", id, 2);
  play(state);
  assert.equal(state.run.hp, 47, "The remaining burning stack resolves after the card action");
  for (const id of ["burning", "corrosion", "poison", "bleed"])
    assert.equal(stacks(state.run, id), 1);
}
{
  const state = combat("heal_soothing_balm_distillate", 2);
  state.run.hp = 30;
  play(state);
  assert.equal(state.run.hp, 50);
  assert.equal(state.run.battle.absorb, 10);
}
{
  const state = combat("heal_vital_sap_concoction", 2);
  state.run.hp = 30;
  state.run.battle.cardsPlayedThisTurn = 2;
  play(state);
  assert.equal(state.run.hp, 52);
}
{
  const state = combat("heal_celestial_ambrosia", 1);
  state.run.hp = 30;
  state.run.battle.harmoniesThisTurn = 1;
  play(state);
  assert.equal(state.run.hp, 53);
  assert.equal(state.run.battle.shield, 23);
}
{
  const state = combat("heal_phoenix_aroma_salve", 2);
  state.run.hp = 30;
  play(state);
  assert.equal(state.run.hp, 47);
  assert.equal(stacks(state.run, "regeneration"), 3);
  assert.equal(turns(state.run, "regeneration"), 5);
}
{
  const state = combat("heal_primordial_dew_elixir", 0);
  state.run.hp = 70;
  play(state);
  assert.equal(state.run.hp, 80);
  assert.equal(state.run.battle.shield, 27);
}
{
  const state = combat("heal_miracle_transmutation", 1);
  state.run.hp = 20;
  E.addStatus(state.run, "player", "poison", 4);
  E.addStatus(state.run, "player", "weak", 1);
  play(state);
  assert.equal(state.run.hp, 62);
  assert.equal(stacks(state.run, "poison"), 0);
  assert.equal(stacks(state.run, "weak"), 0);
}

console.log("PASS Harmony heal cards: ten cards, tiers, notes, upgrades, cleanse, absorb, combo, harmony, regen and overheal shield.");

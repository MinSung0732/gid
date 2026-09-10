import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { OFFICIAL_RELICS } from "../games/harmony/official-relics.js";
import { ITEMS, TEST_ITEMS } from "../games/harmony/data.js";
import * as S from "../games/harmony/statuses.js";

const counts = Object.values(OFFICIAL_RELICS).reduce((result, relic) => {
  result[relic.tier + 1] = (result[relic.tier + 1] || 0) + 1;
  return result;
}, {});
assert.equal(Object.keys(OFFICIAL_RELICS).length, 53);
assert.deepEqual(counts, { 1: 30, 3: 17, 4: 6 });
for (const [id, relic] of Object.entries(OFFICIAL_RELICS)) {
  assert.equal(ITEMS[id], relic);
  assert.equal(TEST_ITEMS[id], relic);
  assert.equal(relic.kind, "relic");
  assert.equal(relic.maxOwned, 1);
}

let run = E.newRun(5301);
assert.equal(E.addInventoryItem(run, "relic_scented_paperweight"), true);
assert.equal(E.addInventoryItem(run, "relic_scented_paperweight"), false);
assert.equal(E.addInventoryItem(run, "relic_extra_pipette_stand"), true, "distinct relics with the same effect coexist");
assert.equal(E.deckLimit(run), 24);

run = E.newRun(5302);
run.inventory = ["relic_glass_funnel_tip", "relic_wax_seal_stamp", "relic_rough_stone_coaster"];
run.route[0] = "battle";
E.enter(run, E.freshMeta());
assert.equal(run.battle.absorb, 4);
assert.equal(run.battle.shield, 3);
assert.equal(S.stacks(run, "thorns"), 1);

run = E.newRun(5303);
run.inventory = ["relic_merchants_diplomatic_seal", "relic_brass_pocket_balance"];
assert.equal(E.shopPrice(run, 45, "card"), 27);

run = E.newRun(5304);
run.inventory = ["relic_chronos_sandglass_of_scent"];
run.route[0] = "battle";
const meta = E.freshMeta();
E.enter(run, meta);
const firstTurn = run.battle.turn;
assert.equal(E.executePlayerTurnEnd(run, meta), true);
assert.equal(run.battle.enemyPhase, false);
assert.equal(run.battle.turn, firstTurn + 1, "Chronos grants one immediate extra turn");

console.log("PASS official relics: 53 items, exact tiers, independent ownership, opening effects, discounts and Chronos extra turn.");

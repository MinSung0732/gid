import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { CARDS, ITEMS } from "../games/harmony/data.js";
import { STAT_AND_CURSE_ITEMS } from "../games/harmony/stat-curse-items.js";

assert.equal(Object.keys(STAT_AND_CURSE_ITEMS).length, 68);
for (const [id, item] of Object.entries(STAT_AND_CURSE_ITEMS)) {
  assert.equal(ITEMS[id], item);
  assert.ok(["stat", "curse"].includes(item.kind));
  assert.ok(item.maxOwned > 0);
  assert.ok(item.description);
}

const meta = () => E.freshMeta();
const battle = (inventory = []) => {
  const run = E.newRun(7101);
  run.inventory = inventory;
  run.route[0] = "battle";
  E.enter(run, meta());
  return run;
};

let run = battle(["stat_marble_coaster", "curse_eternal_shield_debt"]);
assert.equal(run.battle.shield, -15);
run = battle(["stat_primed_absorb_sponge", "curse_abyssal_absorption_void", "curse_abyssal_absorption_void"]);
assert.equal(run.battle.absorb, -40);
run.battle.ap = 5;
E.executePlayerTurnEnd(run, meta());
assert.equal(run.battle.absorb, -40, "absorb debt does not decay into free absorb");

CARDS.test_stat_resources = { id: "test_stat_resources", name: "test", cost: 0, tier: 1, maxCopies: 4, maxUpgrade: 0, category: "guard", shield: 2, absorb: 3 };
run = battle(["curse_fractured_belljar_shards", "stat_capillary_glass_siphon"]);
run.hp = 20;
run.battle.hand = [{ id: "test_stat_resources", level: 0 }];
E.play(run, 0, meta());
assert.equal(run.hp, 18, "negative shield gain becomes health damage");
assert.equal(run.battle.absorb, 5, "card absorb bonus applies once per gain");
delete CARDS.test_stat_resources;

run = E.newRun(7102);
run.hp = 30;
assert.equal(E.addInventoryItem(run, "stat_primordial_essence_heart"), true);
assert.deepEqual([run.hp, run.maxHp], [55, 105]);
assert.equal(E.addInventoryItem(run, "curse_abyssal_life_devourer"), true);
assert.equal(E.addInventoryItem(run, "curse_abyssal_life_devourer"), true);
assert.deepEqual([run.hp, run.maxHp], [35, 35]);
assert.equal(E.addInventoryItem(run, "curse_abyssal_life_devourer"), false);

run = E.newRun(7103);
run.gold = 10;
E.addInventoryItem(run, "stat_royal_perfumers_treasury");
E.addInventoryItem(run, "curse_abyssal_debt_bond");
assert.equal(run.gold, 10);
run.inventory.push("curse_extortionate_merchant_tax", "curse_extortionate_merchant_tax");
assert.equal(E.shopPrice(run, 25), 75);

console.log("PASS stat/curse items: registry, resource opening values, card modifiers, max HP, instant gold and shop prices.");

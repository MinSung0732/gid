import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { CURSE_TRAITS } from "../games/harmony/curse-traits.js";
import { ITEMS, TEST_ITEMS } from "../games/harmony/data.js";
import { loadGame, saveGame } from "../games/harmony/persistence.js";

const counts = Object.values(CURSE_TRAITS).reduce((result, trait) => {
  result[trait.tier + 1] = (result[trait.tier + 1] || 0) + 1;
  return result;
}, {});
assert.equal(Object.keys(CURSE_TRAITS).length, 55);
assert.deepEqual(counts, { 1: 20, 2: 17, 3: 13, 4: 5 });
for (const [id, trait] of Object.entries(CURSE_TRAITS)) {
  assert.equal(ITEMS[id], trait);
  assert.equal(TEST_ITEMS[id], trait);
  assert.equal(trait.kind, "curse");
  assert.equal(trait.curseTrait, true);
  assert.equal(trait.stackable, true);
  assert.ok(trait.maxOwned > 0 && trait.description);
}

const run = E.newRun(5501);
assert.equal(E.addInventoryItem(run, "curse_trait_heavy_sediment"), true);
assert.equal(E.addInventoryItem(run, "curse_trait_heavy_sediment"), true);
assert.equal(E.addInventoryItem(run, "curse_trait_heavy_sediment"), true);
assert.equal(E.addInventoryItem(run, "curse_trait_heavy_sediment"), false);
assert.equal(E.power(run, "extraAbsorbDecay"), 9);

run.inventory.push("curse_trait_heavy_sediment");
run.testMode = true;
const values = new Map();
const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
saveGame(storage, { run, meta: E.freshMeta() });
assert.equal(loadGame(storage).run.inventory.filter((id) => id === "curse_trait_heavy_sediment").length, 3);

console.log("PASS curse traits: 55 items, exact tiers, catalog registration, stacking limits and persistence.");

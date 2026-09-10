import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { BENEFICIAL_TRAITS } from "../games/harmony/beneficial-traits.js";
import { ITEMS, TEST_ITEMS } from "../games/harmony/data.js";
import { loadGame, saveGame } from "../games/harmony/persistence.js";

const counts = Object.values(BENEFICIAL_TRAITS).reduce((result, trait) => {
  result[trait.tier + 1] = (result[trait.tier + 1] || 0) + 1;
  return result;
}, {});
assert.equal(Object.keys(BENEFICIAL_TRAITS).length, 97);
assert.deepEqual(counts, { 1: 32, 2: 30, 3: 20, 4: 15 });
for (const [id, trait] of Object.entries(BENEFICIAL_TRAITS)) {
  assert.equal(ITEMS[id], trait);
  assert.equal(TEST_ITEMS[id], trait);
  assert.equal(trait.kind, "trait");
  assert.equal(trait.stackable, true);
  assert.ok(trait.maxOwned > 0 && trait.description);
}

const run = E.newRun(9701);
assert.equal(E.addInventoryItem(run, "trait_overlapping_petals"), true);
assert.equal(E.addInventoryItem(run, "trait_overlapping_petals"), true);
assert.equal(E.addInventoryItem(run, "trait_overlapping_petals"), true);
assert.equal(E.addInventoryItem(run, "trait_overlapping_petals"), false);
assert.equal(E.power(run, "oilShield"), 6);

const storage = new Map();
const adapter = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
run.testMode = true;
saveGame(adapter, { run, meta: E.freshMeta() });
assert.equal(loadGame(adapter).run.inventory.filter((id) => id === "trait_overlapping_petals").length, 3);

console.log("PASS beneficial traits: 97 items, exact tiers, test catalog, stacking limits and persistence.");

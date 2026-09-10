import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { CARDS, ITEMS, LEGACY_BETA_ITEMS, TEST_ITEMS } from "../games/harmony/data.js";
import { loadGame, saveGame } from "../games/harmony/persistence.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

const allCardIds = Object.values(CARDS).filter((card) => card.id !== "impurity").map((card) => card.id);
assert.ok(allCardIds.some((id) => CARDS[id].tier === 4));

const oversizedDeck = [...allCardIds, ...allCardIds.slice(0, 8)];
const run = E.newRun(777, oversizedDeck);
run.testMode = true;
const storage = new MemoryStorage();
saveGame(storage, { run, meta: E.freshMeta() });
const restored = loadGame(storage).run;
assert.equal(restored.testMode, true);
assert.equal(restored.deck.length, oversizedDeck.length, "Test decks are not truncated to the normal deck limit");

const itemRun = E.newRun(779, [allCardIds[0]]);
itemRun.testMode = true;
const relic = Object.values(TEST_ITEMS).find((item) => item.kind === "relic");
assert.ok(relic && ITEMS[relic.id], "Test catalog exposes official relics to the engine");
assert.ok(Object.keys(LEGACY_BETA_ITEMS).every((id) => !TEST_ITEMS[id]), "Test catalog excludes legacy beta augments");
assert.equal(E.addInventoryItem(itemRun, relic.id), true);
saveGame(storage, { run: itemRun, meta: E.freshMeta() });
const restoredItems = loadGame(storage).run.inventory;
assert.ok(restoredItems.includes(relic.id), "Test augments survive save/load");

const discoveryRun = E.newRun(778);
discoveryRun.testMode = true;
discoveryRun.phase = "reward";
discoveryRun.reward = { cards: ["contact_terracotta_crush"], cardPicksRemaining: 1 };
const meta = E.freshMeta();
assert.equal(E.advance(discoveryRun, "contact_terracotta_crush", null, meta), true);
assert.equal(meta.discoveredCards.includes("contact_terracotta_crush"), false, "Test-mode use does not unlock codex cards");

console.log("PASS local card test mode: unrestricted saved decks and no codex discovery.");

import assert from "node:assert/strict";
import { ATELIER_DROP_TABLE, ATELIER_TIER_PRICES } from "../games/harmony/atelier-shop.js";
import { CARDS, ITEMS } from "../games/harmony/data.js";
import * as E from "../games/harmony/engine.js";

assert.deepEqual(ATELIER_TIER_PRICES, { 1: 30, 2: 55, 3: 90, 4: 140 });
assert.deepEqual(ATELIER_DROP_TABLE, [], "A future curated table can override the automatic catalog fallback");

for (let seed = 1; seed <= 100; seed++) {
  const run = E.newRun(seed);
  const offers = E.rollShopOffers(run);
  assert.ok(offers.length >= 2 && offers.length <= 5, "Empty curated tables fall back to 2-5 live products");
  assert.ok(offers.every((offer) => CARDS[offer.id] || ITEMS[offer.id]));
}

const cardIds = Object.keys(CARDS).filter((id) =>
  id !== "impurity" && !E.newRun(1).deck.some((card) => card.id === id),
).slice(0, 6);
ATELIER_DROP_TABLE.push(...cardIds.map((id) => ({ type: "card", id })));

for (let seed = 1; seed <= 100; seed++) {
  const run = E.newRun(seed);
  const offers = E.rollShopOffers(run);
  assert.ok(offers.length >= 2 && offers.length <= 5, "Base stock stays between two and five products");
}

const buyer = E.newRun(77);
buyer.phase = "shop";
buyer.gold = 999;
buyer.shopOffers = [{
  type: "card",
  id: cardIds[0],
  tier: CARDS[cardIds[0]].tier,
  basePrice: ATELIER_TIER_PRICES[CARDS[cardIds[0]].tier],
  sold: false,
}];
const beforeDeck = buyer.deck.length;
const meta = E.freshMeta();
assert.equal(E.shop(buyer, "offer", 0, meta), true);
assert.equal(buyer.deck.length, beforeDeck + 1);
assert.equal(buyer.shopOffers[0].sold, true);
assert.equal(E.shop(buyer, "offer", 0, meta), false, "A sold product cannot be bought twice");

const augmentId = Object.keys(ITEMS).find((id) =>
  !ITEMS[id].signatureOnly && Number.isFinite(ATELIER_TIER_PRICES[ITEMS[id].tier + 1]),
);
buyer.shopOffers = [{
  type: "augment",
  id: augmentId,
  tier: ITEMS[augmentId].tier + 1,
  basePrice: ATELIER_TIER_PRICES[ITEMS[augmentId].tier + 1],
  sold: false,
}];
assert.equal(E.shop(buyer, "offer", 0, meta), true);
assert.ok(buyer.inventory.includes(augmentId));
assert.equal(E.shop(buyer, "leave"), true, "The shop can be left without another purchase");
assert.equal(buyer.phase, "map");
assert.equal(buyer.shopOffers, null);

ATELIER_DROP_TABLE.length = 0;
console.log("PASS Harmony atelier shop: automatic fallback, 2-5 stock, tier prices, card/augment purchases and free exit.");

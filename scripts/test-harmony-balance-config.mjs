import assert from "node:assert/strict";
import {
  BALANCE,
  CAMPAIGN_BALANCE,
  COMBAT_BALANCE,
  DECK_BALANCE,
  ECONOMY_BALANCE,
  PLAYER_BALANCE,
  validateBalanceConfig,
} from "../games/harmony/editor/index.js";
import { CARDS, ENEMIES, ITEMS, RECOMMENDED_STARTING_DECK, STARTING_DECK } from "../games/harmony/data.js";
import * as E from "../games/harmony/engine.js";

assert.equal(validateBalanceConfig(), true);
assert.equal(STARTING_DECK.length, DECK_BALANCE.startingSize);
assert.equal(RECOMMENDED_STARTING_DECK.length, DECK_BALANCE.startingSize);
for (const deck of [STARTING_DECK, RECOMMENDED_STARTING_DECK]) {
  const counts = {};
  for (const id of deck) {
    const card = CARDS[id];
    assert.equal(card?.tier, 1, `${id} must remain a tier-1 starting card`);
    counts[id] = (counts[id] || 0) + 1;
    assert.ok(counts[id] <= card.maxCopies, `${id} exceeds maxCopies`);
  }
}

const run = E.newRun(20260920);
assert.equal(run.maxHp, PLAYER_BALANCE.startingMaxHp);
assert.equal(run.hp, PLAYER_BALANCE.startingMaxHp);
assert.equal(run.potions, PLAYER_BALANCE.startingPotions);
assert.equal(E.apLimit(run), PLAYER_BALANCE.baseApLimit);
assert.equal(E.turnStartAp(run), PLAYER_BALANCE.baseTurnAp);
assert.equal(E.handLimit(run), PLAYER_BALANCE.baseHandLimit);
assert.equal(E.deckLimit(run), DECK_BALANCE.baseLimit);
assert.equal(E.potionLimit(run), PLAYER_BALANCE.basePotionLimit);
const completeMeta = E.freshMeta();
completeMeta.discoveredCards = Object.keys(CARDS);
completeMeta.discovered = Object.keys(ITEMS);
completeMeta.defeatedMonsters = Object.keys(ENEMIES);
assert.deepEqual(E.codexPerks(completeMeta), {
  startingGold: CAMPAIGN_BALANCE.codexPerks.startingGoldBonus,
  startingPotions: CAMPAIGN_BALANCE.codexPerks.startingPotionBonus,
  shopRerolls: CAMPAIGN_BALANCE.codexPerks.shopRerollBonus,
  turn1Ap: CAMPAIGN_BALANCE.codexPerks.firstTurnApBonus,
  goldenCollection: true,
});
run.phase = "shop";
run.gold = ECONOMY_BALANCE.potionBasePrice;
run.potions = 0;
assert.equal(E.shop(run, "potion"), true);
assert.equal(run.gold, 0);

const invalid = structuredClone(BALANCE);
invalid.deck.startingSize = invalid.deck.baseLimit + 1;
assert.throws(() => validateBalanceConfig(invalid), /startingSize cannot exceed/);
invalid.deck.startingSize = DECK_BALANCE.startingSize;
invalid.player.baseTurnAp = invalid.player.baseApLimit + 1;
assert.throws(() => validateBalanceConfig(invalid), /baseTurnAp cannot exceed/);
invalid.player.baseTurnAp = PLAYER_BALANCE.baseTurnAp;
invalid.combat.maxEnemyCount = COMBAT_BALANCE.maxEnemyCount + 1;
assert.throws(() => validateBalanceConfig(invalid), /maxEnemyCount cannot exceed 3/);

console.log("PASS Harmony balance config: centralized deck, player, economy, reward, campaign, and combat invariants.");

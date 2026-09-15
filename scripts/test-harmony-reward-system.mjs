import assert from "node:assert/strict";
import { CARDS, ITEMS, UNLOCKS } from "../games/harmony/data.js";
import * as E from "../games/harmony/engine.js";
import { loadGame, saveGame } from "../games/harmony/persistence.js";
import {
  DICE_ALTAR_OUTCOMES,
  REWARD_PROFILES,
  SHOP_SLOT_PROFILES,
  SPECIAL_REWARD_PROFILES,
  applyRewardModifiers,
  collectRewardModifiers,
  claimOfferState,
  createRewardOffer,
  skipOfferState,
} from "../games/harmony/reward-system.js";

const unlockedMeta = () => {
  const meta = E.freshMeta();
  meta.unlocked = UNLOCKS.filter((entry) => !entry.legacy).map((entry) => entry.id);
  return meta;
};
const itemTiers = (profile, kind) => [...profile.tierWeightsByKind[kind]];

assert.deepEqual([...REWARD_PROFILES.combat.tierWeights], [60, 28, 10, 2]);
assert.deepEqual(itemTiers(REWARD_PROFILES.gather, "stat"), [65, 28, 6, 1]);
assert.deepEqual(REWARD_PROFILES.golden.kindWeights, { stat: 20, trait: 50, relic: 30 });
assert.deepEqual(itemTiers(REWARD_PROFILES.golden, "stat"), [45, 35, 17, 3]);
assert.deepEqual(itemTiers(REWARD_PROFILES.golden, "trait"), [35, 35, 22, 8]);
assert.deepEqual(itemTiers(REWARD_PROFILES.golden, "relic"), [75, 0, 23, 2]);
assert.deepEqual(REWARD_PROFILES.elite.kindWeights, { trait: 65, relic: 35 });
assert.deepEqual(itemTiers(REWARD_PROFILES.elite, "trait"), [28, 35, 29, 8]);
assert.deepEqual(itemTiers(REWARD_PROFILES.elite, "relic"), [55, 0, 42, 3]);
assert.deepEqual(REWARD_PROFILES.boss.kindWeights, { trait: 45, relic: 55 });
assert.deepEqual(itemTiers(REWARD_PROFILES.boss, "trait"), [15, 25, 42, 18]);
assert.deepEqual(itemTiers(REWARD_PROFILES.boss, "relic"), [35, 0, 60, 5]);
assert.deepEqual(SHOP_SLOT_PROFILES, [
  { card: 100 },
  { trait: 70, relic: 30 },
  { card: 50, trait: 35, relic: 15 },
  { card: 50, trait: 35, relic: 15 },
  { card: 50, trait: 35, relic: 15 },
]);
assert.equal(DICE_ALTAR_OUTCOMES.reduce((sum, entry) => sum + entry.weight, 0), 100);
assert.deepEqual(SPECIAL_REWARD_PROFILES.mysteryJackpot.entries.map(({ kind, tier, weight }) => [kind, tier, weight]), [
  ["trait", 3, 45], ["relic", 2, 50], ["relic", 3, 5],
]);

const modified = applyRewardModifiers(
  { optionCount: 1, pickCount: 1 },
  [{ optionCount: 1 }, { pickCount: 1 }, { optionCount: -1 }],
);
assert.equal(modified.optionCount, 1, "Reward modifiers support additive and subtractive option deltas");
assert.equal(modified.pickCount, 1, "Final pickCount is normalized to the number of available options");

const stackedModifiers = collectRewardModifiers(
  ["modifier_test"],
  {
    modifier_test: {
      rewardModifier: {
        eliteRewardOptions: 1,
        allRewardOptions: 1,
        eliteRewardPick: 1,
      },
    },
  },
  "elite",
);
const stacked = applyRewardModifiers({ optionCount: 1, pickCount: 1 }, stackedModifiers);
assert.equal(stacked.optionCount, 3, "Source-specific and all-reward option modifiers stack additively");
assert.equal(stacked.pickCount, 2, "pickCount is accumulated independently from optionCount");

const pureOffer = createRewardOffer(
  { source: "elite", rewardPool: "test", optionCount: 3, pickCount: 2, allowSkip: true },
  (index, excluded) => {
    const ids = ["a", "b", "c"].filter((id) => !excluded.has(`item:${id}`));
    const id = ids[0];
    return id ? { type: "item", id, kind: "trait", tier: index } : null;
  },
  "test-offer",
);
assert.equal(pureOffer.options.length, 3);
assert.equal(new Set(pureOffer.options.map((option) => option.id)).size, 3, "Reward options do not duplicate by default");
assert.equal(pureOffer.remainingPicks, 2);
assert.equal(claimOfferState(pureOffer, pureOffer.options[0].optionId), true);
assert.equal(claimOfferState(pureOffer, pureOffer.options[0].optionId), false, "Claim state is idempotent");
assert.equal(pureOffer.remainingPicks, 1);
assert.equal(skipOfferState(pureOffer), true, "Players may abandon remaining picks early");
assert.equal(pureOffer.consumed, true);

for (const room of ["gather", "golden", "elite", "boss"]) {
  for (let seed = 1; seed <= 80; seed++) {
    const a = E.newRun(seed), b = E.newRun(seed), meta = unlockedMeta();
    a.loop = 0;
    b.loop = 3;
    assert.equal(E.rollLoot(a, room, meta), E.rollLoot(b, room, meta), `${room} tier/result roll must not scale with Act`);
  }
}

{
  const run = E.newRun(101), meta = unlockedMeta();
  run.route[0] = "gather";
  E.enter(run, meta);
  const before = [...run.inventory];
  assert.equal(E.openChest(run, meta), true);
  assert.equal(run.phase, "reward");
  assert.deepEqual(run.inventory, before, "Generating a gather reward must not grant inventory immediately");
  const offer = E.currentRewardOffer(run);
  assert.equal(offer.source, "gather");
  assert.equal(offer.allowSkip, true);
  assert.ok(offer.options.length >= 1);
  for (const option of offer.options) {
    if (option.type === "item") assert.equal(ITEMS[option.id].kind, "stat", "Gather only offers stat augments");
  }
  assert.equal(E.skipReward(run), true);
  assert.equal(run.phase, "map");
  assert.deepEqual(run.inventory, before, "Skipping gather reward grants no item");
}

{
  const run = E.newRun(102), meta = unlockedMeta();
  run.route[0] = "gather";
  E.enter(run, meta);
  E.openChest(run, meta);
  const offer = E.currentRewardOffer(run), option = offer.options[0];
  const before = run.inventory.length;
  assert.equal(E.claimReward(run, option.optionId, meta), true);
  if (option.type === "item") {
    assert.equal(run.inventory.length, before + 1);
    assert.ok(run.inventory.includes(option.id));
  } else assert.equal(option.type, "gold");
  assert.equal(E.claimReward(run, option.optionId, meta), false, "A consumed option cannot be claimed twice");
}

{
  const run = E.newRun(103), meta = unlockedMeta();
  run.inventory = Object.values(ITEMS)
    .filter((item) => item.kind === "stat")
    .flatMap((item) => Array(item.maxOwned).fill(item.id));
  run.route[0] = "gather";
  E.enter(run, meta);
  E.openChest(run, meta);
  const offer = E.currentRewardOffer(run);
  assert.equal(offer.options[0].type, "gold", "A fully exhausted stat pool falls back to gold, not another augment kind");
  assert.ok(offer.options[0].amount >= 20 && offer.options[0].amount <= 30);
}

function winCurrentBattle(run, meta) {
  run.battle.enemies.forEach((enemy) => { enemy.hp = 0; });
  run.battle.enemies[0].hp = 1;
  run.battle.selectedTarget = 0;
  run.battle.ap = 10;
  run.battle.hand = [{ id: "strike", level: 0 }];
  assert.equal(E.play(run, 0, meta), true);
  assert.equal(run.phase, "reward");
}

{
  const run = E.newRun(201), meta = unlockedMeta();
  run.route[0] = "elite";
  E.enter(run, meta);
  winCurrentBattle(run, meta);
  assert.equal(run.reward.groups.length, 2, "Elite augment and active-card rewards are independent groups");
  const augment = E.currentRewardOffer(run);
  for (const option of augment.options)
    if (option.type === "item") assert.ok(["trait", "relic"].includes(ITEMS[option.id].kind));
  E.skipReward(run);
  const cardOffer = E.currentRewardOffer(run);
  assert.equal(cardOffer.rewardPool, "active");
  assert.ok(cardOffer.options.every((option) => option.type === "card" || option.type === "gold"));
  E.skipReward(run);
  assert.equal(run.phase, "map");
}

{
  const signatureIds = new Set(Object.values(ITEMS).filter((item) => item.signatureOnly).map((item) => item.id));
  for (const room of ["gather", "golden", "elite", "boss"]) {
    for (let seed = 1; seed <= 180; seed++) {
      const run = E.newRun(seed), id = E.rollLoot(run, room, unlockedMeta());
      assert.ok(!signatureIds.has(id), `${room} generic reward leaked a Signature augment`);
    }
  }
  const observedStockCounts = new Set();
  for (let seed = 1; seed <= 80; seed++) {
    const run = E.newRun(seed), meta = unlockedMeta();
    E.rollShopOffers(run, meta);
    observedStockCounts.add(run.shopOffers.length);
    assert.ok(run.shopOffers.length >= 2 && run.shopOffers.length <= 5, "Base shop preserves variable 2-5 stock");
    assert.equal(run.shopOffers[0].type, "card", "Shop slot 1 is always an active card");
    const second = run.shopOffers[1];
    assert.equal(second.type, "augment");
    assert.ok(["trait", "relic"].includes(ITEMS[second.id].kind), "Shop slot 2 is Trait/Relic only");
    for (const offer of run.shopOffers.slice(2)) {
      if (offer.type === "augment") assert.ok(["trait", "relic"].includes(ITEMS[offer.id].kind));
      else assert.equal(offer.type, "card");
    }
    assert.ok(run.shopOffers.every((offer) => !signatureIds.has(offer.id)), "Shop excludes Signature augments");
  }
  assert.ok(observedStockCounts.size > 1, "Shop stock count is actually variable across seeds");
}

{
  let run = null, meta = null, signature = null;
  for (let seed = 7000; seed < 7200 && !run; seed++) {
    const candidateMeta = unlockedMeta(), candidate = E.newRun(seed, null, candidateMeta);
    candidate.route[0] = "boss";
    E.enter(candidate, candidateMeta);
    signature = candidate.battle.enemies[0]?.signatureReward || null;
    if (signature) { run = candidate; meta = candidateMeta; }
  }
  assert.ok(run && signature, "A Signature boss fixture is available");
  winCurrentBattle(run, meta);
  assert.ok(!run.inventory.includes(signature), "Signature reward is offered, never force-granted on boss defeat");
  const offer = E.currentRewardOffer(run);
  assert.equal(offer.source, "signatureBoss");
  assert.equal(offer.options[0].id, signature);
  assert.equal(E.skipReward(run), true);
  assert.ok(!run.inventory.includes(signature), "Skipping a Signature reward leaves inventory unchanged");
  assert.equal(E.currentRewardOffer(run).rewardPool, "active", "Boss active-card reward remains a separate group");
}

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.get(key) ?? null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
{
  const run = E.newRun(301), meta = unlockedMeta(), storage = new MemoryStorage();
  run.route[0] = "golden";
  E.enter(run, meta);
  E.openChest(run, meta);
  const before = structuredClone(run.reward), beforeRng = run.rng;
  saveGame(storage, { meta, run });
  const loaded = loadGame(storage).run;
  assert.deepEqual(loaded.reward.groups, before.groups, "Reload preserves generated RewardOffer options and claim state");
  assert.equal(loaded.rng, beforeRng, "Reload does not reroll a reward");
}

{
  const run = E.newRun(401), meta = unlockedMeta(), storage = new MemoryStorage();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemies = [
    { ...run.battle.enemies[0], hp: 1, maxHp: 1 },
    { ...structuredClone(run.battle.enemies[0]), id: `${run.battle.enemies[0].id}-2`, hp: 0, maxHp: 1 },
    { ...structuredClone(run.battle.enemies[0]), id: `${run.battle.enemies[0].id}-3`, hp: 0, maxHp: 1 },
  ];
  E.attachEnemyAliases(run.battle);
  run.battle.ap = 10;
  run.battle.hand = [{ id: "strike", level: 0 }];
  E.play(run, 0, meta);

  assert.deepEqual(
    run.reward.metadata.battleCardReward,
    { totalGroups: 3, generatedGroups: 1, optionCount: 3 },
    "Three defeated enemies create three sequential battle-card reward groups",
  );
  assert.equal(run.reward.groups.length, 1, "Only the active battle-card group is generated up front");
  const first = E.currentRewardOffer(run);
  assert.equal(first.pickCount, 1);
  assert.equal(first.optionCount, 3);
  assert.equal(first.metadata.groupIndex, 1);
  assert.equal(new Set(first.options.map((option) => option.id)).size, first.options.length, "A battle-card group does not repeat the same card internally");

  const firstOption = first.options.find((candidate) => candidate.type === "card");
  assert.ok(firstOption, "The battle-card fixture provides a card option");
  const maxCopies = E.cardMaxCopies(firstOption.id);
  run.deck = run.deck.filter((card) => card.id !== firstOption.id);
  for (let index = 0; index < maxCopies - 1; index++) run.deck.push({ id: firstOption.id, level: 0 });
  assert.equal(E.claimReward(run, firstOption.optionId, meta), true);

  const second = E.currentRewardOffer(run);
  assert.equal(run.reward.groups.length, 2, "Claiming group 1 lazily generates group 2");
  assert.equal(run.reward.metadata.battleCardReward.generatedGroups, 2);
  assert.equal(second.pickCount, 1);
  assert.equal(second.optionCount, 3);
  assert.equal(second.metadata.groupIndex, 2);
  assert.ok(
    second.options.every((option) => option.optionId !== firstOption.optionId),
    "Each battle-card group has a fresh RewardOffer/optionId set",
  );
  assert.ok(
    second.options.every((option) => option.type !== "card" || option.id !== firstOption.id),
    "The next group respects maxCopies after the previous claim",
  );

  const secondSnapshot = structuredClone(second), beforeRng = run.rng;
  saveGame(storage, { meta, run });
  const loaded = loadGame(storage).run;
  assert.deepEqual(E.currentRewardOffer(loaded), secondSnapshot, "Reload restores the current battle-card group without rerolling it");
  assert.deepEqual(loaded.reward.metadata.battleCardReward, run.reward.metadata.battleCardReward, "Reload preserves battle-card group progress");
  assert.equal(loaded.rng, beforeRng, "Reload preserves RNG while a battle-card reward is open");

  assert.equal(E.skipReward(loaded, meta), true);
  const third = E.currentRewardOffer(loaded);
  assert.equal(loaded.reward.groups.length, 3, "Skipping group 2 lazily generates group 3");
  assert.equal(third.pickCount, 1);
  assert.equal(third.optionCount, 3);
  assert.equal(third.metadata.groupIndex, 3);
  assert.equal(new Set(third.options.map((option) => option.id)).size, third.options.length, "The final group also has no internal duplicate cards");
  assert.equal(E.skipReward(loaded, meta), true);
  assert.equal(loaded.phase, "map", "Finishing the final independent group advances the dungeon");
}

{
  const run = E.newRun(490), meta = unlockedMeta();
  run.inventory = Object.values(ITEMS)
    .filter((item) => item.kind === "curse" && item.tier === 1)
    .flatMap((item) => Array(item.maxOwned).fill(item.id));
  run.route[0] = "treasure";
  run.resolvedRooms[0] = "curse_pit";
  run.phase = "curse_pit";
  assert.equal(E.chooseSpecial(run, "reach", meta), true);
  assert.equal(run.specialDecision?.candidates.length, 2);
  assert.ok(
    run.specialDecision.candidates.every((id) => ITEMS[id]?.kind === "curse" && ITEMS[id]?.tier === 0),
    "If themed and global same-tier curse pools are exhausted, curse choice falls back exactly one tier",
  );
}

{
  const blockedEffects = new Set([
    "turnStartApPenalty", "everyTwoCardsApLoss", "heavyTurnNextApLoss",
    "zeroCostTax", "contactCostUp", "thirdCardZeroAp",
  ]);
  for (let seed = 1; seed <= 40; seed++) {
    const run = E.newRun(600 + seed), meta = unlockedMeta();
    run.route[0] = "treasure";
    run.resolvedRooms[0] = "mercury_still";
    run.phase = "mercury_still";
    assert.equal(E.chooseSpecial(run, "overload", meta), true);
    assert.equal(run.specialDecision?.candidates.length, 3);
    assert.ok(run.specialDecision.candidates.every((id) => !blockedEffects.has(ITEMS[id]?.effect)),
      "Mercury +AP contract never offers a curse that directly cancels its AP reward");
  }
}

{
  const run = E.newRun(501), meta = unlockedMeta();
  run.route[0] = "treasure";
  run.resolvedRooms[0] = "curse_pit";
  run.phase = "curse_pit";
  assert.equal(E.chooseSpecial(run, "reach", meta), true);
  assert.equal(run.specialDecision?.type, "curse-choice");
  const curseId = run.specialDecision.candidates[0];
  assert.equal(E.chooseSpecialCurse(run, 0, meta), true);
  assert.ok(run.inventory.includes(curseId), "Curse-pit cost is committed before reward claim");
  const offer = E.currentRewardOffer(run), rewardItem = offer.options.find((option) => option.type === "item")?.id;
  assert.equal(E.skipReward(run), true);
  assert.ok(run.inventory.includes(curseId), "Skipping the reward does not refund the event cost");
  if (rewardItem) assert.ok(!run.inventory.includes(rewardItem), "Skipped event reward is not granted");
  assert.equal(run.phase, "map");
}

console.log("PASS Harmony Reward System: fixed node tables, optional claims, modifiers, persistence, Signature isolation, and event cost separation.");

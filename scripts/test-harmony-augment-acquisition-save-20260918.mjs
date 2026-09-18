import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import {
  CARDS,
  ITEMS,
} from "../games/harmony/data.js";
import {
  NEW_AUGMENT_CARDS,
  NEW_AUGMENT_ITEMS,
} from "../games/harmony/augment-pack-20260918.js";
import {
  createPersistenceRuntime,
} from "../games/harmony/persistence-runtime.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

function specialRun(seed, room) {
  const meta = E.freshMeta();
  const run = E.newRun(seed, null, meta);
  run.route = Array(12).fill(room);
  run.route[11] = "boss";
  run.resolvedRooms = Array(12).fill(null);
  run.resolvedRooms[0] = room;
  run.currentSubRoom = room;
  run.phase = room;
  run.specialResult = null;
  run.specialDecision = null;
  run.gold = 999;
  return { run, meta };
}

function rewardContains(run, id) {
  const offer = E.currentRewardOffer(run);
  return (offer?.options || []).some(
    (option) => option.type === "item" && option.id === id,
  );
}

function claimCurrentItem(run, meta, id) {
  const offer = E.currentRewardOffer(run);
  const option = (offer?.options || []).find(
    (candidate) => candidate.type === "item" && candidate.id === id,
  );
  assert.ok(option, `missing reward option for ${id}`);
  assert.equal(E.claimReward(run, option.optionId, meta), true);
  assert.ok(run.inventory.includes(id), `${id} must enter inventory after claim`);
  assert.ok(meta.discovered.includes(id), `${id} must enter discovery after claim`);
}

function assertSavedOwnership(run, meta, id) {
  const storage = new MemoryStorage(),
    bridge = createPersistenceRuntime({
      runtime: null,
      fallbackStorage: storage,
    });
  assert.equal(bridge.save({ meta, run }), 1);
  const loaded = bridge.reload();
  assert.ok(loaded.run?.inventory?.includes(id), `${id} inventory must survive save/load`);
  assert.ok(loaded.meta?.discovered?.includes(id), `${id} discovery must survive save/load`);
  return loaded;
}

function assertSavedCard(run, meta, id) {
  const storage = new MemoryStorage(),
    bridge = createPersistenceRuntime({
      runtime: null,
      fallbackStorage: storage,
    });
  assert.equal(bridge.save({ meta, run }), 1);
  const loaded = bridge.reload();
  assert.ok(
    loaded.run?.deck?.some((card) => card.id === id),
    `${id} deck ownership must survive save/load`,
  );
  assert.ok(
    loaded.meta?.discoveredCards?.includes(id),
    `${id} card discovery must survive save/load`,
  );
  return loaded;
}

function findEventReward({
  room,
  itemId,
  prepare = () => {},
  act,
  maxSeed = 20000,
}) {
  for (let seed = 1; seed <= maxSeed; seed++) {
    const { run, meta } = specialRun(seed, room);
    prepare(run, meta);
    const ok = act(run, meta);
    if (!ok) continue;
    if (run.phase === "reward" && rewardContains(run, itemId))
      return { run, meta, seed };
  }
  return null;
}

const eventIds = Object.values(NEW_AUGMENT_ITEMS)
  .filter((item) => Array.isArray(item.acquisition?.eventRooms))
  .map((item) => item.id);
const genericItemIds = Object.values(NEW_AUGMENT_ITEMS)
  .filter((item) => (item.acquisition?.rewardSources || []).length)
  .map((item) => item.id);
const shopItemIds = Object.values(NEW_AUGMENT_ITEMS)
  .filter((item) => item.acquisition?.shop !== false)
  .map((item) => item.id);

// Live reward profiles: every non-event new item must be reachable from one of
// its declared reward sources, and event-only items must never leak into them.
{
  const seen = new Set();
  const eventSeen = new Set();
  for (let seed = 1; seed <= 60000 && seen.size < genericItemIds.length; seed++) {
    const meta = E.freshMeta();
    const run = E.newRun(seed, null, meta);
    for (const room of ["golden", "elite", "boss"]) {
      const id = E.rollLoot(run, room, meta);
      if (genericItemIds.includes(id)) seen.add(id);
      if (eventIds.includes(id)) eventSeen.add(id);
    }
  }
  assert.deepEqual(
    genericItemIds.filter((id) => !seen.has(id)),
    [],
    "all generic/rare new augments must be reachable from declared live reward profiles",
  );
  assert.deepEqual([...eventSeen], [], "event-only augments must not leak into generic rewards");
}

// rollLoot exposure -> actual inventory acquisition -> discovery -> save/load.
{
  const targetId = "trait_hygroscopic_scent_strip";
  let found = null;
  for (let seed = 1; seed <= 30000 && !found; seed++) {
    const meta = E.freshMeta(),
      run = E.newRun(seed, null, meta),
      id = E.rollLoot(run, "golden", meta);
    if (id === targetId) found = { run, meta, seed };
  }
  assert.ok(found, "rollLoot must expose a new canonical augment");
  assert.equal(E.addInventoryItem(found.run, targetId, found.meta), true);
  assert.ok(found.run.inventory.includes(targetId));
  assert.ok(found.meta.discovered.includes(targetId));
  assertSavedOwnership(found.run, found.meta, targetId);
}

// Actual golden chest offer -> claim -> inventory/discovery -> save/load.
{
  const targetId = "trait_hygroscopic_scent_strip";
  let found = null;
  for (let seed = 1; seed <= 30000 && !found; seed++) {
    const meta = E.freshMeta(),
      run = E.newRun(seed, null, meta);
    run.route = Array(12).fill("golden");
    run.route[11] = "boss";
    run.resolvedRooms[0] = "golden";
    E.enter(run, meta);
    if (run.phase !== "chest" || !E.openChest(run, meta)) continue;
    const offer = E.currentRewardOffer(run),
      option = (offer?.options || []).find(
        (candidate) => candidate.type === "item" && candidate.id === targetId,
      );
    if (option) found = { run, meta, option };
  }
  assert.ok(found, "golden chest must expose a new canonical augment");
  assert.equal(E.claimReward(found.run, found.option.optionId, found.meta), true);
  assert.ok(found.run.inventory.includes(targetId));
  assert.ok(found.meta.discovered.includes(targetId));
  assertSavedOwnership(found.run, found.meta, targetId);
}

// Combat reward generation: all four new actives can appear.
{
  const target = new Set(Object.keys(NEW_AUGMENT_CARDS));
  const seen = new Set();
  for (let seed = 1; seed <= 15000 && seen.size < target.size; seed++) {
    const meta = E.freshMeta();
    const run = E.newRun(seed, Array(10).fill("contact_glass_dropper_strike"), meta);
    run.route = Array(12).fill("combat");
    run.route[11] = "boss";
    run.resolvedRooms[0] = "battle";
    E.enter(run, meta);
    run.battle.enemies = [run.battle.enemies[0]];
    E.attachEnemyAliases(run.battle);
    run.battle.enemies[0].hp = 1;
    run.battle.enemies[0].maxHp = 1;
    run.battle.enemies[0].shield = 0;
    run.battle.ap = 8;
    run.battle.hand = [{ id: "contact_glass_dropper_strike", level: 0 }];
    E.play(run, 0, meta);
    for (const option of E.currentRewardOffer(run)?.options || [])
      if (option.type === "card" && target.has(option.id)) seen.add(option.id);
  }
  assert.deepEqual(
    [...target].filter((id) => !seen.has(id)),
    [],
    "all four new active cards must be reachable from actual combat rewards",
  );
}

// Actual combat reward selection -> deck/discovery -> save/load.
{
  const targetId = "noncontact_broken_scent_sample";
  let found = null;
  for (let seed = 1; seed <= 20000 && !found; seed++) {
    const meta = E.freshMeta(),
      run = E.newRun(seed, Array(10).fill("contact_glass_dropper_strike"), meta);
    run.route = Array(12).fill("combat");
    run.route[11] = "boss";
    run.resolvedRooms[0] = "battle";
    E.enter(run, meta);
    run.battle.enemies = [run.battle.enemies[0]];
    E.attachEnemyAliases(run.battle);
    run.battle.enemies[0].hp = 1;
    run.battle.enemies[0].maxHp = 1;
    run.battle.enemies[0].shield = 0;
    run.battle.ap = 8;
    run.battle.hand = [{ id: "contact_glass_dropper_strike", level: 0 }];
    E.play(run, 0, meta);
    const offer = E.currentRewardOffer(run),
      option = (offer?.options || []).find(
        (candidate) => candidate.type === "card" && candidate.id === targetId,
      );
    if (option) found = { run, meta, option };
  }
  assert.ok(found, "combat reward must expose a new active card");
  assert.equal(E.claimReward(found.run, found.option.optionId, found.meta), true);
  assert.ok(found.run.deck.some((card) => card.id === targetId));
  assert.ok(found.meta.discoveredCards.includes(targetId));
  assertSavedCard(found.run, found.meta, targetId);
}

// Atelier live stock: every shop-enabled new entry is reachable; event/rare
// entries with shop=false never leak.
{
  const targetCards = Object.keys(NEW_AUGMENT_CARDS);
  const targetItems = shopItemIds;
  const seenCards = new Set();
  const seenItems = new Set();
  const forbiddenItems = new Set(
    Object.values(NEW_AUGMENT_ITEMS)
      .filter((item) => item.acquisition?.shop === false)
      .map((item) => item.id),
  );
  const leaked = new Set();
  for (
    let seed = 1;
    seed <= 30000 &&
    (seenCards.size < targetCards.length || seenItems.size < targetItems.length);
    seed++
  ) {
    const meta = E.freshMeta();
    const run = E.newRun(seed, null, meta);
    run.route = Array(12).fill("shop");
    run.route[11] = "boss";
    run.resolvedRooms[0] = "shop";
    E.enter(run, meta);
    for (const offer of E.shopOffers(run, meta)) {
      if (targetCards.includes(offer.id)) seenCards.add(offer.id);
      if (targetItems.includes(offer.id)) seenItems.add(offer.id);
      if (forbiddenItems.has(offer.id)) leaked.add(offer.id);
    }
  }
  assert.deepEqual(
    targetCards.filter((id) => !seenCards.has(id)),
    [],
    "all four new cards must be reachable in Atelier",
  );
  assert.deepEqual(
    targetItems.filter((id) => !seenItems.has(id)),
    [],
    "all shop-enabled new augments must be reachable in Atelier",
  );
  assert.deepEqual([...leaked], [], "shop=false augments must never appear in Atelier");
}

// Actual Atelier purchase -> inventory/discovery -> save/load.
{
  const targetId = "trait_hygroscopic_scent_strip";
  let found = null;
  for (let seed = 1; seed <= 30000 && !found; seed++) {
    const meta = E.freshMeta(),
      run = E.newRun(seed, null, meta);
    run.gold = 999;
    run.route = Array(12).fill("shop");
    run.route[11] = "boss";
    run.resolvedRooms[0] = "shop";
    E.enter(run, meta);
    const offers = E.shopOffers(run, meta),
      index = offers.findIndex(
        (offer) => offer.type === "augment" && offer.id === targetId,
      );
    if (index >= 0) found = { run, meta, index };
  }
  assert.ok(found, "Atelier must expose a shop-enabled new augment");
  assert.equal(E.shop(found.run, "offer", found.index, found.meta), true);
  assert.ok(found.run.inventory.includes(targetId));
  assert.ok(found.meta.discovered.includes(targetId));
  assertSavedOwnership(found.run, found.meta, targetId);
}

// Lab: explicit Phase Lens choice -> inventory + discovery.
{
  const { run, meta } = specialRun(1001, "lab");
  assert.equal(E.chooseSpecial(run, "phase_lens", meta), true);
  assert.ok(run.inventory.includes("relic_phase_crossing_lens"));
  assert.ok(meta.discovered.includes("relic_phase_crossing_lens"));
  assertSavedOwnership(run, meta, "relic_phase_crossing_lens");
}
{
  const { run, meta } = specialRun(10011, "mystery");
  assert.equal(
    E.chooseSpecial(run, "phase_lens", meta),
    false,
    "Phase Lens choice must not exist outside Lab",
  );
}

// Mercury Still: explicit Contaminated Essence choice -> inventory + drawback.
{
  const { run, meta } = specialRun(1002, "mercury_still");
  assert.equal(E.chooseSpecial(run, "contaminated_essence", meta), true);
  assert.ok(run.inventory.includes("relic_contaminated_perfumery_essence"));
  assert.ok(meta.discovered.includes("relic_contaminated_perfumery_essence"));
  assert.equal(run.pendingCorrosion, 2);
  assertSavedOwnership(run, meta, "relic_contaminated_perfumery_essence");
}
{
  const { run, meta } = specialRun(10021, "lab");
  assert.equal(
    E.chooseSpecial(run, "contaminated_essence", meta),
    false,
    "Contaminated Essence choice must not exist outside Mercury Still",
  );
}

// Mystery: seeded jackpot variant can expose Overflow Tube and claim it.
{
  const found = findEventReward({
    room: "mystery",
    itemId: "relic_overflow_fragrance_recovery_tube",
    act: (run, meta) => E.chooseSpecial(run, "gamble", meta),
  });
  assert.ok(found, "Mystery must be able to expose Overflow Tube");
  claimCurrentItem(found.run, found.meta, "relic_overflow_fragrance_recovery_tube");
  assertSavedOwnership(found.run, found.meta, "relic_overflow_fragrance_recovery_tube");
}

// Smuggler: contraband -> curse commitment -> seeded variant can expose tube.
{
  const found = findEventReward({
    room: "smuggler",
    itemId: "relic_overflow_fragrance_recovery_tube",
    act(run, meta) {
      if (!E.chooseSpecial(run, "contraband", meta)) return false;
      if (!run.specialDecision?.candidates?.length) return false;
      return E.chooseSpecialCurse(run, 0, meta);
    },
  });
  assert.ok(found, "Smuggler must be able to expose Overflow Tube");
  claimCurrentItem(found.run, found.meta, "relic_overflow_fragrance_recovery_tube");
  assertSavedOwnership(found.run, found.meta, "relic_overflow_fragrance_recovery_tube");
}

// Curse Pit: contract -> curse commitment -> seeded variant can expose Essence.
{
  const found = findEventReward({
    room: "curse_pit",
    itemId: "relic_contaminated_perfumery_essence",
    act(run, meta) {
      if (!E.chooseSpecial(run, "reach", meta)) return false;
      if (!run.specialDecision?.candidates?.length) return false;
      return E.chooseSpecialCurse(run, 0, meta);
    },
  });
  assert.ok(found, "Curse Pit must be able to expose Contaminated Essence");
  claimCurrentItem(found.run, found.meta, "relic_contaminated_perfumery_essence");
  assertSavedOwnership(found.run, found.meta, "relic_contaminated_perfumery_essence");
}

// Dice Altar: Roulette and, with prerequisite ownership, Turbid Core are actual
// reward options and enter inventory only after claim.
{
  const roulette = findEventReward({
    room: "dice_altar",
    itemId: "relic_impurity_reaction_roulette",
    act: (run, meta) => E.chooseSpecial(run, "reroll", meta),
  });
  assert.ok(roulette, "Dice Altar must be able to expose Impurity Roulette");
  claimCurrentItem(roulette.run, roulette.meta, "relic_impurity_reaction_roulette");
  assertSavedOwnership(roulette.run, roulette.meta, "relic_impurity_reaction_roulette");

  let coreWithoutPrerequisite = false;
  for (let seed = 1; seed <= 10000; seed++) {
    const { run, meta } = specialRun(seed, "dice_altar");
    if (!E.chooseSpecial(run, "reroll", meta)) continue;
    if (run.phase === "reward" && rewardContains(run, "relic_turbid_distillation_core")) {
      coreWithoutPrerequisite = true;
      break;
    }
  }
  assert.equal(
    coreWithoutPrerequisite,
    false,
    "Turbid Core must never be offered before Impurity Roulette is owned",
  );

  const core = findEventReward({
    room: "dice_altar",
    itemId: "relic_turbid_distillation_core",
    prepare(run, meta) {
      assert.equal(E.addInventoryItem(run, "relic_impurity_reaction_roulette", meta), true);
    },
    act: (run, meta) => E.chooseSpecial(run, "reroll", meta),
    maxSeed: 50000,
  });
  assert.ok(core, "Dice Altar must expose Turbid Core when Roulette is owned");
  claimCurrentItem(core.run, core.meta, "relic_turbid_distillation_core");
  assertSavedOwnership(core.run, core.meta, "relic_turbid_distillation_core");
}

// Save/load: inventory, new cards, discovery, temporary AP, counters, once flags,
// recovered-card AP0 and pending recovery selection survive supported mid-combat
// persistence. Runtime classifications remain derived, not serialized mutations.
{
  const storage = new MemoryStorage();
  const bridge = createPersistenceRuntime({
    runtime: null,
    fallbackStorage: storage,
  });
  const meta = E.freshMeta();
  const run = E.newRun(
    9001,
    [
      "noncontact_broken_scent_sample",
      "absorb_volatile_residue",
      "noncontact_ignitable_waste_blotter",
      "cycle_redistillation_recovery_fluid",
      ...Array(6).fill("guard_resonance_cover"),
    ],
    meta,
  );
  run.route = Array(12).fill("combat");
  run.route[11] = "boss";
  run.resolvedRooms[0] = "battle";
  E.enter(run, meta);
  E.addInventoryItem(run, "relic_phase_crossing_lens", meta);
  E.addInventoryItem(run, "relic_contaminated_perfumery_essence", meta);
  E.addInventoryItem(run, "relic_fractional_cost_reducer", meta);
  E.addInventoryItem(run, "relic_lossless_redistiller", meta);
  meta.discoveredCards.push("noncontact_broken_scent_sample");

  const discounted = {
    id: "noncontact_ignitable_waste_blotter",
    level: 0,
    _augmentTempCostReduction: 1,
    _augmentTempCostTurn: run.battle.turn,
  };
  const recovered = {
    id: "cycle_redistillation_recovery_fluid",
    level: 0,
    _augmentInstanceId: 77,
    _augmentFreeTurn: run.battle.turn,
  };
  run.battle.hand = [discounted, recovered];
  run.battle.discard = [
    {
      id: "noncontact_broken_scent_sample",
      level: 0,
      _augmentInstanceId: 78,
    },
  ];
  run.battle.pendingAugmentRecovery = {
    turn: run.battle.turn,
    instanceIds: [78],
  };
  run.battle._augmentExtraDrawCount = 2;
  run.battle._augmentActualDiscardsThisTurn = 3;
  run.battle._augmentThirdDiscardBurnTriggered = true;
  run.battle._augmentReshufflesThisCombat = 1;
  run.battle._augmentNextCardDiscount = 1;
  run.battle._augmentLosslessTriggered = true;

  assert.equal(bridge.save({ meta, run }), 1);
  const loaded = bridge.reload();
  const loadedRun = loaded.run;
  assert.ok(loadedRun.inventory.includes("relic_phase_crossing_lens"));
  assert.ok(loadedRun.inventory.includes("relic_contaminated_perfumery_essence"));
  assert.ok(loaded.meta.discovered.includes("relic_phase_crossing_lens"));
  assert.ok(loaded.meta.discoveredCards.includes("noncontact_broken_scent_sample"));
  assert.equal(loadedRun.battle._augmentExtraDrawCount, 2);
  assert.equal(loadedRun.battle._augmentActualDiscardsThisTurn, 3);
  assert.equal(loadedRun.battle._augmentThirdDiscardBurnTriggered, true);
  assert.equal(loadedRun.battle._augmentReshufflesThisCombat, 1);
  assert.equal(loadedRun.battle._augmentNextCardDiscount, 1);
  assert.equal(loadedRun.battle._augmentLosslessTriggered, true);

  const loadedDiscounted = loadedRun.battle.hand.find(
    (card) => card.id === "noncontact_ignitable_waste_blotter",
  );
  const loadedRecovered = loadedRun.battle.hand.find(
    (card) => card._augmentInstanceId === 77,
  );
  assert.equal(loadedDiscounted._augmentTempCostReduction, 1);
  assert.equal(loadedDiscounted._augmentTempCostTurn, loadedRun.battle.turn);
  assert.equal(loadedRecovered._augmentFreeTurn, loadedRun.battle.turn);
  assert.equal(E.cost(loadedRun, loadedRecovered), 0, "recovered-card AP0 must survive save/load");
  assert.deepEqual(
    E.pendingAugmentRecovery(loadedRun).map((card) => card.instanceId),
    [78],
  );
  assert.equal(
    E.effectiveCardAttackPattern(
      loadedRun,
      E.cardDefinition({ id: "noncontact_broken_scent_sample", level: 0 }),
    ),
    "contact",
    "Phase Lens state must be derived after load",
  );
  assert.equal(
    E.isEffectiveImpurityCard(
      loadedRun,
      { id: "noncontact_broken_scent_sample", level: 0 },
    ),
    true,
    "Contaminated Essence state must be derived after load",
  );
}

// Sanity: event-only IDs remain canonical but do not need generic reward reachability.
for (const id of eventIds) {
  assert.ok(ITEMS[id]);
  assert.equal(ITEMS[id].acquisition.shop, false);
}
for (const id of Object.keys(NEW_AUGMENT_CARDS)) assert.ok(CARDS[id]);

console.log("PASS Harmony augment acquisition/save: generic rewards, combat cards, Atelier, Mystery, Smuggler, Curse Pit, Dice, Lab, Mercury Still, discovery and mid-combat persistence verified.");

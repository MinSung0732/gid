import assert from "node:assert/strict";
import { ITEMS, LEGACY_BETA_ITEMS, ENABLE_LEGACY_BETA_AUGMENTS, CARDS, STARTING_DECK, RECOMMENDED_STARTING_DECK, getTier1Cards, ROUTE, EARLY_MONSTERS, ACT1_ELITES, ACT1_BOSSES, ACT2_MONSTERS, ACT2_ELITES, ACT2_BOSSES, ACT3_MONSTERS, ACT3_ELITES, ACT3_BOSSES } from "../games/harmony/data.js";
import { CONTACT_ATTACK_CARDS } from "../games/harmony/contact-cards.js";
import { NON_CONTACT_ATTACK_CARDS } from "../games/harmony/non-contact-cards.js";
import { BETA_CARDS } from "../games/harmony/beta-content.js";
import * as E from "../games/harmony/engine.js";
import { loadGame, saveGame, SAVE_KEYS } from "../games/harmony/persistence.js";
import {
  STATUS_DEFINITIONS,
  applyStatus,
  removeStatus,
  dispelStatuses,
  directDamage,
  damageTaken,
  shieldGain,
  extraCost,
  stacks,
  turns,
  tickDurations,
  modifier,
  restricted,
  canTarget,
} from "../games/harmony/statuses.js";
assert.equal(ENABLE_LEGACY_BETA_AUGMENTS, false);
assert.ok(Object.keys(LEGACY_BETA_ITEMS).length > 0, "Legacy beta augments remain available to tests");
assert.ok(Object.keys(LEGACY_BETA_ITEMS).every((id) => !ITEMS[id]), "Legacy beta augments stay out of the live item pool");
// The remaining legacy behavior tests opt into the archived augments explicitly.
Object.assign(ITEMS, LEGACY_BETA_ITEMS);
const lootRoomMatch = (item, room) => {
  if (item.signatureOnly || item.kind === "curse") return false;
  if (Array.isArray(item.rooms))
    return item.rooms.includes(room) || item.rooms.includes("all") ||
      (["gather", "golden"].includes(room) && item.rooms.includes("treasure"));
  if (room === "elite") return ["golden", "boss"].includes(item.room);
  if (room === "boss") return ["gather", "golden", "boss"].includes(item.room);
  return item.room === room;
};
for (const room of ["gather", "golden", "elite", "boss"]) {
  const s = E.newRun(123),
    seen = new Set(),
    expected = new Set(Object.values(ITEMS)
      .filter((item) => lootRoomMatch(item, room) && ["stat", "trait", "relic"].includes(item.kind))
      .map((item) => `${item.kind}/${item.tier}`));
  for (let i = 0; i < 10000; i++) {
    const item = ITEMS[E.rollLoot(s, room)];
    assert.equal(lootRoomMatch(item, room), true);
    seen.add(`${item.kind}/${item.tier}`);
  }
  assert.deepEqual(seen, expected, "Every configured kind/tier combination can appear in its room");
}
const meta = E.freshMeta();
assert.equal(meta.discoveredCards.length, new Set(STARTING_DECK).size);
assert.deepEqual(meta.discoveredCards, [...new Set(STARTING_DECK)]);
assert.deepEqual(meta.defeatedMonsters, []);
let s = E.newRun(12);
s.route[0] = "battle";
E.enter(s, meta);
assert.ok(
  s.battle.enemies.every((enemy) => meta.defeatedMonsters.includes(enemy.id)),
  "Entering combat records every encountered monster in the codex",
);
assert.equal(s.battle.hand.length, 5, "The first turn starts with 5 cards");
assert.equal(s.battle.ap, 3);
let attacker = E.newRun(31),
  attackerMeta = E.freshMeta();
attacker.route[0] = "battle";
attacker.inventory.push("gather_attack_0");
E.enter(attacker, attackerMeta);
attacker.battle.hand = [{ id: "strike", level: 0 }];
const enemyBefore = attacker.battle.hp;
E.play(attacker, 0, attackerMeta);
assert.equal(
  enemyBefore - attacker.battle.hp,
  8,
  "Card damage must include permanent attack",
);
attacker.battle.hp = 100;
attacker.battle.shield = 10;
attacker.battle.hand = [{ id: "weight", level: 0 }];
E.play(attacker, 0, attackerMeta);
assert.equal(
  attacker.battle.hp,
  89,
  "Converted shield damage must include permanent attack",
);
s.battle.hand = [{ id: "guard", level: 0 }];
s.battle.enemies.forEach(
  (enemy) => (enemy.intent = { type: "guard", value: 0 }),
);
s.battle.intent = { type: "attack", value: 10 };
E.play(s, 0, meta);
E.endTurn(s, meta);
assert.equal(
  s.hp,
  77,
  "Beta guard now supplies only its shield before the enemy attack",
);
assert.equal(s.battle.shield, 0);
s.battle.hand = [{ id: "impurity", level: 0 }];
assert.equal(E.play(s, 0, meta), false);
s.battle.hand = Array.from({ length: 6 }, () => ({ id: "breathe", level: 0 }));
E.play(s, 0, meta);
assert.ok(s.battle.hand.length <= 7);
let keep = E.newRun(91),
  keepMeta = E.freshMeta();
keep.route[0] = "battle";
E.enter(keep, keepMeta);
keep.battle.hand = [
  { id: "strike", level: 0, kept: true },
  { id: "guard", level: 0, kept: true },
];
keep.battle.enemies.forEach(
  (enemy) => (enemy.intent = { type: "guard", value: 0 }),
);
E.endTurn(keep, keepMeta);
assert.equal(keep.battle.hand.length, 5);
assert.equal(
  keep.battle.hand.filter((card) => card.kept).length,
  2,
  "Unused cards stay in hand",
);
assert.equal(keep.battle.drawnThisTurn, 3, "Base turn draw is 3");
s = E.newRun(20);
s.route[1] = "gather";
s.node = 1;
E.enter(s, meta);
E.openChest(s, meta);
assert.equal(s.inventory.length, 1);
assert.ok(
  s._goldFeedback > 0,
  "Gold rewards expose their actual gain for UI feedback",
);
assert.deepEqual(
  s.reward.cards,
  [],
  "Chest rewards passive items, never cards",
);
E.openChest(s, meta);
assert.equal(s.inventory.length, 1, "No duplicate chest award");
assert.equal(s.phase, "reward");
E.advance(s);
assert.equal(s.node, 2);
s = E.newRun(2);
s.route[0] = "battle";
E.enter(s, meta);
s.battle.hp = 99999;
s.battle.maxHp = 99999;
s.inventory = ["golden_carry_3"];
s.battle.shield = 1000;
s.battle.turn = 13;
s.battle.enemies.forEach(
  (enemy) => (enemy.intent = { type: "guard", value: 0 }),
);
E.endTurn(s, meta);
assert.equal(s.hp, 80, "Normal encounters do not enrage before turn 15");
s.battle.enemies.forEach(
  (enemy) => (enemy.intent = { type: "guard", value: 0 }),
);
E.endTurn(s, meta);
assert.equal(s.hp, 70, "Normal encounter enrage starts on turn 15 and ignores shields");
const bossEnrage = E.newRun(3), bossEnrageMeta = E.freshMeta();
bossEnrage.route[0] = "boss";
E.enter(bossEnrage, bossEnrageMeta);
bossEnrage.hp = 80;
bossEnrage.battle.turn = 18;
bossEnrage.battle.enemies.forEach(
  (enemy) => (enemy.intent = { type: "guard", value: 0 }),
);
E.endTurn(bossEnrage, bossEnrageMeta);
assert.equal(bossEnrage.hp, 80, "Boss encounters do not enrage before turn 20");
bossEnrage.battle.enemies.forEach(
  (enemy) => (enemy.intent = { type: "guard", value: 0 }),
);
E.endTurn(bossEnrage, bossEnrageMeta);
assert.equal(bossEnrage.hp, 70, "Boss encounter enrage starts on turn 20");
s = E.newRun(4);
s.route[0] = "battle";
s.inventory = ["golden_pyramid_2", "golden_echo_2"];
E.enter(s, meta);
s.battle.hp = 1000;
s.battle.hand = [
  "contact_beveled_scent_strip",
  "contact_direct_oil_dab",
  "contact_coating_slam",
].map((id) => ({ id, level: 0 }));
E.play(s, 0, meta);
E.play(s, 0, meta);
E.play(s, 0, meta);
assert.equal(s.battle.echoCount, 2);
assert.equal(s.battle.notes.length, 0);
assert.equal(s.battle.ap, 1);
// A complete 12-room journey, serialization and endless transition.
s = E.newRun(55);
for (let node = 0; node < 12; node++) {
  assert.equal(s.node, node);
  E.enter(s, meta);
  if (s.phase === "battle") {
    s.battle.enemies.forEach((enemy) => (enemy.hp = 0));
    s.battle.enemies[0].hp = 1;
    s.battle.selectedTarget = 0;
    s.battle.hand = [{ id: "strike", level: 0 }];
    E.play(s, 0, meta);
  }
  if (s.phase === "chest") E.openChest(s, meta);
  while (s.phase === "reward") E.advance(s);
  if (s.phase === "shop") E.shop(s, "leave");
  else if (s.phase === "rest") E.rest(s, "heal");
  else if (s.phase === "mystery") {
    E.chooseSpecial(s, "safe", meta);
    E.leaveSpecial(s);
  } else if (s.phase === "greenhouse") {
    E.chooseSpecial(s, "heal", meta);
    E.leaveSpecial(s);
  } else if (s.phase === "curse_pit") {
    E.chooseSpecial(s, "flee", meta);
    E.leaveSpecial(s);
  } else if (s.phase === "lab") {
    E.chooseSpecial(s, "note", meta, 0, "middle");
    E.leaveSpecial(s);
  } else if (["mercury_still", "blood_altar", "dice_altar", "purify_furnace", "mirror_doppel", "smuggler"].includes(s.phase)) {
    E.chooseSpecial(s, "skip", meta);
    E.leaveSpecial(s);
  }
  s = JSON.parse(JSON.stringify(s));
}
assert.equal(s.phase, "loop");
const inventory = [...s.inventory];
E.nextLoop(s, meta, true);
assert.equal(s.loop, 1);
assert.deepEqual(s.inventory, inventory);
assert.equal(s.node, 0);
s.route[0] = "battle";
E.enter(s, meta);
const restored = JSON.parse(JSON.stringify(s));
E.endTurn(s, meta);
E.endTurn(restored, structuredClone(meta));
assert.deepEqual(s, restored, "Resume retains RNG and battle state");
E.abandon(s, meta);
const total = meta.totalRuns;
E.abandon(s, meta);
assert.equal(meta.totalRuns, total, "Record once");
for (let seed = 1; seed <= 1000; seed++) {
  const route = E.newRun(seed).route;
  assert.equal(route.length, 12);
  assert.equal(route[0], "combat");
  assert.equal(route[11], "boss");
  assert.equal(route.filter((room) => room === "boss").length, 1);
  assert.ok(route.slice(0, 2).every((room) => room !== "elite"), "Act 1 elites start at the third room or later");
  assert.ok(route.filter((room) => room === "treasure").length >= 1);
  assert.ok(route.filter((room) => room === "treasure").length <= 2);
  assert.ok(route.filter((room) => room === "shop").length <= 1);
  assert.ok(route.filter((room) => room === "elite").length >= 1);
  assert.ok(route.filter((room) => room === "elite").length <= 2);
  assert.ok(route.every((room) => ["combat", "elite", "treasure", "shop", "boss"].includes(room)));
}
const roomRollRun = E.newRun(9876), roomRollCounts = {};
for (let index = 0; index < 10000; index++) {
  const room = E.rollSubRoom(roomRollRun, "treasure");
  roomRollCounts[room] = (roomRollCounts[room] || 0) + 1;
}
for (const room of ["gather", "mystery", "greenhouse", "golden", "curse_pit", "lab", "mercury_still", "blood_altar", "dice_altar", "purify_furnace", "mirror_doppel", "smuggler"])
  assert.ok(roomRollCounts[room] > 0);
assert.equal(
  Object.entries(roomRollCounts).sort((a, b) => b[1] - a[1])[0][0],
  "gather",
  "Gather remains the most common treasure sub-room",
);
assert.equal(E.rollSubRoom(roomRollRun, "boss"), "boss");
ITEMS.test_hand_limit = { effect: "handSize", value: 2 };
ITEMS.test_ap_limit = { effect: "apCap", value: 1 };
const future = E.newRun(9);
future.inventory = ["test_hand_limit", "test_ap_limit"];
assert.equal(E.handLimit(future), 9);
assert.equal(E.apLimit(future), 9);
delete ITEMS.test_hand_limit;
delete ITEMS.test_ap_limit;
assert.equal(E.newRun(10).deck.length, 10, "A new run starts with 10 cards");
assert.equal(E.MAX_DECK_SIZE, 20);
const fullDeck = E.newRun(11);
fullDeck.deck = Array.from({ length: E.MAX_DECK_SIZE }, () => ({
  id: "guard",
  level: 0,
}));
fullDeck.phase = "reward";
fullDeck.reward = { cards: ["strike"] };
assert.equal(
  E.advance(fullDeck, "strike"),
  false,
  "A full deck requires a replacement choice",
);
assert.equal(fullDeck.phase, "reward");
assert.equal(E.advance(fullDeck, "strike", 3), true);
assert.equal(fullDeck.deck.length, E.MAX_DECK_SIZE);
assert.equal(
  fullDeck.deck[3].id,
  "strike",
  "The selected deck card is replaced",
);
const cardDiscoveryRun = E.newRun(111),
  cardDiscoveryMeta = E.freshMeta();
cardDiscoveryRun.phase = "reward";
cardDiscoveryRun.reward = {
  cards: ["burst_spatial_diffusion"],
  cardPicksRemaining: 1,
};
assert.equal(
  E.advance(cardDiscoveryRun, "burst_spatial_diffusion", null, cardDiscoveryMeta),
  true,
);
assert.ok(cardDiscoveryMeta.discoveredCards.includes("burst_spatial_diffusion"));
ITEMS.test_deck_size = { effect: "deckSize", value: 3 };
const expandedDeck = E.newRun(13);
expandedDeck.inventory = ["test_deck_size"];
expandedDeck.deck = Array.from({ length: 20 }, () => ({
  id: "guard",
  level: 0,
}));
expandedDeck.phase = "reward";
expandedDeck.reward = { cards: ["strike"] };
assert.equal(
  E.deckLimit(expandedDeck),
  23,
  "Deck-size items extend the shared deck limit",
);
assert.equal(E.advance(expandedDeck, "strike"), true);
assert.equal(
  expandedDeck.deck.length,
  21,
  "Cards can be added up to the extended limit",
);
delete ITEMS.test_deck_size;
const shopper = E.newRun(14);
shopper.phase = "shop";
shopper.gold = 30;
assert.equal(E.shop(shopper, "potion"), true);
assert.equal(shopper.gold, 5);
assert.equal(
  shopper._goldSpentFeedback,
  25,
  "Successful purchases expose the spent gold for UI feedback",
);
const potionsAfterPurchase = shopper.potions;
assert.equal(E.shop(shopper, "potion"), false);
assert.equal(shopper.gold, 5);
assert.equal(
  shopper.potions,
  potionsAfterPurchase,
  "Failed purchases change nothing",
);
assert.equal(shopper._goldSpentFeedback, 25);
const potionCapRun = E.newRun(1401);
assert.equal(
  E.potionLimit(potionCapRun),
  3,
  "Potion capacity defaults to three without a slot trait or relic",
);
potionCapRun.inventory.push("relic_travelers_cork_stopper");
assert.equal(
  E.potionLimit(potionCapRun),
  4,
  "Potion-slot relics increase the default capacity",
);
potionCapRun.hp = 40;
assert.equal(E.potion(potionCapRun), true, "A usable potion reports success");
assert.equal(potionCapRun.hp, 60);
potionCapRun.hp = potionCapRun.maxHp;
assert.equal(
  E.potion(potionCapRun),
  false,
  "A potion reports failure when no healing can occur",
);
const itemDiscoveryRun = E.newRun(141), itemDiscoveryMeta = E.freshMeta();
assert.equal(E.addInventoryItem(itemDiscoveryRun, "gather_attack_0", itemDiscoveryMeta), true);
assert.ok(itemDiscoveryMeta.discovered.includes("gather_attack_0"));
assert.equal(ROUTE.length, 12);
assert.ok(Object.keys(CARDS).length >= 10);
const attackCards = Object.values(CARDS).filter(
  (card) => card.attack || card.burst || card.weight,
);
assert.ok(
  attackCards.length > 0 &&
    attackCards.every((card) =>
      ["contact", "nonContact"].includes(card.attackPattern),
    ),
  "Every attack card declares a contact pattern",
);
const thornContact = E.newRun(826),
  thornContactMeta = E.freshMeta();
thornContact.route[0] = "battle";
E.enter(thornContact, thornContactMeta);
thornContact.battle.hp = 100;
thornContact.battle.maxHp = 100;
thornContact.battle.hand = [
  { id: "strike", level: 0 },
  { id: "amber", level: 0 },
];
E.addStatus(thornContact, "enemy", "thorns", 3);
E.play(thornContact, 0, thornContactMeta);
assert.equal(thornContact.hp, 77, "Contact cards trigger enemy thorns");
assert.equal(stacks(thornContact.battle, "thorns"), 2);
CARDS.test_harmony_top = { cost: 0, note: "top", shield: 1 };
CARDS.test_harmony_middle = { cost: 0, note: "middle", shield: 1 };
CARDS.test_harmony_base = { cost: 0, note: "base", shield: 1 };
ITEMS.test_harmony_attack = {
  id: "test_harmony_attack",
  kind: "stat",
  effect: "attack",
  value: 4,
};
const baseHarmony = E.newRun(8261), baseHarmonyMeta = E.freshMeta();
baseHarmony.route[0] = "battle";
baseHarmony.inventory = ["test_harmony_attack"];
E.enter(baseHarmony, baseHarmonyMeta);
baseHarmony.battle.hp = 100;
baseHarmony.battle.maxHp = 100;
baseHarmony.battle.hand = [
  { id: "test_harmony_top", level: 0 },
  { id: "test_harmony_middle", level: 0 },
  { id: "test_harmony_base", level: 0 },
];
E.play(baseHarmony, 0, baseHarmonyMeta);
E.play(baseHarmony, 0, baseHarmonyMeta);
assert.equal(baseHarmony._harmonyFeedback, undefined);
E.play(baseHarmony, 0, baseHarmonyMeta);
assert.equal(
  baseHarmony.battle.hp,
  99,
  "Top, middle and base trigger base HARMONY damage independently of card attack",
);
assert.deepEqual(baseHarmony.battle.notes, []);
assert.deepEqual(baseHarmony._harmonyFeedback, [
  {
    id: "base_harmony",
    label: "HARMONY!",
    visual: "default",
    damage: 1,
    blocked: 0,
    targetIndex: 0,
  },
]);
assert.equal(E.BASE_HARMONY_EFFECT.baseDamage, 1);
assert.equal(E.BASE_HARMONY_EFFECT.attackMultiplier, 1);
delete CARDS.test_harmony_top;
delete CARDS.test_harmony_middle;
delete CARDS.test_harmony_base;
delete ITEMS.test_harmony_attack;
E.play(thornContact, 0, thornContactMeta);
assert.equal(
  thornContact.hp,
  77,
  "Non-contact cards do not trigger enemy thorns",
);
assert.equal(stacks(thornContact.battle, "thorns"), 2);
const shieldedEnemyThorns = E.newRun(827),
  shieldedEnemyThornsMeta = E.freshMeta();
shieldedEnemyThorns.route[0] = "battle";
E.enter(shieldedEnemyThorns, shieldedEnemyThornsMeta);
shieldedEnemyThorns.battle.enemyShield = 100;
shieldedEnemyThorns.battle.hand = [{ id: "strike", level: 0 }];
E.addStatus(shieldedEnemyThorns, "enemy", "thorns", 3);
const shieldedEnemyHp = shieldedEnemyThorns.battle.hp;
E.play(shieldedEnemyThorns, 0, shieldedEnemyThornsMeta);
assert.equal(
  shieldedEnemyThorns.battle.hp,
  shieldedEnemyHp,
  "Enemy shield can fully block a contact attack",
);
assert.equal(
  shieldedEnemyThorns.hp,
  77,
  "Enemy thorns retaliate even when shield blocks all contact damage",
);
assert.equal(stacks(shieldedEnemyThorns.battle, "thorns"), 2);

const shieldedPlayerThorns = E.newRun(828),
  shieldedPlayerThornsMeta = E.freshMeta();
shieldedPlayerThorns.route[0] = "battle";
E.enter(shieldedPlayerThorns, shieldedPlayerThornsMeta);
shieldedPlayerThorns.battle.shield = 100;
shieldedPlayerThorns.battle.enemies.slice(1).forEach((enemy) => (enemy.hp = 0));
shieldedPlayerThorns.battle.enemies[0].intent = {
  type: "attack",
  value: 5,
  attackPattern: "contact",
};
E.addStatus(shieldedPlayerThorns, "player", "thorns", 3);
const attackingEnemyHp = shieldedPlayerThorns.battle.hp;
E.endTurn(shieldedPlayerThorns, shieldedPlayerThornsMeta);
assert.equal(
  shieldedPlayerThorns.hp,
  80,
  "Player shield can fully block an enemy contact attack",
);
assert.equal(
  shieldedPlayerThorns.battle.hp,
  attackingEnemyHp - 3,
  "Player thorns retaliate even when shield blocks all contact damage",
);
for (const room of ["gather", "golden", "elite", "boss"]) {
  const capped = E.newRun(77),
    roomItems = Object.values(ITEMS).filter((item) => lootRoomMatch(item, room));
  capped.inventory = roomItems.flatMap((item) =>
    Array(item.maxOwned).fill(item.id),
  );
  assert.equal(
    E.rollLoot(capped, room),
    null,
    `${room} must stop dropping capped items`,
  );
}
class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}
const storage = new MemoryStorage(),
  savedRun = E.newRun(808),
  savedMeta = E.freshMeta();
let revision = saveGame(storage, { meta: savedMeta, run: savedRun });
savedRun.gold = 25;
revision = saveGame(storage, { meta: savedMeta, run: savedRun }, revision);
assert.equal(loadGame(storage).run.gold, 25, "Latest valid save loads");
storage.setItem(SAVE_KEYS.primary, '{"broken":true}');
const recovered = loadGame(storage);
assert.equal(
  recovered.run.gold,
  0,
  "Corrupt primary falls back to previous backup",
);
assert.equal(recovered.recovered, true);
storage.setItem(
  SAVE_KEYS.primary,
  '{"schemaVersion":2,"revision":99,"payload":{},"checksum":"bad"}',
);
assert.equal(loadGame(storage).run.gold, 0, "Checksum rejects tampered save");
assert.equal(
  Object.keys(STATUS_DEFINITIONS).length,
  26,
  "Existing statuses, action-control statuses and intimidation exist",
);
assert.equal(
  Object.values(STATUS_DEFINITIONS).filter(
    (status) => status.category === "duration",
  ).length,
  8,
  "Eight duration statuses exist",
);
assert.equal(
  Object.values(STATUS_DEFINITIONS).filter(
    (status) => status.category === "control",
  ).length,
  9,
  "Nine action-control statuses exist",
);
const betaCardStatuses = new Set(
  Object.values(BETA_CARDS).flatMap((card) => [
    ...Object.keys(card.applyPlayer || {}),
    ...Object.keys(card.applyEnemy || {}),
  ]),
);
assert.equal(
  betaCardStatuses.size,
  0,
  "Beta cards no longer carry temporary status-test effects",
);
const source = { statuses: {} },
  target = { statuses: {} };
applyStatus(source, "weak", 2);
applyStatus(source, "concentration", 3);
applyStatus(target, "vulnerable", 2);
applyStatus(target, "corrosion", 2);
assert.equal(
  directDamage(10, source, target),
  12,
  "Weak, concentration and vulnerable modify direct damage",
);
assert.equal(shieldGain(10, target), 8, "Corrosion reduces shield gain");
applyStatus(source, "overload", 7);
assert.equal(
  extraCost(source),
  2,
  "Overload increases AP cost every three stacks",
);
assert.equal(removeStatus(source, "overload", 2), 2);
applyStatus(source, "poison", 4);
applyStatus(source, "thorns", 3);
assert.equal(
  dispelStatuses(source, { tags: ["debuff"] }),
  3,
  "Future cleanse removes matching debuffs",
);
assert.ok(source.statuses.thorns, "Cleanse leaves buffs intact");
const durationTarget = { statuses: {} };
applyStatus(durationTarget, "regeneration", { stacks: 3, turns: 2 });
applyStatus(durationTarget, "regeneration", { stacks: 2, turns: 1 });
assert.equal(
  stacks(durationTarget, "regeneration"),
  5,
  "Duration status values stack",
);
assert.equal(
  turns(durationTarget, "regeneration"),
  2,
  "Refresh never shortens remaining duration",
);
tickDurations(durationTarget, "afterTrigger");
assert.equal(turns(durationTarget, "regeneration"), 1);
tickDurations(durationTarget, "afterTrigger");
assert.equal(
  stacks(durationTarget, "regeneration"),
  0,
  "Duration status expires at zero turns",
);
applyStatus(durationTarget, "protection", { stacks: 2, turns: 2 });
assert.equal(
  directDamage(10, { statuses: {} }, durationTarget),
  8,
  "Protection reduces incoming direct damage per stack",
);
assert.equal(
  directDamage(10, { statuses: {} }, { statuses: {} }),
  10,
  "Protection does not affect unprotected targets",
);
const timedSource = { statuses: {} },
  timedTarget = { statuses: {} };
applyStatus(timedSource, "strength", { stacks: 2, turns: 2 });
assert.equal(
  directDamage(10, timedSource, timedTarget),
  12,
  "Strength increases outgoing direct damage",
);
applyStatus(timedTarget, "intangible", { stacks: 1, turns: 1 });
assert.equal(
  directDamage(10, { statuses: {} }, timedTarget),
  5,
  "Intangible reduces direct damage",
);
assert.equal(
  damageTaken(9, timedTarget),
  5,
  "Intangible also reduces non-direct damage",
);
applyStatus(timedTarget, "shieldRetention", { stacks: 2, turns: 2 });
assert.equal(
  modifier(timedTarget, "shieldRetention"),
  0.4,
  "Shield retention uses a reusable modifier",
);
applyStatus(timedTarget, "scentBlock", { stacks: 1, turns: 1 });
assert.equal(
  restricted(timedTarget, "notes"),
  true,
  "Scent block exposes its restriction",
);
assert.equal(
  canTarget("scentBlock", "enemy"),
  false,
  "Player-only duration statuses reject enemies",
);
applyStatus(timedTarget, "scentBlock", { stacks: 1, turns: 3 });
assert.equal(
  stacks(timedTarget, "scentBlock"),
  1,
  "Replace statuses do not add stacks",
);
assert.equal(
  turns(timedTarget, "scentBlock"),
  3,
  "Replace statuses can refresh duration",
);
const durationRun = E.newRun(818),
  durationMeta = E.freshMeta();
durationRun.route[0] = "battle";
E.enter(durationRun, durationMeta);
durationRun.hp = 50;
durationRun.battle.enemies.forEach(
  (enemy) => (enemy.intent = { type: "guard", value: 0 }),
);
E.addStatus(durationRun, "player", "regeneration", { stacks: 4, turns: 2 });
E.addStatus(durationRun, "player", "protection", { stacks: 1, turns: 2 });
E.endTurn(durationRun, durationMeta);
assert.equal(
  durationRun.hp,
  54,
  "Regeneration heals at the next player turn start",
);
assert.equal(
  turns(durationRun, "regeneration"),
  1,
  "Regeneration ticks after triggering",
);
assert.equal(
  turns(durationRun, "protection"),
  1,
  "Protection ticks at turn end",
);
const bleedRun = E.newRun(820),
  bleedMeta = E.freshMeta();
bleedRun.route[0] = "battle";
E.enter(bleedRun, bleedMeta);
bleedRun.hp = 50;
bleedRun.battle.hand = [{ id: "breathe", level: 0 }];
bleedRun.battle.enemies.forEach(
  (enemy) => (enemy.intent = { type: "guard", value: 0 }),
);
E.addStatus(bleedRun, "player", "bleed", { stacks: 2, turns: 2 });
E.addStatus(bleedRun, "player", "burning", { stacks: 3, turns: 2 });
E.play(bleedRun, 0, bleedMeta);
assert.equal(bleedRun.hp, 48, "Bleed triggers after an action");
E.endTurn(bleedRun, bleedMeta);
assert.equal(bleedRun.hp, 43, "Bleed and burning trigger at turn end");
assert.equal(turns(bleedRun, "bleed"), 1);
assert.equal(turns(bleedRun, "burning"), 1);
const blockedNotes = E.newRun(821),
  blockedMeta = E.freshMeta();
blockedNotes.route[0] = "battle";
blockedNotes.inventory = ["golden_pyramid_2"];
E.enter(blockedNotes, blockedMeta);
blockedNotes.battle.hand = [{ id: "citrus", level: 0 }];
E.addStatus(blockedNotes, "player", "scentBlock", { stacks: 1, turns: 1 });
E.play(blockedNotes, 0, blockedMeta);
assert.equal(
  blockedNotes.battle.notes.length,
  0,
  "Scent block prevents notes from accumulating",
);
assert.equal(
  E.addStatus(blockedNotes, "enemy", "scentBlock", { stacks: 1, turns: 1 }),
  0,
  "Target rules are enforced by the engine API",
);
const retained = E.newRun(822),
  retainedMeta = E.freshMeta();
retained.route[0] = "battle";
E.enter(retained, retainedMeta);
retained.battle.shield = 10;
retained.battle.enemies.forEach(
  (enemy) => (enemy.intent = { type: "guard", value: 0 }),
);
E.addStatus(retained, "player", "shieldRetention", { stacks: 2, turns: 1 });
E.endTurn(retained, retainedMeta);
assert.equal(
  retained.battle.shield,
  4,
  "Shield retention carries its percentage into the next turn",
);
assert.equal(
  stacks(retained, "shieldRetention"),
  0,
  "One-turn shield retention expires after applying",
);
const burnKill = E.newRun(823),
  burnKillMeta = E.freshMeta();
burnKill.route[0] = "battle";
E.enter(burnKill, burnKillMeta);
burnKill.battle.enemies.slice(1).forEach((enemy) => (enemy.hp = 0));
burnKill.battle.hp = 2;
burnKill.battle.enemies.forEach(
  (enemy) => (enemy.intent = { type: "guard", value: 0 }),
);
E.addStatus(burnKill, "enemy", "burning", { stacks: 2, turns: 1 });
E.endTurn(burnKill, burnKillMeta);
assert.equal(burnKill.battle.hp, 0);
assert.equal(
  burnKill.phase,
  "reward",
  "Duration damage deaths enter the normal reward flow",
);
assert.deepEqual(
  burnKill._damageFeedback,
  [{ target: "enemy", amount: 2, statusId: "burning", targetIndex: 0 }],
  "Duration damage reports its target, amount and status",
);
const poisonKill = E.newRun(824),
  poisonKillMeta = E.freshMeta();
poisonKill.route[0] = "battle";
E.enter(poisonKill, poisonKillMeta);
poisonKill.battle.enemies.slice(1).forEach((enemy) => (enemy.hp = 0));
poisonKill.battle.hp = 3;
poisonKill.battle.enemies.forEach(
  (enemy) => (enemy.intent = { type: "guard", value: 0 }),
);
E.addStatus(poisonKill, "enemy", "poison", 3);
E.endTurn(poisonKill, poisonKillMeta);
assert.equal(poisonKill.battle.hp, 0);
assert.equal(
  poisonKill.phase,
  "reward",
  "Poison deaths enter the normal reward flow",
);
assert.deepEqual(
  poisonKill._damageFeedback,
  [{ target: "enemy", amount: 3, statusId: "poison", targetIndex: 0 }],
  "Poison damage is reported separately",
);
const playerDot = E.newRun(825),
  playerDotMeta = E.freshMeta();
playerDot.route[0] = "battle";
E.enter(playerDot, playerDotMeta);
playerDot.hp = 20;
playerDot.battle.enemies.forEach(
  (enemy) => (enemy.intent = { type: "guard", value: 0 }),
);
E.addStatus(playerDot, "player", "burning", { stacks: 3, turns: 1 });
E.endTurn(playerDot, playerDotMeta);
assert.deepEqual(
  playerDot._damageFeedback,
  [{ target: "player", amount: 3, statusId: "burning" }],
  "Player status damage reports a player target",
);
const durationStorage = new MemoryStorage(),
  durationSaved = E.newRun(819);
durationSaved.statuses.regeneration = { stacks: 6, turns: 3 };
saveGame(durationStorage, { meta: E.freshMeta(), run: durationSaved });
const durationLoaded = loadGame(durationStorage).run;
assert.deepEqual(
  durationLoaded.statuses.regeneration,
  { stacks: 6, turns: 3 },
  "Save data preserves duration stacks and turns",
);
assert.equal(
  Object.keys(CONTACT_ATTACK_CARDS).length,
  10,
  "Ten contact attack cards live in their separate content module",
);
assert.ok(
  Object.keys(CONTACT_ATTACK_CARDS).every(
    (id) => CARDS[id] === CONTACT_ATTACK_CARDS[id],
  ),
  "Separated contact cards are merged into the live card pool",
);
const contactCombat = (seed, id) => {
  const run = E.newRun(seed),
    meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.hp = 100;
  run.battle.maxHp = 100;
  run.battle.hand = [{ id, level: 0 }];
  return { run, meta };
};
let contactCase = contactCombat(830, "contact_fierce_rub");
E.addStatus(contactCase.run, "enemy", "thorns", 3);
E.play(contactCase.run, 0, contactCase.meta);
assert.equal(
  contactCase.run.battle.hp,
  91,
  "Multi-hit contact damage resolves once per hit",
);
assert.equal(
  contactCase.run.hp,
  74,
  "Each contact hit independently triggers the remaining thorn stacks",
);
assert.equal(stacks(contactCase.run.battle, "thorns"), 0);
contactCase = contactCombat(831, "contact_coating_slam");
contactCase.run.battle.shield = 20;
E.play(contactCase.run, 0, contactCase.meta);
assert.equal(
  contactCase.run.battle.hp,
  90,
  "Shield scaling adds 25% of current shield to one attack",
);
assert.equal(
  contactCase.run.battle.shield,
  20,
  "Shield scaling does not consume player shield",
);
contactCase = contactCombat(832, "contact_grind_refine");
contactCase.run.battle.enemyShield = 8;
E.play(contactCase.run, 0, contactCase.meta);
assert.equal(contactCase.run.battle.enemyShield, 0);
assert.equal(contactCase.run.battle.hp, 97);
assert.equal(
  contactCase.run.battle.ap,
  2,
  "Breaking enemy shield refunds one AP after paying the card cost",
);
contactCase = contactCombat(833, "contact_glass_dropper_strike");
contactCase.run.battle.hand.push({ id: "contact_perfumers_touch", level: 0 });
E.play(contactCase.run, 0, contactCase.meta);
E.play(contactCase.run, 0, contactCase.meta);
assert.equal(
  contactCase.run.battle.hp,
  74,
  "Perfumer's Touch gains its bonus after a prior contact card",
);
contactCase = contactCombat(834, "contact_direct_oil_dab");
E.play(contactCase.run, 0, contactCase.meta);
assert.equal(
  contactCase.run.battle.absorb,
  4,
  "Direct Oil Dab triggers its absorb-bearing oil effect",
);
assert.equal(
  contactCase.run._absorbFeedback,
  4,
  "Absorb gains expose their actual amount for UI feedback",
);
const porousRun = E.newRun(8341),
  porousMeta = E.freshMeta();
porousRun.route[0] = "battle";
E.enter(porousRun, porousMeta);
porousRun.inventory = ["gather_absorb_0"];
porousRun.battle.absorb = 20;
porousRun.battle.ap = 1;
delete porousRun._absorbFeedback;
E.executePlayerTurnEnd(porousRun, porousMeta);
assert.equal(
  porousRun.battle.absorb,
  19,
  "Absorb loses ten percent before Porous Grain converts remaining AP",
);
assert.equal(
  porousRun._absorbFeedback,
  1,
  "Porous Grain reports the Absorb gained from remaining AP",
);
assert.equal(
  porousRun._absorbLossFeedback,
  2,
  "Turn-end Absorb decay reports the actual amount lost",
);
assert.equal(
  Object.keys(NON_CONTACT_ATTACK_CARDS).length,
  10,
  "Ten non-contact attack cards live in their separate content module",
);
assert.ok(
  Object.keys(NON_CONTACT_ATTACK_CARDS).every(
    (id) =>
      CARDS[id] === NON_CONTACT_ATTACK_CARDS[id] &&
      CARDS[id].attackPattern === "nonContact",
  ),
  "Separated non-contact cards are merged into the live card pool",
);
let nonContactCase = contactCombat(835, "noncontact_fine_mist_spray");
E.addStatus(nonContactCase.run, "enemy", "thorns", 3);
E.play(nonContactCase.run, 0, nonContactCase.meta);
assert.equal(nonContactCase.run.hp, 80, "Non-contact attacks ignore thorns");
assert.equal(nonContactCase.run.battle.hp, 93);
assert.equal(stacks(nonContactCase.run.battle, "resonance"), 2);
nonContactCase = contactCombat(836, "noncontact_alcohol_flash");
E.addStatus(nonContactCase.run, "enemy", "burning", {
  stacks: 3,
  turns: 2,
});
E.play(nonContactCase.run, 0, nonContactCase.meta);
assert.equal(
  nonContactCase.run.battle.hp,
  86,
  "Alcohol Flash gains two damage per Burning stack",
);
nonContactCase = contactCombat(837, "noncontact_spatial_resonance_wave");
E.addStatus(nonContactCase.run, "enemy", "resonance", 4);
E.play(nonContactCase.run, 0, nonContactCase.meta);
assert.equal(nonContactCase.run.battle.hp, 78);
assert.equal(
  stacks(nonContactCase.run.battle, "resonance"),
  0,
  "Spatial Resonance Wave consumes all Resonance after adding damage",
);
nonContactCase = contactCombat(838, "noncontact_essential_diffuse");
nonContactCase.run.battle.absorb = 7;
E.play(nonContactCase.run, 0, nonContactCase.meta);
assert.equal(nonContactCase.run.battle.hp, 88);
assert.equal(
  nonContactCase.run.battle.absorb,
  7,
  "Essential Diffuse adds but does not consume Absorb",
);
nonContactCase = contactCombat(839, "noncontact_scent_shockwave");
nonContactCase.run.battle.intent = { type: "attack", value: 8 };
E.play(nonContactCase.run, 0, nonContactCase.meta);
assert.equal(
  stacks(nonContactCase.run.battle, "vulnerable"),
  2,
  "Scent Shockwave applies Vulnerable against an attack intent",
);
nonContactCase = contactCombat(8391, "noncontact_atelier_draught");
nonContactCase.run.battle.hand.push(
  { id: "impurity", level: 0 },
  { id: "impurity", level: 0 },
);
E.play(nonContactCase.run, 0, nonContactCase.meta);
assert.equal(
  nonContactCase.run.battle.hand.filter((card) => card.id === "impurity")
    .length,
  1,
  "Atelier Draught permanently purges one Impurity from the hand",
);
const controlCombat = (seed, hand = ["strike", "guard"]) => {
  const run = E.newRun(seed),
    meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.hp = 100;
  run.battle.maxHp = 100;
  run.battle.hand = hand.map((id) => ({ id, level: 0 }));
  run.battle.enemies.forEach(
    (enemy) => (enemy.intent = { type: "guard", value: 0 }),
  );
  return { run, meta };
};
let control = controlCombat(840);
assert.equal(E.addStatus(control.run, "player", "stun"), 1);
assert.equal(
  E.canPlay(control.run, control.run.battle.hand[0]),
  false,
  "Player stun blocks every card",
);
E.endTurn(control.run, control.meta);
assert.equal(control.run.stunResistance, 1);
assert.equal(
  E.addStatus(control.run, "player", "stun"),
  0,
  "Resolved stun grants resistance against one consecutive stun",
);
control = controlCombat(841);
E.addStatus(control.run, "player", "seal", {
  stacks: 1,
  turns: 2,
  notes: ["top"],
});
assert.equal(
  E.canPlay(control.run, control.run.battle.hand[0]),
  false,
  "Seal blocks its selected note",
);
assert.equal(
  E.canPlay(control.run, control.run.battle.hand[1]),
  true,
  "Seal leaves unselected notes available",
);
control = controlCombat(842);
ITEMS.test_silenced_trait = { kind: "trait", effect: "oilShield", value: 7 };
ITEMS.test_unsilenced_stat = { kind: "stat", effect: "attack", value: 2 };
control.run.inventory = ["test_silenced_trait", "test_unsilenced_stat"];
E.addStatus(control.run, "player", "silence", { stacks: 1, turns: 2 });
assert.equal(
  E.power(control.run, "oilShield"),
  0,
  "Silence suppresses traits and relics",
);
assert.equal(
  E.power(control.run, "attack"),
  2,
  "Silence does not suppress stat items",
);
delete ITEMS.test_silenced_trait;
delete ITEMS.test_unsilenced_stat;
control = controlCombat(843, ["breathe"]);
control.run.battle.draw = [
  { id: "guard", level: 0 },
  { id: "strike", level: 0 },
];
E.addStatus(control.run, "player", "bind", { stacks: 1, turns: 2 });
E.play(control.run, 0, control.meta);
assert.equal(
  control.run.battle.hand.length,
  1,
  "Bind reduces card draw by its stack count",
);
control = controlCombat(844);
E.addStatus(control.run, "player", "confusion", {
  stacks: 2,
  turns: 2,
  cardTypes: ["attack"],
});
assert.equal(
  E.cost(control.run, control.run.battle.hand[0]),
  3,
  "Confusion changes selected card costs",
);
assert.equal(
  E.cost(control.run, control.run.battle.hand[1]),
  1,
  "Confusion leaves unselected card types unchanged",
);
control = controlCombat(845, ["strike"]);
control.run.rng = 0;
E.addStatus(control.run, "player", "interference", { stacks: 5, turns: 2 });
const hpBeforeInterference = control.run.battle.hp;
assert.equal(E.play(control.run, 0, control.meta), true);
assert.equal(
  control.run.battle.hp,
  hpBeforeInterference,
  "A failed card still spends the action without its effect",
);
control = controlCombat(846);
E.addStatus(control.run, "player", "disarm", { stacks: 1, turns: 2 });
assert.equal(
  E.canPlay(control.run, control.run.battle.hand[0]),
  false,
  "Disarm blocks attack cards",
);
assert.equal(
  E.canPlay(control.run, control.run.battle.hand[1]),
  true,
  "Disarm permits defensive cards",
);
control = controlCombat(847);
control.run.battle.notes = [{ id: "strike", level: 0, note: "top" }];
assert.equal(E.addStatus(control.run, "player", "noteCollapse"), 1);
assert.equal(
  control.run.battle.notes.length,
  0,
  "Note Collapse immediately clears the accumulated sequence",
);
control = controlCombat(848, ["impurity"]);
E.addStatus(control.run, "player", "impurityLock", { stacks: 1, turns: 2 });
assert.equal(
  E.canDiscard(control.run, control.run.battle.hand[0]),
  false,
  "Impurity Lock exposes a discard and replacement restriction hook",
);

const makeEnemy = (name, overrides = {}) => ({
  id: "normal",
  name,
  hp: 20,
  maxHp: 20,
  shield: 0,
  intent: { type: "guard", value: 0 },
  statuses: {},
  isElite: false,
  isBoss: false,
  stunResistance: 0,
  ...overrides,
});
const multiCombat = (seed = 900) => {
  const run = E.newRun(seed),
    meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemies = [makeEnemy("A"), makeEnemy("B"), makeEnemy("C")];
  run.battle.selectedTarget = 0;
  E.attachEnemyAliases(run.battle);
  run.battle.ap = 9;
  return { run, meta };
};
assert.equal(CARDS.burst_spatial_diffusion.burstMultiplier, 3.2);
assert.deepEqual(
  CARDS.burst_spatial_diffusion.upgrades.burstMultiplier,
  [3.2, 4.5],
  "Spatial Diffusion exposes its base and upgraded multipliers",
);
let spatialDiffusion = multiCombat(899);
spatialDiffusion.run.battle.enemies.forEach((enemy) => {
  enemy.hp = 200;
  enemy.maxHp = 200;
});
spatialDiffusion.run.battle.absorb = 39;
spatialDiffusion.run.battle.hand = [
  { id: "burst_spatial_diffusion", level: 0 },
];
E.play(spatialDiffusion.run, 0, spatialDiffusion.meta);
assert.ok(
  spatialDiffusion.run.battle.enemies.every((enemy) => enemy.hp === 75),
  "Spatial Diffusion rounds 39 × 3.2 up to 125 damage",
);
assert.ok(
  spatialDiffusion.run.battle.enemies.every((enemy) => stacks(enemy, "stun") === 0),
  "Spatial Diffusion does not stun below 40 consumed absorb",
);
assert.equal(spatialDiffusion.run.battle.absorb, 0);

spatialDiffusion = multiCombat(898);
spatialDiffusion.run.battle.enemies.forEach((enemy) => {
  enemy.hp = 200;
  enemy.maxHp = 200;
});
spatialDiffusion.run.battle.absorb = 40;
spatialDiffusion.run.battle.hand = [
  { id: "burst_spatial_diffusion", level: 0 },
];
E.play(spatialDiffusion.run, 0, spatialDiffusion.meta);
assert.ok(
  spatialDiffusion.run.battle.enemies.every((enemy) => enemy.hp === 72),
  "Spatial Diffusion deals 128 damage at the 40-absorb threshold",
);
assert.ok(
  spatialDiffusion.run.battle.enemies.every((enemy) => stacks(enemy, "stun") === 1),
  "Spatial Diffusion stuns every living enemy at 40 consumed absorb",
);
assert.ok(
  spatialDiffusion.run.log.some((entry) => entry.includes("(40)")),
  "Spatial Diffusion logs its stun-threshold activation",
);
const randomEnemyCounts = new Set();
for (let seed = 910; seed < 970; seed++) {
  const encounter = E.newRun(seed),
    encounterMeta = E.freshMeta();
  encounter.route[0] = "battle";
  E.enter(encounter, encounterMeta);
  assert.ok(
    encounter.battle.enemies.length >= 1 &&
      encounter.battle.enemies.length <= 3,
    "Every combat encounter contains one to three enemies",
  );
  randomEnemyCounts.add(encounter.battle.enemies.length);
}
assert.deepEqual(
  [...randomEnemyCounts].sort(),
  [1, 2, 3],
  "Seeded random encounters exercise all supported enemy counts",
);
const spawnedBossIds = new Set();
for (let seed = 970; seed < 1030; seed++) {
  const encounter = E.newRun(seed),
    encounterMeta = E.freshMeta();
  encounter.route[0] = "boss";
  E.enter(encounter, encounterMeta);
  const enemies = encounter.battle.enemies;
  assert.equal(enemies.length, 1, "Act-one bosses spawn without escorts");
  assert.equal(
    enemies.filter((enemy) => enemy.isBoss).length,
    1,
    "Boss encounters contain exactly one boss",
  );
  assert.equal(enemies[0].isBoss, true, "The boss leads the turn order");
  assert.ok(ACT1_BOSSES[enemies[0].id]?.unlockedByDefault);
  assert.equal(enemies[0].maxHp, ACT1_BOSSES[enemies[0].id].baseHp);
  spawnedBossIds.add(enemies[0].id);
}
assert.deepEqual(
  [...spawnedBossIds].sort(),
  Object.values(ACT1_BOSSES).filter((boss) => boss.unlockedByDefault).map((boss) => boss.id).sort(),
  "Default boss pool exposes all three bosses",
);
CARDS.test_all_target = {
  name: "광역 테스트",
  cost: 1,
  note: "top",
  attack: 4,
  target: "all",
};
CARDS.test_random_target = {
  name: "무작위 테스트",
  cost: 1,
  note: "top",
  attack: 5,
  target: "random",
  attackPattern: "nonContact",
};
let multi = multiCombat();
assert.equal(E.selectTarget(multi.run, 1), true);
multi.run.battle.hp = 17;
assert.equal(
  multi.run.battle.enemies[1].hp,
  17,
  "Legacy battle.hp writes through to the selected enemy",
);
multi.run.battle.hand = [{ id: "strike", level: 0 }];
E.play(multi.run, 0, multi.meta);
assert.deepEqual(
  multi.run.battle.enemies.map((enemy) => enemy.hp),
  [20, 10, 20],
  "Cards without target use the selected single enemy",
);
assert.deepEqual(
  multi.run._enemyHitFeedback.map((hit) => hit.targetIndex),
  [1],
  "Damage feedback retains the exact selected enemy index",
);
assert.equal(
  multi.run._enemyHitFeedback[0].attackPattern,
  "contact",
  "Damage feedback identifies contact hits for synchronized sound",
);
delete multi.run._enemyHitFeedback;
multi.run.battle.hand = [{ id: "test_all_target", level: 0 }];
for (const enemy of multi.run.battle.enemies) applyStatus(enemy, "thorns", 1);
const hpBeforeFallbackThorns = multi.run.hp;
E.play(multi.run, 0, multi.meta);
assert.deepEqual(
  multi.run.battle.enemies.map((enemy) => enemy.hp),
  [16, 6, 16],
  "All targeting damages every living enemy",
);
assert.deepEqual(
  multi.run._enemyHitFeedback.map((hit) => hit.targetIndex),
  [0, 1, 2],
  "Area damage emits one correctly targeted feedback event per enemy",
);
assert.equal(
  multi.run.hp,
  hpBeforeFallbackThorns - 3,
  "Missing attackPattern falls back to contact for every target",
);
multi.run.battle.hand = [{ id: "test_random_target", level: 0 }];
for (const enemy of multi.run.battle.enemies) applyStatus(enemy, "thorns", 1);
const hpBeforeRandom = multi.run.battle.enemies.reduce(
    (sum, enemy) => sum + enemy.hp,
    0,
  ),
  playerBeforeNonContact = multi.run.hp;
E.play(multi.run, 0, multi.meta);
assert.equal(
  hpBeforeRandom -
    multi.run.battle.enemies.reduce((sum, enemy) => sum + enemy.hp, 0),
  5,
  "Random targeting hits exactly one living enemy",
);
assert.equal(
  multi.run.hp,
  playerBeforeNonContact,
  "Non-contact attacks ignore enemy thorns",
);

multi = multiCombat(901);
multi.run.hp = 80;
multi.run.battle.enemies[0].intent = { type: "attack", value: 4 };
multi.run.battle.enemies[1].intent = { type: "attack", value: 5 };
multi.run.battle.enemies[2].intent = { type: "attack", value: 6 };
applyStatus(multi.run.battle.enemies[0], "stun");
applyStatus(multi.run.battle.enemies[1], "disarm", { stacks: 1, turns: 2 });
E.endTurn(multi.run, multi.meta);
assert.equal(
  multi.run.hp,
  74,
  "Enemy phase resolves alive enemies in order and honors stun and disarm",
);

multi = multiCombat(904);
multi.run.battle.enemies[0].intent = { type: "attack", value: 3 };
multi.run.battle.enemies[1].intent = { type: "guard", value: 4 };
multi.run.battle.enemies[2].intent = { type: "pollute", value: 1 };
const stagedHp = multi.run.hp;
assert.equal(E.executePlayerTurnEnd(multi.run, multi.meta), true);
assert.equal(
  multi.run.battle.enemyPhase,
  true,
  "Player cleanup locks the battle in enemy phase",
);
const firstOutcome = E.executeSingleEnemyAction(multi.run, 0, multi.meta);
assert.equal(
  firstOutcome.damage,
  3,
  "A staged enemy action returns presentation-friendly damage data",
);
assert.equal(
  firstOutcome.attackPattern,
  "contact",
  "Enemy attack outcomes expose their pattern for synchronized sound",
);
assert.equal(
  multi.run.hp,
  stagedHp - 3,
  "Only the requested enemy acts in a staged step",
);
const secondOutcome = E.executeSingleEnemyAction(multi.run, 1, multi.meta);
assert.equal(
  secondOutcome.shieldGained,
  4,
  "Guard steps report gained enemy shield",
);
const thirdOutcome = E.executeSingleEnemyAction(multi.run, 2, multi.meta);
assert.equal(
  thirdOutcome.impurities,
  1,
  "Pollute steps report inserted impurity cards",
);
assert.equal(E.executeRoundEnd(multi.run, multi.meta), true);
assert.equal(
  multi.run.battle.enemyPhase,
  false,
  "Round cleanup returns control to the player phase",
);

multi = multiCombat(902);
multi.run.battle.enemies = [
  makeEnemy("Elite A", { isElite: true }),
  makeEnemy("Elite B", { isElite: true }),
];
E.attachEnemyAliases(multi.run.battle);
applyStatus(multi.run.battle.enemies[0], "stun");
E.endTurn(multi.run, multi.meta);
multi.run.battle.selectedTarget = 0;
assert.equal(
  E.addStatus(multi.run, "enemy", "stun"),
  0,
  "Elite enemies resist one consecutive stun after recovery",
);

multi = multiCombat(903);
multi.run.battle.enemies[0].hp = 1;
multi.run.battle.hand = [{ id: "strike", level: 0 }];
E.play(multi.run, 0, multi.meta);
assert.equal(
  multi.run.phase,
  "battle",
  "Defeating one enemy does not end a multi-enemy battle",
);
multi.run.battle.enemies.slice(1).forEach((enemy) => (enemy.hp = 1));
multi.run.battle.hand = [{ id: "test_all_target", level: 0 }];
E.play(multi.run, 0, multi.meta);
assert.equal(
  multi.run.phase,
  "reward",
  "Victory occurs only after every enemy is defeated",
);

const earlySpawnCounts = new Set(),
  earlyMonsterIds = new Set();
for (let seed = 1100; seed < 1300; seed++) {
  const encounter = E.newRun(seed),
    encounterMeta = E.freshMeta();
  encounter.route[0] = "battle";
  E.enter(encounter, encounterMeta);
  const enemies = encounter.battle.enemies,
    ratio = enemies.length === 1 ? 1 : enemies.length === 2 ? 0.65 : 0.5;
  earlySpawnCounts.add(enemies.length);
  for (const enemy of enemies) {
    const template = EARLY_MONSTERS[enemy.id];
    earlyMonsterIds.add(enemy.id);
    assert.ok(template, "Act-one battles only use early monster templates");
    assert.equal(enemy.maxHp, Math.round(template.baseHp * ratio));
    assert.deepEqual(
      enemy.intent,
      template.pattern[0],
      "The first turn begins with the first template intent",
    );
    if (enemy.id === "spiky_pinecone")
      assert.equal(
        stacks(enemy, "thorns"),
        2,
        "Initial monster statuses are applied at spawn",
      );
  }
}
assert.deepEqual([...earlySpawnCounts].sort(), [1, 2, 3]);
assert.deepEqual(
  [...earlyMonsterIds].sort(),
  Object.keys(EARLY_MONSTERS).sort(),
  "All six early monsters can appear",
);

assert.equal(Object.keys(ACT2_MONSTERS).length, 9);
assert.deepEqual(
  Object.fromEntries(
    Object.values(ACT2_MONSTERS).map((monster) => [monster.name, monster.baseHp]),
  ),
  {
    "끓어오르는 응축수": 44,
    "과압 증류관": 48,
    "부식성 냉각 슬러그": 46,
    "결정화된 왁스 침전체": 54,
    "휘발 불꽃 정령": 38,
    "엉겨붙은 벤조인 슬라임": 48,
    "묵직한 주물 추": 58,
    "증기 분출구": 44,
    "회전식 분쇄날": 50,
  },
  "Act-two normal monsters use their requested base health",
);
const act2MonsterIds = new Set();
let spawnedCrystallizedSediment = false;
for (let seed = 1300; seed < 1500; seed++) {
  const encounter = E.newRun(seed), encounterMeta = E.freshMeta();
  encounter.loop = 1;
  encounter.route[0] = "battle";
  E.enter(encounter, encounterMeta);
  const enemies = encounter.battle.enemies,
    ratio = enemies.length === 1 ? 1 : enemies.length === 2 ? 0.65 : 0.5;
  for (const enemy of enemies) {
    const template = ACT2_MONSTERS[enemy.id];
    assert.ok(template, "Act-two normal battles use the dedicated monster pool");
    act2MonsterIds.add(enemy.id);
    assert.equal(
      enemy.maxHp,
      Math.round(template.baseHp * ratio * E.actInfo(1).hp),
    );
    assert.deepEqual(enemy.intent, template.pattern[0]);
    if (enemy.id === "crystallized_sediment") {
      spawnedCrystallizedSediment = true;
      assert.equal(stacks(enemy, "protection"), 1);
      assert.equal(turns(enemy, "protection"), 2);
      assert.equal(
        directDamage(10, { statuses: {} }, enemy),
        5,
        "Wax Protection reduces incoming direct damage by 50%",
      );
    }
  }
}
assert.deepEqual(
  [...act2MonsterIds].sort(),
  Object.keys(ACT2_MONSTERS).sort(),
  "All nine act-two normal monsters can appear",
);
assert.equal(spawnedCrystallizedSediment, true);
assert.deepEqual(
  ACT2_MONSTERS.overpressure_still.pattern[1].applyPlayer,
  undefined,
  "The pressure still spends turn two visibly charging behind guard",
);
assert.equal(
  ACT2_MONSTERS.overpressure_still.pattern[0].applyPlayer.vulnerable.modifierPerStack,
  0.5,
);
assert.equal(ACT2_MONSTERS.overpressure_still.pattern[2].value, 16);
assert.equal(ACT2_MONSTERS.volatile_flame_spirit.pattern[0].hits, 3);
assert.deepEqual(
  ACT2_MONSTERS.heavy_cast_ingot.pattern.map((intent) => intent.value),
  [14, 9, 15],
);
assert.deepEqual(
  ACT2_MONSTERS.steam_vent.pattern.map((intent) => [intent.value, intent.hits || 1]),
  [[3, 3], [8, 1], [4, 3]],
);
assert.deepEqual(
  ACT2_MONSTERS.spinning_blade.pattern.map((intent) => intent.value),
  [8, 11, 16],
);
assert.deepEqual(
  ACT2_MONSTERS.boiling_condensate.pattern.map((intent) => intent.type),
  ["attack", "guard", "attack"],
);
assert.deepEqual(
  ACT2_MONSTERS.corrosive_cooling_slug.pattern.map((intent) => intent.type),
  ["debuff", "attack", "debuff"],
);
assert.deepEqual(
  ACT2_MONSTERS.tangled_benzoin.pattern.slice(0, 2).map((intent) =>
    Object.keys(intent.applyPlayer)[0]),
  ["bind", "interference"],
);

assert.equal(Object.keys(ACT3_MONSTERS).length, 6);
assert.deepEqual(
  Object.fromEntries(Object.values(ACT3_MONSTERS).map((monster) => [monster.name, monster.baseHp])),
  {
    "깨진 유리 파편마": 64,
    "심연의 오물 삼킴이": 72,
    "위상 왜곡 프리즘": 66,
    "심연의 흑요석 거석": 78,
    "공명 음파 구체": 60,
    "심연의 돌진 맹수": 65,
  },
);
assert.ok(Object.values(ACT3_MONSTERS).every((monster) =>
  monster.pattern.length === 3 && monster.loopPattern === true));
assert.deepEqual(ACT3_MONSTERS.shattered_glass_fiend.pattern[0].applySelf, { thorns: 3 });
assert.deepEqual(ACT3_MONSTERS.shattered_glass_fiend.pattern[1].applyPlayer, { bleed: 3 });
assert.deepEqual(
  ACT3_MONSTERS.abyssal_sludge_devourer.pattern.map((intent) => intent.pollute || 0),
  [2, 0, 1],
);
assert.equal(ACT3_MONSTERS.phase_distortion_prism.pattern[2].value, 20);
assert.deepEqual(
  ACT3_MONSTERS.resonant_sonic_orb.pattern.map((intent) => [intent.value, intent.hits || 1]),
  [[5, 3], [12, 1], [6, 3]],
);
const act3NormalMonsterPool = { ...ACT3_MONSTERS, ...ACT2_MONSTERS };
const act3MonsterIds = new Set();
for (let seed = 1500; seed < 1700; seed++) {
  const encounter = E.newRun(seed), encounterMeta = E.freshMeta();
  encounter.loop = 2;
  encounter.route[0] = "battle";
  E.enter(encounter, encounterMeta);
  const enemies = encounter.battle.enemies,
    ratio = enemies.length === 1 ? 1 : enemies.length === 2 ? 0.65 : 0.5;
  for (const enemy of enemies) {
    const template = act3NormalMonsterPool[enemy.id];
    assert.ok(template, "Act-three normal battles mix act-two and act-three monsters");
    act3MonsterIds.add(enemy.id);
    assert.equal(enemy.maxHp, Math.round(template.baseHp * ratio * E.actInfo(2).hp));
    assert.equal(enemy.intent.type, template.pattern[0].type);
    assert.equal(enemy.loopPattern, template.loopPattern === true);
    if (Number.isFinite(template.pattern[0].value))
      assert.equal(enemy.intent.value, Math.round(template.pattern[0].value *
        (template.scaleAttackWithAct === false ? 1 : E.actInfo(2).attack)));
  }
}
assert.deepEqual([...act3MonsterIds].sort(), Object.keys(act3NormalMonsterPool).sort());

const pressureCycle = multiCombat(9041);
pressureCycle.run.loop = 1;
pressureCycle.run.hp = 100;
pressureCycle.run.maxHp = 100;
pressureCycle.run.battle.enemies = [
  makeEnemy("과압 증류관", {
    id: "overpressure_still",
    hp: 200,
    maxHp: 200,
    pattern: structuredClone(ACT2_MONSTERS.overpressure_still.pattern),
    scaleAttackWithAct: false,
    intent: structuredClone(ACT2_MONSTERS.overpressure_still.pattern[0]),
  }),
];
E.attachEnemyAliases(pressureCycle.run.battle);
E.endTurn(pressureCycle.run, pressureCycle.meta);
assert.equal(stacks(pressureCycle.run, "vulnerable"), 1);
assert.equal(pressureCycle.run.battle.enemies[0].shield, 12);
E.endTurn(pressureCycle.run, pressureCycle.meta);
assert.equal(
  stacks(pressureCycle.run, "vulnerable"),
  1,
  "Pressure Vulnerable remains through the warning turn",
);
assert.equal(
  directDamage(16, pressureCycle.run.battle.enemies[0], pressureCycle.run),
  24,
);
assert.equal(pressureCycle.run.battle.enemies[0].shield, 20);
E.endTurn(pressureCycle.run, pressureCycle.meta);
assert.equal(
  pressureCycle.run.hp,
  76,
  "The turn-three pressure blast deals 24 through its 50% Vulnerable",
);

const waxGuard = multiCombat(9042);
waxGuard.run.battle.enemies[0].intent = structuredClone(
  ACT2_MONSTERS.crystallized_sediment.pattern[0],
);
E.executePlayerTurnEnd(waxGuard.run, waxGuard.meta);
E.executeSingleEnemyAction(waxGuard.run, 0, waxGuard.meta);
assert.deepEqual(
  waxGuard.run.battle.enemies.map((enemy) => enemy.shield),
  [18, 6, 6],
  "Wax Sediment gains 12 shield and grants six to every ally including itself",
);

multi = multiCombat(905);
multi.run.battle.enemies[0].intent = EARLY_MONSTERS.volatile_vapor.pattern[0];
E.executePlayerTurnEnd(multi.run, multi.meta);
E.executeSingleEnemyAction(multi.run, 0, multi.meta);
assert.equal(
  stacks(multi.run, "burning"),
  2,
  "Attack intents apply their player status effects",
);

multi = multiCombat(906);
multi.run.battle.enemies[0].intent = EARLY_MONSTERS.hardened_resin.pattern[2];
E.executePlayerTurnEnd(multi.run, multi.meta);
const allyGuardOutcome = E.executeSingleEnemyAction(multi.run, 0, multi.meta);
assert.equal(allyGuardOutcome.shieldGained, 8);
assert.ok(
  multi.run.battle.enemies.every((enemy) => stacks(enemy, "protection") === 1),
  "Ally status intents affect every living enemy",
);

multi = multiCombat(907);
multi.run.battle.enemies[0].intent = EARLY_MONSTERS.tangle_wick.pattern[2];
E.executePlayerTurnEnd(multi.run, multi.meta);
const compoundPolluteOutcome = E.executeSingleEnemyAction(
  multi.run,
  0,
  multi.meta,
);
assert.equal(compoundPolluteOutcome.impurities, 2);
assert.equal(
  compoundPolluteOutcome.shieldGained,
  4,
  "Compound pollute intents inject cards and gain guard",
);

multi = multiCombat(908);
multi.run.battle.enemies[0].intent = EARLY_MONSTERS.blighted_pollen.pattern[0];
E.executePlayerTurnEnd(multi.run, multi.meta);
const debuffOutcome = E.executeSingleEnemyAction(multi.run, 0, multi.meta);
assert.equal(debuffOutcome.type, "debuff");
assert.equal(
  stacks(multi.run, "corrosion"),
  2,
  "Pure debuff intents apply without being treated as pollution",
);
delete CARDS.test_all_target;
delete CARDS.test_random_target;

assert.equal(Object.keys(ACT1_ELITES).length, 7);
assert.ok(
  Object.values(ACT1_ELITES).every((enemy) => enemy.symbol === "👹"),
  "Act-one elites share the act-two and act-three elite icon",
);
assert.equal(Object.keys(ACT1_BOSSES).length, 5);
const eliteSpawned = new Set(), unlockedBossSpawned = new Set();
for (let seed = 1; seed <= 500; seed++) {
  let encounter = E.newRun(seed), encounterMeta = E.freshMeta();
  encounter.route[0] = "elite";
  E.enter(encounter, encounterMeta);
  eliteSpawned.add(encounter.battle.enemies[0].id);
  encounter = E.newRun(seed);
  encounterMeta = E.freshMeta();
  encounterMeta.unlocked.push("boss_corrupted_perfumer", "boss_primeval_lily");
  encounter.route[0] = "boss";
  E.enter(encounter, encounterMeta);
  unlockedBossSpawned.add(encounter.battle.enemies[0].id);
}
assert.deepEqual([...eliteSpawned].sort(), Object.keys(ACT1_ELITES).sort());
assert.deepEqual([...unlockedBossSpawned].sort(), Object.keys(ACT1_BOSSES).sort());

const rolledEliteIntents = new Set(), rolledBossIntents = new Set();
for (let seed = 6000; seed < 6100; seed++) {
  for (const [room, turn, output] of [["elite", 3, rolledEliteIntents], ["boss", 8, rolledBossIntents]]) {
    const encounter = E.newRun(seed), encounterMeta = E.freshMeta();
    encounter.route[0] = room;
    E.enter(encounter, encounterMeta);
    const enemy = encounter.battle.enemies[0];
    encounter.battle.turn = turn;
    encounter.battle.enemies.forEach((target) => (target.intent = { type: "guard", value: 0 }));
    E.endTurn(encounter, encounterMeta);
    assert.ok(enemy.pattern.some((intent) => JSON.stringify(intent) === JSON.stringify(enemy.intent)));
    output.add(JSON.stringify(enemy.intent));
  }
}
assert.ok(rolledEliteIntents.size > 1, "Elite AI randomizes after turn three");
assert.ok(rolledBossIntents.size > 1, "Boss AI randomizes after turn eight");

let signatureRun, signatureMeta;
for (let seed = 7000; seed < 7100; seed++) {
  const candidate = E.newRun(seed), candidateMeta = E.freshMeta();
  candidateMeta.unlocked.push("boss_corrupted_perfumer");
  candidate.route[0] = "boss";
  E.enter(candidate, candidateMeta);
  if (candidate.battle.enemies[0].id === "corrupted_perfumer") {
    signatureRun = candidate;
    signatureMeta = candidateMeta;
    break;
  }
}
assert.ok(signatureRun, "Unlocked signature boss can spawn");
signatureRun.battle.enemies[0].hp = 1;
signatureRun.battle.hand = [{ id: "strike", level: 0 }];
E.play(signatureRun, 0, signatureMeta);
assert.ok(signatureRun.inventory.includes("relic_golden_pipette"));
assert.ok(signatureMeta.discovered.includes("relic_golden_pipette"));

ITEMS.test_pack_gold = { effect: "goldBonus", value: 2 };
const packRun = E.newRun(8100), packMeta = E.freshMeta();
packRun.route[0] = "battle";
packRun.inventory = ["test_pack_gold"];
E.enter(packRun, packMeta);
packRun.hp = 60;
packRun.battle.enemies = [makeEnemy("A", { hp: 1 }), makeEnemy("B", { hp: 0 }), makeEnemy("C", { hp: 0 })];
E.attachEnemyAliases(packRun.battle);
packRun.battle.hand = [{ id: "strike", level: 0 }];
E.play(packRun, 0, packMeta);
assert.equal(packRun.gold, 51, "Gold including its bonus is multiplied by three defeated monsters");
assert.equal(packRun.hp, 65, "Battle healing remains fixed at five");
assert.equal(packRun.reward.cardPicksRemaining, 3);
for (let remaining = 2; remaining >= 0; remaining--) {
  const card = packRun.reward.cards[0];
  assert.equal(E.advance(packRun, card), true);
  if (remaining) {
    assert.equal(packRun.phase, "reward");
    assert.equal(packRun.reward.cardPicksRemaining, remaining);
    assert.equal(packRun.reward.cards.length, 3);
  }
}
assert.equal(packRun.phase, "map");
delete ITEMS.test_pack_gold;

const bindTiming = multiCombat(8200);
bindTiming.run.battle.enemies = [
  makeEnemy("끈적한 송진 골렘", {
    isElite: true,
    intent: {
      type: "attack",
      value: 0,
      attackPattern: "contact",
      applyPlayer: { bind: { stacks: 1, turns: 1 } },
    },
  }),
];
E.attachEnemyAliases(bindTiming.run.battle);
E.executePlayerTurnEnd(bindTiming.run, bindTiming.meta);
E.executeSingleEnemyAction(bindTiming.run, 0, bindTiming.meta);
assert.equal(turns(bindTiming.run, "bind"), 1);
E.executeRoundEnd(bindTiming.run, bindTiming.meta);
assert.equal(
  turns(bindTiming.run, "bind"),
  1,
  "A one-turn status applied by an enemy survives that enemy phase and affects the next player turn",
);
bindTiming.run.battle.enemies[0].intent = { type: "guard", value: 0 };
E.endTurn(bindTiming.run, bindTiming.meta);
assert.equal(turns(bindTiming.run, "bind"), 0);

assert.deepEqual(
  [E.actInfo(0).hp, E.actInfo(1).hp, E.actInfo(2).hp, E.actInfo(3).hp],
  [1, 1.45, 2.1, 2.8],
);
for (const [loop, elites, bosses] of [
  [0, ACT1_ELITES, ACT1_BOSSES],
  [1, ACT2_ELITES, ACT2_BOSSES],
  [2, ACT3_ELITES, ACT3_BOSSES],
]) {
  const eliteRun = E.newRun(9000 + loop), eliteMeta = E.freshMeta();
  eliteRun.loop = loop;
  eliteRun.route[0] = "elite";
  E.enter(eliteRun, eliteMeta);
  assert.ok(elites[eliteRun.battle.enemies[0].id], `Loop ${loop} uses its elite pool`);
  const bossRun = E.newRun(9100 + loop), bossMeta = E.freshMeta();
  bossRun.loop = loop;
  bossRun.route[0] = "boss";
  E.enter(bossRun, bossMeta);
  assert.ok(bosses[bossRun.battle.enemies[0].id], `Loop ${loop} uses its boss pool`);
}

const synergyRun = E.newRun(9200), synergyMeta = E.freshMeta();
synergyRun.inventory = ["gather_regen_2", "gather_oilShield_0"];
assert.equal(E.hasSynergy(synergyRun, "dew_petals"), true);
assert.equal(E.synergyPower(synergyRun, "oilHeal"), 2);
assert.equal(E.discoverSynergies(synergyRun, synergyMeta)[0].id, "dew_petals");
assert.ok(synergyMeta.synergies.includes("dew_petals"));
synergyRun.route[0] = "battle";
E.enter(synergyRun, synergyMeta);
synergyRun.hp = 50;
synergyRun.battle.hand = [{ id: "oil", level: 0 }];
E.play(synergyRun, 0, synergyMeta);
assert.equal(synergyRun.hp, 52, "Dew Petals heals two when an oil card is played");

const sealedRun = E.newRun(9300), sealedMeta = E.freshMeta();
sealedRun.inventory = ["golden_carry_2", "boss_shieldHit_0"];
assert.equal(E.hasSynergy(sealedRun, "sealed_impact"), true);
sealedRun.route[0] = "battle";
E.enter(sealedRun, sealedMeta);
sealedRun.battle.shield = 10;
sealedRun.battle.enemies.forEach((enemy) => (enemy.intent = { type: "guard", value: 0 }));
E.endTurn(sealedRun, sealedMeta);
const targetHp = sealedRun.battle.hp;
sealedRun.battle.hand = [{ id: "strike", level: 0 }];
E.play(sealedRun, 0, sealedMeta);
assert.equal(targetHp - sealedRun.battle.hp, 11, "Sealed Impact boosts the first retained-shield contact attack by 50%");

const abyssCost = E.newRun(9400), abyssMeta = E.freshMeta();
abyssCost.loop = 4;
abyssCost.route[0] = "battle";
E.enter(abyssCost, abyssMeta);
assert.equal(E.cost(abyssCost, { id: "strike", level: 0 }), 2);

for (const item of Object.values(ITEMS)) {
  if (item.kind === "relic") {
    assert.ok([0, 2, 3].includes(item.tier), `${item.id} relic tier must be common, unique or epic`);
    assert.equal(item.maxOwned, 1);
  }
  if (["deckSize", "handSize", "apCap", "turnBaseAp", "draw"].includes(item.effect))
    assert.equal(item.kind, "relic", `${item.effect} must belong to a relic`);
  if (item.kind === "stat")
    assert.ok(["maxHp", "attack", "contactAttack", "nonContactAttack", "topAttack", "baseAttack", "corrosionAttack", "burningAttack", "harmonyAttack", "defense", "openingShield", "regen", "incomingHeal", "battleEndHeal", "openingAbsorb", "absorbBonus", "absorb", "goldBonus", "goldLumpSum", "shopPriceMultiplier"].includes(item.effect));
}

const apRun = E.newRun(9500), apMeta = E.freshMeta();
ITEMS.test_ap_cap_relic = { id: "test_ap_cap_relic", kind: "relic", tier: 3, effect: "apCap", value: 2, maxOwned: 1 };
ITEMS.test_turn_ap_relic = { id: "test_turn_ap_relic", kind: "relic", tier: 3, effect: "turnBaseAp", value: 1, maxOwned: 1 };
apRun.inventory = ["test_ap_cap_relic", "test_turn_ap_relic"];
apRun.route[0] = "battle";
E.enter(apRun, apMeta);
assert.equal(E.apLimit(apRun), 10);
assert.equal(E.turnStartAp(apRun), 4);
apRun.battle.ap = 9;
assert.equal(E.gainCurrentAp(apRun, 5), 1);
assert.equal(apRun.battle.ap, 10);
assert.equal(E.gainCurrentAp(apRun, 1), 0);
delete ITEMS.test_ap_cap_relic;
delete ITEMS.test_turn_ap_relic;

ITEMS.test_trait_low = { id: "test_trait_low", room: "gather", kind: "trait", family: "test_family", effect: "testEffect", tier: 0, value: 1, maxOwned: 3 };
ITEMS.test_trait_high = { id: "test_trait_high", room: "gather", kind: "trait", family: "test_family", effect: "testEffect", tier: 3, value: 4, maxOwned: 3 };
const traitRun = E.newRun(9600), traitMeta = E.freshMeta();
assert.equal(E.addInventoryItem(traitRun, "test_trait_low", traitMeta), true);
assert.equal(E.addInventoryItem(traitRun, "test_trait_high", traitMeta), true);
assert.ok(!traitRun.inventory.includes("test_trait_low"));
assert.deepEqual(traitRun.inventory.filter((id) => ITEMS[id]?.family === "test_family"), ["test_trait_high"]);
assert.equal(E.addInventoryItem(traitRun, "test_trait_low", traitMeta), false);
delete ITEMS.test_trait_low;
delete ITEMS.test_trait_high;

const relicUpgradeRun = E.newRun(9650), relicUpgradeMeta = E.freshMeta();
assert.equal(E.addInventoryItem(relicUpgradeRun, "boss_reflect_2", relicUpgradeMeta), true);
assert.equal(E.addInventoryItem(relicUpgradeRun, "boss_reflect_3", relicUpgradeMeta), true);
assert.ok(!relicUpgradeRun.inventory.includes("boss_reflect_2"));
assert.deepEqual(
  relicUpgradeRun.inventory.filter((id) => ITEMS[id]?.effect === "reflect"),
  ["boss_reflect_3"],
);
assert.equal(E.addInventoryItem(relicUpgradeRun, "boss_reflect_2", relicUpgradeMeta), false);
const relicStorage = new MemoryStorage(),
  legacyRelicRun = E.newRun(9651);
legacyRelicRun.inventory.push("boss_reflect_2", "boss_reflect_3");
saveGame(relicStorage, { meta: E.freshMeta(), run: legacyRelicRun });
assert.deepEqual(
  loadGame(relicStorage).run.inventory.filter((id) => ITEMS[id]?.effect === "reflect"),
  ["boss_reflect_3"],
);

const skipRun = E.newRun(9700);
skipRun.phase = "reward";
skipRun.reward = {
  room: "battle",
  cards: ["strike", "guard", "oil"],
  cardPicksRemaining: 3,
  cardPicksTotal: 3,
  cardUnlocks: [],
};
assert.equal(E.advance(skipRun), true);
assert.equal(skipRun.phase, "reward");
assert.equal(skipRun.reward.cardPicksRemaining, 2);
assert.equal(skipRun.reward.cards.length, 3);
assert.equal(E.advance(skipRun), true);
assert.equal(skipRun.phase, "reward");
assert.equal(skipRun.reward.cardPicksRemaining, 1);
assert.equal(E.advance(skipRun), true);
assert.equal(skipRun.phase, "map");
assert.equal(skipRun.node, 1);

assert.deepEqual(STARTING_DECK, [
  "contact_glass_dropper_strike", "contact_glass_dropper_strike",
  "noncontact_fine_mist_spray", "noncontact_citrus_haze",
  "burst_precision_pipetting", "burst_precision_pipetting",
  "burst_oil_resin_coat", "burst_oil_resin_coat",
  "contact_shattered_ampoule", "contact_beveled_scent_strip",
]);
assert.deepEqual(E.newRun(9800).deck.map((card) => card.id), STARTING_DECK);
assert.equal(RECOMMENDED_STARTING_DECK.length, 10);
assert.ok(RECOMMENDED_STARTING_DECK.every((id) => CARDS[id].tier === 1));
assert.ok(getTier1Cards().every((card) => card.tier === 1 && card.id !== "impurity"));
assert.deepEqual(
  E.newRun(9804, RECOMMENDED_STARTING_DECK).deck,
  RECOMMENDED_STARTING_DECK.map((id) => ({ id, level: 0 })),
);
const startingDeckStorage = new MemoryStorage(),
  startingDeckMeta = E.freshMeta();
startingDeckMeta.lastStartingDeck = [...RECOMMENDED_STARTING_DECK];
saveGame(startingDeckStorage, { meta: startingDeckMeta, run: null });
assert.deepEqual(
  loadGame(startingDeckStorage).meta.lastStartingDeck,
  RECOMMENDED_STARTING_DECK,
  "The last valid custom starting deck survives save and load",
);
const invalidStartingDeckStorage = new MemoryStorage(),
  invalidStartingDeckMeta = E.freshMeta();
invalidStartingDeckMeta.lastStartingDeck = Array(10).fill(
  "contact_glass_dropper_strike",
);
saveGame(invalidStartingDeckStorage, {
  meta: invalidStartingDeckMeta,
  run: null,
});
assert.equal(
  loadGame(invalidStartingDeckStorage).meta.lastStartingDeck,
  null,
  "An over-copy-limit starting deck is discarded while loading",
);
assert.ok(Object.keys(CARDS).every((id) => id === "impurity" || !Object.hasOwn(BETA_CARDS, id)));
const singleUpgradeTier3Cards = new Set([
  "guard_amber_crystal_bulwark", "guard_corrosive_membrane", "guard_mist_veil",
  "guard_purifying_censer", "guard_intimidating_barrier",
  "guard_wax_bastion_bash",
  "absorb_supercritical_extraction", "absorb_pressurized_solvent_cycle",
  "absorb_saturated_resonance_filter", "absorb_volatile_essential_steep",
  "absorb_abyssal_oil_concentrate", "absorb_corrosive_extraction_strike",
  "absorb_concentrated_primer",
]);
for (const card of Object.values(CARDS)) {
  assert.ok([1, 2, 3, 4].includes(card.tier));
  const expectedCopies = card.id === "heal_aloe_salve" || card.id === "heal_chamomile_infusion"
    ? 3
    : { 1: 4, 2: 2, 3: 2, 4: 1 }[card.tier];
  assert.equal(card.maxCopies, expectedCopies);
  assert.equal(card.maxUpgrade, singleUpgradeTier3Cards.has(card.id) ? 1 : { 1: 3, 2: 2, 3: 2, 4: 1 }[card.tier]);
}
const epicLimitRun = E.newRun(9801);
epicLimitRun.deck.push({ id: "burst_spatial_diffusion", level: 0 });
for (let i = 0; i < 100; i++)
  assert.ok(!E.cardOptions(epicLimitRun, E.freshMeta()).includes("burst_spatial_diffusion"));
const actOneTierRun = E.newRun(9802);
for (let i = 0; i < 100; i++)
  assert.ok(E.cardOptions(actOneTierRun, E.freshMeta()).every((id) => CARDS[id].tier < 4));
const guaranteedRun = E.newRun(9803);
guaranteedRun.loop = 2;
assert.ok(E.cardOptions(guaranteedRun, E.freshMeta(), true).some((id) => CARDS[id].tier >= 3));
console.log(
  "PASS Harmony: statuses, cleanse, loot, 10/20-card deck limits and replacement, AP/hand, combat, route, endless, resilient save/resume.",
);

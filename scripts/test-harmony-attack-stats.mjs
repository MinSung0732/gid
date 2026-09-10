import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { ATTACK_STAT_ITEMS } from "../games/harmony/attack-stat-items.js";
import { CARDS, ITEMS } from "../games/harmony/data.js";

const tierCounts = Object.values(ATTACK_STAT_ITEMS).reduce((counts, item) => {
  const displayTier = item.tier + 1;
  counts[displayTier] = (counts[displayTier] || 0) + 1;
  return counts;
}, {});
assert.equal(Object.keys(ATTACK_STAT_ITEMS).length, 25);
assert.deepEqual(tierCounts, { 1: 10, 2: 8, 3: 5, 4: 2 });
for (const [id, item] of Object.entries(ATTACK_STAT_ITEMS)) {
  assert.equal(ITEMS[id], item);
  assert.equal(item.kind, "stat");
  assert.ok(item.maxOwned >= 1);
  assert.ok(item.description);
}

function setup(cardId, inventory) {
  const run = E.newRun(2501), meta = E.freshMeta();
  run.route[0] = "battle";
  run.inventory = inventory;
  E.enter(run, meta);
  run.battle.enemies = [run.battle.enemies[0]];
  E.attachEnemyAliases(run.battle);
  Object.assign(run.battle.enemies[0], { hp: 1000, maxHp: 1000, shield: 0, statuses: {} });
  run.battle.ap = 8;
  run.battle.hand = [{ id: cardId, level: 0 }];
  return { run, meta, enemy: run.battle.enemies[0] };
}

CARDS.test_stat_contact_top = {
  id: "test_stat_contact_top", name: "test", cost: 0, tier: 1, maxCopies: 4,
  maxUpgrade: 0, category: "attack", attackPattern: "contact", note: "top", attack: 10, hits: 3,
};
let ctx = setup("test_stat_contact_top", [
  "stat_sharp_pipette_tip", "stat_hardened_reed_point", "stat_sharp_top_scent",
  "stat_corrosive_catalyst", "stat_ignited_wick_ash",
]);
S.applyStatus(ctx.enemy, "corrosion", 1);
S.applyStatus(ctx.enemy, "burning", 1);
E.play(ctx.run, 0, ctx.meta);
assert.equal(ctx.enemy.hp, 1000 - 63, "all matching bonuses apply to every hit");

ctx = setup("test_stat_contact_top", ["stat_micro_nozzle", "stat_heavy_base_resin"]);
E.play(ctx.run, 0, ctx.meta);
assert.equal(ctx.enemy.hp, 970, "non-matching pattern and note bonuses do not apply");
delete CARDS.test_stat_contact_top;

const harmonyRun = E.newRun(2502);
harmonyRun.inventory = ["stat_primeval_pure_essence", "stat_scent_pyramid_apex"];
assert.equal(E.resolveHarmonyEffect(harmonyRun).damage, 9, "HARMONY uses only harmonyAttack plus its base damage");

const limitRun = E.newRun(2503);
assert.equal(E.addInventoryItem(limitRun, "stat_sharp_pipette_tip"), true);
assert.equal(E.addInventoryItem(limitRun, "stat_sharp_pipette_tip"), true);
assert.equal(E.addInventoryItem(limitRun, "stat_sharp_pipette_tip"), true);
assert.equal(E.addInventoryItem(limitRun, "stat_sharp_pipette_tip"), false);
assert.equal(E.addInventoryItem(limitRun, "stat_abyssal_crystal_pestle"), true);
assert.equal(E.addInventoryItem(limitRun, "stat_abyssal_crystal_pestle"), false);

console.log("PASS attack stats: 25 items, tier counts, per-hit conditional stacking, isolated HARMONY scaling and ownership limits.");

import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { CARDS, getTier1Cards } from "../games/harmony/data.js";
import { CONTACT_TIER4_CARDS } from "../games/harmony/contact-tier4-cards.js";

function setup(id, level = 0) {
  const run = E.newRun(404), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemies = [run.battle.enemies[0]];
  E.attachEnemyAliases(run.battle);
  const b = run.battle, enemy = b.enemies[0];
  Object.assign(enemy, { hp: 1000, maxHp: 1000, shield: 0, statuses: {}, isBoss: false });
  b.ap = 6;
  b.hand = [{ id, level }];
  b.draw = [{ id: "contact_glass_dropper_strike", level: 0 }, { id: "contact_direct_oil_dab", level: 0 }];
  return { run, meta, b, enemy, play: () => E.play(run, 0, meta) };
}

assert.equal(Object.keys(CONTACT_TIER4_CARDS).length, 4);
for (const id of Object.keys(CONTACT_TIER4_CARDS)) {
  assert.equal(CARDS[id].tier, 4);
  assert.equal(CARDS[id].maxCopies, 1);
  assert.equal(CARDS[id].maxUpgrade, 1);
  assert.equal(CARDS[id].attackPattern, "contact");
  assert.ok(!getTier1Cards().some((card) => card.id === id));
}

for (const level of [0, 1]) {
  let ctx = setup("contact_terracotta_crush", level);
  ctx.b.shield = 39; ctx.enemy.shield = 100; ctx.play();
  assert.equal(ctx.b.shield, 39);
  assert.equal(ctx.enemy.hp, 1000);
  assert.equal(S.stacks(ctx.enemy, "disarm"), 0);

  ctx = setup("contact_terracotta_crush", level);
  const second = { ...ctx.enemy, statuses: {}, hp: 1000, maxHp: 1000, shield: 0 };
  ctx.b.enemies.push(second); ctx.b.shield = 40; ctx.enemy.shield = 100; ctx.play();
  assert.equal(ctx.enemy.hp, 1000 - [80, 98][level]);
  assert.equal(ctx.enemy.shield, 100);
  assert.equal(ctx.b.shield, 40);
  assert.equal(S.stacks(ctx.enemy, "disarm"), 1);
  assert.equal(S.stacks(second, "disarm"), 1);

  ctx = setup("contact_black_reed_flurry", level);
  ctx.b.contactCardsPlayedThisBattle = 3; ctx.play();
  assert.equal(ctx.enemy.hp, 1000 - [54, 78][level]);
  assert.equal(S.stacks(ctx.enemy, "vulnerable"), 2);
  assert.equal(S.stacks(ctx.enemy, "weak"), 2);

  ctx = setup("contact_blazing_wick_brand", level);
  ctx.enemy.shield = 50;
  for (const [id, amount] of [["burning", 2], ["poison", 3], ["bleed", 4], ["corrosion", 2]]) S.applyStatus(ctx.enemy, id, amount);
  ctx.play();
  assert.equal(ctx.enemy.hp, 1000 - 11 * [3, 4][level]);
  assert.equal(ctx.enemy.shield, 50 - [24, 30][level]);
  assert.equal(S.stacks(ctx.enemy, "burning"), 8);
  assert.equal(S.stacks(ctx.enemy, "poison"), 6);
  assert.equal(S.stacks(ctx.enemy, "bleed"), 12);
  assert.equal(S.stacks(ctx.enemy, "corrosion"), 4);

  ctx = setup("contact_crystal_guillotine", level);
  ctx.enemy.hp = ctx.enemy.maxHp * [0.5, 0.6][level]; ctx.play();
  assert.equal(ctx.enemy.hp, ctx.enemy.maxHp * [0.5, 0.6][level] - [64, 80][level]);

  ctx = setup("contact_crystal_guillotine", level);
  ctx.enemy.isBoss = true; ctx.enemy.hp = 500; ctx.play();
  assert.equal(ctx.enemy.hp, 500 - [32, 40][level]);

  ctx = setup("contact_crystal_guillotine", level);
  ctx.enemy.hp = [64, 80][level];
  const apBefore = ctx.b.ap; ctx.play();
  assert.equal(ctx.enemy.hp, 0);
  assert.equal(ctx.b.ap, apBefore);
  assert.equal(ctx.b.hand.length, 2);
}

console.log("PASS contact tier 4: four cards, upgrades, shield finisher, six-hit scaling, DOT burst/amplification, non-boss execution and kill rewards.");

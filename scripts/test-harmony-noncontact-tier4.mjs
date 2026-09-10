import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { CARDS, getTier1Cards } from "../games/harmony/data.js";
import { NONCONTACT_TIER4_CARDS } from "../games/harmony/noncontact-tier4-cards.js";

function setup(id, level = 0, enemyCount = 1, seed = 404) {
  const run = E.newRun(seed), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  const template = run.battle.enemies[0];
  run.battle.enemies = Array.from({ length: enemyCount }, () => ({
    ...template, hp: 1000, maxHp: 1000, shield: 0, statuses: {}, isBoss: false, stunResistance: 0,
  }));
  E.attachEnemyAliases(run.battle);
  const b = run.battle;
  b.ap = 8;
  b.hand = [{ id, level }];
  return { run, meta, b, play: () => E.play(run, 0, meta) };
}

assert.equal(Object.keys(NONCONTACT_TIER4_CARDS).length, 4);
assert.equal(CARDS.burst_spatial_diffusion.tier, 4);
for (const id of Object.keys(NONCONTACT_TIER4_CARDS)) {
  assert.equal(CARDS[id].tier, 4);
  assert.equal(CARDS[id].maxCopies, 1);
  assert.equal(CARDS[id].maxUpgrade, 1);
  assert.equal(CARDS[id].attackPattern, "nonContact");
  assert.ok(!getTier1Cards().some((card) => card.id === id));
}

for (const level of [0, 1]) {
  let ctx = setup("noncontact_supercritical_beam", level);
  ctx.b.enemies[0].shield = 200; ctx.play();
  assert.equal(ctx.b.enemies[0].hp, 1000 - [45, 58][level]);
  assert.equal(ctx.b.enemies[0].shield, 200);
  assert.equal(S.stacks(ctx.b.enemies[0], "vulnerable"), 3);
  assert.equal(S.stacks(ctx.b.enemies[0], "corrosion"), 3);

  ctx = setup("noncontact_sillage_supernova", level, 2);
  S.applyStatus(ctx.b.enemies[0], "burning", 2);
  S.applyStatus(ctx.b.enemies[0], "poison", 3);
  S.applyStatus(ctx.b.enemies[1], "bleed", 4);
  S.applyStatus(ctx.b.enemies[1], "corrosion", 1);
  ctx.play();
  const expected = [20, 26][level] + Math.round(10 * [2.5, 3.5][level]);
  assert.deepEqual(ctx.b.enemies.map((enemy) => enemy.hp), [1000 - expected, 1000 - expected]);
  assert.equal(S.turns(ctx.b.enemies[0], "burning"), 5);
  assert.equal(ctx.b.enemies[0].statuses.poison.deferDecayTicks, 2);
  assert.equal(S.turns(ctx.b.enemies[1], "bleed"), 5);
  assert.equal(ctx.b.enemies[1].statuses.corrosion.deferDecayTicks, 2);

  ctx = setup("noncontact_perpetual_storm", level);
  ctx.b.cardsPlayedThisTurn = 4; ctx.play();
  assert.equal(ctx.b.enemies[0].hp, 1000 - [60, 84][level]);
  assert.equal(ctx.b.cardsPlayedThisTurn, 5);

  ctx = setup("noncontact_absolute_zero_cryo", level);
  ctx.b.shield = 40; ctx.play();
  assert.equal(ctx.b.enemies[0].hp, 1000 - [75, 97][level]);
  assert.equal(ctx.b.shield, 40);
  assert.equal(S.stacks(ctx.b.enemies[0], "stun"), 1);

  ctx = setup("noncontact_absolute_zero_cryo", level);
  Object.assign(ctx.b.enemies[0], { isBoss: true, stunResistance: 1 });
  ctx.b.shield = 40; ctx.play();
  assert.equal(S.stacks(ctx.b.enemies[0], "stun"), 0);
  assert.equal(S.stacks(ctx.b.enemies[0], "disarm"), 1);
  assert.equal(S.turns(ctx.b.enemies[0], "disarm"), 2);
}

let weakTriggered = false;
for (let seed = 1; seed <= 60 && !weakTriggered; seed++) {
  const ctx = setup("noncontact_perpetual_storm", 0, 3, seed);
  ctx.b.cardsPlayedThisTurn = 4;
  ctx.play();
  weakTriggered = ctx.b.enemies.some((enemy) => S.stacks(enemy, "weak") > 0);
}
assert.equal(weakTriggered, true, "Per-hit 15% weak application can trigger");

console.log("PASS noncontact tier 4: four new cards plus Spatial Diffusion, upgrades, piercing, global DOT burst, duration extension, combo hits, weak chance and shield-scaled boss control.");

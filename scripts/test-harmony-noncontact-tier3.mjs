import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { CARDS, getTier1Cards } from "../games/harmony/data.js";
import { NONCONTACT_TIER3_CARDS } from "../games/harmony/noncontact-tier3-cards.js";

function setup(id, level = 0, enemyCount = 3, fillerCount = 0) {
  const run = E.newRun(303), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  const template = run.battle.enemies[0];
  run.battle.enemies = Array.from({ length: enemyCount }, () => ({
    ...template, hp: 1000, maxHp: 1000, shield: 0, statuses: {}, isBoss: false,
  }));
  E.attachEnemyAliases(run.battle);
  const b = run.battle;
  b.ap = 6;
  b.hand = [{ id, level }, ...Array.from({ length: fillerCount }, () => ({ id: "guard_marble_stand", level: 0 }))];
  b.draw = [{ id: "contact_glass_dropper_strike", level: 0 }];
  return { run, meta, b, play: () => E.play(run, 0, meta) };
}

assert.equal(Object.keys(NONCONTACT_TIER3_CARDS).length, 8);
assert.equal(CARDS.noncontact_dense_essence_beam, undefined);
assert.equal(CARDS.noncontact_nebulizer_shot, undefined);
for (const id of Object.keys(NONCONTACT_TIER3_CARDS)) {
  assert.equal(CARDS[id].tier, 3);
  assert.equal(CARDS[id].maxCopies, 2);
  assert.equal(CARDS[id].maxUpgrade, 2);
  assert.equal(CARDS[id].attackPattern, "nonContact");
  assert.ok(!getTier1Cards().some((card) => card.id === id));
}

for (let level = 0; level <= 2; level++) {
  let ctx = setup("noncontact_diffusive_aroma_wave", level);
  ctx.play();
  assert.deepEqual(ctx.b.enemies.map((enemy) => enemy.hp), Array(3).fill(1000 - [16, 19, 23][level]));

  ctx = setup("noncontact_rapid_aerosol_burst", level, 1);
  const apBefore = ctx.b.ap; ctx.play();
  assert.equal(ctx.b.ap, apBefore);
  assert.equal(ctx.b.enemies[0].hp, 1000 - [12, 15, 18][level]);

  ctx = setup("noncontact_sillage_evaporation", level, 1);
  ctx.b.turn = 5; ctx.play();
  assert.equal(ctx.b.enemies[0].hp, 1000 - [27, 35, 43][level]);

  ctx = setup("noncontact_compressed_diffuser_blast", level, 1, 5);
  ctx.play();
  assert.equal(ctx.b.enemies[0].hp, 1000 - [33, 42, 52][level]);

  ctx = setup("noncontact_bouncing_scent_drops", level);
  ctx.play();
  assert.equal(ctx.b.enemies.reduce((sum, enemy) => sum + (1000 - enemy.hp), 0), [28, 36, 44][level]);
  ctx = setup("noncontact_bouncing_scent_drops", level, 1);
  ctx.play();
  assert.equal(ctx.b.enemies[0].hp, 1000 - [28, 36, 44][level]);

  for (const [turn, fullHp, doubled] of [[1, false, true], [3, true, true], [3, false, false]]) {
    ctx = setup("noncontact_fresh_uncork_burst", level, 1);
    ctx.b.turn = turn;
    if (!fullHp) ctx.b.enemies[0].hp = 900;
    const before = ctx.b.enemies[0].hp; ctx.play();
    assert.equal(ctx.b.enemies[0].hp, before - [15, 18, 22][level] * (doubled ? 2 : 1));
  }

  ctx = setup("noncontact_flaming_emulsion_jet", level, 1);
  ctx.play();
  assert.equal(ctx.b.enemies[0].hp, 1000 - [18, 22, 27][level]);
  assert.equal(S.stacks(ctx.b.enemies[0], "burning"), [4, 5, 6][level]);
  assert.equal(S.stacks(ctx.b.enemies[0], "vulnerable"), 2);

  ctx = setup("noncontact_chilled_siphon", level, 1);
  ctx.play();
  assert.equal(ctx.b.enemies[0].hp, 1000 - [13, 16, 20][level]);
  assert.equal(ctx.b.absorb, [7, 8, 10][level]);
  assert.equal(ctx.b.hand.length, 1);
}

console.log("PASS noncontact tier 3: eight cards, removals, all upgrades, AoE, free multihit, scaling, ricochet, ambush, statuses and damage-based absorb.");

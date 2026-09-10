import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { CARDS, getTier1Cards } from "../games/harmony/data.js";
import { GUARD_TIER3_CARDS } from "../games/harmony/guard-tier3-cards.js";

function setup(id, level = 0, enemyCount = 1) {
  const run = E.newRun(303), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  const template = run.battle.enemies[0];
  run.battle.enemies = Array.from({ length: enemyCount }, () => ({
    ...template, hp: 1000, maxHp: 1000, shield: 0, statuses: {}, isBoss: false,
    intent: { type: "guard", value: 0 }, pattern: null,
  }));
  E.attachEnemyAliases(run.battle);
  run.battle.ap = 5;
  run.battle.hand = [{ id, level }];
  return { run, meta, b: run.battle, play: () => E.play(run, 0, meta) };
}

assert.equal(Object.keys(GUARD_TIER3_CARDS).length, 6);
for (const id of Object.keys(GUARD_TIER3_CARDS)) {
  assert.equal(CARDS[id].tier, 3);
  assert.equal(CARDS[id].maxCopies, 2);
  assert.equal(CARDS[id].maxUpgrade, 1);
  assert.equal(CARDS[id].category, "defense");
  assert.ok(!getTier1Cards().some((card) => card.id === id));
}

for (const level of [0, 1]) {
  let ctx = setup("guard_wax_bastion_bash", level);
  ctx.b.shield = [8, 9][level];
  ctx.play();
  assert.equal(ctx.b.shield, [20, 25][level]);
  assert.equal(ctx.b.enemies[0].hp, 1000 - [6, 10][level]);

  ctx = setup("guard_amber_crystal_bulwark", level);
  ctx.play();
  assert.equal(ctx.b.shield, [12, 16][level]);
  assert.equal(S.stacks(ctx.run, "protection"), [2, 3][level]);

  ctx = setup("guard_corrosive_membrane", level);
  ctx.b.enemies[0].intent = { type: "attack", value: 1, attackPattern: "contact" };
  ctx.play();
  assert.equal(ctx.b.shield, [8, 11][level]);
  assert.equal(S.stacks(ctx.run, "thorns"), [3, 4][level]);
  E.executePlayerTurnEnd(ctx.run, ctx.meta);
  E.executeSingleEnemyAction(ctx.run, 0, ctx.meta);
  assert.equal(ctx.b.enemies[0].hp, 1000 - [3, 4][level]);
  assert.equal(S.stacks(ctx.b.enemies[0], "corrosion"), [2, 3][level]);

  ctx = setup("guard_mist_veil", level, 3);
  ctx.play();
  assert.equal(ctx.b.shield, [7, 10][level]);
  assert.deepEqual(ctx.b.enemies.map((enemy) => S.stacks(enemy, "weak")), Array(3).fill([1, 2][level]));

  ctx = setup("guard_purifying_censer", level);
  S.applyStatus(ctx.run, "weak", 2);
  ctx.play();
  assert.equal(ctx.b.shield, [10, 14][level]);
  assert.equal(S.stacks(ctx.run, "weak"), 0);
  assert.equal(S.stacks(ctx.run, "regeneration"), [3, 4][level]);

  ctx = setup("guard_intimidating_barrier", level);
  ctx.play();
  assert.equal(ctx.b.shield, [9, 13][level]);
  assert.equal(S.stacks(ctx.b.enemies[0], "intimidated"), [3, 5][level]);
  assert.equal(S.turns(ctx.b.enemies[0], "intimidated"), 1);
}

console.log("PASS tier 3 guards: six cards, wax shield bash, single upgrades, protection, corrosive thorns, AoE weak, regeneration cleanse and intimidation.");

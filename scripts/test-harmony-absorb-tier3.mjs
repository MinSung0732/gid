import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { CARDS, getTier1Cards } from "../games/harmony/data.js";
import { ABSORB_TIER3_CARDS } from "../games/harmony/absorb-tier3-cards.js";

function setup(id, level = 0, enemyCount = 1) {
  const run = E.newRun(313), meta = E.freshMeta();
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

assert.equal(Object.keys(ABSORB_TIER3_CARDS).length, 7);
for (const id of Object.keys(ABSORB_TIER3_CARDS)) {
  assert.equal(CARDS[id].tier, 3);
  assert.equal(CARDS[id].maxCopies, 2);
  assert.equal(CARDS[id].maxUpgrade, 1);
  assert.equal(CARDS[id].category, "absorb");
  assert.ok(!getTier1Cards().some((card) => card.id === id));
}

for (const level of [0, 1]) {
  let ctx = setup("absorb_supercritical_extraction", level);
  ctx.play();
  assert.equal(ctx.b.absorb, [14, 18][level]);
  assert.equal(ctx.b.preventAbsorbDecay, true);

  ctx = setup("absorb_pressurized_solvent_cycle", level);
  ctx.b.absorb = [11, 3][level];
  ctx.play();
  assert.equal(ctx.b.ap, 4, "임계치 미만이면 AP를 환급하지 않는다");
  ctx = setup("absorb_pressurized_solvent_cycle", level);
  ctx.b.absorb = [12, 4][level];
  ctx.play();
  assert.equal(ctx.b.ap, 5, "흡수 획득 후 임계치에 도달하면 AP를 환급한다");

  ctx = setup("absorb_saturated_resonance_filter", level, 3);
  ctx.b.absorb = [20, 12][level];
  ctx.play();
  assert.deepEqual(ctx.b.enemies.map((enemy) => S.stacks(enemy, "vulnerable")), [0, 0, 0]);
  ctx = setup("absorb_saturated_resonance_filter", level, 3);
  ctx.b.absorb = [21, 13][level];
  ctx.play();
  assert.deepEqual(ctx.b.enemies.map((enemy) => S.stacks(enemy, "vulnerable")), Array(3).fill([1, 2][level]));

  ctx = setup("absorb_volatile_essential_steep", level, 2);
  ctx.b.draw = [{ id: "absorb_precision_pipette", level: 0 }];
  ctx.play();
  assert.equal(ctx.b.ap, 5);
  assert.equal(ctx.b.absorb, [5, 8][level]);
  assert.equal(ctx.b.hand.length, 1);
  assert.equal(S.stacks(ctx.b.enemies[0], "burning"), [2, 3][level]);
  assert.equal(S.stacks(ctx.b.enemies[1], "burning"), 0);

  ctx = setup("absorb_abyssal_oil_concentrate", level);
  ctx.play();
  assert.equal(ctx.b.absorb, [16, 22][level]);
  assert.equal(S.stacks(ctx.run, "regeneration"), [2, 3][level]);

  ctx = setup("absorb_corrosive_extraction_strike", level);
  ctx.play();
  assert.equal(ctx.b.enemies[0].hp, 1000 - [9, 13][level]);
  assert.equal(ctx.b.absorb, [7, 9][level]);
  assert.equal(S.stacks(ctx.b.enemies[0], "corrosion"), [3, 4][level]);

  ctx = setup("absorb_concentrated_primer", level);
  ctx.b.hand.push(
    { id: "absorb_precision_pipette", level: 0 },
    { id: "absorb_precision_pipette", level: 0 },
    { id: "absorb_precision_pipette", level: 0 },
  );
  ctx.play();
  E.play(ctx.run, 0, ctx.meta);
  E.play(ctx.run, 0, ctx.meta);
  E.play(ctx.run, 0, ctx.meta);
  assert.equal(ctx.b.absorb, [40, 47][level]);
  assert.equal(ctx.b.absorbBoosters.length, 0);
}

console.log("PASS tier 3 absorb: seven cards, thresholds, statuses, oil, draw, strike and two-card booster.");

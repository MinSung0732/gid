import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { CARDS, getTier1Cards } from "../games/harmony/data.js";
import { GUARD_TIER4_CARDS } from "../games/harmony/guard-tier4-cards.js";
import { ABSORB_TIER4_CARDS } from "../games/harmony/absorb-tier4-cards.js";

function setup(id, level = 0, enemyCount = 1) {
  const run = E.newRun(414), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  const template = run.battle.enemies[0];
  run.battle.enemies = Array.from({ length: enemyCount }, () => ({
    ...template, hp: 1000, maxHp: 1000, shield: 0, statuses: {}, isBoss: false,
    intent: { type: "guard", value: 0 }, pattern: null,
  }));
  E.attachEnemyAliases(run.battle);
  run.battle.ap = 6;
  run.battle.hand = [{ id, level }];
  return { run, meta, b: run.battle, play: () => E.play(run, 0, meta) };
}

const groups = [
  [GUARD_TIER4_CARDS, "defense"],
  [ABSORB_TIER4_CARDS, "absorb"],
];
for (const [cards, category] of groups) {
  assert.equal(Object.keys(cards).length, 3);
  for (const id of Object.keys(cards)) {
    assert.equal(CARDS[id].tier, 4);
    assert.equal(CARDS[id].maxCopies, 1);
    assert.equal(CARDS[id].maxUpgrade, 1);
    assert.equal(CARDS[id].category, category);
    assert.ok(!getTier1Cards().some((card) => card.id === id));
  }
}

for (const level of [0, 1]) {
  let ctx = setup("guard_hermetic_crystal_belljar", level);
  ctx.b.hand.push(
    { id: "impurity", level: 0 },
    { id: "absorb_precision_pipette", level: 0 },
    { id: "impurity", level: 0 },
  );
  ctx.play();
  assert.equal(ctx.b.shield, [18, 24][level]);
  assert.equal(S.stacks(ctx.run, "protection"), [3, 4][level]);
  assert.deepEqual(ctx.b.hand.map((card) => card.id), ["absorb_precision_pipette"]);

  ctx = setup("guard_solidified_resin_rampart", level, 2);
  ctx.b.enemies[0].intent = { type: "attack", value: 20, attackPattern: "contact" };
  ctx.b.enemies[1].intent = { type: "guard", value: 20 };
  ctx.play();
  assert.equal(ctx.b.shield, [14, 18][level]);
  assert.equal(S.stacks(ctx.run, "thorns"), [5, 7][level]);
  assert.equal(S.stacks(ctx.b.enemies[0], "disarm"), 1);
  assert.equal(S.stacks(ctx.b.enemies[1], "disarm"), 0);

  ctx = setup("guard_sanctuary_of_purified_water", level);
  S.applyStatus(ctx.run, "weak", 2);
  S.applyStatus(ctx.run, "bleed", 4);
  ctx.play();
  assert.equal(ctx.b.shield, [12, 16][level]);
  assert.equal(S.stacks(ctx.run, "weak"), 0);
  assert.equal(S.stacks(ctx.run, "bleed"), 0);
  assert.equal(S.stacks(ctx.run, "regeneration"), [4, 6][level]);

  ctx = setup("absorb_primordial_still", level);
  ctx.play();
  assert.equal(ctx.b.absorb, [18, 25][level]);
  assert.equal(ctx.b.preventAbsorbDecay, true);
  assert.deepEqual(ctx.b.absorbBoosters, [{ amount: [6, 8][level], remaining: 2 }]);

  ctx = setup("absorb_supercritical_reactor", level);
  ctx.b.hand.push({ id: "absorb_pure_oil_drop", level: 0 });
  ctx.b.draw = Array.from({ length: [2, 3][level] }, () => ({ id: "absorb_pure_oil_drop", level: 0 }));
  ctx.play();
  assert.equal(ctx.b.absorb, [10, 14][level]);
  assert.equal(ctx.b.hand.length, 1 + [2, 3][level]);
  assert.ok(ctx.b.hand.every((card) => card.costReduction === 1));
  assert.ok(ctx.b.hand.every((card) => E.cost(ctx.run, card) === 0));

  ctx = setup("absorb_abyssal_leaching_synthesis", level);
  ctx.play();
  assert.equal(ctx.b.enemies[0].hp, 1000 - [16, 22][level]);
  assert.equal(ctx.b.absorb, [16, 22][level]);
  assert.equal(S.stacks(ctx.b.enemies[0], "corrosion"), [5, 7][level]);
  assert.equal(S.stacks(ctx.b.enemies[0], "intimidated"), [3, 5][level]);
}

console.log("PASS tier 4 guard/absorb: six cards, single upgrades, purge, disarm, cleanse, boosters, oil discounts and damage absorption.");

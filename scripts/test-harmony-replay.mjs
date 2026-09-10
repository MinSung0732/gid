import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { CARDS } from "../games/harmony/data.js";

Object.assign(CARDS, {
  test_replay_top: { id: "test_replay_top", name: "top", category: "attack", cost: 0, tier: 1, note: "top", attack: 2, attackPattern: "contact", maxUpgrade: 0 },
  test_replay_middle: { id: "test_replay_middle", name: "middle", category: "attack", cost: 0, tier: 1, note: "middle", attack: 2, attackPattern: "contact", maxUpgrade: 0 },
  test_replay_base: { id: "test_replay_base", name: "base", category: "heal", cost: 0, tier: 1, note: "base", heal: 1, maxUpgrade: 0 },
});

for (const [augment, expectedDamage] of [
  ["trait_celestial_accord_echo", 7],
  ["trait_godhead_olfactive_trinity", 9],
  ["relic_pyramid_mastery_prism", 7],
]) {
  const meta = E.freshMeta(), run = E.newRun(5150, ["test_replay_top", "test_replay_middle", "test_replay_base"]);
  run.inventory = [augment];
  run.route[0] = "battle";
  E.enter(run, meta);
  const enemy = run.battle.enemies[0];
  Object.assign(enemy, { hp: 100, maxHp: 100, shield: 0 });
  run.battle.hand = [
    { id: "test_replay_top", level: 0 },
    { id: "test_replay_middle", level: 0 },
    { id: "test_replay_base", level: 0 },
  ];
  run.battle.ap = 8;
  assert.doesNotThrow(() => {
    E.play(run, 0, meta);
    E.play(run, 0, meta);
    E.play(run, 0, meta);
  }, `${augment} must replay cards without crashing`);
  assert.equal(enemy.hp, 100 - expectedDamage);
  assert.deepEqual(run.battle.notes, []);
}

delete CARDS.test_replay_top;
delete CARDS.test_replay_middle;
delete CARDS.test_replay_base;
console.log("PASS Harmony replay: one-card traits, two-card traits and relic echoes resolve without a crash.");

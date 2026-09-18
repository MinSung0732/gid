import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import {
  analyzeBuild,
  cardAffinityWeight,
  cardBuildIds,
} from "../games/harmony/build-analysis.js";

function maxCombatLikeStreak(route) {
  let current = 0,
    max = 0;
  for (const room of route) {
    if (room === "combat" || room === "elite") {
      current += 1;
      max = Math.max(max, current);
    } else current = 0;
  }
  return max;
}

for (let seed = 1; seed <= 500; seed += 1) {
  const run = E.newRun(seed);
  const route = run.route;
  assert.equal(route.length, 12);
  assert.equal(route[11], "boss");
  assert.equal(route.filter((room) => room === "combat").length, 4);
  assert.ok(route.filter((room) => room === "elite").length >= 1);
  assert.ok(route.filter((room) => room === "elite").length <= 2);
  assert.equal(route.filter((room) => room === "shop").length, 1);
  const eventLike = route.filter((room) =>
    room === "treasure" || room === "golden"
  ).length;
  assert.ok(eventLike >= 4 && eventLike <= 5);
  assert.ok(maxCombatLikeStreak(route) <= 2);
}

{
  const run = E.newRun(9151);
  const meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  const first = run.battle.enemies[0];
  run.battle.enemies = [
    { ...first, hp: 1, maxHp: Math.max(1, first.maxHp), statuses: {} },
    { ...first, id: `${first.id}_b`, hp: 0, statuses: {} },
    { ...first, id: `${first.id}_c`, hp: 0, statuses: {} },
  ];
  run.battle.selectedTarget = 0;
  run.battle.ap = 10;
  run.battle.hand = [{ id: "strike", level: 0 }];
  assert.equal(E.play(run, 0, meta), true);
  assert.equal(run.phase, "reward");
  assert.equal(
    run.reward.metadata.battleCardReward.totalGroups,
    1,
    "normal combat gives one card-draft group regardless of enemy count",
  );
  assert.equal(E.currentRewardOffer(run).optionCount, 3);
  assert.equal(E.currentRewardOffer(run).pickCount, 1);
}

{
  const run = E.newRun(12001);
  run.deck = [
    { id: "contact_glass_dropper_strike", level: 0 },
    { id: "contact_glass_dropper_strike", level: 0 },
    { id: "contact_shattered_ampoule", level: 0 },
    { id: "contact_censer_shove", level: 0 },
  ];
  run.inventory = ["trait_friction_spark", "trait_glass_splinters"];
  const profile = analyzeBuild(run);
  assert.equal(profile.primary?.id, "contact");
  assert.ok(cardBuildIds("contact_censer_shove").has("contact"));
  assert.equal(cardAffinityWeight(run, "contact_censer_shove"), 1.5);
  assert.ok(
    cardAffinityWeight(run, "noncontact_fine_mist_spray") <= 1.2,
    "non-primary cards are not promoted to the primary 1.5 weight",
  );
}

console.log(
  "PASS Harmony route/reward V2 prototype: 4 normal combats, event-heavy pacing, one draft per normal battle, shared build affinity.",
);

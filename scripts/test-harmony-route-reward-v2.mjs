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
  run.inventory = ["trait_heavy_rebound", "trait_tempo_cadence"];
  // Keep this fixture contact-focused. Friction Spark / Glass Splinters also
  // support the status build, which can legitimately outrank contact in the
  // shared analyzer and makes the test assert an incidental ranking.
  const profile = analyzeBuild(run);
  assert.equal(profile.primary?.id, "contact");
  assert.ok(cardBuildIds("contact_censer_shove").has("contact"));
  assert.equal(cardAffinityWeight(run, "contact_censer_shove"), 1.5);
  assert.ok(
    cardAffinityWeight(run, "noncontact_fine_mist_spray") <= 1.2,
    "non-primary cards are not promoted to the primary 1.5 weight",
  );
}

{
  const run = E.newRun(13001), meta = E.freshMeta();
  assert.deepEqual(E.rewardExposure(run), {
    act: 0,
    traitOffersSeen: 0,
    relicOffersSeen: 0,
    statOffersSeen: 0,
    augmentOffersSeen: 0,
  });

  run.route[0] = "golden";
  E.enter(run, meta);
  assert.equal(run.phase, "chest");
  assert.equal(E.openChest(run, meta), true);
  const offer = E.currentRewardOffer(run),
    item = offer.options.find((option) => option.type === "item"),
    exposure = E.rewardExposure(run);
  assert.ok(item, "golden room exposes an item reward");
  assert.equal(exposure.statOffersSeen, item.kind === "stat" ? 1 : 0);
  assert.equal(exposure.traitOffersSeen, item.kind === "trait" ? 1 : 0);
  assert.equal(exposure.relicOffersSeen, item.kind === "relic" ? 1 : 0);
  assert.equal(
    exposure.augmentOffersSeen,
    ["trait", "relic"].includes(item.kind) ? 1 : 0,
    "exposure counts shown augment offers, not claims",
  );
  const beforeSkip = E.rewardExposure(run);
  E.skipReward(run, meta);
  assert.deepEqual(
    E.rewardExposure(run),
    beforeSkip,
    "skipping a shown reward does not erase or double-count exposure",
  );
}

{
  const run = E.newRun(13002);
  run.node = 6;
  assert.deepEqual(E.rewardExposurePity(run), { trait: 1.15, relic: 1 });
  run.node = 8;
  assert.deepEqual(E.rewardExposurePity(run), { trait: 1.15, relic: 1.1 });
  run.node = 9;
  assert.deepEqual(E.rewardExposurePity(run), { trait: 1.25, relic: 1.21 });
  run.rewardExposure.traitOffersSeen = 1;
  run.rewardExposure.relicOffersSeen = 1;
  run.rewardExposure.augmentOffersSeen = 2;
  assert.deepEqual(
    E.rewardExposurePity(run),
    { trait: 1, relic: 1 },
    "pity turns off after both augment families have been seen enough",
  );
}

{
  const run = E.newRun(13003);
  assert.equal(
    E.synergyItemAffinityWeight(run, "trait_friction_spark"),
    1,
    "hidden synergy affinity stays neutral before the run owns a component",
  );
  run.inventory = ["stat_micro_nozzle"];
  assert.equal(
    E.synergyItemAffinityWeight(run, "trait_friction_spark"),
    1.1,
    "one owned hidden-synergy component gives only a light trait nudge",
  );
  assert.equal(
    E.synergyItemAffinityWeight(run, "relic_scented_candle_wick"),
    1.1,
    "the same light nudge applies to relic components",
  );
  assert.equal(
    E.synergyItemAffinityWeight(run, "stat_flint_pestle_head"),
    1,
    "stat rewards are not build-matched by the hidden-synergy affinity",
  );
  run.inventory.push("relic_scented_candle_wick");
  assert.equal(
    E.synergyItemAffinityWeight(run, "trait_friction_spark"),
    1.2,
    "two owned components softly favor the missing trait without guaranteeing it",
  );
  assert.equal(
    E.synergyItemAffinityWeight(run, "trait_tempo_cadence"),
    1,
    "unrelated traits remain neutral",
  );
}

console.log(
  "PASS Harmony route/reward V2 prototype: route pacing, one combat draft, shared card affinity, augment exposure tracking, light late-act pity, and soft hidden-synergy item affinity.",
);

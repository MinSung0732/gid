import assert from "node:assert/strict";
import { normalizeGamePayload } from "../games/harmony/persistence.js";
import {
  ACT7_ROUTES,
  CAMPAIGN_LOOPS,
  clearMilestone,
  progression,
} from "../games/harmony/campaign-progression.js";

const normalized = normalizeGamePayload({
  meta: {
    highestLoop: 19,
    totalRuns: 3,
    highScore: 12345,
    unlocked: [],
  },
  run: null,
});

assert.ok(normalized, "legacy meta payload should normalize");
assert.deepEqual(
  normalized.meta.campaignClears,
  [],
  "persistence may materialize the old missing campaignClears field as an empty array",
);

const unlocked = progression(normalized.meta);
assert.equal(unlocked.act4, true, "legacy 3막/심연 기록 should unlock Act 4 after persistence normalization");
assert.equal(unlocked.act5, false, "legacy abyss depth must not unlock new Act 5");
assert.equal(unlocked.act6, false, "legacy abyss depth must not unlock new Act 6");
assert.equal(unlocked.act7, false, "legacy abyss depth must not unlock new Act 7");
assert.equal(unlocked.abyss, false, "new Abyss requires a new Act 7 clear");

const fresh = progression(normalizeGamePayload({ meta: { highestLoop: 0 }, run: null }).meta);
assert.equal(fresh.act4, false, "fresh saves must not receive migrated campaign clears");

const beforeAnyAct7 = {
  highestLoop: CAMPAIGN_LOOPS.ACT6,
  campaignClears: ["act3", "act4", "act6"],
};
assert.equal(
  clearMilestone(
    { loop: CAMPAIGN_LOOPS.ACT7, act7Route: ACT7_ROUTES.FLESH },
    beforeAnyAct7,
  )?.key,
  "abyss",
  "the first cleared Act 7 route should announce Abyss unlock",
);

const afterOneAct7 = {
  highestLoop: CAMPAIGN_LOOPS.ACT7,
  campaignClears: ["act3", "act4", "act6", "act7:7-1"],
};
assert.equal(
  clearMilestone(
    { loop: CAMPAIGN_LOOPS.ACT7, act7Route: ACT7_ROUTES.HEAT },
    afterOneAct7,
  ),
  null,
  "later first-clears of other Act 7 routes must not announce Abyss unlock again",
);

console.log("Harmony late campaign persistence migration tests passed.");

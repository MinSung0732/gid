import assert from "node:assert/strict";
import { normalizeGamePayload } from "../games/harmony/persistence.js";
import { actInfo as harmonyActInfo } from "../games/harmony/engine.js";
import {
  ACT7_ROUTES,
  CAMPAIGN_LOOPS,
  clearMilestone,
  progression,
} from "../games/harmony/campaign-progression.js";
import { LATE_GAME_ACTS } from "../games/harmony/late-game-content.js";
import { prepareLateEnemyAction } from "../games/harmony/late-game-runtime.js";
import { prepareLateBosses } from "../games/harmony/late-game-boss-phase.js";
import { lateEnemyTelemetry } from "../games/harmony/late-game-ui.js";
import * as S from "../games/harmony/statuses.js";

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
const firstAct7Milestone = clearMilestone(
  { loop: CAMPAIGN_LOOPS.ACT7, act7Route: ACT7_ROUTES.FLESH },
  beforeAnyAct7,
);
assert.equal(firstAct7Milestone?.key, "abyss", "the first cleared Act 7 route should announce Abyss unlock");
assert.equal(firstAct7Milestone?.forceHome, true, "first Act 7 clear must unlock Abyss then end the run at the share screen");

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

// Public Act info and actual late-game encounter scaling must use the same Abyss curve.
{
  const depth1 = harmonyActInfo(CAMPAIGN_LOOPS.ABYSS_START),
    depth2 = harmonyActInfo(CAMPAIGN_LOOPS.ABYSS_START + 1);
  assert.equal(depth1.hp, 1);
  assert.equal(depth1.attack, 1);
  assert.equal(depth2.hp, 1.18);
  assert.equal(depth2.attack, 1.08);
}

{
  const boss = structuredClone(LATE_GAME_ACTS.act6.bosses.grand_alchemy_perfume_core);
  boss.hp = boss.maxHp = boss.baseHp;
  boss.customState = {};
  const run = { loop: CAMPAIGN_LOOPS.ABYSS_START + 1, battle: { enemies: [boss] } };
  prepareLateBosses(run);
  assert.equal(
    boss.phases[0].opening[2].value,
    19,
    "Abyss depth 2 should scale authored boss phase attacks by 8%",
  );
  assert.equal(
    boss.phases[1].cycle[2].value,
    24,
    "hard-coded later boss phases must keep the same Abyss attack scaling",
  );
  assert.equal(
    boss.phases.some((phase) => [phase.onEnter, ...(phase.opening || []), ...(phase.cycle || [])]
      .some((action) => action?._lateAuthoredPhaseAction)),
    false,
    "authored scaling markers must be consumed so phases cannot be double-scaled after save/resume",
  );
}

// Memory Harvester reads resonance on itself, because resonance is an enemy mark.
{
  const enemy = structuredClone(LATE_GAME_ACTS["act7-3"].normals.memory_harvester);
  enemy.hp = enemy.maxHp = enemy.baseHp;
  enemy.shield = 0;
  enemy.statuses = S.createStatuses();
  enemy.customState = {};
  S.applyStatus(enemy, "resonance", 4);
  enemy.intent = structuredClone(enemy.pattern[1]);
  const run = {
    battle: {
      enemies: [enemy],
      shield: 0,
      cardsPlayedThisTurn: 0,
      contactCardsPlayedThisTurn: 0,
      nonContactCardsPlayedThisTurn: 0,
    },
  };
  prepareLateEnemyAction(run, enemy);
  assert.equal(enemy.intent.value, 20, "잔향 4 이상이면 기억 채집자 공격이 25% 강화되어야 한다");
  const rows = lateEnemyTelemetry(run, enemy).map((row) => row.text);
  assert.ok(rows.some((text) => text.includes("잔향 4 / 4")), "잔향 강화 임계값은 UI에 예고되어야 한다");
}

console.log("Harmony late campaign persistence migration tests passed.");

import assert from "node:assert/strict";
import fs from "node:fs";
import { createGameActionOrchestrator } from "../games/harmony/game-action-orchestrator.js";

const mainSource = fs.readFileSync(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const moduleSource = fs.readFileSync(new URL("../games/harmony/game-action-orchestrator.js", import.meta.url), "utf8");

assert.match(mainSource, /createGameActionOrchestrator/);
assert.match(mainSource, /await handleGameAction\(button\);/);
assert.doesNotMatch(mainSource, /E\.enter\(run, meta\);/);
assert.doesNotMatch(mainSource, /E\.discardFromHand\(run,/);
assert.match(moduleSource, /engine\.enter\(run, meta\);/);
assert.match(moduleSource, /engine\.shop\(run, "offer", index, meta\);/);
assert.match(moduleSource, /engine\.chooseSpecial\(run, action\.replace\("special-", ""\), meta, index\);/);
assert.match(moduleSource, /engine\.nextLoop\(run, meta, true\);/);
assert.match(moduleSource, /openStartingDeckBuilder\(action === "test-new"\);/);
assert.match(moduleSource, /showImpurityOverflowQueue/);
assert.match(moduleSource, /waitForLethalHitEffects/);

function button(action, data = {}) {
  return {
    dataset: { action, ...data },
    closest() {
      return null;
    },
  };
}

function createHarness({ run: initialRun, engineOverrides = {}, confirmResult = true } = {}) {
  let run = initialRun ?? {
      phase: "map",
      hp: 80,
      finished: false,
      battle: null,
    },
    started = false;
  const events = [];

  const engine = {
    discardFromHand: () => false,
    enter() {},
    selectTarget() {},
    openChest() {},
    claimReward() {},
    skipReward() {},
    advance() {},
    rest() {},
    leaveRest() {},
    shop() {},
    chooseSpecialCurse() {},
    chooseSpecial() {},
    leaveSpecial() {},
    potion() { return false; },
    nextLoop() {},
    checkUnlocks() { events.push(["unlocks"]); },
    ...engineOverrides,
  };

  const feedback = {
    animateDiscardedCard: async () => events.push(["discard-animation"]),
    showImpurityOverflowQueue: async (hits) => events.push(["impurity", hits.length]),
    showHarmonyFeedback: (hits) => events.push(["harmony", hits.length]),
    showEnemyHitQueue: async (hits) => events.push(["enemy-hits", hits.length]),
    showStatusDamageQueue: async (hits) => events.push(["status", hits.length]),
    showPlayerDeath: async (amount) => events.push(["player-death", amount]),
    waitForLethalHitEffects: async (hits) => events.push(["lethal-wait", hits.length]),
    showMonsterDeath: async (hits) => events.push(["monster-death", hits.length]),
    stageDrawFeedback: (amount) => events.push(["stage-draw", amount]),
    showShuffleFeedback: async (amount) => events.push(["shuffle", amount]),
    showDrawFeedback: async (amount) => events.push(["draw", amount]),
    showPlayerDamage: (amount) => events.push(["player-damage", amount]),
    showPlayerHealing: (amount) => events.push(["heal", amount]),
    showAbsorbGain: (amount) => events.push(["absorb", amount]),
    showShieldGain: (amount) => events.push(["shield", amount]),
  };

  const { handleGameAction } = createGameActionOrchestrator({
    engine,
    enemyDefinitionFor: () => ({}),
    getRun: () => run,
    getMeta: () => ({}),
    setStarted: (value) => {
      started = value;
      events.push(["started", value]);
    },
    setCardAnimating: (value) => events.push(["animating", value]),
    save: () => events.push(["save"]),
    render: () => events.push(["render"]),
    sleep: async (amount) => events.push(["sleep", amount]),
    reducedCombatMotion: () => false,
    hideRestUpgradeComparison: () => events.push(["hide-upgrade"]),
    confirmReplaceRun: () => {
      events.push(["confirm"]);
      return confirmResult;
    },
    openStartingDeckBuilder: (testMode) => events.push(["builder", testMode]),
    sound: {
      potion: () => events.push(["potion-sfx"]),
      playerStatusHit: () => events.push(["status-sfx"]),
    },
    feedback,
  });

  return {
    get run() { return run; },
    set run(value) { run = value; },
    get started() { return started; },
    events,
    handleGameAction,
  };
}

{
  const run = {
      phase: "battle",
      hp: 80,
      finished: false,
      battle: { hand: [{ id: "a" }], discard: [], enemies: [], shield: 0 },
    },
    harness = createHarness({
      run,
      engineOverrides: {
        discardFromHand(currentRun, index) {
          assert.equal(index, 0);
          currentRun.battle.discard.push(currentRun.battle.hand.splice(index, 1)[0]);
          return true;
        },
      },
    });
  assert.equal(await harness.handleGameAction(button("discard-choice", { index: "0" })), true);
  assert.deepEqual(run.battle.hand, []);
  assert.ok(harness.events.some(([name]) => name === "discard-animation"));
  assert.ok(harness.events.some(([name]) => name === "save"));
  assert.deepEqual(harness.events.at(-1), ["animating", false]);
  assert.equal(harness.events.some(([name]) => name === "unlocks"), false);
}

{
  const harness = createHarness({
    engineOverrides: {
      enter(run) {
        run.phase = "battle";
        run.battle = { enemies: [], shield: 0 };
        run._drawFeedback = 3;
        run._shuffleFeedback = 1;
      },
    },
  });
  assert.equal(await harness.handleGameAction(button("enter")), true);
  assert.ok(harness.events.some(([name]) => name === "unlocks"));
  assert.ok(harness.events.some(([name, amount]) => name === "stage-draw" && amount === 3));
  assert.ok(harness.events.some(([name, amount]) => name === "shuffle" && amount === 1));
  assert.ok(harness.events.some(([name, amount]) => name === "draw" && amount === 3));
  assert.deepEqual(harness.events.at(-1), ["animating", false]);
}

{
  const harness = createHarness({
    run: { phase: "special", hp: 20, finished: false, battle: null },
    engineOverrides: {
      chooseSpecial(run, choice) {
        assert.equal(choice, "blood_trade");
        run.hp = 0;
        run.phase = "result";
        run._damageFeedback = [{ target: "player", statusId: "bleed", amount: 20 }];
      },
    },
  });
  assert.equal(await harness.handleGameAction(button("special-blood_trade", { index: "0" })), true);
  assert.ok(harness.events.some(([name, amount]) => name === "player-death" && amount === 20));
  assert.ok(harness.events.some(([name]) => name === "save"));
  assert.deepEqual(harness.events.at(-1), ["animating", false]);
}

{
  const run = { phase: "map", hp: 80, finished: false, battle: null, _drawFeedback: 2 },
    harness = createHarness({ run, confirmResult: false });
  assert.equal(await harness.handleGameAction(button("test-new")), true);
  assert.ok(harness.events.some(([name]) => name === "confirm"));
  assert.equal(harness.events.some(([name]) => name === "builder"), false);
  assert.equal(run._drawFeedback, undefined);
  assert.equal(harness.events.some(([name]) => name === "unlocks"), false);
}

{
  const harness = createHarness();
  assert.equal(await harness.handleGameAction(button("resume")), true);
  assert.equal(harness.started, true);
  assert.ok(harness.events.some(([name]) => name === "unlocks"));
  assert.ok(harness.events.some(([name]) => name === "render"));
}

console.log("Harmony game action orchestrator regression tests passed.");

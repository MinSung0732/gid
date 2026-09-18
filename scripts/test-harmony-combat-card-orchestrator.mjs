import assert from "node:assert/strict";
import fs from "node:fs";
import { createCombatCardOrchestrator } from "../games/harmony/combat-card-orchestrator.js";

const mainSource = fs.readFileSync(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const moduleSource = fs.readFileSync(new URL("../games/harmony/combat-card-orchestrator.js", import.meta.url), "utf8");

assert.match(mainSource, /createCombatCardOrchestrator/);
assert.match(mainSource, /await handleCardPlay\(button, index\);/);
assert.doesNotMatch(mainSource, /E\.play\(run, index, meta\);/);
assert.match(moduleSource, /engine\.play\(run, index, meta\);/);
assert.match(moduleSource, /animateWeakContactAttack/);
assert.match(moduleSource, /animateStrongContactAttack/);
assert.match(moduleSource, /animateNonContactCast/);
assert.match(moduleSource, /showImpurityOverflowQueue/);
assert.match(moduleSource, /waitForLethalHitEffects/);

function buttonStub() {
  return {
    classes: [],
    classList: {
      add(value) {
        this.owner.classes.push(value);
      },
      owner: null,
    },
  };
}

function createHarness({ card, onPlay, enemies = null }) {
  const playedCard = { id: "test-card" },
    run = {
      phase: "battle",
      hp: 80,
      battle: {
        hand: [playedCard],
        discard: [],
        enemies: enemies || [{ id: "dummy", hp: 20, maxHp: 20, shield: 0 }],
        selectedTarget: 0,
        shield: 0,
      },
    },
    events = [],
    button = buttonStub();
  button.classList.owner = button;
  globalThis.document = {
    querySelectorAll(selector) {
      assert.equal(selector, ".hand > .card");
      return [button];
    },
  };

  const feedback = {
    showApSpend: (_button, spent) => events.push(["ap", spent]),
    animateDiscardedCard: async () => events.push(["discard"]),
    animateWeakContactAttack: async (_button, target, onImpact) => {
      events.push(["weak", target]);
      onImpact();
    },
    animateStrongContactAttack: async () => events.push(["strong"]),
    showStrongContactImpact: (target, _super, presentation) => events.push(["strong-impact", target, presentation]),
    showWeakContactImpact: (target, presentation) => events.push(["weak-impact", target, presentation]),
    resolveMultiHitImpactPoint: ({ targetIndex = 0, hitIndex = 0 }) => ({ x: 100 + targetIndex * 20 + hitIndex, y: 200 + hitIndex, localX: 50 + hitIndex, localY: 60 + hitIndex, region: hitIndex ? "RT" : "CC" }),
    showEnemyShieldBlock: () => events.push(["enemy-block"]),
    updateEnemyHealthFeedback: (_target, hp) => events.push(["enemy-hp", hp]),
    showHitFeedback: (damage, target, pattern, strong, superStrong, blocked, fx, presentation) => {
      events.push(["hit", damage, target, pattern, presentation]);
      return presentation?.impactPoint || null;
    },
    animateNonContactCast: async () => events.push(["noncontact"]),
    strongestAttackPower: () => "weak",
    showEnemyHitQueue: async (hits) => events.push(["hit-queue", hits.length]),
    collapseUsedCard: async () => events.push(["collapse"]),
    showImpurityOverflowQueue: async (hits) => events.push(["impurity", hits.length]),
    showHarmonyFeedback: (hits) => events.push(["harmony", hits.length]),
    showStatusDamageQueue: async (hits) => events.push(["status", hits.length]),
    showStatusProcQueue: async (hits) => {
      if (hits.length) events.push(["status-proc-queue", hits.length]);
    },
    showStatusProcVfx: async (event, { impactPoint = null } = {}) =>
      events.push(["status-proc", event.sourceImpactId, impactPoint]),
    showPlayerDeath: async () => events.push(["player-death"]),
    waitForLethalHitEffects: async () => events.push(["lethal-wait"]),
    showMonsterDeath: async () => events.push(["monster-death"]),
    stageDrawFeedback: (amount) => events.push(["stage-draw", amount]),
    showShuffleFeedback: async () => events.push(["shuffle"]),
    showDrawFeedback: async () => events.push(["draw"]),
    showPlayerDamage: () => events.push(["player-damage"]),
    showPlayerHealing: (amount) => events.push(["heal", amount]),
    showAbsorbGain: () => events.push(["absorb"]),
    showShieldGain: () => events.push(["shield"]),
    playPlayerStatusHit: () => events.push(["status-sfx"]),
  };
  const engine = {
    cost: () => 1,
    combatFxPowerTier: () => "weak",
    play(currentRun, index) {
      const used = currentRun.battle.hand.splice(index, 1)[0];
      currentRun.battle.discard.push(used);
      onPlay?.(currentRun);
    },
    checkUnlocks: () => events.push(["unlocks"]),
  };
  const sound = {
    impurity: () => events.push(["impurity-sfx"]),
    cardPlay: () => events.push(["card-sfx"]),
    absorbCard: () => events.push(["absorb-sfx"]),
    barrierBreakSuperContactFly: () => events.push(["barrier-sfx"]),
  };
  const { handleCardPlay } = createCombatCardOrchestrator({
    engine,
    cards: { "test-card": card },
    enemyDefinitionFor: () => ({}),
    getRun: () => run,
    getMeta: () => ({}),
    setCardAnimating: (value) => events.push(["animating", value]),
    save: () => events.push(["save"]),
    render: () => events.push(["render"]),
    sleep: async () => {},
    startingCardCategory: (definition) => definition.category || "attack",
    sound,
    feedback,
  });
  return { run, events, button, handleCardPlay };
}

{
  const harness = createHarness({
    card: { category: "heal" },
    onPlay(run) {
      run._healingFeedback = 7;
    },
  });
  assert.equal(await harness.handleCardPlay(harness.button, 0), true);
  assert.ok(harness.events.some(([name]) => name === "card-sfx"));
  assert.ok(harness.events.some(([name, amount]) => name === "ap" && amount === 1));
  assert.ok(harness.events.some(([name]) => name === "collapse"));
  assert.ok(harness.events.some(([name, amount]) => name === "heal" && amount === 7));
  assert.deepEqual(harness.events.at(-1), ["animating", false]);
}

{
  const harness = createHarness({
    card: { category: "attack", attack: 10, attackPattern: "contact" },
    onPlay(run) {
      run.battle.enemies[0].hp = 10;
      run._enemyHitFeedback = [{
        targetIndex: 0,
        damage: 10,
        blocked: 0,
        attackPattern: "contact",
        fx: { power: "weak" },
      }];
    },
  });
  assert.equal(await harness.handleCardPlay(harness.button, 0), true);
  assert.ok(harness.events.some(([name, target]) => name === "weak" && target === 0));
  assert.ok(harness.events.some(([name]) => name === "weak-impact"));
  assert.ok(harness.events.some(([name, damage]) => name === "hit" && damage === 10));
  assert.ok(harness.events.some(([name, hp]) => name === "enemy-hp" && hp === 10));
}

{
  const harness = createHarness({
    card: { category: "attack", attack: 10, attackPattern: "contact" },
    onPlay(run) {
      run.battle.enemies[0].hp = 8;
      run._enemyHitFeedback = [{
        targetIndex: 0,
        damage: 12,
        blocked: 0,
        attackPattern: "contact",
        impactId: 501,
        fx: { power: "weak" },
      }];
      run._damageFeedback = [{
        target: "enemy",
        targetIndex: 0,
        statusId: "bleed",
        amount: 3,
        sourceImpactId: 501,
      }];
      run._statusProcFeedback = [{
        target: "enemy",
        targetIndex: 0,
        statusId: "bleed",
        amount: 3,
        consumed: 1,
        sourceImpactId: 501,
        stackBefore: 2,
        stackAfter: 1,
      }];
    },
  });
  assert.equal(await harness.handleCardPlay(harness.button, 0), true);
  const hitIndex = harness.events.findIndex(([name]) => name === "hit"),
    procIndex = harness.events.findIndex(
      ([name, impactId]) => name === "status-proc" && impactId === 501,
    );
  assert.ok(hitIndex >= 0 && procIndex > hitIndex, "status proc VFX follows its linked hit");
  assert.ok(
    !harness.events.some(([name, count]) => name === "status" && count > 0),
    "linked proc damage does not also use the generic status queue",
  );
}

{
  const hits = [0, 1, 2].map((index) => ({
    targetIndex: 0,
    damage: 1,
    blocked: 0,
    attackPattern: "contact",
    impactId: 600 + index,
    fx: { power: "weak" },
  }));
  const harness = createHarness({
    card: { category: "attack", attack: 1, attackPattern: "contact" },
    enemies: [{ id: "dummy", hp: 30, maxHp: 30, shield: 0 }],
    onPlay(run) {
      run.battle.enemies[0].hp = 27;
      run._enemyHitFeedback = hits;
      run._statusProcFeedback = [{
        target: "enemy",
        targetIndex: 0,
        statusId: "bleed",
        amount: 1,
        consumed: 1,
        sourceImpactId: 601,
        stackBefore: 2,
        stackAfter: 1,
      }];
    },
  });
  assert.equal(await harness.handleCardPlay(harness.button, 0), true);
  assert.equal(harness.events.filter(([name]) => name === "weak").length, 1, "contact card attack motion runs once for multi-hit");
  const hitEvents = harness.events.filter(([name]) => name === "hit");
  assert.equal(hitEvents.length, 3, "all actual contact hit feedback events are presented");
  assert.deepEqual(hitEvents.map((event) => event[2]), [0, 0, 0]);
  assert.deepEqual(hitEvents.map((event) => event[4]?.hitIndex), [0, 1, 2]);
  assert.ok(hitEvents.every((event) => event[4]?.multiHit === true));
  assert.equal(hitEvents.at(-1)[4].isFinisher, true);
  const secondPoint = hitEvents[1][4].impactPoint;
  const linkedProc = harness.events.find(([name, impactId]) => name === "status-proc" && impactId === 601);
  assert.deepEqual(linkedProc?.[2], secondPoint, "linked bleed proc reuses the exact hit impact point");
}

{
  const targets = [0, 1, 1, 0, 1, 0];
  const harness = createHarness({
    card: { category: "attack", attack: 1, attackPattern: "nonContact" },
    enemies: [
      { id: "dummy-a", hp: 30, maxHp: 30, shield: 0 },
      { id: "dummy-b", hp: 30, maxHp: 30, shield: 0 },
    ],
    onPlay(run) {
      run.battle.enemies[0].hp = 27;
      run.battle.enemies[1].hp = 27;
      run._enemyHitFeedback = targets.map((targetIndex, index) => ({
        targetIndex,
        damage: 1,
        blocked: 0,
        attackPattern: "nonContact",
        impactId: 700 + index,
        fx: { power: "weak" },
      }));
      run._statusProcFeedback = [{
        target: "enemy",
        targetIndex: 1,
        statusId: "burning",
        amount: 1,
        consumed: 1,
        sourceImpactId: 702,
        stackBefore: 2,
        stackAfter: 1,
      }];
    },
  });
  assert.equal(await harness.handleCardPlay(harness.button, 0), true);
  assert.equal(harness.events.filter(([name]) => name === "noncontact").length, 1, "non-contact cast animation runs once for multi-hit");
  const hitEvents = harness.events.filter(([name]) => name === "hit");
  assert.equal(hitEvents.length, 6);
  assert.deepEqual(hitEvents.map((event) => event[2]), targets, "presentation preserves engine-selected randomEachHit target order");
  assert.ok(hitEvents.every((event) => event[4]?.multiHit === true));
  const thirdPoint = hitEvents[2][4].impactPoint;
  const linkedProc = harness.events.find(([name, impactId]) => name === "status-proc" && impactId === 702);
  assert.deepEqual(linkedProc?.[2], thirdPoint, "linked burning proc reuses the exact hit impact point");
}

assert.match(moduleSource, /createMultiHitPresentationScheduler/);
assert.match(moduleSource, /usesMultiHitPresentation\(contactHits\)/);
assert.match(moduleSource, /usesMultiHitPresentation\(nonContactHits\)/);
assert.match(moduleSource, /showHitFeedback\([\s\S]*?presentation,/s);
assert.match(moduleSource, /queueStatusProcsForHit\(hit, impactPoint\)/);

console.log("Harmony combat card orchestrator regression tests passed.");

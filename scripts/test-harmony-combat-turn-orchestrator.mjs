import assert from "node:assert/strict";
import fs from "node:fs";
import { createCombatTurnOrchestrator } from "../games/harmony/combat-turn-orchestrator.js";

function createHarness({ run, engineOverrides = {}, animating = false } = {}) {
  const events = [];
  let locked = animating;
  const engine = {
    executePlayerTurnEnd() {
      events.push("player-turn-end");
      return true;
    },
    executeSingleEnemyAction() {
      events.push("enemy-action");
      return {
        type: "guard",
        shieldGained: 4,
        playerDebuffs: [],
      };
    },
    executeRoundEnd() {
      events.push("round-end");
    },
    ...engineOverrides,
  };
  const enemyElement = {
    classList: {
      add(name) {
        events.push(`class:${name}`);
      },
    },
  };
  const feedback = {
    showAbsorbLoss: (amount) => events.push(`absorb-loss:${amount}`),
    showAbsorbGain: (amount) => events.push(`absorb-gain:${amount}`),
    getEnemyElement: () => enemyElement,
    getPlayerImpactPoint: () => ({ x: 1, y: 2 }),
    updatePlayerHealthFeedback: () => events.push("player-health"),
    showPlayerContactImpact: () => events.push("player-impact"),
    showShieldBlock: () => events.push("shield-block"),
    showPlayerImpactShieldBlock: () => events.push("impact-shield-block"),
    showPlayerDamage: (amount) => events.push(`player-damage:${amount}`),
    showPlayerHealing: (amount) => events.push(`heal:${amount}`),
    showShieldGain: (amount) => events.push(`shield-gain:${amount}`),
    animateEnemyContactAttack: async (_enemy, _strong, _superStrong, onImpact) => {
      events.push("enemy-contact-animation");
      onImpact({ x: 3, y: 4 });
    },
    combatEffectsEnabled: () => true,
    showEnemyActionPopup: (_index, text, className) =>
      events.push(`popup:${className}:${text}`),
    showEnemyDebuffSmoke: () => events.push("debuff-smoke"),
    showEnemyShieldBlock: () => events.push("enemy-shield-block"),
    showHitFeedback: () => events.push("hit-feedback"),
    showStatusDamageQueue: async () => events.push("status-queue"),
    showStatusProcQueue: async () => {},
    showStatusProcVfx: async () => {},
    showImpurityOverflowQueue: async () => events.push("impurity-overflow-queue"),
    showPlayerDeath: async (amount) => events.push(`player-death:${amount}`),
    showMonsterDeath: async () => events.push("monster-death"),
    showEnemyHitQueue: async () => events.push("enemy-hit-queue"),
    stageDrawFeedback: (amount) => events.push(`stage-draw:${amount}`),
    showShuffleFeedback: async (amount) => events.push(`shuffle:${amount}`),
    showDrawFeedback: async (amount) => events.push(`draw:${amount}`),
    playPlayerStatusHit: () => events.push("player-status-hit"),
    showEnrageDamage: (amount) => events.push(`enrage:${amount}`),
  };
  const orchestrator = createCombatTurnOrchestrator({
    engine,
    enemyDefinitionFor: () => ({ material: "glass" }),
    getRun: () => run,
    getMeta: () => ({ seed: 1 }),
    getCardAnimating: () => locked,
    setCardAnimating: (value) => {
      locked = value;
      events.push(`locked:${value}`);
    },
    save: () => events.push("save"),
    render: () => events.push("render"),
    sleep: async (milliseconds) => events.push(`sleep:${milliseconds}`),
    feedback,
  });
  return { orchestrator, events, isLocked: () => locked };
}

{
  const run = {
    phase: "battle",
    hp: 80,
    maxHp: 80,
    battle: {
      enemyPhase: false,
      shield: 0,
      actingEnemy: null,
      enemies: [{ id: "dummy", hp: 10, maxHp: 10, statuses: {} }],
    },
  };
  const { orchestrator, events, isLocked } = createHarness({ run });
  await orchestrator.handleEndTurn();
  assert.equal(isLocked(), false);
  assert.deepEqual(
    events.filter((event) => ["player-turn-end", "enemy-action", "round-end"].includes(event)),
    ["player-turn-end", "enemy-action", "round-end"],
  );
  assert.ok(events.includes("class:enemy-guard-pulse"));
  assert.ok(events.includes("popup:guard-popup:방어막 +4"));
  assert.ok(events.includes("locked:true"));
  assert.equal(events.at(-1), "locked:false");
}

{
  const run = {
    phase: "battle",
    hp: 80,
    maxHp: 80,
    battle: { enemyPhase: false, shield: 0, enemies: [] },
  };
  const { orchestrator, events } = createHarness({ run, animating: true });
  await orchestrator.handleEndTurn();
  assert.deepEqual(events, []);
}

{
  const run = {
    phase: "battle",
    hp: 8,
    maxHp: 80,
    battle: {
      enemyPhase: false,
      shield: 0,
      actingEnemy: null,
      enemies: [{ id: "dummy", hp: 10, maxHp: 10, statuses: {} }],
    },
  };
  const { orchestrator, events, isLocked } = createHarness({
    run,
    engineOverrides: {
      executeSingleEnemyAction() {
        events.push("enemy-action");
        run.hp = 0;
        run.phase = "result";
        return {
          type: "attack",
          attackPattern: "contact",
          damage: 8,
          blocked: 0,
          playerDied: true,
          playerDebuffs: [],
          hits: [{ damage: 8, blocked: 0 }],
        };
      },
      executeRoundEnd() {
        events.push("round-end");
      },
    },
  });
  await orchestrator.handleEndTurn();
  assert.equal(isLocked(), false);
  assert.ok(events.includes("enemy-contact-animation"));
  assert.ok(events.includes("player-damage:8"));
  assert.ok(events.includes("player-death:0"));
  assert.ok(!events.includes("round-end"));
}


{
  const run = {
    phase: "battle",
    hp: 80,
    maxHp: 80,
    battle: {
      enemyPhase: false,
      shield: 20,
      actingEnemy: null,
      enemies: [{ id: "dummy", hp: 30, maxHp: 30, statuses: {} }],
    },
  };
  const { orchestrator, events } = createHarness({
    run,
    engineOverrides: {
      executePlayerTurnEnd() {
        events.push("player-turn-end");
        run._enemyHitFeedback = [{
          targetIndex: 0,
          damage: 4,
          blocked: 0,
          statusId: null,
          attackPattern: "contact",
        }];
        run._shieldGainFeedback = 3;
        run._absorbFeedback = 2;
        return true;
      },
      executeSingleEnemyAction() {
        events.push("enemy-action");
        return { type: "guard", shieldGained: 0, playerDebuffs: [] };
      },
      executeRoundEnd() {
        events.push("round-end");
      },
    },
  });
  await orchestrator.handleEndTurn();
  const hitIndex = events.indexOf("enemy-hit-queue"),
    enemyIndex = events.indexOf("enemy-action"),
    shieldIndex = events.indexOf("shield-gain:3"),
    absorbIndex = events.indexOf("absorb-gain:2");
  assert.ok(hitIndex >= 0 && hitIndex < enemyIndex, "end-turn enemy hit feedback flushes before Enemy Phase");
  assert.ok(shieldIndex >= 0 && shieldIndex < enemyIndex, "end-turn shield gain feedback flushes before Enemy Phase");
  assert.ok(absorbIndex >= 0 && absorbIndex < enemyIndex, "end-turn absorb feedback flushes before Enemy Phase");
  assert.equal(run._enemyHitFeedback, undefined);
  assert.equal(run._shieldGainFeedback, undefined);
  assert.equal(run._absorbFeedback, undefined);
}

{
  const run = {
    phase: "battle",
    hp: 80,
    maxHp: 80,
    battle: {
      enemyPhase: false,
      shield: 20,
      actingEnemy: null,
      enemies: [{ id: "dummy", hp: 30, maxHp: 30, statuses: {} }],
    },
  };
  const { orchestrator, events } = createHarness({
    run,
    engineOverrides: {
      executeSingleEnemyAction() {
        events.push("enemy-action");
        run._absorbFeedback = 4;
        return {
          type: "attack",
          attackPattern: "nonContact",
          damage: 0,
          blocked: 8,
          hits: [{ damage: 0, blocked: 8 }],
          playerDebuffs: [],
          playerDied: false,
        };
      },
    },
  });
  await orchestrator.handleEndTurn();
  const blockIndex = events.indexOf("shield-block"),
    absorbIndex = events.indexOf("absorb-gain:4");
  assert.ok(blockIndex >= 0 && absorbIndex > blockIndex, "blocked enemy attack presents Absorb Gain after Shield Block");
  assert.equal(events.filter((event) => event === "absorb-gain:4").length, 1);
}

{
  const run = {
    phase: "battle",
    hp: 50,
    maxHp: 80,
    battle: { enemyPhase: false, shield: 0, actingEnemy: null, enemies: [] },
  };
  const { orchestrator, events } = createHarness({
    run,
    engineOverrides: {
      executeRoundEnd() {
        events.push("round-end");
        run.hp = 44;
        run._playerDamageFeedback = 10;
        run._healingFeedback = 4;
        run._shieldGainFeedback = 5;
        run._absorbFeedback = 8;
      },
    },
  });
  await orchestrator.handleEndTurn();
  const damageIndex = events.indexOf("player-damage:10"),
    healIndex = events.indexOf("heal:4"),
    shieldIndex = events.indexOf("shield-gain:5"),
    absorbIndex = events.indexOf("absorb-gain:8");
  assert.ok(damageIndex >= 0, "round-end direct player damage is presented");
  assert.ok(healIndex > damageIndex, "turn-start healing follows direct damage");
  assert.ok(shieldIndex > healIndex, "turn-start shield gain follows healing");
  assert.ok(absorbIndex > shieldIndex, "turn-start absorb gain follows shield gain");
  assert.equal(events.filter((event) => event === "player-damage:10").length, 1);
  assert.equal(events.filter((event) => event === "heal:4").length, 1);
  assert.equal(events.filter((event) => event === "shield-gain:5").length, 1);
  assert.equal(events.filter((event) => event === "absorb-gain:8").length, 1);
  assert.equal(run._playerDamageFeedback, undefined);
  assert.equal(run._healingFeedback, undefined);
  assert.equal(run._shieldGainFeedback, undefined);
  assert.equal(run._absorbFeedback, undefined);
}

{
  const run = {
    phase: "battle",
    hp: 40,
    maxHp: 80,
    battle: {
      enemyPhase: false,
      shield: 0,
      actingEnemy: null,
      enemies: [{ id: "dummy", hp: 10, maxHp: 10, statuses: {} }],
    },
  };
  const { orchestrator, events } = createHarness({
    run,
    engineOverrides: {
      executeSingleEnemyAction() {
        events.push("enemy-action");
        return { type: "guard", shieldGained: 0, playerDebuffs: [] };
      },
      executeRoundEnd() {
        events.push("round-end");
        run.battle.enemies[0].hp = 0;
        run.phase = "reward";
        run.hp = 42;
        run._healingFeedback = 2;
      },
    },
  });
  await orchestrator.handleEndTurn();
  assert.ok(events.includes("monster-death"));
  assert.ok(events.includes("heal:2"), "battle-end heal feedback is presented on round-end victory");
  assert.ok(events.indexOf("heal:2") > events.indexOf("monster-death"));
}

const main = fs.readFileSync(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const moduleSource = fs.readFileSync(
  new URL("../games/harmony/combat-turn-orchestrator.js", import.meta.url),
  "utf8",
);
assert.match(main, /createCombatTurnOrchestrator/);
assert.doesNotMatch(main, /async function handleEndTurn\s*\(/);
assert.match(moduleSource, /engine\.executePlayerTurnEnd/);
assert.match(moduleSource, /engine\.executeSingleEnemyAction/);
assert.match(moduleSource, /engine\.executeRoundEnd/);
assert.match(moduleSource, /showImpurityOverflowQueue/);
assert.match(moduleSource, /roundKilledMonsters/);

console.log("Harmony combat turn orchestrator checks passed.");

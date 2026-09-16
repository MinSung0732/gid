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

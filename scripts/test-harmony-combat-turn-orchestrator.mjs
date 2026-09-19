import assert from "node:assert/strict";
import fs from "node:fs";
import { createCombatTurnOrchestrator } from "../games/harmony/combat-turn-orchestrator.js";

function createHarness({ run, engineOverrides = {}, feedbackOverrides = {}, animating = false } = {}) {
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
    showShieldGain: (amount) => events.push(`shield-gain:${amount}`),
    showPlayerHealing: (amount) => events.push(`heal:${amount}`),
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
    showEnemyHealing: (amount, index) => events.push(`enemy-heal:${index}:${amount}`),
    showEnemyShieldBlock: () => events.push("enemy-shield-block"),
    showHitFeedback: () => events.push("hit-feedback"),
    showStatusDamageQueue: async () => events.push("status-queue"),
    showStatusProcQueue: async () => {},
    showStatusProcVfx: async () => {},
    showImpurityOverflowQueue: async () => events.push("impurity-overflow-queue"),
    showPlayerDeath: async (amount) => events.push(`player-death:${amount}`),
    waitForLethalHitEffects: async (hits) => events.push(`lethal-wait:${hits.length}`),
    showMonsterDeath: async () => events.push("monster-death"),
    showEnemyHitQueue: async () => events.push("enemy-hit-queue"),
    stageDrawFeedback: (amount) => events.push(`stage-draw:${amount}`),
    showShuffleFeedback: async (amount) => events.push(`shuffle:${amount}`),
    showDrawFeedback: async (amount) => events.push(`draw:${amount}`),
    playPlayerStatusHit: () => events.push("player-status-hit"),
    showEnrageDamage: (amount) => events.push(`enrage:${amount}`),
    ...feedbackOverrides,
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
    battle: {
      enemyPhase: false,
      shield: 0,
      actingEnemy: null,
      enemies: [{ id: "regen-dummy", hp: 100, maxHp: 100, statuses: {} }],
    },
  };
  const { orchestrator, events } = createHarness({
    run,
    engineOverrides: {
      executePlayerTurnEnd() {
        events.push("player-turn-end");
        run.battle.enemyPhase = true;
        return true;
      },
      executeSingleEnemyAction() {
        events.push("enemy-action");
        return {
          type: "guard",
          shieldGained: 0,
          regenerationRestored: 2,
          playerDebuffs: [],
        };
      },
      executeRoundEnd() {
        events.push("round-end");
        run.battle.enemyPhase = false;
      },
    },
  });
  await orchestrator.handleEndTurn();
  assert.equal(events.filter((event) => event === "enemy-heal:0:2").length, 1);
  assert.ok(
    events.indexOf("enemy-heal:0:2") > events.indexOf("enemy-action"),
    "enemy regeneration feedback uses the actual restored amount after engine resolution",
  );
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
        run.battle.enemyPhase = true;
        run._enemyHitFeedback = [{ targetIndex: 0, damage: 7, blocked: 0 }];
        run._shieldGainFeedback = 4;
        run._absorbFeedback = 5;
        return true;
      },
      executeSingleEnemyAction() {
        events.push("enemy-action");
        return { type: "guard", shieldGained: 0, playerDebuffs: [] };
      },
      executeRoundEnd() {
        events.push("round-end");
        run.battle.enemyPhase = false;
      },
    },
  });
  await orchestrator.handleEndTurn();
  const hitIndex = events.indexOf("enemy-hit-queue");
  const enemyIndex = events.indexOf("enemy-action");
  assert.ok(hitIndex >= 0 && hitIndex < enemyIndex, "end-turn enemy hit VFX flushes before enemy phase");
  assert.ok(events.includes("shield-gain:4"));
  assert.ok(events.includes("absorb-gain:5"));
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
      shield: 12,
      actingEnemy: null,
      enemies: [{ id: "dummy", hp: 30, maxHp: 30, statuses: {} }],
    },
  };
  const { orchestrator, events } = createHarness({
    run,
    engineOverrides: {
      executePlayerTurnEnd() {
        events.push("player-turn-end");
        run.battle.enemyPhase = true;
        return true;
      },
      executeSingleEnemyAction() {
        events.push("enemy-action");
        run._absorbFeedback = 6;
        return {
          type: "attack",
          attackPattern: "contact",
          damage: 0,
          blocked: 12,
          playerDied: false,
          playerDebuffs: [],
          hits: [{ damage: 0, blocked: 12 }],
        };
      },
      executeRoundEnd() {
        events.push("round-end");
        run.battle.enemyPhase = false;
      },
    },
  });
  await orchestrator.handleEndTurn();
  const blockIndex = events.indexOf("shield-block");
  const absorbIndex = events.indexOf("absorb-gain:6");
  assert.ok(blockIndex >= 0 && absorbIndex > blockIndex, "blocked enemy attack shows absorb gain after shield block");
  assert.equal(events.filter((event) => event === "absorb-gain:6").length, 1);
  assert.equal(run._absorbFeedback, undefined);
}

{
  const run = {
    phase: "battle",
    hp: 60,
    maxHp: 80,
    battle: {
      enemyPhase: false,
      shield: 0,
      actingEnemy: null,
      enemies: [{ id: "dummy", hp: 30, maxHp: 30, statuses: {} }],
    },
  };
  const { orchestrator, events } = createHarness({
    run,
    engineOverrides: {
      executePlayerTurnEnd() {
        events.push("player-turn-end");
        run.battle.enemyPhase = true;
        return true;
      },
      executeSingleEnemyAction() {
        events.push("enemy-action");
        return { type: "guard", shieldGained: 0, playerDebuffs: [] };
      },
      executeRoundEnd() {
        events.push("round-end");
        run.battle.enemyPhase = false;
        run._playerDamageFeedback = 10;
        run._healingFeedback = 4;
        run._shieldGainFeedback = 3;
        run._absorbFeedback = 8;
      },
    },
  });
  await orchestrator.handleEndTurn();
  const damageIndex = events.indexOf("player-damage:10");
  const healIndex = events.indexOf("heal:4");
  const shieldIndex = events.indexOf("shield-gain:3");
  const absorbIndex = events.indexOf("absorb-gain:8");
  assert.ok(damageIndex >= 0, "round-end direct player damage is presented");
  assert.ok(
    healIndex > damageIndex && shieldIndex > healIndex && absorbIndex > shieldIndex,
    "turn-start resources present as healing → shield → absorb",
  );
  assert.equal(events.filter((event) => event === "player-damage:10").length, 1);
  assert.equal(events.filter((event) => event === "heal:4").length, 1);
  assert.equal(events.filter((event) => event === "shield-gain:3").length, 1);
  assert.equal(events.filter((event) => event === "absorb-gain:8").length, 1);
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
      enemies: [{ id: "dummy", hp: 1, maxHp: 10, statuses: {} }],
    },
  };
  let resolveHealingPresentation;
  const healingPresentation = new Promise((resolve) => {
    resolveHealingPresentation = () => {
      resolve();
    };
  });
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
        run._healingFeedback = 2;
        run._damageFeedback = [
          { target: "enemy", targetIndex: 0, amount: 1, statusId: "burning" },
        ];
        run._statusProcFeedback = [];
      },
    },
    feedbackOverrides: {
      showPlayerHealing(amount, options = {}) {
        events.push(`heal:${amount}`);
        if (!options.waitForPresentation) return undefined;
        events.push("heal-presentation-start");
        return healingPresentation.then(() => {
          events.push("heal-presentation-end");
        });
      },
    },
  });
  const task = orchestrator.handleEndTurn();
  await new Promise((resolve) => setImmediate(resolve));
  const deathIndex = events.indexOf("monster-death"),
    healIndex = events.indexOf("heal:2"),
    waitStartIndex = events.indexOf("heal-presentation-start");
  assert.ok(deathIndex >= 0 && healIndex > deathIndex, "victory heal starts after monster death presentation");
  assert.ok(waitStartIndex > healIndex, "victory heal requests presentation completion");
  assert.equal(
    events.slice(waitStartIndex + 1).includes("render"),
    false,
    "reward render must not replace the battle DOM before healing presentation completes",
  );
  resolveHealingPresentation();
  await task;
  const waitEndIndex = events.indexOf("heal-presentation-end"),
    rewardRenderIndex = events.findIndex(
      (event, index) => index > waitEndIndex && event === "render",
    );
  assert.ok(
    waitEndIndex > waitStartIndex && rewardRenderIndex > waitEndIndex,
    "reward render follows the completed healing presentation",
  );
  assert.equal(events.filter((event) => event === "heal:2").length, 1);
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
      enemies: [
        { id: "poisoned", hp: 5, maxHp: 10, statuses: {} },
        { id: "survivor", hp: 10, maxHp: 10, statuses: {} },
      ],
    },
  };
  const { orchestrator, events } = createHarness({
    run,
    engineOverrides: {
      executeRoundEnd() {
        events.push("round-end");
        run.battle.enemies[0].hp = 0;
        run._damageFeedback = [
          { target: "enemy", targetIndex: 0, amount: 5, statusId: "poison" },
        ];
        return true;
      },
    },
  });
  await orchestrator.handleEndTurn();
  const roundEndIndex = events.indexOf("round-end"),
    statusIndex = events.findIndex((event, index) => index > roundEndIndex && event === "status-queue"),
    waitIndex = events.findIndex((event, index) => index > statusIndex && event === "lethal-wait:1"),
    deathIndex = events.findIndex((event, index) => index > waitIndex && event === "monster-death"),
    renderAfterRoundEnd = events.findIndex((event, index) => index > roundEndIndex && event === "render"),
    renderAfterDeath = events.findIndex((event, index) => index > deathIndex && event === "render");
  assert.ok(statusIndex > roundEndIndex, "round-end status damage is presented before death");
  assert.ok(waitIndex > statusIndex && deathIndex > waitIndex, "status kill uses lethal wait and death presentation");
  assert.equal(
    renderAfterRoundEnd,
    renderAfterDeath,
    "nonfinal round kill must not render away the dead panel before its animation",
  );
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
      enemies: [
        { id: "thorn-victim", hp: 5, maxHp: 10, statuses: {} },
        { id: "survivor", hp: 10, maxHp: 10, statuses: {} },
      ],
    },
  };
  let actionCount = 0;
  const { orchestrator, events } = createHarness({
    run,
    engineOverrides: {
      executeSingleEnemyAction(_run, index) {
        events.push(`enemy-action:${index}`);
        actionCount++;
        if (index === 0) {
          run.battle.enemies[0].hp = 0;
          run._damageFeedback = [
            { target: "enemy", targetIndex: 0, amount: 5, statusId: "thorns" },
          ];
          run._enemyHitFeedback = [
            { targetIndex: 0, damage: 5, blocked: 0, statusId: "thorns" },
          ];
        }
        return {
          type: "attack",
          attackPattern: "contact",
          damage: 0,
          blocked: 0,
          hits: [],
          shieldGained: 0,
          impurities: 0,
          playerDebuffs: [],
          regenerationRestored: 0,
          playerDied: false,
        };
      },
      executeRoundEnd() {
        events.push("round-end");
        return true;
      },
    },
  });
  await orchestrator.handleEndTurn();
  assert.equal(actionCount, 2, "surviving enemies continue their turn after a counter-kill");
  const firstActionIndex = events.indexOf("enemy-action:0"),
    deathIndex = events.findIndex((event, index) => index > firstActionIndex && event === "monster-death"),
    firstRenderAfterAction = events.findIndex((event, index) => index > firstActionIndex && event === "render");
  assert.ok(deathIndex > firstActionIndex, "counter-killed enemy receives death presentation");
  assert.ok(firstRenderAfterAction > deathIndex, "counter-killed panel stays mounted until death presentation completes");
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
assert.match(moduleSource, /_shieldGainFeedback/);
assert.match(moduleSource, /_playerDamageFeedback/);
assert.match(main, /showShieldGain,/);
assert.match(main, /showPlayerHealing,/);
assert.match(main, /showEnemyHealing,/);
assert.match(moduleSource, /outcome\.regenerationRestored > 0[\s\S]*?showEnemyHealing\(outcome\.regenerationRestored, index\)/);

console.log("Harmony combat turn orchestrator checks passed.");

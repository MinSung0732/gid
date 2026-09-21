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
    showPlayerShieldBreakVfx: () => events.push("shield-break"),
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
    stageStatusDamageHealth: (hits) =>
      events.push(`status-stage:${hits.map((hit) => `${hit.hpBefore}->${hit.hpAfter}`).join(",")}`),
    showStatusDamageQueue: async () => events.push("status-queue"),
    showStatusProcQueue: async () => {},
    showStatusProcVfx: async () => {},
    showThornsRetaliationVfx: async (event) =>
      events.push(`thorns:${event.sourceImpactId}`),
    showImpurityOverflowQueue: async () => events.push("impurity-overflow-queue"),
    showPlayerDeath: async (amount) => events.push(`player-death:${amount}`),
    waitForLethalHitEffects: async (hits) => events.push(`lethal-wait:${hits.length}`),
    showMonsterDeath: async () => events.push("monster-death"),
    showEnemyHitQueue: async () => events.push("enemy-hit-queue"),
    stageDrawFeedback: (amount) => events.push(`stage-draw:${amount}`),
    showShuffleFeedback: async (amount) => events.push(`shuffle:${amount}`),
    showDrawFeedback: async (amount) => events.push(`draw:${amount}`),
    getHarmonyProgressRect: () => ({
      left: 120,
      top: 48,
      width: 144,
      height: 22,
    }),
    getHarmonyVisualNotes: () => [],
    getVisibleHarmonyNotes: () => [],
    showHarmonyResetVfx: async (event) =>
      events.push(
        `harmony-reset:${event.reason}:${event.notes.join(",")}:${event.anchorRect?.left ?? "none"}`,
      ),
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
      enemies: [{ id: "thorn-attacker", hp: 20, maxHp: 20, statuses: {} }],
    },
  };
  const { orchestrator, events } = createHarness({
    run,
    engineOverrides: {
      executeSingleEnemyAction() {
        run._damageFeedback = [{
          target: "enemy",
          targetIndex: 0,
          amount: 4,
          statusId: "thorns",
        }];
        run._enemyHitFeedback = [{
          targetIndex: 0,
          damage: 4,
          blocked: 0,
          statusId: "thorns",
        }];
        run._thornsFeedback = [{
          source: "player",
          sourceIndex: null,
          targets: [{ target: "enemy", targetIndex: 0, damage: 4 }],
          stackBefore: 4,
          stackAfter: 3,
          nova: false,
          sourceImpactId: 902,
        }];
        return {
          type: "attack",
          attackPattern: "contact",
          damage: 2,
          blocked: 0,
          hits: [{ damage: 2, blocked: 0, impactId: 902 }],
          shieldGained: 0,
          impurities: 0,
          playerDebuffs: [],
          regenerationRestored: 0,
          playerDied: false,
        };
      },
      executeRoundEnd() {
        run.battle.enemyPhase = false;
      },
    },
  });
  await orchestrator.handleEndTurn();
  const impactIndex = events.indexOf("player-impact"),
    thornsIndex = events.indexOf("thorns:902"),
    statusIndex = events.indexOf("status-queue");
  assert.ok(impactIndex >= 0 && thornsIndex > impactIndex, "player Thorns follows the exact enemy contact impact");
  assert.ok(statusIndex > thornsIndex, "enemy's existing Thorns popup follows the counter VFX");
  assert.equal(run._thornsFeedback, undefined, "enemy action boundary consumes transient Thorns feedback once");
}

{
  const run = {
    phase: "battle",
    hp: 31,
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
        return { type: "guard", shieldGained: 0, playerDebuffs: [] };
      },
      executeRoundEnd() {
        run.battle.enemyPhase = false;
        run.hp = 11;
        run._damageFeedback = [{
          target: "player",
          amount: 20,
          statusId: "poison",
          hpBefore: 31,
          hpAfter: 11,
          maxHp: 80,
          presentation: "turnEndTick",
          stackBefore: 20,
          stackAfter: 19,
        }];
        run._drawFeedback = 1;
      },
    },
  });
  await orchestrator.handleEndTurn();
  const renderIndex = events.lastIndexOf("render"),
    drawIndex = events.indexOf("draw:1", renderIndex),
    damageIndex = events.lastIndexOf("status-queue");
  assert.ok(
    damageIndex >= 0 && renderIndex > damageIndex,
    "round-end poison is presented on the existing pre-damage DOM before final-state render",
  );
  assert.ok(
    drawIndex > renderIndex,
    "the next-turn hand presentation starts only after status damage and the final render",
  );
  assert.equal(
    events.includes("status-stage:31->11"),
    false,
    "round-end poison no longer needs to heal the freshly rendered bar back to Before",
  );
}

{
  const run = {
    phase: "battle",
    hp: 31,
    maxHp: 80,
    battle: {
      enemyPhase: false,
      shield: 0,
      actingEnemy: null,
      enemies: [
        { id: "first", hp: 30, maxHp: 30, statuses: {} },
        { id: "second", hp: 30, maxHp: 30, statuses: {} },
      ],
    },
  };
  let enemyActions = 0;
  const { orchestrator, events } = createHarness({
    run,
    engineOverrides: {
      executePlayerTurnEnd() {
        events.push("player-turn-end");
        run.battle.enemyPhase = true;
        return true;
      },
      executeSingleEnemyAction() {
        enemyActions++;
        return { type: "guard", shieldGained: 0, playerDebuffs: [] };
      },
      executeRoundEnd() {
        run.battle.enemyPhase = false;
        run.hp = 20;
        run._damageFeedback = [
          {
            target: "player",
            amount: 5,
            statusId: "bleed",
            sourceImpactId: 41,
            hpBefore: 31,
            hpAfter: 26,
            maxHp: 80,
          },
          {
            target: "player",
            amount: 6,
            statusId: "poison",
            hpBefore: 26,
            hpAfter: 20,
            maxHp: 80,
            presentation: "turnEndTick",
            stackBefore: 6,
            stackAfter: 5,
          },
        ];
        run._statusProcFeedback = [{ statusId: "bleed", sourceImpactId: 41 }];
      },
    },
    feedbackOverrides: {
      showStatusProcQueue: async (procs) =>
        events.push(`proc-only:${procs.map((proc) => proc.statusId).join(",")}`),
      showStatusDamageQueue: async (hits) =>
        events.push(`status-only:${hits.map((hit) => hit.statusId).join(",")}`),
    },
  });
  await orchestrator.handleEndTurn();
  const procIndex = events.indexOf("proc-only:bleed"),
    statusIndex = events.indexOf("status-only:poison"),
    finalRenderIndex = events.lastIndexOf("render");
  assert.equal(enemyActions, 2, "the regression covers a real two-enemy turn");
  assert.ok(
    procIndex >= 0 && statusIndex > procIndex && finalRenderIndex > statusIndex,
    "linked proc and poison damage finish on the old DOM before the next-turn render",
  );
  assert.equal(
    events.includes("status-stage:31->26,26->20"),
    false,
    "multi-enemy round end does not rewind a newly rendered final health bar",
  );
  assert.equal(
    events.some((event) => event === "status-only:bleed,poison"),
    false,
    "linked status damage is not replayed by the generic status queue",
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
    hp: 6,
    maxHp: 80,
    battle: {
      enemyPhase: false,
      shield: 10,
      actingEnemy: null,
      enemies: [{ id: "dummy", hp: 30, maxHp: 30, statuses: {} }],
    },
  };
  const { orchestrator, events } = createHarness({
    run,
    engineOverrides: {
      executePlayerTurnEnd() {
        run.battle.enemyPhase = true;
        return true;
      },
      executeSingleEnemyAction() {
        run.hp = 0;
        run.battle.shield = 0;
        run.phase = "result";
        return {
          type: "attack",
          attackPattern: "nonContact",
          damage: 6,
          blocked: 10,
          playerDied: true,
          playerDebuffs: [],
          hits: [{ damage: 6, blocked: 10, shieldBreak: true, impactId: 1 }],
        };
      },
    },
  });
  await orchestrator.handleEndTurn();
  assert.equal(events.filter((event) => event === "shield-break").length, 1);
  assert.ok(events.indexOf("shield-block") < events.indexOf("shield-break"));
  assert.ok(events.indexOf("shield-break") < events.findIndex((event) => event.startsWith("player-death")));
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
          hits: [{ damage: 0, blocked: 12, shieldBreak: true }],
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
  assert.equal(events.filter((event) => event === "shield-break").length, 1);
  assert.ok(events.indexOf("shield-break") > blockIndex);
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

{
  const run = {
    phase: "battle",
    hp: 80,
    maxHp: 80,
    battle: {
      enemyPhase: false,
      shield: 0,
      actingEnemy: null,
      notes: [{ note: "top" }, { note: "middle" }],
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
        return { type: "guard", shieldGained: 0, playerDebuffs: [] };
      },
      executeRoundEnd() {
        run.battle.enemyPhase = false;
        run.battle.notes = [];
        run._harmonyResetFeedback = {
          notes: ["top", "middle"],
          reason: "turnStart",
        };
      },
    },
  });
  await orchestrator.handleEndTurn();
  const resetIndex = events.indexOf("harmony-reset:turnStart:top,middle:120"),
    preHoldIndex = events.lastIndexOf("sleep:70", resetIndex),
    postHoldIndex = events.findIndex((event, index) => index > resetIndex && event === "sleep:70"),
    playerTurnEndIndex = events.indexOf("player-turn-end"),
    drawIndex = events.findIndex((event) => event.startsWith("draw:"));
  assert.ok(resetIndex >= 0, "incomplete-note reset VFX is presented");
  assert.ok(preHoldIndex >= 0 && preHoldIndex < resetIndex, "reset VFX gets a readable pre-hold");
  assert.ok(postHoldIndex > resetIndex, "reset VFX gets a readable post-hold");
  assert.ok(playerTurnEndIndex > postHoldIndex, "game turn-end logic starts only after the reset presentation finishes");
  assert.ok(drawIndex < 0 || drawIndex > playerTurnEndIndex, "draw presentation remains after normal turn-end logic");
  assert.equal(run._harmonyResetFeedback, undefined, "turn boundary consumes reset feedback exactly once");
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
      notes: [],
      enemies: [{ id: "dummy", hp: 30, maxHp: 30, statuses: {} }],
    },
  };
  const { orchestrator, events } = createHarness({
    run,
    feedbackOverrides: {
      getVisibleHarmonyNotes: () => ["top", "middle"],
    },
    engineOverrides: {
      executePlayerTurnEnd() {
        run.battle.enemyPhase = true;
        return true;
      },
      executeSingleEnemyAction() {
        return { type: "guard", shieldGained: 0, playerDebuffs: [] };
      },
      executeRoundEnd() {
        run.battle.enemyPhase = false;
      },
    },
  });
  await orchestrator.handleEndTurn();
  assert.ok(
    events.includes("harmony-reset:turnStart:top,middle:120"),
    "visible filled note slots should trigger reset presentation even when state notes are already empty",
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
      notes: [],
      enemies: [{ id: "dummy", hp: 30, maxHp: 30, statuses: {} }],
    },
  };
  const { orchestrator, events } = createHarness({
    run,
    feedbackOverrides: {
      getHarmonyVisualNotes: () => ["top"],
      getVisibleHarmonyNotes: () => [],
    },
    engineOverrides: {
      executePlayerTurnEnd() {
        events.push("player-turn-end");
        run.battle.enemyPhase = true;
        return true;
      },
      executeSingleEnemyAction() {
        return { type: "guard", shieldGained: 0, playerDebuffs: [] };
      },
      executeRoundEnd() {
        run.battle.enemyPhase = false;
      },
    },
  });
  await orchestrator.handleEndTurn();
  const resetIndex = events.indexOf("harmony-reset:turnStart:top:120"),
    turnEndIndex = events.indexOf("player-turn-end");
  assert.ok(resetIndex >= 0, "retained visual note state should trigger reset presentation");
  assert.ok(turnEndIndex > resetIndex, "visual reset should still complete before normal turn-end logic");
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
assert.match(
  moduleSource,
  /stateHarmonyNotes[\s\S]*?getHarmonyVisualNotes\?\.\(\)[\s\S]*?getVisibleHarmonyNotes\?\.\(\)[\s\S]*?turnEndHarmonyNotes = stateHarmonyNotes\.length[\s\S]*?visualHarmonyNotes\.length/s,
  "turn end should prefer state notes, then retained presentation notes, then visible DOM notes",
);
assert.match(
  moduleSource,
  /presentHarmonyReset = async[\s\S]*?combatEffectsEnabled\?\.\(\) === false[\s\S]*?await sleep\(70\);[\s\S]*?showHarmonyResetVfx[\s\S]*?await sleep\(70\)/s,
  "reset presentation should reserve visible beats only while combat FX are enabled",
);
assert.match(
  moduleSource,
  /if \(turnEndHarmonyResetFeedback\)[\s\S]*?await presentHarmonyReset\(turnEndHarmonyResetFeedback\);[\s\S]*?engine\.executePlayerTurnEnd/s,
  "reset presentation should run at the visible end-turn click before normal turn-end logic",
);
assert.match(moduleSource, /showImpurityOverflowQueue/);
assert.match(moduleSource, /roundKilledMonsters/);
assert.match(moduleSource, /_shieldGainFeedback/);
assert.match(moduleSource, /_playerDamageFeedback/);
assert.match(main, /showShieldGain,/);
assert.match(main, /showPlayerHealing,/);
assert.match(main, /showEnemyHealing,/);
assert.match(moduleSource, /outcome\.regenerationRestored > 0[\s\S]*?showEnemyHealing\(outcome\.regenerationRestored, index\)/);

console.log("Harmony combat turn orchestrator checks passed.");

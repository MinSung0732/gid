import assert from "node:assert/strict";
import fs from "node:fs";
import { createCombatCardOrchestrator } from "../games/harmony/combat-card-orchestrator.js";

const mainSource = fs.readFileSync(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const moduleSource = fs.readFileSync(new URL("../games/harmony/combat-card-orchestrator.js", import.meta.url), "utf8");
const hpGuardSource = fs.readFileSync(new URL("../games/harmony/enemy-hp-visual-guard.js", import.meta.url), "utf8");

assert.match(mainSource, /createCombatCardOrchestrator/);
assert.match(mainSource, /await handleCardPlay\(button, index\);/);
assert.doesNotMatch(mainSource, /E\.play\(run, index, meta\);/);
assert.match(moduleSource, /engine\.play\(run, index, meta\);/);
assert.match(moduleSource, /animateWeakContactAttack/);
assert.match(moduleSource, /animateStrongContactAttack/);
assert.match(moduleSource, /animateNonContactCast/);
assert.match(moduleSource, /showImpurityOverflowQueue/);
assert.match(moduleSource, /waitForLethalHitEffects/);

assert.match(mainSource, /beginEnemyHpVisualGuard/);
assert.match(mainSource, /endEnemyHpVisualGuard/);
assert.match(
  mainSource,
  /setCardAnimating: \(value\) => \{[\s\S]*?if \(value\) beginEnemyHpVisualGuard\(\);[\s\S]*?else endEnemyHpVisualGuard\(\);/,
  "player-card lifecycle explicitly owns the HP visual guard",
);
assert.match(hpGuardSource, /battle\.classList\.contains\("enemy-phase"\)/);
assert.doesNotMatch(
  hpGuardSource,
  /document\.addEventListener\(\s*["']click["']/,
  "HP guard no longer infers card lifecycle from a global click capture",
);

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
    showHarmonyProgress: async (event, sourcePoint) =>
      events.push(["harmony-progress", event.note, event.completed, sourcePoint]),
    showHarmonyProgressConsume: async (event) =>
      events.push(["harmony-consume", event.completed]),
    showStatusDamageQueue: async (hits) => events.push(["status", hits.length]),
    showStatusProcQueue: async (hits) => {
      if (hits.length) events.push(["status-proc-queue", hits.length]);
    },
    showStatusProcVfx: async (event, { impactPoint = null } = {}) =>
      events.push(["status-proc", event.sourceImpactId, impactPoint]),
    showThornsRetaliationVfx: async (event) =>
      events.push(["thorns", event.sourceImpactId]),
    showPlayerDeath: async () => events.push(["player-death"]),
    waitForLethalHitEffects: async (hits) => events.push(["lethal-wait", hits.length]),
    showMonsterDeath: async (hits) => events.push(["monster-death", hits.length]),
    stageDrawFeedback: (amount) => events.push(["stage-draw", amount]),
    showShuffleFeedback: async () => events.push(["shuffle"]),
    showDrawFeedback: async () => events.push(["draw"]),
    showPlayerDamage: (amount) => events.push(["player-damage", amount]),
    showPlayerHealing: (amount) => events.push(["heal", amount]),
    showAbsorbGain: (amount) => events.push(["absorb", amount]),
    showShieldGain: (amount) => events.push(["shield", amount]),
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
    card: { category: "utility", note: "base" },
    onPlay(run) {
      run._harmonyProgressFeedback = [{
        note: "base",
        cardId: "test-card",
        beforeNotes: ["top", "middle"],
        afterNotes: ["top", "middle", "base"],
        completed: true,
        harmonyTriggered: true,
      }];
      run._harmonyFeedback = [{ id: "base_harmony", label: "HARMONY!" }];
    },
  });
  await harness.handleCardPlay(harness.button, 0);
  const progressIndex = harness.events.findIndex(([name]) => name === "harmony-progress"),
    harmonyIndex = harness.events.findIndex(([name, count]) => name === "harmony" && count === 1),
    consumeIndex = harness.events.findIndex(([name]) => name === "harmony-consume");
  assert.ok(progressIndex >= 0, "resolved note progress is presented");
  assert.ok(harmonyIndex > progressIndex, "existing HARMONY presentation starts after final note landing");
  assert.ok(consumeIndex > harmonyIndex, "note progress consumes only after resonance starts");
  assert.equal(harness.run._harmonyProgressFeedback, undefined, "transient progress feedback is cleared at the action boundary");
}

{
  const harness = createHarness({
    card: { category: "attack", attack: 5, attackPattern: "contact" },
    onPlay(run) {
      run.hp = 77;
      run.battle.enemies[0].hp = 15;
      run._enemyHitFeedback = [{
        targetIndex: 0,
        damage: 5,
        blocked: 0,
        attackPattern: "contact",
        impactId: 901,
        fx: { power: "weak" },
      }];
      run._damageFeedback = [{
        target: "player",
        amount: 3,
        statusId: "thorns",
      }];
      run._thornsFeedback = [{
        source: "enemy",
        sourceIndex: 0,
        targets: [{ target: "player", targetIndex: null, damage: 3 }],
        stackBefore: 3,
        stackAfter: 2,
        nova: false,
        sourceImpactId: 901,
      }];
    },
  });
  assert.equal(await harness.handleCardPlay(harness.button, 0), true);
  const impactIndex = harness.events.findIndex(([name]) => name === "hit"),
    thornsIndex = harness.events.findIndex(([name]) => name === "thorns"),
    statusIndex = harness.events.findIndex(([name, count]) => name === "status" && count === 1);
  assert.ok(impactIndex >= 0 && thornsIndex > impactIndex, "enemy Thorns follows the exact card contact impact");
  assert.ok(statusIndex > thornsIndex, "existing Thorns status popup follows its directional VFX");
  assert.equal(harness.run._thornsFeedback, undefined, "card boundary consumes transient Thorns feedback once");
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

{
  const harness = createHarness({
    card: { category: "attack", attack: 10, attackPattern: "contact" },
    enemies: [
      { id: "first", hp: 10, maxHp: 10, shield: 0 },
      { id: "second", hp: 10, maxHp: 10, shield: 0 },
    ],
    onPlay(run) {
      run.battle.enemies[0].hp = 0;
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
  const hitIndex = harness.events.findIndex(([name]) => name === "hit-queue"),
    waitIndex = harness.events.findIndex(([name]) => name === "lethal-wait"),
    deathIndex = harness.events.findIndex(([name]) => name === "monster-death"),
    saveIndex = harness.events.findIndex(([name]) => name === "save"),
    renderIndex = harness.events.findIndex(([name]) => name === "render");
  assert.ok(hitIndex >= 0 && waitIndex > hitIndex, "nonfinal kill waits for hit feedback before lethal presentation");
  assert.ok(deathIndex > waitIndex, "nonfinal kill runs monster death presentation");
  assert.ok(saveIndex > deathIndex && renderIndex > saveIndex, "nonfinal kill renders survivors only after death presentation");
  assert.deepEqual(
    harness.events.find(([name]) => name === "monster-death"),
    ["monster-death", 1],
  );
}

{
  const harness = createHarness({
    card: { category: "attack", attack: 10, attackPattern: "contact", target: "all" },
    enemies: [
      { id: "first", hp: 10, maxHp: 10, shield: 0 },
      { id: "second", hp: 10, maxHp: 10, shield: 0 },
      { id: "third", hp: 10, maxHp: 10, shield: 0 },
    ],
    onPlay(run) {
      run.battle.enemies[0].hp = 0;
      run.battle.enemies[1].hp = 0;
      run._enemyHitFeedback = [
        { targetIndex: 0, damage: 10, blocked: 0, attackPattern: "contact" },
        { targetIndex: 1, damage: 10, blocked: 0, attackPattern: "contact" },
      ];
    },
  });
  assert.equal(await harness.handleCardPlay(harness.button, 0), true);
  assert.deepEqual(
    harness.events.find(([name]) => name === "monster-death"),
    ["monster-death", 2],
    "simultaneous nonfinal kills share one death presentation batch",
  );
  const deathIndex = harness.events.findIndex(([name]) => name === "monster-death"),
    renderIndex = harness.events.findIndex(([name]) => name === "render");
  assert.ok(renderIndex > deathIndex, "multi-kill survivor render waits for all death animations");
}

{
  const harness = createHarness({
    card: { category: "attack", attack: 20, attackPattern: "nonContact" },
    enemies: [{ id: "spectral-dummy", hp: 20, maxHp: 20, shield: 0 }],
    onPlay(run) {
      run.battle.enemies[0].hp = 0;
      run._enemyHitFeedback = Array.from({ length: 20 }, (_, index) => ({
        targetIndex: 0,
        damage: 1,
        blocked: 0,
        attackPattern: "nonContact",
        impactId: 800 + index,
        fx: { power: "weak", source: "card", cardId: "test-card", hitIndex: index, hitCount: 20 },
      }));
    },
  });
  assert.equal(await harness.handleCardPlay(harness.button, 0), true);
  assert.equal(harness.events.filter(([name]) => name === "noncontact").length, 1);
  const hitEvents = harness.events.filter(([name]) => name === "hit");
  assert.equal(hitEvents.length, 20, "Spectral logical hits all pass through the existing multi-hit scheduler");
  assert.ok(hitEvents.every((event) => event[1] === 1), "Spectral never re-aggregates a total damage number");
  assert.deepEqual(hitEvents.map((event) => event[4]?.hitIndex), Array.from({ length: 20 }, (_, index) => index));
  assert.ok(hitEvents.every((event) => event[4]?.hitCount === 20 && event[4]?.multiHit === true));
  assert.ok(hitEvents.some((event) => event[4]?.playSound === false), "high-hit presentation thins sounds");
  assert.ok(hitEvents.some((event) => event[4]?.react === false), "high-hit presentation thins enemy reactions");
  assert.equal(hitEvents.at(-1)[4].isFinisher, true);
}

{
  const harness = createHarness({
    card: { category: "utility" },
    onPlay(run) {
      run.hp = 78;
      run.battle.shield = 3;
      run._playerDamageFeedback = 6;
      run._healingFeedback = 4;
      run._shieldGainFeedback = 3;
      run._absorbFeedback = 5;
    },
  });
  assert.equal(await harness.handleCardPlay(harness.button, 0), true);
  assert.equal(
    harness.events.filter(([name]) => name === "player-damage").length,
    1,
    "card direct damage VFX stays single",
  );
  assert.ok(
    harness.events.some(
      ([name, amount]) => name === "player-damage" && amount === 6,
    ),
    "card damage uses actual transient damage rather than net HP delta",
  );
  assert.deepEqual(
    harness.events.filter(([name]) => name === "heal"),
    [["heal", 4]],
  );
  assert.deepEqual(
    harness.events.filter(([name]) => name === "shield"),
    [["shield", 3]],
  );
  assert.deepEqual(
    harness.events.filter(([name]) => name === "absorb"),
    [["absorb", 5]],
  );
  assert.equal(harness.run._playerDamageFeedback, undefined);
  assert.equal(harness.run._shieldGainFeedback, undefined);
}

// The presentation guard blocks fake HP rollbacks only during a player-card
// sequence, keeps multiple target indices independent, admits summoned targets,
// and releases immediately when enemy-phase begins.
{
  const makeEnemy = (index, hp, maxHp = 100) => {
      const label = { textContent: `${hp} / ${maxHp}` },
        bar = { style: { width: `${hp}%` } };
      return {
        dataset: { target: String(index) },
        label,
        bar,
        querySelector(selector) {
          if (selector === ".enemy-health-value") return label;
          if (selector === ".enemy-hp > span") return bar;
          return null;
        },
      };
    },
    enemies = [makeEnemy(0, 70), makeEnemy(1, 80)];
  let enemyPhase = false,
    observerCallback = null;
  const battle = {
      classList: { contains: (name) => name === "enemy-phase" && enemyPhase },
      querySelectorAll: () => enemies,
    },
    app = {
      querySelector: (selector) => (selector === ".battle" ? battle : null),
      querySelectorAll: () => enemies,
    };
  globalThis.document = {
    getElementById: (id) => (id === "app" ? app : null),
    querySelectorAll: () => [],
  };
  globalThis.window = {
    setTimeout,
    clearTimeout,
  };
  globalThis.MutationObserver = class {
    constructor(callback) {
      observerCallback = callback;
    }
    observe() {}
  };
  const guard = await import(`../games/harmony/enemy-hp-visual-guard.js?test=${Date.now()}`),
    flush = async () => {
      observerCallback?.();
      await Promise.resolve();
      await Promise.resolve();
    };

  guard.beginEnemyHpVisualGuard();
  enemies[0].label.textContent = "65 / 100";
  enemies[0].bar.style.width = "65%";
  await flush();
  enemies[0].label.textContent = "60 / 100";
  enemies[0].bar.style.width = "60%";
  await flush();
  enemies[0].label.textContent = "55 / 100";
  enemies[0].bar.style.width = "55%";
  await flush();
  enemies[0].label.textContent = "70 / 100";
  enemies[0].bar.style.width = "70%";
  await flush();
  assert.equal(enemies[0].label.textContent, "55 / 100", "multi-hit HP stays monotonic through the full card sequence");
  assert.equal(enemies[1].label.textContent, "80 / 100", "another enemy HP stays independent");

  enemies.push(makeEnemy(2, 55));
  await flush();
  assert.deepEqual(guard.enemyHpVisualGuardSnapshot().targets, [0, 1, 2]);
  enemies[2].label.textContent = "50 / 100";
  await flush();
  enemies[2].label.textContent = "55 / 100";
  await flush();
  assert.equal(enemies[2].label.textContent, "50 / 100", "summoned target gets its own visual baseline");

  enemyPhase = true;
  enemies[0].label.textContent = "60 / 100";
  enemies[0].bar.style.width = "60%";
  await flush();
  assert.equal(guard.enemyHpVisualGuardSnapshot().active, false, "enemy phase immediately terminates the guard");
  assert.equal(enemies[0].label.textContent, "60 / 100", "real enemy-turn regeneration after multi-hit damage is never rolled back");
  guard.endEnemyHpVisualGuard();
}

assert.match(moduleSource, /createMultiHitPresentationScheduler/);
assert.match(moduleSource, /usesMultiHitPresentation\(contactHits\)/);
assert.match(moduleSource, /usesMultiHitPresentation\(nonContactHits\)/);
assert.match(moduleSource, /showHitFeedback\([\s\S]*?presentation,/s);
assert.match(moduleSource, /queueStatusProcsForHit\(hit, impactPoint\)/);

console.log("Harmony combat card orchestrator regression tests passed.");

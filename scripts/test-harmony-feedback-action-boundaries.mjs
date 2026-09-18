import assert from "node:assert/strict";
import fs from "node:fs";
import * as E from "../games/harmony/engine.js";
import { CARDS } from "../games/harmony/data.js";
import { createCombatTurnOrchestrator } from "../games/harmony/combat-turn-orchestrator.js";
import { createGameActionOrchestrator } from "../games/harmony/game-action-orchestrator.js";

function clearTransient(run) {
  for (const key of [
    "_healingFeedback",
    "_playerDamageFeedback",
    "_shieldGainFeedback",
    "_absorbFeedback",
    "_absorbLossFeedback",
    "_damageFeedback",
    "_statusProcFeedback",
    "_enemyHitFeedback",
    "_drawFeedback",
    "_shuffleFeedback",
    "_enrageFeedback",
  ])
    delete run[key];
}

function combat(seed, inventory = []) {
  const run = E.newRun(seed),
    meta = E.freshMeta();
  run.inventory = [...inventory];
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemies = [run.battle.enemies[0]];
  run.battle.selectedTarget = 0;
  E.attachEnemyAliases(run.battle);
  const enemy = run.battle.enemies[0];
  enemy.hp = Math.max(200, enemy.maxHp || 0);
  enemy.maxHp = enemy.hp;
  enemy.shield = 0;
  enemy.intent = { type: "guard", value: 0 };
  clearTransient(run);
  return { run, meta, enemy };
}

function createTurnHarness(run, meta) {
  const events = [];
  let locked = false;
  const engine = {
    executePlayerTurnEnd(...args) {
      events.push({ type: "engine-player-turn-end" });
      return E.executePlayerTurnEnd(...args);
    },
    executeSingleEnemyAction(...args) {
      events.push({ type: "engine-enemy-action", index: args[1] });
      return E.executeSingleEnemyAction(...args);
    },
    executeRoundEnd(...args) {
      events.push({ type: "engine-round-end" });
      return E.executeRoundEnd(...args);
    },
  };
  const enemyElement = { classList: { add() {} } };
  const feedback = {
    showAbsorbLoss: (amount) => events.push({ type: "absorb-loss", amount }),
    showAbsorbGain: (amount) => events.push({ type: "absorb-gain", amount }),
    getEnemyElement: () => enemyElement,
    getPlayerImpactPoint: () => ({ x: 0, y: 0 }),
    updatePlayerHealthFeedback() {},
    showPlayerContactImpact() {},
    showShieldBlock: (amount) => events.push({ type: "shield-block", amount }),
    showPlayerImpactShieldBlock() {},
    showPlayerDamage: (amount) => events.push({ type: "player-damage", amount }),
    showPlayerHealing: (amount) => events.push({ type: "heal", amount }),
    showShieldGain: (amount) => events.push({ type: "shield-gain", amount }),
    animateEnemyContactAttack: async (_enemy, _strong, _super, onImpact) =>
      onImpact({ x: 0, y: 0 }),
    combatEffectsEnabled: () => false,
    showEnemyActionPopup() {},
    showEnemyDebuffSmoke() {},
    showEnemyShieldBlock() {},
    showHitFeedback: (amount, targetIndex) =>
      events.push({ type: "enemy-hit", amount, targetIndex }),
    showStatusDamageQueue: async () => {},
    showStatusProcQueue: async () => {},
    showStatusProcVfx: async () => {},
    showImpurityOverflowQueue: async () => {},
    showPlayerDeath: async (amount) => events.push({ type: "player-death", amount }),
    showMonsterDeath: async () => events.push({ type: "monster-death" }),
    showEnemyHitQueue: async (hits = []) =>
      events.push({
        type: "enemy-hit-queue",
        hits: hits.map((hit) => ({
          damage: hit.damage,
          blocked: hit.blocked,
          targetIndex: hit.targetIndex,
          statusId: hit.statusId || null,
        })),
      }),
    stageDrawFeedback() {},
    showShuffleFeedback: async () => {},
    showDrawFeedback: async () => {},
    playPlayerStatusHit() {},
    showEnrageDamage() {},
  };
  return {
    events,
    orchestrator: createCombatTurnOrchestrator({
      engine,
      enemyDefinitionFor: () => ({ material: "glass" }),
      getRun: () => run,
      getMeta: () => meta,
      getCardAnimating: () => locked,
      setCardAnimating: (value) => { locked = value; },
      save() {},
      render() {},
      sleep: async () => {},
      feedback,
    }),
  };
}

const eventsOf = (events, type) => events.filter((event) => event.type === type);
function assertConsumed(run, keys) {
  for (const key of keys)
    assert.equal(run[key], undefined, `${key} must be consumed by the same action boundary`);
}

// 운동 에너지 흡수벽: Shield Block -> Absorb Gain, exactly once.
{
  const { run, meta, enemy } = combat(15101, ["trait_aegis_kinetic_absorption"]);
  run.battle.shield = 20;
  run.battle.absorb = 0;
  enemy.intent = { type: "attack", value: 10, hits: 1, attackPattern: "nonContact" };
  const { orchestrator, events } = createTurnHarness(run, meta);
  await orchestrator.handleEndTurn();
  const block = events.findIndex((event) => event.type === "shield-block"),
    absorb = events.findIndex((event) => event.type === "absorb-gain" && event.amount === 2);
  assert.ok(block >= 0 && absorb > block);
  assert.equal(eventsOf(events, "absorb-gain").filter((event) => event.amount === 2).length, 1);
  assertConsumed(run, ["_absorbFeedback"]);
}

// 초임계 저장 앰플: turn 2 / turn 3 start both flush +8 immediately.
{
  const { run, meta, enemy } = combat(15102, ["relic_supercritical_storage_ampoule"]);
  const harness = createTurnHarness(run, meta);
  for (const expectedTurn of [2, 3]) {
    enemy.intent = { type: "guard", value: 0 };
    const start = harness.events.length;
    await harness.orchestrator.handleEndTurn();
    assert.equal(run.battle.turn, expectedTurn);
    const turnEvents = harness.events.slice(start);
    assert.equal(
      turnEvents.filter((event) => event.type === "absorb-gain" && event.amount === 8).length,
      1,
    );
    assertConsumed(run, ["_absorbFeedback"]);
  }
}

// 잔향의 기억 + 불안정한 용매: discard animation -> self damage -> Absorb Gain.
{
  const { run, meta } = combat(15103, [
    "trait_scent_memory_echo",
    "curse_trait_unstable_solvent",
  ]);
  run.battle.pendingDiscard = 1;
  run.battle.hand = [{ id: "strike", level: 0 }];
  run.hp = Math.max(10, run.maxHp - 10);
  clearTransient(run);
  const events = [];
  const feedback = {
    animateDiscardedCard: async () => events.push({ type: "discard-animation" }),
    showImpurityOverflowQueue: async () => {},
    showHarmonyFeedback() {},
    showEnemyHitQueue: async () => {},
    showStatusDamageQueue: async () => {},
    showStatusProcQueue: async () => {},
    showStatusProcVfx: async () => {},
    showPlayerDeath: async () => {},
    waitForLethalHitEffects: async () => {},
    showMonsterDeath: async () => {},
    stageDrawFeedback() {},
    showShuffleFeedback: async () => {},
    showDrawFeedback: async () => {},
    showPlayerDamage: (amount) => events.push({ type: "player-damage", amount }),
    showPlayerHealing: (amount) => events.push({ type: "heal", amount }),
    showAbsorbGain: (amount) => events.push({ type: "absorb-gain", amount }),
    showShieldGain: (amount) => events.push({ type: "shield-gain", amount }),
  };
  const { handleGameAction } = createGameActionOrchestrator({
    engine: { discardFromHand: E.discardFromHand },
    enemyDefinitionFor: () => ({}),
    getRun: () => run,
    getMeta: () => meta,
    setStarted() {},
    setCardAnimating() {},
    save() {},
    render() {},
    sleep: async () => {},
    reducedCombatMotion: () => false,
    hideRestUpgradeComparison() {},
    confirmReplaceRun: () => true,
    openStartingDeckBuilder() {},
    sound: { potion() {}, playerStatusHit() {} },
    roomRelicPresentation: null,
    feedback,
  });
  await handleGameAction({ dataset: { action: "discard-choice", index: "0" } });
  const discardIndex = events.findIndex((event) => event.type === "discard-animation"),
    damageIndex = events.findIndex((event) => event.type === "player-damage" && event.amount === 1),
    absorbIndex = events.findIndex((event) => event.type === "absorb-gain" && event.amount === 1);
  assert.ok(discardIndex >= 0 && damageIndex > discardIndex && absorbIndex > damageIndex);
  assert.equal(eventsOf(events, "player-damage").length, 1);
  assert.equal(eventsOf(events, "absorb-gain").length, 1);
  assertConsumed(run, ["_playerDamageFeedback", "_absorbFeedback"]);
}

// 포화 분출 + 방패의 검신 연금술: feedback flushes before Enemy Phase.
{
  const { run, meta, enemy } = combat(15104, [
    "trait_saturated_spillover",
    "trait_shield_to_blade_transmute",
  ]);
  run.battle.absorb = 25;
  run.battle.shield = 20;
  enemy.intent = { type: "guard", value: 0 };
  const { orchestrator, events } = createTurnHarness(run, meta);
  await orchestrator.handleEndTurn();
  const queueIndex = events.findIndex(
      (event) => event.type === "enemy-hit-queue" && event.hits.some((hit) => hit.damage === 4),
    ),
    shieldIndex = events.findIndex((event) => event.type === "shield-gain" && event.amount === 3),
    enemyIndex = events.findIndex((event) => event.type === "engine-enemy-action");
  assert.ok(queueIndex >= 0 && queueIndex < enemyIndex);
  assert.ok(shieldIndex >= 0 && shieldIndex < enemyIndex);
  assert.equal(eventsOf(events, "shield-gain").filter((event) => event.amount === 3).length, 1);
  assertConsumed(run, ["_enemyHitFeedback", "_shieldGainFeedback"]);
}

// 베이스 우디 고정: Base note stages next-turn Shield and VFX flushes on next Turn Start.
{
  const { run, meta, enemy } = combat(15105, ["trait_base_woody_anchor"]);
  const baseCardId = Object.keys(CARDS).find((id) => CARDS[id]?.note === "base");
  assert.ok(baseCardId);
  run.battle.hand = [{ id: baseCardId, level: 0 }];
  run.battle.ap = 99;
  E.play(run, 0, meta);
  assert.ok(run.battle.nextTurnShield >= 5);
  clearTransient(run);
  enemy.intent = { type: "guard", value: 0 };
  const { orchestrator, events } = createTurnHarness(run, meta);
  await orchestrator.handleEndTurn();
  assert.equal(eventsOf(events, "shield-gain").filter((event) => event.amount >= 5).length, 1);
  assertConsumed(run, ["_shieldGainFeedback"]);
}

// 이슬받이 깔때기 + regenShield / regenShieldT2: Healing -> Shield Gain.
for (const [seed, traitId, shieldAmount] of [
  [15106, "trait_steady_metabolism", 2],
  [15107, "trait_cell_regeneration_boost", 3],
]) {
  const { run, meta, enemy } = combat(seed, ["relic_dewdrop_collector_funnel", traitId]);
  run.hp = Math.max(1, run.maxHp - 10);
  enemy.intent = { type: "guard", value: 0 };
  clearTransient(run);
  const { orchestrator, events } = createTurnHarness(run, meta);
  await orchestrator.handleEndTurn();
  const healIndex = events.findIndex((event) => event.type === "heal" && event.amount === 2),
    shieldIndex = events.findIndex(
      (event) => event.type === "shield-gain" && event.amount === shieldAmount,
    );
  assert.ok(healIndex >= 0 && shieldIndex > healIndex);
  assert.equal(eventsOf(events, "heal").filter((event) => event.amount === 2).length, 1);
  assert.equal(eventsOf(events, "shield-gain").filter((event) => event.amount === shieldAmount).length, 1);
}

// 영원한 이슬 받침 + player regeneration: both use existing Healing presentation.
{
  const { run, meta, enemy } = combat(15108, ["relic_dew_of_eternity"]);
  run.hp = Math.max(1, run.maxHp - 10);
  enemy.intent = { type: "guard", value: 0 };
  clearTransient(run);
  const { orchestrator, events } = createTurnHarness(run, meta);
  await orchestrator.handleEndTurn();
  assert.equal(eventsOf(events, "heal").filter((event) => event.amount === 4).length, 1);
}
{
  const { run, meta, enemy } = combat(15109);
  run.hp = Math.max(1, run.maxHp - 10);
  E.addStatus(run, "player", "regeneration", { stacks: 3, turns: 3 });
  enemy.intent = { type: "guard", value: 0 };
  clearTransient(run);
  const { orchestrator, events } = createTurnHarness(run, meta);
  await orchestrator.handleEndTurn();
  assert.equal(eventsOf(events, "heal").filter((event) => event.amount > 0).length, 1);
}

// Round End victory -> battleEndHeal is presented once after lethal enemy feedback.
{
  const { run, meta, enemy } = combat(15110, ["relic_dried_chamomile_flower"]);
  run.hp = Math.max(1, run.maxHp - 10);
  enemy.hp = 1;
  enemy.maxHp = 20;
  enemy.intent = { type: "guard", value: 0 };
  E.addStatus(run, "enemy", "poison", 1);
  clearTransient(run);
  const { orchestrator, events } = createTurnHarness(run, meta);
  await orchestrator.handleEndTurn();
  assert.equal(run.phase, "reward");
  assert.equal(eventsOf(events, "heal").filter((event) => event.amount === 2).length, 1);
  assert.ok(
    events.findIndex((event) => event.type === "heal") >
      events.findIndex((event) => event.type === "monster-death"),
  );
  assertConsumed(run, ["_healingFeedback"]);
}

// 심연의 도플갱어 꼭두각시: exact direct damage VFX, once, separate from healing.
{
  const { run, meta, enemy } = combat(15111, ["curse_trait_abyssal_mirror_puppet"]);
  run.hp = Math.max(30, run.maxHp - 10);
  run.battle.shield = 0;
  run.battle.cardsPlayedDefinitions = [{ attack: 10, bypassShield: true }];
  enemy.intent = { type: "guard", value: 0 };
  clearTransient(run);
  const before = run.hp;
  const { orchestrator, events } = createTurnHarness(run, meta);
  await orchestrator.handleEndTurn();
  const dealt = before - run.hp;
  assert.equal(dealt, 10);
  assert.equal(eventsOf(events, "player-damage").filter((event) => event.amount === dealt).length, 1);
  assertConsumed(run, ["_playerDamageFeedback"]);
}

// Static contracts: transient feedback exists only for presentation and Card Play keeps one-shot consumption.
const turnSource = fs.readFileSync(new URL("../games/harmony/combat-turn-orchestrator.js", import.meta.url), "utf8"),
  gameActionSource = fs.readFileSync(new URL("../games/harmony/game-action-orchestrator.js", import.meta.url), "utf8"),
  cardSource = fs.readFileSync(new URL("../games/harmony/combat-card-orchestrator.js", import.meta.url), "utf8"),
  coreSource = fs.readFileSync(new URL("../games/harmony/engine-core.js", import.meta.url), "utf8");
assert.match(coreSource, /_shieldGainFeedback\s*=\s*\(s\._shieldGainFeedback \|\| 0\) \+ gained/);
assert.match(coreSource, /_playerDamageFeedback\s*=\s*\(s\._playerDamageFeedback \|\| 0\) \+ dealt/);
assert.match(turnSource, /captureResourceFeedback/);
assert.match(turnSource, /await presentResourceFeedback\(playerTurnResources\)/);
assert.match(turnSource, /await presentResourceFeedback\(actionResources\)/);
assert.match(gameActionSource, /if \(action === "discard-choice"\)/);
assert.match(gameActionSource, /if \(playerDamage\) showPlayerDamage\(playerDamage\)/);
assert.match(gameActionSource, /if \(absorbGained\) showAbsorbGain\(absorbGained\)/);
assert.match(cardSource, /delete run\._playerDamageFeedback/);
assert.match(cardSource, /if \(playerDamage\) showPlayerDamage\(playerDamage\)/);
assert.match(cardSource, /if \(healing\) showPlayerHealing\(healing\)/);
assert.match(cardSource, /if \(absorbGained\) showAbsorbGain\(absorbGained\)/);
assert.match(cardSource, /if \(shieldGained\) showShieldGain\(shieldGained, shieldCardPlayed\)/);

console.log("Harmony feedback action-boundary regression checks passed.");

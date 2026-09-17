import * as Core from "./engine-core.js";
import { CARDS, ITEMS } from "./data.js";
import * as S from "./statuses.js?v=20260911-4";
import {
  playWithStagedAugments,
  discardWithStagedAugments,
} from "./staged-augment-runtime.js";
import {
  playWithSignatureRelics,
  signatureCanPlay,
  signatureCardPlayBlockReason,
  signatureCost,
  signaturePotion,
  withEssenceHeartHealing,
} from "./signature-relic-runtime.js";
import {
  commitEnemyPatternPlan,
  initializeCurrentPatternState,
  refreshEnemyPatternPhaseIntents,
  withPreparedNextTurn,
} from "./engine-enemy-patterns.js";
import {
  applyEnemyImpurityPolicy,
  impurityCount,
} from "./engine-impurity-policy.js";
import {
  CAMPAIGN_LOOPS,
  campaignActInfo,
  clearMilestone,
  consumeRequestedCampaignStart,
  emptyAct6RouteStats,
  isAbyssRun,
  isLateCampaignRun,
  legacyCoreLoop,
  markClearProgress,
  nextLoopTarget,
} from "./campaign-progression.js";
import {
  afterLateEnemyAction,
  afterLatePlayerCard,
  afterLatePlayerTurnEnd,
  markArchivistReservation,
  prepareLateEnemyAction,
  replaceLateGameEncounter,
  withLatePlayerCardDefenses,
} from "./late-game-runtime.js";
import {
  afterLateBossAction,
  prepareLateBosses,
} from "./late-game-boss-phase.js";

export * from "./engine-core.js";
export * from "./enemy-intent.js";
export * from "./campaign-progression.js";

function withCoreLoopCompat(s, action) {
  if (!s || !isLateCampaignRun(s)) return action();
  const actualLoop = s.loop;
  s.loop = legacyCoreLoop(s);
  try {
    return action();
  } finally {
    s.loop = actualLoop;
  }
}

function resetStageState(s) {
  s.node = 0;
  s.route = Core.generateRoute(s);
  s.resolvedRooms = Array(12).fill(null);
  s.currentSubRoom = null;
  s.battle = null;
  s.reward = null;
  s.shopOffers = null;
  s.restChoices = null;
  s.restResult = null;
  s.specialResult = null;
  s.specialDecision = null;
  s.won = false;
  s.phase = "map";
}

function reapplyOpeningEnemyEffects(s) {
  if (s?.phase !== "battle" || !s.battle || s.battle.turn !== 1) return;
  const alive = s.battle.enemies.filter((enemy) => enemy.hp > 0),
    burnOne = Core.power(s, "combatStartBurn1"),
    burnAll = Core.power(s, "startCombatBurnAll");
  if (alive.length && burnOne > 0) {
    const target = alive[Math.floor(Core.random(s) * alive.length)];
    S.applyStatus(target, "burning", burnOne);
  }
  if (burnAll > 0)
    for (const enemy of alive) S.applyStatus(enemy, "burning", burnAll);
}

function enforceLateEnemyPersistenceCap(s) {
  const enemies = s?.battle?.enemies;
  if (!Array.isArray(enemies) || enemies.length <= 3) return;
  while (enemies.length > 3) {
    let index = -1;
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i]?.summoned) {
        index = i;
        break;
      }
    }
    if (index < 0) break;
    enemies.splice(index, 1);
  }
  if (s.battle.selectedTarget >= enemies.length)
    s.battle.selectedTarget = Math.max(0, enemies.length - 1);
  Core.attachEnemyAliases(s.battle);
}

export function actInfo(loop) {
  const value = Math.max(0, Math.floor(Number(loop) || 0));
  if (value <= CAMPAIGN_LOOPS.ACT3) return Core.actInfo(value);
  if (value >= CAMPAIGN_LOOPS.ABYSS_START) {
    const base = Core.actInfo(value),
      info = campaignActInfo(value);
    return { ...base, ...info };
  }
  return { ...campaignActInfo(value), hp: 1, attack: 1 };
}

export function newRun(seed = Date.now() >>> 0, customDeckIds = null, meta = null) {
  const s = Core.newRun(seed, customDeckIds, meta),
    requested = consumeRequestedCampaignStart(meta || {});
  if (requested.loop > 0) {
    s.loop = requested.loop;
    s.act7Route = requested.route;
    if (s.loop === CAMPAIGN_LOOPS.ACT6) s.act6RouteStats = emptyAct6RouteStats();
    resetStageState(s);
  }
  return s;
}

export function cost(s, card) {
  return withCoreLoopCompat(s, () => signatureCost(Core, ITEMS, s, card));
}

export function cardPlayBlockReason(s, card) {
  return withCoreLoopCompat(s, () =>
    signatureCardPlayBlockReason(Core, ITEMS, s, card),
  );
}

export function canPlay(s, card) {
  return withCoreLoopCompat(s, () => signatureCanPlay(Core, ITEMS, s, card));
}

export function play(s, index, meta) {
  const held = s?.battle?.hand?.[index],
    definition = held?.id && CARDS[held.id]
      ? { ...CARDS[held.id], id: held.id, note: held.note || CARDS[held.id].note }
      : null,
    harmoniesBefore = Math.max(0, Number(s?.harmoniesThisRun) || 0),
    hitFeedbackStart = Array.isArray(s?._enemyHitFeedback) ? s._enemyHitFeedback.length : 0,
    shieldBefore = Math.max(0, Number(s?.battle?.shield) || 0),
    result = withCoreLoopCompat(s, () =>
      withLatePlayerCardDefenses(S, s, definition, () =>
        playWithSignatureRelics({
          Core,
          items: ITEMS,
          state: s,
          index,
          meta,
          playBase(core, state, cardIndex, runMeta) {
            return playWithStagedAugments(core, CARDS, ITEMS, state, cardIndex, runMeta);
          },
        }),
      ),
    );
  if (result && definition) {
    const harmonyDelta = Math.max(
        0,
        (Number(s?.harmoniesThisRun) || 0) - harmoniesBefore,
      ),
      hits = Array.isArray(s?._enemyHitFeedback)
        ? s._enemyHitFeedback.slice(hitFeedbackStart)
        : [],
      shieldGained = Math.max(0, (Number(s?.battle?.shield) || 0) - shieldBefore);
    afterLatePlayerCard(Core, S, s, definition, harmonyDelta, {
      hits,
      shieldGained,
    });
  }
  if (result && s?.phase === "battle") refreshEnemyPatternPhaseIntents(s);
  return result;
}

export function discardFromHand(s, index, meta) {
  const result = withCoreLoopCompat(s, () =>
    discardWithStagedAugments(Core, CARDS, s, index, meta),
  );
  if (result && s?.phase === "battle") refreshEnemyPatternPhaseIntents(s);
  return result;
}

export function enter(s, meta) {
  const pendingImpuritiesBefore = Math.max(0, Number(s?.pendingImpurities) || 0),
    late = isLateCampaignRun(s) || isAbyssRun(s),
    defeatedBefore = late && Array.isArray(meta?.defeatedMonsters)
      ? [...meta.defeatedMonsters]
      : null,
    result = withCoreLoopCompat(s, () =>
      withEssenceHeartHealing(Core, ITEMS, s, () => Core.enter(s, meta)),
    );

  if (late && s?.phase === "battle" && s.battle) {
    replaceLateGameEncounter(Core, S, s, meta, defeatedBefore);
    prepareLateBosses(s);
    reapplyOpeningEnemyEffects(s);
  }

  // Core.enter draws the opening hand first, then appends pending impurity
  // cards directly to the hand. Keep the current-main opening draw fix.
  if (pendingImpuritiesBefore > 0 && s?.phase === "battle" && s.battle) {
    const feedback = Math.max(0, Number(s._drawFeedback) || 0),
      handCount = s.battle.hand.length;
    if (handCount > feedback) s._drawFeedback = handCount;
  }

  initializeCurrentPatternState(s);
  return result;
}

export function executePlayerTurnEnd(s, meta) {
  const result = withCoreLoopCompat(s, () =>
    withEssenceHeartHealing(Core, ITEMS, s, () =>
      withPreparedNextTurn(s, () => Core.executePlayerTurnEnd(s, meta)),
    ),
  );
  if (result) afterLatePlayerTurnEnd(Core, S, s);
  if (result && s?.phase === "battle") refreshEnemyPatternPhaseIntents(s);
  return result;
}

export function executeSingleEnemyAction(s, enemyIndex, meta) {
  const b = s?.battle,
    enemy = b?.enemies?.[enemyIndex];
  refreshEnemyPatternPhaseIntents(s);
  if (enemy) prepareLateEnemyAction(s, enemy);
  const intent = enemy?.intent ? structuredClone(enemy.intent) : {},
    discardImpuritiesBefore = impurityCount(b?.discard),
    outcome = withCoreLoopCompat(s, () =>
      withEssenceHeartHealing(Core, ITEMS, s, () =>
        Core.executeSingleEnemyAction(s, enemyIndex, meta),
      ),
    );

  if (enemy) {
    commitEnemyPatternPlan(enemy);
    markArchivistReservation(s, enemy, intent);
    afterLateEnemyAction(Core, S, s, enemy, intent, outcome);
    afterLateBossAction(s, enemy, intent);
    enforceLateEnemyPersistenceCap(s);
  }
  applyEnemyImpurityPolicy(
    s,
    enemy,
    intent,
    discardImpuritiesBefore,
    outcome,
  );
  return outcome;
}

export function executeRoundEnd(s, meta) {
  return withCoreLoopCompat(s, () =>
    withEssenceHeartHealing(Core, ITEMS, s, () =>
      withPreparedNextTurn(s, () => Core.executeRoundEnd(s, meta)),
    ),
  );
}

export function endTurn(s, meta) {
  return withCoreLoopCompat(s, () =>
    withEssenceHeartHealing(Core, ITEMS, s, () =>
      withPreparedNextTurn(s, () => {
        if (!Core.executePlayerTurnEnd(s, meta)) return false;
        afterLatePlayerTurnEnd(Core, S, s);
        refreshEnemyPatternPhaseIntents(s);
        for (let index = 0; index < (s.battle?.enemies?.length || 0); index++) {
          const b = s?.battle,
            enemy = b?.enemies?.[index];
          refreshEnemyPatternPhaseIntents(s);
          if (enemy) prepareLateEnemyAction(s, enemy);
          const intent = enemy?.intent ? structuredClone(enemy.intent) : {},
            discardImpuritiesBefore = impurityCount(b?.discard),
            outcome = Core.executeSingleEnemyAction(s, index, meta);
          if (enemy) {
            commitEnemyPatternPlan(enemy);
            markArchivistReservation(s, enemy, intent);
            afterLateEnemyAction(Core, S, s, enemy, intent, outcome);
            afterLateBossAction(s, enemy, intent);
            enforceLateEnemyPersistenceCap(s);
          }
          applyEnemyImpurityPolicy(
            s,
            enemy,
            intent,
            discardImpuritiesBefore,
            outcome,
          );
          if (s.phase !== "battle") return true;
        }
        Core.executeRoundEnd(s, meta);
        return true;
      }),
    ),
  );
}

export function nextLoop(s, meta, continueRun) {
  if (s?.phase !== "loop") return false;
  const milestone = clearMilestone(s, meta);
  markClearProgress(s, meta, milestone);

  if (!continueRun || milestone?.forceHome) {
    Core.nextLoop(s, meta, false);
    return true;
  }

  const target = nextLoopTarget(s);
  s.loop = target.loop;
  s.act7Route = target.route;
  if (s.loop === CAMPAIGN_LOOPS.ACT6) s.act6RouteStats = emptyAct6RouteStats();
  if (s.loop !== CAMPAIGN_LOOPS.ACT7) delete s.act7Route;
  resetStageState(s);
  return true;
}

export function potion(s) {
  return signaturePotion(Core, ITEMS, s);
}

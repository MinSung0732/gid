import * as Core from "./engine-core.js";
import { CARDS, ITEMS } from "./data.js";
import {
  playWithStagedAugments,
  discardWithStagedAugments,
} from "./staged-augment-runtime.js";
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

export * from "./engine-core.js";
export * from "./enemy-intent.js";

export function play(s, index, meta) {
  const result = playWithStagedAugments(Core, CARDS, ITEMS, s, index, meta);
  if (result && s?.phase === "battle") refreshEnemyPatternPhaseIntents(s);
  return result;
}

export function discardFromHand(s, index, meta) {
  const result = discardWithStagedAugments(Core, CARDS, s, index, meta);
  if (result && s?.phase === "battle") refreshEnemyPatternPhaseIntents(s);
  return result;
}

export function enter(s, meta) {
  const pendingImpuritiesBefore = Math.max(0, Number(s?.pendingImpurities) || 0),
    result = Core.enter(s, meta);

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
  const result = withPreparedNextTurn(s, () => Core.executePlayerTurnEnd(s, meta));
  if (result && s?.phase === "battle") refreshEnemyPatternPhaseIntents(s);
  return result;
}

export function executeSingleEnemyAction(s, enemyIndex, meta) {
  const b = s?.battle,
    enemy = b?.enemies?.[enemyIndex];
  refreshEnemyPatternPhaseIntents(s);
  const intent = enemy?.intent ? structuredClone(enemy.intent) : {},
    discardImpuritiesBefore = impurityCount(b?.discard),
    outcome = Core.executeSingleEnemyAction(s, enemyIndex, meta);

  if (enemy) commitEnemyPatternPlan(enemy);
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
  return withPreparedNextTurn(s, () => Core.executeRoundEnd(s, meta));
}

export function endTurn(s, meta) {
  return withPreparedNextTurn(s, () => {
    if (!Core.executePlayerTurnEnd(s, meta)) return false;
    refreshEnemyPatternPhaseIntents(s);
    for (let index = 0; index < (s.battle?.enemies?.length || 0); index++) {
      executeSingleEnemyAction(s, index, meta);
      if (s.phase !== "battle") return true;
    }
    Core.executeRoundEnd(s, meta);
    return true;
  });
}

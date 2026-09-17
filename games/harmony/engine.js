import * as Core from "./engine-core.js";
import { CARDS, ITEMS, TEST_ITEMS } from "./data.js";
import { STAGED_AUGMENT_CARDS } from "./staged-augments.js";
import {
  installStagedAugments,
  playWithStagedAugments,
  discardWithStagedAugments,
} from "./staged-augment-runtime.js";
import {
  initializeCurrentPatternState,
  withPreparedNextTurn,
} from "./engine-enemy-patterns.js";
import {
  applyEnemyImpurityPolicy,
  impurityCount,
} from "./engine-impurity-policy.js";

// Install feature-branch-only content into the shared mutable registries.
// data.js itself stays untouched so the branch remains easy to merge after UI work.
installStagedAugments(CARDS, ITEMS, TEST_ITEMS);
for (const id of Object.keys(STAGED_AUGMENT_CARDS)) CARDS[id].id = id;

export * from "./engine-core.js";

export function play(s, index, meta) {
  return playWithStagedAugments(Core, CARDS, ITEMS, s, index, meta);
}

export function discardFromHand(s, index, meta) {
  return discardWithStagedAugments(Core, CARDS, s, index, meta);
}

export function enter(s, meta) {
  const pendingImpuritiesBefore = Math.max(0, Number(s?.pendingImpurities) || 0),
    result = Core.enter(s, meta);

  // Core.enter draws the opening hand first, then appends pending impurity
  // cards directly to the hand. The UI animates the last _drawFeedback cards,
  // so those direct inserts used to shift that window and make one of the real
  // opening draws appear instantly. When pending impurities were involved,
  // treat every card that actually ended up in the opening hand as newly drawn.
  if (pendingImpuritiesBefore > 0 && s?.phase === "battle" && s.battle) {
    const feedback = Math.max(0, Number(s._drawFeedback) || 0),
      handCount = s.battle.hand.length;
    if (handCount > feedback) s._drawFeedback = handCount;
  }

  initializeCurrentPatternState(s);
  return result;
}

export function executePlayerTurnEnd(s, meta) {
  return withPreparedNextTurn(s, () => Core.executePlayerTurnEnd(s, meta));
}

export function executeSingleEnemyAction(s, enemyIndex, meta) {
  const b = s?.battle,
    enemy = b?.enemies?.[enemyIndex],
    intent = enemy?.intent ? structuredClone(enemy.intent) : {},
    discardImpuritiesBefore = impurityCount(b?.discard),
    outcome = Core.executeSingleEnemyAction(s, enemyIndex, meta);

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
    for (let index = 0; index < (s.battle?.enemies?.length || 0); index++) {
      executeSingleEnemyAction(s, index, meta);
      if (s.phase !== "battle") return true;
    }
    Core.executeRoundEnd(s, meta);
    return true;
  });
}

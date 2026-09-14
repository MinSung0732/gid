import * as Core from "./engine-core.js";
import {
  ACT1_BOSSES,
  ACT1_ELITES,
  ACT2_BOSSES,
  ACT2_ELITES,
  ACT2_MONSTERS,
  ACT3_BOSSES,
  ACT3_ELITES,
  ACT3_MONSTERS,
  EARLY_MONSTERS,
} from "./data.js";
import { chooseEnemyPattern } from "./enemy-patterns.js";
import {
  extractRecentImpurities,
  impurityInjectionConfig,
  placeImpurities,
} from "./impurity-injection.js";

export * from "./engine-core.js";

const ENEMY_TEMPLATES = {
  ...EARLY_MONSTERS,
  ...ACT2_MONSTERS,
  ...ACT3_MONSTERS,
  ...ACT1_ELITES,
  ...ACT2_ELITES,
  ...ACT3_ELITES,
  ...ACT1_BOSSES,
  ...ACT2_BOSSES,
  ...ACT3_BOSSES,
};

function fixedPatternTurns(enemy) {
  if (Number.isInteger(enemy?.patternFixedTurns))
    return Math.max(0, enemy.patternFixedTurns);
  if (enemy?.isBoss) return 8;
  if (enemy?.isElite) return 3;
  return Array.isArray(enemy?.pattern) ? enemy.pattern.length : 0;
}

function usesRandomPattern(enemy, turn) {
  return Boolean(
    Array.isArray(enemy?.pattern) &&
      enemy.pattern.length &&
      enemy.loopPattern !== true &&
      turn > fixedPatternTurns(enemy),
  );
}

function applyPatternConfig(enemy) {
  if (!enemy) return;
  const template = ENEMY_TEMPLATES[enemy.id];
  if (!template) return;
  if (Number.isInteger(template.patternFixedTurns))
    enemy.patternFixedTurns = Math.max(0, template.patternFixedTurns);
  if (Number.isFinite(template.patternRepeatDecay))
    enemy.patternRepeatDecay = Math.max(0, Math.min(1, template.patternRepeatDecay));
}

function initializeCurrentPatternState(s) {
  const turn = s?.battle?.turn;
  if (!Number.isInteger(turn) || turn < 1) return;
  for (const enemy of s.battle.enemies || []) {
    applyPatternConfig(enemy);
    if (!enemy?.pattern?.length || enemy.patternState) continue;
    // Old saves do not contain patternState. Deterministic turns can be
    // reconstructed exactly; random turns simply begin tracking from the next
    // selection instead of guessing from scaled intent values.
    if (enemy.loopPattern || turn <= fixedPatternTurns(enemy))
      chooseEnemyPattern(enemy, turn, () => 0);
  }
}

function prepareNextTurnPatterns(s, nextTurn) {
  const b = s?.battle;
  if (!b?.enemies?.length) return null;

  initializeCurrentPatternState(s);
  const rngBefore = s.rng,
    prepared = [];

  for (const enemy of b.enemies) {
    applyPatternConfig(enemy);
    if (!usesRandomPattern(enemy, nextTurn)) continue;

    const originalPattern = enemy.pattern,
      previousState = enemy.patternState ? structuredClone(enemy.patternState) : null,
      selected = chooseEnemyPattern(enemy, nextTurn, () => Core.random(s));
    if (!selected) continue;

    // engine-core still performs exactly one seeded RNG pick. Replacing the
    // temporary slots with the already weighted-selected action makes that
    // pick deterministic without changing the RNG sequence or pattern count.
    enemy.pattern = originalPattern.map(() => structuredClone(selected));
    prepared.push({ enemy, originalPattern, previousState });
  }

  s.rng = rngBefore;
  return { turnBefore: b.turn, nextTurn, prepared };
}

function finishPreparedTurn(s, context) {
  if (!context) return;
  const advanced = s?.battle?.turn === context.nextTurn;

  for (const item of context.prepared) {
    item.enemy.pattern = item.originalPattern;
    if (!advanced) {
      if (item.previousState) item.enemy.patternState = item.previousState;
      else delete item.enemy.patternState;
    }
  }

  if (!advanced) return;
  for (const enemy of s.battle?.enemies || []) {
    applyPatternConfig(enemy);
    if (!enemy?.pattern?.length || usesRandomPattern(enemy, context.nextTurn)) continue;
    chooseEnemyPattern(enemy, context.nextTurn, () => 0);
  }
}

function withPreparedNextTurn(s, action) {
  const nextTurn = (s?.battle?.turn || 0) + 1,
    context = prepareNextTurnPatterns(s, nextTurn);
  try {
    return action();
  } finally {
    finishPreparedTurn(s, context);
  }
}

function impurityCount(cards) {
  return Array.isArray(cards)
    ? cards.reduce((count, card) => count + (card?.id === "impurity" ? 1 : 0), 0)
    : 0;
}

function canInjectImpurityToHand(s) {
  const b = s?.battle;
  return Boolean(
    b &&
      b.hand.length < Core.handLimit(s) &&
      impurityCount(b.hand) < Core.impurityHandLimit(s),
  );
}

function applyEnemyImpurityPolicy(s, enemy, intent, discardImpuritiesBefore, outcome) {
  const b = s?.battle;
  if (!b || !outcome) return null;

  const addedToDiscard = Math.max(
    0,
    impurityCount(b.discard) - Math.max(0, discardImpuritiesBefore || 0),
  );
  if (!addedToDiscard) return null;

  // engine-core historically appends enemy pollution to discard. Treat that
  // append as the low-level creation step, then route those exact new cards
  // through one centralized policy. Existing discard contents are untouched.
  const cards = extractRecentImpurities(b.discard, addedToDiscard),
    config = impurityInjectionConfig(intent),
    placement = placeImpurities(b, cards, config, {
      random: () => Core.random(s),
      canAddToHand: () => canInjectImpurityToHand(s),
    });
  if (!placement.total) return null;

  const sequence = Math.max(0, Number(s._impurityInjectionSequence) || 0) + 1,
    feedback = {
      sequence,
      amount: placement.total,
      destination: placement.primaryDestination,
      destinations: placement.destinations,
      placement: config.placement,
      enemyId: enemy?.id || null,
      enemyName: enemy?.name || null,
    };
  s._impurityInjectionSequence = sequence;
  s._impurityInjectionFeedback = feedback;

  // Keep the existing UI contract while also exposing destination metadata for
  // draw/hand/discard-specific feedback and future monster gimmicks.
  outcome.impurities = placement.total;
  outcome.impurityInjection = feedback;
  return feedback;
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

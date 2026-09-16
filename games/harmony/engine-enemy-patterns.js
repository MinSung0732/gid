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

export function initializeCurrentPatternState(s) {
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

export function withPreparedNextTurn(s, action) {
  const nextTurn = (s?.battle?.turn || 0) + 1,
    context = prepareNextTurnPatterns(s, nextTurn);
  try {
    return action();
  } finally {
    finishPreparedTurn(s, context);
  }
}

export const DEFAULT_PATTERN_REPEAT_DECAY = 0.55;

const PATTERN_META_KEYS = ["patternKey", "weight", "repeatDecay"];

function clampDecay(value, fallback = DEFAULT_PATTERN_REPEAT_DECAY) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.min(1, number))
    : fallback;
}

function baseWeight(entry) {
  const value = Number(entry?.weight);
  return Number.isFinite(value) ? Math.max(0, value) : 1;
}

function patternKey(entry, index) {
  return entry?.patternKey ?? index;
}

function introTurns(enemy, patternLength) {
  if (Number.isInteger(enemy?.patternFixedTurns))
    return Math.max(0, enemy.patternFixedTurns);
  if (enemy?.isBoss) return 8;
  if (enemy?.isElite) return 3;
  return patternLength;
}

function cloneAction(entry) {
  const action = structuredClone(entry);
  for (const key of PATTERN_META_KEYS) delete action[key];
  return action;
}

function recordPattern(enemy, entry, index) {
  const key = patternKey(entry, index),
    previous = enemy.patternState;
  enemy.patternState = previous?.lastKey === key
    ? { lastKey: key, repeatCount: Math.max(1, previous.repeatCount || 1) + 1 }
    : { lastKey: key, repeatCount: 1 };
}

export function enemyPatternWeights(enemy) {
  const pattern = Array.isArray(enemy?.pattern) ? enemy.pattern : [];
  if (!pattern.length) return [];

  let weights = pattern.map(baseWeight);
  if (!weights.some((weight) => weight > 0)) weights = pattern.map(() => 1);

  const state = enemy?.patternState;
  if (state?.lastKey == null) return weights;

  const repeatCount = Math.max(1, Number(state.repeatCount) || 1);
  weights = weights.map((weight, index) => {
    const entry = pattern[index];
    if (patternKey(entry, index) !== state.lastKey) return weight;
    const decay = clampDecay(entry?.repeatDecay ?? enemy?.patternRepeatDecay);
    return weight * Math.pow(decay, repeatCount);
  });

  // A single-pattern enemy, or a deliberately zero-weight pool, must still
  // have a valid action instead of producing an invalid weighted roll.
  if (!weights.some((weight) => weight > 0))
    weights = pattern.map(baseWeight).map((weight) => weight > 0 ? weight : 1);
  return weights;
}

function weightedIndex(weights, roll01) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!(total > 0)) return 0;
  let roll = Math.max(0, Math.min(0.9999999999999999, Number(roll01) || 0)) * total;
  for (let index = 0; index < weights.length; index++) {
    roll -= weights[index];
    if (roll < 0) return index;
  }
  return weights.length - 1;
}

/**
 * Selects one enemy action without hard-coding pattern indexes.
 *
 * Monster definitions can be maintained by simply adding/removing entries in
 * `pattern`. Optional tuning fields are deliberately local to the definition:
 * - enemy.patternFixedTurns: deterministic intro length (0 = random immediately)
 * - enemy.patternRepeatDecay: repeat multiplier, default 0.55 (1 = old uniform RNG)
 * - entry.weight: base random weight for this action
 * - entry.repeatDecay: per-action repeat multiplier override
 * - entry.patternKey: group equivalent entries under one repeat history key
 *
 * Selection metadata is stripped before the action reaches combat execution.
 */
export function chooseEnemyPattern(enemy, turn, nextRandom = Math.random) {
  const pattern = Array.isArray(enemy?.pattern) ? enemy.pattern : [];
  if (!pattern.length) return null;

  const currentTurn = Math.max(1, Math.floor(Number(turn) || 1)),
    fixedTurns = introTurns(enemy, pattern.length),
    deterministic = enemy.loopPattern === true || currentTurn <= fixedTurns;
  let index;

  if (deterministic) {
    index = (currentTurn - 1) % pattern.length;
  } else {
    index = weightedIndex(enemyPatternWeights(enemy), nextRandom());
  }

  const entry = pattern[index];
  recordPattern(enemy, entry, index);
  return cloneAction(entry);
}

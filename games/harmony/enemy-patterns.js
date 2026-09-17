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
  if (entry == null || typeof entry !== "object") return entry ?? null;
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
 * Selects one legacy enemy action without hard-coding pattern indexes.
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

export function hasEnemyPatternV2(enemy) {
  return Array.isArray(enemy?.phases) && enemy.phases.length > 0;
}

function phaseId(phase, index) {
  return phase?.id || `phase${index + 1}`;
}

function hpRatio(enemy) {
  const maxHp = Math.max(1, Number(enemy?.maxHp) || 1);
  return Math.max(0, Math.min(1, (Number(enemy?.hp) || 0) / maxHp));
}

/**
 * Phase thresholds are evaluated in declaration order. `hpAbove` is an
 * exclusive lower bound, so hpAbove: 0.7 means the phase remains active while
 * HP is greater than 70%; exactly 70% advances to the next declared phase.
 */
export function enemyPatternV2TargetPhaseIndex(enemy) {
  const phases = Array.isArray(enemy?.phases) ? enemy.phases : [];
  if (!phases.length) return -1;
  const ratio = hpRatio(enemy);
  for (let index = 0; index < phases.length; index++) {
    const floor = Number(phases[index]?.hpAbove);
    if (ratio > (Number.isFinite(floor) ? floor : 0) || index === phases.length - 1)
      return index;
  }
  return phases.length - 1;
}

function normalizedV2State(enemy) {
  const phases = enemy.phases,
    targetIndex = enemyPatternV2TargetPhaseIndex(enemy),
    previous = enemy.patternV2State;
  if (!previous || typeof previous !== "object") {
    const initialIndex = Math.max(0, targetIndex),
      initialPhase = phases[initialIndex],
      id = phaseId(initialPhase, initialIndex);
    enemy.patternV2State = {
      phaseIndex: initialIndex,
      phaseId: id,
      openingIndex: 0,
      cycleIndex: 0,
      enteredPhases: [id],
      pendingOnEnter: false,
      conditionalLastUsed: {},
      randomHistory: {},
      selectedCount: 0,
    };
    return { state: enemy.patternV2State, phase: initialPhase, transitioned: false };
  }

  const state = previous;
  let currentIndex = Number.isInteger(state.phaseIndex)
    ? state.phaseIndex
    : phases.findIndex((phase, index) => phaseId(phase, index) === state.phaseId);
  if (currentIndex < 0) currentIndex = 0;
  currentIndex = Math.max(0, Math.min(phases.length - 1, currentIndex));
  const nextIndex = Math.max(currentIndex, targetIndex);
  state.enteredPhases = Array.isArray(state.enteredPhases) ? state.enteredPhases : [];
  state.conditionalLastUsed = state.conditionalLastUsed && typeof state.conditionalLastUsed === "object"
    ? state.conditionalLastUsed
    : {};
  state.randomHistory = state.randomHistory && typeof state.randomHistory === "object"
    ? state.randomHistory
    : {};
  state.selectedCount = Math.max(0, Math.floor(Number(state.selectedCount) || 0));
  state.openingIndex = Math.max(0, Math.floor(Number(state.openingIndex) || 0));
  state.cycleIndex = Math.max(0, Math.floor(Number(state.cycleIndex) || 0));

  if (nextIndex > currentIndex) {
    const nextPhase = phases[nextIndex],
      id = phaseId(nextPhase, nextIndex);
    state.phaseIndex = nextIndex;
    state.phaseId = id;
    state.cycleIndex = 0;
    // `opening` is the initial encounter tutorial. A later HP phase starts at
    // onEnter -> cycle[0], matching the raid-style phase transition contract.
    state.openingIndex = Array.isArray(nextPhase?.opening) ? nextPhase.opening.length : 0;
    state.pendingOnEnter = Boolean(nextPhase?.onEnter);
    if (!state.enteredPhases.includes(id)) state.enteredPhases.push(id);
    return { state, phase: nextPhase, transitioned: true };
  }

  state.phaseIndex = currentIndex;
  state.phaseId = phaseId(phases[currentIndex], currentIndex);
  return { state, phase: phases[currentIndex], transitioned: false };
}

export function syncEnemyPatternV2Phase(enemy) {
  if (!hasEnemyPatternV2(enemy))
    return { state: null, phase: null, transitioned: false };
  return normalizedV2State(enemy);
}

function entityStacks(entity, id) {
  const value = entity?.statuses?.[id];
  if (typeof value === "number") return Math.max(0, value);
  return Math.max(0, Number(value?.stacks) || 0);
}

function statusRequirementMatches(entity, requirement) {
  if (!requirement || typeof requirement !== "object") return false;
  const id = requirement.id || requirement.statusId;
  if (!id) return false;
  const required = Math.max(0, Number(requirement.stacks ?? requirement.amount ?? 1) || 0);
  return entityStacks(entity, id) >= required;
}

/**
 * Explicit predicate vocabulary for conditional actions. Unknown condition
 * keys fail closed so a typo cannot silently create an always-on boss skill.
 */
export function enemyPatternConditionMatches(condition, context = {}, enemy = null, phase = null) {
  if (!condition) return true;
  if (Array.isArray(condition))
    return condition.every((entry) => enemyPatternConditionMatches(entry, context, enemy, phase));
  if (typeof condition !== "object") return false;

  const player = context.player || context.state || null,
    battle = context.battle || player?.battle || null,
    playerMaxHp = Math.max(1, Number(player?.maxHp) || 1),
    playerHpRatio = Math.max(0, Math.min(1, (Number(player?.hp) || 0) / playerMaxHp)),
    enemyRatio = hpRatio(enemy);

  for (const [key, value] of Object.entries(condition)) {
    if (key === "playerHpRatioAtMost" && !(playerHpRatio <= Number(value))) return false;
    else if (key === "playerHpRatioAtLeast" && !(playerHpRatio >= Number(value))) return false;
    else if (key === "enemyHpRatioAtMost" && !(enemyRatio <= Number(value))) return false;
    else if (key === "enemyHpRatioAtLeast" && !(enemyRatio >= Number(value))) return false;
    else if (key === "playerShieldAtLeast" && !((Number(battle?.shield) || 0) >= Number(value))) return false;
    else if (key === "playerShieldAtMost" && !((Number(battle?.shield) || 0) <= Number(value))) return false;
    else if (key === "cardsPlayedThisTurnAtLeast" && !((Number(battle?.cardsPlayedThisTurn) || 0) >= Number(value))) return false;
    else if (key === "contactCardsPlayedThisTurnAtLeast" && !((Number(battle?.contactCardsPlayedThisTurn) || 0) >= Number(value))) return false;
    else if (key === "nonContactCardsPlayedThisTurnAtLeast" && !((Number(battle?.nonContactCardsPlayedThisTurn) || 0) >= Number(value))) return false;
    else if (key === "turnAtLeast" && !((Number(context.turn ?? battle?.turn) || 0) >= Number(value))) return false;
    else if (key === "phaseId" && phaseId(phase, enemy?.patternV2State?.phaseIndex || 0) !== value) return false;
    else if (key === "playerStatusAtLeast" && !statusRequirementMatches(player, value)) return false;
    else if (key === "enemyStatusAtLeast" && !statusRequirementMatches(enemy, value)) return false;
    else if (![
      "playerHpRatioAtMost", "playerHpRatioAtLeast",
      "enemyHpRatioAtMost", "enemyHpRatioAtLeast",
      "playerShieldAtLeast", "playerShieldAtMost",
      "cardsPlayedThisTurnAtLeast", "contactCardsPlayedThisTurnAtLeast",
      "nonContactCardsPlayedThisTurnAtLeast", "turnAtLeast", "phaseId",
      "playerStatusAtLeast", "enemyStatusAtLeast",
    ].includes(key)) return false;
  }
  return true;
}

function slotHistoryKey(state, phase, slotIndex) {
  return `${state.phaseId}:${phaseId(phase, state.phaseIndex)}:${slotIndex}`;
}

function randomCandidate(entry, index) {
  if (entry?.action && typeof entry.action === "object")
    return { source: entry, action: entry.action, key: patternKey(entry, index) };
  return { source: entry, action: entry, key: patternKey(entry, index) };
}

function chooseRandomSlot(enemy, phase, state, slot, slotIndex, nextRandom) {
  const entries = Array.isArray(slot?.random) ? slot.random : [];
  if (!entries.length) return null;
  const historyKey = slotHistoryKey(state, phase, slotIndex),
    history = state.randomHistory[historyKey] || null,
    candidates = entries.map(randomCandidate);
  let weights = candidates.map(({ source }) => baseWeight(source));
  if (!weights.some((weight) => weight > 0)) weights = candidates.map(() => 1);
  if (history?.lastKey != null) {
    const repeatCount = Math.max(1, Number(history.repeatCount) || 1);
    weights = weights.map((weight, index) => {
      const candidate = candidates[index];
      if (candidate.key !== history.lastKey) return weight;
      const decay = clampDecay(candidate.source?.repeatDecay ?? slot?.repeatDecay ?? enemy?.patternRepeatDecay);
      return weight * Math.pow(decay, repeatCount);
    });
    if (!weights.some((weight) => weight > 0)) weights = candidates.map(() => 1);
  }
  const index = weightedIndex(weights, nextRandom()),
    selected = candidates[index],
    previous = state.randomHistory[historyKey];
  state.randomHistory[historyKey] = previous?.lastKey === selected.key
    ? { lastKey: selected.key, repeatCount: Math.max(1, previous.repeatCount || 1) + 1 }
    : { lastKey: selected.key, repeatCount: 1 };
  return cloneAction(selected.action);
}

function resolveV2Entry(enemy, phase, state, entry, slotIndex, nextRandom) {
  if (!entry) return null;
  if (Array.isArray(entry.random))
    return chooseRandomSlot(enemy, phase, state, entry, slotIndex, nextRandom);
  return cloneAction(entry.action && typeof entry.action === "object" ? entry.action : entry);
}

function conditionalPool(enemy, phase) {
  return [
    ...(Array.isArray(enemy?.conditionalActions) ? enemy.conditionalActions : []),
    ...(Array.isArray(phase?.conditionalActions) ? phase.conditionalActions : []),
  ];
}

function conditionalReady(entry, index, state, context, enemy, phase) {
  if (!enemyPatternConditionMatches(entry?.condition, context, enemy, phase)) return false;
  const id = entry?.id || entry?.patternKey || `conditional:${index}`,
    lastUsed = Number(state.conditionalLastUsed[id]),
    cooldown = Math.max(0, Math.floor(Number(entry?.cooldown) || 0));
  if (!Number.isFinite(lastUsed)) return true;
  return state.selectedCount - lastUsed > cooldown;
}

function chooseConditional(enemy, phase, state, context, nextRandom) {
  const pool = conditionalPool(enemy, phase),
    ready = pool
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry, index }) => conditionalReady(entry, index, state, context, enemy, phase));
  if (!ready.length) return null;
  let selected = ready[0];
  if (ready.length > 1) {
    const weights = ready.map(({ entry }) => baseWeight(entry));
    selected = ready[weightedIndex(weights, nextRandom())];
  }
  const id = selected.entry.id || selected.entry.patternKey || `conditional:${selected.index}`;
  state.conditionalLastUsed[id] = state.selectedCount;
  return resolveV2Entry(enemy, phase, state, selected.entry.action, `conditional:${id}`, nextRandom);
}

/**
 * V2 selection priority:
 *   phase onEnter -> initial opening -> eligible conditional -> phase cycle.
 * Conditional actions do not consume the deterministic cycle position.
 */
export function chooseEnemyPatternV2(enemy, context = {}, nextRandom = Math.random) {
  if (!hasEnemyPatternV2(enemy)) return null;
  const { state, phase } = syncEnemyPatternV2Phase(enemy);
  if (!state || !phase) return null;

  let action = null;
  if (state.pendingOnEnter && phase.onEnter) {
    action = resolveV2Entry(enemy, phase, state, phase.onEnter, "onEnter", nextRandom);
    state.pendingOnEnter = false;
  } else {
    const opening = Array.isArray(phase.opening) ? phase.opening : [];
    if (state.openingIndex < opening.length) {
      const index = state.openingIndex++;
      action = resolveV2Entry(enemy, phase, state, opening[index], `opening:${index}`, nextRandom);
    } else {
      action = chooseConditional(enemy, phase, state, context, nextRandom);
      if (!action) {
        const cycle = Array.isArray(phase.cycle) ? phase.cycle : [];
        if (cycle.length) {
          const index = state.cycleIndex % cycle.length;
          action = resolveV2Entry(enemy, phase, state, cycle[index], index, nextRandom);
          state.cycleIndex = (index + 1) % cycle.length;
        }
      }
    }
  }
  if (action) state.selectedCount++;
  return action;
}

export function chooseEnemyAction(enemy, context = {}, nextRandom = Math.random) {
  if (hasEnemyPatternV2(enemy))
    return chooseEnemyPatternV2(enemy, context, nextRandom);
  return chooseEnemyPattern(enemy, context.turn, nextRandom);
}

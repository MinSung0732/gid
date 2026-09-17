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
      "playerHpRatioAtMost",
      "playerHpRatioAtLeast",
      "enemyHpRatioAtMost",
      "enemyHpRatioAtLeast",
      "playerShieldAtLeast",
      "playerShieldAtMost",
      "cardsPlayedThisTurnAtLeast",
      "contactCardsPlayedThisTurnAtLeast",
      "nonContactCardsPlayedThisTurnAtLeast",
      "turnAtLeast",
      "phaseId",
      "playerStatusAtLeast",
      "enemyStatusAtLeast",
    ].includes(key)) return false;
  }
  return true;
}

function historyWeights(entries, history, fallbackDecay) {
  let weights = entries.map(baseWeight);
  if (!weights.some((weight) => weight > 0)) weights = entries.map(() => 1);
  if (history?.lastKey == null) return weights;
  const repeatCount = Math.max(1, Number(history.repeatCount) || 1);
  weights = weights.map((weight, index) => {
    if (patternKey(entries[index], index) !== history.lastKey) return weight;
    const decay = clampDecay(entries[index]?.repeatDecay, fallbackDecay);
    return weight * Math.pow(decay, repeatCount);
  });
  if (!weights.some((weight) => weight > 0)) return entries.map(() => 1);
  return weights;
}

function resolveV2Slot(enemy, state, phase, slot, slotKey, nextRandom) {
  if (!slot || typeof slot !== "object" || !Array.isArray(slot.random))
    return cloneAction(slot);
  const candidates = slot.random.filter((entry) => entry && typeof entry === "object");
  if (!candidates.length) return null;
  const history = state.randomHistory[slotKey],
    weights = historyWeights(
      candidates,
      history,
      clampDecay(slot.repeatDecay ?? enemy.patternRepeatDecay),
    ),
    index = candidates.length === 1 ? 0 : weightedIndex(weights, nextRandom()),
    entry = candidates[index],
    key = patternKey(entry, index);
  state.randomHistory[slotKey] = history?.lastKey === key
    ? { lastKey: key, repeatCount: Math.max(1, history.repeatCount || 1) + 1 }
    : { lastKey: key, repeatCount: 1 };
  return cloneAction(entry);
}

function conditionalPool(enemy, phase) {
  return [
    ...(Array.isArray(enemy?.conditionalActions) ? enemy.conditionalActions : []),
    ...(Array.isArray(phase?.conditionalActions) ? phase.conditionalActions : []),
  ];
}

function conditionalKey(conditional, index) {
  return conditional?.id || conditional?.patternKey || `conditional:${index}`;
}

function conditionalReady(state, conditional, index) {
  const key = conditionalKey(conditional, index),
    cooldown = Math.max(0, Math.floor(Number(conditional?.cooldown) || 0)),
    lastUsed = state?.conditionalLastUsed?.[key];
  if (lastUsed == null) return true;
  return Math.max(0, Number(state?.selectedCount) || 0) - lastUsed > cooldown;
}

function recordConditionalUse(state, conditional, index) {
  const key = conditionalKey(conditional, index);
  state.conditionalLastUsed[key] = state.selectedCount;
}

function statePhase(enemy, state) {
  const phases = Array.isArray(enemy?.phases) ? enemy.phases : [];
  if (!phases.length) return { phase: null, phaseIndex: -1 };
  let phaseIndex = Number.isInteger(state?.phaseIndex)
    ? state.phaseIndex
    : phases.findIndex((phase, index) => phaseId(phase, index) === state?.phaseId);
  if (phaseIndex < 0) phaseIndex = enemyPatternV2TargetPhaseIndex(enemy);
  phaseIndex = Math.max(0, Math.min(phases.length - 1, phaseIndex));
  return { phase: phases[phaseIndex], phaseIndex };
}

/**
 * Read-only conditional lookup used by the runtime while a base cycle action is
 * already being previewed. Passing the pre-plan snapshot lets player actions
 * (shield gain, card count, statuses, etc.) promote the preview to a
 * conditional response without consuming the cycle slot or rerolling it.
 */
export function enemyPatternV2ReadyConditional(
  enemy,
  context = {},
  stateOverride = null,
) {
  if (!hasEnemyPatternV2(enemy)) return null;
  const state = stateOverride || enemy.patternV2State;
  if (!state) return null;
  const { phase, phaseIndex } = statePhase(enemy, state);
  if (!phase) return null;
  const conditionals = conditionalPool(enemy, phase);
  for (let index = 0; index < conditionals.length; index++) {
    const conditional = conditionals[index];
    if (!conditionalReady(state, conditional, index)) continue;
    if (!enemyPatternConditionMatches(conditional?.condition, context, enemy, phase))
      continue;
    return {
      conditional,
      index,
      key: conditionalKey(conditional, index),
      phase,
      phaseIndex,
    };
  }
  return null;
}

function finishV2Selection(state, action, metadata = {}) {
  if (action) state.selectedCount++;
  return action ? { action, ...metadata } : null;
}

/**
 * Selects and advances one V2 raid-style plan while also returning selection
 * metadata for the engine adapter. `chooseEnemyPatternV2` below preserves the
 * simpler action-only API used by tests/content tooling.
 */
export function chooseEnemyPatternV2Plan(
  enemy,
  context = {},
  nextRandom = Math.random,
) {
  if (!hasEnemyPatternV2(enemy)) return null;
  const { state, phase } = normalizedV2State(enemy);
  if (!phase) return null;
  const id = state.phaseId;

  if (state.pendingOnEnter && phase.onEnter) {
    state.pendingOnEnter = false;
    return finishV2Selection(
      state,
      resolveV2Slot(enemy, state, phase, phase.onEnter, `${id}:onEnter`, nextRandom),
      { kind: "onEnter", phaseId: id },
    );
  }

  const opening = Array.isArray(phase.opening) ? phase.opening : [];
  if (state.openingIndex < opening.length) {
    const index = state.openingIndex++,
      action = resolveV2Slot(
        enemy,
        state,
        phase,
        opening[index],
        `${id}:opening:${index}`,
        nextRandom,
      );
    return finishV2Selection(
      state,
      action,
      { kind: "opening", phaseId: id, slotIndex: index },
    );
  }

  const ready = enemyPatternV2ReadyConditional(enemy, context, state);
  if (ready) {
    const action = resolveV2Slot(
      enemy,
      state,
      phase,
      ready.conditional.action,
      `${id}:conditional:${ready.key}`,
      nextRandom,
    );
    if (action) {
      recordConditionalUse(state, ready.conditional, ready.index);
      return finishV2Selection(
        state,
        action,
        {
          kind: "conditional",
          phaseId: id,
          conditionalKey: ready.key,
          conditionalIndex: ready.index,
        },
      );
    }
  }

  const cycle = Array.isArray(phase.cycle) ? phase.cycle : [];
  if (!cycle.length) return null;
  const index = state.cycleIndex % cycle.length;
  state.cycleIndex = (index + 1) % cycle.length;
  return finishV2Selection(
    state,
    resolveV2Slot(enemy, state, phase, cycle[index], `${id}:cycle:${index}`, nextRandom),
    { kind: "cycle", phaseId: id, slotIndex: index },
  );
}

/**
 * Selects a V2 raid-style action. Selection advances pattern state, so callers
 * that expose an intent before execution should snapshot the state and restore
 * it if that planned action is replaced by a later HP phase transition or by a
 * newly-triggered conditional response.
 */
export function chooseEnemyPatternV2(enemy, context = {}, nextRandom = Math.random) {
  return chooseEnemyPatternV2Plan(enemy, context, nextRandom)?.action || null;
}

export function chooseEnemyAction(enemy, context = {}, nextRandom = Math.random) {
  if (hasEnemyPatternV2(enemy))
    return chooseEnemyPatternV2(enemy, context, nextRandom);
  return chooseEnemyPattern(enemy, context.turn, nextRandom);
}

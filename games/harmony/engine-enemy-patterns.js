import * as Core from "./engine-core.js";
import { ENEMIES } from "./data.js";
import {
  chooseEnemyPattern,
  chooseEnemyPatternV2Plan,
  enemyPatternV2ReadyConditional,
  enemyPatternV2TargetPhaseIndex,
  hasEnemyPatternV2,
  syncEnemyPatternV2Phase,
} from "./enemy-patterns.js";
import { refreshEnemyIntentView } from "./enemy-intent.js";

function fixedPatternTurns(enemy) {
  if (Number.isInteger(enemy?.patternFixedTurns))
    return Math.max(0, enemy.patternFixedTurns);
  if (enemy?.isBoss) return 8;
  if (enemy?.isElite) return 3;
  return Array.isArray(enemy?.pattern) ? enemy.pattern.length : 0;
}

function usesRandomPattern(enemy, turn) {
  return Boolean(
    !hasEnemyPatternV2(enemy) &&
      Array.isArray(enemy?.pattern) &&
      enemy.pattern.length &&
      enemy.loopPattern !== true &&
      turn > fixedPatternTurns(enemy),
  );
}

function applyPatternConfig(enemy) {
  if (!enemy) return;
  const template = ENEMIES[enemy.id];
  if (!template) return;
  if (Number.isInteger(template.patternFixedTurns))
    enemy.patternFixedTurns = Math.max(0, template.patternFixedTurns);
  if (Number.isFinite(template.patternRepeatDecay))
    enemy.patternRepeatDecay = Math.max(0, Math.min(1, template.patternRepeatDecay));
  if (!enemy.phases && Array.isArray(template.phases) && template.phases.length)
    enemy.phases = structuredClone(template.phases);
  if (!enemy.conditionalActions && Array.isArray(template.conditionalActions))
    enemy.conditionalActions = structuredClone(template.conditionalActions);
  if (template.intentVisibility && !enemy.intentVisibility)
    enemy.intentVisibility = template.intentVisibility;
  if (hasEnemyPatternV2(enemy)) {
    // Core's pre-V2 bosses have a hard-coded 50% legacy rage phase. Marking the
    // compatibility flag as already reached prevents that unrelated buff from
    // leaking into V2 bosses; V2 phase state lives in patternV2State instead.
    enemy.phase2 = true;
  }
}

function actionContext(s) {
  return {
    state: s,
    player: s,
    battle: s?.battle || null,
    turn: s?.battle?.turn || 1,
  };
}

function scaleAction(s, enemy, action) {
  if (!action) return null;
  const scaled = structuredClone(action),
    multiplier = enemy.scaleAttackWithAct === false ? 1 : Core.actInfo(s.loop).attack;
  if (Number.isFinite(scaled.value)) scaled.value = Math.round(scaled.value * multiplier);
  if (Number.isFinite(scaled.guard)) scaled.guard = Math.round(scaled.guard * multiplier);
  return scaled;
}

function setPlannedAction(s, enemy, action, turn = s?.battle?.turn) {
  if (!enemy || !action) return null;
  const resolved = scaleAction(s, enemy, action);
  enemy.nextAction = structuredClone(resolved);
  // `intent` remains the combat-compatible full action for now. UI can migrate
  // to `intentView` independently, allowing stealth/blindness to hide info
  // without ever changing the action Core will execute.
  enemy.intent = structuredClone(resolved);
  enemy.nextActionTurn = Math.max(1, Math.floor(Number(turn) || 1));
  refreshEnemyIntentView(s, enemy);
  return resolved;
}

function snapshotPlanState(enemy) {
  if (!hasEnemyPatternV2(enemy) || "_patternV2PlanBefore" in enemy) return;
  enemy._patternV2PlanBefore = enemy.patternV2State
    ? structuredClone(enemy.patternV2State)
    : null;
}

function rollbackPlannedAction(enemy) {
  if (!hasEnemyPatternV2(enemy) || !("_patternV2PlanBefore" in enemy)) return;
  if (enemy._patternV2PlanBefore) enemy.patternV2State = structuredClone(enemy._patternV2PlanBefore);
  else delete enemy.patternV2State;
  delete enemy._patternV2PlanBefore;
  delete enemy._patternV2PlanKind;
  delete enemy._patternV2ConditionalPlanKey;
  delete enemy.nextAction;
  delete enemy.nextActionTurn;
}

function planV2Action(s, enemy, turn = s?.battle?.turn) {
  applyPatternConfig(enemy);
  if (!hasEnemyPatternV2(enemy) || enemy.hp <= 0) return null;
  snapshotPlanState(enemy);
  const plan = chooseEnemyPatternV2Plan(
    enemy,
    actionContext(s),
    () => Core.random(s),
  );
  if (!plan?.action) return null;
  enemy._patternV2PlanKind = plan.kind || "cycle";
  if (plan.conditionalKey)
    enemy._patternV2ConditionalPlanKey = plan.conditionalKey;
  else delete enemy._patternV2ConditionalPlanKey;
  enemy._patternV2PlanPhaseId =
    plan.phaseId || enemy.patternV2State?.phaseId || null;
  enemy._patternV2PlanActionId =
    plan.kind === "onEnter"
      ? "onEnter"
      : plan.kind === "conditional"
        ? `conditional:${plan.conditionalKey || (plan.conditionalIndex ?? 0)}`
        : `${plan.kind || "cycle"}:${plan.slotIndex ?? 0}`;
  return setPlannedAction(s, enemy, plan.action, turn);
}

export function commitEnemyPatternPlan(enemy) {
  if (!enemy) return;
  delete enemy._patternV2PlanBefore;
  delete enemy._patternV2PlanKind;
  delete enemy._patternV2ConditionalPlanKey;
  delete enemy._patternV2PlanPhaseId;
  delete enemy._patternV2PlanActionId;
}

/**
 * Replans only when HP crossed into a later V2 phase. The previous unexecuted
 * plan is rolled back first, so skipping multiple thresholds in one player turn
 * schedules only the final phase's onEnter/cycle action.
 */
export function refreshEnemyPatternPhaseIntents(s) {
  const turn = s?.battle?.turn;
  if (!Number.isInteger(turn) || turn < 1) return false;
  let changed = false;
  for (const enemy of s.battle.enemies || []) {
    applyPatternConfig(enemy);
    if (!hasEnemyPatternV2(enemy) || enemy.hp <= 0) continue;
    const currentIndex = Number.isInteger(enemy.patternV2State?.phaseIndex)
        ? enemy.patternV2State.phaseIndex
        : enemyPatternV2TargetPhaseIndex(enemy),
      targetIndex = enemyPatternV2TargetPhaseIndex(enemy);
    if (targetIndex > currentIndex) {
      rollbackPlannedAction(enemy);
      planV2Action(s, enemy, turn);
      changed = true;
      continue;
    }

    // Cycle previews remain provisional until the enemy acts. If the player
    // satisfies a reaction condition during their turn, replace that preview
    // with the conditional action while restoring the unconsumed cycle slot.
    // This never rerolls the already-previewed base action unless it is actually
    // replaced, and opening/onEnter telegraphs keep priority over reactions.
    if (
      enemy._patternV2PlanKind === "cycle" &&
      "_patternV2PlanBefore" in enemy
    ) {
      const ready = enemyPatternV2ReadyConditional(
        enemy,
        actionContext(s),
        enemy._patternV2PlanBefore,
      );
      if (ready && ready.key !== enemy._patternV2ConditionalPlanKey) {
        rollbackPlannedAction(enemy);
        planV2Action(s, enemy, turn);
        changed = true;
        continue;
      }
    }
    refreshEnemyIntentView(s, enemy);
  }
  return changed;
}

export function initializeCurrentPatternState(s) {
  const turn = s?.battle?.turn;
  if (!Number.isInteger(turn) || turn < 1) return;
  for (const enemy of s.battle.enemies || []) {
    applyPatternConfig(enemy);
    if (hasEnemyPatternV2(enemy)) {
      if (!enemy.patternV2State) {
        // Establish the current phase before snapshotting the first visible plan.
        // If HP later skips phases before execution, rollback returns here so
        // only the final crossed phase receives its onEnter action.
        syncEnemyPatternV2Phase(enemy);
      }
      if (enemy.hp > 0 && enemy.nextActionTurn !== turn)
        planV2Action(s, enemy, turn);
      else refreshEnemyIntentView(s, enemy);
      continue;
    }
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
    if (hasEnemyPatternV2(enemy)) {
      prepared.push({ enemy, v2: true });
      continue;
    }
    if (!usesRandomPattern(enemy, nextTurn)) continue;

    const originalPattern = enemy.pattern,
      previousState = enemy.patternState ? structuredClone(enemy.patternState) : null,
      selected = chooseEnemyPattern(enemy, nextTurn, () => Core.random(s));
    if (!selected) continue;

    // engine-core still performs exactly one seeded RNG pick. Replacing the
    // temporary slots with the already weighted-selected action makes that
    // pick deterministic without changing the RNG sequence or pattern count.
    enemy.pattern = originalPattern.map(() => structuredClone(selected));
    prepared.push({ enemy, originalPattern, previousState, v2: false });
  }

  s.rng = rngBefore;
  return { turnBefore: b.turn, nextTurn, prepared };
}

function finishPreparedTurn(s, context) {
  if (!context) return;
  const advanced = s?.battle?.turn === context.nextTurn;

  for (const item of context.prepared) {
    if (item.v2) continue;
    item.enemy.pattern = item.originalPattern;
    if (!advanced) {
      if (item.previousState) item.enemy.patternState = item.previousState;
      else delete item.enemy.patternState;
    }
  }

  if (!advanced) return;
  for (const enemy of s.battle?.enemies || []) {
    applyPatternConfig(enemy);
    if (hasEnemyPatternV2(enemy)) {
      if (enemy.hp > 0 && enemy.nextActionTurn !== context.nextTurn)
        planV2Action(s, enemy, context.nextTurn);
      continue;
    }
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

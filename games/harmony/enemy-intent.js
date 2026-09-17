export const INTENT_VISIBILITY = Object.freeze({
  FULL: "full",
  CATEGORY: "category",
  HIDDEN: "hidden",
});

const VISIBILITY_RANK = Object.freeze({
  [INTENT_VISIBILITY.FULL]: 0,
  [INTENT_VISIBILITY.CATEGORY]: 1,
  [INTENT_VISIBILITY.HIDDEN]: 2,
});

function normalizeVisibility(value) {
  return value in VISIBILITY_RANK ? value : INTENT_VISIBILITY.FULL;
}

function mostRestrictive(...values) {
  return values
    .map(normalizeVisibility)
    .sort((a, b) => VISIBILITY_RANK[b] - VISIBILITY_RANK[a])[0] || INTENT_VISIBILITY.FULL;
}

/**
 * Intent visibility is deliberately separate from action selection.
 * Future statuses can set:
 * - enemy.intentVisibility = "hidden"   // stealth-like enemy buff
 * - player.enemyIntentVisibility = "hidden" // blindness-like player debuff
 * without rerolling or replacing the already planned enemy action.
 */
export function enemyIntentVisibility(player, enemy, action = enemy?.nextAction || enemy?.intent) {
  if (action?.forceTelegraph) return INTENT_VISIBILITY.FULL;
  return mostRestrictive(
    enemy?.intentVisibility,
    player?.enemyIntentVisibility,
  );
}

export function projectEnemyIntent(action, visibility = INTENT_VISIBILITY.FULL) {
  if (!action) return null;
  const level = action.forceTelegraph
    ? INTENT_VISIBILITY.FULL
    : normalizeVisibility(visibility);
  if (level === INTENT_VISIBILITY.FULL)
    return { ...structuredClone(action), visibility: INTENT_VISIBILITY.FULL };
  if (level === INTENT_VISIBILITY.CATEGORY)
    return {
      type: action.type || "unknown",
      attackPattern: action.type === "attack" ? action.attackPattern || "contact" : undefined,
      visibility: INTENT_VISIBILITY.CATEGORY,
      hiddenDetails: true,
    };
  return {
    type: "hidden",
    visibility: INTENT_VISIBILITY.HIDDEN,
    hidden: true,
  };
}

export function refreshEnemyIntentView(player, enemy) {
  if (!enemy) return null;
  const action = enemy.nextAction || enemy.intent || null;
  enemy.intentView = projectEnemyIntent(
    action,
    enemyIntentVisibility(player, enemy, action),
  );
  return enemy.intentView;
}

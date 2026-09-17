import * as Core from "./engine-core.js";
import { CARDS, ITEMS } from "./data.js";
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

export * from "./engine-core.js";
export * from "./enemy-intent.js";

export function cost(s, card) {
  return signatureCost(Core, ITEMS, s, card);
}

export function cardPlayBlockReason(s, card) {
  return signatureCardPlayBlockReason(Core, ITEMS, s, card);
}

export function canPlay(s, card) {
  return signatureCanPlay(Core, ITEMS, s, card);
}

export function play(s, index, meta) {
  const result = playWithSignatureRelics({
    Core,
    items: ITEMS,
    state: s,
    index,
    meta,
    playBase(core, state, cardIndex, runMeta) {
      return playWithStagedAugments(core, CARDS, ITEMS, state, cardIndex, runMeta);
    },
  });
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
    roomBefore = s ? Core.roomAt(s) : null,
    deckBefore = new Set(s?.deck || []),
    result = withEssenceHeartHealing(Core, ITEMS, s, () => Core.enter(s, meta));

  if (["gather", "golden"].includes(roomBefore) && s?.phase === "chest") {
    const duplicatedCard = s.deck?.find((card) => !deckBefore.has(card));
    if (duplicatedCard) {
      s._roomRelicFeedback = {
        type: "cardDuplicate",
        relicId: "relic_mirror_of_duplication",
        node: s.node,
        card: structuredClone(duplicatedCard),
      };
    }
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
  const result = withEssenceHeartHealing(Core, ITEMS, s, () =>
    withPreparedNextTurn(s, () => Core.executePlayerTurnEnd(s, meta)),
  );
  if (result && s?.phase === "battle") refreshEnemyPatternPhaseIntents(s);
  return result;
}

export function executeSingleEnemyAction(s, enemyIndex, meta) {
  const b = s?.battle,
    enemy = b?.enemies?.[enemyIndex];
  refreshEnemyPatternPhaseIntents(s);
  const intent = enemy?.intent ? structuredClone(enemy.intent) : {},
    discardImpuritiesBefore = impurityCount(b?.discard),
    outcome = withEssenceHeartHealing(Core, ITEMS, s, () =>
      Core.executeSingleEnemyAction(s, enemyIndex, meta),
    );

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
  return withEssenceHeartHealing(Core, ITEMS, s, () =>
    withPreparedNextTurn(s, () => Core.executeRoundEnd(s, meta)),
  );
}

export function endTurn(s, meta) {
  return withEssenceHeartHealing(Core, ITEMS, s, () =>
    withPreparedNextTurn(s, () => {
      if (!Core.executePlayerTurnEnd(s, meta)) return false;
      refreshEnemyPatternPhaseIntents(s);
      for (let index = 0; index < (s.battle?.enemies?.length || 0); index++) {
        const b = s?.battle,
          enemy = b?.enemies?.[index];
        refreshEnemyPatternPhaseIntents(s);
        const intent = enemy?.intent ? structuredClone(enemy.intent) : {},
          discardImpuritiesBefore = impurityCount(b?.discard),
          outcome = Core.executeSingleEnemyAction(s, index, meta);
        if (enemy) commitEnemyPatternPlan(enemy);
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
  );
}

export function potion(s) {
  return signaturePotion(Core, ITEMS, s);
}

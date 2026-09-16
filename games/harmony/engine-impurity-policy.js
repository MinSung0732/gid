import * as Core from "./engine-core.js";
import {
  extractRecentImpurities,
  impurityInjectionConfig,
  placeImpurities,
} from "./impurity-injection.js";

export function impurityCount(cards) {
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

export function applyEnemyImpurityPolicy(
  s,
  enemy,
  intent,
  discardImpuritiesBefore,
  outcome,
) {
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

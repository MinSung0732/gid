import {
  CARD_EFFECT_UI,
  createCardPresentation as createBaseCardPresentation,
} from "./card-presentation-base.js?v=20260920-1";
import { applyCardCopyPolicy } from "./card-copy-policy.js";
import { applyCardCopyOverrides } from "./card-copy-overrides.js";

export { CARD_EFFECT_UI };

// Delegation contract: the base renderer owns compactCardEffectSummary(card, comparisonCard),
// while the copy policy preserves the card-summary-row-upgraded comparison marker.
export function createCardPresentation(options) {
  const base = createBaseCardPresentation(options),
    policy = applyCardCopyPolicy(options, base);
  return applyCardCopyOverrides(options, policy);
}

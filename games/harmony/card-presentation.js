import {
  CARD_EFFECT_UI,
  createCardPresentation as createBaseCardPresentation,
} from "./card-presentation-base.js";
import { applyCardCopyPolicy } from "./card-copy-policy.js";
import { applyCardCopyOverrides } from "./card-copy-overrides.js";

export { CARD_EFFECT_UI };

export function createCardPresentation(options) {
  const base = createBaseCardPresentation(options),
    policy = applyCardCopyPolicy(options, base);
  return applyCardCopyOverrides(options, policy);
}

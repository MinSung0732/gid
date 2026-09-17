import {
  CARD_EFFECT_UI,
  createCardPresentation as createBaseCardPresentation,
} from "./card-presentation-base.js";
import { applyCardCopyPolicy } from "./card-copy-policy.js";

export { CARD_EFFECT_UI };

export function createCardPresentation(options) {
  return applyCardCopyPolicy(options, createBaseCardPresentation(options));
}

import * as E from "./engine.js";

export const LAB_REMOVE_BASE_PRICE = 20;
export const POTION_BASE_PRICE = 25;

export function labRemovePrice(run) {
  if (!run) return LAB_REMOVE_BASE_PRICE;
  return Math.max(0, LAB_REMOVE_BASE_PRICE - E.power(run, "labCostDiscount"));
}

export function shopQuote(run, basePrice, type = "all") {
  const normalizedBase = Math.max(0, Number(basePrice) || 0),
    price = run ? E.shopPrice(run, normalizedBase, type) : normalizedBase;
  return Object.freeze({
    basePrice: normalizedBase,
    price,
    changed: price !== normalizedBase,
    discounted: price < normalizedBase,
    markedUp: price > normalizedBase,
    difference: price - normalizedBase,
    type,
  });
}

export function economyModifiers(run) {
  if (!run) return Object.freeze({});
  return Object.freeze({
    labDiscount: E.power(run, "labCostDiscount"),
    shopCardDiscount: E.power(run, "shopCardDiscount"),
    shopAllDiscount: E.power(run, "shopAllDiscount"),
    shopPriceMultiplier: E.power(run, "shopPriceMultiplier"),
    shopCostTriple: E.power(run, "shopCostTriple"),
  });
}

export function shopModifierLabels(run) {
  const modifiers = economyModifiers(run), labels = [];
  if (modifiers.shopCostTriple > 0)
    labels.push(`전체 가격 ×${modifiers.shopCostTriple}`);
  else if (modifiers.shopPriceMultiplier !== 0)
    labels.push(`전체 가격 ${modifiers.shopPriceMultiplier > 0 ? "+" : ""}${Math.round(modifiers.shopPriceMultiplier * 100)}%`);
  if (modifiers.shopAllDiscount > 0)
    labels.push(`전체 할인 -${Math.round(modifiers.shopAllDiscount * 100)}%`);
  if (modifiers.shopCardDiscount > 0)
    labels.push(`카드 추가 할인 -${modifiers.shopCardDiscount}G`);
  return labels;
}

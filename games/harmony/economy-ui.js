import { loadGame } from "./persistence.js";
import * as E from "./engine.js";
import {
  LAB_REMOVE_BASE_PRICE,
  POTION_BASE_PRICE,
  labRemovePrice,
  shopModifierLabels,
  shopQuote,
} from "./economy-pricing.js";

let lastRun = null;

function setHtml(element, html) {
  if (element && element.innerHTML !== html) element.innerHTML = html;
}

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

function setDisabled(element, disabled) {
  if (element && element.disabled !== Boolean(disabled)) element.disabled = Boolean(disabled);
}

function priceMarkup(basePrice, price, unit = "G") {
  const base = `${basePrice}${unit}`,
    effective = price === 0 ? "무료" : `${price}${unit}`;
  if (basePrice === price) return `<span class="economy-price economy-price-plain">${effective}</span>`;
  const direction = price < basePrice ? "discount" : "markup";
  return `<span class="economy-price economy-price-${direction}"><del>${base}</del><strong>${effective}</strong></span>`;
}

function syncLab(run) {
  if (!run || run.phase !== "lab") return;
  const price = labRemovePrice(run),
    blocked = run.deck.length <= 5 || run.gold < price,
    trigger = document.querySelector('[data-special-deck-picker="remove"]');

  if (trigger) {
    const title = trigger.querySelector("b"),
      detail = trigger.querySelector("small");
    setHtml(title, `용매 세척 · ${priceMarkup(LAB_REMOVE_BASE_PRICE, price)}`);
    const discount = LAB_REMOVE_BASE_PRICE - price;
    setText(
      detail,
      discount > 0
        ? `내 덱 보기 → · 카드 1장 영구 제거 · 유물 할인 ${discount}G 적용`
        : "내 덱 보기 → · 카드 1장 영구 제거",
    );
    setDisabled(trigger, blocked);
    trigger.dataset.effectivePrice = String(price);
  }

  document
    .querySelectorAll('#special-deck-picker [data-special-deck-action="remove"]')
    .forEach((button) => {
      setText(button, price === 0 ? "무료 · 영구 제거" : `${price}G · 영구 제거`);
      setDisabled(button, blocked);
      button.dataset.effectivePrice = String(price);
    });

  const selectedRemoveAction = document.querySelector(
    '#special-deck-picker .deck-card-picker-item.is-selected [data-special-deck-action="remove"]',
  );
  if (selectedRemoveAction) {
    const proxy = document.querySelector(
      '#special-deck-picker [data-card-picker-proxy-action="0"]',
    );
    if (proxy) {
      setText(proxy, selectedRemoveAction.textContent.trim());
      setDisabled(proxy, selectedRemoveAction.disabled);
      proxy.dataset.effectivePrice = String(price);
    }
  }
}

function syncShop(run) {
  if (!run || run.phase !== "shop") return;
  const potionButton = document.querySelector('[data-action="buy"]'),
    room = potionButton?.closest(".room") || document.querySelector(".room");

  if (potionButton) {
    const quote = shopQuote(run, POTION_BASE_PRICE, "potion"),
      blocked = run.gold < quote.price || run.potions >= E.potionLimit(run);
    setHtml(
      potionButton,
      `회복약 구매 · ${priceMarkup(quote.basePrice, quote.price)} <span class="economy-stock">(${run.potions}/${E.potionLimit(run)})</span>`,
    );
    setDisabled(potionButton, blocked);
    potionButton.dataset.effectivePrice = String(quote.price);
  }

  document.querySelectorAll('[data-action="shop-offer"][data-index]').forEach((button) => {
    const index = Number(button.dataset.index),
      offer = Number.isInteger(index) ? run.shopOffers?.[index] : null;
    if (!offer || !Number.isFinite(offer.basePrice)) return;
    if (offer.sold) {
      setText(button, "판매 완료");
      return;
    }
    const quote = shopQuote(run, offer.basePrice, offer.type);
    setHtml(button, `구매 · ${priceMarkup(quote.basePrice, quote.price)}`);
    button.dataset.effectivePrice = String(quote.price);
    if (run.gold < quote.price) setDisabled(button, true);
  });

  if (room) {
    const labels = shopModifierLabels(run);
    let summary = room.querySelector(":scope > .economy-modifier-summary");
    if (!labels.length) {
      summary?.remove();
      return;
    }
    if (!summary) {
      summary = document.createElement("aside");
      summary.className = "economy-modifier-summary";
      const firstShopButton = room.querySelector('[data-action="buy"]');
      if (firstShopButton) room.insertBefore(summary, firstShopButton);
      else room.append(summary);
    }
    const markup = `<span>현재 가격 보정</span>${labels.map((label) => `<b>${label}</b>`).join("")}`;
    setHtml(summary, markup);
  }
}

export function syncEconomyUi(run) {
  lastRun = run || null;
  if (!lastRun) return;
  syncLab(lastRun);
  syncShop(lastRun);
}

// The special deck picker is created outside the normal #app render pass.
// Refresh only when that interaction actually opens/changes the picker.
document.addEventListener(
  "click",
  (event) => {
    if (!event.target.closest?.("[data-special-deck-picker], [data-card-picker-proxy-action]")) return;
    queueMicrotask(() => syncEconomyUi(lastRun));
  },
  true,
);

document.addEventListener(
  "change",
  (event) => {
    if (!event.target.closest?.("#special-deck-picker")) return;
    queueMicrotask(() => syncEconomyUi(lastRun));
  },
  true,
);

window.addEventListener("storage", () => {
  try {
    syncEconomyUi(loadGame(localStorage).run);
  } catch {
    // Main save recovery owns malformed storage handling.
  }
});

import * as E from "./engine.js?v=20260913-22";
import { CARDS } from "./data.js?v=20260917-2";

const app = document.getElementById("app");
const STATUS_BADGE_SELECTOR = ".player-effects-side .status-chip, .enemy .status-chip";
const PLAYER_PANEL_STATUS_SELECTOR = ".player-core-status-list .status-chip";
const PLAYER_HELP_SELECTOR = "[data-player-help]";
const SYNERGY_HELP_SELECTOR = "[data-synergy-tip-name]";
const TOOLTIP_TRIGGER_SELECTOR = `${STATUS_BADGE_SELECTOR}, ${PLAYER_PANEL_STATUS_SELECTOR}, ${PLAYER_HELP_SELECTOR}, ${SYNERGY_HELP_SELECTOR}`;
let statusTooltip = null;
const CARD_ID_BY_NAME = new Map(
  Object.entries(CARDS).map(([id, card]) => [card.name, id]),
);

function potionHealPreview(run) {
  const base = 20;
  if (!run) return `기본 회복 ${base}`;

  const flat = E.power(run, "incomingHeal"),
    aura = E.synergyPower(run, "chamomileAura");
  let total = base;
  if (total) total += flat;
  if (total > 0) total = Math.round(total * (1 + aura));

  const missing = Math.max(0, run.maxHp - run.hp),
    restored = Math.max(0, Math.min(total, missing)),
    parts = [`기본 ${base}`];

  if (flat) parts.push(`증강·유물 ${flat > 0 ? "+" : ""}${flat}`);
  if (aura)
    parts.push(`조합 효과 ${aura > 0 ? "+" : ""}${Math.round(aura * 100)}%`);

  return `사용 시 체력 +${restored}${restored !== total ? ` · 최종 회복력 ${total}` : ""} · ${parts.join(" · ")}`;
}

function compactPotion(side, run) {
  const button = side.querySelector(".battle-potion");
  if (!button) return;

  const label = button.querySelector(":scope > span");
  if (label && label.dataset.supportCompacted !== "1") {
    const count = label.querySelector("b")?.textContent?.trim();
    if (count !== undefined) {
      label.innerHTML = `✚ <b>${count}</b>`;
      label.dataset.supportCompacted = "1";
    }
  }

  const description = potionHealPreview(run);
  if (button.dataset.healTip !== description) button.dataset.healTip = description;
  if (button.getAttribute("aria-description") !== description)
    button.setAttribute("aria-description", description);
}

function statusNameFromLabel(label) {
  return label.replace(/\s+\d+(?:\s*·\s*\d+턴)?\s*$/, "").trim();
}

function prepareStatusTooltip(chip, compact = false) {
  if (chip.dataset.statusTipReady === "1") return;

  const label = chip.querySelector(":scope > b"),
    tip = chip.querySelector(":scope > .term-tip");
  if (!label) return;

  const original = label.textContent.trim(),
    statusName = statusNameFromLabel(original),
    detail = (tip?.innerText || tip?.textContent || original).replace(/\s+/g, " ").trim(),
    turns = detail.match(/남은\s*(\d+)\s*\/\s*최대\s*(\d+)\s*턴/),
    stacks = detail.match(/현재\s*(\d+)\s*\/\s*최대\s*(\d+)\s*중첩/),
    simpleTurns = original.match(/·\s*(\d+)턴/),
    simpleStacks = original.match(/\s(\d+)(?:\s|$)/);

  if (compact) {
    let compactLabel = "";
    if (turns) compactLabel = `${turns[1]}턴`;
    else if (stacks) compactLabel = `${stacks[1]}/${stacks[2]}`;
    else if (simpleTurns) compactLabel = `${simpleTurns[1]}턴`;
    else if (simpleStacks) compactLabel = simpleStacks[1];
    label.textContent = compactLabel;
    chip.dataset.supportCompacted = "1";
  }

  chip.dataset.statusTipReady = "1";
  chip.removeAttribute("data-term");
  chip.removeAttribute("aria-expanded");
  chip.removeAttribute("title");
  chip.dataset.statusTipName = statusName || original;
  chip.dataset.statusTipBody = detail;
  chip.setAttribute("aria-label", `${statusName || original}. ${detail}`);
  tip?.remove();
}

function compactStatus(chip) {
  prepareStatusTooltip(chip, true);
}

function syncHandApAvailability(run) {
  if (!run?.battle || run.phase !== "battle") return;

  for (const button of app.querySelectorAll('.hand > .card[data-action="play"]')) {
    const index = Number(button.dataset.index),
      card = Number.isInteger(index) ? run.battle.hand[index] : null,
      apValue = button.querySelector(".card-ap-value");
    if (!card || !apValue) continue;

    const cost = E.cost(run, card),
      playable = E.canPlay(run, card),
      available = playable && run.battle.ap >= cost;

    if (apValue.textContent !== String(cost)) apValue.textContent = String(cost);
    apValue.classList.toggle("card-ap-available", available);
    apValue.classList.toggle("card-ap-unavailable", !available);

    button.disabled = false;
    if (available) button.removeAttribute("aria-disabled");
    else button.setAttribute("aria-disabled", "true");
  }
}

function cardIdentity(card) {
  const title = card.querySelector(":scope > strong")?.textContent?.trim();
  if (!title) return null;
  const match = title.match(/^(.*?)(?:\s+\+(\d+))?$/),
    name = match?.[1]?.trim(),
    level = Number(match?.[2] || 0),
    id = CARD_ID_BY_NAME.get(name);
  return id ? { id, level } : null;
}

function syncOutOfCombatCardCosts(run) {
  if (!app || !run || run.phase === "battle") return;

  for (const card of app.querySelectorAll(".card")) {
    if (card.closest(".hand")) continue;
    const value = card.querySelector(".card-ap-value"),
      identity = cardIdentity(card);
    if (!value || !identity) continue;

    const definition = E.cardDefinition(identity),
      cost = Number(definition?.cost);
    if (!Number.isFinite(cost)) continue;

    if (value.textContent !== String(cost)) value.textContent = String(cost);
    value.classList.remove("card-ap-available", "card-ap-unavailable");
  }
}

function ensureStatusTooltip() {
  if (statusTooltip?.isConnected) return statusTooltip;
  statusTooltip = document.createElement("div");
  statusTooltip.className = "player-status-tooltip";
  statusTooltip.setAttribute("role", "tooltip");
  statusTooltip.hidden = true;
  document.body.append(statusTooltip);
  return statusTooltip;
}

function tooltipCopy(trigger) {
  if (trigger?.dataset.statusTipName)
    return {
      title: trigger.dataset.statusTipName,
      body: trigger.dataset.statusTipBody || "",
    };
  if (trigger?.dataset.playerHelpTitle)
    return {
      title: trigger.dataset.playerHelpTitle,
      body: trigger.dataset.playerHelpBody || "",
    };
  if (trigger?.dataset.synergyTipName)
    return {
      title: trigger.dataset.synergyTipName,
      body: trigger.dataset.synergyTipBody || "",
    };
  return null;
}

function showStatusTooltip(trigger) {
  const copy = tooltipCopy(trigger);
  if (!copy) return;
  const tooltip = ensureStatusTooltip(),
    title = document.createElement("strong"),
    body = document.createElement("span");
  title.textContent = copy.title;
  body.textContent = copy.body;
  tooltip.replaceChildren(title, body);
  tooltip.hidden = false;

  const rect = trigger.getBoundingClientRect(),
    horizontalAnchor = trigger.closest?.(".player-core-panel")?.getBoundingClientRect() || rect,
    bounds = tooltip.getBoundingClientRect(),
    gap = 8,
    right = horizontalAnchor.right + gap,
    left = right + bounds.width <= window.innerWidth - gap
      ? right
      : Math.max(gap, horizontalAnchor.left - bounds.width - gap),
    below = rect.bottom + gap,
    above = rect.top - bounds.height - gap,
    top = below + bounds.height <= window.innerHeight - gap
      ? below
      : above >= gap
        ? above
        : Math.max(gap, Math.min(below, window.innerHeight - bounds.height - gap));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideStatusTooltip() {
  if (statusTooltip) statusTooltip.hidden = true;
}

function enhanceStatusBadges() {
  app?.querySelectorAll(".enemy .status-chip").forEach(compactStatus);
  app?.querySelectorAll(".player-core-status-list .status-chip").forEach((chip) =>
    prepareStatusTooltip(chip, false),
  );
}

export function syncPlayerSupportUi(run) {
  if (!app) return;

  syncHandApAvailability(run);
  syncOutOfCombatCardCosts(run);
  enhanceStatusBadges();

  const side = app.querySelector(".player-effects-side");
  if (!side) return;

  const list = side.querySelector(".status-list");
  if (list && !side.querySelector(".player-status-heading")) {
    const heading = document.createElement("div");
    heading.className = "player-status-heading";
    heading.textContent = "내 상태 정보";
    heading.setAttribute("aria-hidden", "true");
    side.insertBefore(heading, list);
  }

  compactPotion(side, run);
  list?.querySelectorAll(":scope > .status-chip").forEach(compactStatus);
}

if (app) {
  // Tooltip/click delegation is interaction behavior, not render-time DOM repair.
  app.addEventListener(
    "click",
    (event) => {
      if (!event.target.closest?.(".enemy .status-chip")) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  app.addEventListener("pointerover", (event) => {
    const trigger = event.target.closest?.(TOOLTIP_TRIGGER_SELECTOR);
    if (trigger) showStatusTooltip(trigger);
  });
  app.addEventListener("pointerout", (event) => {
    const trigger = event.target.closest?.(TOOLTIP_TRIGGER_SELECTOR);
    if (trigger && !trigger.contains(event.relatedTarget)) hideStatusTooltip();
  });
  app.addEventListener("focusin", (event) => {
    const trigger = event.target.closest?.(TOOLTIP_TRIGGER_SELECTOR);
    if (trigger) showStatusTooltip(trigger);
  });
  app.addEventListener("focusout", (event) => {
    if (event.target.closest?.(TOOLTIP_TRIGGER_SELECTOR)) hideStatusTooltip();
  });
}

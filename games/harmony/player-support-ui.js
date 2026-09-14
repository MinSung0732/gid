import * as E from "./engine.js?v=20260913-22";
import { loadGame } from "./persistence.js";

const app = document.getElementById("app");
let statusTooltip = null;

function currentRun() {
  try {
    return loadGame(localStorage).run;
  } catch {
    return null;
  }
}

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

  if (flat)
    parts.push(`증강·유물 ${flat > 0 ? "+" : ""}${flat}`);
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
  if (button.dataset.healTip !== description)
    button.dataset.healTip = description;
  if (button.getAttribute("aria-description") !== description)
    button.setAttribute("aria-description", description);
}

function statusNameFromLabel(label) {
  return label
    .replace(/\s+\d+(?:\s*·\s*\d+턴)?\s*$/, "")
    .trim();
}

function compactStatus(chip) {
  if (chip.dataset.supportCompacted === "1") return;

  const label = chip.querySelector(":scope > b"),
    tip = chip.querySelector(":scope > .term-tip");
  if (!label) return;

  chip.dataset.supportCompacted = "1";
  const original = label.textContent.trim(),
    statusName = statusNameFromLabel(original),
    detail = (tip?.textContent || original).replace(/\s+/g, " ").trim(),
    turns = detail.match(/남은\s*(\d+)\s*\/\s*최대\s*(\d+)\s*턴/),
    stacks = detail.match(/현재\s*(\d+)\s*\/\s*최대\s*(\d+)\s*중첩/),
    simpleTurns = original.match(/·\s*(\d+)턴/),
    simpleStacks = original.match(/\s(\d+)(?:\s|$)/);

  let compact = "";
  if (turns) compact = `${turns[1]}턴`;
  else if (stacks) compact = `${stacks[1]}/${stacks[2]}`;
  else if (simpleTurns) compact = `${simpleTurns[1]}턴`;
  else if (simpleStacks) compact = simpleStacks[1];

  label.textContent = compact;
  chip.removeAttribute("data-term");
  chip.removeAttribute("aria-expanded");
  chip.removeAttribute("title");
  chip.dataset.statusTipName = statusName || original;
  chip.dataset.statusTipBody = detail;
  chip.setAttribute("aria-label", `${statusName || original}. ${detail}`);
  tip?.remove();
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

function showStatusTooltip(chip) {
  if (!chip?.dataset.statusTipName) return;
  const tooltip = ensureStatusTooltip(),
    title = document.createElement("strong"),
    body = document.createElement("span");
  title.textContent = chip.dataset.statusTipName;
  body.textContent = chip.dataset.statusTipBody || "";
  tooltip.replaceChildren(title, body);
  tooltip.hidden = false;

  const rect = chip.getBoundingClientRect(),
    bounds = tooltip.getBoundingClientRect(),
    gap = 8,
    preferredRight = rect.right + gap,
    left = preferredRight + bounds.width <= window.innerWidth - gap
      ? preferredRight
      : Math.max(gap, rect.left - bounds.width - gap),
    top = Math.max(
      gap,
      Math.min(rect.top + rect.height / 2 - bounds.height / 2, window.innerHeight - bounds.height - gap),
    );
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideStatusTooltip() {
  if (statusTooltip) statusTooltip.hidden = true;
}

function enhanceSidebar() {
  if (!app) return;
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

  const run = currentRun();
  compactPotion(side, run);
  list?.querySelectorAll(":scope > .status-chip").forEach(compactStatus);
}

let scheduled = false;
function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    enhanceSidebar();
  });
}

if (app) {
  app.addEventListener("pointerover", (event) => {
    const chip = event.target.closest?.(".player-effects-side .status-chip");
    if (chip) showStatusTooltip(chip);
  });
  app.addEventListener("pointerout", (event) => {
    const chip = event.target.closest?.(".player-effects-side .status-chip");
    if (chip && !chip.contains(event.relatedTarget)) hideStatusTooltip();
  });
  app.addEventListener("focusin", (event) => {
    const chip = event.target.closest?.(".player-effects-side .status-chip");
    if (chip) showStatusTooltip(chip);
  });
  app.addEventListener("focusout", (event) => {
    if (event.target.closest?.(".player-effects-side .status-chip"))
      hideStatusTooltip();
  });

  new MutationObserver(scheduleEnhance).observe(app, {
    childList: true,
    subtree: true,
  });
  scheduleEnhance();
}

import * as E from "./engine.js?v=20260913-22";
import { loadGame } from "./persistence.js";

const app = document.getElementById("app");

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

  const count = button.querySelector("b")?.textContent?.trim(),
    label = button.querySelector(":scope > span");
  if (label && count !== undefined)
    label.innerHTML = `✚ <b>${count}</b>`;

  const description = potionHealPreview(run);
  button.dataset.healTip = description;
  button.setAttribute("aria-description", description);
}

function compactStatus(chip) {
  if (chip.dataset.supportCompacted === "1") return;

  const label = chip.querySelector(":scope > b"),
    tip = chip.querySelector(":scope > .term-tip");
  if (!label) return;

  const original = label.textContent.trim(),
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
  chip.dataset.supportCompacted = "1";
  chip.removeAttribute("data-term");
  chip.title = detail;
  chip.setAttribute("aria-label", `${original}. ${detail}`);
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
  new MutationObserver(scheduleEnhance).observe(app, {
    childList: true,
    subtree: true,
  });
  scheduleEnhance();
}

import { loadGame } from "./persistence.js";

const app = document.getElementById("app");
let enhancementQueued = false;

function number(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value) || 0);
}

function currentRun() {
  try {
    return loadGame(localStorage)?.run || null;
  } catch {
    return null;
  }
}

function metric(label, value, className = "") {
  return `<div class="run-hud-metric ${className}"><small>${label}</small><strong>${value}</strong></div>`;
}

function enhanceRunFrame() {
  enhancementQueued = false;
  if (!app) return;

  const hud = app.querySelector(":scope > .hud"),
    route = app.querySelector(":scope > .route"),
    playLayout = app.querySelector(":scope > .play-layout");

  document.body.classList.toggle("harmony-stage-active", Boolean(hud && route && playLayout));
  if (!hud || !route || !playLayout || hud.dataset.pcFrameEnhanced === "true") return;

  const run = currentRun();
  if (!run) return;

  const originalContext = hud.querySelector(":scope > div:first-child small")?.textContent?.trim() || "RUN",
    logButton = hud.querySelector("[data-log-open]"),
    homeButton = hud.querySelector('[data-action="home"]'),
    healthPercent = Math.max(0, Math.min(100, (run.hp / Math.max(1, run.maxHp)) * 100)),
    actLabel = originalContext.split("·")[0]?.trim() || "ACT",
    room = Math.max(1, Number(run.node || 0) + 1);

  hud.dataset.pcFrameEnhanced = "true";
  hud.classList.add("run-hud-enhanced");
  hud.replaceChildren();

  const progress = document.createElement("div");
  progress.className = "run-hud-progress";
  progress.innerHTML = `<small>RUN</small><strong>${actLabel}</strong><span>ROOM ${String(room).padStart(2, "0")} / 12</span>`;

  const health = document.createElement("div");
  health.className = "run-hud-health";
  health.innerHTML = `<span><small>HP</small><strong>${run.hp} <em>/ ${run.maxHp}</em></strong></span><div class="run-hud-health-track" role="progressbar" aria-label="현재 체력" aria-valuemin="0" aria-valuemax="${run.maxHp}" aria-valuenow="${run.hp}"><i style="width:${healthPercent}%"></i></div>`;

  const resources = document.createElement("div");
  resources.className = "run-hud-resources";
  resources.innerHTML = [
    metric("GOLD", `${number(run.gold)} G`, "run-hud-gold"),
    metric("POTION", `✚ ${number(run.potions)}`, "run-hud-potion"),
    metric("SCORE", number(run.score), "run-hud-score"),
  ].join("");

  const actions = document.createElement("div");
  actions.className = "run-hud-actions";
  if (logButton) {
    logButton.classList.add("run-hud-action");
    actions.append(logButton);
  }
  if (homeButton) {
    homeButton.classList.add("run-hud-action");
    actions.append(homeButton);
  }

  hud.append(progress, health, resources, actions);

  route.setAttribute("aria-label", "12개 방 진행 상황");
  [...route.children].forEach((node, index) => {
    const label = node.querySelector("small");
    if (label) label.textContent = String(index + 1).padStart(2, "0");
    node.setAttribute("aria-current", node.classList.contains("current") ? "step" : "false");
  });
}

function scheduleEnhancement() {
  if (enhancementQueued) return;
  enhancementQueued = true;
  requestAnimationFrame(enhanceRunFrame);
}

if (app) {
  new MutationObserver(scheduleEnhancement).observe(app, { childList: true, subtree: false });
  scheduleEnhancement();
}

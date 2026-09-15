import { loadGame } from "./persistence.js";
import { polishBattleUi } from "./combat-layout-phase2-finish.js?v=20260915-4";
import { syncHarmonyUi } from "./harmony-core-ui.js?v=20260915-2";
import { syncPlayerSupportUi } from "./player-support-ui.js?v=20260915-2";
import { syncCardDetails } from "./card-detail-dedupe.js?v=20260915-4";
import { syncImpurityUi } from "./impurity-ui.js?v=20260915-5";
import { syncEconomyUi } from "./economy-ui.js?v=20260915-2";
import { queueHandSync } from "./hand-swipe-fix.js?v=20260915-5";

const app = document.getElementById("app"),
  desktop = window.matchMedia("(min-width: 901px)"),
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const metrics = {
  observerCallbacks: 0,
  finalizerRuns: 0,
  stateLoads: 0,
};
const animationDiagnostics = {
  reducedMotion: reducedMotion.matches,
  reward: null,
  upgrade: null,
};
const REWARD_ANIMATIONS = new Set(["reward-flip-in", "reward-rarity-glow"]);
const UPGRADE_ANIMATIONS = new Set([
  "rest-upgrade-result-reveal",
  "rest-upgrade-glow",
  "rest-upgrade-spark",
  "rest-upgrade-copy-in",
]);

function number(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value) || 0);
}

function currentRun() {
  metrics.stateLoads += 1;
  try {
    return loadGame(localStorage)?.run || null;
  } catch {
    return null;
  }
}

function parseNumbers(text = "") {
  return [...String(text).matchAll(/-?\d[\d,]*/g)].map((match) =>
    Number(match[0].replaceAll(",", "")),
  );
}

function metric(label, value, className = "") {
  return `<div class="run-hud-metric ${className}"><small>${label}</small><strong>${value}</strong></div>`;
}

function enhanceRunFrame(run) {
  if (!app || !desktop.matches) {
    document.body.classList.remove("harmony-stage-active");
    return;
  }

  const hud = app.querySelector(":scope > .hud"),
    route = app.querySelector(":scope > .route"),
    playLayout = app.querySelector(":scope > .play-layout");

  document.body.classList.toggle("harmony-stage-active", Boolean(hud && route && playLayout));
  if (!hud || !route || !playLayout || !run || hud.dataset.pcFrameEnhanced === "true") return;

  const originalContext = hud.querySelector(":scope > div:first-child small")?.textContent?.trim() || "RUN",
    originalScore = parseNumbers(hud.querySelector(".hud-score strong")?.textContent)[0],
    liveHealth = parseNumbers(playLayout.querySelector(".health-stat > b")?.textContent),
    liveGold = parseNumbers(playLayout.querySelector(".gold-stat > b")?.textContent)[0],
    livePotion = parseNumbers(playLayout.querySelector(".battle-potion b")?.textContent)[0],
    logButton = hud.querySelector("[data-log-open]"),
    homeButton = hud.querySelector('[data-action="home"]'),
    hp = Number.isFinite(liveHealth[0]) ? liveHealth[0] : run.hp,
    maxHp = Number.isFinite(liveHealth[1]) ? liveHealth[1] : run.maxHp,
    gold = Number.isFinite(liveGold) ? liveGold : run.gold,
    potions = Number.isFinite(livePotion) ? livePotion : run.potions,
    score = Number.isFinite(originalScore) ? originalScore : run.score,
    healthPercent = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100)),
    actLabel = originalContext.split("·")[0]?.trim() || "ACT",
    currentRouteIndex = [...route.children].findIndex((node) => node.classList.contains("current")),
    room = currentRouteIndex >= 0 ? currentRouteIndex + 1 : Math.max(1, Number(run.node || 0) + 1);

  hud.dataset.pcFrameEnhanced = "true";
  hud.classList.add("run-hud-enhanced");
  hud.replaceChildren();

  const progress = document.createElement("div");
  progress.className = "run-hud-progress";
  progress.innerHTML = `<small>RUN</small><strong>${actLabel}</strong><span>ROOM ${String(room).padStart(2, "0")} / 12</span>`;

  const health = document.createElement("div");
  health.className = "run-hud-health";
  health.innerHTML = `<span><small>HP</small><strong>${hp} <em>/ ${maxHp}</em></strong></span><div class="run-hud-health-track" role="progressbar" aria-label="현재 체력" aria-valuemin="0" aria-valuemax="${maxHp}" aria-valuenow="${hp}"><i style="width:${healthPercent}%"></i></div>`;

  const resources = document.createElement("div");
  resources.className = "run-hud-resources";
  resources.innerHTML = [
    metric("GOLD", `${number(gold)} G`, "run-hud-gold"),
    metric("POTION", `✚ ${number(potions)}`, "run-hud-potion"),
    metric("SCORE", number(score), "run-hud-score"),
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

function replayExistingAnimations(root, names, diagnosticKey) {
  if (!root || root.dataset.motionReplayDone === "1") return;
  root.dataset.motionReplayDone = "1";

  const computed = getComputedStyle(root);
  animationDiagnostics.reducedMotion = reducedMotion.matches;
  animationDiagnostics[diagnosticKey] = {
    animationName: computed.animationName,
    animationDuration: computed.animationDuration,
    replayed: [],
  };
  if (reducedMotion.matches) return;

  // The browser already created these CSSAnimation objects from styles.css.
  // Rewind and play those exact animations instead of defining replacement FX.
  requestAnimationFrame(() => {
    if (!root.isConnected) return;
    void root.offsetWidth;
    const animations = root.getAnimations({ subtree: true });
    for (const animation of animations) {
      if (!names.has(animation.animationName)) continue;
      try {
        animation.currentTime = 0;
        animation.play();
        animationDiagnostics[diagnosticKey].replayed.push(animation.animationName);
      } catch {
        // If an animation was replaced during the same render, leave the CSS owner alone.
      }
    }
  });
}

function replayLegacyUiAnimations(run) {
  if (!app) return;

  if (run?.phase === "reward") {
    const rewardItem = app.querySelector(".reward-item > .item");
    if (rewardItem) replayExistingAnimations(rewardItem, REWARD_ANIMATIONS, "reward");
  }

  const upgradeSuccess = app.querySelector(".rest-upgrade-success");
  if (upgradeSuccess)
    replayExistingAnimations(upgradeSuccess, UPGRADE_ANIMATIONS, "upgrade");
}

function finalizeRender() {
  metrics.finalizerRuns += 1;
  if (!app) return;

  const run = currentRun();
  window.HarmonyCurrentRenderRun = run;

  // Group DOM writes into one post-render pass. main.js remains the sole owner of
  // marquee measurement; hand overflow is the only extra layout read scheduled here.
  enhanceRunFrame(run);
  polishBattleUi();
  syncPlayerSupportUi(run);
  syncHarmonyUi(run);
  syncCardDetails(app);
  syncImpurityUi(run);
  syncEconomyUi(run);
  replayLegacyUiAnimations(run);
  queueHandSync();
}

if (app) {
  // main.js replaces #app's direct children on render. Observe only that boundary;
  // nested UI writes performed by the finalizer do not recursively retrigger it.
  new MutationObserver(() => {
    metrics.observerCallbacks += 1;
    finalizeRender();
  }).observe(app, {
    childList: true,
    subtree: false,
  });
  finalizeRender();
}

desktop.addEventListener?.("change", finalizeRender);
reducedMotion.addEventListener?.("change", () => {
  animationDiagnostics.reducedMotion = reducedMotion.matches;
});

window.HarmonyRenderStability = Object.freeze({
  snapshot: () => ({ ...metrics }),
  finalize: finalizeRender,
});
window.HarmonyAnimationDiagnostics = Object.freeze({
  snapshot: () => structuredClone(animationDiagnostics),
});

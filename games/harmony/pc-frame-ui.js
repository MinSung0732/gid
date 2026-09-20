import * as E from "./engine.js?v=20260920-balance-2";
import { CARDS, ITEMS, PLAYER_HELP, RARITIES, ROUTE } from "./data.js?v=20260920-balance-2";
import { PLAYER_BALANCE } from "./editor/index.js";
import { STATUS_DEFINITIONS } from "./statuses.js?v=20260911-4";
import { polishBattleUi } from "./combat-layout-phase2-finish.js?v=20260920-1";
import { syncHarmonyUi } from "./harmony-core-ui.js?v=20260915-2";
import { syncPlayerSupportUi } from "./player-support-ui.js?v=20260920-balance-2";
import { syncCardDetails } from "./card-detail-dedupe.js?v=20260915-4";
import { syncImpurityUi } from "./impurity-ui.js?v=20260915-6";
import { syncEconomyUi } from "./economy-ui.js?v=20260920-balance-2";
import { queueHandSync } from "./hand-swipe-fix.js?v=20260915-5";
import { renderPcRoute } from "./pc-route-ui.js?v=20260917-1";
import { syncRoomBackground } from "./room-background-ui.js?v=20260918-4";
import { analyzeBuild as analyzeSharedBuild } from "./build-analysis.js";

const app = document.getElementById("app"),
  desktop = window.matchMedia("(min-width: 901px)"),
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const metrics = {
  renderBoundaryRuns: 0,
  finalizerRuns: 0,
  observerCallbacks: 0,
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

let currentRenderRun = null;

function number(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value) || 0);
}

function parseNumbers(text = "") {
  return [...String(text).matchAll(/-?\d[\d,]*/g)].map((match) =>
    Number(match[0].replaceAll(",", "")),
  );
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function analyzeBuild(run) {
  return analyzeSharedBuild(run, {
    resolveCard: (held) => E.cardDefinition(held),
  });
}

function candidateReason(candidate) {
  return [candidate.label, candidate.detail, ...candidate.reasons].join(" · ");
}

function buildCoreMarkup(profile) {
  if (!profile.primary)
    return '<div class="build-empty"><strong>빌드 형성 중</strong><small>카드와 조향 원료를 모으면<br>주요 방향이 표시됩니다.</small></div>';

  const builds = [profile.primary, profile.secondary].filter(Boolean),
    state = profile.mode === "mixed"
      ? '<div class="build-mode build-mode-mixed">혼합형</div>'
      : "";
  return `${state}<div class="build-core-list">${builds
    .map(
      (candidate, index) =>
        `<div class="build-core-slot"><span class="build-slot-label">${index ? "보조 빌드" : "주 빌드"}</span><div class="build-core-card" title="${escapeHtml(candidateReason(candidate))}" aria-label="${escapeHtml(candidateReason(candidate))}"><span class="build-core-icon" aria-hidden="true">${candidate.icon}</span><span class="build-core-copy"><strong>${escapeHtml(candidate.label)}</strong><small>${escapeHtml(candidate.detail)}</small></span></div></div>`,
    )
    .join("")}</div>`;
}

function activeSynergyMarkup(profile) {
  const progress = profile.synergyProgress || [];
  if (!progress.length)
    return '<p class="build-compact-empty">세트 정보 없음</p>';
  return `<div class="active-synergy-list">${progress
    .map(
      (synergy) =>
        `<div class="active-synergy-row ${synergy.active ? "is-active" : "is-pending"}" data-synergy-tip-name="${escapeHtml(synergy.name)}" data-synergy-tip-body="${escapeHtml(synergy.description || "활성 시너지 효과")}" tabindex="0" aria-label="${escapeHtml(`${synergy.name}. ${synergy.ownedCount} / ${synergy.total}. ${synergy.description || "활성 시너지 효과"}`)}"><span aria-hidden="true">${synergy.active ? "✦" : "◇"}</span><strong>${escapeHtml(synergy.name)}</strong><b class="synergy-progress">${synergy.ownedCount} / ${synergy.total}</b></div>`,
    )
    .join("")}</div>`;
}
function itemCountRows(run, kind) {
  const counts = new Map();
  for (const id of run.inventory || []) {
    if (ITEMS[id]?.kind !== kind) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.entries()].map(([id, count]) => ({ id, count, item: ITEMS[id] }));
}

function itemSectionMarkup(title, icon, rows) {
  return `<section class="run-build-items-section"><div class="run-build-subhead"><span>${title}</span><b>${rows.length}</b></div>${rows.length
    ? rows
        .map(({ item, count }) => {
          const rarity = RARITIES[item.tier] || `T${item.tier}`;
          return `<div class="run-build-item tier-mark-${item.tier}"><i aria-hidden="true">${icon}</i><div><strong>${escapeHtml(item.name)}${count > 1 ? ` ×${count}` : ""}</strong><small><em>${escapeHtml(rarity)}</em>${item.description ? ` · ${escapeHtml(item.description)}` : ""}</small></div></div>`;
        })
        .join("")
    : '<p class="run-build-item-empty">없음</p>'}</section>`;
}

function acquiredPanelMarkup(run) {
  const profile = analyzeBuild(run),
    traits = itemCountRows(run, "trait"),
    relics = itemCountRows(run, "relic"),
    empty = !traits.length && !relics.length
      ? '<p class="run-build-acquired-empty">아직 획득한 특성이나 유물이 없습니다.</p>'
      : "";
  return `<section class="run-build-core" aria-label="Build Core"><h3>BUILD CORE</h3>${buildCoreMarkup(profile)}</section><section class="run-build-synergy" aria-label="활성 시너지"><h3>ACTIVE SYNERGY</h3>${activeSynergyMarkup(profile)}</section><div class="run-build-divider" aria-hidden="true"></div><div class="run-build-acquired acquired-list">${empty}${itemSectionMarkup("특성", "✦", traits)}${itemSectionMarkup("유물", "◇", relics)}</div>`;
}

function statusMarkup(run) {
  const entries = Object.entries(run?.statuses || {}).filter(
    ([id, status]) => STATUS_DEFINITIONS[id] && Number(status?.stacks) > 0,
  );
  if (!entries.length)
    return '<p class="player-status-empty">현재 적용 중인 상태 없음</p>';
  return `<div class="player-core-status-list">${entries
    .map(([id, status]) => {
      const definition = STATUS_DEFINITIONS[id],
        turns = status.turns ? ` · ${status.turns}턴` : "";
      return `<button type="button" class="status-chip status-${definition.kind}" data-term aria-expanded="false" style="--status-color:${definition.color}"><span>${definition.icon}</span><b>${escapeHtml(definition.name)} ${status.stacks}${turns}</b><span class="term-tip" role="tooltip">${escapeHtml(status.description || definition.description)}<br>현재 ${status.stacks} / 최대 ${definition.maxStacks}중첩${status.turns ? `<br>남은 ${status.turns} / 최대 ${definition.maxTurns}턴` : ""}</span></button>`;
    })
    .join("")}</div>`;
}

function impurityButtonBadge(run) {
  const countCards = (cards) =>
      Array.isArray(cards)
        ? cards.reduce((count, card) => count + (card?.id === "impurity" ? 1 : 0), 0)
        : 0,
    inBattle = run?.phase === "battle" && run.battle,
    shown = inBattle
      ? [run.battle.draw, run.battle.hand, run.battle.discard].reduce(
          (sum, pile) => sum + countCards(pile),
          0,
        )
      : countCards(run?.deck),
    pending = Math.max(0, Number(run?.pendingImpurities) || 0);
  if (!shown && !pending) return "";
  return `<span class="impurity-deck-button-badge phase5-impurity-badge" aria-hidden="true"><b>☣ ${shown}</b>${pending ? `<small>예정 +${pending}</small>` : ""}</span>`;
}

function playerHelpAttributes(key) {
  const help = PLAYER_HELP[key];
  if (!help) return "";
  const title = escapeHtml(help.label),
    body = escapeHtml(help.description);
  return ` data-player-help data-player-help-title="${title}" data-player-help-body="${body}" tabindex="0" aria-label="${title}. ${body}"`;
}

function playerPanelMarkup(run) {
  const attack = E.power(run, "attack"),
    defense = E.power(run, "defense"),
    draw = E.power(run, "draw"),
    augmentCardCount =
      (Array.isArray(run?.deck) ? run.deck.length : 0) +
      (Array.isArray(run?.inventory) ? run.inventory.length : 0),
    impurityBadge = impurityButtonBadge(run),
    stats = [
      ["⚔", "공격력", attack ? `${attack > 0 ? "+" : ""}${attack}` : "0", "attack"],
      ["◆", "방어력", defense ? `${defense > 0 ? "+" : ""}${defense}` : "0", "defense"],
      ["⚡", "AP 기본 / 상한", `${E.turnStartAp(run)} / ${E.apLimit(run)}`, "ap"],
      ["▤", "손패 한도", `${E.handLimit(run)}장`, "handLimit"],
      ["▦", "덱 한도", `${run.deck.length} / ${E.deckLimit(run)}장`, "deckLimit"],
      ["◇", "첫 턴 패", `${PLAYER_BALANCE.firstTurnDraw + draw}장`, "firstHand"],
      ["↻", "턴 드로우", `${PLAYER_BALANCE.turnDraw + draw}장`, "turnDraw"],
    ];
  return `<div class="stats-title"><span>MY HARMONY</span><strong>내 능력치</strong></div><div class="player-core-stats">${stats
    .map(
      ([icon, label, value, helpKey]) =>
        `<div class="player-core-stat"${playerHelpAttributes(helpKey)}><i>${icon}</i><span>${label}</span><b>${value}</b></div>`,
    )
    .join("")}</div><section class="player-core-status"><h3>현재 상태</h3>${statusMarkup(run)}</section><button type="button" class="player-run-summary${impurityBadge ? " has-impurity-count" : ""}" data-run-open><span>▤</span><strong>인벤토리</strong><small>증강카드 ${augmentCardCount}장</small>${impurityBadge}</button>`;
}

function hudMetric(label, value, className = "") {
  return `<div class="run-hud-metric ${className}"><small>${label}</small><strong>${value}</strong></div>`;
}

function transformRunMarkup(value, run) {
  if (
    !desktop.matches ||
    !run ||
    typeof value !== "string" ||
    !value.includes("play-layout")
  )
    return value;

  const template = document.createElement("template");
  template.innerHTML = value;
  const root = template.content,
    hud = root.querySelector(".hud"),
    route = root.querySelector(".route"),
    playLayout = root.querySelector(".play-layout"),
    player = playLayout?.querySelector(":scope > .player-stats"),
    acquired = playLayout?.querySelector(":scope > .acquired-panel");
  if (!hud || !route || !playLayout || !player || !acquired) return value;

  const danger = player.classList.contains("health-danger"),
    critical = player.classList.contains("health-critical"),
    originalContext =
      hud.querySelector(":scope > div:first-child small")?.textContent?.trim() || "RUN",
    originalScore = parseNumbers(hud.querySelector(".hud-score strong")?.textContent)[0],
    liveHealth = parseNumbers(player.querySelector(".health-stat > b")?.textContent),
    livePotion = parseNumbers(player.querySelector(".battle-potion b")?.textContent)[0],
    logButton = hud.querySelector("[data-log-open]"),
    homeButton = hud.querySelector('[data-action="home"]'),
    hp = Number.isFinite(liveHealth[0]) ? liveHealth[0] : Math.max(0, Number(run.hp) || 0),
    maxHp = Number.isFinite(liveHealth[1])
      ? Math.max(1, liveHealth[1])
      : Math.max(1, Number(run.maxHp) || 1),
    gold = Math.max(0, Number(run.gold) || 0),
    potions = Number.isFinite(livePotion) ? livePotion : Math.max(0, Number(run.potions) || 0),
    score = Number.isFinite(originalScore) ? originalScore : Math.max(0, Number(run.score) || 0),
    healthPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100)),
    currentRouteIndex = [...route.children].findIndex((node) =>
      node.classList.contains("current"),
    ),
    room =
      currentRouteIndex >= 0
        ? currentRouteIndex + 1
        : Math.max(1, Number(run.node || 0) + 1),
    actLabel = originalContext.split("·")[0]?.trim() || "ACT";

  hud.className = "hud run-hud-enhanced";
  hud.dataset.pcFrameEnhanced = "true";
  if (logButton) logButton.classList.add("run-hud-action");
  if (homeButton) homeButton.classList.add("run-hud-action");
  const actions = [logButton?.outerHTML, homeButton?.outerHTML].filter(Boolean).join("");
  hud.innerHTML = `<div class="run-hud-progress"><small>RUN</small><strong>${escapeHtml(actLabel)}</strong><span>ROOM ${String(room).padStart(2, "0")} / ${ROUTE.length}</span></div><div class="run-hud-health-slot${danger ? " health-danger" : ""}${critical ? " health-critical" : ""}"${playerHelpAttributes("hp")}><div class="run-hud-health stat-row health-stat"><span><small>HP</small><b>${hp} / ${maxHp}</b></span><div class="run-hud-health-track player-health-bar" role="progressbar" aria-label="현재 체력" aria-valuemin="0" aria-valuemax="${maxHp}" aria-valuenow="${hp}"><span style="width:${healthPercent}%"></span></div></div></div><div class="run-hud-resources">${hudMetric("GOLD", `${number(gold)} G`, "run-hud-gold gold-stat")}${hudMetric("POTION", `✚ ${number(potions)}`, "run-hud-potion")}${hudMetric("SCORE", number(score), "run-hud-score")}</div><div class="run-hud-actions">${actions}</div>`;

  renderPcRoute(route, run, E);

  player.className = "player-stats player-core-panel";
  player.setAttribute("aria-label", "내 전투 능력과 현재 상태");
  player.innerHTML = playerPanelMarkup(run);

  acquired.className = "acquired-panel run-build-panel";
  acquired.setAttribute(
    "aria-label",
    "이번 런의 빌드 방향, 활성 시너지, 특성 및 유물",
  );
  acquired.innerHTML = acquiredPanelMarkup(run);

  metrics.renderBoundaryRuns += 1;
  return template.innerHTML;
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
      } catch {}
    }
  });
}

function replayLegacyUiAnimations(run) {
  if (!app) return;
  if (run?.phase === "reward") {
    const rewardItem = app.querySelector(".reward-item > .item");
    if (rewardItem)
      replayExistingAnimations(rewardItem, REWARD_ANIMATIONS, "reward");
  }
  const upgradeSuccess = app.querySelector(".rest-upgrade-success");
  if (upgradeSuccess)
    replayExistingAnimations(upgradeSuccess, UPGRADE_ANIMATIONS, "upgrade");
}

function finalizeRender(run) {
  metrics.finalizerRuns += 1;
  if (!app) return;
  window.HarmonyCurrentRenderRun = run;
  syncRoomBackground(run);
  document.body.classList.toggle(
    "harmony-stage-active",
    Boolean(
      desktop.matches &&
        app.querySelector(":scope > .hud.run-hud-enhanced") &&
        app.querySelector(":scope > .play-layout"),
    ),
  );

  polishBattleUi();
  syncPlayerSupportUi(run);
  syncHarmonyUi(run);
  syncCardDetails(app);
  syncImpurityUi(run);
  syncEconomyUi(run);
  replayLegacyUiAnimations(run);
  queueHandSync();
}

function transformMarkup(markup, run) {
  return transformRunMarkup(String(markup), run);
}

function syncFrame(run) {
  currentRenderRun = run || null;
  finalizeRender(currentRenderRun);
}

window.HarmonyPcFrame = Object.freeze({
  transform: transformMarkup,
  sync: syncFrame,
});

document.addEventListener(
  "click",
  (event) => {
    if (!event.target.closest?.("[data-run-open]")) return;
    queueMicrotask(() => syncImpurityUi(currentRenderRun));
  },
  true,
);

reducedMotion.addEventListener?.("change", () => {
  animationDiagnostics.reducedMotion = reducedMotion.matches;
});

window.HarmonyRenderStability = Object.freeze({
  snapshot: () => ({ ...metrics }),
  finalize: () => finalizeRender(currentRenderRun),
});
window.HarmonyAnimationDiagnostics = Object.freeze({
  snapshot: () => structuredClone(animationDiagnostics),
});
window.HarmonyBuildAnalyzer = Object.freeze({
  snapshot: () => analyzeBuild(currentRenderRun),
  analyze: analyzeBuild,
});

import { analyzeBuild } from "./pc-frame-ui.js?v=20260915-9";

const app = document.getElementById("app"),
  MOBILE_QUERY = "(max-width: 900px), (max-width: 932px) and (max-height: 600px)",
  mobileBattleMedia = window.matchMedia(MOBILE_QUERY),
  baseFrame = window.HarmonyPcFrame;

let currentRun = null,
  drawerReturnFocus = null;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isMobileBattle(run = currentRun) {
  return Boolean(mobileBattleMedia.matches && run?.phase === "battle" && run?.battle);
}

function actLabel(run) {
  const act = Number(run?.loop || 0) + 1;
  return act <= 3 ? `ACT ${act}` : `ABYSS ${act - 3}`;
}

function healthPercent(run) {
  return Math.max(0, Math.min(100, (Number(run?.hp || 0) / Math.max(1, Number(run?.maxHp || 1))) * 100));
}

function mobileHudMarkup(run) {
  const room = Math.max(1, Math.min(12, Number(run?.node || 0) + 1));
  return `<div class="mobile-battle-hud" aria-label="모바일 전투 HUD">
    <div class="mobile-hud-progress"><small>${actLabel(run)}</small><strong>ROOM ${String(room).padStart(2, "0")} / 12</strong></div>
    <div class="mobile-hud-health"><span><small>HP</small><b>${Number(run.hp || 0)} / ${Number(run.maxHp || 0)}</b></span><i aria-hidden="true"><em style="width:${healthPercent(run)}%"></em></i></div>
    <div class="mobile-hud-resources"><span><small>GOLD</small><b>${Number(run.gold || 0).toLocaleString("ko-KR")}</b></span><span><small>POTION</small><b>✚ ${Number(run.potions || 0)}</b></span></div>
    <button type="button" class="mobile-menu-button" data-mobile-menu aria-haspopup="dialog" aria-controls="mobile-info-drawer"><span aria-hidden="true">☰</span><small>MENU</small></button>
  </div>`;
}

function syncMobileHud(run) {
  const hud = app?.querySelector(":scope > .hud"),
    route = app?.querySelector(":scope > .route");
  if (!hud || !route) return;
  hud.classList.add("mobile-battle-hud-host");
  route.classList.add("mobile-battle-route");
  hud.querySelector(":scope > .mobile-battle-hud")?.remove();
  hud.insertAdjacentHTML("beforeend", mobileHudMarkup(run));
  route.setAttribute("aria-label", `현재 ${Number(run.node || 0) + 1}번째 방, 총 12개 방`);
}

function harmonyState(run) {
  const notes = (run?.battle?.notes || [])
    .map((entry) => String(typeof entry === "string" ? entry : entry?.note || "").toLowerCase())
    .filter(Boolean),
    sequence = ["top", "middle", "base"],
    lastThree = notes.slice(-3),
    completed = lastThree.length === 3 && lastThree.every((note, index) => note === sequence[index]);
  if (completed) return { progress: 3, completed: true, next: null };
  if (notes.slice(-2).join(",") === "top,middle") return { progress: 2, completed: false, next: "base" };
  if (notes.at(-1) === "top") return { progress: 1, completed: false, next: "middle" };
  return { progress: 0, completed: false, next: "top" };
}

function syncMobileHarmony(run) {
  const terms = [...(app?.querySelectorAll(".battle > .combat-stats > .combat-term") || [])],
    term = terms.at(-1);
  if (!term) return;
  if (term.dataset.mobileHarmonyOriginalHtml === undefined) {
    term.dataset.mobileHarmonyOriginalHtml = term.innerHTML;
    term.dataset.mobileHarmonyOriginalAria = term.getAttribute("aria-label") || "";
  }
  const state = harmonyState(run),
    labels = ["TOP", "MID", "BASE"],
    nextLabel = state.next ? { top: "TOP", middle: "MID", base: "BASE" }[state.next] : "완성";
  term.classList.add("mobile-harmony-core");
  term.setAttribute(
    "aria-label",
    state.completed ? "Harmony 완성: TOP, MIDDLE, BASE 완료" : `Harmony 진행: 다음 ${nextLabel}`,
  );
  term.innerHTML = `<span class="mobile-harmony-title">HARMONY</span><span class="mobile-harmony-sequence" aria-hidden="true">${labels
    .map((label, index) => `<i class="${state.completed || index < state.progress ? "done" : index === state.progress ? "next" : ""}">${label}</i>${index < 2 ? "<em>›</em>" : ""}`)
    .join("")}</span><b>${state.completed ? "HARMONY!" : `NEXT ${nextLabel}`}</b>`;
}

function restoreMobileHarmony(root = app) {
  root?.querySelectorAll(".mobile-harmony-core").forEach((term) => {
    if (term.dataset.mobileHarmonyOriginalHtml !== undefined)
      term.innerHTML = term.dataset.mobileHarmonyOriginalHtml;
    const aria = term.dataset.mobileHarmonyOriginalAria;
    if (aria) term.setAttribute("aria-label", aria);
    else term.removeAttribute("aria-label");
    delete term.dataset.mobileHarmonyOriginalHtml;
    delete term.dataset.mobileHarmonyOriginalAria;
    term.classList.remove("mobile-harmony-core");
  });
}

function restoreDesktopEnemyPresentation() {
  app?.querySelectorAll('.battle .enemy[data-enemy-card-ui="1"]').forEach((enemy) => {
    const statusRail = enemy.querySelector(":scope > .enemy-status-rail"),
      defenseRail = enemy.querySelector(":scope > .enemy-defense-rail"),
      vitals = enemy.querySelector(":scope > .enemy-vitals");
    if (!statusRail || !defenseRail || !vitals) return;

    const statusList = document.createElement("div"),
      chips = [
        ...statusRail.querySelectorAll(":scope > .status-chip"),
        ...defenseRail.querySelectorAll(":scope > .status-chip"),
      ].sort((a, b) => Number(a.dataset.enemyStatusOrder || 0) - Number(b.dataset.enemyStatusOrder || 0)),
      shield = defenseRail.querySelector(":scope > .enemy-shield-value");

    statusList.className = `status-list${chips.length ? "" : " status-list-empty"}`;
    statusList.setAttribute("aria-label", `${enemy.querySelector(":scope > h2")?.textContent?.trim() || "적"} 상태`);
    if (!chips.length) statusList.setAttribute("aria-hidden", "true");
    chips.forEach((chip) => {
      delete chip.dataset.enemyStatusOrder;
      statusList.append(chip);
    });
    if (shield) {
      delete shield.dataset.enemyShieldHome;
      vitals.append(shield);
    }
    enemy.insertBefore(statusList, vitals.nextSibling);
    statusRail.remove();
    defenseRail.remove();
    enemy.querySelector(":scope > .enemy-target-badge")?.remove();
    delete enemy.dataset.enemyCardUi;
  });
}

function buildSummaryMarkup(run) {
  const profile = analyzeBuild(run),
    builds = [profile.primary, profile.secondary].filter(Boolean),
    buildMarkup = builds.length
      ? builds.map((build, index) => `<article class="mobile-build-card"><small>${index ? "보조 빌드" : "주 빌드"}</small><span aria-hidden="true">${escapeHtml(build.icon)}</span><strong>${escapeHtml(build.label)}</strong><p>${escapeHtml(build.detail)}</p></article>`).join("")
      : '<p class="mobile-drawer-empty">빌드 형성 중 · 카드와 조향 원료를 모으면 주요 방향이 표시됩니다.</p>',
    synergyMarkup = profile.activeSynergies.length
      ? profile.activeSynergies.map((synergy) => `<div class="mobile-synergy-row"><span aria-hidden="true">✦</span><strong>${escapeHtml(synergy.name)}</strong><small>${escapeHtml(synergy.description || "활성 시너지")}</small></div>`).join("")
      : '<p class="mobile-drawer-empty">활성 시너지 없음</p>';
  return `<section class="mobile-build-summary" aria-label="Build Core"><div class="mobile-drawer-section-head"><small>BUILD CORE</small><strong>현재 빌드</strong></div><div class="mobile-build-grid">${buildMarkup}</div><div class="mobile-drawer-section-head mobile-synergy-head"><small>ACTIVE SYNERGY</small><strong>활성 시너지</strong></div><div class="mobile-synergy-list">${synergyMarkup}</div></section>`;
}

function drawerMarkup() {
  return `<aside id="mobile-info-drawer" class="mobile-info-drawer" role="dialog" aria-modal="true" aria-labelledby="mobile-info-title" hidden>
    <button type="button" class="mobile-drawer-backdrop" data-mobile-drawer-close aria-label="정보 패널 닫기"></button>
    <section class="mobile-info-sheet">
      <header class="mobile-drawer-head"><div><small>BATTLE INFO</small><strong id="mobile-info-title">전투 정보</strong></div><button type="button" data-mobile-drawer-close aria-label="닫기">×</button></header>
      <div class="mobile-drawer-tabs" role="tablist" aria-label="전투 정보 분류">
        <button type="button" role="tab" data-mobile-drawer-tab="stats" aria-selected="false">능력치</button>
        <button type="button" role="tab" data-mobile-drawer-tab="build" aria-selected="false">Build</button>
        <button type="button" role="tab" data-mobile-drawer-tab="menu" aria-selected="true">메뉴</button>
      </div>
      <div class="mobile-drawer-body">
        <div class="mobile-drawer-pane" data-mobile-drawer-pane="stats" hidden></div>
        <div class="mobile-drawer-pane" data-mobile-drawer-pane="build" hidden></div>
        <div class="mobile-drawer-pane mobile-drawer-menu" data-mobile-drawer-pane="menu">
          <button type="button" data-mobile-open="deck"><span>▤</span><strong>내 덱 · 여정 아이템</strong><small>Deck / Run Summary</small></button>
          <button type="button" data-mobile-open="log"><span>≡</span><strong>전투 기록</strong><small>Battle Log</small></button>
          <button type="button" data-mobile-open="codex"><span>◇</span><strong>도감 및 가이드</strong><small>Codex</small></button>
          <button type="button" data-mobile-open="settings"><span>⚙</span><strong>설정</strong><small>Settings</small></button>
          <button type="button" data-mobile-open="home"><span>⌂</span><strong>저장 후 홈</strong><small>Save & Home</small></button>
        </div>
      </div>
    </section>
  </aside>`;
}

function syncMobileDrawer(run) {
  const layout = app?.querySelector(".play-layout"),
    playContent = layout?.querySelector(":scope > .play-content"),
    stats = layout?.querySelector(":scope > .player-stats"),
    acquired = layout?.querySelector(":scope > .acquired-panel");
  if (!layout || !playContent || !stats || !acquired) return;

  layout.querySelector(":scope > .mobile-info-drawer")?.remove();
  layout.insertAdjacentHTML("beforeend", drawerMarkup());
  const drawer = layout.querySelector(":scope > .mobile-info-drawer"),
    statsPane = drawer.querySelector('[data-mobile-drawer-pane="stats"]'),
    buildPane = drawer.querySelector('[data-mobile-drawer-pane="build"]');
  statsPane.append(stats);
  buildPane.insertAdjacentHTML("beforeend", buildSummaryMarkup(run));
  buildPane.append(acquired);
}

function setDrawerTab(drawer, tabId) {
  drawer?.querySelectorAll("[data-mobile-drawer-tab]").forEach((tab) => {
    const selected = tab.dataset.mobileDrawerTab === tabId;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  drawer?.querySelectorAll("[data-mobile-drawer-pane]").forEach((pane) => {
    pane.hidden = pane.dataset.mobileDrawerPane !== tabId;
    if (!pane.hidden) pane.scrollTop = 0;
  });
}

function openDrawer(trigger, tabId = "menu") {
  const drawer = app?.querySelector("#mobile-info-drawer");
  if (!drawer) return;
  drawerReturnFocus = trigger || document.activeElement;
  setDrawerTab(drawer, tabId);
  drawer.hidden = false;
  drawer.classList.add("is-open");
  document.body.classList.add("mobile-info-open");
  drawer.querySelector(`[data-mobile-drawer-tab="${tabId}"]`)?.focus();
}

function closeDrawer({ restoreFocus = true } = {}) {
  const drawer = app?.querySelector("#mobile-info-drawer");
  if (!drawer || drawer.hidden) return;
  drawer.classList.remove("is-open");
  drawer.hidden = true;
  document.body.classList.remove("mobile-info-open");
  if (restoreFocus) drawerReturnFocus?.focus?.();
  drawerReturnFocus = null;
}

function restorePanels() {
  const layout = app?.querySelector(".play-layout"),
    drawer = layout?.querySelector(":scope > .mobile-info-drawer"),
    playContent = layout?.querySelector(":scope > .play-content"),
    stats = drawer?.querySelector(".player-stats"),
    acquired = drawer?.querySelector(".acquired-panel");
  if (playContent && stats) playContent.before(stats);
  if (playContent && acquired) playContent.after(acquired);
  drawer?.remove();
}

function cleanupMobileBattle() {
  closeDrawer({ restoreFocus: false });
  restoreMobileHarmony();
  restorePanels();
  app?.querySelector(":scope > .hud")?.classList.remove("mobile-battle-hud-host");
  app?.querySelector(":scope > .hud > .mobile-battle-hud")?.remove();
  app?.querySelector(":scope > .route")?.classList.remove("mobile-battle-route");
  document.documentElement.classList.remove("mobile-battle-active");
  document.body.classList.remove("mobile-battle-active", "mobile-info-open");
}

function syncMobileBattle(run) {
  currentRun = run || null;
  if (!isMobileBattle(run)) {
    cleanupMobileBattle();
    return;
  }
  restoreDesktopEnemyPresentation();
  document.body.classList.remove("harmony-stage-active");
  document.documentElement.classList.add("mobile-battle-active");
  document.body.classList.add("mobile-battle-active");
  syncMobileHud(run);
  syncMobileHarmony(run);
  syncMobileDrawer(run);
}

function activateMenuTarget(action) {
  if (!isMobileBattle()) return;
  const drawer = app?.querySelector("#mobile-info-drawer"),
    hiddenHudAction = app?.querySelector(`.hud [${action === "log" ? "data-log-open" : 'data-action="home"'}]`);
  if (action === "deck") {
    const deckButton = drawer?.querySelector(".run-summary-button[data-run-open]");
    closeDrawer({ restoreFocus: false });
    deckButton?.click();
  } else if (action === "log") {
    closeDrawer({ restoreFocus: false });
    hiddenHudAction?.click();
  } else if (action === "codex") {
    closeDrawer({ restoreFocus: false });
    document.getElementById("tools-toggle")?.click();
  } else if (action === "settings") {
    closeDrawer({ restoreFocus: false });
    document.getElementById("settings-toggle")?.click();
  } else if (action === "home") {
    closeDrawer({ restoreFocus: false });
    hiddenHudAction?.click();
  }
}

if (baseFrame) {
  window.HarmonyPcFrame = Object.freeze({
    transform(value, run) {
      return baseFrame.transform?.(value, run) ?? value;
    },
    sync(run) {
      baseFrame.sync?.(run);
      syncMobileBattle(run);
    },
  });
}

document.addEventListener("click", (event) => {
  if (!isMobileBattle()) return;
  const menu = event.target.closest("[data-mobile-menu]");
  if (menu) {
    openDrawer(menu, "menu");
    return;
  }
  const close = event.target.closest("[data-mobile-drawer-close]");
  if (close) {
    closeDrawer();
    return;
  }
  const tab = event.target.closest("[data-mobile-drawer-tab]");
  if (tab) {
    setDrawerTab(tab.closest(".mobile-info-drawer"), tab.dataset.mobileDrawerTab);
    return;
  }
  const open = event.target.closest("[data-mobile-open]");
  if (open) activateMenuTarget(open.dataset.mobileOpen);
});

document.addEventListener("keydown", (event) => {
  const drawer = app?.querySelector("#mobile-info-drawer");
  if (event.key === "Escape" && drawer && !drawer.hidden) {
    event.preventDefault();
    closeDrawer();
  }
});

window.addEventListener("harmony:overlay-opening", () => closeDrawer({ restoreFocus: false }));
mobileBattleMedia.addEventListener("change", () => syncMobileBattle(currentRun));

export const MOBILE_BATTLE_MEDIA_QUERY = MOBILE_QUERY;

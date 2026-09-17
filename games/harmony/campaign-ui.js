import { loadGame } from "./persistence.js?v=20260915-2";
import {
  ACT7_INFO,
  CAMPAIGN_LOOPS,
  campaignActInfo,
  clearMilestone,
  clearRequestedCampaignStart,
  progression,
  requestCampaignStart,
  resolveAct7Route,
} from "./campaign-progression.js";
import { routeLabel } from "./late-game-runtime.js";

const STYLE_ID = "harmony-campaign-ui-style";
let launchingCampaign = false;
let scheduled = false;

function runtimeState() {
  const storage = window.HarmonyRuntime?.storage;
  if (!storage) return null;
  try {
    const loaded = loadGame(storage);
    return { meta: loaded.meta || {}, run: loaded.run || null };
  } catch {
    return null;
  }
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .campaign-stage-panel{margin-top:14px;padding:14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.035)}
    .campaign-stage-panel>small,.campaign-unlock-banner>small{display:block;letter-spacing:.12em;opacity:.72;margin-bottom:8px}
    .campaign-stage-grid{display:flex;flex-wrap:wrap;gap:8px}
    .campaign-stage-grid button{min-width:145px}
    .campaign-unlock-banner{margin:16px 0;padding:14px 16px;border:1px solid rgba(255,255,255,.17);border-radius:14px;background:rgba(255,255,255,.055)}
    .campaign-unlock-banner strong{display:block;font-size:1.05rem;margin-bottom:4px}
    .campaign-route-note{display:block;margin-top:8px;opacity:.78}
  `;
  document.head.append(style);
}

function campaignButton(label, loop, route = null) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.campaignLoop = String(loop);
  if (route) button.dataset.campaignRoute = route;
  button.addEventListener("click", () => {
    const state = runtimeState();
    if (state?.run && !state.run.finished) {
      const okay = window.confirm("진행 중인 여정을 종료하고 선택한 막으로 새로 시작할까요?");
      if (!okay) return;
    }
    requestCampaignStart(loop, route);
    const baseNew = document.querySelector('#app [data-action="new"]');
    if (!baseNew) return;
    launchingCampaign = true;
    try {
      baseNew.click();
    } finally {
      launchingCampaign = false;
    }
  });
  return button;
}

function patchLobby(meta) {
  const welcome = document.querySelector("#app .welcome");
  if (!welcome || welcome.querySelector(".campaign-stage-panel")) return;
  const unlocked = progression(meta),
    panel = document.createElement("section"),
    grid = document.createElement("div");
  panel.className = "campaign-stage-panel";
  grid.className = "campaign-stage-grid";
  panel.innerHTML = "<small>UNLOCKED ACTS</small><strong>해금된 후반 막에서 시작</strong>";
  if (unlocked.act4) grid.append(campaignButton("4막 · 변질된 조향실", CAMPAIGN_LOOPS.ACT4));
  if (unlocked.act5) grid.append(campaignButton("5막 · 조향 생태계", CAMPAIGN_LOOPS.ACT5));
  if (unlocked.act6) grid.append(campaignButton("6막 · 대연금 시설", CAMPAIGN_LOOPS.ACT6));
  if (unlocked.act7) {
    grid.append(campaignButton("7-1 · 육체화된 향", CAMPAIGN_LOOPS.ACT7, "7-1"));
    grid.append(campaignButton("7-2 · 초고온 향류", CAMPAIGN_LOOPS.ACT7, "7-2"));
    grid.append(campaignButton("7-3 · 공명 의식", CAMPAIGN_LOOPS.ACT7, "7-3"));
  }
  if (!grid.childElementCount) return;
  panel.append(grid);
  welcome.querySelector(".actions")?.after(panel);
}

function milestoneFor(run, meta) {
  if (!run || run.phase !== "loop") return null;
  const milestone = clearMilestone(run, meta);
  return milestone
    ? { ...milestone, title: `도전과제 클리어 · ${milestone.title}` }
    : null;
}

function addMilestoneBanner(room, milestone) {
  if (!milestone || room.querySelector(".campaign-unlock-banner")) return;
  const banner = document.createElement("div");
  banner.className = "campaign-unlock-banner";
  banner.innerHTML = `<small>ACHIEVEMENT CLEAR</small><strong>${milestone.title}</strong><span>${milestone.detail}</span>`;
  const actions = room.querySelector(".actions");
  if (actions) actions.before(banner);
  else room.append(banner);
}

function patchLoop(run, meta) {
  if (!run || run.phase !== "loop") return;
  const room = document.querySelector("#app .room"),
    primary = room?.querySelector('[data-action="loop"]'),
    finish = room?.querySelector('[data-action="finish"]');
  if (!room || !finish) return;

  const milestone = milestoneFor(run, meta),
    loop = Math.max(0, Math.floor(Number(run.loop) || 0));
  addMilestoneBanner(room, milestone);

  const heading = room.querySelector("h1"),
    text = room.querySelector("h1 + p"),
    info = campaignActInfo(loop, run);
  if (heading && loop >= CAMPAIGN_LOOPS.ACT4)
    heading.textContent = `${info.name}의 조화가 완성됐습니다.`;

  if (milestone?.forceHome) {
    if (primary) primary.hidden = true;
    finish.textContent = "첫 화면으로 돌아가기 →";
    finish.classList.add("primary");
    if (text) text.textContent = "새로운 막이 해금되었습니다. 첫 화면에서 다음 도전을 선택할 수 있습니다.";
    return;
  }

  if (primary) primary.hidden = false;
  if (loop === CAMPAIGN_LOOPS.ACT6) {
    const route = resolveAct7Route(run.act6RouteStats);
    primary.textContent = `${routeLabel(route)} 진행하기 →`;
    finish.textContent = "첫 화면으로 돌아가기";
    if (text)
      text.innerHTML = `6막에서 사용한 카드 성향에 따라 <strong>${routeLabel(route)}</strong> 경로가 선택되었습니다.<span class="campaign-route-note">현재 덱과 아이템을 유지하고 진행합니다.</span>`;
  } else if (loop === CAMPAIGN_LOOPS.ACT7) {
    primary.textContent = "심연 진행하기 →";
    finish.textContent = "첫 화면으로 돌아가기";
    if (text) text.textContent = "현재 덱과 아이템을 유지한 채 심연 1에 진입할 수 있습니다.";
  } else if (loop >= CAMPAIGN_LOOPS.ABYSS_START) {
    const depth = loop - CAMPAIGN_LOOPS.ABYSS_START + 1;
    primary.textContent = `심연 ${depth + 1} 진행하기 →`;
    finish.textContent = "여정 완료 · 기록 확정";
    if (text) text.textContent = `현재 덱과 아이템을 유지한 채 심연 ${depth + 1}에 진입할 수 있습니다.`;
  } else if (loop >= CAMPAIGN_LOOPS.ACT3) {
    const next = campaignActInfo(loop + 1, run);
    primary.textContent = `${next.name} 진행하기 →`;
    finish.textContent = "첫 화면으로 돌아가기";
  }
}

function patchHud(run) {
  if (!run || run.finished) return;
  const hud = document.querySelector("#app .hud small");
  if (!hud) return;
  const info = campaignActInfo(run.loop, run);
  if (run.loop >= CAMPAIGN_LOOPS.ABYSS_START)
    hud.textContent = `심연 ${info.abyssDepth} · ${info.name}`;
  else if (run.loop >= CAMPAIGN_LOOPS.ACT4)
    hud.textContent = `${info.act}막${run.loop === CAMPAIGN_LOOPS.ACT7 ? ` ${run.act7Route || ""}` : ""} · ${info.name}`;
}

function patchResult(run) {
  if (!run || run.phase !== "result") return;
  const label = [...document.querySelectorAll("#app .result-meta span")].find((span) =>
    span.querySelector("small")?.textContent?.includes("도달 구간"),
  );
  const value = label?.querySelector("b");
  if (!value) return;
  const info = campaignActInfo(run.loop, run);
  value.textContent = run.loop >= CAMPAIGN_LOOPS.ABYSS_START
    ? `심연 ${info.abyssDepth}`
    : `${info.act}막 · ${info.name}`;
}

function patchLobbyRecord(meta) {
  const record = document.querySelector("#app .lobby-record");
  if (!record || !meta) return;
  const highest = Math.max(0, Math.floor(Number(meta.highestLoop) || 0));
  if (highest < CAMPAIGN_LOOPS.ABYSS_START) {
    const info = campaignActInfo(highest);
    record.textContent = `완료한 여정 ${meta.totalRuns || 0} · 최고 점수 ${Number(meta.highScore || 0).toLocaleString("ko-KR")} · 최고 도달 ${info.act}막`;
  } else {
    record.textContent = `완료한 여정 ${meta.totalRuns || 0} · 최고 점수 ${Number(meta.highScore || 0).toLocaleString("ko-KR")} · 최고 심연 ${highest - CAMPAIGN_LOOPS.ABYSS_START + 1}`;
  }
}

function patch() {
  scheduled = false;
  ensureStyles();
  const state = runtimeState();
  if (!state) return;
  patchLobby(state.meta);
  patchLobbyRecord(state.meta);
  patchLoop(state.run, state.meta);
  patchHud(state.run);
  patchResult(state.run);
}

function schedulePatch() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(patch);
}

document.addEventListener("click", (event) => {
  const baseNew = event.target.closest?.('#app [data-action="new"]');
  if (baseNew && !launchingCampaign) clearRequestedCampaignStart();
}, true);

const observer = new MutationObserver(schedulePatch);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("harmony:cloud-status", schedulePatch);
window.addEventListener("DOMContentLoaded", schedulePatch);
schedulePatch();

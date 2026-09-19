import { loadGame } from "./persistence.js?v=20260915-2";
import "./campaign-clear-recorder.js";
import "./local-test-act-starts.js?v=20260918-1";
import {
  CAMPAIGN_LOOPS,
  campaignActInfo,
  clearMilestone,
  resolveAct7Route,
} from "./campaign-progression.js";
import { routeLabel } from "./late-game-runtime.js";
import "./late-game-ui.js?v=20260919-2";

const STYLE_ID = "harmony-campaign-ui-style";
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

function liveRun(fallback = null) {
  const current = window.HarmonyCurrentRenderRun;
  return current && typeof current === "object" ? current : fallback;
}

function setText(node, value) {
  if (!node) return;
  const next = String(value ?? "");
  if (node.textContent !== next) node.textContent = next;
}

function setHtml(node, value) {
  if (!node) return;
  const next = String(value ?? "");
  if (node.innerHTML !== next) node.innerHTML = next;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .campaign-unlock-banner{margin:16px 0;padding:14px 16px;border:1px solid rgba(255,255,255,.17);border-radius:14px;background:rgba(255,255,255,.055)}
    .campaign-unlock-banner>small{display:block;letter-spacing:.12em;opacity:.72;margin-bottom:8px}
    .campaign-unlock-banner strong{display:block;font-size:1.05rem;margin-bottom:4px}
    .campaign-route-note{display:block;margin-top:8px;opacity:.78}
    .result-screen .result-actions{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:18px}
    .result-screen .result-actions>[data-action="home"]{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:220px;max-width:100%;min-height:48px;padding:12px 20px;line-height:1.2;text-align:center;white-space:nowrap}
    @media (max-width:600px){
      .result-screen .result-actions>[data-action="home"]{width:min(100%,320px);min-width:0;white-space:normal}
    }
  `;
  document.head.append(style);
}

function feedbackFor(run) {
  const feedback = run?._campaignFeedback;
  if (!feedback) return null;
  const sameLoop = Number(feedback.loop) === Number(run.loop),
    sameRoute = (feedback.route || null) === (run.act7Route || null);
  return sameLoop && sameRoute ? feedback : null;
}

function milestoneFor(run, meta) {
  if (!run || run.phase !== "loop") return null;
  const milestone = feedbackFor(run) || clearMilestone(run, meta);
  return milestone
    ? { ...milestone, title: `도전과제 클리어 · ${milestone.title}` }
    : null;
}

function addMilestoneBanner(room, milestone) {
  if (!milestone || room.querySelector(".campaign-unlock-banner")) return;
  const banner = document.createElement("div");
  banner.className = "campaign-unlock-banner";
  banner.innerHTML = `<small>ACHIEVEMENT CLEAR</small><strong>${milestone.title}</strong><span>${milestone.detail}</span>`;
  const actions = room.querySelector(".actions, .result-actions");
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
    setText(heading, `${info.name}의 조화가 완성됐습니다.`);

  if (milestone?.forceHome) {
    if (primary) primary.hidden = true;
    finish.hidden = false;
    setText(finish, "결과 · 공유 화면으로 →");
    finish.classList.add("primary");
    if (text)
      setText(text, "새로운 구간이 해금되었습니다. 이번 여정은 여기서 종료됩니다.");
    return;
  }

  if (primary) primary.hidden = false;
  finish.hidden = false;
  finish.classList.remove("primary");

  if (loop === CAMPAIGN_LOOPS.ACT6) {
    const route = resolveAct7Route(run.act6RouteStats);
    if (primary) setText(primary, `${routeLabel(route)} 진행하기 →`);
    setText(finish, "여정 종료");
    if (text)
      setHtml(text, `6막에서 사용한 카드 성향에 따라 <strong>${routeLabel(route)}</strong> 경로가 선택되었습니다.<span class="campaign-route-note">현재 런의 덱과 아이템을 유지하고 진행합니다.</span>`);
  } else if (loop === CAMPAIGN_LOOPS.ACT7) {
    if (primary) setText(primary, "심연 진행하기 →");
    setText(finish, "여정 종료");
    if (text) setText(text, "현재 런의 덱과 아이템을 유지한 채 심연 1에 진입할 수 있습니다.");
  } else if (loop >= CAMPAIGN_LOOPS.ABYSS_START) {
    const depth = loop - CAMPAIGN_LOOPS.ABYSS_START + 1;
    if (primary) setText(primary, `심연 ${depth + 1} 진행하기 →`);
    setText(finish, "여정 완료 · 기록 확정");
    if (text) setText(text, `현재 덱과 아이템을 유지한 채 심연 ${depth + 1}에 진입할 수 있습니다.`);
  } else if (loop >= CAMPAIGN_LOOPS.ACT3) {
    const next = campaignActInfo(loop + 1, run);
    if (primary) setText(primary, `${next.name} 진행하기 →`);
    setText(finish, "여정 종료");
    if (text) setText(text, "해금된 다음 구간으로 현재 런을 이어갈 수 있습니다.");
  }
}

function patchHud(run) {
  if (!run || run.finished) return;
  const info = campaignActInfo(run.loop, run),
    isAbyss = run.loop >= CAMPAIGN_LOOPS.ABYSS_START,
    actLabel = isAbyss
      ? `심연 ${info.abyssDepth}`
      : `${info.act}막${run.loop === CAMPAIGN_LOOPS.ACT7 && run.act7Route ? ` ${run.act7Route}` : ""}`,
    enhanced = document.querySelector("#app .run-hud-progress");

  if (enhanced) {
    setText(enhanced.querySelector(":scope > small"), "RUN");
    setText(enhanced.querySelector(":scope > strong"), actLabel);
    enhanced.setAttribute("aria-label", `${actLabel} · ${info.name}`);
    return;
  }

  const hud = document.querySelector("#app .hud > div:first-child small");
  if (!hud) return;
  setText(hud, isAbyss ? actLabel : `${actLabel} · ${info.name}`);
}

function patchResult(run) {
  if (!run || run.phase !== "result") return;
  const room = document.querySelector("#app .room"),
    label = [...document.querySelectorAll("#app .result-meta span")].find((span) =>
      span.querySelector("small")?.textContent?.includes("도달 구간"),
    ),
    value = label?.querySelector("b"),
    info = campaignActInfo(run.loop, run),
    feedback = feedbackFor(run);

  if (value)
    setText(value, run.loop >= CAMPAIGN_LOOPS.ABYSS_START
      ? `심연 ${info.abyssDepth}`
      : `${info.act}막 · ${info.name}`);

  if (feedback?.forceHome && room) {
    addMilestoneBanner(room, {
      ...feedback,
      title: `도전과제 클리어 · ${feedback.title}`,
    });
  }

  if (run.hp > 0 && room) {
    const newButton = room.querySelector('[data-action="new"], [data-action="home"]');
    if (newButton) {
      newButton.dataset.action = "home";
      setText(newButton, "처음 화면으로 가기 →");
      newButton.classList.add("primary", "campaign-home-button");
    }
  }
}

function patchLobbyRecord(meta) {
  const record = document.querySelector("#app .lobby-record");
  if (!record || !meta) return;
  const highest = Math.max(0, Math.floor(Number(meta.highestLoop) || 0));
  if (highest < CAMPAIGN_LOOPS.ABYSS_START) {
    const info = campaignActInfo(highest);
    setText(record, `완료한 여정 ${meta.totalRuns || 0} · 최고 점수 ${Number(meta.highScore || 0).toLocaleString("ko-KR")} · 최고 도달 ${info.act}막`);
  } else {
    setText(record, `완료한 여정 ${meta.totalRuns || 0} · 최고 점수 ${Number(meta.highScore || 0).toLocaleString("ko-KR")} · 최고 심연 ${highest - CAMPAIGN_LOOPS.ABYSS_START + 1}`);
  }
}

function autoAdvanceFirstClearToResult(run) {
  if (run?.phase !== "loop" || !feedbackFor(run)?.forceHome) return;
  const finish = document.querySelector('#app [data-action="finish"]');
  if (!finish || finish.dataset.campaignAutoFinish === "1") return;
  finish.dataset.campaignAutoFinish = "1";
  queueMicrotask(() => {
    if (finish.isConnected) finish.click();
  });
}

function patch() {
  scheduled = false;
  ensureStyles();
  const state = runtimeState();
  if (!state) return;
  const run = liveRun(state.run);
  patchLobbyRecord(state.meta);
  patchLoop(run, state.meta);
  patchHud(run);
  patchResult(run);
  autoAdvanceFirstClearToResult(run);
}

function schedulePatch() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(patch);
}

const observer = new MutationObserver(schedulePatch);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("harmony:cloud-status", schedulePatch);
window.addEventListener("harmony:campaign-clear-recorded", schedulePatch);
window.addEventListener("DOMContentLoaded", schedulePatch);
schedulePatch();

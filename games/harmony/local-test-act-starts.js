import {
  ACT7_ROUTES,
  CAMPAIGN_LOOPS,
  requestLocalTestCampaignStart,
} from "./campaign-progression.js";
import {
  applyLocalFeatureQuery,
  hasLocalFeatureAccess,
} from "./local-feature-access.js?v=20260920-1";

const STYLE_ID = "harmony-local-test-act-starts-style",
  PANEL_ID = "builder-test-act-starts";

const START_TARGETS = Object.freeze([
  { label: "1막", loop: CAMPAIGN_LOOPS.ACT1 },
  { label: "2막", loop: CAMPAIGN_LOOPS.ACT2 },
  { label: "3막", loop: CAMPAIGN_LOOPS.ACT3 },
  { label: "4막", loop: CAMPAIGN_LOOPS.ACT4 },
  { label: "5막", loop: CAMPAIGN_LOOPS.ACT5 },
  { label: "6막", loop: CAMPAIGN_LOOPS.ACT6 },
  { label: "7-1", loop: CAMPAIGN_LOOPS.ACT7, route: ACT7_ROUTES.FLESH },
  { label: "7-2", loop: CAMPAIGN_LOOPS.ACT7, route: ACT7_ROUTES.HEAT },
  { label: "7-3", loop: CAMPAIGN_LOOPS.ACT7, route: ACT7_ROUTES.RESONANCE },
  { label: "심연 1", loop: CAMPAIGN_LOOPS.ABYSS_START },
]);

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .builder-test-act-starts{display:grid;gap:8px;margin-top:10px;padding:10px;border:1px solid #f8e29a36;border-radius:12px;background:#f8e29a0a}
    .builder-test-act-starts-head{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#a9c0b2;font-size:9px;letter-spacing:.08em}
    .builder-test-act-starts-head strong{color:#f8e29a;font-size:10px;letter-spacing:.12em}
    .builder-test-act-starts-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
    .builder-test-act-starts button{display:grid;place-items:center;gap:2px;min-width:0;min-height:42px;padding:6px 4px;border-color:#ffffff24;border-radius:8px;background:#ffffff08}
    .builder-test-act-starts button:hover:not(:disabled){border-color:#f8e29a88;background:#f8e29a18}
    .builder-test-act-starts button strong{color:#edf4ed;font-size:10px;white-space:nowrap}
    .builder-test-act-starts button small{color:#91aa9e;font-size:7px;white-space:nowrap}
    @media(max-width:760px){.builder-test-act-starts-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.append(style);
}

function panelMarkup() {
  return `<div class="builder-test-act-starts-head"><strong>LOCAL · START AREA</strong><span>선택한 덱/증강으로 해당 구간 첫 방에서 시작</span></div><div class="builder-test-act-starts-grid">${START_TARGETS.map((target) => `<button type="button" data-local-test-start data-loop="${target.loop}"${target.route ? ` data-route="${target.route}"` : ""}><strong>${target.label}</strong><small>시작하기</small></button>`).join("")}</div>`;
}

function syncPanel() {
  const dialog = document.getElementById("starting-deck-builder");
  if (!dialog) return;
  const originalStart = dialog.querySelector("#builder-start"),
    testMode = dialog.classList.contains("test-mode");
  if (!originalStart) return;

  let panel = dialog.querySelector(`#${PANEL_ID}`);
  if (!testMode) {
    if (panel) panel.remove();
    if (originalStart.hidden) originalStart.hidden = false;
    return;
  }

  ensureStyle();
  if (!panel) {
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "builder-test-act-starts";
    panel.innerHTML = panelMarkup();
    originalStart.before(panel);
  }
  if (!originalStart.hidden) originalStart.hidden = true;
  const disabled = originalStart.disabled;
  panel.querySelectorAll("[data-local-test-start]").forEach((button) => {
    if (button.disabled !== disabled) button.disabled = disabled;
  });
}

let scheduled = false;
function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    syncPanel();
  });
}

applyLocalFeatureQuery();

if (hasLocalFeatureAccess()) {
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-local-test-start]");
    if (!button) return;
    const dialog = button.closest("#starting-deck-builder.test-mode"),
      originalStart = dialog?.querySelector("#builder-start");
    if (!dialog || !originalStart || originalStart.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const loop = Number(button.dataset.loop),
      route = button.dataset.route || null;
    if (!requestLocalTestCampaignStart(loop, route)) return;
    originalStart.click();
  }, true);

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "disabled", "open"],
  });
  window.addEventListener("DOMContentLoaded", scheduleSync);
  scheduleSync();
}

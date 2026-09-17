import { createMobileRunDetail } from "./mobile-run-detail.js?v=20260917-2";

const app = document.getElementById("app"),
  MOBILE_QUERY = "(max-width: 900px), (max-width: 932px) and (max-height: 600px)",
  media = window.matchMedia(MOBILE_QUERY);

let currentRun = null;

function isMobileBattle(run = currentRun) {
  return Boolean(media.matches && run?.phase === "battle" && run?.battle);
}

const mobileRunDetail = createMobileRunDetail({
  getRun: () => currentRun,
  getDrawer: () => app?.querySelector("#mobile-info-drawer") || null,
});

const baseFrame = window.HarmonyPcFrame;
if (baseFrame) {
  window.HarmonyPcFrame = Object.freeze({
    transform(value, run) {
      return baseFrame.transform?.(value, run) ?? value;
    },
    sync(run) {
      baseFrame.sync?.(run);
      currentRun = run || null;
      if (isMobileBattle(run)) mobileRunDetail.sync(run);
      else mobileRunDetail.cleanup();
    },
  });
}

document.addEventListener(
  "click",
  (event) => {
    const trigger = event.target.closest?.('[data-mobile-open="deck"]');
    if (!trigger || !isMobileBattle()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    mobileRunDetail.open(trigger);
  },
  true,
);

window.addEventListener("harmony:overlay-opening", () =>
  mobileRunDetail.close({ restore: false }),
);
media.addEventListener("change", () => {
  if (!isMobileBattle()) mobileRunDetail.cleanup();
});

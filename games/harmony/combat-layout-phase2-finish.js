const app = document.getElementById("app"),
  desktop = window.matchMedia("(min-width: 901px)");
let queued = false;

function polishBattleSidebar() {
  queued = false;
  if (!app || !desktop.matches) return;

  const panel = app.querySelector(".player-stats");
  if (!panel) return;

  for (const row of panel.querySelectorAll(".stat-row")) {
    const label = row.querySelector(":scope > span");
    if (label?.textContent?.trim() !== "행동력") continue;

    label.textContent = "AP 기본/상한";
    row.classList.add("ap-capacity-stat");
    row.setAttribute(
      "aria-label",
      `AP 기본 및 상한 ${row.querySelector(":scope > b")?.textContent?.trim() || ""}`.trim(),
    );
    break;
  }
}

function schedulePolish() {
  if (queued || !desktop.matches) return;
  queued = true;
  requestAnimationFrame(polishBattleSidebar);
}

if (app) {
  new MutationObserver(schedulePolish).observe(app, { childList: true, subtree: false });
  schedulePolish();
}

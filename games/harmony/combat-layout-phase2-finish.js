const app = document.getElementById("app"),
  desktop = window.matchMedia("(min-width: 901px)");
let queued = false;

function railHeading(text, className = "") {
  const heading = document.createElement("span");
  heading.className = `enemy-rail-heading${className ? ` ${className}` : ""}`;
  heading.textContent = text;
  heading.setAttribute("aria-hidden", "true");
  return heading;
}

function railPlaceholder() {
  const placeholder = document.createElement("span");
  placeholder.className = "enemy-rail-placeholder";
  placeholder.textContent = "—";
  placeholder.setAttribute("aria-hidden", "true");
  return placeholder;
}

function syncRailState(rail) {
  const chips = rail.querySelectorAll(":scope > .status-chip"),
    placeholder = rail.querySelector(":scope > .enemy-rail-placeholder");
  rail.classList.toggle("enemy-rail-empty", chips.length === 0);
  if (chips.length === 0 && !placeholder) rail.append(railPlaceholder());
  else if (chips.length > 0) placeholder?.remove();
}

function upgradeEnemyCard(enemy) {
  if (enemy.dataset.enemyCardUi === "1") return;

  const statusList = enemy.querySelector(":scope > .status-list"),
    vitals = enemy.querySelector(":scope > .enemy-vitals"),
    shield = vitals?.querySelector(":scope > .enemy-shield-value");
  if (!statusList || !vitals || !shield) return;

  const statusRail = document.createElement("div"),
    defenseRail = document.createElement("div"),
    targetBadge = document.createElement("span");

  statusRail.className = "enemy-rail enemy-status-rail";
  statusRail.setAttribute("aria-label", `${enemy.querySelector(":scope > h2")?.textContent?.trim() || "적"} 해로운 상태`);
  statusRail.append(railHeading("STATUS", "enemy-status-heading"));

  defenseRail.className = "enemy-rail enemy-defense-rail";
  defenseRail.setAttribute("aria-label", `${enemy.querySelector(":scope > h2")?.textContent?.trim() || "적"} 방어 및 강화 상태`);
  defenseRail.append(railHeading("DEFENSE", "enemy-defense-heading"));

  targetBadge.className = "enemy-target-badge";
  targetBadge.textContent = "TARGET";
  targetBadge.setAttribute("aria-hidden", "true");

  [...statusList.querySelectorAll(":scope > .status-chip")].forEach((chip, index) => {
    chip.dataset.enemyStatusOrder = String(index);
    if (chip.classList.contains("status-debuff")) statusRail.append(chip);
    else defenseRail.append(chip);
  });

  shield.dataset.enemyShieldHome = "vitals";
  defenseRail.insertBefore(shield, defenseRail.children[1] || null);

  if (defenseRail.querySelector(":scope > .status-chip")) {
    const effectHeading = railHeading("EFFECT", "enemy-effect-heading");
    defenseRail.insertBefore(effectHeading, defenseRail.querySelector(":scope > .status-chip"));
  }

  statusList.remove();
  syncRailState(statusRail);
  enemy.append(targetBadge, statusRail, defenseRail);
  enemy.dataset.enemyCardUi = "1";
}

function restoreEnemyCard(enemy) {
  const statusRail = enemy.querySelector(":scope > .enemy-status-rail"),
    defenseRail = enemy.querySelector(":scope > .enemy-defense-rail"),
    vitals = enemy.querySelector(":scope > .enemy-vitals");
  if (!statusRail || !defenseRail || !vitals) return;

  const restored = document.createElement("div"),
    chips = [
      ...statusRail.querySelectorAll(":scope > .status-chip"),
      ...defenseRail.querySelectorAll(":scope > .status-chip"),
    ].sort(
      (a, b) => Number(a.dataset.enemyStatusOrder || 0) - Number(b.dataset.enemyStatusOrder || 0),
    ),
    shield = defenseRail.querySelector(":scope > .enemy-shield-value");

  restored.className = `status-list${chips.length ? "" : " status-list-empty"}`;
  restored.setAttribute("aria-label", `${enemy.querySelector(":scope > h2")?.textContent?.trim() || "적"} 상태`);
  if (!chips.length) restored.setAttribute("aria-hidden", "true");
  for (const chip of chips) {
    delete chip.dataset.enemyStatusOrder;
    restored.append(chip);
  }

  if (shield) {
    delete shield.dataset.enemyShieldHome;
    vitals.append(shield);
  }

  const anchor = vitals.nextSibling;
  enemy.insertBefore(restored, anchor);
  statusRail.remove();
  defenseRail.remove();
  enemy.querySelector(":scope > .enemy-target-badge")?.remove();
  delete enemy.dataset.enemyCardUi;
}

function polishEnemyCards() {
  if (!app) return;
  if (!desktop.matches) {
    app.querySelectorAll('.enemy[data-enemy-card-ui="1"]').forEach(restoreEnemyCard);
    return;
  }
  app.querySelectorAll(".battle .enemies-field > .enemy").forEach(upgradeEnemyCard);
}

function polishBattleSidebar() {
  const panel = app?.querySelector(".player-stats");
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

function polishBattleUi() {
  queued = false;
  if (!app) return;
  polishEnemyCards();
  if (desktop.matches) polishBattleSidebar();
}

function schedulePolish() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(polishBattleUi);
}

if (app) {
  new MutationObserver(schedulePolish).observe(app, { childList: true, subtree: false });
  desktop.addEventListener?.("change", schedulePolish);
  schedulePolish();
}

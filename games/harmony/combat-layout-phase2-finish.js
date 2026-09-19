const app = document.getElementById("app"),
  desktop = window.matchMedia("(min-width: 901px)");

function railHeading(text, className = "") {
  const heading = document.createElement("span");
  heading.className = `enemy-rail-heading${className ? ` ${className}` : ""}`;
  heading.textContent = text;
  heading.setAttribute("aria-hidden", "true");
  return heading;
}

function upgradeEnemyCard(enemy) {
  enemy
    .querySelector(":scope > .enemy-visual")
    ?.classList.add("enemy-visual-presentation");
  if (enemy.dataset.enemyCardUi === "1") return;

  const vitals = enemy.querySelector(":scope > .enemy-vitals"),
    shield = vitals?.querySelector(":scope > .enemy-shield-value");
  if (!vitals || !shield) return;

  const defenseRail = document.createElement("div"),
    targetBadge = document.createElement("span");

  defenseRail.className = "enemy-rail enemy-defense-rail";
  defenseRail.setAttribute(
    "aria-label",
    `${enemy.querySelector(":scope > h2")?.textContent?.trim() || "적"} 방어 상태`,
  );
  defenseRail.append(railHeading("DEFENSE", "enemy-defense-heading"));

  targetBadge.className = "enemy-target-badge";
  targetBadge.textContent = "TARGET";
  targetBadge.setAttribute("aria-hidden", "true");

  shield.dataset.enemyShieldHome = "vitals";
  defenseRail.append(shield);

  enemy.append(targetBadge, defenseRail);
  enemy.dataset.enemyCardUi = "1";
}

function restoreEnemyCard(enemy) {
  const defenseRail = enemy.querySelector(":scope > .enemy-defense-rail"),
    vitals = enemy.querySelector(":scope > .enemy-vitals");
  if (!defenseRail || !vitals) return;

  const shield = defenseRail.querySelector(":scope > .enemy-shield-value");
  if (shield) {
    delete shield.dataset.enemyShieldHome;
    vitals.append(shield);
  }

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

function polishBattleCopy() {
  const guide = app?.querySelector(".battle > .battle-top > span");
  if (guide?.textContent?.trim() === "턴 종료 후 적이 위에서부터 행동합니다") {
    guide.textContent = "턴 종료 후 표시된 순서대로 행동합니다";
  }
}

export function polishBattleUi() {
  if (!app) return;
  polishEnemyCards();
  if (!desktop.matches) return;
  polishBattleSidebar();
  polishBattleCopy();
}

export function placeBattleOverlay(overlay, battle) {
  const bounds = battle.getBoundingClientRect();
  Object.assign(overlay.style, {
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  });
  document.body.append(overlay);
}

export function syncBattleStateFrame() {
  const battle = document.querySelector(".battle"),
    previous = document.querySelector(".battle-state-frame"),
    active =
      battle &&
      (battle.classList.contains("health-critical") ||
        battle.classList.contains("enraged"));
  if (!active) {
    previous?.remove();
    return;
  }
  const frame = previous || document.createElement("span");
  frame.className = `battle-state-frame${battle.classList.contains("health-critical") ? " health-critical" : ""}${battle.classList.contains("enraged") ? " enraged" : ""}`;
  frame.setAttribute("aria-hidden", "true");
  placeBattleOverlay(frame, battle);
}

export function showBattleShieldOverlay(type) {
  const battle = document.querySelector(".battle");
  if (!battle) return;
  document.querySelector(`.battle-shield-overlay.${type}`)?.remove();
  const overlay = document.createElement("span");
  overlay.className = `battle-shield-overlay ${type}`;
  overlay.setAttribute("aria-hidden", "true");
  placeBattleOverlay(overlay, battle);
  overlay.addEventListener("animationend", () => overlay.remove(), {
    once: true,
  });
  window.setTimeout(() => overlay.remove(), 950);
}

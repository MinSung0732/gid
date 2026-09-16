import { STATUS_DEFINITIONS } from "./statuses.js?v=20260911-4";
import { SFX } from "./sound.js?v=20260911-9";
import { getPlayerHealthAnchor } from "./player-vfx-anchor.js";
import { placeBattleOverlay } from "./battle-overlay.js";

export function createCombatFeedbackVfx({
  combatEffectsEnabled,
  enemyElement,
  formatNumber,
}) {
  const number = formatNumber;

  function playContactHitSound(strong = false, superStrong = false) {
    if (superStrong && typeof SFX.superContactHit === "function")
      SFX.superContactHit();
    else if (strong && typeof SFX.strongContactHit === "function")
      SFX.strongContactHit();
    else SFX.contactHit();
  }

  function showPlayerDamage(
    amount,
    attackPattern = null,
    strong = false,
    superStrong = false,
    playHurtSound = true,
  ) {
    const battle = document.querySelector(".battle"),
      health = getPlayerHealthAnchor();
    if (!battle || !health || amount <= 0) return;
    if (attackPattern === "contact") playContactHitSound(strong, superStrong);
    else if (attackPattern === "nonContact") SFX.nonContactHit();
    if (playHurtSound) {
      if (superStrong) SFX.playerSuperHit();
      else if (strong) SFX.playerStrongHit();
      else SFX.playerHit();
    }
    if (combatEffectsEnabled()) {
      for (const animation of battle.getAnimations()) {
        if (
          animation.animationName === "player-hit" ||
          animation.animationName === "player-contact-hit-strong"
        )
          animation.cancel();
      }
      battle.classList.remove("player-hit", "player-hit-strong");
      battle.classList.add(strong ? "player-hit-strong" : "player-hit");
      document.querySelector(".battle-hit-wash")?.remove();
      const hitWash = document.createElement("span");
      hitWash.className = "battle-hit-wash";
      hitWash.setAttribute("aria-hidden", "true");
      placeBattleOverlay(hitWash, battle);
      hitWash.addEventListener("animationend", () => hitWash.remove(), {
        once: true,
      });
    }
    const popup = document.createElement("strong");
    popup.className = `health-damage-pop${strong ? " player-damage-strong" : ""}`;
    popup.textContent = `-${number(amount)}`;
    popup.setAttribute("aria-label", `${number(amount)} 체력 피해`);
    health.append(popup);
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
  }

  function showPlayerStatusSmoke(color) {
    const panel = getPlayerHealthAnchor();
    if (!panel) return;
    const smoke = document.createElement("span");
    smoke.className = "player-status-smoke";
    smoke.style.setProperty("--status-smoke-color", color);
    smoke.setAttribute("aria-hidden", "true");
    smoke.innerHTML = "<i></i>".repeat(12);
    panel.append(smoke);
    smoke.addEventListener("animationend", (event) => {
      if (event.target === smoke) smoke.remove();
    });
    window.setTimeout(() => smoke.remove(), 1400);
  }

  function showStatusDamage(hit, index = 0) {
    const definition =
      STATUS_DEFINITIONS[hit.statusId] ||
      (hit.statusId === "shufflePenalty"
        ? { name: "셔플 반동", color: "#caa8ff" }
        : hit.statusId === "impurityOverflow"
          ? { name: "불순물 과부하", color: "#8b6f91" }
          : null);
    if (!definition || hit.amount <= 0) return;
    const color = definition.color,
      delay = index * 190,
      slot = index % 3;
    setTimeout(() => {
      if (hit.target === "player") showPlayerStatusSmoke(color);
      const hosts =
        hit.target === "enemy"
          ? [
              [
                enemyElement(hit.targetIndex),
                "status-damage-pop enemy-status-damage",
              ],
            ]
          : [
              [
                getPlayerHealthAnchor(),
                "status-damage-pop health-status-damage",
              ],
            ];
      for (const [host, className] of hosts) {
        if (!host) continue;
        const popup = document.createElement("strong");
        popup.className = className;
        popup.style.setProperty("--status-damage-color", color);
        popup.style.setProperty("--damage-x", `${(slot - 1) * 58}px`);
        popup.style.setProperty("--damage-y", `${slot * 16}px`);
        popup.innerHTML = `<small>${definition.name}</small>-${number(hit.amount)}`;
        popup.setAttribute(
          "aria-label",
          `${definition.name}으로 ${number(hit.amount)} 피해`,
        );
        host.append(popup);
        popup.addEventListener("animationend", () => popup.remove(), {
          once: true,
        });
      }
    }, delay);
  }

  function showEnemyDebuffSmoke(statusIds = []) {
    const battle = document.querySelector(".battle"),
      uniqueStatusIds = [...new Set(statusIds)];
    if (!battle || !uniqueStatusIds.length) return;
    uniqueStatusIds.forEach((statusId, index) => {
      const definition = STATUS_DEFINITIONS[statusId];
      if (!definition) return;
      window.setTimeout(() => {
        if (!document.body.contains(battle)) return;
        const smoke = document.createElement("span");
        smoke.className = "enemy-debuff-smoke";
        smoke.style.setProperty("--debuff-smoke-color", definition.color);
        smoke.setAttribute("aria-hidden", "true");
        smoke.innerHTML = "<i></i>".repeat(20 + Math.floor(Math.random() * 6));
        for (const particle of smoke.children) {
          const fromLeft = Math.random() < .5;
          particle.style.setProperty("--smoke-x", `${8 + Math.random() * 84}%`);
          particle.style.setProperty("--smoke-size", `${80 + Math.random() * 75}px`);
          particle.style.setProperty("--smoke-enter-x", `${fromLeft ? -55 - Math.random() * 40 : 55 + Math.random() * 40}px`);
          particle.style.setProperty("--smoke-drift", `${fromLeft ? 18 + Math.random() * 30 : -18 - Math.random() * 30}px`);
          particle.style.setProperty("--smoke-rise", `${125 + Math.random() * 80}px`);
          particle.style.setProperty("--smoke-delay", `${Math.random() * .22}s`);
          particle.style.setProperty("--smoke-duration", `${.72 + Math.random() * .3}s`);
        }
        placeBattleOverlay(smoke, battle);
        window.setTimeout(() => smoke.remove(), 1400);
      }, index * 130);
    });
  }

  function showStatusDamageQueue(hits) {
    hits.forEach(showStatusDamage);
    return hits.length
      ? new Promise((resolve) =>
          setTimeout(resolve, Math.min(700, 130 + hits.length * 190)),
        )
      : Promise.resolve();
  }

  function addHealingMotes(effect) {
    if (!effect) return;
    for (let index = 0; index < 7; index++) {
      const mote = document.createElement("i");
      mote.className = "healing-mote";
      mote.style.setProperty("--heal-x", `${-28 + index * 9}px`);
      mote.style.setProperty("--heal-drift", `${index % 2 ? 8 : -7}px`);
      mote.style.setProperty("--heal-delay", `${(index % 4) * 55}ms`);
      effect.append(mote);
    }
  }

  function showPlayerHealing(amount) {
    const health = getPlayerHealthAnchor(),
      battle = document.querySelector(".battle");
    if (!health || amount <= 0) return;
    SFX.heal();
    health.classList.remove("player-healing");
    void health.offsetWidth;
    health.classList.add("player-healing");
    const effect = document.createElement("span");
    effect.className = "healing-effect";
    effect.setAttribute("aria-label", `${number(amount)} 체력 회복`);
    effect.innerHTML = `<i class="healing-mist healing-mist-a"></i><i class="healing-mist healing-mist-b"></i><strong>+${number(amount)}</strong>`;
    health.append(effect);
    addHealingMotes(effect);
    effect
      .querySelector("strong")
      .addEventListener("animationend", () => effect.remove(), { once: true });
    if (battle) {
      document.querySelector(".battle-healing-mist")?.remove();
      const borderMist = document.createElement("span");
      borderMist.className = "battle-healing-mist";
      borderMist.setAttribute("aria-hidden", "true");
      placeBattleOverlay(borderMist, battle);
      borderMist.addEventListener("animationend", () => borderMist.remove(), {
        once: true,
      });
    }
  }

  return {
    playContactHitSound,
    showEnemyDebuffSmoke,
    showPlayerDamage,
    showPlayerHealing,
    showStatusDamageQueue,
  };
}

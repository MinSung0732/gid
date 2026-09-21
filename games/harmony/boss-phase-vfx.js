export function createBossPhaseVfx({
  combatEffectsEnabled,
  enemyElement,
  effectsLayer,
  reducedCombatMotion,
}) {
  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function removeAfter(node, ms) {
    if (!node) return;
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      node.remove();
    };
    node.addEventListener("animationend", (event) => {
      if (event.target === node) remove();
    }, { once: true });
    window.setTimeout(remove, ms);
  }

  async function showBossPhase2Vfx(feedback) {
    if (!feedback || feedback.alive === false || !combatEffectsEnabled()) return;
    const actor = enemyElement(feedback.targetIndex),
      bounds = actor?.getBoundingClientRect();
    if (!actor || !bounds?.width || !bounds?.height) return;

    const reduced = reducedCombatMotion(),
      centerX = bounds.left + bounds.width / 2,
      centerY = bounds.top + bounds.height * .48;

    await wait(reduced ? 35 : 100);

    actor.classList.remove("hmy-boss-phase2-actor");
    void actor.offsetWidth;
    actor.classList.add("hmy-boss-phase2-actor");

    const effect = document.createElement("span");
    effect.className = `hmy-boss-phase2${reduced ? " reduced" : ""}`;
    effect.setAttribute("role", "status");
    effect.setAttribute("aria-label", "발향 폭주");
    effect.style.left = `${centerX}px`;
    effect.style.top = `${centerY}px`;
    effect.style.setProperty(
      "--boss-phase-center-x",
      `${(centerX / Math.max(1, window.innerWidth)) * 100}%`,
    );
    effect.style.setProperty(
      "--boss-phase-center-y",
      `${(centerY / Math.max(1, window.innerHeight)) * 100}%`,
    );
    effect.style.setProperty("--boss-phase-width", `${Math.max(120, bounds.width)}px`);
    effect.style.setProperty("--boss-phase-height", `${Math.max(120, bounds.height)}px`);
    effect.innerHTML =
      '<i class="hmy-boss-phase2-darken"></i>' +
      '<i class="hmy-boss-phase2-core"></i>' +
      '<i class="hmy-boss-phase2-ring hmy-boss-phase2-ring-a"></i>' +
      '<i class="hmy-boss-phase2-ring hmy-boss-phase2-ring-b"></i>' +
      '<strong>발향 폭주</strong>';

    if (!reduced) {
      const particleCount = 14;
      for (let index = 0; index < particleCount; index++) {
        const particle = document.createElement("i"),
          angle = index * (360 / particleCount) - 82,
          distance = 64 + (index % 4) * 15;
        particle.className = "hmy-boss-phase2-particle";
        particle.style.setProperty("--boss-phase-angle", `${angle}deg`);
        particle.style.setProperty("--boss-phase-distance", `${distance}px`);
        particle.style.setProperty("--boss-phase-delay", `${180 + (index % 5) * 18}ms`);
        effect.append(particle);
      }
    }

    effectsLayer().append(effect);
    removeAfter(effect, reduced ? 520 : 1050);

    await wait(reduced ? 360 : 820);
    actor.classList.remove("hmy-boss-phase2-actor");
  }

  return { showBossPhase2Vfx };
}

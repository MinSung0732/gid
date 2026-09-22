export function enemyAnticipationType(action = {}) {
  if (action.type === "attack")
    return action.attackPattern === "nonContact" ? "nonContact" : "contact";
  if (["guard", "debuff", "pollute"].includes(action.type)) return action.type;
  return null;
}

const TYPE_META = Object.freeze({
  contact: Object.freeze({
    label: "접촉 공격",
    color: "#e2b08d",
    icon: "›",
    duration: 300,
  }),
  nonContact: Object.freeze({
    label: "비접촉 공격",
    color: "#9fc9d8",
    icon: "✦",
    duration: 330,
  }),
  guard: Object.freeze({
    label: "방어",
    color: "#8fc8bb",
    icon: "◇",
    duration: 290,
  }),
  debuff: Object.freeze({
    label: "상태이상",
    color: "#b99bc8",
    icon: "∿",
    duration: 340,
  }),
  pollute: Object.freeze({
    label: "오염",
    color: "#9289a0",
    icon: "▰",
    duration: 350,
  }),
});

export function createEnemyAnticipationVfx({
  combatEffectsEnabled,
  enemyElement,
  effectsLayer,
  reducedCombatMotion,
}) {
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  async function showEnemyAnticipation({
    enemyIndex,
    action,
    actionId = null,
    isBoss = false,
    signaturePlayed = false,
  } = {}) {
    const actionType = enemyAnticipationType(action),
      meta = TYPE_META[actionType];
    if (!meta || !combatEffectsEnabled()) return false;

    const actor = enemyElement(enemyIndex),
      rect = actor?.getBoundingClientRect();
    if (!actor || !rect?.width || !rect?.height) return false;

    const reduced = reducedCombatMotion(),
      compact = Boolean(signaturePlayed),
      duration = reduced
        ? compact
          ? 110
          : 180
        : compact
          ? 170
          : meta.duration,
      root = document.createElement("span"),
      core = document.createElement("i"),
      glyph = document.createElement("i");

    root.className =
      `hmy-enemy-anticipation type-${actionType}` +
      `${compact ? " compact" : ""}${reduced ? " reduced" : ""}` +
      `${isBoss ? " boss" : ""}`;
    root.dataset.actionId = actionId || "";
    root.dataset.enemyIndex = String(enemyIndex);
    root.style.left = `${rect.left + rect.width / 2}px`;
    root.style.top = `${rect.top + rect.height * .5}px`;
    root.style.width = `${Math.max(100, rect.width)}px`;
    root.style.height = `${Math.max(100, rect.height)}px`;
    root.style.setProperty("--anticipation-color", meta.color);
    root.style.setProperty("--anticipation-duration", `${duration}ms`);
    root.setAttribute("aria-hidden", "true");

    core.className = "hmy-enemy-anticipation-core";
    glyph.className = "hmy-enemy-anticipation-glyph";
    glyph.textContent = meta.icon;
    root.append(core, glyph);

    if (actionType === "nonContact") {
      const particles = reduced ? 2 : compact ? 2 : 4;
      for (let index = 0; index < particles; index++) {
        const mote = document.createElement("i");
        mote.className = "hmy-enemy-anticipation-mote";
        mote.style.setProperty("--anticipation-angle", `${index * (360 / particles) - 45}deg`);
        mote.style.setProperty("--anticipation-radius", `${34 + (index % 2) * 10}px`);
        root.append(mote);
      }
    }

    if (actionType === "guard") {
      const outline = document.createElement("i");
      outline.className = "hmy-enemy-anticipation-shield";
      root.append(outline);
    }

    if (actionType === "debuff" || actionType === "pollute") {
      const smokeCount = reduced ? 2 : compact ? 2 : 4;
      for (let index = 0; index < smokeCount; index++) {
        const smoke = document.createElement("i");
        smoke.className = "hmy-enemy-anticipation-smoke";
        smoke.style.setProperty("--anticipation-smoke-x", `${(index - (smokeCount - 1) / 2) * 18}px`);
        smoke.style.setProperty("--anticipation-smoke-delay", `${index * 30}ms`);
        root.append(smoke);
      }
    }

    actor.classList.remove(
      "hmy-enemy-anticipating-contact",
      "hmy-enemy-anticipating-noncontact",
      "hmy-enemy-anticipating-guard",
      "hmy-enemy-anticipating-debuff",
      "hmy-enemy-anticipating-pollute",
    );
    actor.style.setProperty("--anticipation-duration", `${duration}ms`);
    actor.classList.add(
      `hmy-enemy-anticipating-${actionType === "nonContact" ? "noncontact" : actionType}`,
    );
    effectsLayer().append(root);

    await wait(duration);

    actor.classList.remove(
      "hmy-enemy-anticipating-contact",
      "hmy-enemy-anticipating-noncontact",
      "hmy-enemy-anticipating-guard",
      "hmy-enemy-anticipating-debuff",
      "hmy-enemy-anticipating-pollute",
    );
    actor.style.removeProperty("--anticipation-duration");
    root.remove();
    return true;
  }

  function cleanupEnemyAnticipation({ enemyIndex } = {}) {
    const actor = Number.isInteger(enemyIndex) ? enemyElement(enemyIndex) : null;
    actor?.classList.remove(
      "hmy-enemy-anticipating-contact",
      "hmy-enemy-anticipating-noncontact",
      "hmy-enemy-anticipating-guard",
      "hmy-enemy-anticipating-debuff",
      "hmy-enemy-anticipating-pollute",
    );
    actor?.style.removeProperty("--anticipation-duration");
    if (Number.isInteger(enemyIndex))
      effectsLayer()
        .querySelectorAll(
          `.hmy-enemy-anticipation[data-enemy-index="${enemyIndex}"]`,
        )
        .forEach((node) => node.remove());
  }

  return { cleanupEnemyAnticipation, showEnemyAnticipation };
}

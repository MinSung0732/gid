export const ACTION_CANCEL_PRESENTATIONS = Object.freeze({
  stun: Object.freeze({
    statusId: "stun",
    style: "stun",
    duration: 340,
    reducedDuration: 210,
    cleanupActionPresentation: true,
    fallbackIcon: "✹",
  }),
  disarm: Object.freeze({
    statusId: "disarm",
    style: "disarm",
    duration: 320,
    reducedDuration: 200,
    cleanupActionPresentation: true,
    fallbackIcon: "⚔",
  }),
});

export function actionCancelPresentation(cancelType) {
  return ACTION_CANCEL_PRESENTATIONS[cancelType] || null;
}

export function createActionCancelVfx({
  combatEffectsEnabled,
  enemyElement,
  effectsLayer,
  reducedCombatMotion,
  statusDefinitions,
  cleanupActionPresentation,
}) {
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  async function showActionCancelFeedback(context = {}) {
    const config = actionCancelPresentation(context.cancelType);
    if (!config) return false;

    if (config.cleanupActionPresentation)
      cleanupActionPresentation?.(context);

    if (!combatEffectsEnabled()) return false;

    const actor =
        context.actorElement ||
        (context.sourceType === "enemy" &&
        Number.isInteger(context.sourceIndex)
          ? enemyElement(context.sourceIndex)
          : null),
      rect = actor?.getBoundingClientRect();

    if (!actor || !rect?.width || !rect?.height) return false;

    const reduced = reducedCombatMotion(),
      status = statusDefinitions?.[config.statusId] || {},
      duration = reduced ? config.reducedDuration : config.duration,
      color = status.color || "#d8d2c4",
      icon = status.icon || config.fallbackIcon,
      root = document.createElement("span"),
      flash = document.createElement("i"),
      symbol = document.createElement("i");

    root.className =
      `hmy-action-cancel hmy-action-cancel-${config.style}` +
      `${reduced ? " reduced" : ""}`;
    root.dataset.cancelType = context.cancelType;
    if (Number.isInteger(context.sourceIndex))
      root.dataset.enemyIndex = String(context.sourceIndex);
    root.style.left = `${rect.left + rect.width / 2}px`;
    root.style.top = `${rect.top + rect.height * .48}px`;
    root.style.width = `${Math.max(96, rect.width)}px`;
    root.style.height = `${Math.max(96, rect.height)}px`;
    root.style.setProperty("--action-cancel-color", color);
    root.style.setProperty("--action-cancel-duration", `${duration}ms`);
    root.setAttribute("aria-hidden", "true");

    flash.className = "hmy-action-cancel-flash";
    symbol.className = "hmy-action-cancel-symbol";
    symbol.textContent = icon;
    root.append(flash, symbol);

    const particleCount = reduced ? 2 : config.style === "stun" ? 5 : 4;
    for (let index = 0; index < particleCount; index++) {
      const particle = document.createElement("i");
      particle.className = "hmy-action-cancel-particle";
      particle.style.setProperty(
        "--cancel-angle",
        `${index * (360 / particleCount) - 80}deg`,
      );
      particle.style.setProperty(
        "--cancel-distance",
        `${34 + (index % 3) * 10}px`,
      );
      particle.style.setProperty("--cancel-delay", `${index * 22}ms`);
      root.append(particle);
    }

    actor.classList.remove(
      "hmy-action-cancel-actor-stun",
      "hmy-action-cancel-actor-disarm",
    );
    actor.style.setProperty("--action-cancel-duration", `${duration}ms`);
    actor.classList.add(`hmy-action-cancel-actor-${config.style}`);

    effectsLayer().append(root);
    await wait(duration);

    actor.classList.remove(
      "hmy-action-cancel-actor-stun",
      "hmy-action-cancel-actor-disarm",
    );
    actor.style.removeProperty("--action-cancel-duration");
    root.remove();
    return true;
  }

  function cleanupActionCancelFeedback(context = {}) {
    const actor =
      context.actorElement ||
      (context.sourceType === "enemy" && Number.isInteger(context.sourceIndex)
        ? enemyElement(context.sourceIndex)
        : null);
    actor?.classList.remove(
      "hmy-action-cancel-actor-stun",
      "hmy-action-cancel-actor-disarm",
    );
    actor?.style.removeProperty("--action-cancel-duration");

    if (Number.isInteger(context.sourceIndex))
      effectsLayer()
        .querySelectorAll(
          `.hmy-action-cancel[data-enemy-index="${context.sourceIndex}"]`,
        )
        .forEach((node) => node.remove());
  }

  return { cleanupActionCancelFeedback, showActionCancelFeedback };
}

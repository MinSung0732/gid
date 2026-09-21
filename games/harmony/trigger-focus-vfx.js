const TRIGGER_FOCUS_DEFAULTS = Object.freeze({
  normal: Object.freeze({
    holdDuration: 720,
    fadeDuration: 260,
    reducedHoldDuration: 820,
    reducedFadeDuration: 300,
  }),
  strong: Object.freeze({
    holdDuration: 900,
    fadeDuration: 280,
    reducedHoldDuration: 920,
    reducedFadeDuration: 320,
  }),
});

const MERGE_WINDOW_MS = 520;

function eventKey(event = {}) {
  return [
    event.sourceType || "",
    event.sourceId || "",
    event.triggerId || "",
    event.target || "",
    Number.isInteger(event.targetIndex) ? event.targetIndex : "",
  ].join(":");
}

export function createTriggerFocusVfx({
  combatEffectsEnabled,
  effectsLayer,
  reducedCombatMotion,
  findSourceElement,
  resolveTargetElement,
}) {
  const lastFocusedAt = new Map(),
    activeSources = new Set(),
    sourceStates = new WeakMap();

  function clearSource(element) {
    if (!element) return;
    const state = sourceStates.get(element);
    if (state?.holdTimer) window.clearTimeout(state.holdTimer);
    if (state?.fadeTimer) window.clearTimeout(state.fadeTimer);
    sourceStates.delete(element);
    activeSources.delete(element);
    element.classList.remove(
      "hmy-trigger-focus-source",
      "hmy-trigger-focus-strong",
      "hmy-trigger-focus-reinforced",
      "hmy-trigger-focus-fading",
    );
    element.style.removeProperty("--trigger-focus-fade-duration");
  }

  function beginFade(element) {
    const state = sourceStates.get(element);
    if (!state) return;
    state.holdTimer = null;
    element.classList.add("hmy-trigger-focus-fading");
    state.fadeTimer = window.setTimeout(
      () => clearSource(element),
      state.fadeDuration,
    );
  }

  function scheduleFade(element, holdDuration, fadeDuration) {
    const state = sourceStates.get(element);
    if (!state) return;
    if (state.holdTimer) window.clearTimeout(state.holdTimer);
    if (state.fadeTimer) window.clearTimeout(state.fadeTimer);
    state.fadeTimer = null;
    state.fadeDuration = fadeDuration;
    state.expiresAt = performance.now() + holdDuration;
    element.style.setProperty(
      "--trigger-focus-fade-duration",
      `${fadeDuration}ms`,
    );
    state.holdTimer = window.setTimeout(
      () => beginFade(element),
      holdDuration,
    );
  }

  function highlightSource(element, event, config) {
    if (!element) return false;
    const reduced = reducedCombatMotion(),
      holdDuration = reduced
        ? config.reducedHoldDuration
        : config.holdDuration,
      fadeDuration = reduced
        ? config.reducedFadeDuration
        : config.fadeDuration,
      existing = sourceStates.get(element);

    if (existing) {
      element.classList.remove("hmy-trigger-focus-fading");
      element.classList.add("hmy-trigger-focus-reinforced");
      if (event.intensity === "strong")
        element.classList.add("hmy-trigger-focus-strong");
      scheduleFade(
        element,
        Math.max(holdDuration, existing.expiresAt - performance.now()),
        Math.max(fadeDuration, existing.fadeDuration || 0),
      );
      return true;
    }

    sourceStates.set(element, {
      holdTimer: null,
      fadeTimer: null,
      fadeDuration,
      expiresAt: 0,
    });
    activeSources.add(element);
    element.classList.add("hmy-trigger-focus-source");
    if (event.intensity === "strong")
      element.classList.add("hmy-trigger-focus-strong");
    scheduleFade(element, holdDuration, fadeDuration);
    return true;
  }

  function spawnLinkParticles(sourceElement, targetElement, event) {
    if (
      reducedCombatMotion() ||
      !sourceElement ||
      !targetElement ||
      !["heal", "shield", "damage", "absorb", "status"].includes(
        event.effectType,
      )
    )
      return;

    const sourceRect = sourceElement.getBoundingClientRect(),
      targetRect = targetElement.getBoundingClientRect();
    if (
      !sourceRect.width ||
      !sourceRect.height ||
      !targetRect.width ||
      !targetRect.height
    )
      return;

    const startX = sourceRect.left + sourceRect.width / 2,
      startY = sourceRect.top + sourceRect.height / 2,
      endX = targetRect.left + targetRect.width / 2,
      endY = targetRect.top + targetRect.height / 2,
      particleCount = event.intensity === "strong" ? 3 : 2;

    for (let index = 0; index < particleCount; index++) {
      const particle = document.createElement("i");
      particle.className = `hmy-trigger-focus-link effect-${event.effectType}`;
      particle.style.left = `${startX}px`;
      particle.style.top = `${startY}px`;
      particle.style.setProperty("--trigger-link-x", `${endX - startX}px`);
      particle.style.setProperty("--trigger-link-y", `${endY - startY}px`);
      particle.style.setProperty("--trigger-link-delay", `${index * 34}ms`);
      effectsLayer().append(particle);
      window.setTimeout(
        () => particle.remove(),
        420 + index * 34,
      );
    }
  }

  function showTriggerFocusQueue(events = []) {
    if (!combatEffectsEnabled() || !Array.isArray(events) || !events.length)
      return false;

    const uniqueEvents = [],
      seen = new Set();
    for (const event of events) {
      if (!event?.sourceId || !event?.sourceType) continue;
      const key = eventKey(event);
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueEvents.push(event);
    }
    if (!uniqueEvents.length) return false;

    const now = performance.now();
    let shown = false;
    for (const event of uniqueEvents) {
      const sourceElement = findSourceElement?.(event) || null;
      if (!sourceElement) continue;
      const config =
          TRIGGER_FOCUS_DEFAULTS[event.intensity] ||
          TRIGGER_FOCUS_DEFAULTS.normal,
        recent =
          now - (lastFocusedAt.get(event.sourceId) || -Infinity) <
          MERGE_WINDOW_MS;

      shown = highlightSource(sourceElement, event, config) || shown;
      lastFocusedAt.set(event.sourceId, now);
      if (!recent) {
        const targetElement = resolveTargetElement?.(event) || null;
        spawnLinkParticles(sourceElement, targetElement, event);
      }
    }
    return shown;
  }

  function cleanupTriggerFocus() {
    for (const element of [...activeSources]) clearSource(element);
    effectsLayer()
      .querySelectorAll(".hmy-trigger-focus-link")
      .forEach((node) => node.remove());
  }

  return { cleanupTriggerFocus, showTriggerFocusQueue };
}

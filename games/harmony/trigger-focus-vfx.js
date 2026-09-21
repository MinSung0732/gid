const TRIGGER_FOCUS_DEFAULTS = Object.freeze({
  normal: Object.freeze({
    dimOpacity: 0.13,
    duration: 220,
    reducedDuration: 170,
  }),
  strong: Object.freeze({
    dimOpacity: 0.24,
    duration: 320,
    reducedDuration: 220,
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
  findFallbackElement,
  resolveTargetElement,
}) {
  const lastFocusedAt = new Map(),
    wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  function pulseSource(element, event, duration) {
    if (!element) return null;
    element.classList.remove("hmy-trigger-focus-pulse", "hmy-trigger-focus-strong");
    void element.offsetWidth;
    element.style.setProperty("--trigger-focus-duration", `${duration}ms`);
    element.classList.add("hmy-trigger-focus-source", "hmy-trigger-focus-pulse");
    if (event.intensity === "strong")
      element.classList.add("hmy-trigger-focus-strong");
    return element;
  }

  function clearSource(element) {
    if (!element) return;
    element.classList.remove(
      "hmy-trigger-focus-source",
      "hmy-trigger-focus-pulse",
      "hmy-trigger-focus-strong",
    );
    element.style.removeProperty("--trigger-focus-duration");
  }

  function spawnLinkParticles(sourceElement, targetElement, event, duration) {
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
      particle.style.setProperty(
        "--trigger-link-duration",
        `${Math.max(150, duration - 40)}ms`,
      );
      particle.style.setProperty("--trigger-link-delay", `${index * 34}ms`);
      effectsLayer().append(particle);
      window.setTimeout(
        () => particle.remove(),
        Math.max(220, duration + index * 34 + 80),
      );
    }
  }

  async function showTriggerFocusQueue(events = []) {
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

    const now = performance.now(),
      prepared = uniqueEvents
        .map((event) => {
          const sourceElement =
              findSourceElement?.(event) || findFallbackElement?.(event) || null,
            config =
              TRIGGER_FOCUS_DEFAULTS[event.intensity] ||
              TRIGGER_FOCUS_DEFAULTS.normal,
            duration = reducedCombatMotion()
              ? config.reducedDuration
              : config.duration,
            recent =
              now - (lastFocusedAt.get(event.sourceId) || -Infinity) <
              MERGE_WINDOW_MS;
          return { event, sourceElement, config, duration, recent };
        })
        .filter(({ sourceElement }) => sourceElement);

    if (!prepared.length) return false;

    const needsFullFocus = prepared.some(({ recent }) => !recent),
      dim = needsFullFocus ? document.createElement("span") : null,
      maxDim = Math.max(
        ...prepared.map(({ config }) => config.dimOpacity),
      );

    if (dim) {
      dim.className = "hmy-trigger-focus-dim";
      dim.style.setProperty("--trigger-focus-dim", String(maxDim));
      effectsLayer().append(dim);
      requestAnimationFrame(() => dim.classList.add("is-active"));
    }

    for (let index = 0; index < prepared.length; index++) {
      const { event, sourceElement, duration, recent } = prepared[index];
      lastFocusedAt.set(event.sourceId, performance.now());
      pulseSource(sourceElement, event, duration);
      if (!recent) {
        const targetElement = resolveTargetElement?.(event) || null;
        spawnLinkParticles(sourceElement, targetElement, event, duration);
      }
      await wait(recent ? 90 : Math.min(duration, 220));
      clearSource(sourceElement);
      if (index < prepared.length - 1) await wait(36);
    }

    if (dim) {
      dim.classList.remove("is-active");
      await wait(reducedCombatMotion() ? 70 : 110);
      dim.remove();
    }
    return true;
  }

  function cleanupTriggerFocus() {
    document
      .querySelectorAll(".hmy-trigger-focus-source")
      .forEach((element) => clearSource(element));
    effectsLayer()
      .querySelectorAll(".hmy-trigger-focus-dim, .hmy-trigger-focus-link")
      .forEach((node) => node.remove());
  }

  return { cleanupTriggerFocus, showTriggerFocusQueue };
}

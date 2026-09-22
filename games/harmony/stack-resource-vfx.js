import { STATUS_DEFINITIONS } from "./statuses.js?v=20260922-resonance-1";

function clampParticleCount(delta, reduced) {
  if (reduced) return 1;
  const magnitude = Math.max(1, Math.abs(Number(delta) || 1));
  return Math.min(4, 2 + Math.floor(Math.min(4, magnitude - 1) / 2));
}

export function createStackResourceVfx({
  combatEffectsEnabled,
  enemyElement,
  effectsLayer,
  getPlayerImpactPoint,
  reducedCombatMotion,
}) {
  const activeFlows = new Map(),
    pulseTimers = new WeakMap(),
    wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  function actorScope(event) {
    return event.target === "enemy"
      ? enemyElement(event.targetIndex)
      : document.querySelector(".player-effects-battle");
  }

  function actorPoint(event) {
    if (event.target === "player") return getPlayerImpactPoint();
    const actor = enemyElement(event.targetIndex),
      visual = actor?.querySelector(".enemy-visual") || actor,
      rect = visual?.getBoundingClientRect();
    return rect?.width && rect?.height
      ? { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.46 }
      : null;
  }

  function stackChip(event, create = false) {
    const scope = actorScope(event),
      selector = `.status-chip[data-status-id="${event.resourceId}"]`;
    let chip = scope?.querySelector(selector);
    if (chip || !create || !scope) return chip || null;
    const definition = STATUS_DEFINITIONS[event.resourceId],
      list = scope.querySelector(".status-list");
    if (!definition || !list) return null;
    chip = document.createElement("span");
    chip.className = `status-chip status-${definition.kind} hmy-stack-resource-chip-temporary`;
    chip.dataset.statusId = event.resourceId;
    chip.style.setProperty("--status-color", definition.color);
    chip.setAttribute("aria-hidden", "true");
    chip.innerHTML = `<span>${definition.icon}</span><b>${definition.name} ${event.previousValue}</b>`;
    list.classList.remove("status-list-empty");
    list.append(chip);
    return chip;
  }

  function chipPoint(chip) {
    const rect = chip?.getBoundingClientRect();
    return rect?.width && rect?.height
      ? { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 }
      : null;
  }

  function setChipValue(chip, definition, value) {
    const label = chip?.querySelector("b");
    if (!label || !definition) return;
    label.textContent = `${definition.name} ${Math.max(0, value)}`;
  }

  function pulseChip(chip, changeType, reduced) {
    if (!chip) return;
    const duration = reduced ? 150 : 190,
      existing = pulseTimers.get(chip);
    if (existing) window.clearTimeout(existing);
    chip.style.setProperty("--stack-resource-pulse-duration", `${duration}ms`);
    chip.classList.add("hmy-stack-resource-pulse", `hmy-stack-resource-${changeType}`);
    const timer = window.setTimeout(() => {
      chip.classList.remove(
        "hmy-stack-resource-pulse",
        "hmy-stack-resource-gain",
        "hmy-stack-resource-consume",
        "hmy-stack-resource-reinforced",
      );
      chip.style.removeProperty("--stack-resource-pulse-duration");
      pulseTimers.delete(chip);
    }, duration + 40);
    if (existing) chip.classList.add("hmy-stack-resource-reinforced");
    pulseTimers.set(chip, timer);
  }

  function appendMotes(root, count, startIndex = 0) {
    for (let index = 0; index < count; index++) {
      const mote = document.createElement("i");
      mote.className = "hmy-stack-resource-mote";
      mote.style.setProperty("--stack-resource-mote-index", startIndex + index);
      mote.style.setProperty("--stack-resource-mote-delay", `${index * 24}ms`);
      mote.style.setProperty(
        "--stack-resource-sway",
        `${(index % 2 ? 1 : -1) * (4 + (index % 3) * 2)}px`,
      );
      root.append(mote);
    }
  }

  function makeFlow(event, from, to, presentation, reduced) {
    if (!from || !to || !combatEffectsEnabled()) return null;
    const changeType = event.delta > 0 ? "gain" : "consume",
      key = `${event.target}:${event.targetIndex ?? "player"}:${event.resourceId}:${changeType}`,
      current = activeFlows.get(key),
      particleCount = clampParticleCount(event.delta, reduced),
      life = reduced ? 170 : 260;
    if (current?.root?.isConnected) {
      appendMotes(current.root, Math.max(1, particleCount - 1), current.moteCount);
      current.moteCount += Math.max(1, particleCount - 1);
      current.root.classList.add("hmy-stack-resource-flow-reinforced");
      window.clearTimeout(current.timer);
      current.timer = window.setTimeout(() => {
        current.root.remove();
        activeFlows.delete(key);
      }, life + 120);
      return current.root;
    }

    const root = document.createElement("span"),
      deltaX = to.x - from.x,
      deltaY = to.y - from.y;
    const motionStyle = changeType === "gain"
      ? presentation.gainStyle || "gather"
      : presentation.consumeStyle || "disperse";
    root.className =
      `hmy-stack-resource-flow hmy-stack-resource-${changeType} style-${motionStyle} trail-${presentation.trailStyle || "scent"}` +
      `${reduced ? " reduced" : ""}`;
    root.style.left = `${from.x}px`;
    root.style.top = `${from.y}px`;
    root.style.setProperty("--stack-resource-dx", `${deltaX}px`);
    root.style.setProperty("--stack-resource-dy", `${deltaY}px`);
    root.style.setProperty("--stack-resource-distance", `${Math.hypot(deltaX, deltaY)}px`);
    root.style.setProperty("--stack-resource-angle", `${Math.atan2(deltaY, deltaX)}rad`);
    root.style.setProperty("--stack-resource-color", STATUS_DEFINITIONS[event.resourceId]?.color || "currentColor");
    root.style.setProperty("--stack-resource-life", `${life}ms`);
    root.setAttribute("aria-hidden", "true");

    const ribbon = document.createElement("i");
    ribbon.className = "hmy-stack-resource-ribbon";
    root.append(ribbon);
    appendMotes(root, particleCount);

    effectsLayer().append(root);
    const entry = {
      root,
      moteCount: particleCount,
      timer: window.setTimeout(() => {
        root.remove();
        activeFlows.delete(key);
      }, life + 120),
    };
    activeFlows.set(key, entry);
    root.addEventListener("animationend", (animationEvent) => {
      if (animationEvent.target !== root) return;
      window.clearTimeout(entry.timer);
      root.remove();
      if (activeFlows.get(key)?.root === root) activeFlows.delete(key);
    });
    return root;
  }

  async function showStackResourceChange(
    event,
    { sourcePoint = null, targetPoint = null } = {},
  ) {
    if (!event || !Number.isFinite(event.delta) || event.delta === 0) return false;
    const definition = STATUS_DEFINITIONS[event.resourceId],
      presentation = definition?.stackPresentation;
    if (!definition || !presentation) return false;

    const reduced = reducedCombatMotion(),
      changeType = event.delta > 0 ? "gain" : "consume",
      chip = stackChip(event, true),
      chipAnchor = chipPoint(chip),
      actorAnchor = actorPoint(event),
      externalAnchor = sourcePoint || targetPoint || actorAnchor,
      baseFrom = changeType === "gain"
        ? externalAnchor || actorAnchor
        : chipAnchor || actorAnchor,
      baseTo = changeType === "gain"
        ? chipAnchor || actorAnchor
        : externalAnchor || actorAnchor;
    let from = baseFrom,
      to = baseTo;
    if (reduced && chipAnchor) {
      const reference = externalAnchor || actorAnchor,
        rawX = (reference?.x ?? chipAnchor.x + 1) - chipAnchor.x,
        rawY = (reference?.y ?? chipAnchor.y) - chipAnchor.y,
        distance = Math.hypot(rawX, rawY) || 1,
        shortX = (rawX / distance) * 18,
        shortY = (rawY / distance) * 18;
      if (changeType === "gain") {
        from = { x: chipAnchor.x + shortX, y: chipAnchor.y + shortY };
        to = chipAnchor;
      } else {
        from = chipAnchor;
        to = { x: chipAnchor.x + shortX, y: chipAnchor.y + shortY };
      }
    }

    if (!chip && !actorAnchor) return false;

    if (chip) setChipValue(chip, definition, event.previousValue);
    if (changeType === "consume") pulseChip(chip, changeType, reduced);
    makeFlow(event, from, to, presentation, reduced);

    await wait(reduced ? 90 : 160);

    if (changeType === "gain") pulseChip(chip, changeType, reduced);
    if (chip) setChipValue(chip, definition, event.nextValue);

    if (
      chip?.classList.contains("hmy-stack-resource-chip-temporary") &&
      event.nextValue <= 0
    )
      window.setTimeout(() => chip.remove(), reduced ? 160 : 240);

    return true;
  }

  function cleanupStackResourceVfx() {
    for (const entry of activeFlows.values()) {
      window.clearTimeout(entry.timer);
      entry.root.remove();
    }
    activeFlows.clear();
  }

  return {
    cleanupStackResourceVfx,
    showStackResourceChange,
  };
}

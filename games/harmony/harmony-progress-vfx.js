export function createHarmonyProgressVfx({
  combatEffectsEnabled,
  effectsLayer,
  reducedCombatMotion,
}) {
  const NOTE_LABELS = Object.freeze({
    top: "TOP",
    middle: "MIDDLE",
    base: "BASE",
  });

  function normalizedNote(note) {
    const value = String(note || "").toLowerCase();
    return NOTE_LABELS[value] ? value : value || "none";
  }

  function noteLabel(note) {
    const key = normalizedNote(note);
    return NOTE_LABELS[key] || key.toUpperCase();
  }

  function progressRoot() {
    return document.querySelector(".hmy-note-progress");
  }

  function slots(root = progressRoot()) {
    return root ? [...root.querySelectorAll("[data-note-slot]")] : [];
  }

  function setVisualNotes(notes = [], { ghost = false } = {}) {
    const root = progressRoot();
    if (!root) return null;
    const recent = notes.slice(-3).map(normalizedNote);
    root.classList.toggle("hmy-note-progress-ghost", Boolean(ghost));
    for (const [index, slot] of slots(root).entries()) {
      const note = recent[index] || "";
      slot.dataset.note = note;
      slot.classList.toggle("hmy-note-slot-filled", Boolean(note));
      slot.textContent = note ? noteLabel(note) : "·";
      slot.setAttribute("aria-label", note ? noteLabel(note) : "빈 노트");
    }
    for (const [index, link] of [...root.querySelectorAll("[data-note-link]")].entries())
      link.classList.toggle("hmy-note-link-filled", index < Math.max(0, recent.length - 1));
    root.dataset.noteCount = String(recent.length);
    return root;
  }

  function pulseSlot(slot, className, timeout = 210) {
    if (!slot) return Promise.resolve();
    slot.classList.remove(className);
    void slot.offsetWidth;
    slot.classList.add(className);
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        slot.classList.remove(className);
        resolve();
      };
      slot.addEventListener("animationend", finish, { once: true });
      window.setTimeout(finish, timeout);
    });
  }

  function sourcePointFallback() {
    const hand = document.querySelector(".hand"),
      rect = hand?.getBoundingClientRect();
    return rect?.width
      ? { x: rect.left + rect.width / 2, y: rect.top + Math.min(54, rect.height * 0.32) }
      : null;
  }

  function progressStage(event) {
    return Math.max(1, Math.min(3, event?.afterNotes?.slice(-3)?.length || 1));
  }

  function removeAfterAnimation(node, fallbackMs) {
    if (!node) return;
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      node.remove();
    };
    node.addEventListener("animationend", remove, { once: true });
    window.setTimeout(remove, fallbackMs);
  }

  function showLandingImpact(event, slot) {
    if (!slot || !combatEffectsEnabled()) return;
    const stage = progressStage(event),
      rect = slot.getBoundingClientRect(),
      impact = document.createElement("span");
    impact.className = `hmy-note-landing hmy-note-landing-stage-${stage} hmy-note-landing-${normalizedNote(event.note)}`;
    impact.setAttribute("aria-hidden", "true");
    impact.style.left = `${rect.left + rect.width / 2}px`;
    impact.style.top = `${rect.top + rect.height / 2}px`;
    const particleCount = reducedCombatMotion() ? 0 : [3, 4, 6][stage - 1];
    impact.innerHTML = '<i class="hmy-note-landing-bloom"></i><i class="hmy-note-landing-ring"></i>';
    for (let index = 0; index < particleCount; index++) {
      const particle = document.createElement("i"),
        angle = (360 / particleCount) * index - 90,
        distance = [20, 25, 31][stage - 1] + (index % 2) * 4;
      particle.className = "hmy-note-landing-particle";
      particle.style.setProperty("--note-particle-angle", `${angle}deg`);
      particle.style.setProperty("--note-particle-distance", `${distance}px`);
      particle.style.setProperty("--note-particle-delay", `${index * 10}ms`);
      impact.append(particle);
    }
    effectsLayer().append(impact);
    removeAfterAnimation(impact, reducedCombatMotion() ? 180 : 300);
  }

  async function flyNote(event, sourcePoint, targetSlot) {
    if (!combatEffectsEnabled() || reducedCombatMotion() || !targetSlot) return;
    const targetRect = targetSlot.getBoundingClientRect(),
      source = sourcePoint || sourcePointFallback();
    if (!source || !targetRect?.width) return;
    const target = {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
      },
      dx = target.x - source.x,
      dy = target.y - source.y,
      stage = progressStage(event),
      flight = document.createElement("span");
    flight.className = `hmy-note-flight hmy-note-flight-${normalizedNote(event.note)} hmy-note-flight-stage-${stage}`;
    flight.setAttribute("aria-hidden", "true");
    flight.style.left = `${source.x}px`;
    flight.style.top = `${source.y}px`;
    flight.innerHTML = '<i class="hmy-note-flight-aura"></i><i class="hmy-note-flight-core"></i><i class="hmy-note-flight-trail"></i>' +
      `<b>${noteLabel(event.note)}</b>`;
    const satelliteCount = [2, 3, 5][stage - 1];
    for (let index = 0; index < satelliteCount; index++) {
      const satellite = document.createElement("i");
      satellite.className = "hmy-note-flight-satellite";
      const satelliteX = -12 + index * (24 / Math.max(1, satelliteCount - 1)),
        satelliteY = index % 2 ? 8 : -7;
      satellite.style.setProperty("--note-satellite-x", `${satelliteX}px`);
      satellite.style.setProperty("--note-satellite-y", `${satelliteY}px`);
      satellite.style.setProperty("--note-satellite-end-x", `${satelliteX * .28}px`);
      satellite.style.setProperty("--note-satellite-end-y", `${satelliteY * .28}px`);
      satellite.style.setProperty("--note-satellite-delay", `${index * 18}ms`);
      flight.append(satellite);
    }
    effectsLayer().append(flight);
    const animation = flight.animate(
      [
        { opacity: 0, transform: "translate3d(-50%,-50%,0) scale(.8)" },
        {
          opacity: 1,
          transform: `translate3d(calc(-50% + ${dx * 0.46}px), calc(-50% + ${dy * 0.36 - 18}px), 0) scale(1.05)`,
          offset: .48,
        },
        {
          opacity: 1,
          transform: `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0) scale(.92)`,
        },
      ],
      { duration: 230, easing: "cubic-bezier(.18,.72,.24,1)", fill: "forwards" },
    );
    await Promise.race([
      animation.finished.catch(() => {}),
      new Promise((resolve) => window.setTimeout(resolve, 280)),
    ]);
    flight.remove();
  }

  async function showHarmonyProgress(event, sourcePoint = null) {
    if (!event?.note || !Array.isArray(event.afterNotes)) return;
    const finalNotes = event.afterNotes.slice(-3),
      landingIndex = Math.max(0, Math.min(2, finalNotes.length - 1)),
      preLanding = finalNotes.slice(0, landingIndex),
      root = setVisualNotes(preLanding, { ghost: Boolean(event.completed) });
    if (!root) return;
    const targetSlot = slots(root)[landingIndex];
    await flyNote(event, sourcePoint, targetSlot);
    setVisualNotes(finalNotes, { ghost: Boolean(event.completed) });
    const landed = slots(root)[landingIndex];
    root.dataset.progressStage = String(progressStage(event));
    showLandingImpact(event, landed);
    const landingPulse = pulseSlot(
        landed,
        "hmy-note-slot-landed",
        reducedCombatMotion() ? 130 : 190,
      );

    if (finalNotes.length >= 2) {
      const link = root.querySelector(`[data-note-link="${Math.min(1, finalNotes.length - 2)}"]`);
      if (link && combatEffectsEnabled()) {
        link.classList.remove("hmy-note-link-connect");
        void link.offsetWidth;
        link.classList.add("hmy-note-link-connect");
        root.classList.add("hmy-note-progress-linked");
        window.setTimeout(() => {
          link.classList.remove("hmy-note-link-connect");
          root.classList.remove("hmy-note-progress-linked");
        }, 220);
      }
    }

    if (event.completed) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, reducedCombatMotion() ? 24 : 55),
      );
      root.classList.remove(
        "hmy-note-progress-complete",
        "hmy-note-progress-complete-flow",
      );
      void root.offsetWidth;
      root.classList.add(
        "hmy-note-progress-complete",
        "hmy-note-progress-complete-flow",
      );
      if (combatEffectsEnabled()) {
        root.classList.remove("hmy-note-progress-compress");
        void root.offsetWidth;
        root.classList.add("hmy-note-progress-compress");
      }
      await new Promise((resolve) =>
        window.setTimeout(resolve, reducedCombatMotion() ? 90 : 140),
      );
      root.classList.remove(
        "hmy-note-progress-compress",
        "hmy-note-progress-complete-flow",
      );
    } else await landingPulse;
  }

  function showHarmonyResetVfx(event) {
    if (!event?.notes?.length) return Promise.resolve();
    const root = setVisualNotes(event.notes.slice(-3), { ghost: true });
    if (!root) return Promise.resolve();
    const reduced = reducedCombatMotion(),
      duration = reduced ? 180 : 340;

    root.classList.remove("hmy-note-progress-resetting");
    void root.offsetWidth;
    root.classList.add("hmy-note-progress-resetting");
    root.dataset.resetReason = event.reason || "reset";

    if (combatEffectsEnabled() && !reduced) {
      for (const [index, slot] of slots(root).entries()) {
        if (!slot.classList.contains("hmy-note-slot-filled")) continue;
        const rect = slot.getBoundingClientRect(),
          plumeCount = 4;
        for (let plumeIndex = 0; plumeIndex < plumeCount; plumeIndex++) {
          const plume = document.createElement("i"),
            driftX = (plumeIndex - 1.5) * 12 + (index - 1) * 4,
            driftY = -26 - plumeIndex * 10,
            sway = (plumeIndex % 2 ? 1 : -1) * (8 + plumeIndex * 2);
          plume.className = `hmy-note-reset-mote hmy-note-reset-mote-${normalizedNote(slot.dataset.note)}`;
          plume.style.left = `${rect.left + rect.width / 2}px`;
          plume.style.top = `${rect.top + rect.height / 2}px`;
          plume.style.setProperty("--note-reset-x", `${driftX}px`);
          plume.style.setProperty("--note-reset-y", `${driftY}px`);
          plume.style.setProperty("--note-reset-sway", `${sway}px`);
          plume.style.setProperty("--note-reset-delay", `${25 + index * 18 + plumeIndex * 24}ms`);
          plume.style.setProperty("--note-reset-scale", String(0.9 + plumeIndex * 0.11));
          effectsLayer().append(plume);
          removeAfterAnimation(plume, 520);
        }
      }
    }

    return new Promise((resolve) => {
      window.setTimeout(() => {
        setVisualNotes([]);
        root.classList.remove(
          "hmy-note-progress-resetting",
          "hmy-note-progress-ghost",
        );
        delete root.dataset.resetReason;
        resolve();
      }, duration);
    });
  }

  function showHarmonyProgressConsume(event) {
    if (!event?.completed) return Promise.resolve();
    const root = progressRoot();
    if (!root) return Promise.resolve();
    root.classList.add("hmy-note-progress-consuming");
    const filled = slots(root).filter((slot) => slot.classList.contains("hmy-note-slot-filled"));

    if (combatEffectsEnabled() && !reducedCombatMotion()) {
      const rootRect = root.getBoundingClientRect(),
        targetX = rootRect.left + rootRect.width / 2,
        targetY = rootRect.top - 18;
      for (const slot of filled) {
        const rect = slot.getBoundingClientRect(),
          mote = document.createElement("i");
        mote.className = "hmy-note-consume-mote";
        mote.style.left = `${rect.left + rect.width / 2}px`;
        mote.style.top = `${rect.top + rect.height / 2}px`;
        effectsLayer().append(mote);
        const dx = targetX - (rect.left + rect.width / 2),
          dy = targetY - (rect.top + rect.height / 2);
        mote.animate(
          [
            { opacity: .9, transform: "translate(-50%,-50%) scale(1)" },
            { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.2)` },
          ],
          { duration: 230, easing: "cubic-bezier(.35,.02,.55,1)", fill: "forwards" },
        );
        window.setTimeout(() => mote.remove(), 280);
      }
    }

    return new Promise((resolve) => {
      window.setTimeout(() => {
        setVisualNotes([]);
        root.classList.remove(
          "hmy-note-progress-consuming",
          "hmy-note-progress-complete",
          "hmy-note-progress-ghost",
        );
        resolve();
      }, reducedCombatMotion() ? 150 : 250);
    });
  }

  return {
    showHarmonyProgress,
    showHarmonyProgressConsume,
    showHarmonyResetVfx,
  };
}

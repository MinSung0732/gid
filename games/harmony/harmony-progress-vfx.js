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
      flight = document.createElement("span");
    flight.className = `hmy-note-flight hmy-note-flight-${normalizedNote(event.note)}`;
    flight.setAttribute("aria-hidden", "true");
    flight.style.left = `${source.x}px`;
    flight.style.top = `${source.y}px`;
    flight.innerHTML = `<i></i><b>${noteLabel(event.note)}</b>`;
    effectsLayer().append(flight);
    const animation = flight.animate(
      [
        { opacity: 0, transform: "translate3d(-50%,-50%,0) scale(.55)" },
        {
          opacity: 1,
          transform: `translate3d(calc(-50% + ${dx * 0.46}px), calc(-50% + ${dy * 0.36 - 18}px), 0) scale(.92)`,
          offset: .48,
        },
        {
          opacity: 1,
          transform: `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0) scale(.72)`,
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
    await pulseSlot(landed, "hmy-note-slot-landed", reducedCombatMotion() ? 130 : 190);

    if (finalNotes.length >= 2) {
      const link = root.querySelector(`[data-note-link="${Math.min(1, finalNotes.length - 2)}"]`);
      if (link && combatEffectsEnabled()) {
        link.classList.remove("hmy-note-link-connect");
        void link.offsetWidth;
        link.classList.add("hmy-note-link-connect");
        window.setTimeout(() => link.classList.remove("hmy-note-link-connect"), 220);
      }
    }

    if (event.completed) {
      root.classList.remove("hmy-note-progress-complete");
      void root.offsetWidth;
      root.classList.add("hmy-note-progress-complete");
      await new Promise((resolve) => window.setTimeout(resolve, reducedCombatMotion() ? 80 : 120));
    }
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
  };
}

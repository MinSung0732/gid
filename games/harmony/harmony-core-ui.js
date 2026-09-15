const app = document.getElementById("app"),
  desktop = window.matchMedia("(min-width: 901px)"),
  SEQUENCE = ["top", "middle", "base"],
  LABELS = { top: "TOP", middle: "MIDDLE", base: "BASE" },
  RESULT_LABELS = {
    attack: "추가 피해",
    defense: "추가 방어막",
    absorb: "추가 흡수",
    heal: "추가 회복",
  };

let lastHarmonyCount = null,
  completionTimer = null,
  lastCompletionAt = 0;

function normalizeNote(entry) {
  const value = typeof entry === "string" ? entry : entry?.note;
  return typeof value === "string" ? value.toLowerCase() : "";
}

function battleSnapshot(run) {
  const battle = run?.battle;
  if (!run || run.phase !== "battle" || !battle) return null;
  return {
    notes: Array.isArray(battle.notes) ? battle.notes.map(normalizeNote).filter(Boolean) : [],
    harmonyCount: Number(battle.harmoniesThisBattle || 0),
  };
}

function harmonyProgress(notes) {
  const lastThree = notes.slice(-3),
    completed =
      lastThree.length === 3 &&
      lastThree.every((note, index) => note === SEQUENCE[index]);

  if (completed) return { progress: 3, completed: true, next: null };
  if (notes.slice(-2).join(",") === "top,middle")
    return { progress: 2, completed: false, next: "base" };
  if (notes.at(-1) === "top")
    return { progress: 1, completed: false, next: "middle" };
  return { progress: 0, completed: false, next: "top" };
}

function accessibleProgress(state) {
  if (state.completed) return "Harmony 완성: TOP, MIDDLE, BASE 완료";
  const completed = SEQUENCE.slice(0, state.progress).map((note) => LABELS[note]);
  return `Harmony 진행: ${completed.length ? `${completed.join(", ")} 완료, ` : ""}다음 ${LABELS[state.next]}`;
}

function noteState(index, state) {
  if (state.completed) return "is-harmony-completed";
  if (index < state.progress) return "is-completed";
  if (index === state.progress) return "is-next";
  return "is-inactive";
}

function noteMark(index, state) {
  if (state.completed || index < state.progress) return "✓";
  if (index === state.progress) return "◎";
  return "○";
}

function linkState(index, state) {
  if (state.completed || state.progress > index + 1) return "is-completed";
  if (state.progress === index + 1) return "is-next";
  return "is-inactive";
}

function sequenceMarkup(state) {
  const nodes = SEQUENCE.map(
    (note, index) => `<span class="harmony-core-node harmony-note-${note} ${noteState(index, state)}" data-harmony-note="${note}" aria-hidden="true"><small>${LABELS[note]}</small><b>${noteMark(index, state)}</b><em>${!state.completed && index === state.progress ? "NEXT" : ""}</em></span>`,
  );
  return `<span class="harmony-core-sequence" role="img" aria-label="${accessibleProgress(state)}">${nodes[0]}<i class="harmony-core-link ${linkState(0, state)}" aria-hidden="true"></i>${nodes[1]}<i class="harmony-core-link ${linkState(1, state)}" aria-hidden="true"></i>${nodes[2]}<span class="harmony-core-finale ${state.completed ? "is-completed" : ""}" aria-hidden="true"><b>${state.completed ? "HARMONY!" : "HARMONY"}</b><i>✦</i><small class="harmony-core-result"></small></span></span>`;
}

function findHarmonyTerm() {
  const battle = app?.querySelector(".battle");
  if (!battle) return null;
  const upgraded = battle.querySelector(".combat-stats > .harmony-sequence-term");
  if (upgraded) return upgraded;
  return [...battle.querySelectorAll(".combat-stats > .combat-term")].find(
    (term) => term.querySelector(":scope > span:first-child")?.textContent?.trim() === "노트",
  ) || null;
}

function restoreHarmonyTerm() {
  const term = app?.querySelector(".harmony-sequence-term");
  if (!term) return;
  if (term.dataset.harmonyOriginalHtml !== undefined)
    term.innerHTML = term.dataset.harmonyOriginalHtml;
  const originalAria = term.dataset.harmonyOriginalAria;
  if (originalAria) term.setAttribute("aria-label", originalAria);
  else term.removeAttribute("aria-label");
  delete term.dataset.harmonyOriginalHtml;
  delete term.dataset.harmonyOriginalAria;
  delete term.dataset.harmonySignature;
  term.classList.remove("harmony-sequence-term", "harmony-just-completed");
}

function syncHand(next) {
  const hand = app?.querySelector(".battle > .hand");
  if (!hand) return;
  hand.querySelectorAll(".harmony-next-card").forEach((card) =>
    card.classList.remove("harmony-next-card"),
  );
  if (!next) return;
  hand.querySelectorAll(`.card.note-${next}`).forEach((card) =>
    card.classList.add("harmony-next-card"),
  );
}

function renderHarmony(snapshot) {
  const term = findHarmonyTerm();
  if (!term || !snapshot) return;
  const state = harmonyProgress(snapshot.notes),
    signature = `${snapshot.notes.slice(-3).join(",")}|${snapshot.harmonyCount}`;

  if (!term.classList.contains("harmony-sequence-term")) {
    term.dataset.harmonyOriginalHtml = term.innerHTML;
    term.dataset.harmonyOriginalAria = term.getAttribute("aria-label") || "";
    term.classList.add("harmony-sequence-term");
  }

  if (term.dataset.harmonySignature !== signature) {
    term.innerHTML = sequenceMarkup(state);
    term.dataset.harmonySignature = signature;
    term.setAttribute("aria-label", accessibleProgress(state));
  }
  syncHand(state.next);

  if (lastHarmonyCount !== null && snapshot.harmonyCount > lastHarmonyCount)
    playCompletionFeedback();
  lastHarmonyCount = snapshot.harmonyCount;
}

function feedbackCategory(node) {
  if (!(node instanceof Element)) return null;
  const resonance = node.matches(".harmony-resonance")
    ? node
    : node.querySelector?.(".harmony-resonance");
  if (!resonance) return null;
  return Object.keys(RESULT_LABELS).find((key) =>
    resonance.classList.contains(`harmony-resonance-${key}`),
  ) || "default";
}

function setResultLabel(term, category) {
  const result = term.querySelector(".harmony-core-result");
  if (result && RESULT_LABELS[category]) result.textContent = RESULT_LABELS[category];
  return result;
}

function playCompletionFeedback(category = null) {
  if (!desktop.matches) return;
  const term = app?.querySelector(".harmony-sequence-term");
  if (!term) return;
  const now = performance.now(),
    result = setResultLabel(term, category);

  if (term.classList.contains("harmony-just-completed")) return;
  if (category && now - lastCompletionAt < 1400) {
    if (result)
      window.setTimeout(() => {
        if (!term.classList.contains("harmony-just-completed")) result.textContent = "";
      }, 480);
    return;
  }

  lastCompletionAt = now;
  window.clearTimeout(completionTimer);
  term.classList.remove("harmony-just-completed");
  void term.offsetWidth;
  term.classList.add("harmony-just-completed");
  completionTimer = window.setTimeout(() => {
    term.classList.remove("harmony-just-completed");
    const current = term.querySelector(".harmony-core-result");
    if (current) current.textContent = "";
  }, 760);
}

export function syncHarmonyUi(run) {
  if (!app) return;
  if (!desktop.matches) {
    restoreHarmonyTerm();
    app.querySelectorAll(".harmony-next-card").forEach((card) =>
      card.classList.remove("harmony-next-card"),
    );
    lastHarmonyCount = null;
    return;
  }
  const snapshot = battleSnapshot(run);
  if (!snapshot) {
    lastHarmonyCount = null;
    return;
  }
  renderHarmony(snapshot);
}

// Harmony result feedback is a transient VFX created outside the regular #app
// render lifecycle. Keep this narrow observer so the existing attack/defense/
// absorb/heal result label can accompany the already-existing resonance VFX.
new MutationObserver((mutations) => {
  if (!desktop.matches) return;
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      const category = feedbackCategory(node);
      if (category) playCompletionFeedback(category);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

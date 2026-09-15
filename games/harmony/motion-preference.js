(() => {
  const STORAGE_KEY = "harmony_motion_mode";
  const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
  const MODES = new Set(["system", "full", "reduce"]);
  const nativeMatchMedia = typeof window.matchMedia === "function"
    ? window.matchMedia.bind(window)
    : null;
  const systemMedia = nativeMatchMedia?.(REDUCED_QUERY) || null;
  const mediaListeners = new Set();
  const subscribers = new Set();
  const originalMediaText = new WeakMap();
  let onchange = null;

  function readStoredMode() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return MODES.has(stored) ? stored : "system";
    } catch {
      return "system";
    }
  }

  let mode = readStoredMode();
  let lastEffectiveReduced = false;

  function systemReduced() {
    return Boolean(systemMedia?.matches);
  }

  function effectiveReduced() {
    if (mode === "full") return false;
    if (mode === "reduce") return true;
    return systemReduced();
  }

  function normalizeQuery(query) {
    return String(query || "").replace(/\s+/g, "").toLowerCase();
  }

  function isReducedMotionRule(rule) {
    const mediaText = rule?.media?.mediaText || "";
    return /prefers-reduced-motion\s*:\s*reduce/i.test(mediaText);
  }

  function visitRules(rules) {
    if (!rules) return;
    for (const rule of rules) {
      try {
        if (rule?.media) {
          if (!originalMediaText.has(rule) && isReducedMotionRule(rule))
            originalMediaText.set(rule, rule.media.mediaText);
          if (originalMediaText.has(rule)) {
            const original = originalMediaText.get(rule);
            rule.media.mediaText = mode === "full"
              ? "not all"
              : mode === "reduce"
                ? "all"
                : original;
          }
        }
        if (rule?.cssRules) visitRules(rule.cssRules);
      } catch {
        // Ignore stylesheets/rules whose CSSOM is not readable.
      }
    }
  }

  function applyCssMotionMode() {
    for (const sheet of document.styleSheets) {
      try {
        visitRules(sheet.cssRules);
      } catch {
        // Same-origin Harmony styles are readable; ignore any external sheet.
      }
    }
  }

  function updateDataset() {
    const reduced = effectiveReduced();
    document.documentElement.dataset.harmonyMotion = mode;
    document.documentElement.dataset.reducedMotion = reduced ? "reduce" : "no-preference";
    document.documentElement.dataset.systemReducedMotion = systemReduced() ? "reduce" : "no-preference";
  }

  function createChangeEvent(matches) {
    try {
      return new MediaQueryListEvent("change", {
        media: REDUCED_QUERY,
        matches,
      });
    } catch {
      const event = new Event("change");
      Object.defineProperties(event, {
        media: { value: REDUCED_QUERY },
        matches: { value: matches },
      });
      return event;
    }
  }

  function callListener(listener, event) {
    if (typeof listener === "function") listener.call(effectiveMedia, event);
    else listener?.handleEvent?.(event);
  }

  const effectiveMedia = {
    get matches() {
      return effectiveReduced();
    },
    media: REDUCED_QUERY,
    get onchange() {
      return onchange;
    },
    set onchange(listener) {
      onchange = typeof listener === "function" ? listener : null;
    },
    addEventListener(type, listener) {
      if (type === "change" && listener) mediaListeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "change") mediaListeners.delete(listener);
    },
    addListener(listener) {
      if (listener) mediaListeners.add(listener);
    },
    removeListener(listener) {
      mediaListeners.delete(listener);
    },
    dispatchEvent(event) {
      for (const listener of [...mediaListeners]) callListener(listener, event);
      if (onchange) onchange.call(effectiveMedia, event);
      return true;
    },
  };

  function syncMotionState({ notify = true } = {}) {
    applyCssMotionMode();
    updateDataset();
    const reduced = effectiveReduced();
    if (reduced !== lastEffectiveReduced) {
      lastEffectiveReduced = reduced;
      effectiveMedia.dispatchEvent(createChangeEvent(reduced));
    }
    if (notify) {
      const snapshot = Object.freeze({
        mode,
        reduced,
        systemReduced: systemReduced(),
      });
      for (const subscriber of [...subscribers]) subscriber(snapshot);
      window.dispatchEvent(new CustomEvent("harmony-motion-change", { detail: snapshot }));
    }
  }

  function setMode(nextMode) {
    if (!MODES.has(nextMode)) return mode;
    mode = nextMode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Keep the setting for this page even if storage is unavailable.
    }
    syncMotionState();
    return mode;
  }

  if (nativeMatchMedia) {
    window.matchMedia = (query) =>
      normalizeQuery(query) === normalizeQuery(REDUCED_QUERY)
        ? effectiveMedia
        : nativeMatchMedia(query);
  }

  if (systemMedia?.addEventListener)
    systemMedia.addEventListener("change", () => syncMotionState());
  else systemMedia?.addListener?.(() => syncMotionState());

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    const nextMode = MODES.has(event.newValue) ? event.newValue : "system";
    if (nextMode === mode) return;
    mode = nextMode;
    syncMotionState();
  });

  for (const link of document.querySelectorAll('link[rel="stylesheet"]'))
    link.addEventListener("load", () => applyCssMotionMode(), { once: true });

  window.HarmonyMotionState = Object.freeze({
    query: REDUCED_QUERY,
    getMode: () => mode,
    setMode,
    isReduced: effectiveReduced,
    systemReduced,
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    refresh: () => syncMotionState(),
  });

  lastEffectiveReduced = effectiveReduced();
  syncMotionState({ notify: false });
})();

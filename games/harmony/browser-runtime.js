function defaultWindow() {
  return typeof window === "undefined" ? null : window;
}

function defaultLocation(windowRef) {
  if (typeof location !== "undefined") return location;
  return windowRef?.location || null;
}

function defaultHistory(windowRef) {
  if (typeof history !== "undefined") return history;
  return windowRef?.history || null;
}

function defaultCrypto(windowRef) {
  if (typeof crypto !== "undefined") return crypto;
  return windowRef?.crypto || null;
}

function defaultCustomEvent(windowRef) {
  if (typeof CustomEvent !== "undefined") return CustomEvent;
  return windowRef?.CustomEvent || null;
}

export function createBrowserRuntime({
  windowRef = defaultWindow(),
  locationRef = defaultLocation(windowRef),
  historyRef = defaultHistory(windowRef),
  cryptoRef = defaultCrypto(windowRef),
  CustomEventCtor = defaultCustomEvent(windowRef),
} = {}) {
  function localStorageRef() {
    return windowRef?.localStorage ?? null;
  }

  function currentUrl() {
    return locationRef?.href ? new URL(locationRef.href) : null;
  }

  function replaceUrl(url) {
    if (!url || !historyRef?.replaceState) return false;
    historyRef.replaceState(
      historyRef.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    return true;
  }

  function reload() {
    locationRef?.reload?.();
  }

  function randomUint32() {
    if (!cryptoRef?.getRandomValues) throw new Error("crypto.getRandomValues is unavailable");
    return cryptoRef.getRandomValues(new Uint32Array(1))[0];
  }

  function randomUUID() {
    if (!cryptoRef?.randomUUID) throw new Error("crypto.randomUUID is unavailable");
    return cryptoRef.randomUUID();
  }

  function dispatch(type, detail) {
    if (!windowRef?.dispatchEvent || !CustomEventCtor) return false;
    windowRef.dispatchEvent(new CustomEventCtor(type, { detail }));
    return true;
  }

  function onOnline(callback) {
    if (!windowRef?.addEventListener) return () => {};
    windowRef.addEventListener("online", callback);
    return () => windowRef.removeEventListener?.("online", callback);
  }

  function prefersReducedMotion() {
    return Boolean(
      windowRef?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    );
  }

  function getHarmonyRuntime() {
    return windowRef?.HarmonyRuntime || null;
  }

  function setHarmonyRuntime(runtime) {
    if (windowRef) windowRef.HarmonyRuntime = runtime;
    return runtime;
  }

  return Object.freeze({
    currentUrl,
    dispatch,
    getHarmonyRuntime,
    hostname: () => locationRef?.hostname || "",
    localStorage: localStorageRef,
    onOnline,
    origin: () => locationRef?.origin || "",
    prefersReducedMotion,
    randomUint32,
    randomUUID,
    reload,
    replaceUrl,
    setHarmonyRuntime,
  });
}

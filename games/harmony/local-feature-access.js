export const LOCAL_FEATURE_KEY = "harmony_local_features";

export const LOCAL_FEATURE_HOSTS = Object.freeze([
  "localhost",
  "127.0.0.1",
  "::1",
  "192.168.0.8",
]);

function browserHostname() {
  try {
    return globalThis.location?.hostname || globalThis.window?.location?.hostname || "";
  } catch {
    return "";
  }
}

function browserStorage() {
  try {
    return globalThis.localStorage || globalThis.window?.localStorage || null;
  } catch {
    return null;
  }
}

function browserUrl() {
  try {
    const href = globalThis.location?.href || globalThis.window?.location?.href;
    return href ? new URL(href) : null;
  } catch {
    return null;
  }
}

function replaceBrowserUrl(url) {
  try {
    const historyRef = globalThis.history || globalThis.window?.history;
    if (!historyRef?.replaceState) return false;
    historyRef.replaceState(
      historyRef.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    return true;
  } catch {
    return false;
  }
}

export function hasLocalFeatureAccess({
  hostname = browserHostname(),
  storage = browserStorage(),
} = {}) {
  if (LOCAL_FEATURE_HOSTS.includes(hostname)) return true;
  try {
    return storage?.getItem(LOCAL_FEATURE_KEY) === "true";
  } catch {
    return false;
  }
}

export function applyLocalFeatureQuery({
  url = browserUrl(),
  storage = browserStorage(),
  replaceUrl = replaceBrowserUrl,
} = {}) {
  const request = url?.searchParams?.get("local") ?? null;
  if (request !== "1" && request !== "0") return false;

  try {
    if (request === "1") storage?.setItem(LOCAL_FEATURE_KEY, "true");
    else storage?.removeItem(LOCAL_FEATURE_KEY);
  } catch {}

  url.searchParams.delete("local");
  replaceUrl?.(url);
  return true;
}

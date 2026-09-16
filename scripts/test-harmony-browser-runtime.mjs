import assert from "node:assert/strict";
import fs from "node:fs";
import { createBrowserRuntime } from "../games/harmony/browser-runtime.js";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

class FakeCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

{
  const storage = new MemoryStorage();
  const listeners = new Map();
  const dispatched = [];
  let reloads = 0;
  const windowRef = {
    localStorage: storage,
    HarmonyRuntime: null,
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) {
      if (listeners.get(type) === callback) listeners.delete(type);
    },
    dispatchEvent(event) { dispatched.push(event); return true; },
    matchMedia(query) {
      assert.equal(query, "(prefers-reduced-motion: reduce)");
      return { matches: true };
    },
  };
  const locationRef = {
    href: "http://localhost:5173/games/harmony/?local=1#error=test",
    hostname: "localhost",
    origin: "http://localhost:5173",
    reload() { reloads += 1; },
  };
  const replacements = [];
  const historyRef = {
    state: { page: 1 },
    replaceState(state, title, url) { replacements.push({ state, title, url }); },
  };
  const cryptoRef = {
    randomUUID: () => "00000000-0000-4000-8000-000000000001",
    getRandomValues(array) { array[0] = 424242; return array; },
  };
  const runtime = createBrowserRuntime({
    windowRef,
    locationRef,
    historyRef,
    cryptoRef,
    CustomEventCtor: FakeCustomEvent,
  });

  assert.equal(runtime.localStorage(), storage);
  assert.equal(runtime.hostname(), "localhost");
  assert.equal(runtime.origin(), "http://localhost:5173");
  assert.equal(runtime.currentUrl().searchParams.get("local"), "1");

  const nextUrl = runtime.currentUrl();
  nextUrl.searchParams.delete("local");
  assert.equal(runtime.replaceUrl(nextUrl), true);
  assert.deepEqual(replacements, [{
    state: { page: 1 },
    title: "",
    url: "/games/harmony/#error=test",
  }]);

  assert.equal(runtime.randomUUID(), "00000000-0000-4000-8000-000000000001");
  assert.equal(runtime.randomUint32(), 424242);
  assert.equal(runtime.prefersReducedMotion(), true);

  runtime.dispatch("harmony:test", { ready: true });
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, "harmony:test");
  assert.deepEqual(dispatched[0].detail, { ready: true });

  let onlineCalls = 0;
  const removeOnline = runtime.onOnline(() => { onlineCalls += 1; });
  listeners.get("online")();
  assert.equal(onlineCalls, 1);
  removeOnline();
  assert.equal(listeners.has("online"), false);

  runtime.reload();
  assert.equal(reloads, 1);

  const harmonyRuntime = Object.freeze({ scope: "guest" });
  assert.equal(runtime.setHarmonyRuntime(harmonyRuntime), harmonyRuntime);
  assert.equal(runtime.getHarmonyRuntime(), harmonyRuntime);
}

{
  const runtime = createBrowserRuntime({
    windowRef: null,
    locationRef: null,
    historyRef: null,
    cryptoRef: null,
    CustomEventCtor: null,
  });
  assert.equal(runtime.localStorage(), null);
  assert.equal(runtime.currentUrl(), null);
  assert.equal(runtime.replaceUrl(null), false);
  assert.equal(runtime.dispatch("missing", null), false);
  assert.equal(runtime.prefersReducedMotion(), false);
  assert.doesNotThrow(() => runtime.reload());
  assert.doesNotThrow(() => runtime.onOnline(() => {})());
  assert.throws(() => runtime.randomUUID(), /unavailable/);
  assert.throws(() => runtime.randomUint32(), /unavailable/);
}

const bootstrapSource = fs.readFileSync(new URL("../games/harmony/bootstrap.js", import.meta.url), "utf8");
const authSource = fs.readFileSync(new URL("../games/harmony/auth.js", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../games/harmony/main.js", import.meta.url), "utf8");

for (const [label, source] of [["bootstrap", bootstrapSource], ["auth", authSource], ["main", mainSource]]) {
  assert.match(source, /createBrowserRuntime/, `${label} should use the browser runtime boundary`);
}

assert.doesNotMatch(bootstrapSource, /window\.localStorage|history\.replaceState|location\.reload|window\.dispatchEvent|window\.addEventListener\("online"|crypto\.(?:randomUUID|getRandomValues)|window\.HarmonyRuntime/);
assert.doesNotMatch(authSource, /location\.(?:hostname|origin)/);
assert.doesNotMatch(mainSource, /new URL\(location\.href\)|history\.replaceState|window\.localStorage|window\.matchMedia|crypto\.(?:randomUUID|getRandomValues)|window\.HarmonyRuntime/);

console.log("Harmony browser runtime boundary tests passed.");

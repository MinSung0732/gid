import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  LOCAL_FEATURE_KEY,
  applyLocalFeatureQuery,
  hasLocalFeatureAccess,
} from "../games/harmony/local-feature-access.js";
import {
  ACT7_ROUTES,
  CAMPAIGN_LOOPS,
  clearRequestedCampaignStart,
  consumeRequestedCampaignStart,
  requestLocalTestCampaignStart,
} from "../games/harmony/campaign-progression.js";
import { RECOMMENDED_STARTING_DECK } from "../games/harmony/data.js";
import { newRun } from "../games/harmony/engine.js";

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

for (const hostname of ["localhost", "127.0.0.1", "::1", "192.168.0.8"])
  assert.equal(hasLocalFeatureAccess({ hostname, storage: memoryStorage() }), true, `${hostname} should allow LOCAL features`);

const persisted = memoryStorage({ [LOCAL_FEATURE_KEY]: "true" });
assert.equal(hasLocalFeatureAccess({ hostname: "example.test", storage: persisted }), true);
assert.equal(hasLocalFeatureAccess({ hostname: "example.test", storage: memoryStorage() }), false);

{
  const storage = memoryStorage(),
    url = new URL("https://example.test/harmony/?local=1&keep=yes#cards");
  let replaced = null;
  assert.equal(applyLocalFeatureQuery({ url, storage, replaceUrl: (next) => { replaced = next.toString(); } }), true);
  assert.equal(storage.getItem(LOCAL_FEATURE_KEY), "true");
  assert.equal(hasLocalFeatureAccess({ hostname: "example.test", storage }), true);
  assert.equal(replaced, "https://example.test/harmony/?keep=yes#cards");
}

{
  const storage = memoryStorage({ [LOCAL_FEATURE_KEY]: "true" }),
    url = new URL("https://example.test/harmony/?local=0&keep=yes");
  let replaced = null;
  assert.equal(applyLocalFeatureQuery({ url, storage, replaceUrl: (next) => { replaced = next.toString(); } }), true);
  assert.equal(storage.getItem(LOCAL_FEATURE_KEY), null);
  assert.equal(hasLocalFeatureAccess({ hostname: "example.test", storage }), false);
  assert.equal(hasLocalFeatureAccess({ hostname: "localhost", storage }), true, "local=0 clears only the persisted override");
  assert.equal(replaced, "https://example.test/harmony/?keep=yes");
}

{
  const storage = memoryStorage(),
    url = new URL("https://example.test/harmony/?local=abc&keep=yes");
  let replacements = 0;
  assert.equal(applyLocalFeatureQuery({ url, storage, replaceUrl: () => { replacements += 1; } }), false);
  assert.equal(storage.getItem(LOCAL_FEATURE_KEY), null);
  assert.equal(replacements, 0);
  assert.equal(url.searchParams.get("local"), "abc");
}

const previousGlobals = {
  location: globalThis.location,
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
};
try {
  globalThis.location = { hostname: "example.test" };
  globalThis.localStorage = persisted;
  globalThis.sessionStorage = memoryStorage();

  for (const loop of [
    CAMPAIGN_LOOPS.ACT1,
    CAMPAIGN_LOOPS.ACT2,
    CAMPAIGN_LOOPS.ACT3,
    CAMPAIGN_LOOPS.ACT4,
    CAMPAIGN_LOOPS.ACT5,
    CAMPAIGN_LOOPS.ACT6,
  ]) {
    assert.equal(requestLocalTestCampaignStart(loop), true);
    assert.deepEqual(consumeRequestedCampaignStart(), { loop, route: null });
  }
  assert.deepEqual(consumeRequestedCampaignStart(), { loop: CAMPAIGN_LOOPS.ACT1, route: null }, "LOCAL starts should remain one-shot");
  assert.equal(requestLocalTestCampaignStart(CAMPAIGN_LOOPS.ACT7, ACT7_ROUTES.FLESH), true);
  assert.deepEqual(consumeRequestedCampaignStart(), { loop: CAMPAIGN_LOOPS.ACT7, route: ACT7_ROUTES.FLESH });
  assert.equal(requestLocalTestCampaignStart(CAMPAIGN_LOOPS.ACT7, ACT7_ROUTES.HEAT), true);
  assert.deepEqual(consumeRequestedCampaignStart(), { loop: CAMPAIGN_LOOPS.ACT7, route: ACT7_ROUTES.HEAT });
  assert.equal(requestLocalTestCampaignStart(CAMPAIGN_LOOPS.ACT7, ACT7_ROUTES.RESONANCE), true);
  assert.deepEqual(consumeRequestedCampaignStart(), { loop: CAMPAIGN_LOOPS.ACT7, route: ACT7_ROUTES.RESONANCE });
  assert.equal(requestLocalTestCampaignStart(CAMPAIGN_LOOPS.ABYSS_START), true);
  assert.deepEqual(consumeRequestedCampaignStart(), { loop: CAMPAIGN_LOOPS.ABYSS_START, route: null });

  for (const { loop, route = null } of [
    { loop: CAMPAIGN_LOOPS.ACT2 },
    { loop: CAMPAIGN_LOOPS.ACT4 },
    { loop: CAMPAIGN_LOOPS.ACT7, route: ACT7_ROUTES.FLESH },
    { loop: CAMPAIGN_LOOPS.ACT7, route: ACT7_ROUTES.HEAT },
    { loop: CAMPAIGN_LOOPS.ACT7, route: ACT7_ROUTES.RESONANCE },
    { loop: CAMPAIGN_LOOPS.ABYSS_START },
  ]) {
    assert.equal(requestLocalTestCampaignStart(loop, route), true);
    const run = newRun(1234, RECOMMENDED_STARTING_DECK, {});
    assert.equal(run.loop, loop);
    assert.equal(run.act7Route, route);
    assert.deepEqual(run.deck.map((card) => card.id), RECOMMENDED_STARTING_DECK, "LOCAL act starts must preserve the selected deck");
  }

  globalThis.localStorage = memoryStorage();
  assert.equal(requestLocalTestCampaignStart(CAMPAIGN_LOOPS.ACT2), false);
  clearRequestedCampaignStart();
} finally {
  for (const [key, value] of Object.entries(previousGlobals)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
}

const sources = await Promise.all([
  "main.js",
  "local-test-act-starts.js",
  "campaign-progression.js",
].map((name) => readFile(new URL(`../games/harmony/${name}`, import.meta.url), "utf8")));
for (const source of sources)
  assert.match(source, /local-feature-access\.js/, "every LOCAL feature consumer should use the canonical helper");
assert.equal(sources.join("\n").match(/harmony_local_features/g)?.length || 0, 0, "the storage key should only be defined by the helper");
assert.doesNotMatch(sources.join("\n"), /\b(?:LOCAL_HOSTS|LOCAL_TEST_HOSTS)\b/, "LOCAL host policy should not be duplicated");

function classList(...initial) {
  const values = new Set(initial);
  return {
    contains(value) { return values.has(value); },
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
  };
}

async function loadActStartUi({ access, testMode, token }) {
  const storage = memoryStorage(access ? { [LOCAL_FEATURE_KEY]: "true" } : {}),
    session = memoryStorage(),
    listeners = new Map(),
    windowListeners = new Map(),
    styles = [],
    originalStart = {
      disabled: false,
      hidden: false,
      clickCalls: 0,
      before(node) { dialog.panel = node; },
      click() { this.clickCalls += 1; },
    },
    dialog = {
      panel: null,
      classList: classList(...(testMode ? ["test-mode"] : [])),
      querySelector(selector) {
        if (selector === "#builder-start") return originalStart;
        if (selector === "#builder-test-act-starts") return this.panel;
        return null;
      },
    };

  function makePanel() {
    let markup = "";
    return {
      id: "",
      className: "",
      buttons: [],
      set innerHTML(value) {
        markup = value;
        this.buttons = [...value.matchAll(/<button[^>]*data-loop="(\d+)"(?: data-route="([^"]+)")?[^>]*><strong>([^<]+)<\/strong>/g)]
          .map((match) => ({
            dataset: { loop: match[1], ...(match[2] ? { route: match[2] } : {}) },
            label: match[3],
            disabled: false,
            closest(selector) {
              if (selector === "[data-local-test-start]") return this;
              if (selector === "#starting-deck-builder.test-mode") return dialog;
              return null;
            },
          }));
      },
      get innerHTML() { return markup; },
      querySelectorAll(selector) { return selector === "[data-local-test-start]" ? this.buttons : []; },
      remove() { dialog.panel = null; },
    };
  }

  const documentRef = {
    documentElement: {},
    head: { append(node) { styles.push(node); } },
    getElementById(id) {
      if (id === "starting-deck-builder") return dialog;
      if (id === "harmony-local-test-act-starts-style") return styles.find((node) => node.id === id) || null;
      return null;
    },
    createElement(tag) { return tag === "div" ? makePanel() : { id: "", textContent: "" }; },
    addEventListener(type, handler) { listeners.set(type, handler); },
  };

  const saved = {
    document: globalThis.document,
    window: globalThis.window,
    location: globalThis.location,
    history: globalThis.history,
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
    MutationObserver: globalThis.MutationObserver,
  };
  globalThis.document = documentRef;
  globalThis.window = { localStorage: storage, location: null, addEventListener(type, handler) { windowListeners.set(type, handler); } };
  globalThis.location = { hostname: "example.test", href: "https://example.test/harmony/" };
  globalThis.history = { state: null, replaceState() {} };
  globalThis.localStorage = storage;
  globalThis.sessionStorage = session;
  globalThis.MutationObserver = class { observe() {} };

  await import(`../games/harmony/local-test-act-starts.js?ui-case=${token}`);
  await Promise.resolve();
  return {
    dialog,
    originalStart,
    listeners,
    session,
    restore() {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    },
  };
}

{
  const ui = await loadActStartUi({ access: true, testMode: true, token: "enabled-test" });
  assert.ok(ui.dialog.panel, "LOCAL test-mode builder should show START AREA");
  assert.equal(ui.dialog.panel.buttons.length, 10);
  assert.deepEqual(
    ui.dialog.panel.buttons.map((button) => button.label),
    ["1막", "2막", "3막", "4막", "5막", "6막", "7-1", "7-2", "7-3", "심연 1"],
  );
  assert.equal(ui.originalStart.hidden, true);

  const selectedDeck = ["card-a", "card-b"],
    selectedItems = ["item-a"];
  ui.originalStart.click = () => {
    ui.originalStart.clickCalls += 1;
    assert.deepEqual(selectedDeck, ["card-a", "card-b"]);
    assert.deepEqual(selectedItems, ["item-a"]);
  };
  const act4 = ui.dialog.panel.buttons.find((button) => button.label === "4막");
  ui.listeners.get("click")({ target: act4, preventDefault() {}, stopPropagation() {} });
  assert.equal(ui.originalStart.clickCalls, 1, "act start should reuse the original builder start path");
  assert.equal(ui.session.getItem("harmony_campaign_start_loop"), String(CAMPAIGN_LOOPS.ACT4));
  ui.restore();
}

{
  const ui = await loadActStartUi({ access: true, testMode: false, token: "enabled-normal" });
  assert.equal(ui.dialog.panel, null, "normal builder should not show START AREA");
  assert.equal(ui.originalStart.hidden, false);
  ui.restore();
}

{
  const ui = await loadActStartUi({ access: false, testMode: true, token: "disabled-test" });
  assert.equal(ui.dialog.panel, null, "test-mode class alone must not expose LOCAL controls");
  assert.equal(ui.listeners.has("click"), false);
  ui.restore();
}

console.log("PASS Harmony LOCAL feature access, query persistence, and campaign start requests share one policy.");

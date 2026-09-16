import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freshMeta, newRun } from "../games/harmony/engine.js";
import {
  createPersistenceRuntime,
  loadRuntimeGame,
} from "../games/harmony/persistence-runtime.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

const mainSource = readFileSync(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const economySource = readFileSync(new URL("../games/harmony/economy-ui.js", import.meta.url), "utf8");
const impuritySource = readFileSync(new URL("../games/harmony/impurity-ui.js", import.meta.url), "utf8");

assert.match(mainSource, /createPersistenceRuntime/);
assert.doesNotMatch(mainSource, /from "\.\/persistence\.js/);
assert.doesNotMatch(mainSource, /HarmonyRuntime\?\.cloudSync/);
assert.doesNotMatch(mainSource, /HarmonyRuntime\?\.runHistory/);
assert.match(economySource, /loadRuntimeGame\(\)\.run/);
assert.match(impuritySource, /loadRuntimeGame\(\)\.run/);
assert.doesNotMatch(economySource, /HarmonyRuntime\?\.storage \|\| localStorage/);
assert.doesNotMatch(impuritySource, /HarmonyRuntime\?\.storage \|\| localStorage/);

const fallbackStorage = new MemoryStorage();
const fallback = createPersistenceRuntime({
  runtime: null,
  fallbackStorage,
});
assert.equal(fallback.loaded.run, null);
assert.equal(fallback.revision, 0);
assert.equal(fallback.save({ meta: freshMeta(), run: null }), 1);
assert.equal(fallback.revision, 1);
assert.equal(loadRuntimeGame({ runtime: null, fallbackStorage }).revision, 1);

const runtimeStorage = new MemoryStorage();
const cloudCalls = [];
const historyCalls = [];
const runtime = {
  storage: runtimeStorage,
  cloudSync: {
    schedule(payload, revision) {
      cloudCalls.push({ payload, revision });
    },
  },
  runHistory: {
    record(run, record) {
      historyCalls.push({ run, record });
      return Promise.resolve();
    },
  },
};
const bridge = createPersistenceRuntime({
  runtime,
  fallbackStorage: new MemoryStorage(),
  historyRecord: () => ({ score: 777, source: "history-record" }),
});
const meta = freshMeta();
const run = newRun(501, null, meta);
run.finished = true;
run.runId = "runtime-boundary-test";
run.score = 777;

assert.equal(bridge.save({ meta, run }), 1);
assert.equal(bridge.revision, 1);
assert.equal(cloudCalls.length, 1);
assert.equal(cloudCalls[0].revision, 1);
assert.equal(cloudCalls[0].payload.run.score, 777);
assert.equal(historyCalls.length, 1);
assert.equal(historyCalls[0].run, run);
assert.deepEqual(historyCalls[0].record, { score: 777, source: "history-record" });
assert.equal(bridge.reload().run.runId, "runtime-boundary-test");
assert.equal(loadRuntimeGame({ runtime, fallbackStorage: new MemoryStorage() }).run.runId, "runtime-boundary-test");

const throwingStorage = new MemoryStorage();
const throwingBridge = createPersistenceRuntime({
  runtime: {
    storage: throwingStorage,
    cloudSync: {
      schedule() {
        throw new Error("cloud schedule failed");
      },
    },
  },
  fallbackStorage: new MemoryStorage(),
});
assert.throws(
  () => throwingBridge.save({ meta: freshMeta(), run: null }),
  /cloud schedule failed/,
);
assert.equal(throwingBridge.revision, 1);
assert.equal(throwingBridge.reload().revision, 1);

console.log("Harmony persistence runtime tests passed");

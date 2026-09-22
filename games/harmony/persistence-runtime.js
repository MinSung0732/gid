import {
  loadGame,
  normalizeGamePayload,
  saveGame,
} from "./persistence.js?v=20260920-poison-3";

function browserRuntime() {
  return typeof window === "undefined" ? null : window.HarmonyRuntime || null;
}

function browserStorage() {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function resolveStorage(runtime, fallbackStorage) {
  const storage = runtime?.storage || fallbackStorage;
  if (!storage) throw new Error("Harmony persistence storage is unavailable");
  return storage;
}

export function loadRuntimeGame({
  runtime = browserRuntime(),
  fallbackStorage = browserStorage(),
} = {}) {
  return loadGame(resolveStorage(runtime, fallbackStorage));
}

export function createPersistenceRuntime({
  runtime = browserRuntime(),
  fallbackStorage = browserStorage(),
  historyRecord = null,
} = {}) {
  const storage = resolveStorage(runtime, fallbackStorage),
    loaded = loadGame(storage);
  let revision = loaded.revision;

  return {
    storage,
    loaded,
    get revision() {
      return revision;
    },
    reload() {
      return loadGame(storage);
    },
    save({ meta, run }) {
      const payload = normalizeGamePayload({ meta, run });
      if (!payload) throw new Error("Invalid save data");

      // Keep the local revision authoritative even when a later optional
      // cloud/history side effect fails synchronously.
      revision = saveGame(storage, payload, revision);

      if (runtime?.cloudSync)
        runtime.cloudSync.schedule(payload, revision);
      if (run?.finished && run.runId && runtime?.runHistory)
        void runtime.runHistory.record(
          run,
          typeof historyRecord === "function" ? historyRecord() : null,
        );

      return revision;
    },
  };
}

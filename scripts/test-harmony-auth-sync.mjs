import assert from "node:assert/strict";
import {
  SAVE_KEYS,
  loadGame,
  normalizeGamePayload,
  saveGame,
} from "../games/harmony/persistence.js";
import {
  GUEST_SCOPE,
  createScopedStorage,
  migrateUnscopedGuestSave,
  scopedKey,
} from "../games/harmony/scoped-storage.js";
import {
  createCloudSyncController,
  samePayload,
  updatePlayerState,
} from "../games/harmony/cloud-sync.js";
import { buildRunResultRow } from "../games/harmony/run-history.js";
import { enter, freshMeta, newRun } from "../games/harmony/engine.js";
import { getAuthRedirectUrl } from "../games/harmony/auth.js";
import { SUPABASE_MODULE_URL } from "../games/harmony/supabase-client.js";

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

function state(seed = 1) {
  return { meta: freshMeta(), run: newRun(seed, null, freshMeta()) };
}

function updateClient({ row = null, error = null } = {}) {
  const calls = { table: null, update: null, eq: [] };
  const builder = {
    update(value) { calls.update = value; return this; },
    eq(key, value) { calls.eq.push([key, value]); return this; },
    select() { return this; },
    async maybeSingle() { return { data: row, error }; },
  };
  return {
    calls,
    client: {
      from(table) { calls.table = table; return builder; },
    },
  };
}

{
  const originalLocation = globalThis.location;
  try {
    globalThis.location = new URL("http://127.0.0.1:5173/games/harmony/");
    assert.equal(getAuthRedirectUrl(), "http://127.0.0.1:5173/games/harmony/");
    globalThis.location = new URL("http://localhost:5173/games/harmony/");
    assert.equal(getAuthRedirectUrl(), "http://localhost:5173/games/harmony/");
    globalThis.location = new URL("https://minsung0732.github.io/gid/games/harmony/");
    assert.equal(
      getAuthRedirectUrl(),
      "https://minsung0732.github.io/gid/games/harmony/",
    );
  } finally {
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  }
}

assert.equal(
  SUPABASE_MODULE_URL,
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm",
  "Supabase CDN dependency must stay pinned to the verified exact version",
);

{
  const raw = new MemoryStorage();
  const runtimeMeta = freshMeta();
  const runtimeRun = newRun(1234, null, runtimeMeta);
  runtimeRun.route[0] = "battle";
  runtimeRun.resolvedRooms[0] = null;
  enter(runtimeRun, runtimeMeta);

  runtimeMeta.totalRuns = 3.9;
  runtimeRun.hp = runtimeRun.maxHp + 50;
  runtimeRun.gold = 12.8;
  runtimeRun.log = [
    ...Array.from({ length: 14 }, (_, index) => `log-${index}`),
    { invalid: true },
  ];
  runtimeRun.statuses = {
    poison: { stacks: 150 },
    regeneration: { stacks: 30, turns: 30 },
    unknown_status: { stacks: 5 },
  };
  runtimeRun.battle.enemyPhase = true;
  runtimeRun.battle.actingEnemy = 0;
  runtimeRun.battle.completedEnemies = [0];
  runtimeRun.battle.absorb = 150;
  runtimeRun.battle.ap = -2;
  runtimeRun.battle.turn = 4.8;
  runtimeRun.battle.enemies[0].statuses = {
    poison: { stacks: 120 },
    unknown_status: { stacks: 2 },
  };

  const runtimeState = { meta: runtimeMeta, run: runtimeRun };
  const scheduledPayload = normalizeGamePayload(runtimeState);
  assert.ok(scheduledPayload);
  assert.equal(
    samePayload(runtimeState, scheduledPayload),
    false,
    "fixture must exercise runtime fields changed by save normalization",
  );
  assert.equal(scheduledPayload.meta.totalRuns, 3);
  assert.equal(scheduledPayload.run.hp, scheduledPayload.run.maxHp);
  assert.equal(scheduledPayload.run.gold, 12);
  assert.deepEqual(scheduledPayload.run.log, runtimeRun.log.slice(0, 12));
  assert.deepEqual(scheduledPayload.run.statuses, {
    poison: { stacks: 99 },
    regeneration: { stacks: 20, turns: 9 },
  });
  assert.equal(scheduledPayload.run.battle.enemyPhase, false);
  assert.equal(scheduledPayload.run.battle.actingEnemy, null);
  assert.deepEqual(scheduledPayload.run.battle.completedEnemies, []);
  assert.equal(scheduledPayload.run.battle.absorb, 100);
  assert.equal(scheduledPayload.run.battle.ap, 0);
  assert.equal(scheduledPayload.run.battle.turn, 4);
  assert.deepEqual(scheduledPayload.run.battle.enemies[0].statuses, {
    poison: { stacks: 99 },
  });

  const revision = saveGame(raw, scheduledPayload);
  const localEnvelope = JSON.parse(raw.getItem(SAVE_KEYS.primary));
  const scheduled = [];
  const cloudSync = {
    schedule(payload, localRevision) {
      scheduled.push({ payload: structuredClone(payload), localRevision });
    },
  };
  cloudSync.schedule(scheduledPayload, revision);

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].localRevision, revision);
  assert.equal(
    samePayload(localEnvelope.payload, scheduled[0].payload),
    true,
    "local and cloud sync must receive the same canonical snapshot",
  );
  assert.equal(
    samePayload(
      { meta: loadGame(raw).meta, run: loadGame(raw).run },
      scheduled[0].payload,
    ),
    true,
    "reloaded local payload must match the scheduled cloud payload",
  );
}

{
  const raw = new MemoryStorage();
  const guest = createScopedStorage(raw, GUEST_SCOPE);
  const memberA = createScopedStorage(raw, "11111111-1111-4111-8111-111111111111");
  const memberB = createScopedStorage(raw, "22222222-2222-4222-8222-222222222222");

  const guestRevision = saveGame(guest, state(10));
  const aRevision = saveGame(memberA, state(20));
  const bRevision = saveGame(memberB, state(30));
  assert.equal(guestRevision, 1);
  assert.equal(aRevision, 1);
  assert.equal(bRevision, 1);
  assert.equal(loadGame(guest).run.seed, 10);
  assert.equal(loadGame(memberA).run.seed, 20);
  assert.equal(loadGame(memberB).run.seed, 30);
  assert.ok(raw.getItem(scopedKey(GUEST_SCOPE, SAVE_KEYS.primary)));
  assert.ok(raw.getItem(scopedKey(memberA.scope, SAVE_KEYS.primary)));
  assert.equal(raw.getItem(SAVE_KEYS.primary), null);

  saveGame(memberA, state(21), aRevision);
  assert.ok(raw.getItem(scopedKey(memberA.scope, SAVE_KEYS.backup)));
  assert.equal(raw.getItem(scopedKey(memberB.scope, SAVE_KEYS.backup)), null);
}

{
  const raw = new MemoryStorage();
  raw.setItem(SAVE_KEYS.primary, "legacy-primary");
  assert.equal(migrateUnscopedGuestSave(raw, Object.values(SAVE_KEYS)), 1);
  assert.equal(createScopedStorage(raw, GUEST_SCOPE).getItem(SAVE_KEYS.primary), "legacy-primary");
  assert.equal(raw.getItem(SAVE_KEYS.primary), "legacy-primary");
}

assert.equal(
  samePayload({ meta: { b: 2, a: 1 }, run: { deck: [{ id: "x", level: 0 }] } }, {
    run: { deck: [{ level: 0, id: "x" }] },
    meta: { a: 1, b: 2 },
  }),
  true,
  "JSONB key reordering must not create false cloud conflicts",
);

{
  const userId = "33333333-3333-4333-8333-333333333333";
  const { client, calls } = updateClient({
    row: { user_id: userId, cloud_revision: 8 },
  });
  const result = await updatePlayerState(client, {
    userId,
    expectedCloudRevision: 7,
    payload: { meta: {}, run: null },
    localRevision: 12,
    deviceId: "44444444-4444-4444-8444-444444444444",
  });
  assert.equal(result.conflict, false);
  assert.equal(calls.table, "player_state");
  assert.deepEqual(calls.eq, [["user_id", userId], ["cloud_revision", 7]]);
  assert.equal(calls.update.cloud_revision, 8);
  assert.equal(calls.update.local_revision, 12);
}

{
  const userId = "55555555-5555-4555-8555-555555555555";
  const { client } = updateClient({ row: null });
  const result = await updatePlayerState(client, {
    userId,
    expectedCloudRevision: 2,
    payload: { meta: {}, run: null },
    localRevision: 3,
  });
  assert.equal(result.conflict, true, "0-row optimistic update must be a conflict");
}

{
  const statuses = [];
  const offlineClient = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: null, error: { message: "offline" } }; },
      };
    },
  };
  const controller = createCloudSyncController({
    client: offlineClient,
    userId: "88888888-8888-4888-8888-888888888888",
    deviceId: "99999999-9999-4999-8999-999999999999",
    debounceMs: 1,
    onStatus: (status) => statuses.push(status),
  });
  controller.schedule({ meta: {}, run: null }, 4);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const flushed = await controller.flush();
  assert.equal(flushed, false);
  assert.ok(statuses.some((entry) => entry.status === "error"));
}

{
  const userId = "66666666-6666-4666-8666-666666666666";
  const run = newRun(99, null, freshMeta());
  run.runId = "77777777-7777-4777-8777-777777777777";
  run.finished = true;
  run.phase = "result";
  const row = buildRunResultRow(userId, run, {
    score: 123,
    loop: 1,
    room: 12,
    cleared: true,
    hp: 20,
    maxHp: 80,
    attack: 3,
    defense: 2,
    deckCount: 14,
    maxHit: 28,
    items: [],
  });
  assert.equal(row.user_id, userId);
  assert.equal(row.run_id, run.runId);
  assert.equal(row.verified, false);
  assert.equal(Object.hasOwn(row, "verification_version"), false);
}

console.log("Harmony auth/storage/cloud-sync tests passed");

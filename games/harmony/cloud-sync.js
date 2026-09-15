import { SAVE_SCHEMA } from "./persistence.js?v=20260915-1";
import { GAME_VERSION } from "./version.js?v=20260915-2";

const PLAYER_STATE_COLUMNS = [
  "user_id",
  "save_schema_version",
  "cloud_revision",
  "local_revision",
  "payload",
  "client_version",
  "last_device_id",
  "client_saved_at",
  "created_at",
  "updated_at",
].join(",");

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function samePayload(left, right) {
  return JSON.stringify(canonicalize(left ?? null)) === JSON.stringify(canonicalize(right ?? null));
}

export async function fetchPlayerState(client, userId) {
  const { data, error } = await client
    .from("player_state")
    .select(PLAYER_STATE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function insertPlayerState(
  client,
  { userId, payload, localRevision = 0, deviceId = null, clientVersion = GAME_VERSION },
) {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("player_state")
    .insert({
      user_id: userId,
      save_schema_version: SAVE_SCHEMA,
      cloud_revision: 0,
      local_revision: Math.max(0, Math.floor(localRevision || 0)),
      payload,
      client_version: clientVersion,
      last_device_id: deviceId,
      client_saved_at: now,
    })
    .select(PLAYER_STATE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlayerState(
  client,
  {
    userId,
    expectedCloudRevision,
    payload,
    localRevision,
    deviceId = null,
    clientVersion = GAME_VERSION,
  },
) {
  const nextRevision = Math.max(0, Number(expectedCloudRevision) || 0) + 1;
  const { data, error } = await client
    .from("player_state")
    .update({
      save_schema_version: SAVE_SCHEMA,
      cloud_revision: nextRevision,
      local_revision: Math.max(0, Math.floor(localRevision || 0)),
      payload,
      client_version: clientVersion,
      last_device_id: deviceId,
      client_saved_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("cloud_revision", expectedCloudRevision)
    .select(PLAYER_STATE_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? { conflict: false, row: data } : { conflict: true, row: null };
}

export function createCloudSyncController({
  client,
  userId,
  deviceId,
  initialCloudRevision = null,
  debounceMs = 1800,
  onStatus,
  onConflict,
  onUseCloud,
}) {
  let cloudRevision = Number.isFinite(Number(initialCloudRevision))
      ? Number(initialCloudRevision)
      : null,
    timer = null,
    pending = null,
    syncing = false,
    queuedDuringSync = false,
    stopped = false;

  const notify = (status, message, extra = {}) =>
    onStatus?.({ status, message, cloudRevision, ...extra });

  async function explicitLocalWins(snapshot, latest) {
    const result = await updatePlayerState(client, {
      userId,
      expectedCloudRevision: latest.cloud_revision,
      payload: snapshot.payload,
      localRevision: snapshot.localRevision,
      deviceId,
    });
    if (result.conflict) return false;
    cloudRevision = result.row.cloud_revision;
    notify("synced", "클라우드 저장 완료");
    return true;
  }

  async function resolveConflict(snapshot, latest) {
    notify("conflict", "다른 기기의 저장이 감지되었습니다.", { latest });
    const choice = await onConflict?.({
      local: snapshot,
      cloud: latest,
    });
    if (choice === "cloud") {
      pending = null;
      cloudRevision = latest.cloud_revision;
      await onUseCloud?.(latest);
      return true;
    }
    if (choice === "local") {
      const replaced = await explicitLocalWins(snapshot, latest);
      if (replaced) return true;
      pending = snapshot;
      notify("conflict", "저장 충돌이 다시 발생했습니다. 다시 선택해주세요.");
      return false;
    }
    pending = snapshot;
    return false;
  }

  async function syncSnapshot(snapshot) {
    if (!client || !userId || stopped) return false;
    if (syncing) {
      pending = snapshot;
      queuedDuringSync = true;
      return false;
    }
    syncing = true;
    notify("syncing", "클라우드 저장 중…");
    try {
      if (cloudRevision === null) {
        const latest = await fetchPlayerState(client, userId);
        if (!latest) {
          const inserted = await insertPlayerState(client, {
            userId,
            payload: snapshot.payload,
            localRevision: snapshot.localRevision,
            deviceId,
          });
          cloudRevision = inserted.cloud_revision;
          notify("synced", "클라우드 저장 완료");
          return true;
        }
        if (!samePayload(latest.payload, snapshot.payload))
          return await resolveConflict(snapshot, latest);
        cloudRevision = latest.cloud_revision;
      }

      const result = await updatePlayerState(client, {
        userId,
        expectedCloudRevision: cloudRevision,
        payload: snapshot.payload,
        localRevision: snapshot.localRevision,
        deviceId,
      });
      if (result.conflict) {
        const latest = await fetchPlayerState(client, userId);
        if (!latest) {
          cloudRevision = null;
          pending = snapshot;
          return false;
        }
        return await resolveConflict(snapshot, latest);
      }
      cloudRevision = result.row.cloud_revision;
      notify("synced", "클라우드 저장 완료");
      return true;
    } catch (error) {
      pending = snapshot;
      notify(
        "error",
        "클라우드 저장에 실패했습니다. 로컬에는 저장되었습니다.",
        { error },
      );
      return false;
    } finally {
      syncing = false;
      if (queuedDuringSync && pending && !stopped && !timer) {
        queuedDuringSync = false;
        timer = setTimeout(() => {
          timer = null;
          const next = pending;
          pending = null;
          if (next) void syncSnapshot(next);
        }, debounceMs);
      }
    }
  }

  function schedule(payload, localRevision) {
    if (!client || !userId || stopped) return;
    pending = { payload: clone(payload), localRevision };
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const snapshot = pending;
      pending = null;
      if (snapshot) void syncSnapshot(snapshot);
    }, debounceMs);
  }

  async function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const snapshot = pending;
    pending = null;
    if (!snapshot) return true;
    return syncSnapshot(snapshot);
  }

  function retry() {
    if (!pending || syncing || stopped) return;
    const snapshot = pending;
    pending = null;
    void syncSnapshot(snapshot);
  }

  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return Object.freeze({
    schedule,
    flush,
    retry,
    stop,
    getCloudRevision: () => cloudRevision,
    setCloudRevision(value) {
      cloudRevision = Number.isFinite(Number(value)) ? Number(value) : null;
    },
  });
}

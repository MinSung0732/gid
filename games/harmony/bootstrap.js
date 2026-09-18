import { SAVE_KEYS, loadGame, saveGame } from "./persistence.js?v=20260915-2";
import {
  GUEST_SCOPE,
  createScopedStorage,
  migrateUnscopedGuestSave,
} from "./scoped-storage.js";
import {
  cacheUserId,
  clearCachedUserId,
  fetchProfile,
  getCachedUserId,
  getCurrentSession,
  profileFallback,
  signInWithProvider,
  signOut,
  subscribeAuthState,
} from "./auth.js";
import {
  createCloudSyncController,
  fetchPlayerState,
  insertPlayerState,
  samePayload,
  updatePlayerState,
} from "./cloud-sync.js";
import { createRunHistory } from "./run-history.js";
import { createBrowserRuntime } from "./browser-runtime.js";

const browserRuntime = createBrowserRuntime();
const rawStorage = browserRuntime.localStorage();
const DEVICE_KEY = "harmony_device_id";
const HARMONY_SAVE_KEYS = Object.values(SAVE_KEYS);

function hasSave(state) {
  return Boolean(state?.source);
}

function oauthCallbackError() {
  try {
    const url = browserRuntime.currentUrl(),
      hash = new URLSearchParams(url.hash.replace(/^#/, "")),
      message = url.searchParams.get("error_description") || hash.get("error_description") ||
        (url.searchParams.get("error") || hash.get("error") ? "OAuth 로그인에 실패했습니다." : null);
    if (!message) return null;
    for (const key of ["error", "error_code", "error_description"]) url.searchParams.delete(key);
    for (const key of ["error", "error_code", "error_description"]) hash.delete(key);
    url.hash = hash.toString() ? `#${hash}` : "";
    browserRuntime.replaceUrl(url);
    return new Error(message);
  } catch {
    return null;
  }
}

function getDeviceId() {
  try {
    const stored = rawStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const value = browserRuntime.randomUUID();
    rawStorage.setItem(DEVICE_KEY, value);
    return value;
  } catch {
    return browserRuntime.randomUUID();
  }
}

function saveDate(value) {
  if (!value) return "저장 시간 정보 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "저장 시간 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function snapshotText(payload, savedAt) {
  const run = payload?.run,
    meta = payload?.meta || {};
  if (run)
    return `${saveDate(savedAt)} · 점수 ${Number(run.score || 0).toLocaleString("ko-KR")} · ${Number(run.node || 0) + 1}번째 방`;
  return `${saveDate(savedAt)} · 진행 중인 런 없음 · 완료 ${Number(meta.totalRuns || 0)}회`;
}

function choiceDialog() {
  let dialog = document.getElementById("cloud-save-choice");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "cloud-save-choice";
  dialog.className = "cloud-save-choice";
  dialog.innerHTML = `<div class="dialog-head"><div><small>SAVE SYNC</small><h2 data-cloud-choice-title>저장 데이터 선택</h2></div></div><p data-cloud-choice-message></p><div class="cloud-save-options"><article><strong data-cloud-local-title>이 기기의 저장</strong><small data-cloud-local-meta></small><button type="button" data-cloud-choice="local">이 기기 저장 사용</button></article><article><strong data-cloud-remote-title>클라우드 저장</strong><small data-cloud-remote-meta></small><button type="button" data-cloud-choice="cloud">클라우드 저장 사용</button></article></div>`;
  document.body.append(dialog);
  dialog.addEventListener("cancel", (event) => event.preventDefault());
  return dialog;
}

function requestChoice({
  title,
  message,
  localTitle = "이 기기의 저장",
  localMeta,
  localButton = "이 기기 저장 사용",
  cloudTitle = "클라우드 저장",
  cloudMeta,
  cloudButton = "클라우드 저장 사용",
}) {
  const dialog = choiceDialog();
  dialog.querySelector("[data-cloud-choice-title]").textContent = title;
  dialog.querySelector("[data-cloud-choice-message]").textContent = message;
  dialog.querySelector("[data-cloud-local-title]").textContent = localTitle;
  dialog.querySelector("[data-cloud-local-meta]").textContent = localMeta;
  dialog.querySelector('[data-cloud-choice="local"]').textContent = localButton;
  dialog.querySelector("[data-cloud-remote-title]").textContent = cloudTitle;
  dialog.querySelector("[data-cloud-remote-meta]").textContent = cloudMeta;
  dialog.querySelector('[data-cloud-choice="cloud"]').textContent = cloudButton;
  return new Promise((resolve) => {
    const onClick = (event) => {
      const button = event.target.closest("[data-cloud-choice]");
      if (!button) return;
      dialog.removeEventListener("click", onClick);
      const choice = button.dataset.cloudChoice;
      dialog.close();
      resolve(choice);
    };
    dialog.addEventListener("click", onClick);
    dialog.showModal();
  });
}

function writePayload(storage, payload, preferredRevision = 0) {
  const current = loadGame(storage),
    baseRevision = Math.max(
      Number(current.revision) || 0,
      Math.max(0, Math.floor(Number(preferredRevision) || 0) - 1),
    );
  return saveGame(storage, payload, baseRevision);
}

async function insertCloudOrFetch(client, options) {
  try {
    return await insertPlayerState(client, options);
  } catch (error) {
    if (error?.code !== "23505") throw error;
    return fetchPlayerState(client, options.userId);
  }
}

async function pushLocalOverCloud(client, userId, localState, cloudState, deviceId) {
  let latest = cloudState;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await updatePlayerState(client, {
      userId,
      expectedCloudRevision: latest.cloud_revision,
      payload: { meta: localState.meta, run: localState.run },
      localRevision: localState.revision,
      deviceId,
    });
    if (!result.conflict) return result.row;
    latest = await fetchPlayerState(client, userId);
    if (!latest) return null;
    const choice = await requestChoice({
      title: "저장 충돌이 다시 발생했습니다",
      message: "다른 기기가 방금 클라우드 저장을 갱신했습니다. 사용할 저장을 다시 선택해주세요.",
      localMeta: snapshotText({ meta: localState.meta, run: localState.run }, localState.savedAt),
      cloudMeta: snapshotText(latest.payload, latest.client_saved_at || latest.updated_at),
    });
    if (choice === "cloud") return { useCloud: latest };
  }
  return null;
}

async function resolveInitialMemberState({
  client,
  userId,
  memberStorage,
  guestStorage,
  deviceId,
}) {
  let localState = loadGame(memberStorage),
    guestState = loadGame(guestStorage),
    cloudState = null;
  try {
    cloudState = await fetchPlayerState(client, userId);
  } catch (error) {
    return { localState, cloudState: null, cloudError: error };
  }

  if (!cloudState && !hasSave(localState) && hasSave(guestState)) {
    const choice = await requestChoice({
      title: "비회원 진행을 계정에 저장할까요?",
      message: "현재 기기의 비회원 진행을 이 계정으로 가져올 수 있습니다.",
      localTitle: "비회원 진행",
      localMeta: snapshotText(
        { meta: guestState.meta, run: guestState.run },
        guestState.savedAt,
      ),
      localButton: "현재 진행 가져오기",
      cloudTitle: "새 계정 저장",
      cloudMeta: "비회원 진행을 가져오지 않고 새 저장으로 시작합니다.",
      cloudButton: "새 계정으로 시작",
    });
    if (choice === "local") {
      const revision = writePayload(memberStorage, {
        meta: guestState.meta,
        run: guestState.run,
      });
      localState = loadGame(memberStorage);
      localState.revision = revision;
    }
  }

  if (!cloudState) {
    const payload = { meta: localState.meta, run: localState.run };
    cloudState = await insertCloudOrFetch(client, {
      userId,
      payload,
      localRevision: localState.revision,
      deviceId,
    });
    return { localState, cloudState, cloudError: null };
  }

  if (!hasSave(localState)) {
    writePayload(memberStorage, cloudState.payload, cloudState.local_revision);
    localState = loadGame(memberStorage);
    return { localState, cloudState, cloudError: null };
  }

  const localPayload = { meta: localState.meta, run: localState.run };
  if (samePayload(localPayload, cloudState.payload))
    return { localState, cloudState, cloudError: null };

  const choice = await requestChoice({
    title: "저장 데이터가 서로 다릅니다",
    message: "진행 중인 런은 자동으로 합치지 않습니다. 계속 사용할 저장을 선택해주세요.",
    localMeta: snapshotText(localPayload, localState.savedAt),
    cloudMeta: snapshotText(
      cloudState.payload,
      cloudState.client_saved_at || cloudState.updated_at,
    ),
  });
  if (choice === "cloud") {
    writePayload(memberStorage, cloudState.payload, cloudState.local_revision);
    localState = loadGame(memberStorage);
    return { localState, cloudState, cloudError: null };
  }

  const pushed = await pushLocalOverCloud(
    client,
    userId,
    localState,
    cloudState,
    deviceId,
  );
  if (pushed?.useCloud) {
    cloudState = pushed.useCloud;
    writePayload(memberStorage, cloudState.payload, cloudState.local_revision);
    localState = loadGame(memberStorage);
  } else if (pushed) cloudState = pushed;
  return { localState, cloudState, cloudError: null };
}

function emitCloudStatus(detail) {
  browserRuntime.dispatch("harmony:cloud-status", detail);
  if (detail?.status === "error") {
    const notice = document.getElementById("notice");
    if (notice) notice.textContent = detail.message;
  }
}

async function importGameModules() {
  await import("./pc-frame-ui.js?v=20260918-7");
  await import("./main.js?v=20260918-6");
  await import("./enemy-hp-visual-guard.js?v=20260914-1");
  await import("./combat-floating-text-portal.js?v=20260914-1");
  await import("./combat-super-fx-epic.js?v=20260914-6");
  await import("./account-ui.js?v=20260915-1");
  await import("./settings-ui.js?v=20260915-4");
  await import("./combat-super-stage-hotfix.js?v=20260918-1");
  await import("./card-picker-ui.js?v=20260913-2");
  await import("./card-picker-polish.js?v=20260913-1");
  await import("./run-summary-filter.js?v=20260913-1");
}

async function bootstrap() {
  migrateUnscopedGuestSave(rawStorage, HARMONY_SAVE_KEYS);
  const guestStorage = createScopedStorage(rawStorage, GUEST_SCOPE),
    deviceId = getDeviceId(),
    oauthError = oauthCallbackError();

  let client = null,
    session = null,
    user = null,
    profile = null,
    authError = null;
  try {
    ({ client, session, user } = await getCurrentSession());
    if (user) cacheUserId(rawStorage, user.id);
    else clearCachedUserId(rawStorage);
  } catch (error) {
    authError = error;
  }

  const cachedUserId = authError ? getCachedUserId(rawStorage) : null,
    userId = user?.id || cachedUserId,
    scope = userId || GUEST_SCOPE,
    storage = userId ? createScopedStorage(rawStorage, userId) : guestStorage;

  let cloudState = null,
    cloudError = null;
  if (user && client) {
    try {
      profile = (await fetchProfile(client, user.id)) || profileFallback(user);
    } catch {
      profile = profileFallback(user);
    }
    const resolved = await resolveInitialMemberState({
      client,
      userId: user.id,
      memberStorage: storage,
      guestStorage,
      deviceId,
    });
    cloudState = resolved.cloudState;
    cloudError = resolved.cloudError;
  }

  const cloudSync = user && client
    ? createCloudSyncController({
        client,
        userId: user.id,
        deviceId,
        initialCloudRevision: cloudState?.cloud_revision ?? null,
        onStatus: emitCloudStatus,
        onConflict: async ({ local, cloud }) =>
          requestChoice({
            title: "클라우드 저장 충돌",
            message: "다른 브라우저 또는 기기에서 더 먼저 저장했습니다. 자동 덮어쓰기는 하지 않습니다.",
            localMeta: snapshotText(local.payload, Date.now()),
            cloudMeta: snapshotText(
              cloud.payload,
              cloud.client_saved_at || cloud.updated_at,
            ),
          }),
        onUseCloud: async (cloud) => {
          writePayload(storage, cloud.payload, cloud.local_revision);
          browserRuntime.reload();
        },
      })
    : null;

  const runHistory = user && client
    ? createRunHistory({
        client,
        userId: user.id,
        onStatus: ({ status }) => {
          if (status === "error")
            emitCloudStatus({
              status: "error",
              message: "런 기록 저장에 실패했습니다. 게임 저장에는 영향이 없습니다.",
            });
        },
      })
    : null;

  browserRuntime.setHarmonyRuntime(Object.freeze({
    storage,
    scope,
    userId,
    user,
    session,
    profile,
    authError: authError || oauthError,
    cloudError,
    cloudSync,
    runHistory,
    auth: Object.freeze({
      signInWithProvider,
      async signOut() {
        await cloudSync?.flush();
        await signOut();
        clearCachedUserId(rawStorage);
      },
    }),
  }));

  browserRuntime.onOnline(() => cloudSync?.retry());
  await importGameModules();

  if (oauthError && !user)
    emitCloudStatus({
      status: "error",
      message: "로그인에 실패했습니다. 비회원으로 계속 플레이할 수 있습니다.",
      error: oauthError,
    });
  else if (cloudError)
    emitCloudStatus({
      status: "error",
      message: "클라우드 저장에 연결하지 못했습니다. 로컬 저장으로 계속 플레이합니다.",
      error: cloudError,
    });
  else if (user)
    emitCloudStatus({ status: "ready", message: "클라우드 저장 연결됨" });
  else if (authError && cachedUserId)
    emitCloudStatus({
      status: "offline",
      message: "오프라인 상태입니다. 마지막 로그인 계정의 로컬 저장으로 계속합니다.",
    });

  if (client) {
    try {
      await subscribeAuthState(({ event, session: nextSession, user: nextUser }) => {
        if (event === "TOKEN_REFRESHED" && nextUser?.id === userId) {
          browserRuntime.dispatch("harmony:auth-state", {
            event,
            session: nextSession,
            user: nextUser,
          });
          return;
        }
        if (event === "SIGNED_OUT" && userId) {
          clearCachedUserId(rawStorage);
          browserRuntime.reload();
        } else if (event === "SIGNED_IN" && nextUser?.id && nextUser.id !== userId) {
          cacheUserId(rawStorage, nextUser.id);
          browserRuntime.reload();
        }
      });
    } catch {}
  }
}

bootstrap().catch(async (error) => {
  console.error("Harmony bootstrap failed; continuing as guest.", error);
  const guestStorage = createScopedStorage(rawStorage, GUEST_SCOPE);
  browserRuntime.setHarmonyRuntime(Object.freeze({
    storage: guestStorage,
    scope: GUEST_SCOPE,
    userId: null,
    user: null,
    session: null,
    profile: null,
    authError: error,
    cloudError: error,
    cloudSync: null,
    runHistory: null,
    auth: Object.freeze({ signInWithProvider, signOut }),
  }));
  await importGameModules();
  emitCloudStatus({
    status: "error",
    message: "로그인 기능에 연결하지 못했습니다. 비회원 로컬 저장으로 계속 플레이할 수 있습니다.",
    error,
  });
});

const runtime = window.HarmonyRuntime;
const root = document.getElementById("settings-account");
const cloudStatus = document.getElementById("settings-cloud-status");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function providerLabel(user) {
  const provider = user?.app_metadata?.provider || user?.identities?.[0]?.provider;
  if (provider === "kakao") return "Kakao";
  if (provider === "google") return "Google";
  return "Supabase";
}

function displayName() {
  return runtime?.profile?.display_name || runtime?.user?.user_metadata?.name || runtime?.user?.email || "Harmony 회원";
}

function avatarMarkup() {
  const avatar = runtime?.profile?.avatar_url || runtime?.user?.user_metadata?.avatar_url || runtime?.user?.user_metadata?.picture;
  if (!avatar) return '<span class="account-avatar account-avatar-fallback" aria-hidden="true">H</span>';
  try {
    const url = new URL(avatar, location.href);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported avatar URL");
    return `<img class="account-avatar" src="${escapeHtml(url.href)}" alt="" referrerpolicy="no-referrer" />`;
  } catch {
    return '<span class="account-avatar account-avatar-fallback" aria-hidden="true">H</span>';
  }
}

function setStatus(message, state = "idle") {
  if (!cloudStatus) return;
  cloudStatus.textContent = message;
  cloudStatus.dataset.state = state;
}

function renderAccount() {
  if (!root) return;
  if (!runtime?.user) {
    const offlineMember = Boolean(runtime?.userId && runtime?.authError);
    root.innerHTML = offlineMember
      ? `<div class="settings-account-offline"><strong>오프라인 계정 저장</strong><small>마지막 로그인 계정의 이 기기 저장으로 플레이 중입니다. 네트워크가 복구되면 새로고침 후 로그인 상태를 확인할 수 있습니다.</small></div>`
      : `<div class="settings-account-guest"><div class="settings-account-actions"><button type="button" data-auth-provider="kakao" class="auth-provider auth-kakao">카카오로 로그인</button><button type="button" data-auth-provider="google" class="auth-provider auth-google">Google로 로그인</button></div><small>로그인하지 않아도 플레이할 수 있습니다.<br />로그인하면 클라우드 저장을 사용할 수 있습니다.</small></div>`;
    if (!runtime?.userId) setStatus("비회원 · 이 기기에만 저장", "guest");
    return;
  }

  root.innerHTML = `<div class="settings-account-profile">${avatarMarkup()}<span><strong>${escapeHtml(displayName())}</strong><small>${providerLabel(runtime.user)} 로그인 · 클라우드 저장 사용</small></span><button type="button" data-auth-signout>로그아웃</button></div>`;
  setStatus(runtime.cloudError ? "클라우드 연결 실패 · 로컬 저장 정상" : "클라우드 저장 연결됨", runtime.cloudError ? "error" : "ready");
}

async function login(provider, button) {
  button.disabled = true;
  setStatus("로그인 화면으로 이동하는 중…", "syncing");
  try {
    await runtime?.auth?.signInWithProvider?.(provider);
  } catch (error) {
    console.error("Harmony OAuth sign-in failed", error);
    button.disabled = false;
    setStatus("로그인에 실패했습니다. 비회원으로 계속 플레이할 수 있습니다.", "error");
  }
}

async function logout(button) {
  button.disabled = true;
  setStatus("클라우드 저장을 확인한 뒤 로그아웃합니다…", "syncing");
  try {
    await runtime?.auth?.signOut?.();
    location.reload();
  } catch (error) {
    console.error("Harmony sign-out failed", error);
    button.disabled = false;
    setStatus("로그아웃에 실패했습니다. 잠시 후 다시 시도해주세요.", "error");
  }
}

root?.addEventListener("click", (event) => {
  const providerButton = event.target.closest("[data-auth-provider]");
  if (providerButton) {
    void login(providerButton.dataset.authProvider, providerButton);
    return;
  }
  const signoutButton = event.target.closest("[data-auth-signout]");
  if (signoutButton) void logout(signoutButton);
});

window.addEventListener("harmony:cloud-status", (event) => {
  const detail = event.detail || {};
  if (detail.message) setStatus(detail.message, detail.status || "idle");
});

renderAccount();

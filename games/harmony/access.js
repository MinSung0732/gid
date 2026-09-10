const ACCESS_KEY = "harmony_access_granted";
const PASSWORD_HASH =
  "6e4e3758fc8263c60a15c8f08a9146601ffc0bd1c6c54307e91b9341ad034619";

function hasAccess() {
  try {
    return window.sessionStorage.getItem(ACCESS_KEY) === PASSWORD_HASH;
  } catch {
    return false;
  }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value),
    digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function requireHarmonyAccess() {
  if (hasAccess()) return;

  document.body.classList.add("access-locked");
  const gate = document.createElement("div");
  gate.className = "access-gate";
  gate.innerHTML = `
    <main class="access-panel" aria-labelledby="access-title">
      <p class="eyebrow">PRIVATE PLAYTEST</p>
      <h1 id="access-title">Project Harmony</h1>
      <p>아직 준비 중인 로그라이크 테스트 버전입니다.<br>계속하려면 비밀번호를 입력해 주세요.</p>
      <form class="access-form">
        <label for="harmony-password">비밀번호</label>
        <div>
          <input id="harmony-password" name="password" type="password" autocomplete="current-password" required>
          <button class="primary" type="submit">입장하기</button>
        </div>
        <strong class="access-error" role="alert" aria-live="polite"></strong>
      </form>
      <a href="../">게임 목록으로 돌아가기</a>
    </main>`;
  document.body.append(gate);

  const form = gate.querySelector("form"),
    input = gate.querySelector("input"),
    error = gate.querySelector(".access-error");
  input.focus();

  await new Promise((resolve) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submittedHash = await sha256(input.value);
      if (submittedHash !== PASSWORD_HASH) {
        input.value = "";
        input.setAttribute("aria-invalid", "true");
        error.textContent = "비밀번호가 올바르지 않습니다.";
        input.focus();
        return;
      }
      try {
        window.sessionStorage.setItem(ACCESS_KEY, PASSWORD_HASH);
      } catch {
        // Storage may be disabled; access remains valid until this page closes.
      }
      document.body.classList.remove("access-locked");
      gate.remove();
      resolve();
    });
  });
}

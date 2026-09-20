import { SFX } from "./sound.js?v=20260920-1";
import { GAME_VERSION } from "./version.js?v=20260920-1";

const BGM_STORAGE_KEY = "harmony_bgm_enabled";
const COMBAT_FX_STORAGE_KEY = "harmony_combat_fx";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const settingsDialog = document.getElementById("settings");
const settingsToggle = document.getElementById("settings-toggle");
const settingsClose = document.getElementById("settings-close");
const tabButtons = [...settingsDialog.querySelectorAll("[data-settings-tab]")];
const tabPanels = [...settingsDialog.querySelectorAll("[data-settings-panel]")];
const combatFxEnabled = document.getElementById("combat-fx-enabled");
const motionMode = document.getElementById("settings-motion-mode");
const sfxEnabled = document.getElementById("sfx-enabled");
const sfxVolume = document.getElementById("settings-sfx-volume");
const sfxVolumeOutput = settingsDialog.querySelector('output[for="settings-sfx-volume"]');
const bgmEnabled = document.getElementById("bgm-enabled");
const gameVersion = document.getElementById("settings-game-version");
let settingsReturnFocus = null;
const motionState = window.HarmonyMotionState || null;
const reducedMotionMedia = motionState
  ? null
  : window.matchMedia?.(REDUCED_MOTION_QUERY) || null;

function storedValue(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storeValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The setting still applies until this page closes.
  }
}

function combatFxIsEnabled() {
  return window.HarmonySuperFxTuning?.isEnabled?.()
    ?? storedValue(COMBAT_FX_STORAGE_KEY) !== "off";
}

function setCombatFxEnabled(enabled) {
  if (window.HarmonySuperFxTuning?.setEnabled) {
    window.HarmonySuperFxTuning.setEnabled(enabled);
    return;
  }
  const value = enabled ? "on" : "off";
  document.documentElement.dataset.combatFx = value;
  storeValue(COMBAT_FX_STORAGE_KEY, value);
}

function bgmIsEnabled() {
  return storedValue(BGM_STORAGE_KEY) !== "false";
}

function setBgmEnabled(enabled) {
  document.documentElement.dataset.bgmEnabled = enabled ? "on" : "off";
  storeValue(BGM_STORAGE_KEY, String(enabled));
}

function ensureMotionStateRow() {
  let row = document.getElementById("settings-motion-state-row");
  if (row) return row;
  row = document.createElement("div");
  row.id = "settings-motion-state-row";
  row.className = "settings-info-row settings-motion-state-row";
  row.innerHTML = '<span><strong>현재 모션 상태</strong><small id="settings-motion-description">모션 설정을 확인하는 중입니다.</small></span><b id="settings-motion-state-value">확인 중</b>';
  const anchor = motionMode?.closest(".settings-option")
    || combatFxEnabled.closest(".settings-option");
  anchor?.insertAdjacentElement("afterend", row);
  return row;
}

function fallbackSystemReduced() {
  return Boolean(reducedMotionMedia?.matches);
}

function syncMotionState() {
  const mode = motionState?.getMode?.() || "system";
  const systemReduced = motionState?.systemReduced?.() ?? fallbackSystemReduced();
  const reduced = motionState?.isReduced?.() ?? systemReduced;
  const row = ensureMotionStateRow();
  const value = row?.querySelector("#settings-motion-state-value");
  const description = row?.querySelector("#settings-motion-description");

  if (motionMode) {
    motionMode.value = mode;
    motionMode.disabled = !motionState;
  }

  if (value) {
    value.dataset.motion = mode === "full" ? "full" : mode === "reduce" ? "reduce" : "system";
    value.textContent = mode === "full"
      ? "기본 모션"
      : mode === "reduce"
        ? "모션 줄이기"
        : systemReduced
          ? "시스템 · 줄이기"
          : "시스템 · 기본";
  }

  if (description) {
    if (mode === "full")
      description.textContent = "운영체제 설정과 관계없이 Harmony의 회전·Glow·Spark·턴 전환 등 기본 애니메이션을 사용합니다.";
    else if (mode === "reduce")
      description.textContent = "운영체제 설정과 관계없이 Harmony의 모션을 줄입니다.";
    else
      description.textContent = systemReduced
        ? "운영체제/브라우저의 모션 줄이기가 감지되어 Harmony 애니메이션이 축소됩니다."
        : "운영체제/브라우저 설정을 따라 Harmony 기본 애니메이션을 사용합니다.";
  }

  document.documentElement.dataset.reducedMotion = reduced ? "reduce" : "no-preference";
}

function selectTab(name, focus = false) {
  for (const button of tabButtons) {
    const selected = button.dataset.settingsTab === name;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  }
  for (const panel of tabPanels) panel.hidden = panel.dataset.settingsPanel !== name;
}

function syncSoundControls() {
  const enabled = !SFX.muted;
  sfxEnabled.checked = enabled;
  sfxVolume.disabled = !enabled;
  sfxVolume.value = String(SFX.volume);
  sfxVolumeOutput.value = String(SFX.volume);
  sfxVolumeOutput.textContent = String(SFX.volume);
  sfxVolume.setAttribute("aria-valuetext", `${SFX.volume}퍼센트`);
}

function syncSettings() {
  combatFxEnabled.checked = combatFxIsEnabled();
  bgmEnabled.checked = bgmIsEnabled();
  setBgmEnabled(bgmEnabled.checked);
  gameVersion.textContent = `v${GAME_VERSION}`;
  syncMotionState();
  syncSoundControls();
}

settingsToggle.addEventListener("click", () => {
  settingsReturnFocus = settingsToggle;
  window.dispatchEvent(new CustomEvent("harmony:overlay-opening", { detail: { trigger: settingsToggle } }));
  syncSettings();
  selectTab("gameplay");
  settingsDialog.showModal();
});

settingsClose.addEventListener("click", () => settingsDialog.close());
settingsDialog.addEventListener("close", () => settingsReturnFocus?.focus?.());
settingsDialog.addEventListener("click", (event) => {
  if (event.target === settingsDialog) settingsDialog.close();
});

for (const button of tabButtons) {
  button.addEventListener("click", () => selectTab(button.dataset.settingsTab));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const index = tabButtons.indexOf(button);
    const next = tabButtons[(index + direction + tabButtons.length) % tabButtons.length];
    selectTab(next.dataset.settingsTab, true);
  });
}

combatFxEnabled.addEventListener("change", () => {
  setCombatFxEnabled(combatFxEnabled.checked);
});

motionMode?.addEventListener("change", () => {
  if (!motionState?.setMode) return;
  motionState.setMode(motionMode.value);
  document.querySelectorAll("[data-motion-replay-done]").forEach((node) => {
    delete node.dataset.motionReplayDone;
  });
  window.HarmonyRenderStability?.finalize?.();
  syncMotionState();
});

sfxEnabled.addEventListener("change", () => {
  SFX.setMuted(!sfxEnabled.checked);
  syncSoundControls();
  if (sfxEnabled.checked) {
    SFX.unlock();
    SFX.confirm();
  }
});

sfxVolume.addEventListener("input", () => {
  const value = SFX.setVolume(sfxVolume.value);
  sfxVolumeOutput.value = String(value);
  sfxVolumeOutput.textContent = String(value);
  sfxVolume.setAttribute("aria-valuetext", `${value}퍼센트`);
});

sfxVolume.addEventListener("change", () => SFX.confirm());
bgmEnabled.addEventListener("change", () => setBgmEnabled(bgmEnabled.checked));

if (motionState?.subscribe)
  motionState.subscribe(syncMotionState);
else if (reducedMotionMedia?.addEventListener)
  reducedMotionMedia.addEventListener("change", syncMotionState);
else reducedMotionMedia?.addListener?.(syncMotionState);

syncSettings();

import { GAME_VERSION } from "./version.js?v=20260915-2";

const PATCH_NOTES = [
  {
    version: "0.2.0",
    date: "2026.09.16",
    sections: [
      ["주요 변경", ["보스 전용 Signature 증강을 일반 증강과 분리된 보상 체계로 정리했습니다.", "상태이상 전투 정체성을 23종 기준으로 정리하고 출혈·연소·중독·혼란·방해의 역할을 명확히 했습니다."]],
      ["UI / UX", ["상태 도감에 지속 방식과 최대 중첩·턴 정보를 유지하면서 탐색 구조를 개선했습니다.", "전투 카드·툴팁·Hand 표시 안정화와 모션 설정을 보강했습니다."]],
      ["버그 수정", ["Hand 재렌더 시 스크롤/overflow 동기화가 늦어 한 프레임 흔들리던 문제를 pre-paint microtask 동기화로 수정했습니다."]],
    ],
  },
  {
    version: "0.1.0",
    date: "2026.09.15",
    sections: [
      ["주요 변경", ["Project Harmony 초기 프로토타입 기준 버전입니다.", "카드 전투, 여정, 아이템, 도감과 기본 저장 흐름을 제공합니다."]],
      ["UI / UX", ["Animation/VFX 개발 가이드와 Reduced Motion 기준을 정리했습니다."]],
    ],
  },
];

export function createPatchNotesUi({ getElement = (id) => document.getElementById(id) } = {}) {
  const dialog = getElement("patch-notes"),
    headerTrigger = getElement("version-toggle"),
    settingsTrigger = getElement("patch-notes-toggle"),
    close = getElement("patch-notes-close"),
    nav = getElement("patch-notes-nav"),
    body = getElement("patch-notes-body");
  if (!dialog || !headerTrigger || !settingsTrigger || !close || !nav || !body) return null;

  let selected = GAME_VERSION,
    returnFocus = null;

  function render() {
    if (!PATCH_NOTES.some((entry) => entry.version === selected)) selected = PATCH_NOTES[0].version;
    const note = PATCH_NOTES.find((entry) => entry.version === selected) || PATCH_NOTES[0];
    headerTrigger.textContent = `v${GAME_VERSION}`;
    nav.innerHTML = PATCH_NOTES.map((entry) => `<button type="button" data-patch-version="${entry.version}" class="${entry.version === selected ? "selected" : ""}" aria-pressed="${entry.version === selected}">v${entry.version}</button>`).join("");
    body.innerHTML = `<div class="patch-note-title"><div><small>VERSION</small><h3>v${note.version}</h3></div><time>${note.date}</time></div>${note.sections.map(([title, items]) => `<section><h4>${title}</h4><ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul></section>`).join("")}`;
  }

  function open(trigger) {
    returnFocus = trigger || document.activeElement;
    window.dispatchEvent(new CustomEvent("harmony:overlay-opening", { detail: { trigger: returnFocus } }));
    selected = GAME_VERSION;
    render();
    dialog.showModal();
  }

  headerTrigger.addEventListener("click", () => open(headerTrigger));
  settingsTrigger.addEventListener("click", () => open(settingsTrigger));
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const version = event.target.closest("[data-patch-version]");
    if (version) {
      selected = version.dataset.patchVersion;
      render();
      return;
    }
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => returnFocus?.focus?.());
  render();
  return { open, render };
}

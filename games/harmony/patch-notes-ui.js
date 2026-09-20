import { GAME_VERSION } from "./version.js?v=20260915-2";

const PATCH_NOTES = [
  {
    version: "0.2.0",
    date: "2026.09.20",
    sections: [
      ["주요 변경", [
        "보스 전용 Signature 증강을 일반 증강과 분리된 보상 체계로 정리했습니다.",
        "상태이상 전투 정체성을 23종 기준으로 정리하고 출혈·연소·중독·혼란·방해의 역할을 명확히 했습니다.",
      ]],
      ["덱 빌더", [
        "일반 ‘새로운 조향 시작’에도 공격·방어·흡수·회복 카드 필터를 추가했습니다.",
        "선택 가능한 1티어 카드만 기준으로 의미 있는 필터를 자동 구성하며, 기존 10장 편성·복사 제한·추천 덱 규칙은 그대로 유지됩니다.",
        "LOCAL CARD LAB에는 카드와 증강의 실제 효과·특성·상태이상 데이터를 반영한 상세 필터를 적용했습니다.",
      ]],
      ["UI / UX", [
        "상태 도감에 지속 방식과 최대 중첩·턴 정보를 유지하면서 탐색 구조를 개선했습니다.",
        "전투 카드·툴팁·Hand 표시 안정화와 모션 설정을 보강했습니다.",
        "필터 영역을 한 줄짜리 ‘필터’ 버튼과 활성 조건 칩으로 정리해 카드 목록이 더 넓게 보이도록 개선했습니다.",
        "PC에서는 팝오버, 모바일에서는 하단 시트로 필터가 열리며 카테고리를 이동해도 선택 조건과 아코디언 상태가 유지됩니다.",
        "상단 메뉴에 도감형 ‘도전과제’ 화면을 추가하고 달성 여부·희귀도 필터와 진행 현황을 확인할 수 있게 했습니다.",
      ]],
      ["LOCAL 테스트", [
        "LOCAL CARD LAB에서 막별 시작 버튼과 테스트 덱 편성 기능을 안정적으로 사용할 수 있도록 접근 및 표시 조건을 정리했습니다.",
        "일반 시작 모드와 LOCAL 테스트 모드의 필터 상태를 분리해 서로의 선택 조건이 섞이지 않도록 했습니다.",
      ]],
      ["버그 수정", [
        "Hand 재렌더 시 스크롤/overflow 동기화가 늦어 한 프레임 흔들리던 문제를 pre-paint microtask 동기화로 수정했습니다.",
        "실행 정보가 아직 준비되지 않은 로비에서 방 이름을 읽을 때 발생할 수 있던 오류를 수정했습니다.",
        "필터를 변경해도 이미 편성한 카드와 증강이 선택 목록에서 제거되지 않도록 보존했습니다.",
      ]],
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

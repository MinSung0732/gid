import { GAME_VERSION } from "./version.js?v=20260920-1";

const PATCH_NOTES = [
  {
    version: "0.3.0",
    date: "2026.09.20",
    sections: [
      ["주요 변경", [
        "액티브카드의 상태이상·기믹 판정을 공통 mechanic metadata로 통합해 카드요약 뱃지, 내부 태그, 덱 필터가 같은 기준을 사용하도록 정리했습니다.",
        "공식 액티브카드 134종을 전수 감사하고 직접 부여·참조·소비·조건·조작에 쓰이는 상태이상 뱃지가 누락되지 않도록 보강했습니다.",
        "일반 시작 덱 빌더와 LOCAL CARD LAB의 카드·증강 필터, 도전과제 화면, LOCAL 막별 시작 기능을 최신 main에 통합했습니다.",
      ]],
      ["카드 표시 / 가독성", [
        "카드 상세정보의 상태이상 대표색과 중복 설명을 정리하고, 공용 Positive/Gain 색상을 #65D68A로 통일했습니다.",
        "Local Card Lab의 정적 AP 비용을 진한 색으로 조정해 0 AP부터 높은 비용 카드까지 밝은 카드 배경에서 쉽게 읽히도록 개선했습니다.",
        "잔향·연소 등 실제 기믹을 사용하는 카드는 적용/참조/소비 구분 없이 기존 STATUS_DEFINITIONS 뱃지를 일관되게 표시합니다.",
        "공명 연쇄붕괴 등 실제 방어막 관통 피해를 사용하는 카드가 공통 shieldPierce mechanic과 기존 관통 뱃지를 정상적으로 표시하도록 수정했습니다.",
      ]],
      ["전투 / UI", [
        "처치된 적 패널이 사망 연출 후 정상적으로 정리되도록 하고, 카드·상태·반격 등 여러 처치 경로에서 사망 애니메이션 순서를 안정화했습니다.",
        "적 소환 가능 수를 생존 적 기준으로 계산해 사망 기록이 남아 있어도 빈 슬롯을 올바르게 사용할 수 있도록 수정했습니다.",
        "다음 행동의 상태이상 표시와 적 패널 높이를 조정해 상태 효과가 많은 전투에서도 의도를 읽기 쉽게 개선했습니다.",
        "효과음 설정이 전투 중 즉시 반영되도록 SFX 모듈을 단일 상태로 통합해, 볼륨·음소거 변경 후 새로고침이 필요하던 문제를 수정했습니다.",
      ]],
      ["덱 빌더 / LOCAL", [
        "일반 시작 덱 빌더에 1티어 카드 기준 상세 필터를 추가하고, 기존 10장 편성·복사 제한·추천 덱 규칙은 그대로 유지했습니다.",
        "LOCAL CARD LAB에서 카드와 증강을 실제 데이터 기반으로 필터링할 수 있으며, PC에서는 팝오버·모바일에서는 하단 시트 형태로 표시됩니다.",
        "필터 상태는 일반 시작 모드와 LOCAL 테스트 모드에서 분리되며, 카테고리를 이동해도 각 모드의 선택 상태가 유지됩니다.",
        "LOCAL 접근 정책을 공통화하고 선택한 덱·증강을 유지한 채 1막~7막 및 심연 시작 지점을 선택할 수 있도록 정리했습니다.",
      ]],
      ["도전과제 / 시스템", [
        "상단 메뉴에 도전과제 모달을 추가해 달성 현황, 달성/미달성, 희귀도 기준으로 기록을 확인할 수 있도록 했습니다.",
        "Supabase에 도전과제 카탈로그·사용자 달성 기록·집계 통계 구조와 동기화 마이그레이션을 추가했습니다.",
        "실행 정보가 아직 준비되지 않은 로비에서 ROOM_NAMES를 읽을 때 발생할 수 있는 초기화 오류를 방지했습니다.",
        "기존 카드 효과, 전투 규칙, 저장 구조와 정상 캠페인 진행은 유지하면서 test-patches의 기능을 최신 main 구조에 맞춰 통합했습니다.",
      ]],
    ],
  },
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

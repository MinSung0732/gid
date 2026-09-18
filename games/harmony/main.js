import {
  CARDS,
  ENEMIES,
  ITEMS,
  TEST_ITEMS,
  PLAYER_HELP,
  KINDS,
  RARITIES,
  RECOMMENDED_STARTING_DECK,
  ROOM_NAMES as RAW_ROOM_NAMES,
  ROOM_CATEGORIES,
  ROUTE,
  UNLOCKS,
  getTier1Cards,
} from "./data.js?v=20260918-1";
import * as E from "./engine.js?v=20260919-1";
import { createPersistenceRuntime } from "./persistence-runtime.js";
import { createBrowserRuntime } from "./browser-runtime.js";
import { STATUS_DEFINITIONS } from "./statuses.js?v=20260911-4";
import { formatStatusKeywords } from "./status-text.js";
import { HIDDEN_SYNERGIES, SYNERGY_COLORS } from "./synergies.js?v=20260918-1";
import { SFX } from "./sound.js?v=20260911-9";
import {
  shareHarmonyImage,
  shareHarmonyKakao,
  shareHarmonyLink,
} from "./share.js";
import {
  getPlayerHealthAnchor,
  getPlayerImpactPoint,
} from "./player-vfx-anchor.js";
import {
  placeBattleOverlay,
  showBattleShieldOverlay,
  syncBattleStateFrame,
} from "./battle-overlay.js";
import { createCombatFeedbackVfx } from "./combat-feedback-vfx.js?v=20260919-1";
import { createAttackFeedbackVfx } from "./attack-feedback-vfx.js";
import {
  beginEnemyHpVisualGuard,
  endEnemyHpVisualGuard,
} from "./enemy-hp-visual-guard.js?v=20260919-1";
import { createCodexUi } from "./codex-ui.js?v=20260918-2";
import { createPatchNotesUi } from "./patch-notes-ui.js";
import { createRewardUi } from "./reward-ui.js?v=20260917-1";
import { createRunSummaryUi } from "./run-summary-ui.js";
import { createStartingDeckBuilderUi } from "./starting-deck-builder-ui.js";
import { createDeckReplacementUi } from "./deck-replacement-ui.js";
import { createSpecialDeckPickerUi } from "./special-deck-picker-ui.js";
import { createRestUpgradeUi } from "./rest-upgrade-ui.js";
import { CARD_EFFECT_UI, createCardPresentation } from "./card-presentation.js";
import { createCombatTurnOrchestrator } from "./combat-turn-orchestrator.js?v=20260919-1";
import { createCombatCardOrchestrator } from "./combat-card-orchestrator.js?v=20260918-1";
import { createGameActionOrchestrator } from "./game-action-orchestrator.js?v=20260918-1";
import { createRoomRelicPresentation } from "./room-relic-presentation.js";
const ROOM_NAMES = new Proxy(RAW_ROOM_NAMES, {
  get(target, key) {
    if (ROOM_CATEGORIES[key] && run?.phase !== "map") {
      const revealed = E.roomAt(run);
      if (revealed !== key) return target[revealed];
    }
    return target[key];
  },
});
const LOCAL_FEATURE_KEY = "harmony_local_features",
  browserRuntime = createBrowserRuntime();
function hasLocalFeatureAccess() {
  const localHosts = ["localhost", "127.0.0.1", "::1", "192.168.0.8"],
    url = browserRuntime.currentUrl(),
    request = url?.searchParams.get("local") ?? null,
    hostname = browserRuntime.hostname();
  try {
    const storage = browserRuntime.localStorage();
    if (request === "1") storage?.setItem(LOCAL_FEATURE_KEY, "true");
    else if (request === "0") storage?.removeItem(LOCAL_FEATURE_KEY);
    if (request !== null && url) {
      url.searchParams.delete("local");
      browserRuntime.replaceUrl(url);
    }
    return localHosts.includes(hostname) || storage?.getItem(LOCAL_FEATURE_KEY) === "true";
  } catch {
    return localHosts.includes(hostname);
  }
}
const $ = (id) => document.getElementById(id),
  LOCAL_CARD_TEST = hasLocalFeatureAccess(),
  persistenceRuntime = createPersistenceRuntime({
    runtime: browserRuntime.getHarmonyRuntime(),
    fallbackStorage: browserRuntime.localStorage(),
    historyRecord: () => shareRecord(),
  }),
  loadedSave = persistenceRuntime.loaded;
let meta = loadedSave.meta,
  run = loadedSave.run,
  started = false,
  transientNoticeTimer = null,
  transientNoticeToken = 0;
if (run && !run.runId && !run.finished) run.runId = browserRuntime.randomUUID();
function clearTransientNotice() {
  if (transientNoticeTimer !== null) {
    clearTimeout(transientNoticeTimer);
    transientNoticeTimer = null;
  }
  transientNoticeToken += 1;
  const notice = $("notice");
  if (notice?.dataset.noticeMode !== "transient") return;
  notice.textContent = "";
  delete notice.dataset.noticeMode;
}
function showNotice(message, { transient = false, duration = 1800 } = {}) {
  if (transientNoticeTimer !== null) {
    clearTimeout(transientNoticeTimer);
    transientNoticeTimer = null;
  }
  const notice = $("notice");
  if (!notice) return;
  const token = ++transientNoticeToken;
  notice.textContent = message;
  notice.dataset.noticeMode = transient ? "transient" : "persistent";
  if (!transient) return;
  transientNoticeTimer = setTimeout(() => {
    if (token !== transientNoticeToken) return;
    transientNoticeTimer = null;
    if (notice.dataset.noticeMode !== "transient") return;
    notice.textContent = "";
    delete notice.dataset.noticeMode;
  }, duration);
}
function save() {
  const goldFeedback = run?._goldFeedback,
    goldSpentFeedback = run?._goldSpentFeedback;
  if (run) {
    delete run._goldFeedback;
    delete run._goldSpentFeedback;
  }
  try {
    persistenceRuntime.save({ meta, run });
    return true;
  } catch {
    showNotice(
      "브라우저 저장을 사용할 수 없습니다. 이 탭을 닫으면 진행이 사라질 수 있어요.",
    );
    return false;
  } finally {
    if (run && goldFeedback) run._goldFeedback = goldFeedback;
    if (run && goldSpentFeedback) run._goldSpentFeedback = goldSpentFeedback;
  }
}
const icons = {
  combat: "⚔️",
  treasure: "🗝️",
  battle: "⚔️",
  elite: "👹",
  gather: "🌿",
  golden: "💎",
  boss: "☠️",
  rest: "⛺",
  shop: "🛍️",
  mystery: "🔒",
  greenhouse: "🌱",
  curse_pit: "☣️",
  lab: "⚗️",
  mercury_still: "☿",
  blood_altar: "🩸",
  dice_altar: "🎲",
  purify_furnace: "🔥",
  mirror_doppel: "🪞",
  smuggler: "🧥",
};
const GLOSSARY_GROUPS = [
  [
    "전투 자원",
    [
      ["AP", PLAYER_HELP.ap.description],
      ["체력", PLAYER_HELP.hp.description],
      [
        "방어막",
        "받는 피해를 먼저 막으며 기본적으로 다음 턴 시작 시 사라집니다.",
      ],
      [
        "흡수",
        "오일과 추출 카드로 쌓고 공간 확산 같은 카드가 소비하는 전투 자원입니다. 턴 종료마다 현재 수치의 10%가 감소하며 최대 100입니다.",
      ],
      [
        "골드",
        "방 보상으로 획득하며 아틀리에에서 회복약·액티브 카드·증강 구매에 사용합니다.",
      ],
      ["점수", "전투 승리와 진행 성과로 쌓이는 여정 기록입니다."],
      [
        "회복약",
        "전투 화면에서 사용하면 체력을 20 회복합니다. 최대 체력일 때는 사용할 수 없습니다.",
      ],
    ],
  ],
  [
    "덱 · 손패",
    [
      [
        "덱",
        "전투에서 뽑을 카드의 전체 목록입니다. 기본 최대 20장이며 관련 아이템으로 한도를 늘릴 수 있습니다.",
      ],
      [
        "손패",
        "현재 사용할 수 있는 카드입니다. 사용하지 않은 카드는 다음 턴에도 유지됩니다.",
      ],
      ["손패 한도", "동시에 들고 있을 수 있는 카드 수입니다. 기본 7장입니다."],
      ["첫 턴 패", PLAYER_HELP.firstHand.description],
      ["턴 드로우", PLAYER_HELP.turnDraw.description],
      ["드로우", "뽑을 카드 더미에서 카드를 손패로 가져옵니다. 손패 한도에 도달하면 더 뽑지 못합니다."],
      ["뽑을 카드", "아직 손패로 들어오지 않은 카드 더미입니다."],
      [
        "버린 카드",
        "사용한 카드가 놓이는 더미입니다. 뽑을 카드가 비면 다시 섞입니다.",
      ],
      [
        "버리기",
        "카드를 사용하지 않고 손패에서 버린 카드 더미로 옮깁니다. 카드의 사용 효과는 발동하지 않습니다.",
      ],
      [
        "셔플",
        "뽑을 카드가 비었을 때 버린 카드를 무작위로 섞어 새로운 뽑을 카드 더미로 만듭니다.",
      ],
    ],
  ],
  [
    "카드 · 효과",
    [
      [
        "오일",
        "오일 태그 카드가 사용될 때 관련 특성과 유물 효과를 발동시킵니다.",
      ],
      [
        "직접 피해",
        "공격 카드와 적 공격으로 주는 일반 피해입니다. 취약과 약화 등의 영향을 받습니다.",
      ],
      [
        "접촉 공격",
        "대상과 직접 맞닿는 공격입니다. 가시 같은 접촉 반응 효과를 발동시킵니다.",
      ],
      [
        "접촉 연계",
        "같은 턴에 앞서 접촉 공격 카드를 사용했다면 조건을 만족합니다. 현재 사용하는 카드 자체는 선행 카드로 세지 않습니다.",
      ],
      [
        "연타",
        "표시된 횟수만큼 각각 공격합니다. 공격력과 향기 농도가 매 타격에 적용되며 접촉 연타는 가시도 매번 발동시킵니다.",
      ],
      [
        "방어막 비례 피해",
        "카드 사용 직전 현재 방어막을 기준으로 추가 피해를 계산합니다. 별도 소모 문구가 없다면 방어막은 유지됩니다.",
      ],
      [
        "방어막 파괴",
        "공격 전 적에게 방어막이 있었고 그 공격으로 방어막이 0이 되면 성립합니다. AP 환급은 카드 사용 직후 적용됩니다.",
      ],
      [
        "비접촉 공격",
        "향기나 원거리 효과로 피해를 주는 공격입니다. 가시 효과를 발동시키지 않습니다.",
      ],
      [
        "방어막 무시 피해",
        "방어막을 거치지 않고 체력에 바로 적용되는 피해입니다. 중독과 가시 등이 사용합니다.",
      ],
      [
        "관통 피해",
        "방어막 무시 피해와 같은 뜻으로, 대상의 방어막과 관계없이 체력에 직접 적용됩니다.",
      ],
      [
        "고정 피해",
        "공격력·취약·약화 같은 직접 피해 증감 효과의 영향을 받지 않고 표시된 수치대로 적용됩니다.",
      ],
      [
        "전체 대상",
        "현재 살아 있는 모든 적에게 각각 효과를 적용합니다. 쓰러진 적은 대상에서 제외됩니다.",
      ],
      [
        "AP 환급",
        "카드 사용이나 조건 달성으로 소비한 AP의 일부 또는 전부를 즉시 되돌려 받습니다. 최대 AP를 넘을 수 없습니다.",
      ],
      [
        "처형",
        "정해진 체력 비율 이하의 적을 즉시 쓰러뜨립니다. 보스에게는 보통 즉사 대신 추가 피해로 적용됩니다.",
      ],
      [
        "회복",
        "잃은 체력을 되찾습니다. 최대 체력을 넘긴 회복은 일부 특성이 방어막으로 전환할 수 있습니다.",
      ],
      [
        "상태 부여",
        "카드에 적힌 +수치만큼 대상에게 해당 상태 중첩을 추가합니다.",
      ],
      ["상태 정화", "해제 가능한 해로운 상태를 일부 또는 전부 제거합니다."],
      ["탑·미들·베이스", "향기의 첫인상·중심·잔향을 나타내는 노트 순서입니다."],
      [
        "하모니",
        "탑 → 미들 → 베이스 노트를 순서대로 완성하면 발동합니다. 마지막 베이스 카드가 공격이면 공격력 기반 추가 피해, 방어면 방어력 기반 추가 방어막, 흡수·회복이면 해당 카드 수치의 절반을 더한 추가 효과를 얻습니다.",
      ],
      [
        "무료 재발동",
        "이미 사용한 카드의 효과를 AP 소비 없이 한 번 더 실행합니다. 재발동 자체는 손패의 카드를 다시 소비하지 않습니다.",
      ],
      [
        "방어막 보존",
        "턴이 끝날 때 사라질 방어막의 일부 또는 전부를 다음 턴까지 유지합니다. 여러 보존율은 게임 규칙에 따라 합산됩니다.",
      ],
      [
        "흡수 감쇄",
        "턴 종료 시 현재 흡수의 일부가 감소하는 규칙입니다. 기본 감쇄량은 현재 흡수의 10%를 올림한 값입니다.",
      ],
      [
        "불순물",
        "AP 1을 사용해 전투 중 소멸시키고 카드 1장을 다시 뽑을 수 있는 방해 카드입니다. 손패에는 최대 손패 한도보다 2장 적게까지만 들어오며, 그 이상 드로우한 불순물은 즉시 소멸하고 방어막을 무시하는 체력 피해 2를 준 뒤 예정된 드로우를 계속합니다.",
      ],
      ["강화", "카드의 기본 피해·방어막·회복·흡수 수치를 영구적으로 높입니다."],
    ],
  ],
  [
    "여정 · 아이템",
    [
      [
        "방",
        "전투·채집·황금·아틀리에·휴식·보스 등으로 구성된 진행 단위입니다.",
      ],
      [
        "심연",
        "기본 여정을 마친 뒤 현재 덱과 아이템을 유지하고 난도가 증가한 여정입니다.",
      ],
      ["폭주", "일반·엘리트 전투는 15턴, 보스 전투는 20턴부터 매 턴 증가하는 방어막 무시 피해입니다."],
      [
        "능력치",
        "공격력·방어력·최대 체력처럼 기본 계산을 높이는 아이템입니다.",
      ],
      [
        "특성",
        "행동이나 조건에 반응해 지속적으로 이득을 주는 패시브 아이템입니다.",
      ],
      [
        "유물",
        "규칙을 바꾸거나 특정 조합에 큰 추가 효과를 주는 핵심 패시브 아이템입니다.",
      ],
      [
        "패시브",
        "직접 사용하지 않아도 조건을 만족하면 자동으로 적용되거나 발동하는 효과입니다.",
      ],
      [
        "증강",
        "여정 동안 능력치나 전투 규칙을 강화하는 아이템을 통칭합니다. 능력치·특성·유물 등이 포함됩니다.",
      ],
      [
        "시너지",
        "정해진 아이템 조합을 함께 보유하면 자동으로 활성화되는 추가 세트 효과입니다.",
      ],
      [
        "티어",
        "카드와 아이템의 성능 단계를 나타냅니다. 숫자가 높을수록 일반적으로 강력하고 희귀합니다.",
      ],
      [
        "등급",
        "일반·레어·유니크·에픽으로 구분되며 수치와 등장 확률이 달라집니다.",
      ],
      [
        "전투 종료",
        "승리·패배 시 전투 전용 방어막, 손패, 상태와 불순물이 초기화됩니다.",
      ],
    ],
  ],
];
const number = (n) => Math.round(n).toLocaleString("ko-KR");
function glossaryTermsHtml() {
  const termGroups = GLOSSARY_GROUPS.map(
    ([title, terms]) =>
      `<section class="glossary-section"><div class="glossary-section-head"><h3>${title}</h3></div><div class="glossary-list">${terms.map(([name, description]) => `<div class="glossary-row"><strong>${name}</strong><p>${description}</p></div>`).join("")}</div></section>`,
  ).join("");
  return `<p class="glossary-intro">전투에서 자주 확인하는 용어를 자원 → 덱 → 카드 효과 → 여정 순서로 묶었습니다. 이름을 먼저 훑고 오른쪽 설명에서 실제 적용 규칙을 확인하세요.</p>${termGroups}<section class="glossary-section glossary-symbol-section"><div class="glossary-section-head"><h3>카드 요약 기호</h3><p>카드 구분선 위 기호는 상세보기를 열지 않아도 핵심 효과를 빠르게 구분하기 위한 표시입니다.</p></div><div class="glossary-list">
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#d2b28b"><strong><i>⌖</i>단일 공격<small>공격 분류</small></strong><p>선택한 적 한 명을 공격합니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#e7b65f"><strong><i>◎</i>광역 공격<small>공격 분류</small></strong><p>살아있는 모든 적을 공격합니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#78c8e8"><strong><i>⟐</i>방어막 관통<small>공격 특성</small></strong><p>적의 방어막을 무시하고 체력에 직접 피해를 줍니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#b49ae8"><strong><i>◷</i>턴수 비례<small>공격 특성</small></strong><p>현재 전투 턴수에 비례해 추가 피해가 증가합니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#e18bd1"><strong><i>↝</i>도탄<small>공격 특성</small></strong><p>타격할 때마다 무작위 생존 적을 새로 골라 공격합니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#e59a7f"><strong><i>⋙</i>연타<small>효과 요약 · ⋙ ×3</small></strong><p>한 번 사용할 때 같은 피해를 여러 차례 입힙니다. × 뒤의 숫자가 공격 횟수입니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#8fcbd4"><strong><i>⬡</i>방어막 참조<small>효과 요약 · ⬡ +25%</small></strong><p>현재 방어막을 피해나 효과 계산에 사용합니다. 표시된 백분율만큼 수치가 추가됩니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:${CARD_EFFECT_UI.oil.color}"><strong><i>◉</i>오일 취급<small>카드 분류</small></strong><p>이 카드는 오일 카드로 취급되며, 사용할 때 오일 관련 특성·유물 효과를 발동합니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#81c59b"><strong><i>✦</i>가시<small>상태 효과</small></strong><p>접촉 공격을 받으면 공격자에게 방어막 무시 피해를 주는 가시 상태를 부여합니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:${CARD_EFFECT_UI.heal.color}"><strong><i>${CARD_EFFECT_UI.heal.icon}</i>회복<small>체력 효과</small></strong><p>카드 사용으로 체력을 회복합니다. 조건부·비율 회복도 같은 기호를 사용합니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:${CARD_EFFECT_UI.cleanse.color}"><strong><i>${CARD_EFFECT_UI.cleanse.icon}</i>정화<small>상태 관리</small></strong><p>플레이어에게 걸린 해제 가능한 해로운 상태이상을 일부 또는 전부 제거합니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:${CARD_EFFECT_UI.draw.color}"><strong><i>${CARD_EFFECT_UI.draw.icon}</i>드로우<small>손패 획득</small></strong><p>카드를 손패로 가져옵니다. 즉시 드로우뿐 아니라 파괴·처치 조건 드로우와 지정 카드 서치에도 표시됩니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:${CARD_EFFECT_UI.discard.color}"><strong><i>${CARD_EFFECT_UI.discard.icon}</i>카드 버리기<small>손패 효과</small></strong><p>선택 또는 무작위 방식으로 손패의 카드를 버린 카드 더미로 보냅니다.</p></div>
  </div></section>`;
}
function statusGlossaryHtml() {
  const durationTypeLabels = {
      duration: "턴제",
      stackDecay: "스택 감소형",
      triggerConsume: "발동 소비형",
      persistent: "지속형",
      instant: "즉시 효과",
    },
    statusMeta = (status) => {
      const kind = status.kind === "buff" ? "이로운 효과" : status.kind === "debuff" ? "해로운 효과" : "표식",
        parts = [
          kind,
          durationTypeLabels[status.durationType],
          status.maxStacks ? `최대 ${status.maxStacks}중첩` : "",
          status.maxTurns ? `최대 ${status.maxTurns}턴` : "",
          status.instant ? "즉시 발동" : "",
        ].filter(Boolean);
      return parts.map((part) => `<span>${part}</span>`).join("");
    },
    statusGroup = (title, description, filter) =>
      `<section class="glossary-section status-glossary-group"><div class="glossary-section-head"><h3>${title}</h3><p>${description}</p></div><div class="status-glossary-list">${Object.values(STATUS_DEFINITIONS).filter(filter).map((status) => `<div class="glossary-row glossary-status" style="--status-color:${status.color}"><strong><span class="glossary-status-name"><i>${status.icon}</i>${status.name}</span><small>${statusMeta(status)}</small></strong><p>${status.description}</p></div>`).join("")}</div></section>`;
  return `<p class="glossary-intro">상태이상은 적용 방식에 따라 세 묶음으로 나눴습니다. 색과 기호는 카드 요약·전투 UI에서도 동일하게 사용됩니다.</p>${statusGroup("중첩·표시형", "중첩 수치가 핵심인 상태입니다. 별도 턴 표시가 없으면 각 상태의 감소·소비 규칙을 따릅니다.", (status) => !["duration", "control"].includes(status.category))}${statusGroup("지속 턴형", "정해진 턴 동안 유지되며 턴 시작·종료 또는 행동 시 효과가 발동하거나 지속시간이 감소합니다.", (status) => status.category === "duration")}${statusGroup("행동 제한형", "카드 사용·드로우·행동 자체를 제한하는 상태입니다. 제한 대상과 해제 시점을 설명에서 확인할 수 있습니다.", (status) => status.category === "control")}`;
}
function countItemIds(ids) {
  return [...ids.reduce(
    (counts, id) => counts.set(id, (counts.get(id) || 0) + 1),
    new Map(),
  )];
}
function itemEffectHtml(description, suffix = "", tag = "p") {
  const text = `${description}${suffix}`,
    detailed = text.length > 52,
    formattedText = formatStatusKeywords(text, STATUS_DEFINITIONS);
  if (!detailed) return `<${tag}>${formattedText}</${tag}>`;
  const preview = `${description.slice(0, 42).trim()}…`;
  return `<${tag} class="item-effect-summary">${preview}<span class="item-effect-more">자세한 효과 보기</span></${tag}><span class="item-effect-tooltip" role="tooltip">${formattedText}</span>`;
}
function activeSynergiesForItem(itemId) {
  if (!run) return [];
  return E.activeSynergies(run).filter((synergy) => synergy.requires.includes(itemId));
}
function synergyAura(itemId) {
  const synergies = activeSynergiesForItem(itemId), synergy = synergies[0];
  if (!synergy) return null;
  const palette = SYNERGY_COLORS[synergy.id] || {
    color: "#ffd166", glow: "rgba(255, 209, 102, 0.45)", border: "#f39c12",
  };
  return {
    attributes: ` synergy-shield-active\" style=\"--synergy-color:${palette.color};--synergy-glow:${palette.glow};--synergy-border:${palette.border}`,
    badges: synergies.map((entry) => `<span class="synergy-set-badge">🛡 ${entry.name}</span>`).join(""),
  };
}
function tierStars(tier, className) {
  const level = Math.min(4, Math.max(1, Number(tier) || 1));
  return `<span class="${className}" aria-label="${level}티어">${"★".repeat(level)}</span>`;
}
function rawItemHtml(id, count = 1) {
  const i = ITEMS[id],
    effectSuffix = count > 1 ? " · 중첩 적용" : "",
    hasDetails = `${i.description}${effectSuffix}`.length > 52,
    roomLabel = (i.rooms || [i.room]).map((room) => ROOM_NAMES[room] || room).join(" · "),
    art = i.image
      ? `<img class="item-art" src="${i.image}" alt="${i.name}">`
      : `<span class="item-art item-art-fallback item-art-${i.kind}" aria-hidden="true">${i.kind === "curse" ? "▼" : i.kind === "relic" ? "◇" : i.kind === "trait" ? "✦" : "◆"}</span>`;
  const tierLabel = i.kind === "relic" && i.tier === 3
    ? "T4 · Legendary"
    : `T${i.tier + 1}`;
  return `<div class="${hasDetails ? "item-has-details " : ""}item tier-${i.tier}"${hasDetails ? ' tabindex="0"' : ""}>${tierStars(i.tier + 1, "item-tier-stars")}${count > 1 ? `<b class="item-count" aria-label="${count}개 보유">×${count}</b>` : ""}${art}<small>${tierLabel} · ${RARITIES[i.tier]} · ${KINDS[i.kind]}</small><strong>${i.name}</strong>${itemEffectHtml(i.description, effectSuffix)}<span>${roomLabel} · 최대 ${i.maxOwned}개</span></div>`;
}
function itemHtml(id, count = 1) {
  let html = rawItemHtml(id, count);
  const aura = synergyAura(id), item = ITEMS[id];
  if (!aura) return html;
  html = html.replace(`item tier-${item.tier}`, `item tier-${item.tier}${aura.attributes}`);
  return html.replace(`<strong>${item.name}</strong>`, `<strong>${item.name}</strong>${aura.badges}`);
}
const {
  statusAmountText,
  cardEffectText,
  compactCardEffectSummary,
  cardHtml,
} = createCardPresentation({
  engine: E,
  cards: CARDS,
  statusDefinitions: STATUS_DEFINITIONS,
  getRun: () => run,
  getStarted: () => started,
  tierStars,
});
const {
  cardEffectText: baseCardEffectText,
  cardHtml: startingDeckCardHtml,
} = createCardPresentation({
  engine: E,
  cards: CARDS,
  statusDefinitions: STATUS_DEFINITIONS,
  getRun: () => null,
  getStarted: () => false,
  tierStars,
});
function collection() {
  const found = (meta.synergies || []).map((id) => HIDDEN_SYNERGIES[id]).filter(Boolean),
    achievements = UNLOCKS.filter((unlock) => !unlock.legacy),
    unlockedCount = achievements.filter((unlock) => meta.unlocked.includes(unlock.id)).length,
    discoveredItems = (meta.discovered || []).filter((id) => ITEMS[id] && !ITEMS[id].hidden),
    collectibleItemCount = Object.values(ITEMS).filter((item) => !item.hidden).length;
  return `<details class="collection"><summary>발견 증강 ${discoveredItems.length} / ${collectibleItemCount} · 업적 ${unlockedCount} / ${achievements.length}</summary><div class="unlock-grid">${achievements.map((u) => `<div><strong>${meta.unlocked.includes(u.id) ? "✓" : "◇"} ${u.name}</strong><p>${u.goal}</p></div>`).join("")}</div><h3>✦ 발견한 비밀 조합 ${found.length} / ${Object.keys(HIDDEN_SYNERGIES).length}</h3><div class="synergy-collection">${found.map((synergy) => `<article><strong>${synergy.name}</strong><p>${synergy.description}</p></article>`).join("") || "<p>뜻밖의 아이템 조합이 숨은 조화를 깨웁니다.</p>"}</div><div class="inventory">${discoveredItems.map(itemHtml).join("") || "<p>방을 탐험해 첫 아이템을 발견해보세요.</p>"}</div></details>`;
}
function lobby() {
  return `<section class="welcome"><div><p class="eyebrow">SCENT · CHANCE · HARMONY</p><h1>우연이 모여,<br>하나의 향기가 된다.</h1><p class="lead">12개의 방에서 원료를 모으고, 카드를 엮고,<br>당신만의 뜻밖의 조합을 발견하세요.</p><div class="actions"><button class="primary" data-action="new">새로운 조향 시작 →</button>${LOCAL_CARD_TEST ? '<button class="local-test-entry" data-action="test-new">LOCAL · 카드 테스트 모드</button>' : ""}${run && !run.finished ? '<button data-action="resume">이전 여정 이어하기</button>' : ""}</div><p class="hint">밸런스 테스트 버전</p></div><div class="welcome-art"><img src="../../public/assets/object-2048/2048.png" alt="결이든 향기 오브제 일러스트"><span>BUILD YOUR OWN HARMONY</span></div></section><div class="intro-grid"><div><b>01 / 카드로 조율</b><p>첫 턴 카드 5장 · 이후 턴마다 3장. 적의 다음 행동을 보고 공격과 방어를 선택하세요.</p></div><div><b>02 / 보상은 우연</b><p>능력치·특성·유물 중 하나. 채집방, 황금방, 보스방마다 다른 테이블이 기다립니다.</p></div><div><b>03 / 실패도 발견</b><p>조건을 달성해 새 카드를 해금하세요. 다음 여정의 조합이 더 넓어집니다.</p></div></div><p class="lobby-record">완료한 여정 ${meta.totalRuns} · 최고 점수 ${number(meta.highScore)} · 최고 심연 ${meta.highestLoop}</p>`;
}
function hud() {
  const route = E.routeFor(run),
    act = E.actInfo(run.loop);
  ROUTE.splice(0, ROUTE.length, ...route);
  return `<div class="hud"><div><small>${act.act <= 3 ? `${act.act}막` : "심연"} · ${act.name}</small><strong>PROJECT HARMONY</strong></div><div class="hud-score"><small>점수</small><strong>${number(run.score)}</strong></div><button data-log-open>전투 기록<small>${run.log.length}개</small></button><button data-action="home">저장 후 홈</button></div><div class="route">${route.map((_, i) => { const category = E.roomCategoryAt(run, i), info = ROOM_CATEGORIES[category]; return `<span class="${i === run.node ? "current" : i < run.node ? "done" : ""}" title="${i + 1}. ${info?.name || ROOM_NAMES[category]}">${info?.symbol || icons[category]}<small>${i + 1}</small></span>`; }).join("")}</div>`;
}
function bonus(value, suffix = "") {
  return `<b>${value}${suffix} <small>(+${value}${suffix})</small></b>`;
}
function isCriticalHealth() {
  return run.hp > 0 && run.maxHp > 0 && Math.floor((run.hp / run.maxHp) * 100) <= 20;
}
function statsPanel() {
  const maxHpBonus = E.power(run, "maxHp"),
    attack = E.power(run, "attack"),
    defense = E.power(run, "defense"),
    turnBaseAp = E.power(run, "turnBaseAp"),
    draw = E.power(run, "draw"),
    apCap = E.power(run, "apCap"),
    handSize = E.power(run, "handSize"),
    healthPercent = Math.max(0, Math.min(100, (run.hp / Math.max(1, run.maxHp)) * 100));
  const drawBonus = draw ? ` <small>(+${draw})</small>` : "",
    stats = [
      [
        "♥",
        "체력",
        `<b>${run.hp} / ${run.maxHp}${maxHpBonus ? ` <small>(+${maxHpBonus} 최대)</small>` : ""}</b><div class="player-health-bar" role="progressbar" aria-label="현재 체력" aria-valuemin="0" aria-valuemax="${run.maxHp}" aria-valuenow="${run.hp}"><span style="width:${healthPercent}%"></span></div>`,
      ],
      ["⚔", "공격력", attack ? bonus(attack) : "<b>0</b>"],
      ["⬡", "방어력", defense ? bonus(defense) : "<b>0</b>"],
      [
        "◆",
        "행동력",
        `<b>${E.turnStartAp(run)} / ${E.apLimit(run)}${turnBaseAp || apCap ? ` <small>(턴 충전 +${turnBaseAp} · 한도 +${apCap})</small>` : ""}</b>`,
      ],
      [
        "▤",
        "손패 한도",
        `<b>${E.handLimit(run)}장${handSize ? ` <small>(+${handSize})</small>` : ""}</b>`,
      ],
      ["◇", "첫 턴 패", `<b>${5 + draw}장${drawBonus}</b>`],
      ["↻", "턴 드로우", `<b>${3 + draw}장${drawBonus}</b>`],
    ];
  return `<aside class="player-stats ${run.hp / run.maxHp <= 0.3 ? "health-danger" : ""}${isCriticalHealth() ? " health-critical" : ""}" aria-label="내 능력치"><div class="stats-title"><span>MY HARMONY</span><strong>내 능력치</strong></div><div class="stat-grid">${stats.map(([icon, label, value], index) => `<div class="stat-row${index === 0 ? " health-stat" : ""}"><i>${icon}</i><span>${label}</span>${value}</div>`).join("")}</div><p class="stats-note">괄호 안 수치는 능력치 아이템으로 증가한 값입니다.</p>${run.phase === "battle" ? playerEffectsRow("side") : hasPlayerStatuses() ? playerStatusRow("side") : ""}<button class="run-summary-button" data-run-open><span>▤</span> 내 덱 · 여정 아이템<small>카드 ${run.deck.length}장 · 아이템 ${run.inventory.length}개</small></button></aside>`;
}
function rawAcquiredPanel() {
  const ids = run.inventory.filter((id) =>
      ["trait", "relic"].includes(ITEMS[id].kind),
    ),
    counts = ids.reduce(
      (map, id) => map.set(id, (map.get(id) || 0) + 1),
      new Map(),
    );
  return `<aside class="acquired-panel" aria-label="획득한 특성과 유물"><div class="stats-title"><span>RUN EFFECTS</span><strong>특성 · 유물</strong></div><div class="acquired-head"><span>분류</span><span>이름·효과</span></div><div class="acquired-list">${
    counts.size
      ? [...counts]
          .map(([id, count]) => {
            const i = ITEMS[id];
            const effectSuffix = count > 1 ? " · 중첩 적용" : "",
              hasDetails = `${i.description}${effectSuffix}`.length > 52;
            return `<div class="acquired-row tier-mark-${i.tier}${hasDetails ? " item-has-details" : ""}"${hasDetails ? ' tabindex="0"' : ""}><span><em>${KINDS[i.kind]}</em><small>${RARITIES[i.tier]}</small></span><span><strong>${i.name} ${count} / ${i.maxOwned}</strong>${itemEffectHtml(i.description, effectSuffix, "small")}</span></div>`;
          })
          .join("")
      : "<p>아직 획득한 특성이나 유물이 없습니다.<br>보상으로 얻으면 여정 내내 적용됩니다.</p>"
  }</div></aside>`;
}
function acquiredPanel() {
  let html = rawAcquiredPanel();
  for (const id of new Set(run.inventory)) {
    const aura = synergyAura(id), item = ITEMS[id];
    if (!aura || !item || !["trait", "relic"].includes(item.kind)) continue;
    const nameIndex = html.indexOf(`<strong>${item.name} `);
    if (nameIndex < 0) continue;
    const rowIndex = html.lastIndexOf('<div class="acquired-row', nameIndex);
    const classEnd = html.indexOf('"', rowIndex + 12);
    if (rowIndex >= 0 && classEnd >= 0)
      html = `${html.slice(0, classEnd)}${aura.attributes}${html.slice(classEnd + 1)}`;
    const strongEnd = html.indexOf("</strong>", nameIndex) + 9;
    if (strongEnd >= 9) html = `${html.slice(0, strongEnd)}${aura.badges}${html.slice(strongEnd)}`;
  }
  return html;
}
function combatTerm(label, value, description) {
  return `<button type="button" class="combat-term" data-term aria-expanded="false"><span>${label}</span><b>${value}</b><span class="term-tip" role="tooltip">${description}</span></button>`;
}
function statusList(entity, label) {
  const entries = Object.entries(entity?.statuses || {}).filter(
    ([id, status]) => STATUS_DEFINITIONS[id] && status.stacks > 0,
  );
  return `<div class="status-list${entries.length ? "" : " status-list-empty"}" aria-label="${label}"${entries.length ? "" : ' aria-hidden="true"'}>${entries
    .map(([id, status]) => {
      const definition = STATUS_DEFINITIONS[id],
        duration = status.turns ? ` · ${status.turns}턴` : "";
      return `<button type="button" class="status-chip status-${definition.kind}" data-status-id="${id}" data-term aria-expanded="false" style="--status-color:${definition.color}"><span>${definition.icon}</span><b>${definition.name} ${status.stacks}${duration}</b><span class="term-tip" role="tooltip">${status.description || definition.description}<br>현재 ${status.stacks} / 최대 ${definition.maxStacks}중첩${status.turns ? `<br>남은 ${status.turns} / 최대 ${definition.maxTurns}턴` : ""}</span></button>`;
    })
    .join("")}</div>`;
}
function hasPlayerStatuses() {
  return Object.entries(run?.statuses || {}).some(
    ([id, status]) => STATUS_DEFINITIONS[id] && status?.stacks > 0,
  );
}
function playerStatusRow(location = "side") {
  return `<div class="player-effects-row player-effects-${location} player-status-only">${statusList(run, "플레이어 상태")}</div>`;
}
function playerEffectsRow(location = "battle") {
  const b = run?.battle,
    potionDisabled = !run?.potions || run.hp === run.maxHp;
  return `<div class="player-effects-row player-effects-${location}"><button class="battle-potion" data-action="potion" ${potionDisabled || b?.enemyPhase ? "disabled" : ""}><span>✚ 회복약 <b>${run.potions}</b></span><small>체력 +20</small></button>${statusList(run, "플레이어 상태")}</div>`;
}
function battle() {
  const b = run.battle,
    intentStatuses = (statuses) =>
      Object.entries(statuses || {})
        .map(([id, amount]) => {
          const stacks = typeof amount === "object" ? amount.stacks : amount,
            definition = STATUS_DEFINITIONS[id];
          return `${definition?.icon || "◌"} ${definition?.name || id} ${stacks}`;
        })
        .join(" · "),
    intentText = (enemy) => {
      if (enemy.hp <= 0 || !enemy.intent) return "행동 불가";
      if (enemy.statuses?.stun?.stacks) return "✹ 기절 · 행동 취소";
      const intent = enemy.intent,
        parts = [];
      if (intent.type === "attack") {
        const breakdown = E.intentValueBreakdown(enemy, intent),
          hits = Math.max(1, Math.floor(Number(intent.hits) || 1)),
          perHit = Math.max(0, Number(breakdown.modified) || 0),
          total = perHit * hits,
          pattern = (intent.attackPattern || "contact") === "contact" ? "접촉" : "비접촉";
        parts.push(hits > 1
          ? `⚔ ${pattern} ${perHit} × ${hits} · 총 ${total}`
          : `⚔ ${pattern} ${perHit}`);
      }
      else if (intent.type === "guard") parts.push(`⬡ 방어 ${intent.value}`);
      else if (intent.type === "pollute")
        parts.push(`◆ 불순물 ${intent.value}장`);
      else if (intent.type === "debuff") parts.push("◌ 상태이상");
      if (intent.guard) parts.push(`⬡ 방어 ${intent.guard}`);
      for (const statuses of [
        intent.applyPlayer,
        intent.applySelf,
        intent.applyAllies,
      ]) {
        const text = intentStatuses(statuses);
        if (text) parts.push(text);
      }
      return parts.join(" + ");
    },
    intentModifierHtml = (base, delta, prefix = "") =>
      `<span class="intent-number">${prefix}${base}${delta ? `<span class="intent-modifier ${delta > 0 ? "positive" : "negative"}">(${delta > 0 ? "+" : ""}${delta})</span>` : ""}</span>`,
    attackThreat = (enemy, index) => {
      if (
        enemy.hp <= 0 ||
        enemy.intent?.type !== "attack" ||
        enemy.statuses?.stun?.stacks ||
        enemy.statuses?.disarm?.stacks ||
        (b.enemyPhase && b.completedEnemies?.includes(index))
      )
        return null;
      const perHit = E.intentValueBreakdown(enemy, enemy.intent).modified,
        hits = Math.max(1, Math.floor(Number(enemy.intent?.hits) || 1)),
        damage = perHit * hits,
        tier = E.combatFxPowerTier(damage);
      if (tier === "super")
        return {
          tier,
          icon: "‼",
          message: "몬스터가 위험한 공격을 시전중입니다",
        };
      if (tier === "strong")
        return {
          tier,
          icon: "⚠",
          message: "몬스터가 강력한 공격을 시전중입니다",
        };
      return null;
    },
    attackThreatHtml = (threat) =>
      threat
        ? `<div class="attack-warning attack-warning-${threat.tier}" role="status"><span aria-hidden="true">${threat.icon}</span><strong>${threat.message}</strong></div><div class="enemy-threat-effect enemy-threat-effect-${threat.tier}" aria-hidden="true"><i></i><i></i><i></i></div>`
        : "",
    intentDisplay = (enemy) => {
      if (enemy.hp <= 0 || !enemy.intent)
        return { type: "stun", icon: "—", label: "행동 불가", value: "" };
      if (enemy.statuses?.stun?.stacks)
        return { type: "stun", icon: "✦", label: "기절", value: "취소", detail: "다음 행동을 하지 않습니다" };
      const intent = enemy.intent,
        valueBreakdown = E.intentValueBreakdown(enemy, intent),
        details = [];
      if (intent.guard && intent.type !== "guard") {
        const guardBreakdown = E.intentValueBreakdown(enemy, {
          type: "guard",
          value: intent.guard,
        });
        details.push(
          `방어막 ${intentModifierHtml(guardBreakdown.base, guardBreakdown.delta, "+")}`,
        );
      }
      for (const statuses of [intent.applyPlayer, intent.applySelf, intent.applyAllies]) {
        const text = intentStatuses(statuses);
        if (text) details.push(text);
      }
      if (intent.type === "attack") {
        const contact = (intent.attackPattern || "contact") === "contact",
          hits = Math.max(1, Math.floor(Number(intent.hits) || 1)),
          perHit = Math.max(0, Number(valueBreakdown.modified) || 0),
          total = perHit * hits;
        if (hits > 1) details.unshift(`${hits}연타 · 총 예상 피해 ${total}`);
        return {
          type: "attack",
          icon: contact ? "⚔" : "✦",
          label: hits > 1
            ? `${contact ? "접촉" : "비접촉"} 공격 · ${hits}연타`
            : contact ? "접촉 공격" : "비접촉 공격",
          value: hits > 1
            ? `<span class="intent-number">${perHit} × ${hits}</span>`
            : intentModifierHtml(valueBreakdown.base, valueBreakdown.delta),
          unit: hits > 1 ? `총 ${total}` : "피해",
          detail: details.join(" · "),
        };
      }
      if (intent.type === "guard")
        return { type: "guard", icon: "🛡", label: "방어", value: intentModifierHtml(valueBreakdown.base, valueBreakdown.delta, "+"), unit: "방어막", detail: details.join(" · ") };
      if (intent.type === "heal")
        return { type: "heal", icon: "♥", label: "회복", value: intentModifierHtml(valueBreakdown.base, valueBreakdown.delta, "+"), unit: "체력", detail: details.join(" · ") };
      if (intent.type === "pollute")
        return { type: "pollute", icon: "☣", label: "불순물 주입", value: `${intent.value}`, unit: "장", detail: details.join(" · ") };
      return { type: "debuff", icon: "▼", label: "상태이상", value: "!", detail: details.join(" · ") };
    },
    intentHtml = (enemy) => {
      const display = intentDisplay(enemy);
      return `<div class="intent-wrap"><span class="intent-label">다음 행동</span><div class="intent intent-${display.type}" title="${intentText(enemy)}"><span class="intent-icon" aria-hidden="true">${display.icon}</span><span class="intent-copy"><strong>${display.label}</strong>${display.detail ? `<small>${display.detail}</small>` : ""}</span>${display.value ? `<b class="intent-value"><em>${display.unit || ""}</em>${display.value}</b>` : ""}</div></div>`;
    },
    controlIcons = (enemy) =>
      Object.keys(enemy.statuses || {})
        .filter((id) => STATUS_DEFINITIONS[id]?.category === "control")
        .map((id) => STATUS_DEFINITIONS[id].icon)
        .join(" "),
    queueActors = [
      { id: "player", type: "player" },
      ...b.enemies.map((enemy, index) => ({ id: `enemy-${index}`, type: "enemy", enemy, index })),
    ],
    nextEnemyIndex = Number.isInteger(b.actingEnemy)
      ? b.actingEnemy
      : b.enemies.findIndex((enemy, index) =>
          enemy.hp > 0 && !b.completedEnemies?.includes(index)),
    activeTurnId = b.enemyPhase && nextEnemyIndex >= 0 ? `enemy-${nextEnemyIndex}` : "player",
    activeTurnPosition = queueActors.findIndex((actor) => actor.id === activeTurnId),
    orderedQueueActors = activeTurnPosition > 0
      ? [...queueActors.slice(activeTurnPosition), ...queueActors.slice(0, activeTurnPosition)]
      : queueActors,
    queue = `<aside class="turn-order" aria-label="턴 진행 순서"><strong>TURN ORDER</strong>${orderedQueueActors
      .map((actor, position) => {
        if (actor.type === "player")
          return `<div class="turn-chip turn-queue-item player-turn-chip ${activeTurnId === "player" ? "active" : ""}" data-turn-id="player"><i>${String(position + 1).padStart(2, "0")}</i><span>플레이어<small>${activeTurnId === "player" ? "현재 행동" : "대기"}</small></span></div>`;
        const { enemy, index } = actor;
        return `<div class="turn-chip turn-queue-item ${enemy.hp <= 0 ? "defeated" : ""} ${activeTurnId === actor.id ? "active" : ""} ${b.completedEnemies?.includes(index) ? "done" : ""}" data-turn-id="${actor.id}" data-enemy-index="${index}"><i>${String(position + 1).padStart(2, "0")}</i><span>${enemy.name}<small>${enemy.hp > 0 ? intentText(enemy) : "행동 불가"} ${controlIcons(enemy)}</small></span></div>`;
      })
      .join("")}</aside>`,
    field = `<div class="enemies-field enemies-${b.enemies.length}">${b.enemies
      .map((enemy, index) => {
        const data = ENEMIES[enemy.id] || {},
          art = data.image
            ? `<img class="enemy-image" src="${data.image}" alt="${enemy.name}">`
            : `<span class="enemy-symbol" aria-hidden="true">${data.symbol || "◇"}</span>`,
          shieldTone = enemy.shield > 0 ? "positive" : enemy.shield < 0 ? "negative" : "zero",
          threat = attackThreat(enemy, index);
        return `<article class="enemy ${index === b.selectedTarget && enemy.hp > 0 ? "selected" : ""} ${enemy.hp <= 0 ? "defeated" : ""} ${b.actingEnemy === index ? "acting-enemy" : ""}${threat ? ` enemy-threat enemy-threat-${threat.tier}` : ""}" data-action="target" data-target="${index}" tabindex="${enemy.hp > 0 && !b.enemyPhase ? "0" : "-1"}" aria-label="${enemy.name}${index === b.selectedTarget ? " 선택됨" : " 선택"}${threat ? `, ${threat.message}` : ""}">${intentHtml(enemy)}${attackThreatHtml(threat)}<div class="enemy-visual">${art}</div><h2>${enemy.name}</h2><div class="enemy-hp"><span style="width:${(100 * enemy.hp) / enemy.maxHp}%"></span></div><div class="enemy-vitals"><strong class="enemy-health-value">${enemy.hp} / ${enemy.maxHp}</strong><span class="enemy-shield-value shield-${shieldTone}" aria-label="방어막 ${enemy.shield}"><i aria-hidden="true">🛡</i><small>방어막</small><b>${enemy.shield > 0 ? "+" : ""}${enemy.shield}</b></span></div>${statusList(enemy, `${enemy.name} 상태`)}</article>`;
      })
      .join("")}</div>`;
  const enrageStartTurn = E.enrageTurn(b),
    enraged = b.turn >= enrageStartTurn,
    selectedEnemy = b.enemies[b.selectedTarget],
    battleInfo = `<div class="battle-info" aria-label="현재 전투 정보"><span class="battle-info-chip target"><i aria-hidden="true">🎯</i><small>대상</small><b class="ui-marquee" data-marquee><span class="ui-marquee-track">${selectedEnemy?.hp > 0 ? selectedEnemy.name : "없음"}</span></b></span><span class="battle-info-chip"><i aria-hidden="true">👾</i><small>생존</small><b>${E.livingEnemies(b).length}/${b.enemies.length}</b></span><span class="battle-info-chip draw-pile-chip"><i aria-hidden="true">▤</i><small>남은 덱</small><b>${b.draw.length}</b></span><span class="battle-info-chip"><i aria-hidden="true">◆</i><small>손패</small><b>${b.hand.length}</b></span><button type="button" class="battle-info-chip discard-pile-trigger" aria-label="버린 카드 ${b.discard.length}장 보기"><i aria-hidden="true">▽</i><small>버림</small><b>${b.discard.length}</b></button></div>`;
  const recoveryOptions = E.pendingAugmentRecovery(run),
    recoveryPrompt = recoveryOptions.length
      ? `<div class="discard-prompt augment-recovery-prompt" role="alert"><span aria-hidden="true">↥</span><div><strong>무손실 재증류기 · 회수할 카드 1장을 선택하세요</strong><p>${recoveryOptions
          .map(
            (option) =>
              `<button type="button" data-action="augment-recover-discard" data-augment-instance="${option.instanceId}">${CARDS[option.id]?.name || option.id} · 이번 턴 AP 0</button>`,
          )
          .join("")}</p></div></div>`
      : "";
  return `<section class="battle ${b.enemyPhase ? "enemy-phase" : "player-phase"}${enraged ? " enraged" : ""}${isCriticalHealth() ? " health-critical" : ""}"><div class="battle-top"><p class="eyebrow">${ROOM_NAMES[ROUTE[run.node]]} · ROUND ${b.turn} · ${b.enemyPhase ? "ENEMY PHASE" : "PLAYER PHASE"}</p><span class="${enraged ? "enrage-warning" : ""}">${enraged ? "⚠ 폭주 상태: 매 턴 증가하는 방어 무시 피해!" : b.turn >= enrageStartTurn - 2 ? `⚠ ${enrageStartTurn}턴부터 폭주 관통 피해` : "턴 종료 후 적이 위에서부터 행동합니다"}</span></div><div class="battle-arena">${queue}${field}</div><div class="combat-stats">${combatTerm("AP", b.ap, "카드를 사용할 때 소비하며, 턴이 시작되면 다시 충전됩니다. 카드 왼쪽 위 숫자가 필요한 AP입니다.")}${combatTerm("방어막", b.shield, "받는 피해를 먼저 막습니다. 기본적으로 다음 턴 시작 시 사라지지만 일부 유물은 방어막을 보존합니다.")}${combatTerm("흡수", `${b.absorb} / 100`, "오일과 추출 카드로 쌓는 자원입니다. 공간 확산 같은 카드가 흡수를 소비해 강력한 효과를 냅니다.")}${combatTerm(
    "노트",
    b.notes
      .slice(-2)
      .map((c) => (c.note || CARDS[c.id].note).toUpperCase())
      .join(" → ") || "—",
    "카드는 탑·미들·베이스 노트를 가집니다. 순서를 완성하면 관련 특성과 유물의 연쇄 효과가 발동합니다.",
)}</div>${playerEffectsRow("battle")}${recoveryPrompt}${b.pendingDiscard ? `<div class="discard-prompt" role="alert"><span aria-hidden="true">↓</span><div><strong>버릴 카드 ${b.pendingDiscard}장을 선택하세요</strong><p>아래 강조된 카드를 누르면 버립니다. 카드 사용 효과는 발동하지 않습니다.</p></div></div>` : ""}<div class="hand ${b.pendingDiscard ? "hand-discard-choice" : ""}">${b.hand.map((c, i) => cardHtml(c, i)).join("")}</div><div class="turn-bar">${battleInfo}<button class="primary" data-action="end" ${b.enemyPhase || b.pendingDiscard || recoveryOptions.length ? "disabled" : ""}>${b.pendingDiscard ? "버릴 카드 선택 대기 중" : recoveryOptions.length ? "회수할 카드 선택 대기 중" : b.enemyPhase ? "적 행동 진행 중…" : "턴 종료 · 적 페이즈 →"}</button></div></section>`;
}
function presentationCardHtml(card, comparisonCard = null) {
  return cardHtml(card, null, null, comparisonCard).replace(
    "<button ",
    '<button type="button" tabindex="-1" aria-hidden="true" ',
  );
}
const roomRelicPresentation = createRoomRelicPresentation({
  cards: CARDS,
  items: ITEMS,
  presentationCardHtml,
});
const { rewardRoom } = createRewardUi({
  getRun: () => run,
  currentRewardOffer: E.currentRewardOffer,
  power: E.power,
  cardHtml,
  itemHtml,
  formatNumber: number,
});
const { bindRestUpgradeComparison, hideRestUpgradeComparison, restRoom } =
  createRestUpgradeUi({
    engine: E,
    cards: CARDS,
    getRun: () => run,
    cardHtml,
    presentationCardHtml,
    cardEffectText,
  });
function content() {
  switch (run.phase) {
    case "battle":
      return battle();
    case "map":
      { const act = E.actInfo(run.loop); return `<section class="room"><p class="eyebrow">${act.name} · ROOM ${run.node + 1} / 12</p><div class="room-icon">${icons[ROUTE[run.node]]}</div><h1>${ROOM_NAMES[ROUTE[run.node]]}</h1><p>${["gather", "golden"].includes(ROUTE[run.node]) ? "이번 방의 테이블에서 단 하나의 무작위 보상을 발견합니다." : "현재 조합을 시험하고 다음 방으로 나아가세요."}</p><button class="primary" data-action="enter">방에 들어가기 →</button><p class="hint">적 HP ×${act.hp.toFixed(2)} · 공격 ×${act.attack.toFixed(2)}${run.loop >= 3 ? " · 매 턴 불순물 +1" : ""}${run.loop >= 4 ? " · 첫 턴 AP 비용 +1 · 승리 회복 3" : ""}</p></section>`; }
    case "chest":
      return `<section class="room"><p class="eyebrow">${ROOM_NAMES[ROUTE[run.node]]}</p><div class="room-icon">◇</div><h1>어떤 향기가 기다릴까요?</h1><p>능력치 · 특성 · 유물 중 한 가지를 무작위로 획득합니다.</p><button class="primary" data-action="open">상자 열기 ✦</button></section>`;
    case "mystery":
    case "greenhouse":
    case "curse_pit":
    case "lab":
    case "mercury_still":
    case "blood_altar":
    case "dice_altar":
    case "purify_furnace":
    case "mirror_doppel":
    case "smuggler":
      return specialRoom();
    case "reward":
      return rewardRoom();
    case "rest":
      return restRoom();
    case "shop":
      { const potionPrice = E.shopPrice(run, 25, "potion"), offers = E.shopOffers(run, meta);
        const goods = offers.map((offer, index) => {
          const product = offer.type === "card" ? CARDS[offer.id] : ITEMS[offer.id],
            price = E.shopPrice(run, offer.basePrice, offer.type),
            ownedOut = offer.type === "card"
              ? run.deck.length >= E.deckLimit(run) || run.deck.filter((card) => card.id === offer.id).length >= E.cardMaxCopies(offer.id)
              : run.inventory.filter((id) => id === offer.id).length >= product.maxOwned;
          return `<div class="atelier-product reward-tier-${offer.tier}">${offer.type === "card" ? cardHtml({ id: offer.id, level: 0 }) : itemHtml(offer.id)}<button data-action="shop-offer" data-index="${index}" ${offer.sold || ownedOut || run.gold < price ? "disabled" : ""}>${offer.sold ? "판매 완료" : `구매 · ${price} G`}</button></div>`;
        }).join("");
        return `<section class="room"><p class="eyebrow">ATELIER</p><h1>아틀리에</h1><p>포션과 엄선된 액티브 카드·증강을 판매합니다. 상품 가격은 티어에 따라 결정됩니다.</p><button data-action="buy" ${run.gold < potionPrice || run.potions >= E.potionLimit(run) ? "disabled" : ""}>회복약 구매 · ${potionPrice} G (${run.potions}/${E.potionLimit(run)})</button>${run.shopRerolls > 0 ? `<button data-action="shop-reroll">무료 새로고침 · ${run.shopRerolls}회</button>` : ""}<div class="choices atelier-products">${goods || '<p class="hint">판매 드랍테이블 준비 중입니다.</p>'}</div><button class="primary" data-action="leave">상점 나가기 · 던전 진행 →</button></section>`;
      }
    case "loop":
      { const next = E.actInfo(run.loop + 1); return `<section class="room"><p class="eyebrow">HARMONY COMPLETE</p><h1>${E.actInfo(run.loop).name}의 조화가 완성됐습니다.</h1><p>현재 덱과 아이템을 유지한 채 ${next.name}에 진입할 수 있습니다.</p><div class="actions"><button class="primary" data-action="loop">${next.name} 진입 →</button><button data-action="finish">여정 완료 · 기록 확정</button></div></section>`; }
    case "result":
      return `<section class="room result-screen"><p class="eyebrow">${run.hp ? "JOURNEY COMPLETE" : "JOURNEY ENDED"}</p><h1>${run.hp ? "향기로 채운 여정" : "다음에는 또 다른 조합으로"}</h1><div class="result-overview"><div class="result-score">${number(run.score)}<small>POINTS</small></div><div class="result-meta"><span><small>도달 구간</small><b>${run.loop ? `심연 ${run.loop}` : "기본 여정"}</b></span><span><small>도달 방</small><b>${run.node + 1}번째</b></span><span><small>최대 한 방</small><b>${number(run.maxHit)}</b></span></div></div><section class="result-build-panel"><div><small>FINAL BUILD</small><h2>최종 Build</h2><p>카드 ${run.deck.length}장 · 여정 아이템 ${run.inventory.length}개</p></div><button type="button" data-run-open>최종 덱 · 아이템 보기 →</button></section><div class="result-actions"><button class="primary" data-action="new">새로운 여정 →</button></div>${collection()}</section>`;
  }
}


function specialRoom() {
  const room = run.phase;
  if (run.specialDecision?.type === "curse-choice") {
    const decision = run.specialDecision;
    return `<section class="room special-room special-${room}"><p class="eyebrow">COST DECISION</p><div class="room-icon">${icons[room] || "✦"}</div><h1>계약의 대가를 선택하세요</h1><p>${decision.text || "저주 후보 중 하나를 선택해야 합니다."}</p><div class="choices special-curse-choices">${decision.candidates.map((id, index) => `<article class="reward-item reward-tier-${ITEMS[id].tier}">${itemHtml(id)}<button data-action="special-curse" data-index="${index}">${ITEMS[id].name} 선택</button></article>`).join("")}</div><p class="hint">이 비용은 계약의 일부이며, 이후 보상을 거절해도 되돌아오지 않습니다.</p></section>`;
  }
  if (run.specialResult)
    return `<section class="room special-room special-${room}"><p class="eyebrow">CHOICE RESOLVED</p><div class="room-icon">${icons[room] || "✦"}</div><h1>${ROOM_NAMES[room]}</h1><p class="special-result">${run.specialResult.text}</p>${run.specialResult.item ? `<div class="reward-item reward-tier-${ITEMS[run.specialResult.item].tier}">${itemHtml(run.specialResult.item)}</div>` : ""}<button class="primary" data-action="special-leave">다음 방으로 →</button></section>`;
  const descriptions = {
    mystery: "단단히 봉인된 크리스탈 금고입니다. 안전한 T1 능력치를 고르거나, 55%의 Jackpot과 45%의 실패 위험을 감수할 수 있습니다.",
    greenhouse: "고대 향나무와 약초가 지친 조향사를 감싸며 피로를 씻어냅니다.",
    curse_pit: "검은 침전물 아래 T3 유물이 잠들어 있습니다. 손을 넣으면 먼저 T2 저주 계약을 확정해야 합니다.",
    lab: "연금 증류관 안에서 노트를 다시 섞거나 불필요한 카드를 세척할 수 있습니다.",
    mercury_still: "치명적인 수은이 끓어오릅니다. T3 저주를 받아들이면 턴 시작 AP +1을 영구적으로 얻습니다.",
    blood_altar: "검은 피로 물든 제단입니다. 현재 체력과 저주, 또는 골드와 저주를 비용으로 고급 보상을 계약합니다.",
    dice_altar: "향나무로 조각된 운명의 주사위가 증강·골드·저주 중 하나의 완전한 RNG 결과를 불러냅니다.",
    purify_furnace: "모든 것을 태우는 정제의 화로입니다. 고통을 감수해 덱이나 공격력을 벼릴 수 있습니다.",
    mirror_doppel: "거울 속 또 다른 조향사가 카드를 복제합니다. 복제 비용은 카드 티어에 따라 달라집니다.",
    smuggler: "외눈박이 밀수꾼이 위험한 계약을 제시합니다. 비용은 먼저 확정되고, 나온 증강은 거절할 수 있습니다.",
  };
  let choices = "";
  if (room === "mystery") choices = `<button data-action="special-safe"><b>조심스럽게 열기</b><small>T1 능력치 100% · 결과는 거절 가능</small></button><button data-action="special-gamble"><b>자물쇠 부수기</b><small>성공 55%: T4 특성 / T3·T4 유물 · 실패 45%: 체력 -12 + T1 저주 선택</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
  else if (room === "greenhouse") choices = `<button data-action="special-heal"><b>새벽 이슬 마시기</b><small>완전 회복 · 최대 체력 +5</small></button><button data-action="special-cleanse"><b>약초 흙으로 정제</b><small>덱의 모든 불순물 영구 소멸</small></button>`;
  else if (room === "curse_pit") choices = `<button data-action="special-reach"><b>심연 깊숙이 손 넣기</b><small>T2 저주 2개 중 1개 선택 → T3 유물 제시 · 유물은 거절 가능</small></button><button data-action="special-endure"><b>독성 증기 견디기</b><small>다음 전투 부식 2 · 50G</small></button><button data-action="special-flee"><b>도망치기</b><small>안전하게 빠져나가기</small></button>`;
  else if (room === "lab") { const lensCost = Math.max(0, 40 - E.power(run, "labCostDiscount")); choices = `<button data-special-deck-picker="note"><b>노트 치환</b><small>내 덱 보기 → · 카드의 새 노트 선택</small></button><button data-special-deck-picker="remove" ${run.gold < 20 || run.deck.length <= 5 ? "disabled" : ""}><b>용매 세척 · 20G</b><small>내 덱 보기 → · 카드 1장 영구 제거</small></button><button data-action="special-phase_lens" ${run.inventory.includes("relic_phase_crossing_lens") || run.gold < lensCost ? "disabled" : ""}><b>위상 교차 렌즈 조율 · ${lensCost}G</b><small>카드 직접 공격의 접촉 ↔ 비접촉 판정을 반전</small></button>`; }
  else if (room === "mercury_still") choices = `<button data-action="special-overload"><b>수은 밸브 강제 개방</b><small>T3 저주 3개 중 1개 선택 → 턴 시작 AP +1 영구</small></button><button data-action="special-purify"><b>정제 증기 채취</b><small>안전하게 30골드 획득</small></button><button data-action="special-contaminated_essence" ${run.inventory.includes("relic_contaminated_perfumery_essence") ? "disabled" : ""}><b>오염 원액 채취</b><small>오염된 조향 원액 획득 · 다음 전투 부식 +2</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
  else if (room === "blood_altar") choices = `<button data-action="special-sacrifice"><b>피의 영혼 계약</b><small>현재 HP 30% 손실 + T2 저주 선택 → T3 유물 · 유물은 거절 가능</small></button><button data-action="special-tribute" ${run.gold < 50 ? "disabled" : ""}><b>50골드 공양</b><small>50G + T1 저주 → T2~T4 특성 · 특성은 거절 가능</small></button><button data-special-deck-picker="cleanse_card" ${run.deck.length <= 5 ? "disabled" : ""}><b>카드 1장 무료 소각</b><small>내 덱 보기 → · 소각할 카드 선택</small></button><button data-action="special-skip"><b>계약 거절</b><small>아무 일 없이 통과</small></button>`;
  else if (room === "dice_altar") choices = `<button data-action="special-reroll"><b>운명의 주사위 굴리기</b><small>증강 / 30G / T1~T2 저주 중 확률 결과 · 증강은 거절 가능</small></button><button data-action="special-charm"><b>행운의 부적 챙기기</b><small>체력 15 회복 · 25골드</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
  else if (room === "purify_furnace") choices = `<button data-action="special-burn_two" ${run.deck.length <= 5 ? "disabled" : ""}><b>화로에 몸 던지기</b><small>체력 -14 · 덱 앞쪽 카드 최대 2장 소멸</small></button><button data-action="special-flame_power"><b>화염 흡수</b><small>영구 공격력 +3 · 매 전투 첫 턴 연소 2</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
  else if (room === "mirror_doppel") choices = `<button data-special-deck-picker="duplicate" ${run.deck.length >= E.deckLimit(run) ? "disabled" : ""}><b>카드 복제</b><small>내 덱 보기 → · T1 HP-5 / T2 HP-10 / T3 HP-15+불순물 / T4 HP-10+T1 저주</small></button><button data-action="special-gold_double"><b>거울 속 금화 털기</b><small>현재 골드의 30% 추가 획득</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
  else if (room === "smuggler") choices = `<button data-action="special-contraband" ${run.gold < 50 ? "disabled" : ""}><b>밀수품 상자 구매 · 50G</b><small>50G + T1 저주 선택 → T1/T3/T4 유물 · 유물은 거절 가능</small></button><button data-action="special-blood_trade"><b>생명력 물물교환</b><small>최대 체력 -10 → T2~T4 특성 · 특성은 거절 가능</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
  return `<section class="room special-room special-${room}"><p class="eyebrow">INTERACTIVE ROOM</p><div class="room-icon">${icons[room] || "✦"}</div><h1>${ROOM_NAMES[room]}</h1><p>${descriptions[room] || ""}</p><div class="special-choices">${choices}</div></section>`;
}
function shareRecord() {
  return {
    cleared: run.hp > 0,
    score: run.score,
    loop: run.loop,
    room: run.node + 1,
    maxHit: run.maxHit,
    hp: run.hp,
    maxHp: run.maxHp,
    attack: E.power(run, "attack"),
    defense: E.power(run, "defense"),
    deckCount: run.deck.length,
    items: countItemIds(run.inventory).map(([id, count]) => ({ name: ITEMS[id].name, count })),
  };
}
function mountDeckCapacity() {
  const button = document.querySelector(".run-summary-button");
  if (!button) return;
  const limit = E.deckLimit(run),
    capacity = document.createElement("div");
  capacity.className = `deck-capacity${run.deck.length >= limit ? " deck-capacity-full" : ""}`;
  capacity.innerHTML = `<span><i>▤</i> 덱 카드</span><b>${run.deck.length} / ${limit}장</b>`;
  button.before(capacity);
}
function mountGoldStat() {
  const grid = document.querySelector(".stat-grid");
  if (!grid) return;
  (grid.querySelector(".health-stat") || grid).insertAdjacentHTML(
    grid.querySelector(".health-stat") ? "afterend" : "beforeend",
    `<div class="stat-row gold-stat"><i>●</i><span>골드</span><b>${number(run.gold)}G</b></div>`,
  );
}
function mountResultShare() {
  const room = document.querySelector(".room"),
    newButton = room?.querySelector('[data-action="new"]');
  if (!room || !newButton) return;
  newButton.insertAdjacentHTML(
    "beforebegin",
    '<div class="result-share"><button type="button" data-harmony-share="kakao">카카오톡 공유</button><button type="button" data-harmony-share="image">이미지 저장</button><button type="button" data-harmony-share="link">링크 복사</button></div><p class="share-status" role="status"></p>',
  );
}
function showSynergyDiscovery(ids) {
  for (const [index, id] of ids.entries()) {
    const synergy = HIDDEN_SYNERGIES[id];
    if (!synergy) continue;
    const popup = document.createElement("aside");
    popup.className = "synergy-discovery-popup";
    popup.style.setProperty("--notice-index", index);
    popup.innerHTML = `<small>✦ 뜻밖의 조화 발견!</small><strong>${synergy.name}</strong><p>${synergy.description}</p>`;
    document.body.append(popup);
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
  }
}
function showUnlockDiscovery(entries) {
  for (const [index, entry] of entries.entries()) {
    const popup = document.createElement("aside");
    popup.className = "synergy-discovery-popup unlock-discovery-popup";
    popup.style.setProperty("--notice-index", index);
    popup.innerHTML = `<small>🏆 업적 달성 · 새로운 해금</small><strong>${entry.name}</strong><p>${entry.goal}</p>`;
    document.body.append(popup);
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
  }
}
const PRESERVED_SCROLL_AREAS = [
  ".battle",
  ".hand",
  ".enemies-field",
  ".battle-info",
  ".player-stats",
  ".acquired-list",
];
let discardPreviewCloseTimer = 0;
function discardPreviewPortal() {
  let portal = document.querySelector("#discard-preview-portal");
  if (portal) return portal;
  portal = document.createElement("aside");
  portal.id = "discard-preview-portal";
  portal.className = "discard-preview";
  portal.setAttribute("popover", "manual");
  portal.setAttribute("aria-label", "버린 카드 목록");
  document.body.append(portal);
  portal.addEventListener("pointerenter", () =>
    clearTimeout(discardPreviewCloseTimer),
  );
  portal.addEventListener("pointerleave", scheduleDiscardPreviewClose);
  portal.addEventListener(
    "wheel",
    (event) => {
      const cards = event.target.closest(".discard-preview-cards");
      if (!cards || cards.scrollWidth <= cards.clientWidth) return;
      event.preventDefault();
      cards.scrollLeft += event.deltaY || event.deltaX;
    },
    { passive: false },
  );
  return portal;
}
function openDiscardPreview(trigger) {
  if (!run?.battle) return;
  clearTimeout(discardPreviewCloseTimer);
  const portal = discardPreviewPortal(),
    cards = run.battle.discard,
    rect = trigger.getBoundingClientRect(),
    width = Math.min(760, window.innerWidth - 24);
  portal.innerHTML = `<div class="discard-preview-head"><span><b>버린 카드</b><small>최근에 버린 카드부터 표시됩니다</small></span><strong>${cards.length}장</strong></div>${cards.length ? `<div class="discard-preview-cards">${cards.slice().reverse().map((card) => cardHtml(card)).join("")}</div>` : '<p class="discard-preview-empty">아직 버린 카드가 없습니다.</p>'}`;
  portal.style.width = `${width}px`;
  portal.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2))}px`;
  portal.style.bottom = `${Math.max(12, window.innerHeight - rect.top)}px`;
  if (typeof portal.showPopover === "function") {
    if (!portal.matches(":popover-open")) portal.showPopover();
  } else portal.classList.add("discard-preview-open");
}
function closeDiscardPreview() {
  const portal = document.querySelector("#discard-preview-portal");
  if (!portal) return;
  if (typeof portal.hidePopover === "function" && portal.matches(":popover-open"))
    portal.hidePopover();
  portal.classList.remove("discard-preview-open");
}
function scheduleDiscardPreviewClose() {
  clearTimeout(discardPreviewCloseTimer);
  discardPreviewCloseTimer = window.setTimeout(closeDiscardPreview, 140);
}
function captureViewScroll() {
  const app = $("app"),
    areas = {};
  for (const selector of PRESERVED_SCROLL_AREAS) {
    const element = app?.querySelector(selector);
    if (element)
      areas[selector] = { left: element.scrollLeft, top: element.scrollTop };
  }
  return { areas, windowX: window.scrollX, windowY: window.scrollY };
}
function restoreViewScroll(snapshot) {
  if (!snapshot) return;
  const app = $("app");
  for (const [selector, position] of Object.entries(snapshot.areas)) {
    const element = app?.querySelector(selector);
    if (!element) continue;
    element.scrollLeft = position.left;
    element.scrollTop = position.top;
  }
  if (window.scrollX !== snapshot.windowX || window.scrollY !== snapshot.windowY)
    window.scrollTo(snapshot.windowX, snapshot.windowY);
}
function captureTurnOrderLayout() {
  const items = [...document.querySelectorAll(".turn-queue-item[data-turn-id]")];
  return {
    order: items.map((item) => item.dataset.turnId).join("|"),
    positions: new Map(items.map((item) => [item.dataset.turnId, item.getBoundingClientRect()])),
  };
}
function animateTurnOrderTransition(previous) {
  if (!previous?.positions.size || matchMedia("(prefers-reduced-motion: reduce)").matches)
    return;
  const items = [...document.querySelectorAll(".turn-queue-item[data-turn-id]")],
    nextOrder = items.map((item) => item.dataset.turnId).join("|");
  if (previous.order === nextOrder) return;
  for (const item of items) {
    const before = previous.positions.get(item.dataset.turnId);
    if (!before) continue;
    const after = item.getBoundingClientRect(),
      deltaX = before.left - after.left,
      deltaY = before.top - after.top,
      revolvingToBack = deltaY < 0 || deltaX < 0;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) continue;
    const scale = item.classList.contains("active") ? 1.045 : 1;
    item.style.zIndex = revolvingToBack ? "4" : "2";
    const motion = item.animate(
      [
        { transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scale})` },
        {
          transform: `translate3d(${deltaX * .46}px, ${deltaY * .46}px, 0) rotateX(${revolvingToBack ? -13 : 5}deg) scale(${revolvingToBack ? .94 : scale})`,
          offset: .54,
        },
        { transform: `translate3d(0, 0, 0) scale(${scale})` },
      ],
      { duration: 460, easing: "cubic-bezier(.22,.78,.22,1)" },
    );
    motion.finished.catch(() => {}).finally(() => item.style.removeProperty("z-index"));
  }
}
function refreshOverflowMarquees(root = document) {
  const hosts = root.querySelectorAll?.("[data-marquee]") || [];
  for (const host of hosts) {
    const track = host.querySelector(".ui-marquee-track");
    if (!track) continue;
    const overflow = Math.ceil(track.scrollWidth - host.clientWidth);
    if (overflow <= 2) {
      host.classList.remove("is-overflowing");
      host.style.removeProperty("--marquee-shift");
      host.style.removeProperty("--marquee-duration");
      continue;
    }
    const shift = `${overflow + 6}px`,
      duration = `${Math.min(9, Math.max(5.4, 4.6 + overflow / 18)).toFixed(2)}s`;
    if (host.style.getPropertyValue("--marquee-shift") !== shift)
      host.style.setProperty("--marquee-shift", shift);
    if (host.style.getPropertyValue("--marquee-duration") !== duration)
      host.style.setProperty("--marquee-duration", duration);
    host.classList.add("is-overflowing");
  }
}
function scheduleOverflowMarqueeRefresh(root = document) {
  requestAnimationFrame(() => refreshOverflowMarquees(root));
}
function render() {
  clearTransientNotice();
  hideBattleHandDetailPanel();
  closeDiscardPreview();
  const scrollSnapshot = captureViewScroll(),
    turnOrderLayout = captureTurnOrderLayout();
  const goldGain = run?._goldFeedback || 0,
    goldSpent = run?._goldSpentFeedback || 0,
    synergyDiscoveries = run?._synergyDiscoveries || [],
    unlockDiscoveries = run?._unlockFeedback || [];
  if (run) {
    delete run._goldFeedback;
    delete run._goldSpentFeedback;
    delete run._synergyDiscoveries;
    delete run._unlockFeedback;
  }
  document.body.classList.toggle("codex-complete", E.codexPerks(meta).goldenCollection);
  SFX.setCriticalHeartbeat(Boolean(started && run?.phase === "battle" && isCriticalHealth()));
  if (!started) {
    document.querySelector(".battle-state-frame")?.remove();
    $("app").innerHTML = lobby();
    window.HarmonyPcFrame?.sync?.(null);
    return;
  }
  const frameMarkup =
    hud() +
    `<div class="play-layout">${statsPanel()}<div class="play-content">${content()}</div>${acquiredPanel()}</div>`;
  $("app").innerHTML = window.HarmonyPcFrame?.transform?.(frameMarkup, run) ?? frameMarkup;
  window.HarmonyPcFrame?.sync?.(run);
  syncBattleStateFrame();
  mountGoldStat();
  mountDeckCapacity();
  restoreViewScroll(scrollSnapshot);
  animateTurnOrderTransition(turnOrderLayout);
  scheduleOverflowMarqueeRefresh($("app"));
  if (run.phase === "result") mountResultShare();
  if (goldGain) showGoldGain(goldGain);
  if (goldSpent) showGoldSpend(goldSpent);
  if (synergyDiscoveries.length) showSynergyDiscovery(synergyDiscoveries);
  if (unlockDiscoveries.length) showUnlockDiscovery(unlockDiscoveries);
}
function enemyElement(targetIndex = null) {
  return Number.isInteger(targetIndex)
    ? document.querySelector(`.enemy[data-target="${targetIndex}"]`)
    : document.querySelector(".enemy.selected, .enemy:not(.defeated)");
}
let combatFxSequence = 0;
function combatEffectsEnabled() {
  const override = document.documentElement.dataset.combatFx;
  if (override === "off") return false;
  if (override === "on") return true;
  try {
    return browserRuntime.localStorage()?.getItem("harmony_combat_fx") !== "off";
  } catch {
    return true;
  }
}
const {
  playContactHitSound,
  showEnemyDebuffSmoke,
  showEnemyHealing,
  showPlayerDamage,
  showPlayerHealing,
  showStatusDamageQueue,
  showStatusProcQueue,
  showStatusProcVfx,
} = createCombatFeedbackVfx({
  combatEffectsEnabled,
  enemyElement,
  effectsLayer,
  formatNumber: number,
  reducedCombatMotion,
});
function reducedCombatMotion() {
  return browserRuntime.prefersReducedMotion();
}
const {
  contactHitPause,
  resolveMultiHitImpactPoint,
  showHitFeedback,
  showStrongContactImpact,
  showWeakContactImpact,
} = createAttackFeedbackVfx({
  combatEffectsEnabled,
  effectsLayer,
  enemyElement,
  formatNumber: number,
  getCombatFxSequence: () => combatFxSequence,
  nextCombatFxSequence: () => combatFxSequence++,
  playContactHitSound,
  reducedCombatMotion,
});
function showAbsorbVortex(host) {
  if (!host) return;
  const bounds = host.getBoundingClientRect(),
    vortex = document.createElement("span"),
    particleCount = 10;
  vortex.className = "absorb-vortex";
  vortex.setAttribute("aria-hidden", "true");
  vortex.style.left = `${bounds.left + bounds.width / 2}px`;
  vortex.style.top = `${bounds.top + bounds.height / 2}px`;
  for (let index = 0; index < particleCount; index++) {
    const particle = document.createElement("i");
    particle.style.setProperty("--absorb-angle", `${index * 36 + 12}deg`);
    particle.style.setProperty(
      "--absorb-distance",
      `${46 + (index % 4) * 11}px`,
    );
    particle.style.setProperty("--absorb-delay", `${(index % 5) * 28}ms`);
    vortex.append(particle);
  }
  effectsLayer().append(vortex);
  window.setTimeout(() => vortex.remove(), 980);
}
function showHarmonyResonance(trigger, order = 0) {
  const battle = document.querySelector(".battle");
  if (!battle) return;
  const visual = ["attack", "defense", "absorb", "heal"].includes(
      trigger.visual,
    )
      ? trigger.visual
      : ["attack", "defense", "absorb", "heal"].includes(trigger.category)
        ? trigger.category
        : "default",
    resonance = document.createElement("span");
  resonance.className = `harmony-resonance harmony-resonance-${visual}`;
  resonance.setAttribute("role", "alert");
  resonance.setAttribute(
    "aria-label",
    `${trigger.label || "HARMONY!"} ${visual === "default" ? "" : visual}`.trim(),
  );
  resonance.style.setProperty("--harmony-delay", `${order * 0.18}s`);
  resonance.innerHTML = `<span class="harmony-chain"><i style="--note-delay:0s">TOP</i><i style="--note-delay:.14s">MIDDLE</i><i style="--note-delay:.28s">BASE</i></span><span class="harmony-ring harmony-ring-a"></span><span class="harmony-ring harmony-ring-b"></span><strong>${trigger.label || "HARMONY!"}</strong>`;
  placeBattleOverlay(resonance, battle);
  window.setTimeout(() => resonance.remove(), 1600 + order * 180);
}
function showMonsterDeathBurst(enemy, order = 0) {
  if (!enemy) return;
  const burst = document.createElement("span"),
    particleCount = 12;
  burst.className = "monster-death-burst";
  burst.setAttribute("aria-hidden", "true");
  burst.style.setProperty("--death-order", order);
  for (let index = 0; index < particleCount; index++) {
    const shard = document.createElement("i"),
      angle = (360 / particleCount) * index + 9,
      distance = 42 + (index % 4) * 12;
    shard.style.setProperty("--death-angle", `${angle}deg`);
    shard.style.setProperty("--death-distance", `${distance}px`);
    shard.style.setProperty("--death-rotate", `${index % 2 ? 95 : -95}deg`);
    burst.append(shard);
  }
  enemy.append(burst);
  window.setTimeout(() => burst.remove(), 820);
}
const SPECIAL_CARD_CAST_VFX = Object.freeze({
  // Optional card-only cast motions can be added with `fx: { cast: "your-key" }`.
  // Unregistered keys intentionally fall back to the normal category cast.
  // "example-card-cast": ({ card, power, targetIndex }) => { ... },
});
function updateEnemyHealthFeedback(targetIndex, hp, maxHp) {
  const enemy = enemyElement(targetIndex);
  if (!enemy || !Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0)
    return;
  const bar = enemy.querySelector(".enemy-hp span"),
    label = enemy.querySelector(".enemy-health-value");
  if (bar) bar.style.width = `${(100 * Math.max(0, hp)) / maxHp}%`;
  if (label) label.textContent = `${Math.max(0, hp)} / ${maxHp}`;
}
function showEnemyShieldBlock(
  amount,
  targetIndex = null,
  fullyBlocked = false,
) {
  const enemy = enemyElement(targetIndex);
  if (!enemy || amount <= 0) return;
  SFX.shieldBlock();
  if (fullyBlocked) SFX.defense();
  enemy.classList.remove("enemy-shield-block");
  void enemy.offsetWidth;
  enemy.classList.add("enemy-shield-block");
  const effect = document.createElement("span");
  effect.className = "enemy-shield-wave";
  effect.textContent = "🛡";
  effect.setAttribute("aria-hidden", "true");
  const popup = document.createElement("strong");
  popup.className = "enemy-shield-pop";
  popup.textContent = `-${number(amount)} 경감`;
  popup.setAttribute(
    "aria-label",
    `몬스터 방어막으로 피해 ${number(amount)} 경감`,
  );
  enemy.append(effect, popup);
  effect.addEventListener("animationend", () => effect.remove(), {
    once: true,
  });
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
}
function showAbsorbGain(amount) {
  if (amount <= 0) return;
  const absorb = document.querySelector(
    ".combat-stats .combat-term:nth-child(3)",
  );
  if (!absorb) return;
  SFX.absorb();
  absorb.classList.remove("absorb-gain");
  void absorb.offsetWidth;
  absorb.classList.add("absorb-gain");
  showAbsorbVortex(absorb);
  const popup = document.createElement("strong");
  const bounds = absorb.getBoundingClientRect();
  popup.className = "absorb-gain-pop";
  popup.textContent = `+${number(amount)}`;
  popup.setAttribute("aria-label", `흡수 ${number(amount)} 증가`);
  popup.style.left = `${bounds.left + bounds.width / 2}px`;
  popup.style.top = `${bounds.top}px`;
  effectsLayer().append(popup);
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
}
function showAbsorbLoss(amount) {
  if (amount <= 0) return;
  const absorb = document.querySelector(
    ".combat-stats .combat-term:nth-child(3)",
  );
  if (!absorb) return;
  absorb.classList.remove("absorb-loss");
  void absorb.offsetWidth;
  absorb.classList.add("absorb-loss");
  const popup = document.createElement("strong");
  const bounds = absorb.getBoundingClientRect();
  popup.className = "absorb-loss-pop";
  popup.textContent = `-${number(amount)}`;
  popup.setAttribute("aria-label", `흡수 ${number(amount)} 감소`);
  popup.style.left = `${bounds.left + bounds.width / 2}px`;
  popup.style.top = `${bounds.top}px`;
  effectsLayer().append(popup);
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
}
function showEnrageDamage(amount) {
  if (amount <= 0) return;
  const popup = document.createElement("strong");
  popup.className = "enrage-damage-popup";
  popup.textContent = `⚡ 폭주 관통 -${number(amount)}`;
  popup.setAttribute("role", "alert");
  effectsLayer().append(popup);
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
}
function showHarmonyFeedback(triggers) {
  if (triggers.length) SFX.harmony();
  for (const [index, trigger] of triggers.entries())
    showHarmonyResonance(trigger, index);
}
async function showImpurityOverflowDamage(hit) {
  if (!hit?.amount) return;
  const battle = document.querySelector(".battle"),
    discard = document.querySelector(".discard-pile-trigger");
  if (!battle) {
    showPlayerDamage(hit.amount, null, false, false, false);
    return;
  }
  const battleRect = battle.getBoundingClientRect(),
    discardRect = discard?.getBoundingClientRect(),
    width = Math.min(154, Math.max(118, battleRect.width * 0.18)),
    height = width * 1.72,
    centerX = battleRect.left + battleRect.width / 2,
    centerY = battleRect.top + battleRect.height / 2,
    sourceX = discardRect
      ? discardRect.left + discardRect.width / 2
      : battleRect.right - 34,
    sourceY = discardRect
      ? discardRect.top + discardRect.height / 2
      : battleRect.bottom - 24,
    offsetX = sourceX - centerX,
    offsetY = sourceY - centerY,
    wrapper = document.createElement("div");
  wrapper.innerHTML = cardHtml({ id: "impurity", level: 0 });
  const card = wrapper.firstElementChild;
  if (!card) return;
  card.classList.add("impurity-overflow-card");
  card.removeAttribute("data-action");
  card.removeAttribute("data-index");
  card.tabIndex = -1;
  card.setAttribute("aria-hidden", "true");
  Object.assign(card.style, {
    left: `${centerX - width / 2}px`,
    top: `${centerY - height / 2}px`,
    width: `${width}px`,
    height: `${height}px`,
  });
  discard?.classList.add("impurity-overflow-pile");
  effectsLayer().append(card);
  const reducedMotion = reducedCombatMotion(),
    enter = card.animate(
      reducedMotion
        ? [
            { opacity: 0, transform: "scale(.72)" },
            { opacity: 1, transform: "scale(1)" },
          ]
        : [
            {
              opacity: 0,
              transform: `translate3d(${offsetX}px,${offsetY}px,0) rotate(-16deg) scale(.08)`,
            },
            {
              opacity: 0.92,
              transform: `translate3d(${offsetX * 0.72}px,${offsetY * 0.72}px,0) rotate(-11deg) scale(.28)`,
              offset: 0.22,
            },
            {
              opacity: 1,
              transform: "translate3d(0,0,0) rotate(2deg) scale(1.09)",
              offset: 0.84,
            },
            {
              opacity: 1,
              transform: "translate3d(0,0,0) rotate(0) scale(1)",
            },
          ],
      {
        duration: reducedMotion ? 180 : 620,
        easing: "cubic-bezier(.16,.82,.22,1)",
        fill: "forwards",
      },
    );
  await enter.finished.catch(() => {});

  card.classList.add("impurity-overflow-smoking");
  const smoke = document.createElement("span");
  smoke.className = "impurity-overflow-smoke";
  smoke.setAttribute("aria-hidden", "true");
  smoke.style.left = `${centerX}px`;
  smoke.style.top = `${centerY}px`;
  smoke.innerHTML = "<i></i>".repeat(reducedMotion ? 5 : 11);
  [...smoke.children].forEach((particle, index) => {
    const angle = (360 / smoke.children.length) * index + Math.random() * 22;
    particle.style.setProperty("--impurity-smoke-angle", `${angle}deg`);
    particle.style.setProperty("--impurity-smoke-distance", `${42 + Math.random() * 66}px`);
    particle.style.setProperty("--impurity-smoke-size", `${30 + Math.random() * 38}px`);
    particle.style.setProperty("--impurity-smoke-delay", `${Math.random() * 0.08}s`);
  });
  effectsLayer().append(smoke);
  SFX.impurity();
  await sleep(reducedMotion ? 100 : 270);
  showPlayerDamage(hit.amount, null, false, false, false);
  await sleep(reducedMotion ? 80 : 210);
  card.classList.remove("impurity-overflow-smoking");

  const leave = card.animate(
    reducedMotion
      ? [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(.72)" },
        ]
      : [
          { opacity: 1, transform: "translate3d(0,0,0) rotate(0) scale(1)" },
          {
            opacity: 0.82,
            transform: `translate3d(${offsetX * 0.3}px,${offsetY * 0.3}px,0) rotate(7deg) scale(.68)`,
            offset: 0.38,
          },
          {
            opacity: 0,
            transform: `translate3d(${offsetX}px,${offsetY}px,0) rotate(15deg) scale(.08)`,
          },
        ],
    {
      duration: reducedMotion ? 180 : 470,
      easing: "cubic-bezier(.55,.02,.82,.42)",
      fill: "forwards",
    },
  );
  await leave.finished.catch(() => {});
  card.remove();
  discard?.classList.remove("impurity-overflow-pile");
  window.setTimeout(() => smoke.remove(), reducedMotion ? 0 : 260);
}
async function showImpurityOverflowQueue(hits) {
  for (const hit of hits) await showImpurityOverflowDamage(hit);
}
function showGoldGain(amount) {
  const gold = document.querySelector(".gold-stat");
  if (!gold || amount <= 0) return;
  SFX.coinGet();
  gold.classList.remove("gold-gaining");
  void gold.offsetWidth;
  gold.classList.add("gold-gaining");
  const effect = document.createElement("span");
  effect.className = "gold-gain-effect";
  effect.setAttribute("aria-label", `${number(amount)} 골드 획득`);
  effect.innerHTML = `<i class="coin coin-a">●</i><i class="coin coin-b">●</i><i class="coin coin-c">●</i><strong>+${number(amount)}G</strong>`;
  gold.append(effect);
  effect
    .querySelector("strong")
    .addEventListener("animationend", () => effect.remove(), { once: true });
}
function showGoldSpend(amount) {
  const gold = document.querySelector(".gold-stat");
  if (!gold || amount <= 0) return;
  gold.classList.remove("gold-spending");
  void gold.offsetWidth;
  gold.classList.add("gold-spending");
  const effect = document.createElement("span");
  effect.className = "gold-spend-effect";
  effect.setAttribute("aria-label", `${number(amount)} 골드 소비`);
  effect.innerHTML = `<i class="spent-coin">●</i><strong>-${number(amount)}G</strong>`;
  gold.append(effect);
  SFX.purchase();
  effect
    .querySelector("strong")
    .addEventListener("animationend", () => effect.remove(), { once: true });
}
function showShieldBlock(amount, fullyBlocked = false) {
  const battle = document.querySelector(".battle"),
    stats = document.querySelector(".combat-stats");
  if (!battle || !stats || amount <= 0) return;
  SFX.shieldBlock();
  if (fullyBlocked) SFX.defense();
  showBattleShieldOverlay("shield-block");
  const popup = document.createElement("strong");
  popup.className = "shield-block-pop";
  popup.textContent = `🛡 -${number(amount)} 경감`;
  popup.setAttribute("aria-label", `방어막으로 피해 ${number(amount)} 경감`);
  stats.append(popup);
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
}
function showShieldGain(amount, playCardSound = false) {
  const battle = document.querySelector(".battle"),
    shield = document.querySelector(".combat-stats .combat-term:nth-child(2)");
  if (!battle || !shield || amount <= 0) return;
  SFX.shieldGain();
  if (playCardSound) SFX.shieldCast();
  shield.classList.remove("shield-stat-gain");
  showBattleShieldOverlay("shield-gain");
  shield.classList.add("shield-stat-gain");
  const popup = document.createElement("strong");
  popup.className = "shield-gain-pop";
  popup.textContent = `+${number(amount)}`;
  popup.setAttribute("aria-label", `방어막 ${number(amount)} 증가`);
  shield.append(popup);
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
}
function effectsLayer() {
  let layer = $("fx-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "fx-layer";
    layer.setAttribute("aria-live", "polite");
    document.body.prepend(layer);
  }
  return layer;
}
function beginStrongAttackFocus(
  sourceRect,
  targetRect,
  reducedMotion = false,
  duration = 780,
  pullbackX = 0,
  pullbackY = 0,
  superStrong = false,
) {
  if (reducedMotion || !combatEffectsEnabled()) return () => {};
  const dimmer = document.createElement("span"),
    focus = document.createElement("span"),
    sourceX = sourceRect.left + sourceRect.width / 2,
    sourceY = sourceRect.top + sourceRect.height / 2,
    targetX = targetRect.left + targetRect.width / 2,
    targetY = targetRect.top + targetRect.height / 2;
  dimmer.className = `strong-attack-dimmer${superStrong ? " super-contact-focus" : ""}`;
  focus.className = `strong-attack-focus${superStrong ? " super-contact-focus" : ""}`;
  dimmer.setAttribute("aria-hidden", "true");
  focus.setAttribute("aria-hidden", "true");
  focus.style.setProperty("--focus-start-x", `${sourceX}px`);
  focus.style.setProperty("--focus-start-y", `${sourceY}px`);
  focus.style.setProperty("--focus-travel-x", `${targetX - sourceX}px`);
  focus.style.setProperty("--focus-travel-y", `${targetY - sourceY}px`);
  focus.style.setProperty("--focus-pullback-x", `${pullbackX}px`);
  focus.style.setProperty("--focus-pullback-y", `${pullbackY}px`);
  focus.style.setProperty("--focus-duration", `${duration}ms`);
  dimmer.style.setProperty("--focus-duration", `${duration}ms`);
  document.body.append(dimmer, focus);
  return () => {
    dimmer.remove();
    focus.remove();
  };
}
function beginSuperAttackCharge(
  sourceRect,
  reducedMotion = false,
  pullbackX = 0,
  pullbackY = 0,
  duration = 1480,
) {
  if (!combatEffectsEnabled()) return () => {};
  const charge = document.createElement("span"),
    reducedPullbackX = pullbackX * .18,
    reducedPullbackY = pullbackY * .18;
  charge.className = `super-attack-charge${reducedMotion ? " super-attack-charge-reduced" : ""}`;
  charge.setAttribute("aria-hidden", "true");
  charge.style.left = `${sourceRect.left + sourceRect.width / 2}px`;
  charge.style.top = `${sourceRect.top + sourceRect.height / 2}px`;
  charge.style.setProperty("--super-charge-duration", `${duration}ms`);
  if (!reducedMotion) {
    for (let index = 0; index < 12; index++) {
      const ray = document.createElement("i");
      ray.style.setProperty("--charge-angle", `${index * 30}deg`);
      ray.style.setProperty("--charge-delay", `${-(index % 12) * .046}s`);
      ray.style.setProperty("--charge-distance", `${205 + (index % 5) * 18}px`);
      ray.style.setProperty("--charge-length", `${78 + (index % 6) * 11}px`);
      charge.append(ray);
    }
  }
  document.body.append(charge);
  const tracking = charge.animate(
    reducedMotion
      ? [
          {
            opacity: 0,
            transform: "translate3d(-50%, -50%, 0) scale(.78)",
          },
          {
            opacity: .92,
            transform: "translate3d(-50%, -50%, 0) scale(1)",
            offset: .28,
          },
          {
            opacity: .82,
            transform: `translate3d(calc(-50% + ${reducedPullbackX}px), calc(-50% + ${reducedPullbackY - 4}px), 0) scale(1.06)`,
            offset: .78,
          },
          {
            opacity: 0,
            transform: `translate3d(calc(-50% + ${reducedPullbackX}px), calc(-50% + ${reducedPullbackY - 4}px), 0) scale(1.12)`,
          },
        ]
      : [
          { transform: "translate3d(-50%, -50%, 0)", offset: 0 },
          { transform: "translate3d(-50%, -50%, 0)", offset: .18 },
          { transform: `translate3d(calc(-50% + ${pullbackX}px), calc(-50% + ${pullbackY - 10}px), 0)`, offset: .48 },
          { transform: `translate3d(calc(-50% + ${pullbackX + 3}px), calc(-50% + ${pullbackY - 9}px), 0)`, offset: .6 },
          { transform: `translate3d(calc(-50% + ${pullbackX}px), calc(-50% + ${pullbackY - 10}px), 0)`, offset: .7 },
          { transform: `translate3d(calc(-50% + ${pullbackX}px), calc(-50% + ${pullbackY - 10}px), 0)`, offset: 1 },
        ],
    { duration, easing: "linear", fill: "forwards" },
  );
  return () => {
    tracking.cancel();
    charge.remove();
  };
}
function showApSpend(card, amount) {
  if (amount <= 0) return;
  const cardBox = card.getBoundingClientRect(),
    popup = document.createElement("strong");
  popup.className = "ap-cost-pop";
  popup.textContent = `-${amount} AP`;
  popup.setAttribute("aria-label", `행동력 ${amount} 소비`);
  popup.style.left = `${cardBox.left + cardBox.width / 2}px`;
  popup.style.top = `${Math.max(8, cardBox.top - 12)}px`;
  effectsLayer().append(popup);
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
}
async function showMonsterDeath(defeated = []) {
  const targets = defeated
    .map(({ index }) => document.querySelector(`.enemy[data-target="${index}"]`))
    .filter(Boolean);
  if (!targets.length) {
    const fallback = document.querySelector(".enemy.defeated, .enemy.selected");
    if (fallback) targets.push(fallback);
  }
  if (!targets.length) return;
  SFX.monsterDeath(defeated[0]?.material);
  targets.forEach((enemy, index) => showMonsterDeathBurst(enemy, index));
  for (const enemy of targets) {
    const hp = enemy.querySelector(".enemy-hp span");
    if (hp) hp.style.width = "0";
    enemy.classList.add("monster-dying");
  }
  await new Promise((resolve) => setTimeout(resolve, 760));
}
async function waitForLethalHitEffects(defeated = []) {
  const targets = defeated
      .map(({ index }) => document.querySelector(`.enemy[data-target="${index}"]`))
      .filter(Boolean),
    effects = targets.flatMap((target) => [
      ...target.querySelectorAll(
        ".weak-contact-impact, .strong-contact-impact, .damage-pop, .enemy-shield-wave, .enemy-shield-pop",
      ),
    ]),
    animations = effects.flatMap((effect) => effect.getAnimations({ subtree: true }));
  if (!animations.length) {
    await sleep(180);
    return;
  }
  await Promise.race([
    Promise.allSettled(animations.map((animation) => animation.finished)),
    sleep(1050),
  ]);
}
async function showPlayerDeath(damage = 0) {
  const battle = document.querySelector(".battle"),
    stats = document.querySelector(".player-stats");
  if (!battle && !stats) return;
  if (damage > 0) showPlayerDamage(damage, null, false, false, false);
  SFX.playerDeath();
  battle?.classList.add("player-dying");
  stats?.classList.add("player-dying");
  await sleep(820);
}
function stageDrawFeedback(amount) {
  if (amount <= 0) return;
  const cards = [...document.querySelectorAll(".hand .card")];
  cards.slice(-amount).forEach((card) => card.classList.add("card-draw-pending"));
}
async function showDrawFeedback(amount) {
  if (amount <= 0) return;
  const cards = [...document.querySelectorAll(".hand .card")],
    drawnCards = cards.slice(-amount),
    interval = Math.min(
      140,
      Math.floor(600 / Math.max(1, drawnCards.length - 1)),
    );
  drawnCards.forEach((card) => card.classList.add("card-draw-pending"));
  for (let index = 0; index < drawnCards.length; index++) {
    const card = drawnCards[index];
    card.classList.remove("card-draw-pending");
    card.classList.add("card-drawing");
    if (card.classList.contains("card-impurity")) SFX.impurity();
    else SFX.draw();
    if (index < drawnCards.length - 1) await sleep(interval);
  }
  await sleep(340);
}
async function showShuffleFeedback(amount = 1) {
  const pile = document.querySelector(".draw-pile-chip");
  if (!pile || amount <= 0) return;
  SFX.shuffle();
  const rect = pile.getBoundingClientRect(),
    popup = document.createElement("strong");
  popup.className = "shuffle-popup";
  popup.textContent = "셔플";
  popup.setAttribute("role", "status");
  popup.style.left = `${rect.left + rect.width / 2}px`;
  popup.style.top = `${Math.max(8, rect.top - 7)}px`;
  document.body.append(popup);
  pile.classList.add("draw-pile-shuffling");
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
  // The processed shuffle clip is about 630ms. Finish it, hold for another
  // 200ms, and only then begin the draw animation and its transient.
  await sleep(830);
  pile.classList.remove("draw-pile-shuffling");
}
function attackPowerRank(power = "weak") {
  return power === "super" ? 3 : power === "strong" ? 2 : 1;
}
function strongestAttackPower(hits = [], pattern = null) {
  return hits.reduce((best, hit) => {
    if (hit.statusId || (pattern && hit.attackPattern !== pattern)) return best;
    if (!(hit.damage || hit.blocked)) return best;
    const power = hit.fx?.power || E.combatFxPowerTier((hit.damage || 0) + (hit.blocked || 0));
    return attackPowerRank(power) > attackPowerRank(best) ? power : best;
  }, "weak");
}
async function animateNonContactCast(card, power = "weak", targetIndex = null, cardDefinition = null) {
  if (!card?.isConnected) return;
  if (!combatEffectsEnabled()) return;
  const specialCast = SPECIAL_CARD_CAST_VFX[cardDefinition?.fx?.cast];
  if (typeof specialCast === "function") {
    await specialCast({ card, power, targetIndex, cardDefinition });
    return;
  }
  const rect = card.getBoundingClientRect(),
    target = enemyElement(targetIndex),
    targetRect = target?.getBoundingClientRect(),
    reducedMotion = reducedCombatMotion(),
    rank = attackPowerRank(power),
    duration = reducedMotion ? 180 : power === "super" ? 520 : power === "strong" ? 430 : 350,
    lift = reducedMotion ? 10 : 24 + rank * 10,
    driftX = targetRect
      ? Math.max(-30, Math.min(30, (targetRect.left + targetRect.width / 2 - (rect.left + rect.width / 2)) * 0.055))
      : 0,
    clone = card.cloneNode(true),
    focus = document.createElement("span"),
    moteCount = reducedMotion ? 0 : power === "super" ? 8 : power === "strong" ? 6 : 4;
  clone.classList.remove("card-discarding");
  clone.classList.add("noncontact-cast-card", `noncontact-cast-card-${power}`);
  clone.removeAttribute("data-action");
  clone.removeAttribute("data-index");
  clone.setAttribute("aria-hidden", "true");
  Object.assign(clone.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  focus.className = `noncontact-cast-focus noncontact-cast-focus-${power}`;
  focus.setAttribute("aria-hidden", "true");
  focus.style.left = `${rect.left + rect.width / 2}px`;
  focus.style.top = `${rect.top + rect.height * 0.48 - lift * 0.42}px`;
  focus.style.setProperty("--cast-life", `${duration + 90}ms`);
  focus.innerHTML = '<span class="noncontact-cast-ring"></span><span class="noncontact-cast-core"></span>';
  for (let index = 0; index < moteCount; index++) {
    const mote = document.createElement("i"),
      angle = Math.round(index * (360 / moteCount) + (combatFxSequence % 5) * 7),
      distance = 30 + rank * 9 + (index % 3) * 8;
    mote.style.setProperty("--cast-angle", `${angle}deg`);
    mote.style.setProperty("--cast-distance", `${distance}px`);
    mote.style.setProperty("--cast-delay", `${(index % 4) * 22}ms`);
    focus.append(mote);
  }
  document.body.append(clone);
  effectsLayer().append(focus);
  card.classList.add("noncontact-cast-source");
  try {
    const motion = clone.animate(
      reducedMotion
        ? [
            { opacity: 1, transform: "translate3d(0,0,0) scale(1)" },
            { opacity: 0, transform: `translate3d(0,${-lift}px,0) scale(.94)` },
          ]
        : [
            { opacity: 1, transform: "translate3d(0,0,0) scale(1)", offset: 0 },
            { opacity: 1, transform: `translate3d(${driftX * .3}px,${-lift * .52}px,0) scale(${1 + rank * .014})`, offset: .36, easing: "cubic-bezier(.18,.76,.22,1)" },
            { opacity: 1, transform: `translate3d(${driftX * .72}px,${-lift}px,0) scale(${power === "super" ? 1.055 : 1.025})`, offset: .64, easing: "cubic-bezier(.16,.72,.2,1)" },
            { opacity: .7, transform: `translate3d(${driftX}px,${-lift - 5}px,0) scale(.97)`, offset: .78 },
            { opacity: 0, transform: `translate3d(${driftX * 1.08}px,${-lift - 16}px,0) scale(.82)` },
          ],
      { duration, easing: "linear", fill: "forwards" },
    );
    await motion.finished.catch(() => {});
  } catch {
    // Continue card resolution if the Web Animations API is unavailable.
  } finally {
    clone.remove();
    window.setTimeout(() => focus.remove(), 120);
  }
}
async function collapseUsedCard(card) {
  if (!card?.isConnected) return;
  const hand = card.closest(".hand"),
    remaining = hand
      ? [...hand.querySelectorAll(":scope > .card")].filter(
          (item) => item !== card,
        )
      : [],
    previousPositions = new Map(
      remaining.map((item) => [item, item.getBoundingClientRect()]),
    ),
    reducedMotion = browserRuntime.prefersReducedMotion();
  card.remove();
  if (reducedMotion || !remaining.length) return;
  const motions = remaining
    .map((item) => {
      const before = previousPositions.get(item),
        after = item.getBoundingClientRect(),
        offsetX = before.left - after.left,
        offsetY = before.top - after.top;
      if (Math.abs(offsetX) < 0.5 && Math.abs(offsetY) < 0.5) return null;
      return item.animate(
        [
          { transform: `translate3d(${offsetX}px, ${offsetY}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        { duration: 190, easing: "cubic-bezier(.22,.8,.3,1)" },
      );
    })
    .filter(Boolean);
  await Promise.allSettled(motions.map((motion) => motion.finished));
}
async function animateDiscardedCard(card) {
  if (!card?.isConnected) return;
  const reducedMotion = browserRuntime.prefersReducedMotion();
  card.style.pointerEvents = "none";
  if (!reducedMotion) {
    const motion = card.animate(
      [
        { opacity: 1, filter: "grayscale(0) brightness(1)", transform: "translate3d(0,0,0) rotate(0)" },
        { opacity: .88, filter: "grayscale(.4) brightness(.9)", transform: "translate3d(-2px,12px,0) rotate(-1deg)", offset: .3 },
        { opacity: .7, filter: "grayscale(.75) brightness(.78)", transform: "translate3d(3px,27px,0) rotate(1.2deg)", offset: .55 },
        { opacity: .42, filter: "grayscale(1) brightness(.68)", transform: "translate3d(-3px,46px,0) rotate(-1.4deg)", offset: .76 },
        { opacity: 0, filter: "grayscale(1) brightness(.58)", transform: "translate3d(1px,72px,0) rotate(.5deg) scale(.94)" },
      ],
      { duration: 540, easing: "cubic-bezier(.3,.1,.45,1)", fill: "forwards" },
    );
    await motion.finished.catch(() => {});
  }
  await collapseUsedCard(card);
}
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
async function animateWeakContactAttack(card, targetIndex, onImpact) {
  const target = enemyElement(targetIndex);
  if (!card || !target) return;
  if (!combatEffectsEnabled()) {
    onImpact?.();
    return;
  }
  const cardRect = card.getBoundingClientRect(),
    targetRect = target.getBoundingClientRect(),
    offsetX = targetRect.left + targetRect.width / 2 - (cardRect.left + cardRect.width / 2),
    offsetY = targetRect.top + targetRect.height / 2 - (cardRect.top + cardRect.height / 2),
    distance = Math.hypot(offsetX, offsetY) || 1,
    pullbackX = (-offsetX / distance) * 22,
    pullbackY = (-offsetY / distance) * 22,
    chargeRotation = Math.max(-5, Math.min(5, offsetX / 70)),
    clone = card.cloneNode(true),
    reducedMotion = browserRuntime.prefersReducedMotion();
  clone.classList.remove("card-discarding");
  clone.classList.add("contact-attack-card");
  clone.removeAttribute("data-action");
  clone.removeAttribute("data-index");
  clone.setAttribute("aria-hidden", "true");
  Object.assign(clone.style, {
    left: `${cardRect.left}px`,
    top: `${cardRect.top}px`,
    width: `${cardRect.width}px`,
    height: `${cardRect.height}px`,
  });
  document.body.append(clone);
  card.classList.add("contact-attack-source");
  try {
    const motion = clone.animate(
      reducedMotion
        ? [
            { transform: "translate3d(0, 0, 0) scale(1)" },
            { opacity: 0, transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(.04)` },
          ]
        : [
            { transform: "translate3d(0, 0, 0) scale(1)", offset: 0 },
            { transform: "translate3d(0, -6px, 0) scale(1.015)", offset: 0.18, easing: "ease-out" },
            { transform: `translate3d(${pullbackX}px, ${pullbackY - 6}px, 0) rotate(${-chargeRotation}deg) scale(.985)`, offset: 0.5, easing: "cubic-bezier(.32,0,.42,1)" },
            { opacity: 1, transform: `translate3d(${pullbackX * 1.08}px, ${pullbackY * 1.08 - 6}px, 0) rotate(${-chargeRotation * 1.1}deg) scale(1.015)`, offset: 0.59, easing: "cubic-bezier(.08,.78,.14,1)" },
            { opacity: 0, transform: `translate3d(${offsetX}px, ${offsetY}px, 0) rotate(${chargeRotation * .28}deg) scale(.08)`, offset: 1 },
          ],
      {
        duration: reducedMotion ? 105 : 390,
        easing: "linear",
        fill: "forwards",
      },
    );
    await motion.finished.catch(() => {});
    clone.style.opacity = "0";
    onImpact?.();
    await sleep(contactHitPause("weak", reducedMotion));
  } catch {
    // If the Web Animations API is unavailable, continue without blocking play.
  } finally {
    // Keep the consumed source hidden. The action handler removes this stale
    // hand element after all impact feedback has finished.
    clone.remove();
  }
}
async function animateStrongContactAttack(
  card,
  targetIndex,
  superStrong,
  onImpact,
  onLaunch = null,
) {
  const target = enemyElement(targetIndex);
  if (!card || !target) return;
  if (!combatEffectsEnabled()) {
    onLaunch?.();
    onImpact?.();
    return;
  }
  const cardRect = card.getBoundingClientRect(),
    targetRect = target.getBoundingClientRect(),
    offsetX = targetRect.left + targetRect.width / 2 - (cardRect.left + cardRect.width / 2),
    offsetY = targetRect.top + targetRect.height / 2 - (cardRect.top + cardRect.height / 2),
    distance = Math.hypot(offsetX, offsetY) || 1,
    pullbackX = (-offsetX / distance) * (superStrong ? 76 : 52),
    pullbackY = (-offsetY / distance) * (superStrong ? 76 : 52),
    chargeRotation = Math.max(-10, Math.min(10, offsetX / 42)),
    clone = card.cloneNode(true),
    reducedMotion = reducedCombatMotion(),
    pullbackScale = reducedMotion ? .24 : 1,
    stagedPullbackX = pullbackX * pullbackScale,
    stagedPullbackY = pullbackY * pullbackScale,
    chargeLift = reducedMotion ? (superStrong ? 4 : 3) : 10,
    chargeDuration = reducedMotion
      ? superStrong
        ? 380
        : 180
      : superStrong
        ? 680
        : 270,
    launchDuration = reducedMotion
      ? superStrong
        ? 240
        : 190
      : superStrong
        ? 360
        : 300,
    attackDuration = chargeDuration + launchDuration;
  clone.classList.remove("card-discarding");
  clone.classList.add("contact-attack-card", "strong-contact-attack-card");
  if (superStrong) clone.classList.add("super-contact-attack-card");
  clone.removeAttribute("data-action");
  clone.removeAttribute("data-index");
  clone.setAttribute("aria-hidden", "true");
  Object.assign(clone.style, {
    left: `${cardRect.left}px`,
    top: `${cardRect.top}px`,
    width: `${cardRect.width}px`,
    height: `${cardRect.height}px`,
  });
  document.body.append(clone);
  card.classList.add("contact-attack-source");
  const endFocus = beginStrongAttackFocus(
      cardRect,
      targetRect,
      reducedMotion,
      attackDuration,
      pullbackX,
      pullbackY,
      superStrong,
    ),
    endCharge = superStrong
      ? beginSuperAttackCharge(
          cardRect,
          reducedMotion,
          pullbackX,
          pullbackY,
          attackDuration,
        )
      : () => {};
  try {
    const chargeMotion = clone.animate(
      reducedMotion
        ? [
            {
              opacity: 1,
              transform: "translate3d(0, 0, 0) scale(1)",
              offset: 0,
            },
            {
              opacity: 1,
              transform: `translate3d(${stagedPullbackX * .38}px, ${stagedPullbackY * .38 - 2}px, 0) rotate(${-chargeRotation * .08}deg) scale(${superStrong ? 1.025 : 1.01})`,
              offset: .38,
            },
            {
              opacity: 1,
              transform: `translate3d(${stagedPullbackX}px, ${stagedPullbackY - chargeLift}px, 0) rotate(${-chargeRotation * .18}deg) scale(${superStrong ? 1.045 : 1.018})`,
              offset: .78,
            },
            {
              opacity: 1,
              transform: `translate3d(${stagedPullbackX}px, ${stagedPullbackY - chargeLift}px, 0) rotate(${-chargeRotation * .18}deg) scale(${superStrong ? 1.045 : 1.018})`,
              offset: 1,
            },
          ]
        : superStrong
          ? [
              { transform: "translate3d(0, 0, 0) scale(1)", offset: 0 },
              { transform: "translate3d(0, -8px, 0) scale(1.035)", offset: .16, easing: "ease-out" },
              { transform: `translate3d(${stagedPullbackX}px, ${stagedPullbackY - chargeLift}px, 0) rotate(${-chargeRotation}deg) scale(.94)`, offset: .6, easing: "cubic-bezier(.3,0,.44,1)" },
              { transform: `translate3d(${stagedPullbackX - 3}px, ${stagedPullbackY - chargeLift - 1}px, 0) rotate(${-chargeRotation - 1.2}deg) scale(.925)`, offset: .72 },
              { transform: `translate3d(${stagedPullbackX + 3}px, ${stagedPullbackY - chargeLift + 1}px, 0) rotate(${-chargeRotation + 1.2}deg) scale(.945)`, offset: .82 },
              { transform: `translate3d(${stagedPullbackX}px, ${stagedPullbackY - chargeLift}px, 0) rotate(${-chargeRotation}deg) scale(1.07)`, offset: 1, easing: "cubic-bezier(.08,.78,.14,1)" },
            ]
          : [
              { transform: "translate3d(0, 0, 0) scale(1)", offset: 0 },
              { transform: "translate3d(0, -5px, 0) scale(1.02)", offset: .22, easing: "ease-out" },
              { transform: `translate3d(${stagedPullbackX}px, ${stagedPullbackY - chargeLift}px, 0) rotate(${-chargeRotation * .7}deg) scale(.965)`, offset: .72, easing: "cubic-bezier(.3,0,.44,1)" },
              { transform: `translate3d(${stagedPullbackX}px, ${stagedPullbackY - chargeLift}px, 0) rotate(${-chargeRotation * .7}deg) scale(1.035)`, offset: 1, easing: "cubic-bezier(.08,.78,.14,1)" },
            ],
      { duration: chargeDuration, easing: "linear", fill: "forwards" },
    );
    await chargeMotion.finished.catch(() => {});
    if (superStrong && onLaunch) onLaunch();
    const launchStart = `translate3d(${stagedPullbackX}px, ${stagedPullbackY - chargeLift}px, 0) rotate(${-chargeRotation * (reducedMotion ? .18 : superStrong ? 1 : .7)}deg) scale(${superStrong ? reducedMotion ? 1.045 : 1.07 : reducedMotion ? 1.018 : 1.035})`,
      launchMotion = clone.animate(
        [
          { opacity: 1, transform: launchStart, offset: 0 },
          {
            opacity: 1,
            transform: `translate3d(${stagedPullbackX * .35}px, ${stagedPullbackY * .35 - chargeLift * .35}px, 0) rotate(${chargeRotation * .08}deg) scale(${superStrong ? 1.12 : 1.07})`,
            offset: .16,
            easing: "cubic-bezier(.06,.72,.12,1)",
          },
          {
            opacity: .95,
            transform: `translate3d(${offsetX * .78}px, ${offsetY * .78}px, 0) rotate(${chargeRotation * .18}deg) scale(.34)`,
            offset: .78,
          },
          {
            opacity: 0,
            transform: `translate3d(${offsetX}px, ${offsetY}px, 0) rotate(${chargeRotation * .28}deg) scale(.04)`,
            offset: 1,
          },
        ],
        {
          duration: launchDuration,
          easing: "cubic-bezier(.08,.72,.12,1)",
          fill: "forwards",
        },
      );
    await launchMotion.finished.catch(() => {});
    clone.style.opacity = "0";
    onImpact?.();
    await sleep(
      contactHitPause(superStrong ? "super" : "strong", reducedMotion),
    );
  } catch {
    // If the Web Animations API is unavailable, continue without blocking play.
  } finally {
    endCharge();
    endFocus();
    // Keep the consumed source hidden until the action handler removes it.
    clone.remove();
  }
}
function showPlayerContactImpact(strong = false, point = null) {
  if (!combatEffectsEnabled()) return;
  const battle = document.querySelector(".battle");
  if (!battle) return;
  point ||= getPlayerImpactPoint();
  if (!point) return;
  const impact = document.createElement("span");
  impact.className = `${strong ? "strong" : "weak"}-contact-impact player-contact-impact`;
  impact.setAttribute("aria-hidden", "true");
  impact.innerHTML = strong
    ? `${"<span></span>".repeat(3)}${"<i></i>".repeat(12)}`
    : `${"<span></span>".repeat(2)}${"<i></i>".repeat(8)}`;
  impact.style.left = `${point.x}px`;
  impact.style.top = `${point.y}px`;
  effectsLayer().append(impact);
  impact.addEventListener(
    "animationend",
    (event) => {
      if (event.target === impact) impact.remove();
    },
    { once: true },
  );
  if (strong && battle) {
    for (const animation of battle.getAnimations()) {
      if (animation.animationName === "strong-contact-screen-shake")
        animation.cancel();
    }
    battle.classList.remove("strong-contact-shake");
    battle.classList.add("strong-contact-shake");
    setTimeout(() => battle.classList.remove("strong-contact-shake"), 460);
  }
}
function showPlayerImpactShieldBlock(amount, point, fullyBlocked = false) {
  if (!point || amount <= 0) return;
  const effect = document.createElement("span");
  effect.className = `player-impact-shield${fullyBlocked ? " fully-blocked" : ""}`;
  effect.setAttribute("aria-hidden", "true");
  effect.style.left = `${point.x}px`;
  effect.style.top = `${point.y}px`;
  effect.innerHTML = `<i>🛡</i><strong>-${number(amount)} 경감</strong>`;
  effectsLayer().append(effect);
  effect.addEventListener("animationend", (event) => {
    if (event.target === effect) effect.remove();
  });
}
function updatePlayerHealthFeedback(hp, maxHp, shield) {
  const health = getPlayerHealthAnchor(),
    healthValue = health?.querySelector("b"),
    healthBar = health?.querySelector(".player-health-bar"),
    shieldValue = document.querySelector(
      ".combat-stats .combat-term:nth-child(2) b",
    );
  if (healthValue) healthValue.textContent = `${Math.max(0, hp)} / ${maxHp}`;
  if (healthBar) {
    const percent = Math.max(0, Math.min(100, (Math.max(0, hp) / Math.max(1, maxHp)) * 100));
    healthBar.setAttribute("aria-valuenow", String(Math.max(0, hp)));
    const fill = healthBar.firstElementChild;
    if (fill) fill.style.width = `${percent}%`;
  }
  if (shieldValue) shieldValue.textContent = Math.max(0, shield);
}
async function animateEnemyContactAttack(enemy, strong, superStrong, onImpact) {
  const battle = document.querySelector(".battle");
  if (!enemy || !battle) return;
  if (!combatEffectsEnabled()) {
    onImpact?.(getPlayerImpactPoint());
    return;
  }
  const enemyVisual = enemy.querySelector(".enemy-visual") || enemy,
    enemyRect = enemyVisual.getBoundingClientRect(),
    impactPoint = getPlayerImpactPoint();
  if (!impactPoint) return;
  const targetRect = { left: impactPoint.x, top: impactPoint.y, width: 0, height: 0 },
    offsetX = impactPoint.x - (enemyRect.left + enemyRect.width / 2),
    offsetY = impactPoint.y - (enemyRect.top + enemyRect.height / 2),
    distance = Math.hypot(offsetX, offsetY) || 1,
    pullback = strong ? 52 : 30,
    pullbackX = (-offsetX / distance) * pullback,
    pullbackY = (-offsetY / distance) * pullback,
    clone = enemyVisual.cloneNode(true),
    reducedMotion = superStrong ? false : browserRuntime.prefersReducedMotion(),
    duration = superStrong ? 1480 : strong ? 760 : 720;
  clone.classList.remove("acting-enemy", "enemy-attack-lunge");
  clone.classList.add("enemy-contact-attacker", strong ? "enemy-contact-attacker-strong" : "enemy-contact-attacker-weak");
  clone.removeAttribute("data-action");
  clone.removeAttribute("tabindex");
  clone.setAttribute("aria-hidden", "true");
  Object.assign(clone.style, {
    left: `${enemyRect.left}px`,
    top: `${enemyRect.top}px`,
    width: `${enemyRect.width}px`,
    height: `${enemyRect.height}px`,
  });
  document.body.append(clone);
  enemyVisual.classList.add("enemy-contact-source");
  const endFocus = strong
    ? beginStrongAttackFocus(
        enemyRect,
        targetRect,
        reducedMotion,
        duration,
        pullbackX,
        pullbackY,
      )
    : () => {};
  const endCharge = superStrong
    ? beginSuperAttackCharge(
        enemyRect,
        reducedMotion,
        pullbackX,
        pullbackY,
        duration,
      )
    : () => {};
  try {
    const attackArt = clone.querySelector(".enemy-image, .enemy-symbol"),
      vanish = attackArt?.animate(
        [
          { opacity: 1, transform: "scale(1)", offset: 0 },
          { opacity: 1, transform: "scale(1)", offset: strong ? .74 : .82 },
          { opacity: 0, transform: "scale(.04)", offset: 1 },
        ],
        { duration: reducedMotion ? 120 : duration, easing: "linear", fill: "forwards" },
      );
    const motion = clone.animate(
      reducedMotion
        ? [
            { transform: "translate3d(0,0,0) scale(1)" },
            { transform: `translate3d(${offsetX}px,${offsetY}px,0) scale(.8)` },
          ]
        : [
            { transform: "translate3d(0,0,0) scale(1)", offset: 0 },
            { transform: "translate3d(0,-10px,0) scale(1.03)", offset: .22 },
            { transform: `translate3d(${pullbackX}px,${pullbackY - 10}px,0) scale(${strong ? .93 : .97})`, offset: strong ? .62 : .67 },
            { transform: `translate3d(${pullbackX * 1.06}px,${pullbackY * 1.06 - 10}px,0) scale(${strong ? 1.08 : .94})`, offset: strong ? .72 : .75, easing: "cubic-bezier(.08,.8,.16,1)" },
            { transform: `translate3d(${offsetX}px,${offsetY}px,0) scale(${strong ? .65 : .8})`, offset: 1 },
          ],
      { duration: reducedMotion ? 120 : duration, easing: "linear", fill: "forwards" },
    );
    await motion.finished.catch(() => {});
    await vanish?.finished.catch(() => {});
    clone.style.opacity = "0";
    onImpact?.(impactPoint);
  } catch {
    // Continue the enemy turn if browser animation support is unavailable.
  } finally {
    endCharge();
    endFocus();
    enemyVisual.classList.remove("enemy-contact-source");
    clone.remove();
  }
}
async function showEnemyHitQueue(
  hits,
  waitForFinalHit = false,
  onHit = null,
) {
  const visibleHits = hits.filter((hit) =>
    Boolean(hit.blocked || (hit.damage && !hit.statusId)),
  );
  for (let index = 0; index < visibleHits.length; index++) {
    const hit = visibleHits[index];
    if (hit.blocked)
      showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage);
    if (
      !hit.statusId &&
      (hit.damage || (hit.blocked && hit.attackPattern === "nonContact"))
    )
      showHitFeedback(
        hit.damage,
        hit.targetIndex,
        hit.attackPattern,
        false,
        false,
        Boolean(hit.blocked),
        hit.fx,
      );
    onHit?.(hit);
    if (visibleHits.length > 1 && index < visibleHits.length - 1)
      await sleep(150);
  }
  if (waitForFinalHit && visibleHits.length) await sleep(280);
}
function showEnemyActionPopup(index, text, className) {
  const enemy = document.querySelector(`.enemy[data-target="${index}"]`);
  if (!enemy) return;
  const popup = document.createElement("strong");
  popup.className = `enemy-action-popup ${className}`;
  popup.textContent = text;
  popup.setAttribute("role", "status");
  enemy.append(popup);
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
}
function showControlFeedback(feedback) {
  if (!feedback?.title) return;
  const popup = document.createElement("span");
  popup.className = `player-control-feedback player-control-feedback-${feedback.statusId || "generic"}`;
  popup.setAttribute("role", "status");
  popup.innerHTML = `<strong>${feedback.title}</strong>${feedback.detail ? `<small>${feedback.detail}</small>` : ""}`;
  effectsLayer().append(popup);
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
}
const startingDeckCategories = [
  { id: "attack", name: "공격", icon: "⚔", description: "피해와 상태 이상으로 적을 제압하세요." },
  { id: "defense", name: "방어", icon: "◇", description: "방어막과 반격으로 적의 공격을 버티세요." },
  { id: "absorb", name: "흡수", icon: "◉", description: "흡수를 모아 조향의 힘을 준비하세요." },
  { id: "heal", name: "회복", icon: "✚", description: "체력을 회복하고 위기에서 전열을 가다듬으세요." },
];
function startingCardCategory(card) {
  if (["attack", "defense", "absorb", "heal"].includes(card.category)) return card.category;
  return card.attack || card.burst || card.weight ? "attack"
    : card.heal || card.missingHpHealRatio ? "heal"
      : card.shield ? "defense" : "absorb";
}
const { openStartingDeckBuilder } = createStartingDeckBuilderUi({
  cards: CARDS,
  items: ITEMS,
  testItems: TEST_ITEMS,
  statusDefinitions: STATUS_DEFINITIONS,
  recommendedStartingDeck: RECOMMENDED_STARTING_DECK,
  getTier1Cards,
  localCardTest: LOCAL_CARD_TEST,
  cardHtml: startingDeckCardHtml,
  itemHtml,
  startingCardCategory,
  startingDeckCategories,
  onStartRun: ({ deckIds, itemIds, testMode, dialog }) => {
    if (run && !run.finished) E.abandon(run, meta);
    if (!testMode) {
      meta.lastStartingDeck = [...deckIds];
      meta.discoveredCards ??= [];
      for (const cardId of deckIds)
        if (!meta.discoveredCards.includes(cardId)) meta.discoveredCards.push(cardId);
    }
    run = E.newRun(browserRuntime.randomUint32(), deckIds, meta);
    run.runId = browserRuntime.randomUUID();
    run.testMode = testMode;
    if (testMode)
      for (const itemId of itemIds) E.addInventoryItem(run, itemId);
    started = true;
    dialog.close();
    save();
    render();
  },
});
const { bindDeckReplacement } = createDeckReplacementUi({
  engine: E,
  cards: CARDS,
  getRun: () => run,
  getMeta: () => meta,
  cardHtml,
  cardCategory: startingCardCategory,
  cardCategories: startingDeckCategories,
  save,
  render,
});
bindDeckReplacement($("app"));
let cardAnimating = false;
const { bindSpecialDeckPicker } = createSpecialDeckPickerUi({
  engine: E,
  cards: CARDS,
  getRun: () => run,
  getMeta: () => meta,
  getCardAnimating: () => cardAnimating,
  presentationCardHtml,
  save,
  render,
});
bindSpecialDeckPicker($("app"));
const { handleEndTurn } = createCombatTurnOrchestrator({
  engine: E,
  enemyDefinitionFor: (id) => ENEMIES[id],
  getRun: () => run,
  getMeta: () => meta,
  getCardAnimating: () => cardAnimating,
  setCardAnimating: (value) => {
    cardAnimating = value;
  },
  save,
  render,
  sleep,
  feedback: {
    showAbsorbLoss,
    showAbsorbGain,
    showShieldGain,
    showPlayerHealing,
    getEnemyElement: (index) =>
      document.querySelector(`.enemy[data-target="${index}"]`),
    getPlayerImpactPoint,
    updatePlayerHealthFeedback,
    showPlayerContactImpact,
    showShieldBlock,
    showPlayerImpactShieldBlock,
    showPlayerDamage,
    animateEnemyContactAttack,
    combatEffectsEnabled,
    showEnemyActionPopup,
    showEnemyDebuffSmoke,
    showEnemyHealing,
    showEnemyShieldBlock,
    showHitFeedback,
    showStatusDamageQueue,
    showStatusProcQueue,
    showStatusProcVfx,
    showImpurityOverflowQueue,
    showPlayerDeath,
    showMonsterDeath,
    showEnemyHitQueue,
    stageDrawFeedback,
    showShuffleFeedback,
    showDrawFeedback,
    playPlayerStatusHit: () => SFX.playerStatusHit(),
    showEnrageDamage,
  },
});
const { handleCardPlay } = createCombatCardOrchestrator({
  engine: E,
  cards: CARDS,
  enemyDefinitionFor: (id) => ENEMIES[id],
  getRun: () => run,
  getMeta: () => meta,
  setCardAnimating: (value) => {
    cardAnimating = value;
    if (value) beginEnemyHpVisualGuard();
    else endEnemyHpVisualGuard();
  },
  save,
  render,
  sleep,
  startingCardCategory,
  sound: SFX,
  feedback: {
    showApSpend,
    animateDiscardedCard,
    animateWeakContactAttack,
    animateStrongContactAttack,
    showStrongContactImpact,
    showWeakContactImpact,
    resolveMultiHitImpactPoint,
    showEnemyShieldBlock,
    updateEnemyHealthFeedback,
    showHitFeedback,
    animateNonContactCast,
    strongestAttackPower,
    showEnemyHitQueue,
    collapseUsedCard,
    showImpurityOverflowQueue,
    showHarmonyFeedback,
    showStatusDamageQueue,
    showStatusProcQueue,
    showStatusProcVfx,
    showControlFeedback,
    showPlayerDeath,
    waitForLethalHitEffects,
    showMonsterDeath,
    stageDrawFeedback,
    showShuffleFeedback,
    showDrawFeedback,
    showPlayerDamage,
    showPlayerHealing,
    showAbsorbGain,
    showShieldGain,
    playPlayerStatusHit: () => SFX.playerStatusHit(),
  },
});

const { handleGameAction } = createGameActionOrchestrator({
  engine: E,
  enemyDefinitionFor: (id) => ENEMIES[id],
  getRun: () => run,
  getMeta: () => meta,
  setStarted: (value) => {
    started = value;
  },
  setCardAnimating: (value) => {
    cardAnimating = value;
  },
  save,
  render,
  sleep,
  reducedCombatMotion,
  hideRestUpgradeComparison,
  confirmReplaceRun: () => confirm("진행 중인 여정을 종료하고 새로 시작할까요?"),
  openStartingDeckBuilder,
  sound: SFX,
  roomRelicPresentation,
  feedback: {
    animateDiscardedCard,
    showImpurityOverflowQueue,
    showHarmonyFeedback,
    showEnemyHitQueue,
    showStatusDamageQueue,
    showStatusProcQueue,
    showStatusProcVfx,
    showPlayerDeath,
    waitForLethalHitEffects,
    showMonsterDeath,
    stageDrawFeedback,
    showShuffleFeedback,
    showDrawFeedback,
    showPlayerDamage,
    showPlayerHealing,
    showAbsorbLoss,
    showAbsorbGain,
    showShieldGain,
  },
});

bindRestUpgradeComparison($("app"));
$("app").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || cardAnimating) return;
  if (button.closest(".hand") && button.getAttribute("aria-disabled") === "true") {
    const reason = button.querySelector(".card-unavailable-reason")?.textContent?.trim();
    if (reason) showNotice(reason, { transient: true });
    return;
  }
  if (run?.battle?.pendingDiscard && button.dataset.action === "end") {
    showNotice("먼저 손패에서 버릴 카드 1장을 선택하세요.", { transient: true });
    return;
  }

  const action = button.dataset.action,
    index = Number(button.dataset.index);
  if (action === "end") {
    await handleEndTurn();
    return;
  }
  if (action === "play") {
    await handleCardPlay(button, index);
    return;
  }
  await handleGameAction(button);
});
$("app").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-harmony-share]");
  if (!button || !run?.finished) return;
  const status = document.querySelector(".share-status"),
    actions = {
      kakao: shareHarmonyKakao,
      image: shareHarmonyImage,
      link: shareHarmonyLink,
    };
  button.disabled = true;
  if (status) status.textContent = "공유 기록을 준비하고 있어요.";
  try {
    const message = await actions[button.dataset.harmonyShare](shareRecord());
    if (status) status.textContent = message;
  } catch (error) {
    if (status)
      status.textContent =
        error.name === "AbortError"
          ? "공유를 취소했어요."
          : "공유하지 못했어요. 잠시 후 다시 시도해 주세요.";
  } finally {
    button.disabled = false;
  }
});
let toolsReturnFocus = null,
  battleLogReturnFocus = null;
function prepareOverlay(trigger) {
  document.querySelectorAll(".battle-card-effect-tooltip-portal").forEach((portal) => portal.remove());
  document.querySelectorAll("[data-term].tip-open").forEach((item) => {
    item.classList.remove("tip-open");
    item.setAttribute("aria-expanded", "false");
  });
  return trigger || document.activeElement;
}
window.addEventListener("harmony:overlay-opening", (event) => prepareOverlay(event.detail?.trigger));
$("tools-toggle").onclick = () => {
  toolsReturnFocus = prepareOverlay($("tools-toggle"));
  renderCodex();
  $("tools").showModal();
};
$("tools-close").onclick = () => $("tools").close();
$("tools").addEventListener("close", () => toolsReturnFocus?.focus?.());
$("battle-log-close").onclick = () => $("battle-log").close();
$("battle-log").addEventListener("close", () => battleLogReturnFocus?.focus?.());
const { bindRunSummary } = createRunSummaryUi({
  getRun: () => run,
  cards: CARDS,
  cardHtml,
  itemHtml,
  countItemIds,
  startingCardCategory,
});
bindRunSummary();
document.addEventListener(
  "wheel",
  (event) => {
    const scroller = event.target.closest(
      ".hand,.card-reward-choices,.summary-card-grid,.builder-selected,.deck-replace-grid,.special-deck-picker-grid",
    );
    if (
      !scroller ||
      (scroller.classList.contains("summary-card-grid") &&
        !matchMedia("(max-width: 900px)").matches) ||
      scroller.scrollWidth <= scroller.clientWidth
    )
      return;
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
      ? event.deltaY
      : event.deltaX;
    scroller.scrollLeft += delta;
    event.preventDefault();
  },
  { passive: false },
);
const HORIZONTAL_DRAG_SELECTOR = [
  ".hand",
  ".battle-info",
  ".turn-order",
  ".enemies-field",
  ".discard-preview-cards",
  ".atelier-products",
  ".card-reward-choices",
  ".rest-card-choices",
  ".summary-card-grid",
  ".builder-selected",
  ".deck-replace-filters",
  ".deck-replace-grid",
  ".special-deck-picker-grid",
  ".stat-grid",
].join(",");
let horizontalMouseDrag = null,
  suppressHorizontalDragClick = null;
document.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "mouse" || event.button !== 0) return;
  // A fresh press is always a new click/drag gesture. It must not inherit the
  // synthetic-click guard left by the preceding drag.
  suppressHorizontalDragClick = null;
  const scroller = event.target.closest(HORIZONTAL_DRAG_SELECTOR);
  if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
  horizontalMouseDrag = {
    scroller,
    pointerId: event.pointerId,
    startX: event.clientX,
    startScrollLeft: scroller.scrollLeft,
    moved: false,
  };
  scroller.classList.add("mouse-drag-scroll");
});
document.addEventListener("pointermove", (event) => {
  const drag = horizontalMouseDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const distance = event.clientX - drag.startX;
  if (!drag.moved && Math.abs(distance) < 4) return;
  if (!drag.moved) {
    drag.moved = true;
    drag.scroller.setPointerCapture(event.pointerId);
  }
  drag.scroller.classList.add("is-mouse-dragging");
  drag.scroller.scrollLeft = drag.startScrollLeft - distance;
  event.preventDefault();
});
function finishHorizontalMouseDrag(event, cancelled = false) {
  const drag = horizontalMouseDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (drag.scroller.hasPointerCapture(event.pointerId))
    drag.scroller.releasePointerCapture(event.pointerId);
  drag.scroller.classList.remove("mouse-drag-scroll", "is-mouse-dragging");
  suppressHorizontalDragClick = !cancelled && drag.moved ? drag.scroller : null;
  if (suppressHorizontalDragClick) {
    const pendingScroller = suppressHorizontalDragClick;
    window.setTimeout(() => {
      if (suppressHorizontalDragClick === pendingScroller)
        suppressHorizontalDragClick = null;
    }, 500);
  }
  horizontalMouseDrag = null;
}
document.addEventListener("pointerup", (event) => finishHorizontalMouseDrag(event));
document.addEventListener("pointercancel", (event) => finishHorizontalMouseDrag(event, true));
document.addEventListener("dragstart", (event) => {
  if (event.target.closest(HORIZONTAL_DRAG_SELECTOR)) event.preventDefault();
});
document.addEventListener("click", (event) => {
  if (!suppressHorizontalDragClick) return;
  const shouldSuppress = suppressHorizontalDragClick.contains(event.target);
  suppressHorizontalDragClick = null;
  if (!shouldSuppress) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
document.addEventListener("click", (event) => {
  const open = event.target.closest("[data-log-open]");
  if (open) {
    const list = $("battle-log-list");
    list.replaceChildren();
    const columns = document.createElement("div");
    columns.className = "log-column-head";
    for (const label of ["라운드", "주체 · 대상", "상세"]) {
      const heading = document.createElement("b");
      heading.textContent = label;
      columns.append(heading);
    }
    list.append(columns);
    if (!run?.log.length) {
      const empty = document.createElement("p");
      empty.className = "log-empty";
      empty.textContent = "아직 기록된 전투 행동이 없습니다.";
      list.append(empty);
    } else
      run.log.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "log-row";
        const normalizedEntry = String(entry)
            .replace(/^나(?=\s|\s*·)/, "플레이어")
            .replace(/(^|·\s*)나(?=\s)/g, "$1플레이어"),
          parts = normalizedEntry.split(" · "),
          hasRound = /^\d+라운드$/.test(parts[0]),
          round = document.createElement("small"),
          name = document.createElement("strong"),
          detail = document.createElement("div");
        detail.className = "log-detail";
        if (normalizedEntry.includes("[카드 사용]")) row.classList.add("log-card-use");
        else if (normalizedEntry.includes("[적 행동]")) row.classList.add("log-enemy-action");
        else if (normalizedEntry.includes("[피해]")) row.classList.add("log-damage");
        else if (normalizedEntry.includes("HARMONY") || normalizedEntry.includes("하모니"))
          row.classList.add("log-harmony");
        round.textContent = hasRound ? parts.shift() : "이전 기록";
        let detailParts;
        if (parts.length > 1) {
          name.textContent = parts.shift();
          detailParts = parts;
        } else {
          const legacyText = parts[0] || "기록 없음",
            legacyActor = legacyText.startsWith("플레이어 ")
              ? "플레이어"
              : run?.battle?.enemies
                  ?.map((enemy) => enemy.name)
                  .sort((a, b) => b.length - a.length)
                  .find((enemyName) => legacyText.startsWith(`${enemyName} `));
          name.textContent = legacyActor || "전투 효과";
          detailParts = [
            legacyActor ? legacyText.slice(legacyActor.length).trim() : legacyText,
          ];
        }
        const headline = document.createElement("b");
        headline.textContent = detailParts.shift() || "기록";
        detail.append(headline);
        for (const item of detailParts) {
          const metric = document.createElement("span");
          metric.textContent = item;
          detail.append(metric);
        }
        row.append(round, name, detail);
        list.append(row);
      });
    battleLogReturnFocus = prepareOverlay(open);
    $("battle-log").showModal();
    const rows = [...list.querySelectorAll(".log-row")];
    if (rows.length > 10) {
      const listStyle = getComputedStyle(list),
        padding = parseFloat(listStyle.paddingTop) + parseFloat(listStyle.paddingBottom),
        tenRowsHeight = rows.slice(0, 10).reduce((height, row) => height + row.offsetHeight, padding + columns.offsetHeight);
      list.style.maxHeight = `min(${Math.ceil(tenRowsHeight)}px, 70dvh)`;
    } else list.style.removeProperty("max-height");
    return;
  }
  const term = event.target.closest("[data-term]");
  document.querySelectorAll("[data-term].tip-open").forEach((item) => {
    if (item !== term) {
      item.classList.remove("tip-open");
      item.setAttribute("aria-expanded", "false");
    }
  });
  if (term) {
    const opened = term.classList.toggle("tip-open");
    term.setAttribute("aria-expanded", String(opened));
  }
});
const mobilePreviewButton = $("mobile-preview");
mobilePreviewButton.hidden = !LOCAL_CARD_TEST;
if (LOCAL_CARD_TEST) mobilePreviewButton.onclick = () => {
  const preview = window.open(
    location.href,
    "harmony-mobile-preview",
    "popup,width=430,height=860,resizable=yes,scrollbars=yes",
  );
  if (!preview)
    showNotice(
      "팝업이 차단됐습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러주세요.",
    );
};
const { handleCodexClick, handleCodexInput, renderCodex } = createCodexUi({
  meta,
  cardEffectText: baseCardEffectText,
  glossaryTermsHtml,
  itemHtml,
  statusAmountText,
  statusGlossaryHtml,
});
$("tools").addEventListener("click", handleCodexClick);
$("codex-search").addEventListener("input", handleCodexInput);
createPatchNotesUi();
document.addEventListener("pointerdown", SFX.unlock, { capture: true });
document.addEventListener("keydown", SFX.unlock, { capture: true });

$("app").addEventListener("pointerover", (event) => {
  const trigger = event.target.closest(".discard-pile-trigger");
  if (!trigger || trigger.contains(event.relatedTarget)) return;
  openDiscardPreview(trigger);
});
$("app").addEventListener("pointerout", (event) => {
  const trigger = event.target.closest(".discard-pile-trigger");
  if (!trigger || trigger.contains(event.relatedTarget)) return;
  scheduleDiscardPreviewClose();
});
$("app").addEventListener("focusin", (event) => {
  const trigger = event.target.closest(".discard-pile-trigger");
  if (trigger) openDiscardPreview(trigger);
});
$("app").addEventListener("focusout", (event) => {
  if (event.target.closest(".discard-pile-trigger")) scheduleDiscardPreviewClose();
});

$("app").addEventListener(
  "wheel",
  (event) => {
    const field = event.target.closest(
      ".enemies-field, .discard-preview-cards, .atelier-products",
    );
    if (
      !field ||
      field.scrollWidth <= field.clientWidth ||
      Math.abs(event.deltaX) >= Math.abs(event.deltaY)
    )
      return;
    const delta = event.deltaY,
      canScroll =
        delta > 0
          ? field.scrollLeft + field.clientWidth < field.scrollWidth - 1
          : field.scrollLeft > 0;
    if (!canScroll) return;
    event.preventDefault();
    field.scrollLeft += delta;
  },
  { passive: false },
);

renderCodex();
if (loadedSave.migrated || loadedSave.recovered) save();
render();
let battleFrameSyncPending = false;
function scheduleBattleFrameSync() {
  if (battleFrameSyncPending) return;
  battleFrameSyncPending = true;
  requestAnimationFrame(() => {
    battleFrameSyncPending = false;
    syncBattleStateFrame();
  });
}
window.addEventListener("resize", scheduleBattleFrameSync, { passive: true });
window.addEventListener(
  "resize",
  () => scheduleOverflowMarqueeRefresh($("app")),
  { passive: true },
);
window.addEventListener("scroll", scheduleBattleFrameSync, { passive: true });
if (loadedSave.recovered)
  showNotice("이전 저장본에 문제가 있어 안전한 백업 시점으로 복구했습니다.");
window.addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") save();
});

// Battle hand detail panel positioning · 20260912
var battleHandDetailState = null;

function hideBattleHandDetailPanel() {
  if (!battleHandDetailState) return;
  const { tooltip, placeholder } = battleHandDetailState;
  tooltip.classList.remove("battle-card-effect-tooltip-portal");
  tooltip.style.removeProperty("--battle-detail-left");
  tooltip.style.removeProperty("--battle-detail-top");
  tooltip.style.removeProperty("--battle-detail-width");
  tooltip.style.removeProperty("--battle-detail-max-height");
  if (placeholder?.isConnected) placeholder.replaceWith(tooltip);
  else tooltip.remove();
  battleHandDetailState = null;
}

function mountBattleHandDetailPanel(card) {
  if (battleHandDetailState?.card === card && battleHandDetailState.tooltip.isConnected)
    return battleHandDetailState.tooltip;
  hideBattleHandDetailPanel();
  const tooltip = card.querySelector(".card-effect-tooltip");
  if (!tooltip) return null;
  const placeholder = document.createComment("card-effect-tooltip");
  tooltip.before(placeholder);
  tooltip.classList.add("battle-card-effect-tooltip-portal");
  document.body.append(tooltip);
  battleHandDetailState = { card, tooltip, placeholder };
  return tooltip;
}

function positionBattleHandDetailPanel(card) {
  const battle = card.closest(".battle"),
    hand = card.closest(".hand"),
    tooltip = mountBattleHandDetailPanel(card);
  if (!battle || !hand || !tooltip) return;

  const battleRect = battle.getBoundingClientRect(),
    handRect = hand.getBoundingClientRect(),
    cardRect = card.getBoundingClientRect(),
    viewportPadding = 10,
    panelWidth = Math.max(
      180,
      Math.min(430, battleRect.width - 20, window.innerWidth - viewportPadding * 2),
    ),
    panelLeft = Math.min(
      window.innerWidth - viewportPadding - panelWidth,
      Math.max(
        viewportPadding,
        cardRect.left + cardRect.width / 2 - panelWidth / 2,
      ),
    ),
    spaceAbove = Math.max(0, handRect.top - viewportPadding),
    spaceBelow = Math.max(0, window.innerHeight - handRect.bottom - viewportPadding),
    panelMaxHeight = Math.min(210, Math.max(96, Math.max(spaceAbove, spaceBelow) - 10));

  tooltip.style.setProperty("--battle-detail-left", `${Math.round(panelLeft)}px`);
  tooltip.style.setProperty("--battle-detail-width", `${Math.round(panelWidth)}px`);
  tooltip.style.setProperty("--battle-detail-max-height", `${Math.round(panelMaxHeight)}px`);

  requestAnimationFrame(() => {
    if (!battleHandDetailState || battleHandDetailState.card !== card || !card.isConnected)
      return;
    const panelHeight = Math.min(tooltip.scrollHeight, panelMaxHeight),
      canFitAbove = spaceAbove >= panelHeight + 10,
      desiredTop = canFitAbove
        ? handRect.top - panelHeight - 10
        : handRect.bottom + 10,
      panelTop = Math.max(
        viewportPadding,
        Math.min(desiredTop, window.innerHeight - panelHeight - viewportPadding),
      );
    tooltip.style.setProperty("--battle-detail-top", `${Math.round(panelTop)}px`);
  });
}

function refreshBattleHandDetailPanel() {
  const card = battleHandDetailState?.card;
  if (!card?.isConnected) {
    hideBattleHandDetailPanel();
    return;
  }
  if (card.matches(":hover") || card.matches(":focus, :focus-within"))
    positionBattleHandDetailPanel(card);
  else hideBattleHandDetailPanel();
}

document.addEventListener("pointerover", (event) => {
  if (!(event.target instanceof Element)) return;
  const card = event.target.closest(".battle > .hand .card");
  if (!card || (event.relatedTarget instanceof Node && card.contains(event.relatedTarget))) return;
  positionBattleHandDetailPanel(card);
});
document.addEventListener("pointerout", (event) => {
  if (!(event.target instanceof Element)) return;
  const card = event.target.closest(".battle > .hand .card");
  if (!card || (event.relatedTarget instanceof Node && card.contains(event.relatedTarget))) return;
  requestAnimationFrame(() => {
    if (
      battleHandDetailState?.card === card &&
      !card.matches(":hover, :focus, :focus-within")
    )
      hideBattleHandDetailPanel();
  });
});
document.addEventListener("focusin", (event) => {
  if (!(event.target instanceof Element)) return;
  const card = event.target.closest(".battle > .hand .card");
  if (card) positionBattleHandDetailPanel(card);
});
document.addEventListener("focusout", (event) => {
  if (!(event.target instanceof Element)) return;
  const card = event.target.closest(".battle > .hand .card");
  if (!card) return;
  requestAnimationFrame(() => {
    if (battleHandDetailState?.card === card && !card.matches(":hover, :focus-within"))
      hideBattleHandDetailPanel();
  });
});
window.addEventListener("resize", refreshBattleHandDetailPanel);
document.addEventListener("scroll", refreshBattleHandDetailPanel, true);

import {
  ACT1_BOSSES,
  ACT1_ELITES,
  ACT2_BOSSES,
  ACT2_ELITES,
  ACT2_MONSTERS,
  ACT3_BOSSES,
  ACT3_ELITES,
  ACT3_MONSTERS,
  CARDS,
  EARLY_MONSTERS,
  ENEMIES,
  ITEMS,
  TEST_ITEMS,
  KINDS,
  RARITIES,
  RECOMMENDED_STARTING_DECK,
  ROOM_NAMES as RAW_ROOM_NAMES,
  ROOM_CATEGORIES,
  ROUTE,
  UNLOCKS,
  getTier1Cards,
} from "./data.js";
import * as E from "./engine.js?v=20260911-14";
import { loadGame, saveGame } from "./persistence.js";
import { STATUS_DEFINITIONS } from "./statuses.js?v=20260911-4";
import { HIDDEN_SYNERGIES, SYNERGY_COLORS } from "./synergies.js";
import { SFX } from "./sound.js?v=20260911-9";
import {
  shareHarmonyImage,
  shareHarmonyKakao,
  shareHarmonyLink,
} from "./share.js";
const ROOM_NAMES = new Proxy(RAW_ROOM_NAMES, {
  get(target, key) {
    if (ROOM_CATEGORIES[key] && run?.phase !== "map") {
      const revealed = E.roomAt(run);
      if (revealed !== key) return target[revealed];
    }
    return target[key];
  },
});
const LOCAL_FEATURE_KEY = "harmony_local_features";
function hasLocalFeatureAccess() {
  const localHosts = ["localhost", "127.0.0.1", "::1", "192.168.0.8"],
    url = new URL(location.href),
    request = url.searchParams.get("local");
  try {
    if (request === "1") localStorage.setItem(LOCAL_FEATURE_KEY, "true");
    else if (request === "0") localStorage.removeItem(LOCAL_FEATURE_KEY);
    if (request !== null) {
      url.searchParams.delete("local");
      history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    return localHosts.includes(location.hostname) || localStorage.getItem(LOCAL_FEATURE_KEY) === "true";
  } catch {
    return localHosts.includes(location.hostname);
  }
}
const $ = (id) => document.getElementById(id),
  LOCAL_CARD_TEST = hasLocalFeatureAccess(),
  loadedSave = loadGame(localStorage);
let meta = loadedSave.meta,
  run = loadedSave.run,
  started = false,
  saveRevision = loadedSave.revision;
function save() {
  const goldFeedback = run?._goldFeedback,
    goldSpentFeedback = run?._goldSpentFeedback;
  if (run) {
    delete run._goldFeedback;
    delete run._goldSpentFeedback;
  }
  try {
    saveRevision = saveGame(localStorage, { meta, run }, saveRevision);
    return true;
  } catch {
    const notice = $("notice");
    if (notice)
      notice.textContent =
        "브라우저 저장을 사용할 수 없습니다. 이 탭을 닫으면 진행이 사라질 수 있어요.";
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
      [
        "AP",
        "카드를 사용할 때 소비합니다. 기본적으로 턴 시작 시 3까지 충전되며 최대 8까지 보유합니다.",
      ],
      [
        "체력",
        "플레이어의 생명력입니다. 0이 되면 현재 여정이 종료됩니다.",
      ],
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
      ["첫 턴 패", "전투가 시작될 때 뽑는 카드 수입니다. 기본 5장입니다."],
      ["턴 드로우", "두 번째 턴부터 매 턴 뽑는 카드 수입니다. 기본 3장입니다."],
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
        "사용할 수 없고 손패 한 칸을 차지하며 해당 전투가 끝나면 사라지는 방해 카드입니다.",
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
  return GLOSSARY_GROUPS.map(
    ([title, terms]) =>
      `<section><h3>${title}</h3>${terms.map(([name, description]) => `<div class="glossary-row"><strong>${name}</strong><p>${description}</p></div>`).join("")}</section>`,
  ).join("") + `<section><h3>카드 요약 기호</h3>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#d2b28b"><strong><i>⌖</i>단일 공격<small>공격 분류</small></strong><p>선택한 적 한 명을 공격합니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#e7b65f"><strong><i>◎</i>광역 공격<small>공격 분류</small></strong><p>살아있는 모든 적을 공격합니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#78c8e8"><strong><i>⟐</i>방어막 관통<small>공격 특성</small></strong><p>적의 방어막을 무시하고 체력에 직접 피해를 줍니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#b49ae8"><strong><i>◷</i>턴수 비례<small>공격 특성</small></strong><p>현재 전투 턴수에 비례해 추가 피해가 증가합니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#e18bd1"><strong><i>↝</i>도탄<small>공격 특성</small></strong><p>타격할 때마다 무작위 생존 적을 새로 골라 공격합니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#e59a7f"><strong><i>⋙</i>연타<small>효과 요약 · ⋙ ×3</small></strong><p>한 번 사용할 때 같은 피해를 여러 차례 입힙니다. × 뒤의 숫자가 공격 횟수입니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#8fcbd4"><strong><i>⬡</i>방어막 참조<small>효과 요약 · ⬡ +25%</small></strong><p>현재 방어막을 피해나 효과 계산에 사용합니다. 표시된 백분율만큼 수치가 추가됩니다.</p></div>
    <div class="glossary-row glossary-card-symbol" style="--symbol-color:#d9ad69"><strong><i>◉</i>오일 취급<small>카드 분류 · 접촉/비접촉 아래</small></strong><p>이 카드는 오일 카드로 취급되며, 사용할 때 오일 관련 특성·유물 효과를 발동합니다.</p></div>
  </section>`;
}
function statusGlossaryHtml() {
  const statusGroup = (title, filter) =>
    `<section><h3>${title}</h3>${Object.values(STATUS_DEFINITIONS)
        .filter(filter)
        .map(
          (status) =>
            `<div class="glossary-row glossary-status" style="--status-color:${status.color}"><strong><i>${status.icon}</i>${status.name}<small>${status.kind === "buff" ? "이로운 효과" : status.kind === "debuff" ? "해로운 효과" : "표식"} · 최대 ${status.maxStacks}중첩${status.maxTurns ? ` · 최대 ${status.maxTurns}턴` : ""}${status.instant ? " · 즉시 발동" : ""}</small></strong><p>${status.description}</p></div>`,
        )
        .join("")}</section>`;
  return (
    statusGroup(
      "중첩 상태이상",
      (status) => !["duration", "control"].includes(status.category),
    ) +
    statusGroup(
      "지속 턴형 상태이상",
      (status) => status.category === "duration",
    ) +
    statusGroup(
      "행동 제한형 상태이상",
      (status) => status.category === "control",
    )
  );
}
function countItemIds(ids) {
  return [...ids.reduce(
    (counts, id) => counts.set(id, (counts.get(id) || 0) + 1),
    new Map(),
  )];
}
function itemEffectHtml(description, suffix = "", tag = "p") {
  const text = `${description}${suffix}`,
    detailed = text.length > 52;
  if (!detailed) return `<${tag}>${text}</${tag}>`;
  const preview = `${description.slice(0, 42).trim()}…`;
  return `<${tag} class="item-effect-summary">${preview}<span class="item-effect-more">자세한 효과 보기</span></${tag}><span class="item-effect-tooltip" role="tooltip">${text}</span>`;
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
  return `<div class="${hasDetails ? "item-has-details " : ""}item tier-${i.tier}"${hasDetails ? ' tabindex="0"' : ""}>${tierStars(i.tier + 1, "item-tier-stars")}${count > 1 ? `<b class="item-count" aria-label="${count}개 보유">×${count}</b>` : ""}${art}<small>${RARITIES[i.tier]} · ${KINDS[i.kind]}</small><strong>${i.name}</strong>${itemEffectHtml(i.description, effectSuffix)}<span>${roomLabel} · 최대 ${i.maxOwned}개</span></div>`;
}
function itemHtml(id, count = 1) {
  let html = rawItemHtml(id, count);
  const aura = synergyAura(id), item = ITEMS[id];
  if (!aura) return html;
  html = html.replace(`item tier-${item.tier}`, `item tier-${item.tier}${aura.attributes}`);
  return html.replace(`<strong>${item.name}</strong>`, `<strong>${item.name}</strong>${aura.badges}`);
}
function statusAmountText(id, amount) {
  const value =
    typeof amount === "object" ? (amount.stacks ?? amount.value ?? 1) : amount;
  const selectors =
    typeof amount === "object"
      ? [
          ...(amount.notes || []).map((note) => note.toUpperCase()),
          ...(amount.cardTypes || []).map(
            (type) =>
              ({
                attack: "공격 카드",
                defense: "방어 카드",
                oil: "오일 카드",
                effect: "기능 카드",
              })[type] || type,
          ),
          ...(amount.cardIds || []).map(
            (cardId) => CARDS[cardId]?.name || cardId,
          ),
        ]
      : [];
  return `${STATUS_DEFINITIONS[id].name} +${value}${selectors.length ? ` (${selectors.join("·")})` : ""}`;
}
function appliedStatusText(c) {
  return [
    ...Object.entries(c.applyPlayer || {}),
    ...Object.entries(c.applyEnemy || {}),
  ]
    .map(([id, amount]) => statusAmountText(id, amount))
    .join(" · ");
}
function cardValueWithStatusModifier(base, kind) {
  if (!started || run?.phase !== "battle" || !run.battle) return `${base}`;
  const target = run.battle.enemies?.[run.battle.selectedTarget],
    { delta } = E.cardStatusValueBreakdown(run, base, kind, target);
  return `${base}${delta ? `<span class="card-value-modifier ${delta > 0 ? "positive" : "negative"}">(${delta > 0 ? "+" : ""}${delta})</span>` : ""}`;
}
function cardEffectText(card, expanded = false) {
  const c = E.cardDefinition(card),
    level = card.level || 0,
    up = c.upgrades ? 0 : level * 3,
    attack = run ? E.power(run, "attack") : 0,
    defense = run ? E.power(run, "defense") : 0,
    lines = [];
  if (c.attack)
    lines.push(
      `피해 ${cardValueWithStatusModifier(c.attack + up + attack, "attack")}${c.hits ? ` × ${c.hits}회` : ""}`,
    );
  else if (c.burst)
    lines.push(`흡수 전부 ×${c.burstMultiplier ?? 8 + level} 피해`);
  else if (c.weight)
    lines.push(`방어막을 모두 소모해 방어막 수치 + 공격력 ${attack} 피해`);
  else if (c.heal) lines.push(`체력 +${cardValueWithStatusModifier(c.heal + up, "heal")}`);
  else if (c.shield) lines.push(`방어막 +${cardValueWithStatusModifier(c.shield + up + defense, "shield")}`);
  else if (c.missingHpHealRatio) lines.push(`잃은 체력의 ${Math.round(c.missingHpHealRatio * 100)}% 회복 · 최소 ${c.minimumHeal}`);
  else if (c.absorb) lines.push(`흡수 +${c.absorb + up}`);
  else if (c.draw) lines.push(`카드 +${c.draw}`);
  else if (card.id === "impurity") lines.push("사용 불가");
  if ((c.shield || c.attack || c.heal) && c.absorb) lines.push(`흡수 +${c.absorb + up}`);
  if (c.heal && c.shield) lines.push(`방어막 +${cardValueWithStatusModifier(c.shield + up + defense, "shield")}`);
  if (c.comboHealThreshold) lines.push(`이 카드를 포함해 이번 턴 ${c.comboHealThreshold}장 이상 사용 시 회복 ×${c.comboHealMultiplier}`);
  if (c.harmonyHealShield) lines.push("이번 턴 하모니를 완성했다면 회복량만큼 방어막 획득");
  if (c.overhealShieldRatio) lines.push(`초과 회복량의 ${Math.round(c.overhealShieldRatio * 100)}%를 방어막으로 전환`);
  if (c.cleanseDotStacks) lines.push(`연소·부식·중독·출혈 각각 ${c.cleanseDotStacks}중첩 제거`);
  if (c.attack && c.shield) lines.push(`공격 후 방어막 +${cardValueWithStatusModifier(c.shield + up + defense, "shield")}`);
  if (c.shieldDamageMultiplier) lines.push(`방어막 피해 ×${c.shieldDamageMultiplier}`);
  if (c.bypassShield) lines.push("적 방어막 관통");
  if (c.battleContactBonus) lines.push(`이번 전투에서 앞서 사용한 접촉 카드 1장당 타격마다 피해 +${c.battleContactBonus}`);
  if (c.shieldThreshold) lines.push(`방어막 ${c.shieldThreshold} 이상이면 적 방어막 관통 · 모든 적 무장 해제 1턴`);
  if (c.onHitCount) lines.push(`${c.onHitCount}타 이상 적중 시 ${Object.entries(c.onHitApplyEnemy || {}).map(([id, amount]) => statusAmountText(id, amount)).join(" · ")}`);
  if (c.dotBurstMultiplier) lines.push(`대상의 연소·중독·출혈·부식 합계 ×${c.dotBurstMultiplier} 관통 절대 피해`);
  if (c.amplifyDots) lines.push(`피해 후 대상의 지속 피해 중첩 ×${c.amplifyDots}`);
  if (c.applyEnemyAfterAttack) lines.push(Object.entries(c.applyEnemyAfterAttack).map(([id, amount]) => statusAmountText(id, amount)).join(" · "));
  if (c.turnDamageBonus) lines.push(`현재 전투 턴수 ×${c.turnDamageBonus} 추가 피해`);
  if (c.handDamageBonus) lines.push(`현재 손패 1장당 피해 +${c.handDamageBonus}`);
  if (c.randomEachHit) lines.push(`매 타격마다 무작위 적에게 도탄`);
  if (c.firstTurnOrFullHpMultiplier) lines.push(`전투 1턴째 또는 대상 체력 100%일 때 피해 ×${c.firstTurnOrFullHpMultiplier}`);
  if (c.absorbFromDamage) lines.push(`가한 피해의 ${Math.round(c.absorbFromDamage * 100)}%만큼 흡수 획득`);
  if (c.globalDotBurstMultiplier) lines.push(`모든 적의 연소·중독·출혈·부식 합계 ×${c.globalDotBurstMultiplier} 추가 광역 관통 피해`);
  if (c.extendAllDotDurations) lines.push(`모든 지속 피해 지속시간 ${c.extendAllDotDurations}턴 연장`);
  if (c.hitsPerCardThisTurn) lines.push(`이번 턴 앞서 사용한 카드마다 타수 +${c.hitsPerCardThisTurn} · 최대 ${c.maxHits}타`);
  if (c.chanceStatusOnHit) lines.push(`적중마다 ${Math.round(c.chanceStatusOnHit.chance * 100)}% 확률로 ${statusAmountText(c.chanceStatusOnHit.id, c.chanceStatusOnHit.amount)}`);
  if (c.stunOrDisarmBossTurns) lines.push(`기절 1턴 · 보스의 기절 저항 시 무장 해제 ${c.stunOrDisarmBossTurns}턴`);
  if (c.drawOnBreak) lines.push(`방어막 파괴 시 카드 ${c.drawOnBreak}장 드로우`);
  if (c.randomDiscard) lines.push(`손패 ${c.randomDiscard}장 무작위 버리기`);
  if (c.discardTierAp) lines.push(`1티어 이상 카드 버리면 AP +${c.discardTierAp} · 불순물 제외`);
  if (c.requiredAbsorb) lines.push(`흡수 ${c.requiredAbsorb} 소모 · 흡수가 부족시 사용 불가`);
  if (c.intimidateOnHit) lines.push(`적중마다 위축 누적 · 총 ${c.intimidateOnHit} · 1턴`);
  if (c.detonateBurning) lines.push(`기존 연소 피해 ×${c.detonateBurning} 즉시 폭발 · 연소를 소모하지 않습니다`);
  if (c.maxHpOnKill) lines.push(`이 공격으로 처치 시 최대 체력 영구 +${c.maxHpOnKill}`);
  if (c.discardAttackBurn) lines.push(`공격 카드 버리면 대상에게 연소 ${c.discardAttackBurn}`);
  if (c.discardCostDamage) lines.push(`버린 카드 기본 비용 1 AP당 비접촉 추가 피해 ${c.discardCostDamage}`);
  if (c.refundAbsorbThreshold) lines.push(`흡수 ${c.refundAbsorbThreshold} 이상에서 사용시 AP 1 환급`);
  if (c.absorbStatusThreshold && c.absorbThresholdApplyAllEnemy) {
    const statuses = Object.entries(c.absorbThresholdApplyAllEnemy)
      .map(([id, amount]) => `${STATUS_DEFINITIONS[id]?.name || id} ${amount}`)
      .join(" · ");
    lines.push(`흡수 획득 후 ${c.absorbStatusThreshold} 이상이면 모든 적에게 ${statuses} 부여`);
  }
  if (card.id === "burst_spatial_diffusion")
    lines.push("흡수 40 이상에서 사용시 모든 적에게 기절 1중첩 적용");
  if (c.absorbCost) lines.push(`흡수 ${c.absorbCost} 이상이면 자동 소진 후 추가 피해 +${c.fueledAttack - (c.attack || 0)}`);
  if (c.executeRatio) {
    const executeMultiplier = c.executeMultiplier || (c.executeAttack && c.attack ? c.executeAttack / c.attack : 1);
    lines.push(`체력 ${Math.round(c.executeRatio * 100)}% 이하인${c.executeNonBoss ? " 비보스" : ""} 대상에게 추가 피해 ×${Number(executeMultiplier.toFixed(2))}`);
  }
  if (c.refundOnKill) lines.push(`처치 시 AP +${c.refundOnKill}`);
  if (c.drawOnKill) lines.push(`처치 시 카드 ${c.drawOnKill}장 드로우`);
  if ((c.shield || c.absorb || c.attack) && c.draw) lines.push(`카드 ${c.draw}장 드로우`);
  if (c.preventAbsorbDecay) lines.push("이번 턴 종료 시 흡수 감쇄 무효화");
  if (c.searchDrawCard) lines.push(`뽑을 카드 더미에서 ${CARDS[c.searchDrawCard].name} 1장 서치 · 손패가 가득 차면 유지`);
  if (c.absorbAmplifyRatio) lines.push(`기본 흡수 획득 후 ${c.absorbAmplifyThreshold} 이상이면 현재 흡수의 ${Math.round(c.absorbAmplifyRatio * 100)}% 추가 획득`);
  if (c.absorbBooster) lines.push(`이번 턴 다음 카드 2장 · 흡수 획득 +${c.absorbBooster}`);
  if (c.reduceOilCost) lines.push(`이번 턴 손패의 모든 오일 카드 비용 ${c.reduceOilCost} 감소 · 최소 0`);
  if (c.retainShield) lines.push(`다음 턴 방어막 ${Math.round(c.retainShield * 100)}% 유지`);
  if (c.cleanse) lines.push(`해로운 상태이상 ${c.cleanse === "all" ? "전부" : `${c.cleanse}개`} 정화`);
  if (c.turnDamageReduction) lines.push(`이번 턴 받는 모든 피해 ${c.turnDamageReduction} 경감`);
  if (c.shieldCounter) lines.push(`방어막 획득 후 현재 방어막 ${Math.round(c.shieldCounter * 100)}% 접촉 피해 · 소모 없음`);
  if (c.shieldScalingAttack) lines.push(`방어막 획득 후 현재 방어막 ${Math.round(c.shieldScalingAttack * 100)}% 접촉 피해 · 소모 없음`);
  if (c.shieldSurvivalHeal) lines.push(`방어막이 깨지지 않고 턴을 마치면 체력 +${c.shieldSurvivalHeal}`);
  if (c.thorns) lines.push(`가시 +${c.thorns}`);
  if (c.thornsApplyAttacker) lines.push(`가시 반격 시 공격자에게 ${Object.entries(c.thornsApplyAttacker).map(([id, amount]) => statusAmountText(id, amount)).join(" · ")}`);
  if (c.discard) lines.push("손패 1장 선택 버리기");
  if (c.intimidate) lines.push(`적 위축 · 피해량 ${c.intimidate} 감소 · 1턴`);
  if (c.oil) lines.push("오일 발동");
  if (c.target === "all") lines.push("적 대상을 광역으로 공격합니다");
  if (c.target === "random") lines.push("무작위 생존 적 대상");
  if (c.target === "self") lines.push("플레이어 자신 대상");
  if (c.shieldScaling)
    lines.push(
      `현재 방어막 ${Math.round(c.shieldScaling * 100)}% 추가 피해 · 방어막 소모 없음`,
    );
  if (c.refundOnBreak) lines.push(`방어막 파괴 시 AP +${c.refundOnBreak}`);
  if (c.comboContactBonus)
    lines.push(`선행 접촉 카드 사용 시 피해 +${c.comboContactBonus}`);
  for (const [id, amount] of Object.entries(c.bonusPerStatus || {}))
    lines.push(`${STATUS_DEFINITIONS[id]?.name || id} 중첩당 피해 +${amount}`);
  if (c.consumeResonance)
    lines.push(`잔향 전량 소비 · 중첩당 피해 +${c.consumeResonance}`);
  if (c.absorbBonusRatio)
    lines.push(
      c.absorbBonusRatio === 1
        ? "현재 흡수량만큼 추가 피해 · 흡수 소모 없음"
        : `현재 흡수량의 ${Math.round(c.absorbBonusRatio * 100)}% 추가 피해 · 흡수 소모 없음`,
    );
  for (const [intent, statuses] of Object.entries(
    c.conditionalEnemyIntent || {},
  ))
    for (const [id, amount] of Object.entries(statuses))
      lines.push(
        `${intent === "attack" ? "공격 준비 중인 적에게" : `${intent} 행동을 준비 중인 적에게`} ${statusAmountText(id, amount)}`,
      );
  if (c.purgeImpurity) lines.push(c.purgeImpurity === Infinity ? "손패의 불순물 전부 소멸" : `손패의 불순물 ${c.purgeImpurity}장 소멸`);
  if (c.burst) lines.push("적 행동 -1회");
  if (card.id === "impurity") lines.push("전투 덱 오염");
  for (const [id, amount] of [
    ...Object.entries(c.applyPlayer || {}),
    ...Object.entries(c.applyEnemy || {}),
  ])
    lines.push(statusAmountText(id, amount));
  if (expanded) return lines.join(" · ");
  const visibleTextLength = lines
      .join("")
      .replace(/<[^>]*>/g, "")
      .length,
    condensed = lines.length > 2 || visibleTextLength > 34,
    visible = condensed
      ? [lines[0], "자세한 효과 보기"]
      : lines,
    body = visible
      .map(
        (line, index) =>
          `<span class="${index ? "card-effect-extra" : "card-effect-main"}${condensed && index === visible.length - 1 ? " card-effect-more" : ""}">${line}</span>`,
      )
      .join("");
  return condensed
    ? `${body}<span class="card-effect-tooltip" role="tooltip">${lines.join("<br>")}</span>`
    : body;
}
function semanticRuleMarkup(text) {
  let markup = text.replace(
    /([+-]?\d+(?:\.\d+)?%?)(턴|중첩|회|장|AP)?/g,
    (match, value, unit = "", offset) => {
      const before = text.slice(Math.max(0, offset - 18), offset),
        after = text.slice(offset + match.length, offset + match.length + 18),
        discardLoss = unit === "장" && /버리/.test(after),
        resourceLoss = /(?:흡수|방어막)\s*$/.test(before) && /(?:소모|소진)/.test(after),
        selfDamageLoss = /(?:플레이어|자신)/.test(before) && /피해/.test(after),
        costLoss = /비용/.test(before) && /증가/.test(after),
        valueClass = discardLoss || resourceLoss || selfDamageLoss || costLoss
          ? "semantic-loss"
          : "semantic-gain";
      return `<b class="${valueClass}">${value}${unit}</b>`;
    },
  );
  for (const status of Object.values(STATUS_DEFINITIONS))
    markup = markup.replaceAll(
      status.name,
      `<span class="detail-status" style="--detail-status-color:${status.color}">${status.name}</span>`,
    );
  markup = markup
    .replaceAll("모든 적", "__DETAIL_ALL_ENEMIES__")
    .replaceAll("방어막 관통", "__DETAIL_PIERCE__")
    .replaceAll("완전 관통", "__DETAIL_FULL_PIERCE__")
    .replaceAll("도탄", "__DETAIL_RICOCHET__")
    .replaceAll("광역", "__DETAIL_AOE__")
    .replaceAll("방어막", '<span class="detail-shield">방어막</span>')
    .replaceAll("흡수", '<span class="detail-absorb">흡수</span>')
    .replaceAll("오일", '<span class="detail-oil">오일</span>')
    .replaceAll("__DETAIL_PIERCE__", '<span class="detail-pierce">방어막 관통</span>')
    .replaceAll("__DETAIL_FULL_PIERCE__", '<span class="detail-pierce">완전 관통</span>')
    .replaceAll("__DETAIL_RICOCHET__", '<span class="detail-ricochet">도탄</span>')
    .replaceAll("__DETAIL_AOE__", '<span class="detail-aoe">광역</span>')
    .replaceAll("__DETAIL_ALL_ENEMIES__", '<span class="detail-aoe">모든 적</span>');
  return markup;
}
function completeSemanticRule(text) {
  const clean = text.replace(/<[^>]*>/g, "").trim();
  if (!clean) return "";
  if (clean === "흡수가 부족시 사용 불가")
    return `${semanticRuleMarkup("흡수가 부족시")} 사용불가합니다.`;
  if (clean === "연소를 소모하지 않습니다")
    return `${semanticRuleMarkup(clean)}.`;
  if (clean === "적 대상을 광역으로 공격합니다")
    return `${semanticRuleMarkup(clean)}.`;
  if (clean === "불순물 제외")
    return "위 효과는 불순물 카드 제외입니다.";
  if (/^흡수 40 이상에서 사용시 모든 적에게 기절 1중첩 적용$/.test(clean))
    return `${semanticRuleMarkup(clean)}합니다.`;
  if (/[.!?]$/.test(clean)) return semanticRuleMarkup(clean);
  return `${semanticRuleMarkup(clean)} 효과가 적용됩니다.`;
}
function compactCardEffectSummary(card) {
  const c = E.cardDefinition(card);
  const isTierOneContactAttack =
      c.tier === 1 &&
      (c.category || (c.attack || c.burst || c.weight ? "attack" : null)) ===
        "attack" &&
      c.attackPattern === "contact",
    isDualStatusTestCard = c.id === "contact_steel_pierce";
  if (c.id === "impurity") return null;
  const level = card.level || 0,
    up = c.upgrades ? 0 : level * 3,
    attack = run ? E.power(run, "attack") : 0,
    defense = run ? E.power(run, "defense") : 0,
    mainValues = [],
    directStatuses = [
      ...Object.entries(c.applyEnemy || {}).map(([id, amount]) => ({
        id,
        amount,
        target: "enemy",
      })),
      ...Object.entries(c.applyPlayer || {}).map(([id, amount]) => ({
        id,
        amount,
        target: "player",
      })),
    ],
    referencedStatusIds = [
      ...Object.keys(c.bonusPerStatus || {}),
      ...(c.consumeResonance ? ["resonance"] : []),
      ...(c.detonateBurning ? ["burning"] : []),
      ...((c.dotBurstMultiplier || c.globalDotBurstMultiplier || c.amplifyDots)
        ? ["burning", "poison", "bleed", "corrosion"]
        : []),
    ],
    statuses = [
      ...directStatuses,
      ...Object.entries(c.applyEnemyAfterAttack || {}).map(([id, amount]) => ({
        id,
        amount,
        target: "enemy",
      })),
      ...Object.entries(c.onHitApplyEnemy || {}).map(([id, amount]) => ({
        id,
        amount,
        target: "enemy",
      })),
      ...Object.entries(c.absorbThresholdApplyAllEnemy || {}).map(
        ([id, amount]) => ({ id, amount, target: "enemy" }),
      ),
      ...Object.entries(c.thornsApplyAttacker || {}).map(([id, amount]) => ({
        id,
        amount,
        target: "enemy",
      })),
      ...Object.values(c.conditionalEnemyIntent || {}).flatMap((statusMap) =>
        Object.entries(statusMap).map(([id, amount]) => ({
          id,
          amount,
          target: "enemy",
        })),
      ),
      ...(c.chanceStatusOnHit
        ? [
            {
              id: c.chanceStatusOnHit.id,
              amount: c.chanceStatusOnHit.amount,
              target: "enemy",
            },
          ]
        : []),
      ...(c.intimidate || c.intimidateOnHit
        ? [
            {
              id: "intimidated",
              amount: c.intimidate || c.intimidateOnHit,
              target: "enemy",
            },
          ]
        : []),
      ...(c.stunOrDisarmBossTurns
        ? [
            { id: "stun", amount: 1, target: "enemy" },
            {
              id: "disarm",
              amount: { stacks: 1, turns: c.stunOrDisarmBossTurns },
              target: "enemy",
            },
          ]
        : []),
      ...(c.id === "burst_spatial_diffusion"
        ? [{ id: "stun", amount: 1, target: "enemy" }]
        : []),
    ],
    symbolStatuses = [...statuses, ...referencedStatusIds.map((id) => ({ id, amount: null, target: "reference" }))]
      .filter(({ id }, index, list) => list.findIndex((entry) => entry.id === id) === index),
    isAttackCard = Boolean(c.attack || c.burst || c.weight),
    effectSymbols = symbolStatuses
      .map(({ id, amount, target }) => {
        const definition = STATUS_DEFINITIONS[id];
        if (!definition) return "";
        const label = target === "reference" ? `${definition.name} 참조` : `${target === "player" ? "자신에게 " : ""}${statusAmountText(id, amount)}`;
        return `<em class="card-effect-symbol target-${target}" style="--card-status-color:${definition.color}" title="${label}" aria-label="${label}">${definition.icon}</em>`;
      })
      .join("") + [
      isAttackCard && c.target === "all"
        ? `<em class="card-effect-symbol" style="--card-status-color:#e7b65f" title="광역 공격" aria-label="광역 공격">◎</em>`
        : isAttackCard && c.target !== "random"
          ? `<em class="card-effect-symbol" style="--card-status-color:#d2b28b" title="단일 대상 공격" aria-label="단일 대상 공격">⌖</em>`
          : "",
      isAttackCard && (c.bypassShield || c.thresholdBypassShield)
        ? `<em class="card-effect-symbol" style="--card-status-color:#78c8e8" title="방어막 관통" aria-label="방어막 관통">⟐</em>`
        : "",
      isAttackCard && c.turnDamageBonus
        ? `<em class="card-effect-symbol" style="--card-status-color:#b49ae8" title="턴수 비례 피해" aria-label="턴수 비례 피해">◷</em>`
        : "",
      isAttackCard && c.randomEachHit
        ? `<em class="card-effect-symbol" style="--card-status-color:#e18bd1" title="도탄" aria-label="도탄">↝</em>`
        : "",
      c.hits > 1
        ? `<em class="card-effect-symbol" style="--card-status-color:#e59a7f" title="연타 ${c.hits}회" aria-label="연타 ${c.hits}회">⋙</em>`
        : "",
      c.shieldScaling
        ? `<em class="card-effect-symbol" style="--card-status-color:#8fcbd4" title="현재 방어막의 ${Math.round(c.shieldScaling * 100)}%만큼 추가 피해" aria-label="방어막 비례 추가 피해 ${Math.round(c.shieldScaling * 100)}퍼센트">⬡</em>`
        : "",
    ].join(""),
    targetLabel = c.target === "all" ? "모든 적" : c.target === "random" ? "무작위 적" : "대상",
    targetMarkup = c.target === "all"
      ? `<span class="detail-aoe">${targetLabel}</span>`
      : `<span class="detail-target">${targetLabel}</span>`,
    damageText = c.hits
      ? `<b class="semantic-gain">${c.attack + up + attack}</b>씩 <b class="semantic-gain">${c.hits}회</b>`
      : `<b class="semantic-gain">${c.attack + up + attack}</b>`,
    statusSentences = directStatuses.map(({ id, amount, target }) => {
      const definition = STATUS_DEFINITIONS[id],
        value = typeof amount === "object" ? amount.stacks ?? amount.value ?? 1 : amount,
        turns = typeof amount === "object" ? amount.turns : null,
        beneficial =
          (target === "player" && definition?.kind === "buff") ||
          (target === "enemy" && definition?.kind !== "buff"),
        valueClass = beneficial ? "semantic-gain" : "semantic-loss";
      if (!definition) return "";
      const lastCode = definition.name.charCodeAt(definition.name.length - 1),
        objectParticle = lastCode >= 0xac00 && lastCode <= 0xd7a3 && (lastCode - 0xac00) % 28 === 0 ? "를" : "을";
      return `<span class="detail-status-clause" style="--detail-status-color:${definition.color}"><span class="detail-status">${definition.name}</span>${objectParticle} ${turns ? `<b class="${valueClass}">${turns}턴 동안</b> ` : ""}<b class="${valueClass}">${value}중첩</b> 적용합니다${target === "player" ? " (자신)" : ""}</span>.`;
    }).filter(Boolean),
    extraSentences = [];
  if (c.attack)
    mainValues.push(`피해 <b>${cardValueWithStatusModifier(c.attack + up + attack, "attack")}</b>`);
  else if (c.burst)
    mainValues.push(`흡수 비례 피해 <b>×${c.burstMultiplier ?? 8 + level}</b>`);
  else if (c.weight)
    mainValues.push(`방어막 소모 <b>전량</b>`);
  if (c.shield)
    mainValues.push(`방어막 <b>+${cardValueWithStatusModifier(c.shield + up + defense, "shield")}</b>`);
  if (c.heal)
    mainValues.push(`회복 <b>+${cardValueWithStatusModifier(c.heal + up, "heal")}</b>`);
  if (c.absorb) mainValues.push(`흡수 <b>+${c.absorb + up}</b>`);
  if (c.draw) mainValues.push(`카드 <b>+${c.draw}</b>`);
  for (const { id, amount, target } of statuses) {
    const definition = STATUS_DEFINITIONS[id],
      value = typeof amount === "object" ? amount.stacks ?? amount.value ?? 1 : amount;
    if (!definition) continue;
    mainValues.push(`<span class="card-summary-status" style="--summary-row-color:${definition.color}">${target === "player" ? "자신 " : ""}${definition.name}</span><b class="card-summary-status" style="--summary-row-color:${definition.color}">+${value}</b>`);
  }
  if (c.hits > 1)
    mainValues.push(`<span class="card-summary-special">연타</span><b class="card-summary-special">${c.hits}회</b>`);
  if (c.shieldScaling)
    mainValues.push(`<span class="card-summary-shield">방어막 비례</span><b class="card-summary-shield">${Math.round(c.shieldScaling * 100)}%</b>`);
  if (c.oil) extraSentences.push(`<span class="detail-oil">오일</span>을 발동합니다.`);
  if (c.shieldScaling)
    extraSentences.push(`현재 <span class="detail-shield">방어막</span>의 <b class="semantic-gain">${Math.round(c.shieldScaling * 100)}%</b>만큼 추가 피해를 주며 <span class="detail-shield">방어막</span>은 소모하지 않습니다.`);
  if (c.absorbBonusRatio)
    extraSentences.push(`현재 <span class="detail-absorb">흡수</span>의 <b class="semantic-gain">${Math.round(c.absorbBonusRatio * 100)}%</b>만큼 추가 피해를 주며 <span class="detail-absorb">흡수</span>는 소모하지 않습니다.`);
  if (!mainValues.length)
    mainValues.push(cardEffectText(card, true).split(" · ")[0]);
  const attackPatternLabel = c.attackPattern === "nonContact" ? "비접촉 피해" : "접촉 피해",
    primarySentences = [];
  if (c.attack)
    primarySentences.push(`${targetMarkup}에게 <span class="detail-pattern detail-pattern-${c.attackPattern || "contact"}">${attackPatternLabel}</span>를 ${damageText} 입힙니다.`);
  else if (c.burst)
    primarySentences.push(`<span class="detail-absorb">흡수</span>를 전부 소모하여 현재 흡수의 <b class="semantic-gain">${c.burstMultiplier ?? 8 + level}배</b>만큼 피해를 입힙니다.`);
  else if (c.weight)
    primarySentences.push(`현재 <span class="detail-shield">방어막</span>을 모두 소모하고, 방어막 수치와 공격력을 합한 만큼 대상에게 피해를 입힙니다.`);
  if (c.shield)
    primarySentences.push(`플레이어가 <span class="detail-shield">방어막</span>을 <b class="semantic-gain">${c.shield + up + defense}</b> 얻습니다.`);
  if (c.heal)
    primarySentences.push(`플레이어의 체력을 <b class="semantic-gain">${c.heal + up}</b> 회복합니다.`);
  if (c.absorb)
    primarySentences.push(`<span class="detail-absorb">흡수</span>를 <b class="semantic-gain">${c.absorb + up}</b> 얻습니다.`);
  if (c.draw)
    primarySentences.push(`카드를 <b class="semantic-gain">${c.draw}장</b> 뽑습니다.`);
  const representedStatusNames = new Set(
      directStatuses.map(({ id }) => STATUS_DEFINITIONS[id]?.name).filter(Boolean),
    ),
    expandedRules = cardEffectText(card, true)
      .split(" · ")
      .map((rule) => rule.replace(/<[^>]*>/g, "").trim())
      .filter(Boolean),
    remainingRules = expandedRules.filter((rule, index) => {
      if (index === 0 && (c.attack || c.burst || c.weight || c.heal || c.shield || c.absorb || c.draw)) return false;
      if (c.absorb && /^흡수 \+/.test(rule)) return false;
      if (c.shield && /^방어막 \+/.test(rule)) return false;
      if (c.heal && /^체력 \+/.test(rule)) return false;
      if (c.draw && /^카드 \+/.test(rule)) return false;
      if (c.oil && rule === "오일 발동") return false;
      if (c.shieldScaling && /^현재 방어막/.test(rule)) return false;
      if (c.shieldScaling && rule === "방어막 소모 없음") return false;
      if (c.absorbBonusRatio && /^현재 흡수/.test(rule)) return false;
      if (c.absorbBonusRatio && rule === "흡수 소모 없음") return false;
      if (c.target === "all" && rule === "적 대상을 광역으로 공격합니다") return false;
      return ![...representedStatusNames].some((name) => rule.startsWith(`${name} +`));
    }),
    detail = [
      ...primarySentences,
      ...statusSentences,
      ...extraSentences,
      ...remainingRules.map(completeSemanticRule),
    ].filter(Boolean).join(" ");
  return {
    symbols: effectSymbols
      ? `<span class="card-effect-symbols">${effectSymbols}</span>`
      : "",
    body: `<span class="card-effect-main card-effect-compact">${mainValues.map((value) => `<span>${value}</span>`).join("")}</span><span class="card-effect-tooltip" role="tooltip">${detail}</span>`,
  };
}
function cardHtml(card, index = null, interaction = null) {
  const c = CARDS[card.id],
    tier = Math.min(4, Math.max(1, Number(c.tier) || 1)),
    cardNote = card.note || c.note,
    price = run?.battle ? E.cost(run, card) : c.cost,
    type =
      c.attack || c.burst || c.weight
        ? "attack"
        : c.category === "heal"
          ? "healing"
        : c.shield
          ? "defense"
          : c.heal
            ? "healing"
            : "effect",
    choosingDiscard = index !== null && run?.battle?.pendingDiscard,
    disabled = index !== null && (choosingDiscard ? !E.canDiscard(run, card) : !E.canPlay(run, card)),
    pattern =
      c.attackPattern || (c.attack || c.burst || c.weight ? "contact" : null),
    patternBadge = pattern
      ? `<em class="attack-pattern pattern-${pattern}">${pattern === "contact" ? "접촉" : "비접촉"}</em>`
      : "",
    oilBadge = c.oil
      ? `<em class="attack-pattern classification-oil" title="오일 카드" aria-label="오일 카드">◉</em>`
      : "",
    category = c.category || (c.attack || c.burst || c.weight ? "attack" : c.shield || c.heal ? "defense" : c.absorb ? "absorb" : "effect"),
    icon = {
      attack: `<svg viewBox="0 0 24 24"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6m-3 3 4 4m-1 1 2-2M14.5 6.5 18 3h3v3L9.5 17.5M5 14l-2 2 5 5 2-2"/></svg>`,
      defense: `<svg viewBox="0 0 40 40"><path d="M20 5l12 5v9c0 8-4.8 13-12 17-7.2-4-12-9-12-17v-9z"/></svg>`,
      absorb: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="11"/><circle cx="20" cy="20" r="7"/></svg>`,
      heal: `<svg viewBox="0 0 40 40"><path d="M16 6h8v10h10v8H24v10h-8V24H6v-8h10z"/></svg>`,
      effect: `<svg viewBox="0 0 40 40"><path d="M20 6l3.6 10.4L34 20l-10.4 3.6L20 34l-3.6-10.4L6 20l10.4-3.6z"/></svg>`,
    }[category],
    interactionAttributes = interaction
      ? `data-action="${interaction.action}" data-card="${interaction.card}" aria-label="${interaction.ariaLabel}"${interaction.index === undefined ? "" : ` data-index="${interaction.index}"`}${interaction.replaceIndex === undefined ? "" : ` data-replace-index="${interaction.replaceIndex}"`}`
      : index === null
        ? ""
        : `data-action="${choosingDiscard ? "discard-choice" : "play"}" data-index="${index}"`,
    compactEffect = compactCardEffectSummary(card);
 return `<button class="card card-type-${type} card-category-${category} note-${cardNote} card-tier-${tier}${compactEffect !== null ? " card-compact-status" : ""}${card.id === "impurity" ? " card-impurity" : ""}${interaction?.className ? ` ${interaction.className}` : ""}" ${interactionAttributes} ${disabled ? "disabled" : ""}><span class="card-top"><b>${choosingDiscard ? (disabled ? "버리기 불가" : "이 카드 버리기") : `${price} AP`}</b>${card.id === "impurity" ? "" : tierStars(tier, "card-tier-stars")}<span class="card-meta"><small>${{ top: "TOP", middle: "MIDDLE", base: "BASE", none: "불순물" }[cardNote]}</small>${patternBadge}${oilBadge}</span></span><span class="card-symbol" aria-hidden="true">${icon}</span><strong>${c.name}${card.level ? ` +${card.level}` : ""}</strong>${compactEffect?.symbols || ""}<span class="card-effects">${compactEffect?.body ?? cardEffectText(card)}</span></button>`;
}
function collection() {
  const found = (meta.synergies || []).map((id) => HIDDEN_SYNERGIES[id]).filter(Boolean),
    achievements = UNLOCKS.filter((unlock) => !unlock.legacy),
    unlockedCount = achievements.filter((unlock) => meta.unlocked.includes(unlock.id)).length;
  return `<details class="collection"><summary>발견 증강 ${meta.discovered.length} / ${Object.keys(ITEMS).length} · 업적 ${unlockedCount} / ${achievements.length}</summary><div class="unlock-grid">${achievements.map((u) => `<div><strong>${meta.unlocked.includes(u.id) ? "✓" : "◇"} ${u.name}</strong><p>${u.goal}</p></div>`).join("")}</div><h3>✦ 발견한 비밀 조합 ${found.length} / ${Object.keys(HIDDEN_SYNERGIES).length}</h3><div class="synergy-collection">${found.map((synergy) => `<article><strong>${synergy.name}</strong><p>${synergy.description}</p></article>`).join("") || "<p>뜻밖의 아이템 조합이 숨은 조화를 깨웁니다.</p>"}</div><div class="inventory">${meta.discovered.map(itemHtml).join("") || "<p>방을 탐험해 첫 아이템을 발견해보세요.</p>"}</div></details>`;
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
  return `<aside class="player-stats ${run.hp / run.maxHp <= 0.3 ? "health-danger" : ""}${isCriticalHealth() ? " health-critical" : ""}" aria-label="내 능력치"><div class="stats-title"><span>MY HARMONY</span><strong>내 능력치</strong></div><div class="stat-grid">${stats.map(([icon, label, value], index) => `<div class="stat-row${index === 0 ? " health-stat" : ""}"><i>${icon}</i><span>${label}</span>${value}</div>`).join("")}</div><p class="stats-note">괄호 안 수치는 능력치 아이템으로 증가한 값입니다.</p>${run.phase === "battle" ? playerEffectsRow("side") : ""}<button class="run-summary-button" data-run-open><span>▤</span> 내 덱 · 여정 아이템<small>카드 ${run.deck.length}장 · 아이템 ${run.inventory.length}개</small></button></aside>`;
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
      return `<button type="button" class="status-chip status-${definition.kind}" data-term aria-expanded="false" style="--status-color:${definition.color}"><span>${definition.icon}</span><b>${definition.name} ${status.stacks}${duration}</b><span class="term-tip" role="tooltip">${status.description || definition.description}<br>현재 ${status.stacks} / 최대 ${definition.maxStacks}중첩${status.turns ? `<br>남은 ${status.turns} / 최대 ${definition.maxTurns}턴` : ""}</span></button>`;
    })
    .join("")}</div>`;
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
      if (intent.type === "attack")
        parts.push(
          `⚔ ${(intent.attackPattern || "contact") === "contact" ? "접촉" : "비접촉"} ${intent.value}`,
        );
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
        const contact = (intent.attackPattern || "contact") === "contact";
        return {
          type: "attack",
          icon: contact ? "⚔" : "✦",
          label: contact ? "접촉 공격" : "비접촉 공격",
          value: intentModifierHtml(valueBreakdown.base, valueBreakdown.delta),
          unit: "피해",
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
            : `<span class="enemy-symbol" aria-hidden="true">${data.symbol || "◇"}</span>`;
        const shieldTone = enemy.shield > 0 ? "positive" : enemy.shield < 0 ? "negative" : "zero";
        return `<article class="enemy ${index === b.selectedTarget && enemy.hp > 0 ? "selected" : ""} ${enemy.hp <= 0 ? "defeated" : ""} ${b.actingEnemy === index ? "acting-enemy" : ""}" data-action="target" data-target="${index}" tabindex="${enemy.hp > 0 && !b.enemyPhase ? "0" : "-1"}" aria-label="${enemy.name}${index === b.selectedTarget ? " 선택됨" : " 선택"}">${intentHtml(enemy)}<div class="enemy-visual">${art}</div><h2>${enemy.name}</h2><div class="enemy-hp"><span style="width:${(100 * enemy.hp) / enemy.maxHp}%"></span></div><div class="enemy-vitals"><strong class="enemy-health-value">${enemy.hp} / ${enemy.maxHp}</strong><span class="enemy-shield-value shield-${shieldTone}" aria-label="방어막 ${enemy.shield}"><i aria-hidden="true">🛡</i><small>방어막</small><b>${enemy.shield > 0 ? "+" : ""}${enemy.shield}</b></span></div>${statusList(enemy, `${enemy.name} 상태`)}</article>`;
      })
      .join("")}</div>`;
  const enrageStartTurn = E.enrageTurn(b),
    enraged = b.turn >= enrageStartTurn,
    selectedEnemy = b.enemies[b.selectedTarget],
    battleInfo = `<div class="battle-info" aria-label="현재 전투 정보"><span class="battle-info-chip target"><i aria-hidden="true">🎯</i><small>대상</small><b>${selectedEnemy?.hp > 0 ? selectedEnemy.name : "없음"}</b></span><span class="battle-info-chip"><i aria-hidden="true">👾</i><small>생존</small><b>${E.livingEnemies(b).length}/${b.enemies.length}</b></span><span class="battle-info-chip draw-pile-chip"><i aria-hidden="true">▤</i><small>남은 덱</small><b>${b.draw.length}</b></span><span class="battle-info-chip"><i aria-hidden="true">◆</i><small>손패</small><b>${b.hand.length}</b></span><button type="button" class="battle-info-chip discard-pile-trigger" aria-label="버린 카드 ${b.discard.length}장 보기"><i aria-hidden="true">▽</i><small>버림</small><b>${b.discard.length}</b></button></div>`;
  return `<section class="battle ${b.enemyPhase ? "enemy-phase" : "player-phase"}${enraged ? " enraged" : ""}${isCriticalHealth() ? " health-critical" : ""}"><div class="battle-top"><p class="eyebrow">${ROOM_NAMES[ROUTE[run.node]]} · ROUND ${b.turn} · ${b.enemyPhase ? "ENEMY PHASE" : "PLAYER PHASE"}</p><span class="${enraged ? "enrage-warning" : ""}">${enraged ? "⚠ 폭주 상태: 매 턴 증가하는 방어 무시 피해!" : b.turn >= enrageStartTurn - 2 ? `⚠ ${enrageStartTurn}턴부터 폭주 관통 피해` : "턴 종료 후 적이 위에서부터 행동합니다"}</span></div><div class="battle-arena">${queue}${field}</div><div class="combat-stats">${combatTerm("AP", b.ap, "카드를 사용할 때 소비하며, 턴이 시작되면 다시 충전됩니다. 카드 왼쪽 위 숫자가 필요한 AP입니다.")}${combatTerm("방어막", b.shield, "받는 피해를 먼저 막습니다. 기본적으로 다음 턴 시작 시 사라지지만 일부 유물은 방어막을 보존합니다.")}${combatTerm("흡수", `${b.absorb} / 100`, "오일과 추출 카드로 쌓는 자원입니다. 공간 확산 같은 카드가 흡수를 소비해 강력한 효과를 냅니다.")}${combatTerm(
    "노트",
    b.notes
      .slice(-2)
      .map((c) => (c.note || CARDS[c.id].note).toUpperCase())
      .join(" → ") || "—",
    "카드는 탑·미들·베이스 노트를 가집니다. 순서를 완성하면 관련 특성과 유물의 연쇄 효과가 발동합니다.",
)}</div>${playerEffectsRow("battle")}${b.pendingDiscard ? `<div class="discard-prompt" role="alert"><span aria-hidden="true">↓</span><div><strong>버릴 카드 ${b.pendingDiscard}장을 선택하세요</strong><p>아래 강조된 카드를 누르면 버립니다. 카드 사용 효과는 발동하지 않습니다.</p></div></div>` : ""}<div class="hand ${b.pendingDiscard ? "hand-discard-choice" : ""}">${b.hand.map((c, i) => cardHtml(c, i)).join("")}</div><div class="turn-bar">${battleInfo}<button class="primary" data-action="end" ${b.enemyPhase || b.pendingDiscard ? "disabled" : ""}>${b.pendingDiscard ? "버릴 카드 선택 대기 중" : b.enemyPhase ? "적 행동 진행 중…" : "턴 종료 · 적 페이즈 →"}</button></div></section>`;
}
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
    case "reward": {
      const r = run.reward,
        totalPicks = r.cardPicksTotal || r.cardPicksRemaining || 1,
        currentPick = Math.max(1, totalPicks - (r.cardPicksRemaining || 1) + 1),
        showItem = r.item && !r.itemAcknowledged;
      return `<section class="room"><p class="eyebrow">DISCOVERY</p><h1>${showItem ? "새로운 조합의 조각" : "조율 성공"}</h1><p>기본 보상: 골드 ${r.gold}${!r.goldIncludesBonus && E.power(run, "goldBonus") ? ` + 보너스 ${E.power(run, "goldBonus")}` : ""}</p>${showItem ? `<div class="reward-item reward-tier-${ITEMS[r.item].tier}">${itemHtml(r.item)}</div><p class="hint">아이템 획득 후 카드 보상이 이어집니다.</p>` : `<p>카드를 선택하세요. <b>남은 선택 ${r.cardPicksRemaining || 1}회</b> · 건너뛰기는 현재 선택 1회만 소모합니다.</p><div class="choices card-reward-choices">${r.cards.map((id) => `<div>${cardHtml({ id, level: 0 }, null, { action: "reward", card: id, className: "reward-select-card", ariaLabel: `${CARDS[id].name} 카드 추가` })}<button data-action="reward" data-card="${id}">이 카드 추가</button></div>`).join("")}</div>`}<button class="primary" data-action="reward">${showItem ? "카드 보상 확인 →" : `건너뛰기 (${currentPick}/${totalPicks}) →`}</button></section>`;
    }
    case "rest": {
      const choices = E.restCardChoices(run);
      return `<section class="room rest-room"><p class="eyebrow">REST SITE</p><h1>잠시 숨을 고르는 시간</h1><p>체력을 회복하거나, 무작위로 펼쳐진 카드 중 한 장을 영구 강화하세요.</p><button class="primary" data-action="rest-heal">체력 ${Math.ceil(run.maxHp * 0.3)} 회복</button><div class="choices rest-card-choices">${choices.map((index) => { const card = run.deck[index], definition = CARDS[card.id], max = E.cardMaxUpgrade(card), nextLevel = Math.min(max, card.level + 1), interaction = { action: "upgrade", card: card.id, index, ariaLabel: `${definition.name} +${nextLevel} 강화` }; return `<div>${cardHtml(card, null, interaction)}<button data-action="upgrade" data-index="${index}" ${card.level >= max ? "disabled" : ""}>강화 +${card.level} → +${nextLevel}</button></div>`; }).join("") || '<p class="hint">강화할 수 있는 카드가 없습니다. 회복을 선택해 휴식을 마치세요.</p>'}</div></section>`;
    }
    case "shop":
      { const potionPrice = E.shopPrice(run, 25, "potion"), offers = E.shopOffers(run, meta);
        const goods = offers.map((offer, index) => {
          const product = offer.type === "card" ? CARDS[offer.id] : ITEMS[offer.id],
            price = E.shopPrice(run, offer.basePrice, offer.type),
            ownedOut = offer.type === "card"
              ? run.deck.length >= E.deckLimit(run) || run.deck.filter((card) => card.id === offer.id).length >= E.cardMaxCopies(offer.id)
              : false;
          return `<div class="atelier-product reward-tier-${offer.tier}">${offer.type === "card" ? cardHtml({ id: offer.id, level: 0 }) : itemHtml(offer.id)}<button data-action="shop-offer" data-index="${index}" ${offer.sold || ownedOut || run.gold < price ? "disabled" : ""}>${offer.sold ? "판매 완료" : `구매 · ${price} G`}</button></div>`;
        }).join("");
        return `<section class="room"><p class="eyebrow">ATELIER</p><h1>아틀리에</h1><p>포션과 엄선된 액티브 카드·증강을 판매합니다. 상품 가격은 티어에 따라 결정됩니다.</p><button data-action="buy" ${run.gold < potionPrice || run.potions >= E.potionLimit(run) ? "disabled" : ""}>회복약 구매 · ${potionPrice} G (${run.potions}/${E.potionLimit(run)})</button>${run.shopRerolls > 0 ? `<button data-action="shop-reroll">무료 새로고침 · ${run.shopRerolls}회</button>` : ""}<div class="choices atelier-products">${goods || '<p class="hint">판매 드랍테이블 준비 중입니다.</p>'}</div><button class="primary" data-action="leave">상점 나가기 · 던전 진행 →</button></section>`;
      }
    case "loop":
      { const next = E.actInfo(run.loop + 1); return `<section class="room"><p class="eyebrow">HARMONY COMPLETE</p><h1>${E.actInfo(run.loop).name}의 조화가 완성됐습니다.</h1><p>현재 덱과 아이템을 유지한 채 ${next.name}에 진입할 수 있습니다.</p><div class="actions"><button class="primary" data-action="loop">${next.name} 진입 →</button><button data-action="finish">여정 완료 · 기록 확정</button></div></section>`; }
    case "result":
      return `<section class="room"><p class="eyebrow">${run.hp ? "JOURNEY COMPLETE" : "JOURNEY ENDED"}</p><h1>${run.hp ? "향기로 채운 여정" : "다음에는 또 다른 조합으로"}</h1><div class="result-score">${number(run.score)}<small>POINTS</small></div><p>${run.loop ? `심연 ${run.loop}` : "기본 여정"} · ${run.node + 1}번째 방 · 최대 한 방 ${number(run.maxHit)}</p><button class="primary" data-action="new">새로운 여정 →</button>${collection()}</section>`;
  }
}

function specialRoom() {
  const room = run.phase;
  if (run.specialResult)
    return `<section class="room special-room special-${room}"><p class="eyebrow">CHOICE RESOLVED</p><div class="room-icon">${icons[room] || "✦"}</div><h1>${ROOM_NAMES[room]}</h1><p class="special-result">${run.specialResult.text}</p>${run.specialResult.item ? `<div class="reward-item reward-tier-${ITEMS[run.specialResult.item].tier}">${itemHtml(run.specialResult.item)}</div>` : ""}<button class="primary" data-action="special-leave">다음 방으로 →</button></section>`;
  const descriptions = {
    mystery: "단단히 봉인된 크리스탈 금고입니다. 강제로 부수면 대박을 건지거나 독가스가 터집니다.",
    greenhouse: "고대 향나무와 약초가 지친 조향사를 감싸며 피로를 씻어냅니다.",
    curse_pit: "검은 침전물 아래서 값비싼 유물이 요동치지만 깊은 대가를 치러야 합니다.",
    lab: "연금 증류관 안에서 노트를 다시 섞거나 불필요한 카드를 세척할 수 있습니다.",
    mercury_still: "치명적인 수은이 끓어오릅니다. 더 많은 AP를 얻는 대신 매 턴 생명력을 잃을 수 있습니다.",
    blood_altar: "검은 피로 물든 제단입니다. 생명력이나 골드를 제물로 힘을 얻습니다.",
    dice_altar: "향나무로 조각된 운명의 주사위가 위험한 전리품을 불러냅니다.",
    purify_furnace: "모든 것을 태우는 정제의 화로입니다. 고통을 감수해 덱이나 공격력을 벼릴 수 있습니다.",
    mirror_doppel: "거울 속 또 다른 조향사가 카드와 금화를 비춰 보입니다.",
    smuggler: "외눈박이 밀수꾼이 코트를 펼쳐 진귀한 물건을 보여줍니다.",
  };
  let choices = "";
  if (room === "mystery") choices = `<button data-action="special-safe"><b>조심스럽게 열기</b><small>기초 원료 1개 · 안전</small></button><button data-action="special-gamble"><b>자물쇠 부수기</b><small>60%: 고급 유물 + 50G / 실패: 체력 -15 · 불순물 2장</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
  else if (room === "greenhouse") choices = `<button data-action="special-heal"><b>새벽 이슬 마시기</b><small>완전 회복 · 최대 체력 +5</small></button><button data-action="special-cleanse"><b>약초 흙으로 정제</b><small>덱의 모든 불순물 영구 소멸</small></button>`;
  else if (room === "curse_pit") choices = `<button data-action="special-reach"><b>심연 깊숙이 손 넣기</b><small>최대 체력 -10 · 보스급 전리품</small></button><button data-action="special-endure"><b>독성 증기 견디기</b><small>다음 전투 부식 2 · 50G</small></button><button data-action="special-flee"><b>도망치기</b><small>안전하게 빠져나가기</small></button>`;
  else if (room === "lab") choices = `<div class="lab-block"><h2>노트 치환</h2><p>카드의 새 노트를 선택하세요.</p>${run.deck.map((card, i) => `<div class="lab-card-row"><span>${CARDS[card.id].name} <small>${(card.note || CARDS[card.id].note).toUpperCase()}</small></span>${["top", "middle", "base"].map((note) => `<button data-action="lab-note" data-index="${i}" data-note="${note}">${note.toUpperCase()}</button>`).join("")}</div>`).join("")}</div><div class="lab-block"><h2>용매 세척 · 20G</h2>${run.deck.map((card, i) => `<button data-action="lab-remove" data-index="${i}" ${run.gold < 20 || run.deck.length <= 5 ? "disabled" : ""}>${CARDS[card.id].name} 영구 제거</button>`).join("")}</div>`;
  else if (room === "mercury_still") choices = `<button data-action="special-overload"><b>수은 밸브 강제 개방</b><small>턴 시작 AP +1 · 매 턴 체력 -2</small></button><button data-action="special-purify"><b>정제 증기 채취</b><small>안전하게 30골드 획득</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
  else if (room === "blood_altar") choices = `<button data-action="special-sacrifice"><b>피의 영혼 계약</b><small>최대 체력의 40%만큼 현재 체력 희생 · 보스급 유물</small></button><button data-action="special-tribute" ${run.gold < 40 ? "disabled" : ""}><b>40골드 공양</b><small>고급 특성 1개</small></button><div class="lab-block"><h2>카드 1장 무료 소각</h2>${run.deck.map((card, i) => `<button data-action="special-cleanse_card" data-index="${i}" ${run.deck.length <= 5 ? "disabled" : ""}>${CARDS[card.id].name} 소각</button>`).join("")}</div><button data-action="special-skip"><b>계약 거절</b><small>아무 일 없이 통과</small></button>`;
  else if (room === "dice_altar") choices = `<button data-action="special-reroll"><b>운명의 주사위 굴리기</b><small>고급 전리품 · 30% 확률로 불순물 1장</small></button><button data-action="special-charm"><b>행운의 부적 챙기기</b><small>체력 15 회복 · 25골드</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
  else if (room === "purify_furnace") choices = `<button data-action="special-burn_two" ${run.deck.length <= 5 ? "disabled" : ""}><b>화로에 몸 던지기</b><small>체력 -14 · 덱 앞쪽 카드 최대 2장 소멸</small></button><button data-action="special-flame_power"><b>화염 흡수</b><small>영구 공격력 +3 · 매 전투 첫 턴 연소 2</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
  else if (room === "mirror_doppel") choices = `<div class="lab-block"><h2>카드 복제 · 체력 -10</h2>${run.deck.map((card, i) => { const blocked = run.deck.length >= E.deckLimit(run) || run.deck.filter((held) => held.id === card.id).length >= E.cardMaxCopies(card.id); return `<button data-action="special-duplicate" data-index="${i}" ${blocked ? "disabled" : ""}>${CARDS[card.id].name} 복제</button>`; }).join("")}</div><button data-action="special-gold_double"><b>거울 속 금화 털기</b><small>현재 골드의 30% 추가 획득</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
  else if (room === "smuggler") choices = `<button data-action="special-contraband" ${run.gold < 40 ? "disabled" : ""}><b>밀수품 상자 구매 · 40G</b><small>보스급 유물 1개</small></button><button data-action="special-blood_trade"><b>생명력 물물교환</b><small>최대 체력 -10 · 고급 특성 1개</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
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
function render() {
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
    return;
  }
  $("app").innerHTML =
    hud() +
    `<div class="play-layout">${statsPanel()}<div class="play-content">${content()}</div>${acquiredPanel()}</div>`;
  syncBattleStateFrame();
  mountGoldStat();
  mountDeckCapacity();
  restoreViewScroll(scrollSnapshot);
  animateTurnOrderTransition(turnOrderLayout);
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
function playContactHitSound(strong = false, superStrong = false) {
  if (superStrong && typeof SFX.superContactHit === "function")
    SFX.superContactHit();
  else if (strong && typeof SFX.strongContactHit === "function")
    SFX.strongContactHit();
  else SFX.contactHit();
}
function showHitFeedback(
  amount,
  targetIndex = null,
  attackPattern = null,
  strong = false,
  superStrong = false,
  brokeThroughShield = false,
) {
  const enemy = enemyElement(targetIndex);
  if (!enemy || amount <= 0) return;
  if (
    attackPattern === "contact" &&
    brokeThroughShield &&
    superStrong
  )
    SFX.barrierBreakSuperContactHit();
  else if (
    attackPattern === "contact" &&
    brokeThroughShield &&
    strong &&
    !superStrong
  )
    SFX.barrierBreakStrongContactHit();
  else if (
    attackPattern === "contact" &&
    brokeThroughShield &&
    !strong &&
    !superStrong
  )
    SFX.barrierBreakContactHit();
  else if (attackPattern === "contact")
    playContactHitSound(strong, superStrong);
  else if (attackPattern === "nonContact") SFX.nonContactHit();
  for (const animation of enemy.getAnimations()) {
    if (
      animation.animationName === "enemy-hit" ||
      animation.animationName === "enemy-hit-strong"
    )
      animation.cancel();
  }
  enemy.classList.remove("enemy-hit", "enemy-hit-strong");
  enemy.classList.add(strong ? "enemy-hit-strong" : "enemy-hit");
  const popup = document.createElement("strong");
  popup.className = `damage-pop${strong ? " damage-pop-strong" : ""}`;
  popup.textContent = `-${number(amount)}`;
  popup.setAttribute("aria-label", `${number(amount)} 피해`);
  enemy.append(popup);
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
}
function showWeakContactImpact(targetIndex = null) {
  const enemy = enemyElement(targetIndex);
  if (!enemy) return;
  const impact = document.createElement("span");
  impact.className = "weak-contact-impact";
  impact.setAttribute("aria-hidden", "true");
  impact.innerHTML = `${"<span></span>".repeat(2)}${"<i></i>".repeat(8)}`;
  enemy.append(impact);
  impact.addEventListener("animationend", () => impact.remove(), { once: true });
}
function showStrongContactImpact(targetIndex = null) {
  const enemy = enemyElement(targetIndex),
    battle = document.querySelector(".battle");
  if (!enemy) return;
  const impact = document.createElement("span");
  impact.className = "strong-contact-impact";
  impact.setAttribute("aria-hidden", "true");
  impact.innerHTML = `${"<span></span>".repeat(3)}${"<i></i>".repeat(12)}`;
  enemy.append(impact);
  impact.addEventListener(
    "animationend",
    (event) => {
      if (event.target === impact) impact.remove();
    },
    { once: true },
  );
  if (battle) {
    for (const animation of battle.getAnimations()) {
      if (animation.animationName === "strong-contact-screen-shake")
        animation.cancel();
    }
    battle.classList.remove("strong-contact-shake");
    battle.classList.add("strong-contact-shake");
    setTimeout(() => battle.classList.remove("strong-contact-shake"), 460);
  }
}
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
function placeBattleOverlay(overlay, battle) {
  const bounds = battle.getBoundingClientRect();
  Object.assign(overlay.style, {
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  });
  document.body.append(overlay);
}
function syncBattleStateFrame() {
  const battle = document.querySelector(".battle"),
    previous = document.querySelector(".battle-state-frame"),
    active = battle && (battle.classList.contains("health-critical") || battle.classList.contains("enraged"));
  if (!active) {
    previous?.remove();
    return;
  }
  const frame = previous || document.createElement("span");
  frame.className = `battle-state-frame${battle.classList.contains("health-critical") ? " health-critical" : ""}${battle.classList.contains("enraged") ? " enraged" : ""}`;
  frame.setAttribute("aria-hidden", "true");
  placeBattleOverlay(frame, battle);
}
function showBattleShieldOverlay(type) {
  const battle = document.querySelector(".battle");
  if (!battle) return;
  document.querySelector(`.battle-shield-overlay.${type}`)?.remove();
  const overlay = document.createElement("span");
  overlay.className = `battle-shield-overlay ${type}`;
  overlay.setAttribute("aria-hidden", "true");
  placeBattleOverlay(overlay, battle);
  overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
  window.setTimeout(() => overlay.remove(), 950);
}
function showPlayerDamage(
  amount,
  attackPattern = null,
  strong = false,
  superStrong = false,
  playHurtSound = true,
) {
  const battle = document.querySelector(".battle"),
    stats = document.querySelector(".combat-stats"),
    health = document.querySelector(".stat-row:first-child");
  if (!battle || !stats || amount <= 0) return;
  if (attackPattern === "contact") playContactHitSound(strong, superStrong);
  else if (attackPattern === "nonContact") SFX.nonContactHit();
  if (playHurtSound) {
    if (superStrong) SFX.playerSuperHit();
    else if (strong) SFX.playerStrongHit();
    else SFX.playerHit();
  }
  for (const animation of battle.getAnimations()) {
    if (
      animation.animationName === "player-hit" ||
      animation.animationName === "player-contact-hit-strong"
    )
      animation.cancel();
  }
  battle.classList.remove("player-hit", "player-hit-strong");
  battle.classList.add(strong ? "player-hit-strong" : "player-hit");
  document.querySelector(".battle-hit-wash")?.remove();
  const hitWash = document.createElement("span");
  hitWash.className = "battle-hit-wash";
  hitWash.setAttribute("aria-hidden", "true");
  placeBattleOverlay(hitWash, battle);
  hitWash.addEventListener("animationend", () => hitWash.remove(), {
    once: true,
  });
  for (const [host, className] of [
    [stats, "player-damage-pop"],
    [health, "health-damage-pop"],
  ]) {
    if (!host) continue;
    const popup = document.createElement("strong");
    popup.className = `${className}${strong ? " player-damage-strong" : ""}`;
    popup.textContent = `-${number(amount)}`;
    popup.setAttribute("aria-label", `${number(amount)} 체력 피해`);
    host.append(popup);
    popup.addEventListener("animationend", () => popup.remove(), {
      once: true,
    });
  }
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
  for (const [index, trigger] of triggers.entries()) {
    const popup = document.createElement("strong");
    popup.className = `harmony-effect harmony-effect-${trigger.visual || "default"}`;
    popup.textContent = trigger.label || "HARMONY!";
    popup.setAttribute("role", "alert");
    popup.style.setProperty("--harmony-order", index);
    effectsLayer().append(popup);
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
  }
}
function showStatusDamage(hit, index = 0) {
  const definition =
    STATUS_DEFINITIONS[hit.statusId] ||
    (hit.statusId === "shufflePenalty"
      ? { name: "셔플 반동", color: "#caa8ff" }
      : null);
  if (!definition || hit.amount <= 0) return;
  const color = definition.color,
    delay = index * 190,
    slot = index % 3;
  setTimeout(() => {
    if (hit.target === "player") showPlayerStatusSmoke(color);
    const hosts =
      hit.target === "enemy"
        ? [
            [
              enemyElement(hit.targetIndex),
              "status-damage-pop enemy-status-damage",
            ],
          ]
        : [
            [
              document.querySelector(".battle"),
              "status-damage-pop player-status-damage",
            ],
            [
              document.querySelector(".stat-row:first-child"),
              "status-damage-pop health-status-damage",
            ],
          ];
    for (const [host, className] of hosts) {
      if (!host) continue;
      const popup = document.createElement("strong");
      popup.className = className;
      popup.style.setProperty("--status-damage-color", color);
      popup.style.setProperty("--damage-x", `${(slot - 1) * 58}px`);
      popup.style.setProperty("--damage-y", `${slot * 16}px`);
      popup.innerHTML = `<small>${definition.name}</small>-${number(hit.amount)}`;
      popup.setAttribute(
        "aria-label",
        `${definition.name}으로 ${number(hit.amount)} 피해`,
      );
      host.append(popup);
      popup.addEventListener("animationend", () => popup.remove(), {
        once: true,
      });
    }
  }, delay);
}
function showPlayerStatusSmoke(color) {
  const panel = document.querySelector(".player-stats");
  if (!panel) return;
  const smoke = document.createElement("span");
  smoke.className = "player-status-smoke";
  smoke.style.setProperty("--status-smoke-color", color);
  smoke.setAttribute("aria-hidden", "true");
  smoke.innerHTML = "<i></i>".repeat(12);
  panel.append(smoke);
  smoke.addEventListener("animationend", (event) => {
    if (event.target === smoke) smoke.remove();
  });
  window.setTimeout(() => smoke.remove(), 1400);
}
function showEnemyDebuffSmoke(statusIds = []) {
  const battle = document.querySelector(".battle"),
    uniqueStatusIds = [...new Set(statusIds)];
  if (!battle || !uniqueStatusIds.length) return;
  uniqueStatusIds.forEach((statusId, index) => {
    const definition = STATUS_DEFINITIONS[statusId];
    if (!definition) return;
    window.setTimeout(() => {
      if (!document.body.contains(battle)) return;
      const smoke = document.createElement("span");
      smoke.className = "enemy-debuff-smoke";
      smoke.style.setProperty("--debuff-smoke-color", definition.color);
      smoke.setAttribute("aria-hidden", "true");
      smoke.innerHTML = "<i></i>".repeat(20 + Math.floor(Math.random() * 6));
      for (const particle of smoke.children) {
        const fromLeft = Math.random() < .5;
        particle.style.setProperty("--smoke-x", `${8 + Math.random() * 84}%`);
        particle.style.setProperty("--smoke-size", `${80 + Math.random() * 75}px`);
        particle.style.setProperty("--smoke-enter-x", `${fromLeft ? -55 - Math.random() * 40 : 55 + Math.random() * 40}px`);
        particle.style.setProperty("--smoke-drift", `${fromLeft ? 18 + Math.random() * 30 : -18 - Math.random() * 30}px`);
        particle.style.setProperty("--smoke-rise", `${125 + Math.random() * 80}px`);
        particle.style.setProperty("--smoke-delay", `${Math.random() * .22}s`);
        particle.style.setProperty("--smoke-duration", `${.72 + Math.random() * .3}s`);
      }
      placeBattleOverlay(smoke, battle);
      window.setTimeout(() => smoke.remove(), 1400);
    }, index * 130);
  });
}
function showStatusDamageQueue(hits) {
  hits.forEach(showStatusDamage);
  return hits.length
    ? new Promise((resolve) =>
        setTimeout(resolve, Math.min(700, 130 + hits.length * 190)),
      )
    : Promise.resolve();
}
function showPlayerHealing(amount) {
  const health = document.querySelector(".stat-row:first-child"),
    battle = document.querySelector(".battle");
  if (!health || amount <= 0) return;
  SFX.heal();
  health.classList.remove("player-healing");
  void health.offsetWidth;
  health.classList.add("player-healing");
  const effect = document.createElement("span");
  effect.className = "healing-effect";
  effect.setAttribute("aria-label", `${number(amount)} 체력 회복`);
  effect.innerHTML = `<i class="healing-mist healing-mist-a"></i><i class="healing-mist healing-mist-b"></i><strong>+${number(amount)}</strong>`;
  health.append(effect);
  effect
    .querySelector("strong")
    .addEventListener("animationend", () => effect.remove(), { once: true });
  if (battle) {
    document.querySelector(".battle-healing-mist")?.remove();
    const borderMist = document.createElement("span");
    borderMist.className = "battle-healing-mist";
    borderMist.setAttribute("aria-hidden", "true");
    placeBattleOverlay(borderMist, battle);
    borderMist.addEventListener("animationend", () => borderMist.remove(), {
      once: true,
    });
  }
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
) {
  if (reducedMotion) return () => {};
  const dimmer = document.createElement("span"),
    focus = document.createElement("span"),
    sourceX = sourceRect.left + sourceRect.width / 2,
    sourceY = sourceRect.top + sourceRect.height / 2,
    targetX = targetRect.left + targetRect.width / 2,
    targetY = targetRect.top + targetRect.height / 2;
  dimmer.className = "strong-attack-dimmer";
  focus.className = "strong-attack-focus";
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
  if (reducedMotion) return () => {};
  const charge = document.createElement("span");
  charge.className = "super-attack-charge";
  charge.setAttribute("aria-hidden", "true");
  charge.style.left = `${sourceRect.left + sourceRect.width / 2}px`;
  charge.style.top = `${sourceRect.top + sourceRect.height / 2}px`;
  for (let index = 0; index < 12; index++) {
    const ray = document.createElement("i");
    ray.style.setProperty("--charge-angle", `${index * 30}deg`);
    ray.style.setProperty("--charge-delay", `${-(index % 12) * .046}s`);
    ray.style.setProperty("--charge-distance", `${205 + (index % 5) * 18}px`);
    ray.style.setProperty("--charge-length", `${78 + (index % 6) * 11}px`);
    charge.append(ray);
  }
  document.body.append(charge);
  const tracking = charge.animate(
    [
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
    reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
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
  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
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
  const cardRect = card.getBoundingClientRect(),
    targetRect = target.getBoundingClientRect(),
    offsetX = targetRect.left + targetRect.width / 2 - (cardRect.left + cardRect.width / 2),
    offsetY = targetRect.top + targetRect.height / 2 - (cardRect.top + cardRect.height / 2),
    distance = Math.hypot(offsetX, offsetY) || 1,
    pullbackX = (-offsetX / distance) * 34,
    pullbackY = (-offsetY / distance) * 34,
    chargeRotation = Math.max(-7, Math.min(7, offsetX / 55)),
    clone = card.cloneNode(true),
    reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
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
            { transform: "translate3d(0, 0, 0) scale(1)", offset: 0, easing: "ease-out" },
            { transform: "translate3d(0, -18px, 0) scale(1.03)", offset: 0.28, easing: "ease-in-out" },
            { transform: `translate3d(${pullbackX}px, ${pullbackY - 18}px, 0) rotate(${-chargeRotation}deg) scale(.97)`, offset: 0.64, easing: "ease-in" },
            { opacity: 1, transform: `translate3d(${pullbackX * 1.08}px, ${pullbackY * 1.08 - 18}px, 0) rotate(${-chargeRotation * 1.2}deg) scale(.93)`, offset: 0.72, easing: "cubic-bezier(.12,.75,.18,1)" },
            { opacity: 0, transform: `translate3d(${offsetX}px, ${offsetY}px, 0) rotate(${chargeRotation * 0.45}deg) scale(.04)`, offset: 1 },
          ],
      {
        duration: reducedMotion ? 120 : 620,
        easing: "linear",
        fill: "forwards",
      },
    );
    await motion.finished.catch(() => {});
    clone.style.opacity = "0";
    onImpact?.();
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
  const cardRect = card.getBoundingClientRect(),
    targetRect = target.getBoundingClientRect(),
    offsetX = targetRect.left + targetRect.width / 2 - (cardRect.left + cardRect.width / 2),
    offsetY = targetRect.top + targetRect.height / 2 - (cardRect.top + cardRect.height / 2),
    distance = Math.hypot(offsetX, offsetY) || 1,
    pullbackX = (-offsetX / distance) * 58,
    pullbackY = (-offsetY / distance) * 58,
    chargeRotation = Math.max(-10, Math.min(10, offsetX / 42)),
    clone = card.cloneNode(true),
    reducedMotion = false;
  clone.classList.remove("card-discarding");
  clone.classList.add("contact-attack-card", "strong-contact-attack-card");
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
  const attackDuration = superStrong ? 1480 : 780,
    endFocus = beginStrongAttackFocus(
      cardRect,
      targetRect,
      reducedMotion,
      attackDuration,
      pullbackX,
      pullbackY,
    );
  const endCharge = superStrong
    ? beginSuperAttackCharge(
        cardRect,
        reducedMotion,
        pullbackX,
        pullbackY,
        attackDuration,
      )
    : () => {};
  let launchTimer = null;
  try {
    const motion = clone.animate(
      reducedMotion
        ? [
            { transform: "translate3d(0, 0, 0) scale(1)" },
            { opacity: 0, transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(.04)` },
          ]
        : [
            { transform: "translate3d(0, 0, 0) scale(1)", offset: 0 },
            { transform: "translate3d(0, -10px, 0) scale(1.04)", offset: 0.18 },
            { transform: `translate3d(${pullbackX}px, ${pullbackY - 10}px, 0) rotate(${-chargeRotation}deg) scale(.95)`, offset: 0.48 },
            { transform: `translate3d(${pullbackX - 3}px, ${pullbackY - 11}px, 0) rotate(${-chargeRotation - 1.5}deg) scale(.92)`, offset: 0.54 },
            { transform: `translate3d(${pullbackX + 3}px, ${pullbackY - 9}px, 0) rotate(${-chargeRotation + 1.5}deg) scale(.94)`, offset: 0.6 },
            { opacity: 1, transform: `translate3d(${pullbackX}px, ${pullbackY - 10}px, 0) rotate(${-chargeRotation}deg) scale(1.1)`, offset: 0.7, easing: "cubic-bezier(.08,.8,.16,1)" },
            { opacity: 0, transform: `translate3d(${offsetX}px, ${offsetY}px, 0) rotate(${chargeRotation * 0.3}deg) scale(.04)`, offset: 1 },
          ],
      { duration: reducedMotion ? 130 : attackDuration, easing: "linear", fill: "forwards" },
    );
    if (superStrong && onLaunch)
      launchTimer = window.setTimeout(onLaunch, attackDuration * 0.7);
    await motion.finished.catch(() => {});
    clone.style.opacity = "0";
    onImpact?.();
  } catch {
    // If the Web Animations API is unavailable, continue without blocking play.
  } finally {
    if (launchTimer !== null) window.clearTimeout(launchTimer);
    endCharge();
    endFocus();
    // Keep the consumed source hidden until the action handler removes it.
    clone.remove();
  }
}
function randomPlayerImpactPoint() {
  const player = document.querySelector(".player-stats");
  if (!player) return null;
  const bounds = player.getBoundingClientRect(),
    insetX = Math.min(42, bounds.width * .18),
    insetY = Math.min(48, bounds.height * .16);
  return {
    x: bounds.left + insetX + Math.random() * Math.max(1, bounds.width - insetX * 2),
    y: bounds.top + insetY + Math.random() * Math.max(1, bounds.height - insetY * 2),
  };
}
function showPlayerContactImpact(strong = false, point = null) {
  const player = document.querySelector(".player-stats"),
    battle = document.querySelector(".battle");
  if (!player) return;
  point ||= randomPlayerImpactPoint();
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
  const healthValue = document.querySelector(".stat-row:first-child b"),
    shieldValue = document.querySelector(
      ".combat-stats .combat-term:nth-child(2) b",
    );
  if (healthValue?.firstChild)
    healthValue.firstChild.nodeValue = `${Math.max(0, hp)} / ${maxHp}`;
  if (shieldValue) shieldValue.textContent = Math.max(0, shield);
}
async function animateEnemyContactAttack(enemy, strong, superStrong, onImpact) {
  const target = document.querySelector(".player-stats");
  if (!enemy || !target) return;
  const enemyVisual = enemy.querySelector(".enemy-visual") || enemy,
    enemyRect = enemyVisual.getBoundingClientRect(),
    impactPoint = randomPlayerImpactPoint(),
    targetRect = { left: impactPoint.x, top: impactPoint.y, width: 0, height: 0 },
    offsetX = impactPoint.x - (enemyRect.left + enemyRect.width / 2),
    offsetY = impactPoint.y - (enemyRect.top + enemyRect.height / 2),
    distance = Math.hypot(offsetX, offsetY) || 1,
    pullback = strong ? 52 : 30,
    pullbackX = (-offsetX / distance) * pullback,
    pullbackY = (-offsetY / distance) * pullback,
    clone = enemyVisual.cloneNode(true),
    reducedMotion = superStrong
      ? false
      : window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
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
async function showEnemyHitQueue(hits, waitForFinalHit = false) {
  const visibleHits = hits.filter((hit) =>
    Boolean(hit.blocked || (hit.damage && !hit.statusId)),
  );
  for (let index = 0; index < visibleHits.length; index++) {
    const hit = visibleHits[index];
    if (hit.blocked)
      showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage);
    if (hit.damage && !hit.statusId)
      showHitFeedback(
        hit.damage,
        hit.targetIndex,
        hit.attackPattern,
        false,
        false,
        Boolean(hit.blocked),
      );
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
async function handleEndTurn() {
  if (cardAnimating || run?.phase !== "battle" || run.battle.enemyPhase) return;
  cardAnimating = true;
  let playerTookStatusDamage = false;
  delete run._enemyHitFeedback;
  delete run._drawFeedback;
  delete run._shuffleFeedback;
  if (!E.executePlayerTurnEnd(run, meta)) {
    cardAnimating = false;
    return;
  }
  const absorbGained = run._absorbFeedback || 0;
  const absorbLost = run._absorbLossFeedback || 0;
  delete run._absorbFeedback;
  delete run._absorbLossFeedback;
  save();
  render();
  if (absorbLost) {
    showAbsorbLoss(absorbLost);
    await sleep(180);
  }
  if (absorbGained) showAbsorbGain(absorbGained);
  await sleep(180);
  for (let index = 0; index < run.battle.enemies.length; index++) {
    if (run.battle.enemies[index].hp <= 0) continue;
    run.battle.actingEnemy = index;
    render();
    await sleep(140);
    const enemyBoxBeforeAction = document.querySelector(
        `.enemy[data-target="${index}"]`,
      ),
      playerHpBeforeAction = run.hp,
      playerShieldBeforeAction = run.battle.shield;
    const outcome = E.executeSingleEnemyAction(run, index, meta);
    if (!outcome) break;
    let enemyAttackAnimated = false;
    if (
      outcome.type === "attack" &&
      outcome.attackPattern === "contact" &&
      outcome.hits.length
    ) {
      const strongAttack = outcome.hits.some(
          (hit) => hit.damage + hit.blocked >= 20,
        ),
        visualPlayer = {
          hp: playerHpBeforeAction,
          shield: playerShieldBeforeAction,
        },
        showEnemyStrike = (hit, impactPoint = randomPlayerImpactPoint()) => {
          const impactDamage = hit.damage + hit.blocked,
            strongHit = impactDamage >= 20;
          visualPlayer.shield = Math.max(0, visualPlayer.shield - hit.blocked);
          visualPlayer.hp = Math.max(0, visualPlayer.hp - hit.damage);
          updatePlayerHealthFeedback(
            visualPlayer.hp,
            run.maxHp,
            visualPlayer.shield,
          );
          showPlayerContactImpact(strongHit, impactPoint);
          if (hit.blocked) {
            showShieldBlock(hit.blocked, !hit.damage);
            showPlayerImpactShieldBlock(hit.blocked, impactPoint, !hit.damage);
          }
          if (hit.damage)
            showPlayerDamage(
              hit.damage,
              outcome.attackPattern,
              strongHit,
              impactDamage >= 30,
            );
        };
      await animateEnemyContactAttack(
        enemyBoxBeforeAction,
        strongAttack,
        outcome.hits[0].damage + outcome.hits[0].blocked >= 30,
        (impactPoint) => showEnemyStrike(outcome.hits[0], impactPoint),
      );
      for (const hit of outcome.hits.slice(1)) {
        await sleep(hit.damage + hit.blocked >= 20 ? 190 : 150);
        showEnemyStrike(hit);
      }
      await sleep(outcome.hits.length > 1 ? 300 : strongAttack ? 240 : 170);
      enemyAttackAnimated = true;
    }
    if (run.phase !== "battle" || outcome.playerDied) {
      if (outcome.playerDied)
        await showPlayerDeath(enemyAttackAnimated ? 0 : outcome.damage);
      save();
      render();
      cardAnimating = false;
      return;
    }
    run.battle.actingEnemy = index;
    render();
    const enemyBox = document.querySelector(`.enemy[data-target="${index}"]`);
    if (outcome.type === "attack") {
      if (!enemyAttackAnimated) enemyBox?.classList.add("enemy-attack-lunge");
      showEnemyActionPopup(
        index,
        outcome.damage
          ? `공격! -${outcome.damage}`
          : `방어됨 ${outcome.blocked}`,
        "attack-popup",
      );
      if (outcome.blocked && !enemyAttackAnimated)
        showShieldBlock(outcome.blocked, !outcome.damage);
      if (outcome.damage && !enemyAttackAnimated)
        showPlayerDamage(outcome.damage, outcome.attackPattern);
    } else if (outcome.type === "guard") {
      enemyBox?.classList.add("enemy-guard-pulse");
      showEnemyActionPopup(
        index,
        `방어막 +${outcome.shieldGained}`,
        "guard-popup",
      );
    } else if (outcome.type === "pollute") {
      showEnemyActionPopup(
        index,
        `불순물 +${outcome.impurities}${outcome.shieldGained ? ` · 방어막 +${outcome.shieldGained}` : ""}`,
        "pollute-popup",
      );
    } else if (outcome.type === "debuff") {
      showEnemyActionPopup(index, "상태이상 부여", "control-popup");
    } else {
      showEnemyActionPopup(
        index,
        outcome.type === "stun" ? "기절! 행동 불가" : "무장 해제! 행동 불가",
        "control-popup",
      );
    }
    showEnemyDebuffSmoke(outcome.playerDebuffs);
    const statusHits = run._damageFeedback || [],
      enemyHits = run._enemyHitFeedback || [];
    if (statusHits.some((hit) => hit.target === "player" && hit.amount > 0))
      playerTookStatusDamage = true;
    delete run._damageFeedback;
    delete run._enemyHitFeedback;
    for (const hit of enemyHits) {
      if (hit.blocked)
        showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage);
      if (hit.damage && !hit.statusId)
        showHitFeedback(
          hit.damage,
          hit.targetIndex,
          hit.attackPattern,
          false,
          false,
          Boolean(hit.blocked),
        );
    }
    showStatusDamageQueue(statusHits);
    await sleep(420);
    if (run.phase !== "battle") break;
    run.battle.actingEnemy = null;
    save();
  }
  if (run.phase === "battle") {
    const beforeRoundHp = run.hp,
      beforeRoundEnemies = run.battle.enemies.map((enemy, index) => ({
        index,
        hp: enemy.hp,
        material: enemy.material || ENEMIES[enemy.id]?.material,
      }));
    E.executeRoundEnd(run, meta);
    const statusHits = run._damageFeedback || [],
      enemyHits = run._enemyHitFeedback || [],
      enrageHit = run._enrageFeedback?.damage || 0,
      drawn = run.phase === "battle" ? run._drawFeedback || 0 : 0,
      shuffled = run.phase === "battle" ? run._shuffleFeedback || 0 : 0,
      roundKilledMonsters = beforeRoundEnemies.filter(
        (enemy) =>
          enemy.hp > 0 && (run.battle?.enemies[enemy.index]?.hp ?? 0) <= 0,
      );
    if (statusHits.some((hit) => hit.target === "player" && hit.amount > 0))
      playerTookStatusDamage = true;
    delete run._damageFeedback;
    delete run._enemyHitFeedback;
    delete run._enrageFeedback;
    delete run._drawFeedback;
    delete run._shuffleFeedback;
    if (beforeRoundHp > 0 && run.hp <= 0 && run.phase === "result") {
      await showStatusDamageQueue(statusHits);
      await showPlayerDeath(
        statusHits
          .filter((hit) => hit.target === "player")
          .reduce((sum, hit) => sum + hit.amount, 0) || enrageHit,
      );
      save();
      render();
      cardAnimating = false;
      return;
    }
    if (
      roundKilledMonsters.length &&
      run.phase === "reward" &&
      run.battle.enemies.every((enemy) => enemy.hp <= 0)
    ) {
      await showEnemyHitQueue(enemyHits);
      await showStatusDamageQueue(statusHits);
      await showMonsterDeath(roundKilledMonsters);
      save();
      render();
      cardAnimating = false;
      return;
    }
    save();
    render();
    stageDrawFeedback(drawn);
    if (shuffled) await showShuffleFeedback(shuffled);
    if (drawn) await showDrawFeedback(drawn);
    for (const hit of enemyHits) {
      if (hit.blocked)
        showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage);
      if (hit.damage && !hit.statusId)
        showHitFeedback(
          hit.damage,
          hit.targetIndex,
          hit.attackPattern,
          false,
          false,
          Boolean(hit.blocked),
        );
    }
    await showStatusDamageQueue(statusHits);
    if (playerTookStatusDamage) SFX.playerStatusHit();
    if (enrageHit) showEnrageDamage(enrageHit);
  }
  cardAnimating = false;
}
let startingDeckSelection = [];
let startingDeckCategory = null;
let startingDeckFilter = "all";
let attackDeckFilters = { target: "any", traits: new Set(), statuses: new Set() };
let startingDeckTestMode = false;
let startingItemSelection = [];
let startingBuilderContent = "cards";
const startingDeckCategories = [
  { id: "attack", name: "공격", icon: "⚔", description: "피해와 상태 이상으로 적을 제압하세요." },
  { id: "defense", name: "방어", icon: "◇", description: "방어막과 반격으로 적의 공격을 버티세요." },
  { id: "absorb", name: "흡수", icon: "◉", description: "흡수를 모아 조향의 힘을 준비하세요." },
  { id: "heal", name: "회복", icon: "✚", description: "체력을 회복하고 위기에서 전열을 가다듬으세요." },
];
const startingItemCategories = [
  { id: "stat", name: "능력치", icon: "◆", description: "공격·방어·회복과 자원 수치를 직접 조정합니다." },
  { id: "trait", name: "특성", icon: "✦", description: "조건과 행동에 반응하는 지속 효과입니다." },
  { id: "relic", name: "유물", icon: "◇", description: "전투 규칙을 바꾸는 핵심 패시브입니다." },
  { id: "curse", name: "저주", icon: "▼", description: "불리한 능력치와 자원 패널티를 시험합니다." },
];
const testDeckFilters = [
  ["all", "전체"], ["contact", "접촉"], ["nonContact", "비접촉"],
  ["top", "TOP"], ["middle", "MIDDLE"], ["base", "BASE"],
  ["tier-1", "1티어"], ["tier-2", "2티어"], ["tier-3", "3티어"], ["tier-4", "4티어"],
];
const attackTraitFilters = [
  ["multi-hit", "⋙", "연타"],
  ["shield-pierce", "⟐", "관통"],
  ["turn-scaling", "◷", "턴 비례"],
  ["shield-scaling", "⬡", "방어막 참조"],
  ["oil", "◉", "오일"],
];
function cardClassificationTags(card) {
  const tags = new Set(),
    statusIds = [
      ...Object.keys(card.applyEnemy || {}),
      ...Object.keys(card.applyPlayer || {}),
      ...Object.keys(card.applyEnemyAfterAttack || {}),
      ...Object.keys(card.onHitApplyEnemy || {}),
      ...Object.keys(card.absorbThresholdApplyAllEnemy || {}),
      ...Object.keys(card.thornsApplyAttacker || {}),
      ...Object.values(card.conditionalEnemyIntent || {}).flatMap((statuses) => Object.keys(statuses)),
      ...(card.chanceStatusOnHit ? [card.chanceStatusOnHit.id] : []),
      ...(card.intimidate || card.intimidateOnHit ? ["intimidated"] : []),
      ...(card.stunOrDisarmBossTurns ? ["stun", "disarm"] : []),
      ...(card.id === "burst_spatial_diffusion" ? ["stun"] : []),
      ...Object.keys(card.bonusPerStatus || {}),
      ...(card.consumeResonance ? ["resonance"] : []),
      ...(card.detonateBurning ? ["burning"] : []),
      ...((card.dotBurstMultiplier || card.globalDotBurstMultiplier || card.amplifyDots)
        ? ["burning", "poison", "bleed", "corrosion"]
        : []),
    ];
  tags.add(card.target === "all" ? "target-all" : card.randomEachHit || card.target === "random" ? "target-ricochet" : "target-single");
  if (card.hits > 1) tags.add("multi-hit");
  if (card.bypassShield || card.thresholdBypassShield) tags.add("shield-pierce");
  if (card.turnDamageBonus) tags.add("turn-scaling");
  if (card.shieldScaling) tags.add("shield-scaling");
  if (card.oil) tags.add("oil");
  for (const id of statusIds) tags.add(`status-${id}`);
  return tags;
}
function startingCardCategory(card) {
  if (["attack", "defense", "absorb", "heal"].includes(card.category)) return card.category;
  return card.attack || card.burst || card.weight ? "attack"
    : card.heal || card.missingHpHealRatio ? "heal"
      : card.shield ? "defense" : "absorb";
}
function validStartingDeck(ids) {
  if (!Array.isArray(ids) || ids.length !== 10) return false;
  const counts = {};
  for (const id of ids) {
    const card = CARDS[id];
    if (!card || card.tier !== 1) return false;
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] > card.maxCopies) return false;
  }
  return true;
}
function validTestDeck(ids) {
  return Array.isArray(ids) && ids.length > 0 && ids.every((id) => CARDS[id] && id !== "impurity");
}
function matchesTestDeckFilter(card) {
  if (startingDeckFilter === "all") return true;
  if (startingDeckFilter.startsWith("tier-")) return card.tier === Number(startingDeckFilter.slice(5));
  if (["top", "middle", "base"].includes(startingDeckFilter)) return card.note === startingDeckFilter;
  return card.attackPattern === startingDeckFilter;
}
function matchesAttackDeckFilters(card) {
  if (startingDeckCategory !== "attack") return true;
  const tags = cardClassificationTags(card);
  if (attackDeckFilters.target !== "any" && !tags.has(`target-${attackDeckFilters.target}`)) return false;
  if ([...attackDeckFilters.traits].some((tag) => !tags.has(tag))) return false;
  if ([...attackDeckFilters.statuses].some((id) => !tags.has(`status-${id}`))) return false;
  return true;
}
function startingDeckDialog() {
  let dialog = $("starting-deck-builder");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "starting-deck-builder";
  dialog.className = "starting-deck-builder";
  dialog.innerHTML = `<div class="dialog-head"><div><small id="builder-eyebrow">PERFUMER'S TRAVEL BAG</small><h2 id="builder-title">시작 덱 편성</h2></div><button data-builder-action="close">닫기</button></div><div id="builder-content-tabs" class="builder-content-tabs" hidden><button data-builder-action="content" data-content="cards">카드 덱</button><button data-builder-action="content" data-content="items">증강 · 아이템</button></div><section class="builder-catalog"><div class="builder-heading builder-navigation"><h3 id="builder-category-title" tabindex="-1">카드 선택</h3><button data-builder-action="back" hidden>← 카테고리로 돌아가기</button></div><div id="builder-filters" class="builder-filters" hidden></div><div id="builder-categories" class="builder-categories"></div><div id="builder-pool" class="builder-pool" hidden></div></section><section class="builder-tray"><div class="builder-heading"><h3>내 덱 <b id="builder-count"></b></h3><div><button id="builder-preset" data-builder-action="preset">기본 추천 덱 채우기</button><button data-builder-action="clear">전체 비우기</button></div></div><div id="builder-selected" class="builder-selected"></div><div id="builder-item-selection" hidden><div class="builder-heading"><h3>선택된 증강 <b id="builder-item-count"></b></h3><button data-builder-action="clear-items">증강 비우기</button></div><div id="builder-selected-items" class="builder-selected"></div></div><button id="builder-start" class="primary builder-start" data-builder-action="start"></button></section>`;
  document.body.append(dialog);
  dialog.addEventListener("click", (event) => {
    const button = event.target.closest("[data-builder-action]");
    if (!button) return;
    const action = button.dataset.builderAction, id = button.dataset.card;
    if (action === "close") dialog.close();
    else if (action === "content" && startingDeckTestMode) { startingBuilderContent = button.dataset.content; startingDeckCategory = null; }
    else if (action === "category" && (startingBuilderContent === "items" ? startingItemCategories : startingDeckCategories).some((category) => category.id === button.dataset.category)) {
      startingDeckCategory = button.dataset.category;
      startingDeckFilter = "all";
      attackDeckFilters = { target: "any", traits: new Set(), statuses: new Set() };
    }
    else if (action === "filter") startingDeckFilter = button.dataset.filter;
    else if (action === "attack-filter") {
      const group = button.dataset.filterGroup, value = button.dataset.filter;
      if (group === "target") attackDeckFilters.target = attackDeckFilters.target === value ? "any" : value;
      else if (group === "trait" || group === "status") {
        const selected = group === "trait" ? attackDeckFilters.traits : attackDeckFilters.statuses;
        selected.has(value) ? selected.delete(value) : selected.add(value);
      }
    }
    else if (action === "clear-attack-filters")
      attackDeckFilters = { target: "any", traits: new Set(), statuses: new Set() };
    else if (action === "back") { startingDeckCategory = null; startingDeckFilter = "all"; attackDeckFilters = { target: "any", traits: new Set(), statuses: new Set() }; }
    else if (action === "clear") startingDeckSelection = [];
    else if (action === "clear-items") startingItemSelection = [];
    else if (action === "preset") startingDeckSelection = startingDeckTestMode
      ? Object.values(CARDS).filter((card) => card.id !== "impurity").map((card) => card.id)
      : [...RECOMMENDED_STARTING_DECK];
    else if (action === "remove" && Number.isInteger(Number(button.dataset.index)))
      startingDeckSelection.splice(Number(button.dataset.index), 1);
    else if (action === "remove-item" && Number.isInteger(Number(button.dataset.index)))
      startingItemSelection.splice(Number(button.dataset.index), 1);
    else if (action === "add-item" && id && ITEMS[id]) {
      const count = startingItemSelection.filter((itemId) => itemId === id).length;
      if (count < ITEMS[id].maxOwned) startingItemSelection.push(id);
    }
    else if (action === "add" && id && (startingDeckTestMode || startingDeckSelection.length < 10)) {
      const count = startingDeckSelection.filter((cardId) => cardId === id).length;
      if (startingDeckTestMode || count < CARDS[id].maxCopies) startingDeckSelection.push(id);
    } else if (action === "start" && (startingDeckTestMode ? validTestDeck(startingDeckSelection) : validStartingDeck(startingDeckSelection))) {
      if (run && !run.finished) E.abandon(run, meta);
      if (!startingDeckTestMode) {
        meta.lastStartingDeck = [...startingDeckSelection];
        meta.discoveredCards ??= [];
        for (const cardId of startingDeckSelection)
          if (!meta.discoveredCards.includes(cardId)) meta.discoveredCards.push(cardId);
      }
      run = E.newRun(crypto.getRandomValues(new Uint32Array(1))[0], startingDeckSelection, meta);
      run.testMode = startingDeckTestMode;
      if (startingDeckTestMode)
        for (const itemId of startingItemSelection) E.addInventoryItem(run, itemId);
      started = true;
      dialog.close();
      save();
      render();
      return;
    }
    renderStartingDeckBuilder();
    if (action === "category" || action === "back") {
      $("builder-pool").scrollTop = 0;
      $("builder-category-title").focus();
    }
  });
  return dialog;
}
function renderStartingDeckBuilder() {
  const dialog = startingDeckDialog(),
    cards = startingDeckTestMode
      ? Object.values(CARDS).filter((card) => card.id !== "impurity")
      : getTier1Cards();
  dialog.classList.toggle("test-mode", startingDeckTestMode);
  $("builder-content-tabs").hidden = !startingDeckTestMode;
  for (const tab of dialog.querySelectorAll("[data-builder-action=content]"))
    tab.classList.toggle("active", tab.dataset.content === startingBuilderContent);
  $("builder-eyebrow").textContent = startingDeckTestMode ? "LOCAL CARD LAB" : "PERFUMER'S TRAVEL BAG";
  $("builder-title").textContent = startingDeckTestMode ? "카드 테스트 덱 편성" : "시작 덱 편성";
  $("builder-preset").textContent = startingDeckTestMode ? "모든 카드 1장씩 담기" : "기본 추천 덱 채우기";
  $("builder-count").textContent = startingDeckTestMode
    ? `(${startingDeckSelection.length}장 · 제한 없음)`
    : `(${startingDeckSelection.length} / 10장)`;
  const selectedCardGroups = [...new Set(startingDeckSelection)].map((id) => ({
    id,
    count: startingDeckSelection.filter((cardId) => cardId === id).length,
    removeIndex: startingDeckSelection.lastIndexOf(id),
  }));
  $("builder-selected").innerHTML = selectedCardGroups.length
    ? selectedCardGroups.map(({ id, count, removeIndex }) => `<article class="builder-deck-card${count > 1 ? " stacked" : ""}"><span class="builder-card-count">×${count}</span>${cardHtml({ id, level: 0 })}<button data-builder-action="remove" data-index="${removeIndex}"><span>−</span> 한 장 빼기</button></article>`).join("")
    : "<p>현재 덱은 0장입니다.<br>왼쪽 카드 선택 창에서 10장을 골라주세요.</p>";
  const showingItems = startingDeckTestMode && startingBuilderContent === "items";
  $("builder-selected").hidden = showingItems;
  $("builder-selected").previousElementSibling.hidden = showingItems;
  $("builder-item-selection").hidden = !showingItems;
  $("builder-item-count").textContent = `(${startingItemSelection.length}개)`;
  $("builder-selected-items").innerHTML = startingItemSelection.length
    ? startingItemSelection.map((id, index) => `<button data-builder-action="remove-item" data-index="${index}"><span>−</span><b>${ITEMS[id].name}</b></button>`).join("")
    : "<p>선택된 증강이 없습니다.</p>";
  const poolSection = $("builder-pool").parentElement;
  poolSection.querySelector(":scope > h3")?.remove();
  if (showingItems) {
    const category = startingItemCategories.find((entry) => entry.id === startingDeckCategory);
    $("builder-category-title").textContent = category ? `전체 티어 · ${category.name}` : "증강 종류 선택";
    dialog.querySelector('[data-builder-action="back"]').hidden = !category;
    $("builder-categories").hidden = !!category;
    $("builder-pool").hidden = !category;
    $("builder-filters").hidden = true;
    $("builder-categories").innerHTML = startingItemCategories.map((entry) => {
      const available = Object.values(TEST_ITEMS).filter((item) => item.kind === entry.id).length;
      const selected = startingItemSelection.filter((id) => ITEMS[id]?.kind === entry.id).length;
      return `<button class="builder-category builder-category-${entry.id}" data-builder-action="category" data-category="${entry.id}"><span aria-hidden="true">${entry.icon}</span><strong>${entry.name} →</strong><small>${entry.description}</small><b>${available}종 · 선택 ${selected}개</b></button>`;
    }).join("");
    const visibleItems = category ? Object.values(TEST_ITEMS).filter((item) => item.kind === category.id) : [];
    $("builder-pool").innerHTML = visibleItems.map((item) => {
      const count = startingItemSelection.filter((id) => id === item.id).length;
      return `<article>${itemHtml(item.id)}<button data-builder-action="add-item" data-card="${item.id}" ${count >= item.maxOwned ? "disabled" : ""}>선택 ${count}/${item.maxOwned}개 · 추가 +</button></article>`;
    }).join("") || (category ? `<p class="builder-empty">선택 가능한 ${category.name} 아이템이 없습니다.</p>` : "");
    const start = $("builder-start"), ready = validTestDeck(startingDeckSelection);
    start.disabled = !ready;
    start.textContent = `테스트 여정 시작 (카드 ${startingDeckSelection.length}장 · 증강 ${startingItemSelection.length}개)`;
    return;
  }
  const category = startingDeckCategories.find((entry) => entry.id === startingDeckCategory);
  $("builder-category-title").textContent = category
    ? `${startingDeckTestMode ? "전체 티어" : "1티어"} · ${category.name}`
    : "카테고리 선택";
  dialog.querySelector('[data-builder-action="back"]').hidden = !category;
  $("builder-categories").hidden = !!category;
  $("builder-pool").hidden = !category;
  $("builder-filters").hidden = !category || !startingDeckTestMode;
  const attackCards = cards.filter((card) => startingCardCategory(card) === "attack"),
    availableAttackStatuses = Object.entries(STATUS_DEFINITIONS)
      .map(([id, status]) => ({ id, ...status }))
      .filter((status) => attackCards.some((card) => cardClassificationTags(card).has(`status-${status.id}`))),
    attackAdvancedFilters = category?.id === "attack"
      ? `<div class="builder-filter-group"><b>대상</b>${[["single", "⌖", "단일"], ["all", "◎", "광역"], ["ricochet", "↝", "도탄"]].map(([id, icon, label]) => `<button data-builder-action="attack-filter" data-filter-group="target" data-filter="${id}" class="${attackDeckFilters.target === id ? "active" : ""}"><i>${icon}</i>${label}</button>`).join("")}</div>
        <div class="builder-filter-group"><b>특성</b>${attackTraitFilters.map(([id, icon, label]) => `<button data-builder-action="attack-filter" data-filter-group="trait" data-filter="${id}" class="${attackDeckFilters.traits.has(id) ? "active" : ""}"><i>${icon}</i>${label}</button>`).join("")}</div>
        <div class="builder-filter-group builder-filter-statuses"><b>상태</b>${availableAttackStatuses.map((status) => `<button data-builder-action="attack-filter" data-filter-group="status" data-filter="${status.id}" class="${attackDeckFilters.statuses.has(status.id) ? "active" : ""}" style="--filter-color:${status.color}"><i>${status.icon}</i>${status.name}</button>`).join("")}<button class="builder-filter-clear" data-builder-action="clear-attack-filters">상세 초기화</button></div>`
      : "";
  $("builder-filters").innerHTML = startingDeckTestMode
    ? `<div class="builder-filter-group builder-filter-primary"><b>기본</b>${testDeckFilters.map(([id, label]) => `<button data-builder-action="filter" data-filter="${id}" class="${startingDeckFilter === id ? "active" : ""}">${label}</button>`).join("")}</div>${attackAdvancedFilters}`
    : "";
  $("builder-categories").innerHTML = startingDeckCategories.map((entry) => {
    const available = cards.filter((card) => startingCardCategory(card) === entry.id).length;
    const selected = startingDeckSelection.filter((id) => startingCardCategory(CARDS[id]) === entry.id).length;
    return `<button class="builder-category builder-category-${entry.id}" data-builder-action="category" data-category="${entry.id}"><span aria-hidden="true">${entry.icon}</span><strong>${entry.name} →</strong><small>${entry.description}</small><b>${available}종 · 선택 ${selected}장</b></button>`;
  }).join("");
  const visibleCards = category ? cards.filter((card) =>
    startingCardCategory(card) === category.id && (!startingDeckTestMode || (matchesTestDeckFilter(card) && matchesAttackDeckFilters(card)))) : [];
  $("builder-pool").innerHTML = visibleCards.map((card) => {
    const count = startingDeckSelection.filter((id) => id === card.id).length,
      disabled = !startingDeckTestMode && (count >= card.maxCopies || startingDeckSelection.length >= 10);
    return `<article>${cardHtml({ id: card.id, level: 0 })}<button data-builder-action="add" data-card="${card.id}" ${disabled ? "disabled" : ""}>${startingDeckTestMode ? `선택 ${count}장 · 추가 +` : `${count}/${card.maxCopies}장 ${count >= card.maxCopies ? "· MAX" : "· 추가 +"}`}</button></article>`;
  }).join("") || (category ? `<p class="builder-empty">현재 분류에 해당하는 ${category.name} 카드가 없습니다.</p>` : "");
  const start = $("builder-start"), ready = startingDeckTestMode ? validTestDeck(startingDeckSelection) : startingDeckSelection.length === 10;
  start.disabled = !ready;
  start.textContent = startingDeckTestMode
    ? `테스트 여정 시작 (${startingDeckSelection.length}장)`
    : `이 덱으로 조향 여정 시작 (${startingDeckSelection.length}/10)`;
}
function openStartingDeckBuilder(testMode = false) {
  startingDeckTestMode = testMode && LOCAL_CARD_TEST;
  startingBuilderContent = "cards";
  startingItemSelection = [];
  startingDeckCategory = null;
  startingDeckFilter = "all";
  attackDeckFilters = { target: "any", traits: new Set(), statuses: new Set() };
  startingDeckSelection = [];
  const dialog = startingDeckDialog();
  renderStartingDeckBuilder();
  dialog.showModal();
}
let pendingRewardCard = null;
let deckReplacementFilter = "all";
function renderDeckReplacement() {
  if (!pendingRewardCard || !run) return;
  const chosen = CARDS[pendingRewardCard],
    filters = [{ id: "all", name: "전체" }, ...startingDeckCategories],
    cards = run.deck
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => deckReplacementFilter === "all" || startingCardCategory(CARDS[card.id]) === deckReplacementFilter);
  $("deck-replace-filters").innerHTML = filters
    .map(({ id, name }) => {
      const count = id === "all"
        ? run.deck.length
        : run.deck.filter((card) => startingCardCategory(CARDS[card.id]) === id).length;
      return `<button data-replace-filter="${id}" class="${deckReplacementFilter === id ? "active" : ""}">${name} <b>${count}</b></button>`;
    })
    .join("") + '<span class="deck-replace-scroll-controls"><button data-replace-scroll="-1" aria-label="이전 카드">←</button><button data-replace-scroll="1" aria-label="다음 카드">→</button></span>';
  $("deck-replace-list").innerHTML = cards
    .map(({ card, index }) =>
      `<div>${cardHtml(card, null, { action: "deck-replace", card: card.id, replaceIndex: index, className: "deck-replace-card", ariaLabel: `${CARDS[card.id].name} 버리고 ${chosen.name} 받기` })}<button data-replace-index="${index}">${CARDS[card.id].name} 버리고<br><b>${chosen.name}</b> 받기</button></div>`,
    )
    .join("") || '<p class="summary-empty">해당 카테고리의 카드가 없습니다.</p>';
}
function replacementDialog() {
  let dialog = $("deck-replace");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "deck-replace";
  dialog.innerHTML =
    '<div class="dialog-head"><div><small id="deck-replace-limit"></small><h2>교체할 카드를 선택하세요</h2></div><button id="deck-replace-close">취소</button></div><p id="deck-replace-copy"></p><div id="deck-replace-filters" class="deck-replace-filters" aria-label="카드 카테고리 필터"></div><div id="deck-replace-list" class="deck-replace-grid"></div>';
  document.body.append(dialog);
  $("deck-replace-close").onclick = () => {
    pendingRewardCard = null;
    dialog.close();
  };
  dialog.addEventListener("cancel", () => {
    pendingRewardCard = null;
  });
  dialog.addEventListener("click", (event) => {
    const scrollButton = event.target.closest("[data-replace-scroll]");
    if (scrollButton) {
      const list = $("deck-replace-list");
      list.scrollBy({
        left: Number(scrollButton.dataset.replaceScroll) * Math.max(180, list.clientWidth * 0.72),
        behavior: "smooth",
      });
      return;
    }
    const filter = event.target.closest("[data-replace-filter]");
    if (filter) {
      deckReplacementFilter = filter.dataset.replaceFilter;
      renderDeckReplacement();
      return;
    }
    const button = event.target.closest("[data-replace-index]");
    if (!button || !pendingRewardCard) return;
    const index = Number(button.dataset.replaceIndex);
    if (!E.advance(run, pendingRewardCard, index, meta)) return;
    pendingRewardCard = null;
    dialog.close();
    save();
    render();
  });
  const list = $("deck-replace-list");
  list.addEventListener("wheel", (event) => {
    if (list.scrollWidth <= list.clientWidth) return;
    const rawDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
        ? event.deltaY
        : event.deltaX;
    if (!rawDelta) return;
    const cardStep = Math.max(160, list.clientWidth * 0.18);
    list.scrollBy({ left: Math.sign(rawDelta) * cardStep, behavior: "smooth" });
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false, capture: true });
  return dialog;
}
function requestDeckReplacement(cardId) {
  if (!run?.reward?.cards.includes(cardId)) return;
  pendingRewardCard = cardId;
  deckReplacementFilter = "all";
  const dialog = replacementDialog(),
    limit = E.deckLimit(run);
  $("deck-replace-limit").textContent = `DECK LIMIT · ${limit}`;
  $("deck-replace-copy").textContent =
    `덱이 ${limit}장으로 가득 찼습니다. 아래 카드 한 장을 버리고 새 카드를 받습니다.`;
  renderDeckReplacement();
  dialog.showModal();
}
$("app").addEventListener(
  "click",
  (event) => {
    const button = event.target.closest('[data-action="reward"][data-card]');
    if (!button || !run || run.deck.length < E.deckLimit(run)) return;
    event.stopImmediatePropagation();
    requestDeckReplacement(button.dataset.card);
  },
  true,
);
let cardAnimating = false;
$("app").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || cardAnimating) return;
  if (button.dataset.action === "discard-choice") {
    if (E.discardFromHand(run, Number(button.dataset.index), meta)) {
      cardAnimating = true;
      await animateDiscardedCard(button);
      save();
      render();
      cardAnimating = false;
    }
    return;
  }
  if (run?.battle?.pendingDiscard && button.dataset.action === "end") {
    $("notice").textContent = "먼저 손패에서 버릴 카드 1장을 선택하세요.";
    return;
  }
  const action = button.dataset.action,
    index = Number(button.dataset.index),
    playedCard =
      action === "play" ? CARDS[run?.battle?.hand[index]?.id] : null,
    playedCardInstance = action === "play" ? run?.battle?.hand[index] : null,
    beforeHandCards = run?.battle ? [...run.battle.hand] : [],
    beforeHandElements = [...document.querySelectorAll(".hand > .card")],
    contactAttackPlayed = Boolean(
      action === "play" &&
      playedCard &&
      (playedCard.attack || playedCard.burst || playedCard.weight) &&
      (playedCard.attackPattern || "contact") === "contact"
    ),
    playedTargetIndex = contactAttackPlayed ? run.battle.selectedTarget : null,
    beforeEnemies = run?.battle?.enemies.map((enemy) => ({
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      id: enemy.id,
      material: enemy.material || ENEMIES[enemy.id]?.material,
    })),
    beforeEnemyHp =
      run?.phase === "battle" && run.battle
        ? run.battle.enemies.reduce((sum, enemy) => sum + enemy.hp, 0)
        : null,
    beforeEnemyShield =
      run?.phase === "battle" && run.battle
        ? run.battle.enemies.reduce((sum, enemy) => sum + enemy.shield, 0)
        : null,
    beforePlayer = run?.hp ?? null,
    beforeShield = run?.battle?.shield || 0,
    blockedDamage =
      action === "end" && run?.battle
        ? Math.min(
            beforeShield,
            run.battle.enemies
              .filter(
                (enemy) =>
                  enemy.hp > 0 &&
                  enemy.intent?.type === "attack" &&
                  !enemy.statuses?.stun?.stacks &&
                  !enemy.statuses?.disarm?.stacks,
              )
              .reduce((sum, enemy) => sum + enemy.intent.value, 0),
          )
        : 0;
  if (action === "end") {
    await handleEndTurn();
    return;
  }
  if (run) {
    delete run._healingFeedback;
    delete run._damageFeedback;
    delete run._enemyHitFeedback;
    delete run._absorbFeedback;
    delete run._absorbLossFeedback;
    delete run._harmonyFeedback;
    delete run._drawFeedback;
    delete run._shuffleFeedback;
  }
  if (action === "play") {
    cardAnimating = true;
    const spent = E.cost(run, run.battle.hand[index]);
    SFX.cardPlay();
    if (startingCardCategory(playedCard) === "absorb") SFX.absorbCard();
    showApSpend(button, spent);
    if (!contactAttackPlayed) {
      button.classList.add("card-discarding");
      await sleep(260);
    }
  }
  if (action === "new" || action === "test-new") {
    if (
      run &&
      !run.finished &&
      !confirm("진행 중인 여정을 종료하고 새로 시작할까요?")
    ) {
      cardAnimating = false;
      return;
    }
    openStartingDeckBuilder(action === "test-new");
    cardAnimating = false;
    return;
  } else if (action === "resume") started = true;
  else if (action === "home") started = false;
  else if (run) {
    switch (action) {
      case "enter":
        E.enter(run, meta);
        break;
      case "play":
        E.play(run, index, meta);
        break;
      case "target":
        E.selectTarget(run, Number(button.dataset.target));
        break;
      case "end":
        E.endTurn(run, meta);
        break;
      case "open":
        E.openChest(run, meta);
        break;
      case "reward":
        E.advance(run, button.dataset.card, null, meta);
        break;
      case "rest-heal":
        E.rest(run, "heal");
        break;
      case "upgrade":
        E.rest(run, "upgrade", index);
        break;
      case "buy":
        E.shop(run, "potion");
        break;
      case "shop-offer":
        E.shop(run, "offer", index, meta);
        break;
      case "shop-reroll":
        E.shop(run, "reroll", null, meta);
        break;
      case "leave":
        E.shop(run, "leave");
        break;
      case "special-safe":
      case "special-gamble":
      case "special-skip":
      case "special-heal":
      case "special-cleanse":
      case "special-reach":
      case "special-endure":
      case "special-flee":
      case "special-overload":
      case "special-purify":
      case "special-sacrifice":
      case "special-tribute":
      case "special-cleanse_card":
      case "special-reroll":
      case "special-charm":
      case "special-burn_two":
      case "special-flame_power":
      case "special-duplicate":
      case "special-gold_double":
      case "special-contraband":
      case "special-blood_trade":
        E.chooseSpecial(run, action.replace("special-", ""), meta, index);
        break;
      case "lab-note":
        E.chooseSpecial(run, "note", meta, index, button.dataset.note);
        break;
      case "lab-remove":
        E.chooseSpecial(run, "remove", meta, index);
        break;
      case "special-leave":
        E.leaveSpecial(run);
        break;
      case "potion":
        if (E.potion(run)) SFX.potion();
        break;
      case "loop":
        E.nextLoop(run, meta, true);
        break;
      case "finish":
        E.nextLoop(run, meta, false);
        break;
    }
  }
  E.checkUnlocks(run, meta);
  const randomlyDiscardedElements =
    action === "play" && run?.battle
      ? beforeHandCards
          .map((card, cardIndex) =>
            card !== playedCardInstance &&
            !run.battle.hand.includes(card) &&
            run.battle.discard.includes(card)
              ? beforeHandElements[cardIndex]
              : null,
          )
          .filter(Boolean)
      : [];
  const afterEnemyHp = run?.battle
      ? run.battle.enemies.reduce((sum, enemy) => sum + enemy.hp, 0)
      : null,
    afterEnemyShield = run?.battle
      ? run.battle.enemies.reduce((sum, enemy) => sum + enemy.shield, 0)
      : null,
    statusHits = run?._damageFeedback || [],
    enemyHits = run?._enemyHitFeedback || [],
    statusEnemyDamage = statusHits
      .filter((hit) => hit.target === "enemy")
      .reduce((sum, hit) => sum + hit.amount, 0),
    statusPlayerDamage = statusHits
      .filter((hit) => hit.target === "player")
      .reduce((sum, hit) => sum + hit.amount, 0),
    enemyDamage =
      beforeEnemyHp !== null && afterEnemyHp !== null
        ? Math.max(0, beforeEnemyHp - afterEnemyHp - statusEnemyDamage)
        : 0,
    enemyBlocked =
      beforeEnemyShield !== null && afterEnemyShield !== null
        ? Math.max(0, beforeEnemyShield - afterEnemyShield)
        : 0,
    playerDamage =
      beforePlayer !== null && run
        ? Math.max(0, beforePlayer - run.hp - statusPlayerDamage)
        : 0,
    shieldGained = run?.battle
      ? Math.max(0, run.battle.shield - beforeShield)
      : 0,
    healing = run ? run._healingFeedback || 0 : 0,
    absorbGained = run ? run._absorbFeedback || 0 : 0,
    harmonyTriggers = run?._harmonyFeedback || [],
    drawn = run?.phase === "battle" ? run._drawFeedback || 0 : 0,
    shuffled = run?.phase === "battle" ? run._shuffleFeedback || 0 : 0,
    killedMonsters = (beforeEnemies || [])
      .map((enemy, index) => ({ ...enemy, index }))
      .filter(
        (enemy) =>
          enemy.hp > 0 && (run?.battle?.enemies[enemy.index]?.hp ?? 0) <= 0,
      ),
    killingBlow =
      killedMonsters.length > 0 &&
      run?.phase === "reward" &&
      (run.battle?.enemies || []).every((enemy) => enemy.hp <= 0),
    playerKilled =
      beforePlayer !== null &&
      beforePlayer > 0 &&
      (run?.hp ?? 0) <= 0 &&
      run?.phase === "result",
    shieldCardPlayed =
      action === "play" &&
      playedCard &&
      startingCardCategory(playedCard) === "defense";
  if (run) {
    delete run._healingFeedback;
    delete run._damageFeedback;
    delete run._enemyHitFeedback;
    delete run._absorbFeedback;
    delete run._harmonyFeedback;
    delete run._drawFeedback;
    delete run._shuffleFeedback;
  }
  let weakContactAttackPlayed = false,
    enemyHitsForFeedback = enemyHits;
  if (contactAttackPlayed) {
    const contactHits = enemyHits.filter(
        (hit) =>
          !hit.statusId &&
          hit.attackPattern === "contact" &&
          hit.damage + hit.blocked > 0,
      ),
      weakContactAttack =
        contactHits.length > 0 &&
        contactHits.every((hit) => hit.damage + hit.blocked <= 19),
      visualHp = (beforeEnemies || []).map((enemy) => enemy.hp),
      showContactHit = (hit) => {
        const impactDamage = hit.damage + hit.blocked,
          strongHit = impactDamage >= 20;
        if (strongHit) showStrongContactImpact(hit.targetIndex);
        else showWeakContactImpact(hit.targetIndex);
        if (hit.blocked)
          showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage);
        if (hit.damage) {
          visualHp[hit.targetIndex] = Math.max(
            0,
            visualHp[hit.targetIndex] - hit.damage,
          );
          updateEnemyHealthFeedback(
            hit.targetIndex,
            visualHp[hit.targetIndex],
            beforeEnemies[hit.targetIndex].maxHp,
          );
          showHitFeedback(
            hit.damage,
            hit.targetIndex,
            hit.attackPattern,
            strongHit,
            impactDamage >= 30,
            Boolean(hit.blocked),
          );
        }
      };
    weakContactAttackPlayed = weakContactAttack;
    if (weakContactAttack) {
      const impactHit = contactHits[0];
      await animateWeakContactAttack(
        button,
        impactHit?.targetIndex ?? playedTargetIndex,
        () => showContactHit(impactHit),
      );
      for (const hit of contactHits.slice(1)) {
        await sleep(150);
        showContactHit(hit);
      }
      enemyHitsForFeedback = enemyHits.filter((hit) => !contactHits.includes(hit));
      await sleep(contactHits.length > 1 ? 280 : 170);
    } else if (contactHits.length) {
      const impactHit = contactHits[0];
      await animateStrongContactAttack(
        button,
        impactHit?.targetIndex ?? playedTargetIndex,
        impactHit.damage + impactHit.blocked >= 30,
        () => showContactHit(impactHit),
        impactHit.damage > 0 && impactHit.blocked > 0 &&
          impactHit.damage + impactHit.blocked >= 30
          ? () => SFX.barrierBreakSuperContactFly()
          : null,
      );
      for (const hit of contactHits.slice(1)) {
        await sleep(190);
        showContactHit(hit);
      }
      enemyHitsForFeedback = enemyHits.filter((hit) => !contactHits.includes(hit));
      await sleep(contactHits.length > 1 ? 360 : 240);
    } else {
      button.classList.add("card-discarding");
      await sleep(260);
    }
  }
  if (action === "play") {
    const hitCounts = enemyHitsForFeedback.reduce((counts, hit) => {
        if (!hit.statusId && Number.isInteger(hit.targetIndex))
          counts.set(hit.targetIndex, (counts.get(hit.targetIndex) || 0) + 1);
        return counts;
      }, new Map()),
      stagedHits = enemyHitsForFeedback.filter(
        (hit) =>
          !hit.statusId &&
          Number.isInteger(hit.targetIndex) &&
          hitCounts.get(hit.targetIndex) > 1 &&
          (hit.damage || hit.blocked),
      );
    if (stagedHits.length) {
      const visualHp = (beforeEnemies || []).map((enemy) => enemy.hp);
      for (let index = 0; index < stagedHits.length; index++) {
        const hit = stagedHits[index];
        if (hit.blocked)
          showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage);
        if (hit.damage) {
          visualHp[hit.targetIndex] = Math.max(
            0,
            visualHp[hit.targetIndex] - hit.damage,
          );
          updateEnemyHealthFeedback(
            hit.targetIndex,
            visualHp[hit.targetIndex],
            beforeEnemies[hit.targetIndex].maxHp,
          );
          showHitFeedback(
            hit.damage,
            hit.targetIndex,
            hit.attackPattern,
            false,
            false,
            Boolean(hit.blocked),
          );
        }
        if (index < stagedHits.length - 1) await sleep(150);
      }
      enemyHitsForFeedback = enemyHitsForFeedback.filter(
        (hit) => !stagedHits.includes(hit),
      );
      await sleep(280);
    }
    // Resolve the card's final hit before showing any discard caused by it.
    await showEnemyHitQueue(
      enemyHitsForFeedback,
      weakContactAttackPlayed || randomlyDiscardedElements.length > 0,
    );
    enemyHitsForFeedback = [];
    for (const discardedCard of randomlyDiscardedElements)
      await animateDiscardedCard(discardedCard);
    // The engine has consumed this card. Remove the stale pre-render element
    // before death/reward presentation so it cannot linger in the hand.
    await collapseUsedCard(button);
  }
  if (playerKilled) {
    cardAnimating = true;
    showHarmonyFeedback(harmonyTriggers);
    await showEnemyHitQueue(enemyHitsForFeedback, weakContactAttackPlayed);
    await showStatusDamageQueue(statusHits);
    await showPlayerDeath(playerDamage || statusPlayerDamage);
    save();
    render();
    cardAnimating = false;
    return;
  }
  if (killingBlow) {
    cardAnimating = true;
    showHarmonyFeedback(harmonyTriggers);
    await showEnemyHitQueue(enemyHitsForFeedback, weakContactAttackPlayed);
    await showStatusDamageQueue(statusHits);
    await waitForLethalHitEffects(killedMonsters);
    await showMonsterDeath(killedMonsters);
    await sleep(120);
    save();
    render();
    if (healing) showPlayerHealing(healing);
    if (absorbGained) showAbsorbGain(absorbGained);
    if (shieldGained) showShieldGain(shieldGained, shieldCardPlayed);
    cardAnimating = false;
    return;
  }
  save();
  render();
  stageDrawFeedback(drawn);
  if (shuffled) await showShuffleFeedback(shuffled);
  if (drawn) {
    cardAnimating = true;
    await showDrawFeedback(drawn);
  }
  showHarmonyFeedback(harmonyTriggers);
  await showEnemyHitQueue(enemyHitsForFeedback, weakContactAttackPlayed);
  if (blockedDamage) showShieldBlock(blockedDamage);
  if (playerDamage) showPlayerDamage(playerDamage);
  showStatusDamageQueue(statusHits);
  if (statusPlayerDamage) SFX.playerStatusHit();
  if (healing) showPlayerHealing(healing);
  if (absorbGained) showAbsorbGain(absorbGained);
  if (shieldGained) showShieldGain(shieldGained, shieldCardPlayed);
  cardAnimating = false;
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
$("tools-toggle").onclick = () => {
  renderCodex();
  $("tools").showModal();
};
$("tools-close").onclick = () => $("tools").close();
$("battle-log-close").onclick = () => $("battle-log").close();
$("run-summary-close").onclick = () => $("run-summary").close();
let runSummaryFilter = "all";
let runSummarySelectedId = null;
let runSummaryTierOrder = "desc";
function renderRunDeckSummary() {
  if (!run) return;
  const deckList = $("run-deck-list"),
    grouped = new Map();
  for (const card of run.deck) {
    if (!grouped.has(card.id)) grouped.set(card.id, []);
    grouped.get(card.id).push(card);
  }
  const categories = [["all", "전체"], ["attack", "공격"], ["defense", "방어"], ["absorb", "흡수"], ["heal", "회복"]],
    groups = [...grouped].map(([id, cards]) => ({ id, cards, definition: CARDS[id] }))
      .filter((group) => runSummaryFilter === "all" || startingCardCategory(group.definition) === runSummaryFilter)
      .sort((a, b) => (runSummaryTierOrder === "desc"
        ? b.definition.tier - a.definition.tier
        : a.definition.tier - b.definition.tier) || a.definition.name.localeCompare(b.definition.name, "ko"));
  if (!groups.some((group) => group.id === runSummarySelectedId)) runSummarySelectedId = groups[0]?.id || null;
  const selected = groups.find((group) => group.id === runSummarySelectedId),
    detailCard = selected ? { id: selected.id, level: Math.max(...selected.cards.map((card) => card.level || 0)) } : null,
    categoryCounts = Object.fromEntries(categories.map(([id]) => [id, id === "all" ? run.deck.length : run.deck.filter((card) => startingCardCategory(CARDS[card.id]) === id).length])),
    rows = groups.map(({ id, cards, definition }) => {
      const levels = [...new Set(cards.map((card) => card.level || 0))].sort((a, b) => a - b)
          .map((level) => `+${level} ×${cards.filter((card) => (card.level || 0) === level).length}`).join(" · "),
        category = startingCardCategory(definition),
        active = id === runSummarySelectedId;
      return `<article class="summary-deck-entry ${active ? "active" : ""}"><button data-run-summary-card="${id}" aria-expanded="${active}"><span class="summary-deck-role role-${category}">${{ attack: "공격", defense: "방어", absorb: "흡수", heal: "회복" }[category]}</span><span><strong>${definition.name}</strong><small>${definition.cost} AP · ${definition.note.toUpperCase()} · ${definition.tier}티어</small></span><span class="summary-deck-levels">${levels}<b>총 ${cards.length}장</b></span></button>${active ? `<div class="summary-card-inline">${cardHtml(detailCard)}</div>` : ""}</article>`;
    }).join("");
  deckList.className = "summary-deck-shell";
  deckList.innerHTML = `<div class="summary-deck-toolbar"><div class="summary-deck-filters">${categories.map(([id, label]) => `<button data-run-summary-filter="${id}" class="${runSummaryFilter === id ? "active" : ""}">${label}<b>${categoryCounts[id]}</b></button>`).join("")}</div><div class="summary-deck-sort"><button data-run-summary-sort="desc" class="${runSummaryTierOrder === "desc" ? "active" : ""}">높은 티어순</button><button data-run-summary-sort="asc" class="${runSummaryTierOrder === "asc" ? "active" : ""}">낮은 티어순</button></div></div><div class="summary-deck-workspace"><div class="summary-deck-list">${rows || '<p class="summary-empty">해당 분류의 카드가 없습니다.</p>'}</div><aside class="summary-card-detail">${detailCard ? `<small>선택 카드 · 보유 최고 강화</small>${cardHtml(detailCard)}` : ""}</aside></div>`;
}
document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-run-open]") || !run) return;
  $("run-deck-title").textContent = `내 덱 · ${run.deck.length}장`;
  $("run-item-title").textContent =
    `이번 여정 아이템 · ${run.inventory.length}개`;
  runSummaryFilter = "all";
  runSummaryTierOrder = "desc";
  runSummarySelectedId = run.deck[0]?.id || null;
  renderRunDeckSummary();
  $("run-item-list").innerHTML =
    countItemIds(run.inventory)
      .map(([id, count]) => itemHtml(id, count))
      .join("") ||
    '<p class="summary-empty">아직 획득한 아이템이 없습니다.</p>';
  $("run-summary").showModal();
});
$("run-summary").addEventListener("click", (event) => {
  const filter = event.target.closest("[data-run-summary-filter]"),
    sort = event.target.closest("[data-run-summary-sort]"),
    card = event.target.closest("[data-run-summary-card]");
  if (filter) {
    runSummaryFilter = filter.dataset.runSummaryFilter;
    renderRunDeckSummary();
  } else if (sort) {
    runSummaryTierOrder = sort.dataset.runSummarySort;
    renderRunDeckSummary();
  } else if (card) {
    runSummarySelectedId = card.dataset.runSummaryCard;
    renderRunDeckSummary();
  }
});
document.addEventListener(
  "wheel",
  (event) => {
    const scroller = event.target.closest(
      ".hand,.card-reward-choices,.summary-card-grid,.builder-selected,.deck-replace-grid",
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
    for (const label of ["라운드", "대상", "효과"]) {
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
      run.log.forEach((entry, index) => {
        const row = document.createElement("div");
        row.className = "log-row";
        const normalizedEntry = String(entry)
            .replace(/^나(?=\s|\s*·)/, "플레이어")
            .replace(/(^|·\s*)나(?=\s)/g, "$1플레이어"),
          parts = normalizedEntry.split(" · "),
          hasRound = /^\d+라운드$/.test(parts[0]),
          round = document.createElement("small"),
          name = document.createElement("strong"),
          action = document.createElement("span");
        round.textContent = hasRound
          ? parts.shift()
          : "이전 기록";
        if (parts.length > 1) {
          const subject = parts.shift(),
            effect = parts.join(" · "),
            direction = subject.split(" → ");
          if (direction.length > 1) {
            const target = direction.pop();
            name.textContent = target;
            action.textContent = `${direction.join(" → ")} · ${effect}`;
          } else {
            name.textContent = subject;
            action.textContent = effect;
          }
        } else {
          const legacyText = parts[0] || "기록 없음",
            legacyActor = legacyText.startsWith("플레이어 ")
              ? "플레이어"
              : run?.battle?.enemies
                  ?.map((enemy) => enemy.name)
                  .sort((a, b) => b.length - a.length)
                  .find((enemyName) => legacyText.startsWith(`${enemyName} `));
          name.textContent = legacyActor || "전투 효과";
          action.textContent = legacyActor
            ? legacyText.slice(legacyActor.length).trim()
            : legacyText;
        }
        row.append(round, name, action);
        list.append(row);
      });
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
    $("notice").textContent =
      "팝업이 차단됐습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러주세요.";
};
const CODEX_AUGMENTS = {
    cards: { label: "액티브 카드", entries: () => Object.values(CARDS).filter((card) => card.id !== "impurity") },
    traits: { label: "특성", entries: () => Object.values(ITEMS).filter((item) => item.kind === "trait") },
    relics: { label: "유물", entries: () => Object.values(ITEMS).filter((item) => item.kind === "relic") },
    stats: { label: "능력치", entries: () => Object.values(ITEMS).filter((item) => item.kind === "stat") },
  },
  CODEX_MONSTERS = {
    act1: { label: "1막", normal: EARLY_MONSTERS, elite: ACT1_ELITES, boss: ACT1_BOSSES },
    act2: { label: "2막", normal: ACT2_MONSTERS, elite: ACT2_ELITES, boss: ACT2_BOSSES },
    act3: { label: "3막", normal: ACT3_MONSTERS, elite: ACT3_ELITES, boss: ACT3_BOSSES },
  },
  CODEX_MONSTER_TYPES = { normal: "일반", elite: "엘리트", boss: "보스" };
let codexState = { major: "augment", middle: "cards", minor: "1" };
function codexTabs(host, entries, selected, level) {
  host.innerHTML = entries.map(([id, label]) => `<button type="button" data-codex-level="${level}" data-codex-value="${id}" class="${id === selected ? "selected" : ""}" aria-pressed="${id === selected}">${label}</button>`).join("");
}
function codexCardEntry(card) {
  const discovered = (meta.discoveredCards || []).includes(card.id);
  if (!discovered)
    return `<article class="codex-entry codex-card-entry undiscovered tier-${Math.max(0, card.tier - 1)}"><small>${card.tier}티어 · ${(card.note || "none").toUpperCase()}</small><strong>???</strong><p>여정 중 획득하여 기록을 해금하세요.</p></article>`;
  const pattern = card.attackPattern ? `<span>${card.attackPattern === "contact" ? "접촉" : "비접촉"}</span>` : "";
  return `<article class="codex-entry codex-card-entry tier-${Math.max(0, card.tier - 1)}"><small>${card.tier}티어 · ${(card.note || "none").toUpperCase()}</small><strong>${card.name}</strong><p>${cardEffectText({ id: card.id, level: 0 }, true)}</p>${pattern}</article>`;
}
function codexItemEntry(item) {
  if (!(meta.discovered || []).includes(item.id))
    return `<article class="codex-entry codex-item-entry undiscovered tier-${item.tier}"><span class="item-art item-art-fallback" aria-hidden="true">?</span><small>${RARITIES[item.tier]} · ${KINDS[item.kind]}</small><strong>???</strong><p>아직 발견하지 못한 조향 원료입니다.</p></article>`;
  return itemHtml(item.id);
}
function codexIntent(intent, turn) {
  const parts = [];
  if (intent.type === "attack") parts.push(`${intent.attackPattern === "nonContact" ? "비접촉" : "접촉"} 공격 ${intent.value}${intent.hits ? ` × ${intent.hits}` : ""}`);
  else if (intent.type === "guard") parts.push(`방어막 ${intent.value}`);
  else if (intent.type === "pollute") parts.push(`불순물 ${intent.value}장`);
  else parts.push("상태이상 부여");
  if (intent.guard) parts.push(`방어막 ${intent.guard}`);
  if (intent.allyGuard) parts.push(`아군 전체 방어막 ${intent.allyGuard}`);
  if (intent.pollute && intent.type !== "pollute") parts.push(`불순물 ${intent.pollute}장`);
  for (const [id, amount] of Object.entries(intent.applyPlayer || {})) parts.push(statusAmountText(id, amount));
  for (const [id, amount] of Object.entries(intent.applySelf || {})) parts.push(`자신 ${statusAmountText(id, amount)}`);
  for (const [id, amount] of Object.entries(intent.applyAllies || {})) parts.push(`아군 ${statusAmountText(id, amount)}`);
  return `<li><b>${turn + 1}턴</b><span>${parts.join(" · ")}</span></li>`;
}
function codexMonsterEntry(monster) {
  const discovered = Object.hasOwn(EARLY_MONSTERS, monster.id) ||
    (meta.defeatedMonsters || []).includes(monster.id);
  if (!discovered)
    return `<article class="codex-entry codex-monster-entry undiscovered"><div class="codex-monster-head"><i aria-hidden="true">?</i><span><small>???</small><strong>미지의 존재</strong></span><b>HP ???</b></div><ol><li><span>아직 마주친 적이 없습니다.</span></li></ol></article>`;
  const initial = Object.entries(monster.initialStatuses || {}).map(([id, amount]) => statusAmountText(id, amount)).join(" · ");
  return `<article class="codex-entry codex-monster-entry"><div class="codex-monster-head"><i aria-hidden="true">${monster.symbol || "◇"}</i><span><small>${monster.id}</small><strong>${monster.name}</strong></span><b>HP ${monster.baseHp}</b></div>${initial ? `<p>초기 상태 · ${initial}</p>` : ""}<ol>${(monster.pattern || []).map(codexIntent).join("")}</ol></article>`;
}
function codexProgress() {
  const cards = Object.values(CARDS).filter((card) => card.id !== "impurity"),
    items = Object.values(ITEMS),
    monsters = Object.values(CODEX_MONSTERS).flatMap((act) => [
      ...Object.values(act.normal),
      ...Object.values(act.elite),
      ...Object.values(act.boss),
    ]),
    foundCards = cards.filter((card) => (meta.discoveredCards || []).includes(card.id)).length,
    foundItems = items.filter((item) => (meta.discovered || []).includes(item.id)).length,
    foundMonsters = monsters.filter((monster) =>
      Object.hasOwn(EARLY_MONSTERS, monster.id) ||
      (meta.defeatedMonsters || []).includes(monster.id)).length,
    found = foundCards + foundItems + foundMonsters,
    total = cards.length + items.length + monsters.length,
    percent = total ? Math.round((found / total) * 100) : 0;
  return { found, total, percent };
}
function renderCodex() {
  const progress = codexProgress();
  const milestones = [[20, "수습 조향사 · 시작 골드 +20"], [40, "숙련 연금술사 · 시작 포션 +1"], [60, "수석 마스터 · 상점 무료 리롤 1회"], [80, "전설의 조향장 · 첫 턴 AP +1"], [100, "절대 조화의 신 · 골든 칭호"]],
    title = [...milestones].reverse().find(([rate]) => progress.percent >= rate)?.[1].split(" · ")[0] || "견습 조향사";
  $("codex-progress").innerHTML = `<div class="codex-progress-copy"><strong>✦ ${title} · 종합 수집률</strong><span>${progress.found} / ${progress.total} (${progress.percent}%)</span></div><div class="codex-progress-track" role="progressbar" aria-label="도감 수집률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}"><i style="width:${progress.percent}%"></i></div><div class="codex-milestones">${milestones.map(([rate, label]) => `<small class="${progress.percent >= rate ? "earned" : ""}">${progress.percent >= rate ? "✓" : "◇"} ${rate}% ${label}</small>`).join("")}</div>`;
  codexTabs($("codex-major"), [["augment", "증강"], ["monster", "몬스터"], ["glossary", "용어사전"], ["status", "상태이상"]], codexState.major, "major");
  if (codexState.major === "augment") {
    if (!CODEX_AUGMENTS[codexState.middle]) codexState.middle = "cards";
    codexTabs($("codex-middle"), Object.entries(CODEX_AUGMENTS).map(([id, group]) => [id, group.label]), codexState.middle, "middle");
    const tiers = codexState.middle === "cards" ? [1, 2, 3, 4] : [0, 1, 2, 3];
    if (!tiers.includes(Number(codexState.minor))) codexState.minor = String(tiers[0]);
    codexTabs($("codex-minor"), tiers.map((tier) => [String(tier), `${codexState.middle === "cards" ? tier : tier + 1}티어${codexState.middle === "cards" ? "" : ` · ${RARITIES[tier]}`}`]), codexState.minor, "minor");
    const entries = CODEX_AUGMENTS[codexState.middle].entries().filter((entry) => entry.tier === Number(codexState.minor));
    $("codex-view").innerHTML = `<p class="codex-count">${CODEX_AUGMENTS[codexState.middle].label} · ${codexState.middle === "cards" ? Number(codexState.minor) : Number(codexState.minor) + 1}티어 · ${entries.length}종</p><div class="codex-grid">${entries.map((entry) => codexState.middle === "cards" ? codexCardEntry(entry) : codexItemEntry(entry)).join("") || "<p>등록된 항목이 없습니다.</p>"}</div>`;
  } else if (codexState.major === "monster") {
    if (!CODEX_MONSTERS[codexState.middle]) codexState.middle = "act1";
    if (!CODEX_MONSTER_TYPES[codexState.minor]) codexState.minor = "normal";
    codexTabs($("codex-middle"), Object.entries(CODEX_MONSTERS).map(([id, act]) => [id, act.label]), codexState.middle, "middle");
    codexTabs($("codex-minor"), Object.entries(CODEX_MONSTER_TYPES), codexState.minor, "minor");
    const entries = Object.values(CODEX_MONSTERS[codexState.middle][codexState.minor]);
    $("codex-view").innerHTML = `<p class="codex-count">${CODEX_MONSTERS[codexState.middle].label} · ${CODEX_MONSTER_TYPES[codexState.minor]} · ${entries.length}종</p><div class="codex-grid codex-monster-grid">${entries.map(codexMonsterEntry).join("") || "<p>현재 등록된 몬스터가 없습니다.</p>"}</div>`;
  } else {
    $("codex-middle").innerHTML = "";
    $("codex-minor").innerHTML = "";
    const isStatus = codexState.major === "status";
    $("codex-view").innerHTML = `<p class="codex-count">${isStatus ? "전투 중 적용되는 이로운 효과·해로운 효과·표식" : "여정과 전투에 사용되는 핵심 용어"}</p><div class="codex-glossary">${isStatus ? statusGlossaryHtml() : glossaryTermsHtml()}</div>`;
  }
}
$("tools").addEventListener("click", (event) => {
  const button = event.target.closest("[data-codex-level]");
  if (!button) return;
  const level = button.dataset.codexLevel;
  codexState[level] = button.dataset.codexValue;
  if (level === "major") {
    if (codexState.major === "augment") {
      codexState.middle = "cards";
      codexState.minor = "1";
    } else if (codexState.major === "monster") {
      codexState.middle = "act1";
      codexState.minor = "normal";
    }
  } else if (level === "middle") {
    codexState.minor = codexState.major === "augment" ? (codexState.middle === "cards" ? "1" : "0") : "normal";
  }
  renderCodex();
});
const sfxToggle = $("sfx-toggle"),
  sfxVolume = document.querySelector(".sfx-volume");
const sfxVolumeInput = sfxVolume.querySelector("input"),
  sfxVolumeOutput = sfxVolume.querySelector("output");
sfxVolumeInput.value = SFX.volume;
sfxVolumeOutput.textContent = SFX.volume;
sfxVolumeInput.setAttribute("aria-valuetext", `${SFX.volume}퍼센트`);
sfxVolumeInput.addEventListener("input", () => {
  const value = SFX.setVolume(sfxVolumeInput.value);
  sfxVolumeOutput.textContent = value;
  sfxVolumeInput.setAttribute("aria-valuetext", `${value}퍼센트`);
});
sfxVolumeInput.addEventListener("change", () => {
  if (SFX.muted) {
    SFX.toggleMute();
    renderSfxToggle();
  }
  SFX.confirm();
});
function renderSfxToggle() {
  sfxToggle.textContent = SFX.muted ? "소리 꺼짐" : "소리 켜짐";
  sfxToggle.setAttribute("aria-pressed", String(!SFX.muted));
  sfxToggle.title = SFX.muted ? "효과음 켜기" : "효과음 끄기";
}
sfxToggle.addEventListener("click", () => {
  SFX.toggleMute();
  renderSfxToggle();
  if (!SFX.muted) SFX.confirm();
});
renderSfxToggle();
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
window.addEventListener("scroll", scheduleBattleFrameSync, { passive: true });
if (loadedSave.recovered)
  $("notice").textContent =
    "이전 저장본에 문제가 있어 안전한 백업 시점으로 복구했습니다.";
window.addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") save();
});

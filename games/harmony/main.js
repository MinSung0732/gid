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
import * as E from "./engine.js";
import { loadGame, saveGame } from "./persistence.js";
import { STATUS_DEFINITIONS } from "./statuses.js";
import { HIDDEN_SYNERGIES, SYNERGY_COLORS } from "./synergies.js";
import { SFX } from "./sound.js";
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
const $ = (id) => document.getElementById(id),
  LOCAL_CARD_TEST = ["localhost", "127.0.0.1", "::1"].includes(location.hostname),
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
      ["뽑을 카드", "아직 손패로 들어오지 않은 카드 더미입니다."],
      [
        "버린 카드",
        "사용한 카드가 놓이는 더미입니다. 뽑을 카드가 비면 다시 섞입니다.",
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
function glossaryHtml() {
  const groups = GLOSSARY_GROUPS.map(
      ([title, terms]) =>
        `<section><h3>${title}</h3>${terms.map(([name, description]) => `<div class="glossary-row"><strong>${name}</strong><p>${description}</p></div>`).join("")}</section>`,
    ).join(""),
    statusGroup = (title, filter) =>
      `<section><h3>${title}</h3>${Object.values(STATUS_DEFINITIONS)
        .filter(filter)
        .map(
          (status) =>
            `<div class="glossary-row glossary-status" style="--status-color:${status.color}"><strong><i>${status.icon}</i>${status.name}<small>${status.kind === "buff" ? "이로운 효과" : status.kind === "debuff" ? "해로운 효과" : "표식"} · 최대 ${status.maxStacks}중첩${status.maxTurns ? ` · 최대 ${status.maxTurns}턴` : ""}${status.instant ? " · 즉시 발동" : ""}</small></strong><p>${status.description}</p></div>`,
        )
        .join("")}</section>`;
  return (
    groups +
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
function rawItemHtml(id, count = 1) {
  const i = ITEMS[id],
    roomLabel = (i.rooms || [i.room]).map((room) => ROOM_NAMES[room] || room).join(" · "),
    art = i.image
      ? `<img class="item-art" src="${i.image}" alt="${i.name}">`
      : `<span class="item-art item-art-fallback item-art-${i.kind}" aria-hidden="true">${i.kind === "curse" ? "▼" : i.kind === "relic" ? "◇" : i.kind === "trait" ? "✦" : "◆"}</span>`;
  return `<div class="item tier-${i.tier}">${count > 1 ? `<b class="item-count" aria-label="${count}개 보유">×${count}</b>` : ""}${art}<small>${RARITIES[i.tier]} · ${KINDS[i.kind]}</small><strong>${i.name}</strong><p>${i.description}</p><span>${roomLabel} · 최대 ${i.maxOwned}개</span></div>`;
}
function itemHtml(id, count = 1) {
  let html = rawItemHtml(id, count);
  const aura = synergyAura(id), item = ITEMS[id];
  if (!aura) return html;
  html = html.replace(`class="item tier-${item.tier}`, `class="item tier-${item.tier}${aura.attributes}`);
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
function cardEffectText(card, expanded = false) {
  const c = E.cardDefinition(card),
    level = card.level || 0,
    up = c.upgrades ? 0 : level * 3,
    attack = run ? E.power(run, "attack") : 0,
    defense = run ? E.power(run, "defense") : 0,
    lines = [];
  if (c.attack)
    lines.push(
      `피해 ${c.attack + up + attack}${c.hits ? ` × ${c.hits}회` : ""}`,
    );
  else if (c.burst)
    lines.push(`흡수 전부 ×${c.burstMultiplier ?? 8 + level} 피해`);
  else if (c.weight)
    lines.push(`방어막을 모두 소모해 방어막 수치 + 공격력 ${attack} 피해`);
  else if (c.shield) lines.push(`방어막 +${c.shield + up + defense}`);
  else if (c.heal) lines.push(`체력 +${c.heal + up}`);
  else if (c.missingHpHealRatio) lines.push(`잃은 체력의 ${Math.round(c.missingHpHealRatio * 100)}% 회복 · 최소 ${c.minimumHeal}`);
  else if (c.absorb) lines.push(`흡수 +${c.absorb + up}`);
  else if (c.draw) lines.push(`카드 +${c.draw}`);
  else if (card.id === "impurity") lines.push("사용 불가");
  if ((c.shield || c.attack || c.heal) && c.absorb) lines.push(`흡수 +${c.absorb + up}`);
  if (c.heal && c.shield) lines.push(`방어막 +${c.shield + up + defense}`);
  if (c.comboHealThreshold) lines.push(`이 카드를 포함해 이번 턴 ${c.comboHealThreshold}장 이상 사용 시 회복 ×${c.comboHealMultiplier}`);
  if (c.harmonyHealShield) lines.push("이번 턴 하모니를 완성했다면 회복량만큼 방어막 획득");
  if (c.overhealShieldRatio) lines.push(`초과 회복량의 ${Math.round(c.overhealShieldRatio * 100)}%를 방어막으로 전환`);
  if (c.cleanseDotStacks) lines.push(`화상·부식·중독·출혈 각각 ${c.cleanseDotStacks}중첩 제거`);
  if (c.attack && c.shield) lines.push(`공격 후 방어막 +${c.shield + up + defense}`);
  if (c.shieldDamageMultiplier) lines.push(`방어막 피해 ×${c.shieldDamageMultiplier}`);
  if (c.bypassShield) lines.push("적 방어막 완전 관통");
  if (c.battleContactBonus) lines.push(`이번 전투에서 앞서 사용한 접촉 카드 1장당 타격마다 피해 +${c.battleContactBonus}`);
  if (c.ceilBattleContactBonus) lines.push("접촉 카드 누적 피해는 소수점 올림");
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
  if (c.requiredAbsorb) lines.push(`흡수 ${c.requiredAbsorb} 소모 · 부족하면 사용 불가`);
  if (c.intimidateOnHit) lines.push(`적중마다 위축 누적 · 총 ${c.intimidateOnHit} · 1턴`);
  if (c.detonateBurning) lines.push(`기존 화상 피해 ×${c.detonateBurning} 즉시 폭발 · 화상 소모 없음`);
  if (c.maxHpOnKill) lines.push(`이 공격으로 처치 시 최대 체력 영구 +${c.maxHpOnKill}`);
  if (c.discardAttackBurn) lines.push(`공격 카드 버리면 대상에게 화상 ${c.discardAttackBurn}`);
  if (c.discardCostDamage) lines.push(`버린 카드 기본 비용 1 AP당 비접촉 추가 피해 ${c.discardCostDamage}`);
  if (c.refundAbsorbThreshold) lines.push(`흡수 ${c.refundAbsorbThreshold} 이상 · AP 1 환급 · 흡수 소모 없음`);
  if (c.absorbStatusThreshold && c.absorbThresholdApplyAllEnemy) {
    const statuses = Object.entries(c.absorbThresholdApplyAllEnemy)
      .map(([id, amount]) => `${STATUS_DEFINITIONS[id]?.name || id} ${amount}`)
      .join(" · ");
    lines.push(`흡수 획득 후 ${c.absorbStatusThreshold} 이상이면 모든 적에게 ${statuses} 부여`);
  }
  if (c.absorbCost) lines.push(`흡수 ${c.absorbCost} 이상이면 자동 소모 · 기본 피해 ${c.fueledAttack}`);
  if (c.executeRatio) lines.push(`체력 ${Math.round(c.executeRatio * 100)}% 이하${c.executeNonBoss ? " 비보스" : ""} · 피해 ×${c.executeMultiplier || 1}`);
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
  if (c.target === "all") lines.push("살아있는 모든 적 대상");
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
  const condensed = lines.length > 2 || lines.join("").length > 34,
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
function cardHtml(card, index = null) {
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
    category = c.category || (c.attack || c.burst || c.weight ? "attack" : c.shield || c.heal ? "defense" : c.absorb ? "absorb" : "effect"),
    icon = {
      attack: `<svg viewBox="0 0 24 24"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6m-3 3 4 4m-1 1 2-2M14.5 6.5 18 3h3v3L9.5 17.5M5 14l-2 2 5 5 2-2"/></svg>`,
      defense: `<svg viewBox="0 0 40 40"><path d="M20 5l12 5v9c0 8-4.8 13-12 17-7.2-4-12-9-12-17v-9z"/></svg>`,
      absorb: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="11"/><circle cx="20" cy="20" r="7"/></svg>`,
      heal: `<svg viewBox="0 0 40 40"><path d="M16 6h8v10h10v8H24v10h-8V24H6v-8h10z"/></svg>`,
      effect: `<svg viewBox="0 0 40 40"><path d="M20 6l3.6 10.4L34 20l-10.4 3.6L20 34l-3.6-10.4L6 20l10.4-3.6z"/></svg>`,
    }[category];
return `<button class="card card-type-${type} card-category-${category} note-${cardNote} card-tier-${tier}${card.id === "impurity" ? " card-impurity" : ""}" ${index === null ? "" : `data-action="${choosingDiscard ? "discard-choice" : "play"}" data-index="${index}"`} ${disabled ? "disabled" : ""}><span class="card-top"><b>${choosingDiscard ? (disabled ? "버리기 불가" : "이 카드 버리기") : `${price} AP`}</b><span class="card-meta"><small>${{ top: "TOP", middle: "MIDDLE", base: "BASE", none: "불순물" }[cardNote]}</small>${patternBadge}</span></span><span class="card-symbol" aria-hidden="true">${icon}</span><strong>${c.name}${card.level ? ` +${card.level}` : ""}</strong><span class="card-effects">${cardEffectText(card)}</span></button>`;
}
function collection() {
  const found = (meta.synergies || []).map((id) => HIDDEN_SYNERGIES[id]).filter(Boolean),
    achievements = UNLOCKS.filter((unlock) => !unlock.legacy),
    unlockedCount = achievements.filter((unlock) => meta.unlocked.includes(unlock.id)).length;
  return `<details class="collection"><summary>발견 증강 ${meta.discovered.length} / ${Object.keys(ITEMS).length} · 업적 ${unlockedCount} / ${achievements.length}</summary><div class="unlock-grid">${achievements.map((u) => `<div><strong>${meta.unlocked.includes(u.id) ? "✓" : "◇"} ${u.name}</strong><p>${u.goal}</p></div>`).join("")}</div><h3>✦ 발견한 비밀 조합 ${found.length} / ${Object.keys(HIDDEN_SYNERGIES).length}</h3><div class="synergy-collection">${found.map((synergy) => `<article><strong>${synergy.name}</strong><p>${synergy.description}</p></article>`).join("") || "<p>뜻밖의 아이템 조합이 숨은 조화를 깨웁니다.</p>"}</div><div class="inventory">${meta.discovered.map(itemHtml).join("") || "<p>방을 탐험해 첫 아이템을 발견해보세요.</p>"}</div></details>`;
}
function lobby() {
  return `<section class="welcome"><div><p class="eyebrow">SCENT · CHANCE · HARMONY</p><h1>우연이 모여,<br>하나의 향기가 된다.</h1><p class="lead">12개의 방에서 원료를 모으고, 카드를 엮고,<br>당신만의 뜻밖의 조합을 발견하세요.</p><div class="actions"><button class="primary" data-action="new">새로운 조향 시작 →</button>${LOCAL_CARD_TEST ? '<button class="local-test-entry" data-action="test-new">LOCAL · 카드 테스트 모드</button>' : ""}${run && !run.finished ? '<button data-action="resume">이전 여정 이어하기</button>' : ""}</div><p class="hint">기본 여정 목표 10~15분 · 밸런스 테스트 버전</p></div><div class="welcome-art"><img src="../../public/assets/object-2048/2048.png" alt="결이든 향기 오브제 일러스트"><span>BUILD YOUR OWN HARMONY</span></div></section><div class="intro-grid"><div><b>01 / 카드로 조율</b><p>첫 턴 카드 5장 · 이후 턴마다 3장. 적의 다음 행동을 보고 공격과 방어를 선택하세요.</p></div><div><b>02 / 보상은 우연</b><p>능력치·특성·유물 중 하나. 채집방, 황금방, 보스방마다 다른 테이블이 기다립니다.</p></div><div><b>03 / 실패도 발견</b><p>조건을 달성해 새 카드를 해금하세요. 다음 여정의 조합이 더 넓어집니다.</p></div></div><p class="lobby-record">완료한 여정 ${meta.totalRuns} · 최고 점수 ${number(meta.highScore)} · 최고 심연 ${meta.highestLoop}</p>`;
}
function hud() {
  const route = E.routeFor(run),
    act = E.actInfo(run.loop);
  ROUTE.splice(0, ROUTE.length, ...route);
  return `<div class="hud"><div><small>${act.act <= 3 ? `${act.act}막` : "심연"} · ${act.name}</small><strong>PROJECT HARMONY</strong></div><div class="hud-score"><small>점수</small><strong>${number(run.score)}</strong></div><button data-glossary-open>용어 설명<small>효과 · 상태</small></button><button data-log-open>전투 기록<small>${run.log.length}개</small></button><button data-action="home">저장 후 홈</button></div><div class="route">${route.map((_, i) => { const category = E.roomCategoryAt(run, i), info = ROOM_CATEGORIES[category]; return `<span class="${i === run.node ? "current" : i < run.node ? "done" : ""}" title="${i + 1}. ${info?.name || ROOM_NAMES[category]}">${info?.symbol || icons[category]}<small>${i + 1}</small></span>`; }).join("")}</div>`;
}
function bonus(value, suffix = "") {
  return `<b>${value}${suffix} <small>(+${value}${suffix})</small></b>`;
}
function statsPanel() {
  const maxHpBonus = E.power(run, "maxHp"),
    attack = E.power(run, "attack"),
    defense = E.power(run, "defense"),
    turnBaseAp = E.power(run, "turnBaseAp"),
    draw = E.power(run, "draw"),
    apCap = E.power(run, "apCap"),
    handSize = E.power(run, "handSize");
  const drawBonus = draw ? ` <small>(+${draw})</small>` : "",
    stats = [
      [
        "♥",
        "체력",
        `<b>${run.hp} / ${run.maxHp}${maxHpBonus ? ` <small>(+${maxHpBonus} 최대)</small>` : ""}</b>`,
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
  return `<aside class="player-stats ${run.hp / run.maxHp <= 0.3 ? "health-danger" : ""}" aria-label="내 능력치"><div class="stats-title"><span>MY HARMONY</span><strong>내 능력치</strong></div><div class="stat-grid">${stats.map(([icon, label, value]) => `<div class="stat-row"><i>${icon}</i><span>${label}</span>${value}</div>`).join("")}</div><p class="stats-note">괄호 안 수치는 능력치 아이템으로 증가한 값입니다.</p><button class="run-summary-button" data-run-open><span>▤</span> 내 덱 · 여정 아이템<small>카드 ${run.deck.length}장 · 아이템 ${run.inventory.length}개</small></button></aside>`;
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
            return `<div class="acquired-row tier-mark-${i.tier}"><span><em>${KINDS[i.kind]}</em><small>${RARITIES[i.tier]}</small></span><span><strong>${i.name} ${count} / ${i.maxOwned}</strong><small>${i.description}${count > 1 ? " · 중첩 적용" : ""}</small></span></div>`;
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
function battle() {
  const b = run.battle,
    potionDisabled = !run.potions || run.hp === run.maxHp,
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
    controlIcons = (enemy) =>
      Object.keys(enemy.statuses || {})
        .filter((id) => STATUS_DEFINITIONS[id]?.category === "control")
        .map((id) => STATUS_DEFINITIONS[id].icon)
        .join(" "),
    queue = `<aside class="turn-order" aria-label="턴 진행 순서"><strong>TURN ORDER</strong><div class="turn-chip turn-queue-item player-turn-chip ${b.enemyPhase ? "" : "active"}"><i>01</i><span>플레이어<small>${b.enemyPhase ? "대기" : "현재 행동"}</small></span></div>${b.enemies
      .map(
        (enemy, index) =>
          `<div class="turn-chip turn-queue-item ${enemy.hp <= 0 ? "defeated" : ""} ${b.actingEnemy === index ? "active" : ""} ${b.completedEnemies?.includes(index) ? "done" : ""}" data-enemy-index="${index}"><i>${String(index + 2).padStart(2, "0")}</i><span>${enemy.name}<small>${enemy.hp > 0 ? intentText(enemy) : "행동 불가"} ${controlIcons(enemy)}</small></span></div>`,
      )
      .join("")}</aside>`,
    field = `<div class="enemies-field enemies-${b.enemies.length}">${b.enemies
      .map((enemy, index) => {
        const data = ENEMIES[enemy.id] || {},
          art = data.image
            ? `<img class="enemy-image" src="${data.image}" alt="${enemy.name}">`
            : `<span class="enemy-symbol" aria-hidden="true">${data.symbol || "◇"}</span>`;
        return `<article class="enemy ${index === b.selectedTarget && enemy.hp > 0 ? "selected" : ""} ${enemy.hp <= 0 ? "defeated" : ""} ${b.actingEnemy === index ? "acting-enemy" : ""}" data-action="target" data-target="${index}" tabindex="${enemy.hp > 0 && !b.enemyPhase ? "0" : "-1"}" aria-label="${enemy.name}${index === b.selectedTarget ? " 선택됨" : " 선택"}"><div class="intent intent-${enemy.statuses?.stun?.stacks ? "stun" : enemy.intent.type}"><strong>${intentText(enemy)}</strong></div><div class="enemy-visual">${art}</div><h2>${enemy.name}</h2><div class="enemy-hp"><span style="width:${(100 * enemy.hp) / enemy.maxHp}%"></span></div><p>${enemy.hp} / ${enemy.maxHp} <small>방어막 ${enemy.shield}</small></p>${statusList(enemy, `${enemy.name} 상태`)}</article>`;
      })
      .join("")}</div>`;
  const enrageStartTurn = E.enrageTurn(b),
    enraged = b.turn >= enrageStartTurn;
  return `<section class="battle ${b.enemyPhase ? "enemy-phase" : "player-phase"}${enraged ? " enraged" : ""}"><div class="battle-top"><p class="eyebrow">${ROOM_NAMES[ROUTE[run.node]]} · ROUND ${b.turn} · ${b.enemyPhase ? "ENEMY PHASE" : "PLAYER PHASE"}</p><span class="${enraged ? "enrage-warning" : ""}">${enraged ? "⚠ 폭주 상태: 매 턴 증가하는 방어 무시 피해!" : b.turn >= enrageStartTurn - 2 ? `⚠ ${enrageStartTurn}턴부터 폭주 관통 피해` : "턴 종료 후 적이 위에서부터 행동합니다"}</span></div><div class="battle-arena">${queue}${field}</div><div class="combat-stats">${combatTerm("AP", b.ap, "카드를 사용할 때 소비하며, 턴이 시작되면 다시 충전됩니다. 카드 왼쪽 위 숫자가 필요한 AP입니다.")}${combatTerm("방어막", b.shield, "받는 피해를 먼저 막습니다. 기본적으로 다음 턴 시작 시 사라지지만 일부 유물은 방어막을 보존합니다.")}${combatTerm("흡수", `${b.absorb} / 100`, "오일과 추출 카드로 쌓는 자원입니다. 공간 확산 같은 카드가 흡수를 소비해 강력한 효과를 냅니다.")}${combatTerm(
    "노트",
    b.notes
      .slice(-2)
      .map((c) => (c.note || CARDS[c.id].note).toUpperCase())
      .join(" → ") || "—",
    "카드는 탑·미들·베이스 노트를 가집니다. 순서를 완성하면 관련 특성과 유물의 연쇄 효과가 발동합니다.",
)}</div><div class="player-effects-row"><button class="battle-potion" data-action="potion" ${potionDisabled || b.enemyPhase ? "disabled" : ""}><span>✚ 회복약 <b>${run.potions}</b></span><small>체력 +20</small></button>${statusList(run, "플레이어 상태")}</div>${b.pendingDiscard ? `<div class="discard-prompt" role="alert"><span aria-hidden="true">↓</span><div><strong>버릴 카드 ${b.pendingDiscard}장을 선택하세요</strong><p>아래 강조된 카드를 누르면 버립니다. 카드 사용 효과는 발동하지 않습니다.</p></div></div>` : ""}<div class="hand ${b.pendingDiscard ? "hand-discard-choice" : ""}">${b.hand.map((c, i) => cardHtml(c, i)).join("")}</div><div class="turn-bar"><span>대상 ${b.selectedTarget + 1} · 생존 ${E.livingEnemies(b).length}/${b.enemies.length}<small>뽑을 카드 ${b.draw.length} · 버린 카드 ${b.discard.length}</small></span><button class="primary" data-action="end" ${b.enemyPhase || b.pendingDiscard ? "disabled" : ""}>${b.pendingDiscard ? "버릴 카드 선택 대기 중" : b.enemyPhase ? "적 행동 진행 중…" : "턴 종료 · 적 페이즈 →"}</button></div></section>`;
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
      return `<section class="room"><p class="eyebrow">DISCOVERY</p><h1>${showItem ? "새로운 조합의 조각" : "조율 성공"}</h1><p>기본 보상: 회복 ${r.heal} · 골드 ${r.gold}${!r.goldIncludesBonus && E.power(run, "goldBonus") ? ` + 보너스 ${E.power(run, "goldBonus")}` : ""}</p>${showItem ? `<div class="reward-item reward-tier-${ITEMS[r.item].tier}">${itemHtml(r.item)}</div><p class="hint">아이템 획득 후 카드 보상이 이어집니다.</p>` : `<p>카드를 선택하세요. <b>남은 선택 ${r.cardPicksRemaining || 1}회</b> · 건너뛰기는 현재 선택 1회만 소모합니다.</p><div class="choices card-reward-choices">${r.cards.map((id) => `<div>${cardHtml({ id, level: 0 })}<button data-action="reward" data-card="${id}">이 카드 추가</button></div>`).join("")}</div>`}<button class="primary" data-action="reward">${showItem ? "카드 보상 확인 →" : `건너뛰기 (${currentPick}/${totalPicks}) →`}</button></section>`;
    }
    case "rest": {
      const choices = E.restCardChoices(run);
      return `<section class="room rest-room"><p class="eyebrow">REST SITE</p><h1>잠시 숨을 고르는 시간</h1><p>체력을 회복하거나, 무작위로 펼쳐진 카드 중 한 장을 영구 강화하세요.</p><button class="primary" data-action="rest-heal">체력 ${Math.ceil(run.maxHp * 0.3)} 회복</button><div class="choices rest-card-choices">${choices.map((index) => { const card = run.deck[index], max = E.cardMaxUpgrade(card); return `<div>${cardHtml(card)}<button data-action="upgrade" data-index="${index}" ${card.level >= max ? "disabled" : ""}>${CARDS[card.id].name} +${card.level} → +${Math.min(max, card.level + 1)} 강화</button></div>`; }).join("") || '<p class="hint">강화할 수 있는 카드가 없습니다. 회복을 선택해 휴식을 마치세요.</p>'}</div></section>`;
    }
    case "shop":
      { const potionPrice = E.shopPrice(run, 25, "potion"), offers = E.shopOffers(run, meta);
        const goods = offers.map((offer, index) => {
          const product = offer.type === "card" ? CARDS[offer.id] : ITEMS[offer.id],
            price = E.shopPrice(run, offer.basePrice, offer.type),
            ownedOut = offer.type === "card"
              ? run.deck.length >= E.deckLimit(run) || run.deck.filter((card) => card.id === offer.id).length >= E.cardMaxCopies(offer.id)
              : false;
          return `<div class="atelier-product reward-tier-${offer.tier}">${offer.type === "card" ? cardHtml({ id: offer.id, level: 0 }) : itemHtml(offer.id)}<button data-action="shop-offer" data-index="${index}" ${offer.sold || ownedOut || run.gold < price ? "disabled" : ""}>${offer.sold ? "판매 완료" : `${product.name} 구매 · ${price} G`}</button></div>`;
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
  else if (room === "purify_furnace") choices = `<button data-action="special-burn_two" ${run.deck.length <= 5 ? "disabled" : ""}><b>화로에 몸 던지기</b><small>체력 -14 · 덱 앞쪽 카드 최대 2장 소멸</small></button><button data-action="special-flame_power"><b>화염 흡수</b><small>영구 공격력 +3 · 매 전투 첫 턴 화상 2</small></button><button data-action="special-skip"><b>지나치기</b><small>아무 일 없이 통과</small></button>`;
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
  grid.insertAdjacentHTML(
    "beforeend",
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
function render() {
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
  if (!started) {
    $("app").innerHTML = lobby();
    return;
  }
  $("app").innerHTML =
    hud() +
    `<div class="play-layout">${statsPanel()}<div class="play-content">${content()}</div>${acquiredPanel()}</div>`;
  mountGoldStat();
  mountDeckCapacity();
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
function showHitFeedback(amount, targetIndex = null, attackPattern = null) {
  const enemy = enemyElement(targetIndex);
  if (!enemy || amount <= 0) return;
  if (attackPattern === "contact") SFX.contactHit();
  else if (attackPattern === "nonContact") SFX.nonContactHit();
  enemy.classList.remove("enemy-hit");
  void enemy.offsetWidth;
  enemy.classList.add("enemy-hit");
  const popup = document.createElement("strong");
  popup.className = "damage-pop";
  popup.textContent = `-${number(amount)}`;
  popup.setAttribute("aria-label", `${number(amount)} 피해`);
  enemy.append(popup);
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
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
function showPlayerDamage(amount, attackPattern = null) {
  const battle = document.querySelector(".battle"),
    stats = document.querySelector(".combat-stats"),
    health = document.querySelector(".stat-row:first-child");
  if (!battle || !stats || amount <= 0) return;
  if (attackPattern === "contact") SFX.contactHit();
  else if (attackPattern === "nonContact") SFX.nonContactHit();
  SFX.playerHit();
  battle.classList.remove("player-hit");
  void battle.offsetWidth;
  battle.classList.add("player-hit");
  for (const [host, className] of [
    [stats, "player-damage-pop"],
    [health, "health-damage-pop"],
  ]) {
    if (!host) continue;
    const popup = document.createElement("strong");
    popup.className = className;
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
  const definition = STATUS_DEFINITIONS[hit.statusId];
  if (!definition || hit.amount <= 0) return;
  const color = definition.color,
    delay = index * 190,
    slot = index % 3;
  setTimeout(() => {
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
function showStatusDamageQueue(hits) {
  hits.forEach(showStatusDamage);
  return hits.length
    ? new Promise((resolve) =>
        setTimeout(resolve, Math.min(700, 130 + hits.length * 190)),
      )
    : Promise.resolve();
}
function showPlayerHealing(amount) {
  const health = document.querySelector(".stat-row:first-child");
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
  battle.classList.remove("shield-block");
  void battle.offsetWidth;
  battle.classList.add("shield-block");
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
  battle.classList.remove("shield-gain");
  shield.classList.remove("shield-stat-gain");
  void battle.offsetWidth;
  battle.classList.add("shield-gain");
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
async function showMonsterDeath(material) {
  const enemy = document.querySelector(".enemy.defeated, .enemy.selected");
  if (!enemy) return;
  SFX.monsterDeath(material);
  const hp = enemy.querySelector(".enemy-hp span");
  if (hp) hp.style.width = "0";
  enemy.classList.add("monster-dying");
  await new Promise((resolve) => setTimeout(resolve, 760));
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
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
async function showEnemyHitQueue(hits) {
  const visibleHits = hits.filter((hit) =>
    Boolean(hit.blocked || (hit.damage && !hit.statusId)),
  );
  for (let index = 0; index < visibleHits.length; index++) {
    const hit = visibleHits[index];
    if (hit.blocked)
      showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage);
    if (hit.damage && !hit.statusId)
      showHitFeedback(hit.damage, hit.targetIndex, hit.attackPattern);
    if (visibleHits.length > 1 && index < visibleHits.length - 1)
      await sleep(150);
  }
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
    const outcome = E.executeSingleEnemyAction(run, index, meta);
    if (!outcome) break;
    if (run.phase !== "battle" || outcome.playerDied) {
      save();
      render();
      cardAnimating = false;
      return;
    }
    run.battle.actingEnemy = index;
    render();
    const enemyBox = document.querySelector(`.enemy[data-target="${index}"]`);
    if (outcome.type === "attack") {
      enemyBox?.classList.add("enemy-attack-lunge");
      showEnemyActionPopup(
        index,
        outcome.damage
          ? `공격! -${outcome.damage}`
          : `방어됨 ${outcome.blocked}`,
        "attack-popup",
      );
      if (outcome.blocked)
        showShieldBlock(outcome.blocked, !outcome.damage);
      if (outcome.damage)
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
        showHitFeedback(hit.damage, hit.targetIndex, hit.attackPattern);
    }
    showStatusDamageQueue(statusHits);
    await sleep(420);
    if (run.phase !== "battle") break;
    run.battle.actingEnemy = null;
    save();
    render();
  }
  if (run.phase === "battle") {
    E.executeRoundEnd(run, meta);
    const statusHits = run._damageFeedback || [],
      enemyHits = run._enemyHitFeedback || [],
      enrageHit = run._enrageFeedback?.damage || 0,
      drawn = run.phase === "battle" ? run.battle.drawnThisTurn || 0 : 0;
    if (statusHits.some((hit) => hit.target === "player" && hit.amount > 0))
      playerTookStatusDamage = true;
    delete run._damageFeedback;
    delete run._enemyHitFeedback;
    delete run._enrageFeedback;
    save();
    render();
    if (drawn) await showDrawFeedback(drawn);
    for (const hit of enemyHits) {
      if (hit.blocked)
        showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage);
      if (hit.damage && !hit.statusId)
        showHitFeedback(hit.damage, hit.targetIndex, hit.attackPattern);
    }
    await showStatusDamageQueue(statusHits);
    if (playerTookStatusDamage) SFX.playerHit();
    if (enrageHit) showEnrageDamage(enrageHit);
  }
  cardAnimating = false;
}
let startingDeckSelection = [];
let startingDeckCategory = null;
let startingDeckFilter = "all";
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
function startingDeckDialog() {
  let dialog = $("starting-deck-builder");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "starting-deck-builder";
  dialog.className = "starting-deck-builder";
  dialog.innerHTML = `<div class="dialog-head"><div><small id="builder-eyebrow">PERFUMER'S TRAVEL BAG</small><h2 id="builder-title">시작 덱 편성</h2></div><button data-builder-action="close">닫기</button></div><div id="builder-content-tabs" class="builder-content-tabs" hidden><button data-builder-action="content" data-content="cards">카드 덱</button><button data-builder-action="content" data-content="items">증강 · 아이템</button></div><section class="builder-tray"><div class="builder-heading"><h3>선택된 카드 <b id="builder-count"></b></h3><div><button id="builder-preset" data-builder-action="preset">기본 추천 덱 채우기</button><button data-builder-action="clear">전체 비우기</button></div></div><div id="builder-selected" class="builder-selected"></div><div id="builder-item-selection" hidden><div class="builder-heading"><h3>선택된 증강 <b id="builder-item-count"></b></h3><button data-builder-action="clear-items">증강 비우기</button></div><div id="builder-selected-items" class="builder-selected"></div></div></section><section><h3>카드</h3><div id="builder-pool" class="builder-pool"></div></section><button id="builder-start" class="primary builder-start" data-builder-action="start"></button>`;
  document.body.append(dialog);
  const poolSection = $("builder-pool").parentElement;
  poolSection.innerHTML = `<div class="builder-heading builder-navigation"><h3 id="builder-category-title" tabindex="-1">카테고리 선택</h3><button data-builder-action="back" hidden>← 카테고리로 돌아가기</button></div><div id="builder-filters" class="builder-filters" hidden></div><div id="builder-categories" class="builder-categories"></div><div id="builder-pool" class="builder-pool" hidden></div>`;
  dialog.addEventListener("click", (event) => {
    const button = event.target.closest("[data-builder-action]");
    if (!button) return;
    const action = button.dataset.builderAction, id = button.dataset.card;
    if (action === "close") dialog.close();
    else if (action === "content" && startingDeckTestMode) { startingBuilderContent = button.dataset.content; startingDeckCategory = null; }
    else if (action === "category" && (startingBuilderContent === "items" ? startingItemCategories : startingDeckCategories).some((category) => category.id === button.dataset.category)) {
      startingDeckCategory = button.dataset.category;
      startingDeckFilter = "all";
    }
    else if (action === "filter") startingDeckFilter = button.dataset.filter;
    else if (action === "back") { startingDeckCategory = null; startingDeckFilter = "all"; }
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
  $("builder-selected").innerHTML = startingDeckSelection.length
    ? startingDeckSelection.map((id, index) => `<button data-builder-action="remove" data-index="${index}"><span>−</span><b>${CARDS[id].name}</b></button>`).join("")
    : "<p>가방이 비어 있습니다. 아래에서 카드를 골라주세요.</p>";
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
  $("builder-filters").innerHTML = startingDeckTestMode
    ? testDeckFilters.map(([id, label]) => `<button data-builder-action="filter" data-filter="${id}" class="${startingDeckFilter === id ? "active" : ""}">${label}</button>`).join("")
    : "";
  $("builder-categories").innerHTML = startingDeckCategories.map((entry) => {
    const available = cards.filter((card) => startingCardCategory(card) === entry.id).length;
    const selected = startingDeckSelection.filter((id) => startingCardCategory(CARDS[id]) === entry.id).length;
    return `<button class="builder-category builder-category-${entry.id}" data-builder-action="category" data-category="${entry.id}"><span aria-hidden="true">${entry.icon}</span><strong>${entry.name} →</strong><small>${entry.description}</small><b>${available}종 · 선택 ${selected}장</b></button>`;
  }).join("");
  const visibleCards = category ? cards.filter((card) =>
    startingCardCategory(card) === category.id && (!startingDeckTestMode || matchesTestDeckFilter(card))) : [];
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
  startingDeckSelection = startingDeckTestMode ? [] : validStartingDeck(meta.lastStartingDeck)
    ? [...meta.lastStartingDeck] : [...RECOMMENDED_STARTING_DECK];
  const dialog = startingDeckDialog();
  renderStartingDeckBuilder();
  dialog.showModal();
}
let pendingRewardCard = null;
function replacementDialog() {
  let dialog = $("deck-replace");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "deck-replace";
  dialog.innerHTML =
    '<div class="dialog-head"><div><small id="deck-replace-limit"></small><h2>교체할 카드를 선택하세요</h2></div><button id="deck-replace-close">취소</button></div><p id="deck-replace-copy"></p><div id="deck-replace-list" class="deck-replace-grid"></div>';
  document.body.append(dialog);
  $("deck-replace-close").onclick = () => {
    pendingRewardCard = null;
    dialog.close();
  };
  dialog.addEventListener("cancel", () => {
    pendingRewardCard = null;
  });
  dialog.addEventListener("click", (event) => {
    const button = event.target.closest("[data-replace-index]");
    if (!button || !pendingRewardCard) return;
    const index = Number(button.dataset.replaceIndex);
    if (!E.advance(run, pendingRewardCard, index, meta)) return;
    pendingRewardCard = null;
    dialog.close();
    save();
    render();
  });
  return dialog;
}
function requestDeckReplacement(cardId) {
  if (!run?.reward?.cards.includes(cardId)) return;
  pendingRewardCard = cardId;
  const dialog = replacementDialog(),
    chosen = CARDS[cardId],
    limit = E.deckLimit(run);
  $("deck-replace-limit").textContent = `DECK LIMIT · ${limit}`;
  $("deck-replace-copy").textContent =
    `덱이 ${limit}장으로 가득 찼습니다. 아래 카드 한 장을 버리고 새 카드를 받습니다.`;
  $("deck-replace-list").innerHTML = run.deck
    .map(
      (card, index) =>
        `<div>${cardHtml(card)}<button data-replace-index="${index}">${CARDS[card.id].name} 버리고<br><b>${chosen.name}</b> 받기</button></div>`,
    )
    .join("");
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
    if (E.discardFromHand(run, Number(button.dataset.index), meta)) { save(); render(); }
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
    beforeEnemies = run?.battle?.enemies.map((enemy) => ({
      hp: enemy.hp,
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
  }
  if (action === "play") {
    cardAnimating = true;
    const spent = E.cost(run, run.battle.hand[index]);
    SFX.cardPlay();
    if (startingCardCategory(playedCard) === "absorb") SFX.absorbCard();
    showApSpend(button, spent);
    button.classList.add("card-discarding");
    await new Promise((resolve) => setTimeout(resolve, 260));
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
    drawn =
      run?.phase === "battle" && ["enter", "end"].includes(action)
        ? run.battle.drawnThisTurn || 0
        : 0,
    killingBlow =
      beforeEnemyHp !== null &&
      beforeEnemyHp > 0 &&
      run?.phase === "reward" &&
      afterEnemyHp === 0,
    killedMonster = beforeEnemies?.find(
      (enemy, enemyIndex) =>
        enemy.hp > 0 && (run?.battle?.enemies[enemyIndex]?.hp || 0) <= 0,
    ),
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
  }
  if (killingBlow) {
    cardAnimating = true;
    showHarmonyFeedback(harmonyTriggers);
    await showEnemyHitQueue(enemyHits);
    await showStatusDamageQueue(statusHits);
    await new Promise((resolve) => setTimeout(resolve, 130));
    await showMonsterDeath(killedMonster?.material);
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
  if (drawn) {
    cardAnimating = true;
    await showDrawFeedback(drawn);
  }
  showHarmonyFeedback(harmonyTriggers);
  await showEnemyHitQueue(enemyHits);
  if (blockedDamage) showShieldBlock(blockedDamage);
  if (playerDamage) showPlayerDamage(playerDamage);
  showStatusDamageQueue(statusHits);
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
$("glossary-close").onclick = () => $("glossary").close();
document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-glossary-open]")) return;
  $("glossary-list").innerHTML = glossaryHtml();
  $("glossary").showModal();
});
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
      ".hand,.card-reward-choices,.summary-card-grid",
    );
    if (
      !scroller ||
      (scroller.classList.contains("summary-card-grid") &&
        !matchMedia("(max-width: 900px)").matches) ||
      scroller.scrollWidth <= scroller.clientWidth ||
      Math.abs(event.deltaX) >= Math.abs(event.deltaY)
    )
      return;
    scroller.scrollLeft += event.deltaY;
    event.preventDefault();
  },
  { passive: false },
);
document.addEventListener("click", (event) => {
  const open = event.target.closest("[data-log-open]");
  if (open) {
    const list = $("battle-log-list");
    list.replaceChildren();
    if (!run?.log.length) {
      const empty = document.createElement("p");
      empty.className = "log-empty";
      empty.textContent = "아직 기록된 전투 행동이 없습니다.";
      list.append(empty);
    } else
      run.log.forEach((entry, index) => {
        const row = document.createElement("div");
        row.className = "log-row";
        const order = document.createElement("small");
        order.textContent = String(run.log.length - index).padStart(2, "0");
        const text = document.createElement("span");
        text.textContent = entry;
        row.append(order, text);
        list.append(row);
      });
    $("battle-log").showModal();
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
$("mobile-preview").onclick = () => {
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
  $("codex-progress").innerHTML = `<div class="codex-progress-copy"><strong>✦ ${title} · 종합 수집률</strong><span>${progress.found} / ${progress.total} (${progress.percent}%)</span></div><div class="codex-progress-track" role="progressbar" aria-label="전투도감 수집률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}"><i style="width:${progress.percent}%"></i></div><div class="codex-milestones">${milestones.map(([rate, label]) => `<small class="${progress.percent >= rate ? "earned" : ""}">${progress.percent >= rate ? "✓" : "◇"} ${rate}% ${label}</small>`).join("")}</div>`;
  codexTabs($("codex-major"), [["augment", "증강"], ["monster", "몬스터"]], codexState.major, "major");
  if (codexState.major === "augment") {
    if (!CODEX_AUGMENTS[codexState.middle]) codexState.middle = "cards";
    codexTabs($("codex-middle"), Object.entries(CODEX_AUGMENTS).map(([id, group]) => [id, group.label]), codexState.middle, "middle");
    const tiers = codexState.middle === "cards" ? [1, 2, 3, 4] : [0, 1, 2, 3];
    if (!tiers.includes(Number(codexState.minor))) codexState.minor = String(tiers[0]);
    codexTabs($("codex-minor"), tiers.map((tier) => [String(tier), `${codexState.middle === "cards" ? tier : tier + 1}티어${codexState.middle === "cards" ? "" : ` · ${RARITIES[tier]}`}`]), codexState.minor, "minor");
    const entries = CODEX_AUGMENTS[codexState.middle].entries().filter((entry) => entry.tier === Number(codexState.minor));
    $("codex-view").innerHTML = `<p class="codex-count">${CODEX_AUGMENTS[codexState.middle].label} · ${codexState.middle === "cards" ? Number(codexState.minor) : Number(codexState.minor) + 1}티어 · ${entries.length}종</p><div class="codex-grid">${entries.map((entry) => codexState.middle === "cards" ? codexCardEntry(entry) : codexItemEntry(entry)).join("") || "<p>등록된 항목이 없습니다.</p>"}</div>`;
  } else {
    if (!CODEX_MONSTERS[codexState.middle]) codexState.middle = "act1";
    if (!CODEX_MONSTER_TYPES[codexState.minor]) codexState.minor = "normal";
    codexTabs($("codex-middle"), Object.entries(CODEX_MONSTERS).map(([id, act]) => [id, act.label]), codexState.middle, "middle");
    codexTabs($("codex-minor"), Object.entries(CODEX_MONSTER_TYPES), codexState.minor, "minor");
    const entries = Object.values(CODEX_MONSTERS[codexState.middle][codexState.minor]);
    $("codex-view").innerHTML = `<p class="codex-count">${CODEX_MONSTERS[codexState.middle].label} · ${CODEX_MONSTER_TYPES[codexState.minor]} · ${entries.length}종</p><div class="codex-grid codex-monster-grid">${entries.map(codexMonsterEntry).join("") || "<p>현재 등록된 몬스터가 없습니다.</p>"}</div>`;
  }
}
$("tools").addEventListener("click", (event) => {
  const button = event.target.closest("[data-codex-level]");
  if (!button) return;
  const level = button.dataset.codexLevel;
  codexState[level] = button.dataset.codexValue;
  if (level === "major") {
    codexState.middle = codexState.major === "augment" ? "cards" : "act1";
    codexState.minor = codexState.major === "augment" ? "1" : "normal";
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

renderCodex();
if (loadedSave.migrated || loadedSave.recovered) save();
render();
if (loadedSave.recovered)
  $("notice").textContent =
    "이전 저장본에 문제가 있어 안전한 백업 시점으로 복구했습니다.";
window.addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") save();
});

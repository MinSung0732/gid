import * as E from "./engine.js?v=20260918-1";
import { CARDS, ITEMS, PLAYER_HELP, RARITIES } from "./data.js?v=20260918-3";
import { STATUS_DEFINITIONS } from "./statuses.js?v=20260911-4";
import { polishBattleUi } from "./combat-layout-phase2-finish.js?v=20260915-4";
import { syncHarmonyUi } from "./harmony-core-ui.js?v=20260915-2";
import { syncPlayerSupportUi } from "./player-support-ui.js?v=20260918-1";
import { syncCardDetails } from "./card-detail-dedupe.js?v=20260915-4";
import { syncImpurityUi } from "./impurity-ui.js?v=20260915-6";
import { syncEconomyUi } from "./economy-ui.js?v=20260915-3";
import { queueHandSync } from "./hand-swipe-fix.js?v=20260915-5";
import { renderPcRoute } from "./pc-route-ui.js?v=20260917-1";
import { syncRoomBackground } from "./room-background-ui.js?v=20260918-4";

const app = document.getElementById("app"),
  desktop = window.matchMedia("(min-width: 901px)"),
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const metrics = {
  renderBoundaryRuns: 0,
  finalizerRuns: 0,
  observerCallbacks: 0,
};
const animationDiagnostics = {
  reducedMotion: reducedMotion.matches,
  reward: null,
  upgrade: null,
};
const REWARD_ANIMATIONS = new Set(["reward-flip-in", "reward-rarity-glow"]);
const UPGRADE_ANIMATIONS = new Set([
  "rest-upgrade-result-reveal",
  "rest-upgrade-glow",
  "rest-upgrade-spark",
  "rest-upgrade-copy-in",
]);

const BUILD_META = Object.freeze({
  contact: { label: "접촉 연계", icon: "⚔" },
  noncontact: { label: "비접촉", icon: "✦" },
  absorb: { label: "흡수", icon: "◆" },
  "absorb-burst": { label: "흡수 버스트", icon: "◆" },
  shield: { label: "방어막", icon: "⬡" },
  heal: { label: "회복", icon: "♥" },
  oil: { label: "오일", icon: "◈" },
  status: { label: "상태이상", icon: "▼" },
  harmony: { label: "하모니 순환", icon: "◇" },
});

const ITEM_EFFECT_SUPPORT = Object.freeze({
  contact: new Set([
    "contactIgnite",
    "contactBleed",
    "contactShield",
    "comboContact",
    "firstTurnContact",
    "retainedBonusDamage",
  ]),
  noncontact: new Set([
    "nonContactPoison",
    "firstNonContactBonus",
    "nonContactAbsorb",
    "nonContactWeak",
  ]),
  absorb: new Set([
    "absorbOnEnd",
    "absorbSpillShield",
    "nonContactAbsorb",
    "absorbCostHeal",
    "highAbsorbAttack",
    "absorbChainRefund",
    "absorbDecaySoftener",
    "absorbGainFlat1",
    "openingAbsorb",
  ]),
  shield: new Set([
    "shieldHit",
    "thornsOnGuard",
    "retainedShield",
    "thornsCorrode",
    "shieldRetainPercent",
    "openingShield",
    "oilShield",
    "regenShield",
  ]),
  heal: new Set([
    "overflow",
    "lowHpDefense",
    "regenShield",
    "absorbCostHeal",
    "battleEndHeal",
    "middleHeal",
    "oilHeal",
  ]),
  oil: new Set([
    "oilShield",
    "oilAttack",
    "oilAbsorbRatio",
    "reduceOilCost",
    "oilHeal",
  ]),
  status: new Set([
    "burningBonus",
    "corrosionTickDamage",
    "bleedLeech",
    "poisonSpread",
    "contactIgnite",
    "contactBleed",
    "nonContactPoison",
    "nonContactWeak",
  ]),
  harmony: new Set([
    "topShield",
    "middleHeal",
    "baseDamage",
    "harmonyBonus",
    "harmonyEchoDamage",
    "harmonyAoeTrueDamage",
    "harmonyDebuffStorm",
    "harmonyWeakAll",
    "harmonyReplayBothCards",
    "harmonyReplayCard",
  ]),
});

const SYNERGY_BUILD_SUPPORT = Object.freeze({
  novice_pestle: ["contact"],
  pressurized_airflow: ["noncontact", "status"],
  morning_chamomile: ["heal", "shield"],
  hardened_wax_seal: ["shield"],
  brass_scales_funnel: ["absorb"],
  grand_trinity: ["harmony"],
  diamond_bastion: ["shield"],
  supercritical_void: ["absorb", "absorb-burst", "status"],
  dew_petals: ["oil", "heal"],
  sealed_impact: ["shield", "contact"],
});

const STATUS_APPLICATION_FIELDS = [
  "applyEnemy",
  "applyEnemyAfterAttack",
  "onHitApplyEnemy",
  "conditionalEnemyIntent",
  "absorbThresholdApplyAllEnemy",
];
const STATUS_INTERACTION_FIELDS = [
  "chanceStatusOnHit",
  "bonusPerStatus",
  "consumeResonance",
  "burnProcCount",
  "applyEnemyIfPreAttackStatus",
  "ailmentBurstMultiplier",
  "globalAilmentBurstMultiplier",
  "amplifyAilments",
  "thornsApplyAttacker",
  "applyWeak",
  "weakOnHit",
  "stunOrDisarmBossTurns",
];
const ABSORB_INTERACTION_FIELDS = [
  "requiredAbsorb",
  "absorbCost",
  "absorbBonusRatio",
  "absorbFromDamage",
  "absorbAmplifyRatio",
  "absorbBooster",
  "preventAbsorbDecay",
  "refundAbsorbThreshold",
  "absorbStatusThreshold",
  "absorbThresholdApplyAllEnemy",
  "burstMultiplier",
];
const SHIELD_INTERACTION_FIELDS = [
  "shieldScaling",
  "weight",
  "shieldCounter",
  "shieldScalingAttack",
  "shieldSurvivalHeal",
  "thorns",
  "shieldDamageMultiplier",
  "shieldThreshold",
  "retainShield",
];
const HEAL_INTERACTION_FIELDS = [
  "missingHpHealRatio",
  "comboHealThreshold",
  "harmonyHealShield",
  "overhealShieldRatio",
  "shieldSurvivalHeal",
];
const CONTACT_INTERACTION_FIELDS = ["comboContactBonus", "battleContactBonus"];

let currentRenderRun = null;

function number(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value) || 0);
}

function parseNumbers(text = "") {
  return [...String(text).matchAll(/-?\d[\d,]*/g)].map((match) =>
    Number(match[0].replaceAll(",", "")),
  );
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hasStructuredValue(value) {
  if (value == null || value === false || value === 0 || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object")
    return Object.values(value).some((entry) => hasStructuredValue(entry));
  return true;
}

function hasAnyField(definition, fields) {
  return fields.some((field) => hasStructuredValue(definition?.[field]));
}

function synergyProgresses(run) {
  try {
    return E.synergyProgresses(run) || [];
  } catch {
    return [];
  }
}

function createCandidate(id) {
  return {
    id,
    label: BUILD_META[id].label,
    icon: BUILD_META[id].icon,
    score: 0,
    cardCount: 0,
    advancedCount: 0,
    itemCount: 0,
    synergyCount: 0,
    reasons: [],
    detail: "",
    qualified: false,
  };
}

function scoreCandidate(candidate) {
  candidate.score =
    candidate.cardCount +
    candidate.advancedCount * 2 +
    candidate.itemCount * 2 +
    candidate.synergyCount * 3;
  return candidate;
}

export function analyzeBuild(run) {
  const candidates = Object.fromEntries(
      Object.keys(BUILD_META).map((id) => [id, createCandidate(id)]),
    ),
    notes = { top: 0, middle: 0, base: 0 },
    synergyProgress = synergyProgresses(run),
    active = synergyProgress.filter((synergy) => synergy.active),
    deck = Array.isArray(run?.deck) ? run.deck : [],
    inventory = Array.isArray(run?.inventory) ? run.inventory : [];

  let absorbCards = 0,
    absorbConsumers = 0,
    burstCards = 0;

  for (const held of deck) {
    let definition = null;
    try {
      definition = E.cardDefinition(held);
    } catch {}
    definition ||= CARDS[held?.id];
    if (!definition) continue;

    const note = held.note || definition.note;
    if (Object.hasOwn(notes, note)) notes[note] += 1;

    const attack = Boolean(definition.attack || definition.burst || definition.weight),
      pattern = definition.attackPattern || (attack ? "contact" : null),
      contactAdvanced = hasAnyField(definition, CONTACT_INTERACTION_FIELDS),
      absorbProducer = Number(definition.absorb || 0) > 0,
      absorbInteraction = hasAnyField(definition, ABSORB_INTERACTION_FIELDS),
      shieldProducer = Number(definition.shield || 0) > 0,
      shieldInteraction = hasAnyField(definition, SHIELD_INTERACTION_FIELDS),
      healProducer = Number(definition.heal || 0) > 0,
      healInteraction = hasAnyField(definition, HEAL_INTERACTION_FIELDS),
      oilCard = Boolean(definition.oil),
      statusApplication = hasAnyField(definition, STATUS_APPLICATION_FIELDS),
      statusInteraction = hasAnyField(definition, STATUS_INTERACTION_FIELDS),
      harmonyInteraction = Object.keys(definition).some(
        (key) => key.toLowerCase().includes("harmony") && hasStructuredValue(definition[key]),
      );

    if (attack && pattern === "contact") candidates.contact.cardCount += 1;
    if (contactAdvanced) candidates.contact.advancedCount += 1;

    if (attack && pattern === "nonContact") candidates.noncontact.cardCount += 1;
    if (
      pattern === "nonContact" &&
      (statusApplication || statusInteraction || absorbInteraction)
    )
      candidates.noncontact.advancedCount += 1;

    if (absorbProducer) {
      absorbCards += 1;
      candidates.absorb.cardCount += 1;
      candidates["absorb-burst"].cardCount += 1;
    }
    if (absorbInteraction) {
      absorbConsumers += 1;
      candidates.absorb.advancedCount += 1;
      candidates["absorb-burst"].advancedCount += 1;
    }
    if (definition.burst) burstCards += 1;

    if (shieldProducer) candidates.shield.cardCount += 1;
    if (shieldInteraction) candidates.shield.advancedCount += 1;

    if (healProducer) candidates.heal.cardCount += 1;
    if (healInteraction) candidates.heal.advancedCount += 1;

    if (oilCard) candidates.oil.cardCount += 1;

    if (statusApplication) candidates.status.cardCount += 1;
    if (statusInteraction) candidates.status.advancedCount += 1;

    if (harmonyInteraction) candidates.harmony.advancedCount += 1;
  }

  for (const id of inventory) {
    const effect = ITEMS[id]?.effect;
    if (!effect) continue;
    for (const [buildId, effects] of Object.entries(ITEM_EFFECT_SUPPORT))
      if (effects.has(effect)) candidates[buildId].itemCount += 1;
  }

  for (const synergy of active) {
    for (const buildId of SYNERGY_BUILD_SUPPORT[synergy.id] || [])
      candidates[buildId].synergyCount += 1;
  }

  for (const candidate of Object.values(candidates)) scoreCandidate(candidate);

  const support = (candidate) =>
    candidate.advancedCount + candidate.itemCount + candidate.synergyCount;

  candidates.contact.qualified =
    candidates.contact.cardCount >= 3 && support(candidates.contact) >= 2;
  candidates.noncontact.qualified =
    candidates.noncontact.cardCount >= 4 && support(candidates.noncontact) >= 1;
  candidates.absorb.qualified =
    absorbCards >= 2 && support(candidates.absorb) >= 1;
  candidates["absorb-burst"].qualified =
    absorbCards >= 2 && burstCards >= 1 && absorbConsumers >= 1;
  candidates.shield.qualified =
    candidates.shield.cardCount >= 2 && support(candidates.shield) >= 2;
  candidates.heal.qualified =
    candidates.heal.cardCount >= 2 && support(candidates.heal) >= 1;
  candidates.oil.qualified =
    candidates.oil.cardCount >= 2 &&
    candidates.oil.itemCount + candidates.oil.synergyCount >= 1;
  candidates.status.qualified =
    candidates.status.cardCount >= 2 && support(candidates.status) >= 1;

  const noteValues = Object.values(notes),
    noteMin = Math.min(...noteValues),
    noteMax = Math.max(...noteValues),
    harmonySupport = support(candidates.harmony);
  candidates.harmony.cardCount = noteValues.reduce((sum, value) => sum + value, 0);
  candidates.harmony.score =
    Math.max(0, noteMin * 2 - (noteMax - noteMin)) +
    candidates.harmony.advancedCount * 2 +
    candidates.harmony.itemCount * 2 +
    candidates.harmony.synergyCount * 3;
  candidates.harmony.qualified =
    noteMin >= 2 && noteMax - noteMin <= 2 && harmonySupport >= 1;

  if (candidates["absorb-burst"].qualified) candidates.absorb.qualified = false;

  const details = {
    contact: `접촉 ${candidates.contact.cardCount} · 연계 ${candidates.contact.advancedCount}`,
    noncontact: `비접촉 ${candidates.noncontact.cardCount} · 연계 ${candidates.noncontact.advancedCount}`,
    absorb: `흡수 ${absorbCards} · 연계 ${candidates.absorb.advancedCount}`,
    "absorb-burst": `흡수 ${absorbCards} · Burst ${burstCards}`,
    shield: `방어막 ${candidates.shield.cardCount} · 활용 ${candidates.shield.advancedCount}`,
    heal: `회복 ${candidates.heal.cardCount} · 연계 ${candidates.heal.advancedCount}`,
    oil: `오일 ${candidates.oil.cardCount} · 지원 ${candidates.oil.itemCount + candidates.oil.synergyCount}`,
    status: `상태 ${candidates.status.cardCount} · 연계 ${candidates.status.advancedCount}`,
    harmony: `TOP ${notes.top} · MID ${notes.middle} · BASE ${notes.base}`,
  };

  for (const candidate of Object.values(candidates)) {
    candidate.detail = details[candidate.id];
    if (candidate.cardCount)
      candidate.reasons.push(
        candidate.id === "harmony"
          ? details.harmony
          : `관련 카드 ${candidate.cardCount}장`,
      );
    if (candidate.advancedCount)
      candidate.reasons.push(`구조화 연계 ${candidate.advancedCount}개`);
    if (candidate.itemCount)
      candidate.reasons.push(`관련 특성·유물 ${candidate.itemCount}개`);
    if (candidate.synergyCount)
      candidate.reasons.push(`관련 활성 시너지 ${candidate.synergyCount}개`);
    if (candidate.id === "absorb-burst" && burstCards)
      candidate.reasons.splice(1, 0, `Burst 카드 ${burstCards}장`);
  }

  const qualified = Object.values(candidates)
      .filter((candidate) => candidate.qualified)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.synergyCount - a.synergyCount ||
          b.advancedCount - a.advancedCount,
      ),
    primary = qualified[0] || null,
    secondaryCandidate = qualified[1] || null,
    secondary =
      primary &&
      secondaryCandidate &&
      secondaryCandidate.score >= Math.max(5, Math.floor(primary.score * 0.7))
        ? secondaryCandidate
        : null,
    mixed = Boolean(primary && secondary && Math.abs(primary.score - secondary.score) <= 1);

  return {
    mode: !primary ? "forming" : mixed ? "mixed" : "defined",
    primary,
    secondary,
    notes,
    activeSynergies: active,
    synergyProgress,
  };
}

function candidateReason(candidate) {
  return [candidate.label, candidate.detail, ...candidate.reasons].join(" · ");
}

function buildCoreMarkup(profile) {
  if (!profile.primary)
    return '<div class="build-empty"><strong>빌드 형성 중</strong><small>카드와 조향 원료를 모으면<br>주요 방향이 표시됩니다.</small></div>';

  const builds = [profile.primary, profile.secondary].filter(Boolean),
    state = profile.mode === "mixed"
      ? '<div class="build-mode build-mode-mixed">혼합형</div>'
      : "";
  return `${state}<div class="build-core-list">${builds
    .map(
      (candidate, index) =>
        `<div class="build-core-slot"><span class="build-slot-label">${index ? "보조 빌드" : "주 빌드"}</span><div class="build-core-card" title="${escapeHtml(candidateReason(candidate))}" aria-label="${escapeHtml(candidateReason(candidate))}"><span class="build-core-icon" aria-hidden="true">${candidate.icon}</span><span class="build-core-copy"><strong>${escapeHtml(candidate.label)}</strong><small>${escapeHtml(candidate.detail)}</small></span></div></div>`,
    )
    .join("")}</div>`;
}

function activeSynergyMarkup(profile) {
  const progress = profile.synergyProgress || [];
  if (!progress.length)
    return '<p class="build-compact-empty">세트 정보 없음</p>';
  return `<div class="active-synergy-list">${progress
    .map(
      (synergy) =>
        `<div class="active-synergy-row ${synergy.active ? "is-active" : "is-pending"}" data-synergy-tip-name="${escapeHtml(synergy.name)}" data-synergy-tip-body="${escapeHtml(synergy.description || "활성 시너지 효과")}" tabindex="0" aria-label="${escapeHtml(`${synergy.name}. ${synergy.ownedCount} / ${synergy.total}. ${synergy.description || "활성 시너지 효과"}`)}"><span aria-hidden="true">${synergy.active ? "✦" : "◇"}</span><strong>${escapeHtml(synergy.name)}</strong><b class="synergy-progress">${synergy.ownedCount} / ${synergy.total}</b></div>`,
    )
    .join("")}</div>`;
}
function itemCountRows(run, kind) {
  const counts = new Map();
  for (const id of run.inventory || []) {
    if (ITEMS[id]?.kind !== kind) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.entries()].map(([id, count]) => ({ id, count, item: ITEMS[id] }));
}

function itemSectionMarkup(title, icon, rows) {
  return `<section class="run-build-items-section"><div class="run-build-subhead"><span>${title}</span><b>${rows.length}</b></div>${rows.length
    ? rows
        .map(({ item, count }) => {
          const rarity = RARITIES[item.tier] || `T${item.tier}`;
          return `<div class="run-build-item tier-mark-${item.tier}"><i aria-hidden="true">${icon}</i><div><strong>${escapeHtml(item.name)}${count > 1 ? ` ×${count}` : ""}</strong><small><em>${escapeHtml(rarity)}</em>${item.description ? ` · ${escapeHtml(item.description)}` : ""}</small></div></div>`;
        })
        .join("")
    : '<p class="run-build-item-empty">없음</p>'}</section>`;
}

function acquiredPanelMarkup(run) {
  const profile = analyzeBuild(run),
    traits = itemCountRows(run, "trait"),
    relics = itemCountRows(run, "relic"),
    empty = !traits.length && !relics.length
      ? '<p class="run-build-acquired-empty">아직 획득한 특성이나 유물이 없습니다.</p>'
      : "";
  return `<section class="run-build-core" aria-label="Build Core"><h3>BUILD CORE</h3>${buildCoreMarkup(profile)}</section><section class="run-build-synergy" aria-label="활성 시너지"><h3>ACTIVE SYNERGY</h3>${activeSynergyMarkup(profile)}</section><div class="run-build-divider" aria-hidden="true"></div><div class="run-build-acquired acquired-list">${empty}${itemSectionMarkup("특성", "✦", traits)}${itemSectionMarkup("유물", "◇", relics)}</div>`;
}

function statusMarkup(run) {
  const entries = Object.entries(run?.statuses || {}).filter(
    ([id, status]) => STATUS_DEFINITIONS[id] && Number(status?.stacks) > 0,
  );
  if (!entries.length)
    return '<p class="player-status-empty">현재 적용 중인 상태 없음</p>';
  return `<div class="player-core-status-list">${entries
    .map(([id, status]) => {
      const definition = STATUS_DEFINITIONS[id],
        turns = status.turns ? ` · ${status.turns}턴` : "";
      return `<button type="button" class="status-chip status-${definition.kind}" data-term aria-expanded="false" style="--status-color:${definition.color}"><span>${definition.icon}</span><b>${escapeHtml(definition.name)} ${status.stacks}${turns}</b><span class="term-tip" role="tooltip">${escapeHtml(status.description || definition.description)}<br>현재 ${status.stacks} / 최대 ${definition.maxStacks}중첩${status.turns ? `<br>남은 ${status.turns} / 최대 ${definition.maxTurns}턴` : ""}</span></button>`;
    })
    .join("")}</div>`;
}

function impurityButtonBadge(run) {
  const countCards = (cards) =>
      Array.isArray(cards)
        ? cards.reduce((count, card) => count + (card?.id === "impurity" ? 1 : 0), 0)
        : 0,
    inBattle = run?.phase === "battle" && run.battle,
    shown = inBattle
      ? [run.battle.draw, run.battle.hand, run.battle.discard].reduce(
          (sum, pile) => sum + countCards(pile),
          0,
        )
      : countCards(run?.deck),
    pending = Math.max(0, Number(run?.pendingImpurities) || 0);
  if (!shown && !pending) return "";
  return `<span class="impurity-deck-button-badge phase5-impurity-badge" aria-hidden="true"><b>☣ ${shown}</b>${pending ? `<small>예정 +${pending}</small>` : ""}</span>`;
}

function playerHelpAttributes(key) {
  const help = PLAYER_HELP[key];
  if (!help) return "";
  const title = escapeHtml(help.label),
    body = escapeHtml(help.description);
  return ` data-player-help data-player-help-title="${title}" data-player-help-body="${body}" tabindex="0" aria-label="${title}. ${body}"`;
}

function playerPanelMarkup(run) {
  const attack = E.power(run, "attack"),
    defense = E.power(run, "defense"),
    draw = E.power(run, "draw"),
    augmentCardCount =
      (Array.isArray(run?.deck) ? run.deck.length : 0) +
      (Array.isArray(run?.inventory) ? run.inventory.length : 0),
    impurityBadge = impurityButtonBadge(run),
    stats = [
      ["⚔", "공격력", attack ? `${attack > 0 ? "+" : ""}${attack}` : "0", "attack"],
      ["◆", "방어력", defense ? `${defense > 0 ? "+" : ""}${defense}` : "0", "defense"],
      ["⚡", "AP 기본 / 상한", `${E.turnStartAp(run)} / ${E.apLimit(run)}`, "ap"],
      ["▤", "손패 한도", `${E.handLimit(run)}장`, "handLimit"],
      ["▦", "최대 덱 한도", `${run.deck.length} / ${E.deckLimit(run)}장`, "deckLimit"],
      ["◇", "첫 턴 패", `${5 + draw}장`, "firstHand"],
      ["↻", "턴 드로우", `${3 + draw}장`, "turnDraw"],
    ];
  return `<div class="stats-title"><span>MY HARMONY</span><strong>내 능력치</strong></div><div class="player-core-stats">${stats
    .map(
      ([icon, label, value, helpKey]) =>
        `<div class="player-core-stat"${playerHelpAttributes(helpKey)}><i>${icon}</i><span>${label}</span><b>${value}</b></div>`,
    )
    .join("")}</div><section class="player-core-status"><h3>현재 상태</h3>${statusMarkup(run)}</section><button type="button" class="player-run-summary${impurityBadge ? " has-impurity-count" : ""}" data-run-open><span>▤</span><strong>인벤토리</strong><small>증강카드 ${augmentCardCount}장</small>${impurityBadge}</button>`;
}

function hudMetric(label, value, className = "") {
  return `<div class="run-hud-metric ${className}"><small>${label}</small><strong>${value}</strong></div>`;
}

function transformRunMarkup(value, run) {
  if (
    !desktop.matches ||
    !run ||
    typeof value !== "string" ||
    !value.includes("play-layout")
  )
    return value;

  const template = document.createElement("template");
  template.innerHTML = value;
  const root = template.content,
    hud = root.querySelector(".hud"),
    route = root.querySelector(".route"),
    playLayout = root.querySelector(".play-layout"),
    player = playLayout?.querySelector(":scope > .player-stats"),
    acquired = playLayout?.querySelector(":scope > .acquired-panel");
  if (!hud || !route || !playLayout || !player || !acquired) return value;

  const danger = player.classList.contains("health-danger"),
    critical = player.classList.contains("health-critical"),
    originalContext =
      hud.querySelector(":scope > div:first-child small")?.textContent?.trim() || "RUN",
    originalScore = parseNumbers(hud.querySelector(".hud-score strong")?.textContent)[0],
    liveHealth = parseNumbers(player.querySelector(".health-stat > b")?.textContent),
    livePotion = parseNumbers(player.querySelector(".battle-potion b")?.textContent)[0],
    logButton = hud.querySelector("[data-log-open]"),
    homeButton = hud.querySelector('[data-action="home"]'),
    hp = Number.isFinite(liveHealth[0]) ? liveHealth[0] : Math.max(0, Number(run.hp) || 0),
    maxHp = Number.isFinite(liveHealth[1])
      ? Math.max(1, liveHealth[1])
      : Math.max(1, Number(run.maxHp) || 1),
    gold = Math.max(0, Number(run.gold) || 0),
    potions = Number.isFinite(livePotion) ? livePotion : Math.max(0, Number(run.potions) || 0),
    score = Number.isFinite(originalScore) ? originalScore : Math.max(0, Number(run.score) || 0),
    healthPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100)),
    currentRouteIndex = [...route.children].findIndex((node) =>
      node.classList.contains("current"),
    ),
    room =
      currentRouteIndex >= 0
        ? currentRouteIndex + 1
        : Math.max(1, Number(run.node || 0) + 1),
    actLabel = originalContext.split("·")[0]?.trim() || "ACT";

  hud.className = "hud run-hud-enhanced";
  hud.dataset.pcFrameEnhanced = "true";
  if (logButton) logButton.classList.add("run-hud-action");
  if (homeButton) homeButton.classList.add("run-hud-action");
  const actions = [logButton?.outerHTML, homeButton?.outerHTML].filter(Boolean).join("");
  hud.innerHTML = `<div class="run-hud-progress"><small>RUN</small><strong>${escapeHtml(actLabel)}</strong><span>ROOM ${String(room).padStart(2, "0")} / 12</span></div><div class="run-hud-health-slot${danger ? " health-danger" : ""}${critical ? " health-critical" : ""}"${playerHelpAttributes("hp")}><div class="run-hud-health stat-row health-stat"><span><small>HP</small><b>${hp} / ${maxHp}</b></span><div class="run-hud-health-track player-health-bar" role="progressbar" aria-label="현재 체력" aria-valuemin="0" aria-valuemax="${maxHp}" aria-valuenow="${hp}"><span style="width:${healthPercent}%"></span></div></div></div><div class="run-hud-resources">${hudMetric("GOLD", `${number(gold)} G`, "run-hud-gold gold-stat")}${hudMetric("POTION", `✚ ${number(potions)}`, "run-hud-potion")}${hudMetric("SCORE", number(score), "run-hud-score")}</div><div class="run-hud-actions">${actions}</div>`;

  renderPcRoute(route, run, E);

  player.className = "player-stats player-core-panel";
  player.setAttribute("aria-label", "내 전투 능력과 현재 상태");
  player.innerHTML = playerPanelMarkup(run);

  acquired.className = "acquired-panel run-build-panel";
  acquired.setAttribute(
    "aria-label",
    "이번 런의 빌드 방향, 활성 시너지, 특성 및 유물",
  );
  acquired.innerHTML = acquiredPanelMarkup(run);

  metrics.renderBoundaryRuns += 1;
  return template.innerHTML;
}

function replayExistingAnimations(root, names, diagnosticKey) {
  if (!root || root.dataset.motionReplayDone === "1") return;
  root.dataset.motionReplayDone = "1";

  const computed = getComputedStyle(root);
  animationDiagnostics.reducedMotion = reducedMotion.matches;
  animationDiagnostics[diagnosticKey] = {
    animationName: computed.animationName,
    animationDuration: computed.animationDuration,
    replayed: [],
  };
  if (reducedMotion.matches) return;

  requestAnimationFrame(() => {
    if (!root.isConnected) return;
    void root.offsetWidth;
    const animations = root.getAnimations({ subtree: true });
    for (const animation of animations) {
      if (!names.has(animation.animationName)) continue;
      try {
        animation.currentTime = 0;
        animation.play();
        animationDiagnostics[diagnosticKey].replayed.push(animation.animationName);
      } catch {}
    }
  });
}

function replayLegacyUiAnimations(run) {
  if (!app) return;
  if (run?.phase === "reward") {
    const rewardItem = app.querySelector(".reward-item > .item");
    if (rewardItem)
      replayExistingAnimations(rewardItem, REWARD_ANIMATIONS, "reward");
  }
  const upgradeSuccess = app.querySelector(".rest-upgrade-success");
  if (upgradeSuccess)
    replayExistingAnimations(upgradeSuccess, UPGRADE_ANIMATIONS, "upgrade");
}

function finalizeRender(run) {
  metrics.finalizerRuns += 1;
  if (!app) return;
  window.HarmonyCurrentRenderRun = run;
  syncRoomBackground(run);
  document.body.classList.toggle(
    "harmony-stage-active",
    Boolean(
      desktop.matches &&
        app.querySelector(":scope > .hud.run-hud-enhanced") &&
        app.querySelector(":scope > .play-layout"),
    ),
  );

  polishBattleUi();
  syncPlayerSupportUi(run);
  syncHarmonyUi(run);
  syncCardDetails(app);
  syncImpurityUi(run);
  syncEconomyUi(run);
  replayLegacyUiAnimations(run);
  queueHandSync();
}

function transformMarkup(markup, run) {
  return transformRunMarkup(String(markup), run);
}

function syncFrame(run) {
  currentRenderRun = run || null;
  finalizeRender(currentRenderRun);
}

window.HarmonyPcFrame = Object.freeze({
  transform: transformMarkup,
  sync: syncFrame,
});

document.addEventListener(
  "click",
  (event) => {
    if (!event.target.closest?.("[data-run-open]")) return;
    queueMicrotask(() => syncImpurityUi(currentRenderRun));
  },
  true,
);

reducedMotion.addEventListener?.("change", () => {
  animationDiagnostics.reducedMotion = reducedMotion.matches;
});

window.HarmonyRenderStability = Object.freeze({
  snapshot: () => ({ ...metrics }),
  finalize: () => finalizeRender(currentRenderRun),
});
window.HarmonyAnimationDiagnostics = Object.freeze({
  snapshot: () => structuredClone(animationDiagnostics),
});
window.HarmonyBuildAnalyzer = Object.freeze({
  snapshot: () => analyzeBuild(currentRenderRun),
  analyze: analyzeBuild,
});

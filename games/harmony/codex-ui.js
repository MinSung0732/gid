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
  ITEMS,
  KINDS,
  RARITIES,
} from "./data.js?v=20260918-1";

import {
  ACT4_BOSSES,
  ACT4_ELITES,
  ACT4_MONSTERS,
  ACT5_BOSSES,
  ACT5_ELITES,
  ACT5_MONSTERS,
  ACT6_BOSSES,
  ACT6_ELITES,
  ACT6_MONSTERS,
  ACT7_1_BOSSES,
  ACT7_1_ELITES,
  ACT7_1_MONSTERS,
  ACT7_2_BOSSES,
  ACT7_2_ELITES,
  ACT7_2_MONSTERS,
  ACT7_3_BOSSES,
  ACT7_3_ELITES,
  ACT7_3_MONSTERS,
} from "./late-game-content.js";

function withCodexRoute(group, route) {
  return Object.fromEntries(Object.entries(group).map(([id, monster]) => [id, { ...monster, codexRoute: route }]));
}

const ACT7_CODEX_MONSTERS = {
    ...withCodexRoute(ACT7_1_MONSTERS, "7-1"),
    ...withCodexRoute(ACT7_2_MONSTERS, "7-2"),
    ...withCodexRoute(ACT7_3_MONSTERS, "7-3"),
  },
  ACT7_CODEX_ELITES = {
    ...withCodexRoute(ACT7_1_ELITES, "7-1"),
    ...withCodexRoute(ACT7_2_ELITES, "7-2"),
    ...withCodexRoute(ACT7_3_ELITES, "7-3"),
  },
  ACT7_CODEX_BOSSES = {
    ...withCodexRoute(ACT7_1_BOSSES, "7-1"),
    ...withCodexRoute(ACT7_2_BOSSES, "7-2"),
    ...withCodexRoute(ACT7_3_BOSSES, "7-3"),
  };

const ITEM_GROUPS = {
    traits: { label: "특성", entries: () => Object.values(ITEMS).filter((item) => !item.hidden && item.kind === "trait") },
    relics: { label: "유물", entries: () => Object.values(ITEMS).filter((item) => !item.hidden && item.kind === "relic") },
    stats: { label: "능력치", entries: () => Object.values(ITEMS).filter((item) => !item.hidden && item.kind === "stat") },
  },
  MONSTERS = {
    act1: { label: "1막", normal: EARLY_MONSTERS, elite: ACT1_ELITES, boss: ACT1_BOSSES },
    act2: { label: "2막", normal: ACT2_MONSTERS, elite: ACT2_ELITES, boss: ACT2_BOSSES },
    act3: { label: "3막", normal: ACT3_MONSTERS, elite: ACT3_ELITES, boss: ACT3_BOSSES },
    act4: { label: "4막", normal: ACT4_MONSTERS, elite: ACT4_ELITES, boss: ACT4_BOSSES },
    act5: { label: "5막", normal: ACT5_MONSTERS, elite: ACT5_ELITES, boss: ACT5_BOSSES },
    act6: { label: "6막", normal: ACT6_MONSTERS, elite: ACT6_ELITES, boss: ACT6_BOSSES },
    act7: { label: "7막", normal: ACT7_CODEX_MONSTERS, elite: ACT7_CODEX_ELITES, boss: ACT7_CODEX_BOSSES },
  },
  MONSTER_TYPES = { normal: "일반", elite: "엘리트", boss: "보스" },
  STATUS_GROUPS = {
    stack: "중첩·표시형",
    duration: "지속 턴형",
    control: "행동 제한형",
  },
  GLOSSARY_GROUPS = {
    resources: "전투 자원",
    deck: "덱 · 손패",
    effects: "카드 · 효과",
    journey: "여정 · 아이템",
    symbols: "카드 요약 기호",
  };

// Preserve the established internal names used by the Codex regression contract.
const CODEX_AUGMENTS = ITEM_GROUPS,
  CODEX_MONSTERS = MONSTERS,
  CODEX_MONSTER_TYPES = MONSTER_TYPES;

export function createCodexUi({
  meta,
  cardEffectText,
  glossaryTermsHtml,
  itemHtml,
  statusAmountText,
  statusGlossaryHtml,
  getElementById = (id) => document.getElementById(id),
}) {
  const $ = getElementById;
  let codexState = { major: "card", middle: "1", minor: "normal", query: "" };

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
    const patternName = intent.name ? ` · ${intent.name}` : "";
    if (Number(intent.lateState?.pressureDelta) > 0) parts.push(`압력 +${Number(intent.lateState.pressureDelta)}`);
    if (intent.lateState?.pressureReset) parts.push("압력 초기화");
    if (Number(intent.lateState?.chargeDelta) > 0) parts.push(`충전 +${Number(intent.lateState.chargeDelta)}`);
    if (intent.lateState?.chargeReset) parts.push("충전 초기화");
    return `<li><b>${turn + 1}턴${patternName}</b><span>${parts.join(" · ")}</span></li>`;
  }

  function codexMonsterEntry(monster) {
    const discovered = Object.hasOwn(EARLY_MONSTERS, monster.id) || (meta.defeatedMonsters || []).includes(monster.id);
    if (!discovered)
      return `<article class="codex-entry codex-monster-entry undiscovered"><div class="codex-monster-head"><i aria-hidden="true">?</i><span><small>???</small><strong>미지의 존재</strong></span><b>HP ???</b></div><ol><li><span>아직 마주친 적이 없습니다.</span></li></ol></article>`;
    const initial = Object.entries(monster.initialStatuses || {}).map(([id, amount]) => statusAmountText(id, amount)).join(" · ");
    const route = monster.codexRoute ? `${monster.codexRoute} · ` : "",
      patternNote = monster.loopPattern ? `<p>패턴 · 아래 순서대로 반복</p>` : "";
    return `<article class="codex-entry codex-monster-entry"><div class="codex-monster-head"><i aria-hidden="true">${monster.symbol || "◇"}</i><span><small>${route}${monster.id}</small><strong>${monster.name}</strong></span><b>HP ${monster.baseHp}</b></div>${initial ? `<p>초기 상태 · ${initial}</p>` : ""}${patternNote}<ol>${(monster.pattern || []).map(codexIntent).join("")}</ol></article>`;
  }

  function codexProgress() {
    const cards = Object.values(CARDS).filter((card) => card.id !== "impurity"),
      items = Object.values(ITEMS).filter((item) => !item.hidden),
      monsters = Object.values(MONSTERS).flatMap((act) => [
        ...Object.values(act.normal), ...Object.values(act.elite), ...Object.values(act.boss),
      ]),
      foundCards = cards.filter((card) => (meta.discoveredCards || []).includes(card.id)).length,
      foundItems = items.filter((item) => (meta.discovered || []).includes(item.id)).length,
      foundMonsters = monsters.filter((monster) => Object.hasOwn(EARLY_MONSTERS, monster.id) || (meta.defeatedMonsters || []).includes(monster.id)).length,
      found = foundCards + foundItems + foundMonsters,
      total = cards.length + items.length + monsters.length,
      percent = total ? Math.round((found / total) * 100) : 0;
    return { found, total, percent };
  }

  function selectGlossarySection(label) {
    const view = $("codex-view");
    for (const section of view.querySelectorAll(".glossary-section")) {
      section.hidden = section.querySelector("h3")?.textContent.trim() !== label;
    }
  }

  function applySearchFilter() {
    const view = $("codex-view"), query = codexState.query.trim().toLocaleLowerCase("ko");
    view.querySelectorAll(".codex-empty-search").forEach((node) => node.remove());
    const candidates = [...view.querySelectorAll(".codex-entry, .glossary-row")]
      .filter((node) => !node.closest(".glossary-section[hidden]"));
    let visible = 0;
    for (const node of candidates) {
      const matches = !query || node.textContent.toLocaleLowerCase("ko").includes(query);
      node.hidden = !matches;
      if (matches) visible += 1;
    }
    if (query && candidates.length && !visible)
      view.insertAdjacentHTML("beforeend", `<p class="codex-empty-search">“${codexState.query}”와 일치하는 항목이 없습니다.</p>`);
  }

  function renderCodex() {
    const progress = codexProgress(),
      milestones = [[20, "수습 조향사 · 시작 골드 +20"], [40, "숙련 연금술사 · 시작 포션 +1"], [60, "수석 마스터 · 상점 무료 리롤 1회"], [80, "전설의 조향장 · 첫 턴 AP +1"], [100, "절대 조화의 신 · 골든 칭호"]],
      title = [...milestones].reverse().find(([rate]) => progress.percent >= rate)?.[1].split(" · ")[0] || "견습 조향사";
    $("codex-progress").innerHTML = `<div class="codex-progress-copy"><strong>✦ ${title} · 종합 수집률</strong><span>${progress.found} / ${progress.total} (${progress.percent}%)</span></div><div class="codex-progress-track" role="progressbar" aria-label="도감 수집률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}"><i style="width:${progress.percent}%"></i></div><div class="codex-milestones">${milestones.map(([rate, label]) => `<small class="${progress.percent >= rate ? "earned" : ""}">${progress.percent >= rate ? "✓" : "◇"} ${rate}% ${label}</small>`).join("")}</div>`;
    codexTabs($("codex-major"), [["card", "카드"], ["item", "아이템"], ["monster", "적"], ["status", "상태"], ["glossary", "기본 용어"]], codexState.major, "major");
    $("codex-search").value = codexState.query;

    if (codexState.major === "card") {
      if (!["1", "2", "3", "4"].includes(codexState.middle)) codexState.middle = "1";
      codexTabs($("codex-middle"), [1, 2, 3, 4].map((tier) => [String(tier), `${tier}티어`]), codexState.middle, "middle");
      $("codex-minor").innerHTML = "";
      const entries = Object.values(CARDS).filter((card) => card.id !== "impurity" && card.tier === Number(codexState.middle));
      $("codex-view").innerHTML = `<p class="codex-count">카드 · ${codexState.middle}티어 · ${entries.length}종</p><div class="codex-grid">${entries.map(codexCardEntry).join("")}</div>`;
    } else if (codexState.major === "item") {
      if (!ITEM_GROUPS[codexState.middle]) codexState.middle = "traits";
      if (!["0", "1", "2", "3"].includes(codexState.minor)) codexState.minor = "0";
      codexTabs($("codex-middle"), Object.entries(ITEM_GROUPS).map(([id, group]) => [id, group.label]), codexState.middle, "middle");
      codexTabs($("codex-minor"), [0, 1, 2, 3].map((tier) => [String(tier), `${tier + 1}티어 · ${RARITIES[tier]}`]), codexState.minor, "minor");
      const entries = ITEM_GROUPS[codexState.middle].entries().filter((entry) => entry.tier === Number(codexState.minor));
      $("codex-view").innerHTML = `<p class="codex-count">${ITEM_GROUPS[codexState.middle].label} · ${Number(codexState.minor) + 1}티어 · ${entries.length}종</p><div class="codex-grid">${entries.map(codexItemEntry).join("") || "<p>등록된 항목이 없습니다.</p>"}</div>`;
    } else if (codexState.major === "monster") {
      if (!MONSTERS[codexState.middle]) codexState.middle = "act1";
      if (!MONSTER_TYPES[codexState.minor]) codexState.minor = "normal";
      codexTabs($("codex-middle"), Object.entries(MONSTERS).map(([id, act]) => [id, act.label]), codexState.middle, "middle");
      codexTabs($("codex-minor"), Object.entries(MONSTER_TYPES), codexState.minor, "minor");
      const entries = Object.values(MONSTERS[codexState.middle][codexState.minor]);
      $("codex-view").innerHTML = `<p class="codex-count">${MONSTERS[codexState.middle].label} · ${MONSTER_TYPES[codexState.minor]} · ${entries.length}종</p><div class="codex-grid codex-monster-grid">${entries.map(codexMonsterEntry).join("")}</div>`;
    } else if (codexState.major === "status") {
      if (!STATUS_GROUPS[codexState.middle]) codexState.middle = "stack";
      codexTabs($("codex-middle"), Object.entries(STATUS_GROUPS), codexState.middle, "middle");
      $("codex-minor").innerHTML = "";
      $("codex-view").innerHTML = `<p class="codex-count">전투 중 적용되는 이로운 효과·해로운 효과·표식</p><div class="codex-glossary">${statusGlossaryHtml()}</div>`;
      selectGlossarySection(STATUS_GROUPS[codexState.middle]);
    } else {
      if (!GLOSSARY_GROUPS[codexState.middle]) codexState.middle = "resources";
      codexTabs($("codex-middle"), Object.entries(GLOSSARY_GROUPS), codexState.middle, "middle");
      $("codex-minor").innerHTML = "";
      $("codex-view").innerHTML = `<p class="codex-count">여정과 전투에 사용되는 핵심 용어</p><div class="codex-glossary">${glossaryTermsHtml()}</div>`;
      selectGlossarySection(GLOSSARY_GROUPS[codexState.middle]);
    }
    applySearchFilter();
  }

  function handleCodexClick(event) {
    const button = event.target.closest("[data-codex-level]");
    if (!button) return;
    const level = button.dataset.codexLevel;
    codexState[level] = button.dataset.codexValue;
    if (level === "major") {
      const defaults = {
        card: ["1", "normal"],
        item: ["traits", "0"],
        monster: ["act1", "normal"],
        status: ["stack", "normal"],
        glossary: ["resources", "normal"],
      };
      [codexState.middle, codexState.minor] = defaults[codexState.major];
    } else if (level === "middle") {
      if (codexState.major === "item") codexState.minor = "0";
      else if (codexState.major === "monster") codexState.minor = "normal";
    }
    renderCodex();
  }

  function handleCodexInput(event) {
    codexState.query = event.target.value;
    applySearchFilter();
  }

  return { handleCodexClick, handleCodexInput, renderCodex };
}

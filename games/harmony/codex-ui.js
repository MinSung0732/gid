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
} from "./data.js?v=20260913-1";

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
  function handleCodexClick(event) {
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
  }

  return {
    handleCodexClick,
    renderCodex,
  };
}

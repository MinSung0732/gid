import { CARDS, ITEMS, KINDS } from "./data.js";

const app = document.getElementById("app");
const MOBILE_QUERY = "(max-width: 900px), (max-width: 932px) and (max-height: 600px)";
const media = window.matchMedia(MOBILE_QUERY);
const NOTE_LABELS = { top: "TOP", middle: "MID", base: "BASE" };
const ROLE_LABELS = { attack: "공격", defense: "방어", absorb: "흡수", heal: "회복", effect: "기능", oil: "오일", impurity: "불순물" };
let currentRun = null;
let returnFocus = null;
let activeTab = "deck";
let query = "";
let filters = { category: "all", tier: "all", note: "all", role: "all" };
let selectedCardId = null;
let selectedItemId = null;
let filterOpen = false;

function esc(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function isMobileBattle() {
  return Boolean(media.matches && currentRun?.phase === "battle" && currentRun?.battle);
}

function roleOf(card = {}) {
  if (card.id === "impurity") return "impurity";
  if (card.attack || card.burst || card.weight) return "attack";
  if (card.shield || card.retainShield || card.thorns) return "defense";
  if (card.heal || card.missingHpHealRatio) return "heal";
  if (card.absorb || card.absorbCost || card.requiredAbsorb) return "absorb";
  if (card.oil) return "oil";
  return card.kind || card.type || "effect";
}

function categoryOf(card = {}) {
  const role = roleOf(card);
  if (role === "attack") return "attack";
  if (role === "defense") return "defense";
  if (role === "heal") return "heal";
  if (role === "absorb") return "absorb";
  return "effect";
}

function summaryOf(card = {}) {
  const parts = [];
  if (card.attack) parts.push(`피해 ${card.attack}${card.hits ? ` × ${card.hits}` : ""}`);
  else if (card.burst) parts.push(`흡수 전부 ×${card.burstMultiplier ?? 8} 피해`);
  else if (card.heal) parts.push(`체력 +${card.heal}`);
  else if (card.shield) parts.push(`방어막 +${card.shield}`);
  else if (card.absorb) parts.push(`흡수 +${card.absorb}`);
  else if (card.draw) parts.push(`카드 +${card.draw}`);
  if (card.shield && card.heal) parts.push(`회복 +${card.heal}`);
  if ((card.attack || card.shield || card.heal) && card.absorb) parts.push(`흡수 +${card.absorb}`);
  if (card.draw && !parts.some((part) => part.startsWith("카드"))) parts.push(`카드 +${card.draw}`);
  if (card.retainShield) parts.push(`방어막 ${Math.round(card.retainShield * 100)}% 유지`);
  if (card.cleanse) parts.push(`상태 정화 ${card.cleanse === "all" ? "전부" : card.cleanse}`);
  if (card.description) parts.push(card.description);
  return parts.filter(Boolean).slice(0, 2).join(" · ") || "카드 효과 정보";
}

function groupedDeck() {
  const grouped = new Map();
  for (const held of currentRun?.deck || []) {
    if (!grouped.has(held.id)) grouped.set(held.id, []);
    grouped.get(held.id).push(held);
  }
  return [...grouped].map(([id, held]) => ({ id, held, card: CARDS[id] })).filter((entry) => entry.card);
}

function countedItems() {
  const counts = new Map();
  for (const id of currentRun?.inventory || []) counts.set(id, (counts.get(id) || 0) + 1);
  return [...counts].map(([id, count]) => ({ id, count, item: ITEMS[id] })).filter((entry) => entry.item);
}

function activeFilterCount() {
  return Object.values(filters).filter((value) => value !== "all").length;
}

function filteredDeck() {
  const needle = query.trim().toLocaleLowerCase("ko");
  return groupedDeck().filter(({ card }) => {
    const role = roleOf(card), category = categoryOf(card), note = String(card.note || "").toLowerCase();
    if (needle && !`${card.name} ${summaryOf(card)} ${note} ${ROLE_LABELS[role] || role}`.toLocaleLowerCase("ko").includes(needle)) return false;
    if (filters.category !== "all" && category !== filters.category) return false;
    if (filters.tier !== "all" && String(card.tier || 1) !== filters.tier) return false;
    if (filters.note !== "all" && note !== filters.note) return false;
    if (filters.role !== "all" && role !== filters.role) return false;
    return true;
  });
}

function detailShell() {
  const deckCount = currentRun?.deck?.length || 0;
  const itemCount = currentRun?.inventory?.length || 0;
  return `<section id="mobile-run-detail" class="mobile-run-detail" role="dialog" aria-modal="true" aria-labelledby="mobile-run-detail-title" hidden>
    <header class="mobile-run-detail-header">
      <div class="mobile-run-detail-titlebar"><button type="button" data-mobile-run-back aria-label="전투 정보로 돌아가기">← <span>전투 정보</span></button><strong id="mobile-run-detail-title">내 덱</strong></div>
      <div class="mobile-run-detail-tabs" role="tablist" aria-label="내 덱과 여정 아이템">
        <button type="button" role="tab" data-mobile-run-tab="deck" aria-selected="true">내 덱 <b>${deckCount}</b></button>
        <button type="button" role="tab" data-mobile-run-tab="items" aria-selected="false">아이템 <b>${itemCount}</b></button>
      </div>
      <div class="mobile-run-detail-tools" data-mobile-run-tools>
        <label><span class="sr-only">카드 검색</span><input type="search" data-mobile-run-search placeholder="카드 검색" autocomplete="off" value="${esc(query)}" /></label>
        <button type="button" data-mobile-run-filter aria-expanded="${filterOpen}">필터${activeFilterCount() ? ` ${activeFilterCount()}` : ""}</button>
      </div>
      <div class="mobile-run-filter-sheet" data-mobile-run-filter-sheet ${filterOpen ? "" : "hidden"}></div>
    </header>
    <div class="mobile-run-detail-content" data-mobile-run-content></div>
    <div class="mobile-run-detail-modal" data-mobile-run-modal hidden></div>
  </section>`;
}

function filterSheetMarkup() {
  const select = (key, label, options) => `<label><span>${label}</span><select data-mobile-filter="${key}">${options.map(([value, text]) => `<option value="${value}" ${filters[key] === value ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;
  return `<div class="mobile-run-filter-grid">
    ${select("category", "카테고리", [["all","전체"],["attack","공격"],["defense","방어"],["absorb","흡수"],["heal","회복"],["effect","기능"]])}
    ${select("tier", "등급", [["all","전체"],["1","T1"],["2","T2"],["3","T3"],["4","T4"]])}
    ${select("note", "노트", [["all","전체"],["top","TOP"],["middle","MID"],["base","BASE"]])}
    ${select("role", "유형", [["all","전체"],["attack","공격"],["defense","방어"],["absorb","흡수"],["heal","회복"],["effect","기능"],["oil","오일"]])}
  </div><div class="mobile-run-filter-actions"><button type="button" data-mobile-filter-reset>초기화</button><button type="button" data-mobile-filter-apply>적용</button></div>`;
}

function deckMarkup() {
  const rows = filteredDeck();
  if (!rows.length) return '<p class="mobile-run-empty">조건에 맞는 카드가 없습니다.</p>';
  return `<div class="mobile-run-list" role="list">${rows.map(({ id, held, card }) => {
    const role = roleOf(card), note = NOTE_LABELS[String(card.note || "").toLowerCase()] || String(card.note || "-").toUpperCase();
    return `<button type="button" class="mobile-deck-row" data-mobile-card-detail="${esc(id)}" role="listitem">
      <span class="mobile-deck-row-meta"><b>${esc(note)} · ${esc(ROLE_LABELS[role] || role)}</b><em>AP ${Number(card.cost || 0)}</em></span>
      <span class="mobile-deck-row-name"><strong>${esc(card.name)}</strong><b>×${held.length}</b></span>
      <small>${esc(summaryOf(card))}</small>
      <i aria-hidden="true">›</i>
    </button>`;
  }).join("")}</div>`;
}

function itemsMarkup() {
  const items = countedItems();
  if (!items.length) return '<p class="mobile-run-empty">아직 획득한 여정 아이템이 없습니다.</p>';
  return `<div class="mobile-run-list" role="list">${items.map(({ id, count, item }) => `<button type="button" class="mobile-item-row" data-mobile-item-detail="${esc(id)}" role="listitem">
    <span class="mobile-item-row-icon" aria-hidden="true">◇</span><span><strong>${esc(item.name)}</strong><small>${esc(item.description || "아이템 효과")}</small><em>T${Number(item.tier || 1)} · ${esc(KINDS[item.kind] || item.kind || "아이템")}${count > 1 ? ` · ×${count}` : ""}</em></span><i aria-hidden="true">›</i>
  </button>`).join("")}</div>`;
}

function render() {
  const root = document.getElementById("mobile-run-detail");
  if (!root) return;
  root.querySelector("#mobile-run-detail-title").textContent = activeTab === "deck" ? "내 덱" : "여정 아이템";
  root.querySelectorAll("[data-mobile-run-tab]").forEach((tab) => {
    const selected = tab.dataset.mobileRunTab === activeTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  const tools = root.querySelector("[data-mobile-run-tools]");
  tools.hidden = activeTab !== "deck";
  const sheet = root.querySelector("[data-mobile-run-filter-sheet]");
  sheet.hidden = activeTab !== "deck" || !filterOpen;
  sheet.innerHTML = activeTab === "deck" ? filterSheetMarkup() : "";
  const filterButton = root.querySelector("[data-mobile-run-filter]");
  filterButton.textContent = `필터${activeFilterCount() ? ` ${activeFilterCount()}` : ""}`;
  filterButton.setAttribute("aria-expanded", String(filterOpen));
  root.querySelector("[data-mobile-run-content]").innerHTML = activeTab === "deck" ? deckMarkup() : itemsMarkup();
}

function showDetailModal(type, id, trigger) {
  const modal = document.querySelector("[data-mobile-run-modal]");
  if (!modal) return;
  returnFocus = trigger || document.activeElement;
  if (type === "card") {
    const card = CARDS[id];
    const held = groupedDeck().find((entry) => entry.id === id)?.held || [];
    if (!card) return;
    modal.innerHTML = `<button type="button" class="mobile-detail-backdrop" data-mobile-detail-close aria-label="상세 닫기"></button><article class="mobile-detail-card" role="document"><header><small>${esc((NOTE_LABELS[String(card.note || "").toLowerCase()] || card.note || "-").toString())} · ${esc(ROLE_LABELS[roleOf(card)] || roleOf(card))} · T${Number(card.tier || 1)}</small><button type="button" data-mobile-detail-close aria-label="닫기">×</button></header><h2>${esc(card.name)}</h2><p>${esc(summaryOf(card))}</p><dl><div><dt>AP</dt><dd>${Number(card.cost || 0)}</dd></div><div><dt>보유</dt><dd>${held.length}장</dd></div><div><dt>강화</dt><dd>${Math.max(0, ...held.map((entry) => Number(entry.level || 0)))}</dd></div></dl></article>`;
  } else {
    const item = ITEMS[id];
    if (!item) return;
    modal.innerHTML = `<button type="button" class="mobile-detail-backdrop" data-mobile-detail-close aria-label="상세 닫기"></button><article class="mobile-detail-card" role="document"><header><small>T${Number(item.tier || 1)} · ${esc(KINDS[item.kind] || item.kind || "아이템")}</small><button type="button" data-mobile-detail-close aria-label="닫기">×</button></header><h2>${esc(item.name)}</h2><p>${esc(item.description || "아이템 효과 정보")}</p></article>`;
  }
  modal.hidden = false;
  modal.querySelector("[data-mobile-detail-close]")?.focus();
}

function closeDetailModal() {
  const modal = document.querySelector("[data-mobile-run-modal]");
  if (!modal || modal.hidden) return false;
  modal.hidden = true;
  modal.innerHTML = "";
  const target = returnFocus;
  returnFocus = null;
  target?.focus?.();
  return true;
}

function openDetail(trigger) {
  if (!isMobileBattle()) return;
  const layout = app?.querySelector(".play-layout"), drawer = app?.querySelector("#mobile-info-drawer");
  if (!layout || !drawer) return;
  layout.querySelector("#mobile-run-detail")?.remove();
  layout.insertAdjacentHTML("beforeend", detailShell());
  returnFocus = trigger || document.activeElement;
  drawer.classList.remove("is-open");
  drawer.hidden = true;
  document.body.classList.add("mobile-run-detail-open");
  document.getElementById("mobile-run-detail").hidden = false;
  activeTab = "deck"; query = ""; filters = { category: "all", tier: "all", note: "all", role: "all" }; filterOpen = false;
  render();
  document.querySelector("[data-mobile-run-back]")?.focus();
}

function closeDetail({ restoreDrawer = true } = {}) {
  const root = document.getElementById("mobile-run-detail");
  if (!root) return;
  root.remove();
  document.body.classList.remove("mobile-run-detail-open");
  if (restoreDrawer && isMobileBattle()) {
    const drawer = app?.querySelector("#mobile-info-drawer");
    if (drawer) {
      drawer.hidden = false;
      drawer.classList.add("is-open");
      document.body.classList.add("mobile-info-open");
      const target = drawer.querySelector('[data-mobile-open="deck"]');
      target?.focus?.();
    }
  } else {
    document.body.classList.remove("mobile-info-open");
  }
  returnFocus = null;
}

const baseFrame = window.HarmonyPcFrame;
if (baseFrame) {
  window.HarmonyPcFrame = Object.freeze({
    transform(value, run) { return baseFrame.transform?.(value, run) ?? value; },
    sync(run) { baseFrame.sync?.(run); currentRun = run || null; if (!isMobileBattle()) closeDetail({ restoreDrawer: false }); },
  });
}

document.addEventListener("click", (event) => {
  const deckEntry = event.target.closest('[data-mobile-open="deck"]');
  if (deckEntry && isMobileBattle()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openDetail(deckEntry);
    return;
  }
  if (event.target.closest("[data-mobile-run-back]")) { closeDetail(); return; }
  const tab = event.target.closest("[data-mobile-run-tab]");
  if (tab) { activeTab = tab.dataset.mobileRunTab; filterOpen = false; render(); tab.focus(); return; }
  const filter = event.target.closest("[data-mobile-run-filter]");
  if (filter) { filterOpen = !filterOpen; render(); document.querySelector("[data-mobile-run-filter]")?.focus(); return; }
  if (event.target.closest("[data-mobile-filter-reset]")) { filters = { category: "all", tier: "all", note: "all", role: "all" }; query = ""; const input = document.querySelector("[data-mobile-run-search]"); if (input) input.value = ""; render(); return; }
  if (event.target.closest("[data-mobile-filter-apply]")) { filterOpen = false; render(); document.querySelector("[data-mobile-run-filter]")?.focus(); return; }
  const card = event.target.closest("[data-mobile-card-detail]");
  if (card) { selectedCardId = card.dataset.mobileCardDetail; showDetailModal("card", selectedCardId, card); return; }
  const item = event.target.closest("[data-mobile-item-detail]");
  if (item) { selectedItemId = item.dataset.mobileItemDetail; showDetailModal("item", selectedItemId, item); return; }
  if (event.target.closest("[data-mobile-detail-close]")) closeDetailModal();
}, true);

document.addEventListener("input", (event) => {
  if (!event.target.matches("[data-mobile-run-search]")) return;
  query = event.target.value;
  render();
  const input = document.querySelector("[data-mobile-run-search]");
  input?.focus();
  input?.setSelectionRange(query.length, query.length);
});

document.addEventListener("change", (event) => {
  const select = event.target.closest("[data-mobile-filter]");
  if (!select) return;
  filters[select.dataset.mobileFilter] = select.value;
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (closeDetailModal()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  if (document.getElementById("mobile-run-detail")) { event.preventDefault(); event.stopImmediatePropagation(); closeDetail(); }
}, true);

window.addEventListener("harmony:overlay-opening", () => closeDetail({ restoreDrawer: false }));
media.addEventListener("change", () => { if (!isMobileBattle()) closeDetail({ restoreDrawer: false }); });

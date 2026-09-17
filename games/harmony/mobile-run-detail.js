import * as E from "./engine.js?v=20260913-22";
import { CARDS, ITEMS, KINDS } from "./data.js?v=20260913-1";
import { STATUS_DEFINITIONS } from "./statuses.js?v=20260911-4";
import { createCardPresentation } from "./card-presentation.js";
import {
  CATEGORY_LABELS,
  NOTE_LABELS,
  TYPE_LABELS,
  categoryOf,
  noteOf,
  typesOf,
  semanticWords,
} from "./run-summary-filter.js?v=20260913-1";

const FILTER_KEYS = ["category", "tier", "note", "type"],
  FOCUSABLE = 'button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"]):not([hidden])';

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textFromHtml(value = "") {
  const node = document.createElement("div");
  node.innerHTML = String(value);
  return node.textContent?.replace(/\s+/g, " ").trim() || "";
}

function countIds(values = []) {
  const counts = new Map();
  values.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  return [...counts];
}

function options(values, labels, fallback = (value) => value) {
  return [`<option value="all">전체</option>`, ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labels?.[value] || fallback(value))}</option>`)].join("");
}

export function createMobileRunDetail({ getRun, getDrawer }) {
  let open = false,
    returnFocus = null,
    filterReturnFocus = null,
    tab = "deck",
    query = "",
    filters = { category: "all", tier: "all", note: "all", type: "all" },
    draft = { ...filters };

  const presentation = createCardPresentation({
    engine: E,
    cards: CARDS,
    statusDefinitions: STATUS_DEFINITIONS,
    getRun,
    getStarted: () => Boolean(getRun()),
    tierStars: (tier) => "★".repeat(Math.max(1, Number(tier) || 1)),
  });

  function root() {
    return document.getElementById("mobile-run-detail");
  }

  function compactSummary(card) {
    try {
      const rows = presentation.compactCardEffectSummary(card)?.rows || [];
      const summary = rows.slice(0, 2).map((row) => textFromHtml(row.value)).filter(Boolean).join(" · ");
      if (summary) return summary;
      return textFromHtml(presentation.cardEffectText(card)).split(" · ")[0] || "카드 효과 확인";
    } catch {
      return "카드 효과 확인";
    }
  }

  function deckGroups(run) {
    const grouped = new Map();
    for (const held of run?.deck || []) {
      if (!held?.id || !CARDS[held.id]) continue;
      if (!grouped.has(held.id)) grouped.set(held.id, []);
      grouped.get(held.id).push(held);
    }
    return [...grouped].map(([id, cards]) => {
      const definition = CARDS[id],
        representative = [...cards].sort((a, b) => Number(b.level || 0) - Number(a.level || 0))[0],
        category = categoryOf(definition),
        note = noteOf(definition),
        types = typesOf(definition),
        tier = Number(definition.tier) || 1,
        summary = compactSummary(representative),
        searchText = `${semanticWords(definition, category, types)} ${summary}`.toLocaleLowerCase("ko-KR");
      return { id, cards, representative, definition, category, note, types, tier, summary, searchText };
    }).sort((a, b) => (a.definition.name || a.id).localeCompare(b.definition.name || b.id, "ko-KR", { numeric: true }));
  }

  function itemGroups(run) {
    return countIds(run?.inventory || []).map(([id, count]) => ({ id, count, item: ITEMS[id] })).filter((entry) => entry.item);
  }

  function filterCount() {
    return FILTER_KEYS.reduce((sum, key) => sum + (filters[key] !== "all" ? 1 : 0), 0);
  }

  function matchesDeck(group) {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    return (!normalized || group.searchText.includes(normalized)) &&
      (filters.category === "all" || group.category === filters.category) &&
      (filters.tier === "all" || String(group.tier) === filters.tier) &&
      (filters.note === "all" || group.note === filters.note) &&
      (filters.type === "all" || group.types.includes(filters.type));
  }

  function cardAp(run, card) {
    try { return run?.battle ? E.cost(run, card) : E.cardDefinition(card).cost; }
    catch { return CARDS[card.id]?.cost ?? 0; }
  }

  function cardRow(group, run) {
    const note = NOTE_LABELS[group.note] || group.note.toUpperCase(),
      category = CATEGORY_LABELS[group.category] || group.category,
      ap = cardAp(run, group.representative),
      name = group.definition.name || group.id,
      levelInfo = [...new Set(group.cards.map((card) => Number(card.level || 0)))].sort((a, b) => a - b).map((level) => level ? `+${level}` : "기본").join(" · ");
    let detail = "";
    try { detail = presentation.cardEffectText(group.representative, true); }
    catch { detail = escapeHtml(group.summary); }
    return `<article class="mobile-run-card-row" data-mobile-card-entry="${escapeHtml(group.id)}">
      <button type="button" class="mobile-run-row-trigger" data-mobile-card-toggle="${escapeHtml(group.id)}" aria-expanded="false">
        <span class="mobile-run-row-meta"><b>${escapeHtml(note)} · ${escapeHtml(category)}</b><em>AP ${escapeHtml(ap)}</em></span>
        <span class="mobile-run-row-title"><strong>${escapeHtml(name)}</strong><b>×${group.cards.length}</b></span>
        <small>${escapeHtml(group.summary)}</small>
        <i aria-hidden="true">›</i>
      </button>
      <div class="mobile-run-row-detail" data-mobile-card-detail="${escapeHtml(group.id)}" hidden>
        <p class="mobile-run-detail-meta">T${group.tier} · ${escapeHtml(levelInfo)}${group.types.length ? ` · ${escapeHtml(group.types.map((type) => TYPE_LABELS[type] || type).join(" · "))}` : ""}</p>
        <div class="mobile-run-effect-detail">${detail}</div>
      </div>
    </article>`;
  }

  function itemRow(entry) {
    const { item, count, id } = entry,
      kind = KINDS[item.kind] || item.kind || "아이템",
      description = item.description || "상세 효과 없음";
    return `<article class="mobile-run-item-row" data-mobile-item-entry="${escapeHtml(id)}">
      <button type="button" class="mobile-run-row-trigger" data-mobile-item-toggle="${escapeHtml(id)}" aria-expanded="false">
        <span class="mobile-run-row-title"><strong><span aria-hidden="true">◇</span> ${escapeHtml(item.name || id)}</strong>${count > 1 ? `<b>×${count}</b>` : ""}</span>
        <small>${escapeHtml(description)}</small>
        <span class="mobile-run-item-meta">T${Number(item.tier) || 1} · ${escapeHtml(kind)}</span>
        <i aria-hidden="true">›</i>
      </button>
      <div class="mobile-run-row-detail" data-mobile-item-detail="${escapeHtml(id)}" hidden>
        <p>${escapeHtml(description)}</p>
        <p class="mobile-run-detail-meta">${escapeHtml(kind)} · T${Number(item.tier) || 1}${item.room ? ` · ${escapeHtml(item.room)}` : ""}</p>
      </div>
    </article>`;
  }

  function ensureRoot() {
    if (root()) return root();
    document.body.insertAdjacentHTML("beforeend", `<section id="mobile-run-detail" class="mobile-run-detail" role="dialog" aria-modal="true" aria-labelledby="mobile-run-detail-title" hidden>
      <header class="mobile-run-detail-header">
        <div class="mobile-run-detail-nav"><button type="button" data-mobile-run-back aria-label="전투 정보로 돌아가기">← <span>전투 정보</span></button><strong id="mobile-run-detail-title">내 덱</strong><span aria-hidden="true"></span></div>
        <div class="mobile-run-tabs" role="tablist" aria-label="덱과 여정 아이템"><button type="button" role="tab" data-mobile-run-tab="deck" aria-selected="true">내 덱 <b data-mobile-deck-count>0</b></button><button type="button" role="tab" data-mobile-run-tab="items" aria-selected="false">아이템 <b data-mobile-item-count>0</b></button></div>
        <div class="mobile-run-toolbar"><label><span class="sr-only">검색</span><input type="search" data-mobile-run-search placeholder="카드 검색" autocomplete="off" /></label><button type="button" data-mobile-filter-open aria-haspopup="dialog">필터</button></div>
      </header>
      <div class="mobile-run-scroll" data-mobile-run-scroll tabindex="0"><div data-mobile-run-list></div></div>
      <div class="mobile-run-filter-layer" data-mobile-filter-layer hidden>
        <button type="button" class="mobile-run-filter-backdrop" data-mobile-filter-cancel aria-label="필터 닫기"></button>
        <section class="mobile-run-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title">
          <header><div><small>DECK FILTER</small><strong id="mobile-filter-title">필터</strong></div><button type="button" data-mobile-filter-cancel aria-label="필터 닫기">×</button></header>
          <div data-mobile-filter-fields></div>
          <footer><button type="button" data-mobile-filter-reset>초기화</button><button type="button" class="primary" data-mobile-filter-apply>적용</button></footer>
        </section>
      </div>
    </section>`);
    return root();
  }

  function renderFilterFields(groups) {
    const categories = [...new Set(groups.map((group) => group.category))],
      tiers = [...new Set(groups.map((group) => String(group.tier)))].sort((a, b) => Number(a) - Number(b)),
      notes = [...new Set(groups.map((group) => group.note))],
      types = [...new Set(groups.flatMap((group) => group.types))];
    const host = root()?.querySelector("[data-mobile-filter-fields]");
    if (!host) return;
    host.innerHTML = `<label><span>카테고리</span><select data-mobile-filter="category">${options(categories, CATEGORY_LABELS)}</select></label>
      <label><span>등급</span><select data-mobile-filter="tier">${options(tiers, null, (value) => `T${value}`)}</select></label>
      <label><span>노트</span><select data-mobile-filter="note">${options(notes, NOTE_LABELS)}</select></label>
      <label><span>유형</span><select data-mobile-filter="type">${options(types, TYPE_LABELS)}</select></label>`;
    FILTER_KEYS.forEach((key) => { const select = host.querySelector(`[data-mobile-filter="${key}"]`); if (select) select.value = draft[key]; });
  }

  function render({ preserveScroll = false } = {}) {
    const view = ensureRoot(), run = getRun();
    if (!run) return;
    const scroll = view.querySelector("[data-mobile-run-scroll]"), scrollTop = scroll.scrollTop,
      groups = deckGroups(run), items = itemGroups(run),
      deckCount = (run.deck || []).length, itemCount = (run.inventory || []).length;
    view.querySelector("[data-mobile-deck-count]").textContent = deckCount;
    view.querySelector("[data-mobile-item-count]").textContent = itemCount;
    view.querySelector("#mobile-run-detail-title").textContent = tab === "deck" ? "내 덱" : "여정 아이템";
    view.querySelectorAll("[data-mobile-run-tab]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.mobileRunTab === tab)));
    const search = view.querySelector("[data-mobile-run-search]"), filter = view.querySelector("[data-mobile-filter-open]");
    search.placeholder = tab === "deck" ? "카드 검색" : "아이템 검색";
    if (search.value !== query) search.value = query;
    filter.hidden = tab !== "deck";
    filter.textContent = filterCount() ? `필터 ${filterCount()}` : "필터";
    const list = view.querySelector("[data-mobile-run-list]");
    if (tab === "deck") {
      const visible = groups.filter(matchesDeck);
      list.innerHTML = visible.length ? visible.map((group) => cardRow(group, run)).join("") : '<p class="mobile-run-empty">조건에 맞는 카드가 없습니다.</p>';
      renderFilterFields(groups);
    } else {
      const normalized = query.trim().toLocaleLowerCase("ko-KR"), visible = items.filter(({ item }) => !normalized || `${item.name || ""} ${item.description || ""} ${KINDS[item.kind] || item.kind || ""}`.toLocaleLowerCase("ko-KR").includes(normalized));
      list.innerHTML = visible.length ? visible.map(itemRow).join("") : '<p class="mobile-run-empty">이번 여정에서 획득한 아이템이 없습니다.</p>';
    }
    if (preserveScroll) scroll.scrollTop = Math.min(scrollTop, Math.max(0, scroll.scrollHeight - scroll.clientHeight));
    else scroll.scrollTop = 0;
  }

  function openFilter(trigger) {
    const view = root(); if (!view || tab !== "deck") return;
    draft = { ...filters }; filterReturnFocus = trigger || document.activeElement;
    renderFilterFields(deckGroups(getRun()));
    const layer = view.querySelector("[data-mobile-filter-layer]"); layer.hidden = false;
    view.classList.add("filter-open");
    layer.querySelector("select")?.focus();
  }

  function closeFilter({ restore = true } = {}) {
    const view = root(), layer = view?.querySelector("[data-mobile-filter-layer]"); if (!layer || layer.hidden) return false;
    layer.hidden = true; view.classList.remove("filter-open");
    if (restore) filterReturnFocus?.focus?.(); filterReturnFocus = null; return true;
  }

  function close({ restore = true } = {}) {
    const view = root(); if (!view || !open) return;
    closeFilter({ restore: false });
    view.hidden = true; view.classList.remove("is-open"); open = false;
    document.body.classList.remove("mobile-run-detail-open");
    const drawer = getDrawer?.(); drawer?.removeAttribute("aria-hidden");
    if (restore) (getDrawer?.()?.querySelector('[data-mobile-open="deck"]') || returnFocus)?.focus?.();
    returnFocus = null;
  }

  function show(trigger) {
    const run = getRun(); if (!run?.battle) return false;
    const view = ensureRoot(); returnFocus = trigger || document.activeElement; tab = "deck"; query = "";
    filters = { category: "all", tier: "all", note: "all", type: "all" }; draft = { ...filters };
    render();
    getDrawer?.()?.setAttribute("aria-hidden", "true");
    view.hidden = false; view.classList.add("is-open"); open = true; document.body.classList.add("mobile-run-detail-open");
    view.querySelector("[data-mobile-run-back]")?.focus(); return true;
  }

  function toggleDetail(button, selector) {
    const detail = button.closest("article")?.querySelector(selector); if (!detail) return;
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded)); detail.hidden = expanded;
  }

  function visibleFocusables(container) {
    return [...container.querySelectorAll(FOCUSABLE)].filter((node) => !node.closest("[hidden]") && node.getClientRects().length);
  }

  function trapTab(event) {
    const view = root(); if (!view || !open || event.key !== "Tab") return;
    const layer = view.querySelector("[data-mobile-filter-layer]"), scope = !layer.hidden ? layer.querySelector(".mobile-run-filter-sheet") : view,
      focusables = visibleFocusables(scope); if (!focusables.length) return;
    const first = focusables[0], last = focusables.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  document.addEventListener("click", (event) => {
    if (!open) return;
    const view = event.target.closest?.("#mobile-run-detail"); if (!view) return;
    if (event.target.closest("[data-mobile-run-back]")) return close();
    const tabButton = event.target.closest("[data-mobile-run-tab]");
    if (tabButton) { tab = tabButton.dataset.mobileRunTab; query = ""; render(); view.querySelector("[data-mobile-run-search]")?.focus(); return; }
    const filterButton = event.target.closest("[data-mobile-filter-open]"); if (filterButton) return openFilter(filterButton);
    if (event.target.closest("[data-mobile-filter-cancel]")) return closeFilter();
    if (event.target.closest("[data-mobile-filter-reset]")) { draft = { category: "all", tier: "all", note: "all", type: "all" }; renderFilterFields(deckGroups(getRun())); return; }
    if (event.target.closest("[data-mobile-filter-apply]")) {
      FILTER_KEYS.forEach((key) => { draft[key] = view.querySelector(`[data-mobile-filter="${key}"]`)?.value || "all"; });
      filters = { ...draft }; closeFilter(); render({ preserveScroll: false }); return;
    }
    const card = event.target.closest("[data-mobile-card-toggle]"); if (card) return toggleDetail(card, "[data-mobile-card-detail]");
    const item = event.target.closest("[data-mobile-item-toggle]"); if (item) return toggleDetail(item, "[data-mobile-item-detail]");
  });

  document.addEventListener("input", (event) => {
    if (!open || !event.target.matches?.("[data-mobile-run-search]")) return;
    query = event.target.value; render({ preserveScroll: false });
    root()?.querySelector("[data-mobile-run-search]")?.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (!open) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); if (!closeFilter()) close(); return; }
    trapTab(event);
  }, true);

  return {
    open: show,
    close,
    sync() { if (open) render({ preserveScroll: true }); },
    cleanup() { close({ restore: false }); root()?.remove(); },
    isOpen: () => open,
  };
}

const SUMMARY_CATEGORIES = [
  ["all", "전체"],
  ["attack", "공격"],
  ["defense", "방어"],
  ["absorb", "흡수"],
  ["heal", "회복"],
];

const SUMMARY_CATEGORY_LABELS = Object.freeze({
  attack: "공격",
  defense: "방어",
  absorb: "흡수",
  heal: "회복",
});

export function createRunSummaryUi({
  getRun,
  cards,
  cardHtml,
  itemHtml,
  countItemIds,
  startingCardCategory,
  getElement = (id) => document.getElementById(id),
  eventRoot = document,
}) {
  let runSummaryFilter = "all";
  let runSummarySelectedId = null;
  let runSummaryTierOrder = "desc";

  function renderRunDeckSummary() {
    const run = getRun();
    if (!run) return;
    const deckList = getElement("run-deck-list"),
      grouped = new Map();
    for (const card of run.deck) {
      if (!grouped.has(card.id)) grouped.set(card.id, []);
      grouped.get(card.id).push(card);
    }
    const groups = [...grouped]
      .map(([id, heldCards]) => ({ id, cards: heldCards, definition: cards[id] }))
      .filter(
        (group) =>
          runSummaryFilter === "all" ||
          startingCardCategory(group.definition) === runSummaryFilter,
      )
      .sort(
        (a, b) =>
          (runSummaryTierOrder === "desc"
            ? b.definition.tier - a.definition.tier
            : a.definition.tier - b.definition.tier) ||
          a.definition.name.localeCompare(b.definition.name, "ko"),
      );
    if (!groups.some((group) => group.id === runSummarySelectedId))
      runSummarySelectedId = groups[0]?.id || null;
    const selected = groups.find((group) => group.id === runSummarySelectedId),
      detailCard = selected
        ? {
            id: selected.id,
            level: Math.max(...selected.cards.map((card) => card.level || 0)),
          }
        : null,
      categoryCounts = Object.fromEntries(
        SUMMARY_CATEGORIES.map(([id]) => [
          id,
          id === "all"
            ? run.deck.length
            : run.deck.filter(
                (card) => startingCardCategory(cards[card.id]) === id,
              ).length,
        ]),
      ),
      rows = groups
        .map(({ id, cards: heldCards, definition }) => {
          const levels = [...new Set(heldCards.map((card) => card.level || 0))]
              .sort((a, b) => a - b)
              .map(
                (level) =>
                  `+${level} ×${heldCards.filter((card) => (card.level || 0) === level).length}`,
              )
              .join(" · "),
            category = startingCardCategory(definition),
            active = id === runSummarySelectedId;
          return `<article class="summary-deck-entry ${active ? "active" : ""}"><button data-run-summary-card="${id}" aria-expanded="${active}"><span class="summary-deck-role role-${category}">${SUMMARY_CATEGORY_LABELS[category]}</span><span><strong>${definition.name}</strong><small>${definition.cost} AP · ${definition.note.toUpperCase()} · ${definition.tier}티어</small></span><span class="summary-deck-levels">${levels}<b>총 ${heldCards.length}장</b></span></button>${active ? `<div class="summary-card-inline">${cardHtml(detailCard)}</div>` : ""}</article>`;
        })
        .join("");
    deckList.className = "summary-deck-shell";
    deckList.innerHTML = `<div class="summary-deck-toolbar"><div class="summary-deck-filters">${SUMMARY_CATEGORIES.map(([id, label]) => `<button data-run-summary-filter="${id}" class="${runSummaryFilter === id ? "active" : ""}">${label}<b>${categoryCounts[id]}</b></button>`).join("")}</div><div class="summary-deck-sort"><button data-run-summary-sort="desc" class="${runSummaryTierOrder === "desc" ? "active" : ""}">높은 티어순</button><button data-run-summary-sort="asc" class="${runSummaryTierOrder === "asc" ? "active" : ""}">낮은 티어순</button></div></div><div class="summary-deck-workspace"><div class="summary-deck-list">${rows || '<p class="summary-empty">해당 분류의 카드가 없습니다.</p>'}</div><aside class="summary-card-detail">${detailCard ? `<small>선택 카드 · 보유 최고 강화</small>${cardHtml(detailCard)}` : ""}</aside></div>`;
  }

  function openRunSummary() {
    const run = getRun();
    if (!run) return;
    getElement("run-deck-title").textContent = `내 덱 · ${run.deck.length}장`;
    getElement("run-item-title").textContent =
      `이번 여정 아이템 · ${run.inventory.length}개`;
    runSummaryFilter = "all";
    runSummaryTierOrder = "desc";
    runSummarySelectedId = run.deck[0]?.id || null;
    renderRunDeckSummary();
    getElement("run-item-list").innerHTML =
      countItemIds(run.inventory)
        .map(([id, count]) => itemHtml(id, count))
        .join("") || '<p class="summary-empty">아직 획득한 아이템이 없습니다.</p>';
    getElement("run-summary").showModal();
  }

  function handleOpenClick(event) {
    if (!event.target.closest("[data-run-open]") || !getRun()) return;
    openRunSummary();
  }

  function handleSummaryClick(event) {
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
  }

  function bindRunSummary() {
    getElement("run-summary-close").onclick = () => getElement("run-summary").close();
    eventRoot.addEventListener("click", handleOpenClick);
    getElement("run-summary").addEventListener("click", handleSummaryClick);
  }

  return { bindRunSummary, openRunSummary, renderRunDeckSummary };
}

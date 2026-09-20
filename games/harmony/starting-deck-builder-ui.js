import { deriveCardMechanics } from "./card-mechanics.js";

const STARTING_ITEM_CATEGORIES = [
  { id: "stat", name: "능력치", icon: "◆", description: "공격·방어·회복과 자원 수치를 직접 조정합니다." },
  { id: "trait", name: "특성", icon: "✦", description: "조건과 행동에 반응하는 지속 효과입니다." },
  { id: "relic", name: "유물", icon: "◇", description: "전투 규칙을 바꾸는 핵심 패시브입니다." },
  { id: "curse", name: "저주", icon: "▼", description: "불리한 능력치와 자원 패널티를 시험합니다." },
];

const TEST_DECK_FILTERS = [
  ["all", "전체"], ["contact", "접촉"], ["nonContact", "비접촉"],
  ["top", "TOP"], ["middle", "MIDDLE"], ["base", "BASE"],
  ["tier-1", "1티어"], ["tier-2", "2티어"], ["tier-3", "3티어"], ["tier-4", "4티어"],
];

const ATTACK_TRAIT_FILTERS = [
  ["multiHit", "⋙", "연타"],
  ["shieldPierce", "⟐", "관통"],
  ["turnScaling", "◷", "턴 비례"],
  ["shieldScaling", "⬡", "방어막 참조"],
  ["oil", "◉", "오일"],
];

export function createStartingDeckBuilderUi({
  cards: CARDS,
  items: ITEMS,
  testItems: TEST_ITEMS,
  statusDefinitions: STATUS_DEFINITIONS,
  recommendedStartingDeck: RECOMMENDED_STARTING_DECK,
  getTier1Cards,
  localCardTest: LOCAL_CARD_TEST,
  cardHtml,
  itemHtml,
  startingCardCategory,
  startingDeckCategories,
  onStartRun,
  getElement = (id) => document.getElementById(id),
  documentRef = document,
}) {
  const $ = getElement;
  let startingDeckSelection = [];
  let startingDeckCategory = null;
  let startingDeckFilter = "all";
  let attackDeckFilters = { target: "any", traits: new Set(), statuses: new Set() };
  let startingDeckTestMode = false;
  let startingItemSelection = [];
  let startingBuilderContent = "cards";

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
    const tags = deriveCardMechanics(card);
    if (attackDeckFilters.target !== "any" && !tags.has(`target:${attackDeckFilters.target}`)) return false;
    if ([...attackDeckFilters.traits].some((tag) => !tags.has(tag))) return false;
    if ([...attackDeckFilters.statuses].some((id) => !tags.has(`status:${id}`))) return false;
    return true;
  }

  function startingDeckDialog() {
    let dialog = $("starting-deck-builder");
    if (dialog) return dialog;
    dialog = documentRef.createElement("dialog");
    dialog.id = "starting-deck-builder";
    dialog.className = "starting-deck-builder";
    dialog.innerHTML = `<div class="dialog-head"><div><small id="builder-eyebrow">PERFUMER'S TRAVEL BAG</small><h2 id="builder-title">시작 덱 편성</h2></div><button data-builder-action="close">닫기</button></div><div id="builder-content-tabs" class="builder-content-tabs" hidden><button data-builder-action="content" data-content="cards">카드 덱</button><button data-builder-action="content" data-content="items">증강 · 아이템</button></div><section class="builder-catalog"><div class="builder-heading builder-navigation"><h3 id="builder-category-title" tabindex="-1">카드 선택</h3><button data-builder-action="back" hidden>← 카테고리로 돌아가기</button></div><div id="builder-filters" class="builder-filters" hidden></div><div id="builder-categories" class="builder-categories"></div><div id="builder-pool" class="builder-pool" hidden></div></section><section class="builder-tray"><div class="builder-heading"><h3>내 덱 <b id="builder-count"></b></h3><div><button id="builder-preset" data-builder-action="preset">기본 추천 덱 채우기</button><button data-builder-action="clear">전체 비우기</button></div></div><div id="builder-selected" class="builder-selected"></div><div id="builder-item-selection" hidden><div class="builder-heading"><h3>선택된 증강 <b id="builder-item-count"></b></h3><button data-builder-action="clear-items">증강 비우기</button></div><div id="builder-selected-items" class="builder-selected"></div></div><button id="builder-start" class="primary builder-start" data-builder-action="start"></button></section>`;
    documentRef.body.append(dialog);
    dialog.addEventListener("click", (event) => {
      const button = event.target.closest("[data-builder-action]");
      if (!button) return;
      const action = button.dataset.builderAction, id = button.dataset.card;
      if (action === "close") dialog.close();
      else if (action === "content" && startingDeckTestMode) { startingBuilderContent = button.dataset.content; startingDeckCategory = null; }
      else if (action === "category" && (startingBuilderContent === "items" ? STARTING_ITEM_CATEGORIES : startingDeckCategories).some((category) => category.id === button.dataset.category)) {
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
        onStartRun?.({
          deckIds: [...startingDeckSelection],
          itemIds: [...startingItemSelection],
          testMode: startingDeckTestMode,
          dialog,
        });
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
      const category = STARTING_ITEM_CATEGORIES.find((entry) => entry.id === startingDeckCategory);
      $("builder-category-title").textContent = category ? `전체 티어 · ${category.name}` : "증강 종류 선택";
      dialog.querySelector('[data-builder-action="back"]').hidden = !category;
      $("builder-categories").hidden = !!category;
      $("builder-pool").hidden = !category;
      $("builder-filters").hidden = true;
      $("builder-categories").innerHTML = STARTING_ITEM_CATEGORIES.map((entry) => {
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
        .filter((status) => attackCards.some((card) => deriveCardMechanics(card).has(`status:${status.id}`))),
      attackAdvancedFilters = category?.id === "attack"
        ? `<div class="builder-filter-group"><b>대상</b>${[["single", "⌖", "단일"], ["all", "◎", "광역"], ["ricochet", "↝", "도탄"]].map(([id, icon, label]) => `<button data-builder-action="attack-filter" data-filter-group="target" data-filter="${id}" class="${attackDeckFilters.target === id ? "active" : ""}"><i>${icon}</i>${label}</button>`).join("")}</div>
          <div class="builder-filter-group"><b>특성</b>${ATTACK_TRAIT_FILTERS.map(([id, icon, label]) => `<button data-builder-action="attack-filter" data-filter-group="trait" data-filter="${id}" class="${attackDeckFilters.traits.has(id) ? "active" : ""}"><i>${icon}</i>${label}</button>`).join("")}</div>
          <div class="builder-filter-group builder-filter-statuses"><b>상태</b>${availableAttackStatuses.map((status) => `<button data-builder-action="attack-filter" data-filter-group="status" data-filter="${status.id}" class="${attackDeckFilters.statuses.has(status.id) ? "active" : ""}" style="--filter-color:${status.color}"><i>${status.icon}</i>${status.name}</button>`).join("")}<button class="builder-filter-clear" data-builder-action="clear-attack-filters">상세 초기화</button></div>`
        : "";
    $("builder-filters").innerHTML = startingDeckTestMode
      ? `<div class="builder-filter-group builder-filter-primary"><b>기본</b>${TEST_DECK_FILTERS.map(([id, label]) => `<button data-builder-action="filter" data-filter="${id}" class="${startingDeckFilter === id ? "active" : ""}">${label}</button>`).join("")}</div>${attackAdvancedFilters}`
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

  return {
    openStartingDeckBuilder,
    renderStartingDeckBuilder,
  };
}

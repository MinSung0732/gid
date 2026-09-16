export function createDeckReplacementUi({
  engine,
  cards,
  getRun,
  getMeta,
  cardHtml,
  cardCategory,
  cardCategories,
  save,
  render,
}) {
  let pendingRewardOption = null,
    deckReplacementFilter = "all";
  const $ = (id) => document.getElementById(id);

  function renderDeckReplacement() {
    const run = getRun();
    if (!pendingRewardOption || !run) return;
    const chosen = cards[pendingRewardOption.cardId],
      filters = [{ id: "all", name: "전체" }, ...cardCategories],
      visibleCards = run.deck
        .map((card, index) => ({ card, index }))
        .filter(
          ({ card }) =>
            deckReplacementFilter === "all" ||
            cardCategory(cards[card.id]) === deckReplacementFilter,
        );
    $("deck-replace-filters").innerHTML =
      filters
        .map(({ id, name }) => {
          const count =
            id === "all"
              ? run.deck.length
              : run.deck.filter((card) => cardCategory(cards[card.id]) === id)
                  .length;
          return `<button data-replace-filter="${id}" class="${deckReplacementFilter === id ? "active" : ""}">${name} <b>${count}</b></button>`;
        })
        .join("") +
      '<span class="deck-replace-scroll-controls"><button data-replace-scroll="-1" aria-label="이전 카드">←</button><button data-replace-scroll="1" aria-label="다음 카드">→</button></span>';
    $("deck-replace-list").innerHTML =
      visibleCards
        .map(({ card, index }) => {
          const wouldExceedCopies =
            run.deck.reduce(
              (count, held, heldIndex) =>
                count +
                (heldIndex !== index && held.id === chosen.id ? 1 : 0),
              0,
            ) >= engine.cardMaxCopies(chosen.id);
          return `<div>${cardHtml(card, null, {
            action: "deck-replace",
            card: card.id,
            replaceIndex: index,
            className: "deck-replace-card",
            ariaLabel: `${cards[card.id].name} 버리고 ${chosen.name} 받기`,
          })}<button data-replace-index="${index}" ${wouldExceedCopies ? "disabled" : ""}>${cards[card.id].name} 버리고<br><b>${chosen.name}</b> 받기</button></div>`;
        })
        .join("") ||
      '<p class="summary-empty">해당 카테고리의 카드가 없습니다.</p>';
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
      pendingRewardOption = null;
      dialog.close();
    };
    dialog.addEventListener("cancel", () => {
      pendingRewardOption = null;
    });
    dialog.addEventListener("click", (event) => {
      const scrollButton = event.target.closest("[data-replace-scroll]");
      if (scrollButton) {
        const list = $("deck-replace-list");
        list.scrollBy({
          left:
            Number(scrollButton.dataset.replaceScroll) *
            Math.max(180, list.clientWidth * 0.72),
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
      if (!button || !pendingRewardOption) return;
      const run = getRun(),
        index = Number(button.dataset.replaceIndex);
      if (
        !run ||
        !engine.claimReward(
          run,
          pendingRewardOption.optionId,
          getMeta(),
          index,
        )
      )
        return;
      pendingRewardOption = null;
      dialog.close();
      save();
      render();
    });
    const list = $("deck-replace-list");
    list.addEventListener(
      "wheel",
      (event) => {
        if (list.scrollWidth <= list.clientWidth) return;
        const rawDelta =
          Math.abs(event.deltaY) >= Math.abs(event.deltaX)
            ? event.deltaY
            : event.deltaX;
        if (!rawDelta) return;
        const cardStep = Math.max(160, list.clientWidth * 0.18);
        list.scrollBy({
          left: Math.sign(rawDelta) * cardStep,
          behavior: "smooth",
        });
        event.preventDefault();
        event.stopPropagation();
      },
      { passive: false, capture: true },
    );
    return dialog;
  }

  function requestDeckReplacement(optionId, cardId) {
    const run = getRun(),
      offer = run ? engine.currentRewardOffer(run) : null,
      option = offer?.options?.find(
        (candidate) => candidate.optionId === optionId,
      );
    if (
      !run ||
      !option ||
      option.claimed ||
      option.type !== "card" ||
      option.id !== cardId
    )
      return false;
    pendingRewardOption = { optionId, cardId };
    deckReplacementFilter = "all";
    const dialog = replacementDialog(),
      limit = engine.deckLimit(run);
    $("deck-replace-limit").textContent = `DECK LIMIT · ${limit}`;
    $("deck-replace-copy").textContent =
      `덱이 ${limit}장으로 가득 찼습니다. 아래 카드 한 장을 버리고 새 카드를 받습니다.`;
    renderDeckReplacement();
    dialog.showModal();
    return true;
  }

  function bindDeckReplacement(app) {
    app.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest(
          '[data-action="reward-claim"][data-card][data-option]',
        );
        const run = getRun();
        if (!button || !run || run.deck.length < engine.deckLimit(run)) return;
        event.stopImmediatePropagation();
        requestDeckReplacement(button.dataset.option, button.dataset.card);
      },
      true,
    );
  }

  return { bindDeckReplacement, requestDeckReplacement };
}

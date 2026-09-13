const PICKER_STATE = new WeakMap();

const CATEGORY_LABELS = Object.freeze({
  attack: "공격",
  defense: "방어",
  absorb: "흡수",
  heal: "회복",
  effect: "효과",
});
const NOTE_LABELS = Object.freeze({
  top: "TOP",
  middle: "MIDDLE",
  base: "BASE",
  none: "기타",
});
const TYPE_LABELS = Object.freeze({
  contact: "접촉",
  noncontact: "비접촉",
  oil: "오일",
  attack: "공격",
  defense: "방어",
  healing: "회복",
  absorb: "흡수",
  other: "기타",
});

function classValue(element, prefix) {
  if (!element) return null;
  const found = [...element.classList].find((name) => name.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function inferCardMeta(item, cardSelector = ".card") {
  const card = item.querySelector(cardSelector);
  if (!card) return null;
  const name = card.querySelector(":scope > strong")?.textContent?.trim() || "카드";
  const category = classValue(card, "card-category-") || "effect";
  const tier = Number(classValue(card, "card-tier-")) || 0;
  const note = classValue(card, "note-") || "none";
  const cardType = classValue(card, "card-type-") || "other";
  const pattern = card.querySelector(".attack-pattern.pattern-contact")
    ? "contact"
    : card.querySelector(
          ".attack-pattern.pattern-nonContact, .attack-pattern.pattern-noncontact",
        )
      ? "noncontact"
      : null;
  const oil = Boolean(card.querySelector(".classification-oil"));
  const types = [...new Set([pattern, oil ? "oil" : null, cardType].filter(Boolean))];
  const detailSource = card.querySelector(".card-effect-tooltip");
  const effectSource = card.querySelector(".card-effects");
  return {
    card,
    name,
    category,
    tier,
    note,
    type: types[0] || "other",
    types: types.length ? types : ["other"],
    oil,
    detailHtml: detailSource?.innerHTML || effectSource?.innerHTML || "",
    searchText: `${name} ${card.textContent || ""}`.toLocaleLowerCase("ko-KR"),
  };
}

function createSelect(label, filter, options) {
  const wrapper = document.createElement("label");
  wrapper.className = "deck-card-picker-filter";
  const caption = document.createElement("span");
  caption.textContent = label;
  const select = document.createElement("select");
  select.dataset.cardPickerFilter = filter;
  for (const [value, text] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.append(option);
  }
  wrapper.append(caption, select);
  return wrapper;
}

function filterOptions(entries, key, labels, order = []) {
  const values = [...new Set(entries.map(({ meta }) => meta?.[key]).filter(Boolean))];
  values.sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai !== -1 || bi !== -1)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return String(a).localeCompare(String(b), "ko-KR");
  });
  return [
    ["all", "전체"],
    ...values.map((value) => [String(value), labels[value] || String(value)]),
  ];
}

function multiFilterOptions(entries, key, labels, order = []) {
  const values = [
    ...new Set(entries.flatMap(({ meta }) => meta?.[key] || []).filter(Boolean)),
  ];
  values.sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai !== -1 || bi !== -1)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return String(a).localeCompare(String(b), "ko-KR");
  });
  return [
    ["all", "전체"],
    ...values.map((value) => [String(value), labels[value] || String(value)]),
  ];
}

function buildToolbar(state) {
  let toolbar = state.dialog.querySelector(":scope > .deck-card-picker-toolbar");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.className = "deck-card-picker-toolbar";
    const anchor = state.grid.parentElement?.classList.contains(
      "deck-card-picker-workspace",
    )
      ? state.grid.parentElement
      : state.grid;
    anchor.before(toolbar);
  }
  toolbar.replaceChildren();

  const search = document.createElement("label");
  search.className = "deck-card-picker-search";
  search.innerHTML =
    '<span>카드 찾기</span><input type="search" data-card-picker-search placeholder="이름·효과 검색" autocomplete="off" />';
  toolbar.append(search);

  const filters = document.createElement("div");
  filters.className = "deck-card-picker-filter-row";
  filters.append(
    createSelect(
      "카테고리",
      "category",
      filterOptions(state.entries, "category", CATEGORY_LABELS, [
        "attack",
        "defense",
        "absorb",
        "heal",
        "effect",
      ]),
    ),
    createSelect("등급", "tier", [
      ["all", "전체"],
      ["1", "1티어"],
      ["2", "2티어"],
      ["3", "3티어"],
      ["4", "4티어"],
    ]),
    createSelect(
      "노트",
      "note",
      filterOptions(state.entries, "note", NOTE_LABELS, [
        "top",
        "middle",
        "base",
        "none",
      ]),
    ),
    createSelect(
      "유형",
      "type",
      multiFilterOptions(state.entries, "types", TYPE_LABELS, [
        "contact",
        "noncontact",
        "oil",
        "attack",
        "defense",
        "healing",
        "absorb",
        "other",
      ]),
    ),
  );
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "deck-card-picker-reset";
  reset.dataset.cardPickerReset = "";
  reset.textContent = "필터 초기화";
  filters.append(reset);
  toolbar.append(filters);

  const result = document.createElement("span");
  result.className = "deck-card-picker-result";
  result.dataset.cardPickerResult = "";
  toolbar.append(result);
}

function ensureWorkspace(state) {
  let workspace = state.grid.parentElement?.classList.contains(
    "deck-card-picker-workspace",
  )
    ? state.grid.parentElement
    : null;
  if (!workspace) {
    workspace = document.createElement("section");
    workspace.className = "deck-card-picker-workspace";
    workspace.setAttribute("aria-label", "카드 선택 및 상세 보기");
    state.grid.before(workspace);
    workspace.append(state.grid);
  }
  let detail = workspace.querySelector(":scope > .deck-card-picker-detail");
  if (!detail) {
    detail = document.createElement("aside");
    detail.className = "deck-card-picker-detail is-empty";
    detail.setAttribute("aria-live", "polite");
    detail.innerHTML =
      '<div class="deck-card-picker-detail-head"><small data-card-picker-detail-label>CARD DETAIL</small><strong data-card-picker-detail-name>카드 상세보기</strong><span data-card-picker-detail-meta>카드에 마우스를 올리거나 선택하세요.</span></div><div class="deck-card-picker-detail-preview" data-card-picker-detail-preview></div><div class="deck-card-picker-detail-effect" data-card-picker-detail-effect>전체 효과와 분류를 여기에서 확인할 수 있습니다.</div>';
    workspace.append(detail);
  }
  state.workspace = workspace;
  state.detail = detail;
  return workspace;
}

function ensureActionBar(state) {
  let bar = state.dialog.querySelector(":scope > .deck-card-picker-actionbar");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "deck-card-picker-actionbar";
    bar.innerHTML =
      '<div class="deck-card-picker-selection"><small>선택 카드</small><strong data-card-picker-selected-name>카드를 선택하세요</strong><span data-card-picker-selected-meta>카드를 고르면 여기에서 행동을 실행할 수 있습니다.</span></div><div class="deck-card-picker-actions" data-card-picker-actions><button type="button" disabled>카드를 먼저 선택하세요</button></div>';
    state.dialog.append(bar);
  }
  return bar;
}

function selectedMetaText(meta) {
  const typeLabels = meta.types
    .map((type) => TYPE_LABELS[type] || type)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 3);
  const parts = [
    CATEGORY_LABELS[meta.category] || meta.category,
    meta.tier ? `${meta.tier}티어` : null,
    NOTE_LABELS[meta.note] || meta.note,
    typeLabels.length ? typeLabels.join(" · ") : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function getOriginalActions(state, entry) {
  if (!entry || !state.actionSelector) return [];
  return [...entry.item.querySelectorAll(state.actionSelector)];
}

function prepareOriginalActions(state, entry) {
  for (const action of getOriginalActions(state, entry)) {
    action.classList.add("deck-card-picker-original-action");
    action.tabIndex = -1;
    action.setAttribute("aria-hidden", "true");
  }
}

function clearSelectionState(state) {
  state.selectedIndex = null;
  state.entries.forEach(({ item }) => {
    item.classList.remove("is-selected");
    item.setAttribute("aria-selected", "false");
  });
}

function detailEntry(state, index) {
  if (!Number.isInteger(index)) return null;
  const entry = state.entries[index];
  return entry && !entry.item.hidden ? entry : null;
}

function updateDetail(state, index = null) {
  const detail =
      state.detail ||
      ensureWorkspace(state).querySelector(":scope > .deck-card-picker-detail"),
    entry = detailEntry(state, index),
    label = detail.querySelector("[data-card-picker-detail-label]"),
    name = detail.querySelector("[data-card-picker-detail-name]"),
    metaText = detail.querySelector("[data-card-picker-detail-meta]"),
    preview = detail.querySelector("[data-card-picker-detail-preview]"),
    effect = detail.querySelector("[data-card-picker-detail-effect]");
  preview.replaceChildren();
  if (!entry) {
    detail.classList.add("is-empty");
    label.textContent = "CARD DETAIL";
    name.textContent = "카드 상세보기";
    metaText.textContent = "카드에 마우스를 올리거나 선택하세요.";
    effect.textContent = "전체 효과와 분류를 여기에서 확인할 수 있습니다.";
    return;
  }

  detail.classList.remove("is-empty");
  label.textContent = state.selectedIndex === index ? "SELECTED CARD" : "HOVER DETAIL";
  name.textContent = entry.meta.name;
  metaText.textContent = selectedMetaText(entry.meta);

  const clone = entry.meta.card.cloneNode(true);
  clone.classList.add("deck-card-picker-detail-card");
  clone.removeAttribute("data-action");
  clone.removeAttribute("data-index");
  clone.removeAttribute("data-replace-index");
  clone.removeAttribute("disabled");
  clone.tabIndex = -1;
  clone.setAttribute("aria-hidden", "true");
  clone
    .querySelectorAll("[data-action], [data-index], [data-replace-index]")
    .forEach((node) => {
      node.removeAttribute("data-action");
      node.removeAttribute("data-index");
      node.removeAttribute("data-replace-index");
    });
  clone.querySelector(".card-effect-tooltip")?.remove();
  preview.append(clone);
  if (entry.meta.detailHtml) effect.innerHTML = entry.meta.detailHtml;
  else effect.textContent = "추가 상세 효과가 없습니다.";
}

function updateActionBar(state) {
  const bar = ensureActionBar(state);
  const name = bar.querySelector("[data-card-picker-selected-name]");
  const detail = bar.querySelector("[data-card-picker-selected-meta]");
  const actions = bar.querySelector("[data-card-picker-actions]");
  let entry =
    state.selectedIndex === null ? null : state.entries[state.selectedIndex];
  actions.replaceChildren();
  if (!entry || entry.item.hidden) {
    if (state.selectedIndex !== null) clearSelectionState(state);
    entry = null;
    name.textContent = "카드를 선택하세요";
    detail.textContent = "카드를 고르면 여기에서 행동을 실행할 수 있습니다.";
    const disabled = document.createElement("button");
    disabled.type = "button";
    disabled.disabled = true;
    disabled.textContent = "카드를 먼저 선택하세요";
    actions.append(disabled);
    return;
  }
  name.textContent = entry.meta.name;
  detail.textContent = selectedMetaText(entry.meta);
  const originals = getOriginalActions(state, entry);
  if (!originals.length) {
    const disabled = document.createElement("button");
    disabled.type = "button";
    disabled.disabled = true;
    disabled.textContent = "실행할 행동이 없습니다";
    actions.append(disabled);
    return;
  }
  originals.forEach((original, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `deck-card-picker-action${
      original.classList.contains("current") ? " current" : ""
    }${index === originals.length - 1 && originals.length === 1 ? " primary" : ""}`;
    button.disabled = original.disabled;
    button.textContent = original.textContent.trim();
    button.dataset.cardPickerProxyAction = String(index);
    actions.append(button);
  });
}

function applyFilters(state) {
  const query = state.filters.query.trim().toLocaleLowerCase("ko-KR");
  let visible = 0;
  state.entries.forEach((entry, index) => {
    const { meta, item } = entry;
    const matches =
      (!query || meta.searchText.includes(query)) &&
      (state.filters.category === "all" ||
        meta.category === state.filters.category) &&
      (state.filters.tier === "all" ||
        String(meta.tier) === state.filters.tier) &&
      (state.filters.note === "all" || meta.note === state.filters.note) &&
      (state.filters.type === "all" || meta.types.includes(state.filters.type));
    item.hidden = !matches;
    item.dataset.cardPickerIndex = String(index);
    if (matches) visible += 1;
  });

  if (state.selectedIndex !== null && !detailEntry(state, state.selectedIndex))
    clearSelectionState(state);
  if (state.previewIndex !== null && !detailEntry(state, state.previewIndex))
    state.previewIndex = null;

  const result = state.dialog.querySelector("[data-card-picker-result]");
  if (result) result.textContent = `${state.entries.length}장 중 ${visible}장`;
  updateActionBar(state);
  updateDetail(
    state,
    state.previewIndex !== null ? state.previewIndex : state.selectedIndex,
  );
}

function setSelected(state, index) {
  if (!detailEntry(state, index)) return;
  state.selectedIndex = index;
  state.entries.forEach(({ item }, itemIndex) => {
    const active = itemIndex === index;
    item.classList.toggle("is-selected", active);
    item.setAttribute("aria-selected", String(active));
  });
  updateActionBar(state);
  updateDetail(state, state.previewIndex !== null ? state.previewIndex : index);
}

function previewItem(state, item) {
  if (!item || !state.grid.contains(item)) return;
  const index = Number(item.dataset.cardPickerIndex);
  if (!Number.isInteger(index) || !detailEntry(state, index)) return;
  state.previewIndex = index;
  updateDetail(state, index);
}

function clearPreview(state) {
  state.previewIndex = null;
  updateDetail(state, state.selectedIndex);
}

function bindPicker(state) {
  if (state.bound) return;
  state.bound = true;

  state.dialog.addEventListener("input", (event) => {
    const search = event.target.closest("[data-card-picker-search]");
    if (!search) return;
    state.filters.query = search.value;
    applyFilters(state);
  });

  state.dialog.addEventListener("change", (event) => {
    const select = event.target.closest("[data-card-picker-filter]");
    if (!select) return;
    state.filters[select.dataset.cardPickerFilter] = select.value;
    applyFilters(state);
  });

  state.dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-card-picker-reset]")) {
      state.filters = {
        query: "",
        category: "all",
        tier: "all",
        note: "all",
        type: "all",
      };
      const search = state.dialog.querySelector("[data-card-picker-search]");
      if (search) search.value = "";
      state.dialog
        .querySelectorAll("[data-card-picker-filter]")
        .forEach((select) => {
          select.value = "all";
        });
      applyFilters(state);
      return;
    }

    const proxy = event.target.closest("[data-card-picker-proxy-action]");
    if (proxy) {
      const entry =
        state.selectedIndex === null ? null : state.entries[state.selectedIndex];
      const original = getOriginalActions(state, entry)[
        Number(proxy.dataset.cardPickerProxyAction)
      ];
      if (original && !original.disabled) original.click();
      return;
    }

    if (event.target.closest(".deck-card-picker-original-action")) return;
    const item = event.target.closest(state.itemSelector);
    if (!item || !state.grid.contains(item)) return;
    const index = Number(item.dataset.cardPickerIndex);
    if (Number.isInteger(index)) setSelected(state, index);
  });

  state.dialog.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const item = event.target.closest(state.itemSelector);
    if (!item || !state.grid.contains(item)) return;
    event.preventDefault();
    const index = Number(item.dataset.cardPickerIndex);
    if (Number.isInteger(index)) setSelected(state, index);
  });

  state.dialog.addEventListener("pointerover", (event) => {
    const item = event.target.closest(state.itemSelector);
    if (!item || !state.grid.contains(item) || item.contains(event.relatedTarget))
      return;
    previewItem(state, item);
  });

  state.dialog.addEventListener("pointerout", (event) => {
    const item = event.target.closest(state.itemSelector);
    if (!item || !state.grid.contains(item) || item.contains(event.relatedTarget))
      return;
    clearPreview(state);
  });

  state.dialog.addEventListener("focusin", (event) => {
    const item = event.target.closest(state.itemSelector);
    if (item && state.grid.contains(item)) previewItem(state, item);
  });

  state.dialog.addEventListener("focusout", (event) => {
    const item = event.target.closest(state.itemSelector);
    if (!item || !state.grid.contains(item)) return;
    if (event.relatedTarget && item.contains(event.relatedTarget)) return;
    clearPreview(state);
  });
}

function enhance(options) {
  const dialog =
      typeof options.dialog === "string"
        ? document.querySelector(options.dialog)
        : options.dialog,
    grid =
      typeof options.grid === "string"
        ? dialog?.querySelector(options.grid)
        : options.grid;
  if (!dialog || !grid) return null;

  let state = PICKER_STATE.get(dialog);
  if (!state) {
    state = {
      dialog,
      grid,
      itemSelector: options.itemSelector,
      cardSelector: options.cardSelector || ".card",
      actionSelector: options.actionSelector,
      filters: {
        query: "",
        category: "all",
        tier: "all",
        note: "all",
        type: "all",
      },
      entries: [],
      selectedIndex: null,
      previewIndex: null,
      bound: false,
      workspace: null,
      detail: null,
    };
    PICKER_STATE.set(dialog, state);
  } else {
    state.grid = grid;
    state.itemSelector = options.itemSelector;
    state.cardSelector = options.cardSelector || state.cardSelector;
    state.actionSelector = options.actionSelector;
    state.selectedIndex = null;
    state.previewIndex = null;
    state.filters = {
      query: "",
      category: "all",
      tier: "all",
      note: "all",
      type: "all",
    };
  }

  dialog.classList.add("deck-card-picker-dialog");
  grid.classList.add("deck-card-picker-grid");
  state.entries = [...grid.querySelectorAll(state.itemSelector)]
    .map((item) => ({ item, meta: inferCardMeta(item, state.cardSelector) }))
    .filter((entry) => entry.meta);

  state.entries.forEach((entry, index) => {
    const { item, meta } = entry;
    item.classList.add("deck-card-picker-item");
    item.dataset.cardPickerIndex = String(index);
    item.tabIndex = 0;
    item.setAttribute("role", "option");
    item.setAttribute("aria-label", `${meta.name} 선택`);
    item.setAttribute("aria-selected", "false");
    meta.card.tabIndex = -1;
    meta.card.setAttribute("aria-hidden", "true");
    prepareOriginalActions(state, entry);
  });
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", "내 덱 카드 선택");

  buildToolbar(state);
  ensureWorkspace(state);
  ensureActionBar(state);
  bindPicker(state);
  applyFilters(state);
  return state;
}

function enhanceSpecialDeckPicker(
  dialog = document.getElementById("special-deck-picker"),
) {
  if (!dialog) return null;
  return enhance({
    dialog,
    grid: dialog.querySelector("#special-deck-picker-grid"),
    itemSelector: ".special-deck-picker-card",
    cardSelector: ".card",
    actionSelector: ".special-deck-picker-actions > button",
  });
}

function enhanceDeckReplacement(dialog = document.getElementById("deck-replace")) {
  if (!dialog) return null;
  return enhance({
    dialog,
    grid: dialog.querySelector("#deck-replace-list"),
    itemSelector: "#deck-replace-list > div",
    cardSelector: ".card",
    actionSelector: ":scope > button[data-replace-index]:not(.card)",
  });
}

function enhanceOpenPicker(dialog) {
  if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return;
  if (dialog.id === "special-deck-picker") enhanceSpecialDeckPicker(dialog);
  else if (dialog.id === "deck-replace") enhanceDeckReplacement(dialog);
}

window.HarmonyCardPickerUI = Object.freeze({
  enhance,
  enhanceSpecialDeckPicker,
  enhanceDeckReplacement,
  inferCardMeta,
});

const dialogObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    const dialog = mutation.target;
    if (
      mutation.type === "attributes" &&
      mutation.attributeName === "open" &&
      dialog instanceof HTMLDialogElement &&
      ["special-deck-picker", "deck-replace"].includes(dialog.id) &&
      dialog.open
    ) {
      requestAnimationFrame(() => enhanceOpenPicker(dialog));
    }
  }
});
dialogObserver.observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ["open"],
});

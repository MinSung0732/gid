import { CARDS } from "./data.js?v=20260913-1";
import { STATUS_DEFINITIONS } from "./statuses.js?v=20260911-4";

const dialog = document.getElementById("run-summary");
const deckRoot = document.getElementById("run-deck-list");

const CATEGORY_LABELS = Object.freeze({
  attack: "공격",
  defense: "방어",
  absorb: "흡수",
  heal: "회복",
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
  shield: "방어막",
  healing: "회복",
  absorb: "흡수",
  draw: "드로우",
  status: "상태 효과",
});

const state = {
  query: "",
  category: "all",
  tier: "all",
  note: "all",
  type: "all",
};

let syncing = false;
let syncQueued = false;

function categoryOf(card) {
  if (!card) return "absorb";
  if (["attack", "defense", "absorb", "heal"].includes(card.category))
    return card.category;
  if (card.attack || card.burst || card.weight) return "attack";
  if (card.heal || card.missingHpHealRatio) return "heal";
  if (card.shield) return "defense";
  return "absorb";
}

function noteOf(card) {
  return card?.note || "none";
}

function typesOf(card) {
  if (!card) return [];
  const types = new Set();
  if (card.attackPattern === "contact") types.add("contact");
  if (card.attackPattern === "nonContact" || card.attackPattern === "noncontact")
    types.add("noncontact");
  if (card.oil) types.add("oil");
  if (card.shield) types.add("shield");
  if (card.heal || card.missingHpHealRatio) types.add("healing");
  if (card.absorb || card.burst) types.add("absorb");
  if (
    card.draw ||
    card.drawOnBreak ||
    card.drawOnKill ||
    card.searchDrawCard
  )
    types.add("draw");
  if (
    Object.keys(card.applyEnemy || {}).length ||
    Object.keys(card.applyPlayer || {}).length ||
    card.cleanse ||
    card.cleanseDotStacks
  )
    types.add("status");
  return [...types];
}

function statusNames(card) {
  const ids = new Set([
    ...Object.keys(card?.applyEnemy || {}),
    ...Object.keys(card?.applyPlayer || {}),
  ]);
  return [...ids]
    .map((id) => STATUS_DEFINITIONS[id]?.name || id)
    .join(" ");
}

function semanticWords(card, category, types) {
  const words = [
    card?.name,
    card?.flavor,
    CATEGORY_LABELS[category],
    NOTE_LABELS[noteOf(card)],
    ...types.map((type) => TYPE_LABELS[type]),
    statusNames(card),
  ];
  if (card?.attack || card?.burst || card?.weight) words.push("공격 피해");
  if (card?.shield) words.push("방어 방어막");
  if (card?.heal || card?.missingHpHealRatio) words.push("회복 체력");
  if (card?.absorb || card?.burst) words.push("흡수");
  if (card?.draw || card?.drawOnBreak || card?.drawOnKill || card?.searchDrawCard)
    words.push("드로우 카드 뽑기");
  if (card?.oil) words.push("오일");
  if (card?.cleanse || card?.cleanseDotStacks)
    words.push("정화 연소 부식 중독 출혈");
  if (
    card?.harmonyHealShield ||
    card?.harmonyDamage ||
    card?.harmonyShield ||
    card?.harmony
  )
    words.push("하모니");
  return words.filter(Boolean).join(" ");
}

function copyCount(row) {
  const text = row.querySelector(".summary-deck-levels b")?.textContent || "";
  return Number(text.match(/총\s*(\d+)장/)?.[1] || 1);
}

function entryFor(row) {
  const button = row.querySelector("[data-run-summary-card]");
  const id = button?.dataset.runSummaryCard;
  const card = id ? CARDS[id] : null;
  if (!id || !card) return null;
  const category = categoryOf(card);
  const note = noteOf(card);
  const types = typesOf(card);
  const tier = Number(card.tier) || 1;
  const searchText = `${semanticWords(card, category, types)} ${row.textContent || ""}`
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, " ");
  return {
    row,
    id,
    card,
    name: card.name || id,
    category,
    tier,
    note,
    types,
    searchText,
    copies: copyCount(row),
  };
}

function optionMarkup(values, labels, allLabel = "전체") {
  return [
    `<option value="all">${allLabel}</option>`,
    ...values.map(
      (value) =>
        `<option value="${value}">${labels?.[value] || value}</option>`,
    ),
  ].join("");
}

function buildToolbar(entries) {
  const old = deckRoot.querySelector(":scope > .summary-deck-toolbar");
  if (old?.classList.contains("run-summary-filter-v2")) return old;

  const toolbar = document.createElement("div");
  toolbar.className = "summary-deck-toolbar run-summary-filter-v2";

  const categories = [...new Set(entries.map((entry) => entry.category))].sort(
    (a, b) => ["attack", "defense", "absorb", "heal"].indexOf(a) - ["attack", "defense", "absorb", "heal"].indexOf(b),
  );
  const tiers = [...new Set(entries.map((entry) => entry.tier))].sort((a, b) => a - b);
  const notes = [...new Set(entries.map((entry) => entry.note))].sort(
    (a, b) => ["top", "middle", "base", "none"].indexOf(a) - ["top", "middle", "base", "none"].indexOf(b),
  );
  const types = [...new Set(entries.flatMap((entry) => entry.types))].sort(
    (a, b) => ["contact", "noncontact", "oil", "shield", "healing", "absorb", "draw", "status"].indexOf(a) - ["contact", "noncontact", "oil", "shield", "healing", "absorb", "draw", "status"].indexOf(b),
  );

  toolbar.innerHTML = `
    <div class="run-summary-filter-head">
      <label class="run-summary-search">
        <span>카드 찾기</span>
        <input type="search" data-run-deck-search placeholder="이름·효과 검색" autocomplete="off" />
      </label>
      <span class="run-summary-filter-result" data-run-deck-filter-result></span>
      <button type="button" class="run-summary-filter-reset" data-run-deck-reset>필터 초기화</button>
    </div>
    <div class="run-summary-filter-row">
      <label><span>카테고리</span><select data-run-deck-filter="category">${optionMarkup(categories, CATEGORY_LABELS)}</select></label>
      <label><span>등급</span><select data-run-deck-filter="tier">${optionMarkup(tiers.map(String), Object.fromEntries(tiers.map((tier) => [String(tier), `${tier}티어`])) )}</select></label>
      <label><span>노트</span><select data-run-deck-filter="note">${optionMarkup(notes, NOTE_LABELS)}</select></label>
      <label><span>유형</span><select data-run-deck-filter="type">${optionMarkup(types, TYPE_LABELS)}</select></label>
    </div>`;

  old?.replaceWith(toolbar);
  if (!old) deckRoot.prepend(toolbar);

  const search = toolbar.querySelector("[data-run-deck-search]");
  search.value = state.query;
  toolbar.querySelector('[data-run-deck-filter="category"]').value = state.category;
  toolbar.querySelector('[data-run-deck-filter="tier"]').value = state.tier;
  toolbar.querySelector('[data-run-deck-filter="note"]').value = state.note;
  toolbar.querySelector('[data-run-deck-filter="type"]').value = state.type;
  return toolbar;
}

function matches(entry) {
  const query = state.query.trim().toLocaleLowerCase("ko-KR");
  return (
    (!query || entry.searchText.includes(query)) &&
    (state.category === "all" || entry.category === state.category) &&
    (state.tier === "all" || String(entry.tier) === state.tier) &&
    (state.note === "all" || entry.note === state.note) &&
    (state.type === "all" || entry.types.includes(state.type))
  );
}

function alphabetize(entries) {
  const list = deckRoot.querySelector(".summary-deck-list");
  if (!list) return;
  const sorted = [...entries].sort((a, b) =>
    a.name.localeCompare(b.name, "ko-KR", { numeric: true, sensitivity: "base" }),
  );
  sorted.forEach((entry, index) => {
    const current = list.children[index];
    if (current !== entry.row) list.insertBefore(entry.row, current || null);
  });
}

function applyFilters(entries, toolbar) {
  let visibleKinds = 0;
  let visibleCopies = 0;
  for (const entry of entries) {
    const visible = matches(entry);
    entry.row.hidden = !visible;
    if (visible) {
      visibleKinds += 1;
      visibleCopies += entry.copies;
    }
  }
  const result = toolbar.querySelector("[data-run-deck-filter-result]");
  if (result)
    result.textContent = `${visibleKinds}종 · ${visibleCopies}장 / 전체 ${entries.length}종`;

  const empty = deckRoot.querySelector(".summary-deck-list > .run-summary-filter-empty");
  if (!visibleKinds) {
    if (!empty) {
      const message = document.createElement("p");
      message.className = "summary-empty run-summary-filter-empty";
      message.textContent = "조건에 맞는 카드가 없습니다.";
      deckRoot.querySelector(".summary-deck-list")?.append(message);
    }
  } else {
    empty?.remove();
  }
}

function sync() {
  syncQueued = false;
  if (syncing || !deckRoot?.classList.contains("summary-deck-shell")) return;
  const rows = [...deckRoot.querySelectorAll(".summary-deck-list > .summary-deck-entry")];
  if (!rows.length) return;
  const entries = rows.map(entryFor).filter(Boolean);
  if (!entries.length) return;
  syncing = true;
  try {
    const toolbar = buildToolbar(entries);
    alphabetize(entries);
    applyFilters(entries, toolbar);
  } finally {
    syncing = false;
  }
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  requestAnimationFrame(sync);
}

function resetFilters({ syncNow = true } = {}) {
  state.query = "";
  state.category = "all";
  state.tier = "all";
  state.note = "all";
  state.type = "all";
  if (syncNow) queueSync();
}

deckRoot?.addEventListener("input", (event) => {
  const search = event.target.closest?.("[data-run-deck-search]");
  if (!search) return;
  state.query = search.value;
  const entries = [...deckRoot.querySelectorAll(".summary-deck-list > .summary-deck-entry")]
    .map(entryFor)
    .filter(Boolean);
  applyFilters(entries, deckRoot.querySelector(".run-summary-filter-v2"));
});

deckRoot?.addEventListener("change", (event) => {
  const select = event.target.closest?.("[data-run-deck-filter]");
  if (!select) return;
  state[select.dataset.runDeckFilter] = select.value;
  const entries = [...deckRoot.querySelectorAll(".summary-deck-list > .summary-deck-entry")]
    .map(entryFor)
    .filter(Boolean);
  applyFilters(entries, deckRoot.querySelector(".run-summary-filter-v2"));
});

deckRoot?.addEventListener("click", (event) => {
  if (!event.target.closest?.("[data-run-deck-reset]")) return;
  resetFilters({ syncNow: false });
  const toolbar = deckRoot.querySelector(".run-summary-filter-v2");
  if (!toolbar) return;
  toolbar.querySelector("[data-run-deck-search]").value = "";
  toolbar.querySelectorAll("[data-run-deck-filter]").forEach((select) => {
    select.value = "all";
  });
  const entries = [...deckRoot.querySelectorAll(".summary-deck-list > .summary-deck-entry")]
    .map(entryFor)
    .filter(Boolean);
  applyFilters(entries, toolbar);
});

dialog?.addEventListener("close", () => resetFilters({ syncNow: false }));

if (deckRoot) {
  new MutationObserver(queueSync).observe(deckRoot, { childList: true, subtree: true });
  queueSync();
}

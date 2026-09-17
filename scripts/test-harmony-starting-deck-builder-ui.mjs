import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createStartingDeckBuilderUi } from "../games/harmony/starting-deck-builder-ui.js";
import { createCardPresentation } from "../games/harmony/card-presentation.js";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const source = await readFile(new URL("../games/harmony/starting-deck-builder-ui.js", import.meta.url), "utf8");

assert.match(main, /from "\.\/starting-deck-builder-ui\.js"/, "main should consume the starting deck builder UI module");
assert.match(
  main,
  /createStartingDeckBuilderUi\(\{[\s\S]*?cards:\s*CARDS[\s\S]*?items:\s*ITEMS[\s\S]*?testItems:\s*TEST_ITEMS[\s\S]*?statusDefinitions:\s*STATUS_DEFINITIONS[\s\S]*?recommendedStartingDeck:\s*RECOMMENDED_STARTING_DECK[\s\S]*?getTier1Cards[\s\S]*?localCardTest:\s*LOCAL_CARD_TEST[\s\S]*?startingCardCategory[\s\S]*?startingDeckCategories[\s\S]*?onStartRun:/,
  "main should inject existing builder dependencies and keep run orchestration outside the UI module",
);
assert.match(main, /const \{ openStartingDeckBuilder \} = createStartingDeckBuilderUi/);
assert.match(main, /E\.newRun\([\s\S]*?deckIds[\s\S]*?run\.testMode = testMode[\s\S]*?E\.addInventoryItem\(run, itemId\)/);
assert.doesNotMatch(main, /function startingDeckDialog\(/);
assert.doesNotMatch(main, /function renderStartingDeckBuilder\(/);
assert.doesNotMatch(main, /let startingDeckSelection\s*=/);
assert.doesNotMatch(main, /function cardClassificationTags\(/);

assert.match(
  main,
  /const \{[\s\S]*?cardEffectText:\s*baseCardEffectText[\s\S]*?cardHtml:\s*startingDeckCardHtml[\s\S]*?\} = createCardPresentation\(\{[\s\S]*?getRun:\s*\(\) => null[\s\S]*?getStarted:\s*\(\) => false[\s\S]*?\}\);/,
  "starting deck builder should render through a presentation that cannot see the active run",
);
assert.match(
  main,
  /createStartingDeckBuilderUi\(\{[\s\S]*?cardHtml:\s*startingDeckCardHtml/,
  "starting deck builder should use the base-only card renderer for catalog, selected cards, and details",
);

const presentationCards = {
  strike: {
    id: "strike",
    name: "Strike",
    tier: 1,
    cost: 1,
    category: "attack",
    attack: 10,
    maxUpgrade: 0,
    maxCopies: 10,
    note: "top",
    attackPattern: "contact",
  },
};
const presentationEngine = {
  cardDefinition(card) { return presentationCards[card.id]; },
  power(_run, key) { return key === "attack" ? 5 : key === "defense" ? 4 : 0; },
  cardStatusValueBreakdown() { return { delta: 2 }; },
  cost(_run, card) { return presentationCards[card.id].cost; },
};
const livePresentation = createCardPresentation({
  engine: presentationEngine,
  cards: presentationCards,
  statusDefinitions: {},
  getRun: () => ({ phase: "battle", battle: { selectedTarget: 0, enemies: [{}] } }),
  getStarted: () => true,
  tierStars: () => "",
});
const basePresentation = createCardPresentation({
  engine: presentationEngine,
  cards: presentationCards,
  statusDefinitions: {},
  getRun: () => null,
  getStarted: () => false,
  tierStars: () => "",
});
const liveCardMarkup = livePresentation.cardHtml({ id: "strike", level: 0 });
const baseCardMarkup = basePresentation.cardHtml({ id: "strike", level: 0 });
assert.match(liveCardMarkup, /피해 <b>15<\/b>/, "combat presentation may include runtime attack power");
assert.match(liveCardMarkup, /card-value-modifier positive[^>]*>\(\+2\)<\/span>/, "combat detail may include runtime status modifiers");
assert.match(baseCardMarkup, /피해 <b>10<\/b>/, "builder presentation should keep the original card damage");
assert.doesNotMatch(baseCardMarkup, /피해 <b>15<\/b>|card-value-modifier/, "builder presentation should ignore every active-run modifier source");

for (const marker of [
  "data-builder-action",
  "LOCAL CARD LAB",
  "PERFUMER'S TRAVEL BAG",
  "clear-attack-filters",
  "statusDefinitions: STATUS_DEFINITIONS",
  "TEST_DECK_FILTERS",
  "STARTING_ITEM_CATEGORIES",
  "validStartingDeck",
  "validTestDeck",
]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `starting deck builder module should preserve ${marker}`);

function makeClassList() {
  const values = new Set();
  return {
    toggle(name, force) {
      if (force) values.add(name);
      else values.delete(name);
    },
    contains(name) { return values.has(name); },
  };
}

const elements = new Map();
function makeElement(id) {
  return {
    id,
    hidden: false,
    disabled: false,
    innerHTML: "",
    textContent: "",
    scrollTop: 0,
    classList: makeClassList(),
    previousElementSibling: { hidden: false },
    parentElement: { querySelector: () => null },
    listeners: new Map(),
    addEventListener(type, handler) { this.listeners.set(type, handler); },
    focusCalls: 0,
    focus() { this.focusCalls += 1; },
  };
}

for (const id of [
  "builder-content-tabs",
  "builder-eyebrow",
  "builder-title",
  "builder-preset",
  "builder-count",
  "builder-selected",
  "builder-item-selection",
  "builder-item-count",
  "builder-selected-items",
  "builder-pool",
  "builder-category-title",
  "builder-categories",
  "builder-filters",
  "builder-start",
]) elements.set(id, makeElement(id));

const backButton = { hidden: false };
const contentTabs = [
  { dataset: { content: "cards" }, classList: makeClassList() },
  { dataset: { content: "items" }, classList: makeClassList() },
];
const documentRef = {
  body: {
    append(node) {
      elements.set(node.id, node);
    },
  },
  createElement(tag) {
    assert.equal(tag, "dialog");
    return {
      id: "",
      className: "",
      innerHTML: "",
      classList: makeClassList(),
      listeners: new Map(),
      showModalCalls: 0,
      closeCalls: 0,
      addEventListener(type, handler) { this.listeners.set(type, handler); },
      showModal() { this.showModalCalls += 1; },
      close() { this.closeCalls += 1; },
      querySelector(selector) {
        if (selector === '[data-builder-action="back"]') return backButton;
        return null;
      },
      querySelectorAll(selector) {
        return selector === "[data-builder-action=content]" ? contentTabs : [];
      },
    };
  },
};

const cards = {
  strike: { id: "strike", name: "Strike", tier: 1, maxCopies: 10, category: "attack", note: "top", attackPattern: "contact", hits: 1 },
  mist: { id: "mist", name: "Mist", tier: 2, maxCopies: 10, category: "absorb", note: "middle", attackPattern: "nonContact", hits: 1 },
  impurity: { id: "impurity", name: "Impurity", tier: 1, maxCopies: 99, category: "attack", note: "base", hits: 1 },
};
let startedPayload = null;
const ui = createStartingDeckBuilderUi({
  cards,
  items: {},
  testItems: {},
  statusDefinitions: {},
  recommendedStartingDeck: Array(10).fill("strike"),
  getTier1Cards: () => [cards.strike],
  localCardTest: true,
  cardHtml: (card) => `CARD:${card.id}`,
  itemHtml: (id) => `ITEM:${id}`,
  startingCardCategory: (card) => card.category,
  startingDeckCategories: [
    { id: "attack", name: "공격", icon: "⚔", description: "attack" },
    { id: "absorb", name: "흡수", icon: "◉", description: "absorb" },
  ],
  onStartRun: (payload) => { startedPayload = payload; },
  getElement: (id) => elements.get(id) || null,
  documentRef,
});

ui.openStartingDeckBuilder(false);
const dialog = elements.get("starting-deck-builder");
assert.equal(dialog.showModalCalls, 1);
assert.equal(elements.get("builder-title").textContent, "시작 덱 편성");
assert.equal(elements.get("builder-count").textContent, "(0 / 10장)");
assert.match(elements.get("builder-categories").innerHTML, /공격/);
assert.equal(elements.get("builder-start").disabled, true);

const click = dialog.listeners.get("click");
function fire(dataset) {
  const button = { dataset };
  click({ target: { closest: (selector) => selector === "[data-builder-action]" ? button : null } });
}
fire({ builderAction: "category", category: "attack" });
assert.equal(backButton.hidden, false);
assert.match(elements.get("builder-pool").innerHTML, /CARD:strike/);
fire({ builderAction: "preset" });
assert.equal(elements.get("builder-count").textContent, "(10 / 10장)");
assert.equal(elements.get("builder-start").disabled, false);
fire({ builderAction: "start" });
assert.deepEqual(startedPayload.deckIds, Array(10).fill("strike"));
assert.deepEqual(startedPayload.itemIds, []);
assert.equal(startedPayload.testMode, false);
assert.equal(startedPayload.dialog, dialog);

ui.openStartingDeckBuilder(true);
assert.equal(dialog.showModalCalls, 2);
assert.equal(elements.get("builder-title").textContent, "카드 테스트 덱 편성");
assert.equal(elements.get("builder-content-tabs").hidden, false);
fire({ builderAction: "preset" });
assert.match(elements.get("builder-count").textContent, /제한 없음/);
assert.doesNotMatch(elements.get("builder-selected").innerHTML, /impurity/i, "test preset should continue excluding impurity");

console.log("PASS Harmony starting deck builder UI is modular without changing normal/test deck selection and start contracts.");

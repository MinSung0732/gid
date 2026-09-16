import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRunSummaryUi } from "../games/harmony/run-summary-ui.js";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const source = await readFile(new URL("../games/harmony/run-summary-ui.js", import.meta.url), "utf8");

assert.match(main, /from "\.\/run-summary-ui\.js"/, "main should consume the run summary UI module");
assert.match(
  main,
  /createRunSummaryUi\(\{[\s\S]*?getRun:[\s\S]*?cards:\s*CARDS[\s\S]*?cardHtml[\s\S]*?itemHtml[\s\S]*?countItemIds[\s\S]*?startingCardCategory[\s\S]*?\}\)/,
  "main should inject existing run summary dependencies",
);
assert.match(main, /bindRunSummary\(\);/);
assert.doesNotMatch(main, /function renderRunDeckSummary\(/);
assert.doesNotMatch(main, /let runSummaryFilter\s*=/);
for (const marker of [
  "data-run-summary-filter",
  "data-run-summary-sort",
  "data-run-summary-card",
  "summary-deck-shell",
  "run-summary-close",
]) assert.match(source, new RegExp(marker), `run summary module should preserve ${marker}`);

const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      className: "",
      innerHTML: "",
      textContent: "",
      showModalCalls: 0,
      closeCalls: 0,
      listeners: new Map(),
      showModal() { this.showModalCalls += 1; },
      close() { this.closeCalls += 1; },
      addEventListener(type, handler) { this.listeners.set(type, handler); },
    });
  }
  return elements.get(id);
}
const eventRoot = { listeners: new Map(), addEventListener(type, handler) { this.listeners.set(type, handler); } };
const cards = {
  strike: { id: "strike", name: "Strike", cost: 1, note: "top", tier: 1, category: "attack" },
  guard: { id: "guard", name: "Guard", cost: 2, note: "base", tier: 3, category: "defense" },
  mist: { id: "mist", name: "Mist", cost: 1, note: "middle", tier: 2, category: "absorb" },
};
let run = {
  deck: [
    { id: "strike", level: 0 },
    { id: "strike", level: 2 },
    { id: "guard", level: 1 },
    { id: "mist", level: 0 },
  ],
  inventory: ["amber", "amber", "glass"],
};
const ui = createRunSummaryUi({
  getRun: () => run,
  cards,
  cardHtml: (card) => `CARD:${card.id}:+${card.level}`,
  itemHtml: (id, count) => `ITEM:${id}:${count}`,
  countItemIds: (ids) => [...new Set(ids)].map((id) => [id, ids.filter((value) => value === id).length]),
  startingCardCategory: (card) => card.category,
  getElement: element,
  eventRoot,
});

ui.bindRunSummary();
assert.ok(eventRoot.listeners.has("click"), "open handler should be bound on the document/root");
assert.ok(element("run-summary").listeners.has("click"), "summary interaction handler should be bound on the modal");
element("run-summary-close").onclick();
assert.equal(element("run-summary").closeCalls, 1, "close control should keep closing the modal");

ui.openRunSummary();
assert.equal(element("run-deck-title").textContent, "내 덱 · 4장");
assert.equal(element("run-item-title").textContent, "이번 여정 아이템 · 3개");
assert.equal(element("run-summary").showModalCalls, 1);
assert.match(element("run-item-list").innerHTML, /ITEM:amber:2/);
assert.match(element("run-item-list").innerHTML, /ITEM:glass:1/);
const initial = element("run-deck-list").innerHTML;
assert.ok(initial.indexOf("Guard") < initial.indexOf("Mist"), "default order should keep high tiers first");
assert.match(initial, /\+0 ×1 · \+2 ×1/);
assert.match(initial, /CARD:strike:\+2/, "selected detail should use the highest owned upgrade level");

const summaryClick = element("run-summary").listeners.get("click");
summaryClick({ target: { closest: (selector) => selector === "[data-run-summary-filter]" ? { dataset: { runSummaryFilter: "defense" } } : null } });
assert.match(element("run-deck-list").innerHTML, /Guard/);
assert.doesNotMatch(element("run-deck-list").innerHTML, /Strike/);
summaryClick({ target: { closest: (selector) => selector === "[data-run-summary-filter]" ? null : selector === "[data-run-summary-sort]" ? { dataset: { runSummarySort: "asc" } } : null } });
assert.match(element("run-deck-list").innerHTML, /낮은 티어순/);

run = null;
const before = element("run-summary").showModalCalls;
ui.openRunSummary();
assert.equal(element("run-summary").showModalCalls, before, "missing run state should not open the modal");

console.log("PASS Harmony run summary UI is modular without changing deck grouping, sorting, filtering, or item summary contracts.");

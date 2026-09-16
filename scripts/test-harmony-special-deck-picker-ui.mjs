import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSpecialDeckPickerUi } from "../games/harmony/special-deck-picker-ui.js";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const source = await readFile(new URL("../games/harmony/special-deck-picker-ui.js", import.meta.url), "utf8");

assert.match(main, /from "\.\/special-deck-picker-ui\.js"/, "main should consume the special deck picker UI module");
assert.match(
  main,
  /createSpecialDeckPickerUi\(\{[\s\S]*?engine:\s*E[\s\S]*?cards:\s*CARDS[\s\S]*?getRun:[\s\S]*?getMeta:[\s\S]*?getCardAnimating:[\s\S]*?presentationCardHtml[\s\S]*?save[\s\S]*?render[\s\S]*?\}\)/s,
  "main should inject the special deck picker dependencies",
);
assert.match(main, /bindSpecialDeckPicker\(\$\("app"\)\)/, "main should bind the extracted special deck picker");
for (const name of ["specialDeckPickerDialog", "specialDeckPickerActions", "renderSpecialDeckPicker", "openSpecialDeckPicker"]) {
  assert.doesNotMatch(main, new RegExp(`function ${name}\\(`), `${name} implementation should live outside main.js`);
}
assert.match(source, /engine\.chooseSpecial\(/, "picker should delegate special-room rules to the engine");
assert.match(source, /engine\.checkUnlocks\(/, "picker should preserve unlock checks after a special choice");

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.id = "";
    this.className = "";
    this.dataset = {};
    this.listeners = new Map();
    this.innerHTML = "";
    this.textContent = "";
    this.open = false;
    this.showModalCount = 0;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  emit(type, event) {
    for (const handler of this.listeners.get(type) || []) handler(event);
  }

  showModal() {
    this.open = true;
    this.showModalCount += 1;
  }

  close() {
    this.open = false;
    this.emit("close", {});
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.body = {
      append: (element) => {
        this.register(element);
        for (const match of element.innerHTML.matchAll(/id="([^"]+)"/g)) {
          if (!this.elements.has(match[1])) {
            const child = new FakeElement("div", this);
            child.id = match[1];
            this.register(child);
          }
        }
      },
    };
  }

  register(element) {
    if (element.id) this.elements.set(element.id, element);
    return element;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }
}

const document = new FakeDocument();
globalThis.document = document;
const app = document.register(Object.assign(new FakeElement("main", document), { id: "app" }));

const cards = {
  t1: { id: "t1", name: "T1", tier: 1, note: "top" },
  t2: { id: "t2", name: "T2", tier: 2, note: "middle" },
  t3: { id: "t3", name: "T3", tier: 3, note: "base" },
  t4: { id: "t4", name: "T4", tier: 4, note: "top" },
  filler: { id: "filler", name: "Filler", tier: 1, note: "middle" },
  filler2: { id: "filler2", name: "Filler2", tier: 1, note: "base" },
};
const meta = { id: "meta" };
let animating = false;
let run = {
  gold: 50,
  deck: [
    { id: "t1", level: 0 },
    { id: "t2", level: 0 },
    { id: "t3", level: 0 },
    { id: "t4", level: 0 },
    { id: "filler", level: 0 },
    { id: "filler2", level: 0 },
  ],
};
const choices = [];
let unlockChecks = 0,
  saves = 0,
  renders = 0;
const engine = {
  chooseSpecial: (...args) => choices.push(args),
  checkUnlocks: (actualRun, actualMeta) => {
    assert.equal(actualRun, run);
    assert.equal(actualMeta, meta);
    unlockChecks += 1;
  },
  deckLimit: () => 8,
  cardMaxCopies: () => 2,
};
const ui = createSpecialDeckPickerUi({
  engine,
  cards,
  getRun: () => run,
  getMeta: () => meta,
  getCardAnimating: () => animating,
  presentationCardHtml: (card) => `CARD:${card.id}`,
  save: () => {
    saves += 1;
  },
  render: () => {
    renders += 1;
  },
});
ui.bindSpecialDeckPicker(app);

function pickerTrigger(mode) {
  return {
    target: {
      closest: (selector) =>
        selector === "[data-special-deck-picker]"
          ? { dataset: { specialDeckPicker: mode } }
          : null,
    },
  };
}

app.emit("click", pickerTrigger("note"));
const dialog = document.getElementById("special-deck-picker");
assert.ok(dialog?.open, "note mode should open the special deck picker");
assert.equal(document.getElementById("special-deck-picker-eyebrow").textContent, "OLFACTORY LAB");
assert.equal(document.getElementById("special-deck-picker-title").textContent, "노트 치환 · 내 덱 · 6장");
assert.match(document.getElementById("special-deck-picker-description").textContent, /TOP · MIDDLE · BASE/);
const grid = document.getElementById("special-deck-picker-grid");
assert.match(grid.innerHTML, /CARD:t1/);
assert.match(grid.innerHTML, /data-special-deck-action="note"/);
assert.match(grid.innerHTML, /data-note="top" class="current"/);

dialog.emit("click", {
  target: {
    closest: (selector) =>
      selector === "[data-special-deck-action]"
        ? { dataset: { index: "1", specialDeckAction: "note", note: "base" } }
        : null,
  },
});
assert.equal(choices.length, 1);
assert.deepEqual(choices[0], [run, "note", meta, 1, "base"]);
assert.equal(unlockChecks, 1);
assert.equal(saves, 1);
assert.equal(renders, 1);
assert.equal(dialog.open, false);

run.gold = 10;
ui.openSpecialDeckPicker("remove");
assert.match(grid.innerHTML, /data-special-deck-action="remove" data-index="0" disabled/);
assert.match(grid.innerHTML, />20G · 영구 제거<\/button>/);
dialog.close();

run.gold = 50;
run.deck = run.deck.slice(0, 5);
ui.openSpecialDeckPicker("cleanse_card");
assert.match(grid.innerHTML, /data-special-deck-action="cleanse_card" data-index="0" disabled/);
dialog.close();

run.deck = [
  { id: "t3", level: 0 },
  { id: "t1", level: 0 },
  { id: "t2", level: 0 },
  { id: "t4", level: 0 },
  { id: "filler", level: 0 },
  { id: "filler2", level: 0 },
  { id: "t1", level: 0 },
];
ui.openSpecialDeckPicker("duplicate");
assert.match(grid.innerHTML, /CARD:t3/);
assert.match(grid.innerHTML, /체력 -15 · 불순물 1장 · 복제/);
assert.match(grid.innerHTML, /data-special-deck-action="duplicate" data-index="0" disabled/);
assert.match(grid.innerHTML, /data-special-deck-action="duplicate" data-index="1" disabled/);
dialog.close();

const beforeAnimatedOpenCount = dialog.showModalCount;
animating = true;
app.emit("click", pickerTrigger("note"));
assert.equal(dialog.showModalCount, beforeAnimatedOpenCount, "animation lock should block picker opening");
animating = false;

app.emit("click", pickerTrigger("unknown"));
assert.equal(dialog.showModalCount, beforeAnimatedOpenCount, "unknown picker modes should not open the dialog");

delete globalThis.document;
console.log("PASS Harmony special deck picker UI owns special-room deck selection presentation, guards, and commit flow.");

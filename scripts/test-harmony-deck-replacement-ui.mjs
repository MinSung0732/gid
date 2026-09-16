import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDeckReplacementUi } from "../games/harmony/deck-replacement-ui.js";

const main = await readFile(
  new URL("../games/harmony/main.js", import.meta.url),
  "utf8",
);
const source = await readFile(
  new URL("../games/harmony/deck-replacement-ui.js", import.meta.url),
  "utf8",
);

assert.match(
  main,
  /from "\.\/deck-replacement-ui\.js"/,
  "main should consume the deck replacement UI module",
);
assert.match(
  main,
  /createDeckReplacementUi\(\{[\s\S]*?engine:\s*E[\s\S]*?cards:\s*CARDS[\s\S]*?getRun:[\s\S]*?getMeta:[\s\S]*?cardHtml[\s\S]*?cardCategory:\s*startingCardCategory[\s\S]*?cardCategories:\s*startingDeckCategories[\s\S]*?save[\s\S]*?render[\s\S]*?\}\)/s,
  "main should inject existing reward/deck rendering dependencies",
);
assert.match(
  main,
  /bindDeckReplacement\(\$\("app"\)\)/,
  "main should bind the extracted capture handler to the app root",
);
for (const name of [
  "renderDeckReplacement",
  "replacementDialog",
  "requestDeckReplacement",
]) {
  assert.doesNotMatch(
    main,
    new RegExp(`function ${name}\\(`),
    `${name} implementation should live outside main.js`,
  );
  assert.match(
    source,
    new RegExp(`function ${name}\\(`),
    `${name} should remain implemented by deck-replacement-ui.js`,
  );
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.id = "";
    this.dataset = {};
    this.listeners = new Map();
    this.innerHTML = "";
    this.textContent = "";
    this.clientWidth = 1000;
    this.scrollWidth = 2000;
    this.open = false;
    this.onclick = null;
    this.lastScroll = null;
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
  }

  close() {
    this.open = false;
  }

  scrollBy(options) {
    this.lastScroll = options;
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
  attack_a: { id: "attack_a", name: "공격 A", category: "attack" },
  defense_b: { id: "defense_b", name: "방어 B", category: "defense" },
  chosen: { id: "chosen", name: "새 공격", category: "attack" },
};
const meta = { id: "meta" };
let run = {
  deck: [{ id: "attack_a" }, { id: "defense_b" }, { id: "chosen" }],
};
const offer = {
  options: [
    { optionId: "reward-card", type: "card", id: "chosen", claimed: false },
  ],
};
const claims = [];
let saves = 0,
  renders = 0;
const engine = {
  currentRewardOffer: () => offer,
  deckLimit: () => 3,
  cardMaxCopies: () => 1,
  claimReward: (...args) => {
    claims.push(args);
    return true;
  },
};
const ui = createDeckReplacementUi({
  engine,
  cards,
  getRun: () => run,
  getMeta: () => meta,
  cardHtml: (card, _index, interaction) =>
    `CARD:${card.id}:${interaction.replaceIndex}`,
  cardCategory: (card) => card.category,
  cardCategories: [
    { id: "attack", name: "공격" },
    { id: "defense", name: "방어" },
  ],
  save: () => {
    saves += 1;
  },
  render: () => {
    renders += 1;
  },
});
ui.bindDeckReplacement(app);

const rewardButton = {
  dataset: { option: "reward-card", card: "chosen" },
};
let stopped = false;
app.emit("click", {
  target: {
    closest: (selector) =>
      selector === '[data-action="reward-claim"][data-card][data-option]'
        ? rewardButton
        : null,
  },
  stopImmediatePropagation: () => {
    stopped = true;
  },
});

assert.equal(stopped, true, "full-deck reward clicks should be intercepted before normal claim handling");
const dialog = document.getElementById("deck-replace");
assert.ok(dialog?.open, "full-deck card rewards should open the replacement dialog");
assert.equal(document.getElementById("deck-replace-limit").textContent, "DECK LIMIT · 3");
assert.match(document.getElementById("deck-replace-copy").textContent, /덱이 3장으로 가득/);
assert.match(document.getElementById("deck-replace-filters").innerHTML, /전체 <b>3<\/b>/);
assert.match(document.getElementById("deck-replace-filters").innerHTML, /공격 <b>2<\/b>/);
assert.match(document.getElementById("deck-replace-filters").innerHTML, /방어 <b>1<\/b>/);
const list = document.getElementById("deck-replace-list");
assert.match(list.innerHTML, /CARD:attack_a:0/);
assert.match(list.innerHTML, /CARD:defense_b:1/);
assert.match(list.innerHTML, /CARD:chosen:2/);
assert.match(list.innerHTML, /data-replace-index="0" disabled/);
assert.doesNotMatch(list.innerHTML, /data-replace-index="2" disabled/);

dialog.emit("click", {
  target: {
    closest: (selector) =>
      selector === "[data-replace-filter]"
        ? { dataset: { replaceFilter: "attack" } }
        : null,
  },
});
assert.match(list.innerHTML, /CARD:attack_a:0/);
assert.match(list.innerHTML, /CARD:chosen:2/);
assert.doesNotMatch(list.innerHTML, /CARD:defense_b:1/);

dialog.emit("click", {
  target: {
    closest: (selector) =>
      selector === "[data-replace-scroll]"
        ? { dataset: { replaceScroll: "1" } }
        : null,
  },
});
assert.deepEqual(list.lastScroll, { left: 720, behavior: "smooth" });

let wheelPrevented = false,
  wheelStopped = false;
list.emit("wheel", {
  deltaX: 0,
  deltaY: 120,
  preventDefault: () => {
    wheelPrevented = true;
  },
  stopPropagation: () => {
    wheelStopped = true;
  },
});
assert.deepEqual(list.lastScroll, { left: 180, behavior: "smooth" });
assert.equal(wheelPrevented, true);
assert.equal(wheelStopped, true);

dialog.emit("click", {
  target: {
    closest: (selector) =>
      selector === "[data-replace-index]"
        ? { dataset: { replaceIndex: "0" } }
        : null,
  },
});
assert.equal(claims.length, 1);
assert.equal(claims[0][0], run);
assert.equal(claims[0][1], "reward-card");
assert.equal(claims[0][2], meta);
assert.equal(claims[0][3], 0);
assert.equal(dialog.open, false);
assert.equal(saves, 1);
assert.equal(renders, 1);

run = { deck: [{ id: "attack_a" }, { id: "defense_b" }] };
stopped = false;
app.emit("click", {
  target: {
    closest: (selector) =>
      selector === '[data-action="reward-claim"][data-card][data-option]'
        ? rewardButton
        : null,
  },
  stopImmediatePropagation: () => {
    stopped = true;
  },
});
assert.equal(stopped, false, "non-full decks should keep the normal reward claim path");

delete globalThis.document;
console.log(
  "PASS Harmony deck replacement UI owns full-deck reward interception, filtering, scrolling, copy caps, and replacement commit flow.",
);

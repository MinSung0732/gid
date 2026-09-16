import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";
import { loadGame, saveGame } from "../games/harmony/persistence.js";
import { createRestUpgradeUi } from "../games/harmony/rest-upgrade-ui.js";

const run = E.newRun(4242);
run.phase = "rest";
const choices = E.restCardChoices(run);
assert.equal(choices.length, 5, "Rest site offers five cards when five are upgradeable");
assert.equal(new Set(choices).size, 5, "Each offered card is a distinct deck copy");
assert.deepEqual(E.restCardChoices(run), choices, "Rest choices remain stable across renders");
const chosen = choices[0], beforeLevel = run.deck[chosen].level;
assert.equal(E.rest(run, "upgrade", chosen), true);
assert.equal(run.deck[chosen].level, beforeLevel + 1);
assert.equal(run.phase, "rest", "An upgrade waits on its success screen");
assert.equal(run.restChoices, null);
assert.deepEqual(run.restResult, {
  type: "upgrade",
  index: chosen,
  cardId: run.deck[chosen].id,
  previousLevel: beforeLevel,
  level: beforeLevel + 1,
});
assert.deepEqual(E.restCardChoices(run), [], "No second upgrade is offered while confirmation is pending");
assert.equal(E.leaveRest(run), true);
assert.equal(run.phase, "map");
assert.equal(run.restResult, null);

const guarded = E.newRun(4243);
guarded.phase = "rest";
const offered = E.restCardChoices(guarded);
const notOffered = guarded.deck.findIndex((_, index) => !offered.includes(index));
if (notOffered >= 0) {
  E.rest(guarded, "upgrade", notOffered);
  assert.equal(guarded.phase, "rest", "Cards outside the offer cannot be upgraded");
}

const healing = E.newRun(4244);
healing.phase = "rest";
healing.hp = 20;
E.restCardChoices(healing);
E.rest(healing, "heal");
assert.equal(healing.hp, 44, "The existing 30% max-HP rest heal remains unchanged");
assert.equal(healing.phase, "map");

const fullHealth = E.newRun(4245);
fullHealth.phase = "rest";
assert.equal(E.rest(fullHealth, "heal"), false, "Rest healing is unavailable at full HP");
assert.equal(fullHealth.phase, "rest", "A blocked full-HP heal does not leave the room");

const pending = E.newRun(4246), pendingChoice = (() => {
  pending.phase = "rest";
  return E.restCardChoices(pending)[0];
})();
E.rest(pending, "upgrade", pendingChoice);
const stored = new Map(), storage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: (key) => stored.delete(key),
};
saveGame(storage, { meta: E.freshMeta(), run: pending });
const resumed = loadGame(storage).run;
assert.deepEqual(resumed.restResult, pending.restResult, "The upgrade confirmation survives save and resume");
assert.equal(resumed.phase, "rest");

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const restUiSource = await readFile(new URL("../games/harmony/rest-upgrade-ui.js", import.meta.url), "utf8");
const css = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");
assert.match(main, /from "\.\/rest-upgrade-ui\.js"/);
assert.match(main, /createRestUpgradeUi\(\{[\s\S]*?engine:\s*E[\s\S]*?cards:\s*CARDS[\s\S]*?getRun:[\s\S]*?cardHtml[\s\S]*?presentationCardHtml[\s\S]*?cardEffectText[\s\S]*?\}\)/s);
assert.match(main, /bindRestUpgradeComparison\(\$\("app"\)\)/);
assert.match(main, /case "rest":\s*return restRoom\(\);/);
assert.match(main, /createCardPresentation\(/);
const cardPresentationSource = await readFile(new URL("../games/harmony/card-presentation.js", import.meta.url), "utf8");
assert.match(cardPresentationSource, /compactCardEffectSummary\(card, comparisonCard\)/);
assert.match(cardPresentationSource, /card-summary-row-upgraded/);
for (const name of [
  "highlightUpgradeDetailValues",
  "restUpgradeComparisonMarkup",
  "restUpgradeSuccess",
  "restUpgradeChoice",
  "restUpgradePreviewTarget",
  "showRestUpgradeComparison",
]) {
  assert.doesNotMatch(main, new RegExp(`function ${name}\\(`), `${name} implementation should live outside main.js`);
}
assert.doesNotMatch(main, /E\.restCardChoices\(run\)/, "rest offer presentation should be owned by rest-upgrade-ui");
assert.match(restUiSource, /engine\.restCardChoices\(run\)/);
assert.match(restUiSource, /engine\.cardMaxUpgrade\(card\)/);
assert.match(restUiSource, /rest-upgrade-value-changed/);
assert.match(restUiSource, /data-action="rest-leave"/);
assert.match(css, /grid-template-columns:repeat\(5/);
assert.match(css, /\.rest-upgrade-comparison\.visible/);
assert.match(css, /@keyframes rest-upgrade-result-reveal/);
assert.match(css, /\.rest-upgrade-after \.card-compact-status \.card-effect-compact/);
assert.doesNotMatch(
  css,
  /\.card-effect-compact > span:has\(> \.card-summary-applied-status\)\s*\{\s*display:\s*none/,
  "Applied status summary rows stay visible outside the battle hand",
);

class FakeClassList {
  constructor() {
    this.values = new Set();
  }
  add(value) {
    this.values.add(value);
  }
  remove(value) {
    this.values.delete(value);
  }
  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.dataset = {};
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.innerHTML = "";
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  emit(type, event) {
    for (const handler of this.listeners.get(type) || []) handler(event);
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

const elements = new Map();
const document = {
  getElementById: (id) => elements.get(id) || null,
};
globalThis.document = document;

const fakeCards = {
  a: { id: "a", name: "Alpha", tier: 1, note: "top" },
  b: { id: "b", name: "Beta", tier: 1, note: "middle" },
};
let uiRun = {
  phase: "rest",
  hp: 20,
  maxHp: 80,
  restResult: null,
  deck: [
    { id: "a", level: 0 },
    { id: "b", level: 1 },
  ],
};
const uiEngine = {
  restCardChoices: () => [0, 1],
  cardMaxUpgrade: () => 2,
};
const ui = createRestUpgradeUi({
  engine: uiEngine,
  cards: fakeCards,
  getRun: () => uiRun,
  cardHtml: (card, _index, interaction) =>
    `<button class="${interaction.className}" data-index="${interaction.index}">${card.id}:${interaction.ariaLabel}</button>`,
  presentationCardHtml: (card, comparison = null) =>
    `CARD:${card.id}:+${card.level}${comparison ? `:FROM${comparison.level}` : ""}`,
  cardEffectText: (card) => `피해 ${card.level ? 7 : 5} · 방어 2`,
});

let markup = ui.restRoom();
assert.match(markup, /REST SITE/);
assert.match(markup, /체력 24 회복/);
assert.match(markup, /rest-card-choices/);
assert.match(markup, /data-action="upgrade" data-index="0"/);
assert.match(markup, /강화 \+0 → \+1/);
assert.match(markup, /id="rest-upgrade-comparison"/);

uiRun.hp = 80;
markup = ui.restRoom();
assert.match(markup, /rest-heal-button" data-action="rest-heal" disabled/);
assert.match(markup, /체력이 이미 가득 찼습니다/);

uiRun.hp = 20;
uiRun.restResult = {
  type: "upgrade",
  index: 0,
  cardId: "a",
  previousLevel: 0,
  level: 1,
};
uiRun.deck[0].level = 1;
markup = ui.restRoom();
assert.match(markup, /UPGRADE COMPLETE/);
assert.match(markup, /Alpha/);
assert.match(markup, /\+0에서 \+1 단계/);
assert.match(markup, /data-action="rest-leave"/);

uiRun.restResult = null;
uiRun.deck[0].level = 0;
const app = new FakeElement("app"),
  panel = new FakeElement("rest-upgrade-comparison");
elements.set(panel.id, panel);
ui.bindRestUpgradeComparison(app);
const preview = {
  dataset: { index: "0" },
  closest: (selector) =>
    selector === ".rest-upgrade-card, .rest-upgrade-button" ? preview : null,
  contains: () => false,
};
app.emit("pointerover", { target: preview, relatedTarget: null });
assert.equal(panel.classList.contains("visible"), true);
assert.equal(panel.getAttribute("aria-hidden"), "false");
assert.match(panel.innerHTML, /강화 미리보기/);
assert.match(panel.innerHTML, /CARD:a:\+0/);
assert.match(panel.innerHTML, /CARD:a:\+1:FROM0/);
assert.match(panel.innerHTML, /<mark class="rest-upgrade-value-changed">7<\/mark>/);
assert.doesNotMatch(panel.innerHTML, /<mark class="rest-upgrade-value-changed">2<\/mark>/);

app.emit("pointerout", { target: preview, relatedTarget: null });
assert.equal(panel.classList.contains("visible"), false);
assert.equal(panel.getAttribute("aria-hidden"), "true");

uiRun.deck[0].level = 2;
app.emit("focusin", { target: preview });
assert.equal(panel.classList.contains("visible"), false, "maxed cards should not reopen the comparison");

delete globalThis.document;
console.log("PASS Harmony rest site: engine guards plus extracted rest upgrade presentation, comparison highlighting, confirmation step, and full-HP heal lock.");

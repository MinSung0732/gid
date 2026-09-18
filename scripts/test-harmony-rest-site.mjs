import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";
import { loadGame, saveGame } from "../games/harmony/persistence.js";
import { createRestUpgradeUi } from "../games/harmony/rest-upgrade-ui.js";

const run = E.newRun(4242);
run.phase = "rest";
run.restMode = "choice";
const choices = E.restCardChoices(run);
assert.equal(choices.length, 5, "Rest site offers five cards when five are upgradeable");
assert.equal(new Set(choices).size, 5, "Each offered card is a distinct deck copy");
assert.deepEqual(E.restCardChoices(run), choices, "Rest choices remain stable across renders");
const chosen = choices[0], beforeLevel = run.deck[chosen].level, beforeNode = run.node;
assert.equal(E.rest(run, "upgrade", chosen), false, "An upgrade cannot skip the rest action-choice step");
assert.equal(run.deck[chosen].level, beforeLevel);
assert.equal(E.rest(run, "openUpgrade"), true);
assert.equal(run.restMode, "upgrade");
assert.equal(E.rest(run, "cancelUpgrade"), true);
assert.equal(run.restMode, "choice", "Back returns to the action-choice screen before commitment");
assert.equal(E.rest(run, "openUpgrade"), true);
assert.equal(E.rest(run, "upgrade", chosen), true);
assert.equal(run.deck[chosen].level, beforeLevel + 1);
assert.equal(run.phase, "rest", "An upgrade waits on its success screen");
assert.equal(run.restMode, "resolved");
assert.equal(run.restChoices, null);
assert.deepEqual(run.restResult, {
  type: "upgrade",
  index: chosen,
  cardId: run.deck[chosen].id,
  previousLevel: beforeLevel,
  level: beforeLevel + 1,
});
assert.deepEqual(E.restCardChoices(run), [], "No second upgrade is offered while confirmation is pending");
assert.equal(E.rest(run, "heal"), false, "Resolved upgrade cannot be followed by a heal");
assert.equal(E.leaveRest(run), true);
assert.equal(run.phase, "map");
assert.equal(run.node, beforeNode + 1);
assert.equal(run.restResult, null);
assert.equal(run.restMode, null);

const guarded = E.newRun(4243);
guarded.phase = "rest";
guarded.restMode = "choice";
const offered = E.restCardChoices(guarded);
const notOffered = guarded.deck.findIndex((_, index) => !offered.includes(index));
assert.equal(E.rest(guarded, "openUpgrade"), true);
if (notOffered >= 0) {
  E.rest(guarded, "upgrade", notOffered);
  assert.equal(guarded.phase, "rest", "Cards outside the offer cannot be upgraded");
  assert.equal(guarded.restResult, null);
}

const healing = E.newRun(4244);
healing.phase = "rest";
healing.restMode = "choice";
healing.hp = 20;
const healNode = healing.node, healAmount = E.restHealAmount(healing);
assert.equal(healAmount, 24, "The canonical rest heal remains 30% of max HP, rounded up");
E.restCardChoices(healing);
assert.equal(E.rest(healing, "heal"), true);
assert.equal(healing.hp, 44, "The existing 30% max-HP rest heal remains unchanged");
assert.equal(healing.phase, "map");
assert.equal(healing.node, healNode + 1);
assert.equal(healing.restMode, null);
assert.equal(healing.restResult, null);
assert.equal(E.rest(healing, "heal"), false, "A consumed rest action cannot be applied twice");

const fullHealth = E.newRun(4245);
fullHealth.phase = "rest";
fullHealth.restMode = "choice";
assert.equal(E.rest(fullHealth, "heal"), false, "Existing full-HP rest policy stays disabled");
assert.equal(fullHealth.phase, "rest", "A blocked full-HP heal does not leave the room");
assert.equal(fullHealth.restMode, "choice");

const noUpgrade = E.newRun(4246);
noUpgrade.phase = "rest";
noUpgrade.restMode = "choice";
for (const card of noUpgrade.deck) card.level = E.cardMaxUpgrade(card);
noUpgrade.restChoices = null;
assert.deepEqual(E.restCardChoices(noUpgrade), []);
assert.equal(E.rest(noUpgrade, "openUpgrade"), false, "Upgrade mode cannot open without an eligible card");
assert.equal(noUpgrade.restMode, "choice");

const selecting = E.newRun(4247);
selecting.phase = "rest";
selecting.restMode = "choice";
E.restCardChoices(selecting);
assert.equal(E.rest(selecting, "openUpgrade"), true);
const stored = new Map(), storage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: (key) => stored.delete(key),
};
saveGame(storage, { meta: E.freshMeta(), run: selecting });
const selectingResumed = loadGame(storage).run;
assert.equal(selectingResumed.phase, "rest");
assert.equal(selectingResumed.restMode, "upgrade", "Upgrade-selection mode survives save and resume");
assert.equal(selectingResumed.restResult, null);
assert.equal(E.rest(selectingResumed, "cancelUpgrade"), true);
assert.equal(selectingResumed.restMode, "choice");

const pending = E.newRun(4248);
pending.phase = "rest";
pending.restMode = "choice";
const pendingChoice = E.restCardChoices(pending)[0];
E.rest(pending, "openUpgrade");
E.rest(pending, "upgrade", pendingChoice);
saveGame(storage, { meta: E.freshMeta(), run: pending });
const resumed = loadGame(storage).run;
assert.deepEqual(resumed.restResult, pending.restResult, "The upgrade confirmation survives save and resume");
assert.equal(resumed.phase, "rest");
assert.equal(resumed.restMode, "resolved");
assert.equal(E.rest(resumed, "heal"), false, "Reload cannot re-open a second rest action after upgrade commitment");

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const restUiSource = await readFile(new URL("../games/harmony/rest-upgrade-ui.js", import.meta.url), "utf8");
const css = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");
assert.match(main, /from "\.\/rest-upgrade-ui\.js(?:\?v=[^"]+)?"/);
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
assert.match(restUiSource, /engine\.restHealAmount\(run\)/);
assert.doesNotMatch(restUiSource, /Math\.ceil\(run\.maxHp \* 0\.3\)/, "rest UI uses the canonical engine heal amount");
assert.match(restUiSource, /engine\.cardMaxUpgrade\(card\)/);
assert.match(restUiSource, /rest-upgrade-value-changed/);
assert.match(restUiSource, /data-action="rest-leave"/);
assert.match(css, /\.rest-action-options\s*\{[^}]*grid-template-columns:repeat\(2/s);
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
let uiChoices = [0, 1];
let uiRun = {
  phase: "rest",
  hp: 20,
  maxHp: 80,
  restMode: "choice",
  restResult: null,
  deck: [
    { id: "a", level: 0 },
    { id: "b", level: 1 },
  ],
};
const uiEngine = {
  restCardChoices: () => uiChoices,
  restHealAmount: () => 24,
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
assert.match(markup, /잠시 쉬어갑니다/);
assert.match(markup, /data-action="rest-heal"/);
assert.match(markup, /휴식하기/);
assert.match(markup, /체력 24 회복/);
assert.match(markup, /data-action="rest-upgrade-open"/);
assert.match(markup, /강화하기/);
assert.doesNotMatch(markup, /rest-card-choices/);
assert.doesNotMatch(markup, /data-action="upgrade"/);
assert.doesNotMatch(markup, /rest-upgrade-comparison/);

uiRun.hp = 80;
markup = ui.restRoom();
assert.match(markup, /rest-heal-button" data-action="rest-heal" disabled/);
assert.match(markup, /체력이 이미 가득 찼습니다/);

uiRun.hp = 20;
uiChoices = [];
markup = ui.restRoom();
assert.match(markup, /rest-upgrade-open-button" data-action="rest-upgrade-open" disabled/);
assert.match(markup, /강화할 수 있는 카드가 없습니다/);

uiChoices = [0, 1];
uiRun.restMode = "upgrade";
markup = ui.restRoom();
assert.match(markup, /REST SITE · UPGRADE/);
assert.match(markup, /data-action="rest-upgrade-back"/);
assert.match(markup, /rest-card-choices/);
assert.match(markup, /data-action="upgrade" data-index="0"/);
assert.match(markup, /강화 \+0 → \+1/);
assert.match(markup, /id="rest-upgrade-comparison"/);
assert.doesNotMatch(markup, /data-action="rest-heal"/);
assert.doesNotMatch(markup, /휴식하기/);

uiRun.restMode = "resolved";
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
uiRun.restMode = "upgrade";
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
console.log("PASS Harmony rest site: explicit choice/upgrade/resolved flow, canonical heal amount, save/resume safety, back navigation, upgrade presentation, and full-HP policy.");

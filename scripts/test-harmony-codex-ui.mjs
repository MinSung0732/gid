import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCardPresentation } from "../games/harmony/card-presentation.js";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const codex = await readFile(new URL("../games/harmony/codex-ui.js", import.meta.url), "utf8");
const codexLayout = await readFile(new URL("../games/harmony/codex-pc-master-detail.css", import.meta.url), "utf8");

assert.match(main, /from "\.\/codex-ui\.js(?:\?v=[^"]+)?"/, "main should consume the codex UI module");
assert.match(
  main,
  /createCodexUi\(\{[\s\S]*?meta[\s\S]*?cardEffectText:\s*baseCardEffectText[\s\S]*?glossaryTermsHtml[\s\S]*?itemHtml[\s\S]*?statusAmountText[\s\S]*?statusGlossaryHtml[\s\S]*?\}\)/,
  "codex cards should render through the base-only card effect presentation",
);
assert.match(
  main,
  /cardEffectText:\s*baseCardEffectText[\s\S]*?cardHtml:\s*startingDeckCardHtml[\s\S]*?getRun:\s*\(\) => null[\s\S]*?getStarted:\s*\(\) => false/,
  "deck builder and codex should share a presentation that cannot see the active run",
);
assert.match(main, /\$\("tools"\)\.addEventListener\("click", handleCodexClick\)/);
assert.doesNotMatch(main, /function codexTabs\(/);
assert.doesNotMatch(main, /function codexCardEntry\(/);
assert.doesNotMatch(main, /function codexItemEntry\(/);
assert.doesNotMatch(main, /function codexIntent\(/);
assert.doesNotMatch(main, /function codexMonsterEntry\(/);
assert.doesNotMatch(main, /function codexProgress\(/);
assert.doesNotMatch(main, /function renderCodex\(/);

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
const codexPresentation = createCardPresentation({
  engine: presentationEngine,
  cards: presentationCards,
  statusDefinitions: {},
  getRun: () => null,
  getStarted: () => false,
  tierStars: () => "",
});
const liveCardEffect = livePresentation.cardEffectText({ id: "strike", level: 0 }, true);
const codexCardEffect = codexPresentation.cardEffectText({ id: "strike", level: 0 }, true);
const plainCardEffect = (value) => value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
assert.match(plainCardEffect(liveCardEffect), /접촉 피해를 15\(\+2\) 입힙니다\./, "combat card text may include runtime attack power and status modifiers");
assert.match(liveCardEffect, /card-value-modifier positive[^>]*>\(\+2\)<\/span>/, "combat card text may include runtime status modifier markup");
assert.match(plainCardEffect(codexCardEffect), /접촉 피해를 10 입힙니다\./, "codex card text should remain the original card specification");
assert.doesNotMatch(codexCardEffect, /card-value-modifier|>15</, "codex card text must not include active-run modifiers");


for (const marker of [
  "CODEX_AUGMENTS",
  "CODEX_MONSTERS",
  "CODEX_MONSTER_TYPES",
  "codex-progress",
  "codex-major",
  "codex-middle",
  "codex-minor",
  "codex-view",
  "data-codex-level",
]) {
  assert.match(codex, new RegExp(marker), `codex module should preserve ${marker}`);
}
assert.match(codex, /export function createCodexUi\(/);
assert.match(codex, /function handleCodexClick\(event\)/);
assert.match(codex, /function renderCodex\(/);
assert.match(codex, /Object\.hasOwn\(EARLY_MONSTERS, monster\.id\)/);
assert.match(codex, /meta\.discoveredCards/);
assert.match(codex, /meta\.defeatedMonsters/);
assert.match(codex, /from "\.\/late-game-content\.js"/, "codex should consume late-game monster definitions");
for (const act of ["act4", "act5", "act6", "act7"]) {
  assert.match(codex, new RegExp(`\\b${act}: \\{ label:`), `codex should expose ${act}`);
}
assert.match(codex, /ACT7_CODEX_MONSTERS/);
assert.match(codex, /patternName = intent\.name/);
assert.match(codexLayout, /#tools\[open\]/, "codex dialog layout must only override display while open");
assert.match(codexLayout, /#codex-view[\s\S]*?overflow-y:\s*auto/, "codex detail pane should own vertical scrolling");
assert.match(codexLayout, /\.codex-master-detail[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\)/, "codex detail grid row must be constrained so the view can scroll");
assert.match(codexLayout, /\.codex-detail-nav[\s\S]*?overflow-y:\s*auto/, "codex detail navigation should own vertical scrolling");
assert.doesNotMatch(codexLayout, /#tools\s*\{[\s\S]{0,180}?display:\s*grid/, "closed dialog must not be forced visible by author CSS");
assert.match(
  codex,
  /return \{[\s\S]*?handleCodexClick[\s\S]*?renderCodex[\s\S]*?\};/,
  "codex factory should expose only orchestration-facing UI functions",
);

console.log("PASS Harmony codex UI is modular without changing discovery, tabs, or progress contracts.");

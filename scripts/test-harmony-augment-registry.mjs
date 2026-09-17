import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CARDS,
  ITEMS,
  OFFICIAL_CARDS,
  TEST_ITEMS,
} from "../games/harmony/data.js?v=20260913-1";
import {
  STAGED_AUGMENT_CARDS,
  STAGED_AUGMENT_ITEMS,
} from "../games/harmony/staged-augments.js";
import { createCodexUi } from "../games/harmony/codex-ui.js";
import { createRewardUi } from "../games/harmony/reward-ui.js";

const stagedCardIds = Object.keys(STAGED_AUGMENT_CARDS);
const stagedItemIds = Object.keys(STAGED_AUGMENT_ITEMS);
assert.equal(stagedCardIds.length, 16, "staged card registry should contain 16 cards");
assert.equal(stagedItemIds.length, 6, "staged item registry should contain 6 items");
assert.equal(stagedCardIds.length + stagedItemIds.length, 22, "new augment set should contain 22 entries");

for (const id of stagedCardIds) {
  assert.ok(OFFICIAL_CARDS[id], `${id} should be an official card`);
  assert.ok(CARDS[id], `${id} should be in canonical CARDS`);
  assert.equal(CARDS[id].id, id, `${id} should carry its registry id`);
  assert.equal(CARDS[id].name, STAGED_AUGMENT_CARDS[id].name, `${id} name should match staged data`);
}
for (const id of stagedItemIds) {
  assert.ok(ITEMS[id], `${id} should be in canonical ITEMS`);
  assert.ok(TEST_ITEMS[id], `${id} should be in TEST_ITEMS`);
  assert.equal(ITEMS[id].id, id, `${id} should carry its registry id`);
  assert.equal(ITEMS[id].name, STAGED_AUGMENT_ITEMS[id].name, `${id} name should match staged data`);
}

const sourceData = await readFile(new URL("../games/harmony/data.js", import.meta.url), "utf8");
const sourceEngine = await readFile(new URL("../games/harmony/engine.js", import.meta.url), "utf8");
const sourceCodex = await readFile(new URL("../games/harmony/codex-ui.js", import.meta.url), "utf8");
const sourceReward = await readFile(new URL("../games/harmony/reward-ui.js", import.meta.url), "utf8");
assert.match(sourceData, /STAGED_AUGMENT_CARDS, STAGED_AUGMENT_ITEMS/);
assert.match(sourceData, /\.\.\.STAGED_AUGMENT_CARDS/);
assert.match(sourceData, /\.\.\.STAGED_AUGMENT_ITEMS/);
assert.doesNotMatch(sourceEngine, /installStagedAugments|STAGED_AUGMENT_CARDS/,
  "engine should no longer own registry installation as a side effect");
assert.match(sourceCodex, /Object\.values\(CARDS\)/);
assert.match(sourceCodex, /Object\.values\(ITEMS\)/);
assert.match(sourceReward, /import \{ CARDS, ITEMS \} from "\.\/data\.js/);

function fakeElement() {
  return {
    innerHTML: "",
    value: "",
    hidden: false,
    querySelectorAll() { return []; },
    querySelector() { return null; },
    insertAdjacentHTML(_where, html) { this.innerHTML += html; },
  };
}
const ids = ["codex-progress", "codex-major", "codex-middle", "codex-minor", "codex-view", "codex-search"];
const elements = new Map(ids.map((id) => [id, fakeElement()]));
const meta = {
  discoveredCards: [...stagedCardIds],
  discovered: [...stagedItemIds],
  defeatedMonsters: [],
};
const codexUi = createCodexUi({
  meta,
  cardEffectText: (card) => CARDS[card.id]?.text || "",
  glossaryTermsHtml: () => "",
  itemHtml: (id) => `<article>ITEM:${id}:${ITEMS[id]?.name || ""}</article>`,
  statusAmountText: () => "",
  statusGlossaryHtml: () => "",
  getElementById: (id) => elements.get(id),
});
const clickCodex = (level, value) => codexUi.handleCodexClick({
  target: { closest: () => ({ dataset: { codexLevel: level, codexValue: value } }) },
});

for (const tier of [1, 2, 3, 4]) {
  clickCodex("major", "card");
  clickCodex("middle", String(tier));
  const html = elements.get("codex-view").innerHTML;
  for (const id of stagedCardIds.filter((cardId) => CARDS[cardId].tier === tier))
    assert.match(html, new RegExp(STAGED_AUGMENT_CARDS[id].name), `${id} should render in Codex tier ${tier}`);
}
for (const id of stagedItemIds) {
  const item = ITEMS[id];
  clickCodex("major", "item");
  clickCodex("middle", item.kind === "trait" ? "traits" : item.kind === "relic" ? "relics" : "stats");
  clickCodex("minor", String(item.tier));
  assert.match(elements.get("codex-view").innerHTML, new RegExp(`ITEM:${id}:`), `${id} should render in Codex`);
}

const rewardOptions = [
  ...stagedCardIds.map((id, index) => ({ optionId: `card-${index}`, type: "card", id })),
  ...stagedItemIds.map((id, index) => ({ optionId: `item-${index}`, type: "item", id })),
];
const rewardUi = createRewardUi({
  getRun: () => ({ reward: { gold: 0, activeGroupIndex: 0, groups: [{}], metadata: {} } }),
  currentRewardOffer: () => ({
    source: "combat",
    rewardPool: "active",
    remainingPicks: rewardOptions.length,
    allowSkip: true,
    claimedOptionIds: [],
    options: rewardOptions,
  }),
  power: () => 0,
  cardHtml: (card) => `CARD:${card.id}`,
  itemHtml: (id) => `ITEM:${id}`,
  formatNumber: String,
});
const rewardHtml = rewardUi.rewardRoom();
for (const id of stagedCardIds) assert.match(rewardHtml, new RegExp(`CARD:${id}`), `${id} should render in Reward UI`);
for (const id of stagedItemIds) assert.match(rewardHtml, new RegExp(`ITEM:${id}`), `${id} should render in Reward UI`);

console.log("PASS Harmony augment registry: all 22 staged augments are canonical data and render through Codex/Reward UI.");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CARDS, ITEMS } from "../games/harmony/data.js?v=20260913-1";
import { createRewardUi } from "../games/harmony/reward-ui.js";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const rewardSource = await readFile(new URL("../games/harmony/reward-ui.js", import.meta.url), "utf8");

assert.match(main, /from "\.\/reward-ui\.js(?:\?v=[^"]+)?"/, "main should consume the reward UI module");
assert.match(
  main,
  /createRewardUi\(\{[\s\S]*?getRun:[\s\S]*?currentRewardOffer:\s*E\.currentRewardOffer[\s\S]*?power:\s*E\.power[\s\S]*?cardHtml[\s\S]*?itemHtml[\s\S]*?formatNumber:\s*number[\s\S]*?\}\)/s,
  "main should inject existing reward state/render helpers",
);
for (const name of ["rewardSourceLabel", "rewardOptionMarkup", "rewardRoom"]) {
  assert.doesNotMatch(main, new RegExp(`function ${name}\\(`), `${name} implementation should live outside main.js`);
  assert.match(rewardSource, new RegExp(`function ${name}\\(`), `${name} should remain implemented by reward-ui.js`);
}
assert.match(main, /case "reward":\s*return rewardRoom\(\);/s, "reward phase should keep using the extracted renderer");

const cardId = Object.keys(CARDS).find((id) => id !== "impurity");
const itemId = Object.keys(ITEMS)[0];
let run = null;
const offer = {
  source: "combat",
  rewardPool: "active",
  remainingPicks: 2,
  allowSkip: true,
  claimedOptionIds: ["claimed"],
  metadata: { groupIndex: 2 },
  options: [
    { optionId: "card-1", type: "card", id: cardId },
    { optionId: "item-1", type: "item", id: itemId },
    { optionId: "gold-1", type: "gold", amount: 17 },
    { optionId: "claimed", type: "gold", amount: 99, claimed: true },
  ],
};
const { rewardRoom } = createRewardUi({
  getRun: () => run,
  currentRewardOffer: () => offer,
  power: (_run, id) => id === "goldBonus" ? 3 : 0,
  cardHtml: (card, _index, interaction) => `CARD:${card.id}:${interaction.optionId}`,
  itemHtml: (id) => `ITEM:${id}`,
  formatNumber: (value) => String(value),
});

assert.match(rewardRoom(), /보상 정리 중/, "missing reward state should keep the transition placeholder");
run = {
  reward: {
    gold: 13,
    goldIncludesBonus: false,
    activeGroupIndex: 0,
    groups: [{}, {}],
    metadata: { battleCardReward: { totalGroups: 3, generatedGroups: 2 } },
  },
};
const html = rewardRoom();
assert.match(html, /전투 보상/i);
assert.match(html, /보상 그룹 2 \/ 3/);
assert.match(html, /기본 골드 보상 <b>13G<\/b> · 보너스 \+3G/);
assert.match(html, new RegExp(`CARD:${cardId}:card-1`));
assert.match(html, new RegExp(`ITEM:${itemId}`));
assert.match(html, /<strong>17G<\/strong>/);
assert.doesNotMatch(html, /99G/, "claimed options should remain hidden");
assert.match(html, /card-reward-choices/);
assert.match(html, /남은 보상 포기하고 진행/);
assert.match(html, /최대 <b>2개<\/b>/);

console.log("PASS Harmony reward UI is modular without changing reward option, progress, gold, or skip contracts.");

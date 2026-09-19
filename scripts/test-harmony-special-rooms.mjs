import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CATEGORY_ROOM_WEIGHTS, ITEMS } from "../games/harmony/data.js";
import * as E from "../games/harmony/engine.js";
import { stacks } from "../games/harmony/statuses.js";


const mainSource = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8"),
  stylesSource = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");

assert.match(
  mainSource,
  /data-action="special-curse" data-index="\$\{index\}" aria-label="\$\{ITEMS\[id\]\.name\} 선택">선택<\/button>/,
  "curse choice buttons keep the curse name in aria-label while visible text stays short",
);
assert.doesNotMatch(
  mainSource,
  /data-action="special-curse"[^>]*>\$\{ITEMS\[id\]\.name\} 선택<\/button>/,
  "curse name must not be repeated in the visible button text",
);
assert.match(stylesSource, /\.special-curse-choices > \.reward-item > button \{[\s\S]*?height:\s*44px;[\s\S]*?min-height:\s*44px;[\s\S]*?max-height:\s*44px;[\s\S]*?white-space:\s*nowrap;/);

const eventRooms = [
  "mystery", "greenhouse", "curse_pit", "lab", "mercury_still",
  "blood_altar", "dice_altar", "purify_furnace", "mirror_doppel", "smuggler",
];
assert.deepEqual(
  CATEGORY_ROOM_WEIGHTS.treasure.filter(({ room }) => eventRooms.includes(room)).map(({ room }) => room).sort(),
  [...eventRooms].sort(),
  "All ten interactive events are registered in the treasure pool",
);
assert.equal(CATEGORY_ROOM_WEIGHTS.treasure.reduce((sum, entry) => sum + entry.weight, 0), 100);

const enterEvent = (room, seed = 1) => {
  const run = E.newRun(seed), meta = E.freshMeta();
  run.route[0] = room;
  E.enter(run, meta);
  assert.equal(run.phase, room);
  return { run, meta };
};

{
  const { run, meta } = enterEvent("mercury_still");
  const hpBefore = run.hp;
  assert.equal(E.chooseSpecial(run, "overload", meta), true);
  assert.equal(run.specialDecision?.type, "curse-choice");
  assert.equal(run.specialDecision.candidates.length, 3);
  assert.ok(run.specialDecision.candidates.every((id) => ITEMS[id]?.tier === 2 && ITEMS[id]?.kind === "curse"));
  const curse = run.specialDecision.candidates[0];
  assert.equal(E.chooseSpecialCurse(run, 0, meta), true);
  assert.equal(E.power(run, "turnBaseAp"), 1);
  assert.equal(run.eventTurnHpLoss, 0, "Mercury contract no longer uses the old per-turn HP-loss bargain");
  assert.equal(run.hp, hpBefore);
  assert.ok(run.inventory.includes(curse));
  assert.equal(E.leaveSpecial(run), true);
  run.route[1] = "battle";
  E.enter(run, meta);
  assert.equal(run.battle.ap, 4);
}

{
  const { run, meta } = enterEvent("blood_altar");
  run.deck[2].testMarker = true;
  const before = run.deck.length;
  assert.equal(E.chooseSpecial(run, "cleanse_card", meta, 2), true);
  assert.equal(run.deck.length, before - 1);
  assert.ok(run.deck.every((card) => !card.testMarker), "The selected card, not the first card, is removed");
}

{
  const { run, meta } = enterEvent("blood_altar", 19);
  run.hp = 60;
  assert.equal(E.chooseSpecial(run, "sacrifice", meta), true);
  assert.equal(run.hp, 42, "Blood sacrifice commits 30% of current HP before reward claim");
  assert.equal(run.specialDecision?.candidates.length, 2);
  const curse = run.specialDecision.candidates[0];
  assert.equal(E.chooseSpecialCurse(run, 0, meta), true);
  assert.ok(run.inventory.includes(curse));
  assert.equal(run.phase, "reward");
  const offered = E.currentRewardOffer(run).options.find((option) => option.type === "item")?.id;
  assert.equal(E.skipReward(run), true);
  assert.equal(run.hp, 42, "Skipping the reward never refunds paid HP");
  assert.ok(run.inventory.includes(curse), "Skipping the reward never refunds the selected curse");
  if (offered) assert.ok(!run.inventory.includes(offered));
}

{
  const { run, meta } = enterEvent("dice_altar");
  run.hp = 40;
  run.gold = 0;
  assert.equal(E.chooseSpecial(run, "charm", meta), true);
  assert.equal(run.hp, 55);
  assert.equal(run.gold, 25);
}

{
  const { run, meta } = enterEvent("purify_furnace");
  assert.equal(E.chooseSpecial(run, "flame_power", meta), true);
  assert.equal(E.power(run, "attack"), 3);
  assert.equal(E.leaveSpecial(run), true);
  run.route[1] = "battle";
  E.enter(run, meta);
  assert.equal(stacks(run, "burning"), 2);
}

{
  const { run, meta } = enterEvent("mirror_doppel");
  run.deck = [run.deck.find((card) => (ITEMS[card.id]?.tier ?? 0) === 0) || run.deck[0]];
  const index = 0, tier = E.cardDefinition(run.deck[index]).tier,
    hpCost = tier === 1 ? 5 : tier === 2 ? 10 : tier === 3 ? 15 : 10,
    extraCards = tier === 3 ? 2 : 1,
    before = run.deck.length,
    hpBefore = run.hp;
  assert.equal(E.chooseSpecial(run, "duplicate", meta, index), true);
  assert.equal(run.deck.length, before + extraCards);
  assert.equal(run.hp, hpBefore - hpCost);
  if (tier === 3) assert.equal(run.deck.at(-1).id, "impurity");
  if (tier === 4) assert.ok(run.inventory.some((id) => ITEMS[id]?.kind === "curse" && ITEMS[id]?.tier === 0));
}

{
  const { run, meta } = enterEvent("smuggler", 33);
  run.gold = 100;
  assert.equal(E.chooseSpecial(run, "contraband", meta), true);
  assert.equal(run.gold, 50, "Smuggler contraband commits 50G before curse/reward selection");
  assert.ok(run.specialDecision?.candidates.length >= 1);
  const curse = run.specialDecision.candidates[0];
  E.chooseSpecialCurse(run, 0, meta);
  assert.ok(run.inventory.includes(curse));
  assert.equal(run.phase, "reward");
  E.skipReward(run);
  assert.equal(run.gold, 50);
  assert.ok(run.inventory.includes(curse));
}

for (const room of eventRooms.filter((id) => !["mercury_still", "blood_altar", "dice_altar", "purify_furnace", "mirror_doppel", "smuggler"].includes(id))) {
  const { run, meta } = enterEvent(room, 100 + eventRooms.indexOf(room));
  const safeChoice = room === "greenhouse" ? "heal" : room === "curse_pit" ? "flee" : room === "lab" ? "note" : "skip";
  const args = room === "lab" ? [run, safeChoice, meta, 0, "middle"] : [run, safeChoice, meta];
  assert.equal(E.chooseSpecial(...args), true);
  if (run.phase === "reward") E.skipReward(run);
  else {
    assert.equal(E.leaveSpecial(run), true);
  }
  assert.equal(run.phase, "map");
}

console.log("PASS Harmony special rooms: ten-event pool, committed costs, curse choices, optional rewards, selected removal, and persistent combat effects.");

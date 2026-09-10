import assert from "node:assert/strict";
import { CATEGORY_ROOM_WEIGHTS } from "../games/harmony/data.js";
import * as E from "../games/harmony/engine.js";
import { stacks } from "../games/harmony/statuses.js";

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
  assert.equal(E.chooseSpecial(run, "overload", meta), true);
  assert.equal(E.power(run, "turnBaseAp"), 1);
  assert.equal(run.eventTurnHpLoss, 2);
  assert.equal(E.leaveSpecial(run), true);
  run.route[1] = "battle";
  E.enter(run, meta);
  assert.equal(run.hp, 78);
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
  run.deck = [run.deck[0]];
  const index = run.deck.findIndex((card) =>
    run.deck.filter((held) => held.id === card.id).length < E.cardMaxCopies(card.id),
  );
  const before = run.deck.length;
  assert.ok(index >= 0);
  assert.equal(E.chooseSpecial(run, "duplicate", meta, index), true);
  assert.equal(run.deck.length, before + 1);
  assert.equal(run.hp, 70);
}

for (const room of eventRooms.filter((id) => !["mercury_still", "blood_altar", "dice_altar", "purify_furnace", "mirror_doppel"].includes(id))) {
  const { run, meta } = enterEvent(room, 100 + eventRooms.indexOf(room));
  const safeChoice = room === "greenhouse" ? "heal" : room === "curse_pit" ? "flee" : room === "lab" ? "note" : "skip";
  const args = room === "lab" ? [run, safeChoice, meta, 0, "middle"] : [run, safeChoice, meta];
  assert.equal(E.chooseSpecial(...args), true);
  assert.equal(E.leaveSpecial(run), true);
  assert.equal(run.phase, "map");
}

console.log("PASS Harmony special rooms: ten-event pool, persistent bargains, selected removal, safe exits and combat effects.");

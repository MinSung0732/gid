import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";

for (let seed = 1; seed <= 40; seed++) {
  const run = E.newRun(seed);
  const meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.hp = 40;
  run.battle.enemies.forEach((enemy) => {
    enemy.hp = 0;
    enemy.statuses = {};
  });
  run.battle.enemies[0].hp = 1;
  run.battle.selectedTarget = 0;
  run.battle.ap = 10;
  run.battle.hand = [{ id: "strike", level: 0 }];
  const goldBefore = run.gold;

  assert.equal(E.play(run, 0, meta), true);
  assert.equal(run.phase, "reward");
  assert.equal(run.hp, 40, "normal combat victory does not heal the player");
  assert.ok(run.gold - goldBefore >= 13 && run.gold - goldBefore <= 15,
    "normal combat grants 85–100% of the 15G base reward");
  assert.equal(run.reward.heal, 0);
  assert.equal(run.reward.gold, run.gold - goldBefore);
}

{
  const run = E.newRun(50);
  const meta = E.freshMeta();
  run.route[0] = "gather";
  E.enter(run, meta);
  run.hp = 40;
  E.openChest(run, meta);
  assert.equal(run.hp, 40, "clearing a reward node does not heal the player");
  assert.equal(run.reward.heal, 0);
}

console.log("PASS Harmony clear rewards: no automatic healing and normal combat grants 13–15G.");

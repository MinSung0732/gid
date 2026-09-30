import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRewardInputGuard } from "../games/harmony/reward-input-guard.js";

let now = 1000;
const nextButton = { id: "previous-next" },
  rewardA = { id: "reward-a" },
  rewardB = { id: "reward-b" },
  guard = createRewardInputGuard({
    now: () => now,
    cooldownMs: 180,
  });

assert.equal(guard.allowClick(nextButton, { detail: 1 }), true,
  "non-reward screens should not be affected by the reward guard");

assert.equal(guard.sync("offer-1|1"), true);
assert.equal(guard.isLocked(), true);
assert.equal(
  guard.notePointerDown(rewardA, 1),
  false,
  "a pointer already held while the reward screen appears must not arm a reward",
);
assert.equal(
  guard.allowClick(rewardA, { detail: 1 }),
  false,
  "the inherited pointer-up/click must not claim a newly rendered reward",
);

now += 181;
assert.equal(
  guard.allowClick(rewardA, { detail: 1 }),
  false,
  "cooldown expiry alone is not enough; a fresh pointerdown is required",
);
assert.equal(guard.notePointerDown(rewardA, 2), true);
assert.equal(guard.allowClick(rewardA, { detail: 1 }), true,
  "a fresh click after reward activation should work normally");

assert.equal(guard.notePointerDown(rewardA, 3), true);
assert.equal(
  guard.allowClick(rewardB, { detail: 1 }),
  false,
  "pointerdown on one reward must not activate another reward target",
);

assert.equal(guard.sync("offer-1|0|offer-1:option:1"), true,
  "claiming a reward changes the reward-state key and re-arms the transition lock");
assert.equal(guard.isLocked(), true);
assert.equal(
  guard.allowClick(rewardB, { detail: 1 }),
  false,
  "a fast double click must not spill into the next reward state",
);
now += 181;
assert.equal(guard.notePointerDown(rewardB, 4), true);
guard.notePointerCancel(4);
assert.equal(guard.allowClick(rewardB, { detail: 1 }), false,
  "cancelled gestures must not claim rewards");

assert.equal(
  guard.allowClick(rewardB, { detail: 0 }),
  true,
  "keyboard/programmatic activation remains accessible and is not pointer-gated",
);

guard.sync(null);
assert.equal(guard.isLocked(), false);
assert.equal(guard.allowClick(nextButton, { detail: 1 }), true);

const main = await readFile(
  new URL("../games/harmony/main.js", import.meta.url),
  "utf8",
);
assert.match(main, /createRewardInputGuard/);
assert.match(
  main,
  /function rewardInputStateKey\(\)[\s\S]*?run\?\.phase !== "reward"[\s\S]*?offer\.remainingPicks[\s\S]*?offer\.claimedOptionIds/s,
  "reward state identity should change when an offer advances or a pick is consumed",
);
assert.match(
  main,
  /addEventListener\("pointerdown"[\s\S]*?REWARD_ACTIONS[\s\S]*?notePointerDown/s,
  "reward actions should only arm on a fresh pointerdown on the rendered reward",
);
assert.match(
  main,
  /REWARD_ACTIONS\.has\(action\)[\s\S]*?!rewardInputGuard\.allowClick[\s\S]*?event\.preventDefault\(\)[\s\S]*?handleGameAction/s,
  "guarded reward clicks must be rejected before gameplay reward handling",
);
assert.doesNotMatch(
  main,
  /contact_glass_dropper_strike|cardId\s*===/,
  "reward input safety must not be tied to any content-specific card",
);

console.log("PASS reward transition input guard: held pointer, fast double click, fresh gesture, cancel, keyboard.");

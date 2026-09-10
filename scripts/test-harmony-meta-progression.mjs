import assert from "node:assert/strict";
import { CARDS, EARLY_MONSTERS, ENEMIES, ITEMS, UNLOCKS } from "../games/harmony/data.js";
import * as E from "../games/harmony/engine.js";

const achievements = UNLOCKS.filter((unlock) => !unlock.legacy);
assert.equal(achievements.length, 20);
assert.equal(new Set(achievements.map((unlock) => unlock.id)).size, 20);

const lockedMeta = E.freshMeta();
assert.equal(E.isContentUnlocked(lockedMeta, "item", "relic_chimeric_alembic"), false);
assert.equal(E.isContentUnlocked(lockedMeta, "card", "contact_cauterizing_brand"), false);
lockedMeta.unlocked.push("relic_chimeric_alembic", "contact_cauterizing_brand");
assert.equal(E.isContentUnlocked(lockedMeta, "item", "relic_chimeric_alembic"), true);
assert.equal(E.isContentUnlocked(lockedMeta, "card", "contact_cauterizing_brand"), true);

const achievementRun = E.newRun(90210);
const achievementMeta = E.freshMeta();
achievementRun.route[0] = "battle";
E.enter(achievementRun, achievementMeta);
achievementRun.battle.shield = 60;
achievementRun.battle.hand = [{ id: "contact_glass_dropper_strike", level: 0 }];
E.play(achievementRun, 0, achievementMeta);
assert.ok(achievementMeta.unlocked.includes("relic_aegis_of_the_eternal_wax"));
assert.equal(achievementRun._unlockFeedback.at(-1).name, "철벽의 연금술");

const completeMeta = E.freshMeta();
completeMeta.discoveredCards = Object.keys(CARDS).filter((id) => id !== "impurity");
completeMeta.discovered = Object.keys(ITEMS);
completeMeta.defeatedMonsters = Object.keys(ENEMIES);
const completeProgress = E.codexProgress(completeMeta);
assert.equal(completeProgress.rate, 1);
assert.deepEqual(E.codexPerks(completeMeta), {
  startingGold: 20,
  startingPotions: 1,
  shopRerolls: 1,
  turn1Ap: 1,
  goldenCollection: true,
});
const veteranRun = E.newRun(77, null, completeMeta);
assert.equal(veteranRun.gold, 20);
assert.equal(veteranRun.potions, 2);
assert.equal(veteranRun.shopRerolls, 1);
assert.equal(E.power(veteranRun, "turn1ExtraAp"), 1);

const freshProgress = E.codexProgress(E.freshMeta());
assert.ok(freshProgress.found >= Object.keys(EARLY_MONSTERS).length);
assert.ok(freshProgress.rate < 0.2);

console.log("PASS Harmony meta progression: 20 achievements, locked pools, unlock feedback and codex account perks.");

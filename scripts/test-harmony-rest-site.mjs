import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";
import { loadGame, saveGame } from "../games/harmony/persistence.js";

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
const css = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");
assert.match(main, /rest-card-choices/);
assert.match(main, /E\.restCardChoices\(run\)/);
assert.match(main, /restUpgradeComparisonMarkup/);
assert.match(main, /restUpgradeSuccess/);
assert.match(main, /data-action="rest-leave"/);
assert.match(main, /fullHealth \? "disabled"/);
assert.match(main, /compactCardEffectSummary\(card, comparisonCard\)/);
assert.match(main, /card-summary-row-upgraded/);
assert.match(main, /highlightUpgradeDetailValues/);
assert.match(main, /rest-upgrade-value-changed/);
assert.match(css, /grid-template-columns:repeat\(5/);
assert.match(css, /\.rest-upgrade-comparison\.visible/);
assert.match(css, /@keyframes rest-upgrade-result-reveal/);
assert.match(css, /\.rest-upgrade-after \.card-compact-status \.card-effect-compact/);
assert.doesNotMatch(
  css,
  /\.card-effect-compact > span:has\(> \.card-summary-applied-status\)\s*\{\s*display:\s*none/,
  "Applied status summary rows stay visible outside the battle hand",
);

console.log("PASS Harmony rest site: shared status summaries, changed-value comparison, guarded upgrades, confirmation step, full-HP heal lock and animations.");

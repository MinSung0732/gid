import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";

const run = E.newRun(4242);
run.phase = "rest";
const choices = E.restCardChoices(run);
assert.equal(choices.length, 5, "Rest site offers five cards when five are upgradeable");
assert.equal(new Set(choices).size, 5, "Each offered card is a distinct deck copy");
assert.deepEqual(E.restCardChoices(run), choices, "Rest choices remain stable across renders");
const chosen = choices[0], beforeLevel = run.deck[chosen].level;
assert.equal(E.rest(run, "upgrade", chosen), undefined);
assert.equal(run.deck[chosen].level, beforeLevel + 1);
assert.equal(run.phase, "map");
assert.equal(run.restChoices, null);

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

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const css = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");
assert.match(main, /rest-card-choices/);
assert.match(main, /E\.restCardChoices\(run\)/);
assert.match(css, /grid-template-columns:repeat\(5/);

console.log("PASS Harmony rest site: stable five-card offer, guarded upgrades, hand layout and unchanged healing.");

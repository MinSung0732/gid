import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";
import { ITEMS } from "../games/harmony/data.js";
import { HIDDEN_SYNERGIES, SYNERGY_COLORS, SYNERGY_COMPONENT_IDS } from "../games/harmony/synergies.js";

assert.equal(Object.keys(HIDDEN_SYNERGIES).length, 10, "The supplied design contains ten, not eight, sets");
assert.equal(Object.keys(SYNERGY_COLORS).length, 10);
assert.equal(new Set(SYNERGY_COMPONENT_IDS).size, 23);
for (const id of SYNERGY_COMPONENT_IDS) {
  assert.ok(ITEMS[id], `Missing obtainable set component: ${id}`);
  assert.equal(ITEMS[id].synergyComponent, true);
}
for (const synergy of Object.values(HIDDEN_SYNERGIES)) {
  const run = E.newRun(101);
  run.inventory = [...synergy.requires];
  assert.ok(E.hasSynergy(run, synergy.id), `${synergy.name} should activate with every component`);
  run.inventory.pop();
  assert.equal(E.hasSynergy(run, synergy.id), false, `${synergy.name} should require the complete set`);
}

const mainSource = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");
assert.match(mainSource, /SYNERGY_COLORS/);
assert.match(mainSource, /synergy-shield-active/);
assert.match(mainSource, /synergy-set-badge/);
assert.match(cssSource, /@keyframes synergyShieldPulse/);
assert.match(cssSource, /prefers-reduced-motion/);

console.log("PASS Harmony synergy sets: ten complete sets, 23 obtainable components and accessible shield-aura UI.");

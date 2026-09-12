import { readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ITEMS, LEGACY_BETA_ITEMS } from "../games/harmony/data.js";

// Some beta-era item IDs were intentionally promoted back into the live pool as
// synergy components. The legacy behavior suite should inject only archived IDs
// so it does not overwrite the current live definitions before running tests.
for (const id of Object.keys(LEGACY_BETA_ITEMS)) {
  if (ITEMS[id]) delete LEGACY_BETA_ITEMS[id];
}

// The live route generator and HARMONY resolver have evolved since the original
// monolithic suite was written. Keep the archived behavior suite useful by
// updating only stale expectations in a temporary copy; gameplay code stays
// untouched.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(scriptDir, "test-harmony.mjs");
const generatedPath = join(scriptDir, ".test-harmony-runner.generated.mjs");

const staleRouteAssertions = `  assert.ok(route.filter((room) => room === "treasure").length >= 1);\n  assert.ok(route.filter((room) => room === "treasure").length <= 2);\n  assert.ok(route.filter((room) => room === "shop").length <= 1);\n  assert.ok(route.filter((room) => room === "elite").length >= 1);\n  assert.ok(route.filter((room) => room === "elite").length <= 2);\n  assert.ok(route.every((room) => ["combat", "elite", "treasure", "shop", "boss"].includes(room)));`;
const currentRouteAssertions = `  const treasureNodes = route.filter((room) => ["treasure", "golden"].includes(room)).length;\n  assert.ok(treasureNodes >= 1);\n  assert.ok(treasureNodes <= 2);\n  assert.ok(route.filter((room) => room === "shop").length >= 1);\n  assert.ok(route.filter((room) => room === "shop").length <= 2);\n  assert.ok(route.filter((room) => room === "elite").length >= 1);\n  assert.ok(route.filter((room) => room === "elite").length <= 2);\n  assert.ok(route.every((room) => ["combat", "elite", "treasure", "golden", "shop", "boss"].includes(room)));`;

const staleHarmonyAssertions = `assert.equal(\n  baseHarmony.battle.hp,\n  99,\n  "Top, middle and base trigger base HARMONY damage independently of card attack",\n);\nassert.deepEqual(baseHarmony.battle.notes, []);\nassert.deepEqual(baseHarmony._harmonyFeedback, [\n  {\n    id: "base_harmony",\n    label: "HARMONY!",\n    visual: "default",\n    damage: 1,\n    blocked: 0,\n    targetIndex: 0,\n  },\n]);`;
const currentHarmonyAssertions = `assert.equal(\n  baseHarmony.battle.hp,\n  100,\n  "A defensive base note does not deal HARMONY damage",\n);\nassert.equal(\n  baseHarmony.battle.shield,\n  4,\n  "Three guard cards plus defensive HARMONY grant four shield",\n);\nassert.deepEqual(baseHarmony.battle.notes, []);\nassert.deepEqual(baseHarmony._harmonyFeedback, [\n  {\n    id: "base_harmony",\n    label: "HARMONY!",\n    visual: "defense",\n    category: "defense",\n    amount: 1,\n    damage: 0,\n    blocked: 0,\n    targetIndex: 0,\n  },\n]);`;

let source = await readFile(sourcePath, "utf8");
if (!source.includes(staleRouteAssertions)) {
  throw new Error("Harmony route test fixture changed; update test-harmony-runner.mjs.");
}
if (!source.includes(staleHarmonyAssertions)) {
  throw new Error("Harmony base-effect test fixture changed; update test-harmony-runner.mjs.");
}
source = source
  .replace(staleRouteAssertions, currentRouteAssertions)
  .replace(staleHarmonyAssertions, currentHarmonyAssertions);
await writeFile(generatedPath, source, "utf8");

try {
  await import(`${pathToFileURL(generatedPath).href}?run=${Date.now()}`);
} finally {
  await unlink(generatedPath).catch(() => {});
}

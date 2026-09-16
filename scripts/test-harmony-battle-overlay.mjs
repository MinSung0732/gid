import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(
  new URL("../games/harmony/main.js", import.meta.url),
  "utf8",
);
const overlay = await readFile(
  new URL("../games/harmony/battle-overlay.js", import.meta.url),
  "utf8",
);
const feedback = await readFile(
  new URL("../games/harmony/combat-feedback-vfx.js", import.meta.url),
  "utf8",
);

assert.match(
  main,
  /from "\.\/battle-overlay\.js"/,
  "main should consume the shared battle overlay module",
);

for (const name of [
  "placeBattleOverlay",
  "syncBattleStateFrame",
  "showBattleShieldOverlay",
]) {
  assert.doesNotMatch(
    main,
    new RegExp(`function ${name}\\(`),
    `${name} implementation should live outside main.js`,
  );
  assert.match(
    overlay,
    new RegExp(`export function ${name}\\(`),
    `${name} should be exported by battle-overlay.js`,
  );
}

assert.match(
  overlay,
  /getBoundingClientRect\(\)[\s\S]*?document\.body\.append\(overlay\)/,
  "battle overlays should remain positioned from battle bounds and appended to the document body",
);
assert.match(
  overlay,
  /\.battle-state-frame[\s\S]*?health-critical[\s\S]*?enraged/,
  "battle state frame should keep critical/enraged state classes",
);
assert.match(
  overlay,
  /\.battle-shield-overlay\.\$\{type\}[\s\S]*?window\.setTimeout\(\(\) => overlay\.remove\(\), 950\)/,
  "shield overlay should keep duplicate cleanup and timeout removal",
);
assert.match(
  feedback,
  /from "\.\/battle-overlay\.js"/,
  "combat feedback VFX should consume the shared overlay placement helper",
);
assert.match(
  feedback,
  /placeBattleOverlay\(hitWash, battle\)/,
  "player hit wash should keep using the shared overlay placement helper",
);
assert.match(
  feedback,
  /placeBattleOverlay\(borderMist, battle\)/,
  "player healing border mist should keep using the shared overlay placement helper",
);
assert.match(
  feedback,
  /placeBattleOverlay\(smoke, battle\)/,
  "enemy debuff smoke should keep using the shared overlay placement helper",
);

console.log("PASS Harmony battle overlays stay modular across main and combat feedback VFX.");

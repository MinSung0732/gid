import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const feedback = await readFile(new URL("../games/harmony/combat-feedback-vfx.js", import.meta.url), "utf8");

assert.match(
  main,
  /from "\.\/combat-feedback-vfx\.js"/,
  "main should consume the shared combat feedback VFX module",
);
assert.match(
  main,
  /createCombatFeedbackVfx\(\{[\s\S]*?combatEffectsEnabled[\s\S]*?enemyElement[\s\S]*?formatNumber:\s*number[\s\S]*?\}\)/s,
  "main should inject only its combat DOM/effect dependencies into the feedback module",
);

for (const name of [
  "playContactHitSound",
  "addHealingMotes",
  "showPlayerDamage",
  "showStatusDamage",
  "showPlayerStatusSmoke",
  "showEnemyDebuffSmoke",
  "showStatusDamageQueue",
  "showPlayerHealing",
]) {
  assert.doesNotMatch(
    main,
    new RegExp(`function ${name}\\(`),
    `${name} implementation should live outside main.js`,
  );
}

assert.match(feedback, /export function createCombatFeedbackVfx\(/);
assert.match(feedback, /from "\.\/player-vfx-anchor\.js"/);
assert.match(feedback, /from "\.\/battle-overlay\.js"/);
assert.match(feedback, /from "\.\/statuses\.js\?v=20260911-4"/);
assert.match(feedback, /from "\.\/sound\.js\?v=20260911-9"/);

for (const marker of [
  "battle-hit-wash",
  "health-damage-pop",
  "player-status-smoke",
  "enemy-debuff-smoke",
  "healing-effect",
  "battle-healing-mist",
]) {
  assert.match(feedback, new RegExp(marker), `combat feedback module should preserve ${marker}`);
}

assert.match(
  feedback,
  /Math\.min\(700,\s*130 \+ hits\.length \* 190\)/,
  "status damage queue pacing should remain unchanged",
);
assert.match(
  feedback,
  /superStrong[\s\S]*?SFX\.superContactHit\(\)[\s\S]*?strong[\s\S]*?SFX\.strongContactHit\(\)[\s\S]*?SFX\.contactHit\(\)/s,
  "contact hit sound fallback order should remain unchanged",
);
assert.match(
  feedback,
  /return \{[\s\S]*?playContactHitSound[\s\S]*?showEnemyDebuffSmoke[\s\S]*?showPlayerDamage[\s\S]*?showPlayerHealing[\s\S]*?showStatusDamageQueue[\s\S]*?\};/s,
  "factory should expose the feedback functions used by main",
);

console.log("PASS Harmony combat feedback VFX is modular without changing hit/heal/status behavior contracts.");

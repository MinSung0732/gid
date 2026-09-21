import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const feedback = await readFile(new URL("../games/harmony/combat-feedback-vfx.js", import.meta.url), "utf8");
const cardOrchestrator = await readFile(new URL("../games/harmony/combat-card-orchestrator.js", import.meta.url), "utf8");
const actionOrchestrator = await readFile(new URL("../games/harmony/game-action-orchestrator.js", import.meta.url), "utf8");
const statusProcCss = await readFile(new URL("../games/harmony/status-proc-vfx.css", import.meta.url), "utf8");

assert.match(
  main,
  /from "\.\/combat-feedback-vfx\.js(?:\?v=[^"]+)?"/,
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
  "showEnemyHealing",
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
assert.match(feedback, /from "\.\/sound\.js\?v=20260920-1"/);

for (const marker of [
  "battle-hit-wash",
  "health-damage-pop",
  "player-status-smoke",
  "enemy-debuff-smoke",
  "enemy-healing-pop",
  "healing-effect",
  "battle-healing-mist",
]) {
  assert.match(feedback, new RegExp(marker), `combat feedback module should preserve ${marker}`);
}

assert.match(
  feedback,
  /hit\.target === "player"[\s\S]*?\? 250[\s\S]*?hits\.some\(isPoisonTick\)[\s\S]*?\? 150[\s\S]*?Math\.min\(900, 130 \+ hits\.length \* 190 \+ poisonTail\)/s,
  "status damage queue gives the longer multi-spot player signature a bounded tail without changing enemy poison timing",
);
assert.match(
  cardOrchestrator,
  /render\(\);\s*stageStatusDamageHealth\?\.\(statusHits\);/,
  "card actions stage pre-status health in the same task as the resolved-state render",
);
assert.match(
  actionOrchestrator,
  /render\(\);\s*stageStatusDamageHealth\?\.\(statusHits\);/,
  "general actions stage pre-status health in the same task as the resolved-state render",
);
assert.match(
  feedback,
  /superStrong[\s\S]*?SFX\.superContactHit\(\)[\s\S]*?strong[\s\S]*?SFX\.strongContactHit\(\)[\s\S]*?SFX\.contactHit\(\)/s,
  "contact hit sound fallback order should remain unchanged",
);
assert.match(
  feedback,
  /return \{[\s\S]*?playContactHitSound[\s\S]*?showEnemyDebuffSmoke[\s\S]*?showEnemyHealing[\s\S]*?showPlayerDamage[\s\S]*?showPlayerHealing[\s\S]*?stageStatusDamageHealth[\s\S]*?showStatusDamageQueue[\s\S]*?\};/s,
  "factory should expose the feedback functions used by main",
);

assert.match(
  feedback,
  /showPlayerHealing\(\s*amount,\s*\{ waitForPresentation = false \} = \{\},\s*\)/s,
  "healing renderer should expose an opt-in presentation completion boundary",
);
assert.match(
  feedback,
  /waitForPresentation[\s\S]*?animationend[\s\S]*?setTimeout\(finish, 1100\)/s,
  "healing presentation wait should reuse the existing animation with a bounded fallback",
);

assert.match(
  feedback,
  /function showPlayerCleanseVfx\(changes = \[\]\)[\s\S]*?playerCleanseBounds\(\)[\s\S]*?hmy-player-cleanse-wave-primary[\s\S]*?hmy-player-cleanse-wave-secondary/s,
  "player cleanse should use a dedicated wide two-wave presentation instead of scaling enemy effects",
);
assert.match(
  cardOrchestrator,
  /beforePlayerStatuses[\s\S]*?cleanseCandidateIds[\s\S]*?playerCleanseChanges[\s\S]*?await showPlayerCleanseVfx\(playerCleanseChanges\)/s,
  "card presentation should derive cleanse visuals from resolved player status changes",
);
assert.match(
  main,
  /const \{[\s\S]*?showPlayerHealing,[\s\S]*?showPlayerCleanseVfx,[\s\S]*?\} = createCombatFeedbackVfx/s,
  "main should expose player cleanse presentation from the shared feedback module",
);
assert.match(
  main,
  /feedback:\s*\{[\s\S]*?showPlayerHealing,[\s\S]*?showPlayerCleanseVfx,[\s\S]*?showAbsorbGain,/s,
  "card orchestrator feedback should receive player cleanse presentation",
);
assert.match(
  statusProcCss,
  /\.hmy-player-cleanse \{[\s\S]*?pointer-events: none;[\s\S]*?@keyframes hmy-player-cleanse-wave-secondary/s,
  "player cleanse overlay should stay non-interactive and expand as an elliptical secondary wave",
);
assert.match(
  statusProcCss,
  /\.hmy-player-cleanse-reduced[\s\S]*?hmy-player-cleanse-wave-reduced/s,
  "reduced motion should retain a wide cleanse footprint",
);
assert.match(
  feedback,
  /hmy-player-cleanse-sweep[\s\S]*?glintPositions[\s\S]*?hmy-player-cleanse-glint[\s\S]*?310 \+ index \* 52/s,
  "player cleanse should add one wipe sweep followed by staggered clean glints",
);
assert.match(
  feedback,
  /glintPositions = reduced[\s\S]*?\[\[38, 25\], \[67, 34\]\][\s\S]*?\[\[19, 30\], \[43, 21\], \[69, 31\], \[56, 46\]\]/s,
  "reduced cleanse should keep two glints while full motion uses a restrained four-glint finish",
);
assert.match(
  feedback,
  /setTimeout\(finish, reduced \? 540 : 640\)/,
  "cleanse presentation should finish within the requested compact timing envelope",
);
assert.match(
  statusProcCss,
  /\.hmy-player-cleanse > i,[\s\S]*?pointer-events: none;[\s\S]*?\.hmy-player-cleanse-sweep \{[\s\S]*?@keyframes hmy-player-cleanse-sweep[\s\S]*?@keyframes hmy-player-cleanse-glint[\s\S]*?@keyframes hmy-player-cleanse-afterglow/s,
  "clean finish should remain non-interactive and preserve wipe, shine, and afterglow phases",
);

console.log("PASS Harmony combat feedback VFX is modular without changing hit/heal/status behavior contracts.");

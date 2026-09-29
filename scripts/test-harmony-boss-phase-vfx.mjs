import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const engine = await readFile(new URL("../games/harmony/engine-core.js", import.meta.url), "utf8");
const card = await readFile(new URL("../games/harmony/combat-card-orchestrator.js", import.meta.url), "utf8");
const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const vfx = await readFile(new URL("../games/harmony/boss-phase-vfx.js", import.meta.url), "utf8");
const css = await readFile(new URL("../games/harmony/boss-phase-vfx.css", import.meta.url), "utf8");

assert.match(
  engine,
  /enemy\.isBoss[\s\S]*?!enemy\.phase2[\s\S]*?enemy\.hp > 0[\s\S]*?enemy\.hp <= enemy\.maxHp \/ 2[\s\S]*?enemy\.phase2 = true;[\s\S]*?S\.applyStatus\(enemy, "strength", \{ stacks: 2, turns: 9 \}\);[\s\S]*?s\._bossPhaseFeedback = true;/s,
  "existing Phase 2 rule, threshold, strength gain, and feedback flag must remain intact",
);

assert.match(
  card,
  /delete run\._bossPhaseFeedback;[\s\S]*?engine\.play\(run, index, meta\);[\s\S]*?bossPhaseTriggered = Boolean\(run\._bossPhaseFeedback\)[\s\S]*?delete run\._bossPhaseFeedback;/s,
  "boss phase feedback must follow clear -> resolve -> capture -> clear lifecycle",
);
assert.match(
  card,
  /before\.isBoss[\s\S]*?!before\.phase2[\s\S]*?Boolean\(after\?\.phase2\)[\s\S]*?\(after\?\.hp \|\| 0\) > 0/s,
  "presentation target must be the living boss that actually transitioned false -> true",
);
assert.match(
  card,
  /await showEnemyHitQueue\([\s\S]*?await showStatusProcQueue\([\s\S]*?if \(bossPhaseFeedback\)[\s\S]*?await showBossPhase2Vfx\(bossPhaseFeedback\)/s,
  "boss transformation must start only after existing enemy hit presentation finishes",
);

assert.match(
  main,
  /createBossPhaseVfx\([\s\S]*?combatEffectsEnabled[\s\S]*?enemyElement[\s\S]*?reducedCombatMotion/s,
  "main should wire boss phase presentation through existing combat FX and enemy anchors",
);
assert.match(
  vfx,
  /if \(!feedback \|\| feedback\.alive === false \|\| !combatEffectsEnabled\(\)\) return;/,
  "Combat FX OFF and dead targets must skip the presentation and its delay",
);
assert.match(
  vfx,
  /await wait\(reduced \? 35 : 100\)[\s\S]*?hmy-boss-phase2-core[\s\S]*?hmy-boss-phase2-ring-a[\s\S]*?hmy-boss-phase2-ring-b[\s\S]*?발향 폭주/s,
  "phase VFX should preserve the short post-hit beat then core/rings/label transformation",
);
assert.match(
  vfx,
  /particleCount = 14[\s\S]*?hmy-boss-phase2-particle[\s\S]*?await wait\(reduced \? 360 : 820\)/s,
  "full motion should burst actor-centered particles and remain within the intended duration",
);
assert.doesNotMatch(
  vfx + css,
  /screen[- ]?shake|strong-contact-shake/i,
  "boss phase presentation must not add screen shake",
);
assert.match(
  css,
  /\.hmy-boss-phase2-ring-a[\s\S]*?\.hmy-boss-phase2-ring-b[\s\S]*?hmy-boss-phase2-particle[\s\S]*?hmy-boss-phase2-actor[\s\S]*?@media \(prefers-reduced-motion: reduce\)/s,
  "CSS should cover strong rings, particles, actor glow, and reduced motion",
);

console.log("PASS boss Phase 2 feedback is presented once after hit resolution without changing Phase 2 rules.");

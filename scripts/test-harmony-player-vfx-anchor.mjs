import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const anchors = await readFile(new URL("../games/harmony/player-vfx-anchor.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");

assert.match(
  main,
  /from "\.\/player-vfx-anchor\.js"/,
  "main should consume the shared player VFX anchor module",
);
assert.doesNotMatch(
  main,
  /function getPlayerHealthAnchor\(\)/,
  "player health anchor implementation should live outside main.js",
);
assert.doesNotMatch(
  main,
  /function getPlayerImpactPoint\(\)/,
  "player impact point implementation should live outside main.js",
);
assert.match(
  anchors,
  /function getPlayerHealthAnchor\(\)\s*\{[\s\S]*?\.run-hud-health-slot[\s\S]*?\.run-hud-health[\s\S]*?\.player-stats \.health-stat/s,
  "player health VFX should use a shared semantic health anchor with mobile fallback",
);
assert.match(
  anchors,
  /function getPlayerImpactPoint\(\)\s*\{[\s\S]*?document\.querySelector\("\.battle"\)[\s\S]*?getBoundingClientRect\(\)/s,
  "player contact impact points should be derived from the battle bounds",
);
const impactStart = anchors.indexOf("function getPlayerImpactPoint");
const impactEnd = anchors.indexOf("\nfunction ", impactStart + 1);
const impactBody = anchors.slice(impactStart, impactEnd === -1 ? anchors.length : impactEnd);
assert.match(
  impactBody,
  /battle\.querySelector\("\.hand"\)[\s\S]*?handBounds/,
  "player contact impacts should prefer the full hand container as the player-side zone",
);
assert.match(
  impactBody,
  /bounds\.width \* \.12[\s\S]*?bounds\.width \* \.88[\s\S]*?bounds\.height \* \.58[\s\S]*?bounds\.height \* \.76/,
  "hand-less layouts should keep a broad lower-battle fallback zone",
);
assert.match(impactBody, /Math\.random\(\)/, "impact coordinates should remain continuous Math.random samples");
assert.doesNotMatch(impactBody, /\.hand \.card|querySelector(?:All)?\([^)]*\.card/, "impact targeting must not use individual cards");
assert.doesNotMatch(impactBody, /bounds\.width \* \.18[\s\S]*?bounds\.width \* \.36/, "the legacy narrow left-side impact band must not return");
assert.doesNotMatch(main, /randomPlayerImpactPoint/);
assert.doesNotMatch(main, /\.stat-row:first-child/);

for (const name of [
  "showPlayerDamage",
  "showStatusDamage",
  "showPlayerStatusSmoke",
  "showPlayerHealing",
  "updatePlayerHealthFeedback",
]) {
  const start = main.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = main.indexOf("\nfunction ", start + 1);
  const body = main.slice(start, next === -1 ? main.length : next);
  assert.match(body, /getPlayerHealthAnchor\(\)/, `${name} should use getPlayerHealthAnchor()`);
}

for (const name of ["showPlayerContactImpact", "animateEnemyContactAttack"]) {
  const start = main.indexOf(`function ${name}`) >= 0
    ? main.indexOf(`function ${name}`)
    : main.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = main.indexOf("\nfunction ", start + 1);
  const nextAsync = main.indexOf("\nasync function ", start + 1);
  const candidates = [next, nextAsync].filter((value) => value >= 0);
  const end = candidates.length ? Math.min(...candidates) : main.length;
  const body = main.slice(start, end);
  assert.doesNotMatch(body, /\.player-stats/, `${name} must not target the left player panel`);
  assert.match(body, /getPlayerImpactPoint\(\)/, `${name} should use the shared battle impact point`);
}

assert.doesNotMatch(styles, /\.stat-row:first-child/);
assert.match(styles, /\.health-stat,\s*\n\.run-hud-health-slot\s*\{\s*position:\s*relative;/s);

console.log("PASS Harmony player VFX anchors are modular and keep semantic HP HUD / battle-space impact points.");

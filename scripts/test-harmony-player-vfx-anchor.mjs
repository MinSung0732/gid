import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");

assert.match(
  main,
  /function getPlayerHealthAnchor\(\)\s*\{[\s\S]*?\.run-hud-health-slot[\s\S]*?\.run-hud-health[\s\S]*?\.player-stats \.health-stat/s,
  "player health VFX should use a shared semantic health anchor with mobile fallback",
);
assert.match(
  main,
  /function getPlayerImpactPoint\(\)\s*\{[\s\S]*?document\.querySelector\("\.battle"\)[\s\S]*?getBoundingClientRect\(\)/s,
  "player contact impact points should be derived from the battle bounds",
);
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

console.log("PASS Harmony player VFX anchors use semantic HP HUD and battle-space impact points.");

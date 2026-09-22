import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../games/harmony/", import.meta.url),
  resolution = await readFile(new URL("enemy-noncontact-resolution-vfx.js", root), "utf8"),
  css = await readFile(new URL("enemy-noncontact-resolution-vfx.css", root), "utf8"),
  anticipation = await readFile(new URL("enemy-anticipation-vfx.js", root), "utf8"),
  turn = await readFile(new URL("combat-turn-orchestrator.js", root), "utf8"),
  main = await readFile(new URL("main.js", root), "utf8"),
  html = await readFile(new URL("index.html", root), "utf8"),
  act1 = await readFile(new URL("act1-monsters.js", root), "utf8"),
  act2 = await readFile(new URL("act2-monsters.js", root), "utf8");

assert.match(
  resolution,
  /DEFAULT_PRESENTATION[\s\S]*?delivery: "streak"[\s\S]*?impactStyle: "default"[\s\S]*?releaseDuration: 110[\s\S]*?travelDuration: 150[\s\S]*?impactDuration: 190/s,
  "nonContact attacks need a compact release/travel/impact fallback",
);
assert.match(
  resolution,
  /action\?\.presentation \|\| \{\}[\s\S]*?configured\.delivery[\s\S]*?configured\.impactStyle/s,
  "action presentation metadata should override common delivery/impact styles",
);
assert.doesNotMatch(
  resolution,
  /monsterId|enemyName|switch \(.*enemy/i,
  "shared nonContact rendering must not branch by monster identity",
);
assert.match(
  resolution,
  /showRelease\(source, presentation\);[\s\S]*?for \(let index = 0; index < hits\.length; index\+\+\)[\s\S]*?showTravel[\s\S]*?showImpact[\s\S]*?onImpact\?\./s,
  "one release should lead into per-hit travel/impact without replaying anticipation",
);
assert.match(
  resolution,
  /if \(!combatEffectsEnabled\(\) \|\| !source \|\| !target\)[\s\S]*?hits\.forEach[\s\S]*?onImpact/s,
  "missing actor/UI or FX OFF should fall back to existing hit feedback safely",
);
assert.match(
  resolution,
  /reduced \? 70[\s\S]*?reduced[\s\S]*?80[\s\S]*?impactDuration: reduced \? 130/s,
  "reduced motion should shorten travel while retaining release and impact",
);
for (const className of [
  "hmy-enemy-noncontact-release",
  "hmy-enemy-noncontact-travel",
  "hmy-enemy-noncontact-impact",
  "hmy-noncontact-impact-flash",
  "hmy-noncontact-impact-ring",
  "hmy-noncontact-impact-spark",
]) assert.match(css, new RegExp(className));
assert.match(
  css,
  /is-blocked[\s\S]*?#98c8c0[\s\S]*?is-shield-break/s,
  "shield impact should reuse the common resolution impact instead of duplicating shield-break VFX",
);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(
  anticipation,
  /await wait\(duration\);[\s\S]*?actor\.classList\.remove[\s\S]*?root\.remove\(\)/s,
  "anticipation should clean its charge state before resolution presentation",
);
assert.match(
  turn,
  /outcome\.attackPattern === "nonContact"[\s\S]*?outcome\.hits\.length[\s\S]*?showEnemyNonContactResolution[\s\S]*?action: actingIntent[\s\S]*?hits: outcome\.hits[\s\S]*?onImpact: showEnemyNonContactImpact/s,
  "single and multi-hit nonContact attacks should use the shared resolution pipeline",
);
assert.doesNotMatch(
  turn,
  /outcome\.attackPattern === "nonContact"[\s\S]{0,120}?outcome\.hits\.length > 1/s,
  "single-hit nonContact attacks must not skip release/travel/impact",
);
for (const marker of [
  "showShieldBlock",
  "showPlayerImpactShieldBlock",
  "showPlayerShieldBreakVfx",
  "showPlayerDamage",
]) assert.match(turn, new RegExp(marker), `existing feedback should remain connected: ${marker}`);
assert.match(main, /createEnemyNonContactResolutionVfx/);
assert.match(main, /showEnemyNonContactResolution/);
assert.match(html, /enemy-noncontact-resolution-vfx\.css/);

assert.match(
  act1,
  /phase_separator:[\s\S]*?attackPattern: "nonContact"/s,
  "Act 1 elite fallback nonContact action should require no presentation metadata",
);
assert.match(
  act1,
  /blighted_strip:[\s\S]*?hits: 3, attackPattern: "nonContact"/s,
  "real multi-hit nonContact action should use the common pipeline",
);
assert.match(
  act2,
  /bossPattern[\s\S]*?hits: 2, attackPattern: "nonContact"/s,
  "boss multi-hit nonContact actions should remain compatible with the same pipeline",
);

console.log("PASS enemy nonContact release/travel/impact presentation contracts.");

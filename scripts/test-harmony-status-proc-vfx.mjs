import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../games/harmony/", import.meta.url),
  feedback = await readFile(new URL("combat-feedback-vfx.js", root), "utf8"),
  css = await readFile(new URL("status-proc-vfx.css", root), "utf8"),
  engine = await readFile(new URL("engine-core.js", root), "utf8"),
  main = await readFile(new URL("main.js", root), "utf8"),
  card = await readFile(new URL("combat-card-orchestrator.js", root), "utf8"),
  turn = await readFile(new URL("combat-turn-orchestrator.js", root), "utf8"),
  html = await readFile(new URL("index.html", root), "utf8");

for (const className of [
  "hmy-bleed-proc",
  "hmy-bleed-core",
  "hmy-bleed-slash",
  "hmy-bleed-particle",
  "hmy-bleed-damage",
  "hmy-status-consume-bleed",
  "hmy-burn-proc",
  "hmy-burn-core",
  "hmy-burn-flame",
  "hmy-burn-ember",
  "hmy-burn-damage",
  "hmy-status-consume-burn",
]) {
  assert.match(
    `${feedback}\n${css}`,
    new RegExp(className),
    `${className} should be part of the proc VFX contract`,
  );
}

assert.match(html, /status-proc-vfx\.css/);
assert.match(main, /data-status-id="\$\{id\}"/);
assert.match(main, /showEnemyHitQueue\([\s\S]*?onHit = null[\s\S]*?onHit\?\.\(hit\)/s);
assert.match(feedback, /isBleed \? 5 : 6/, "particles stay explicitly capped");
assert.match(feedback, /setTimeout\(\(\) => effect\.remove\(\)/, "proc nodes have a cleanup fallback");
assert.match(feedback, /await wait\(reducedCombatMotion\(\) \? 35 : 85\)/);
assert.match(feedback, /await wait\(reducedCombatMotion\(\) \? 35 : 45\)/);
assert.match(feedback, /!health\.closest\("\.player-stats"\)/, "player proc damage must not use the left stats panel");
assert.match(feedback, /getPlayerImpactPoint\(\)/, "player proc VFX uses a real battle impact point");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /hmy-bleed-core 380ms/);
assert.match(css, /hmy-burn-flame 440ms/);

assert.match(engine, /sourceImpactId/);
assert.match(engine, /stackBefore/);
assert.match(engine, /stackAfter/);
assert.match(card, /event\.sourceImpactId === hit\.impactId/);
assert.match(turn, /event\.sourceImpactId === hit\.impactId/);
assert.match(card, /for \(const event of linked\)[\s\S]*?await showStatusProcVfx/s);
assert.match(card, /hit\.statusId !== "impurityOverflow" && !hit\.sourceImpactId/);

assert.doesNotMatch(feedback, /\.hp\s*[+\-]?=/, "VFX code must not mutate combat HP");
assert.doesNotMatch(feedback, /removeStatus|applyStatus|procRatio/, "VFX code must not implement status math");

console.log("PASS Harmony bleed/burning proc VFX contracts, timing, anchors, and cleanup.");

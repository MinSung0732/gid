import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { enemyAnticipationType } from "../games/harmony/enemy-anticipation-vfx.js";

assert.equal(enemyAnticipationType({ type: "attack", attackPattern: "contact" }), "contact");
assert.equal(enemyAnticipationType({ type: "attack", attackPattern: "nonContact" }), "nonContact");
assert.equal(enemyAnticipationType({ type: "attack" }), "contact");
assert.equal(enemyAnticipationType({ type: "guard" }), "guard");
assert.equal(enemyAnticipationType({ type: "debuff" }), "debuff");
assert.equal(enemyAnticipationType({ type: "pollute" }), "pollute");
assert.equal(enemyAnticipationType({ type: "stun" }), null);
assert.equal(enemyAnticipationType({ type: "disarm" }), null);

const turn = await readFile(
  new URL("../games/harmony/combat-turn-orchestrator.js", import.meta.url),
  "utf8",
);
const main = await readFile(
  new URL("../games/harmony/main.js", import.meta.url),
  "utf8",
);
const vfx = await readFile(
  new URL("../games/harmony/enemy-anticipation-vfx.js", import.meta.url),
  "utf8",
);
const css = await readFile(
  new URL("../games/harmony/enemy-anticipation-vfx.css", import.meta.url),
  "utf8",
);
const core = await readFile(
  new URL("../games/harmony/engine-core.js", import.meta.url),
  "utf8",
);

assert.equal(
  (turn.match(/showEnemyAnticipation\?\.\(/g) || []).length,
  1,
  "anticipation should be called once per enemy action, not once per hit",
);
assert.match(
  turn,
  /actionWillBeCancelled[\s\S]*?showBossSignature[\s\S]*?showEnemyAnticipation[\s\S]*?engine\.executeSingleEnemyAction\(run, index, getMeta\(\)\)/s,
  "cancellation check, signature, anticipation, then gameplay resolution must stay ordered",
);
assert.match(
  turn,
  /signaturePlayed: bossSignaturePlayed/,
  "signature playback result should compact the following anticipation",
);
assert.match(
  main,
  /STATUS_DEFINITIONS\[id\]\?\.restriction === "allActions"[\s\S]*?STATUS_DEFINITIONS\[id\]\?\.restriction === "attacks"/s,
  "presentation should skip anticipation for actions already cancelled by stun/disarm restrictions",
);
assert.match(
  vfx,
  /if \(!meta \|\| !combatEffectsEnabled\(\)\) return false;/,
  "Combat FX OFF and unsupported action types must add no anticipation delay",
);
assert.match(
  vfx,
  /compact\s*\?\s*170\s*:\s*meta\.duration/s,
  "boss signature actions should use a compact anticipation instead of full duration",
);
assert.match(
  vfx,
  /const particles = reduced \? 2 : compact \? 2 : 4/,
  "non-contact reduced motion should preserve only a small readable particle gather",
);
assert.match(
  css,
  /hmy-enemy-anticipate-contact[\s\S]*?hmy-enemy-anticipate-cast[\s\S]*?hmy-enemy-anticipate-guard[\s\S]*?hmy-enemy-anticipate-control/s,
  "contact, cast, guard, and control silhouettes should remain visually distinct",
);
assert.match(
  css,
  /type-pollute[\s\S]*?hmy-enemy-anticipation-smoke/s,
  "pollution should use its own murky visual language rather than generic debuff smoke",
);
assert.match(
  css,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transform: none/s,
  "Reduced Motion should suppress large actor translation while keeping type cues",
);

assert.match(
  core,
  /enemy\.intent\.type === "attack"[\s\S]*?enemy\.intent\.type === "guard"[\s\S]*?enemy\.intent\.type === "pollute"[\s\S]*?enemy\.intent\.type === "debuff"/s,
  "anticipation categories must continue to mirror actual engine action types",
);
assert.match(
  core,
  /const hits = Math\.max\(1, Math\.floor\(enemy\.intent\.hits \|\| 1\)\)/,
  "multi-hit remains resolved inside one enemy action after a single anticipation",
);

console.log("PASS typed enemy anticipation presentation contract.");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ACTION_CANCEL_PRESENTATIONS,
  actionCancelPresentation,
} from "../games/harmony/action-cancel-vfx.js";

assert.equal(actionCancelPresentation("stun")?.statusId, "stun");
assert.equal(actionCancelPresentation("disarm")?.statusId, "disarm");
assert.equal(actionCancelPresentation("unknown"), null);
assert.equal(ACTION_CANCEL_PRESENTATIONS.stun.cleanupActionPresentation, true);
assert.equal(ACTION_CANCEL_PRESENTATIONS.disarm.cleanupActionPresentation, true);

const core = await readFile(new URL("../games/harmony/engine-core.js", import.meta.url), "utf8");
const statuses = await readFile(new URL("../games/harmony/statuses.js", import.meta.url), "utf8");
const turn = await readFile(new URL("../games/harmony/combat-turn-orchestrator.js", import.meta.url), "utf8");
const anticipation = await readFile(new URL("../games/harmony/enemy-anticipation-vfx.js", import.meta.url), "utf8");
const signature = await readFile(new URL("../games/harmony/boss-signature-vfx.js", import.meta.url), "utf8");
const cancelVfx = await readFile(new URL("../games/harmony/action-cancel-vfx.js", import.meta.url), "utf8");
const cancelCss = await readFile(new URL("../games/harmony/action-cancel-vfx.css", import.meta.url), "utf8");

assert.match(statuses, /stun:[\s\S]*?restriction: "allActions"/s);
assert.match(statuses, /disarm:[\s\S]*?restriction: "attacks"/s);

assert.match(
  core,
  /const stunned = S\.stacks\(enemy, "stun"\) \|\| S\.restricted\(enemy, "allActions"\)[\s\S]*?type = "stun";[\s\S]*?skipped = true;[\s\S]*?enemy\.intent\.type === "attack" && S\.restricted\(enemy, "attacks"\)[\s\S]*?type = "disarm";[\s\S]*?skipped = true;/s,
  "gameplay must remain the authority for stun/disarm cancellation",
);
assert.match(
  core,
  /if \(id === "stun" && \(entity\.stunResistance \|\| 0\) > 0\) return 0;/,
  "stun resistance must continue to prevent the status before presentation",
);

assert.match(
  turn,
  /actionWillBeCancelled[\s\S]*?if \(!actionWillBeCancelled && bossSignatureIdentity\)[\s\S]*?if \(!actionWillBeCancelled && actingIntent\)[\s\S]*?engine\.executeSingleEnemyAction/s,
  "already-cancelled actions must not start signature or anticipation",
);
assert.match(
  turn,
  /outcome\.skipped[\s\S]*?\["stun", "disarm"\]\.includes\(outcome\.type\)[\s\S]*?showActionCancelFeedback/s,
  "cancel feedback must consume the resolved skipped outcome exactly once",
);
assert.equal(
  (turn.match(/showActionCancelFeedback\?\.\(/g) || []).length,
  1,
  "one cancelled action should produce one cancel presentation",
);

assert.match(
  anticipation,
  /function cleanupEnemyAnticipation[\s\S]*?hmy-enemy-anticipating-contact[\s\S]*?querySelectorAll/s,
  "anticipation should own its cleanup path",
);
assert.match(
  signature,
  /function cleanupBossSignature[\s\S]*?hmy-boss-signature-actor[\s\S]*?querySelectorAll/s,
  "boss signatures should own their cleanup path",
);
assert.match(
  cancelVfx,
  /cleanupActionPresentation\?\.\(context\)[\s\S]*?if \(!combatEffectsEnabled\(\)\) return false;/s,
  "cleanup should happen through the shared interface and Combat FX OFF should add no VFX delay",
);
assert.match(
  cancelCss,
  /hmy-action-cancel-actor-stun[\s\S]*?hmy-action-cancel-actor-disarm[\s\S]*?@media \(prefers-reduced-motion: reduce\)/s,
  "stun/disarm must remain visually distinct with reduced-motion support",
);

console.log("PASS stun/disarm action cancel presentation contract.");

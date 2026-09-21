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
  "hmy-status-proc-pulse",
  "hmy-status-rising-proc",
  "hmy-status-rising-mote",
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
assert.match(
  feedback,
  /STATUS_PROC_PRESENTATIONS[\s\S]*?bleed:[\s\S]*?particleCount: 5[\s\S]*?burning:[\s\S]*?particleCount: 6[\s\S]*?regeneration:[\s\S]*?mode: "healingTick"[\s\S]*?particleCount: 4[\s\S]*?reducedParticleCount: 2/s,
  "status proc visuals should stay registry-driven with capped particle counts",
);
assert.match(feedback, /setTimeout\(\(\) => effect\.remove\(\)/, "proc nodes have a cleanup fallback");
assert.match(feedback, /await wait\(reducedCombatMotion\(\) \? 35 : 85\)/);
assert.match(feedback, /await wait\(reducedCombatMotion\(\) \? 35 : 45\)/);
assert.match(feedback, /!health\.closest\("\.player-stats"\)/, "player proc damage must not use the left stats panel");
assert.match(feedback, /getPlayerImpactPoint\(\)/, "player proc VFX uses a real battle impact point");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /hmy-bleed-core 380ms/);
assert.match(css, /hmy-burn-flame 440ms/);
assert.match(
  feedback,
  /regeneration:[\s\S]*?intensity: "micro"[\s\S]*?particleStyle: "rising"[\s\S]*?leadDuration: 140[\s\S]*?reducedLeadDuration: 90/s,
  "regeneration should use a compact Micro/Normal proc presentation",
);
assert.match(
  feedback,
  /function pulseStatusProcChip\(event, presentation\)[\s\S]*?statusProcChip\(event, false\)[\s\S]*?clearTimeout[\s\S]*?hmy-status-proc-pulse/s,
  "status chip pulses should extend without forcing a restart and should tolerate a missing chip",
);
assert.match(
  feedback,
  /function createRisingStatusProcEffect\(event, point, presentation\)[\s\S]*?STATUS_DEFINITIONS\[event\.statusId\][\s\S]*?presentation\.reducedParticleCount[\s\S]*?--status-proc-color/s,
  "rising proc particles should reuse status definition colors and reduced-motion counts",
);
assert.match(
  feedback,
  /presentation\.mode === "healingTick"[\s\S]*?showHealingStatusProcVfx/s,
  "presentation dispatch should use registry mode instead of status-specific if branches",
);
assert.doesNotMatch(
  feedback,
  /if \(event\.statusId === "regeneration"\)/,
  "presentation core should not hardcode regeneration branches",
);
assert.match(
  css,
  /\.status-chip\.hmy-status-proc-pulse[\s\S]*?var\(--status-color/s,
  "status chip feedback should reuse the rendered status color token",
);
assert.match(
  css,
  /\.hmy-status-rising-mote[\s\S]*?--status-proc-color[\s\S]*?@keyframes hmy-status-rising-mote/s,
  "regeneration motes should rise softly from the actor using the shared status color",
);
assert.match(
  css,
  /prefers-reduced-motion: reduce[\s\S]*?hmy-status-proc-pulse-reduced[\s\S]*?hmy-status-rising-mote[\s\S]*?animation-duration: 220ms/s,
  "reduced motion should retain status identity while shortening movement",
);

assert.match(engine, /sourceImpactId/);
assert.match(engine, /stackBefore/);
assert.match(engine, /stackAfter/);
assert.match(engine, /const linkedDamage = \[\.\.\.\(s\._damageFeedback \|\| \[\]\)\]/);
assert.match(engine, /"hpBefore",\s*"hpAfter",\s*"maxHp"/s);
assert.match(
  engine,
  /function triggerRegeneration[\s\S]*?restored > 0[\s\S]*?statusId,[\s\S]*?amount: restored,[\s\S]*?effectType: "heal",[\s\S]*?source: "status",[\s\S]*?triggerType: "turnStart"[\s\S]*?emitStatusProcFeedback\(s, event\)/s,
  "regeneration gameplay should emit resolved cause metadata once per tick",
);
assert.match(
  engine,
  /const statusId = "regeneration",[\s\S]*?stackBefore = Number\(S\.stacks\(entity, statusId\)\)[\s\S]*?heal\(s, stackBefore\)[\s\S]*?S\.tickDurations\(entity, "afterTrigger"\)/s,
  "regeneration amount, timing, and duration rules should remain in gameplay",
);
assert.match(
  feedback,
  /function showStatusProcDamage\(event, point\) \{[\s\S]*?presentStatusHealth\(event, event\.hpAfter\)/s,
  "proc health changes land on the proc damage beat",
);
assert.match(
  feedback,
  /async function showStatusProcQueue\(events, options = \{\}\) \{\s*stageStatusDamageHealth\(events\);[\s\S]*?finalizeStatusDamageHealth\(events\);/s,
  "proc queues stage and reconcile health presentation",
);
assert.match(card, /event\.sourceImpactId === hit\.impactId/);
assert.match(turn, /event\.sourceImpactId === hit\.impactId/);
assert.match(
  turn,
  /presentLeadingStatusProcs[\s\S]*?event\.effectType === "heal"[\s\S]*?event\.triggerType === "turnStart"[\s\S]*?await feedback\.showStatusProcVfx\(event\)[\s\S]*?outcome\.regenerationRestored > 0[\s\S]*?await presentLeadingStatusProcs\("enemy", index\)[\s\S]*?showEnemyHealing/s,
  "enemy status cause feedback should precede the existing heal renderer without status-id branching",
);
assert.match(card, /for \(const event of linked\)[\s\S]*?await showStatusProcVfx/s);
assert.match(card, /hit\.statusId !== "impurityOverflow" && !hit\.sourceImpactId/);

assert.doesNotMatch(feedback, /\.hp\s*[+\-]?=/, "VFX code must not mutate combat HP");
assert.doesNotMatch(feedback, /removeStatus|applyStatus|procRatio/, "VFX code must not implement status math");

console.log("PASS Harmony status proc VFX contracts, regeneration cause feedback, timing, anchors, and cleanup.");

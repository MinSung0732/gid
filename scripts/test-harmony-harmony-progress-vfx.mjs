import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const engine = await readFile(new URL("../games/harmony/engine-core.js", import.meta.url), "utf8");
const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const card = await readFile(new URL("../games/harmony/combat-card-orchestrator.js", import.meta.url), "utf8");
const progress = await readFile(new URL("../games/harmony/harmony-progress-vfx.js", import.meta.url), "utf8");
const css = await readFile(new URL("../games/harmony/harmony-progress-vfx.css", import.meta.url), "utf8");

assert.match(
  engine,
  /beforeNotes[\s\S]*?afterNotes[\s\S]*?_harmonyProgressFeedback \?\?= \[\]/s,
  "engine should emit transient note progress snapshots when a note is actually gained",
);
assert.match(
  engine,
  /if \(!S\.sealBlocksHarmony\(s\)[\s\S]*?if \(harmonyProgressFeedback\) \{[\s\S]*?completed = true;[\s\S]*?harmonyTriggered = true;[\s\S]*?triggerHarmony\(s, chain\)/s,
  "completion flag must come from the engine's real HARMONY branch",
);
assert.doesNotMatch(
  progress,
  /anyThreeCardsHarmony|BASE_HARMONY_EFFECT/,
  "presentation must not recalculate HARMONY rules",
);

assert.match(
  main,
  /function noteProgressTerm\(notes = \[\]\)[\s\S]*?slice\(-3\)[\s\S]*?data-note-slot[\s\S]*?data-note-link/s,
  "combat stats should render semantic recent-three note progress slots",
);
assert.match(
  main,
  /function showHarmonyResonance\([\s\S]*?harmony-chain[\s\S]*?harmony-ring-a[\s\S]*?harmony-ring-b[\s\S]*?HARMONY!/s,
  "existing HARMONY resonance structure must stay intact",
);
assert.match(
  main,
  /function showHarmonyFeedback\(triggers\) \{[\s\S]*?SFX\.harmony\(\)[\s\S]*?showHarmonyResonance/s,
  "existing HARMONY SFX and resonance entry point must stay intact",
);

assert.match(
  card,
  /playedCardRect = button\?\.getBoundingClientRect\?\.\(\)[\s\S]*?harmonySourcePoint/s,
  "note flight should capture the actually used card position before DOM removal",
);
assert.match(
  card,
  /await showHarmonyProgress\(progressEvent, harmonySourcePoint\);[\s\S]*?showHarmonyFeedback\(harmonyTriggers\);[\s\S]*?showHarmonyProgressConsume\(progressEvent\)/s,
  "final note landing must precede existing resonance and consume must follow resonance start",
);
assert.match(
  card,
  /delete run\._harmonyProgressFeedback;[\s\S]*?engine\.play\(run, index, meta\);[\s\S]*?harmonyProgressEvents = run\._harmonyProgressFeedback \|\| \[\][\s\S]*?delete run\._harmonyProgressFeedback;/s,
  "progress feedback should obey clear -> resolve -> capture -> clear lifecycle",
);

assert.match(
  progress,
  /duration: 230[\s\S]*?hmy-note-slot-landed[\s\S]*?reducedCombatMotion\(\) \? 80 : 120/s,
  "note flight and final landing bridge should stay short",
);
assert.match(
  progress,
  /hmy-note-progress-consuming[\s\S]*?hmy-note-consume-mote[\s\S]*?setVisualNotes\(\[\]\)/s,
  "completed progress should visually consume into resonance before becoming empty",
);
assert.match(
  engine,
  /if \(b\.notes\.length\) \{[\s\S]*?_harmonyResetFeedback = \{[\s\S]*?reason: "turnStart"[\s\S]*?\}[\s\S]*?b\.notes = \[\]/s,
  "turn start should snapshot incomplete notes immediately before the existing reset",
);
assert.match(
  progress,
  /function showHarmonyResetVfx\(event\)[\s\S]*?setVisualNotes\(event\.notes\.slice\(-3\), \{ ghost: true \}\)[\s\S]*?hmy-note-progress-resetting[\s\S]*?setVisualNotes\(\[\]\)/s,
  "reset VFX should replay captured notes as a temporary visual ghost and then clear it",
);
assert.match(
  css,
  /hmy-note-progress-resetting[\s\S]*?hmy-note-reset-slot[\s\S]*?hmy-note-reset-link[\s\S]*?hmy-note-reset-mote/s,
  "incomplete notes should dim, lose connection light, and evaporate without a failure flash",
);
assert.match(
  progress,
  /animation\.finished[\s\S]*?setTimeout\(resolve, 280\)[\s\S]*?flight\.remove\(\)/s,
  "one-shot flight DOM should have animation completion and timeout cleanup",
);
assert.match(
  css,
  /\.hmy-note-flight,[\s\S]*?pointer-events: none;[\s\S]*?@media \(max-width: 900px\)[\s\S]*?@media \(prefers-reduced-motion: reduce\)/s,
  "progress VFX should be non-interactive with mobile and reduced-motion rules",
);

assert.match(
  progress,
  /progressStage\(event\)[\s\S]*?\[2, 3, 5\]\[stage - 1\][\s\S]*?hmy-note-flight-stage-\$\{stage\}/s,
  "flight visual density should scale from note 1 to note 3 without changing progress data",
);
assert.match(
  progress,
  /\[3, 4, 6\]\[stage - 1\][\s\S]*?hmy-note-landing-bloom[\s\S]*?hmy-note-landing-ring[\s\S]*?hmy-note-landing-particle/s,
  "landing impact should scale bloom, ring, and particles across the three progress stages",
);
assert.match(
  progress,
  /hmy-note-progress-linked[\s\S]*?hmy-note-progress-complete[\s\S]*?hmy-note-progress-compress/s,
  "second-note connection and third-note completion compression should reuse the existing progress flow",
);
assert.match(
  progress,
  /reducedCombatMotion\(\) \? 24 : 55[\s\S]*?hmy-note-progress-complete-flow[\s\S]*?reducedCombatMotion\(\) \? 90 : 140/s,
  "final BASE should visibly land before a short three-slot completion hold and existing resonance",
);
assert.match(
  css,
  /\.hmy-note-flight-core \{[\s\S]*?width: 22px;[\s\S]*?hmy-note-flight-stage-2[\s\S]*?width: 25px;[\s\S]*?hmy-note-flight-stage-3[\s\S]*?width: 29px;/s,
  "flight core should remain clearly visible and scale up through the three progress stages",
);
assert.match(
  css,
  /hmy-note-progress-complete-flow \[data-note-link="0"\][\s\S]*?animation-delay: 24ms[\s\S]*?data-note-link="1"[\s\S]*?animation-delay: 62ms[\s\S]*?hmy-note-complete-halo/s,
  "third-note completion should show a readable connection resonance before HARMONY",
);
assert.match(
  css,
  /hmy-note-flight-stage-2[\s\S]*?hmy-note-flight-stage-3[\s\S]*?hmy-note-slot-landed-2[\s\S]*?hmy-note-slot-landed-3/s,
  "visual hierarchy must clearly increase from first to second to third note",
);
assert.match(
  css,
  /hmy-note-filled-breathe 2\.35s[\s\S]*?hmy-note-link-travel[\s\S]*?hmy-note-complete-slot[\s\S]*?hmy-note-compress/s,
  "filled notes should breathe subtly while connection and final completion stay short-lived",
);

console.log("PASS Harmony note progress bridges card resolve into existing resonance without changing HARMONY rules.");

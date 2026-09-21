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
  progress,
  /animation\.finished[\s\S]*?setTimeout\(resolve, 280\)[\s\S]*?flight\.remove\(\)/s,
  "one-shot flight DOM should have animation completion and timeout cleanup",
);
assert.match(
  css,
  /\.hmy-note-flight,[\s\S]*?pointer-events: none;[\s\S]*?@media \(max-width: 900px\)[\s\S]*?@media \(prefers-reduced-motion: reduce\)/s,
  "progress VFX should be non-interactive with mobile and reduced-motion rules",
);

console.log("PASS Harmony note progress bridges card resolve into existing resonance without changing HARMONY rules.");

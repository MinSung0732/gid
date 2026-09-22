import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../games/harmony/", import.meta.url),
  statuses = await readFile(new URL("statuses.js", root), "utf8"),
  engine = await readFile(new URL("engine-core.js", root), "utf8"),
  vfx = await readFile(new URL("stack-resource-vfx.js", root), "utf8"),
  css = await readFile(new URL("stack-resource-vfx.css", root), "utf8"),
  card = await readFile(new URL("combat-card-orchestrator.js", root), "utf8"),
  turn = await readFile(new URL("combat-turn-orchestrator.js", root), "utf8"),
  actions = await readFile(new URL("game-action-orchestrator.js", root), "utf8"),
  main = await readFile(new URL("main.js", root), "utf8"),
  html = await readFile(new URL("index.html", root), "utf8"),
  nonContact = await readFile(new URL("non-contact-cards.js", root), "utf8"),
  contact = await readFile(new URL("contact-cards.js", root), "utf8"),
  guard = await readFile(new URL("guard-cards.js", root), "utf8");

assert.match(
  statuses,
  /resonance:[\s\S]*?color: "#e8bc75"[\s\S]*?stackPresentation:[\s\S]*?gainStyle: "gather"[\s\S]*?consumeStyle: "disperse"[\s\S]*?trailStyle: "scent"/s,
  "resonance style should live in status metadata and reuse its existing color",
);

assert.match(
  statuses,
  /concentration:[\s\S]*?color: "#f8e29a"[\s\S]*?consume: "cardPlayed"[\s\S]*?stackPresentation:[\s\S]*?consumeStyle: "inject"[\s\S]*?trailStyle: "focused"[\s\S]*?particleCount: 1[\s\S]*?duration: 170[\s\S]*?reducedDuration: 135[\s\S]*?pulseDuration: 85[\s\S]*?mergeFlow: false[\s\S]*?targetSpark: true/s,
  "concentration consume should be a metadata-driven micro injection using its existing status color",
);
assert.match(
  statuses,
  /directDamage\(base, source, target\)[\s\S]*?stacks\(source, "concentration"\)[\s\S]*?Math\.max\(0, base \+ concentration\)/s,
  "concentration direct-damage scaling must remain in gameplay status math",
);
assert.match(
  statuses,
  /shieldGain\(base, entity\)[\s\S]*?base \+ stacks\(entity, "concentration"\)/s,
  "concentration shield scaling must remain in gameplay status math",
);
assert.match(
  statuses,
  /consumeCardStatuses\(entity\)[\s\S]*?removeStatus\(entity, "concentration", 1\)/s,
  "card play should still consume exactly one concentration stack",
);
assert.match(
  engine,
  /function consumeBattleCardStatuses\(s\)[\s\S]*?consume === "cardPlayed"[\s\S]*?S\.consumeCardStatuses\(s\)[\s\S]*?recordStackResourceChange/s,
  "card-consumed stack resources should be observed generically before/after gameplay consumption",
);
assert.match(
  contact,
  /contact_glass_dropper_strike:[\s\S]*?attack: 8/s,
  "a real direct-damage card should remain available for concentration damage coverage",
);
assert.match(
  guard,
  /guard_paraffin_seal:[\s\S]*?shield: 8/s,
  "a real shield card should remain available for concentration shield coverage",
);
assert.doesNotMatch(
  vfx,
  /event\.resourceId === "concentration"|resourceId === "concentration"/,
  "generic stack renderer must not branch on concentration identity",
);
assert.match(
  vfx,
  /presentation\.particleCount[\s\S]*?particleCount = configuredCount \?\? clampParticleCount/s,
  "resource metadata should be able to pin concentration to one focused particle even for larger deltas",
);
assert.match(
  vfx,
  /presentation\.mergeFlow !== false[\s\S]*?current\?\.root\?\.isConnected/s,
  "resource metadata should control whether per-card target flows merge",
);
assert.match(
  vfx,
  /presentation\.targetSpark[\s\S]*?hmy-stack-resource-target-spark/s,
  "focused injection may add only a small metadata-driven target spark",
);
assert.match(
  vfx,
  /Number\.isFinite\(Number\(presentation\.pulseDuration\)\)[\s\S]*?duration = configured \?\? \(reduced \? 150 : 190\)/s,
  "custom micro pulse timing must not change default resonance pulse timing",
);
assert.match(
  css,
  /style-inject[\s\S]*?height: 1px[\s\S]*?hmy-stack-resource-target-spark/s,
  "inject styling should stay thinner and more focused than the default resource trail",
);

assert.match(
  engine,
  /function recordStackResourceChange\([\s\S]*?delta > 0 \? "gain" : "consume"[\s\S]*?definition\?\.stackPresentation\?\.\[styleKey\][\s\S]*?_stackResourceFeedback/s,
  "gameplay should emit resolved generic stack-change metadata",
);
assert.match(
  engine,
  /function applyBattleStatus[\s\S]*?beforeStacks[\s\S]*?afterStacks[\s\S]*?recordStackResourceChange/s,
  "stack gains should be emitted from the existing status application path",
);
assert.match(
  engine,
  /function removeBattleStatus[\s\S]*?S\.removeStatus[\s\S]*?recordStackResourceChange/s,
  "stack consumes should use the same generic change event path",
);
assert.match(
  engine,
  /sourceType: "card"[\s\S]*?sourceId: card\.id[\s\S]*?reason: "cardPlay"/s,
  "card gameplay should preserve its source metadata without DOM knowledge",
);
assert.match(
  engine,
  /c\.consumeResonance[\s\S]*?removeBattleStatus\([\s\S]*?"resonance"[\s\S]*?reason: "cardConsume"/s,
  "existing resonance consumption should retain gameplay semantics while emitting presentation context",
);

assert.match(
  nonContact,
  /noncontact_fine_mist_spray:[\s\S]*?applyEnemy: \{ resonance: 2 \}/s,
  "real +2 resonance card should exercise multi-stack gain",
);
assert.match(
  nonContact,
  /noncontact_spatial_resonance_wave:[\s\S]*?consumeResonance: 3/s,
  "real resonance consumer should remain unchanged",
);

assert.match(vfx, /event\.delta > 0 \? "gain" : "consume"/);
assert.doesNotMatch(
  vfx,
  /event\.resourceId === "resonance"|resourceId === "resonance"/,
  "renderer core must not branch on resonance identity",
);
assert.match(
  vfx,
  /changeType === "gain"[\s\S]*?externalAnchor[\s\S]*?chipAnchor[\s\S]*?changeType === "gain"[\s\S]*?chipAnchor[\s\S]*?externalAnchor/s,
  "gain and consume must use opposite source/target direction",
);
assert.match(
  vfx,
  /Math\.abs\(Number\(delta\)[\s\S]*?Math\.min\(4, 2 \+ Math\.floor/s,
  "large deltas should raise particle density only slightly instead of repeating animations",
);
assert.match(
  vfx,
  /activeFlows\.get\(key\)[\s\S]*?appendMotes[\s\S]*?hmy-stack-resource-flow-reinforced[\s\S]*?clearTimeout/s,
  "rapid same-resource changes should reinforce the active flow instead of restarting it",
);
assert.match(
  vfx,
  /hmy-stack-resource-chip-temporary[\s\S]*?event\.previousValue[\s\S]*?event\.nextValue <= 0/s,
  "missing/removed chips should use a safe temporary presentation shell",
);
assert.match(
  vfx,
  /if \(!chip && !actorAnchor\) return false/,
  "missing chip and actor should skip presentation without affecting gameplay",
);
assert.match(
  vfx,
  /if \(reduced && chipAnchor\)[\s\S]*?18[\s\S]*?changeType === "gain"[\s\S]*?chipAnchor\.x \+ shortX[\s\S]*?to = chipAnchor[\s\S]*?from = chipAnchor/s,
  "Reduced Motion should retain short inward/outward direction",
);

assert.match(css, /hmy-stack-resource-ribbon/);
assert.doesNotMatch(css, /#e8bc75/, "resource CSS must not hardcode the resonance color");
assert.match(css, /hmy-stack-resource-mote/);
assert.match(css, /hmy-stack-resource-chip-pulse/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

assert.match(
  card,
  /stackResourceChanges = run\._stackResourceFeedback \|\| \[\][\s\S]*?showStackResourceChange\(event, \{ sourcePoint: harmonySourcePoint \}\)/s,
  "card presentation should connect resolved resource events to the captured card anchor",
);
assert.match(turn, /stackResourceChanges:[\s\S]*?showStackResourceChange/s);
assert.match(actions, /presentStackResourceChanges[\s\S]*?showStackResourceChange/s);
assert.match(main, /createStackResourceVfx/);
assert.match(main, /showStackResourceChange/);
assert.match(html, /stack-resource-vfx\.css/);

assert.doesNotMatch(vfx, /applyStatus|removeStatus|\.hp\s*[+\-]?=/, "presentation must not own gameplay state");
console.log("PASS generic stack resource VFX: resonance gather/disperse plus concentration card injection, timing, anchors, fallbacks, and reduced motion.");

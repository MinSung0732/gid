import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const attack = await readFile(new URL("../games/harmony/attack-feedback-vfx.js", import.meta.url), "utf8");
const cardPresentation = await readFile(new URL("../games/harmony/card-presentation.js", import.meta.url), "utf8");
const handCss = await readFile(new URL("../games/harmony/card-hand-ui.css", import.meta.url), "utf8");
const enemyUi = await readFile(new URL("../games/harmony/combat-layout-phase2-finish.js", import.meta.url), "utf8");
const enemyCss = await readFile(new URL("../games/harmony/combat-layout-phase2-finish.css", import.meta.url), "utf8");

assert.match(
  main,
  /from "\.\/attack-feedback-vfx\.js"/,
  "main should consume the shared attack feedback VFX module",
);
assert.match(
  main,
  /createAttackFeedbackVfx\(\{[\s\S]*?combatEffectsEnabled[\s\S]*?effectsLayer[\s\S]*?enemyElement[\s\S]*?formatNumber:\s*number[\s\S]*?getCombatFxSequence[\s\S]*?nextCombatFxSequence[\s\S]*?playContactHitSound[\s\S]*?reducedCombatMotion[\s\S]*?\}\)/s,
  "main should inject the existing combat DOM, sequence, sound and motion dependencies",
);

for (const name of [
  "showCombatImpactRing",
  "contactHitPause",
  "showContactImpactHold",
  "showContactImpactCrack",
  "showContactTierImpact",
  "showShieldBreakImpact",
  "showNonContactImpact",
  "showAttackImpactVisual",
  "normalizedAttackFx",
  "defaultAttackVfxKey",
  "playAttackHitSound",
  "enemyHitClassFor",
  "showHitFeedback",
  "showWeakContactImpact",
  "showStrongContactImpact",
]) {
  assert.doesNotMatch(
    main,
    new RegExp(`function ${name}\\(`),
    `${name} implementation should live outside main.js`,
  );
  assert.match(
    attack,
    new RegExp(`function ${name}\\(`),
    `${name} should remain implemented by attack-feedback-vfx.js`,
  );
}

assert.match(attack, /from "\.\/engine\.js\?v=20260913-22"/);
assert.match(attack, /from "\.\/sound\.js\?v=20260911-9"/);
assert.match(attack, /from "\.\/battle-overlay\.js"/);

for (const marker of [
  "contact-impact-hold",
  "contact-impact-crack",
  "shield-break-impact",
  "noncontact-impact",
  "damage-pop",
  "weak-contact-impact",
  "strong-contact-impact",
]) {
  assert.match(attack, new RegExp(marker), `attack feedback module should preserve ${marker}`);
}

assert.match(
  attack,
  /descriptor\.pattern === "contact" && descriptor\.shieldBreak[\s\S]*?barrierBreakSuperContactHit[\s\S]*?barrierBreakStrongContactHit[\s\S]*?barrierBreakContactHit/s,
  "contact shield-break sound selection should remain unchanged",
);
assert.match(
  attack,
  /nextCombatFxSequence\(\) % 7/,
  "damage popup variation should keep advancing the shared combat FX sequence",
);
assert.match(
  main,
  /angle = Math\.round\(index \* \(360 \/ moteCount\) \+ \(combatFxSequence % 5\) \* 7\)/,
  "non-contact cast visuals should keep sharing the same combat FX sequence",
);
assert.match(
  attack,
  /return \{[\s\S]*?contactHitPause[\s\S]*?showHitFeedback[\s\S]*?showStrongContactImpact[\s\S]*?showWeakContactImpact[\s\S]*?\};/s,
  "factory should expose only the attack feedback functions still consumed by main",
);

assert.match(
  cardPresentation,
  /class="card\$\{index === null \? "" : " hand-card-visual"\}/,
  "rendered hand cards should expose an explicit presentation class",
);
assert.match(
  handCss,
  /:is\(\.battle > \.hand \.card, \.hand-card-visual\)/,
  "live hand cards and body-level VFX clones should share one presentation ruleset",
);
assert.equal(
  (main.match(/cloneNode\(true\)/g) || []).length >= 4,
  true,
  "contact, strong/super, non-contact and enemy attack clones should preserve source classes",
);
assert.match(
  main,
  /clone = enemyVisual\.cloneNode\(true\)/,
  "enemy attack playback should clone the rendered visual slot",
);
assert.match(
  enemyUi,
  /querySelector\(":scope > \.enemy-visual"\)[\s\S]*?classList\.add\("enemy-visual-presentation"\)/,
  "rendered enemy slots should expose the presentation class inherited by attack clones",
);
assert.match(
  enemyCss,
  /\.enemy-visual-presentation \.enemy-symbol \{[\s\S]*?font-size: clamp\(36px, 6vh, 62px\);[\s\S]*?line-height: 1;/,
  "enemy attack clones should retain the desktop symbol metrics",
);
assert.match(
  enemyCss,
  /@media \(min-width: 901px\) and \(max-height: 800px\)[\s\S]*?\.enemy-visual-presentation \.enemy-symbol \{[\s\S]*?font-size: clamp\(28px, 4vh, 32px\);/,
  "enemy attack clones should retain the compact-height symbol metrics",
);
assert.match(
  enemyCss,
  /@media \(min-width: 901px\) and \(max-height: 800px\)[\s\S]*?\.enemy-visual-presentation \{[\s\S]*?height: 32px;[\s\S]*?min-height: 32px;[\s\S]*?max-height: 32px;/,
  "enemy attack clones should retain the compact-height visual slot metrics",
);

console.log("PASS Harmony attack feedback VFX is modular without changing hit impact, sound, or shared sequence contracts.");

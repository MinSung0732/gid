import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
const attack = await readFile(new URL("../games/harmony/attack-feedback-vfx.js", import.meta.url), "utf8");

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

console.log("PASS Harmony attack feedback VFX is modular without changing hit impact, sound, or shared sequence contracts.");

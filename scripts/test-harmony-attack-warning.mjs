import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { combatFxPowerTier } from "../games/harmony/engine.js";

const main = await readFile(
  new URL("../games/harmony/main.js", import.meta.url),
  "utf8",
);
const css = await readFile(
  new URL("../games/harmony/styles.css", import.meta.url),
  "utf8",
);
const superFx = await readFile(
  new URL("../games/harmony/combat-super-fx-epic.js", import.meta.url),
  "utf8",
);
const superFxCss = await readFile(
  new URL("../games/harmony/combat-super-fx-epic.css", import.meta.url),
  "utf8",
);

assert.equal(combatFxPowerTier(19), "weak");
assert.equal(combatFxPowerTier(20), "strong");
assert.equal(combatFxPowerTier(29), "strong");
assert.equal(combatFxPowerTier(30), "super");
assert.match(main, /몬스터가 강력한 공격을 시전중입니다/);
assert.match(main, /몬스터가 위험한 공격을 시전중입니다/);
assert.match(main, /combatFxPowerTier\(damage\)/);
assert.match(main, /enemy\.statuses\?\.stun\?\.stacks/);
assert.match(main, /enemy\.statuses\?\.disarm\?\.stacks/);
assert.match(main, /b\.completedEnemies\?\.includes\(index\)/);
assert.match(css, /\.enemy-threat-effect-strong/);
assert.match(css, /\.enemy-threat-effect-super/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.enemy-threat-effect/);
assert.match(superFx, /const SUPER_ATTACK_CHARGE_MS = 1350/);
assert.match(superFx, /CONTACT_SUPER_HOLD_MS = SUPER_ATTACK_CHARGE_MS/);
assert.match(superFx, /NONCONTACT_SUPER_CHARGE_MS = SUPER_ATTACK_CHARGE_MS/);
assert.match(superFx, /createCircularCardCharge\([\s\S]*particleCount = 32/);
assert.match(superFx, /createCircularCardCharge\([\s\S]*"contact"/);
assert.match(superFx, /createCircularCardCharge\([\s\S]*"noncontact"/);
assert.match(superFxCss, /\.super-card-light-charge-contact/);
assert.match(superFxCss, /\.super-card-light-charge-noncontact/);
assert.match(superFxCss, /@keyframes super-card-light-particle/);
assert.doesNotMatch(superFx, /prefers-reduced-motion/);
assert.doesNotMatch(superFxCss, /prefers-reduced-motion/);

console.log("PASS Harmony attack warnings: thresholds, copy, effects, cancellation guards, 1.35-second super charge and circular card-light particles are present.");

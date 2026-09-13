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

console.log("PASS Harmony attack warnings: thresholds, copy, effects, and cancellation guards are present.");

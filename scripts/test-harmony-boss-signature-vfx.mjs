import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BOSS_SIGNATURES,
  bossSignatureConfig,
} from "../games/harmony/boss-signature-vfx.js";

const expectedBosses = [
  "scent_devouring_archivist",
  "incomplete_refinement_supervisor",
  "symbiosis_mother",
  "blooming_parasitic_garden",
  "grand_alchemy_perfume_core",
  "forbidden_perfume_computation",
  "wounded_scent_incarnation",
  "thousand_wounds",
  "solar_scent_storm_core",
  "eternal_distillation_sun",
  "absolute_resonance_conductor",
  "scent_memory_itself",
];

assert.deepEqual(
  Object.keys(BOSS_SIGNATURES).sort(),
  [...expectedBosses].sort(),
  "signature registry should contain only the selected real late-game bosses",
);

for (const bossId of expectedBosses)
  assert.ok(
    Object.keys(BOSS_SIGNATURES[bossId] || {}).length > 0,
    `${bossId} should have at least one registered signature action`,
  );

assert.equal(
  bossSignatureConfig({
    bossId: "scent_devouring_archivist",
    actionId: "opening:1",
    phase: "late-main",
  })?.label,
  "강제 열람",
);
assert.equal(
  bossSignatureConfig({
    bossId: "scent_devouring_archivist",
    actionId: "opening:0",
    phase: "late-main",
  }),
  null,
  "ordinary archivist guard must not trigger a signature",
);
assert.equal(
  bossSignatureConfig({
    bossId: "symbiosis_mother",
    actionId: "onEnter",
    phase: "symbiosis-bloom",
  })?.label,
  "기관 공명 강화",
);
assert.equal(
  bossSignatureConfig({
    bossId: "symbiosis_mother",
    actionId: "onEnter",
    phase: "symbiosis-growth",
  }),
  null,
  "phase-specific signatures must not leak into another phase",
);
assert.equal(
  bossSignatureConfig({
    bossId: "grand_alchemy_perfume_core",
    actionId: "onEnter",
    phase: "alchemy-collapse",
  })?.intensity,
  "super",
);
assert.equal(
  bossSignatureConfig({
    bossId: "eternal_distillation_sun",
    actionId: "opening:3",
    phase: "late-main",
  })?.label,
  "임계 방출",
);
assert.equal(
  bossSignatureConfig({
    bossId: "ordinary_enemy",
    actionId: "opening:0",
    phase: "late-main",
  }),
  null,
);

const patternRuntime = await readFile(
  new URL("../games/harmony/engine-enemy-patterns.js", import.meta.url),
  "utf8",
);
const turnRuntime = await readFile(
  new URL("../games/harmony/combat-turn-orchestrator.js", import.meta.url),
  "utf8",
);
const vfx = await readFile(
  new URL("../games/harmony/boss-signature-vfx.js", import.meta.url),
  "utf8",
);

assert.match(
  patternRuntime,
  /_patternV2PlanPhaseId[\s\S]*?_patternV2PlanActionId[\s\S]*?plan\.kind === "onEnter"[\s\S]*?plan\.kind === "conditional"[\s\S]*?plan\.slotIndex/s,
  "planner adapter should retain actual V2 phase and action-slot identity for presentation",
);
assert.match(
  patternRuntime,
  /commitEnemyPatternPlan[\s\S]*?delete enemy\._patternV2PlanPhaseId;[\s\S]*?delete enemy\._patternV2PlanActionId;/s,
  "presentation identity metadata should be cleared with the committed plan",
);
assert.match(
  turnRuntime,
  /bossSignatureIdentity[\s\S]*?_patternV2PlanActionId[\s\S]*?await feedback\.showBossSignature\?\.\(bossSignatureIdentity\)[\s\S]*?engine\.executeSingleEnemyAction\(run, index, getMeta\(\)\)/s,
  "registered signature presentation must occur before the underlying enemy action resolves",
);
assert.match(
  vfx,
  /if \(!config \|\| !combatEffectsEnabled\(\)\) return false;/,
  "unregistered actions and Combat FX OFF must add no signature delay",
);

console.log("PASS data-driven boss signature registry and call ordering.");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const core = await readFile(
  new URL("../games/harmony/engine-core.js", import.meta.url),
  "utf8",
);
const main = await readFile(
  new URL("../games/harmony/main.js", import.meta.url),
  "utf8",
);
const card = await readFile(
  new URL("../games/harmony/combat-card-orchestrator.js", import.meta.url),
  "utf8",
);
const turn = await readFile(
  new URL("../games/harmony/combat-turn-orchestrator.js", import.meta.url),
  "utf8",
);
const game = await readFile(
  new URL("../games/harmony/game-action-orchestrator.js", import.meta.url),
  "utf8",
);
const focus = await readFile(
  new URL("../games/harmony/trigger-focus-vfx.js", import.meta.url),
  "utf8",
);
const traits = await readFile(
  new URL("../games/harmony/beneficial-traits.js", import.meta.url),
  "utf8",
);
const relics = await readFile(
  new URL("../games/harmony/official-relics.js", import.meta.url),
  "utf8",
);

assert.match(
  core,
  /function recordTriggerFocus\(s, effectKey, context = \{\}\)[\s\S]*?item\.effect === effectKey[\s\S]*?sourceType: item\.kind[\s\S]*?sourceId/s,
  "gameplay should emit source metadata by effect contract, not content-id branches",
);

for (const effectKey of [
  "regen",
  "bleedLeech",
  "bleedTriggerShield",
  "contactBleedHeal",
  "contactShield",
  "nonContactLeechAbsorb",
  "nonContactPoison",
  "endTurnShieldAttack",
  "absorbSpillShield",
  "harmonyEchoDamage",
  "harmonyAoeTrueDamage",
  "harmonyDebuffStorm",
  "harmonyWeakAll",
  "startCombatThornsAndShield",
  "startCombatBurnAll",
]) {
  assert.match(
    core,
    new RegExp(`recordTriggerFocus\\(s, "${effectKey}"`),
    `${effectKey} should emit trigger focus metadata at its real trigger site`,
  );
}

assert.match(
  traits,
  /trait_open_wound_scent:[\s\S]*?effect: "bleedLeech"/s,
);
assert.match(
  traits,
  /trait_cauterizing_strike:[\s\S]*?effect: "contactBleedHeal"/s,
);
assert.match(
  traits,
  /trait_shield_to_blade_transmute:[\s\S]*?effect: "endTurnShieldAttack"/s,
);
assert.match(
  traits,
  /trait_olfactive_pyramid_echo:[\s\S]*?effect: "harmonyEchoDamage"/s,
);
assert.match(
  relics,
  /relic_resonant_glass_bell:[\s\S]*?effect: "harmonyWeakAll"/s,
);
assert.match(
  relics,
  /relic_dewdrop_collector_funnel:[\s\S]*?effect: "regen"/s,
);
assert.match(
  relics,
  /relic_crystalline_thorn_core:[\s\S]*?effect: "startCombatThornsAndShield"/s,
);
assert.match(
  relics,
  /relic_eternal_incense_censer:[\s\S]*?effect: "startCombatBurnAll"/s,
);

assert.match(
  main,
  /data-source-type="\$\{i\.kind\}" data-source-id="\$\{id\}"/,
  "visible trait/relic rows should expose generic source identity datasets",
);
assert.match(
  main,
  /findTriggerSourceElement[\s\S]*?dataset\.sourceType === sourceType[\s\S]*?dataset\.sourceId === sourceId/s,
  "source lookup should be generic and dataset-driven",
);

assert.match(
  focus,
  /const MERGE_WINDOW_MS = 520/,
  "same-source focus should share one common debounce window",
);
assert.match(
  focus,
  /needsFullFocus[\s\S]*?hmy-trigger-focus-dim[\s\S]*?for \(let index = 0; index < prepared\.length; index\+\+\)/s,
  "multiple sources should share one dim session instead of flickering per source",
);
assert.match(
  focus,
  /findSourceElement\?\.\(event\) \|\| findFallbackElement\?\.\(event\) \|\| null/,
  "missing source UI should fall back safely without gameplay coupling",
);
assert.match(
  focus,
  /reducedCombatMotion\(\)[\s\S]*?!\["heal", "shield", "damage", "absorb", "status"\]\.includes/s,
  "link particles should be optional and disabled in reduced motion",
);
assert.match(
  focus,
  /if \(!combatEffectsEnabled\(\)[\s\S]*?return false;/s,
  "Combat FX OFF must add no trigger-focus presentation delay",
);

assert.match(
  card,
  /triggerFocusEvents = run\._triggerFocusFeedback \|\| \[\][\s\S]*?delete run\._triggerFocusFeedback;[\s\S]*?await showTriggerFocusQueue\(triggerFocusEvents\)[\s\S]*?if \(contactAttackPlayed\)/s,
  "card gameplay should capture/clear focus once before existing result VFX",
);
assert.match(
  turn,
  /endTurnTriggerFocusEvents[\s\S]*?showTriggerFocusQueue\?\.\(endTurnTriggerFocusEvents\)/s,
);
assert.match(
  turn,
  /roundTriggerFocusEvents[\s\S]*?showTriggerFocusQueue\?\.\(roundTriggerFocusEvents\)/s,
);
assert.match(
  game,
  /triggerFocusEvents = run\?\._triggerFocusFeedback \|\| \[\][\s\S]*?delete run\._triggerFocusFeedback/s,
  "room/combat-entry triggers should follow the same capture-clear lifecycle",
);

console.log("PASS trait/relic trigger focus presentation contract.");

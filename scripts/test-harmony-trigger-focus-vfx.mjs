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
const focusCss = await readFile(
  new URL("../games/harmony/trigger-focus-vfx.css", import.meta.url),
  "utf8",
);
const styles = await readFile(
  new URL("../games/harmony/styles.css", import.meta.url),
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
const frameUi = await readFile(
  new URL("../games/harmony/pc-frame-ui.js", import.meta.url),
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
  relics,
  /relic_dull_mortar_pestle:[\s\S]*?effect: "firstStrikeBonus"[\s\S]*?value: 2/s,
  "the real +2 first-strike relic should remain data-driven through the shared bonus source path",
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
  main,
  /findTriggerSourceElement[\s\S]*?element\.isConnected[\s\S]*?element\.getClientRects\(\)\.length > 0/s,
  "Trigger Focus should target only a currently visible source element",
);
assert.doesNotMatch(
  main,
  /findFallbackElement/,
  "Trigger Focus should skip safely when the source UI is absent",
);
assert.match(
  frameUi,
  /data-source-type="\$\{escapeHtml\(item\.kind\)\}" data-source-id="\$\{escapeHtml\(id\)\}"/,
  "PC acquired rows must preserve the same source identity used by Trigger Focus lookup",
);
assert.match(
  core,
  /sourceMetadata:\s*sourceMetadataFromFx\(fx\)/,
  "generic damage presentation metadata should retain augment source metadata",
);
assert.match(
  core,
  /cardAttackPower\([\s\S]*?sourceMetadata[\s\S]*?effectSourceMetadata/s,
  "numeric attack bonuses should retain their contributing trait/relic source metadata",
);
assert.match(
  core,
  /recordTriggerFocusFromFx\(s, fx,[\s\S]*?effectType:\s*"damage"/s,
  "damage resolution should bridge source metadata into the existing Trigger Focus queue",
);

assert.match(
  focus,
  /const MERGE_WINDOW_MS = 520/,
  "same-source focus should share one common debounce window",
);
assert.doesNotMatch(
  focus,
  /hmy-trigger-focus-dim|dimOpacity|needsFullFocus/,
  "Trigger Focus should not create or manage a screen dim overlay",
);
assert.match(
  focus,
  /const sourceElement = findSourceElement\?\.\(event\) \|\| null;[\s\S]*?if \(!sourceElement\) continue;/s,
  "missing source UI should skip presentation instead of focusing a fallback surface",
);
assert.match(
  focus,
  /sourceStates = new WeakMap\(\)[\s\S]*?if \(existing\)[\s\S]*?scheduleFade/s,
  "same-source retriggers should extend the active glow without restarting its source class",
);
assert.match(
  focus,
  /holdDuration: 480[\s\S]*?fadeDuration: 180[\s\S]*?holdDuration: 580[\s\S]*?fadeDuration: 200/s,
  "Trigger Focus should keep a compact 600-900ms glow window before fading",
);
assert.doesNotMatch(
  focus,
  /await wait|async function showTriggerFocusQueue/,
  "Trigger Focus presentation must not delay gameplay/result VFX",
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
assert.doesNotMatch(
  focusCss,
  /hmy-trigger-focus-dim/,
  "Trigger Focus CSS should contain no full-screen dim styling",
);
assert.match(
  focusCss,
  /var\(--tier-color, #82958c\)/,
  "source glow should consume the shared tier color rather than source-specific colors",
);
assert.match(
  focusCss,
  /hmy-trigger-focus-fading[\s\S]*?opacity: 0/s,
  "source glow should end through a soft residual fade",
);
assert.match(
  focusCss,
  /inset: -2px;[\s\S]*?border: 1px solid[\s\S]*?0 0 8px 1px[\s\S]*?0 0 16px 2px/s,
  "Trigger Focus should use a thin edge glow with restrained blur and spread",
);
assert.match(
  focusCss,
  /hmy-trigger-focus-rise 150ms/,
  "Trigger Focus glow should rise quickly without flashing",
);
assert.match(
  focusCss,
  /prefers-reduced-motion: reduce[\s\S]*?--trigger-focus-scale: 1[\s\S]*?hmy-trigger-focus-link[\s\S]*?display: none/s,
  "reduced motion should remove scale/link motion while keeping the source glow state",
);
assert.match(
  styles,
  /--rarity-common:#82958c;[\s\S]*?--rarity-rare:#329be8;[\s\S]*?--rarity-epic:#a563e2;[\s\S]*?--rarity-legendary:#e8b72f;/s,
  "rarity colors should be shared tokens rather than duplicated Trigger Focus mappings",
);
assert.match(
  styles,
  /\.tier-mark-0[\s\S]*?--tier-color: var\(--rarity-common\)[\s\S]*?\.tier-mark-3[\s\S]*?--tier-color: var\(--rarity-legendary\)/s,
  "trait/relic source rows should expose the same tier color contract used by cards",
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

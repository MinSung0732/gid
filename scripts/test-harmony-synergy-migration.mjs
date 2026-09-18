import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";
import { ITEMS } from "../games/harmony/data.js";
import { HIDDEN_SYNERGIES } from "../games/harmony/synergies.js";
import { LEGACY_SYNERGY_COMPONENT_IDS } from "../games/harmony/synergy-components.js";
import { normalizeGamePayload } from "../games/harmony/persistence.js";

const CANONICAL = {
  novice_pestle: ["stat_pure_extract_drop", "stat_flint_pestle_head"],
  morning_chamomile: ["stat_aloe_soothing_salve", "stat_gentle_chamomile_infusion"],
  hardened_wax_seal: ["stat_hardened_resin_shell", "trait_hardened_wax_bulwark"],
  dew_petals: ["stat_primordial_dew_chalice", "trait_overlapping_petals"],
  brass_scales_funnel: ["stat_merchants_brass_scale", "relic_glass_funnel_tip"],
  diamond_bastion: ["trait_hardened_crust", "relic_aegis_of_the_eternal_wax", "trait_reactive_thorn_burst"],
  sealed_impact: ["trait_unyielding_wax_monolith", "relic_perpetual_alembic_coil"],
  grand_trinity: ["relic_spacious_scent_pouch", "stat_scent_pyramid_apex", "relic_philosophers_mercury_still"],
  supercritical_void: ["trait_saturated_spillover", "relic_supercritical_storage_ampoule", "trait_saturated_resonance"],
  pressurized_airflow: ["stat_micro_nozzle", "relic_scented_candle_wick", "trait_friction_spark"],
};

const LEGACY_BY_SET = {
  novice_pestle: ["gather_attack_0", "gather_contactBonus_0"],
  morning_chamomile: ["gather_healBonus_0", "gather_regen_0"],
  hardened_wax_seal: ["gather_maxHp_0", "golden_carry_0"],
  dew_petals: ["gather_regen_2", "gather_oilShield_0"],
  brass_scales_funnel: ["gather_goldBonus_0", "golden_absorb_0"],
  diamond_bastion: ["golden_shieldCounter_0", "boss_bastionCore_0", "boss_thornsRetain_0"],
  sealed_impact: ["golden_carry_2", "boss_shieldHit_0"],
  grand_trinity: ["golden_draw_0", "boss_harmony_0", "boss_apRegen_0"],
  supercritical_void: ["golden_absorbExplode_0", "boss_blackHoleAroma_0", "boss_criticalDistill_0"],
  pressurized_airflow: ["gather_defense_0", "gather_pressureValve_0"],
};

assert.deepEqual(
  Object.fromEntries(Object.entries(HIDDEN_SYNERGIES).map(([id, synergy]) => [id, synergy.requires])),
  CANONICAL,
  "all synergy requires should use the approved canonical augment IDs",
);

for (const [id, requires] of Object.entries(CANONICAL)) {
  const complete = E.newRun(9000);
  complete.inventory = [...requires];
  assert.equal(E.hasSynergy(complete, id), true, id + " should activate with canonical requires");

  const incomplete = E.newRun(9001);
  incomplete.inventory = requires.slice(0, -1);
  assert.equal(E.hasSynergy(incomplete, id), false, id + " should stay inactive when one canonical component is missing");

  const legacyOnly = E.newRun(9002);
  legacyOnly.inventory = [...LEGACY_BY_SET[id]];
  assert.equal(E.hasSynergy(legacyOnly, id), false, id + " should ignore legacy synergyComponent IDs");
}

const progress3 = E.newRun(9010);
const threeIds = CANONICAL.grand_trinity;
for (let count = 0; count <= threeIds.length; count++) {
  progress3.inventory = threeIds.slice(0, count);
  const progress = E.synergyProgress(progress3, "grand_trinity");
  assert.equal(progress.ownedCount, count);
  assert.equal(progress.total, 3);
  assert.equal(progress.active, count === 3);
}

const progress2 = E.newRun(9011);
const twoIds = CANONICAL.novice_pestle;
for (let count = 0; count <= twoIds.length; count++) {
  progress2.inventory = twoIds.slice(0, count);
  const progress = E.synergyProgress(progress2, "novice_pestle");
  assert.equal(progress.ownedCount, count);
  assert.equal(progress.total, 2);
  assert.equal(progress.active, count === 2);
}

assert.equal(LEGACY_SYNERGY_COMPONENT_IDS.length, 23);
for (const id of LEGACY_SYNERGY_COMPONENT_IDS) {
  assert.ok(ITEMS[id], "legacy item should stay registered: " + id);
  assert.equal(Object.keys(ITEMS).includes(id), false, "legacy item must be non-enumerable: " + id);
  assert.equal(ITEMS[id].legacy, true);
  assert.equal(ITEMS[id].hidden, true);
  assert.equal(ITEMS[id].synergyComponent, true);
  const fresh = E.newRun(9020);
  assert.equal(E.addInventoryItem(fresh, id, E.freshMeta()), false, "new run acquired hidden legacy item " + id);
}

const legacyIds = new Set(LEGACY_SYNERGY_COMPONENT_IDS);
for (let seed = 1; seed <= 240; seed++) {
  const run = E.newRun(seed), meta = E.freshMeta();
  for (const room of ["gather", "golden", "boss"]) {
    const id = E.rollLoot(run, room, meta);
    assert.equal(legacyIds.has(id), false, "random loot included legacy item " + String(id));
  }
  run.phase = "shop";
  for (const offer of E.rollShopOffers(run, meta))
    if (offer.type === "augment")
      assert.equal(legacyIds.has(offer.id), false, "shop included legacy item " + offer.id);
}

const cleanCodex = E.codexProgress(E.freshMeta());
const legacyDiscoveredMeta = E.freshMeta();
legacyDiscoveredMeta.discovered = [...LEGACY_SYNERGY_COMPONENT_IDS];
assert.equal(
  E.codexProgress(legacyDiscoveredMeta).found,
  cleanCodex.found,
  "legacy discoveries should not count toward normal Codex progress",
);
const codexSource = await readFile(new URL("../games/harmony/codex-ui.js", import.meta.url), "utf8");
assert.ok((codexSource.match(/!item\.hidden/g) || []).length >= 4, "Codex item tabs and progress should filter hidden legacy items");

const legacySave = E.newRun(9030);
legacySave.inventory = [LEGACY_SYNERGY_COMPONENT_IDS[0]];
const normalized = normalizeGamePayload({ meta: E.freshMeta(), run: legacySave });
assert.ok(normalized?.run, "old save payload with legacy synergy item should still load");
assert.deepEqual(normalized.run.inventory, [LEGACY_SYNERGY_COMPONENT_IDS[0]], "old save should retain its legacy item ID");

const brass = E.newRun(9040);
brass.inventory = [...CANONICAL.brass_scales_funnel];
brass.gold = 0;
brass.battle = { absorb: 100 };
assert.equal(E.synergyPower(brass, "goldGainMultiplier"), 0.2, "normal brass gold bonus should remain active");
assert.equal(E.applyBrassAbsorbConversion(brass), 30, "absorb conversion should cap at 30G");
assert.equal(brass.gold, 30, "conversion gold must not amplify itself to 36G");
brass.gold = 0;
brass.battle.absorb = 59;
assert.equal(E.applyBrassAbsorbConversion(brass), 29, "conversion should floor absorb / 2");

function combat(seed, inventory = []) {
  const run = E.newRun(seed), meta = E.freshMeta();
  run.inventory = [...inventory];
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemies.slice(1).forEach((enemy) => (enemy.hp = 0));
  const enemy = run.battle.enemies[0];
  enemy.hp = 1000;
  enemy.maxHp = 1000;
  enemy.shield = 0;
  enemy.statuses = {};
  run.battle.selectedTarget = 0;
  E.attachEnemyAliases(run.battle);
  return { run, enemy };
}

const pressurizedItems = CANONICAL.pressurized_airflow;
const baselineBurning = combat(9049);
E.addStatus(baselineBurning.run, "enemy", "burning", 2);
const baselineHit = E.dealEnemyDamage(baselineBurning.run, baselineBurning.enemy, 20, {
  attackPattern: "nonContact",
  fx: { source: "card" },
});
const baselineBurnProc = baselineBurning.run._statusProcFeedback?.find((event) => event.statusId === "burning");
assert.equal(baselineHit.damage, 20);

const nonContactBurning = combat(9050, pressurizedItems);
E.addStatus(nonContactBurning.run, "enemy", "burning", 2);
const boosted = E.dealEnemyDamage(nonContactBurning.run, nonContactBurning.enemy, 20, {
  attackPattern: "nonContact",
  fx: { source: "card" },
});
const boostedBurnProc = nonContactBurning.run._statusProcFeedback?.find((event) => event.statusId === "burning");
assert.equal(boosted.damage, 25, "burning target should take +25% direct non-contact card damage");
assert.equal(
  boostedBurnProc?.amount,
  baselineBurnProc?.amount,
  "pressurized airflow must not increase the Burning proc/DOT amount itself",
);

const nonContactClean = combat(9051, pressurizedItems);
assert.equal(
  E.dealEnemyDamage(nonContactClean.run, nonContactClean.enemy, 20, {
    attackPattern: "nonContact",
    fx: { source: "card" },
  }).damage,
  20,
  "non-contact card damage should not be boosted without pre-existing burning",
);

const contactBurning = combat(9052, pressurizedItems);
E.addStatus(contactBurning.run, "enemy", "burning", 2);
assert.equal(
  E.dealEnemyDamage(contactBurning.run, contactBurning.enemy, 20, {
    attackPattern: "contact",
    fx: { source: "card" },
  }).damage,
  20,
  "contact card damage should not receive the pressurized bonus",
);

const nonCardNonContact = combat(9053, pressurizedItems);
E.addStatus(nonCardNonContact.run, "enemy", "burning", 2);
assert.equal(
  E.dealEnemyDamage(nonCardNonContact.run, nonCardNonContact.enemy, 20, {
    attackPattern: "nonContact",
  }).damage,
  20,
  "non-card non-contact direct damage should not receive the card-specific pressurized bonus",
);

const burnDot = combat(9054, pressurizedItems);
assert.equal(
  E.dealEnemyDamage(burnDot.run, burnDot.enemy, 12, {
    direct: false,
    bypassShield: true,
    statusId: "burning",
  }).damage,
  12,
  "burning status damage itself must not receive the pressurized bonus",
);

const pcSource = await readFile(new URL("../games/harmony/pc-frame-ui.js", import.meta.url), "utf8");
const mobileSource = await readFile(new URL("../games/harmony/mobile-battle-ui.js", import.meta.url), "utf8");
assert.match(pcSource, /synergy-progress/, "PC synergy rows should display progress");
assert.match(mobileSource, /mobile-synergy-progress/, "mobile synergy rows should display progress");
assert.match(pcSource, /synergyProgress/, "PC UI should use shared synergy progress state");
assert.match(mobileSource, /profile\.synergyProgress/, "mobile UI should use shared synergy progress state");

console.log("PASS Harmony canonical synergy migration: requires, legacy isolation, progress UI, brass conversion, pressurized damage, and old-save compatibility.");

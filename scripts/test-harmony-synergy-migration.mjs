import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";
import { ITEMS, TEST_ITEMS } from "../games/harmony/data.js";
import { HIDDEN_SYNERGIES } from "../games/harmony/synergies.js";
import { SYNERGY_COMPONENT_ITEMS } from "../games/harmony/synergy-components.js";
import { normalizeGamePayload } from "../games/harmony/persistence.js";

const EXPECTED = Object.freeze({
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
});
const legacyIds = Object.keys(SYNERGY_COMPONENT_ITEMS);
const legacySet = new Set(legacyIds);

for (const [id, requires] of Object.entries(EXPECTED)) {
  assert.deepEqual(HIDDEN_SYNERGIES[id].requires, requires, `${id} canonical requires`);
  assert.ok(requires.every((itemId) => ITEMS[itemId]), `${id} canonical items exist`);
  assert.ok(E.activeSynergies({ inventory: [...requires] }).some((synergy) => synergy.id === id), `${id} activates from canonical IDs`);
  assert.ok(!E.activeSynergies({ inventory: requires.slice(0, -1) }).some((synergy) => synergy.id === id), `${id} requires every canonical item`);
}
assert.equal(E.activeSynergies({ inventory: legacyIds }).length, 0, "legacy synergyComponent inventory must not activate canonical sets");

for (const id of legacyIds) {
  assert.ok(ITEMS[id], `${id} remains directly loadable for save compatibility`);
  assert.equal(ITEMS[id].legacy, true);
  assert.equal(ITEMS[id].hidden, true);
  assert.equal(Object.prototype.propertyIsEnumerable.call(ITEMS, id), false, `${id} is hidden from enumerable game pools`);
  assert.equal(TEST_ITEMS[id], undefined, `${id} is excluded from new-run test/random pools`);
}
assert.ok(Object.values(ITEMS).every((item) => !legacySet.has(item.id)), "legacy components are absent from ordinary item enumeration");

for (let seed = 1; seed <= 150; seed++) {
  const run = E.newRun(seed), meta = E.freshMeta();
  for (const room of ["gather", "golden"]) {
    const rolled = E.rollLoot(run, room, meta);
    assert.ok(!legacySet.has(rolled), `legacy item must not roll from ${room}`);
  }
  for (const offer of E.rollShopOffers(run, meta))
    assert.ok(!legacySet.has(offer.id), "legacy item must not appear in shop stock");
}

for (const [id, requires] of [
  ["pressurized_airflow", EXPECTED.pressurized_airflow],
  ["novice_pestle", EXPECTED.novice_pestle],
]) {
  for (let count = 0; count <= requires.length; count++) {
    const progress = E.synergyProgress({ inventory: requires.slice(0, count) }, id);
    assert.equal(progress.owned, count, `${id} owned count ${count}`);
    assert.equal(progress.total, requires.length);
    assert.equal(progress.complete, count === requires.length);
  }
}

function combat(seed, cardId, inventory, room = "battle") {
  const run = E.newRun(seed), meta = E.freshMeta();
  run.inventory = [...inventory];
  run.route[0] = room;
  E.enter(run, meta);
  run.battle.enemies = [run.battle.enemies[0]];
  E.attachEnemyAliases(run.battle);
  const enemy = run.battle.enemies[0];
  Object.assign(enemy, {
    hp: 1000,
    maxHp: 1000,
    shield: 0,
    statuses: {},
    isBoss: room === "boss",
    intent: { type: "guard", value: 0 },
  });
  run.battle.selectedTarget = 0;
  run.battle.ap = 20;
  run.battle.hand = [{ id: cardId, level: 0 }];
  delete run._enemyHitFeedback;
  delete run._statusProcFeedback;
  return { run, meta, enemy };
}
function play(ctx) {
  assert.equal(E.play(ctx.run, 0, ctx.meta), true);
}

{
  const fullIds = EXPECTED.pressurized_airflow;
  const missingNeutral = fullIds.filter((id) => id !== "relic_scented_candle_wick");
  const boosted = combat(7001, "noncontact_fine_mist_spray", fullIds);
  const baseline = combat(7002, "noncontact_fine_mist_spray", missingNeutral);
  boosted.enemy.statuses = { burning: { stacks: 1 } };
  baseline.enemy.statuses = { burning: { stacks: 1 } };
  play(boosted);
  play(baseline);
  assert.equal(boosted.run._enemyHitFeedback[0].damage, Math.round(baseline.run._enemyHitFeedback[0].damage * 1.25), "burning target takes +25% non-contact direct damage");
  assert.equal(boosted.run._statusProcFeedback[0].amount, baseline.run._statusProcFeedback[0].amount, "burning proc damage itself is unchanged");

  const cleanBoosted = combat(7003, "noncontact_fine_mist_spray", fullIds);
  const cleanBaseline = combat(7004, "noncontact_fine_mist_spray", missingNeutral);
  play(cleanBoosted);
  play(cleanBaseline);
  assert.equal(cleanBoosted.run._enemyHitFeedback[0].damage, cleanBaseline.run._enemyHitFeedback[0].damage, "non-burning target gets no +25% bonus");

  const contactBoosted = combat(7005, "contact_glass_dropper_strike", fullIds);
  const contactBaseline = combat(7006, "contact_glass_dropper_strike", missingNeutral);
  contactBoosted.enemy.statuses = { burning: { stacks: 1 } };
  contactBaseline.enemy.statuses = { burning: { stacks: 1 } };
  play(contactBoosted);
  play(contactBaseline);
  assert.equal(contactBoosted.run._enemyHitFeedback[0].damage, contactBaseline.run._enemyHitFeedback[0].damage, "contact direct damage is not boosted");
}

{
  const convertedBoss = combat(7101, "contact_glass_dropper_strike", EXPECTED.brass_scales_funnel, "boss");
  const controlBoss = combat(7101, "contact_glass_dropper_strike", EXPECTED.brass_scales_funnel, "boss");
  convertedBoss.run.gold = controlBoss.run.gold = 0;
  convertedBoss.enemy.hp = convertedBoss.enemy.maxHp = 1;
  controlBoss.enemy.hp = controlBoss.enemy.maxHp = 1;
  convertedBoss.run.battle.absorb = 100;
  controlBoss.run.battle.absorb = 0;
  play(convertedBoss);
  play(controlBoss);
  assert.equal(convertedBoss.run.gold - controlBoss.run.gold, 30, "brass conversion adds exactly 30G at the cap without its own +20% multiplier");
  assert.ok(convertedBoss.run.log.some((line) => line.includes("30골드로 환전")));

  const full = combat(7102, "contact_glass_dropper_strike", EXPECTED.brass_scales_funnel);
  const incomplete = combat(7102, "contact_glass_dropper_strike", ["stat_merchants_brass_scale"]);
  full.run.gold = incomplete.run.gold = 0;
  full.run.battle.absorb = incomplete.run.battle.absorb = 0;
  full.enemy.hp = full.enemy.maxHp = 1;
  incomplete.enemy.hp = incomplete.enemy.maxHp = 1;
  play(full);
  play(incomplete);
  assert.equal(full.run.gold, Math.floor(incomplete.run.gold * 1.2), "ordinary battle gold still receives the set's +20% gain bonus");
}

{
  const run = E.newRun(7201), meta = E.freshMeta(), legacyId = legacyIds[0];
  run.inventory = [legacyId];
  const normalized = normalizeGamePayload({ meta, run });
  assert.ok(normalized, "legacy save payload remains loadable");
  assert.deepEqual(normalized.run.inventory, [legacyId], "legacy inventory ID is preserved on load");
}

const pc = await readFile(new URL("../games/harmony/pc-frame-ui.js", import.meta.url), "utf8");
const mobile = await readFile(new URL("../games/harmony/mobile-battle-ui.js", import.meta.url), "utf8");
assert.match(pc, /synergyProgresses\(run\)/);
assert.match(pc, /SET PROGRESS/);
assert.match(pc, /\$\{owned\} \/ \$\{total\}/);
assert.match(mobile, /SET PROGRESS/);
assert.match(mobile, /\$\{owned\} \/ \$\{total\}/);

console.log("PASS Harmony canonical synergy migration, legacy isolation, gold conversion, pressurized airflow, progress UI, and save compatibility.");

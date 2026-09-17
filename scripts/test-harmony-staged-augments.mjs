import assert from "node:assert/strict";
import { CARDS, ITEMS } from "../games/harmony/data.js";
import "../games/harmony/engine.js";

const stagedCardIds = [
  "contact_scentline_rewind",
  "noncontact_compound_vapor_recovery",
  "guard_wax_recoil_coating",
  "guard_discard_solvent_recovery",
  "heal_regenerative_inhalation",
  "guard_triad_note_stopper",
  "noncontact_supersaturated_tray_spray",
  "contact_bloodflow_rhythm_pierce",
  "noncontact_compound_toxic_reignition",
  "absorb_supercritical_chain_catalyst",
  "guard_resonance_cover",
  "heal_resonance_suture",
  "absorb_resonance_condensation",
  "contact_resonance_piercing_needle",
  "noncontact_branching_resonance_wave",
  "noncontact_resonance_chain_collapse",
];

const stagedItemIds = [
  "trait_resonance_ignition_coil",
  "trait_resonance_buffer_field",
  "trait_inverse_phase_amplifier",
  "trait_critical_discharge_meter",
  "relic_resonance_capture_flask",
  "relic_permanent_resonance_core",
];

assert.equal(stagedCardIds.length, 16);
assert.equal(stagedItemIds.length, 6);

for (const id of stagedCardIds) {
  assert.ok(CARDS[id], `missing staged card: ${id}`);
  assert.equal(CARDS[id].id, id, `staged card id must be normalized: ${id}`);
  assert.ok(CARDS[id].tier >= 1 && CARDS[id].tier <= 4, `invalid tier: ${id}`);
  assert.ok(CARDS[id].maxCopies >= 1, `invalid maxCopies: ${id}`);
}

for (const id of stagedItemIds) {
  assert.ok(ITEMS[id], `missing staged item: ${id}`);
  assert.equal(ITEMS[id].id, id, `staged item id mismatch: ${id}`);
  assert.ok(["trait", "relic"].includes(ITEMS[id].kind), `invalid kind: ${id}`);
}

assert.equal(CARDS.guard_discard_solvent_recovery.maxCopies, 3);
assert.equal(CARDS.heal_regenerative_inhalation.maxCopies, 3);
assert.equal(CARDS.guard_triad_note_stopper.maxCopies, 3);
assert.equal(CARDS.noncontact_supersaturated_tray_spray.maxCopies, 3);
assert.equal(CARDS.absorb_resonance_condensation.maxCopies, 3);
assert.equal(CARDS.contact_resonance_piercing_needle.maxCopies, 3);

assert.equal(ITEMS.trait_resonance_ignition_coil.maxOwned, 2);
assert.equal(ITEMS.trait_resonance_buffer_field.maxOwned, 2);
assert.equal(ITEMS.trait_inverse_phase_amplifier.maxOwned, 2);
assert.equal(ITEMS.trait_critical_discharge_meter.maxOwned, 1);
assert.equal(ITEMS.relic_resonance_capture_flask.maxOwned, 1);
assert.equal(ITEMS.relic_permanent_resonance_core.maxOwned, 1);

console.log("Harmony staged augments registry: OK (16 active cards + 6 traits/relics)");

from pathlib import Path

path = Path("scripts/test-harmony.mjs")
source = path.read_text()
old = '''  const expectedCopies = card.id === "heal_aloe_salve" || card.id === "heal_chamomile_infusion"
    ? 3
    : { 1: 4, 2: 2, 3: 2, 4: 1 }[card.tier];
'''
new = '''  const stagedThreeCopyTier2Cards = new Set([
    "guard_discard_solvent_recovery",
    "heal_regenerative_inhalation",
    "guard_triad_note_stopper",
    "noncontact_supersaturated_tray_spray",
    "absorb_resonance_condensation",
    "contact_resonance_piercing_needle",
  ]);
  const expectedCopies =
    card.id === "heal_aloe_salve" ||
    card.id === "heal_chamomile_infusion" ||
    stagedThreeCopyTier2Cards.has(card.id)
      ? 3
      : { 1: 4, 2: 2, 3: 2, 4: 1 }[card.tier];
'''
assert source.count(old) == 1, "test-harmony maxCopies contract changed"
path.write_text(source.replace(old, new, 1))

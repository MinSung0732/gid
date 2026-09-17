from pathlib import Path

path = Path("scripts/test-harmony-staged-augments.mjs")
source = path.read_text()
source = source.replace(
    'E.newRun(seed, Array(10).fill("contact_scentline_rewind"), meta)',
    'E.newRun(seed, Array(10).fill("contact_glass_dropper_strike"), meta)',
    1,
)
source = source.replace(
    'state.battle.hand = [{ id: "contact_scentline_rewind", level: 0 }];',
    'state.battle.hand = [{ id: "contact_glass_dropper_strike", level: 0 }];',
    1,
)
path.write_text(source)

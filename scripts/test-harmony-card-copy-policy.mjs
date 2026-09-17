import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { CARDS } from "../games/harmony/data.js";
import { STATUS_DEFINITIONS } from "../games/harmony/statuses.js";
import { createCardPresentation } from "../games/harmony/card-presentation.js";

const P = createCardPresentation({
  engine: E,
  cards: CARDS,
  statusDefinitions: STATUS_DEFINITIONS,
  getRun: () => null,
  getStarted: () => false,
  tierStars: (tier) => "★".repeat(tier),
});

function summary(id, level = 0) {
  return P.compactCardEffectSummary({ id, level });
}

function texts(id, level = 0) {
  return summary(id, level).rows.map((entry) => entry.text || entry.result);
}

{
  assert.deepEqual(texts("contact_obsidian_breaker"), ["피해 16", "AP 환급", "드로우"]);
}

{
  const rows = texts("noncontact_perpetual_storm");
  assert.deepEqual(rows, ["피해 5 ×8", "약화", "도탄", "연타 보너스"]);
  assert.ok(!rows.some((text) => /약화\s*[+]?\d/.test(text)), "status summaries keep the name only");
}

{
  assert.deepEqual(texts("burst_spatial_diffusion"), ["피해", "기절", "광역"]);
}

{
  assert.deepEqual(texts("contact_pure_absorb_overload"), ["피해 34"]);
}

{
  assert.deepEqual(texts("noncontact_absolute_zero_cryo"), ["피해 35", "기절", "무장 해제", "피해 보너스"]);
}

{
  assert.deepEqual(texts("guard_triad_note_stopper"), ["방어막 3", "HARMONY 보너스"]);
}

{
  assert.deepEqual(texts("noncontact_resonance_chain_collapse"), ["피해 20", "관통", "피해 보너스"]);
}

{
  assert.deepEqual(texts("guard_aroma_veil"), ["방어막 6", "약화"]);
}

{
  assert.deepEqual(texts("guard_mist_veil"), ["방어막 7", "약화"]);
}

{
  assert.deepEqual(texts("noncontact_chilled_siphon"), ["피해 13", "드로우 1", "흡수"]);
}

{
  const detail = P.cardEffectText({ id: "noncontact_perpetual_storm", level: 0 }, true);
  assert.ok(detail.includes("15%"));
  assert.ok(detail.length > 0);
}

console.log("Harmony card copy policy tests passed");

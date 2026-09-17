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
  const rows = texts("contact_obsidian_breaker");
  assert.ok(rows.includes("피해 16"));
  assert.ok(rows.includes("방어막 파괴 → AP+2 · 드로우1"));
  assert.ok(rows.length <= 3);
}

{
  const rows = texts("noncontact_perpetual_storm");
  assert.ok(rows.some((text) => text.includes("피해 5 ×8") && text.includes("무작위")));
  assert.ok(rows.includes("이전 카드당 +1타 (최대12)"));
  assert.ok(rows.includes("적중 15% → 약화 +1"));
  assert.ok(!rows.includes("약화 +1"), "conditional status must never be shown as unconditional");
  assert.ok(rows.length <= 4);
}

{
  const rows = texts("burst_spatial_diffusion");
  assert.deepEqual(rows, [
    "흡수 전량 → 전체 ×3.2 피해",
    "적 행동 -1",
    "흡수 40+ → 전체 기절 +1",
  ]);
}

{
  const rows = texts("contact_pure_absorb_overload");
  assert.deepEqual(rows, ["흡수 20 → 피해 34"]);
}

{
  const rows = texts("noncontact_absolute_zero_cryo");
  assert.ok(rows.some((text) => text.includes("피해 35")));
  assert.ok(rows.some((text) => text.includes("방어막 100% 추가 피해")));
  assert.ok(rows.some((text) => text.includes("보스 저항") && text.includes("무장해제 2턴")));
  assert.ok(!rows.some((text) => text === "기절 +1"), "boss fallback control must retain its condition");
}

{
  const rows = texts("guard_triad_note_stopper");
  assert.ok(rows.includes("방어막 +3"));
  assert.ok(rows.includes("HARMONY 완료 → AP +1"));
}

{
  const rows = texts("noncontact_resonance_chain_collapse");
  assert.ok(rows.some((text) => text.includes("잔향 전량")));
  assert.ok(rows.some((text) => text.includes("관통") && text.includes("잔향 +2")));
  assert.ok(rows.length <= 4);
}

{
  const detail = P.cardEffectText({ id: "noncontact_resonance_chain_collapse", level: 0 }, true);
  assert.match(
    detail,
    /<span class="detail-status" style="--detail-status-color:#e8bc75">잔향<\/span>/,
    "resonance references in expanded detail must use the resonance status color",
  );
}

{
  const rows = texts("guard_aroma_veil");
  assert.ok(rows.includes("방어막 +6"));
  assert.ok(rows.includes("약화 +1"), "unconditional applyWeak must remain visible");
}

{
  const rows = texts("guard_mist_veil");
  assert.ok(rows.includes("전체 약화 +1"), "AOE status summaries must keep the target scope");
}

{
  const rows = texts("noncontact_chilled_siphon");
  assert.ok(rows.some((text) => text.includes("피해 13") && text.includes("드로우1")));
  assert.ok(rows.includes("가한 피해 50% → 흡수"));
}

{
  const detail = P.cardEffectText({ id: "noncontact_perpetual_storm", level: 0 }, true);
  assert.ok(detail.includes("15%"));
  assert.ok(detail.length > 0);
}

console.log("Harmony card copy policy tests passed");

// Project Harmony 신규 인큐베이터에서 확정된 액티브 카드 16종.
// UI 작업 브랜치와의 충돌을 줄이기 위해 기존 티어별 파일과 분리합니다.

const card = (name, englishName, tier, maxCopies, maxUpgrade, cost, note, category, effects, upgrades, text) => ({
  name,
  englishName,
  tier,
  maxCopies,
  maxUpgrade,
  cost,
  note,
  category,
  ...effects,
  upgrades,
  text,
});

export const NEW_AUGMENT_CARDS = {
  // ---------------------------------------------------------------------------
  // AP 환급 신규 10종
  // ---------------------------------------------------------------------------
  contact_scentline_rewind: card(
    "향맥 되감기", "Scentline Rewind", 1, 4, 3, 1, "middle", "attack",
    { attack: 4, attackPattern: "contact", target: "selected", refundIfPaidContactBefore: 1, refundAp: 1 },
    { attack: [4, 5, 6, 7] },
    "피해 4 · 선행 유료 접촉 → AP +1",
  ),
  noncontact_compound_vapor_recovery: card(
    "복합 증기 회수", "Compound Vapor Recovery", 1, 4, 3, 1, "top", "attack",
    {
      attack: 4,
      attackPattern: "nonContact",
      target: "selected",
      refundIfDotTypeCount: 2,
      refundAp: 1,
      refundStatusIds: ["burning", "poison", "corrosion", "bleed"],
    },
    { attack: [4, 5, 7, 9] },
    "피해 4 · 상태 2종+ → AP +1",
  ),
  guard_wax_recoil_coating: card(
    "왁스 반동 코팅", "Wax Recoil Coating", 1, 4, 3, 1, "base", "defense",
    { shield: 4, target: "self", refundIfShieldBefore: 12, refundAp: 1 },
    { shield: [4, 5, 6, 7] },
    "방어막 +4 · 기존 방어막 12+ → AP +1",
  ),
  guard_discard_solvent_recovery: card(
    "폐기 용매 회수", "Waste Solvent Recovery", 2, 3, 2, 1, "base", "defense",
    {
      shield: 4,
      target: "self",
      discard: 1,
      discardRefundBaseCostAtLeast: 2,
      discardRefundAp: 1,
    },
    { shield: [4, 6, 8] },
    "방어막 +4 · 선택 버리기1 · 기본 AP 2+ 버림 → AP +1",
  ),
  heal_regenerative_inhalation: card(
    "재생 촉진 흡입", "Regenerative Inhalation", 2, 3, 2, 1, "middle", "heal",
    {
      heal: 4,
      target: "self",
      refundIfPlayerStatus: { id: "regeneration", stacks: 1 },
      refundAp: 1,
    },
    { heal: [4, 5, 7] },
    "회복 +4 · 재생 보유 → AP +1",
  ),
  guard_triad_note_stopper: card(
    "삼중 향조 마개", "Triad Note Stopper", 2, 3, 2, 1, "base", "defense",
    { shield: 3, target: "self", refundOnHarmony: 1 },
    { shield: [3, 5, 7] },
    "방어막 +3 · HARMONY 완성 → AP +1",
  ),
  noncontact_supersaturated_tray_spray: card(
    "과포화 트레이 분사", "Supersaturated Tray Spray", 2, 3, 2, 1, "middle", "attack",
    { attack: 6, attackPattern: "nonContact", target: "selected", refundIfHandSizeBefore: 6, refundAp: 1 },
    { attack: [6, 8, 11] },
    "피해 6 · 손패 6+ → AP +1",
  ),
  contact_bloodflow_rhythm_pierce: card(
    "혈류 리듬 천공", "Bloodflow Rhythm Pierce", 3, 2, 2, 2, "middle", "attack",
    {
      attack: 5,
      hits: 3,
      attackPattern: "contact",
      target: "selected",
      refundIfTargetStatus: { id: "bleed", stacks: 4 },
      refundAp: 1,
    },
    { attack: [5, 6, 7] },
    "피해 5 ×3 · 출혈 4+ → AP +1",
  ),
  noncontact_compound_toxic_reignition: card(
    "복합 향독 재점화", "Compound Toxic Reignition", 3, 2, 2, 2, "base", "attack",
    {
      attack: 12,
      attackPattern: "nonContact",
      target: "selected",
      refundIfDotTypeCount: 3,
      refundAp: 2,
      refundStatusIds: ["burning", "poison", "corrosion", "bleed"],
    },
    { attack: [12, 15, 19] },
    "피해 12 · 상태 3종+ → AP +2",
  ),
  absorb_supercritical_chain_catalyst: card(
    "초임계 연쇄 촉매", "Supercritical Chain Catalyst", 4, 1, 1, 1, "middle", "absorb",
    {
      absorb: 6,
      target: "self",
      comboRefundCardIndexMin: 5,
      comboRefundAp: 2,
      comboDraw: 1,
      comboRefundOncePerTurn: true,
    },
    { absorb: [6, 10] },
    "흡수 +6 · 5번째+ 카드 → AP +2 · 드로우1 (턴당 1회)",
  ),

  // ---------------------------------------------------------------------------
  // 잔향 신규 액티브 6종
  // ---------------------------------------------------------------------------
  guard_resonance_cover: card(
    "공명 엄폐막", "Resonance Cover", 1, 4, 3, 1, "base", "defense",
    {
      shield: 6,
      target: "self",
      resonanceCoverThreshold: 3,
      resonanceBonusShield: 3,
    },
    {
      shield: [6, 7, 8, 10],
      resonanceBonusShield: [3, 3, 4, 4],
    },
    "방어막 +6 · 잔향 3+ 적 존재 → 추가 방어막 +3",
  ),
  heal_resonance_suture: card(
    "잔향 봉합액", "Resonance Suture", 1, 4, 3, 1, "middle", "heal",
    {
      heal: 4,
      target: "self",
      consumeHighestResonance: 2,
      requireFullResonanceConsume: true,
      resonanceBonusHeal: 4,
    },
    {
      heal: [4, 5, 6, 7],
      resonanceBonusHeal: [4, 4, 5, 6],
    },
    "회복 +4 · 최고 잔향 적에게 2 소비 → 추가 회복 +4",
  ),
  absorb_resonance_condensation: card(
    "회향 응축", "Resonance Condensation", 2, 3, 2, 1, "middle", "absorb",
    {
      absorb: 6,
      target: "selected",
      consumeTargetResonanceMax: 4,
      resonanceAbsorbPerStack: 2,
    },
    {
      absorb: [6, 8, 8],
      resonanceAbsorbPerStack: [2, 2, 3],
    },
    "흡수 +6 · 잔향 최대4 소비 · 1당 흡수 +2",
  ),
  contact_resonance_piercing_needle: card(
    "공명 침투침", "Resonance Piercing Needle", 2, 3, 2, 1, "top", "attack",
    {
      attack: 8,
      attackPattern: "contact",
      target: "selected",
      resonanceDamagePerStack: 1,
      resonanceDamageCap: 8,
    },
    {
      attack: [8, 10, 12],
      resonanceDamageCap: [8, 9, 10],
    },
    "피해 8 · 잔향 1당 +1 (최대 +8) · 미소비",
  ),
  noncontact_branching_resonance_wave: card(
    "분기 공명파", "Branching Resonance Wave", 3, 2, 2, 2, "top", "attack",
    {
      attack: 12,
      attackPattern: "nonContact",
      target: "all",
      applyEnemy: { resonance: 1 },
    },
    { attack: [12, 15, 18] },
    "전체 피해 12 · 잔향 +1",
  ),
  noncontact_resonance_chain_collapse: card(
    "공명 연쇄붕괴", "Resonance Chain Collapse", 4, 1, 1, 2, "base", "attack",
    {
      attack: 20,
      attackPattern: "nonContact",
      target: "selected",
      consumeAllTargetResonance: true,
      resonanceCalcCap: 10,
      resonanceDamagePerStack: 4,
      splashBypassPerStack: 2,
      splashResonance: 2,
    },
    {
      attack: [20, 26],
      resonanceDamagePerStack: [4, 5],
    },
    "잔향 전량 소비 · 최대10 계산 · 주대상 1당 +4 · 다른 적 1당 관통2/잔향+2",
  ),
};

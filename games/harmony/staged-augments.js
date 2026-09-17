// Staged Project Harmony augments.
// Kept in one isolated module so the feature branch can be merged after the UI work
// with minimal conflicts in the existing card/item definition files.

const active = (name, tier, maxCopies, maxUpgrade, cost, note, category, effects, upgrades = null) => ({
  name,
  tier,
  maxCopies,
  maxUpgrade,
  cost,
  note,
  category,
  ...effects,
  ...(upgrades ? { upgrades } : {}),
});

export const STAGED_AUGMENT_CARDS = {
  contact_scentline_rewind: active("향맥 되감기", 1, 4, 3, 1, "middle", "attack", {
    attack: 4,
    attackPattern: "contact",
    stagedRefund: "paidContactBefore",
    text: "피해 4 · 이번 턴 먼저 AP를 지불한 접촉 공격이 있었다면 AP +1",
  }, { attack: [4, 5, 6, 7] }),

  noncontact_compound_vapor_recovery: active("복합 증기 회수", 1, 4, 3, 1, "top", "attack", {
    attack: 4,
    attackPattern: "nonContact",
    stagedRefund: "ailmentTypes2",
    text: "피해 4 · 대상의 연소·중독·부식·출혈 중 2종 이상이면 AP +1",
  }, { attack: [4, 5, 7, 9] }),

  guard_wax_recoil_coating: active("왁스 반동 코팅", 1, 4, 3, 1, "base", "defense", {
    shield: 4,
    target: "self",
    stagedRefund: "shield12Before",
    text: "방어막 4 · 사용 전 방어막 12 이상이면 AP +1",
  }, { shield: [4, 5, 6, 7] }),

  guard_discard_solvent_recovery: active("폐기 용매 회수", 2, 3, 2, 1, "base", "defense", {
    shield: 4,
    target: "self",
    discard: 1,
    stagedDiscardRefundBaseCost: 2,
    text: "방어막 4 · 카드 1장 버리기 · 기본 AP 2 이상 카드를 버리면 AP +1",
  }, { shield: [4, 6, 8] }),

  heal_regenerative_inhalation: active("재생 촉진 흡입", 2, 3, 2, 1, "middle", "heal", {
    heal: 4,
    target: "self",
    stagedRefund: "regenerationBefore",
    text: "회복 4 · 사용 전 재생이 있으면 AP +1",
  }, { heal: [4, 5, 7] }),

  guard_triad_note_stopper: active("삼중 향조 마개", 2, 3, 2, 1, "base", "defense", {
    shield: 3,
    target: "self",
    stagedRefund: "harmonyCompletedByCard",
    text: "방어막 3 · 이 카드로 HARMONY!를 완성하면 AP +1",
  }, { shield: [3, 5, 7] }),

  noncontact_supersaturated_tray_spray: active("과포화 트레이 분사", 2, 3, 2, 1, "middle", "attack", {
    attack: 6,
    attackPattern: "nonContact",
    stagedRefund: "hand6Before",
    text: "피해 6 · 사용 전 손패가 이 카드를 포함해 6장 이상이면 AP +1",
  }, { attack: [6, 8, 11] }),

  contact_bloodflow_rhythm_pierce: active("혈류 리듬 천공", 3, 2, 2, 2, "middle", "attack", {
    attack: 5,
    hits: 3,
    attackPattern: "contact",
    stagedRefund: "targetBleed4Before",
    text: "피해 5 × 3 · 공격 전 대상 출혈 4 이상이면 AP +1",
  }, { attack: [5, 6, 7] }),

  noncontact_compound_toxic_reignition: active("복합 향독 재점화", 3, 2, 2, 2, "base", "attack", {
    attack: 12,
    attackPattern: "nonContact",
    stagedRefund: "ailmentTypes3",
    text: "피해 12 · 대상의 연소·중독·부식·출혈 중 3종 이상이면 AP +2",
  }, { attack: [12, 15, 19] }),

  absorb_supercritical_chain_catalyst: active("초임계 연쇄 촉매", 4, 1, 1, 1, "middle", "absorb", {
    absorb: 6,
    target: "self",
    stagedRefund: "fifthCardOnce",
    text: "흡수 6 · 이번 턴 5번째 이후 카드라면 1회 AP +2 · 카드 +1",
  }, { absorb: [6, 10] }),

  guard_resonance_cover: active("공명 엄폐막", 1, 4, 3, 1, "base", "defense", {
    shield: 6,
    target: "self",
    resonanceCoverBonus: 3,
    text: "방어막 6 · 살아있는 적 중 잔향 3 이상이 있으면 방어막 +3",
  }, {
    shield: [6, 7, 8, 10],
    resonanceCoverBonus: [3, 3, 4, 4],
  }),

  heal_resonance_suture: active("잔향 봉합액", 1, 4, 3, 1, "middle", "heal", {
    heal: 4,
    target: "self",
    resonanceSutureConsume: 2,
    resonanceSutureBonus: 4,
    text: "회복 4 · 가장 높은 잔향이 2 이상이면 잔향 2 소비 · 회복 +4",
  }, {
    heal: [4, 5, 6, 7],
    resonanceSutureBonus: [4, 4, 5, 6],
  }),

  absorb_resonance_condensation: active("회향 응축", 2, 3, 2, 1, "middle", "absorb", {
    absorb: 6,
    target: "enemy",
    resonanceConsumeMax: 4,
    resonanceAbsorbPerStack: 2,
    text: "흡수 6 · 대상 잔향 최대 4 소비 · 소비 1당 흡수 +2",
  }, {
    absorb: [6, 8, 8],
    resonanceAbsorbPerStack: [2, 2, 3],
  }),

  contact_resonance_piercing_needle: active("공명 침투침", 2, 3, 2, 1, "top", "attack", {
    attack: 8,
    attackPattern: "contact",
    resonanceDamagePerStack: 1,
    resonanceDamageCap: 8,
    text: "피해 8 · 대상 잔향 1당 피해 +1 (최대 +8) · 잔향 유지",
  }, {
    attack: [8, 10, 12],
    resonanceDamageCap: [8, 9, 10],
  }),

  noncontact_branching_resonance_wave: active("분기 공명파", 3, 2, 2, 2, "top", "attack", {
    attack: 12,
    attackPattern: "nonContact",
    target: "all",
    applyEnemyAfterAttack: { resonance: 1 },
    text: "전체 피해 12 · 살아남은 적 잔향 +1",
  }, { attack: [12, 15, 18] }),

  noncontact_resonance_chain_collapse: active("공명 연쇄붕괴", 4, 1, 1, 2, "base", "attack", {
    attack: 20,
    attackPattern: "nonContact",
    resonanceChainConsumeAll: true,
    resonanceChainCap: 10,
    resonanceChainPerStack: 4,
    resonanceChainSplashPerStack: 2,
    resonanceChainSplashAdd: 2,
    text: "대상 잔향 전량 소비 · 피해 20 + 소비 잔향×4 · 다른 적 관통 피해 소비 잔향×2 · 잔향 +2",
  }, {
    attack: [20, 26],
    resonanceChainPerStack: [4, 5],
  }),
};

const stagedItem = ({ id, name, kind, tier, room, effect, value, maxOwned = 1, stackable = false, description }) => ({
  id,
  name,
  kind,
  tier,
  room,
  effect,
  value,
  maxOwned,
  stackable,
  passive: true,
  image: null,
  family: effect,
  description,
});

export const STAGED_AUGMENT_ITEMS = {
  trait_resonance_ignition_coil: stagedItem({
    id: "trait_resonance_ignition_coil",
    name: "잔향 시동 코일",
    kind: "trait",
    tier: 0,
    room: "gather",
    effect: "resonanceFirstNonContactAdd",
    value: 1,
    maxOwned: 2,
    stackable: true,
    description: "매 턴 첫 비접촉 공격이 적중한 각 대상에게 잔향 +1 (중첩 가능)",
  }),
  trait_resonance_buffer_field: stagedItem({
    id: "trait_resonance_buffer_field",
    name: "공명 완충막",
    kind: "trait",
    tier: 0,
    room: "gather",
    effect: "resonanceFirstHitShield",
    value: 3,
    maxOwned: 2,
    stackable: true,
    description: "매 턴 처음으로 잔향이 있는 적에게 직접 피해를 주면 방어막 +3 (중첩 가능)",
  }),
  trait_inverse_phase_amplifier: stagedItem({
    id: "trait_inverse_phase_amplifier",
    name: "역위상 증폭기",
    kind: "trait",
    tier: 1,
    room: "golden",
    effect: "resonanceConsumeDamageBonus",
    value: 1,
    maxOwned: 2,
    stackable: true,
    description: "잔향을 소비하는 공격은 실제 소비량 최대 5까지 1중첩당 추가 피해 +1 (중첩 가능)",
  }),
  trait_critical_discharge_meter: stagedItem({
    id: "trait_critical_discharge_meter",
    name: "임계점 방전계",
    kind: "trait",
    tier: 2,
    room: "boss",
    effect: "resonanceConsumeRefundDraw",
    value: 1,
    maxOwned: 1,
    stackable: false,
    description: "한 번의 잔향 소비로 6 이상 소비하면 AP +1 · 카드 +1 (턴 1회)",
  }),
  relic_resonance_capture_flask: stagedItem({
    id: "relic_resonance_capture_flask",
    name: "회향 포집병",
    kind: "relic",
    tier: 3,
    room: "boss",
    effect: "resonanceTransferOnKill",
    value: 5,
    description: "적 처치 시 남아 있던 잔향을 최대 5까지 무작위 다른 생존 적에게 이전",
  }),
  relic_permanent_resonance_core: stagedItem({
    id: "relic_permanent_resonance_core",
    name: "영구 공명핵",
    kind: "relic",
    tier: 3,
    room: "boss",
    effect: "resonanceCoreNonContactAdd",
    value: 1,
    description: "비접촉 공격 후 생존한 적중 대상에게 잔향 +1 · 적용 직전 잔향 5 이상이면 +2",
  }),
};

export const SYNERGY_COLORS = {
  novice_pestle: { color: "#ff9f43", glow: "rgba(255, 159, 67, 0.45)", border: "#ffa94d" },
  pressurized_airflow: { color: "#ff5252", glow: "rgba(255, 82, 82, 0.45)", border: "#ff6b6b" },
  morning_chamomile: { color: "#1dd1a1", glow: "rgba(29, 209, 161, 0.45)", border: "#20bf6b" },
  hardened_wax_seal: { color: "#feca57", glow: "rgba(254, 202, 87, 0.45)", border: "#fed330" },
  brass_scales_funnel: { color: "#e67e22", glow: "rgba(230, 126, 34, 0.45)", border: "#f39c12" },
  grand_trinity: { color: "#a29bfe", glow: "rgba(162, 155, 254, 0.55)", border: "#6c5ce7" },
  diamond_bastion: { color: "#00d2d3", glow: "rgba(0, 210, 211, 0.55)", border: "#01a3a4" },
  supercritical_void: { color: "#ff007f", glow: "rgba(255, 0, 127, 0.55)", border: "#eb3b5a" },
  dew_petals: { color: "#ff7675", glow: "rgba(255, 118, 117, 0.45)", border: "#d63031" },
  sealed_impact: { color: "#54a0ff", glow: "rgba(84, 160, 255, 0.45)", border: "#2e86de" },
};

export const HIDDEN_SYNERGIES = {
  novice_pestle: { id: "novice_pestle", name: "초심자의 막자사발", tier: 1, description: "접촉 공격 카드가 적중하면 추가 피해 2를 주고 체력을 1 회복합니다.", requires: ["gather_attack_0", "gather_contactBonus_0"], effect: "pestlePower", value: 2, heal: 1 },
  pressurized_airflow: { id: "pressurized_airflow", name: "가압 기류 분사", tier: 1, description: "비접촉 공격 카드가 적중하면 모든 적에게 연소 2를 부여하고 적의 연소 피해를 20% 증폭합니다.", requires: ["gather_defense_0", "gather_pressureValve_0"], effect: "pressurizedAroma", value: 0.2, burning: 2 },
  morning_chamomile: { id: "morning_chamomile", name: "아침 카모마일 온기", tier: 1, description: "전투 시작과 턴 종료에 방어막 4를 얻고 모든 회복량이 25% 증가합니다.", requires: ["gather_healBonus_0", "gather_regen_0"], effect: "chamomileAura", value: 0.25, shield: 4 },
  hardened_wax_seal: { id: "hardened_wax_seal", name: "경화 밀랍 인장", tier: 2, description: "방어막 보존율이 20%p 증가하고, 방어막 보유 중 받는 직접 피해가 3 감소합니다.", requires: ["gather_maxHp_0", "golden_carry_0"], effect: "hardenedArmor", value: 3, retention: 0.2 },
  brass_scales_funnel: { id: "brass_scales_funnel", name: "황동 저울 깔때기", tier: 2, description: "모든 골드 획득량이 20% 증가하고, 승리 시 남은 흡수 2당 1골드로 환전합니다(최대 30골드).", requires: ["gather_goldBonus_0", "golden_absorb_0"], effect: "goldGainMultiplier", value: 0.2 },
  grand_trinity: { id: "grand_trinity", name: "대삼위일체의 조화", tier: 4, description: "하모니 완성 시 모든 적에게 관통 피해 40을 주고 다음 턴 AP를 1 추가합니다.", requires: ["golden_draw_0", "boss_harmony_0", "boss_apRegen_0"], effect: "trinityBurst", value: 40, nextTurnAp: 1 },
  diamond_bastion: { id: "diamond_bastion", name: "다이아몬드 요새", tier: 3, description: "적의 직접 공격을 방어막으로 막으면 피격 직전 방어막의 50%만큼 공격자에게 관통 피해를 줍니다.", requires: ["golden_shieldCounter_0", "boss_bastionCore_0", "boss_thornsRetain_0"], effect: "bastionReflect", value: 0.5 },
  supercritical_void: { id: "supercritical_void", name: "초임계 보이드 특이점", tier: 4, description: "적 턴 시작에 흡수가 30 이상이면 모두 소모해 적 전체에 관통 피해 80과 기절 1을 부여합니다.", requires: ["golden_absorbExplode_0", "boss_blackHoleAroma_0", "boss_criticalDistill_0"], effect: "voidSingularity", value: 80, threshold: 30 },
  dew_petals: { id: "dew_petals", name: "이슬 머금은 꽃잎", tier: 2, description: "오일 카드를 사용할 때마다 체력을 2 회복합니다.", requires: ["gather_regen_2", "gather_oilShield_0"], effect: "oilHeal", value: 2 },
  sealed_impact: { id: "sealed_impact", name: "완전 밀폐 충격", tier: 3, description: "방어막이 턴을 넘어 보존되면 다음 첫 접촉 공격의 피해가 50% 증가합니다.", requires: ["golden_carry_2", "boss_shieldHit_0"], effect: "retainedBonusDamage", value: 0.5 },
};

export const SYNERGY_COMPONENT_IDS = Object.freeze([
  ...new Set(Object.values(HIDDEN_SYNERGIES).flatMap((synergy) => synergy.requires)),
]);

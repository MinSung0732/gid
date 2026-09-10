export const HIDDEN_SYNERGIES = {
  dew_petals: {
    id: "dew_petals", name: "이슬 머금은 꽃잎",
    description: "오일 카드를 사용할 때마다 방어막뿐만 아니라 체력도 2 회복합니다.",
    requires: ["gather_regen_2", "gather_oilShield_0"], effect: "oilHeal", value: 2,
  },
  sealed_impact: {
    id: "sealed_impact", name: "완전 밀폐 충격",
    description: "방어막 보존 시 다음 턴 첫 접촉 공격의 피해가 50% 증폭됩니다.",
    requires: ["golden_carry_2", "boss_shieldHit_0"], effect: "retainedBonusDamage", value: 0.5,
  },
};

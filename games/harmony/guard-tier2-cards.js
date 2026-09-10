const guard = (name, cost, effects, upgrades) => ({
  name, cost, tier: 2, maxCopies: 2, maxUpgrade: 2, note: "base",
  category: "defense", ...effects, upgrades,
});
export const GUARD_TIER2_CARDS = {
  guard_double_coating: guard("이중 왁스 코팅", 1, { shield: 10, retainShield: 0.6 }, { shield: [10,12,14], retainShield: [0.6,0.6,0.7] }),
  guard_granite_pedestal: guard("화강암 작업대", 2, { shield: 22, turnDamageReduction: 2 }, { shield: [22,26,30], turnDamageReduction: [2,2,3] }),
  guard_counter_crimp: guard("크림프 반사 타격", 1, { shield: 8, shieldCounter: 0.75, attackPattern: "contact" }, { shield: [8,10,12], shieldCounter: [0.75,0.75,1] }),
  guard_hardened_resin_spikes: guard("경화 수지 가시막", 1, { shield: 9, thorns: 5 }, { shield: [9,11,13], thorns: [5,6,8] }),
  guard_quick_mist_shield: guard("급속 미스트 차단", 0, { shield: 7, draw: 1, discard: 1 }, { shield: [7,9,11] }),
  guard_antiseptic_rinse: guard("무균 소독 세척", 1, { shield: 8, cleanse: 2 }, { shield: [8,10,12], cleanse: [2,2,"all"] }),
  guard_aroma_barrier: guard("농축 오일 베리어", 1, { shield: 10, absorb: 6 }, { shield: [10,12,14], absorb: [6,7,9] }),
  guard_skin_regeneration: guard("세라마이드 피부 장벽", 1, { shield: 9, shieldSurvivalHeal: 3 }, { shield: [9,11,13], shieldSurvivalHeal: [3,4,5] }),
};

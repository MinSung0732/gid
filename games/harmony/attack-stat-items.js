const stat = (id, name, tier, effect, value, maxOwned, description) => ({
  id,
  name,
  tier: tier - 1,
  room: tier === 1 ? "gather" : tier === 2 ? "golden" : "boss",
  kind: "stat",
  effect,
  value,
  maxOwned,
  image: null,
  description,
});

export const ATTACK_STAT_ITEMS = {
  stat_sharp_pipette_tip: stat("stat_sharp_pipette_tip", "예리한 피펫 팁", 1, "attack", 1, 3, "모든 공격 카드의 피해가 +1 증가합니다."),
  stat_pure_extract_drop: stat("stat_pure_extract_drop", "맑은 원액 한 방울", 1, "attack", 1, 3, "모든 공격 카드의 피해가 +1 증가합니다."),
  stat_hardened_reed_point: stat("stat_hardened_reed_point", "경화된 리드 촉", 1, "contactAttack", 2, 2, "접촉 공격 카드의 피해가 +2 증가합니다."),
  stat_flint_pestle_head: stat("stat_flint_pestle_head", "부싯돌 유발 머리", 1, "contactAttack", 2, 2, "접촉 공격 카드의 피해가 +2 증가합니다."),
  stat_micro_nozzle: stat("stat_micro_nozzle", "초미세 분무 노즐", 1, "nonContactAttack", 2, 2, "비접촉 공격 카드의 피해가 +2 증가합니다."),
  stat_pressurized_spray_cap: stat("stat_pressurized_spray_cap", "가압식 스프레이 캡", 1, "nonContactAttack", 2, 2, "비접촉 공격 카드의 피해가 +2 증가합니다."),
  stat_sharp_top_scent: stat("stat_sharp_top_scent", "날카로운 탑노트", 1, "topAttack", 2, 2, "Top 노트 공격 카드의 피해가 +2 증가합니다."),
  stat_heavy_base_resin: stat("stat_heavy_base_resin", "묵직한 베이스 수지", 1, "baseAttack", 2, 2, "Base 노트 공격 카드의 피해가 +2 증가합니다."),
  stat_corrosive_catalyst: stat("stat_corrosive_catalyst", "부식 촉진제", 1, "corrosionAttack", 3, 2, "부식 상태인 적에게 가하는 공격 피해가 +3 증가합니다."),
  stat_ignited_wick_ash: stat("stat_ignited_wick_ash", "발화된 심지 재", 1, "burningAttack", 3, 2, "연소 상태인 적에게 가하는 공격 피해가 +3 증가합니다."),

  stat_refined_extract_vial: stat("stat_refined_extract_vial", "농축 에센스 앰플", 2, "attack", 2, 3, "모든 공격 카드의 피해가 +2 증가합니다."),
  stat_dense_oil_essence: stat("stat_dense_oil_essence", "고밀도 오일 에센스", 2, "attack", 2, 3, "모든 공격 카드의 피해가 +2 증가합니다."),
  stat_weighted_pestle_stone: stat("stat_weighted_pestle_stone", "묵직한 유발 추", 2, "contactAttack", 3, 2, "접촉 공격 카드의 피해가 +3 증가합니다."),
  stat_honed_reed_needle: stat("stat_honed_reed_needle", "연마된 리드 바늘", 2, "contactAttack", 3, 2, "접촉 공격 카드의 피해가 +3 증가합니다."),
  stat_high_pressure_atomizer: stat("stat_high_pressure_atomizer", "고압 원자화 노즐", 2, "nonContactAttack", 3, 2, "비접촉 공격 카드의 피해가 +3 증가합니다."),
  stat_aerodynamic_diffuser_flute: stat("stat_aerodynamic_diffuser_flute", "기류 제어 디퓨저 관", 2, "nonContactAttack", 3, 2, "비접촉 공격 카드의 피해가 +3 증가합니다."),
  stat_sharp_top_amplifier: stat("stat_sharp_top_amplifier", "탑노트 농축제", 2, "topAttack", 3, 2, "Top 노트 공격 카드의 피해가 +3 증가합니다."),
  stat_heavy_base_anchor: stat("stat_heavy_base_anchor", "베이스노트 고정제", 2, "baseAttack", 3, 2, "Base 노트 공격 카드의 피해가 +3 증가합니다."),

  stat_primeval_pure_essence: stat("stat_primeval_pure_essence", "태초의 순수 에센스", 3, "attack", 3, 2, "모든 공격 카드의 피해가 +3 증가합니다."),
  stat_abyssal_crystal_pestle: stat("stat_abyssal_crystal_pestle", "심연의 크리스탈 유발", 3, "contactAttack", 5, 1, "접촉 공격 카드의 피해가 +5 증가합니다."),
  stat_supercritical_pressure_nozzle: stat("stat_supercritical_pressure_nozzle", "초임계 고압 노즐", 3, "nonContactAttack", 5, 1, "비접촉 공격 카드의 피해가 +5 증가합니다."),
  stat_scent_pyramid_apex: stat("stat_scent_pyramid_apex", "올팩티브 피라미드 정점", 3, "harmonyAttack", 8, 1, "HARMONY! 발동 피해가 +8 증가합니다."),
  stat_piercing_diamond_pipette: stat("stat_piercing_diamond_pipette", "다이아몬드 코팅 피펫", 3, "attack", 3, 2, "모든 공격 카드의 피해가 +3 증가합니다."),

  stat_primordial_quintessence: stat("stat_primordial_quintessence", "태초의 제5원소 정수", 4, "attack", 5, 1, "모든 공격 카드의 피해가 +5 증가합니다."),
  stat_celestial_resonance_tuning: stat("stat_celestial_resonance_tuning", "천상의 하모니 조율기", 4, "harmonyAttack", 12, 1, "HARMONY! 발동 피해가 +12 증가합니다."),
};

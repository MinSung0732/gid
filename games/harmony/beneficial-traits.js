const RAW_BENEFICIAL_TRAITS = {
  // ==========================================
  // [1티어 특성 - 32종]
  // ==========================================
  // A. 오일 & 흡수 시너지 (4종)
  trait_overlapping_petals: { id: "trait_overlapping_petals", name: "겹친 꽃잎", tier: 1, kind: "trait", effect: "oilShield", value: 2, maxOwned: 3, description: "오일 카드 사용 시마다 장당 방어막 +2 획득" },
  trait_oil_reflux_heat: { id: "trait_oil_reflux_heat", name: "오일 환류열", tier: 1, kind: "trait", effect: "oilAttack", value: 1, maxOwned: 3, description: "오일 카드를 사용한 턴 동안 장당 모든 공격 피해 +1" },
  trait_porous_grain: { id: "trait_porous_grain", name: "다공성 결", tier: 1, kind: "trait", effect: "absorbOnEnd", value: 1, maxOwned: 3, description: "턴 종료 시 남은 AP 1당 장당 흡수 +1 획득" },
  trait_saturated_spillover: { id: "trait_saturated_spillover", name: "포화 분출", tier: 1, kind: "trait", effect: "absorbSpillShield", value: 3, maxOwned: 2, description: "턴 종료 시 흡수 25 이상이면 장당 방어막 +3 획득" },
  // B. 접촉 공격 & 연속 타격 (4종)
  trait_friction_spark: { id: "trait_friction_spark", name: "마찰 불꽃", tier: 1, kind: "trait", effect: "contactIgnite", value: 1, maxOwned: 2, description: "접촉 공격 적중 시마다 적에게 장당 연소 1 부여" },
  trait_glass_splinters: { id: "trait_glass_splinters", name: "유리 파편 돌출", tier: 1, kind: "trait", effect: "contactBleed", value: 1, maxOwned: 2, description: "접촉 공격으로 적 방어막을 깎을 때 장당 출혈 1 부여" },
  trait_heavy_rebound: { id: "trait_heavy_rebound", name: "묵직한 반동", tier: 1, kind: "trait", effect: "contactShield", value: 2, maxOwned: 3, description: "2코스트 이상 접촉 카드 사용 시 장당 방어막 +2 획득" },
  trait_tempo_cadence: { id: "trait_tempo_cadence", name: "연타 케이던스", tier: 1, kind: "trait", effect: "comboContact", value: 1, maxOwned: 3, description: "한 턴에 2번째 사용하는 접촉 카드부터 장당 피해 +1" },
  // C. 비접촉 확산 & 원거리 (4종)
  trait_lingering_vapor: { id: "trait_lingering_vapor", name: "잔류 증기", tier: 1, kind: "trait", effect: "nonContactPoison", value: 1, maxOwned: 2, description: "비접촉 공격 카드 사용 시 적 전체에게 장당 중독 1 부여" },
  trait_pressurized_draft: { id: "trait_pressurized_draft", name: "가압 기류", tier: 1, kind: "trait", effect: "firstNonContactBonus", value: 2, maxOwned: 3, description: "매 턴 처음 쓰는 비접촉 공격 피해 장당 +2" },
  trait_aerosol_purification: { id: "trait_aerosol_purification", name: "에어로졸 정화", tier: 1, kind: "trait", effect: "nonContactAbsorb", value: 2, maxOwned: 2, description: "비접촉 광역 공격 카드 사용 시 장당 흡수 +2 획득" },
  trait_distant_chilling: { id: "trait_distant_chilling", name: "원거리 냉각", tier: 1, kind: "trait", effect: "nonContactIntimidate", value: 1, maxOwned: 2, description: "비접촉 공격 적중 시 적에게 장당 위축 1 부여" },
  // D. 방어막 & 가시 반사 (4종)
  trait_hardened_crust: { id: "trait_hardened_crust", name: "단단한 결", tier: 1, kind: "trait", effect: "shieldHit", value: 0.05, maxOwned: 3, description: "방어 카드 사용 시 현재 방어막의 장당 5%만큼 반격 피해" },
  trait_calcified_spikes: { id: "trait_calcified_spikes", name: "석회질 가시", tier: 1, kind: "trait", effect: "thornsOnGuard", value: 1, maxOwned: 3, description: "방어 카드 사용 시마다 자신에게 장당 가시 1 획득" },
  trait_dense_paraffin_buffer: { id: "trait_dense_paraffin_buffer", name: "밀집 파라핀 완충", tier: 1, kind: "trait", effect: "retainedShield", value: 2, maxOwned: 3, description: "턴 종료 시 장당 2의 방어막 보존" },
  trait_reactive_corrosion: { id: "trait_reactive_corrosion", name: "반응성 부식 외벽", tier: 1, kind: "trait", effect: "thornsCorrode", value: 1, maxOwned: 2, description: "가시로 반사 피해를 입힐 때마다 공격자에게 장당 부식 1 부여" },
  // E. 조향 노트 하모니 (4종)
  trait_sparkling_top: { id: "trait_sparkling_top", name: "스파클링 탑", tier: 1, kind: "trait", effect: "topShield", value: 2, maxOwned: 3, description: "Top 노트 카드 사용 시마다 장당 방어막 +2 획득" },
  trait_heart_resonance: { id: "trait_heart_resonance", name: "하트 레조넌스", tier: 1, kind: "trait", effect: "middleHeal", value: 1, maxOwned: 2, description: "Middle 노트 카드 사용 시마다 장당 체력 +1 회복" },
  trait_deep_sillage_foundation: { id: "trait_deep_sillage_foundation", name: "심층 잔향의 기초", tier: 1, kind: "trait", effect: "baseDamage", value: 1, maxOwned: 3, description: "Base 노트 카드 사용 시마다 장당 피해 +1" },
  trait_accord_cadence: { id: "trait_accord_cadence", name: "화음 완성의 기운", tier: 1, kind: "trait", effect: "harmonyBonus", value: 3, maxOwned: 2, description: "하모니(HARMONY!) 발동 시 장당 추가 피해 +3" },
  // F. 상태이상 폭발 (4종)
  trait_kindling_residue: { id: "trait_kindling_residue", name: "착화 잔여물", tier: 1, kind: "trait", effect: "burningBonus", value: 1, maxOwned: 3, description: "연소 걸린 적 공격 시 장당 피해 +1 증가" },
  trait_acidic_condensation: { id: "trait_acidic_condensation", name: "산성 응결", tier: 1, kind: "trait", effect: "corrosionTickDamage", value: 1, maxOwned: 3, description: "턴 종료 시 적의 부식 피해 장당 +1 추가" },
  trait_open_wound_scent: { id: "trait_open_wound_scent", name: "열린 상처의 피향", tier: 1, kind: "trait", effect: "bleedLeech", value: 1, maxOwned: 2, description: "적에게 출혈 피해가 터질 때마다 플레이어 체력 +1 회복" },
  trait_toxic_evaporation: { id: "trait_toxic_evaporation", name: "독기 증산", tier: 1, kind: "trait", effect: "poisonSpread", value: 1, maxOwned: 2, description: "중독 상태인 적 처치 시 다른 모든 적에게 장당 중독 1 전염" },
  // G. 유지력 & 회복 (4종)
  trait_warmth_condensation: { id: "trait_warmth_condensation", name: "응축된 온기", tier: 1, kind: "trait", effect: "overflow", value: 0.5, maxOwned: 2, description: "초과 회복량의 장당 50%를 방어막으로 전환" },
  trait_crisis_surge: { id: "trait_crisis_surge", name: "위기 호르몬", tier: 1, kind: "trait", effect: "lowHpDefense", value: 2, maxOwned: 3, description: "체력 50% 이하일 때 쓰는 방어 카드의 방어막 장당 +2" },
  trait_steady_metabolism: { id: "trait_steady_metabolism", name: "안정 대사 작용", tier: 1, kind: "trait", effect: "regenShield", value: 2, maxOwned: 2, description: "턴 시작 시 재생으로 체력 찰 때 장당 방어막 +2 획득" },
  trait_vital_percolation: { id: "trait_vital_percolation", name: "활력 추출", tier: 1, kind: "trait", effect: "absorbCostHeal", value: 1, maxOwned: 3, description: "10 이상의 흡수를 소모하는 카드 사용 시 장당 체력 +1 회복" },
  // H. 손패 순환 & 템포 (4종)
  trait_light_hand_tactics: { id: "trait_light_hand_tactics", name: "가벼운 손놀림", tier: 1, kind: "trait", effect: "zeroCostBonus", value: 1, maxOwned: 3, description: "0 AP 카드 사용 시 다음 공격 카드 피해 장당 +1" },
  trait_opening_ambush: { id: "trait_opening_ambush", name: "개막 기습 분사", tier: 1, kind: "trait", effect: "turn1Shield", value: 4, maxOwned: 2, description: "전투 첫 턴에 장당 방어막 +4 추가 획득" },
  trait_scent_memory_echo: { id: "trait_scent_memory_echo", name: "잔향의 기억", tier: 1, kind: "trait", effect: "discardAbsorb", value: 1, maxOwned: 3, description: "카드를 버릴 때마다 장당 흡수 +1 획득" },
  trait_tactical_scent_strip: { id: "trait_tactical_scent_strip", name: "전술 시향지", tier: 1, kind: "trait", effect: "handRetain", value: 1, maxOwned: 1, description: "턴 종료 시 가장 코스트 높은 카드 1장 보존" },
  // ==========================================
  // [2티어 특성 - 30종]
  // ==========================================
  // A. 오일 & 흡수 가속 (4종)
  trait_essence_replication: { id: "trait_essence_replication", name: "에센스 복제", tier: 2, kind: "trait", effect: "oilAbsorbRatio", value: 0.25, maxOwned: 2, description: "오일 카드로 얻는 흡수량이 장당 +25% 배율 증가" },
  trait_viscous_shielding: { id: "trait_viscous_shielding", name: "점성 수지 코팅", tier: 2, kind: "trait", effect: "oilShieldT2", value: 5, maxOwned: 2, description: "오일 카드 사용 시마다 장당 방어막 +5 획득" },
  trait_saturated_resonance: { id: "trait_saturated_resonance", name: "포화 공명파", tier: 2, kind: "trait", effect: "highAbsorbAttack", value: 6, maxOwned: 2, description: "현재 흡수가 30 이상일 때 공격 시 장당 피해 +6 추가" },
  trait_solvent_recycle_engine: { id: "trait_solvent_recycle_engine", name: "용매 환류 엔진", tier: 2, kind: "trait", effect: "absorbChainRefund", value: 1, maxOwned: 1, description: "한 턴에 흡수 카드를 3장 이상 쓰면 1 AP 환급 (턴당 1회)" },
  // B. 접촉 공격 & 타격 (4종)
  trait_crushing_pestle_force: { id: "trait_crushing_pestle_force", name: "분쇄 유발의 파괴력", tier: 2, kind: "trait", effect: "contactBypass", value: 4, maxOwned: 2, description: "접촉 카드 사용 시 장당 4의 방어막 관통 피해 추가" },
  trait_searing_friction: { id: "trait_searing_friction", name: "맹렬한 마찰열", tier: 2, kind: "trait", effect: "contactIgniteT2", value: 2, maxOwned: 2, description: "1코스트 이상 접촉 적중 시 적에게 장당 연소 2 부여" },
  trait_cauterizing_strike: { id: "trait_cauterizing_strike", name: "지혈 압박타", tier: 2, kind: "trait", effect: "contactBleedHeal", value: 2, maxOwned: 2, description: "출혈 상태인 적을 접촉 공격 시 장당 체력 +2 회복" },
  trait_contact_counter_posture: { id: "trait_contact_counter_posture", name: "접촉 반격 자세", tier: 2, kind: "trait", effect: "contactThorns", value: 3, maxOwned: 2, description: "한 턴에 접촉 카드 2장 이상 썼다면 장당 가시 3 획득" },
  // C. 비접촉 확산 & 기화 (4종)
  trait_diffusive_pressure_wave: { id: "trait_diffusive_pressure_wave", name: "확산형 기압파", tier: 2, kind: "trait", effect: "aoeNonContactBonus", value: 3, maxOwned: 2, description: "전체 대상 비접촉 공격 피해가 장당 +3 증가" },
  trait_volatile_vapor_plume: { id: "trait_volatile_vapor_plume", name: "급속 기화 연무", tier: 2, kind: "trait", effect: "firstNonContactVulnerable", value: 1, maxOwned: 2, description: "매 턴 처음 쓰는 비접촉 적중 시 적에게 장당 취약 1 부여" },
  trait_siphon_percolation: { id: "trait_siphon_percolation", name: "사이폰 흡혈 침출", tier: 2, kind: "trait", effect: "nonContactLeechAbsorb", value: 0.2, maxOwned: 2, description: "비접촉 공격으로 가한 피해의 장당 20%만큼 흡수 획득" },
  trait_chilling_aerosol: { id: "trait_chilling_aerosol", name: "동결 에어로졸", tier: 2, kind: "trait", effect: "nonContactIntimidateT2", value: 2, maxOwned: 2, description: "공격 패턴인 적에게 비접촉 적중 시 장당 위축 2 부여" },
  // D. 방어막 & 성벽 (4종)
  trait_hardened_wax_bulwark: { id: "trait_hardened_wax_bulwark", name: "경화 왁스 보루", tier: 2, kind: "trait", effect: "shieldRetainPercent", value: 0.3, maxOwned: 2, description: "턴 종료 시 남은 방어막의 장당 30%를 이월 보존" },
  trait_reactive_thorn_burst: { id: "trait_reactive_thorn_burst", name: "반응성 가시 파열", tier: 2, kind: "trait", effect: "thornsDamageBonus", value: 3, maxOwned: 2, description: "피격 시 가시로 반사하는 피해가 장당 +3 증가" },
  trait_fortified_paraffin: { id: "trait_fortified_paraffin", name: "요새화 파라핀", tier: 2, kind: "trait", effect: "guardBonusT2", value: 3, maxOwned: 3, description: "1코스트 이상 방어 카드 사용 시 장당 추가 방어막 +3" },
  trait_corrosive_armor_plating: { id: "trait_corrosive_armor_plating", name: "부식 장갑판", tier: 2, kind: "trait", effect: "blockCorrosion", value: 2, maxOwned: 2, description: "적의 접촉 공격을 막아낼 때 공격자에게 장당 부식 2 부여" },
  // E. 조향 노트 하모니 (4종)
  trait_olfactive_pyramid_echo: { id: "trait_olfactive_pyramid_echo", name: "피라미드 잔향 복제", tier: 2, kind: "trait", effect: "harmonyEchoDamage", value: 5, maxOwned: 2, description: "하모니 완성 시 장당 +5 추가 피해 및 카드 1장 드로우" },
  trait_top_citrus_flash: { id: "trait_top_citrus_flash", name: "탑 시트러스 섬광", tier: 2, kind: "trait", effect: "topZeroCostBonus", value: 2, maxOwned: 2, description: "Top 노트를 낸 턴 동안 0코스트 카드 피해 장당 +2" },
  trait_middle_floral_bloom: { id: "trait_middle_floral_bloom", name: "미들 플로럴 만개", tier: 2, kind: "trait", effect: "middleRegenBoost", value: 2, maxOwned: 2, description: "Middle 노트 사용 시 내 재생 스택 장당 +2 증가" },
  trait_base_woody_anchor: { id: "trait_base_woody_anchor", name: "베이스 우디 고정", tier: 2, kind: "trait", effect: "baseNextShield", value: 5, maxOwned: 2, description: "Base 노트를 내고 턴 종료 시 다음 턴 방어막 장당 +5" },
  // F. 상태이상 증폭 (4종)
  trait_combustion_acceleration: { id: "trait_combustion_acceleration", name: "연소 가속화", tier: 2, kind: "trait", effect: "burningDamageBonus", value: 2, maxOwned: 2, description: "턴 종료 시 터지는 연소 피해 장당 +2 추가" },
  trait_acid_armor_melt: { id: "trait_acid_armor_melt", name: "산성 융해 침식", tier: 2, kind: "trait", effect: "corrosionShieldDamage", value: 3, maxOwned: 2, description: "적 방어막에 터지는 부식 피해 장당 +3 증폭" },
  trait_hemorrhage_cascade: { id: "trait_hemorrhage_cascade", name: "출혈 연쇄 반응", tier: 2, kind: "trait", effect: "bleedHitBonus", value: 1, maxOwned: 3, description: "출혈 걸린 적을 공격할 때 매 타격(Hit)마다 장당 +1 추가 피해" },
  trait_toxic_spore_cloud: { id: "trait_toxic_spore_cloud", name: "맹독 포자 구름", tier: 2, kind: "trait", effect: "poisonDeathDetonate", value: 3, maxOwned: 2, description: "중독 걸린 적 사망 시 모든 적에게 장당 3의 중독 폭발" },
  // G. 유지력 & 자원 가속 (6종)
  trait_vital_dew_overflow: { id: "trait_vital_dew_overflow", name: "이슬 과포화 전환", tier: 2, kind: "trait", effect: "overflowT2", value: 0.75, maxOwned: 2, description: "초과 회복량의 장당 75%를 방어막으로 전환" },
  trait_cell_regeneration_boost: { id: "trait_cell_regeneration_boost", name: "세포 분열 촉진", tier: 2, kind: "trait", effect: "regenShieldT2", value: 3, maxOwned: 2, description: "턴 시작 시 재생 발동 때마다 장당 방어막 +3 추가" },
  trait_adrenaline_purification: { id: "trait_adrenaline_purification", name: "아드레날린 정제", tier: 2, kind: "trait", effect: "cleanseOnLowHp", value: 1, maxOwned: 1, description: "체력이 처음 40% 이하로 떨어지면 모든 디버프 즉시 해제 (전투당 1회)" },
  trait_volatile_discard_surge: { id: "trait_volatile_discard_surge", name: "휘발성 패 순환 촉매", tier: 2, kind: "trait", effect: "discardDraw", value: 1, maxOwned: 2, description: "한 턴에 카드를 3장 이상 버릴 때마다 장당 카드 1장 드로우" },
  trait_first_turn_mastery: { id: "trait_first_turn_mastery", name: "초반 제압 마스터리", tier: 2, kind: "trait", effect: "turn1ExtraAp", value: 1, maxOwned: 1, description: "전투 첫 턴 시작 AP +1 추가 획득" },
  trait_craft_efficiency: { id: "trait_craft_efficiency", name: "조향 공정 최적화", tier: 2, kind: "trait", effect: "reduceHighCostCard", value: 1, maxOwned: 1, description: "2코스트 이상 공격 카드 사용 시 무작위 1장 비용 1 감소 (턴당 1회)" },
  // ==========================================
  // [3티어 특성 - 20종]
  // ==========================================
  trait_supercritical_distill_loop: { id: "trait_supercritical_distill_loop", name: "초임계 환류 증류", tier: 3, kind: "trait", effect: "absorbDecayGuard", value: 10, maxOwned: 2, description: "턴 종료 감쇄 전 장당 흡수 10 확정 보존" },
  trait_viscous_fuel_burst: { id: "trait_viscous_fuel_burst", name: "농축 원액 가압 연소", tier: 3, kind: "trait", effect: "absorbSpendAoeDamage", value: 2, maxOwned: 1, description: "흡수 5 소모할 때마다 적 전체에게 피해 +2 파편 분사" },
  trait_perpetual_oil_motion: { id: "trait_perpetual_oil_motion", name: "영구 오일 순환", tier: 3, kind: "trait", effect: "oilSearchAndDiscount", value: 1, maxOwned: 1, description: "오일 카드를 2장 쓸 때마다 비접촉 카드 1장 서치 및 비용 1 감소" },
  trait_obsidian_impact_resonance: { id: "trait_obsidian_impact_resonance", name: "흑요석 충격 잔향", tier: 3, kind: "trait", effect: "heavyContactTrueDamage", value: 8, maxOwned: 2, description: "2코 이상 접촉으로 체력 피해 시 장당 +8의 관통 추가타" },
  trait_flurry_momentum: { id: "trait_flurry_momentum", name: "난타 모멘텀", tier: 3, kind: "trait", effect: "multiHitDamageBonus", value: 2, maxOwned: 2, description: "3연타 이상 접촉 카드의 매 타격마다 장당 피해 +2 가산" },
  trait_shattering_counter_blow: { id: "trait_shattering_counter_blow", name: "성벽 파쇄 카운터", tier: 3, kind: "trait", effect: "shieldBreakRefund", value: 1, maxOwned: 1, description: "적의 실드 파괴 시 1 AP 즉시 환급 + 카드 1장 드로우" },
  trait_atmospheric_decompression: { id: "trait_atmospheric_decompression", name: "대기 감압 쇼크", tier: 3, kind: "trait", effect: "aoeNonContactStunChance", value: 0.25, maxOwned: 2, description: "비접촉 광역 적중 시 장당 25% 확률로 기절 부여 (보스 제외)" },
  trait_hyper_atomized_cloud: { id: "trait_hyper_atomized_cloud", name: "극초미세 기화 구름", tier: 3, kind: "trait", effect: "extendDotDurations", value: 1, maxOwned: 1, description: "비접촉 공격 적중 시 적의 모든 도트 지속시간 +1턴 연장" },
  trait_sonic_boom_dispersion: { id: "trait_sonic_boom_dispersion", name: "초음파 음향 확산", tier: 3, kind: "trait", effect: "nonContactDotBonus", value: 2, maxOwned: 2, description: "비접촉 공격 시 대상의 상태이상 1개당 장당 피해 +2 증폭" },
  trait_unyielding_wax_monolith: { id: "trait_unyielding_wax_monolith", name: "부동의 왁스 모놀리스", tier: 3, kind: "trait", effect: "perfectShieldRetain", value: 0.5, maxOwned: 2, description: "턴 종료 시 남은 방어막의 장당 50% 이월 보존 (2개 시 100% 완전 보존)" },
  trait_spiked_crystalline_barrier: { id: "trait_spiked_crystalline_barrier", name: "결정체 가시 장벽", tier: 3, kind: "trait", effect: "thornsAmplifyRatio", value: 0.5, maxOwned: 2, description: "가시 반사 피해가 장당 +50% 배율로 증폭" },
  trait_aegis_kinetic_absorption: { id: "trait_aegis_kinetic_absorption", name: "운동 에너지 흡수벽", tier: 3, kind: "trait", effect: "blockedDamageToAbsorb", value: 0.2, maxOwned: 1, description: "방어막으로 공격을 완벽히 막아냈을 때 막은 대미지의 20%를 흡수로 전환" },
  trait_celestial_accord_echo: { id: "trait_celestial_accord_echo", name: "천상의 화음 반향", tier: 3, kind: "trait", effect: "harmonyReplayCard", value: 1, maxOwned: 1, description: "하모니 완성 시 사용된 Top 또는 Middle 카드 중 1장 무료 재발동" },
  trait_prismatic_note_prism: { id: "trait_prismatic_note_prism", name: "프리즘 조향 굴절", tier: 3, kind: "trait", effect: "harmonyAoeTrueDamage", value: 10, maxOwned: 2, description: "하모니 발동 시 적 전체에게 장당 +10 관통 피해 및 취약 1 부여" },
  trait_conflagration_inferno: { id: "trait_conflagration_inferno", name: "대화재 업화", tier: 3, kind: "trait", effect: "burningMultiplier", value: 0.5, maxOwned: 2, description: "턴 종료 시 터지는 연소 피해량이 장당 +50% 배율로 폭증" },
  trait_caustic_dissolution: { id: "trait_caustic_dissolution", name: "가성 소다 급속 용해", tier: 3, kind: "trait", effect: "corrosionDoubleTick", value: 1, maxOwned: 1, description: "적의 부식 피해가 턴 종료뿐만 아니라 턴 시작 시에도 한 번 더 발동" },
  trait_bloodletting_torrent: { id: "trait_bloodletting_torrent", name: "혈류 폭주 분출", tier: 3, kind: "trait", effect: "bleedTriggerShield", value: 3, maxOwned: 2, description: "적의 출혈 피해가 터질 때마다 플레이어 장당 방어막 +3 획득" },
  trait_phoenix_aroma_rebirth: { id: "trait_phoenix_aroma_rebirth", name: "불사조 향로 환생", tier: 3, kind: "trait", effect: "reviveOnFatal", value: 0.3, maxOwned: 1, description: "치명상 시 모든 상태이상 해제 및 최대 체력의 30%로 부활 (런당 1회)" },
  trait_overflowing_fountainhead: { id: "trait_overflowing_fountainhead", name: "과포화 생명 분천", tier: 3, kind: "trait", effect: "overflowT3", value: 1.5, maxOwned: 1, description: "최대 체력 초과 회복량의 150%를 방어막으로 극대 전환" },
  trait_hyper_efficiency_tempo: { id: "trait_hyper_efficiency_tempo", name: "초고속 조향 템포", tier: 3, kind: "trait", effect: "fourthCardRefund", value: 1, maxOwned: 1, description: "한 턴에 카드를 4장 쓸 때마다 1 AP 충전 + 카드 1장 드로우 (턴당 1회)" },
  // ==========================================
  // [4티어 특성 - 15종]
  // ==========================================
  trait_absolute_diffusion_singularity: { id: "trait_absolute_diffusion_singularity", name: "절대 확산 특이점", tier: 4, kind: "trait", effect: "spatialDiffusionMultiplier", value: 1.0, maxOwned: 1, description: "공간 확산 발동 시 소비 흡수 피해 배율 영구 +1.0배 증가" },
  trait_perpetual_oil_fountain: { id: "trait_perpetual_oil_fountain", name: "영구 마르지 않는 유전", tier: 4, kind: "trait", effect: "freeOilCardEachTurn", value: 1, maxOwned: 1, description: "매 턴 시작 시 손패의 무작위 오일 카드 1장의 비용 0 AP 고정" },
  trait_essence_overdrive_loop: { id: "trait_essence_overdrive_loop", name: "에센스 오버드라이브", tier: 4, kind: "trait", effect: "maxAbsorbCapBonus", value: 25, maxOwned: 2, description: "플레이어의 최대 흡수 상한치가 장당 +25 증가 (최대 150)" },
  trait_supercritical_phase_lock: { id: "trait_supercritical_phase_lock", name: "초임계 영구 동결 밀폐", tier: 4, kind: "trait", effect: "infiniteAbsorbDecayImmunity", value: 1, maxOwned: 1, description: "전투 중 턴 종료 시 흡수 게이지가 영구적으로 절대 감쇄되지 않음" },
  trait_guillotine_executioner: { id: "trait_guillotine_executioner", name: "단두대의 처형인", tier: 4, kind: "trait", effect: "executeThreshold", value: 0.25, maxOwned: 1, description: "체력 25% 이하인 일반/엘리트 적을 타격 시 즉사 (보스는 1.5배 피해)" },
  trait_infinite_resonance_flurry: { id: "trait_infinite_resonance_flurry", name: "무한 연타의 잔향 폭풍", tier: 4, kind: "trait", effect: "contactFourHitsBonus", value: 2, maxOwned: 1, description: "접촉 공격으로 4회 이상 타격 성공 시 2 AP 충전 + 카드 2장 드로우 (턴당 1회)" },
  trait_sillage_supernova_collapse: { id: "trait_sillage_supernova_collapse", name: "천상의 초신성 붕괴", tier: 4, kind: "trait", effect: "nonContactKillSupernova", value: 15, maxOwned: 2, description: "비접촉으로 적 처치 시 남은 모든 적에게 장당 15의 방어 무시 폭발" },
  trait_prismatic_hyper_beam: { id: "trait_prismatic_hyper_beam", name: "초임계 무지개 굴절광", tier: 4, kind: "trait", effect: "bypassShieldAmplify", value: 0.5, maxOwned: 2, description: "방어막 무시 공격 카드로 입히는 실제 피해량이 장당 +50% 배율 폭증" },
  trait_unbreakable_diamond_casing: { id: "trait_unbreakable_diamond_casing", name: "부서지지 않는 금강 외벽", tier: 4, kind: "trait", effect: "diamondShieldImmunity", value: 5, maxOwned: 1, description: "턴 종료 시 모든 방어막이 100% 보존되며 턴 시작 시 방어막 +5 추가 획득" },
  trait_retaliatory_nova: { id: "trait_retaliatory_nova", name: "절대 반사 신성", tier: 4, kind: "trait", effect: "thornsNovaMultiplier", value: 2.0, maxOwned: 1, description: "가시 반사 피해가 200%(3배)로 극대 증폭되며 적 전체에게 반사" },
  trait_pure_protection_domain: { id: "trait_pure_protection_domain", name: "완전 무결한 성역", tier: 4, kind: "trait", effect: "permanentProtection", value: 1, maxOwned: 1, description: "전투 내내 보호(protection) 1스택이 영구적으로 상시 유지" },
  trait_shield_to_blade_transmute: { id: "trait_shield_to_blade_transmute", name: "방패의 검신 연금술", tier: 4, kind: "trait", effect: "endTurnShieldAttack", value: 0.2, maxOwned: 1, description: "턴 종료 시 방어막 20 이상이면 현재 방어막의 20%만큼 무작위 적 자동 타격" },
  trait_godhead_olfactive_trinity: { id: "trait_godhead_olfactive_trinity", name: "삼위일체의 신성 화음", tier: 4, kind: "trait", effect: "harmonyReplayBothCards", value: 1, maxOwned: 1, description: "하모니 완성 시 사용된 Top과 Middle 카드 2장을 둘 다 무료 즉시 재발동" },
  trait_eternal_sillage_storm: { id: "trait_eternal_sillage_storm", name: "영겁의 잔향 폭풍", tier: 4, kind: "trait", effect: "harmonyDebuffStorm", value: 1, maxOwned: 1, description: "하모니 완성 시 살아있는 모든 적에게 취약 2, 부식 5, 연소 5 동시 부여" },
  trait_transcendent_tempo_master: { id: "trait_transcendent_tempo_master", name: "초월적 조향의 마에스트로", tier: 4, kind: "trait", effect: "chanceFullApRefund", value: 0.3, maxOwned: 1, description: "1코스트 이상 카드 사용 시 30% 확률로 사용한 AP 즉시 전액 환급" },
};

const roomForTier = (tier) => tier === 1 ? "gather" : tier === 2 ? "golden" : "boss";

export const BENEFICIAL_TRAITS = Object.fromEntries(
  Object.entries(RAW_BENEFICIAL_TRAITS).map(([id, trait]) => [id, {
    ...trait, tier: trait.tier - 1, room: roomForTier(trait.tier), passive: true, stackable: true, image: null,
  }]),
);

const RAW_CURSE_TRAITS = {
  // ==========================================
  // [1티어 해로운 특성 - 20종]
  // ==========================================
  curse_trait_oily_slippage: { id: "curse_trait_oily_slippage", name: "미끄러운 오일 잔여물", tier: 1, kind: "curse", effect: "oilDiscardChance", value: 0.3, maxOwned: 2, description: "오일 카드 사용 시 30% 확률로 손패 1장 무작위 버림" },
  curse_trait_volatile_fume_cough: { id: "curse_trait_volatile_fume_cough", name: "자극성 증기 기침", tier: 1, kind: "curse", effect: "nonContactSelfBurn", value: 1, maxOwned: 2, description: "비접촉 공격 카드 사용 시 플레이어에게 연소 1 부여" },
  curse_trait_glass_recoil: { id: "curse_trait_glass_recoil", name: "유리 파편 반동", tier: 1, kind: "curse", effect: "contactSelfBleed", value: 1, maxOwned: 2, description: "접촉 공격 카드 사용 시 플레이어에게 출혈 1 부여" },
  curse_trait_corroded_glove: { id: "curse_trait_corroded_glove", name: "부식된 가죽 장갑", tier: 1, kind: "curse", effect: "zeroCostSelfDamage", value: 1, maxOwned: 2, description: "0 AP 카드를 사용할 때마다 체력 1 자해 피해" },
  curse_trait_heavy_sediment: { id: "curse_trait_heavy_sediment", name: "가라앉은 침전물", tier: 1, kind: "curse", effect: "extraAbsorbDecay", value: 3, maxOwned: 3, description: "턴 종료 시 장당 흡수 3을 추가로 증발시킴" },
  curse_trait_brittle_shell: { id: "curse_trait_brittle_shell", name: "부서지기 쉬운 껍질", tier: 1, kind: "curse", effect: "hitShieldExtraLoss", value: 2, maxOwned: 3, description: "피격당할 때마다 내 방어막이 장당 2 추가 차감" },
  curse_trait_clogged_dropper: { id: "curse_trait_clogged_dropper", name: "막혀가는 스포이트", tier: 1, kind: "curse", effect: "turn1DrawPenalty", value: 1, maxOwned: 1, description: "전투 첫 턴의 시작 드로우가 1장 감소" },
  curse_trait_unstable_solvent: { id: "curse_trait_unstable_solvent", name: "불안정한 용매", tier: 1, kind: "curse", effect: "discardSelfDamage", value: 1, maxOwned: 2, description: "손패가 버려질 때마다 장당 1의 자해 피해" },
  curse_trait_scattered_notes: { id: "curse_trait_scattered_notes", name: "뒤엉킨 시향 노트", tier: 1, kind: "curse", effect: "harmonyDamagePenalty", value: 3, maxOwned: 2, description: "하모니 발동 시 기본 효과가 장당 -3 감소" },
  curse_trait_dull_scent_memory: { id: "curse_trait_dull_scent_memory", name: "둔화된 후각 기억", tier: 1, kind: "curse", effect: "startWithImpurity", value: 1, maxOwned: 2, description: "전투 시작 시 버린 카드 더미에 불순물 1장 주입" },
  curse_trait_stagnant_air: { id: "curse_trait_stagnant_air", name: "정체된 공기", tier: 1, kind: "curse", effect: "thirdCardZeroAp", value: 1, maxOwned: 1, description: "한 턴에 카드를 3장 쓰는 순간 남은 AP가 즉시 0이 됨" },
  curse_trait_flinching_muscle: { id: "curse_trait_flinching_muscle", name: "움츠러드는 근육", tier: 1, kind: "curse", effect: "enemyShieldOnAttack", value: 2, maxOwned: 2, description: "공격 카드 사용 시 타격 전 적에게 방어막 2 먼저 제공" },
  curse_trait_acidic_sweat: { id: "curse_trait_acidic_sweat", name: "산성 땀방울", tier: 1, kind: "curse", effect: "turnStartShieldLoss", value: 3, maxOwned: 2, description: "턴 시작 시 전 턴에서 이월된 방어막이 장당 3 감소" },
  curse_trait_impaired_coordination: { id: "curse_trait_impaired_coordination", name: "조율 장애", tier: 1, kind: "curse", effect: "topNoteShieldHalf", value: 0.5, maxOwned: 1, description: "Top 노트 카드를 낸 턴에는 방어막 획득량이 50%로 반토막" },
  curse_trait_fragile_pipette: { id: "curse_trait_fragile_pipette", name: "취약한 피펫", tier: 1, kind: "curse", effect: "multiHitDamagePenalty", value: 1, maxOwned: 2, description: "2연타 이상 공격 카드의 매 타격마다 피해 장당 -1" },
  curse_trait_overflow_leakage: { id: "curse_trait_overflow_leakage", name: "과열 오버플로우 누출", tier: 1, kind: "curse", effect: "healAbsorbLoss", value: 5, maxOwned: 2, description: "체력을 회복할 때마다 저장된 흡수 게이지가 5 소실" },
  curse_trait_lethargic_pulse: { id: "curse_trait_lethargic_pulse", name: "무기력한 맥박", tier: 1, kind: "curse", effect: "victoryGoldPenalty", value: 3, maxOwned: 3, description: "전투 승리 시 획득하는 골드가 장당 -3 감소 (최소 0)" },
  curse_trait_choking_smoke: { id: "curse_trait_choking_smoke", name: "질식하는 연기", tier: 1, kind: "curse", effect: "heavyCardSelfWeak", value: 1, maxOwned: 2, description: "2코스트 이상 공격 카드 사용 시 플레이어에게 약화 1 부여" },
  curse_trait_paraffin_stiffness: { id: "curse_trait_paraffin_stiffness", name: "굳어버린 파라핀 관절", tier: 1, kind: "curse", effect: "firstGuardCostUp", value: 1, maxOwned: 1, description: "턴에 처음 사용하는 방어 카드의 비용이 +1 AP 증가" },
  curse_trait_trembling_breath: { id: "curse_trait_trembling_breath", name: "가쁜 호흡", tier: 1, kind: "curse", effect: "handSizePenalty", value: 1, maxOwned: 1, description: "최대 손패 소지 상한이 6장으로 -1장 영구 감소" },
  // ==========================================
  // [2티어 해로운 특성 - 17종]
  // ==========================================
  curse_trait_solvent_toxification: { id: "curse_trait_solvent_toxification", name: "용매 중독 증세", tier: 2, kind: "curse", effect: "absorbCardSelfCorrosion", value: 1, maxOwned: 2, description: "흡수 카드 사용 시마다 플레이어에게 부식 1 누적" },
  curse_trait_heavy_shackle_pestle: { id: "curse_trait_heavy_shackle_pestle", name: "무거운 쇠사슬 유발", tier: 2, kind: "curse", effect: "contactCostUp", value: 1, maxOwned: 1, description: "모든 접촉 공격 카드의 비용이 +1 AP 증가" },
  curse_trait_backfiring_diffuser: { id: "curse_trait_backfiring_diffuser", name: "역류하는 디퓨저 노즐", tier: 2, kind: "curse", effect: "nonContactEnemyShield", value: 4, maxOwned: 2, description: "비접촉 카드 사용 시 모든 적에게 방어막 장당 4 무료 충전" },
  curse_trait_porous_rot: { id: "curse_trait_porous_rot", name: "썩어가는 다공질", tier: 2, kind: "curse", effect: "endTurnShieldHalfLoss", value: 0.5, maxOwned: 1, description: "턴 종료 시 남은 방어막의 절반(50%)을 강제 소멸" },
  curse_trait_blood_attraction: { id: "curse_trait_blood_attraction", name: "피를 부르는 향기", tier: 2, kind: "curse", effect: "enemyAttackBuff", value: 1, maxOwned: 2, description: "적이 공격할 때마다 적에게 영구 공격력 +1 버프 부여" },
  curse_trait_censer_burnout: { id: "curse_trait_censer_burnout", name: "향로의 산소 고갈", tier: 2, kind: "curse", effect: "heavyTurnNextApLoss", value: 1, maxOwned: 1, description: "한 턴에 카드를 3장 초과해 사용하면 다음 턴 AP -1 감소" },
  curse_trait_polluted_pipette: { id: "curse_trait_polluted_pipette", name: "오염된 피펫 침출", tier: 2, kind: "curse", effect: "drawImpurityChance", value: 0.2, maxOwned: 1, description: "카드를 드로우할 때마다 20% 확률로 불순물 카드가 끼어듦" },
  curse_trait_shattered_confidence: { id: "curse_trait_shattered_confidence", name: "깨진 조향사의 신념", tier: 2, kind: "curse", effect: "hitDamagePenalty", value: 2, maxOwned: 2, description: "체력 피해를 입을 때마다 이번 턴 가하는 피해 장당 -2 감소" },
  curse_trait_leaking_oil_cask: { id: "curse_trait_leaking_oil_cask", name: "새어나가는 오일통", tier: 2, kind: "curse", effect: "oilCardSelfDamage", value: 2, maxOwned: 2, description: "오일 카드를 발동할 때마다 장당 체력 2의 자해 피해" },
  curse_trait_olfactive_discord: { id: "curse_trait_olfactive_discord", name: "불협화음의 저주", tier: 2, kind: "curse", effect: "harmonySelfVulnerable", value: 1, maxOwned: 1, description: "하모니 발동 시 플레이어 자신에게 취약 1 부여" },
  curse_trait_corrosive_perspiration: { id: "curse_trait_corrosive_perspiration", name: "부식성 분비물", tier: 2, kind: "curse", effect: "shieldBreakEnemyRegen", value: 2, maxOwned: 2, description: "내 방어막이 완전히 깨질 때 모든 적에게 재생 2 부여" },
  curse_trait_dead_weight_resin: { id: "curse_trait_dead_weight_resin", name: "납덩이 수지", tier: 2, kind: "curse", effect: "lockRandomCardTurn", value: 1, maxOwned: 1, description: "매 턴 시작 시 손패 무작위 카드 1장에 이번 턴 사용 불가 락 부여" },
  curse_trait_numbing_vapor: { id: "curse_trait_numbing_vapor", name: "감각 마비 증기", tier: 2, kind: "curse", effect: "zeroCostTax", value: 1, maxOwned: 1, description: "모든 0코스트 카드를 쓸 때마다 1 AP를 강제로 추가 소모" },
  curse_trait_feverish_metabolism: { id: "curse_trait_feverish_metabolism", name: "과열된 혈류 대사", tier: 2, kind: "curse", effect: "consumeBurnEnemyHeal", value: 5, maxOwned: 1, description: "턴 종료 시 적의 연소 스택 1을 지우고 적 체력 5 회복" },
  curse_trait_mercenary_extortion: { id: "curse_trait_mercenary_extortion", name: "용병 길드의 상납금", tier: 2, kind: "curse", effect: "enterRoomGoldLoss", value: 5, maxOwned: 2, description: "새로운 방에 진입할 때마다 통행세로 장당 골드 -5 차감" },
  curse_trait_brittle_veins: { id: "curse_trait_brittle_veins", name: "취약한 유리 혈관", tier: 2, kind: "curse", effect: "enemyBleedMirror", value: 1, maxOwned: 1, description: "적에게 출혈 피해가 터질 때 플레이어도 동일 수치 피해를 입음" },
  curse_trait_dampened_resonance: { id: "curse_trait_dampened_resonance", name: "먹먹해진 음향", tier: 2, kind: "curse", effect: "buffNullifyChance", value: 0.5, maxOwned: 1, description: "플레이어가 버프를 획득할 때 50% 확률로 획득 무효화" },
  // ==========================================
  // [3티어 해로운 특성 - 13종]
  // ==========================================
  curse_trait_abyssal_parasite: { id: "curse_trait_abyssal_parasite", name: "심연의 기생충", tier: 3, kind: "curse", effect: "endTurnAddImpurity", value: 1, maxOwned: 1, description: "전투 중 매 턴 종료 시마다 버린 카드 더미에 불순물 1장 무한 주입" },
  curse_trait_zero_point_freeze: { id: "curse_trait_zero_point_freeze", name: "절대영도 동결 마비", tier: 3, kind: "curse", effect: "turnStartApPenalty", value: 1, maxOwned: 1, description: "매 턴 시작 AP가 영구적으로 -1 감소 (기본 3 ➔ 2 AP)" },
  curse_trait_combustion_backdraft: { id: "curse_trait_combustion_backdraft", name: "역류하는 화염 폭풍", tier: 3, kind: "curse", effect: "burningBackfireRatio", value: 0.5, maxOwned: 1, description: "적에게 터지는 모든 연소 피해의 50%를 플레이어가 직접 맞음" },
  curse_trait_shattered_shield_core: { id: "curse_trait_shattered_shield_core", name: "산산조각 난 방패 코어", tier: 3, kind: "curse", effect: "shieldCapLimit", value: 25, maxOwned: 1, description: "전투 중 내 방어막이 25를 절대 초과할 수 없음" },
  curse_trait_ap_siphon_curse: { id: "curse_trait_ap_siphon_curse", name: "마력을 갉아먹는 종양", tier: 3, kind: "curse", effect: "everyTwoCardsApLoss", value: 1, maxOwned: 1, description: "카드를 2장 쓸 때마다 남은 사용 가능 AP 중 1 AP 강제 소실" },
  curse_trait_blind_frenzy: { id: "curse_trait_blind_frenzy", name: "맹목의 살인 광란", tier: 3, kind: "curse", effect: "forceRandomTarget", value: 1, maxOwned: 1, description: "모든 단일 대상 공격 카드가 무작위 적을 강제로 타격" },
  curse_trait_caustic_blood: { id: "curse_trait_caustic_blood", name: "부식성 혈액", tier: 3, kind: "curse", effect: "hitPermanentMaxHpLoss", value: 1, maxOwned: 1, description: "몬스터에게 피격 시마다 최대 체력이 영구적으로 -1씩 감소" },
  curse_trait_decaying_absorb_blackhole: { id: "curse_trait_decaying_absorb_blackhole", name: "흡수 블랙홀", tier: 3, kind: "curse", effect: "endTurnAbsorbZeroReset", value: 1, maxOwned: 1, description: "턴 종료 시 남아있는 모든 흡수 게이지를 무조건 0으로 전량 소멸" },
  curse_trait_boss_frenzy_catalyst: { id: "curse_trait_boss_frenzy_catalyst", name: "폭주의 촉매", tier: 3, kind: "curse", effect: "bossEnrageTurnAdvance", value: 2, maxOwned: 1, description: "보스들의 광폭화 및 폭주 관통 피해 시작 턴이 2턴 앞당겨짐" },
  curse_trait_vampiric_enemies: { id: "curse_trait_vampiric_enemies", name: "적들의 흡혈 본능", tier: 3, kind: "curse", effect: "enemyLeechAmount", value: 3, maxOwned: 2, description: "적이 플레이어 공격 성공 시 체력 장당 3을 흡혈 회복" },
  curse_trait_crippled_card_draw: { id: "curse_trait_crippled_card_draw", name: "불구의 서고", tier: 3, kind: "curse", effect: "fixedDrawTwoCards", value: 2, maxOwned: 1, description: "모든 드로우 효과를 무시하고 매 턴 무조건 2장만 드로우" },
  curse_trait_double_debuff_agony: { id: "curse_trait_double_debuff_agony", name: "두 배의 고통", tier: 3, kind: "curse", effect: "doubleIncomingDebuffs", value: 2, maxOwned: 1, description: "플레이어가 받는 중독, 출혈, 부식, 연소 스택이 2배로 폭증" },
  curse_trait_greed_bankruptcy: { id: "curse_trait_greed_bankruptcy", name: "탐욕의 파산 선고", tier: 3, kind: "curse", effect: "shopCostTriple", value: 3, maxOwned: 1, description: "아틀리에 상점의 모든 상품 가격이 3배로 폭등" },
  // ==========================================
  // [4티어 해로운 특성 - 5종]
  // ==========================================
  curse_trait_damocles_guillotine: { id: "curse_trait_damocles_guillotine", name: "다모클레스의 단두대", tier: 4, kind: "curse", effect: "hitInstaDeathChance", value: 0.1, maxOwned: 1, description: "체력 피해를 입을 때마다 10% 확률로 즉사(게임오버)" },
  curse_trait_the_lost_vow: { id: "curse_trait_the_lost_vow", name: "상실자의 맹세", tier: 4, kind: "curse", effect: "zeroShieldLock", value: 1, maxOwned: 1, description: "전투 중 어떠한 수단으로도 방어막을 얻을 수 없음 (실드 0 고정)" },
  curse_trait_entrophic_extinction: { id: "curse_trait_entrophic_extinction", name: "엔트로피 종말 시계", tier: 4, kind: "curse", effect: "fiveTurnsDeathLimit", value: 5, maxOwned: 1, description: "모든 전투에서 5턴이 종료되는 순간 즉사 (타임어택 챌린지)" },
  curse_trait_blood_tithe_tribute: { id: "curse_trait_blood_tithe_tribute", name: "피의 십일조 계약", tier: 4, kind: "curse", effect: "cardHpCost", value: 2, maxOwned: 1, description: "카드를 1장 사용할 때마다 체력 2를 추가로 강제 소모" },
  curse_trait_abyssal_mirror_puppet: { id: "curse_trait_abyssal_mirror_puppet", name: "심연의 도플갱어 꼭두각시", tier: 4, kind: "curse", effect: "enemyCardMirror", value: 1, maxOwned: 1, description: "턴 종료 시 내가 쓴 카드 중 가장 강한 1장을 적이 나에게 복제 시전" },
};

const roomForTier = (tier) => tier === 1 ? "gather" : tier === 2 ? "golden" : "boss";

export const CURSE_TRAITS = Object.fromEntries(
  Object.entries(RAW_CURSE_TRAITS).map(([id, trait]) => [id, {
    ...trait,
    tier: trait.tier - 1,
    room: roomForTier(trait.tier),
    passive: true,
    stackable: true,
    curseTrait: true,
    image: null,
  }]),
);

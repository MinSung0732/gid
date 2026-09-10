const RAW_OFFICIAL_RELICS = {
  // ==========================================
  // [1티어 유물 - 30종]
  // ==========================================
  relic_broken_flacon_base: { id: "relic_broken_flacon_base", name: "깨진 시약병 바닥", tier: 1, kind: "relic", effect: "firstDiscardShield", value: 2, maxOwned: 1, passive: true, image: null, description: "매 턴 처음으로 카드를 버릴 때 방어막 +2 획득" },
  relic_scented_paperweight: { id: "relic_scented_paperweight", name: "방향성 문진 조각", tier: 1, kind: "relic", effect: "deckSize", value: 2, maxOwned: 1, passive: true, image: null, description: "최대 덱 보관 상한이 +2장 확장됩니다." },
  relic_pocket_scent_blotter: { id: "relic_pocket_scent_blotter", name: "주머니 속 마른 시향지", tier: 1, kind: "relic", effect: "turn1DrawChance", value: 0.3, maxOwned: 1, passive: true, image: null, description: "전투 첫 턴에 30% 확률로 카드 1장을 추가 드로우합니다." },
  relic_copper_pipette_clip: { id: "relic_copper_pipette_clip", name: "구리 피펫 걸이", tier: 1, kind: "relic", effect: "apCap", value: 1, maxOwned: 1, passive: true, image: null, description: "최대 AP 보관 한도를 +1 늘려줍니다." },
  relic_travelers_cork_stopper: { id: "relic_travelers_cork_stopper", name: "여행자의 낡은 코르크 마개", tier: 1, kind: "relic", effect: "potionSlot", value: 1, maxOwned: 1, passive: true, image: null, description: "물약 소지 슬롯이 +1칸 늘어납니다." },
  relic_dusty_sample_case: { id: "relic_dusty_sample_case", name: "먼지 쌓인 샘플 케이스", tier: 1, kind: "relic", effect: "shopRerollDiscount", value: 1, maxOwned: 1, passive: true, image: null, description: "상점의 첫 번째 새로고침(리롤)을 무료로 제공합니다." },
  relic_dim_candle_stub: { id: "relic_dim_candle_stub", name: "가물거리는 촛토막", tier: 1, kind: "relic", effect: "roomClearTorch", value: 3, maxOwned: 1, passive: true, image: null, description: "새로운 방을 클리어할 때마다 바닥에서 3골드를 발견합니다." },
  relic_used_filter_paper: { id: "relic_used_filter_paper", name: "한 번 쓴 거름종이", tier: 1, kind: "relic", effect: "absorbDecaySoftener", value: 1, maxOwned: 1, passive: true, image: null, description: "전투 첫 번째 턴 종료 시 흡수 감쇄를 1회 면제합니다." },
  relic_bent_tweezers: { id: "relic_bent_tweezers", name: "휘어진 금속 핀셋", tier: 1, kind: "relic", effect: "impurityDrawPush", value: 1, maxOwned: 1, passive: true, image: null, description: "손패에 불순물이 들어오면 카드 1장을 즉시 추가로 뽑습니다." },
  relic_fragrant_handkerchief: { id: "relic_fragrant_handkerchief", name: "향기 나는 손수건", tier: 1, kind: "relic", effect: "fleeBonusGold", value: 10, maxOwned: 1, passive: true, image: null, description: "특정 이벤트에서 통과를 선택할 때 위로금 10골드를 얻습니다." },
  relic_dull_mortar_pestle: { id: "relic_dull_mortar_pestle", name: "마모된 초미니 막자", tier: 1, kind: "relic", effect: "firstStrikeBonus", value: 2, maxOwned: 1, passive: true, image: null, description: "매 전투 가하는 첫 번째 공격 피해가 +2 증가합니다." },
  relic_faded_recipe_scrap: { id: "relic_faded_recipe_scrap", name: "빛바랜 조향 레시피 쪽지", tier: 1, kind: "relic", effect: "labCostDiscount", value: 5, maxOwned: 1, passive: true, image: null, description: "증류 배합대(Lab) 이용 비용을 5골드 할인받습니다." },
  relic_rough_stone_coaster: { id: "relic_rough_stone_coaster", name: "거친 숫돌 받침", tier: 1, kind: "relic", effect: "thornsFlat1", value: 1, maxOwned: 1, passive: true, image: null, description: "매 전투 시작 시 플레이어에게 가시 1스택을 부여합니다." },
  relic_empty_perfume_flacon: { id: "relic_empty_perfume_flacon", name: "비어있는 미니어처 향수병", tier: 1, kind: "relic", effect: "chestExtraGold", value: 5, maxOwned: 1, passive: true, image: null, description: "보물 상자를 열 때마다 5골드를 추가로 챙깁니다." },
  relic_dry_moss_pouch: { id: "relic_dry_moss_pouch", name: "바싹 마른 이끼 주머니", tier: 1, kind: "relic", effect: "restSiteOverheal", value: 5, maxOwned: 1, passive: true, image: null, description: "휴식처를 이용한 뒤 다음 전투 진입 시 개막 방어막 +5 획득." },
  relic_chipped_dropper_bulb: { id: "relic_chipped_dropper_bulb", name: "뜯겨진 고무 스포이트 꼭지", tier: 1, kind: "relic", effect: "absorbGainFlat1", value: 0.1, maxOwned: 1, passive: true, image: null, description: "흡수를 얻을 때마다 10% 확률로 +1 더 얻습니다." },
  relic_copper_thimble: { id: "relic_copper_thimble", name: "녹슨 구리 골무", tier: 1, kind: "relic", effect: "firstHitBlock", value: 2, maxOwned: 1, passive: true, image: null, description: "매 전투 처음 피격당할 때 입는 피해를 2 경감합니다." },
  relic_wax_carving_knife: { id: "relic_wax_carving_knife", name: "뭉툭한 왁스 조각도", tier: 1, kind: "relic", effect: "cardTransformReroll", value: 2, maxOwned: 1, passive: true, image: null, description: "전투 보상에서 카드를 건너뛸 때마다 체력 2를 회복합니다." },
  relic_old_incense_matches: { id: "relic_old_incense_matches", name: "눅눅한 성냥갑", tier: 1, kind: "relic", effect: "combatStartBurn1", value: 1, maxOwned: 1, passive: true, image: null, description: "전투 시작 시 무작위 적 1체에게 연소 1을 부여합니다." },
  relic_cracked_hourglass: { id: "relic_cracked_hourglass", name: "모래가 새는 모래시계", tier: 1, kind: "relic", effect: "turnTimerIndicator", value: 1, maxOwned: 1, passive: true, image: null, description: "턴 종료 시 남은 손패가 0장이라면 방어막 +1을 획득합니다." },
  relic_leather_strap_sheath: { id: "relic_leather_strap_sheath", name: "가죽 끈 시약병 집", tier: 1, kind: "relic", effect: "handSize", value: 1, maxOwned: 1, passive: true, image: null, description: "최대 손패 소지 상한(기본 7장)이 +1장 늘어납니다." },
  relic_mini_notebook_clip: { id: "relic_mini_notebook_clip", name: "조향 수첩 미니 클립", tier: 1, kind: "relic", effect: "turn1Draw", value: 1, maxOwned: 1, passive: true, image: null, description: "전투 첫 턴 시작 시 카드 +1장을 추가 드로우합니다." },
  relic_extra_pipette_stand: { id: "relic_extra_pipette_stand", name: "여분의 아크릴 피펫 스탠드", tier: 1, kind: "relic", effect: "deckSize", value: 2, maxOwned: 1, passive: true, image: null, description: "최대 덱 보관 상한이 +2장 확장됩니다." },
  relic_clover_scent_sachet: { id: "relic_clover_scent_sachet", name: "네잎클로버 압화 향낭", tier: 1, kind: "relic", effect: "rareCardChance", value: 0.05, maxOwned: 1, passive: true, image: null, description: "카드 보상 시 2티어 카드 등장 확률이 +5% 증가합니다." },
  relic_brass_pocket_balance: { id: "relic_brass_pocket_balance", name: "손바닥 황동 천칭", tier: 1, kind: "relic", effect: "shopCardDiscount", value: 5, maxOwned: 1, passive: true, image: null, description: "상점의 카드 제거 비용이 5골드 영구 할인됩니다." },
  relic_amber_rosin_crumb: { id: "relic_amber_rosin_crumb", name: "송진 가루 부스러기", tier: 1, kind: "relic", effect: "firstTurnContact", value: 2, maxOwned: 1, passive: true, image: null, description: "전투 첫 턴에 사용하는 접촉 공격 카드의 피해가 +2 증가합니다." },
  relic_glass_funnel_tip: { id: "relic_glass_funnel_tip", name: "작은 유리 깔때기 팁", tier: 1, kind: "relic", effect: "openingAbsorb", value: 4, maxOwned: 1, passive: true, image: null, description: "전투 시작 시 흡수 +4를 충전하고 시작합니다." },
  relic_wax_seal_stamp: { id: "relic_wax_seal_stamp", name: "조향 길드 실링 스탬프", tier: 1, kind: "relic", effect: "openingShield", value: 3, maxOwned: 1, passive: true, image: null, description: "전투 첫 턴 시작 시 방어막 +3을 추가로 얻습니다." },
  relic_dried_chamomile_flower: { id: "relic_dried_chamomile_flower", name: "말린 카모마일 한 송이", tier: 1, kind: "relic", effect: "battleEndHeal", value: 2, maxOwned: 1, passive: true, image: null, description: "전투 승리 시 체력 +2를 즉시 회복합니다." },
  relic_scented_candle_wick: { id: "relic_scented_candle_wick", name: "그을린 목화 심지 조각", tier: 1, kind: "relic", effect: "burningDurationFlat", value: 0.2, maxOwned: 1, passive: true, image: null, description: "적에게 연소 부여 시 20% 확률로 1스택 추가 부여합니다." },
  // ==========================================
  // [3티어 유물 - 17종]
  // ==========================================
  relic_spacious_scent_pouch: { id: "relic_spacious_scent_pouch", name: "넉넉한 조향 시향지 보관함", tier: 3, kind: "relic", effect: "draw", value: 1, maxOwned: 1, passive: true, image: null, description: "매 턴 시작 시 카드를 +1장 추가로 드로우합니다." },
  relic_expanded_atelier_case: { id: "relic_expanded_atelier_case", name: "확장된 아틀리에 수납함", tier: 3, kind: "relic", effect: "deckSize", value: 5, maxOwned: 1, passive: true, image: null, description: "최대 덱 보관 상한이 +5장 대폭 확장됩니다." },
  relic_opening_ambush_blotter: { id: "relic_opening_ambush_blotter", name: "개막 기습의 넓은 시향포", tier: 3, kind: "relic", effect: "turn1Draw", value: 2, maxOwned: 1, passive: true, image: null, description: "전투 첫 턴 시작 시 카드를 +2장 추가로 드로우합니다." },
  relic_ergonomic_perfume_bandolier: { id: "relic_ergonomic_perfume_bandolier", name: "인체공학적 향수 밴돌리어", tier: 3, kind: "relic", effect: "handSize", value: 2, maxOwned: 1, passive: true, image: null, description: "최대 손패 소지 상한이 +2장 늘어납니다. (최대 9장)" },
  relic_perpetual_alembic_coil: { id: "relic_perpetual_alembic_coil", name: "영구 알렘빅 냉각 코일", tier: 3, kind: "relic", effect: "shieldRetainPercent", value: 0.4, maxOwned: 1, passive: true, image: null, description: "턴 종료 시 방어막의 40%를 다음 턴으로 이월 보존합니다." },
  relic_golden_pipette_junior: { id: "relic_golden_pipette_junior", name: "정밀 정제 미니 피펫", tier: 3, kind: "relic", effect: "impurityApRefund", value: 1, maxOwned: 1, passive: true, image: null, description: "손패에 불순물 드로우 시 1 AP 충전 + 카드 1장 다시 뽑기" },
  relic_supercritical_storage_ampoule: { id: "relic_supercritical_storage_ampoule", name: "초임계 저장 앰플", tier: 3, kind: "relic", effect: "turnStartAbsorb", value: 8, maxOwned: 1, passive: true, image: null, description: "매 턴 시작 시 흡수 +8을 자동으로 충전합니다." },
  relic_merchants_diplomatic_seal: { id: "relic_merchants_diplomatic_seal", name: "상인 길드의 외교 인장", tier: 3, kind: "relic", effect: "shopAllDiscount", value: 0.3, maxOwned: 1, passive: true, image: null, description: "아틀리에 상점의 모든 물품 및 제거 비용이 30% 영구 할인됩니다." },
  relic_transmuting_crucible: { id: "relic_transmuting_crucible", name: "원소 변환 도가니", tier: 3, kind: "relic", effect: "autoUpgradeBasicStrike", value: 1, maxOwned: 1, passive: true, image: null, description: "방 2개 클리어 시 기본 타격 1장을 강화 카드로 자동 변환합니다." },
  relic_eternal_incense_censer: { id: "relic_eternal_incense_censer", name: "꺼지지 않는 유향 향로", tier: 3, kind: "relic", effect: "startCombatBurnAll", value: 3, maxOwned: 1, passive: true, image: null, description: "전투 시작 시 적 전체에게 연소 3을 확정 부여합니다." },
  relic_resonant_glass_bell: { id: "relic_resonant_glass_bell", name: "공명하는 크리스탈 종", tier: 3, kind: "relic", effect: "harmonyIntimidateAll", value: 3, maxOwned: 1, passive: true, image: null, description: "하모니 발동 시 적 전체에게 위축 3을 부여합니다." },
  relic_dewdrop_collector_funnel: { id: "relic_dewdrop_collector_funnel", name: "이슬받이 깔때기", tier: 3, kind: "relic", effect: "regen", value: 2, maxOwned: 1, passive: true, image: null, description: "매 턴 시작 시 체력 +2를 영구적으로 지속 회복합니다." },
  relic_alchemists_pocket_watch: { id: "relic_alchemists_pocket_watch", name: "연금술사의 회중시계", tier: 3, kind: "relic", effect: "bossEliteTurn1Ap", value: 1, maxOwned: 1, passive: true, image: null, description: "엘리트 및 보스전 시작 시 첫 턴 AP +1을 추가 충전합니다." },
  relic_mirror_of_duplication: { id: "relic_mirror_of_duplication", name: "조향 복제의 거울", tier: 3, kind: "relic", effect: "treasureRoomCardDuplication", value: 1, maxOwned: 1, passive: true, image: null, description: "보물방 진입 시 보유 카드 1장을 무료 복제할 수 있습니다." },
  relic_crystalline_thorn_core: { id: "relic_crystalline_thorn_core", name: "결정화된 가시 코어", tier: 3, kind: "relic", effect: "startCombatThornsAndShield", value: 4, maxOwned: 1, passive: true, image: null, description: "전투 개막 시 가시 4와 개막 방어막 +6을 동시 획득합니다." },
  relic_infinite_oil_cruet: { id: "relic_infinite_oil_cruet", name: "무한 오일 크루엣", tier: 3, kind: "relic", effect: "firstOilCardFree", value: 1, maxOwned: 1, passive: true, image: null, description: "매 턴 처음 사용하는 오일 카드의 비용이 0 AP로 고정됩니다." },
  relic_pyramid_mastery_prism: { id: "relic_pyramid_mastery_prism", name: "피라미드 조향 프리즘", tier: 3, kind: "relic", effect: "harmonyReplayCard", value: 1, maxOwned: 1, passive: true, image: null, description: "하모니 완성 시 사용된 카드 중 1장을 무료 즉시 재발동합니다." },
  // ==========================================
  // [4티어 전설 유물 - 6종]
  // ==========================================
  relic_philosophers_mercury_still: { id: "relic_philosophers_mercury_still", name: "현자의 수은 증류기", tier: 4, kind: "relic", effect: "turnBaseAp", value: 1, maxOwned: 1, passive: true, image: null, description: "모든 턴 시작 AP가 영구적으로 +1 증가합니다. (기본 3 ➔ 4 AP)" },
  relic_infinite_fragrance_reservoir: { id: "relic_infinite_fragrance_reservoir", name: "무한 향기의 저수조", tier: 4, kind: "relic", effect: "draw", value: 2, maxOwned: 1, passive: true, image: null, description: "매 턴 시작 시 카드를 +2장 추가로 드로우합니다." },
  relic_aegis_of_the_eternal_wax: { id: "relic_aegis_of_the_eternal_wax", name: "영겁 밀랍의 이지스", tier: 4, kind: "relic", effect: "permanentShieldRetain", value: 1, maxOwned: 1, passive: true, image: null, description: "턴이 종료되어도 플레이어의 방어막이 100% 영구 보존됩니다." },
  relic_chimeric_alembic: { id: "relic_chimeric_alembic", name: "키메라의 알렘빅", tier: 4, kind: "relic", effect: "anyThreeCardsHarmony", value: 1, maxOwned: 1, passive: true, image: null, description: "순서 상관없이 아무 카드나 3장 연속 사용 시 하모니가 강제 발동합니다." },
  relic_chronos_sandglass_of_scent: { id: "relic_chronos_sandglass_of_scent", name: "크로노스의 향기 모래시계", tier: 4, kind: "relic", effect: "extraTurnOncePerBattle", value: 1, maxOwned: 1, passive: true, image: null, description: "전투당 1회, 플레이어의 턴 종료 시 적의 턴을 스킵하고 즉시 내 턴을 한 번 더 실행합니다." },
  relic_primordial_essence_heart: { id: "relic_primordial_essence_heart", name: "원초의 에센스 심장", tier: 4, kind: "relic", effect: "reviveFullHpOncePerRun", value: 1, maxOwned: 1, passive: true, image: null, description: "런당 1회, 체력이 0이 되어 사망 시 모든 상태이상을 풀고 체력 100% 풀피로 부활합니다." },
};

const roomForTier = (tier) => tier === 1 ? "gather" : tier === 3 ? "golden" : "boss";

export const OFFICIAL_RELICS = Object.fromEntries(
  Object.entries(RAW_OFFICIAL_RELICS).map(([id, relic]) => [id, {
    ...relic,
    tier: relic.tier - 1,
    room: roomForTier(relic.tier),
    maxOwned: 1,
    passive: true,
    stackable: true,
    image: null,
  }]),
);


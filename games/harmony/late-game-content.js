const monster = (id, name, baseHp, pattern, extra = {}) => ({
  id,
  name,
  material: extra.material || "spirit",
  symbol: extra.symbol || "◆",
  image: null,
  baseHp,
  scaleWithAct: false,
  scaleAttackWithAct: false,
  loopPattern: true,
  patternFixedTurns: pattern.length,
  pattern,
  encounterTags: extra.encounterTags || [],
  forbiddenWith: extra.forbiddenWith || [],
  mechanic: extra.mechanic || null,
  initialStatuses: extra.initialStatuses || undefined,
  intentVisibility: extra.intentVisibility || undefined,
  customState: extra.customState || undefined,
});

const elite = (id, name, baseHp, pattern, extra = {}) => ({
  ...monster(id, name, baseHp, pattern, { ...extra, symbol: "👹" }),
  isElite: true,
});

const boss = (id, name, baseHp, pattern, extra = {}) => ({
  ...monster(id, name, baseHp, pattern, { ...extra, symbol: "💀" }),
  isBoss: true,
  unlockedByDefault: true,
  patternFixedTurns: 8,
});

const attack = (value, attackPattern = "contact", extra = {}) => ({
  type: "attack",
  value,
  attackPattern,
  ...extra,
});
const guard = (value, extra = {}) => ({ type: "guard", value, ...extra });
const debuff = (applyPlayer, extra = {}) => ({ type: "debuff", applyPlayer, ...extra });

export const ACT4_MONSTERS = {
  overheated_condensate: monster("overheated_condensate", "과열 응축체", 70, [
    attack(10, "nonContact", { applyPlayer: { burning: 3 }, name: "고온 증기" }),
    guard(12, { name: "압력 유지" }),
    attack(7, "nonContact", { hits: 2, name: "응축 분사" }),
  ], { material: "gas", encounterTags: ["burnSupplier", "multiHit"] }),
  corrosive_coolant: monster("corrosive_coolant", "부식 냉각액", 74, [
    debuff({ corrosion: 2 }, { name: "산성 누출" }),
    attack(14, "contact", { name: "냉각 충격" }),
    attack(10, "nonContact", { applyPlayer: { weak: 1 }, name: "약화 냉각" }),
  ], { material: "liquid", encounterTags: ["debuffer"] }),
  overpressure_valve: monster("overpressure_valve", "과압 밸브체", 78, [
    guard(8, { name: "압력 축적 I", lateState: { pressureDelta: 1 } }),
    guard(8, { name: "압력 축적 II", lateState: { pressureDelta: 1 } }),
    attack(23, "nonContact", { name: "과압 폭발", lateState: { pressureReset: true } }),
  ], { material: "stone", encounterTags: ["charge"], customState: { pressure: 0 }, mechanic: "pressure2" }),
  fractured_perfume_swarm: monster("fractured_perfume_swarm", "균열 향수병 군집", 68, [
    attack(11, "nonContact"),
    guard(11),
    attack(16, "contact", { name: "불안정 파열", lateState: { scaleByCounter: "instability", values: [16, 16, 19, 22], resetCounter: true } }),
  ], { material: "glass", encounterTags: ["hitReaction"], customState: { instability: 0 }, mechanic: "attackedCounter" }),
  defective_filter: monster("defective_filter", "불량 여과기", 72, [
    guard(12, { allyGuard: 12, name: "여과 지원" }),
    guard(14),
    attack(12, "nonContact"),
  ], { material: "glass", encounterTags: ["support"] }),
  denatured_resin_mass: monster("denatured_resin_mass", "변질 송진 덩어리", 82, [
    guard(16),
    attack(14, "contact"),
    attack(17, "contact", { name: "송진 폭주", lateState: { bonusIf: "rageReady", bonusValue: 5, clearFlag: "rageReady" } }),
  ], { material: "stone", encounterTags: ["shieldReaction"], customState: { rageReady: false }, mechanic: "shieldBreakRage" }),
};

export const ACT4_ELITES = {
  rampaging_still: elite("rampaging_still", "폭주 증류탑", 118, [
    guard(18, { name: "압력 축적", lateState: { pressureDelta: 1 } }),
    attack(16, "nonContact", { name: "압력 분사", lateState: { pressureDelta: 1 } }),
    guard(10, { name: "압력 조정" }),
    attack(26, "nonContact", { name: "임계 폭발", lateState: { pressureReset: true } }),
  ], { material: "stone", encounterTags: ["charge"], customState: { pressure: 0 }, mechanic: "pressure3" }),
  contaminated_perfume_automaton: elite("contaminated_perfume_automaton", "오염된 조향 자동인형", 116, [
    guard(18, { name: "정제 방어" }),
    guard(12, { allyGuard: 8, name: "정제 지원" }),
    attack(13, "contact", { name: "정제 타격" }),
    attack(18, "contact", { name: "폭주 타격" }),
    attack(8, "nonContact", { hits: 2, name: "폭주 분사" }),
    attack(24, "contact", { name: "폭주 강타" }),
  ], { material: "stone", encounterTags: ["mode"], mechanic: "alternatingMode3" }),
  reverse_cooling_tower: elite("reverse_cooling_tower", "역류 냉각탑", 114, [
    debuff({ corrosion: 1 }, { name: "냉각 부식" }),
    guard(12, { name: "역류 준비" }),
    attack(18, "nonContact", { name: "역류 공격", lateState: { playerShieldScaling: [20, 0.25, 40, 0.4] } }),
    guard(16, { name: "냉각" }),
  ], { material: "glass", encounterTags: ["analyzer"], mechanic: "shieldGainAnalyzer" }),
  fractured_pressure_golem: elite("fractured_pressure_golem", "균열 압력 골렘", 124, [
    guard(18),
    attack(17, "contact"),
    guard(16, { name: "균열 판정", lateState: { explodeAtCounter: ["fracture", 3, 25] } }),
    attack(25, "contact"),
  ], { material: "stone", encounterTags: ["hitReaction"], customState: { fracture: 0 }, mechanic: "attackedCounter" }),
};

export const ACT4_BOSSES = {
  scent_devouring_archivist: boss("scent_devouring_archivist", "향을 삼키는 기록관", 190, [
    guard(24, { name: "봉인된 장서" }),
    guard(14, { name: "강제 열람", lateHook: "reserveHandAbsorb" }),
    attack(17, "nonContact", { name: "기록 재현", lateHook: "replayStoredCard" }),
    attack(9, "nonContact", { hits: 2 }),
    attack(18, "contact", { name: "강제 열람 타격", lateHook: "reserveHandAbsorb" }),
    attack(18, "nonContact", { name: "기록 재현", lateHook: "replayStoredCard" }),
    attack(20, "contact", { guard: 12 }),
    attack(28, "nonContact"),
  ], { material: "spirit", encounterTags: ["bossControl"], customState: { storedCard: null }, mechanic: "archivist" }),
  incomplete_refinement_supervisor: boss("incomplete_refinement_supervisor", "불완전한 정제 감독관", 205, [
    guard(20, { name: "검사 기준 설정", lateHook: "setInspection" }),
    attack(17, "contact"),
    attack(14, "nonContact", { name: "검사 판정", lateHook: "inspectionAttack" }),
    guard(22),
    guard(16, { name: "새 검사", lateHook: "setInspection" }),
    attack(18, "nonContact"),
    attack(15, "contact", { name: "검사 판정", lateHook: "inspectionAttack" }),
    attack(29, "nonContact"),
  ], { material: "stone", encounterTags: ["bossAnalyzer"], mechanic: "inspection" }),
};

export const ACT5_MONSTERS = {
  poison_spore_pod: monster("poison_spore_pod", "독향 포자낭", 78, [
    debuff({ poison: 3 }), attack(11, "nonContact"), guard(6, { applyPlayer: { poison: 2 } }),
  ], { material: "liquid", encounterTags: ["poisonSupplier"] }),
  resin_trapper: monster("resin_trapper", "수지 포획체", 84, [
    attack(13, "contact"), debuff({ bind: { stacks: 1, turns: 1 } }), guard(14),
  ], { material: "stone", encounterTags: ["strongControl"] }),
  symbiotic_mycelium: monster("symbiotic_mycelium", "공생 균사체", 72, [
    guard(8, { applyAllies: { regeneration: { stacks: 5, turns: 1 } }, name: "공생 회복" }),
    guard(8, { applyAllies: { regeneration: { stacks: 3, turns: 2 } }, name: "균사 재생" }),
    guard(12),
  ], { material: "liquid", encounterTags: ["healer", "support"] }),
  poison_scent_stalker: monster("poison_scent_stalker", "독향 추적충", 82, [
    attack(13, "contact"), attack(14, "contact", { lateState: { bonusIfPlayerStatus: ["poison", 5] } }), guard(10),
  ], { material: "stone", encounterTags: ["conditionalAttack"] }),
  parasitic_scentwood: monster("parasitic_scentwood", "기생 향목", 88, [
    guard(15), guard(10, { allyGuard: 10 }), debuff({ vulnerable: 1 }),
  ], { material: "stone", encounterTags: ["support"] }),
  proliferating_sap_core: monster("proliferating_sap_core", "증식 수액핵", 76, [
    guard(8, { name: "성장 준비" }), guard(12, { name: "증식", lateHook: "summonSapling" }), attack(12, "nonContact"),
  ], { material: "liquid", encounterTags: ["summoner"], mechanic: "summon" }),
};

export const ACT5_ELITES = {
  mycelial_shepherd: elite("mycelial_shepherd", "균사 목동", 126, [
    guard(10, { applyAllies: { regeneration: { stacks: 7, turns: 1 } }, name: "균사 회복" }),
    guard(20), attack(18, "nonContact"), guard(10, { applyAllies: { regeneration: { stacks: 4, turns: 2 } } }),
  ], { material: "liquid", encounterTags: ["healer"] }),
  resin_devouring_flower: elite("resin_devouring_flower", "수지 포식꽃", 132, [
    debuff({ poison: 4 }), guard(12, { name: "포식 준비" }), attack(22, "contact", { lateState: { bonusIfPlayerStatus: ["poison", 6] } }), guard(14),
  ], { material: "stone", encounterTags: ["poisonSupplier", "charge"] }),
  spore_queen_bee: elite("spore_queen_bee", "포자 여왕벌", 122, [
    guard(12, { name: "산란 준비" }), guard(10, { name: "유충 소환", lateHook: "summonLarva" }), debuff({ poison: 3 }), attack(18, "contact"),
  ], { material: "gas", encounterTags: ["summoner"] }),
  symbiotic_resin_giant: elite("symbiotic_resin_giant", "공생 수지거인", 140, [
    guard(22, { name: "공생 연결", lateHook: "linkAlly" }), attack(18, "contact"), guard(18), attack(24, "contact"),
  ], { material: "stone", encounterTags: ["support"], customState: { transferredDamage: 0 }, mechanic: "symbioticLink" }),
};

export const ACT5_BOSSES = {
  symbiosis_mother: boss("symbiosis_mother", "공생의 모체", 220, [
    guard(18, { name: "포자 기관 생성", lateHook: "summonSporeOrgan" }),
    debuff({ poison: 3 }),
    guard(18, { name: "균사 기관 생성", lateHook: "summonMyceliumOrgan" }),
    attack(18, "nonContact"),
    guard(22),
    attack(20, "contact"),
    debuff({ poison: 4 }),
    attack(30, "nonContact"),
  ], { material: "liquid", encounterTags: ["summoner", "bossPhase"], mechanic: "symbiosisMother" }),
  blooming_parasitic_garden: boss("blooming_parasitic_garden", "만개한 기생정원", 230, [
    debuff({ poison: 3 }, { name: "포자기 I" }), attack(15, "nonContact", { name: "포자기 II" }),
    debuff({ bind: { stacks: 1, turns: 1 } }, { name: "수지기 I" }), guard(24, { applySelf: { regeneration: { stacks: 4, turns: 2 } }, name: "수지기 II" }),
    attack(21, "contact", { name: "개화기 I" }), attack(27, "nonContact", { name: "개화기 II" }),
    guard(20), attack(32, "contact"),
  ], { material: "stone", encounterTags: ["bossCycle"], mechanic: "gardenCycle" }),
};

export const ACT6_MONSTERS = {
  supercritical_compressor: monster("supercritical_compressor", "초임계 압축기", 88, [
    debuff({ overload: 2 }), attack(14, "nonContact"), attack(19, "nonContact"),
  ], { material: "stone", encounterTags: ["resourcePressure"] }),
  interference_catalyst_tube: monster("interference_catalyst_tube", "교란 촉매관", 82, [
    debuff({ interference: { stacks: 1, turns: 1 } }), attack(13, "nonContact"), guard(15),
  ], { material: "glass", encounterTags: ["softControl"] }),
  resonance_blocking_coil: monster("resonance_blocking_coil", "공명 차단 코일", 90, [
    attack(16, "contact"), guard(10, { name: "침묵 예고" }), debuff({ silence: { stacks: 1, turns: 1 } }, { guard: 6, name: "침묵 방출" }), guard(14),
  ], { material: "stone", encounterTags: ["strongControl"] }),
  crystal_shield_unit: monster("crystal_shield_unit", "결정 차폐체", 94, [
    guard(12, { allyGuard: 10 }), guard(12, { applySelf: { protection: { stacks: 2, turns: 2 } } }), attack(17, "contact"),
  ], { material: "glass", encounterTags: ["support", "tank"] }),
  backflow_pressure_gauge: monster("backflow_pressure_gauge", "역류 압력계", 86, [
    guard(10, { name: "행동 감시 준비", lateHook: "watchCards4" }), attack(17, "nonContact", { name: "감시 판정", lateHook: "cards4Attack" }), guard(14), attack(18, "contact"),
  ], { material: "stone", encounterTags: ["analyzer"], mechanic: "cardsPlayedWatch" }),
  forbidden_distillate: monster("forbidden_distillate", "금단 증류체", 92, [
    guard(10, { name: "충전 1/2", lateState: { chargeDelta: 1 } }), guard(10, { name: "충전 2/2", lateState: { chargeDelta: 1 } }), attack(28, "nonContact", { name: "대폭발", lateState: { chargeReset: true } }), guard(8, { name: "냉각" }),
  ], { material: "gas", encounterTags: ["charge"], customState: { charge: 0 }, mechanic: "damageBreakCharge" }),
};

export const ACT6_ELITES = {
  validation_enforcer: elite("validation_enforcer", "검증 집행관", 138, [
    debuff({ overload: 2 }), debuff({ interference: { stacks: 1, turns: 1 } }), debuff({ silence: { stacks: 1, turns: 1 } }), guard(10),
  ], { material: "stone", encounterTags: ["strongControl"] }),
  supercritical_alchemy_furnace: elite("supercritical_alchemy_furnace", "초임계 연금로", 148, [
    guard(22, { lateState: { pressureDelta: 1 } }), attack(18, "nonContact", { lateState: { pressureDelta: 1 } }), guard(12, { name: "임계 준비" }), attack(29, "nonContact", { name: "임계 폭발" }),
  ], { material: "stone", encounterTags: ["charge"], customState: { pressure: 0 }, mechanic: "shieldBreakPressure" }),
  forbidden_reaction_observer: elite("forbidden_reaction_observer", "금단 반응 관측기", 134, [
    guard(12, { name: "공격 타입 분석", lateHook: "analyzeAttackType" }), attack(19, "contact"), attack(19, "nonContact"), guard(16),
  ], { material: "glass", encounterTags: ["analyzer"], mechanic: "attackTypeResistance" }),
  lockdown_protocol: elite("lockdown_protocol", "봉쇄 프로토콜", 142, [
    guard(15, { name: "스캔" }), guard(10, { name: "강한 제어 예고" }), debuff({ silence: { stacks: 1, turns: 1 } }, { name: "봉쇄" }), guard(6, { name: "재기동" }),
  ], { material: "spirit", encounterTags: ["strongControl"] }),
};

export const ACT6_BOSSES = {
  grand_alchemy_perfume_core: boss("grand_alchemy_perfume_core", "대연금 조향핵", 245, [
    debuff({ overload: 2 }, { name: "압축" }), guard(24), attack(18, "nonContact"), guard(14, { name: "제어 예고" }),
    debuff({ interference: { stacks: 1, turns: 1 } }), attack(22, "contact"), attack(25, "nonContact"), attack(31, "contact"),
  ], { material: "stone", encounterTags: ["bossPhase", "strongControl"], mechanic: "alchemyCorePhases" }),
  forbidden_perfume_computation: boss("forbidden_perfume_computation", "금단 조향 연산체", 238, [
    guard(20, { name: "행동 분석", lateHook: "analyzePreviousTurn" }), attack(18, "contact"), attack(18, "nonContact"), guard(22),
    guard(18, { name: "재분석", lateHook: "analyzePreviousTurns" }), attack(22, "contact"), attack(22, "nonContact"), attack(30, "nonContact"),
  ], { material: "spirit", encounterTags: ["bossAnalyzer"], mechanic: "adaptiveComputation" }),
};

export const ACT7_1_MONSTERS = {
  glass_needle_hunter: monster("glass_needle_hunter", "유리침 사냥꾼", 96, [attack(14, "contact", { applyPlayer: { bleed: 2 } }), guard(14), attack(20, "contact")], { material: "glass", encounterTags: ["bleedSupplier"] }),
  blood_scent_carapace: monster("blood_scent_carapace", "혈향 갑피수", 104, [guard(12, { applySelf: { thorns: 2 } }), guard(18), attack(20, "contact")], { material: "stone", encounterTags: ["thorns"] }),
  wound_stalker: monster("wound_stalker", "상처 추적체", 98, [attack(15, "contact"), attack(16, "contact", { lateState: { bonusIfPlayerStatus: ["bleed", 6] } }), guard(12)], { material: "spirit", encounterTags: ["conditionalAttack"] }),
  compression_muscle_mass: monster("compression_muscle_mass", "압착 근육괴", 110, [attack(17, "contact"), guard(18), attack(20, "contact", { lateState: { bonusIfPlayerShield: [1, 5] } })], { material: "stone" }),
  suture_leech: monster("suture_leech", "봉합 흡혈충", 92, [attack(12, "contact"), guard(10, { applyAllies: { regeneration: { stacks: 4, turns: 1 } }, name: "혈향 회복" }), guard(12)], { material: "liquid", encounterTags: ["healer"] }),
  fragment_flesh_mass: monster("fragment_flesh_mass", "파편 육괴", 102, [guard(16), attack(16, "contact"), attack(22, "contact")], { material: "stone", encounterTags: ["thorns", "hitReaction"], customState: { reactiveThorns: 0 }, mechanic: "attackedThorns" }),
};

export const ACT7_1_ELITES = {
  thorn_saint: elite("thorn_saint", "가시 성자", 150, [guard(18, { applySelf: { thorns: 3 } }), attack(19, "contact"), guard(20), attack(27, "contact")], { material: "stone", encounterTags: ["thorns"], mechanic: "contactCardThorns" }),
  vein_executioner: elite("vein_executioner", "혈맥 집행자", 146, [attack(17, "contact", { applyPlayer: { bleed: 2 } }), guard(16), attack(25, "contact", { lateHook: "consumePlayerBleed" }), guard(12)], { material: "spirit", encounterTags: ["bleedSupplier"] }),
  unhealed_scar: elite("unhealed_scar", "봉합되지 않는 흉터", 154, [guard(14, { applySelf: { regeneration: { stacks: 6, turns: 1 } } }), attack(18, "contact"), guard(16), attack(25, "contact")], { material: "stone", encounterTags: ["healer"], mechanic: "regenUnlessBleeding" }),
  rupture_executioner: elite("rupture_executioner", "파열 집행수", 148, [guard(12, { name: "파열 준비" }), attack(22, "contact", { lateHook: "ruptureFollowup" }), guard(18), attack(27, "contact")], { material: "stone", encounterTags: ["charge"] }),
};

export const ACT7_1_BOSSES = {
  wounded_scent_incarnation: boss("wounded_scent_incarnation", "상처 입은 향의 육신", 270, [
    attack(16, "contact", { applyPlayer: { bleed: 2 }, name: "출혈" }), guard(24, { name: "갑피" }), guard(18, { applySelf: { thorns: 4 }, name: "가시" }), debuff({ vulnerable: 1 }, { name: "노출" }),
    attack(20, "contact", { applyPlayer: { bleed: 2 } }), guard(26), guard(20, { applySelf: { thorns: 4 } }), attack(30, "contact", { name: "노출 강타" }),
  ], { material: "stone", encounterTags: ["bossCycle", "thorns"], mechanic: "woundedBodyCycle" }),
  thousand_wounds: boss("thousand_wounds", "천 개의 상처", 260, [
    attack(17, "contact"), guard(18), attack(21, "contact"), guard(20, { name: "봉합", lateHook: "reduceWound" }),
    attack(20, "contact"), attack(23, "contact"), guard(16), attack(31, "contact"),
  ], { material: "spirit", customState: { wound: 0 }, mechanic: "woundRiskReward" }),
};

export const ACT7_2_MONSTERS = {
  aerosol_igniter: monster("aerosol_igniter", "에어로졸 점화체", 94, [debuff({ burning: 4 }), guard(14), attack(15, "nonContact")], { material: "gas", encounterTags: ["burnSupplier"] }),
  steam_cluster_bug: monster("steam_cluster_bug", "증기 다발충", 92, [attack(6, "nonContact", { hits: 3 }), guard(13), attack(7, "nonContact", { hits: 3 })], { material: "gas", encounterTags: ["multiHit"] }),
  volatile_transmitter: monster("volatile_transmitter", "휘발 전달체", 98, [attack(14, "nonContact"), guard(14), debuff({ burning: 2 })], { material: "gas", encounterTags: ["burnSupplier"], mechanic: "transferBurnOnDeath" }),
  overheated_pressure_turbine: monster("overheated_pressure_turbine", "과열 압력터빈", 104, [debuff({ overload: 2 }), attack(14, "nonContact"), attack(7, "nonContact", { hits: 2 })], { material: "stone", encounterTags: ["multiHit", "resourcePressure"] }),
  thermal_flow_amplifier: monster("thermal_flow_amplifier", "열류 증폭기", 96, [guard(10, { applyAllies: { strength: { stacks: 1, turns: 2 } }, name: "열류 증폭" }), guard(14), attack(13, "nonContact")], { material: "glass", encounterTags: ["support", "amplifier"] }),
  chain_reaction_core: monster("chain_reaction_core", "연쇄 반응핵", 106, [guard(12, { name: "연쇄열 감시", lateHook: "watchFieldBurn" }), attack(16, "nonContact"), guard(14), attack(25, "nonContact", { name: "연쇄 폭발", lateHook: "fieldBurnAttack" })], { material: "stone", encounterTags: ["analyzer"], customState: { chainHeat: 0 }, mechanic: "fieldBurnCounter" }),
};

export const ACT7_2_ELITES = {
  incandescent_spray_tower: elite("incandescent_spray_tower", "백열 분무탑", 148, [debuff({ burning: 5 }), guard(18), attack(7, "nonContact", { hits: 3 }), guard(10)], { material: "gas", encounterTags: ["burnSupplier", "multiHit"] }),
  chain_overpressure_body: elite("chain_overpressure_body", "연쇄 폭압체", 154, [guard(18), attack(20, "nonContact", { lateHook: "scaleFromOwnBurn" }), debuff({ burning: 2 }), attack(27, "nonContact")], { material: "stone", mechanic: "ownBurnPower" }),
  volatile_chain_body: elite("volatile_chain_body", "휘발성 연쇄체", 144, [attack(17, "nonContact"), guard(16), debuff({ burning: 3 }), attack(23, "nonContact")], { material: "gas", mechanic: "transferBurnOnDeath" }),
  ultraheat_injector: elite("ultraheat_injector", "초고열 분사기관", 152, [debuff({ burning: 3 }), debuff({ overload: 2 }), attack(7, "nonContact", { hits: 3 }), attack(20, "nonContact")], { material: "stone", encounterTags: ["burnSupplier", "multiHit"], mechanic: "heatSprayModes" }),
};

export const ACT7_2_BOSSES = {
  solar_scent_storm_core: boss("solar_scent_storm_core", "태양향 폭풍핵", 265, [
    debuff({ burning: 4 }), attack(17, "nonContact"), guard(18), attack(8, "nonContact", { hits: 2 }),
    debuff({ burning: 5 }), attack(21, "nonContact"), guard(14), attack(31, "nonContact"),
  ], { material: "gas", mechanic: "mutualBurnRisk" }),
  eternal_distillation_sun: boss("eternal_distillation_sun", "영겁의 증류 태양", 280, [
    attack(14, "nonContact", { name: "저온" }), debuff({ burning: 3 }, { name: "고온" }), guard(18, { name: "임계" }), attack(30, "nonContact", { name: "방출" }),
    guard(8, { name: "냉각" }), attack(18, "nonContact"), debuff({ burning: 4 }), attack(32, "nonContact"),
  ], { material: "gas", mechanic: "temperatureCycle" }),
};

export const ACT7_3_MONSTERS = {
  tuning_watcher: monster("tuning_watcher", "조율 감시자", 96, [guard(10, { name: "봉인 대상 예고" }), debuff({ seal: { stacks: 1, turns: 1, notes: ["top"] } }), attack(14, "nonContact"), guard(12)], { material: "spirit", encounterTags: ["strongControl"], mechanic: "rotatingNoteSeal" }),
  afterscent_replica: monster("afterscent_replica", "잔향 복제체", 94, [guard(12, { name: "노트 감시" }), attack(14, "nonContact"), guard(16), attack(17, "nonContact")], { material: "spirit", encounterTags: ["analyzer"], mechanic: "repeatNoteShield" }),
  dissonance_resonator: monster("dissonance_resonator", "불협 공명구", 92, [debuff({ interference: { stacks: 1, turns: 1 } }), attack(14, "nonContact"), guard(14)], { material: "spirit", encounterTags: ["softControl"] }),
  harmony_reflector: monster("harmony_reflector", "Harmony 반사체", 100, [guard(12, { name: "하모니 감시" }), attack(15, "nonContact"), guard(18), attack(18, "nonContact")], { material: "glass", encounterTags: ["analyzer"], mechanic: "harmonyDefense" }),
  memory_harvester: monster("memory_harvester", "기억 채집자", 102, [guard(10, { name: "잔향 감시" }), attack(16, "nonContact"), guard(14), attack(22, "nonContact")], { material: "spirit", encounterTags: ["charge"], mechanic: "resonanceThreshold" }),
  silent_conductor: monster("silent_conductor", "무음 지휘자", 98, [attack(14, "nonContact"), guard(10, { name: "침묵 예고" }), debuff({ silence: { stacks: 1, turns: 1 } }), guard(10)], { material: "spirit", encounterTags: ["strongControl"] }),
};

export const ACT7_3_ELITES = {
  triple_tuner: elite("triple_tuner", "삼중 조율자", 150, [
    debuff({ seal: { stacks: 1, turns: 1, notes: ["top"] } }, { name: "TOP 봉인" }),
    debuff({ seal: { stacks: 1, turns: 1, notes: ["middle"] } }, { name: "MIDDLE 봉인" }),
    debuff({ seal: { stacks: 1, turns: 1, notes: ["base"] } }, { name: "BASE 봉인" }), guard(6, { name: "재조율" }),
  ], { material: "spirit", encounterTags: ["strongControl"] }),
  dissonance_archive: elite("dissonance_archive", "불협화음 기록체", 146, [debuff({ interference: { stacks: 1, turns: 1 } }), attack(18, "nonContact"), guard(10, { name: "혼란 예고" }), debuff({ confusion: { stacks: 1, turns: 1 } }), guard(8)], { material: "spirit", encounterTags: ["strongControl"] }),
  antiphase_tuning_fork: elite("antiphase_tuning_fork", "역위상 음차", 148, [guard(14, { name: "노트 지정" }), attack(18, "nonContact"), guard(18), attack(24, "nonContact")], { material: "glass", encounterTags: ["analyzer"], mechanic: "repeatedNoteCounter" }),
  forgotten_tuner_echo: elite("forgotten_tuner_echo", "잊힌 조율사의 잔향", 144, [guard(14, { name: "하모니 예측" }), attack(18, "nonContact"), debuff({ interference: { stacks: 1, turns: 1 } }), guard(10)], { material: "spirit", encounterTags: ["softControl"], mechanic: "harmonyPrediction" }),
};

export const ACT7_3_BOSSES = {
  absolute_resonance_conductor: boss("absolute_resonance_conductor", "절대 공명의 지휘자", 270, [
    guard(20, { name: "불협 노트 지정" }), attack(17, "nonContact"), guard(12, { name: "봉인 예고" }), debuff({ seal: { stacks: 1, turns: 1, notes: ["top"] } }),
    attack(20, "nonContact"), guard(22, { name: "역공명 준비" }), attack(24, "nonContact"), attack(31, "nonContact"),
  ], { material: "spirit", mechanic: "discordAndHarmony" }),
  scent_memory_itself: boss("scent_memory_itself", "향의 기억 그 자체", 275, [
    guard(20, { name: "최근 3턴 기록" }), attack(17, "nonContact"), guard(18, { name: "노트 분석" }), attack(20, "nonContact"),
    guard(20, { name: "기억 갱신" }), attack(22, "nonContact"), guard(16), attack(31, "nonContact"),
  ], { material: "spirit", mechanic: "recentThreeTurnMemory" }),
};

export const LATE_GAME_ACTS = Object.freeze({
  act4: Object.freeze({ normals: ACT4_MONSTERS, elites: ACT4_ELITES, bosses: ACT4_BOSSES }),
  act5: Object.freeze({ normals: ACT5_MONSTERS, elites: ACT5_ELITES, bosses: ACT5_BOSSES }),
  act6: Object.freeze({ normals: ACT6_MONSTERS, elites: ACT6_ELITES, bosses: ACT6_BOSSES }),
  "act7-1": Object.freeze({ normals: ACT7_1_MONSTERS, elites: ACT7_1_ELITES, bosses: ACT7_1_BOSSES }),
  "act7-2": Object.freeze({ normals: ACT7_2_MONSTERS, elites: ACT7_2_ELITES, bosses: ACT7_2_BOSSES }),
  "act7-3": Object.freeze({ normals: ACT7_3_MONSTERS, elites: ACT7_3_ELITES, bosses: ACT7_3_BOSSES }),
});

export const ABYSS_NORMALS = Object.freeze(Object.assign({}, ...Object.values(LATE_GAME_ACTS).map((act) => act.normals)));
export const ABYSS_ELITES = Object.freeze(Object.assign({}, ...Object.values(LATE_GAME_ACTS).map((act) => act.elites)));
export const ABYSS_BOSSES = Object.freeze(Object.assign({}, ...Object.values(LATE_GAME_ACTS).map((act) => act.bosses)));

export const FORBIDDEN_ENCOUNTERS = Object.freeze([
  ["fractured_perfume_swarm", "fractured_pressure_golem"],
  ["symbiotic_mycelium", "parasitic_scentwood", "proliferating_sap_core"],
  ["resonance_blocking_coil", "validation_enforcer"],
  ["blood_scent_carapace", "fragment_flesh_mass", "thorn_saint"],
  ["aerosol_igniter", "steam_cluster_bug", "thermal_flow_amplifier"],
  ["silent_conductor", "tuning_watcher", "dissonance_resonator"],
]);

export function encounterValid(templates = []) {
  const ids = new Set(templates.map((template) => template.id));
  if (FORBIDDEN_ENCOUNTERS.some((group) => group.every((id) => ids.has(id)))) return false;
  const tags = templates.flatMap((template) => template.encounterTags || []),
    count = (tag) => tags.filter((value) => value === tag).length;
  if (count("strongControl") > 1) return false;
  if (count("summoner") > 1) return false;
  if (count("healer") > 1) return false;
  if (count("thorns") > 1) return false;
  if (count("hitReaction") > 1) return false;
  if (count("charge") > 1) return false;
  if (count("burnSupplier") && count("multiHit") && count("amplifier")) return false;
  for (const template of templates) {
    const forbidden = new Set(template.forbiddenWith || []);
    if (templates.some((other) => other !== template && forbidden.has(other.id))) return false;
  }
  return true;
}

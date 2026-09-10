const elite = (id, name, n) => ({ id, name, symbol: "👹", baseHp: 96 + n * 3, isElite: true, pattern: [
  { type: "attack", value: 11 + n, attackPattern: n % 2 ? "contact" : "nonContact" },
  { type: "guard", value: 17 + n, applyPlayer: n % 3 === 0 ? { confusion: 1 } : { weak: 1 } },
  { type: "attack", value: 17 + n, attackPattern: n % 2 ? "nonContact" : "contact" },
] });
const bossPattern = (n) => Array.from({ length: 8 }, (_, i) =>
  i % 3 === 0
    ? { type: "guard", value: 18 + n + i, ...(i > 3 ? { pollute: 1 } : {}) }
    : { type: "attack", value: 14 + n + i, attackPattern: i % 2 ? "nonContact" : "contact", ...(i === 6 ? { applyPlayer: { vulnerable: 1 } } : {}) },
);
const boss = (id, name, n, extra = {}) => ({ id, name, symbol: "💀", baseHp: 160 + n * 5, isBoss: true, pattern: bossPattern(n), ...extra });

export const ACT3_MONSTERS = {
  shattered_glass_fiend: {
    id: "shattered_glass_fiend", name: "깨진 유리 파편마", symbol: "✧", image: null, baseHp: 62, loopPattern: true,
    pattern: [
      { type: "guard", value: 14, applySelf: { thorns: 3 } },
      { type: "attack", value: 10, attackPattern: "nonContact", applyPlayer: { bleed: 3 } },
      { type: "attack", value: 17, attackPattern: "contact" },
    ],
  },
  abyssal_sludge_devourer: {
    id: "abyssal_sludge_devourer", name: "심연의 오물 삼킴이", symbol: "◈", image: null, baseHp: 72, loopPattern: true,
    pattern: [
      { type: "guard", value: 14, pollute: 2 },
      { type: "attack", value: 12, attackPattern: "contact" },
      { type: "guard", value: 18, pollute: 1 },
    ],
  },
  phase_distortion_prism: {
    id: "phase_distortion_prism", name: "위상 왜곡 프리즘", symbol: "❖", image: null, baseHp: 65, loopPattern: true,
    pattern: [
      { type: "guard", value: 16, applyPlayer: { vulnerable: 1 } },
      { type: "guard", value: 10 },
      { type: "attack", value: 22, attackPattern: "nonContact" },
    ],
  },
  abyssal_monolith: {
    id: "abyssal_monolith", name: "심연의 흑요석 거석", symbol: "◆", image: null, baseHp: 78, loopPattern: true,
    pattern: [
      { type: "guard", value: 18 },
      { type: "attack", value: 14, attackPattern: "contact" },
      { type: "attack", value: 22, attackPattern: "contact" },
    ],
  },
  resonant_sonic_orb: {
    id: "resonant_sonic_orb", name: "공명 음파 구체", symbol: "▲", image: null, baseHp: 58, loopPattern: true,
    pattern: [
      { type: "attack", value: 5, hits: 3, attackPattern: "nonContact" },
      { type: "guard", value: 12 },
      { type: "attack", value: 6, hits: 3, attackPattern: "nonContact" },
    ],
  },
  abyssal_stalker: {
    id: "abyssal_stalker", name: "심연의 돌진 맹수", symbol: "✦", image: null, baseHp: 64, loopPattern: true,
    pattern: [
      { type: "attack", value: 13, attackPattern: "contact" },
      { type: "attack", value: 17, attackPattern: "contact" },
      { type: "attack", value: 21, attackPattern: "contact" },
    ],
  },
};

export const ACT3_ELITES = Object.fromEntries([
  ["odorless_void", "무향체"], ["distorted_prism", "왜곡 프리즘"],
  ["crystalline_golem", "결정체 골렘"], ["remnant_blender", "시향사 잔재"],
  ["razor_mist", "칼날 안개"], ["black_solvent", "흑화 용매"],
  ["memory_wood", "기억 향나무"], ["ultrasonic_resonator", "초진동 디퓨저"],
  ["putrid_amalgam", "에센스 아말감"], ["zero_ampoule", "절대영도 앰플"],
].map(([id, name], index) => [id, elite(id, name, index)]));

export const ACT3_BOSSES = {
  spatial_cacophony: boss("spatial_cacophony", "공간의 불협화음", 0, { unlockedByDefault: true }),
  scentless_devourer: boss("scentless_devourer", "무향의 삼킨 자", 1, { unlockedByDefault: true }),
  alchemy_furnace: boss("alchemy_furnace", "연금로의 화신", 2, { unlockedByDefault: true }),
  broken_strips: boss("broken_strips", "깨진 시향지", 3, { unlockedByDefault: true }),
  golden_perfumer: boss("golden_perfumer", "원초의 조향사", 4, { unlockId: "boss_golden_perfumer", signatureReward: "relic_primordial_pipette" }),
  abyssal_lily: boss("abyssal_lily", "심연의 거대 백합", 5, { unlockId: "boss_abyssal_lily", signatureReward: "relic_essence_heart" }),
  lord_of_harmony: boss("lord_of_harmony", "절대 조화의 군주", 6, { unlockId: "boss_lord_of_harmony", signatureReward: "relic_harmony_orb" }),
};

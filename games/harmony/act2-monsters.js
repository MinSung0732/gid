const elite = (id, name, baseHp, pattern, material = "stone") => ({
  id,
  name,
  material,
  symbol: "👹",
  baseHp,
  isElite: true,
  pattern,
});
const boss = (id, name, baseHp, pattern, material = "spirit") => ({
  id,
  name,
  material,
  symbol: "💀",
  baseHp,
  isBoss: true,
  unlockedByDefault: true,
  pattern,
});
const elitePattern = (attack, status) => [
  {
    type: "attack",
    value: attack,
    attackPattern: "contact",
    ...(status ? { applyPlayer: status } : {}),
  },
  { type: "guard", value: attack + 7 },
  { type: "attack", value: attack + 6, attackPattern: "nonContact" },
];
const bossPattern = (attack, status) => [
  { type: "guard", value: attack + 5 },
  { type: "attack", value: attack, attackPattern: "contact" },
  {
    type: "attack",
    value: attack - 2,
    attackPattern: "nonContact",
    ...(status ? { applyPlayer: status } : {}),
  },
  { type: "guard", value: attack + 8, pollute: 1 },
  { type: "attack", value: attack + 3, attackPattern: "nonContact" },
  { type: "guard", value: attack + 10 },
  { type: "attack", value: attack + 6, attackPattern: "contact" },
  { type: "attack", value: attack, hits: 2, attackPattern: "nonContact" },
];

export const ACT2_MONSTERS = {
  boiling_condensate: {
    id: "boiling_condensate",
    name: "끓어오르는 응축수",
    material: "liquid",
    symbol: "♨",
    image: null,
    baseHp: 42,
    scaleAttackWithAct: false,
    pattern: [
      {
        type: "attack",
        value: 6,
        attackPattern: "nonContact",
        applyPlayer: { burning: { stacks: 2, turns: 2 } },
      },
      { type: "guard", value: 10 },
      { type: "attack", value: 11, attackPattern: "nonContact" },
    ],
  },
  overpressure_still: {
    id: "overpressure_still",
    name: "과압 증류관",
    material: "gas",
    symbol: "⚙",
    image: null,
    baseHp: 48,
    scaleAttackWithAct: false,
    pattern: [
      {
        type: "debuff",
        guard: 12,
        applyPlayer: {
          vulnerable: {
            stacks: 1,
            modifierPerStack: 0.5,
            deferDecayTurns: 1,
            description: "받는 직접 피해가 50% 증가합니다.",
          },
        },
      },
      { type: "guard", value: 8 },
      { type: "attack", value: 16, attackPattern: "nonContact" },
    ],
  },
  corrosive_cooling_slug: {
    id: "corrosive_cooling_slug",
    name: "부식성 냉각 슬러그",
    material: "liquid",
    symbol: "💧",
    image: null,
    baseHp: 44,
    scaleAttackWithAct: false,
    pattern: [
      { type: "debuff", applyPlayer: { corrosion: 2 } },
      { type: "attack", value: 7, attackPattern: "contact", pollute: 1 },
      { type: "debuff", guard: 10, applyPlayer: { weak: 1 } },
    ],
  },
  crystallized_sediment: {
    id: "crystallized_sediment",
    name: "결정화된 왁스 침전체",
    material: "stone",
    symbol: "⬢",
    image: null,
    baseHp: 52,
    scaleAttackWithAct: false,
    initialStatuses: {
      protection: {
        stacks: 1,
        turns: 2,
        modifierPerStack: -0.5,
        description: "받는 직접 피해가 50% 감소합니다.",
      },
    },
    pattern: [
      { type: "guard", value: 12, allyGuard: 6 },
      { type: "attack", value: 8, attackPattern: "contact" },
      {
        type: "guard",
        value: 14,
        applySelf: {
          protection: {
            stacks: 1,
            turns: 2,
            modifierPerStack: -0.5,
            description: "받는 직접 피해가 50% 감소합니다.",
          },
        },
      },
    ],
  },
  volatile_flame_spirit: {
    id: "volatile_flame_spirit",
    name: "휘발 불꽃 정령",
    material: "gas",
    symbol: "✦",
    image: null,
    baseHp: 36,
    scaleAttackWithAct: false,
    pattern: [
      { type: "attack", value: 3, hits: 3, attackPattern: "nonContact" },
      {
        type: "attack",
        value: 6,
        attackPattern: "contact",
        applyPlayer: { vulnerable: 1 },
      },
      { type: "attack", value: 4, hits: 3, attackPattern: "nonContact" },
    ],
  },
  tangled_benzoin: {
    id: "tangled_benzoin",
    name: "엉겨붙은 벤조인 슬라임",
    material: "liquid",
    symbol: "⬡",
    image: null,
    baseHp: 46,
    scaleAttackWithAct: false,
    pattern: [
      {
        type: "attack",
        value: 7,
        attackPattern: "contact",
        applyPlayer: { bind: { stacks: 1, turns: 1 } },
      },
      {
        type: "debuff",
        guard: 11,
        applyPlayer: {
          interference: {
            stacks: 1,
            turns: 1,
            modifierPerStack: 0.15,
            description: "카드 사용 시 15% 확률로 실패합니다.",
          },
        },
      },
      { type: "attack", value: 11, attackPattern: "contact" },
    ],
  },
  heavy_cast_ingot: {
    id: "heavy_cast_ingot",
    name: "묵직한 주물 추",
    material: "stone",
    symbol: "■",
    image: null,
    baseHp: 56,
    scaleAttackWithAct: false,
    pattern: [
      { type: "guard", value: 14 },
      { type: "attack", value: 9, attackPattern: "contact" },
      { type: "attack", value: 15, attackPattern: "contact" },
    ],
  },
  steam_vent: {
    id: "steam_vent",
    name: "증기 분출구",
    material: "gas",
    symbol: "♨",
    image: null,
    baseHp: 42,
    scaleAttackWithAct: false,
    pattern: [
      { type: "attack", value: 3, hits: 3, attackPattern: "nonContact" },
      { type: "guard", value: 8 },
      { type: "attack", value: 4, hits: 3, attackPattern: "nonContact" },
    ],
  },
  spinning_blade: {
    id: "spinning_blade",
    name: "회전식 분쇄날",
    material: "stone",
    symbol: "⚙",
    image: null,
    baseHp: 48,
    scaleAttackWithAct: false,
    pattern: [
      { type: "attack", value: 8, attackPattern: "contact" },
      { type: "attack", value: 11, attackPattern: "contact" },
      { type: "attack", value: 16, attackPattern: "contact" },
    ],
  },
};

export const ACT2_ELITES = {
  blazing_censer: elite("blazing_censer", "놋쇠 향로", 88, elitePattern(10, { burning: { stacks: 2, turns: 2 } })),
  corroded_coil: elite("corroded_coil", "구리 냉각관", 92, elitePattern(11, { corrosion: 2 })),
  fermented_mold: elite("fermented_mold", "곰팡이 군체", 86, elitePattern(9, { poison: 3 }), "liquid"),
  molten_slug: elite("molten_slug", "융해 슬러그", 96, elitePattern(12, { weak: 1 }), "liquid"),
  pressure_valve: elite("pressure_valve", "압력 밸브", 90, elitePattern(11, { vulnerable: 1 }), "gas"),
};
export const ACT2_BOSSES = {
  entangled_aftertaste: boss("entangled_aftertaste", "뒤엉킨 잔향", 132, bossPattern(13, { confusion: 1 }), "spirit"),
  benzoin_golem: boss("benzoin_golem", "벤조인 수지", 145, bossPattern(14, { bind: { stacks: 1, turns: 1 } }), "stone"),
  still_heart: boss("still_heart", "증류의 심장", 138, bossPattern(14, { corrosion: 2 }), "glass"),
};

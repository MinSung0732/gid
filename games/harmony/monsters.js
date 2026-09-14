// 1막 초반 일반 몬스터. 이후 막의 몬스터와 분리해 확장할 수 있습니다.
//
// 패턴 추가/삭제는 아래 pattern 배열 항목만 추가/삭제하면 됩니다. 랜덤 구간은
// enemy-patterns.js가 배열 길이를 자동으로 따라가므로 엔진 인덱스 수정이 필요 없습니다.
// 필요할 때만 선택적으로 다음 메타데이터를 붙일 수 있습니다.
// - 몬스터: patternFixedTurns, patternRepeatDecay (기본 0.55)
// - 패턴 항목: weight, repeatDecay, patternKey
// patternRepeatDecay/repeatDecay가 1이면 기존 균등 랜덤과 같고, 작을수록 연속 재등장 확률이 줄어듭니다.
export const EARLY_MONSTERS = {
  stray_note: {
    id: "stray_note",
    name: "흩어진 잡향",
    material: "gas",
    symbol: "❋",
    image: null,
    baseHp: 28,
    pattern: [
      { type: "attack", value: 6, attackPattern: "contact" },
      { type: "guard", value: 6 },
      { type: "attack", value: 8, attackPattern: "contact" },
    ],
  },
  spiky_pinecone: {
    id: "spiky_pinecone",
    name: "가시 돋친 솔방울",
    material: "stone",
    symbol: "✦",
    image: null,
    baseHp: 24,
    initialStatuses: { thorns: 2 },
    pattern: [
      { type: "guard", value: 5, applySelf: { thorns: 1 } },
      { type: "attack", value: 5, attackPattern: "contact" },
      { type: "attack", value: 7, attackPattern: "contact" },
    ],
  },
  volatile_vapor: {
    id: "volatile_vapor",
    name: "휘발하는 에탄올",
    material: "gas",
    symbol: "♨",
    image: null,
    baseHp: 20,
    pattern: [
      {
        type: "attack",
        value: 4,
        attackPattern: "nonContact",
        applyPlayer: { burning: { stacks: 2, turns: 2 } },
      },
      { type: "attack", value: 7, attackPattern: "nonContact" },
      { type: "attack", value: 10, attackPattern: "nonContact" },
    ],
  },
  hardened_resin: {
    id: "hardened_resin",
    name: "딱딱한 송진 찌꺼기",
    material: "stone",
    symbol: "⬡",
    image: null,
    baseHp: 34,
    pattern: [
      { type: "guard", value: 10 },
      { type: "attack", value: 5, attackPattern: "contact" },
      {
        type: "guard",
        value: 8,
        applyAllies: { protection: { stacks: 1, turns: 2 } },
      },
    ],
  },
  blighted_pollen: {
    id: "blighted_pollen",
    name: "변질된 꽃잎 먼지",
    material: "gas",
    symbol: "✣",
    image: null,
    baseHp: 26,
    pattern: [
      { type: "debuff", applyPlayer: { corrosion: 2 } },
      {
        type: "attack",
        value: 4,
        attackPattern: "nonContact",
        applyPlayer: { weak: 1 },
      },
      { type: "attack", value: 6, attackPattern: "nonContact" },
    ],
  },
  tangle_wick: {
    id: "tangle_wick",
    name: "엉킨 심지 슬러그",
    material: "liquid",
    symbol: "※",
    image: null,
    baseHp: 30,
    pattern: [
      { type: "pollute", value: 1 },
      { type: "attack", value: 5, attackPattern: "contact" },
      { type: "pollute", value: 2, guard: 4 },
    ],
  },
};

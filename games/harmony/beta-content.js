// Project Harmony 베타 전용 콘텐츠 모음.
// 정식 카드·능력치·특성·유물을 제작할 때 이 파일의 내보내기만 교체하면 됩니다.

export const BETA_RARITIES = ["일반", "레어", "유니크", "에픽"];
export const BETA_KINDS = { stat: "능력치", trait: "특성", relic: "유물" };

const BETA_ITEM_FAMILIES = {
  gather: [
    ["stat", "넓은 용기", "maxHp", "최대 조화도 +", [5, 9, 14, 22]],
    ["stat", "맑은 원액", "attack", "공격 카드 피해 +", [1, 2, 3, 5]],
    [
      "trait",
      "다공성 결",
      "absorb",
      "턴 종료 시 남은 AP 1당 흡수 +",
      [1, 2, 3, 5],
    ],
    ["trait", "겹친 꽃잎", "oilShield", "오일 사용 시 방어막 +", [2, 4, 7, 12]],
    ["relic", "이슬 받침", "regen", "턴 시작 시 조화도 회복 +", [1, 2, 3, 5]],
    [
      "relic",
      "채집 주머니",
      "goldBonus",
      "방 기본 골드 보상 +",
      [3, 6, 10, 16],
    ],
  ],
  golden: [
    ["stat", "정교한 코팅", "defense", "방어 카드 방어막 +", [2, 4, 7, 11]],
    [
      "stat",
      "넉넉한 시향지",
      "draw",
      "매 턴 추가 드로우 (손패 최대 7장) +",
      [1, 1, 2, 2],
    ],
    [
      "trait",
      "에센스 복제",
      "doubleAbsorb",
      "오일 사용 시 흡수 배율 (최대 100) ×",
      [1.25, 1.5, 1.75, 2],
    ],
    [
      "trait",
      "잔향 증폭",
      "echo",
      "무료 재발동 효과 배율 ×",
      [1.15, 1.3, 1.5, 1.8],
    ],
    [
      "relic",
      "올팩티브 피라미드",
      "pyramid",
      "탑→미들→베이스 완성 시 앞선 두 카드 재발동. 추가 방어막 +",
      [0, 3, 6, 10],
    ],
    [
      "relic",
      "크라프트 코팅",
      "carry",
      "다음 턴 방어막 보존율 ",
      [0.3, 0.45, 0.6, 0.7],
    ],
  ],
  boss: [
    ["stat", "깊은 호흡", "maxHp", "최대 조화도 +", [10, 16, 24, 35]],
    ["stat", "조향사의 집중", "ap", "최대 AP +", [1, 1, 1, 2]],
    [
      "trait",
      "단단한 결",
      "shieldHit",
      "방어 카드 사용 시 현재 방어막의 비율만큼 추가 공격 ",
      [0.1, 0.15, 0.2, 0.3],
    ],
    [
      "trait",
      "응축된 온기",
      "overflow",
      "초과 회복을 방어막으로 전환하는 배율 ×",
      [1, 1.25, 1.5, 2],
    ],
    [
      "relic",
      "단단한 받침대",
      "reflect",
      "피격 직전 방어막 50 이상이면 막은 피해 반사 배율 ×",
      [0.5, 0.8, 1.2, 1.5],
    ],
    [
      "relic",
      "심장의 나이테",
      "openingShield",
      "전투 첫 턴 방어막 +",
      [8, 14, 22, 35],
    ],
  ],
};

export const BETA_ITEMS = Object.fromEntries(
  Object.entries(BETA_ITEM_FAMILIES).flatMap(([room, rows]) =>
    rows.flatMap(([kind, name, effect, description, values]) =>
      values.map((value, tier) => {
        const id = `${room}_${effect}_${tier}`,
          maxOwned = kind === "relic" ? 1 : kind === "trait" ? 3 : 5;
        return [
          id,
          {
            id,
            room,
            kind,
            name,
            tier,
            effect,
            value,
            maxOwned,
            passive: true,
            image: null,
            description:
              description +
              (["carry", "shieldHit"].includes(effect)
                ? `${Math.round(value * 100)}%`
                : value),
          },
        ];
      }),
    ),
  ),
);

export const BETA_CARDS = {
  strike: {
    name: "향기 타격",
    cost: 1,
    note: "top",
    attack: 7,
    attackPattern: "contact",
    text: "접촉 피해 7",
  },
  guard: {
    name: "고요한 코팅",
    cost: 1,
    note: "base",
    shield: 7,
    text: "방어막 7",
  },
  oil: {
    name: "원액 한 방울",
    cost: 1,
    note: "middle",
    oil: true,
    absorb: 5,
    text: "흡수 5 · 오일 발동",
  },
  diffuse: {
    name: "공간 확산",
    cost: 3,
    note: "base",
    burst: true,
    target: "all",
    attackPattern: "nonContact",
    text: "전체 비접촉 · 흡수 전부 ×8 피해 · 전체 기절",
  },
  weight: {
    name: "결의 무게",
    cost: 2,
    note: "base",
    weight: true,
    attackPattern: "contact",
    text: "접촉 · 방어막을 모두 소모해 그 수치만큼 피해",
  },
  citrus: {
    name: "시트러스 탑",
    cost: 0,
    note: "top",
    attack: 3,
    attackPattern: "nonContact",
    text: "비접촉 피해 3",
  },
  floral: {
    name: "꽃의 미들",
    cost: 1,
    note: "middle",
    shield: 5,
    absorb: 3,
    text: "방어막 5 · 흡수 3",
  },
  amber: {
    name: "앰버 베이스",
    cost: 1,
    note: "base",
    attack: 10,
    attackPattern: "nonContact",
    text: "비접촉 피해 10",
  },
  breathe: {
    name: "숨 고르기",
    cost: 0,
    note: "middle",
    draw: 2,
    text: "카드 2장 드로우",
  },
  polish: {
    name: "겹겹의 코팅",
    cost: 2,
    note: "base",
    shield: 18,
    text: "방어막 18",
  },
  extract: {
    name: "정밀 추출",
    cost: 1,
    note: "top",
    absorb: 9,
    text: "흡수 9",
  },
  heal: {
    name: "따뜻한 이슬",
    cost: 1,
    note: "middle",
    heal: 6,
    text: "체력 6 회복",
  },
  impurity: {
    name: "불순물",
    cost: 0,
    note: "none",
    text: "사용 불가 · 이번 전투에서만 덱 오염",
  },
};

export const BETA_STARTING_DECK = [
  "strike",
  "strike",
  "guard",
  "guard",
  "oil",
  "oil",
  "citrus",
  "floral",
  "amber",
  "extract",
];

export const BETA_UNLOCKS = [
  {
    id: "burst",
    name: "공간 확산",
    card: "diffuse",
    goal: "한 번에 흡수 30 이상 모으기",
  },
  {
    id: "wall",
    name: "결의 무게",
    card: "weight",
    goal: "방어막 35 이상 만들기",
  },
  {
    id: "master",
    name: "따뜻한 이슬",
    card: "heal",
    goal: "보스 처음 격파하기",
  },
];

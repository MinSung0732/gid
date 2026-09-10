// 아틀리에 드랍테이블은 밸런스 확정 후 이 목록만 채우면 됩니다.
// 형식: { type: "card" | "augment", id: "data.js에 등록된 ID" }
export const ATELIER_DROP_TABLE = [];

// 액티브 카드와 증강에 공통으로 적용되는 티어별 기본 가격입니다.
export const ATELIER_TIER_PRICES = Object.freeze({
  1: 30,
  2: 55,
  3: 90,
  4: 140,
});

export const ATELIER_MIN_STOCK = 2;
export const ATELIER_MAX_STOCK = 5;

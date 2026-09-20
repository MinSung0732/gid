// 캠페인 공통 구조와 도감 진행 보너스. 막별 고유 데이터는 campaign/data 모듈에 유지합니다.
export const CAMPAIGN_BALANCE = Object.freeze({
  codexPerks: Object.freeze({
    startingGoldRate: 0.2,
    startingGoldBonus: 20,
    startingPotionRate: 0.4,
    startingPotionBonus: 1,
    shopRerollRate: 0.6,
    shopRerollBonus: 1,
    firstTurnApRate: 0.8,
    firstTurnApBonus: 1,
    fullCollectionRate: 1,
  }),
});

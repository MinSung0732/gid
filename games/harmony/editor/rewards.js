// 후보가 소진됐을 때 지급되는 대체 골드. 일반 방 보상은 data.js의 TABLES에서 조정합니다.
export const REWARD_BALANCE = Object.freeze({
  fallbackGold: Object.freeze({
    card: 25,
    statMin: 20,
    statMax: 30,
    trait: 30,
    relicTier0To1: 30,
    relicTier2: 60,
    relicTier3Plus: 100,
    generic: 25,
  }),
});

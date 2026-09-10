export const BURST_CARDS = {
  burst_spatial_diffusion: {
    id: "burst_spatial_diffusion", name: "공간 확산", englishName: "Spatial Diffusion",
    tier: 4, maxCopies: 1, maxUpgrade: 1, cost: 3, note: "base", target: "all",
    attackPattern: "nonContact", burst: true,
    burstMultiplier: 3.2,
    upgrades: { burstMultiplier: [3.2, 4.5] },
    text: "전체 비접촉 · 흡수 전량 소비 ×3.2 피해 (강화 시 ×4.5) · 소비 흡수 40 이상 시 살아있는 모든 적 1턴 기절",
  },
  burst_scent_premonition: {
    id: "burst_scent_premonition", name: "확산의 조짐", englishName: "Diffusion Portent",
    tier: 3, maxCopies: 2, maxUpgrade: 2, cost: 1, note: "top", searchBurst: true,
    absorb: 10, text: "흡수 +10 · 덱 또는 버린 카드 더미에서 [공간 확산] 1장을 손패로 가져옴",
  },
  burst_condensed_essence_drop: {
    id: "burst_condensed_essence_drop", name: "원액 농축 적하", englishName: "Condensed Essence Drop",
    tier: 2, maxCopies: 2, maxUpgrade: 2, cost: 1, note: "middle", oil: true,
    absorb: 8, reduceOilCost: 1, text: "오일 발동 · 흡수 +8 · 내 손패의 모든 오일 카드 비용 1 감소",
  },
  burst_precision_pipetting: {
    id: "burst_precision_pipetting", name: "정밀 추출", englishName: "Precision Pipetting",
    tier: 1, maxCopies: 4, maxUpgrade: 3, cost: 1, note: "top", absorb: 12,
    text: "흡수 +12",
  },
  burst_oil_resin_coat: {
    id: "burst_oil_resin_coat", name: "오일 수지 코팅", englishName: "Oil Resin Coat",
    tier: 2, maxCopies: 2, maxUpgrade: 2, cost: 1, note: "base", shield: 7,
    absorb: 5, oil: true, text: "방어막 7 · 흡수 +5 · 오일 발동",
  },
};

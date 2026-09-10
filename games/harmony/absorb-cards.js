const absorb = (name, cost, effects, upgrades) => ({
  name, cost, tier: 1, maxCopies: 4, maxUpgrade: 3, note: "middle",
  category: "absorb", ...effects, upgrades,
});
export const ABSORB_CARDS = {
  absorb_precision_pipette: absorb("정밀 피펫 계량", 1, { absorb: 8 }, { absorb: [8, 10, 13, 16] }),
  absorb_cold_maceration: absorb("저온 냉침 추출", 1, { absorb: 5, preventAbsorbDecay: true }, { absorb: [5, 7, 9, 11] }),
  absorb_pure_oil_drop: absorb("순수 오일 방울", 0, { absorb: 4, oil: true, draw: 1 }, { absorb: [4, 5, 6, 8] }),
  absorb_solvent_percolation: absorb("용매 침출 타격", 1, { attack: 4, absorb: 6, attackPattern: "nonContact" }, { attack: [4, 6, 8, 10], absorb: [6, 7, 8, 10] }),
  absorb_fragrance_primer: absorb("향료 프라이머", 1, { absorb: 4, absorbBooster: 3 }, { absorb: [4, 6, 8, 10], absorbBooster: [3, 4, 5, 6] }),
};

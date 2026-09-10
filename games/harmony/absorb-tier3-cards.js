const absorb = (name, cost, note, effects, upgrades) => ({
  name,
  cost,
  tier: 3,
  maxCopies: 2,
  maxUpgrade: 1,
  note,
  category: "absorb",
  ...effects,
  upgrades,
});

export const ABSORB_TIER3_CARDS = {
  absorb_supercritical_extraction: absorb("초임계 유체 추출", 1, "middle", {
    absorb: 14,
    preventAbsorbDecay: true,
  }, {
    absorb: [14, 18],
  }),
  absorb_pressurized_solvent_cycle: absorb("고압 용매 순환", 1, "base", {
    absorb: 8,
    refundAbsorbThreshold: 20,
  }, {
    absorb: [8, 11],
    refundAbsorbThreshold: [20, 15],
  }),
  absorb_saturated_resonance_filter: absorb("포화 공명 여과", 1, "middle", {
    absorb: 9,
    absorbStatusThreshold: 30,
    absorbThresholdApplyAllEnemy: { vulnerable: 1 },
  }, {
    absorb: [9, 12],
    absorbStatusThreshold: [30, 25],
    absorbThresholdApplyAllEnemy: [{ vulnerable: 1 }, { vulnerable: 2 }],
  }),
  absorb_volatile_essential_steep: absorb("휘발성 정유 침출", 0, "top", {
    absorb: 5,
    oil: true,
    draw: 1,
    applyEnemy: { burning: 2 },
  }, {
    absorb: [5, 8],
    applyEnemy: [{ burning: 2 }, { burning: 3 }],
  }),
  absorb_abyssal_oil_concentrate: absorb("심연의 오일 농축", 2, "base", {
    absorb: 16,
    oil: true,
    applyPlayer: { regeneration: 2 },
  }, {
    absorb: [16, 22],
    applyPlayer: [{ regeneration: 2 }, { regeneration: 3 }],
  }),
  absorb_corrosive_extraction_strike: absorb("부식성 추출 타격", 1, "top", {
    attack: 9,
    attackPattern: "nonContact",
    absorb: 7,
    applyEnemy: { corrosion: 3 },
  }, {
    attack: [9, 13],
    absorb: [7, 9],
    applyEnemy: [{ corrosion: 3 }, { corrosion: 4 }],
  }),
  absorb_concentrated_primer: absorb("농축 향료 프라이머", 1, "middle", {
    absorb: 6,
    absorbBooster: 5,
  }, {
    absorb: [6, 9],
    absorbBooster: [5, 7],
  }),
};

const ranged = (name, cost, note, effects, upgrades) => ({
  name,
  cost,
  tier: 4,
  maxCopies: 1,
  maxUpgrade: 1,
  note,
  category: "attack",
  attackPattern: "nonContact",
  ...effects,
  upgrades,
});

export const NONCONTACT_TIER4_CARDS = {
  noncontact_supercritical_beam: ranged("초임계 유체 추출 빔", 3, "top", {
    attack: 45,
    bypassShield: true,
    applyEnemy: { vulnerable: 3, corrosion: 3 },
  }, {
    attack: [45, 58],
  }),
  noncontact_sillage_supernova: ranged("천상의 잔향 초신성", 2, "middle", {
    attack: 20,
    target: "all",
    globalDotBurstMultiplier: 2.5,
    extendAllDotDurations: 2,
  }, {
    attack: [20, 26],
    globalDotBurstMultiplier: [2.5, 3.5],
  }),
  noncontact_perpetual_storm: ranged("영구 발향 디퓨저 폭풍", 2, "top", {
    attack: 5,
    hits: 8,
    hitsPerCardThisTurn: 1,
    maxHits: 12,
    target: "random",
    randomEachHit: true,
    chanceStatusOnHit: { chance: 0.15, id: "weak", amount: 1 },
  }, {
    attack: [5, 7],
  }),
  noncontact_absolute_zero_cryo: ranged("절대영도 동결 결정포", 3, "base", {
    attack: 35,
    shieldScaling: 1,
    stunOrDisarmBossTurns: 2,
  }, {
    attack: [35, 45],
    shieldScaling: [1, 1.3],
  }),
};

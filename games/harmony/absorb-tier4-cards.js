const absorb = (name, cost, note, effects, upgrades) => ({
  name,
  cost,
  tier: 4,
  maxCopies: 1,
  maxUpgrade: 1,
  note,
  category: "absorb",
  ...effects,
  upgrades,
});

export const ABSORB_TIER4_CARDS = {
  absorb_primordial_still: absorb("원초의 증류탑", 2, "base", {
    absorb: 18,
    preventAbsorbDecay: true,
    absorbBooster: 6,
  }, {
    absorb: [18, 25],
    absorbBooster: [6, 8],
  }),
  absorb_supercritical_reactor: absorb("초임계 반응로", 1, "top", {
    absorb: 10,
    oil: true,
    draw: 2,
    reduceOilCost: 1,
  }, {
    absorb: [10, 14],
    draw: [2, 3],
  }),
  absorb_abyssal_leaching_synthesis: absorb("심연의 침출 배합", 2, "middle", {
    attack: 16,
    attackPattern: "nonContact",
    absorbFromDamage: 1,
    applyEnemy: { corrosion: 5, intimidated: { stacks: 3, turns: 1 } },
  }, {
    attack: [16, 22],
    applyEnemy: [
      { corrosion: 5, intimidated: { stacks: 3, turns: 1 } },
      { corrosion: 7, intimidated: { stacks: 5, turns: 1 } },
    ],
  }),
};

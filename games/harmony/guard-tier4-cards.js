const guard = (name, note, effects, upgrades) => ({
  name,
  cost: 2,
  tier: 4,
  maxCopies: 1,
  maxUpgrade: 1,
  note,
  category: "defense",
  ...effects,
  upgrades,
});

export const GUARD_TIER4_CARDS = {
  guard_hermetic_crystal_belljar: guard("절대 밀폐 크리스탈 벨자", "base", {
    shield: 18,
    applyPlayer: { protection: 3 },
    purgeImpurity: Infinity,
  }, {
    shield: [18, 24],
    applyPlayer: [{ protection: 3 }, { protection: 4 }],
  }),
  guard_solidified_resin_rampart: guard("고착화 수지 흉벽", "base", {
    shield: 14,
    thorns: 5,
    conditionalEnemyIntent: { attack: { disarm: { stacks: 1, turns: 1 } } },
  }, {
    shield: [14, 18],
    thorns: [5, 7],
  }),
  guard_sanctuary_of_purified_water: guard("생명의 정제수 성소", "middle", {
    shield: 12,
    applyPlayer: { regeneration: 4 },
    cleanse: "all",
  }, {
    shield: [12, 16],
    applyPlayer: [{ regeneration: 4 }, { regeneration: 6 }],
  }),
};

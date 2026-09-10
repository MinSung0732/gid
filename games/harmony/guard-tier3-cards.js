const guard = (name, cost, note, effects, upgrades) => ({
  name,
  cost,
  tier: 3,
  maxCopies: 2,
  maxUpgrade: 1,
  note,
  category: "defense",
  ...effects,
  upgrades,
});

export const GUARD_TIER3_CARDS = {
  guard_wax_bastion_bash: guard("왁스 성벽 격돌", 2, "base", {
    shield: 12,
    shieldScalingAttack: 0.3,
    attackPattern: "contact",
  }, {
    shield: [12, 16],
    shieldScalingAttack: [0.3, 0.4],
  }),
  guard_amber_crystal_bulwark: guard("호박 결정 방벽", 2, "base", {
    shield: 12,
    applyPlayer: { protection: 2 },
  }, {
    shield: [12, 16],
    applyPlayer: [{ protection: 2 }, { protection: 3 }],
  }),
  guard_corrosive_membrane: guard("침식 반응막", 1, "middle", {
    shield: 8,
    thorns: 3,
    thornsApplyAttacker: { corrosion: 2 },
  }, {
    shield: [8, 11],
    thorns: [3, 4],
    thornsApplyAttacker: [{ corrosion: 2 }, { corrosion: 3 }],
  }),
  guard_mist_veil: guard("안개 은폐막", 1, "top", {
    shield: 7,
    target: "all",
    applyEnemy: { weak: 1 },
  }, {
    shield: [7, 10],
    applyEnemy: [{ weak: 1 }, { weak: 2 }],
  }),
  guard_purifying_censer: guard("정화의 향로", 2, "middle", {
    shield: 10,
    applyPlayer: { regeneration: 3 },
    cleanse: 1,
  }, {
    shield: [10, 14],
    applyPlayer: [{ regeneration: 3 }, { regeneration: 4 }],
  }),
  guard_intimidating_barrier: guard("위축의 결계", 1, "base", {
    shield: 9,
    intimidate: 3,
  }, {
    shield: [9, 13],
    intimidate: [3, 5],
  }),
};

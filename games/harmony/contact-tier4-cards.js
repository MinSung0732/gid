const contact = (name, cost, note, effects, upgrades) => ({
  name,
  cost,
  tier: 4,
  maxCopies: 1,
  maxUpgrade: 1,
  note,
  category: "attack",
  attackPattern: "contact",
  ...effects,
  upgrades,
});

export const CONTACT_TIER4_CARDS = {
  contact_terracotta_crush: contact("테라코타 발향석 대격돌", 2, "base", {
    attack: 20,
    shieldScaling: 1.5,
    shieldThreshold: 40,
    thresholdBypassShield: true,
    thresholdApplyAllEnemy: { disarm: 1 },
  }, {
    attack: [20, 26],
    shieldScaling: [1.5, 1.8],
  }),
  contact_black_reed_flurry: contact("흑단 디퓨저 리드 난타", 2, "middle", {
    attack: 6,
    hits: 6,
    battleContactBonus: 1,
    ceilBattleContactBonus: true,
    onHitCount: 3,
    onHitApplyEnemy: { vulnerable: 2, weak: 2 },
  }, {
    attack: [6, 8],
    battleContactBonus: [1, 1.5],
  }),
  contact_blazing_wick_brand: contact("타오르는 목화 심지 낙인", 2, "top", {
    attack: 24,
    dotBurstMultiplier: 3,
    amplifyDots: 2,
    applyEnemyAfterAttack: { burning: 4, bleed: 4 },
  }, {
    attack: [24, 30],
    dotBurstMultiplier: [3, 4],
  }),
  contact_crystal_guillotine: contact("크리스탈 시약병 단두대", 3, "base", {
    attack: 32,
    shieldDamageMultiplier: 3,
    executeRatio: 0.5,
    executeMultiplier: 2,
    executeNonBoss: true,
    refundOnKill: 3,
    drawOnKill: 2,
  }, {
    attack: [32, 40],
    executeRatio: [0.5, 0.6],
  }),
};

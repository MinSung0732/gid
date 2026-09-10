const contact = (name, cost, effects, upgrades) => ({
  name, cost, tier: 2, maxCopies: 2, maxUpgrade: 2, note: "middle",
  category: "attack", attackPattern: "contact", ...effects, upgrades,
});
export const CONTACT_TIER2_CARDS = {
  contact_pestle_grind: contact("유발 연속 마쇄", 1, { attack: 6, hits: 2, absorb: 3 }, { attack: [6, 7, 8] }),
  contact_heavy_crimp: contact("중압 크림프 압착", 2, { attack: 16, shield: 6, shieldScaling: 0.5 }, { attack: [16, 19, 23], shield: [6, 8, 10] }),
  contact_glass_cleaver: contact("유리 시약병 파쇄", 1, { attack: 10, shieldDamageMultiplier: 2, refundOnBreak: 1 }, { attack: [10, 12, 14] }),
  contact_volatile_overheat: contact("과열 휘발 직격", 1, { attack: 11, discard: 1, discardAttackBurn: 3 }, { attack: [11, 13, 16], discardAttackBurn: [3, 4, 5] }),
  contact_resin_smash: contact("농축 레진 스매시", 1, { attack: 9, absorbCost: 8, fueledAttack: 17 }, { attack: [9, 11, 13], fueledAttack: [17, 20, 24] }),
  contact_steel_pierce: contact("스틸 니들 심층 천공", 1, { attack: 9, applyEnemy: { vulnerable: 2, weak: 1 } }, { attack: [9, 11, 13], applyEnemy: [{ vulnerable: 2, weak: 1 }, { vulnerable: 2, weak: 2 }, { vulnerable: 3, weak: 2 }] }),
  contact_friction_combustion: contact("마찰 발화", 1, { attack: 8, bonusPerStatus: { burning: 1, bleed: 1, poison: 1 } }, { attack: [8, 10, 13] }),
  contact_execution_stamp: contact("추출 압착 스탬프", 2, { attack: 20, executeRatio: 0.5, executeAttack: 30 }, { attack: [20, 24, 28], executeAttack: [30, 36, 42] }),
};

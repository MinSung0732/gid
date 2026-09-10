const contact = (name, cost, effects, upgrades) => ({
  name, cost, tier: 3, maxCopies: 2, maxUpgrade: 2, note: "middle",
  category: "attack", attackPattern: "contact", ...effects, upgrades,
});
const dots = (amount) => ({ burning: amount, bleed: amount, poison: amount });
export const CONTACT_TIER3_CARDS = {
  contact_basalt_impact: contact("현무암 스톤 분쇄타", 2, { note: "base", attack: 24, bypassShield: true, applyEnemy: { stun: 1 } }, { attack: [24, 28, 33] }),
  contact_infinite_resonance: contact("무한 잔향 천공타", 1, { attack: 5, hits: 3, battleContactBonus: 1 }, { attack: [5, 6, 7] }),
  contact_obsidian_breaker: contact("흑요석 시약병 절단", 1, { attack: 16, refundOnBreak: 2, drawOnBreak: 1 }, { attack: [16, 19, 23] }),
  contact_volatile_reaction: contact("격렬 휘발 연쇄타", 0, { note: "top", attack: 13, randomDiscard: 1, discardTierAp: 1 }, { attack: [13, 16, 20] }),
  contact_essence_spear: contact("농축 원액 관통창", 2, { attack: 28, bonusPerStatus: dots(3) }, { attack: [28, 33, 38], bonusPerStatus: [dots(3), dots(4), dots(5)] }),
  contact_pure_absorb_overload: contact("원액 과부하 직격", 1, { attack: 34, requiredAbsorb: 20 }, { attack: [34, 40, 46], requiredAbsorb: [20, 20, 18] }),
  contact_cauterizing_brand: contact("초고온 밀랍 낙인", 2, { note: "top", attack: 22, applyEnemy: { burning: 6 }, detonateBurning: 2 }, { attack: [22, 26, 31], applyEnemy: [{ burning: 6 }, { burning: 7 }, { burning: 8 }], detonateBurning: [2, 2, 2.5] }),
  contact_alchemical_transmute: contact("연금 추출 일격", 1, { attack: 15, maxHpOnKill: 2 }, { attack: [15, 18, 22], maxHpOnKill: [2, 3, 4] }),
};

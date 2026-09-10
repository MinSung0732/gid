const ranged = (name, cost, effects, upgrades) => ({
  name, cost, tier: 2, maxCopies: 2, maxUpgrade: 2, note: "top",
  category: "attack", attackPattern: "nonContact", ...effects, upgrades,
});
export const NONCONTACT_TIER2_CARDS = {
  noncontact_aerosol_sweep: ranged("초음파 에어로졸 확산", 2, { attack: 11, target: "all", applyEnemy: { vulnerable: 1 } }, { attack: [11, 13, 16], applyEnemy: [{ vulnerable: 1 }, { vulnerable: 1 }, { vulnerable: 2 }] }),
  noncontact_toxic_vapor: ranged("농축 독성 증기 기화", 1, { attack: 7, applyEnemy: { poison: 5 } }, { attack: [7, 9, 11], applyEnemy: [{ poison: 5 }, { poison: 6 }, { poison: 8 }] }),
  noncontact_solvent_jet: ranged("고압 에탄올 분사", 1, { attack: 12, refundAbsorbThreshold: 20 }, { attack: [12, 15, 18], refundAbsorbThreshold: [20, 20, 15] }),
  noncontact_diffusing_mist: ranged("연쇄 기화 확산", 1, { attack: 8, discard: 1, discardCostDamage: 4 }, { attack: [8, 10, 12], discardCostDamage: [4, 5, 6] }),
};

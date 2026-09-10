const ranged = (name, cost, note, effects, upgrades) => ({
  name,
  cost,
  tier: 3,
  maxCopies: 2,
  maxUpgrade: 2,
  note,
  category: "attack",
  attackPattern: "nonContact",
  ...effects,
  upgrades,
});

export const NONCONTACT_TIER3_CARDS = {
  noncontact_diffusive_aroma_wave: ranged("확산형 향기 파동", 2, "middle", { attack: 16, target: "all" }, { attack: [16, 19, 23] }),
  noncontact_rapid_aerosol_burst: ranged("스피드 에어로졸 난사", 0, "top", { attack: 4, hits: 3 }, { attack: [4, 5, 6] }),
  noncontact_sillage_evaporation: ranged("심층 잔향의 증발", 1, "base", { attack: 12, turnDamageBonus: 3 }, { attack: [12, 15, 18], turnDamageBonus: [3, 4, 5] }),
  noncontact_compressed_diffuser_blast: ranged("디퓨저 증기 압축탄", 2, "base", { attack: 15, handDamageBonus: 3 }, { attack: [15, 18, 22], handDamageBonus: [3, 4, 5] }),
  noncontact_bouncing_scent_drops: ranged("튀는 향기 물방울", 2, "top", { attack: 7, hits: 4, target: "random", randomEachHit: true }, { attack: [7, 9, 11] }),
  noncontact_fresh_uncork_burst: ranged("갓 개봉한 첫 발향", 1, "top", { attack: 15, firstTurnOrFullHpMultiplier: 2 }, { attack: [15, 18, 22] }),
  noncontact_flaming_emulsion_jet: ranged("타오르는 방향 유화액", 2, "middle", { attack: 18, applyEnemy: { burning: 4, vulnerable: 2 } }, { attack: [18, 22, 27], applyEnemy: [{ burning: 4, vulnerable: 2 }, { burning: 5, vulnerable: 2 }, { burning: 6, vulnerable: 2 }] }),
  noncontact_chilled_siphon: ranged("냉침 에센스 사이폰", 1, "middle", { attack: 13, absorbFromDamage: 0.5, draw: 1 }, { attack: [13, 16, 20] }),
};

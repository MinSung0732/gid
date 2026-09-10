const guard = (name, cost, effects, upgrades) => ({
  name, cost, tier: 1, maxCopies: 4, maxUpgrade: 3, note: "base",
  category: "defense", ...effects, upgrades,
});
export const GUARD_CARDS = {
  guard_paraffin_seal: guard("파라핀 밀봉", 1, { shield: 8 }, { shield: [8, 10, 12, 14] }),
  guard_wax_coating: guard("비활성 왁스 코팅", 1, { shield: 6, retainShield: 0.5 }, { shield: [6, 8, 10, 12] }),
  guard_marble_stand: guard("대리석 거치대", 2, { shield: 15 }, { shield: [15, 18, 21, 25] }),
  guard_alcohol_rinse: guard("알코올 세척", 1, { shield: 5, cleanse: 1 }, { shield: [5, 7, 9, 11], cleanse: [1, 1, 1, 2] }),
  guard_kraft_wrapping: guard("크라프트 완충지", 1, { shield: 6, draw: 1 }, { shield: [6, 8, 10, 12] }),
  guard_amber_resin: guard("호박 수지 응고", 1, { shield: 6, thorns: 3 }, { shield: [6, 8, 10, 12], thorns: [3, 4, 5, 6] }),
  guard_base_anchor: guard("베이스노트 앵커", 1, { shield: 5, absorb: 4 }, { shield: [5, 7, 9, 11], absorb: [4, 5, 6, 8] }),
  guard_heavy_pestle: guard("묵직한 유발 타격", 1, { attack: 5, shieldScaling: 0.5, attackPattern: "contact" }, { attack: [5, 7, 9, 12] }),
  guard_solvent_purge: guard("휘발 차단막", 0, { shield: 4, discard: 1 }, { shield: [4, 6, 8, 10] }),
  guard_aroma_veil: guard("아로마 진정 베일", 1, { shield: 6, intimidate: 2 }, { shield: [6, 8, 10, 12], intimidate: [2, 2, 3, 4] }),
};

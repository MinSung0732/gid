const healCard = (name, cost, tier, note, maxCopies, maxUpgrade, effects, upgrades, flavor) => ({
  name, cost, tier, note, maxCopies, maxUpgrade, category: "heal", target: "self",
  ...effects, upgrades, flavor,
});

export const HEAL_CARDS = {
  heal_aloe_salve: healCard("알로에 진정 팅크", 1, 1, "top", 3, 3,
    { heal: 5 }, { heal: [5, 7, 9, 11] },
    "가볍고 청량한 탑노트. 살갗에 닿자마자 상처의 열기를 식혀줍니다."),
  heal_chamomile_infusion: healCard("카모마일 온침액", 1, 1, "middle", 3, 3,
    { heal: 4, shield: 4 }, { heal: [4, 6, 8, 10], shield: [4, 5, 6, 8] },
    "은은한 꽃잎 향. 체력을 채우며 부드러운 수호 피막을 형성합니다."),
  heal_herbal_compress: healCard("약초 찜질 압착", 0, 1, "base", 4, 3,
    { heal: 3, draw: 1 }, { heal: [3, 4, 5, 7] },
    "빠른 손놀림의 응급 처치. 즉시 체력을 추스르고 다음 패를 끌어옵니다."),
  heal_clarifying_lavender: healCard("정화의 라벤더 수", 1, 2, "top", 2, 2,
    { heal: 8, cleanseDotStacks: 1 }, { heal: [8, 11, 15] },
    "머리를 맑게 하는 보랏빛 향. 몸속에 침투한 독기를 씻어냅니다."),
  heal_soothing_balm_distillate: healCard("진정의 유향 밤", 2, 2, "middle", 2, 2,
    { heal: 12, absorb: 6, oil: true }, { heal: [12, 16, 20], absorb: [6, 8, 10] },
    "걸쭉하게 정제된 유향 고약. 깊은 상처를 메우며 향액을 비축합니다."),
  heal_vital_sap_concoction: healCard("활력 수액 농축액", 1, 2, "base", 2, 2,
    { heal: 6, comboHealThreshold: 3, comboHealMultiplier: 2 }, { heal: [6, 8, 11] },
    "빠른 템포로 카드를 몰아쳤을 때 폭발적인 생명력을 뿜어냅니다."),
  heal_celestial_ambrosia: healCard("천상의 앰브로시아", 2, 3, "middle", 2, 2,
    { heal: 18, harmonyHealShield: true }, { heal: [18, 23, 28] },
    "완벽한 조화 속에서 피와 방패를 동시에 채우는 신들의 영약입니다."),
  heal_phoenix_aroma_salve: healCard("불사조의 훈향 연고", 1, 3, "base", 2, 2,
    { heal: 10, applyPlayer: { regeneration: { stacks: 3, turns: 3 } } }, {
      heal: [10, 13, 17],
      applyPlayer: [
        { regeneration: { stacks: 3, turns: 3 } },
        { regeneration: { stacks: 3, turns: 4 } },
        { regeneration: { stacks: 3, turns: 5 } },
      ],
    }, "잿더미에서 피어나는 온기가 오랜 시간 상처를 스스로 아물게 합니다."),
  heal_primordial_dew_elixir: healCard("태초의 새벽 엘릭서", 2, 4, "top", 1, 1,
    { heal: 28, overhealShieldRatio: 1.5 }, { heal: [28, 38] },
    "넘쳐흐르는 태초의 생명 에너지가 단단한 방패로 응결됩니다."),
  heal_miracle_transmutation: healCard("기적의 생명 연성", 3, 4, "base", 1, 1,
    { missingHpHealRatio: 0.5, minimumHeal: 20, cleanse: "all" }, {
      missingHpHealRatio: [0.5, 0.7],
    }, "빈사 상태일수록 신적인 힘으로 심장을 다시 뛰게 합니다."),
};

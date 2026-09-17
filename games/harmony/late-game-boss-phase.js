const clone = (value) => structuredClone(value);
const attack = (value, attackPattern = "contact", extra = {}) => ({
  type: "attack",
  value,
  attackPattern,
  ...extra,
});
const guard = (value, extra = {}) => ({ type: "guard", value, ...extra });
const debuff = (applyPlayer, extra = {}) => ({ type: "debuff", applyPlayer, ...extra });

function singlePhase(enemy) {
  return [
    {
      id: "late-main",
      label: "MAIN",
      hpAbove: 0,
      opening: enemy.pattern.map(clone),
      cycle: enemy.pattern.map(clone),
    },
  ];
}

function symbiosisMotherPhases(enemy) {
  return [
    {
      id: "symbiosis-growth",
      label: "성장기",
      hpAbove: 0.5,
      opening: enemy.pattern.map(clone),
      cycle: enemy.pattern.map(clone),
    },
    {
      id: "symbiosis-bloom",
      label: "강화 공생기",
      hpAbove: 0,
      onEnter: guard(20, { name: "기관 공명 강화", lateHook: "empowerSymbiosisOrgan" }),
      cycle: [
        guard(16, { name: "포자 기관 재생성 준비" }),
        guard(16, { name: "강화 포자 기관 생성", lateHook: "summonSporeOrgan" }),
        attack(20, "nonContact"),
        guard(16, { name: "균사 기관 재생성 준비" }),
        guard(16, { name: "강화 균사 기관 생성", lateHook: "summonMyceliumOrgan" }),
        debuff({ poison: 4 }, { name: "공생 독향" }),
        attack(24, "contact"),
        attack(31, "nonContact"),
      ],
    },
  ];
}

function gardenPhases(enemy) {
  return [
    {
      id: "garden-cycle",
      label: "생태 순환",
      hpAbove: 0.5,
      opening: enemy.pattern.map(clone),
      cycle: enemy.pattern.map(clone),
    },
    {
      id: "garden-overlap",
      label: "중첩 개화",
      hpAbove: 0,
      onEnter: guard(12, { name: "생태 중첩" }),
      cycle: [
        attack(15, "nonContact", { applyPlayer: { poison: 2 }, name: "포자 개화" }),
        guard(18, { applySelf: { regeneration: { stacks: 3, turns: 2 } }, name: "수지 재생" }),
        attack(18, "contact", { applyPlayer: { bind: { stacks: 1, turns: 1 } }, name: "수지 포획" }),
        guard(12, { name: "개화 준비" }),
        attack(25, "nonContact", { name: "개화 분출" }),
        attack(30, "contact", { name: "개화 강타" }),
      ],
    },
  ];
}

function alchemyCorePhases() {
  return [
    {
      id: "alchemy-compression",
      label: "압축",
      hpAbove: 0.66,
      opening: [
        debuff({ overload: 2 }, { name: "압축" }),
        guard(24, { name: "압력 방어" }),
        attack(18, "nonContact", { name: "압축 방출" }),
        guard(14, { name: "제어 계통 예열" }),
      ],
      cycle: [
        debuff({ overload: 2 }, { name: "압축" }),
        attack(19, "nonContact"),
        guard(22),
        attack(23, "contact"),
      ],
    },
    {
      id: "alchemy-control",
      label: "제어",
      hpAbove: 0.33,
      onEnter: guard(16, { name: "제어 페이즈 전환" }),
      cycle: [
        guard(12, { name: "방해 예고" }),
        debuff({ interference: { stacks: 1, turns: 1 } }, { name: "방해 방출" }),
        attack(22, "contact"),
        guard(12, { name: "침묵 예고" }),
        debuff({ silence: { stacks: 1, turns: 1 } }, { name: "침묵 방출" }),
        attack(25, "nonContact"),
      ],
    },
    {
      id: "alchemy-collapse",
      label: "붕괴",
      hpAbove: 0,
      onEnter: attack(18, "nonContact", { name: "붕괴 충격" }),
      cycle: [
        attack(24, "contact"),
        guard(12),
        attack(27, "nonContact"),
        attack(31, "contact"),
        guard(8, { name: "불안정 냉각" }),
        attack(29, "nonContact"),
      ],
    },
  ];
}

function computationPhases(enemy) {
  return [
    {
      id: "computation-single",
      label: "단일 턴 분석",
      hpAbove: 0.5,
      opening: enemy.pattern.slice(0, 4).map(clone),
      cycle: enemy.pattern.slice(0, 4).map(clone),
    },
    {
      id: "computation-memory",
      label: "최근 2턴 분석",
      hpAbove: 0,
      onEnter: guard(18, { name: "분석 범위 확장", lateHook: "analyzePreviousTurns" }),
      cycle: enemy.pattern.slice(4).map(clone),
    },
  ];
}

function authoredPhases(enemy) {
  if (enemy.id === "symbiosis_mother") return symbiosisMotherPhases(enemy);
  if (enemy.id === "blooming_parasitic_garden") return gardenPhases(enemy);
  if (enemy.id === "grand_alchemy_perfume_core") return alchemyCorePhases();
  if (enemy.id === "forbidden_perfume_computation") return computationPhases(enemy);
  return singlePhase(enemy);
}

export function prepareLateBossPattern(enemy) {
  if (!enemy?.isBoss || !Array.isArray(enemy.pattern) || !enemy.pattern.length) return enemy;
  if (!Array.isArray(enemy.phases) || !enemy.phases.length) enemy.phases = authoredPhases(enemy);
  // engine-core's legacy bosses gain an unrelated 50%-HP rage phase. Late-game
  // bosses use explicit authored patterns, so mark the compatibility flag as
  // already consumed. The V2 planner owns their actual action sequence.
  enemy.phase2 = true;
  return enemy;
}

function latestSummon(run, id) {
  return [...(run?.battle?.enemies || [])]
    .reverse()
    .find((enemy) => enemy?.summoned && enemy.id === id && enemy.hp > 0);
}

function specializeOrgan(enemy, kind, empowered = false) {
  if (!enemy) return;
  const hpMultiplier = empowered ? 1.35 : 1;
  if (!enemy.customState?.lateOrganConfigured) {
    enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * hpMultiplier));
    enemy.hp = Math.min(enemy.maxHp, Math.max(1, Math.round(enemy.hp * hpMultiplier)));
  }
  enemy.customState ??= {};
  enemy.customState.lateOrganConfigured = true;
  enemy.customState.empowered = empowered;
  if (kind === "spore") {
    enemy.name = empowered ? "강화 포자 기관" : "포자 기관";
    enemy.pattern = [
      debuff({ poison: empowered ? 3 : 2 }, { name: "독향 포자" }),
      attack(empowered ? 12 : 10, "nonContact"),
      guard(empowered ? 10 : 8),
    ];
  } else {
    enemy.name = empowered ? "강화 균사 기관" : "균사 기관";
    enemy.pattern = [
      guard(empowered ? 12 : 10, { applyAllies: { regeneration: { stacks: empowered ? 4 : 3, turns: 1 } }, name: "균사 회복" }),
      guard(empowered ? 14 : 11),
      attack(empowered ? 10 : 8, "nonContact"),
    ];
  }
  enemy.patternFixedTurns = enemy.pattern.length;
  enemy.intent = clone(enemy.pattern[0]);
}

export function afterLateBossAction(run, enemy, intent) {
  if (!run?.battle || !enemy?.isBoss || !intent) return;
  if (enemy.id === "symbiosis_mother") {
    const phase2 = (enemy.hp || 0) / Math.max(1, enemy.maxHp || 1) <= 0.5;
    if (intent.lateHook === "summonSporeOrgan")
      specializeOrgan(latestSummon(run, "spore_organ"), "spore", phase2 && !enemy.customState?.empoweredOrganChosen);
    if (intent.lateHook === "summonMyceliumOrgan")
      specializeOrgan(latestSummon(run, "mycelium_organ"), "mycelium", phase2 && !enemy.customState?.empoweredOrganChosen);
    if (phase2 && ["summonSporeOrgan", "summonMyceliumOrgan"].includes(intent.lateHook))
      enemy.customState.empoweredOrganChosen = true;
    if (intent.lateHook === "empowerSymbiosisOrgan") {
      const organ = (run.battle.enemies || []).find((target) => target.summoned && target.hp > 0 && ["spore_organ", "mycelium_organ"].includes(target.id));
      if (organ) {
        specializeOrgan(organ, organ.id === "spore_organ" ? "spore" : "mycelium", true);
        enemy.customState ??= {};
        enemy.customState.empoweredOrganChosen = true;
      }
    }
  }
}

export function prepareLateBosses(run) {
  for (const enemy of run?.battle?.enemies || []) prepareLateBossPattern(enemy);
  return run;
}

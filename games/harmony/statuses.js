export const STATUS_DEFINITIONS = {
  intimidated: {
    name: "위축", icon: "▽", color: "#b7a8d8", kind: "debuff", tags: ["debuff", "damage"],
    maxStacks: 99, maxTurns: 1, defaultTurns: 1, stackRule: "replace", durationRule: "refresh",
    durationTick: "turnEnd", description: "1턴 동안 주는 직접 피해가 중첩 수만큼 감소합니다.",
  },
  vulnerable: {
    name: "취약",
    icon: "◇",
    color: "#ef9b87",
    kind: "debuff",
    tags: ["debuff", "damage"],
    maxStacks: 5,
    decay: "turnEnd",
    description: "받는 직접 피해가 중첩당 10% 증가합니다.",
  },
  weak: {
    name: "약화",
    icon: "▽",
    color: "#b7a8d8",
    kind: "debuff",
    tags: ["debuff", "damage"],
    maxStacks: 5,
    decay: "turnEnd",
    description: "주는 직접 피해가 중첩당 10% 감소합니다.",
  },
  corrosion: {
    name: "부식",
    icon: "◌",
    color: "#9dbc75",
    kind: "debuff",
    tags: ["debuff", "shield"],
    maxStacks: 99,
    decay: "turnEnd",
    description: "얻는 방어막이 중첩당 10% 감소합니다.",
  },
  poison: {
    name: "중독",
    icon: "✣",
    color: "#84bd65",
    kind: "debuff",
    tags: ["debuff", "damageOverTime"],
    maxStacks: 99,
    tick: "turnEnd",
    decay: "afterTick",
    description:
      "자신의 턴 종료 시 중첩만큼 방어막 무시 피해를 받고 1 감소합니다.",
  },
  resonance: {
    name: "잔향",
    icon: "≋",
    color: "#e8bc75",
    kind: "mark",
    tags: ["mark", "scent"],
    maxStacks: 99,
    description:
      "카드와 특성의 추가 효과가 참조하거나 소비할 수 있는 향기 표식입니다.",
  },
  overload: {
    name: "과부하",
    icon: "ϟ",
    color: "#ed795f",
    kind: "debuff",
    tags: ["debuff", "resource"],
    maxStacks: 9,
    decay: "turnEnd",
    description:
      "3중첩마다 카드 AP 비용이 1 증가하며, 턴 종료 시 1 감소합니다.",
  },
  concentration: {
    name: "향기 농도",
    icon: "◈",
    color: "#f8e29a",
    kind: "buff",
    tags: ["buff", "scent"],
    maxStacks: 20,
    consume: "cardPlayed",
    description:
      "직접 피해와 방어막이 중첩당 1 증가합니다. 카드를 사용하면 1 감소합니다.",
  },
  thorns: {
    name: "가시",
    icon: "✦",
    color: "#81c59b",
    kind: "buff",
    tags: ["buff", "retaliate"],
    maxStacks: 30,
    decay: "turnEnd",
    description:
      "접촉 공격을 받으면 공격자에게 중첩만큼 방어막 무시 피해를 주고 1 감소합니다. 비접촉 공격에는 발동하지 않습니다.",
  },
  strength: {
    name: "강화",
    icon: "▲",
    color: "#e8a66a",
    kind: "buff",
    category: "duration",
    tags: ["buff", "damage", "duration"],
    maxStacks: 5,
    maxTurns: 9,
    defaultTurns: 2,
    stackRule: "add",
    durationRule: "refresh",
    modifier: "outgoingDirectDamage",
    modifierPerStack: 0.1,
    durationTick: "turnEnd",
    description:
      "주는 직접 피해가 중첩당 10% 증가합니다. 자신의 턴 종료 시 남은 턴이 1 감소합니다.",
  },
  regeneration: {
    name: "재생",
    icon: "✚",
    color: "#82d49a",
    kind: "buff",
    category: "duration",
    tags: ["buff", "healing", "duration"],
    maxStacks: 20,
    maxTurns: 9,
    defaultTurns: 3,
    stackRule: "add",
    durationRule: "refresh",
    trigger: "turnStart",
    durationTick: "afterTrigger",
    description:
      "턴 시작 시 중첩만큼 체력을 회복합니다. 발동 후 남은 턴이 1 감소합니다.",
  },
  protection: {
    name: "보호",
    icon: "⬡",
    color: "#8fcbd4",
    kind: "buff",
    category: "duration",
    tags: ["buff", "damage", "duration"],
    maxStacks: 5,
    maxTurns: 9,
    defaultTurns: 2,
    stackRule: "add",
    durationRule: "refresh",
    modifier: "incomingDirectDamage",
    modifierPerStack: -0.1,
    durationTick: "turnEnd",
    description:
      "받는 직접 피해가 중첩당 10% 감소합니다. 자신의 턴 종료 시 남은 턴이 1 감소합니다.",
  },
  bleed: {
    name: "출혈",
    icon: "◆",
    color: "#d86e73",
    kind: "debuff",
    category: "duration",
    tags: ["debuff", "damageOverTime", "duration"],
    maxStacks: 30,
    maxTurns: 9,
    defaultTurns: 3,
    stackRule: "add",
    durationRule: "refresh",
    triggers: ["afterAction", "turnEnd"],
    effect: "bypassDamage",
    durationTick: "turnEnd",
    description:
      "행동한 후와 자신의 턴 종료 시 중첩만큼 방어막 무시 피해를 받습니다. 턴 종료 후 남은 턴이 1 감소합니다.",
  },
  burning: {
    name: "연소",
    icon: "♨",
    color: "#ef8c59",
    kind: "debuff",
    category: "duration",
    tags: ["debuff", "damageOverTime", "duration"],
    maxStacks: 30,
    maxTurns: 9,
    defaultTurns: 3,
    stackRule: "add",
    durationRule: "refresh",
    triggers: ["turnEnd"],
    effect: "bypassDamage",
    durationTick: "turnEnd",
    description:
      "자신의 턴 종료 시 중첩만큼 고정 피해를 받습니다. 발동 후 남은 턴이 1 감소합니다.",
  },
  scentBlock: {
    name: "향기 차단",
    icon: "⊘",
    color: "#9b91b5",
    kind: "debuff",
    category: "duration",
    tags: ["debuff", "scent", "restriction", "duration"],
    targets: ["player"],
    maxStacks: 1,
    maxTurns: 9,
    defaultTurns: 1,
    stackRule: "replace",
    durationRule: "refresh",
    restriction: "notes",
    durationTick: "turnEnd",
    description:
      "노트가 쌓이지 않고 노트 조합 효과가 발동하지 않습니다. 플레이어 턴 종료 시 남은 턴이 1 감소합니다.",
  },
  intangible: {
    name: "무형",
    icon: "◌",
    color: "#aebbd4",
    kind: "buff",
    category: "duration",
    tags: ["buff", "damage", "duration"],
    maxStacks: 1,
    maxTurns: 9,
    defaultTurns: 1,
    stackRule: "replace",
    durationRule: "refresh",
    modifier: "incomingDamage",
    modifierPerStack: -0.5,
    durationTick: "turnStart",
    description:
      "받는 모든 피해가 50% 감소합니다. 자신의 턴 시작 시 남은 턴이 1 감소합니다.",
  },
  shieldRetention: {
    name: "방어막 보존",
    icon: "▣",
    color: "#79b9aa",
    kind: "buff",
    category: "duration",
    tags: ["buff", "shield", "duration"],
    targets: ["player"],
    maxStacks: 5,
    maxTurns: 9,
    defaultTurns: 2,
    stackRule: "add",
    durationRule: "refresh",
    modifier: "shieldRetention",
    modifierPerStack: 0.2,
    durationTick: "turnStart",
    description:
      "다음 턴에 방어막을 중첩당 20% 보존합니다. 턴 시작 시 보존 효과 적용 후 남은 턴이 1 감소합니다.",
  },
  stun: {
    name: "기절",
    icon: "✹",
    color: "#f2c75c",
    kind: "debuff",
    category: "control",
    tags: ["debuff", "control", "action"],
    maxStacks: 1,
    stackRule: "replace",
    restriction: "allActions",
    description:
      "해당 턴의 행동 전체를 취소합니다. 발동 후 제거되며 다음 행동 1회 동안 연속 기절에 저항합니다.",
  },
  seal: {
    name: "봉인",
    icon: "▧",
    color: "#b69ad9",
    kind: "debuff",
    category: "control",
    tags: ["debuff", "control", "card"],
    targets: ["player"],
    maxStacks: 1,
    maxTurns: 9,
    defaultTurns: 1,
    stackRule: "replace",
    durationRule: "refresh",
    restriction: "selectedCards",
    durationTick: "turnEnd",
    description:
      "지정된 노트·카드 유형·카드 ID에 해당하는 카드를 사용할 수 없습니다. 지정값이 없으면 모든 노트를 봉인합니다.",
  },
  silence: {
    name: "침묵",
    icon: "∅",
    color: "#9ba5bd",
    kind: "debuff",
    category: "control",
    tags: ["debuff", "control", "passive"],
    maxStacks: 1,
    maxTurns: 9,
    defaultTurns: 1,
    stackRule: "replace",
    durationRule: "refresh",
    restriction: "passives",
    durationTick: "turnEnd",
    description:
      "특성과 유물의 효과가 발동하지 않습니다. 능력치 아이템과 상태 효과는 유지됩니다.",
  },
  bind: {
    name: "속박",
    icon: "⌁",
    color: "#7fa9c7",
    kind: "debuff",
    category: "control",
    tags: ["debuff", "control", "draw"],
    targets: ["player"],
    maxStacks: 5,
    maxTurns: 9,
    defaultTurns: 1,
    stackRule: "add",
    durationRule: "refresh",
    modifier: "drawPenalty",
    modifierPerStack: 1,
    durationTick: "turnEnd",
    description:
      "카드를 뽑을 때 중첩당 1장 적게 뽑습니다. 최소 드로우는 0장입니다.",
  },
  confusion: {
    name: "혼란",
    icon: "↯",
    color: "#d69ac4",
    kind: "debuff",
    category: "control",
    tags: ["debuff", "control", "cost"],
    targets: ["player"],
    maxStacks: 3,
    maxTurns: 9,
    defaultTurns: 1,
    stackRule: "add",
    durationRule: "refresh",
    restriction: "confusedCost",
    durationTick: "turnEnd",
    description:
      "지정된 카드의 AP 비용이 중첩당 1 증가합니다. 지정값이 없으면 모든 카드에 적용됩니다.",
  },
  interference: {
    name: "방해",
    icon: "※",
    color: "#d78972",
    kind: "debuff",
    category: "control",
    tags: ["debuff", "control", "failure"],
    targets: ["player"],
    maxStacks: 5,
    maxTurns: 9,
    defaultTurns: 1,
    stackRule: "add",
    durationRule: "refresh",
    modifier: "cardFailureChance",
    modifierPerStack: 0.1,
    durationTick: "turnEnd",
    description:
      "사용한 카드가 중첩당 10% 확률로 실패합니다. AP와 카드는 소비되며 확률은 최대 50%입니다.",
  },
  disarm: {
    name: "무장 해제",
    icon: "⚔",
    color: "#c58d83",
    kind: "debuff",
    category: "control",
    tags: ["debuff", "control", "attack"],
    maxStacks: 1,
    maxTurns: 9,
    defaultTurns: 1,
    stackRule: "replace",
    durationRule: "refresh",
    restriction: "attacks",
    durationTick: "turnEnd",
    description:
      "공격 카드 또는 공격 행동을 사용할 수 없습니다. 방어와 기능 행동은 가능합니다.",
  },
  noteCollapse: {
    name: "노트 붕괴",
    icon: "≀",
    color: "#ae8fbd",
    kind: "debuff",
    category: "control",
    tags: ["debuff", "control", "scent", "instant"],
    targets: ["player"],
    maxStacks: 1,
    instant: true,
    description:
      "현재 쌓아놓은 노트 순서를 즉시 모두 제거합니다. 지속 상태로 남지 않습니다.",
  },
  impurityLock: {
    name: "불순물 고정",
    icon: "▰",
    color: "#867f91",
    kind: "debuff",
    category: "control",
    tags: ["debuff", "control", "impurity"],
    targets: ["player"],
    maxStacks: 1,
    maxTurns: 9,
    defaultTurns: 1,
    stackRule: "replace",
    durationRule: "refresh",
    restriction: "impurityDiscard",
    durationTick: "turnEnd",
    description:
      "불순물 카드를 손패에서 버리거나 교체할 수 없습니다. 사용 불가 속성은 그대로 유지됩니다.",
  },
};

export function createStatuses() {
  return {};
}
export function canTarget(id, target) {
  const targets = STATUS_DEFINITIONS[id]?.targets;
  return !targets || targets.includes(target);
}
export function stacks(entity, id) {
  return Math.max(0, entity?.statuses?.[id]?.stacks || 0);
}
export function turns(entity, id) {
  return Math.max(0, entity?.statuses?.[id]?.turns || 0);
}
export function applyStatus(entity, id, amount = 1) {
  const definition = STATUS_DEFINITIONS[id],
    options = typeof amount === "object" ? amount : { stacks: amount },
    added = Math.floor(options.stacks ?? options.value ?? 1);
  if (!definition || !entity || added <= 0 || definition.instant) return 0;
  entity.statuses ??= {};
  const before = stacks(entity, id),
    after = Math.min(
      definition.maxStacks,
      definition.stackRule === "replace" ? added : before + added,
    ),
    currentTurns = turns(entity, id);
  const state = { ...(entity.statuses[id] || {}), stacks: after };
  if (definition.defaultTurns) {
    const incoming = Math.max(
      1,
      Math.floor(options.turns ?? definition.defaultTurns),
    );
    state.turns =
      definition.durationRule === "extend"
        ? Math.min(definition.maxTurns, currentTurns + incoming)
        : Math.min(definition.maxTurns, Math.max(currentTurns, incoming));
  }
  for (const key of ["notes", "cardTypes", "cardIds"])
    if (Array.isArray(options[key]))
      state[key] = [
        ...new Set(options[key].filter((value) => typeof value === "string")),
      ];
  if (Number.isFinite(options.modifierPerStack))
    state.modifierPerStack = options.modifierPerStack;
  if (Number.isFinite(options.deferDecayTurns))
    state.deferDecayTurns = Math.max(0, Math.floor(options.deferDecayTurns));
  if (typeof options.description === "string")
    state.description = options.description;
  entity.statuses[id] = state;
  return Math.max(0, after - before);
}
export function deferTurnEnd(entity, id) {
  const state = entity?.statuses?.[id],
    definition = STATUS_DEFINITIONS[id];
  if (!state || !definition) return;
  if (definition.decay === "turnEnd") state.deferDecayTurnEnd = true;
  if (definition.durationTick === "turnEnd")
    state.deferDurationTurnEnd = true;
}
export function removeStatus(entity, id, amount = Infinity) {
  if (!entity?.statuses?.[id]) return 0;
  const before = stacks(entity, id),
    left = Math.max(0, before - amount);
  if (left) entity.statuses[id].stacks = left;
  else delete entity.statuses[id];
  return before - left;
}
export function dispelStatuses(
  entity,
  { tags = [], kind = null, limit = Infinity } = {},
) {
  let removed = 0;
  for (const id of Object.keys(entity?.statuses || {})) {
    const definition = STATUS_DEFINITIONS[id];
    if (
      !definition ||
      definition.dispellable === false ||
      (kind && definition.kind !== kind) ||
      (tags.length && !tags.some((tag) => definition.tags.includes(tag)))
    )
      continue;
    removeStatus(entity, id);
    removed++;
    if (removed >= limit) break;
  }
  return removed;
}
export function decayStatuses(entity, timing = "turnEnd") {
  for (const [id, definition] of Object.entries(STATUS_DEFINITIONS)) {
    if (definition.decay !== timing) continue;
    const state = entity?.statuses?.[id];
    if (state?.deferDecayTicks > 0) {
      state.deferDecayTicks--;
      continue;
    }
    if (timing === "turnEnd" && state?.deferDecayTurnEnd) {
      delete state.deferDecayTurnEnd;
      continue;
    }
    if (timing === "turnEnd" && state?.deferDecayTurns > 0) {
      state.deferDecayTurns--;
      continue;
    }
    removeStatus(entity, id, 1);
  }
}
export function tickDurations(entity, timing = "turnEnd") {
  for (const [id, state] of Object.entries(entity?.statuses || {})) {
    const definition = STATUS_DEFINITIONS[id];
    if (!definition?.defaultTurns || definition.durationTick !== timing)
      continue;
    if (timing === "turnEnd" && state.deferDurationTurnEnd) {
      delete state.deferDurationTurnEnd;
      continue;
    }
    state.turns = Math.max(0, turns(entity, id) - 1);
    if (!state.turns) delete entity.statuses[id];
  }
}
export function modifier(entity, key) {
  return Object.entries(entity?.statuses || {}).reduce((total, [id, state]) => {
    const definition = STATUS_DEFINITIONS[id];
    return (
      total +
      (definition?.modifier === key
        ? (state.modifierPerStack ?? definition.modifierPerStack) * state.stacks
        : 0)
    );
  }, 0);
}
export function triggered(entity, event) {
  return Object.entries(entity?.statuses || {})
    .filter(([id]) => STATUS_DEFINITIONS[id]?.triggers?.includes(event))
    .map(([id, state]) => ({ id, state, definition: STATUS_DEFINITIONS[id] }));
}
export function restricted(entity, key) {
  return Object.keys(entity?.statuses || {}).some(
    (id) => STATUS_DEFINITIONS[id]?.restriction === key,
  );
}
function cardType(card) {
  return card.attackPattern || card.attack || card.burst || card.weight
    ? "attack"
    : card.shield
      ? "defense"
      : card.oil
        ? "oil"
        : "effect";
}
function selected(state, card, defaultMatch = true) {
  const selectors = [
    state?.notes?.includes(card.note),
    state?.cardTypes?.includes(cardType(card)),
    state?.cardIds?.includes(card.id),
  ].filter((value) => value !== undefined);
  return selectors.length ? selectors.some(Boolean) : defaultMatch;
}
export function cardRestricted(entity, card) {
  if (!card) return true;
  if (
    restricted(entity, "allActions") ||
    (restricted(entity, "attacks") && cardType(card) === "attack")
  )
    return true;
  const seal = entity?.statuses?.seal;
  if (seal && selected(seal, card)) return true;
  return false;
}
export function cardCostChange(entity, card) {
  const state = entity?.statuses?.confusion;
  return state && selected(state, card) ? stacks(entity, "confusion") : 0;
}
export function drawPenalty(entity) {
  return Math.max(0, Math.round(modifier(entity, "drawPenalty")));
}
export function cardFailureChance(entity) {
  return Math.min(0.5, Math.max(0, modifier(entity, "cardFailureChance")));
}
export function damageTaken(base, target) {
  return Math.max(
    0,
    Math.round(base * Math.max(0.2, 1 + modifier(target, "incomingDamage"))),
  );
}
function roundModifiedValue(base, modified) {
  if (modified < base) return Math.floor(modified);
  if (modified > base) return Math.ceil(modified);
  return Math.round(modified);
}
export function directDamage(base, source, target) {
  const weak = Math.min(0.8, stacks(source, "weak") * 0.1),
    vulnerable =
      stacks(target, "vulnerable") *
      (target?.statuses?.vulnerable?.modifierPerStack ?? 0.1),
    concentration = stacks(source, "concentration"),
    directDamageRate = Math.max(
      0.2,
      1 - weak + vulnerable +
        modifier(source, "outgoingDirectDamage") +
        modifier(target, "incomingDirectDamage"),
    );
  const modified =
    Math.max(0, base + concentration - stacks(source, "intimidated")) *
    directDamageRate;
  return damageTaken(roundModifiedValue(base, modified), target);
}
export function shieldGain(base, entity) {
  const corrosion = Math.min(0.8, stacks(entity, "corrosion") * 0.1),
    raw = Math.max(0, base + stacks(entity, "concentration"));
  return Math.max(0, Math.floor(raw * (1 - corrosion)));
}
export function extraCost(entity) {
  return Math.floor(stacks(entity, "overload") / 3);
}
export function consumeCardStatuses(entity) {
  removeStatus(entity, "concentration", 1);
}

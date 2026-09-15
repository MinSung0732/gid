export const REWARD_SOURCES = Object.freeze({
  combat: "combat",
  gather: "gather",
  golden: "golden",
  elite: "elite",
  boss: "boss",
  signatureBoss: "signatureBoss",
  shop: "shop",
  treasureEvent: "treasureEvent",
  curseEvent: "curseEvent",
  anyReward: "anyReward",
});

const ITEM_TIER = (t1 = 0, t2 = 0, t3 = 0, t4 = 0) => Object.freeze([t1, t2, t3, t4]);
const CARD_TIER = ITEM_TIER;

export const REWARD_PROFILES = Object.freeze({
  combat: Object.freeze({
    source: REWARD_SOURCES.combat,
    rewardPool: "active",
    type: "card",
    optionCount: 3,
    pickCount: 1,
    allowSkip: true,
    tierWeights: CARD_TIER(60, 28, 10, 2),
  }),
  gather: Object.freeze({
    source: REWARD_SOURCES.gather,
    rewardPool: "stat",
    type: "item",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    kindWeights: Object.freeze({ stat: 100 }),
    tierWeightsByKind: Object.freeze({
      stat: ITEM_TIER(65, 28, 6, 1),
    }),
  }),
  golden: Object.freeze({
    source: REWARD_SOURCES.golden,
    rewardPool: "augment",
    type: "item",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    kindWeights: Object.freeze({ stat: 20, trait: 50, relic: 30 }),
    tierWeightsByKind: Object.freeze({
      stat: ITEM_TIER(45, 35, 17, 3),
      trait: ITEM_TIER(35, 35, 22, 8),
      relic: ITEM_TIER(75, 0, 23, 2),
    }),
  }),
  elite: Object.freeze({
    source: REWARD_SOURCES.elite,
    rewardPool: "eliteAugment",
    type: "item",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    kindWeights: Object.freeze({ trait: 65, relic: 35 }),
    tierWeightsByKind: Object.freeze({
      trait: ITEM_TIER(28, 35, 29, 8),
      relic: ITEM_TIER(55, 0, 42, 3),
    }),
  }),
  boss: Object.freeze({
    source: REWARD_SOURCES.boss,
    rewardPool: "bossAugment",
    type: "item",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    kindWeights: Object.freeze({ trait: 45, relic: 55 }),
    tierWeightsByKind: Object.freeze({
      trait: ITEM_TIER(15, 25, 42, 18),
      relic: ITEM_TIER(35, 0, 60, 5),
    }),
  }),
  signatureBoss: Object.freeze({
    source: REWARD_SOURCES.signatureBoss,
    rewardPool: "signature",
    type: "item",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
  }),
  shopCard: Object.freeze({
    source: REWARD_SOURCES.shop,
    rewardPool: "shopActive",
    type: "card",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    tierWeights: CARD_TIER(60, 28, 10, 2),
  }),
  shopTrait: Object.freeze({
    source: REWARD_SOURCES.shop,
    rewardPool: "shopTrait",
    type: "item",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    kindWeights: Object.freeze({ trait: 100 }),
    tierWeightsByKind: Object.freeze({
      trait: ITEM_TIER(50, 32, 15, 3),
    }),
  }),
  shopRelic: Object.freeze({
    source: REWARD_SOURCES.shop,
    rewardPool: "shopRelic",
    type: "item",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    kindWeights: Object.freeze({ relic: 100 }),
    tierWeightsByKind: Object.freeze({
      relic: ITEM_TIER(90, 0, 9, 1),
    }),
  }),
});

export const SHOP_SLOT_PROFILES = Object.freeze([
  Object.freeze({ card: 100 }),
  Object.freeze({ trait: 70, relic: 30 }),
  Object.freeze({ card: 50, trait: 35, relic: 15 }),
  Object.freeze({ card: 50, trait: 35, relic: 15 }),
  Object.freeze({ card: 50, trait: 35, relic: 15 }),
]);

export const SPECIAL_REWARD_PROFILES = Object.freeze({
  mysterySafe: Object.freeze({
    source: REWARD_SOURCES.treasureEvent,
    rewardPool: "mysterySafe",
    type: "item",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    kindWeights: Object.freeze({ stat: 100 }),
    tierWeightsByKind: Object.freeze({ stat: ITEM_TIER(100, 0, 0, 0) }),
  }),
  mysteryJackpot: Object.freeze({
    source: REWARD_SOURCES.treasureEvent,
    rewardPool: "mysteryJackpot",
    type: "itemEntry",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    entries: Object.freeze([
      Object.freeze({ kind: "trait", tier: 3, weight: 45 }),
      Object.freeze({ kind: "relic", tier: 2, weight: 50 }),
      Object.freeze({ kind: "relic", tier: 3, weight: 5 }),
    ]),
  }),
  cursePitRelic: Object.freeze({
    source: REWARD_SOURCES.curseEvent,
    rewardPool: "cursePitRelic",
    type: "itemEntry",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    entries: Object.freeze([Object.freeze({ kind: "relic", tier: 2, weight: 100 })]),
  }),
  bloodRelic: Object.freeze({
    source: REWARD_SOURCES.curseEvent,
    rewardPool: "bloodRelic",
    type: "itemEntry",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    entries: Object.freeze([Object.freeze({ kind: "relic", tier: 2, weight: 100 })]),
  }),
  bloodTrait: Object.freeze({
    source: REWARD_SOURCES.curseEvent,
    rewardPool: "bloodTrait",
    type: "itemEntry",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    entries: Object.freeze([
      Object.freeze({ kind: "trait", tier: 1, weight: 45 }),
      Object.freeze({ kind: "trait", tier: 2, weight: 40 }),
      Object.freeze({ kind: "trait", tier: 3, weight: 15 }),
    ]),
  }),
  smugglerRelic: Object.freeze({
    source: REWARD_SOURCES.curseEvent,
    rewardPool: "smugglerRelic",
    type: "itemEntry",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    entries: Object.freeze([
      Object.freeze({ kind: "relic", tier: 0, weight: 55 }),
      Object.freeze({ kind: "relic", tier: 2, weight: 42 }),
      Object.freeze({ kind: "relic", tier: 3, weight: 3 }),
    ]),
  }),
  smugglerTrait: Object.freeze({
    source: REWARD_SOURCES.curseEvent,
    rewardPool: "smugglerTrait",
    type: "itemEntry",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    entries: Object.freeze([
      Object.freeze({ kind: "trait", tier: 1, weight: 45 }),
      Object.freeze({ kind: "trait", tier: 2, weight: 40 }),
      Object.freeze({ kind: "trait", tier: 3, weight: 15 }),
    ]),
  }),
});

export const DICE_ALTAR_OUTCOMES = Object.freeze([
  Object.freeze({ type: "item", kind: "stat", tier: 0, weight: 20 }),
  Object.freeze({ type: "item", kind: "trait", tier: 1, weight: 15 }),
  Object.freeze({ type: "item", kind: "trait", tier: 2, weight: 10 }),
  Object.freeze({ type: "item", kind: "trait", tier: 3, weight: 5 }),
  Object.freeze({ type: "item", kind: "relic", tier: 0, weight: 15 }),
  Object.freeze({ type: "item", kind: "relic", tier: 2, weight: 8 }),
  Object.freeze({ type: "item", kind: "relic", tier: 3, weight: 2 }),
  Object.freeze({ type: "gold", amount: 30, weight: 10 }),
  Object.freeze({ type: "curse", tier: 0, weight: 10 }),
  Object.freeze({ type: "curse", tier: 1, weight: 5 }),
]);

function clampCount(value, fallback) {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : fallback));
}
function countDelta(value) {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}
const SOURCE_ALIASES = Object.freeze({
  combat: REWARD_SOURCES.combat,
  gather: REWARD_SOURCES.gather,
  golden: REWARD_SOURCES.golden,
  elite: REWARD_SOURCES.elite,
  boss: REWARD_SOURCES.boss,
  signatureBoss: REWARD_SOURCES.signatureBoss,
  shop: REWARD_SOURCES.shop,
  treasure: REWARD_SOURCES.treasureEvent,
  treasureEvent: REWARD_SOURCES.treasureEvent,
  curse: REWARD_SOURCES.curseEvent,
  curseEvent: REWARD_SOURCES.curseEvent,
  all: REWARD_SOURCES.anyReward,
  any: REWARD_SOURCES.anyReward,
  anyReward: REWARD_SOURCES.anyReward,
});
function rewardModifierParts(rewardModifier, source) {
  if (!rewardModifier || typeof rewardModifier !== "object") return [];
  const parts = [];
  if (Number.isFinite(rewardModifier.optionCount) || Number.isFinite(rewardModifier.pickCount)) {
    const sources = Array.isArray(rewardModifier.sources)
      ? rewardModifier.sources.map((entry) => SOURCE_ALIASES[entry] || entry)
      : [SOURCE_ALIASES[rewardModifier.source] || rewardModifier.source || REWARD_SOURCES.anyReward];
    if (sources.includes(source) || sources.includes(REWARD_SOURCES.anyReward)) parts.push(rewardModifier);
  }
  for (const key of [REWARD_SOURCES.anyReward, source]) {
    const nested = rewardModifier[key];
    if (nested && typeof nested === "object") parts.push(nested);
  }
  // Data-friendly aliases let future augments modify reward counts without
  // touching any room implementation. Both the terse and design-doc naming
  // styles are accepted (goldenOptionCount / goldenRewardOptions, etc.).
  const aliases = [
    [REWARD_SOURCES.anyReward, "all"],
    [REWARD_SOURCES.combat, "combat"],
    [REWARD_SOURCES.gather, "gather"],
    [REWARD_SOURCES.golden, "golden"],
    [REWARD_SOURCES.elite, "elite"],
    [REWARD_SOURCES.boss, "boss"],
    [REWARD_SOURCES.signatureBoss, "signatureBoss"],
    [REWARD_SOURCES.shop, "shop"],
    [REWARD_SOURCES.treasureEvent, "treasure"],
    [REWARD_SOURCES.curseEvent, "curse"],
  ];
  for (const [targetSource, prefix] of aliases) {
    if (targetSource !== source && targetSource !== REWARD_SOURCES.anyReward) continue;
    const optionCount = [
        rewardModifier[`${prefix}OptionCount`],
        rewardModifier[`${prefix}RewardOptions`],
      ].find(Number.isFinite),
      pickCount = [
        rewardModifier[`${prefix}PickCount`],
        rewardModifier[`${prefix}RewardPick`],
      ].find(Number.isFinite);
    if (Number.isFinite(optionCount) || Number.isFinite(pickCount))
      parts.push({ optionCount, pickCount });
  }
  return parts;
}

export function collectRewardModifiers(inventory = [], items = {}, source) {
  return inventory.flatMap((id) => rewardModifierParts(items[id]?.rewardModifier, source));
}

export function applyRewardModifiers(baseConfig, modifiers = []) {
  const config = {
    ...baseConfig,
    optionCount: clampCount(baseConfig.optionCount, 1),
    pickCount: clampCount(baseConfig.pickCount, 1),
  };
  for (const modifier of modifiers) {
    config.optionCount = Math.max(0, config.optionCount + countDelta(modifier.optionCount));
    config.pickCount = Math.max(0, config.pickCount + countDelta(modifier.pickCount));
  }
  // optionCount and pickCount are accumulated independently, then normalized
  // only at the final boundary: a player cannot take more rewards than exist.
  config.pickCount = config.optionCount === 0 ? 0 : Math.min(config.pickCount, config.optionCount);
  return config;
}

export function rewardOptionKey(option) {
  if (!option) return null;
  if (option.type === "card" || option.type === "item") return `${option.type}:${option.id}`;
  return null;
}

export function createRewardOffer(config, rollOption, id) {
  const optionCount = clampCount(config.optionCount, 1),
    pickCount = clampCount(config.pickCount, 1),
    options = [],
    excludedKeys = new Set();
  for (let index = 0; index < optionCount; index++) {
    const option = rollOption(index, excludedKeys);
    if (!option) continue;
    const optionId = `${id}:option:${index + 1}`,
      normalized = { ...option, optionId, claimed: false };
    options.push(normalized);
    if (!config.allowDuplicatePick) {
      const key = rewardOptionKey(normalized);
      if (key) excludedKeys.add(key);
    }
  }
  return {
    id,
    source: config.source,
    rewardPool: config.rewardPool,
    options,
    optionCount,
    pickCount,
    remainingPicks: Math.min(pickCount, options.length),
    allowSkip: config.allowSkip !== false,
    allowDuplicatePick: Boolean(config.allowDuplicatePick),
    grantMode: config.grantMode || "claim",
    claimedOptionIds: [],
    consumed: options.length === 0 || pickCount === 0,
    skipped: false,
    metadata: { ...(config.metadata || {}) },
  };
}

export function claimOfferState(offer, optionId) {
  if (!offer || offer.consumed || offer.remainingPicks <= 0) return false;
  const option = offer.options?.find((candidate) => candidate.optionId === optionId);
  if (!option || option.claimed || offer.claimedOptionIds?.includes(optionId)) return false;
  option.claimed = true;
  offer.claimedOptionIds ??= [];
  offer.claimedOptionIds.push(optionId);
  offer.remainingPicks = Math.max(0, offer.remainingPicks - 1);
  const unclaimed = offer.options.filter((candidate) => !candidate.claimed).length;
  if (offer.remainingPicks <= 0 || unclaimed <= 0) offer.consumed = true;
  return true;
}

export function skipOfferState(offer) {
  if (!offer || offer.consumed || offer.allowSkip === false) return false;
  offer.skipped = true;
  offer.consumed = true;
  offer.remainingPicks = 0;
  return true;
}

export function activeRewardOffer(reward) {
  if (!reward?.groups?.length) return null;
  const start = Math.max(0, Math.floor(reward.activeGroupIndex || 0));
  for (let index = start; index < reward.groups.length; index++) {
    const offer = reward.groups[index];
    if (!offer?.consumed) {
      reward.activeGroupIndex = index;
      return offer;
    }
  }
  reward.activeGroupIndex = reward.groups.length;
  return null;
}

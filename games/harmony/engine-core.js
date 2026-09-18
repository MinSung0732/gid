import {
  ACT1_BOSSES,
  ACT1_ELITES,
  ACT2_BOSSES,
  ACT2_ELITES,
  ACT2_MONSTERS,
  ACT3_BOSSES,
  ACT3_ELITES,
  ACT3_MONSTERS,
  CARDS,
  CATEGORY_ROOM_WEIGHTS,
  EARLY_MONSTERS,
  ENEMIES,
  ITEMS,
  ROUTE,
  ROOM_CATEGORIES,
  STARTING_DECK,
  TABLES,
  UNLOCKS,
} from "./data.js?v=20260918-1";
import * as S from "./statuses.js?v=20260911-4";
import { HIDDEN_SYNERGIES } from "./synergies.js?v=20260918-1";
import { analyzeBuild, cardBuildIds } from "./build-analysis.js";
import {
  acquisitionAllows,
  augmentCardCost,
  cardBaseAp,
  consumeAugmentCardCostState,
  effectiveAttackPattern,
  isEffectiveImpurity,
  onAugmentActualDiscard,
  onAugmentCardUsed,
  onAugmentCardUseStart,
  onAugmentDrawSuccess,
  onAugmentFailedDraw,
  onAugmentReshuffle,
  onAugmentTurnStart,
  pendingAugmentRecoveryCards,
  recoverAugmentDiscard,
} from "./augment-event-runtime.js";
import {
  ATELIER_DROP_TABLE,
  ATELIER_MAX_STOCK,
  ATELIER_MIN_STOCK,
  ATELIER_TIER_PRICES,
} from "./atelier-shop.js";
import {
  DICE_ALTAR_OUTCOMES,
  REWARD_PROFILES,
  SHOP_SLOT_PROFILES,
  SPECIAL_REWARD_PROFILES,
  activeRewardOffer,
  applyRewardModifiers,
  claimOfferState,
  collectRewardModifiers,
  createRewardOffer,
  skipOfferState,
} from "./reward-system.js";
export const BASE_DECK_SIZE = 20;
export const MAX_DECK_SIZE = BASE_DECK_SIZE;
export const BASE_HARMONY_EFFECT = Object.freeze({
  id: "base_harmony",
  label: "HARMONY!",
  sequence: Object.freeze(["top", "middle", "base"]),
  baseDamage: 1,
  attackMultiplier: 1,
  attackPattern: "nonContact",
  visual: "default",
});
export const freshMeta = () => ({
  totalRuns: 0,
  highScore: 0,
  highestLoop: 0,
  unlocked: [],
  discovered: [],
  discoveredCards: [...new Set(STARTING_DECK)],
  defeatedMonsters: [],
  synergies: [],
  lastStartingDeck: null,
  achievementStats: { totalHarmonies: 0, act2Clears: 0, impuritiesPurified: 0 },
});
export function isContentUnlocked(meta, type, id) {
  const unlock = UNLOCKS.find((entry) => entry[type] === id && !entry.legacy);
  return !unlock || !meta || Boolean(meta.unlocked?.includes(unlock.id));
}
export function codexProgress(meta) {
  const cardIds = Object.keys(CARDS).filter((id) => id !== "impurity"),
    itemIds = Object.keys(ITEMS).filter((id) => !ITEMS[id].hidden), monsterIds = Object.keys(ENEMIES),
    foundMonsters = new Set([...Object.keys(EARLY_MONSTERS), ...(meta?.defeatedMonsters || [])]);
  const total = cardIds.length + itemIds.length + monsterIds.length;
  const found = cardIds.filter((id) => meta?.discoveredCards?.includes(id)).length +
    itemIds.filter((id) => meta?.discovered?.includes(id)).length +
    monsterIds.filter((id) => foundMonsters.has(id)).length;
  return { found, total, rate: total ? found / total : 0 };
}
export function codexPerks(meta) {
  const rate = codexProgress(meta).rate;
  return {
    startingGold: rate >= 0.2 ? 20 : 0,
    startingPotions: rate >= 0.4 ? 1 : 0,
    shopRerolls: rate >= 0.6 ? 1 : 0,
    turn1Ap: rate >= 0.8 ? 1 : 0,
    goldenCollection: rate >= 1,
  };
}
export function retainBetweenBattleStatuses(s) {
  const current = s?.statuses && typeof s.statuses === "object"
    ? s.statuses
    : S.createStatuses();
  const kept = S.createStatuses();
  for (const [id, state] of Object.entries(current)) {
    if (!S.STATUS_DEFINITIONS[id]?.persistsBetweenBattles) continue;
    kept[id] = { ...state };
  }
  if (s) s.statuses = kept;
  return kept;
}

export function synergyProgresses(s) {
  const owned = new Set(Array.isArray(s?.inventory) ? s.inventory : []);
  return Object.values(HIDDEN_SYNERGIES).map((synergy) => {
    const ownedCount = synergy.requires.filter((id) => owned.has(id)).length,
      total = synergy.requires.length;
    return { ...synergy, ownedCount, total, active: total > 0 && ownedCount === total };
  });
}
export function synergyProgress(s, synergyId) {
  return synergyProgresses(s).find((synergy) => synergy.id === synergyId) || null;
}
export function activeSynergies(s) {
  return synergyProgresses(s).filter((synergy) => synergy.active);
}
export function hasSynergy(s, synergyId) {
  return Boolean(synergyProgress(s, synergyId)?.active);
}
export const SYNERGY_ITEM_AFFINITY = Object.freeze({
  perOwnedComponent: 0.1,
  maxMultiplier: 1.25,
});

export function synergyItemAffinityWeight(s, itemOrId) {
  const item = typeof itemOrId === "string" ? ITEMS[itemOrId] : itemOrId;
  if (!item || !["trait", "relic"].includes(item.kind)) return 1;
  const owned = new Set(Array.isArray(s?.inventory) ? s.inventory : []);
  if (owned.has(item.id)) return 1;

  let bestOwnedCount = 0;
  for (const synergy of Object.values(HIDDEN_SYNERGIES)) {
    if (!synergy.requires?.includes(item.id)) continue;
    const ownedCount = synergy.requires.reduce(
      (count, id) => count + (owned.has(id) ? 1 : 0),
      0,
    );
    if (ownedCount <= 0 || ownedCount >= synergy.requires.length) continue;
    bestOwnedCount = Math.max(bestOwnedCount, ownedCount);
  }
  if (!bestOwnedCount) return 1;
  return Number(
    Math.min(
      SYNERGY_ITEM_AFFINITY.maxMultiplier,
      1 + bestOwnedCount * SYNERGY_ITEM_AFFINITY.perOwnedComponent,
    ).toFixed(3),
  );
}

function pickRewardItem(s, pool) {
  if (!pool.length) return null;
  const weights = pool.map((item) => synergyItemAffinityWeight(s, item));
  return weights.some((weight) => weight > 1)
    ? pool[weighted(s, weights)]
    : pick(s, pool);
}

export function synergyPower(s, effectKey) {
  return activeSynergies(s)
    .filter((synergy) => synergy.effect === effectKey)
    .reduce((sum, synergy) => sum + synergy.value, 0);
}
export function discoverSynergies(s, meta) {
  meta.synergies ??= [];
  const found = activeSynergies(s).filter((synergy) => !meta.synergies.includes(synergy.id));
  if (found.length) {
    meta.synergies.push(...found.map((synergy) => synergy.id));
    s._synergyDiscoveries = [...(s._synergyDiscoveries || []), ...found.map((synergy) => synergy.id)];
  }
  return found;
}
export function actInfo(loop) {
  if (loop === 0) return { act: 1, name: "버려진 공방", hp: 1, attack: 1 };
  if (loop === 1) return { act: 2, name: "농축 증류실", hp: 1.45, attack: 1.2 };
  if (loop === 2) return { act: 3, name: "공명의 심연", hp: 2.1, attack: 1.45 };
  return {
    act: 4, name: `무한 심연 ${loop - 2}`,
    hp: 2.8 * Math.pow(1.25, loop - 3),
    attack: 1.7 * Math.pow(1.15, loop - 3),
  };
}
export function random(s) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
function pick(s, values) {
  return values[Math.floor(random(s) * values.length)];
}
function weighted(s, weights) {
  let roll = random(s) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return weights.length - 1;
}
function shuffle(s, values) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const ROUTE_PACING_PROFILE = Object.freeze({
  nodeCount: 12,
  bossIndex: 11,
  normalCombatTarget: 4,
  eliteMin: 1,
  eliteMax: 2,
  shopTarget: 1,
  earlyCombatTarget: 2,
  midCombatTarget: 1,
  lateCombatTarget: 1,
  maxCombatLikeStreak: 2,
});

function combatLikeRoom(room) {
  return room === "combat" || room === "elite";
}

function wouldCreateCombatLikeStreak(route, index, room, maxStreak = 2) {
  const previous = route[index];
  route[index] = room;
  let streak = 0,
    invalid = false;
  for (const value of route) {
    if (combatLikeRoom(value)) {
      streak += 1;
      if (streak > maxStreak) {
        invalid = true;
        break;
      }
    } else streak = 0;
  }
  route[index] = previous;
  return invalid;
}

export function generateRoute(s) {
  const profile = ROUTE_PACING_PROFILE,
    route = Array(profile.nodeCount).fill(null),
    stage = s.loop + 1;
  route[profile.bossIndex] = "boss";

  // Early game still establishes the deck through combat, but mid/late pacing
  // deliberately opens more room for events, augments, rest and shop decisions.
  route[0] = "combat";
  const earlyExtra = pick(s, [1, 2, 3]);
  route[earlyExtra] = "combat";
  route[pick(s, [4, 5, 6, 7])] = "combat";
  route[pick(s, [8, 9, 10])] = "combat";

  const desiredEliteCount = Math.min(
      profile.eliteMax,
      profile.eliteMin + (random(s) < 0.35 ? 1 : 0),
    ),
    eliteCandidates = shuffle(
      s,
      Array.from({ length: profile.bossIndex }, (_, index) => index).filter(
        (index) =>
          !route[index] &&
          (stage !== 1 || index >= 3),
      ),
    );
  let eliteCount = 0;
  for (const index of eliteCandidates) {
    if (
      wouldCreateCombatLikeStreak(
        route,
        index,
        "elite",
        profile.maxCombatLikeStreak,
      )
    )
      continue;
    route[index] = "elite";
    eliteCount += 1;
    if (eliteCount >= desiredEliteCount) break;
  }

  const shopTarget = stage >= 6 ? 0 : profile.shopTarget,
    shopCandidates = shuffle(
      s,
      Array.from({ length: profile.bossIndex }, (_, index) => index).filter(
        (index) =>
          !route[index] &&
          (stage !== 1 || index >= 3),
      ),
    );
  for (const index of shopCandidates.slice(0, shopTarget)) route[index] = "shop";

  for (let index = 0; index < profile.bossIndex; index += 1) {
    if (route[index]) continue;
    route[index] = stage === 1 && index < 3 ? "golden" : "treasure";
  }

  return route;
}
export function routeFor(s) {
  return Array.isArray(s.route) && s.route.length === 12 ? s.route : ROUTE;
}
const LEGACY_ROOM_CATEGORIES = {
  battle: "combat", elite: "combat", gather: "treasure", golden: "treasure",
  mystery: "treasure", greenhouse: "treasure", curse_pit: "treasure", lab: "treasure",
  shop: "shop", rest: "shop", boss: "boss",
};
export function roomCategoryAt(s, node = s.node) {
  const value = routeFor(s)[node];
  if (s.resolvedRooms?.[node] === "elite") return "elite";
  return ROOM_CATEGORIES[value] ? value : LEGACY_ROOM_CATEGORIES[value] || value;
}
export function rollSubRoom(s, category, node = s.node) {
  const pool = CATEGORY_ROOM_WEIGHTS[category];
  if (!pool?.length) return category;
  return pool[weighted(s, pool.map((item) => item.weight))].room;
}
export function roomAt(s) {
  const routeRoom = routeFor(s)[s.node];
  if (!ROOM_CATEGORIES[routeRoom]) return routeRoom;
  return s.resolvedRooms?.[s.node] || routeRoom;
}
const ENEMY_ALIASES = {
  hp: "hp",
  maxHp: "maxHp",
  enemyShield: "shield",
  intent: "intent",
  statuses: "statuses",
  enemyId: "id",
  stunResistance: "stunResistance",
};
export function livingEnemies(battle) {
  return (battle?.enemies || []).filter((enemy) => enemy.hp > 0);
}
export function selectedEnemy(battle) {
  if (!battle?.enemies?.length) return null;
  const selected = battle.enemies[battle.selectedTarget];
  if (selected?.hp > 0) return selected;
  const next = battle.enemies.findIndex((enemy) => enemy.hp > 0);
  battle.selectedTarget = next < 0 ? 0 : next;
  return battle.enemies[battle.selectedTarget] || null;
}
export function attachEnemyAliases(battle) {
  if (!battle?.enemies?.length) return battle;
  battle.selectedTarget = Math.max(
    0,
    Math.min(battle.enemies.length - 1, battle.selectedTarget || 0),
  );
  for (const [alias, field] of Object.entries(ENEMY_ALIASES)) {
    delete battle[alias];
    Object.defineProperty(battle, alias, {
      enumerable: true,
      configurable: true,
      get() {
        return selectedEnemy(this)?.[field];
      },
      set(value) {
        const enemy = selectedEnemy(this);
        if (enemy) enemy[field] = value;
      },
    });
  }
  return battle;
}
export function selectTarget(s, index) {
  const enemy = s?.battle?.enemies?.[index];
  if (s?.phase !== "battle" || !enemy || enemy.hp <= 0) return false;
  s.battle.selectedTarget = index;
  return true;
}
function rewardItemEligible(
  s,
  item,
  meta,
  {
    kind = null,
    tier = null,
    predicate = null,
    allowCurse = false,
    source = null,
    eventRoom = null,
  } = {},
) {
  if (!item || item.hidden || item.signatureOnly || !isContentUnlocked(meta, "item", item.id)) return false;
  if (!acquisitionAllows(item, { source, eventRoom, state: s })) return false;
  if (!allowCurse && item.kind === "curse") return false;
  if (kind && item.kind !== kind) return false;
  if (Number.isInteger(tier) && item.tier !== tier) return false;
  if (predicate && !predicate(item)) return false;
  if (s.inventory.filter((id) => id === item.id).length >= item.maxOwned) return false;
  if (!["trait", "relic"].includes(item.kind) || item.stackable) return true;
  const family = item.family || item.effect;
  return !s.inventory
    .map((id) => ITEMS[id])
    .some((owned) =>
      owned?.kind === item.kind &&
      (owned.family || owned.effect) === family &&
      owned.tier >= item.tier,
    );
}

function eligibleRewardItems(s, meta, filters = {}, excludedKeys = new Set()) {
  return Object.values(ITEMS).filter((item) =>
    rewardItemEligible(s, item, meta, filters) && !excludedKeys.has(`item:${item.id}`),
  );
}

function eligibleRewardCards(s, meta, tier = null, excludedKeys = new Set(), source = null) {
  const unlocked = meta?.unlocked || [];
  return Object.values(CARDS).filter((card) =>
    card.id !== "impurity" &&
    acquisitionAllows(card, { source, state: s }) &&
    (!Number.isInteger(tier) || card.tier === tier) &&
    !excludedKeys.has(`card:${card.id}`) &&
    cardCount(s, card.id) < cardMaxCopies(card) &&
    (!UNLOCKS.some((unlock) => unlock.card === card.id) ||
      UNLOCKS.some((unlock) => unlock.card === card.id && unlocked.includes(unlock.id))),
  );
}

function weightedEntry(s, entries, weightKey = "weight") {
  if (!entries?.length) return null;
  return entries[weighted(s, entries.map((entry) => Math.max(0, Number(entry?.[weightKey]) || 0)))] || null;
}

function adjustedCardTierWeights(s, baseWeights) {
  const weights = [...baseWeights];
  const rareShift = Math.min(weights[0] || 0, Math.round(100 * power(s, "rareCardChance")));
  weights[0] = Math.max(0, (weights[0] || 0) - rareShift);
  weights[1] = Math.max(0, (weights[1] || 0) + rareShift);
  return weights;
}

function fallbackRewardOption(s, type, kind = null, tier = null) {
  if (type === "card") return { type: "gold", amount: 25, fallbackFor: "active" };
  if (kind === "stat")
    return { type: "gold", amount: 20 + Math.floor(random(s) * 11), fallbackFor: "stat", tier };
  if (kind === "trait") return { type: "gold", amount: 30, fallbackFor: "trait", tier };
  if (kind === "relic") {
    const amount = tier >= 3 ? 100 : tier >= 2 ? 60 : 30;
    return { type: "gold", amount, fallbackFor: "relic", tier };
  }
  return { type: "gold", amount: 25, fallbackFor: kind || type || "reward", tier };
}

function rollCardRewardOption(s, meta, profile, excludedKeys = new Set(), optionIndex = 0) {
  const weights = adjustedCardTierWeights(s, profile.tierWeights || REWARD_PROFILES.combat.tierWeights),
    requestedTier = weighted(s, weights) + 1,
    exact = eligibleRewardCards(s, meta, requestedTier, excludedKeys, profile.source);
  let pool = exact, tier = requestedTier;
  if (!pool.length) {
    const eligibleWeights = weights.map((weight, index) =>
      eligibleRewardCards(s, meta, index + 1, excludedKeys, profile.source).length ? weight : 0,
    );
    if (eligibleWeights.some(Boolean)) {
      tier = weighted(s, eligibleWeights) + 1;
      pool = eligibleRewardCards(s, meta, tier, excludedKeys, profile.source);
    }
  }
  if (!pool.length) return fallbackRewardOption(s, "card", null, requestedTier);
  const affinityProfile = optionIndex === 1 && profile.rewardPool === "active"
      ? analyzeBuild(s)
      : null,
    card = affinityProfile?.primary
      ? pool[
          weighted(
            s,
            pool.map((candidate) => {
              const buildIds = cardBuildIds(candidate);
              if (buildIds.has(affinityProfile.primary.id)) return 1.5;
              if (
                affinityProfile.secondary &&
                buildIds.has(affinityProfile.secondary.id)
              )
                return 1.2;
              return 1;
            }),
          )
        ]
      : pick(s, pool);
  return { type: "card", id: card.id, tier: card.tier };
}

function rollItemRewardOption(s, meta, profile, excludedKeys = new Set()) {
  const kinds = Object.keys(profile.kindWeights || {});
  if (!kinds.length) return null;
  const kind = kinds[weighted(s, kinds.map((key) => profile.kindWeights[key]))],
    weights = profile.tierWeightsByKind?.[kind] || [100, 0, 0, 0],
    requestedTier = weighted(s, weights),
    exact = eligibleRewardItems(s, meta, { kind, tier: requestedTier, predicate: profile.predicate, source: profile.source, eventRoom: profile.metadata?.eventRoom }, excludedKeys);
  let pool = exact, tier = requestedTier;
  if (!pool.length) {
    const eligibleWeights = weights.map((weight, index) =>
      eligibleRewardItems(s, meta, { kind, tier: index, predicate: profile.predicate, source: profile.source, eventRoom: profile.metadata?.eventRoom }, excludedKeys).length ? weight : 0,
    );
    if (eligibleWeights.some(Boolean)) {
      tier = weighted(s, eligibleWeights);
      pool = eligibleRewardItems(s, meta, { kind, tier, predicate: profile.predicate, source: profile.source, eventRoom: profile.metadata?.eventRoom }, excludedKeys);
    }
  }
  if (!pool.length) return fallbackRewardOption(s, "item", kind, requestedTier);
  const item = pickRewardItem(s, pool);
  return { type: "item", id: item.id, kind: item.kind, tier: item.tier };
}

function rollEntryRewardOption(s, meta, profile, excludedKeys = new Set()) {
  const entries = profile.entries || [],
    requested = weightedEntry(s, entries);
  if (!requested) return null;
  const poolFor = (entry) => eligibleRewardItems(
    s,
    meta,
    { kind: entry.kind, tier: entry.tier, predicate: profile.predicate, source: profile.source, eventRoom: profile.metadata?.eventRoom },
    excludedKeys,
  );
  let entry = requested,
    pool = poolFor(entry);
  if (!pool.length) {
    const availableEntries = entries.filter((candidate) => poolFor(candidate).length);
    if (availableEntries.length) {
      entry = weightedEntry(s, availableEntries);
      pool = poolFor(entry);
    }
  }
  if (!pool.length) return fallbackRewardOption(s, "item", requested.kind, requested.tier);
  const item = pickRewardItem(s, pool);
  return { type: "item", id: item.id, kind: item.kind, tier: item.tier };
}

function rollProfileOption(s, meta, profile, excludedKeys = new Set(), optionIndex = 0) {
  if (profile.type === "card") return rollCardRewardOption(s, meta, profile, excludedKeys, optionIndex);
  if (profile.type === "item") return rollItemRewardOption(s, meta, profile, excludedKeys);
  if (profile.type === "itemEntry") return rollEntryRewardOption(s, meta, profile, excludedKeys);
  return null;
}

export function rollLoot(s, room, meta = null) {
  const profile = REWARD_PROFILES[room];
  if (!profile || !["item", "itemEntry"].includes(profile.type)) return null;
  const option = rollProfileOption(s, meta, profile);
  return option?.type === "item" ? option.id : null;
}

export function newRun(seed = Date.now() >>> 0, customDeckIds = null, meta = null) {
  const perks = codexPerks(meta);
  const s = {
    version: 2,
    rng: seed >>> 0,
    seed: seed >>> 0,
    loop: 0,
    node: 0,
    hp: 80,
    maxHp: 80,
    gold: perks.startingGold,
    score: 0,
    potions: 1 + perks.startingPotions,
    inventory: [],
    deck: (customDeckIds || STARTING_DECK).map((id) => ({ id, level: 0 })),
    phase: "map",
    battle: null,
    reward: null,
    rewardOfferSequence: 0,
    rewardExposure: freshRewardExposure(0),
    shopOffers: null,
    restChoices: null,
    restResult: null,
    statuses: S.createStatuses(),
    log: [],
    maxHit: 0,
    won: false,
    finished: false,
    pendingCorrosion: 0,
    pendingImpurities: 0,
    specialResult: null,
    specialDecision: null,
    eventPowers: perks.turn1Ap ? { turn1ExtraAp: perks.turn1Ap } : {},
    eventTurnHpLoss: 0,
    eventOpeningBurning: 0,
    shopRerolls: perks.shopRerolls,
    resolvedRooms: Array(12).fill(null),
    currentSubRoom: null,
  };
  s.route = generateRoute(s);
  return s;
}
export function power(s, key) {
  return (Number.isFinite(s.eventPowers?.[key]) ? s.eventPowers[key] : 0) + s.inventory.reduce(
    (n, id) => {
      const item = ITEMS[id];
      if (!item) return n;
      return n +
        (item.effect === key &&
        !(
          S.restricted(s, "passives") &&
          ["trait", "relic"].includes(item.kind)
        )
          ? item.value
          : 0);
    },
    0,
  );
}
function powers(s, ...keys) {
  return keys.reduce((total, key) => total + power(s, key), 0);
}
function ownedEffectCount(s, key) {
  return s.inventory.filter((id) => ITEMS[id]?.effect === key).length;
}
function isAttackCard(card) {
  return Boolean(card.attack || card.burst || card.weight);
}
function cardPattern(card) {
  return card.attackPattern || "contact";
}
export const COMBAT_FX_POWER_THRESHOLDS = Object.freeze({
  strong: 20,
  super: 30,
});
export function combatFxPowerTier(impact = 0) {
  const value = Math.max(0, Number(impact) || 0);
  if (value >= COMBAT_FX_POWER_THRESHOLDS.super) return "super";
  if (value >= COMBAT_FX_POWER_THRESHOLDS.strong) return "strong";
  return value > 0 ? "weak" : "none";
}
function combatFxPatternKey(pattern) {
  if (pattern === "nonContact") return "noncontact";
  if (pattern === "contact") return "contact";
  return "neutral";
}
export function combatFxSoundCandidates(descriptor = {}) {
  const candidates = [],
    push = (value) => {
      if (value && !candidates.includes(value)) candidates.push(value);
    },
    pattern = combatFxPatternKey(descriptor.pattern);
  if (descriptor.sfxKey) push(descriptor.sfxKey);
  if (pattern === "neutral") return candidates;
  const powerTier = ["weak", "strong", "super"].includes(descriptor.power)
      ? descriptor.power
      : "weak",
    modifiers = [
      descriptor.shieldBreak && "shield-break",
      descriptor.damagePierce && "damage-pierce",
      descriptor.statusPierce && "status-pierce",
      descriptor.aoe && "aoe",
      descriptor.multiHit && "multi",
    ].filter(Boolean);
  for (const modifier of modifiers) push(`${pattern}-${modifier}-${powerTier}`);
  for (const modifier of modifiers) push(`${pattern}-${modifier}`);
  if (descriptor.multiHit) push(`${pattern}-multi-${powerTier}`);
  if (descriptor.aoe) push(`${pattern}-aoe-${powerTier}`);
  push(`${pattern}-${powerTier}`);
  push(`${pattern}-hit`);
  return candidates;
}
export function combatFxVisualKey(descriptor = {}) {
  if (typeof descriptor.vfxKey === "string" && descriptor.vfxKey.trim())
    return descriptor.vfxKey.trim();
  const pattern = combatFxPatternKey(descriptor.pattern);
  if (pattern === "neutral") return "neutral-hit";
  const power = ["weak", "strong", "super"].includes(descriptor.power)
      ? descriptor.power
      : "weak",
    impact = descriptor.shieldBreak ? "shield-break" : "hit";
  return `${pattern}-${impact}-${power}`;
}
export function combatFxDescriptor({
  attackPattern = null,
  damage = 0,
  blocked = 0,
  shieldBefore = 0,
  shieldAfter = 0,
  bypassShield = false,
  fx = null,
} = {}) {
  const pattern = attackPattern === "contact" || attackPattern === "nonContact"
      ? attackPattern
      : "neutral",
    damageValue = Math.max(0, Number(damage) || 0),
    blockedValue = Math.max(0, Number(blocked) || 0),
    shieldBeforeValue = Math.max(0, Number(shieldBefore) || 0),
    shieldAfterValue = Math.max(0, Number(shieldAfter) || 0),
    hitCount = Math.max(1, Math.floor(Number(fx?.hitCount) || 1)),
    hitIndex = Math.max(0, Math.floor(Number(fx?.hitIndex) || 0)),
    targetMode = fx?.targetMode || (fx?.aoe ? "all" : "single"),
    damagePierce = Boolean(bypassShield || fx?.damagePierce),
    statusPierce = Boolean(
      fx?.statusPierce ||
        fx?.pierce === "status" ||
        (fx?.appliesEnemyStatus && shieldBeforeValue > 0 && !damagePierce),
    ),
    shieldDepleted = Boolean(
      shieldBeforeValue > 0 && shieldAfterValue <= 0 && blockedValue > 0,
    ),
    shieldBreak = Boolean(shieldDepleted && damageValue > 0),
    powerTier = combatFxPowerTier(damageValue + blockedValue),
    descriptor = {
      source: fx?.source || (pattern === "neutral" ? "effect" : "attack"),
      cardId: fx?.cardId || null,
      pattern,
      power: powerTier,
      targetMode,
      hitIndex,
      hitCount,
      multiHit: hitCount > 1,
      aoe: Boolean(fx?.aoe || targetMode === "all"),
      statusPierce,
      damagePierce,
      shieldHit: blockedValue > 0,
      shieldDepleted,
      shieldBreak,
      blockedOnly: blockedValue > 0 && damageValue <= 0,
      damage: damageValue,
      blocked: blockedValue,
      vfxKey:
        typeof fx?.vfxKey === "string" && fx.vfxKey.trim()
          ? fx.vfxKey.trim()
          : typeof fx?.vfx === "string" && fx.vfx.trim()
            ? fx.vfx.trim()
            : null,
      sfxKey:
        typeof fx?.sfxKey === "string" && fx.sfxKey.trim()
          ? fx.sfxKey.trim()
          : typeof fx?.sfx === "string" && fx.sfx.trim()
            ? fx.sfx.trim()
            : null,
    };
  descriptor.tags = [
    descriptor.pattern !== "neutral" && descriptor.pattern,
    descriptor.power !== "none" && descriptor.power,
    descriptor.multiHit && "multi",
    descriptor.aoe && "aoe",
    descriptor.statusPierce && "status-pierce",
    descriptor.damagePierce && "damage-pierce",
    descriptor.shieldHit && "shield-hit",
    descriptor.shieldBreak && "shield-break",
  ].filter(Boolean);
  descriptor.variant = descriptor.tags.join(":") || "neutral";
  descriptor.soundCandidates = combatFxSoundCandidates(descriptor);
  descriptor.soundKey = descriptor.soundCandidates[0] || null;
  return descriptor;
}
function cardAppliesEnemyStatusForFx(card) {
  return Boolean(
    Object.keys(card.applyEnemy || {}).length ||
      Object.keys(card.applyEnemyAfterAttack || {}).length ||
      Object.keys(card.onHitApplyEnemy || {}).length ||
      Object.values(card.conditionalEnemyIntent || {}).some(
        (statuses) => Object.keys(statuses || {}).length,
      ) ||
      Object.keys(card.absorbThresholdApplyAllEnemy || {}).length ||
      card.chanceStatusOnHit ||
      card.applyWeak ||
      card.weakOnHit ||
      card.stunOrDisarmBossTurns,
  );
}
function combatFxCardContext(card, cardId, hitCount) {
  const targetMode = card.target === "all"
    ? "all"
    : card.randomEachHit || card.target === "random"
      ? "random"
      : card.target === "self"
        ? "self"
        : "single";
  return {
    source: "card",
    cardId,
    targetMode,
    hitCount,
    aoe: targetMode === "all",
    appliesEnemyStatus: cardAppliesEnemyStatusForFx(card),
    pierce: card.fx?.pierce || null,
    statusPierce: Boolean(card.fx?.statusPierce),
    vfxKey:
      typeof card.fx?.vfx === "string" && card.fx.vfx.trim()
        ? card.fx.vfx.trim()
        : null,
    sfxKey:
      typeof card.fx?.sfx === "string" && card.fx.sfx.trim()
        ? card.fx.sfx.trim()
        : null,
  };
}
function gainPlayerShield(s, amount) {
  const b = s.battle;
  if (!b) return 0;
  if (power(s, "zeroShieldLock")) { b.shield = 0; return 0; }
  const before = b.shield;
  if (b.topPlayedThisTurn && power(s, "topNoteShieldHalf")) amount *= 0.5;
  b.shield += Math.round(amount);
  const cap = power(s, "shieldCapLimit");
  if (cap > 0) b.shield = Math.min(cap, b.shield);
  const gained = Math.max(0, b.shield - before);
  if (gained) s._shieldGainFeedback = (s._shieldGainFeedback || 0) + gained;
  return gained;
}
function cardAttackPower(s, card, definition, target = null) {
  const pattern = definition.attackPattern || "contact";
  let bonus = power(s, "attack") +
    power(s, pattern === "contact" ? "contactAttack" : "nonContactAttack");
  const note = card.note || definition.note;
  if (note === "top") bonus += power(s, "topAttack");
  if (note === "base") bonus += powers(s, "baseAttack", "baseDamage");
  if (target && S.stacks(target, "corrosion") > 0) bonus += power(s, "corrosionAttack");
  if (target && S.stacks(target, "burning") > 0) bonus += powers(s, "burningAttack", "burningBonus");
  if (target && S.stacks(target, "bleed") > 0) bonus += power(s, "bleedHitBonus");
  if (s.battle.absorb >= 30) bonus += power(s, "highAbsorbAttack");
  if ((s.battle.oilCardsPlayedThisTurn || 0) > 0) bonus += power(s, "oilAttack");
  if (!(s.battle.attackCardsPlayedThisBattle || 0)) bonus += power(s, "firstStrikeBonus");
  if (s.battle.turn === 1 && pattern === "contact") bonus += power(s, "firstTurnContact");
  if (definition.target === "all" && pattern === "nonContact") bonus += power(s, "aoeNonContactBonus");
  if (pattern === "nonContact" && !(s.battle.nonContactCardsPlayedThisTurn || 0)) bonus += power(s, "firstNonContactBonus");
  if (pattern === "nonContact" && target)
    bonus += ["burning", "poison", "bleed", "corrosion"].filter((id) => S.stacks(target, id) > 0).length * power(s, "nonContactAilmentBonus");
  if (pattern === "contact" && (s.battle.contactCardsPlayedThisTurn || 0) > 0) bonus += power(s, "comboContact");
  if ((definition.hits || 1) >= 3 && pattern === "contact") bonus += power(s, "multiHitDamageBonus");
  if ((definition.hits || 1) >= 2) bonus -= power(s, "multiHitDamagePenalty");
  if (definition.cost === 0 && s.battle.topPlayedThisTurn) bonus += power(s, "topZeroCostBonus");
  bonus += s.battle.nextAttackBonus || 0;
  bonus -= s.battle.turnDamagePenalty || 0;
  return bonus;
}
function harmonyCardCategory(card) {
  if (["attack", "defense", "absorb", "heal"].includes(card?.category))
    return card.category;
  if (isAttackCard(card || {})) return "attack";
  if (card?.heal || card?.missingHpHealRatio) return "heal";
  if (card?.shield) return "defense";
  return "absorb";
}
export function resolveHarmonyEffect(s, baseCard = null) {
  const effect = { ...BASE_HARMONY_EFFECT },
    definition = baseCard ? cardDefinition(baseCard) : null,
    category = harmonyCardCategory(definition),
    upgrade = definition && !definition.upgrades ? (baseCard.level || 0) * 3 : 0,
    baseAmount = Math.max(
      0,
      effect.baseDamage + power(s, "harmonyAttack") + power(s, "harmonyBonus") -
        power(s, "harmonyDamagePenalty"),
    ),
    cardValue = category === "absorb"
      ? (definition?.absorb || 0) + upgrade
      : category === "heal"
        ? (definition?.heal || definition?.minimumHeal || 0) + upgrade
        : 0,
    amount = Math.max(
      0,
      Math.round(
        baseAmount +
          (category === "attack" ? power(s, "attack") : 0) +
          (category === "defense" ? power(s, "defense") : 0) +
          (["absorb", "heal"].includes(category) ? Math.floor(cardValue / 2) : 0),
      ),
    );
  return { ...effect, category, amount, damage: category === "attack" ? amount : 0 };
}
function triggerHarmony(s, chain = []) {
  const baseCard = chain.at(-1),
    harmonyEffect = resolveHarmonyEffect(s, baseCard),
    target = selectedEnemy(s.battle),
    targetIndex = target ? s.battle.enemies.indexOf(target) : null;
  let result = { damage: 0, blocked: 0 },
    appliedAmount = 0,
    effectText = "";
  if (harmonyEffect.category === "attack") {
    result = damage(s, harmonyEffect.amount, {
      attackPattern: harmonyEffect.attackPattern,
      targetEnemy: target,
    });
    appliedAmount = result.damage;
    effectText = `추가 피해 ${result.damage}`;
  } else if (harmonyEffect.category === "defense") {
    appliedAmount = gainPlayerShield(s, S.shieldGain(harmonyEffect.amount, s));
    effectText = `추가 방어막 ${appliedAmount}`;
  } else if (harmonyEffect.category === "absorb") {
    appliedAmount = gainAbsorb(s, harmonyEffect.amount);
    effectText = `추가 흡수 ${appliedAmount}`;
  } else {
    appliedAmount = heal(s, harmonyEffect.amount);
    effectText = `추가 회복 ${appliedAmount}`;
  }
  s._harmonyFeedback ??= [];
  s.harmoniesThisRun = (s.harmoniesThisRun || 0) + 1;
  s.battle.harmoniesThisBattle = (s.battle.harmoniesThisBattle || 0) + 1;
  s.battle.harmoniesThisTurn = (s.battle.harmoniesThisTurn || 0) + 1;
  s._harmonyFeedback.push({
    id: harmonyEffect.id,
    label: harmonyEffect.label,
    visual: harmonyEffect.category,
    category: harmonyEffect.category,
    amount: appliedAmount,
    damage: result.damage,
    blocked: result.blocked,
    targetIndex,
  });
  log(s, `${harmonyEffect.label} ${effectText}`);
  if (hasSynergy(s, "grand_trinity")) {
    for (const enemy of livingEnemies(s.battle))
      damage(s, HIDDEN_SYNERGIES.grand_trinity.value, { targetEnemy: enemy, direct: false, bypassShield: true });
    s.battle.nextTurnSynergyAp = (s.battle.nextTurnSynergyAp || 0) + HIDDEN_SYNERGIES.grand_trinity.nextTurnAp;
    log(s, "세트 효과 [대삼위일체의 조화]: 적 전체에 관통 피해 40 · 다음 턴 AP +1");
  }
  if (power(s, "harmonyEchoDamage")) {
    damage(s, power(s, "harmonyEchoDamage"), { targetEnemy: target });
    draw(s, ownedEffectCount(s, "harmonyEchoDamage"));
  }
  if (power(s, "harmonyAoeTrueDamage"))
    for (const enemy of livingEnemies(s.battle)) {
      damage(s, power(s, "harmonyAoeTrueDamage"), { targetEnemy: enemy, direct: false, bypassShield: true });
      applyBattleStatus(s, "enemy", "vulnerable", ownedEffectCount(s, "harmonyAoeTrueDamage"), enemy);
    }
  if (power(s, "harmonyDebuffStorm"))
    for (const enemy of livingEnemies(s.battle)) {
      applyBattleStatus(s, "enemy", "vulnerable", 2, enemy);
      applyBattleStatus(s, "enemy", "corrosion", 5, enemy);
      applyBattleStatus(s, "enemy", "burning", 5, enemy);
    }
  if (power(s, "harmonyWeakAll"))
    for (const enemy of livingEnemies(s.battle)) applyBattleStatus(s, "enemy", "weak", Math.min(5, power(s, "harmonyWeakAll")), enemy);
  applyBattleStatus(s, "player", "vulnerable", power(s, "harmonySelfVulnerable"));
  const replayBoth = power(s, "harmonyReplayBothCards"), replayOne = power(s, "harmonyReplayCard");
  const replay = replayBoth ? chain.slice(0, 2) : replayOne && chain.length ? [pick(s, chain.slice(0, 2))] : [];
  for (const replayCard of replay) effect(s, replayCard);
  return result;
}
export function apLimit(s) {
  return 8 + power(s, "apCap");
}
export function turnStartAp(s) {
  return Math.min(apLimit(s), 3 + power(s, "turnBaseAp"));
}
export function gainCurrentAp(s, amount = 1) {
  if (s?.phase !== "battle" || !s.battle || amount <= 0) return 0;
  const before = s.battle.ap;
  s.battle.ap = Math.min(apLimit(s), s.battle.ap + amount);
  const gained = s.battle.ap - before;
  if (gained > 0) log(s, `⚡ AP +${gained} 즉시 충전`);
  return gained;
}
export function addInventoryItem(s, id, meta = null) {
  const item = ITEMS[id];
  if (!item || item.hidden) return false;
  if (["trait", "relic"].includes(item.kind) && !item.stackable) {
    const family = item.family || item.effect,
      owned = s.inventory
        .map((ownedId, index) => ({ id: ownedId, index, item: ITEMS[ownedId] }))
        .filter(({ item: current }) =>
          current?.kind === item.kind && (current.family || current.effect) === family,
        );
    if (owned.some(({ item: current }) => current.tier >= item.tier)) return false;
    const remove = new Set(owned.map(({ id: ownedId }) => ownedId));
    s.inventory = s.inventory.filter((ownedId) => !remove.has(ownedId));
  } else if (
    s.inventory.filter((ownedId) => ownedId === id).length >= item.maxOwned
  ) return false;
  s.inventory.push(id);
  if (item.effect === "maxHp") {
    s.maxHp = Math.max(1, s.maxHp + item.value);
    s.hp = item.value > 0
      ? Math.min(s.maxHp, s.hp + item.value)
      : Math.min(s.hp, s.maxHp);
  }
  if (item.effect === "goldLumpSum") gainGold(s, item.value);
  if (item.effect === "goldDebt") s.gold += item.value;
  if (meta) {
    meta.discovered ??= [];
    if (!meta.discovered.includes(id)) meta.discovered.push(id);
    discoverSynergies(s, meta);
  }
  return true;
}
export function handLimit(s) {
  return Math.max(1, 7 + power(s, "handSize") - power(s, "handSizePenalty"));
}
const IMPURITY_HAND_RESERVE = 2;
const IMPURITY_OVERFLOW_DAMAGE = 2;
export function impurityHandLimit(s) {
  return Math.max(0, handLimit(s) - IMPURITY_HAND_RESERVE);
}
function impurityCountInHand(s) {
  return s.battle.hand.reduce(
    (count, card) => count + (card.id === "impurity" ? 1 : 0),
    0,
  );
}
function canAddImpurityToHand(s) {
  return (
    s.battle.hand.length < handLimit(s) &&
    impurityCountInHand(s) < impurityHandLimit(s)
  );
}
export function deckLimit(s) {
  return BASE_DECK_SIZE + power(s, "deckSize");
}
function log(s, text) {
  const round = s.battle?.turn,
    actor = s.battle?.enemies
      ?.filter((enemy) => enemy?.name)
      .sort((a, b) => b.name.length - a.name.length)
      .find((enemy) => text.startsWith(`${enemy.name} `) || text.startsWith(`${enemy.name}의 `));
  if (actor && !text.includes(" → ") && !text.startsWith(`${actor.name} ·`)) {
    const action = text.slice(actor.name.length).trim().replace(/^의\s*/, "");
    text = `${actor.name} · ${action}`;
  }
  s.log.unshift(`${round ? `${round}라운드 · ` : ""}${text}`);
  s.log = s.log.slice(0, 120);
}
function heal(s, amount, minimumHp = 0) {
  if (amount) amount += power(s, "incomingHeal");
  if (amount > 0) amount = Math.round(amount * (1 + synergyPower(s, "chamomileAura")));
  const before = s.hp,
    excess = Math.max(0, s.hp + amount - s.maxHp);
  s.hp = Math.max(minimumHp, Math.min(s.maxHp, s.hp + amount));
  const restored = Math.max(0, s.hp - before);
  if (restored) s._healingFeedback = (s._healingFeedback || 0) + restored;
  if (s.battle && excess) gainPlayerShield(s, Math.floor(excess * powers(s, "overflow", "overflowT2", "overflowT3")));
  if (s.battle && restored) s.battle.absorb = Math.max(-50, s.battle.absorb - power(s, "healAbsorbLoss"));
  return restored;
}
function nextCombatImpactId(s) {
  s._combatImpactSequence = (s._combatImpactSequence || 0) + 1;
  return s._combatImpactSequence;
}
function damageFeedback(
  s,
  target,
  amount,
  statusId,
  targetIndex = null,
  sourceImpactId = null,
) {
  if (!statusId || amount <= 0) return;
  s._damageFeedback ??= [];
  const feedback = { target, amount, statusId };
  if (Number.isInteger(targetIndex)) feedback.targetIndex = targetIndex;
  if (Number.isInteger(sourceImpactId)) feedback.sourceImpactId = sourceImpactId;
  s._damageFeedback.push(feedback);
}
function emitStatusProc(
  s,
  entity,
  statusId,
  amount,
  isPlayerTarget,
  sourceImpactId,
  stackBefore,
  stackAfter,
) {
  s._statusProcFeedback ??= [];
  const event = {
    target: isPlayerTarget ? "player" : "enemy",
    statusId,
    amount,
    consumed: 1,
    sourceImpactId,
    stackBefore,
    stackAfter,
  };
  if (!isPlayerTarget) {
    const targetIndex = s.battle?.enemies?.indexOf(entity);
    if (Number.isInteger(targetIndex) && targetIndex >= 0) event.targetIndex = targetIndex;
  }
  s._statusProcFeedback.push(event);

  if (isPlayerTarget) return;
  if (statusId === "bleed") {
    heal(s, power(s, "bleedLeech"));
    gainPlayerShield(s, power(s, "bleedTriggerShield"));
    if (power(s, "enemyBleedMirror"))
      hurtPlayer(s, amount, { direct: false, bypassShield: true, statusId: "bleed" });
  }
  if (statusId === "burning" && power(s, "burningBackfireRatio"))
    hurtPlayer(s, amount * power(s, "burningBackfireRatio"), {
      direct: false,
      bypassShield: true,
      statusId: "burning",
    });
}
function triggerImpactStatusProc(
  s,
  entity,
  attackPattern,
  directImpactAmount,
  isPlayerTarget,
  maxProcs = 1,
  sourceImpactId = null,
) {
  const statusId = attackPattern === "contact"
      ? "bleed"
      : attackPattern === "nonContact"
        ? "burning"
        : null,
    definition = statusId ? S.STATUS_DEFINITIONS[statusId] : null,
    stacksBefore = statusId ? S.stacks(entity, statusId) : 0,
    procCount = Math.min(stacksBefore, Math.max(1, Math.floor(maxProcs || 1)));
  if (!definition || stacksBefore <= 0 || directImpactAmount <= 0) return null;

  S.removeStatus(entity, statusId, procCount);
  let amount = Math.max(1, Math.round(directImpactAmount * definition.procRatio));
  if (!isPlayerTarget && statusId === "burning")
    amount = Math.max(
      0,
      Math.round(
        (amount + power(s, "burningDamageBonus")) *
          (1 + power(s, "burningMultiplier")),
      ),
    );
  for (let proc = 0; proc < procCount; proc++) {
    if (amount > 0) {
      if (isPlayerTarget) {
        hurtPlayer(s, amount, {
          direct: false,
          bypassShield: true,
          statusId,
          sourceImpactId,
        });
      } else if (entity.hp > 0) {
        damage(s, amount, {
          direct: false,
          bypassShield: true,
          statusId,
          targetEnemy: entity,
          sourceImpactId,
        });
      }
    }
    emitStatusProc(
      s,
      entity,
      statusId,
      amount,
      isPlayerTarget,
      sourceImpactId,
      stacksBefore - proc,
      stacksBefore - proc - 1,
    );
    log(
      s,
      `${isPlayerTarget ? "플레이어" : entity.name || "적"} · ${definition.name} 발동 · ${amount} 추가 피해 · 1중첩 소비`,
    );
  }
  return { statusId, amount, consumed: procCount };
}
function triggerRegeneration(s, entity, isPlayer) {
  const amount = S.stacks(entity, "regeneration");
  if (!amount) return;
  const restored = isPlayer
    ? heal(s, amount)
    : Math.max(0, Math.min(amount, entity.maxHp - entity.hp));
  if (!isPlayer) entity.hp += restored;
  log(s, `${isPlayer ? "플레이어" : entity.name || "적"} · 재생으로 체력 +${restored}`);
  S.tickDurations(entity, "afterTrigger");
}
function triggerStatusEvent(s, entity, event, isPlayer) {
  for (const { id, state, definition } of S.triggered(entity, event)) {
    if (definition.effect !== "bypassDamage") continue;
    let amount = state.stacks;
    if (isPlayer)
      hurtPlayer(s, amount, {
        direct: false,
        bypassShield: true,
        statusId: id,
      });
    else
      damage(s, amount, {
        direct: false,
        bypassShield: true,
        statusId: id,
        targetEnemy: entity,
      });
    log(s, `${isPlayer ? "플레이어" : entity.name || "적"} · ${definition.name}으로 체력 피해 ${amount}`);
    if ((isPlayer && !s.hp) || (!isPlayer && !entity.hp)) break;
  }
}
function gainGold(s, amount, { applySynergyMultiplier = true } = {}) {
  const multiplier = applySynergyMultiplier
      ? 1 + synergyPower(s, "goldGainMultiplier")
      : 1,
    gained = Math.max(0, Math.floor(amount * multiplier));
  if (!gained) return 0;
  s.gold += gained;
  s._goldFeedback = (s._goldFeedback || 0) + gained;
  return gained;
}
export function applyBrassAbsorbConversion(s) {
  if (!s?.battle || !hasSynergy(s, "brass_scales_funnel")) return 0;
  const convertedGold = Math.min(30, Math.floor(Math.max(0, s.battle.absorb) / 2));
  return convertedGold > 0
    ? gainGold(s, convertedGold, { applySynergyMultiplier: false })
    : 0;
}
function spendGold(s, amount) {
  const spent = Math.max(0, Math.floor(amount));
  if (!spent || s.gold < spent) return false;
  s.gold -= spent;
  s._goldSpentFeedback = (s._goldSpentFeedback || 0) + spent;
  return true;
}
function unlock(meta, id, s) {
  if (!meta.unlocked.includes(id)) {
    meta.unlocked.push(id);
    const entry = UNLOCKS.find((candidate) => candidate.id === id);
    s._unlockFeedback ??= [];
    if (entry && !entry.legacy) s._unlockFeedback.push(entry);
    log(
      s,
      `新 해금: ${entry?.name || id} — 다음 보상부터 등장`,
    );
  }
}
function recordPurifiedImpurities(meta, s, count) {
  if (count <= 0) return;
  meta.achievementStats ??= { totalHarmonies: 0, act2Clears: 0, impuritiesPurified: 0 };
  meta.achievementStats.impuritiesPurified += count;
  if (meta.achievementStats.impuritiesPurified >= 15)
    unlock(meta, "boss_abyssal_lily", s);
}
function milestones(s, meta) {
  meta.achievementStats ??= { totalHarmonies: 0, act2Clears: 0, impuritiesPurified: 0 };
  const unrecorded = (s.harmoniesThisRun || 0) - (s.recordedHarmonies || 0);
  if (unrecorded > 0) {
    meta.achievementStats.totalHarmonies += unrecorded;
    s.recordedHarmonies = s.harmoniesThisRun;
  }
  if (meta.achievementStats.totalHarmonies >= 10) unlock(meta, "trait_celestial_accord_echo", s);
  if ((s.battle?.harmoniesThisBattle || 0) >= 3) unlock(meta, "relic_chimeric_alembic", s);
  if (s.gold >= 150) unlock(meta, "relic_merchants_diplomatic_seal", s);
  if ((s.battle?.shield || 0) >= 60) unlock(meta, "relic_aegis_of_the_eternal_wax", s);
  if ((s.battle?.absorb || 0) >= 80) unlock(meta, "relic_infinite_fragrance_reservoir", s);
  if ((s.battle?.contactCardsPlayedThisTurn || 0) >= 5) unlock(meta, "trait_infinite_resonance_flurry", s);
  if (s.deck.length >= 16) unlock(meta, "relic_expanded_atelier_case", s);
  if ((s.battle?.enemies || []).some((enemy) => S.stacks(enemy, "corrosion") >= 10))
    unlock(meta, "absorb_corrosive_extraction_strike", s);
  if ((s.battle?.enemies || []).some((enemy) => S.stacks(enemy, "burning") >= 12))
    unlock(meta, "contact_cauterizing_brand", s);
  if (s.battle?.absorb >= 30) unlock(meta, "burst", s);
  if (s.battle?.shield >= 35) unlock(meta, "wall", s);
}
export function checkUnlocks(s, meta) {
  if (!s || !meta) return false;
  const before = meta.unlocked.length;
  milestones(s, meta);
  return meta.unlocked.length > before;
}
function gainAbsorb(s, amount, fromCard = false) {
  const b = s.battle,
    before = b.absorb;
  if (fromCard && amount > 0) amount += power(s, "absorbBonus");
  if (amount > 0 && power(s, "absorbGainFlat1") && random(s) < power(s, "absorbGainFlat1")) amount += 1;
  const cap = Math.min(150, 100 + power(s, "maxAbsorbCapBonus"));
  b.absorb = Math.min(cap, Math.max(-50, b.absorb + Math.round(amount)));
  const gained = Math.max(0, b.absorb - before);
  if (gained) s._absorbFeedback = (s._absorbFeedback || 0) + gained;
  return gained;
}
function decayAbsorb(s) {
  if (s.battle.absorb <= 0) return 0;
  if (power(s, "infiniteAbsorbDecayImmunity")) return 0;
  if (s.battle.turn === 1 && power(s, "absorbDecaySoftener")) return 0;
  if (s.battle.preventAbsorbDecay) {
    s.battle.preventAbsorbDecay = false;
    return 0;
  }
  const b = s.battle,
    protectedAmount = power(s, "absorbDecayGuard"),
    decayBase = Math.max(0, b.absorb - protectedAmount),
    lost = Math.ceil(decayBase * Math.max(0, 0.1 + power(s, "absorbDecayBonus") / 100)) + power(s, "extraAbsorbDecay");
  b.absorb = Math.max(0, b.absorb - lost);
  if (lost) s._absorbLossFeedback = (s._absorbLossFeedback || 0) + lost;
  return lost;
}
const SHUFFLE_HP_PENALTY = 1;
function applyShufflePenalty(s) {
  return hurtPlayer(s, SHUFFLE_HP_PENALTY, {
    direct: false,
    bypassShield: true,
    statusId: "shufflePenalty",
  });
}
function exhaustOverflowImpurity(s, card) {
  const b = s.battle,
    previousActor = b._logActor;
  b.exhaust ??= [];
  b.exhaust.push(card);
  b._logActor = "불순물 과부하";
  const result = hurtPlayer(s, IMPURITY_OVERFLOW_DAMAGE, {
    direct: false,
    bypassShield: true,
    statusId: "impurityOverflow",
  });
  if (previousActor) b._logActor = previousActor;
  else delete b._logActor;
  return result;
}
function augmentRuntimeApi() {
  return {
    random,
    livingEnemies,
    gainShield: gainPlayerShield,
    gainAbsorb,
    gainAp: gainCurrentAp,
    attackPower: (state) => power(state, "attack"),
    dealEnemyDamage: (state, enemy, amount, options = {}) =>
      damage(state, amount, { ...options, targetEnemy: enemy }),
    applyEnemyStatus: (state, enemy, id, amount) =>
      applyBattleStatus(state, "enemy", id, amount, enemy),
    drawCards: (state, amount, turnStart = false) =>
      draw(state, amount, turnStart),
    log,
  };
}
function draw(s, n, turnStart = false) {
  const b = s.battle,
    drawKind = turnStart ? (b.turn === 1 ? "opening" : "turnStart") : "extra",
    api = augmentRuntimeApi();
  let drawn = 0;
  if (power(s, "fixedDrawTwoCards")) {
    if (!turnStart) return 0;
    n = power(s, "fixedDrawTwoCards");
  }
  n = Math.max(0, n - S.drawPenalty(s));
  while (n-- > 0) {
    if (b.hand.length >= handLimit(s)) {
      onAugmentFailedDraw(s, "handLimit", ITEMS, api);
      continue;
    }
    if (!b.draw.length && b.discard.length) {
      b.draw = shuffle(s, b.discard.splice(0));
      s._shuffleFeedback = (s._shuffleFeedback || 0) + 1;
      const penalty = applyShufflePenalty(s);
      if (penalty.damage > 0)
        log(s, `덱 셔플 패널티 · 체력 -${penalty.damage}`);
      if (!s.hp) break;
      onAugmentReshuffle(s, ITEMS, api);
      if (!s.hp) break;
      if (b.hand.length >= handLimit(s)) {
        onAugmentFailedDraw(s, "handLimit", ITEMS, api);
        continue;
      }
    }
    if (!b.draw.length) break;
    const card = b.draw.pop();
    if (card.id === "impurity" && s.inventory.includes("relic_golden_pipette")) {
      gainCurrentAp(s, 1);
      gainAbsorb(s, 6);
      log(s, "황금빛 정제 피펫: 불순물 소멸 · AP +1 · 흡수 +6");
      continue;
    }
    if (card.id === "impurity" && !canAddImpurityToHand(s)) {
      exhaustOverflowImpurity(s, card);
      if (!s.hp) break;
      n++;
      continue;
    }
    b.hand.push(card);
    drawn++;
    s._drawFeedback = (s._drawFeedback || 0) + 1;
    onAugmentDrawSuccess(s, card, drawKind, CARDS, ITEMS, api);
    if (!s.hp) break;
    if (card.id === "impurity") {
      if (power(s, "impurityApRefund")) gainCurrentAp(s, power(s, "impurityApRefund"));
      if (powers(s, "impurityDrawPush", "impurityApRefund")) n++;
    }
    if (
      b.hand.length < handLimit(s) &&
      power(s, "drawImpurityChance") &&
      random(s) < power(s, "drawImpurityChance")
    ) {
      const impurity = { id: "impurity", level: 0 };
      if (canAddImpurityToHand(s)) {
        // This is direct hand creation, not an actual draw event.
        b.hand.push(impurity);
        drawn++;
        s._drawFeedback = (s._drawFeedback || 0) + 1;
      } else {
        exhaustOverflowImpurity(s, impurity);
        if (!s.hp) break;
      }
    }
  }
  return drawn;
}
function intent(s, enemy, enemyIndex = 0) {
  const b = s.battle;
  const scale = enemy.scaleAttackWithAct === false ? 1 : actInfo(s.loop).attack;
  if (enemy.pattern?.length) {
    const fixedTurns = enemy.isBoss ? 8 : enemy.isElite ? 3 : enemy.pattern.length,
      source = enemy.loopPattern || b.turn <= fixedTurns
        ? enemy.pattern[(b.turn - 1) % enemy.pattern.length]
        : pick(s, enemy.pattern);
    enemy.intent = structuredClone(source);
    if (Number.isFinite(enemy.intent.value))
      enemy.intent.value = Math.round(enemy.intent.value * scale);
    if (Number.isFinite(enemy.intent.guard))
      enemy.intent.guard = Math.round(enemy.intent.guard * scale);
    if (enemy.phase2 && Number.isFinite(enemy.intent.value))
      enemy.intent.value = Math.ceil(enemy.intent.value * 1.35);
    return;
  }
  const index = (b.turn - 1) % 4;
  enemy.intent =
    index === 2 && enemy.isBoss
      ? { type: "pollute", value: 2 }
      : index === 1
        ? {
            type: "guard",
            value: Math.max(
              3,
              Math.round((8 * (1 + s.node / 8) * scale) / b.enemies.length),
            ),
          }
        : {
            type: "attack",
            value: Math.round(
              ((7 +
                s.node * 1.1 +
                (enemy.isElite ? 3 : 0) +
                (enemy.isBoss ? 3 : 0)) *
                scale) /
                Math.sqrt(b.enemies.length),
            ),
            attackPattern:
              (index + enemyIndex) % 2 === 0 ? "contact" : "nonContact",
          };
  if (enemy.phase2) {
    if (index === 1) enemy.intent = { type: "pollute", value: 2, guard: Math.round(10 * scale) };
    else if (Number.isFinite(enemy.intent.value)) enemy.intent.value = Math.ceil(enemy.intent.value * 1.35);
  }
}
export function intentValueBreakdown(enemy, action = enemy?.intent) {
  const base = Number(action?.value);
  if (!Number.isFinite(base)) return { base: 0, modified: 0, delta: 0 };
  let modified = base;
  if (action.type === "attack") {
    modified = S.directDamage(base, enemy, { statuses: S.createStatuses() });
  } else if (action.type === "guard") {
    modified = S.shieldGain(base, enemy);
  } else if (action.type === "heal") {
    modified = Math.max(
      0,
      Math.round(base * Math.max(0.2, 1 + S.modifier(enemy, "outgoingHealing"))),
    );
  }
  return { base, modified, delta: modified - base };
}
export function cardStatusValueBreakdown(s, baseValue, kind, target = null) {
  const base = Number(baseValue);
  if (!Number.isFinite(base) || !s?.battle)
    return { base: Number.isFinite(base) ? base : 0, modified: base, delta: 0 };
  let modified = base;
  if (kind === "attack") {
    modified = S.directDamage(base, s, target || selectedEnemy(s.battle));
  } else if (kind === "shield") {
    modified = S.shieldGain(base, s);
  } else if (kind === "heal") {
    const adjusted = base * Math.max(0.2, 1 + S.modifier(s, "outgoingHealing"));
    modified = adjusted < base
      ? Math.floor(adjusted)
      : adjusted > base
        ? Math.ceil(adjusted)
        : Math.round(adjusted);
  }
  return { base, modified, delta: modified - base };
}
export function enrageTurn(battle) {
  return battle.boss ? 20 : 15;
}
function startTurn(s, meta) {
  const b = s.battle;
  b.turn++;
  b.turnDamageReduction = 0;
  b.shieldSurvivalHeal = 0;
  b.absorbBoosters = [];
  b.preventAbsorbDecay = false;
  const shieldBeforeRetention = b.shield;
  const traitRetention = power(s, "diamondShieldImmunity")
    ? 1
    : power(s, "permanentShieldRetain")
      ? 1
      : Math.min(1, powers(s, "shieldRetainPercent", "perfectShieldRetain"));
  const setRetention = hasSynergy(s, "hardened_wax_seal")
    ? HIDDEN_SYNERGIES.hardened_wax_seal.retention
    : 0;
  b.shield = Math.floor(
    b.shield *
      Math.min(1, Math.max(power(s, "carry"), S.modifier(s, "shieldRetention"), b.nextShieldRetention || 0, traitRetention) + setRetention) *
      (power(s, "endTurnShieldHalfLoss") ? 0.5 : 1),
  );
  if (power(s, "zeroShieldLock")) b.shield = 0;
  if (shieldBeforeRetention > 0) b.shield = Math.max(b.shield, Math.min(shieldBeforeRetention, power(s, "retainedShield")));
  b.shield = Math.max(0, b.shield - power(s, "turnStartShieldLoss"));
  b.retainedBonusReady =
    b.shield > 0 && shieldBeforeRetention > 0 && hasSynergy(s, "sealed_impact");
  b.nextShieldRetention = 0;
  b.ap = Math.min(apLimit(s), Math.max(0, turnStartAp(s) + (b.nextTurnSynergyAp || 0) - power(s, "turnStartApPenalty") - (b.nextTurnApLoss || 0)));
  if (b.turn === 1) b.ap = Math.min(apLimit(s), b.ap + power(s, "turn1ExtraAp"));
  if (b.turn === 1 && (b.boss || b.elite)) b.ap = Math.min(apLimit(s), b.ap + power(s, "bossEliteTurn1Ap"));
  b.nextTurnApLoss = 0;
  b.nextTurnSynergyAp = 0;
  b.notes = [];
  b.echoCount = 0;
  b.contactCardsPlayedThisTurn = 0;
  b.nonContactCardsPlayedThisTurn = 0;
  b.oilCardsPlayedThisTurn = 0;
  b.absorbCardsPlayedThisTurn = 0;
  b.guardCardsPlayedThisTurn = 0;
  b.discardedThisTurn = 0;
  b.topPlayedThisTurn = false;
  b.nextAttackBonus = 0;
  b.turnDamagePenalty = 0;
  b.traitRefunds = {};
  b.cardsPlayedThisTurn = 0;
  b.harmoniesThisTurn = 0;
  b.cardsPlayedDefinitions = [];
  if (s.eventTurnHpLoss > 0) {
    s.hp = Math.max(0, s.hp - s.eventTurnHpLoss);
    log(s, `수은 중독 · 체력 -${s.eventTurnHpLoss}`);
    if (!s.hp) {
      finish(s, meta);
      return;
    }
  }
  b.handRetain = power(s, "handRetain");
  const enrageStartTurn = Math.max(1, enrageTurn(b) - (b.boss ? power(s, "bossEnrageTurnAdvance") : 0));
  if (b.turn >= enrageStartTurn) {
    const damage = 10 + (b.turn - enrageStartTurn) * 5;
    s.hp = Math.max(0, s.hp - damage);
    s._enrageFeedback = { damage, turn: b.turn };
    log(s, `폭주 관통 피해 ${damage}`);
    if (!s.hp) {
      finish(s, meta);
      return;
    }
  }
  if (s.loop >= 3) b.discard.push({ id: "impurity", level: 0 });
  if (b.turn === 1) {
    gainPlayerShield(s, powers(s, "openingShield", "turn1Shield") + (s.nextOpeningShield || 0));
    s.nextOpeningShield = 0;
  }
  else if (power(s, "diamondShieldImmunity")) gainPlayerShield(s, power(s, "diamondShieldImmunity"));
  if (b.nextTurnShield) { gainPlayerShield(s, b.nextTurnShield); b.nextTurnShield = 0; }
  gainAbsorb(s, power(s, "turnStartAbsorb"));
  const regenBefore = s.hp;
  heal(s, power(s, "regen"), 1);
  if (s.hp > regenBefore) gainPlayerShield(s, powers(s, "regenShield", "regenShieldT2"));
  if (s.inventory.includes("relic_dew_of_eternity")) {
    const excess = Math.max(0, s.hp + 4 - s.maxHp);
    heal(s, 4);
    gainPlayerShield(s, Math.floor(excess * 1.5));
  }
  triggerRegeneration(s, s, true);
  S.tickDurations(s, "turnStart");
  let turnDraw = (b.turn === 1 ? 5 - power(s, "turn1DrawPenalty") + power(s, "turn1Draw") : 3) + power(s, "draw");
  if (b.turn === 1 && power(s, "turn1DrawChance") && random(s) < power(s, "turn1DrawChance")) turnDraw++;
  b.drawnThisTurn = draw(s, turnDraw, true);
  if (!s.hp) {
    finish(s, meta);
    return;
  }
  if (b.turn === 1)
    for (let i = 0; i < power(s, "startWithImpurity"); i++) b.discard.push({ id: "impurity", level: 0 });
  if (power(s, "permanentProtection") > S.stacks(s, "protection"))
    applyBattleStatus(s, "player", "protection", power(s, "permanentProtection") - S.stacks(s, "protection"));
  if (power(s, "freeOilCardEachTurn")) {
    const oils = b.hand.filter((held) => CARDS[held.id]?.oil);
    if (oils.length) pick(s, oils).costReduction = 99;
  }
  if (power(s, "firstOilCardFree")) b.firstOilFreeReady = true;
  if (b.turn === 1) {
    if (s.eventOpeningBurning > 0)
      applyBattleStatus(s, "player", "burning", s.eventOpeningBurning);
    applyBattleStatus(s, "player", "thorns", powers(s, "thornsFlat1", "startCombatThornsAndShield"));
    if (power(s, "startCombatThornsAndShield")) gainPlayerShield(s, 6);
    const alive = livingEnemies(b);
    if (alive.length && power(s, "combatStartBurn1")) applyBattleStatus(s, "enemy", "burning", power(s, "combatStartBurn1"), pick(s, alive));
    if (power(s, "startCombatBurnAll")) for (const enemy of alive) applyBattleStatus(s, "enemy", "burning", power(s, "startCombatBurnAll"), enemy);
  }
  if (power(s, "lockRandomCardTurn") && b.hand.length) pick(s, b.hand).traitLocked = b.turn;
  b.enemies.forEach((enemy, index) => {
    if (enemy.hp > 0 && power(s, "corrosionDoubleTick") && S.stacks(enemy, "corrosion"))
      damage(s, S.stacks(enemy, "corrosion"), { targetEnemy: enemy, direct: false, statusId: "corrosion" });
    if (enemy.hp > 0) intent(s, enemy, index);
  });
  selectedEnemy(b);
  milestones(s, meta);
}
export function enter(s, meta) {
  if (s.phase !== "map") return;
  const category = roomCategoryAt(s);
  s.resolvedRooms ??= Array(12).fill(null);
  const room = ROOM_CATEGORIES[routeFor(s)[s.node]]
    ? (s.resolvedRooms[s.node] ||= rollSubRoom(s, category, s.node))
    : roomAt(s);
  s.currentSubRoom = room;
  s.restChoices = room === "rest" ? rollRestChoices(s) : null;
  s.restResult = null;
  s.log = [];
  if (power(s, "enterRoomGoldLoss")) s.gold -= power(s, "enterRoomGoldLoss");
  if (["battle", "elite", "boss"].includes(room)) {
    const base =
      room === "boss"
        ? 75 + s.node * 9
        : room === "elite"
          ? 65 + s.node * 5
          : 30 + s.node * 5;
    const totalHp = Math.round(base * actInfo(s.loop).hp);
    const groupRoll = Math.floor(random(s) * 3);
    const createEnemy = ({
      id,
      name,
      hp,
      isElite = false,
      isBoss = false,
      template = null,
    }) => {
      const enemy = {
        id,
        name,
        material: template?.material || ENEMIES[id]?.material || "spirit",
        hp,
        maxHp: hp,
        shield: 0,
        intent: null,
        pattern: template?.pattern ? structuredClone(template.pattern) : null,
        statuses: S.createStatuses(),
        isElite,
        isBoss,
        stunResistance: 0,
        lastAction: null,
        unlockId: template?.unlockId || null,
        signatureReward: template?.signatureReward || null,
        scaleWithAct: template?.scaleWithAct !== false,
        scaleAttackWithAct: template?.scaleAttackWithAct !== false,
        loopPattern: template?.loopPattern === true,
      };
      for (const [statusId, amount] of Object.entries(
        template?.initialStatuses || {},
      ))
        S.applyStatus(enemy, statusId, amount);
      return enemy;
    };
    let enemies;
    if (room === "battle") {
      const countRoll = random(s),
        enemyCount = countRoll < 0.5 ? 1 : countRoll < 0.85 ? 2 : 3,
        hpRatio = enemyCount === 1 ? 1 : enemyCount === 2 ? 0.65 : 0.5,
        monsterTable = s.loop === 0
          ? EARLY_MONSTERS
          : s.loop === 1
            ? ACT2_MONSTERS
            : { ...ACT3_MONSTERS, ...ACT2_MONSTERS },
        templates = shuffle(s, Object.values(monsterTable)).slice(
          0,
          enemyCount,
        ),
        hpScale = actInfo(s.loop).hp;
      enemies = templates.map((template) => {
        const scale = template.scaleWithAct === false ? 1 : hpScale,
          hp = Math.max(1, Math.round(template.baseHp * hpRatio * scale));
        return createEnemy({
          id: template.id,
          name: template.name,
          hp,
          template,
        });
      });
    } else if (room === "boss") {
      const bossTable = s.loop === 0 ? ACT1_BOSSES : s.loop === 1 ? ACT2_BOSSES : ACT3_BOSSES,
        pool = Object.values(bossTable).filter(
          (boss) => boss.unlockedByDefault || meta.unlocked.includes(boss.unlockId),
        ),
        template = pick(s, pool),
        hp = Math.round(template.baseHp * actInfo(s.loop).hp);
      enemies = [createEnemy({ id: template.id, name: template.name, hp, isBoss: true, template })];
    } else if (room === "elite") {
      const eliteTable = s.loop === 0 ? ACT1_ELITES : s.loop === 1 ? ACT2_ELITES : ACT3_ELITES,
        template = pick(s, Object.values(eliteTable)),
        hp = Math.round(template.baseHp * actInfo(s.loop).hp);
      const enemy = createEnemy({
        id: template.id,
        name: template.name,
        hp,
        isElite: true,
        template,
      });
      enemies = [enemy];
    } else {
      const enemyCount = 1 + groupRoll;
      const enemyId = room === "elite" ? "elite" : "normal";
      const baseName = ENEMIES[enemyId]?.name || "몬스터";
      enemies = Array.from({ length: enemyCount }, (_, index) => {
        const hp = Math.max(
          1,
          Math.round((totalHp * (enemyCount > 1 ? 1.15 : 1)) / enemyCount),
        );
        return createEnemy({
          id: enemyId,
          name:
            enemyCount > 1
              ? `${baseName} ${String.fromCharCode(65 + index)}`
              : baseName,
          hp,
          isElite: room === "elite",
        });
      });
    }
    meta.defeatedMonsters ??= [];
    for (const enemy of enemies)
      if (!meta.defeatedMonsters.includes(enemy.id))
        meta.defeatedMonsters.push(enemy.id);
    retainBetweenBattleStatuses(s);
    if (s.pendingCorrosion) {
      S.applyStatus(s, "corrosion", s.pendingCorrosion);
      log(s, `폐기장의 독성 증기: 부식 ${s.pendingCorrosion}`);
      s.pendingCorrosion = 0;
    }
    s.battle = attachEnemyAliases({
      enemies,
      selectedTarget: 0,
      shield: 0,
      absorb: Math.min(100, Math.max(-50, power(s, "openingAbsorb"))),
      turn: 0,
      ap: 0,
      stun: 0,
      hand: [],
      draw: shuffle(
        s,
        s.deck.map((c) => ({ ...c })),
      ),
      discard: [],
      exhaust: [],
      notes: [],
      boss: room === "boss",
      contactCardsPlayedThisBattle: 0,
      elite: room === "elite",
      lastEnemyAction: null,
    });
    s.phase = "battle";
    startTurn(s, meta);
    if (s.phase !== "battle") return;
    if (hasSynergy(s, "morning_chamomile")) {
      gainPlayerShield(s, HIDDEN_SYNERGIES.morning_chamomile.shield);
      log(s, "세트 효과 [아침 카모마일 온기]: 방어막 +4 전개");
    }
    while (s.pendingImpurities > 0) {
      if (s.inventory.includes("relic_golden_pipette")) {
        gainCurrentAp(s, 1);
        gainAbsorb(s, 6);
      } else if (canAddImpurityToHand(s)) {
        s.battle.hand.push({ id: "impurity", level: 0 });
      } else {
        s.battle.discard.push({ id: "impurity", level: 0 });
      }
      s.pendingImpurities--;
    }
  } else if (room === "gather" || room === "golden") {
    if (power(s, "treasureRoomCardDuplication") && s.lastRelicDuplicatedNode !== s.node && s.deck.length < deckLimit(s)) {
      const source = pick(s, s.deck);
      if (source) {
        s.deck.push({ ...source });
        s._roomRelicFeedback = {
          type: "cardDuplicate",
          relicId: "relic_mirror_of_duplication",
          node: s.node,
          card: { ...source },
        };
      }
      s.lastRelicDuplicatedNode = s.node;
    }
    s.phase = "chest";
  } else {
    s.phase = room;
    if (room === "shop") rollShopOffers(s, meta);
    if (["mystery", "greenhouse", "curse_pit", "lab", "mercury_still", "blood_altar", "dice_altar", "purify_furnace", "mirror_doppel", "smuggler"].includes(room))
      s.specialResult = null;
  }
}
function finish(s, meta) {
  if (s.finished) return;
  s.finished = true;
  s.phase = "result";
  meta.totalRuns++;
  meta.highScore = Math.max(meta.highScore, s.score);
  meta.highestLoop = Math.max(meta.highestLoop, s.loop);
}
function damage(
  s,
  amount,
  {
    direct = true,
    bypassShield = false,
    statusId = null,
    attackPattern = null,
    targetEnemy = null,
    shieldDamageMultiplier = 1,
    statusProcCount = 1,
    sourceImpactId = null,
    fx = null,
  } = {},
) {
  const b = s.battle,
    impactId = direct ? nextCombatImpactId(s) : sourceImpactId;
  const enemy = targetEnemy || selectedEnemy(b);
  if (!enemy || enemy.hp <= 0) return { damage: 0, blocked: 0 };
  const hpBeforeHit = enemy.hp,
    shieldBeforeHit = enemy.shield;
  if (direct && power(s, "executeThreshold") && enemy.hp <= enemy.maxHp * power(s, "executeThreshold")) {
    if (enemy.isBoss) amount *= 1.5;
    else amount = enemy.hp + (bypassShield ? 0 : enemy.shield);
  }
  if (direct && bypassShield && power(s, "bypassShieldAmplify")) amount *= 1 + power(s, "bypassShieldAmplify");
  const directImpactBaseAmount = direct
    ? S.directDamage(amount, s, enemy)
    : 0;
  amount = direct
    ? directImpactBaseAmount
    : S.damageTaken(amount, enemy);
  if (
    direct &&
    attackPattern === "nonContact" &&
    fx?.source === "card" &&
    S.stacks(enemy, "burning") > 0
  )
    amount *= 1 + synergyPower(s, "burningTargetNonContactMultiplier");
  amount = Math.min(999999, Math.max(0, Math.round(amount)));
  const directImpactAmount = direct ? amount : 0;
  s.maxHit = Math.max(s.maxHit, amount);
  const blocked = bypassShield ? 0 : Math.min(enemy.shield, amount * shieldDamageMultiplier);
  enemy.shield -= blocked;
  const dealt = Math.max(0, amount - Math.ceil(blocked / shieldDamageMultiplier));
  enemy.hp = Math.max(0, enemy.hp - dealt);
  if (hpBeforeHit > 0 && enemy.hp === 0 && statusId === "thorns")
    b.thornsKill = true;
  if (
    enemy.isBoss &&
    !enemy.phase2 &&
    enemy.hp > 0 &&
    enemy.hp <= enemy.maxHp / 2
  ) {
    enemy.phase2 = true;
    S.applyStatus(enemy, "strength", { stacks: 2, turns: 9 });
    log(s, `${enemy.name}의 발향 폭주가 시작됐다!`);
    s._bossPhaseFeedback = true;
  }
  const targetIndex = b.enemies.indexOf(enemy);
  s._enemyHitFeedback ??= [];
  const hitFeedback = {
    targetIndex,
    damage: dealt,
    blocked,
    statusId,
    attackPattern,
    impactId,
  };
  if (attackPattern || fx)
    Object.defineProperty(hitFeedback, "fx", {
      value: combatFxDescriptor({
        attackPattern,
        damage: dealt,
        blocked,
        shieldBefore: shieldBeforeHit,
        shieldAfter: enemy.shield,
        bypassShield,
        fx,
      }),
      enumerable: false,
      configurable: true,
    });
  s._enemyHitFeedback.push(hitFeedback);
  damageFeedback(s, "enemy", dealt, statusId, targetIndex, sourceImpactId);
  const damageSource = statusId
    ? S.STATUS_DEFINITIONS[statusId]?.name || statusId
    : b._logActor || "플레이어";
  const patternLabel = attackPattern
    ? attackPattern === "nonContact" ? "비접촉" : "접촉"
    : null;
  log(
    s,
    `${damageSource} → ${enemy.name} · [피해]${patternLabel ? ` ${patternLabel}` : ""} · 체력 ${hpBeforeHit}→${enemy.hp} (실피해 ${dealt}) · 방어막 ${shieldBeforeHit}→${enemy.shield} (흡수 ${blocked})`,
  );
  if (hpBeforeHit > 0 && enemy.hp === 0 && !enemy._traitDeathTriggered) {
    enemy._traitDeathTriggered = true;
    const others = livingEnemies(b);
    if (S.stacks(enemy, "poison")) {
      for (const other of others) {
        applyBattleStatus(s, "enemy", "poison", power(s, "poisonSpread"), other);
        if (power(s, "poisonDeathDetonate")) damage(s, power(s, "poisonDeathDetonate"), { targetEnemy: other, direct: false, bypassShield: true, statusId: "poison" });
      }
    }
    if (attackPattern === "nonContact" && power(s, "nonContactKillSupernova"))
      for (const other of others) damage(s, power(s, "nonContactKillSupernova"), { targetEnemy: other, direct: false, bypassShield: true });
  }
  if (direct && (dealt > 0 || blocked > 0))
    triggerImpactStatusProc(
      s,
      enemy,
      attackPattern,
      directImpactBaseAmount,
      false,
      statusProcCount,
      impactId,
    );
  if (
    direct &&
    attackPattern === "contact" &&
    S.stacks(enemy, "thorns")
  ) {
    const reflected = S.stacks(enemy, "thorns");
    S.removeStatus(enemy, "thorns", 1);
    hurtPlayer(s, reflected, {
      direct: false,
      bypassShield: true,
      statusId: "thorns",
    });
  }
  return { damage: dealt, blocked, impactId };
}
function hurtPlayer(
  s,
  amount,
  {
    direct = true,
    bypassShield = false,
    statusId = null,
    attackPattern = null,
    sourceEnemy = null,
    sourceImpactId = null,
  } = {},
) {
  const b = s.battle,
    hpBeforeHit = s.hp,
    impactId = direct ? nextCombatImpactId(s) : sourceImpactId;
  amount = direct
    ? S.directDamage(amount, sourceEnemy || selectedEnemy(b), s)
    : S.damageTaken(amount, s);
  if (sourceEnemy && !b.firstHitTaken) {
    amount = Math.max(0, amount - power(s, "firstHitBlock"));
    b.firstHitTaken = true;
  }
  amount = Math.max(0, Math.round(amount) - (b.turnDamageReduction || 0));
  const shieldBefore = b.shield;
  if (direct && sourceEnemy && shieldBefore > 0 && hasSynergy(s, "hardened_wax_seal"))
    amount = Math.max(0, amount - HIDDEN_SYNERGIES.hardened_wax_seal.value);
  const directImpactAmount = direct ? amount : 0,
    blocked = bypassShield ? 0 : Math.min(b.shield, amount);
  b.shield -= blocked;
  if (direct && sourceEnemy && blocked > 0 && hasSynergy(s, "diamond_bastion")) {
    const reflected = Math.max(1, Math.round(shieldBefore * HIDDEN_SYNERGIES.diamond_bastion.value));
    damage(s, reflected, { targetEnemy: sourceEnemy, direct: false, bypassShield: true });
    log(s, `세트 효과 [다이아몬드 요새]: 반사 피해 ${reflected}`);
  }
  if (amount > 0) b.shield = Math.max(0, b.shield - power(s, "hitShieldExtraLoss"));
  if (b.shield <= 0) b.shieldSurvivalHeal = 0;
  s.hp = Math.max(0, s.hp - amount + blocked);
  const dealt = amount - blocked;
  if (dealt > 0) b.playerHpDamageTaken = (b.playerHpDamageTaken || 0) + dealt;
  if (sourceEnemy && blocked >= amount && amount > 0)
    gainAbsorb(s, blocked * power(s, "blockedDamageToAbsorb"));
  if (sourceEnemy && blocked > 0 && attackPattern === "contact")
    S.applyStatus(sourceEnemy, "corrosion", power(s, "blockCorrosion"));
  if (sourceEnemy && direct && amount > 0)
    S.applyStatus(sourceEnemy, "strength", power(s, "enemyAttackBuff"));
  if (dealt > 0) {
    b.turnDamagePenalty = (b.turnDamagePenalty || 0) + power(s, "hitDamagePenalty");
    if (power(s, "hitPermanentMaxHpLoss")) {
      s.maxHp = Math.max(1, s.maxHp - power(s, "hitPermanentMaxHpLoss"));
      s.hp = Math.min(s.hp, s.maxHp);
    }
    if (power(s, "hitInstaDeathChance") && random(s) < power(s, "hitInstaDeathChance")) s.hp = 0;
    if (sourceEnemy && power(s, "enemyLeechAmount"))
      sourceEnemy.hp = Math.min(sourceEnemy.maxHp, sourceEnemy.hp + power(s, "enemyLeechAmount"));
  }
  if (shieldBefore > 0 && b.shield === 0 && power(s, "shieldBreakEnemyRegen"))
    for (const enemy of livingEnemies(b)) S.applyStatus(enemy, "regeneration", power(s, "shieldBreakEnemyRegen"));
  if (s.hp > 0 && s.hp <= s.maxHp * 0.4 && power(s, "cleanseOnLowHp") && !b.lowHpCleansed) {
    S.dispelStatuses(s, { kind: "debuff" });
    b.lowHpCleansed = true;
  }
  if (!s.hp && power(s, "reviveFullHpOncePerRun") && !s._relicFullRevived) {
    s._relicFullRevived = true;
    s.hp = s.maxHp;
    S.dispelStatuses(s, { kind: "debuff" });
  } else if (!s.hp && power(s, "reviveOnFatal") && !s._traitRevived) {
    s._traitRevived = true;
    s.hp = Math.max(1, Math.ceil(s.maxHp * power(s, "reviveOnFatal")));
    S.dispelStatuses(s, { kind: "debuff" });
  }
  if (dealt > 0 && !statusId)
    s._playerDamageFeedback = (s._playerDamageFeedback || 0) + dealt;
  damageFeedback(s, "player", dealt, statusId, null, sourceImpactId);
  if (amount > 0 || blocked > 0) {
    const damageSource = statusId
      ? S.STATUS_DEFINITIONS[statusId]?.name ||
        ({ shufflePenalty: "셔플 반동", impurityOverflow: "불순물 과부하" }[statusId] ?? statusId)
      : sourceEnemy?.name || b._logActor || "효과";
    const patternLabel = attackPattern
      ? attackPattern === "nonContact" ? "비접촉" : "접촉"
      : null;
    log(
      s,
      `${damageSource} → 플레이어 · [피해]${patternLabel ? ` ${patternLabel}` : ""} · 체력 ${hpBeforeHit}→${s.hp} (실피해 ${dealt}) · 방어막 ${shieldBefore}→${b.shield} (흡수 ${blocked})`,
    );
  }
  if (direct && (dealt > 0 || blocked > 0))
    triggerImpactStatusProc(
      s,
      s,
      attackPattern,
      directImpactAmount,
      true,
      1,
      impactId,
    );
  if (
    direct &&
    attackPattern === "contact" &&
    S.stacks(s, "thorns")
  ) {
    const reflected = Math.round((S.stacks(s, "thorns") + power(s, "thornsDamageBonus")) * (1 + power(s, "thornsAmplifyRatio") + power(s, "thornsNovaMultiplier")));
    S.removeStatus(s, "thorns", 1);
    const reflectedTargets = power(s, "thornsNovaMultiplier") ? livingEnemies(b) : [sourceEnemy || selectedEnemy(b)];
    for (const targetEnemy of reflectedTargets) damage(s, reflected, { direct: false, bypassShield: true, statusId: "thorns", targetEnemy });
    const attacker = sourceEnemy || selectedEnemy(b);
    if (attacker?.hp > 0 && power(s, "thornsCorrode"))
      applyBattleStatus(s, "enemy", "corrosion", power(s, "thornsCorrode"), attacker);
    if (attacker?.hp > 0)
      for (const [id, amount] of Object.entries(b.thornsApplyAttacker || {}))
        applyBattleStatus(s, "enemy", id, amount, attacker);
    if (!S.stacks(s, "thorns")) b.thornsApplyAttacker = null;
  }
  return { damage: dealt, blocked, impactId };
}
function applyBattleStatus(s, target, id, amount = 1, targetEnemy = null) {
  if (!S.canTarget(id, target)) return 0;
  const entity =
    target === "enemy" ? targetEnemy || selectedEnemy(s.battle) : s;
  if (!entity) return 0;
  const definition = S.STATUS_DEFINITIONS[id];
  if (target === "player" && definition?.kind === "buff" && power(s, "buffNullifyChance") && random(s) < power(s, "buffNullifyChance")) return 0;
  if (target === "player" && ["poison", "bleed", "corrosion", "burning"].includes(id) && power(s, "doubleIncomingDebuffs")) {
    const multiplier = power(s, "doubleIncomingDebuffs");
    amount = typeof amount === "number" ? amount * multiplier : { ...amount, stacks: (amount.stacks || 1) * multiplier };
  }
  if (target === "enemy" && id === "burning" && power(s, "burningStackBonusChance") && random(s) < power(s, "burningStackBonusChance")) {
    amount = typeof amount === "number" ? amount + 1 : { ...amount, stacks: (amount.stacks || 1) + 1 };
  }
  if (id === "stun" && (entity.stunResistance || 0) > 0) return 0;
  const beforeStacks = S.stacks(entity, id),
    beforeTurns = S.turns(entity, id),
    applied = S.applyStatus(entity, id, amount),
    afterStacks = S.stacks(entity, id),
    afterTurns = S.turns(entity, id);
  if (applied || afterTurns > beforeTurns) {
    const source = s.battle?._logActor || "효과",
      targetName = target === "player" ? "플레이어" : entity.name || "적",
      duration = afterTurns ? ` · ${afterTurns}턴` : "",
      change = applied ? `+${applied}` : "지속시간 갱신";
    log(s, `${source} → ${targetName} · ${definition.name} ${change} (현재 ${afterStacks}중첩${duration})`);
  }
  return applied;
}
function applyCardStatuses(s, card, targets) {
  for (const [id, amount] of Object.entries(card.applyPlayer || {}))
    applyBattleStatus(s, "player", id, amount);
  for (const enemy of targets)
    for (const [id, amount] of Object.entries(card.applyEnemy || {}))
      applyBattleStatus(s, "enemy", id, amount, enemy);
  for (const enemy of targets) {
    const conditional = card.conditionalEnemyIntent?.[enemy.intent?.type];
    for (const [id, amount] of Object.entries(conditional || {}))
      applyBattleStatus(s, "enemy", id, amount, enemy);
  }
}
function cardTargets(s, card) {
  const alive = livingEnemies(s.battle);
  if (card.target === "self") return [];
  if (card.target === "all") return alive;
  if (card.target === "random") return alive.length ? [pick(s, alive)] : [];
  if (isAttackCard(card) && power(s, "forceRandomTarget")) return alive.length ? [pick(s, alive)] : [];
  const selected = selectedEnemy(s.battle);
  return selected?.hp > 0 ? [selected] : alive.slice(0, 1);
}
export function cardDefinition(card) {
  const definition = CARDS[card.id];
  if (!definition.upgrades) return definition;
  const level = Math.max(0, Math.min(definition.maxUpgrade, card.level || 0));
  return { ...definition, ...Object.fromEntries(Object.entries(definition.upgrades).map(([key, values]) => [key, values[level]])) };
}
function effect(s, card, factor = 1) {
  const b = s.battle,
    c = cardDefinition(card),
    up = c.upgrades ? 0 : card.level * 3,
    targets = cardTargets(s, c);
  const pattern = cardPattern(c), attackCard = isAttackCard(c), note = card.note || c.note;
  if (attackCard)
    for (const enemy of targets) enemy.shield += power(s, "enemyShieldOnAttack");
  if (pattern === "nonContact")
    for (const enemy of livingEnemies(b)) enemy.shield += power(s, "nonContactEnemyShield");
  if (c.cost === 0) hurtPlayer(s, power(s, "zeroCostSelfDamage"), { direct: false, bypassShield: true });
  if (c.oil) hurtPlayer(s, power(s, "oilCardSelfDamage"), { direct: false, bypassShield: true });
  if (pattern === "nonContact" && attackCard) applyBattleStatus(s, "player", "burning", power(s, "nonContactSelfBurn"));
  if (pattern === "contact" && attackCard) applyBattleStatus(s, "player", "bleed", power(s, "contactSelfBleed"));
  if (c.absorb) applyBattleStatus(s, "player", "corrosion", power(s, "absorbCardSelfCorrosion"));
  if (attackCard && c.cost >= 2) applyBattleStatus(s, "player", "weak", power(s, "heavyCardSelfWeak"));
  let attackFactor = factor;
  if (
    b.retainedBonusReady &&
    (c.attack || c.burst || c.weight) &&
    (c.attackPattern || "contact") === "contact"
  ) {
    attackFactor *= 1 + synergyPower(s, "retainedBonusDamage");
    b.retainedBonusReady = false;
  }
  if (c.oil && power(s, "doubleAbsorb"))
    gainAbsorb(
      s,
      Math.floor(b.absorb * Math.min(4, power(s, "doubleAbsorb"))) - b.absorb,
    );
  let synergyHitEnemy = null;
  if (c.attack) {
    const preExistingBleedTargets = pattern === "contact"
        ? new Set(livingEnemies(b).filter((enemy) => S.stacks(enemy, "bleed") > 0))
        : new Set(),
      preExistingConditionalTargets = c.applyEnemyIfPreAttackStatus
        ? new Set(livingEnemies(b).filter((enemy) => S.stacks(enemy, c.applyEnemyIfPreAttackStatus.statusId) > 0))
        : new Set();
    let shouldHealFromContactBleed = false;
    if (c.requiredAbsorb && b.absorb < c.requiredAbsorb) return targets;
    if (c.requiredAbsorb) b.absorb -= c.requiredAbsorb;
    const fueled = c.absorbCost && b.absorb >= c.absorbCost;
    if (fueled) b.absorb -= c.absorbCost;
    const traitAbsorbSpent = (c.requiredAbsorb || 0) + (fueled ? c.absorbCost || 0 : 0);
    if (traitAbsorbSpent >= 10) heal(s, power(s, "absorbCostHeal"));
    if (traitAbsorbSpent >= 5 && power(s, "absorbSpendAoeDamage"))
      for (const enemy of livingEnemies(b)) damage(s, Math.floor(traitAbsorbSpent / 5) * power(s, "absorbSpendAoeDamage"), { targetEnemy: enemy });
    const hits = Math.min(c.maxHits || Infinity, (c.hits || 1) +
        (c.hitsPerCardThisTurn || 0) * (b.cardsPlayedThisTurn || 0)),
      fxContext = combatFxCardContext(c, card.id, hits),
      comboBonus =
        c.comboContactBonus && b.contactCardsPlayedThisTurn > 0
          ? c.comboContactBonus
          : 0,
      rawBattleContactBonus = (c.battleContactBonus || 0) * (b.contactCardsPlayedThisBattle || 0),
      battleContactBonus = c.ceilBattleContactBonus
        ? Math.ceil(rawBattleContactBonus)
        : rawBattleContactBonus,
      shieldBonus = b.shield * (c.shieldScaling || 0),
      absorbBonus = b.absorb * (c.absorbBonusRatio || 0),
      turnDamageBonus = b.turn * (c.turnDamageBonus || 0),
      handDamageBonus = (b.hand.length + 1) * (c.handDamageBonus || 0),
      globalAilmentStacks = c.globalAilmentBurstMultiplier
        ? livingEnemies(b).reduce((total, target) => total +
            ["burning", "poison", "bleed", "corrosion"].reduce((sum, id) => sum + S.stacks(target, id), 0), 0)
        : 0;
    if (c.target === "self") {
      for (let hit = 0; hit < hits; hit++)
        hurtPlayer(
          s,
          (c.attack +
            up +
            cardAttackPower(s, card, c) +
            comboBonus +
            shieldBonus +
            absorbBonus) *
            attackFactor,
          { attackPattern: c.attackPattern || "contact" },
        );
    } else {
      let brokeShield = false;
      for (const enemy of targets) {
        const shieldBefore = enemy.shield,
          hpBefore = enemy.hp,
          thresholdActive = Boolean(c.shieldThreshold && b.shield >= c.shieldThreshold),
          ailmentStacksBefore = ["burning", "poison", "bleed", "corrosion"]
            .reduce((sum, id) => sum + S.stacks(enemy, id), 0),
          statusBonus = Object.entries(c.bonusPerStatus || {}).reduce(
            (sum, [id, amount]) => sum + S.stacks(enemy, id) * amount,
            0,
          ),
          resonanceBonus = c.consumeResonance
            ? S.stacks(enemy, "resonance") * c.consumeResonance
            : 0,
          conditionalMultiplier = c.firstTurnOrFullHpMultiplier &&
            (b.turn === 1 || enemy.hp === enemy.maxHp)
              ? c.firstTurnOrFullHpMultiplier
              : 1;
        let landedHits = 0;
        let damageDealt = 0;
        const executionActive = Boolean(
          c.executeRatio &&
          enemy.hp <= enemy.maxHp * c.executeRatio &&
          (!c.executeNonBoss || !enemy.isBoss)
        );
        for (let hit = 0; hit < hits && (c.randomEachHit ? livingEnemies(b).length : enemy.hp > 0); hit++) {
          const hitEnemy = c.randomEachHit ? pick(s, livingEnemies(b)) : enemy;
          const result = damage(
            s,
            (((executionActive
              ? c.executeAttack ?? c.attack * (c.executeMultiplier || 1)
              : fueled ? c.fueledAttack : c.attack)) +
              up +
              cardAttackPower(s, card, c, hitEnemy) +
              comboBonus +
              battleContactBonus +
              shieldBonus +
              absorbBonus +
              turnDamageBonus +
              handDamageBonus +
              statusBonus +
              resonanceBonus) *
              attackFactor * conditionalMultiplier,
            {
              attackPattern: c.attackPattern || "contact",
              targetEnemy: hitEnemy,
              shieldDamageMultiplier: c.shieldDamageMultiplier || 1,
              bypassShield: Boolean(c.bypassShield || (thresholdActive && c.thresholdBypassShield)),
              statusProcCount: c.burnProcCount || 1,
              fx: { ...fxContext, hitIndex: hit },
            },
          );
          damageDealt += result.damage;
          if (!synergyHitEnemy && result.damage + result.blocked > 0) synergyHitEnemy = hitEnemy;
          if (result.damage + result.blocked > 0) landedHits++;
          if (result.damage + result.blocked > 0 && preExistingBleedTargets.has(hitEnemy))
            shouldHealFromContactBleed = true;
          if (result.damage + result.blocked > 0 && pattern === "contact") {
            applyBattleStatus(
              s,
              "enemy",
              "burning",
              power(s, "contactIgnite") + (c.cost >= 1 ? power(s, "contactIgniteT2") : 0),
              hitEnemy,
            );
            if (result.blocked > 0) applyBattleStatus(s, "enemy", "bleed", power(s, "contactBleed"), hitEnemy);
          }
          if (result.damage + result.blocked > 0 && pattern === "nonContact")
            applyBattleStatus(s, "enemy", "weak", Math.min(5, Math.max(0, powers(s, "nonContactWeak", enemy.intent?.type === "attack" ? "nonContactWeakT2" : ""))), hitEnemy);
          if (!b.suppressCardSecondaryEffects && c.chanceStatusOnHit && result.damage + result.blocked > 0 && random(s) < c.chanceStatusOnHit.chance)
            applyBattleStatus(s, "enemy", c.chanceStatusOnHit.id, c.chanceStatusOnHit.amount, hitEnemy);
          if (!b.suppressCardSecondaryEffects && c.weakOnHit && enemy.hp > 0 && result.damage + result.blocked > 0) {
            const totalWeak = Math.min(5, Math.max(1, c.weakOnHit)),
              amount = Math.floor((hit + 1) * totalWeak / hits) - Math.floor(hit * totalWeak / hits);
            if (amount > 0) applyBattleStatus(s, "enemy", "weak", amount, enemy);
          }
        }
        if (pattern === "contact" && power(s, "contactBypass"))
          damage(s, power(s, "contactBypass"), { targetEnemy: enemy, direct: false, bypassShield: true });
        if (pattern === "contact" && c.cost >= 2 && damageDealt > 0 && power(s, "heavyContactTrueDamage"))
          damage(s, power(s, "heavyContactTrueDamage"), { targetEnemy: enemy, direct: false, bypassShield: true });
        if (pattern === "nonContact" && damageDealt > 0) gainAbsorb(s, damageDealt * power(s, "nonContactLeechAbsorb"));
        if (c.absorbFromDamage && damageDealt > 0)
          gainAbsorb(s, damageDealt * c.absorbFromDamage);
        if (c.globalAilmentBurstMultiplier && globalAilmentStacks > 0 && enemy.hp > 0)
          damage(s, globalAilmentStacks * c.globalAilmentBurstMultiplier * factor, {
            targetEnemy: enemy,
            direct: false,
            bypassShield: true,
          });
        if (c.extendDecayStatuses && enemy.hp > 0)
          for (const id of ["poison", "corrosion"]) {
            const state = enemy.statuses?.[id];
            if (state) state.deferDecayTicks = (state.deferDecayTicks || 0) + c.extendDecayStatuses;
          }
        if (pattern === "nonContact" && power(s, "extendDecayStatuses") && enemy.hp > 0)
          for (const id of ["poison", "corrosion"]) {
            const state = enemy.statuses?.[id];
            if (state) state.deferDecayTicks = (state.deferDecayTicks || 0) + power(s, "extendDecayStatuses");
          }
        if (pattern === "nonContact" && c.target === "all" && !enemy.isBoss && random(s) < Math.min(1, power(s, "aoeNonContactStunChance")))
          applyBattleStatus(s, "enemy", "stun", 1, enemy);
        if (c.ailmentBurstMultiplier && ailmentStacksBefore > 0 && enemy.hp > 0)
          damage(s, ailmentStacksBefore * c.ailmentBurstMultiplier * factor, {
            targetEnemy: enemy,
            direct: false,
            bypassShield: true,
          });
        if (c.amplifyAilments && enemy.hp > 0)
          for (const id of ["burning", "poison", "bleed", "corrosion"]) {
            const stacks = S.stacks(enemy, id);
            if (stacks > 0) applyBattleStatus(s, "enemy", id, stacks * (c.amplifyAilments - 1), enemy);
          }
        if (!b.suppressCardSecondaryEffects && c.applyEnemyAfterAttack && enemy.hp > 0)
          for (const [id, amount] of Object.entries(c.applyEnemyAfterAttack))
            applyBattleStatus(s, "enemy", id, amount, enemy);
        if (!b.suppressCardSecondaryEffects && c.onHitCount && landedHits >= c.onHitCount && enemy.hp > 0)
          for (const [id, amount] of Object.entries(c.onHitApplyEnemy || {}))
            applyBattleStatus(s, "enemy", id, amount, enemy);
        if (c.stunOrDisarmBossTurns && enemy.hp > 0) {
          const stunned = applyBattleStatus(s, "enemy", "stun", 1, enemy);
          if (!stunned && enemy.isBoss)
            applyBattleStatus(s, "enemy", "disarm", { stacks: 1, turns: c.stunOrDisarmBossTurns }, enemy);
        }
        if (
          !b.suppressCardSecondaryEffects &&
          c.applyEnemyIfPreAttackStatus &&
          preExistingConditionalTargets.has(enemy) &&
          enemy.hp > 0
        )
          for (const [id, amount] of Object.entries(c.applyEnemyIfPreAttackStatus.apply || {}))
            applyBattleStatus(s, "enemy", id, amount, enemy);
        if (c.maxHpOnKill && hpBefore > 0 && enemy.hp === 0) {
          s.maxHp += c.maxHpOnKill;
          log(s, `연금 추출 · 최대 체력 영구 +${c.maxHpOnKill}`);
        }
        if (hpBefore > 0 && enemy.hp === 0) {
          if (!b.suppressCardSecondaryEffects && c.refundOnKill) gainCurrentAp(s, c.refundOnKill);
          if (!b.suppressCardSecondaryEffects && c.drawOnKill) draw(s, c.drawOnKill);
        }
        if (c.consumeResonance) S.removeStatus(enemy, "resonance");
        if (shieldBefore > 0 && enemy.shield === 0) brokeShield = true;
        if (pattern === "contact" && landedHits >= 4 && power(s, "contactFourHitsBonus") && !b.traitRefunds.contactFour) {
          gainCurrentAp(s, power(s, "contactFourHitsBonus")); draw(s, 2); b.traitRefunds.contactFour = true;
        }
      }
      if (!b.suppressCardSecondaryEffects && c.refundOnBreak && brokeShield) gainCurrentAp(s, c.refundOnBreak);
      if (!b.suppressCardSecondaryEffects && c.drawOnBreak && brokeShield) draw(s, c.drawOnBreak);
      if (shouldHealFromContactBleed) heal(s, power(s, "contactBleedHeal"));
      if (brokeShield && power(s, "shieldBreakRefund") && !b.traitRefunds.shieldBreak) {
        gainCurrentAp(s, power(s, "shieldBreakRefund")); draw(s, 1); b.traitRefunds.shieldBreak = true;
      }
      if (c.shieldThreshold && b.shield >= c.shieldThreshold && c.thresholdApplyAllEnemy)
        for (const enemy of livingEnemies(b))
          for (const [id, amount] of Object.entries(c.thresholdApplyAllEnemy))
            applyBattleStatus(s, "enemy", id, amount, enemy);
    }
  }
  if (synergyHitEnemy && pattern === "contact" && hasSynergy(s, "novice_pestle")) {
    damage(s, HIDDEN_SYNERGIES.novice_pestle.value, { targetEnemy: synergyHitEnemy, direct: false });
    heal(s, HIDDEN_SYNERGIES.novice_pestle.heal);
    log(s, "세트 효과 [초심자의 막자사발]: 추가 피해 2 · 체력 +1 흡혈");
  }
  if (synergyHitEnemy && pattern === "nonContact" && hasSynergy(s, "pressurized_airflow")) {
    for (const enemy of livingEnemies(b))
      applyBattleStatus(s, "enemy", "burning", HIDDEN_SYNERGIES.pressurized_airflow.burning, enemy);
    log(s, "세트 효과 [가압 기류 분사]: 모든 적에게 연소 2");
  }
  if (c.shield) {
    let traitShield = c.cost >= 1 ? power(s, "guardBonusT2") : 0;
    if (s.hp <= s.maxHp / 2) traitShield += power(s, "lowHpDefense");
    const rawShield = Math.round((c.shield + up + power(s, "defense") + traitShield) * factor * (note === "top" && power(s, "topNoteShieldHalf") ? 0.5 : 1));
    if (rawShield < 0) hurtPlayer(s, -rawShield, { direct: false, bypassShield: true });
    else gainPlayerShield(s, S.shieldGain(rawShield, s));
    if (power(s, "shieldHit"))
      for (const enemy of targets)
        damage(s, b.shield * power(s, "shieldHit"), { targetEnemy: enemy });
  }
  if (c.shieldCounter) {
    const counterFx = combatFxCardContext(c, card.id, 1);
    for (const enemy of targets)
      damage(s, b.shield * c.shieldCounter * attackFactor, {
        attackPattern: "contact",
        targetEnemy: enemy,
        fx: { ...counterFx, hitIndex: 0 },
      });
  }
  if (c.shieldScalingAttack) {
    const scalingFx = combatFxCardContext(c, card.id, 1);
    for (const enemy of targets)
      damage(s, b.shield * c.shieldScalingAttack * attackFactor, {
        attackPattern: c.attackPattern || "contact",
        targetEnemy: enemy,
        fx: { ...scalingFx, hitIndex: 0 },
      });
  }
  if (c.turnDamageReduction) b.turnDamageReduction = (b.turnDamageReduction || 0) + c.turnDamageReduction;
  if (c.shieldSurvivalHeal && b.shield > 0) b.shieldSurvivalHeal = (b.shieldSurvivalHeal || 0) + c.shieldSurvivalHeal;
  const absorbBonus = (b.absorbBoosters || []).reduce((sum, booster) => sum + booster.amount, 0);
  b.absorbBoosters = (b.absorbBoosters || [])
    .map((booster) => ({ ...booster, remaining: booster.remaining - 1 }))
    .filter((booster) => booster.remaining > 0);
  if (c.absorb) gainAbsorb(s, (c.absorb + up + absorbBonus) * factor * (c.oil ? 1 + power(s, "oilAbsorbRatio") : 1), true);
  if (c.absorbStatusThreshold && b.absorb >= c.absorbStatusThreshold && c.absorbThresholdApplyAllEnemy)
    for (const enemy of livingEnemies(b))
      for (const [id, amount] of Object.entries(c.absorbThresholdApplyAllEnemy))
        applyBattleStatus(s, "enemy", id, amount, enemy);
  if (c.absorbAmplifyRatio && b.absorb >= c.absorbAmplifyThreshold)
    gainAbsorb(s, b.absorb * c.absorbAmplifyRatio);
  if (c.searchDrawCard && b.hand.length < handLimit(s)) {
    const index = b.draw.findIndex((held) => held.id === c.searchDrawCard);
    if (index >= 0) {
      const [found] = b.draw.splice(index, 1);
      b.hand.push(found);
      log(s, `🔎 ${CARDS[found.id].name} 카드를 손패로 가져왔습니다.`);
    }
  }
  if (c.preventAbsorbDecay) b.preventAbsorbDecay = true;
  if (c.absorbBooster) b.absorbBoosters.push({ amount: c.absorbBooster, remaining: 2 });
  if (c.oil) {
    gainPlayerShield(s, powers(s, "oilShield", "oilShieldT2"));
    heal(s, synergyPower(s, "oilHeal"));
  }
  if (c.searchBurst) {
    const isBurst = (held) => CARDS[held.id]?.burst,
      preferred = (held) => held.id === "burst_spatial_diffusion",
      findIn = (pile) => {
        let index = pile.findIndex(preferred);
        if (index < 0) index = pile.findIndex(isBurst);
        return index;
      };
    let pile = b.draw, index = findIn(pile);
    if (index < 0) { pile = b.discard; index = findIn(pile); }
    if (index >= 0) {
      const [found] = pile.splice(index, 1);
      b.hand.push(found);
      log(s, `🔎 ${CARDS[found.id].name} 카드를 손패로 가져왔습니다.`);
    }
  }
  if (c.heal || c.missingHpHealRatio) {
    let healAmount = c.missingHpHealRatio
      ? Math.max(c.minimumHeal || 0, Math.ceil((s.maxHp - s.hp) * c.missingHpHealRatio))
      : c.heal + up;
    if (c.comboHealThreshold && b.cardsPlayedThisTurn >= c.comboHealThreshold - 1)
      healAmount *= c.comboHealMultiplier || 1;
    healAmount = Math.round(healAmount * factor);
    const excess = Math.max(0, s.hp + healAmount - s.maxHp);
    heal(s, healAmount);
    if (c.harmonyHealShield && (b.harmoniesThisTurn || 0) > 0)
      gainPlayerShield(s, S.shieldGain(healAmount, s));
    if (c.overhealShieldRatio && excess > 0)
      gainPlayerShield(s, S.shieldGain(Math.floor(excess * c.overhealShieldRatio), s));
  }
  if (c.cleanseAilmentStacks)
    for (const id of ["burning", "corrosion", "poison", "bleed"])
      S.removeStatus(s, id, c.cleanseAilmentStacks);
  if (note === "top") gainPlayerShield(s, power(s, "topShield"));
  if (note === "middle") {
    heal(s, power(s, "middleHeal"));
    if (power(s, "middleRegenBoost")) applyBattleStatus(s, "player", "regeneration", power(s, "middleRegenBoost"));
  }
  if (note === "base") b.nextTurnShield = (b.nextTurnShield || 0) + power(s, "baseNextShield");
  if (pattern === "nonContact" && c.target === "all") {
    gainAbsorb(s, power(s, "nonContactAbsorb"));
    for (const enemy of livingEnemies(b)) applyBattleStatus(s, "enemy", "poison", power(s, "nonContactPoison"), enemy);
  }
  if (pattern === "nonContact" && !(b.nonContactCardsPlayedThisTurn || 0))
    for (const enemy of targets) applyBattleStatus(s, "enemy", "vulnerable", power(s, "firstNonContactVulnerable"), enemy);
  if (c.shield) applyBattleStatus(s, "player", "thorns", power(s, "thornsOnGuard"));
  if (c.draw && !b.suppressCardSecondaryEffects) draw(s, c.draw);
  if (c.reduceOilCost) {
    for (const held of b.hand)
      if (CARDS[held.id]?.oil)
        held.costReduction = (held.costReduction || 0) + c.reduceOilCost;
  }
  if (c.retainShield) b.nextShieldRetention = Math.max(b.nextShieldRetention || 0, c.retainShield);
  if (c.cleanse) S.dispelStatuses(s, { kind: "debuff", limit: c.cleanse === "all" ? Infinity : c.cleanse });
  if (c.thorns) {
    applyBattleStatus(s, "player", "thorns", c.thorns);
    b.thornsApplyAttacker = c.thornsApplyAttacker ? { ...c.thornsApplyAttacker } : null;
  }
  if (!b.suppressCardSecondaryEffects && c.applyWeak)
    for (const enemy of targets) applyBattleStatus(s, "enemy", "weak", Math.min(5, Math.max(1, c.applyWeak)), enemy);
  for (let i = 0; i < (c.randomDiscard || 0); i++) {
    const candidates = b.hand.filter((held) => canDiscard(s, held));
    if (!candidates.length) break;
    const discarded = pick(s, candidates);
    b.hand.splice(b.hand.indexOf(discarded), 1);
    b.discard.push(discarded);
    if (c.discardTierAp && discarded.id !== "impurity" && CARDS[discarded.id].tier >= 1)
      gainCurrentAp(s, c.discardTierAp);
  }
  if (c.discard && b.hand.some((held) => canDiscard(s, held))) {
    b.pendingDiscard = (b.pendingDiscard || 0) + c.discard;
    b.discardEffects ??= [];
    for (let i = 0; i < c.discard; i++) b.discardEffects.push({ burn: c.discardAttackBurn || 0, costDamage: (c.discardCostDamage || 0) * factor, targets: targets.map((enemy) => b.enemies.indexOf(enemy)) });
  }
  if (!b.suppressCardSecondaryEffects && c.refundAbsorbThreshold && b.absorb >= c.refundAbsorbThreshold) gainCurrentAp(s, 1);
  if (c.burst) {
    const consumed = b.absorb;
    const multiplier = ((c.upgrades ? c.burstMultiplier : (card.level > 0 ? 4.5 : 3.2)) || 3.2) + power(s, "spatialDiffusionMultiplier");
    const burstDamage = Math.ceil(consumed * multiplier),
      burstFx = combatFxCardContext(c, card.id, 1);
    for (const enemy of targets)
      damage(s, (burstDamage + cardAttackPower(s, card, c, enemy)) * attackFactor, {
        attackPattern: c.attackPattern || "nonContact",
        targetEnemy: enemy,
        fx: { ...burstFx, hitIndex: 0 },
      });
    b.absorb = 0;
    if (consumed >= 40) {
      for (const enemy of targets)
        applyBattleStatus(s, "enemy", "stun", 1, enemy);
      log(s, `공간 확산 임계점 돌파 (${consumed}) · 적 전원 기절!`);
    }
  }
  if (c.weight) {
    const shield = b.shield,
      weightFx = combatFxCardContext(c, card.id, 1);
    b.shield = 0;
    for (const enemy of targets)
      damage(s, (shield + up + cardAttackPower(s, card, c, enemy)) * attackFactor, {
        attackPattern: c.attackPattern || "contact",
        targetEnemy: enemy,
        fx: { ...weightFx, hitIndex: 0 },
      });
  }
  if (c.purgeImpurity) {
    let remaining = c.purgeImpurity;
    for (let index = b.hand.length - 1; index >= 0 && remaining > 0; index--)
      if (b.hand[index].id === "impurity") {
        b.hand.splice(index, 1);
        remaining--;
      }
  }
  return targets;
}
export function cost(s, card) {
  if (card?.id === "impurity") return 1;
  const definition = CARDS[card.id], baseCost = definition.cost;
  if (definition.oil && s.battle.firstOilFreeReady) return 0;
  return Math.max(0,
    baseCost +
    (s.loop >= 4 && s.battle.turn === 1 ? 1 : 0) +
    S.extraCost(s) +
    S.cardCostChange(s, { ...definition, id: card.id }) +
    (cardPattern(definition) === "contact" && isAttackCard(definition) ? power(s, "contactCostUp") : 0) +
    (baseCost === 0 ? power(s, "zeroCostTax") : 0) +
    (definition.shield && !(s.battle.guardCardsPlayedThisTurn || 0) ? power(s, "firstGuardCostUp") : 0) -
    (card.costReduction || 0)
  );
}
export function cardPlayBlockReason(s, card) {
  if (s?.phase !== "battle" || !s.battle) return "전투 중에만 사용 가능";
  const battle = s.battle;
  if (battle.enemyPhase) return "적 행동 진행 중";
  if (battle.pendingDiscard) return "먼저 버릴 카드 선택";
  if (!card) return "카드 정보 없음";
  if (card.traitLocked === battle.turn) return "특성 효과로 이번 턴 잠김";
  if (card.id === "impurity") {
    const requiredAp = cost(s, card);
    return battle.ap < requiredAp ? `${requiredAp} AP 필요 · 현재 ${battle.ap}` : null;
  }
  const definition = CARDS[card.id];
  if (!definition) return "카드 정보 없음";
  if (definition.category === "heal" && s.hp >= s.maxHp) return "체력이 이미 최대";
  const requiredAbsorb = cardDefinition(card).requiredAbsorb || 0;
  if (battle.absorb < requiredAbsorb)
    return `흡수 ${requiredAbsorb} 필요 · 현재 ${battle.absorb}`;
  if (S.cardRestricted(s, { ...definition, id: card.id })) {
    if (S.restricted(s, "allActions")) return "기절 · 행동 불가";
    if (
      S.restricted(s, "attacks") &&
      (definition.attackPattern || definition.attack || definition.burst || definition.weight)
    )
      return "무장 해제 · 공격 카드 사용 불가";
    return "봉인 · 이 카드 사용 불가";
  }
  const requiredAp = cost(s, card);
  return battle.ap < requiredAp ? `${requiredAp} AP 필요 · 현재 ${battle.ap}` : null;
}
export function canPlay(s, card) {
  return cardPlayBlockReason(s, card) === null;
}
export function cardDiscardBlockReason(s, card) {
  if (!card) return "카드 정보 없음";
  if (card.id === "impurity" && S.restricted(s, "impurityDiscard"))
    return "불순물 고정 · 버리기 불가";
  return null;
}
export function canDiscard(s, card) {
  return cardDiscardBlockReason(s, card) === null;
}
export function discardFromHand(s, index, meta = freshMeta()) {
  const b = s?.battle;
  if (s?.phase !== "battle" || b.enemyPhase || !b.pendingDiscard || !canDiscard(s, b.hand[index])) return false;
  const [discarded] = b.hand.splice(index, 1);
  b.discard.push(discarded);
  b.discardedThisTurn = (b.discardedThisTurn || 0) + 1;
  if (b.discardedThisTurn === 1) gainPlayerShield(s, power(s, "firstDiscardShield"));
  gainAbsorb(s, power(s, "discardAbsorb"));
  hurtPlayer(s, power(s, "discardSelfDamage"), { direct: false, bypassShield: true });
  if (b.discardedThisTurn >= 3 && power(s, "discardDraw")) draw(s, power(s, "discardDraw"));
  const discardEffect = b.discardEffects?.shift();
  const definition = CARDS[discarded.id];
  if (discardEffect?.burn && (definition.attack || definition.burst || definition.weight))
    for (const target of discardEffect.targets) {
      const enemy = b.enemies[target];
      if (enemy?.hp > 0) applyBattleStatus(s, "enemy", "burning", discardEffect.burn, enemy);
    }
  b.pendingDiscard--;
  if (!b.hand.some((held) => canDiscard(s, held))) b.pendingDiscard = 0;
  if (!b.pendingDiscard) b.discardEffects = [];
  if (discardEffect?.costDamage && definition.cost > 0) {
    for (const target of discardEffect.targets) {
      const enemy = b.enemies[target];
      if (enemy?.hp > 0) damage(s, definition.cost * discardEffect.costDamage, { attackPattern: "nonContact", targetEnemy: enemy });
    }
    milestones(s, meta);
    if (!livingEnemies(b).length) victory(s, meta);
  }
  return true;
}
export function dealEnemyDamage(s, enemy, amount, options = {}) {
  return damage(s, amount, { ...options, targetEnemy: enemy });
}
export function drawCards(s, amount, turnStart = false) {
  return draw(s, amount, turnStart);
}
export function play(s, index, meta, hooks = null) {
  if (s.phase !== "battle") return false;
  attachEnemyAliases(s.battle);
  const b = s.battle,
    card = b.hand[index];
  if (!canPlay(s, card)) return false;
  const handBeforePlay = b.hand.length,
    apBeforePlay = b.ap;
  if (card.id === "impurity") {
    const paidCost = cost(s, card);
    b.ap -= paidCost;
    b.hand.splice(index, 1);
    b.exhaust ??= [];
    b.exhaust.push(card);
    const handAfterUse = b.hand.length,
      apAfterUse = b.ap;
    draw(s, 1);
    log(
      s,
      `플레이어 · [카드 사용] 불순물 · 정제 · AP ${apBeforePlay}→${apAfterUse} (비용 ${paidCost}) · 손패 ${handBeforePlay}→${handAfterUse}→${b.hand.length} · 대상 플레이어 · 전투 중 소멸`,
    );
    if (!s.hp) finish(s, meta);
    return true;
  }
  const definition = cardDefinition(card),
    paidCost = cost(s, card),
    cardType = isAttackCard(definition)
      ? `${cardPattern(definition) === "nonContact" ? "비접촉" : "접촉"} 공격`
      : definition.shield
        ? "방어"
        : definition.absorb
          ? "흡수"
          : definition.heal || definition.category === "heal"
            ? "회복"
            : "효과",
    cardTarget = definition.target === "all"
      ? `적 전체 (${livingEnemies(b).length})`
      : definition.target === "random"
        ? "무작위 적"
        : definition.target === "self"
          ? "플레이어"
          : isAttackCard(definition) || definition.target === "enemy"
            ? selectedEnemy(b)?.name || "대상 없음"
            : "플레이어";
  b._logActor = `플레이어 [${definition.name}]`;
  b.ap -= paidCost;
  b.hand.splice(index, 1);
  b.discard.push(card);
  const handAfterUse = b.hand.length,
    apAfterUse = b.ap,
    logCardUse = (result = "해결") => {
      const apFlow = `${apBeforePlay}→${apAfterUse}${b.ap !== apAfterUse ? `→${b.ap}` : ""}`,
        handFlow = `${handBeforePlay}→${handAfterUse}${b.hand.length !== handAfterUse ? `→${b.hand.length}` : ""}`;
      log(
        s,
        `플레이어 · [카드 사용] ${definition.name} · ${cardType} · AP ${apFlow} (비용 ${paidCost}) · 손패 ${handFlow} · 대상 ${cardTarget} · ${result}`,
      );
    };
  const statusCard = { ...definition, id: card.id },
    confusionChance = S.confusionFailureChance(s, statusCard);
  if (confusionChance > 0 && random(s) < confusionChance) {
    const selfDamage = Math.max(3, Math.round(s.maxHp * 0.05));
    s._controlFeedback = {
      statusId: "confusion",
      title: "혼란!",
      detail: "카드 사용 실패",
    };
    hurtPlayer(s, selfDamage, {
      direct: false,
      bypassShield: true,
      statusId: "confusion",
    });
    log(s, `${CARDS[card.id].name} · 혼란으로 카드 효과 전체 취소 · 자해 ${selfDamage}`);
    logCardUse("혼란으로 실패");
    S.consumeCardStatuses(s);
    if (!s.hp) finish(s, meta);
    delete b._logActor;
    return true;
  }
  const interferenceChance = S.interferenceFailureChance(s),
    interferenceTriggered = interferenceChance > 0 && random(s) < interferenceChance;
  if (interferenceTriggered) {
    b.suppressCardSecondaryEffects = true;
    const failedEffect = Object.keys(definition.applyEnemy || {}).length
      ? `${S.STATUS_DEFINITIONS[Object.keys(definition.applyEnemy)[0]]?.name || "상태이상"} 부여 실패`
      : Object.keys(definition.applyPlayer || {}).length
        ? `${S.STATUS_DEFINITIONS[Object.keys(definition.applyPlayer)[0]]?.name || "상태이상"} 부여 실패`
        : definition.draw
          ? "카드 드로우 실패"
          : definition.refundOnKill || definition.refundOnBreak || definition.refundAbsorbThreshold
            ? "AP 환급 실패"
            : "부가효과 실패";
    s._controlFeedback = { statusId: "interference", title: "방해!", detail: failedEffect };
    log(s, `${CARDS[card.id].name} · 방해 발동 · ${failedEffect}`);
  }
  const hpBeforeCard = s.hp,
    shieldBeforeCard = b.shield,
    absorbBeforeCard = b.absorb,
    effectHookContext = {
      state: s,
      battle: b,
      card,
      definition,
      paidCost,
      interferenceTriggered,
      meta,
    };
  let effectHookState = null,
    targets = [];
  try {
    effectHookState = hooks?.beforeEffect?.(effectHookContext) ?? null;
    targets = effect(s, card);
    hooks?.afterEffect?.({ ...effectHookContext, targets, hookState: effectHookState });
  } finally {
    hooks?.cleanupEffect?.({ ...effectHookContext, targets, hookState: effectHookState });
  }
  if (s.hp > hpBeforeCard) log(s, `플레이어 · 체력 +${s.hp - hpBeforeCard}`);
  if (b.shield > shieldBeforeCard) log(s, `플레이어 · 방어막 +${b.shield - shieldBeforeCard}`);
  if (b.absorb > absorbBeforeCard) log(s, `플레이어 · 흡수 +${b.absorb - absorbBeforeCard}`);
  S.consumeCardStatuses(s);
  if (!interferenceTriggered) applyCardStatuses(s, cardDefinition(card), targets);
  delete b.suppressCardSecondaryEffects;
  delete b._logActor;
  if (
    isAttackCard(definition) && cardPattern(definition) === "contact"
  ) {
    b.contactCardsPlayedThisTurn = (b.contactCardsPlayedThisTurn || 0) + 1;
    b.contactCardsPlayedThisBattle = (b.contactCardsPlayedThisBattle || 0) + 1;
  }
  if (isAttackCard(definition) && cardPattern(definition) === "nonContact")
    b.nonContactCardsPlayedThisTurn = (b.nonContactCardsPlayedThisTurn || 0) + 1;
  if (definition.absorb) b.absorbCardsPlayedThisTurn = (b.absorbCardsPlayedThisTurn || 0) + 1;
  if (definition.shield) b.guardCardsPlayedThisTurn = (b.guardCardsPlayedThisTurn || 0) + 1;
  b.cardsPlayedThisTurn = (b.cardsPlayedThisTurn || 0) + 1;
  if (definition.oil) b.oilCardsPlayedThisTurn = (b.oilCardsPlayedThisTurn || 0) + 1;
  if (definition.oil) b.firstOilFreeReady = false;
  if (isAttackCard(definition)) b.attackCardsPlayedThisBattle = (b.attackCardsPlayedThisBattle || 0) + 1;
  b.cardsPlayedDefinitions ??= [];
  b.cardsPlayedDefinitions.push({ ...definition, id: card.id });
  if ((card.note || definition.note) === "top") b.topPlayedThisTurn = true;
  if (definition.cost === 0) b.nextAttackBonus += power(s, "zeroCostBonus");
  if (isAttackCard(definition)) b.nextAttackBonus = 0;
  hurtPlayer(s, power(s, "cardHpCost"), { direct: false, bypassShield: true });
  if (b.cardsPlayedThisTurn === 3 && power(s, "thirdCardZeroAp")) b.ap = 0;
  if (b.cardsPlayedThisTurn % 2 === 0) b.ap = Math.max(0, b.ap - power(s, "everyTwoCardsApLoss"));
  if (b.cardsPlayedThisTurn === 4 && power(s, "fourthCardRefund") && !b.traitRefunds.fourthCard) {
    gainCurrentAp(s, power(s, "fourthCardRefund")); draw(s, 1); b.traitRefunds.fourthCard = true;
  }
  if (paidCost > 0 && random(s) < power(s, "chanceFullApRefund")) gainCurrentAp(s, paidCost);
  if (definition.absorb && b.absorbCardsPlayedThisTurn >= 3 && !b.traitRefunds.absorbChain) {
    gainCurrentAp(s, power(s, "absorbChainRefund")); b.traitRefunds.absorbChain = true;
  }
  if (cardPattern(definition) === "contact" && b.contactCardsPlayedThisTurn >= 2)
    applyBattleStatus(s, "player", "thorns", power(s, "contactThorns"));
  if (cardPattern(definition) === "contact" && paidCost >= 2) gainPlayerShield(s, power(s, "contactShield"));
  if (isAttackCard(definition) && paidCost >= 2 && power(s, "reduceHighCostCard") && !b.traitRefunds.costReduce) {
    const candidates = b.hand.filter((held) => (CARDS[held.id]?.cost || 0) > 0);
    if (candidates.length) {
      const reduced = pick(s, candidates);
      reduced.costReduction = (reduced.costReduction || 0) + power(s, "reduceHighCostCard");
    }
    b.traitRefunds.costReduce = true;
  }
  if (b.cardsPlayedThisTurn > 3) b.nextTurnApLoss = power(s, "heavyTurnNextApLoss");
  if (definition.oil && b.oilCardsPlayedThisTurn % 2 === 0 && power(s, "oilSearchAndDiscount")) {
    const findNonContact = (pile) => pile.findIndex((held) => cardPattern(CARDS[held.id] || {}) === "nonContact");
    let pile = b.draw, foundIndex = findNonContact(pile);
    if (foundIndex < 0) { pile = b.discard; foundIndex = findNonContact(pile); }
    if (foundIndex >= 0 && b.hand.length < handLimit(s)) {
      const [found] = pile.splice(foundIndex, 1);
      found.costReduction = (found.costReduction || 0) + power(s, "oilSearchAndDiscount");
      b.hand.push(found);
    }
  }
  if (definition.oil && random(s) < Math.min(1, power(s, "oilDiscardChance"))) {
    const candidates = b.hand.filter((held) => canDiscard(s, held));
    if (candidates.length) {
      const discarded = pick(s, candidates);
      b.hand.splice(b.hand.indexOf(discarded), 1);
      b.discard.push(discarded);
      b.discardedThisTurn++;
      if (b.discardedThisTurn === 1) gainPlayerShield(s, power(s, "firstDiscardShield"));
      gainAbsorb(s, power(s, "discardAbsorb"));
      hurtPlayer(s, power(s, "discardSelfDamage"), { direct: false, bypassShield: true });
    }
  }
  triggerStatusEvent(s, s, "afterAction", true);
  logCardUse();
  if (!s.hp) {
    finish(s, meta);
    return true;
  }
  if (!S.sealBlocksNoteGain(s))
    b.notes.push({ ...card, note: card.note || CARDS[card.id].note });
  const chain = b.notes.slice(-3);
  if (!S.sealBlocksHarmony(s) && chain.length === 3 && (
    power(s, "anyThreeCardsHarmony") ||
    chain.map((played) => played.note).join(",") === BASE_HARMONY_EFFECT.sequence.join(",")
  )) {
    triggerHarmony(s, chain);
    if (
      !S.restricted(s, "passives") &&
      s.inventory.some((id) => ITEMS[id]?.effect === "pyramid")
    ) {
      log(s, "✦ 3단 노트 완성! 앞선 카드 2장 무료 재발동");
      gainPlayerShield(s, power(s, "pyramid"));
      for (const echo of chain.slice(0, 2)) {
        b.echoCount++;
        effect(
          s,
          echo,
          Math.min(10, Math.pow(Math.max(1, power(s, "echo")), b.echoCount)),
        );
      }
    }
    b.notes = [];
  }
  milestones(s, meta);
  if (!livingEnemies(b).length) victory(s, meta);
  return true;
}
function legacyEndTurn(s, meta) {
  if (s.phase !== "battle") return;
  attachEnemyAliases(s.battle);
  const b = s.battle,
    playerStunned = S.stacks(s, "stun") > 0;
  decayAbsorb(s);
  if (!playerStunned) gainAbsorb(s, b.ap * power(s, "absorb"));
  milestones(s, meta);
  if (playerStunned) {
    S.removeStatus(s, "stun");
    s.stunResistance = 1;
    log(s, "플레이어 · 기절로 행동 취소");
  } else if (s.stunResistance) s.stunResistance--;
  for (const enemy of b.enemies) {
    if (enemy.hp <= 0 || !s.hp) continue;
    triggerRegeneration(s, enemy, false);
    const stunned =
      S.stacks(enemy, "stun") || S.restricted(enemy, "allActions");
    if (stunned) {
      S.removeStatus(enemy, "stun");
      if (enemy.isElite || enemy.isBoss) enemy.stunResistance = 1;
      log(s, `${enemy.name} · 기절로 행동 취소`);
    } else if (
      enemy.intent.type === "attack" &&
      S.restricted(enemy, "attacks")
    ) {
      log(s, `${enemy.name} · 무장 해제로 공격 취소`);
      if (enemy.stunResistance) enemy.stunResistance--;
    } else if (enemy.intent.type === "attack") {
      const before = b.shield;
      const result = hurtPlayer(s, enemy.intent.value, {
        attackPattern: enemy.intent.attackPattern || "contact",
        sourceEnemy: enemy,
      });
      enemy.lastAction = result;
      b.lastEnemyAction = result;
      log(
        s,
        `${enemy.name} ${(enemy.intent.attackPattern || "contact") === "contact" ? "접촉" : "비접촉"} 공격 ${result.damage + result.blocked} · 방어 ${result.blocked}`,
      );
      if (before >= 50 && power(s, "reflect"))
        damage(s, result.blocked * power(s, "reflect"), { targetEnemy: enemy });
      if (enemy.stunResistance) enemy.stunResistance--;
    } else if (enemy.intent.type === "guard") {
      const gained = S.shieldGain(enemy.intent.value, enemy);
      enemy.shield += gained;
      log(s, `${enemy.name} 방어막 +${gained}`);
      if (enemy.stunResistance) enemy.stunResistance--;
    } else {
      for (let i = 0; i < enemy.intent.value; i++)
        b.discard.push({ id: "impurity", level: 0 });
      log(s, `${enemy.name} 불순물 ${enemy.intent.value}장 주입`);
      if (enemy.stunResistance) enemy.stunResistance--;
    }
    if (enemy.hp) triggerStatusEvent(s, enemy, "afterAction", false);
  }
  triggerStatusEvent(s, s, "turnEnd", true);
  if (S.stacks(s, "poison")) {
    const poison = S.stacks(s, "poison");
    hurtPlayer(s, poison, {
      direct: false,
      bypassShield: true,
      statusId: "poison",
    });
    S.removeStatus(s, "poison", 1);
    log(s, `중독 ${poison} 피해`);
  }
  if (!s.hp) {
    finish(s, meta);
    return;
  }
  for (const enemy of b.enemies) {
    if (enemy.hp <= 0) continue;
    triggerStatusEvent(s, enemy, "turnEnd", false);
    if (S.stacks(enemy, "poison")) {
      const poison = S.stacks(enemy, "poison");
      damage(s, poison, {
        direct: false,
        bypassShield: true,
        statusId: "poison",
        targetEnemy: enemy,
      });
      S.removeStatus(enemy, "poison", 1);
      log(s, `${enemy.name} 중독 ${poison} 피해`);
    }
  }
  S.decayStatuses(s);
  S.tickDurations(s, "turnEnd");
  for (const enemy of b.enemies) {
    S.decayStatuses(enemy);
    S.tickDurations(enemy, "turnEnd");
    S.tickDurations(enemy, "turnStart");
  }
  if (!s.hp) {
    finish(s, meta);
    return;
  }
  if (!livingEnemies(b).length) {
    victory(s, meta);
    return;
  }
  startTurn(s, meta);
}

export function executePlayerTurnEnd(s, meta) {
  if (s.phase !== "battle" || s.battle.enemyPhase || s.battle.pendingDiscard) return false;
  attachEnemyAliases(s.battle);
  const b = s.battle,
    playerStunned = S.stacks(s, "stun") > 0;
  b.enemyPhase = true;
  b.actingEnemy = null;
  b.completedEnemies = [];
  const voidSet = HIDDEN_SYNERGIES.supercritical_void;
  if (hasSynergy(s, voidSet.id) && b.absorb >= voidSet.threshold) {
    b.absorb = 0;
    for (const enemy of livingEnemies(b)) {
      damage(s, voidSet.value, { targetEnemy: enemy, direct: false, bypassShield: true });
      if (enemy.hp > 0) applyBattleStatus(s, "enemy", "stun", 1, enemy);
    }
    log(s, "세트 효과 [초임계 보이드 특이점]: 흡수 폭발 · 적 전체 관통 피해 80 · 행동 취소");
  }
  if (b.shield >= 20 && power(s, "endTurnShieldAttack")) {
    const targets = livingEnemies(b);
    if (targets.length) damage(s, b.shield * power(s, "endTurnShieldAttack"), { targetEnemy: pick(s, targets) });
  }
  if (b.contactCardsPlayedThisTurn >= 2) applyBattleStatus(s, "player", "thorns", power(s, "contactThorns"));
  if (b.absorb >= 25) gainPlayerShield(s, power(s, "absorbSpillShield"));
  decayAbsorb(s);
  if (!playerStunned) gainAbsorb(s, b.ap * powers(s, "absorb", "absorbOnEnd"));
  if (power(s, "endTurnAbsorbZeroReset")) b.absorb = 0;
  for (let i = 0; i < power(s, "endTurnAddImpurity"); i++) b.discard.push({ id: "impurity", level: 0 });
  if (!b.hand.length) gainPlayerShield(s, power(s, "turnTimerIndicator"));
  if (power(s, "extraTurnOncePerBattle") && !b.extraTurnUsed) {
    b.extraTurnUsed = true;
    b.enemyPhase = false;
    startTurn(s, meta);
    return true;
  }
  milestones(s, meta);
  if (playerStunned) {
    S.removeStatus(s, "stun");
    s.stunResistance = 1;
    log(s, "플레이어 · 기절로 행동 취소");
  } else if (s.stunResistance) s.stunResistance--;
  return true;
}

function applyIntentStatusMap(s, target, statuses, targetEnemy = null) {
  const appliedStatuses = [];
  for (const [id, amount] of Object.entries(statuses || {})) {
    const applied = applyBattleStatus(s, target, id, amount, targetEnemy);
    if (target === "player") S.deferTurnEnd(s, id);
    if (
      target === "player" &&
      S.STATUS_DEFINITIONS[id]?.kind === "debuff" &&
      (applied > 0 || S.stacks(s, id) > 0)
    )
      appliedStatuses.push(id);
  }
  return appliedStatuses;
}

function executeIntentExtras(s, enemy) {
  const intent = enemy.intent;
  if (intent.guard) {
    const gained = S.shieldGain(intent.guard, enemy);
    enemy.shield += gained;
    log(s, `${enemy.name} 방어막 +${gained}`);
  }
  if (intent.allyGuard) {
    for (const ally of livingEnemies(s.battle)) {
      const gained = S.shieldGain(intent.allyGuard, ally);
      ally.shield += gained;
    }
    log(s, `${enemy.name} 아군 전체 방어막 +${intent.allyGuard}`);
  }
  const playerDebuffs = applyIntentStatusMap(s, "player", intent.applyPlayer);
  applyIntentStatusMap(s, "enemy", intent.applySelf, enemy);
  for (const ally of livingEnemies(s.battle))
    applyIntentStatusMap(s, "enemy", intent.applyAllies, ally);
  const pollution = Math.max(0, Math.floor(intent.pollute || 0));
  for (let i = 0; i < pollution; i++)
    s.battle.discard.push({ id: "impurity", level: 0 });
  if (pollution) log(s, `${enemy.name} 불순물 ${pollution}장 주입`);
  return playerDebuffs;
}

export function executeSingleEnemyAction(s, enemyIndex, meta) {
  if (s.phase !== "battle" || !s.battle.enemyPhase) return null;
  const b = s.battle,
    enemy = b.enemies[enemyIndex];
  if (!enemy || enemy.hp <= 0 || !s.hp)
    return { enemyIndex, type: "dead", skipped: true };
  b.actingEnemy = enemyIndex;
  b._logActor = enemy.name;
  const beforeHp = s.hp,
    beforeShield = b.shield,
    beforeEnemyShield = enemy.shield,
    beforeDiscard = b.discard.length;
  triggerRegeneration(s, enemy, false);
  const stunned = S.stacks(enemy, "stun") || S.restricted(enemy, "allActions");
  let type = enemy.intent.type,
    skipped = false;
  if (stunned) {
    type = "stun";
    skipped = true;
    S.removeStatus(enemy, "stun");
    if (enemy.isElite || enemy.isBoss) enemy.stunResistance = 1;
    log(s, `${enemy.name} · 기절로 행동 취소`);
  } else if (enemy.intent.type === "attack" && S.restricted(enemy, "attacks")) {
    type = "disarm";
    skipped = true;
    log(s, `${enemy.name} · 무장 해제로 공격 취소`);
    if (enemy.stunResistance) enemy.stunResistance--;
  } else if (enemy.intent.type === "attack") {
    const hits = Math.max(1, Math.floor(enemy.intent.hits || 1));
    let result = { damage: 0, blocked: 0 };
    const strikes = [];
    for (let hit = 0; hit < hits && s.hp; hit++) {
      const strike = hurtPlayer(s, enemy.intent.value, {
        attackPattern: enemy.intent.attackPattern || "contact",
        sourceEnemy: enemy,
      });
      strikes.push(strike);
      result.damage += strike.damage;
      result.blocked += strike.blocked;
    }
    result.hits = strikes;
    enemy.lastAction = result;
    b.lastEnemyAction = result;
    const patternLabel = (enemy.intent.attackPattern || "contact") === "contact"
        ? "접촉"
        : "비접촉",
      actionName = enemy.intent.name || enemy.intent.label || `${patternLabel} 공격`;
    log(
      s,
      `${enemy.name} · [적 행동] ${actionName}${hits > 1 ? ` ×${hits}` : ""} · 형태 ${patternLabel} · 공격력 ${enemy.intent.value}${hits > 1 ? ` × ${hits}` : ""} · 방어막 ${beforeShield}→${b.shield} (방어 ${result.blocked}) · 체력 ${beforeHp}→${s.hp} (실피해 ${result.damage})`,
    );
    if (beforeShield >= 50 && power(s, "reflect"))
      damage(s, result.blocked * power(s, "reflect"), { targetEnemy: enemy });
    if (enemy.stunResistance) enemy.stunResistance--;
  } else if (enemy.intent.type === "guard") {
    const gained = S.shieldGain(enemy.intent.value, enemy);
    enemy.shield += gained;
    log(s, `${enemy.name} 방어막 +${gained}`);
    if (enemy.stunResistance) enemy.stunResistance--;
  } else if (enemy.intent.type === "pollute") {
    for (let i = 0; i < enemy.intent.value; i++)
      b.discard.push({ id: "impurity", level: 0 });
    log(s, `${enemy.name} 불순물 ${enemy.intent.value}장 주입`);
    if (enemy.stunResistance) enemy.stunResistance--;
  } else if (enemy.intent.type === "debuff") {
    log(s, `${enemy.name} 상태이상 부여`);
    if (enemy.stunResistance) enemy.stunResistance--;
  }
  const playerDebuffs = skipped ? [] : executeIntentExtras(s, enemy);
  if (enemy.hp) triggerStatusEvent(s, enemy, "afterAction", false);
  b.completedEnemies.push(enemyIndex);
  b.actingEnemy = null;
  const outcome = {
    enemyIndex,
    enemyName: enemy.name,
    type,
    skipped,
    attackPattern:
      type === "attack" ? enemy.intent.attackPattern || "contact" : null,
    damage: Math.max(0, beforeHp - s.hp),
    blocked: Math.max(0, beforeShield - b.shield),
    hits: type === "attack" ? enemy.lastAction?.hits || [] : [],
    shieldGained: Math.max(0, enemy.shield - beforeEnemyShield),
    impurities: Math.max(0, b.discard.length - beforeDiscard),
    playerDebuffs,
    enemyDied: enemy.hp <= 0,
    playerDied: s.hp <= 0,
  };
  delete b._logActor;
  if (!s.hp) finish(s, meta);
  return outcome;
}

export function executeRoundEnd(s, meta) {
  if (s.phase !== "battle" || !s.battle.enemyPhase) return false;
  const b = s.battle;
  if (hasSynergy(s, "morning_chamomile")) {
    gainPlayerShield(s, HIDDEN_SYNERGIES.morning_chamomile.shield);
    log(s, "세트 효과 [아침 카모마일 온기]: 턴 종료 방어막 +4");
  }
  if (b.turn >= power(s, "fiveTurnsDeathLimit") && power(s, "fiveTurnsDeathLimit")) s.hp = 0;
  if (power(s, "enemyCardMirror") && b.cardsPlayedDefinitions?.length) {
    const strongest = [...b.cardsPlayedDefinitions].sort((a, z) => (z.attack || z.burst || z.weight || 0) - (a.attack || a.burst || a.weight || 0))[0];
    const mirrored = strongest.attack || (strongest.burst ? Math.ceil(b.absorb * 3.2) : strongest.weight ? b.shield : 0);
    if (mirrored > 0) hurtPlayer(s, mirrored, { direct: true, bypassShield: Boolean(strongest.bypassShield) });
  }
  b.actingEnemy = null;
  triggerStatusEvent(s, s, "turnEnd", true);
  if (S.stacks(s, "poison")) {
    const poison = S.stacks(s, "poison");
    hurtPlayer(s, poison, {
      direct: false,
      bypassShield: true,
      statusId: "poison",
    });
    S.removeStatus(s, "poison", 1);
    log(s, `중독 ${poison} 피해`);
  }
  if (!s.hp) {
    finish(s, meta);
    return true;
  }
  for (const enemy of b.enemies) {
    if (enemy.hp <= 0) continue;
    triggerStatusEvent(s, enemy, "turnEnd", false);
    const corrosion = S.stacks(enemy, "corrosion");
    if (corrosion && powers(s, "corrosionTickDamage", "corrosionShieldDamage"))
      damage(s, corrosion + powers(s, "corrosionTickDamage", "corrosionShieldDamage"), { targetEnemy: enemy, direct: false, statusId: "corrosion" });
    if (S.stacks(enemy, "burning") && power(s, "consumeBurnEnemyHeal")) {
      S.removeStatus(enemy, "burning", 1);
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + power(s, "consumeBurnEnemyHeal"));
    }
    if (S.stacks(enemy, "poison")) {
      const poison = S.stacks(enemy, "poison");
      damage(s, poison, {
        direct: false,
        bypassShield: true,
        statusId: "poison",
        targetEnemy: enemy,
      });
      S.removeStatus(enemy, "poison", 1);
      log(s, `${enemy.name} 중독 ${poison} 피해`);
    }
  }
  S.decayStatuses(s);
  S.tickDurations(s, "turnEnd");
  for (const enemy of b.enemies) {
    S.decayStatuses(enemy);
    S.tickDurations(enemy, "turnEnd");
    S.tickDurations(enemy, "turnStart");
  }
  b.enemyPhase = false;
  if (s.hp > 0 && b.shield > 0 && b.shieldSurvivalHeal) heal(s, b.shieldSurvivalHeal);
  b.shieldSurvivalHeal = 0;
  b.completedEnemies = [];
  if (!s.hp) finish(s, meta);
  else if (!livingEnemies(b).length) victory(s, meta);
  else startTurn(s, meta);
  return true;
}

export function endTurn(s, meta) {
  if (!executePlayerTurnEnd(s, meta)) return false;
  for (let index = 0; index < s.battle.enemies.length; index++) {
    executeSingleEnemyAction(s, index, meta);
    if (s.phase !== "battle") return true;
  }
  executeRoundEnd(s, meta);
  return true;
}

export function cardMaxCopies(card) {
  const definition = typeof card === "string" ? CARDS[card] : card;
  return definition?.maxCopies ?? ({ 1: 4, 2: 2, 3: 2, 4: 1 }[definition?.tier] || 1);
}
export function cardMaxUpgrade(card) {
  const definition = typeof card === "string" ? CARDS[card] : CARDS[card?.id] || card;
  return definition?.maxUpgrade ?? ({ 1: 3, 2: 2, 3: 2, 4: 1 }[definition?.tier] || 1);
}
function cardCount(s, id, excludedIndex = -1) {
  return s.deck.reduce((count, card, index) => count + (index !== excludedIndex && card.id === id ? 1 : 0), 0);
}
export function cardOptions(s, meta = { unlocked: [] }, guaranteeHighTier = false) {
  const profile = REWARD_PROFILES.combat,
    excluded = new Set(),
    chosen = [];
  if (guaranteeHighTier) {
    const pool = eligibleRewardCards(s, meta, null, excluded).filter((card) => card.tier >= 3);
    if (pool.length) {
      const card = pick(s, pool);
      chosen.push(card.id);
      excluded.add(`card:${card.id}`);
    }
  }
  while (chosen.length < 3) {
    const option = rollCardRewardOption(s, meta, profile, excluded);
    if (!option || option.type !== "card") break;
    chosen.push(option.id);
    excluded.add(`card:${option.id}`);
  }
  return chosen;
}

function nextRewardOfferId(s, source) {
  s.rewardOfferSequence = Math.max(0, Number(s.rewardOfferSequence) || 0) + 1;
  return `reward:${s.seed}:${s.node}:${s.rewardOfferSequence}:${source}`;
}

export const REWARD_EXPOSURE_PITY = Object.freeze({
  traitStartNode: 6,
  relicStartNode: 8,
  lowAugmentStartNode: 9,
  lowAugmentThreshold: 2,
  traitMultiplier: 1.15,
  relicMultiplier: 1.1,
  lowAugmentMultiplier: 1.1,
  maxMultiplier: 1.25,
});

function freshRewardExposure(loop = 0) {
  return {
    act: Math.max(0, Math.floor(Number(loop) || 0)),
    traitOffersSeen: 0,
    relicOffersSeen: 0,
    statOffersSeen: 0,
    augmentOffersSeen: 0,
  };
}

function ensureRewardExposure(s) {
  const act = Math.max(0, Math.floor(Number(s?.loop) || 0)),
    current = s?.rewardExposure;
  if (!current || Number(current.act) !== act) {
    if (s) s.rewardExposure = freshRewardExposure(act);
    return s?.rewardExposure || freshRewardExposure(act);
  }
  for (const key of [
    "traitOffersSeen",
    "relicOffersSeen",
    "statOffersSeen",
    "augmentOffersSeen",
  ])
    current[key] = Math.max(0, Math.floor(Number(current[key]) || 0));
  return current;
}

export function rewardExposure(s) {
  return { ...ensureRewardExposure(s) };
}

export function rewardExposurePity(s) {
  const exposure = ensureRewardExposure(s),
    node = Math.max(0, Math.floor(Number(s?.node) || 0)),
    config = REWARD_EXPOSURE_PITY;
  let trait = 1,
    relic = 1;
  if (node >= config.traitStartNode && exposure.traitOffersSeen === 0)
    trait *= config.traitMultiplier;
  if (node >= config.relicStartNode && exposure.relicOffersSeen === 0)
    relic *= config.relicMultiplier;
  if (
    node >= config.lowAugmentStartNode &&
    exposure.augmentOffersSeen < config.lowAugmentThreshold
  ) {
    trait *= config.lowAugmentMultiplier;
    relic *= config.lowAugmentMultiplier;
  }
  return {
    trait: Number(Math.min(config.maxMultiplier, trait).toFixed(3)),
    relic: Number(Math.min(config.maxMultiplier, relic).toFixed(3)),
  };
}

function applyExposurePity(s, config) {
  if (
    config?.type !== "item" ||
    !config.kindWeights ||
    !["golden", "elite"].includes(config.source)
  )
    return config;
  const pity = rewardExposurePity(s),
    kindWeights = { ...config.kindWeights };
  if (Number.isFinite(kindWeights.trait))
    kindWeights.trait *= pity.trait;
  if (Number.isFinite(kindWeights.relic))
    kindWeights.relic *= pity.relic;
  return { ...config, kindWeights };
}

function recordRewardExposure(s, offer) {
  if (!offer || offer.metadata?.rewardExposureRecorded) return offer;
  const exposure = ensureRewardExposure(s),
    itemOptions = (offer.options || []).filter(
      (option) =>
        option?.type === "item" &&
        ["stat", "trait", "relic"].includes(option.kind),
    ),
    kinds = new Set(itemOptions.map((option) => option.kind));
  if (kinds.has("stat")) exposure.statOffersSeen += 1;
  if (kinds.has("trait")) exposure.traitOffersSeen += 1;
  if (kinds.has("relic")) exposure.relicOffersSeen += 1;
  if (kinds.has("trait") || kinds.has("relic"))
    exposure.augmentOffersSeen += 1;
  offer.metadata ??= {};
  offer.metadata.rewardExposureRecorded = true;
  return offer;
}

function rewardProfileWithModifiers(s, profile, overrides = {}, applyModifiers = true) {
  const base = { ...profile, ...overrides };
  if (!applyModifiers) return base;
  return applyRewardModifiers(
    base,
    collectRewardModifiers(s.inventory, ITEMS, base.source),
  );
}

function createProfileOffer(s, meta, profile, overrides = {}, applyModifiers = true) {
  const modified = rewardProfileWithModifiers(s, profile, overrides, applyModifiers),
    config = applyExposurePity(s, modified),
    id = nextRewardOfferId(s, config.source),
    offer = createRewardOffer(
      config,
      (index, excludedKeys) => rollProfileOption(s, meta, config, excludedKeys, index),
      id,
    );
  return recordRewardExposure(s, offer);
}

function battleCardRewardPlan(s) {
  const profile = REWARD_PROFILES.combat,
    modifiers = collectRewardModifiers(s.inventory, ITEMS, profile.source),
    optionConfig = applyRewardModifiers(
      { ...profile, pickCount: 1 },
      modifiers,
    ),
    groupDelta = modifiers.reduce(
      (total, modifier) =>
        total + (Number.isFinite(modifier?.pickCount) ? Math.trunc(modifier.pickCount) : 0),
      0,
    );
  return {
    totalGroups: Math.max(0, 1 + groupDelta),
    generatedGroups: 0,
    optionCount: optionConfig.optionCount,
  };
}

function createBattleCardRewardOffer(s, meta, plan, groupIndex) {
  return createProfileOffer(
    s,
    meta,
    REWARD_PROFILES.combat,
    {
      source: REWARD_PROFILES.combat.source,
      rewardPool: REWARD_PROFILES.combat.rewardPool,
      optionCount: Math.max(0, Math.floor(Number(plan.optionCount) || 0)),
      pickCount: 1,
      metadata: {
        battleCardReward: true,
        groupIndex,
        groupTotal: Math.max(0, Math.floor(Number(plan.totalGroups) || 0)),
      },
    },
    false,
  );
}

function appendNextBattleCardRewardOffer(s, meta = null) {
  const reward = s.reward,
    plan = reward?.metadata?.battleCardReward;
  if (!reward || !plan || typeof plan !== "object") return null;
  const totalGroups = Math.max(0, Math.floor(Number(plan.totalGroups) || 0));
  let generatedGroups = Math.max(0, Math.floor(Number(plan.generatedGroups) || 0));
  while (generatedGroups < totalGroups) {
    const groupIndex = generatedGroups + 1,
      offer = createBattleCardRewardOffer(s, meta, plan, groupIndex);
    generatedGroups = groupIndex;
    plan.generatedGroups = generatedGroups;
    reward.groups.push(offer);
    const active = activeRewardOffer(reward);
    if (active) return active;
  }
  return null;
}

function createFixedItemOffer(s, itemId, source, metadata = {}, applyModifiers = false) {
  const item = ITEMS[itemId];
  if (!item) return null;
  const profile = rewardProfileWithModifiers(s, REWARD_PROFILES.signatureBoss, {
      source,
      rewardPool: metadata.rewardPool || "fixedItem",
      metadata,
    }, applyModifiers),
    id = nextRewardOfferId(s, source);
  return recordRewardExposure(
    s,
    createRewardOffer(
      profile,
      () => ({ type: "item", id: item.id, kind: item.kind, tier: item.tier }),
      id,
    ),
  );
}

function syncRewardCompatibility(s) {
  const reward = s.reward;
  if (!reward) return;
  const offer = activeRewardOffer(reward),
    options = offer?.options?.filter((option) => !option.claimed) || [];
  reward.cards = options.filter((option) => option.type === "card").map((option) => option.id);
  reward.item = options.find((option) => option.type === "item")?.id || null;
  reward.cardPicksRemaining = offer?.rewardPool === "active" ? offer.remainingPicks : null;
  reward.cardPicksTotal = offer?.rewardPool === "active" ? offer.pickCount : null;
}

function beginRewardPhase(s, {
  room,
  source = room,
  gold = 0,
  goldIncludesBonus = false,
  groups = [],
  metadata = {},
} = {}) {
  s.reward = {
    version: 2,
    room,
    source,
    gold,
    heal: 0,
    goldIncludesBonus,
    groups: groups.filter(Boolean),
    activeGroupIndex: 0,
    metadata: { ...metadata },
  };
  s.phase = "reward";
  syncRewardCompatibility(s);
  if (!activeRewardOffer(s.reward)) completeRewardPhase(s);
  return s.reward;
}

function rewardGold(s, room, victoryReward = false) {
  const table = TABLES[room] || { gold: 0 },
    base = Math.max(0, Number(table.gold) || 0),
    amount = base + power(s, "goldBonus") +
      (victoryReward ? power(s, "roomClearTorch") : power(s, "chestExtraGold")) -
      (victoryReward ? power(s, "victoryGoldPenalty") : 0);
  return { base, gained: gainGold(s, amount) };
}

function award(s, room, meta, victoryReward = false, extraGroups = []) {
  const profile = REWARD_PROFILES[room];
  if (!profile) return false;
  const gold = rewardGold(s, room, victoryReward);
  milestones(s, meta);
  return beginRewardPhase(s, {
    room,
    source: profile.source,
    gold: gold.base,
    groups: [createProfileOffer(s, meta, profile), ...extraGroups],
    metadata: { clearBattle: victoryReward },
  });
}

export function openChest(s, meta) {
  if (s.phase !== "chest") return false;
  const room = roomAt(s);
  if (!REWARD_PROFILES[room]) return false;
  award(s, room, meta);
  return true;
}

function victory(s, meta) {
  meta.defeatedMonsters ??= [];
  for (const enemy of s.battle.enemies)
    if (!meta.defeatedMonsters.includes(enemy.id))
      meta.defeatedMonsters.push(enemy.id);
  meta.achievementStats ??= { totalHarmonies: 0, act2Clears: 0, impuritiesPurified: 0 };
  if (hasSynergy(s, "brass_scales_funnel")) {
    const gained = applyBrassAbsorbConversion(s);
    if (gained > 0)
      log(s, `세트 효과 [황동 저울 깔때기]: 남은 흡수를 ${gained}골드로 환전`);
  }
  const curseCount = s.inventory.filter((id) => ITEMS[id]?.kind === "curse").length;
  if (curseCount >= 2) unlock(meta, "relic_philosophers_mercury_still", s);
  if (s.battle.turn >= 15) unlock(meta, "relic_chronos_sandglass_of_scent", s);
  if (s.hp <= 5) unlock(meta, "relic_primordial_essence_heart", s);
  if (s.deck.length <= 6) unlock(meta, "relic_faded_recipe_scrap", s);
  if (s.battle.turn === 1 && s.battle.nonContactCardsPlayedThisTurn > 0)
    unlock(meta, "trait_prismatic_hyper_beam", s);
  if (s.battle.thornsKill) unlock(meta, "trait_spiked_crystalline_barrier", s);
  s.score += Math.round((100 + s.node * 35) * (1 + s.loop * 0.75));
  heal(s, power(s, "battleEndHeal"), 1);
  if (power(s, "autoUpgradeBasicStrike")) {
    s.relicRoomsCleared = (s.relicRoomsCleared || 0) + 1;
    if (s.relicRoomsCleared % 2 === 0) {
      const basic = s.deck.find((card) => CARDS[card.id]?.tier === 1 && isAttackCard(CARDS[card.id]) && card.level < cardMaxUpgrade(card));
      if (basic) basic.level++;
    }
  }
  const room = roomAt(s);
  if (room === "boss") {
    if (s.loop === 0 && !s.battle.playerHpDamageTaken)
      unlock(meta, "boss_corrupted_perfumer", s);
    if (s.node === 11 && s.loop === 1) {
      meta.achievementStats.act2Clears++;
      if (meta.achievementStats.act2Clears >= 3) unlock(meta, "boss_golden_perfumer", s);
    }
    if (s.node === 11 && s.loop === 2) unlock(meta, "boss_lord_of_harmony", s);
    const defeatedBoss = s.battle.enemies.find((enemy) => enemy.isBoss),
      signature = defeatedBoss?.signatureReward,
      gold = rewardGold(s, "boss", true),
      cardGroup = createProfileOffer(
        s,
        meta,
        REWARD_PROFILES.combat,
        { source: "boss", rewardPool: "active", pickCount: 1 },
        false,
      ),
      primaryGroup = signature && ITEMS[signature]
        ? createFixedItemOffer(s, signature, "signatureBoss", {
            rewardPool: "signature",
            bossId: defeatedBoss.id,
          })
        : createProfileOffer(s, meta, REWARD_PROFILES.boss);
    unlock(meta, "master", s);
    if (defeatedBoss?.unlockId && !meta.unlocked.includes(defeatedBoss.unlockId))
      meta.unlocked.push(defeatedBoss.unlockId);
    milestones(s, meta);
    beginRewardPhase(s, {
      room: "boss",
      source: signature ? "signatureBoss" : "boss",
      gold: gold.base,
      groups: [primaryGroup, cardGroup],
      metadata: { clearBattle: true, bossId: defeatedBoss?.id || null },
    });
    if (s.node === 11) s.won = true;
  } else if (room === "elite") {
    const gold = rewardGold(s, "elite", true),
      augmentGroup = createProfileOffer(s, meta, REWARD_PROFILES.elite),
      cardGroup = createProfileOffer(
        s,
        meta,
        REWARD_PROFILES.combat,
        { source: "elite", rewardPool: "active", pickCount: 1 },
        false,
      );
    milestones(s, meta);
    beginRewardPhase(s, {
      room: "elite",
      source: "elite",
      gold: gold.base,
      groups: [augmentGroup, cardGroup],
      metadata: { clearBattle: true },
    });
  } else {
    const baseGold = Math.round(15 * (.85 + random(s) * .15)),
      gold = Math.max(0, baseGold + power(s, "goldBonus") + power(s, "roomClearTorch") - power(s, "victoryGoldPenalty")),
      battleCardReward = battleCardRewardPlan(s),
      cardGroup = battleCardReward.totalGroups > 0
        ? createBattleCardRewardOffer(s, meta, battleCardReward, 1)
        : null;
    gainGold(s, gold);
    if (cardGroup) battleCardReward.generatedGroups = 1;
    beginRewardPhase(s, {
      room: "battle",
      source: "combat",
      gold,
      goldIncludesBonus: true,
      groups: cardGroup ? [cardGroup] : [],
      metadata: { clearBattle: true, battleCardReward },
    });
  }
}

export function currentRewardOffer(s) {
  return s?.phase === "reward" ? activeRewardOffer(s.reward) : null;
}

function grantRewardOption(s, option, meta = null, replaceIndex = null) {
  if (!option) return false;
  if (option.type === "gold") {
    gainGold(s, option.amount || 0);
    return true;
  }
  if (option.type === "item") return addInventoryItem(s, option.id, meta);
  if (option.type !== "card" || !CARDS[option.id]) return false;
  const excludedIndex = Number.isInteger(replaceIndex) ? replaceIndex : -1;
  if (cardCount(s, option.id, excludedIndex) >= cardMaxCopies(option.id)) return false;
  const card = { id: option.id, level: 0 };
  if (s.deck.length < deckLimit(s)) s.deck.push(card);
  else if (Number.isInteger(replaceIndex) && s.deck[replaceIndex])
    s.deck.splice(replaceIndex, 1, card);
  else return false;
  if (meta) milestones(s, meta);
  if (meta && !s.testMode) {
    meta.discoveredCards ??= [...new Set(STARTING_DECK)];
    if (!meta.discoveredCards.includes(option.id)) meta.discoveredCards.push(option.id);
  }
  return true;
}

function completeRewardPhase(s) {
  const reward = s.reward,
    clearBattle = Boolean(reward?.metadata?.clearBattle);
  s.reward = null;
  if (clearBattle) {
    s.battle = null;
    retainBetweenBattleStatuses(s);
  }
  if (s.node === 11) {
    s.phase = "loop";
    return true;
  }
  s.node++;
  s.phase = "map";
  return true;
}

function progressRewardPhase(s, meta = null) {
  let offer = activeRewardOffer(s.reward);
  if (!offer) offer = appendNextBattleCardRewardOffer(s, meta);
  if (offer) {
    syncRewardCompatibility(s);
    return true;
  }
  return completeRewardPhase(s);
}

export function claimReward(s, optionId, meta = null, replaceIndex = null) {
  if (s.phase !== "reward") return false;
  const offer = activeRewardOffer(s.reward),
    option = offer?.options?.find((candidate) => candidate.optionId === optionId);
  if (!offer || !option || option.claimed || offer.consumed) return false;
  if (!grantRewardOption(s, option, meta, replaceIndex)) return false;
  if (!claimOfferState(offer, optionId)) return false;
  return progressRewardPhase(s, meta);
}

export function skipReward(s, meta = null) {
  if (s.phase !== "reward") return false;
  const offer = activeRewardOffer(s.reward);
  if (!offer || !skipOfferState(offer)) return false;
  return progressRewardPhase(s, meta);
}

export function advance(s, cardId = null, replaceIndex = null, meta = null) {
  if (s.phase !== "reward") return false;
  const offer = activeRewardOffer(s.reward);
  if (!offer) return completeRewardPhase(s);
  if (cardId) {
    const option = offer.options?.find((candidate) =>
      !candidate.claimed && candidate.type === "card" && candidate.id === cardId,
    );
    return option ? claimReward(s, option.optionId, meta, replaceIndex) : false;
  }
  return skipReward(s, meta);
}

function rollRestChoices(s) {
  const eligible = s.deck
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.level < cardMaxUpgrade(card));
  return shuffle(s, eligible).slice(0, 5).map(({ index }) => index);
}
export function restCardChoices(s) {
  if (s.phase !== "rest" || s.restResult) return [];
  if (!Array.isArray(s.restChoices)) s.restChoices = rollRestChoices(s);
  return s.restChoices.filter((index) => s.deck[index]);
}
export function rest(s, choice, index) {
  if (s.phase !== "rest" || s.restResult) return false;
  if (choice === "heal") {
    if (s.hp >= s.maxHp) return false;
    heal(s, Math.ceil(s.maxHp * 0.3));
    s.nextOpeningShield = power(s, "restSiteOverheal");
    s.restChoices = null;
    s.node++;
    s.phase = "map";
    return true;
  }
  if (
    choice !== "upgrade" ||
    !restCardChoices(s).includes(index) ||
    s.deck[index].level >= cardMaxUpgrade(s.deck[index])
  )
    return false;
  const card = s.deck[index], previousLevel = card.level;
  card.level++;
  s.restResult = {
    type: "upgrade",
    index,
    cardId: card.id,
    previousLevel,
    level: card.level,
  };
  s.restChoices = null;
  return true;
}
export function leaveRest(s) {
  if (s.phase !== "rest" || s.restResult?.type !== "upgrade") return false;
  s.restResult = null;
  s.node++;
  s.phase = "map";
  return true;
}
function canBuyShopCard(s, id, meta = null) {
  return Boolean(CARDS[id]) && isContentUnlocked(meta, "card", id) &&
    s.deck.length < deckLimit(s) && cardCount(s, id) < cardMaxCopies(id);
}

function canBuyShopAugment(s, id, meta = null) {
  const item = ITEMS[id];
  if (
    !item ||
    !["trait", "relic"].includes(item.kind) ||
    item.hidden ||
    item.signatureOnly ||
    !isContentUnlocked(meta, "item", id)
  )
    return false;
  if (s.inventory.filter((ownedId) => ownedId === id).length >= item.maxOwned) return false;
  if (item.stackable) return true;
  const family = item.family || item.effect;
  return !s.inventory
    .map((ownedId) => ITEMS[ownedId])
    .some((owned) =>
      owned?.kind === item.kind &&
      (owned.family || owned.effect) === family &&
      owned.tier >= item.tier,
    );
}

export function shopStockLimit(s) {
  return ATELIER_MIN_STOCK + Math.floor(random(s) * (ATELIER_MAX_STOCK - ATELIER_MIN_STOCK + 1)) +
    Math.max(0, Math.floor(power(s, "shopStockSlots")));
}

function shopCatalog(meta = null) {
  const fallbackTable = [
      ...Object.keys(CARDS).filter((id) => id !== "impurity").map((id) => ({ type: "card", id })),
      ...Object.keys(ITEMS).map((id) => ({ type: "augment", id })),
    ],
    sourceTable = ATELIER_DROP_TABLE.length ? ATELIER_DROP_TABLE : fallbackTable;
  return sourceTable.filter((entry) => {
    const product = entry?.type === "card" ? CARDS[entry.id] : ITEMS[entry?.id];
    if (!product) return false;
    if (entry.type === "card")
      return product.id !== "impurity" &&
        acquisitionAllows(product, { shop: true }) &&
        isContentUnlocked(meta, "card", product.id);
    return entry.type === "augment" && ["trait", "relic"].includes(product.kind) &&
      acquisitionAllows(product, { shop: true }) &&
      !product.hidden && !product.signatureOnly && product.kind !== "curse" &&
      isContentUnlocked(meta, "item", product.id);
  });
}

function rollShopCatalogEntry(s, meta, catalog, kind, excludedIds) {
  if (kind === "card") {
    const weights = adjustedCardTierWeights(s, REWARD_PROFILES.shopCard.tierWeights),
      poolForTier = (tier) => catalog.filter((entry) =>
        entry.type === "card" && !excludedIds.has(`card:${entry.id}`) &&
        CARDS[entry.id]?.tier === tier && canBuyShopCard(s, entry.id, meta),
      ),
      requestedTier = weighted(s, weights) + 1;
    let pool = poolForTier(requestedTier);
    if (!pool.length) {
      const eligibleWeights = weights.map((weight, index) => poolForTier(index + 1).length ? weight : 0);
      if (eligibleWeights.some(Boolean)) pool = poolForTier(weighted(s, eligibleWeights) + 1);
    }
    return pool.length ? pick(s, pool) : null;
  }
  const profile = kind === "trait" ? REWARD_PROFILES.shopTrait : REWARD_PROFILES.shopRelic,
    weights = profile.tierWeightsByKind[kind],
    poolForTier = (tier) => catalog.filter((entry) =>
      entry.type === "augment" && !excludedIds.has(`item:${entry.id}`) &&
      ITEMS[entry.id]?.kind === kind && ITEMS[entry.id]?.tier === tier &&
      canBuyShopAugment(s, entry.id, meta),
    ),
    requestedTier = weighted(s, weights);
  let pool = poolForTier(requestedTier);
  if (!pool.length) {
    const eligibleWeights = weights.map((weight, index) => poolForTier(index).length ? weight : 0);
    if (eligibleWeights.some(Boolean)) pool = poolForTier(weighted(s, eligibleWeights));
  }
  return pool.length ? pick(s, pool) : null;
}

export function rollShopOffers(s, meta = null) {
  const catalog = shopCatalog(meta),
    count = shopStockLimit(s),
    selected = [],
    excludedIds = new Set();
  for (let index = 0; index < count; index++) {
    const slot = SHOP_SLOT_PROFILES[Math.min(index, SHOP_SLOT_PROFILES.length - 1)],
      kinds = Object.keys(slot),
      selectedKind = kinds[weighted(s, kinds.map((kind) => slot[kind]))],
      fallbackKinds = [selectedKind, ...kinds.filter((kind) => kind !== selectedKind)],
      entry = fallbackKinds
        .map((kind) => rollShopCatalogEntry(s, meta, catalog, kind, excludedIds))
        .find(Boolean);
    if (!entry) continue;
    const product = entry.type === "card" ? CARDS[entry.id] : ITEMS[entry.id],
      tier = entry.type === "card" ? product.tier : product.tier + 1;
    selected.push({
      type: entry.type,
      id: entry.id,
      tier,
      basePrice: ATELIER_TIER_PRICES[tier],
      sold: false,
    });
    excludedIds.add(`${entry.type === "card" ? "card" : "item"}:${entry.id}`);
  }
  s.shopOffers = selected;
  return s.shopOffers;
}

export function shopOffers(s, meta = null) {
  // Older saves may contain an empty shop array from before the automatic
  // catalog fallback existed. Treat that as uninitialized so those runs can
  // immediately receive the current stock instead of showing "preparing".
  return Array.isArray(s.shopOffers) && s.shopOffers.length
    ? s.shopOffers
    : rollShopOffers(s, meta);
}

export function shop(s, action, index, meta = null) {
  if (s.phase !== "shop") return false;
  if (action === "leave") {
    s.shopOffers = null;
    s.node++;
    s.phase = "map";
    return true;
  }
  if (action === "potion" && s.potions < potionLimit(s) && spendGold(s, shopPrice(s, 25, "potion"))) {
    s.potions++;
    return true;
  }
  if (action === "reroll" && s.shopRerolls > 0) {
    s.shopRerolls--;
    rollShopOffers(s, meta);
    return true;
  }
  if (action === "offer") {
    const offer = s.shopOffers?.[index];
    if (!offer || offer.sold || !Number.isFinite(offer.basePrice)) return false;
    const eligible = offer.type === "card"
      ? canBuyShopCard(s, offer.id, meta)
      : offer.type === "augment" && canBuyShopAugment(s, offer.id, meta);
    if (!eligible || !spendGold(s, shopPrice(s, offer.basePrice, offer.type))) return false;
    if (offer.type === "card") {
      s.deck.push({ id: offer.id, level: 0 });
      if (meta && !s.testMode) {
        meta.discoveredCards ??= [...new Set(STARTING_DECK)];
        if (!meta.discoveredCards.includes(offer.id)) meta.discoveredCards.push(offer.id);
      }
    } else if (!addInventoryItem(s, offer.id, meta)) return false;
    offer.sold = true;
    return true;
  }
  return false;
}

export function potionLimit(s) {
  return 3 + power(s, "potionSlot");
}

export function shopPrice(s, basePrice, type = "all") {
  const triple = power(s, "shopCostTriple");
  const multiplier = (triple || (1 + power(s, "shopPriceMultiplier"))) * Math.max(0, 1 - power(s, "shopAllDiscount"));
  const flatDiscount = type === "card" ? power(s, "shopCardDiscount") : 0;
  return Math.max(0, Math.round(basePrice * multiplier + 1e-9) - flatDiscount);
}

const CURSE_THEME_EFFECTS = Object.freeze({
  curse_pit: new Set([
    "defense", "openingShield", "turnStartShieldLoss", "endTurnShieldHalfLoss", "hitShieldExtraLoss",
    "shieldCapLimit", "zeroShieldLock", "absorbBonus", "openingAbsorb", "absorbDecayBonus",
    "extraAbsorbDecay", "absorbCardSelfCorrosion", "endTurnAbsorbZeroReset",
  ]),
  blood: new Set([
    "maxHp", "incomingHeal", "regen", "battleEndHeal", "hitPermanentMaxHpLoss",
    "cardHpCost", "enemyBleedMirror", "oilCardSelfDamage", "zeroCostSelfDamage",
    "contactSelfBleed", "discardSelfDamage", "healAbsorbLoss", "hitDamagePenalty", "enemyAttackBuff",
  ]),
  mercury: new Set([
    "turnStartApPenalty", "everyTwoCardsApLoss", "heavyTurnNextApLoss", "zeroCostTax",
    "contactCostUp", "thirdCardZeroAp", "fixedDrawTwoCards", "handSizePenalty",
    "turn1DrawPenalty", "drawImpurityChance", "lockRandomCardTurn", "endTurnAddImpurity",
  ]),
  mirror: new Set([
    "harmonyDamagePenalty", "harmonySelfVulnerable", "handSizePenalty", "turn1DrawPenalty",
    "drawImpurityChance", "lockRandomCardTurn", "zeroCostTax", "thirdCardZeroAp",
    "everyTwoCardsApLoss", "enemyCardMirror",
  ]),
  smuggler: new Set([
    "goldDebt", "goldBonus", "shopPriceMultiplier", "shopCostTriple", "enterRoomGoldLoss",
    "victoryGoldPenalty",
  ]),
});

const DIRECT_AP_CURSE_EFFECTS = new Set([
  "turnStartApPenalty",
  "everyTwoCardsApLoss",
  "heavyTurnNextApLoss",
  "zeroCostTax",
  "contactCostUp",
  "thirdCardZeroAp",
]);

function themedCurse(item, theme) {
  if (!theme || theme === "all" || theme === "mystery" || theme === "dice") return true;
  return CURSE_THEME_EFFECTS[theme]?.has(item.effect) || false;
}

function rollCurseCandidates(s, meta, tier, count, theme = "all", excludedEffects = new Set()) {
  const eligibleTier = (targetTier) => eligibleRewardItems(
      s,
      meta,
      {
        kind: "curse",
        tier: targetTier,
        allowCurse: true,
        predicate: (item) => !excludedEffects.has(item.effect),
      },
    ),
    sameTier = eligibleTier(tier),
    stages = [
      sameTier.filter((item) => themedCurse(item, theme)),
      sameTier,
      ...(tier > 0 ? [eligibleTier(tier - 1)] : []),
    ],
    candidates = [],
    selectedIds = new Set();
  for (const stage of stages) {
    const remaining = stage.filter((item) => !selectedIds.has(item.id));
    while (candidates.length < count && remaining.length) {
      const item = pick(s, remaining);
      candidates.push(item.id);
      selectedIds.add(item.id);
      remaining.splice(remaining.findIndex((candidate) => candidate.id === item.id), 1);
    }
    if (candidates.length >= count) break;
  }
  return candidates;
}

function specialDone(s, text, item = null) {
  s.specialDecision = null;
  s.specialResult = { text, item };
  return true;
}

function startSpecialReward(s, meta, profile, text, metadata = {}) {
  const room = roomAt(s),
    group = createProfileOffer(s, meta, profile, {
      metadata: { eventRoom: room, ...metadata },
    });
  s.specialDecision = null;
  s.specialResult = null;
  beginRewardPhase(s, {
    room,
    source: profile.source,
    groups: [group],
    metadata: {
      eventRoom: room,
      eventText: text,
      clearBattle: false,
      ...metadata,
    },
  });
  return true;
}

function startExactSpecialReward(s, meta, { kind, tier }, text, metadata = {}) {
  const profile = {
    source: metadata.source || "treasureEvent",
    rewardPool: metadata.rewardPool || "eventReward",
    type: "itemEntry",
    optionCount: 1,
    pickCount: 1,
    allowSkip: true,
    entries: [{ kind, tier, weight: 100 }],
  };
  return startSpecialReward(s, meta, profile, text, metadata);
}

function setCurseDecision(s, candidates, continuation, text) {
  if (!candidates.length) return false;
  s.specialDecision = {
    type: "curse-choice",
    candidates,
    continuation,
    text,
  };
  return true;
}

export function chooseSpecialCurse(s, index, meta) {
  const decision = s.specialDecision;
  if (!decision || decision.type !== "curse-choice" || s.phase !== roomAt(s)) return false;
  const id = decision.candidates?.[index];
  if (!id || ITEMS[id]?.kind !== "curse" || !addInventoryItem(s, id, meta)) return false;
  const name = ITEMS[id].name,
    continuation = decision.continuation;
  s.specialDecision = null;
  if (continuation === "mysteryFailure")
    return specialDone(s, `금고의 독기가 체력을 갉아먹고 ${name} 저주가 남았습니다.`, id);
  if (continuation === "cursePitRelic")
    return startSpecialReward(
      s,
      meta,
      SPECIAL_REWARD_PROFILES.cursePitRelic,
      `${name} 저주를 받아들였습니다. 계약의 T3 유물은 획득하거나 버릴 수 있습니다.`,
      { costCommitted: true },
    );
  if (continuation === "mercuryOverload") {
    s.eventPowers ??= {};
    s.eventPowers.turnBaseAp = (s.eventPowers.turnBaseAp || 0) + 1;
    return specialDone(s, `${name} 저주를 대가로 턴 시작 AP +1 영구 효과를 얻었습니다.`, id);
  }
  if (continuation === "bloodRelic")
    return startSpecialReward(
      s,
      meta,
      SPECIAL_REWARD_PROFILES.bloodRelic,
      `${name} 저주까지 지불했습니다. 제단의 T3 유물은 획득하거나 버릴 수 있습니다.`,
      { costCommitted: true },
    );
  if (continuation === "smugglerRelic")
    return startSpecialReward(
      s,
      meta,
      SPECIAL_REWARD_PROFILES.smugglerRelic,
      `${name} 저주까지 거래 대가로 확정됐습니다. 밀수 유물은 획득하거나 버릴 수 있습니다.`,
      { costCommitted: true },
    );
  return specialDone(s, `${name} 저주가 적용되었습니다.`, id);
}

export function chooseSpecial(s, choice, meta, index = null, note = null) {
  const room = roomAt(s);
  if (s.phase !== room || s.specialResult || s.specialDecision) return false;
  if (room === "mystery") {
    if (choice === "safe")
      return startSpecialReward(
        s,
        meta,
        SPECIAL_REWARD_PROFILES.mysterySafe,
        "금고를 안전하게 열었습니다. T1 능력치 보상은 원하지 않으면 버릴 수 있습니다.",
      );
    if (choice === "gamble") {
      if (random(s) < 0.55)
        return startSpecialReward(
          s,
          meta,
          SPECIAL_REWARD_PROFILES.mysteryJackpot,
          "강제 개방에 성공했습니다. Jackpot 보상은 확인 후 획득하거나 버릴 수 있습니다.",
        );
      s.hp = Math.max(1, s.hp - 12);
      return setCurseDecision(
        s,
        rollCurseCandidates(s, meta, 0, 2, "mystery"),
        "mysteryFailure",
        "강제 개방 실패 · 체력 -12. T1 저주 후보 2개 중 하나를 선택해야 합니다.",
      );
    }
    if (choice === "skip") return specialDone(s, "잠긴 향은 잠긴 채로 남겨 두었습니다.");
  }
  if (room === "greenhouse") {
    if (choice === "heal") {
      s.maxHp += 5;
      heal(s, s.maxHp);
      unlock(meta, "boss_primeval_lily", s);
      return specialDone(s, "새벽 이슬을 마셔 최대 체력이 5 증가하고 체력을 완전히 회복했습니다.");
    }
    if (choice === "cleanse") {
      const before = s.deck.length;
      s.deck = s.deck.filter((card) => card.id !== "impurity");
      recordPurifiedImpurities(meta, s, before - s.deck.length);
      return specialDone(s, `허브 흙이 불순물 ${before - s.deck.length}장을 영구히 정화했습니다.`);
    }
  }
  if (room === "curse_pit") {
    if (choice === "reach")
      return setCurseDecision(
        s,
        rollCurseCandidates(s, meta, 1, 2, "curse_pit"),
        "cursePitRelic",
        "계약 비용을 먼저 확정합니다. T2 저주 후보 2개 중 하나를 선택하세요.",
      );
    if (choice === "endure") {
      s.pendingCorrosion = (s.pendingCorrosion || 0) + 2;
      gainGold(s, 50);
      return specialDone(s, "50골드를 건졌지만 다음 전투는 부식 2와 함께 시작합니다.");
    }
    if (choice === "flee") { gainGold(s, power(s, "fleeBonusGold")); return specialDone(s, "독성 안개가 닿기 전에 폐기장을 벗어났습니다."); }
  }
  if (room === "lab") {
    if (choice === "note" && s.deck[index] && ["top", "middle", "base"].includes(note)) {
      s.deck[index].note = note;
      return specialDone(s, `${CARDS[s.deck[index].id].name}의 노트를 ${note.toUpperCase()}로 치환했습니다.`);
    }
    if (choice === "remove" && s.deck.length > 5 && s.deck[index] && spendGold(s, Math.max(0, 20 - power(s, "labCostDiscount")))) {
      const name = CARDS[s.deck[index].id].name,
        purified = s.deck[index].id === "impurity" ? 1 : 0;
      s.deck.splice(index, 1);
      recordPurifiedImpurities(meta, s, purified);
      return specialDone(s, `${name} 카드를 용매로 씻어 영구 제거했습니다.`);
    }
  }
  if (room === "mercury_still") {
    if (choice === "overload")
      return setCurseDecision(
        s,
        rollCurseCandidates(s, meta, 2, 3, "mercury", DIRECT_AP_CURSE_EFFECTS),
        "mercuryOverload",
        "턴 시작 AP +1의 대가로 T3 저주 후보 3개 중 하나를 선택하세요. AP를 직접 깎는 저주는 제외됩니다.",
      );
    if (choice === "purify") {
      gainGold(s, 30);
      return specialDone(s, "정제된 수은 증기를 팔아 30골드를 얻었습니다.");
    }
    if (choice === "skip") return specialDone(s, "폭발 위험이 도사리는 증류기를 지나쳤습니다.");
  }
  if (room === "blood_altar") {
    if (choice === "sacrifice") {
      const cost = Math.max(1, Math.ceil(s.hp * 0.3)),
        candidates = rollCurseCandidates(s, meta, 1, 2, "blood");
      if (!candidates.length) return false;
      s.hp = Math.max(1, s.hp - cost);
      return setCurseDecision(
        s,
        candidates,
        "bloodRelic",
        `현재 체력의 30%(${cost})를 이미 바쳤습니다. T2 저주 후보 2개 중 하나를 선택하세요.`,
      );
    }
    if (choice === "tribute") {
      const curse = rollCurseCandidates(s, meta, 0, 1, "blood")[0];
      if (!curse || !spendGold(s, 50) || !addInventoryItem(s, curse, meta)) return false;
      return startSpecialReward(
        s,
        meta,
        SPECIAL_REWARD_PROFILES.bloodTrait,
        `50골드와 ${ITEMS[curse].name} 저주를 공양했습니다. 특성 보상은 획득하거나 버릴 수 있습니다.`,
        { costCommitted: true, curseId: curse },
      );
    }
    if (choice === "cleanse_card" && s.deck.length > 5 && s.deck[index]) {
      const name = CARDS[s.deck[index].id].name;
      s.deck.splice(index, 1);
      return specialDone(s, `${name} 카드를 제단의 불꽃으로 소각했습니다.`);
    }
    if (choice === "skip") return specialDone(s, "피의 계약을 거절하고 제단을 떠났습니다.");
  }
  if (room === "dice_altar") {
    if (choice === "reroll") {
      const outcome = weightedEntry(s, DICE_ALTAR_OUTCOMES);
      if (!outcome) return false;
      if (outcome.type === "gold") {
        gainGold(s, outcome.amount);
        return specialDone(s, `운명의 주사위가 ${outcome.amount}골드를 즉시 지급했습니다.`);
      }
      if (outcome.type === "curse") {
        const curse = rollCurseCandidates(s, meta, outcome.tier, 1, "dice")[0];
        if (!curse || !addInventoryItem(s, curse, meta)) return false;
        return specialDone(s, `운명의 주사위가 ${ITEMS[curse].name} 저주를 즉시 남겼습니다.`, curse);
      }
      return startExactSpecialReward(
        s,
        meta,
        outcome,
        "운명의 주사위가 증강을 불러냈습니다. 좋은 결과라도 원하지 않으면 버릴 수 있습니다.",
        { rewardPool: "diceAltar" },
      );
    }
    if (choice === "charm") {
      const healed = heal(s, 15);
      gainGold(s, 25);
      return specialDone(s, `행운의 부적으로 체력 ${healed}을 회복하고 25골드를 얻었습니다.`);
    }
    if (choice === "skip") return specialDone(s, "주사위의 유혹을 뿌리치고 지나갔습니다.");
  }
  if (room === "purify_furnace") {
    if (choice === "burn_two") {
      s.hp = Math.max(1, s.hp - 14);
      const removed = s.deck.splice(0, Math.max(0, Math.min(2, s.deck.length - 5)));
      recordPurifiedImpurities(meta, s, removed.filter((card) => card.id === "impurity").length);
      return specialDone(s, `체력 14를 잃고 덱 앞쪽 카드 ${removed.length}장을 영구 소멸시켰습니다.`);
    }
    if (choice === "flame_power") {
      s.eventPowers ??= {};
      s.eventPowers.attack = (s.eventPowers.attack || 0) + 3;
      s.eventOpeningBurning = (s.eventOpeningBurning || 0) + 2;
      return specialDone(s, "영구 공격력 +3을 얻었지만, 매 전투 첫 턴에 화상 2를 얻습니다.");
    }
    if (choice === "skip") return specialDone(s, "뜨거운 열기를 피해 돌아섰습니다.");
  }
  if (room === "mirror_doppel") {
    if (choice === "duplicate" && s.deck[index]) {
      const card = structuredClone(s.deck[index]),
        tier = CARDS[card.id]?.tier || 1,
        impurityCost = tier === 3 ? 1 : 0,
        neededSlots = 1 + impurityCost;
      if (s.deck.length + neededSlots > deckLimit(s) || cardCount(s, card.id) >= cardMaxCopies(card.id)) return false;
      const curse = tier === 4 ? rollCurseCandidates(s, meta, 0, 1, "mirror")[0] : null;
      if (tier === 4 && !curse) return false;
      const hpCost = tier === 1 ? 5 : tier === 2 ? 10 : tier === 3 ? 15 : 10;
      s.hp = Math.max(1, s.hp - hpCost);
      if (curse && !addInventoryItem(s, curse, meta)) return false;
      s.deck.push(card);
      if (impurityCost) s.deck.push({ id: "impurity", level: 0 });
      return specialDone(
        s,
        `${CARDS[card.id].name} 카드를 복제했습니다. 비용: 체력 -${hpCost}${impurityCost ? " · 불순물 1장" : ""}${curse ? ` · ${ITEMS[curse].name} 저주` : ""}.`,
        curse,
      );
    }
    if (choice === "gold_double") {
      const bonus = Math.floor(s.gold * 0.3);
      gainGold(s, bonus);
      return specialDone(s, `거울 속 금화가 쏟아져 나와 ${bonus}골드를 얻었습니다.`);
    }
    if (choice === "skip") return specialDone(s, "거울을 들여다보지 않고 통과했습니다.");
  }
  if (room === "smuggler") {
    if (choice === "contraband") {
      const candidates = rollCurseCandidates(s, meta, 0, 2, "smuggler");
      if (!candidates.length || !spendGold(s, 50)) return false;
      return setCurseDecision(
        s,
        candidates,
        "smugglerRelic",
        "50골드를 이미 지불했습니다. T1 저주 후보 중 하나를 거래 대가로 선택하세요.",
      );
    }
    if (choice === "blood_trade") {
      s.maxHp = Math.max(1, s.maxHp - 10);
      s.hp = Math.min(s.hp, s.maxHp);
      return startSpecialReward(
        s,
        meta,
        SPECIAL_REWARD_PROFILES.smugglerTrait,
        "최대 체력 10을 이미 넘겼습니다. 특성 보상은 획득하거나 버릴 수 있습니다.",
        { costCommitted: true },
      );
    }
    if (choice === "skip") return specialDone(s, "수상한 밀수꾼을 모른 척 지나쳤습니다.");
  }
  return false;
}

export function leaveSpecial(s) {
  if (!["mystery", "greenhouse", "curse_pit", "lab", "mercury_still", "blood_altar", "dice_altar", "purify_furnace", "mirror_doppel", "smuggler"].includes(s.phase) || !s.specialResult || s.specialDecision)
    return false;
  s.specialResult = null;
  s.specialDecision = null;
  s.node++;
  s.phase = "map";
  return true;
}

export function potion(s) {
  if (s.potions > 0 && s.hp > 0 && s.hp < s.maxHp && !s.finished) {
    s.potions--;
    heal(s, 20);
    return true;
  }
  return false;
}
export function nextLoop(s, meta, continueRun) {
  if (s.phase !== "loop") return;
  if (!continueRun) {
    finish(s, meta);
    return;
  }
  s.loop++;
  s.node = 0;
  s.rewardExposure = freshRewardExposure(s.loop);
  s.route = generateRoute(s);
  s.resolvedRooms = Array(12).fill(null);
  s.currentSubRoom = null;
  s.phase = "map";
}
export function abandon(s, meta) {
  finish(s, meta);
}
export function addStatus(s, target, id, amount = 1) {
  return applyBattleStatus(s, target, id, amount);
}
export function removeStatus(s, target, id, amount = Infinity) {
  const entity = target === "enemy" ? selectedEnemy(s.battle) : s;
  return S.removeStatus(entity, id, amount);
}
export function dispelStatuses(s, target, filters = {}) {
  const entity = target === "enemy" ? selectedEnemy(s.battle) : s;
  return S.dispelStatuses(entity, filters);
}

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
} from "./data.js";
import * as S from "./statuses.js";
import { HIDDEN_SYNERGIES } from "./synergies.js";
import {
  ATELIER_DROP_TABLE,
  ATELIER_MAX_STOCK,
  ATELIER_MIN_STOCK,
  ATELIER_TIER_PRICES,
} from "./atelier-shop.js";
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
    itemIds = Object.keys(ITEMS), monsterIds = Object.keys(ENEMIES),
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
export function activeSynergies(s) {
  return Object.values(HIDDEN_SYNERGIES).filter((synergy) =>
    synergy.requires.every((id) => s.inventory.includes(id)),
  );
}
export function hasSynergy(s, synergyId) {
  return activeSynergies(s).some((synergy) => synergy.id === synergyId);
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
export function generateRoute(s) {
  const route = Array(12).fill("combat");
  route[11] = "boss";
  const available = shuffle(s, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const treasureCount = 1 + Math.floor(random(s) * 2);
  for (const index of available.splice(0, treasureCount)) route[index] = "treasure";
  const shopCount = Math.floor(random(s) * 2);
  for (const index of available.splice(0, shopCount)) route[index] = "shop";
  const eliteCount = treasureCount;
  const eliteCandidates = available.filter((index) => s.loop > 0 || index >= 2);
  for (const index of eliteCandidates.slice(0, eliteCount)) route[index] = "elite";
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
export function rollLoot(s, room, meta = null) {
  const table = TABLES[room];
  if (!table) throw Error(`Unknown room: ${room}`);
  const available = Object.values(ITEMS).filter((i) => {
    if (i.signatureOnly || i.kind === "curse" || !isContentUnlocked(meta, "item", i.id)) return false;
    const explicitRooms = Array.isArray(i.rooms),
      allowed = explicitRooms ? i.rooms : [i.room || "gather"],
      legacyMatch = !explicitRooms &&
        (room === "elite"
          ? ["golden", "boss"].includes(i.room)
          : room === "boss"
            ? ["gather", "golden", "boss"].includes(i.room)
            : false),
      matched = allowed.includes(room) || allowed.includes("all") ||
        (["gather", "golden"].includes(room) && allowed.includes("treasure")) || legacyMatch;
    return matched &&
      s.inventory.filter((id) => id === i.id).length < i.maxOwned &&
      (!(["trait", "relic"].includes(i.kind) && !i.stackable) ||
        i.tier > Math.max(
          -1,
          ...s.inventory
            .map((id) => ITEMS[id])
            .filter(
              (owned) =>
                owned?.kind === i.kind &&
                (owned.family || owned.effect) === (i.family || i.effect),
            )
            .map((owned) => owned.tier),
        ));
  });
  if (!available.length) return null;
  const kind = ["stat", "trait", "relic"][weighted(s, table.kinds)],
    tier = weighted(s, table.tiers);
  const exact = available.filter((i) => i.kind === kind && i.tier === tier),
    sameTier = available.filter((i) => i.tier === tier),
    sameKind = available.filter((i) => i.kind === kind),
    pool = exact.length ? exact : sameTier.length ? sameTier : sameKind.length ? sameKind : available;
  return pick(s, pool).id;
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
    shopOffers: null,
    restChoices: null,
    statuses: S.createStatuses(),
    log: [],
    maxHit: 0,
    won: false,
    finished: false,
    pendingCorrosion: 0,
    pendingImpurities: 0,
    specialResult: null,
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
    (n, id) =>
      n +
      (ITEMS[id].effect === key &&
      !(
        S.restricted(s, "passives") &&
        ["trait", "relic"].includes(ITEMS[id].kind)
      )
        ? ITEMS[id].value
        : 0),
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
function gainPlayerShield(s, amount) {
  const b = s.battle;
  if (!b) return 0;
  if (power(s, "zeroShieldLock")) { b.shield = 0; return 0; }
  const before = b.shield;
  if (b.topPlayedThisTurn && power(s, "topNoteShieldHalf")) amount *= 0.5;
  b.shield += Math.round(amount);
  const cap = power(s, "shieldCapLimit");
  if (cap > 0) b.shield = Math.min(cap, b.shield);
  return Math.max(0, b.shield - before);
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
    bonus += ["burning", "poison", "bleed", "corrosion"].filter((id) => S.stacks(target, id) > 0).length * power(s, "nonContactDotBonus");
  if (pattern === "contact" && (s.battle.contactCardsPlayedThisTurn || 0) > 0) bonus += power(s, "comboContact");
  if ((definition.hits || 1) >= 3 && pattern === "contact") bonus += power(s, "multiHitDamageBonus");
  if ((definition.hits || 1) >= 2) bonus -= power(s, "multiHitDamagePenalty");
  if (definition.cost === 0 && s.battle.topPlayedThisTurn) bonus += power(s, "topZeroCostBonus");
  bonus += s.battle.nextAttackBonus || 0;
  bonus -= s.battle.turnDamagePenalty || 0;
  return bonus;
}
export function resolveHarmonyEffect(s) {
  const effect = { ...BASE_HARMONY_EFFECT };
  return {
    ...effect,
    damage: Math.max(
      0,
      Math.round(effect.baseDamage + power(s, "harmonyAttack") + power(s, "harmonyBonus") - power(s, "harmonyDamagePenalty")),
    ),
  };
}
function triggerHarmony(s, chain = []) {
  const harmonyEffect = resolveHarmonyEffect(s),
    target = selectedEnemy(s.battle),
    targetIndex = target ? s.battle.enemies.indexOf(target) : null,
    result = damage(s, harmonyEffect.damage, {
      attackPattern: harmonyEffect.attackPattern,
      targetEnemy: target,
    });
  s._harmonyFeedback ??= [];
  s.harmoniesThisRun = (s.harmoniesThisRun || 0) + 1;
  s.battle.harmoniesThisBattle = (s.battle.harmoniesThisBattle || 0) + 1;
  s.battle.harmoniesThisTurn = (s.battle.harmoniesThisTurn || 0) + 1;
  s._harmonyFeedback.push({
    id: harmonyEffect.id,
    label: harmonyEffect.label,
    visual: harmonyEffect.visual,
    damage: result.damage,
    blocked: result.blocked,
    targetIndex,
  });
  log(s, `${harmonyEffect.label} 추가 피해 ${result.damage}`);
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
  if (power(s, "harmonyIntimidateAll"))
    for (const enemy of livingEnemies(s.battle)) applyBattleStatus(s, "enemy", "intimidated", power(s, "harmonyIntimidateAll"), enemy);
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
  if (!item) return false;
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
export function deckLimit(s) {
  return BASE_DECK_SIZE + power(s, "deckSize");
}
function log(s, text) {
  s.log.unshift(text);
  s.log = s.log.slice(0, 12);
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
function damageFeedback(s, target, amount, statusId, targetIndex = null) {
  if (!statusId || amount <= 0) return;
  s._damageFeedback ??= [];
  const feedback = { target, amount, statusId };
  if (Number.isInteger(targetIndex)) feedback.targetIndex = targetIndex;
  s._damageFeedback.push(feedback);
}
function triggerRegeneration(s, entity, isPlayer) {
  const amount = S.stacks(entity, "regeneration");
  if (!amount) return;
  const restored = isPlayer
    ? heal(s, amount)
    : Math.max(0, Math.min(amount, entity.maxHp - entity.hp));
  if (!isPlayer) entity.hp += restored;
  log(s, `${isPlayer ? "나" : "적"} 재생 +${restored}`);
  S.tickDurations(entity, "afterTrigger");
}
function triggerStatusEvent(s, entity, event, isPlayer) {
  for (const { id, state, definition } of S.triggered(entity, event)) {
    if (definition.effect !== "bypassDamage") continue;
    let amount = state.stacks;
    if (!isPlayer && id === "burning")
      amount = Math.round((amount + power(s, "burningDamageBonus")) * (1 + power(s, "burningMultiplier") + synergyPower(s, "pressurizedAroma")));
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
    if (!isPlayer && id === "bleed") {
      heal(s, power(s, "bleedLeech"));
      gainPlayerShield(s, power(s, "bleedTriggerShield"));
      if (power(s, "enemyBleedMirror")) hurtPlayer(s, amount, { direct: false, bypassShield: true, statusId: "bleed" });
    }
    if (!isPlayer && id === "burning" && power(s, "burningBackfireRatio"))
      hurtPlayer(s, amount * power(s, "burningBackfireRatio"), { direct: false, bypassShield: true, statusId: "burning" });
    log(s, `${isPlayer ? "나" : "적"} ${definition.name} ${amount} 피해`);
    if ((isPlayer && !s.hp) || (!isPlayer && !entity.hp)) break;
  }
}
function gainGold(s, amount) {
  const gained = Math.max(0, Math.floor(amount * (1 + synergyPower(s, "goldGainMultiplier"))));
  if (!gained) return 0;
  s.gold += gained;
  s._goldFeedback = (s._goldFeedback || 0) + gained;
  return gained;
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
function draw(s, n, turnStart = false) {
  const b = s.battle;
  let drawn = 0;
  if (power(s, "fixedDrawTwoCards")) {
    if (!turnStart) return 0;
    n = power(s, "fixedDrawTwoCards");
  }
  n = Math.max(0, n - S.drawPenalty(s));
  while (n-- > 0 && b.hand.length < handLimit(s)) {
    if (!b.draw.length) b.draw = shuffle(s, b.discard.splice(0));
    if (!b.draw.length) break;
    const card = b.draw.pop();
    if (card.id === "impurity" && s.inventory.includes("relic_golden_pipette")) {
      gainCurrentAp(s, 1);
      gainAbsorb(s, 6);
      log(s, "황금빛 정제 피펫: 불순물 소멸 · AP +1 · 흡수 +6");
      continue;
    }
    b.hand.push(card);
    drawn++;
    if (card.id === "impurity") {
      if (power(s, "impurityApRefund")) gainCurrentAp(s, power(s, "impurityApRefund"));
      if (powers(s, "impurityDrawPush", "impurityApRefund")) n++;
    }
    if (power(s, "drawImpurityChance") && random(s) < power(s, "drawImpurityChance") && b.hand.length < handLimit(s)) {
      b.hand.push({ id: "impurity", level: 0 });
      drawn++;
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
    s.statuses = S.createStatuses();
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
      notes: [],
      boss: room === "boss",
      contactCardsPlayedThisBattle: 0,
      elite: room === "elite",
      lastEnemyAction: null,
    });
    s.phase = "battle";
    startTurn(s, meta);
    if (hasSynergy(s, "morning_chamomile")) {
      gainPlayerShield(s, HIDDEN_SYNERGIES.morning_chamomile.shield);
      log(s, "세트 효과 [아침 카모마일 온기]: 방어막 +4 전개");
    }
    while (s.pendingImpurities > 0 && s.battle.hand.length < handLimit(s)) {
      if (s.inventory.includes("relic_golden_pipette")) {
        gainCurrentAp(s, 1);
        gainAbsorb(s, 6);
      } else s.battle.hand.push({ id: "impurity", level: 0 });
      s.pendingImpurities--;
    }
  } else if (room === "gather" || room === "golden") {
    if (power(s, "treasureRoomCardDuplication") && s.lastRelicDuplicatedNode !== s.node && s.deck.length < deckLimit(s)) {
      const source = pick(s, s.deck);
      if (source) s.deck.push({ ...source });
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
  } = {},
) {
  const b = s.battle;
  const enemy = targetEnemy || selectedEnemy(b);
  if (!enemy || enemy.hp <= 0) return { damage: 0, blocked: 0 };
  const hpBeforeHit = enemy.hp;
  if (direct && power(s, "executeThreshold") && enemy.hp <= enemy.maxHp * power(s, "executeThreshold")) {
    if (enemy.isBoss) amount *= 1.5;
    else amount = enemy.hp + (bypassShield ? 0 : enemy.shield);
  }
  if (direct && bypassShield && power(s, "bypassShieldAmplify")) amount *= 1 + power(s, "bypassShieldAmplify");
  amount = direct
    ? S.directDamage(amount, s, enemy)
    : S.damageTaken(amount, enemy);
  amount = Math.min(999999, Math.max(0, Math.round(amount)));
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
  s._enemyHitFeedback.push({
    targetIndex,
    damage: dealt,
    blocked,
    statusId,
    attackPattern,
  });
  damageFeedback(s, "enemy", dealt, statusId, targetIndex);
  log(s, `발향 ${amount} 피해${blocked ? ` (방어 ${blocked})` : ""}`);
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
  return { damage: dealt, blocked };
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
  } = {},
) {
  const b = s.battle;
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
  const blocked = bypassShield ? 0 : Math.min(b.shield, amount);
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
  damageFeedback(s, "player", dealt, statusId);
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
  return { damage: dealt, blocked };
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
  if (target === "enemy" && id === "burning" && power(s, "burningDurationFlat") && random(s) < power(s, "burningDurationFlat")) {
    amount = typeof amount === "number" ? amount + 1 : { ...amount, stacks: (amount.stacks || 1) + 1 };
  }
  if (id === "noteCollapse") {
    if (target !== "player") return 0;
    const removed = s.battle?.notes?.length || 0;
    if (s.battle) s.battle.notes = [];
    if (removed) log(s, "노트 붕괴 · 쌓인 노트 제거");
    return removed;
  }
  if (id === "stun" && (entity.stunResistance || 0) > 0) return 0;
  return S.applyStatus(entity, id, amount);
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
      globalDotStacks = c.globalDotBurstMultiplier
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
          burningBefore = S.stacks(enemy, "burning"),
          dotStacksBefore = ["burning", "poison", "bleed", "corrosion"]
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
            },
          );
          damageDealt += result.damage;
          if (!synergyHitEnemy && result.damage + result.blocked > 0) synergyHitEnemy = hitEnemy;
          if (result.damage + result.blocked > 0) landedHits++;
          if (result.damage + result.blocked > 0 && pattern === "contact") {
            applyBattleStatus(s, "enemy", "burning", powers(s, "contactIgnite", "contactIgniteT2"), hitEnemy);
            if (result.blocked > 0) applyBattleStatus(s, "enemy", "bleed", power(s, "contactBleed"), hitEnemy);
          }
          if (result.damage + result.blocked > 0 && pattern === "nonContact")
            applyBattleStatus(s, "enemy", "intimidated", powers(s, "nonContactIntimidate", enemy.intent?.type === "attack" ? "nonContactIntimidateT2" : ""), hitEnemy);
          if (c.chanceStatusOnHit && result.damage + result.blocked > 0 && random(s) < c.chanceStatusOnHit.chance)
            applyBattleStatus(s, "enemy", c.chanceStatusOnHit.id, c.chanceStatusOnHit.amount, hitEnemy);
          if (c.intimidateOnHit && enemy.hp > 0 && result.damage + result.blocked > 0) {
            const amount = Math.floor((hit + 1) * c.intimidateOnHit / hits) - Math.floor(hit * c.intimidateOnHit / hits);
            applyBattleStatus(s, "enemy", "intimidated", { stacks: S.stacks(enemy, "intimidated") + amount, turns: 1 }, enemy);
          }
        }
        if (pattern === "contact" && power(s, "contactBypass"))
          damage(s, power(s, "contactBypass"), { targetEnemy: enemy, direct: false, bypassShield: true });
        if (pattern === "contact" && c.cost >= 2 && damageDealt > 0 && power(s, "heavyContactTrueDamage"))
          damage(s, power(s, "heavyContactTrueDamage"), { targetEnemy: enemy, direct: false, bypassShield: true });
        if (pattern === "contact" && S.stacks(enemy, "bleed")) heal(s, power(s, "contactBleedHeal"));
        if (pattern === "nonContact" && damageDealt > 0) gainAbsorb(s, damageDealt * power(s, "nonContactLeechAbsorb"));
        if (c.absorbFromDamage && damageDealt > 0)
          gainAbsorb(s, damageDealt * c.absorbFromDamage);
        if (c.globalDotBurstMultiplier && globalDotStacks > 0 && enemy.hp > 0)
          damage(s, globalDotStacks * c.globalDotBurstMultiplier * factor, {
            targetEnemy: enemy,
            direct: false,
            bypassShield: true,
          });
        if (c.extendAllDotDurations && enemy.hp > 0)
          for (const id of ["burning", "poison", "bleed", "corrosion"]) {
            const state = enemy.statuses?.[id], definition = S.STATUS_DEFINITIONS[id];
            if (!state) continue;
            if (state.turns) state.turns = Math.min(definition.maxTurns || 99, state.turns + c.extendAllDotDurations);
            else state.deferDecayTicks = (state.deferDecayTicks || 0) + c.extendAllDotDurations;
          }
        if (pattern === "nonContact" && power(s, "extendDotDurations") && enemy.hp > 0)
          for (const id of ["burning", "poison", "bleed", "corrosion"]) {
            const state = enemy.statuses?.[id], definition = S.STATUS_DEFINITIONS[id];
            if (state?.turns) state.turns = Math.min(definition.maxTurns || 99, state.turns + power(s, "extendDotDurations"));
          }
        if (pattern === "nonContact" && c.target === "all" && !enemy.isBoss && random(s) < Math.min(1, power(s, "aoeNonContactStunChance")))
          applyBattleStatus(s, "enemy", "stun", 1, enemy);
        if (c.dotBurstMultiplier && dotStacksBefore > 0 && enemy.hp > 0)
          damage(s, dotStacksBefore * c.dotBurstMultiplier * factor, {
            targetEnemy: enemy,
            direct: false,
            bypassShield: true,
          });
        if (c.amplifyDots && enemy.hp > 0)
          for (const id of ["burning", "poison", "bleed", "corrosion"]) {
            const stacks = S.stacks(enemy, id);
            if (stacks > 0) applyBattleStatus(s, "enemy", id, stacks * (c.amplifyDots - 1), enemy);
          }
        if (c.applyEnemyAfterAttack && enemy.hp > 0)
          for (const [id, amount] of Object.entries(c.applyEnemyAfterAttack))
            applyBattleStatus(s, "enemy", id, amount, enemy);
        if (c.onHitCount && landedHits >= c.onHitCount && enemy.hp > 0)
          for (const [id, amount] of Object.entries(c.onHitApplyEnemy || {}))
            applyBattleStatus(s, "enemy", id, amount, enemy);
        if (c.stunOrDisarmBossTurns && enemy.hp > 0) {
          const stunned = applyBattleStatus(s, "enemy", "stun", 1, enemy);
          if (!stunned && enemy.isBoss)
            applyBattleStatus(s, "enemy", "disarm", { stacks: 1, turns: c.stunOrDisarmBossTurns }, enemy);
        }
        if (c.detonateBurning && burningBefore > 0 && enemy.hp > 0)
          damage(s, burningBefore * c.detonateBurning * factor, { targetEnemy: enemy, direct: false, bypassShield: true, statusId: "burning" });
        if (c.maxHpOnKill && hpBefore > 0 && enemy.hp === 0) {
          s.maxHp += c.maxHpOnKill;
          log(s, `연금 추출 · 최대 체력 영구 +${c.maxHpOnKill}`);
        }
        if (hpBefore > 0 && enemy.hp === 0) {
          if (c.refundOnKill) gainCurrentAp(s, c.refundOnKill);
          if (c.drawOnKill) draw(s, c.drawOnKill);
        }
        if (c.consumeResonance) S.removeStatus(enemy, "resonance");
        if (shieldBefore > 0 && enemy.shield === 0) brokeShield = true;
        if (pattern === "contact" && landedHits >= 4 && power(s, "contactFourHitsBonus") && !b.traitRefunds.contactFour) {
          gainCurrentAp(s, power(s, "contactFourHitsBonus")); draw(s, 2); b.traitRefunds.contactFour = true;
        }
      }
      if (c.refundOnBreak && brokeShield) gainCurrentAp(s, c.refundOnBreak);
      if (c.drawOnBreak && brokeShield) draw(s, c.drawOnBreak);
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
  if (c.shieldCounter)
    for (const enemy of targets)
      damage(s, b.shield * c.shieldCounter * attackFactor, { attackPattern: "contact", targetEnemy: enemy });
  if (c.shieldScalingAttack)
    for (const enemy of targets)
      damage(s, b.shield * c.shieldScalingAttack * attackFactor, {
        attackPattern: c.attackPattern || "contact",
        targetEnemy: enemy,
      });
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
  if (c.cleanseDotStacks)
    for (const id of ["burning", "corrosion", "poison", "bleed"])
      S.removeStatus(s, id, c.cleanseDotStacks);
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
  if (c.draw) draw(s, c.draw);
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
  if (c.intimidate)
    for (const enemy of targets) applyBattleStatus(s, "enemy", "intimidated", { stacks: c.intimidate, turns: 1 }, enemy);
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
  if (c.refundAbsorbThreshold && b.absorb >= c.refundAbsorbThreshold) gainCurrentAp(s, 1);
  if (c.burst) {
    const consumed = b.absorb;
    const multiplier = ((c.upgrades ? c.burstMultiplier : (card.level > 0 ? 4.5 : 3.2)) || 3.2) + power(s, "spatialDiffusionMultiplier");
    const burstDamage = Math.ceil(consumed * multiplier);
    for (const enemy of targets)
      damage(s, (burstDamage + cardAttackPower(s, card, c, enemy)) * attackFactor, {
        attackPattern: c.attackPattern || "nonContact",
        targetEnemy: enemy,
      });
    b.absorb = 0;
    if (consumed >= 40) {
      for (const enemy of targets)
        applyBattleStatus(s, "enemy", "stun", 1, enemy);
      log(s, `공간 확산 임계점 돌파 (${consumed}) · 적 전원 기절!`);
    }
  }
  if (c.weight) {
    const shield = b.shield;
    b.shield = 0;
    for (const enemy of targets)
      damage(s, (shield + up + cardAttackPower(s, card, c, enemy)) * attackFactor, {
        attackPattern: c.attackPattern || "contact",
        targetEnemy: enemy,
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
export function canPlay(s, card) {
  if (
    s?.phase !== "battle" ||
    s.battle.enemyPhase ||
    s.battle.pendingDiscard ||
    !card ||
    card.id === "impurity" ||
    card.traitLocked === s.battle.turn
  )
    return false;
  const definition = CARDS[card.id];
  return (
    Boolean(definition) &&
    s.battle.absorb >= (cardDefinition(card).requiredAbsorb || 0) &&
    !S.cardRestricted(s, { ...definition, id: card.id }) &&
    s.battle.ap >= cost(s, card)
  );
}
export function canDiscard(s, card) {
  return (
    Boolean(card) &&
    !(card.id === "impurity" && S.restricted(s, "impurityDiscard"))
  );
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
export function play(s, index, meta) {
  if (s.phase !== "battle") return false;
  attachEnemyAliases(s.battle);
  const b = s.battle,
    card = b.hand[index];
  if (!canPlay(s, card)) return false;
  const definition = cardDefinition(card), paidCost = cost(s, card);
  b.ap -= paidCost;
  b.hand.splice(index, 1);
  b.discard.push(card);
  if (random(s) < S.cardFailureChance(s)) {
    log(s, `${CARDS[card.id].name} 방해로 실패`);
    S.consumeCardStatuses(s);
    triggerStatusEvent(s, s, "afterAction", true);
    if (!s.hp) finish(s, meta);
    return true;
  }
  const targets = effect(s, card);
  S.consumeCardStatuses(s);
  applyCardStatuses(s, cardDefinition(card), targets);
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
  if (!s.hp) {
    finish(s, meta);
    return true;
  }
  if (!S.restricted(s, "notes"))
    b.notes.push({ ...card, note: card.note || CARDS[card.id].note });
  const chain = b.notes.slice(-3);
  if (chain.length === 3 && (
    power(s, "anyThreeCardsHarmony") ||
    chain.map((played) => played.note).join(",") === BASE_HARMONY_EFFECT.sequence.join(",")
  )) {
    triggerHarmony(s, chain);
    if (
      !S.restricted(s, "passives") &&
      s.inventory.some((id) => ITEMS[id].effect === "pyramid")
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
    log(s, "기절 · 내 행동 취소");
  } else if (s.stunResistance) s.stunResistance--;
  for (const enemy of b.enemies) {
    if (enemy.hp <= 0 || !s.hp) continue;
    triggerRegeneration(s, enemy, false);
    const stunned =
      S.stacks(enemy, "stun") || S.restricted(enemy, "allActions");
    if (stunned) {
      S.removeStatus(enemy, "stun");
      if (enemy.isElite || enemy.isBoss) enemy.stunResistance = 1;
      log(s, `기절 · ${enemy.name} 행동 취소`);
    } else if (
      enemy.intent.type === "attack" &&
      S.restricted(enemy, "attacks")
    ) {
      log(s, `무장 해제 · ${enemy.name} 공격 취소`);
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
    log(s, "기절 · 내 행동 취소");
  } else if (s.stunResistance) s.stunResistance--;
  return true;
}

function applyIntentStatusMap(s, target, statuses, targetEnemy = null) {
  for (const [id, amount] of Object.entries(statuses || {})) {
    applyBattleStatus(s, target, id, amount, targetEnemy);
    if (target === "player") S.deferTurnEnd(s, id);
  }
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
  applyIntentStatusMap(s, "player", intent.applyPlayer);
  applyIntentStatusMap(s, "enemy", intent.applySelf, enemy);
  for (const ally of livingEnemies(s.battle))
    applyIntentStatusMap(s, "enemy", intent.applyAllies, ally);
  const pollution = Math.max(0, Math.floor(intent.pollute || 0));
  for (let i = 0; i < pollution; i++)
    s.battle.discard.push({ id: "impurity", level: 0 });
  if (pollution) log(s, `${enemy.name} 불순물 ${pollution}장 주입`);
}

export function executeSingleEnemyAction(s, enemyIndex, meta) {
  if (s.phase !== "battle" || !s.battle.enemyPhase) return null;
  const b = s.battle,
    enemy = b.enemies[enemyIndex];
  if (!enemy || enemy.hp <= 0 || !s.hp)
    return { enemyIndex, type: "dead", skipped: true };
  b.actingEnemy = enemyIndex;
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
    log(s, `기절 · ${enemy.name} 행동 취소`);
  } else if (enemy.intent.type === "attack" && S.restricted(enemy, "attacks")) {
    type = "disarm";
    skipped = true;
    log(s, `무장 해제 · ${enemy.name} 공격 취소`);
    if (enemy.stunResistance) enemy.stunResistance--;
  } else if (enemy.intent.type === "attack") {
    const hits = Math.max(1, Math.floor(enemy.intent.hits || 1));
    let result = { damage: 0, blocked: 0 };
    for (let hit = 0; hit < hits && s.hp; hit++) {
      const strike = hurtPlayer(s, enemy.intent.value, {
        attackPattern: enemy.intent.attackPattern || "contact",
        sourceEnemy: enemy,
      });
      result.damage += strike.damage;
      result.blocked += strike.blocked;
    }
    enemy.lastAction = result;
    b.lastEnemyAction = result;
    log(
      s,
      `${enemy.name} ${(enemy.intent.attackPattern || "contact") === "contact" ? "접촉" : "비접촉"} 공격 ${result.damage + result.blocked} · 방어 ${result.blocked}`,
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
  if (!skipped) executeIntentExtras(s, enemy);
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
    shieldGained: Math.max(0, enemy.shield - beforeEnemyShield),
    impurities: Math.max(0, b.discard.length - beforeDiscard),
    enemyDied: enemy.hp <= 0,
    playerDied: s.hp <= 0,
  };
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

const CARD_TIER_WEIGHTS = {
  0: [70, 24, 6, 0],
  1: [45, 38, 14, 3],
  2: [20, 45, 25, 10],
};
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
  const unlocked = meta?.unlocked || [],
    available = Object.keys(CARDS).filter((id) => {
      const card = CARDS[id];
      return id !== "impurity" && cardCount(s, id) < cardMaxCopies(card) &&
        (!UNLOCKS.some((unlock) => unlock.card === id) || UNLOCKS.some((unlock) => unlock.card === id && unlocked.includes(unlock.id)));
    }),
    chosen = [], weights = [...(CARD_TIER_WEIGHTS[Math.min(2, s.loop)] || CARD_TIER_WEIGHTS[2])],
    take = (pool) => {
      if (!pool.length) return false;
      const id = pick(s, pool);
      chosen.push(id);
      available.splice(available.indexOf(id), 1);
      return true;
      };
  const rareShift = Math.min(weights[0], Math.round(100 * power(s, "rareCardChance")));
  weights[0] -= rareShift;
  weights[1] += rareShift;
  if (guaranteeHighTier) take(available.filter((id) => CARDS[id].tier >= 3));
  while (chosen.length < 3 && available.length) {
    const eligibleWeights = weights.map((weight, index) =>
        available.some((id) => CARDS[id].tier === index + 1) ? weight : 0,
      );
    if (!eligibleWeights.some(Boolean)) break;
    const tier = weighted(s, eligibleWeights) + 1;
    take(available.filter((id) => CARDS[id].tier === tier));
  }
  return chosen;
}
function award(s, room, meta, victoryReward = false) {
  const t = TABLES[room];
  heal(s, t.heal);
  gainGold(s, t.gold + power(s, "goldBonus") + (victoryReward ? power(s, "roomClearTorch") : power(s, "chestExtraGold")) - (victoryReward ? power(s, "victoryGoldPenalty") : 0));
  milestones(s, meta);
  const id = rollLoot(s, room, meta);
  if (id) {
    addInventoryItem(s, id, meta);
  }
  s.reward = { room, item: id, heal: t.heal, gold: t.gold, cards: [] };
  s.phase = "reward";
}
export function openChest(s, meta) {
  if (s.phase === "chest") award(s, roomAt(s), meta);
}
function victory(s, meta) {
  meta.defeatedMonsters ??= [];
  for (const enemy of s.battle.enemies)
    if (!meta.defeatedMonsters.includes(enemy.id))
      meta.defeatedMonsters.push(enemy.id);
  meta.achievementStats ??= { totalHarmonies: 0, act2Clears: 0, impuritiesPurified: 0 };
  if (hasSynergy(s, "brass_scales_funnel")) {
    const convertedGold = Math.min(30, Math.floor(Math.max(0, s.battle.absorb) / 2));
    if (convertedGold > 0) {
      const gained = gainGold(s, convertedGold);
      log(s, `세트 효과 [황동 저울 깔때기]: 남은 흡수를 ${gained}골드로 환전`);
    }
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
      signature = defeatedBoss?.signatureReward;
    unlock(meta, "master", s);
    award(s, "boss", meta, true);
    s.reward.cards = cardOptions(s, meta, true);
    s.reward.cardPicksRemaining = 1;
    s.reward.cardPicksTotal = 1;
    s.reward.cardUnlocks = [...meta.unlocked];
    s.reward.itemAcknowledged = false;
    if (signature && ITEMS[signature]) {
      addInventoryItem(s, signature, meta);
      if (defeatedBoss.unlockId && !meta.unlocked.includes(defeatedBoss.unlockId))
        meta.unlocked.push(defeatedBoss.unlockId);
      s.reward.signatureItem = signature;
      s.reward.item = signature;
    }
    if (s.node === 11) s.won = true;
  } else if (room === "elite") {
    award(s, "elite", meta, true);
    s.reward.cards = cardOptions(s, meta, true);
    s.reward.cardPicksRemaining = 1;
    s.reward.cardPicksTotal = 1;
    s.reward.cardUnlocks = [...meta.unlocked];
    s.reward.itemAcknowledged = false;
  } else {
    const count = s.battle.enemies.length || 1,
      gold = Math.max(0, (15 + power(s, "goldBonus")) * count + power(s, "roomClearTorch") - power(s, "victoryGoldPenalty"));
    const recovery = s.loop >= 4 ? 3 : 5;
    heal(s, recovery);
    gainGold(s, gold);
    s.reward = {
      room: "battle",
      heal: recovery,
      gold,
      goldIncludesBonus: true,
      item: null,
      cards: cardOptions(s, meta),
      cardPicksRemaining: count,
      cardPicksTotal: count,
      cardUnlocks: [...meta.unlocked],
    };
    s.phase = "reward";
  }
}
export function advance(s, cardId = null, replaceIndex = null, meta = null) {
  if (s.phase !== "reward") return false;
  if (s.reward.item && s.reward.cards?.length && !s.reward.itemAcknowledged && !cardId) {
    s.reward.itemAcknowledged = true;
    return true;
  }
  if (cardId) {
    if (!s.reward.cards.includes(cardId)) return false;
    const excludedIndex = Number.isInteger(replaceIndex) ? replaceIndex : -1;
    if (cardCount(s, cardId, excludedIndex) >= cardMaxCopies(cardId)) return false;
    const card = { id: cardId, level: 0 };
    if (s.deck.length < deckLimit(s)) s.deck.push(card);
    else if (Number.isInteger(replaceIndex) && s.deck[replaceIndex])
      s.deck.splice(replaceIndex, 1, card);
    else return false;
    if (meta) milestones(s, meta);
    if (meta && !s.testMode) {
      meta.discoveredCards ??= [...new Set(STARTING_DECK)];
      if (!meta.discoveredCards.includes(cardId))
        meta.discoveredCards.push(cardId);
    }
    if (Number.isFinite(s.reward.cardPicksRemaining)) {
      s.reward.cardPicksRemaining--;
      if (s.reward.cardPicksRemaining > 0) {
        s.reward.cards = cardOptions(s, { unlocked: s.reward.cardUnlocks || [] });
        return true;
      }
    }
  } else if (Number.isFinite(s.reward.cardPicksRemaining)) {
    heal(s, power(s, "cardTransformReroll"));
    s.reward.cardPicksRemaining--;
    if (s.reward.cardPicksRemaining > 0) {
      s.reward.cards = cardOptions(s, { unlocked: s.reward.cardUnlocks || [] });
      return true;
    }
  }
  s.reward = null;
  s.battle = null;
  s.statuses = S.createStatuses();
  if (s.node === 11) {
    s.phase = "loop";
    return true;
  }
  s.node++;
  s.phase = "map";
  return true;
}
function rollRestChoices(s) {
  const eligible = s.deck
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.level < cardMaxUpgrade(card));
  return shuffle(s, eligible).slice(0, 5).map(({ index }) => index);
}
export function restCardChoices(s) {
  if (s.phase !== "rest") return [];
  if (!Array.isArray(s.restChoices)) s.restChoices = rollRestChoices(s);
  return s.restChoices.filter((index) => s.deck[index]);
}
export function rest(s, choice, index) {
  if (s.phase !== "rest") return;
  if (choice === "heal") { heal(s, Math.ceil(s.maxHp * 0.3)); s.nextOpeningShield = power(s, "restSiteOverheal"); }
  else if (choice === "upgrade" && restCardChoices(s).includes(index) && s.deck[index].level < cardMaxUpgrade(s.deck[index])) s.deck[index].level++;
  else return;
  s.restChoices = null;
  s.node++;
  s.phase = "map";
}
function canBuyShopCard(s, id) {
  return Boolean(CARDS[id]) && s.deck.length < deckLimit(s) && cardCount(s, id) < cardMaxCopies(id);
}

function canBuyShopAugment(s, id, meta = null) {
  const item = ITEMS[id];
  if (!item || item.signatureOnly || !isContentUnlocked(meta, "item", id)) return false;
  if (s.inventory.filter((ownedId) => ownedId === id).length >= item.maxOwned) return false;
  if (!["trait", "relic"].includes(item.kind) || item.stackable) return true;
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

export function rollShopOffers(s, meta = null) {
  const fallbackTable = [
      ...Object.keys(CARDS).filter((id) => id !== "impurity").map((id) => ({ type: "card", id })),
      ...Object.keys(ITEMS).map((id) => ({ type: "augment", id })),
    ],
    sourceTable = ATELIER_DROP_TABLE.length ? ATELIER_DROP_TABLE : fallbackTable,
    storefrontTier = (entry, product) => entry.type === "card"
      ? product?.tier
      : Number.isFinite(product?.tier) ? product.tier + 1 : NaN,
    available = shuffle(s, sourceTable).filter((entry) => {
    const product = entry?.type === "card" ? CARDS[entry.id] : ITEMS[entry?.id];
    const tier = storefrontTier(entry, product);
    if (!product || !Number.isFinite(ATELIER_TIER_PRICES[tier])) return false;
    return entry.type === "card"
      ? isContentUnlocked(meta, "card", entry.id) && canBuyShopCard(s, entry.id)
      : entry.type === "augment" && canBuyShopAugment(s, entry.id, meta);
  });
  const count = shopStockLimit(s);
  const selected = [];
  while (selected.length < count && available.length) {
    const rolledTier = weighted(s, TABLES.shop.tiers) + 1,
      matching = available.filter((entry) => {
        const product = entry.type === "card" ? CARDS[entry.id] : ITEMS[entry.id];
        return storefrontTier(entry, product) === rolledTier;
      }),
      entry = pick(s, matching.length ? matching : available);
    selected.push(entry);
    available.splice(available.indexOf(entry), 1);
  }
  s.shopOffers = selected.map((entry) => {
    const product = entry.type === "card" ? CARDS[entry.id] : ITEMS[entry.id];
    const tier = storefrontTier(entry, product);
    return {
      type: entry.type,
      id: entry.id,
      tier,
      basePrice: ATELIER_TIER_PRICES[tier],
      sold: false,
    };
  });
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
      ? canBuyShopCard(s, offer.id)
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

function availableItems(s, room, predicate = () => true, meta = null) {
  return Object.values(ITEMS).filter(
    (item) => {
      const allowed = Array.isArray(item.rooms) ? item.rooms : [item.room || "gather"],
        matched = allowed.includes(room) || allowed.includes("all") ||
          (["gather", "golden"].includes(room) && allowed.includes("treasure"));
      return matched && item.kind !== "curse" && isContentUnlocked(meta, "item", item.id) &&
      !item.signatureOnly &&
      predicate(item) &&
      s.inventory.filter((id) => id === item.id).length < item.maxOwned &&
      (!(["trait", "relic"].includes(item.kind) && !item.stackable) ||
        item.tier > Math.max(-1, ...s.inventory
          .map((id) => ITEMS[id])
          .filter((owned) => owned?.kind === item.kind && (owned.family || owned.effect) === (item.family || item.effect))
          .map((owned) => owned.tier)));
    },
  );
}
function grantSpecialItem(s, meta, room, predicate) {
  const pool = availableItems(s, room, predicate, meta);
  const fallback = availableItems(s, room, () => true, meta);
  const item = pick(s, pool.length ? pool : fallback);
  if (!item) return null;
  return addInventoryItem(s, item.id, meta) ? item.id : null;
}
function specialDone(s, text, item = null) {
  s.specialResult = { text, item };
  return true;
}
export function chooseSpecial(s, choice, meta, index = null, note = null) {
  const room = roomAt(s);
  if (s.phase !== room || s.specialResult) return false;
  if (room === "mystery") {
    if (choice === "safe") {
      const item = grantSpecialItem(s, meta, "gather", (i) => i.tier === 0);
      return specialDone(s, "봉인이 조용히 풀리고 온전한 원료가 모습을 드러냈습니다.", item);
    }
    if (choice === "gamble") {
      if (random(s) < 0.6) {
        const item = grantSpecialItem(s, meta, "golden", (i) => i.kind === "relic" && i.tier >= 2);
        gainGold(s, 50);
        return specialDone(s, "자물쇠를 부수고 진귀한 유물과 50골드를 챙겼습니다!", item);
      }
      s.hp = Math.max(1, s.hp - 15);
      s.pendingImpurities = (s.pendingImpurities || 0) + 2;
      return specialDone(s, "함정이 터졌습니다! 체력 -15, 다음 전투에 불순물 2장이 스며듭니다.");
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
    if (choice === "reach") {
      s.maxHp = Math.max(1, s.maxHp - 10);
      s.hp = Math.min(s.hp, s.maxHp);
      const item = grantSpecialItem(s, meta, "boss", (i) => i.kind === "relic");
      return specialDone(s, "웅덩이가 최대 체력 10을 삼킨 대신 보스급 유물을 밀어 올렸습니다.", item);
    }
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
      const name = CARDS[s.deck[index].id].name;
      const purified = s.deck[index].id === "impurity" ? 1 : 0;
      s.deck.splice(index, 1);
      recordPurifiedImpurities(meta, s, purified);
      return specialDone(s, `${name} 카드를 용매로 씻어 영구 제거했습니다.`);
    }
  }
  if (room === "mercury_still") {
    if (choice === "overload") {
      s.eventPowers ??= {};
      s.eventPowers.turnBaseAp = (s.eventPowers.turnBaseAp || 0) + 1;
      s.eventTurnHpLoss = (s.eventTurnHpLoss || 0) + 2;
      return specialDone(s, "수은 밸브를 열어 턴 시작 AP +1을 얻었지만, 매 턴 체력을 2 잃습니다.");
    }
    if (choice === "purify") {
      gainGold(s, 30);
      return specialDone(s, "정제된 수은 증기를 팔아 30골드를 얻었습니다.");
    }
    if (choice === "skip") return specialDone(s, "폭발 위험이 도사리는 증류기를 지나쳤습니다.");
  }
  if (room === "blood_altar") {
    if (choice === "sacrifice") {
      const cost = Math.floor(s.maxHp * 0.4);
      s.hp = Math.max(1, s.hp - cost);
      const item = grantSpecialItem(s, meta, "boss", (i) => i.kind === "relic" && i.tier >= 2);
      return specialDone(s, `피의 제단에 체력 ${cost}을 바치고 보스급 유물을 얻었습니다.`, item);
    }
    if (choice === "tribute" && spendGold(s, 40)) {
      const item = grantSpecialItem(s, meta, "golden", (i) => i.kind === "trait");
      return specialDone(s, "40골드를 공양하고 강력한 특성을 전수받았습니다.", item);
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
      const item = grantSpecialItem(s, meta, "boss", (i) => i.tier >= 2);
      const tainted = random(s) < 0.3;
      if (tainted) s.pendingImpurities = (s.pendingImpurities || 0) + 1;
      return specialDone(s, `운명의 주사위가 고급 전리품을 불러냈습니다${tainted ? ". 불순물 1장도 따라붙었습니다." : "!"}`, item);
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
    if (choice === "duplicate" && s.deck[index] && s.deck.length < deckLimit(s) &&
      cardCount(s, s.deck[index].id) < cardMaxCopies(s.deck[index].id)) {
      const card = structuredClone(s.deck[index]);
      s.hp = Math.max(1, s.hp - 10);
      s.deck.push(card);
      return specialDone(s, `체력 10을 바쳐 ${CARDS[card.id].name} 카드를 복제했습니다.`);
    }
    if (choice === "gold_double") {
      const bonus = Math.floor(s.gold * 0.3);
      gainGold(s, bonus);
      return specialDone(s, `거울 속 금화가 쏟아져 나와 ${bonus}골드를 얻었습니다.`);
    }
    if (choice === "skip") return specialDone(s, "거울을 들여다보지 않고 통과했습니다.");
  }
  if (room === "smuggler") {
    if (choice === "contraband" && spendGold(s, 40)) {
      const item = grantSpecialItem(s, meta, "boss", (i) => i.kind === "relic");
      return specialDone(s, "40골드로 보스급 밀수 유물을 거래했습니다.", item);
    }
    if (choice === "blood_trade") {
      s.maxHp = Math.max(1, s.maxHp - 10);
      s.hp = Math.min(s.hp, s.maxHp);
      const item = grantSpecialItem(s, meta, "golden", (i) => i.kind === "trait" && i.tier >= 1);
      return specialDone(s, "최대 체력 10을 넘기고 고급 특성을 얻었습니다.", item);
    }
    if (choice === "skip") return specialDone(s, "수상한 밀수꾼을 모른 척 지나쳤습니다.");
  }
  return false;
}
export function leaveSpecial(s) {
  if (!["mystery", "greenhouse", "curse_pit", "lab", "mercury_still", "blood_altar", "dice_altar", "purify_furnace", "mirror_doppel", "smuggler"].includes(s.phase) || !s.specialResult)
    return false;
  s.specialResult = null;
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
  s.route = generateRoute(s);
  s.resolvedRooms = Array(12).fill(null);
  s.currentSubRoom = null;
  heal(s, s.maxHp);
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

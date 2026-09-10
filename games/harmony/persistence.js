import { CARDS, ENEMIES, ITEMS, LEGACY_BETA_ITEMS, UNLOCKS } from "./data.js";
import { attachEnemyAliases, deckLimit, freshMeta } from "./engine.js";
import { STATUS_DEFINITIONS } from "./statuses.js";
import { HIDDEN_SYNERGIES } from "./synergies.js";

export const SAVE_SCHEMA = 2;
export const SAVE_KEYS = {
  primary: "gyeolideun-harmony-save-v2",
  backup: "gyeolideun-harmony-save-v2-backup",
  temporary: "gyeolideun-harmony-save-v2-temporary",
  legacy: "gyeolideun-harmony-prototype-v1",
};
const PHASES = new Set([
  "map",
  "battle",
  "chest",
  "reward",
  "rest",
  "shop",
  "loop",
  "result",
  "mystery",
  "greenhouse",
  "curse_pit",
  "lab",
]);
const ROOMS = new Set([
  "combat", "treasure",
  "battle",
  "elite",
  "gather",
  "golden",
  "boss",
  "rest",
  "shop",
  "mystery",
  "greenhouse",
  "curse_pit",
  "lab",
]);
const finite = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const unique = (values) => [...new Set(values)];

function checksum(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function normalizeMeta(value = {}) {
  const base = freshMeta();
  const deckCounts = {};
  const lastStartingDeck =
    Array.isArray(value.lastStartingDeck) &&
    value.lastStartingDeck.length === 10 &&
    value.lastStartingDeck.every((id) => {
      const card = CARDS[id];
      if (!card || card.tier !== 1) return false;
      deckCounts[id] = (deckCounts[id] || 0) + 1;
      return deckCounts[id] <= card.maxCopies;
    })
      ? [...value.lastStartingDeck]
      : null;
  return {
    ...base,
    totalRuns: Math.max(0, Math.floor(finite(value.totalRuns))),
    highScore: Math.max(0, Math.floor(finite(value.highScore))),
    highestLoop: Math.max(0, Math.floor(finite(value.highestLoop))),
    unlocked: unique(
      Array.isArray(value.unlocked)
        ? value.unlocked.filter((id) => UNLOCKS.some((item) => item.id === id))
        : [],
    ),
    discovered: unique(
      Array.isArray(value.discovered)
        ? value.discovered.filter((id) => ITEMS[id])
        : [],
    ),
    discoveredCards: unique([
      ...base.discoveredCards,
      ...(Array.isArray(value.discoveredCards)
        ? value.discoveredCards.filter((id) => CARDS[id] && id !== "impurity")
        : []),
    ]),
    defeatedMonsters: unique(
      Array.isArray(value.defeatedMonsters)
        ? value.defeatedMonsters.filter((id) => ENEMIES[id])
        : [],
    ),
    synergies: unique(
      Array.isArray(value.synergies)
        ? value.synergies.filter((id) => HIDDEN_SYNERGIES[id]?.requires.every((itemId) => ITEMS[itemId]))
        : [],
    ),
    lastStartingDeck,
  };
}
function validCard(card) {
  return (
    card && CARDS[card.id] && Number.isFinite(card.level) && card.level >= 0
  );
}
function normalizeStatuses(value) {
  const statuses = {};
  if (!value || typeof value !== "object") return statuses;
  for (const [id, status] of Object.entries(value)) {
    const definition = STATUS_DEFINITIONS[id],
      amount = Math.floor(finite(status?.stacks));
    if (!definition || definition.instant || amount <= 0) continue;
    const normalized = { stacks: clamp(amount, 1, definition.maxStacks) };
    if (definition.defaultTurns) {
      const remaining = Math.floor(finite(status?.turns));
      if (remaining <= 0) continue;
      normalized.turns = clamp(remaining, 1, definition.maxTurns);
    }
    for (const key of ["notes", "cardTypes", "cardIds"])
      if (Array.isArray(status?.[key]))
        normalized[key] = unique(
          status[key].filter((value) => typeof value === "string"),
        );
    if (status?.deferDecayTurnEnd) normalized.deferDecayTurnEnd = true;
    if (status?.deferDurationTurnEnd)
      normalized.deferDurationTurnEnd = true;
    if (Number.isFinite(status?.modifierPerStack))
      normalized.modifierPerStack = status.modifierPerStack;
    if (Number.isFinite(status?.deferDecayTurns))
      normalized.deferDecayTurns = Math.max(0, Math.floor(status.deferDecayTurns));
    if (typeof status?.description === "string")
      normalized.description = status.description;
    statuses[id] = normalized;
  }
  return statuses;
}
function normalizeIntent(value) {
  if (
    !value ||
    !["attack", "guard", "pollute", "debuff"].includes(value.type) ||
    (value.type !== "debuff" && !Number.isFinite(value.value))
  )
    return null;
  const intent = { ...value, value: Math.max(0, finite(value.value)) };
  if (
    intent.type === "attack" &&
    !["contact", "nonContact"].includes(intent.attackPattern)
  )
    intent.attackPattern = "contact";
  return intent;
}
function normalizeEnemy(value, fallback = {}) {
  if (!value || !Number.isFinite(value.hp) || !Number.isFinite(value.maxHp))
    return null;
  const intent = normalizeIntent(value.intent || fallback.intent);
  return {
    id: typeof value.id === "string" ? value.id : fallback.id || "normal",
    name:
      typeof value.name === "string"
        ? value.name
        : fallback.name || "알 수 없는 향",
    hp: Math.max(0, finite(value.hp)),
    maxHp: Math.max(1, finite(value.maxHp, 1)),
    shield: Math.max(0, finite(value.shield, fallback.shield)),
    intent,
    statuses: normalizeStatuses(value.statuses || fallback.statuses),
    isElite: Boolean(value.isElite ?? fallback.isElite),
    isBoss: Boolean(value.isBoss ?? fallback.isBoss),
    stun: Math.max(0, Math.floor(finite(value.stun))),
    stunResistance: clamp(Math.floor(finite(value.stunResistance)), 0, 1),
    lastAction: value.lastAction || null,
    pattern: Array.isArray(value.pattern) ? structuredClone(value.pattern) : null,
    unlockId: typeof value.unlockId === "string" ? value.unlockId : null,
    signatureReward:
      typeof value.signatureReward === "string" ? value.signatureReward : null,
    scaleWithAct: value.scaleWithAct !== false,
    scaleAttackWithAct: value.scaleAttackWithAct !== false,
    loopPattern: Boolean(value.loopPattern),
    phase2: Boolean(value.phase2),
  };
}
function normalizeBattle(value) {
  if (
    !value ||
    !Array.isArray(value.hand) ||
    !Array.isArray(value.draw) ||
    !Array.isArray(value.discard)
  )
    return null;
  const piles = ["hand", "draw", "discard"];
  if (piles.some((name) => !value[name].every(validCard))) return null;
  const legacyEnemy = normalizeEnemy(
    {
      id: value.enemyId,
      name: value.enemyName,
      hp: value.hp,
      maxHp: value.maxHp,
      shield: value.enemyShield,
      intent: value.intent,
      statuses: value.statuses,
      isElite: value.elite,
      isBoss: value.boss,
      stun: value.stun,
      stunResistance: value.stunResistance,
    },
    {},
  );
  const enemies = (Array.isArray(value.enemies) ? value.enemies : [])
    .slice(0, 3)
    .map((enemy) => normalizeEnemy(enemy))
    .filter(Boolean);
  if (!enemies.length && legacyEnemy) enemies.push(legacyEnemy);
  if (!enemies.length || enemies.some((enemy) => enemy.hp > 0 && !enemy.intent))
    return null;
  return attachEnemyAliases({
    ...value,
    enemies,
    selectedTarget: clamp(
      Math.floor(finite(value.selectedTarget)),
      0,
      enemies.length - 1,
    ),
    // Mid-animation saves resume safely at the player phase instead of staying locked.
    enemyPhase: false,
    actingEnemy: null,
    completedEnemies: [],
    shield: Math.max(0, finite(value.shield)),
    absorb: clamp(finite(value.absorb), 0, 100),
    contactCardsPlayedThisBattle: Math.max(0, Math.floor(finite(value.contactCardsPlayedThisBattle))),
    cardsPlayedThisTurn: Math.max(0, Math.floor(finite(value.cardsPlayedThisTurn))),
    turn: Math.max(1, Math.floor(finite(value.turn, 1))),
    ap: Math.max(0, finite(value.ap)),
    notes: Array.isArray(value.notes) ? value.notes.filter(validCard) : [],
  });
}
function normalizeRun(value) {
  if (
    !value ||
    !Array.isArray(value.deck) ||
    !value.deck.length ||
    !value.deck.every(validCard) ||
    !Array.isArray(value.inventory) ||
    value.inventory.some((id) => !ITEMS[id] && !LEGACY_BETA_ITEMS[id])
  )
    return null;
  const node = Math.floor(finite(value.node, -1));
  if (node < 0 || node > 11 || !PHASES.has(value.phase)) return null;
  const route =
    Array.isArray(value.route) &&
    value.route.length === 12 &&
    value.route.every((room) => ROOMS.has(room))
      ? [...value.route]
      : null;
  if (!route) return null;
  const resolvedRooms = Array.isArray(value.resolvedRooms) && value.resolvedRooms.length === 12
    ? value.resolvedRooms.map((room) => room === null || ROOMS.has(room) ? room : null)
    : Array(12).fill(null);
  const battle = normalizeBattle(value.battle);
  if (value.phase === "battle" && !battle) return null;
  if (
    value.phase === "reward" &&
    (!value.reward || !Array.isArray(value.reward.cards))
  )
    return null;
  const maxHp = Math.max(1, finite(value.maxHp, 80)),
    inventory = [],
    strongest = new Map();
  for (const id of value.inventory.filter((itemId) => ITEMS[itemId])) {
    const item = ITEMS[id];
    if (!["trait", "relic"].includes(item.kind) || item.stackable) {
      if (inventory.filter((ownedId) => ownedId === id).length < item.maxOwned)
        inventory.push(id);
      continue;
    }
    const key = `${item.kind}:${item.family || item.effect}`,
      previousIndex = strongest.get(key);
    if (previousIndex === undefined) {
      strongest.set(key, inventory.length);
      inventory.push(id);
    } else if (ITEMS[inventory[previousIndex]].tier < item.tier) {
      inventory[previousIndex] = id;
    }
  }
  const limit = deckLimit({ ...value, inventory });
  return {
    ...value,
    version: 2,
    node,
    route,
    resolvedRooms,
    currentSubRoom: typeof value.currentSubRoom === "string" && ROOMS.has(value.currentSubRoom)
      ? value.currentSubRoom : resolvedRooms[node],
    hp: clamp(finite(value.hp, maxHp), 0, maxHp),
    maxHp,
    gold: Math.max(0, Math.floor(finite(value.gold))),
    score: Math.max(0, Math.floor(finite(value.score))),
    potions: Math.max(0, Math.floor(finite(value.potions))),
    loop: Math.max(0, Math.floor(finite(value.loop))),
    rng: finite(value.rng) >>> 0,
    seed: finite(value.seed) >>> 0,
    inventory,
    deck: value.deck
      .slice(0, value.testMode ? value.deck.length : limit)
      .map((card) => ({ ...card, level: Math.floor(card.level) })),
    battle,
    reward: value.reward ? {
      ...value.reward,
      item: ITEMS[value.reward.item] ? value.reward.item : null,
      signatureItem: ITEMS[value.reward.signatureItem] ? value.reward.signatureItem : null,
    } : null,
    statuses: normalizeStatuses(value.statuses),
    stunResistance: clamp(Math.floor(finite(value.stunResistance)), 0, 1),
    log: Array.isArray(value.log)
      ? value.log.filter((entry) => typeof entry === "string").slice(0, 12)
      : [],
    maxHit: Math.max(0, finite(value.maxHit)),
    won: Boolean(value.won),
    finished: Boolean(value.finished),
  };
}
function normalizePayload(value) {
  if (!value || typeof value !== "object") return null;
  const run = value.run === null ? null : normalizeRun(value.run);
  if (value.run !== null && !run) return null;
  return { meta: normalizeMeta(value.meta), run };
}
function parseEnvelope(raw) {
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw);
    if (
      envelope?.schemaVersion !== SAVE_SCHEMA ||
      !Number.isFinite(envelope.revision) ||
      !envelope.payload
    )
      return null;
    const payloadText = JSON.stringify(envelope.payload);
    if (envelope.checksum !== checksum(payloadText)) return null;
    const payload = normalizePayload(envelope.payload);
    return payload
      ? {
          payload,
          revision: Math.max(0, Math.floor(envelope.revision)),
          savedAt: finite(envelope.savedAt),
        }
      : null;
  } catch {
    return null;
  }
}
export function loadGame(storage) {
  const candidates = [SAVE_KEYS.primary, SAVE_KEYS.temporary, SAVE_KEYS.backup]
    .map((key) => ({ key, data: parseEnvelope(storage.getItem(key)) }))
    .filter((candidate) => candidate.data)
    .sort(
      (a, b) =>
        b.data.revision - a.data.revision || b.data.savedAt - a.data.savedAt,
    );
  if (candidates.length)
    return {
      ...candidates[0].data.payload,
      revision: candidates[0].data.revision,
      recovered: candidates[0].key !== SAVE_KEYS.primary,
      source: candidates[0].key,
    };
  try {
    const legacy = normalizePayload(
      JSON.parse(storage.getItem(SAVE_KEYS.legacy)),
    );
    if (legacy)
      return {
        ...legacy,
        revision: 0,
        recovered: false,
        source: SAVE_KEYS.legacy,
        migrated: true,
      };
  } catch {}
  return {
    meta: freshMeta(),
    run: null,
    revision: 0,
    recovered: false,
    source: null,
  };
}
export function saveGame(storage, state, revision = 0) {
  const payload = normalizePayload(state);
  if (!payload) throw new Error("Invalid save data");
  const nextRevision = Math.max(0, Math.floor(revision)) + 1,
    payloadText = JSON.stringify(payload),
    envelope = JSON.stringify({
      schemaVersion: SAVE_SCHEMA,
      revision: nextRevision,
      savedAt: Date.now(),
      payload,
      checksum: checksum(payloadText),
    });
  storage.setItem(SAVE_KEYS.temporary, envelope);
  const current = storage.getItem(SAVE_KEYS.primary);
  if (parseEnvelope(current)) storage.setItem(SAVE_KEYS.backup, current);
  storage.setItem(SAVE_KEYS.primary, envelope);
  storage.removeItem(SAVE_KEYS.temporary);
  return nextRevision;
}

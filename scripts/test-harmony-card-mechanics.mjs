import assert from "node:assert/strict";
import { OFFICIAL_CARDS } from "../games/harmony/data.js";
import { STATUS_DEFINITIONS } from "../games/harmony/statuses.js";
import {
  AILMENT_STATUS_IDS,
  cardStatusMechanicIds,
  deriveCardMechanics,
} from "../games/harmony/card-mechanics.js";
import { createCardPresentation } from "../games/harmony/card-presentation-base.js";

assert.equal(
  Object.keys(OFFICIAL_CARDS).length,
  134,
  "the mechanic audit must cover all 134 official active cards",
);

const STATUS_MAP_FIELDS = [
  "applyEnemy",
  "applyPlayer",
  "applyEnemyAfterAttack",
  "onHitApplyEnemy",
  "absorbThresholdApplyAllEnemy",
  "thresholdApplyAllEnemy",
  "thornsApplyAttacker",
];

const STAGED_REFUND_STATUSES = {
  ailmentTypes2: AILMENT_STATUS_IDS,
  ailmentTypes3: AILMENT_STATUS_IDS,
  regenerationBefore: ["regeneration"],
  targetBleed4Before: ["bleed"],
};

function expectedStatusIds(card) {
  const ids = new Set(),
    add = (id) => {
      if (id) ids.add(id);
    },
    addMap = (map) => Object.keys(map || {}).forEach(add),
    addAilments = () => AILMENT_STATUS_IDS.forEach(add);

  STATUS_MAP_FIELDS.forEach((field) => addMap(card[field]));
  Object.values(card.conditionalEnemyIntent || {}).forEach(addMap);
  Object.keys(card.bonusPerStatus || {}).forEach(add);

  if (card.chanceStatusOnHit?.id) add(card.chanceStatusOnHit.id);
  if (card.applyWeak || card.weakOnHit) add("weak");
  if (card.thorns) add("thorns");
  if (card.stunOrDisarmBossTurns) {
    add("stun");
    add("disarm");
  }
  if (card.applyEnemyIfPreAttackStatus) {
    add(card.applyEnemyIfPreAttackStatus.statusId);
    addMap(card.applyEnemyIfPreAttackStatus.apply);
  }
  if (card.consumeResonance) add("resonance");
  if (card.burnProcCount) add("burning");
  if (card.discardAttackBurn || card.discardedRandomBurn) add("burning");
  if (
    card.ailmentBurstMultiplier ||
    card.globalAilmentBurstMultiplier ||
    card.amplifyAilments ||
    card.cleanseAilmentStacks
  )
    addAilments();
  if (card.extendDecayStatuses) {
    add("poison");
    add("corrosion");
  }
  if (card.burst) add("stun");
  for (const id of STAGED_REFUND_STATUSES[card.stagedRefund] || []) add(id);
  if (
    Object.entries(card).some(
      ([key, value]) =>
        key.startsWith("resonance") &&
        (Array.isArray(value)
          ? value.some(Boolean)
          : value && typeof value === "object"
            ? Object.keys(value).length > 0
            : Boolean(value)),
    )
  )
    add("resonance");

  return ids;
}

const engine = {
  cardDefinition(card) {
    return OFFICIAL_CARDS[card.id];
  },
  power() {
    return 0;
  },
  cardStatusValueBreakdown() {
    return { delta: 0 };
  },
  cost(_run, card) {
    return OFFICIAL_CARDS[card.id].cost;
  },
};

const presentation = createCardPresentation({
  engine,
  cards: OFFICIAL_CARDS,
  statusDefinitions: STATUS_DEFINITIONS,
  getRun: () => null,
  getStarted: () => false,
  tierStars: () => "",
});

let auditedStatusCards = 0,
  auditedPierceCards = 0;
for (const card of Object.values(OFFICIAL_CARDS)) {
  const expected = expectedStatusIds(card),
    mechanics = deriveCardMechanics(card),
    statusIds = cardStatusMechanicIds(card);

  assert.equal(
    mechanics.size,
    new Set(mechanics).size,
    `${card.id}: mechanic tags must be Set-deduped`,
  );
  assert.equal(
    statusIds.length,
    new Set(statusIds).size,
    `${card.id}: each status mechanic tag must appear once`,
  );

  for (const id of expected) {
    assert.ok(
      STATUS_DEFINITIONS[id],
      `${card.id}: expected status ${id} must exist in STATUS_DEFINITIONS`,
    );
    assert.ok(
      mechanics.has(`status:${id}`),
      `${card.id}: gameplay field requires status:${id} mechanic tag`,
    );
  }

  assert.deepEqual(
    new Set(statusIds),
    expected,
    `${card.id}: derived status mechanics must exactly match gameplay-definition status interactions`,
  );

  const expectsPierce = Boolean(
    card.bypassShield ||
      card.thresholdBypassShield ||
      card.resonanceChainSplashPerStack ||
      card.ailmentBurstMultiplier ||
      card.globalAilmentBurstMultiplier,
  );
  if (expectsPierce) {
    auditedPierceCards += 1;
    assert.ok(
      mechanics.has("shieldPierce"),
      `${card.id}: intrinsic shield-bypassing damage must derive shieldPierce`,
    );
  }

  const summary = presentation.compactCardEffectSummary({
    id: card.id,
    level: 0,
  });
  assert.ok(summary, `${card.id}: official active card must have compact presentation`);

  if (expectsPierce)
    assert.match(
      summary.symbols,
      /title="방어막 관통"[^>]*>⟐<\/em>/,
      `${card.id}: intrinsic shield-piercing damage must render the existing pierce badge`,
    );

  if (!expected.size) continue;
  auditedStatusCards += 1;

  for (const id of expected) {
    const matches =
      summary.symbols.match(
        new RegExp(`data-card-status-id="${id.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&")}"`, "g"),
      ) || [];
    assert.equal(
      matches.length,
      1,
      `${card.id}: status:${id} must render exactly one existing compact badge`,
    );
    assert.match(
      summary.symbols,
      new RegExp(
        `data-card-status-id="${id}"[^>]*--card-status-color:${STATUS_DEFINITIONS[id].color.replace("#", "\\#")}`,
      ),
      `${card.id}: ${id} badge must reuse STATUS_DEFINITIONS color`,
    );
  }
}

// Generic cleanse must stay one cleanse mechanic instead of expanding every debuff.
const genericCleanse = deriveCardMechanics({ cleanse: "all" });
assert.ok(genericCleanse.has("cleanse"));
assert.equal(
  [...genericCleanse].filter((tag) => tag.startsWith("status:")).length,
  0,
  "generic cleanse must not manufacture individual status tags",
);

// Field-based representative invariants.
assert.ok(
  deriveCardMechanics({ applyEnemy: { burning: 3 } }).has("status:burning"),
);
assert.ok(
  deriveCardMechanics({ bonusPerStatus: { burning: 1 } }).has("status:burning"),
);
assert.ok(
  deriveCardMechanics({ consumeResonance: 3 }).has("status:resonance"),
);
assert.ok(
  deriveCardMechanics({
    applyEnemyIfPreAttackStatus: {
      statusId: "burning",
      apply: { bleed: 1 },
    },
  }).has("status:burning"),
);
assert.ok(
  deriveCardMechanics({
    applyEnemyIfPreAttackStatus: {
      statusId: "burning",
      apply: { bleed: 1 },
    },
  }).has("status:bleed"),
);
for (const id of AILMENT_STATUS_IDS)
  assert.ok(
    deriveCardMechanics({ ailmentBurstMultiplier: 3 }).has(`status:${id}`),
  );

for (const fieldCard of [
  { bypassShield: true },
  { thresholdBypassShield: true },
  { resonanceChainSplashPerStack: 2 },
  { ailmentBurstMultiplier: 3 },
  { globalAilmentBurstMultiplier: 3 },
])
  assert.ok(
    deriveCardMechanics(fieldCard).has("shieldPierce"),
    "every intrinsic bypass-shield card field must derive shieldPierce",
  );

assert.ok(auditedStatusCards > 0);
assert.ok(auditedPierceCards > 0);
console.log(
  `PASS Harmony card mechanic audit: 134 official active cards checked; ${auditedStatusCards} status-interacting cards share canonical mechanic tags/badges; ${auditedPierceCards} intrinsic pierce cards share shieldPierce metadata/badge.`,
);

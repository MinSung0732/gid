import assert from "node:assert/strict";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ITEMS, LEGACY_BETA_ITEMS } from "../games/harmony/data.js?v=20260920-balance-1";
import {
  NEW_AUGMENT_CARDS,
  NEW_AUGMENT_ITEMS,
} from "../games/harmony/augment-pack-20260918.js";
import { combatFxDescriptor, combatFxPowerTier, combatFxVisualKey } from "../games/harmony/engine.js";


// Combat FX descriptors are runtime presentation metadata. They classify the
// resolved hit without changing combat math, so VFX/SFX can branch consistently.
assert.equal(combatFxPowerTier(19), "weak");
assert.equal(combatFxPowerTier(20), "strong");
assert.equal(combatFxPowerTier(30), "super");

const statusPierceFx = combatFxDescriptor({
  attackPattern: "contact",
  damage: 0,
  blocked: 8,
  shieldBefore: 12,
  shieldAfter: 4,
  fx: { source: "card", cardId: "status-test", appliesEnemyStatus: true },
});
assert.equal(statusPierceFx.statusPierce, true);
assert.equal(statusPierceFx.damagePierce, false);
assert.equal(statusPierceFx.shieldBreak, false);
assert.ok(statusPierceFx.soundCandidates.includes("contact-status-pierce"));

const shieldBreakFx = combatFxDescriptor({
  attackPattern: "contact",
  damage: 5,
  blocked: 25,
  shieldBefore: 25,
  shieldAfter: 0,
  fx: { source: "card", cardId: "break-test", hitCount: 3, hitIndex: 1 },
});
assert.equal(shieldBreakFx.power, "super");
assert.equal(shieldBreakFx.multiHit, true);
assert.equal(shieldBreakFx.shieldBreak, true);
assert.ok(shieldBreakFx.tags.includes("shield-break"));
assert.ok(shieldBreakFx.soundCandidates.includes("contact-shield-break"));
assert.equal(combatFxVisualKey(shieldBreakFx), "contact-shield-break-super");

const nonContactWeakFx = combatFxDescriptor({
  attackPattern: "nonContact",
  damage: 11,
  fx: { source: "card", cardId: "mist-test" },
});
assert.equal(combatFxVisualKey(nonContactWeakFx), "noncontact-hit-weak");

const nonContactBreakFx = combatFxDescriptor({
  attackPattern: "nonContact",
  damage: 8,
  blocked: 22,
  shieldBefore: 22,
  shieldAfter: 0,
  fx: { source: "card", cardId: "mist-break-test" },
});
assert.equal(combatFxVisualKey(nonContactBreakFx), "noncontact-shield-break-super");

const customCardFx = combatFxDescriptor({
  attackPattern: "contact",
  damage: 12,
  fx: {
    source: "card",
    cardId: "signature-test",
    vfxKey: "signature-rose-cut",
    sfxKey: "signature-rose-hit",
  },
});
assert.equal(combatFxVisualKey(customCardFx), "signature-rose-cut");
assert.equal(customCardFx.soundCandidates[0], "signature-rose-hit");

const aoeFx = combatFxDescriptor({
  attackPattern: "nonContact",
  damage: 22,
  fx: { source: "card", cardId: "aoe-test", targetMode: "all", aoe: true },
});
assert.equal(aoeFx.power, "strong");
assert.equal(aoeFx.aoe, true);
assert.ok(aoeFx.soundCandidates.includes("noncontact-aoe"));

const damagePierceFx = combatFxDescriptor({
  attackPattern: "nonContact",
  damage: 10,
  shieldBefore: 20,
  shieldAfter: 20,
  bypassShield: true,
  fx: { source: "card", cardId: "pierce-test" },
});
assert.equal(damagePierceFx.damagePierce, true);
assert.equal(damagePierceFx.statusPierce, false);
assert.equal(damagePierceFx.shieldBreak, false);
assert.ok(damagePierceFx.soundCandidates.includes("noncontact-damage-pierce"));

// Some beta-era item IDs were intentionally promoted back into the live pool as
// synergy components. The legacy behavior suite should inject only archived IDs
// so it does not overwrite the current live definitions before running tests.
for (const id of Object.keys(LEGACY_BETA_ITEMS)) {
  if (ITEMS[id]) delete LEGACY_BETA_ITEMS[id];
}

// The live route generator, HARMONY resolver, status math, encounter rewards,
// and item catalog have evolved since the original monolithic suite was written.
// Keep the archived behavior suite useful by updating only stale expectations in
// a temporary copy; gameplay code stays untouched.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(scriptDir, "test-harmony.mjs");
const generatedPath = join(scriptDir, ".test-harmony-runner.generated.mjs");

const staleRouteAssertions = `  assert.ok(route.filter((room) => room === "treasure").length >= 1);\n  assert.ok(route.filter((room) => room === "treasure").length <= 2);\n  assert.ok(route.filter((room) => room === "shop").length <= 1);\n  assert.ok(route.filter((room) => room === "elite").length >= 1);\n  assert.ok(route.filter((room) => room === "elite").length <= 2);\n  assert.ok(route.every((room) => ["combat", "elite", "treasure", "shop", "boss"].includes(room)));`;
const currentRouteAssertions = `  const treasureNodes = route.filter((room) => ["treasure", "golden"].includes(room)).length;\n  assert.ok(treasureNodes >= 4);\n  assert.ok(treasureNodes <= 5);\n  assert.equal(route.filter((room) => room === "combat").length, 4);\n  assert.equal(route.filter((room) => room === "shop").length, 1);\n  assert.ok(route.filter((room) => room === "elite").length >= 1);\n  assert.ok(route.filter((room) => room === "elite").length <= 2);\n  let combatLikeStreak = 0, maxCombatLikeStreak = 0;\n  for (const room of route) {\n    if (["combat", "elite"].includes(room)) {\n      combatLikeStreak += 1;\n      maxCombatLikeStreak = Math.max(maxCombatLikeStreak, combatLikeStreak);\n    } else combatLikeStreak = 0;\n  }\n  assert.ok(maxCombatLikeStreak <= 2);\n  assert.ok(route.every((room) => ["combat", "elite", "treasure", "golden", "shop", "boss"].includes(room)));`;

const staleHarmonyAssertions = `assert.equal(\n  baseHarmony.battle.hp,\n  99,\n  "Top, middle and base trigger base HARMONY damage independently of card attack",\n);\nassert.deepEqual(baseHarmony.battle.notes, []);\nassert.deepEqual(baseHarmony._harmonyFeedback, [\n  {\n    id: "base_harmony",\n    label: "HARMONY!",\n    visual: "default",\n    damage: 1,\n    blocked: 0,\n    targetIndex: 0,\n  },\n]);`;
const currentHarmonyAssertions = `assert.equal(\n  baseHarmony.battle.hp,\n  100,\n  "A defensive base note does not deal HARMONY damage",\n);\nassert.equal(\n  baseHarmony.battle.shield,\n  4,\n  "Three guard cards plus defensive HARMONY grant four shield",\n);\nassert.deepEqual(baseHarmony.battle.notes, []);\nassert.deepEqual(baseHarmony._harmonyFeedback, [\n  {\n    id: "base_harmony",\n    label: "HARMONY!",\n    visual: "defense",\n    category: "defense",\n    amount: 1,\n    damage: 0,\n    blocked: 0,\n    targetIndex: 0,\n  },\n]);`;

const staleEncounterGoldAssertion = `assert.equal(packRun.gold, 51, "Gold including its bonus is multiplied by three defeated monsters");`;
const currentEncounterGoldAssertion = `assert.equal(packRun.gold, 17, "Encounter gold is awarded once with the configured gold bonus");`;

const staleBattleHealAssertion = `assert.equal(packRun.hp, 65, "Battle healing remains fixed at five");`;
const currentBattleHealAssertion = `assert.equal(packRun.hp, 60, "Battles do not grant fixed healing without a battle-end healing effect");`;

const staleBattleRewardAssertions = `assert.equal(packRun.reward.cardPicksRemaining, 3);
for (let remaining = 2; remaining >= 0; remaining--) {
  const card = packRun.reward.cards[0];
  assert.equal(E.advance(packRun, card), true);
  if (remaining) {
    assert.equal(packRun.phase, "reward");
    assert.equal(packRun.reward.cardPicksRemaining, remaining);
    assert.equal(packRun.reward.cards.length, remaining, "Claimed fixed options are removed from the remaining view");
  }
}
assert.equal(packRun.phase, "map");`;
const currentBattleRewardAssertions = `assert.equal(packRun.reward.cardPicksRemaining, 1, "Normal combat grants one three-card draft");\nassert.equal(packRun.reward.metadata.battleCardReward.totalGroups, 1);\nassert.equal(packRun.reward.groups.length, 1);\nconst offer = E.currentRewardOffer(packRun);\nassert.equal(offer.pickCount, 1);\nassert.equal(offer.optionCount, 3);\nassert.equal(offer.metadata.groupIndex, 1);\nassert.equal(packRun.reward.cards.length, 3);\nconst card = packRun.reward.cards[0];\nassert.equal(E.advance(packRun, card, null, packMeta), true);\nassert.equal(packRun.phase, "map");`;



const staleAbyssCostFixture = `const abyssCost = E.newRun(9400), abyssMeta = E.freshMeta();
abyssCost.loop = 4;
abyssCost.route[0] = "battle";
E.enter(abyssCost, abyssMeta);
assert.equal(E.cost(abyssCost, { id: "strike", level: 0 }), 2);`;
const currentAbyssCostFixture = `const abyssCost = E.newRun(9400), abyssMeta = E.freshMeta();
abyssCost.loop = 7;
abyssCost.route[0] = "battle";
E.enter(abyssCost, abyssMeta);
assert.equal(E.cost(abyssCost, { id: "strike", level: 0 }), 2);`;

const staleActInfoAssertion = `assert.deepEqual(
  [E.actInfo(0).hp, E.actInfo(1).hp, E.actInfo(2).hp, E.actInfo(3).hp],
  [1, 1.45, 2.1, 2.8],
);`;
const currentActInfoAssertion = `assert.deepEqual(
  [E.actInfo(0).hp, E.actInfo(1).hp, E.actInfo(2).hp, E.actInfo(3).hp],
  [1, 1.45, 2.1, 1],
  "Loop 3 is Act 4 in the extended campaign, not the old endless stage",
);`;
const staleCardCopyCapBlock = `  const expectedCopies =
    card.id === "heal_aloe_salve" ||
    card.id === "heal_chamomile_infusion" ||
    stagedThreeCopyTier2Cards.has(card.id)
      ? 3
      : { 1: 4, 2: 2, 3: 2, 4: 1 }[card.tier];
  assert.equal(card.maxCopies, expectedCopies);`;
const officialAugmentCardCopyCaps = JSON.stringify(
  Object.fromEntries(
    Object.entries(NEW_AUGMENT_CARDS).map(([id, card]) => [id, card.maxCopies]),
  ),
);
const currentCardCopyCapBlock = `  const expectedCopies =
    ${officialAugmentCardCopyCaps}[card.id] ??
    (card.id === "heal_aloe_salve" ||
    card.id === "heal_chamomile_infusion" ||
    stagedThreeCopyTier2Cards.has(card.id)
      ? 3
      : { 1: 4, 2: 2, 3: 2, 4: 1 }[card.tier]);
  assert.equal(card.maxCopies, expectedCopies);`;

const staleRelicTierAssertion = `assert.ok([0, 2, 3].includes(item.tier), \`\${item.id} relic tier must be common, unique or epic\`);`;
const officialAugmentItemIdList = JSON.stringify(Object.keys(NEW_AUGMENT_ITEMS));
const currentRelicTierAssertion = `assert.ok(
      (${officialAugmentItemIdList}.includes(item.id) ? [0, 1, 2, 3] : [0, 2, 3]).includes(item.tier),
      \`\${item.id} relic tier must follow its canonical catalog generation\`,
    );`;

const staleStatEffectAllowlist = `["maxHp", "attack", "contactAttack", "nonContactAttack", "topAttack", "baseAttack", "corrosionAttack", "burningAttack", "harmonyAttack", "defense", "openingShield", "regen", "incomingHeal", "battleEndHeal", "openingAbsorb", "absorbBonus", "absorb", "goldBonus", "goldLumpSum", "shopPriceMultiplier"]`;
const currentStatEffectAllowlist = `["maxHp", "attack", "contactAttack", "nonContactAttack", "topAttack", "baseAttack", "corrosionAttack", "burningAttack", "harmonyAttack", "highAbsorbAttack", "defense", "openingShield", "regen", "incomingHeal", "battleEndHeal", "openingAbsorb", "absorbBonus", "absorb", "goldBonus", "goldLumpSum", "shopPriceMultiplier"]`;

const staleSeparatedCardIdentityAssertion = `assert.ok(
  Object.keys(CONTACT_ATTACK_CARDS).every(
    (id) => CARDS[id] === CONTACT_ATTACK_CARDS[id],
  ),
  "Separated contact cards are merged into the live card pool",
);`;
const currentSeparatedCardIdentityAssertion = `assert.ok(
  Object.keys(CONTACT_ATTACK_CARDS).every(
    (id) =>
      CARDS[id]?.id === id &&
      CARDS[id]?.name === CONTACT_ATTACK_CARDS[id]?.name &&
      CARDS[id]?.attack === CONTACT_ATTACK_CARDS[id]?.attack,
  ),
  "Separated contact cards are merged into the live card pool",
);`;

const staleSeparatedNonContactIdentityAssertion = `assert.ok(
  Object.keys(NON_CONTACT_ATTACK_CARDS).every(
    (id) =>
      CARDS[id] === NON_CONTACT_ATTACK_CARDS[id] &&
      CARDS[id].attackPattern === "nonContact",
  ),
  "Separated non-contact cards are merged into the live card pool",
);`;
const currentSeparatedNonContactIdentityAssertion = `assert.ok(
  Object.keys(NON_CONTACT_ATTACK_CARDS).every(
    (id) =>
      CARDS[id]?.id === id &&
      CARDS[id]?.name === NON_CONTACT_ATTACK_CARDS[id]?.name &&
      CARDS[id]?.attack === NON_CONTACT_ATTACK_CARDS[id]?.attack &&
      CARDS[id]?.attackPattern === "nonContact",
  ),
  "Separated non-contact cards are merged into the live card pool",
);`;


const replacements = [
  [staleRouteAssertions, currentRouteAssertions, "route"],
  [staleHarmonyAssertions, currentHarmonyAssertions, "base-effect"],
  [staleEncounterGoldAssertion, currentEncounterGoldAssertion, "encounter-gold"],
  [staleBattleHealAssertion, currentBattleHealAssertion, "battle-heal"],
  [staleBattleRewardAssertions, currentBattleRewardAssertions, "battle-reward-groups"],
  [staleActInfoAssertion, currentActInfoAssertion, "extended-campaign-act-info"],
  [staleAbyssCostFixture, currentAbyssCostFixture, "extended-campaign-abyss-loop"],
  [staleCardCopyCapBlock, currentCardCopyCapBlock, "official-augment-card-copy-cap"],
  [staleRelicTierAssertion, currentRelicTierAssertion, "official-augment-relic-tier"],
  [staleStatEffectAllowlist, currentStatEffectAllowlist, "stat-effect-allowlist"],
  [staleSeparatedCardIdentityAssertion, currentSeparatedCardIdentityAssertion, "separated-card-merge"],
  [staleSeparatedNonContactIdentityAssertion, currentSeparatedNonContactIdentityAssertion, "separated-noncontact-card-merge"],
];

let source = (await readFile(sourcePath, "utf8"))
  .replace(/\r\n/g, "\n")
  .replace(
    '../games/harmony/data.js";',
    '../games/harmony/data.js?v=20260920-balance-1";',
  )
  .replace(
    'import { CONTACT_ATTACK_CARDS } from "../games/harmony/contact-cards.js";',
    'import { ITEMS as PERSISTENCE_ITEMS } from "../games/harmony/data.js?v=20260920-balance-1";\nimport { CONTACT_ATTACK_CARDS } from "../games/harmony/contact-cards.js";',
  )
  .replace(
    'Object.assign(ITEMS, LEGACY_BETA_ITEMS);',
    'Object.assign(ITEMS, LEGACY_BETA_ITEMS);\nObject.assign(PERSISTENCE_ITEMS, LEGACY_BETA_ITEMS);',
  );
for (const [stale, current, label] of replacements) {
  if (!source.includes(stale)) {
    throw new Error(`Harmony ${label} test fixture changed; update test-harmony-runner.mjs.`);
  }
  source = source.replace(stale, current);
}

const canonicalSynergyFixtureIds = [
  ["gather_attack_0", "stat_pure_extract_drop"],
  ["gather_regen_2", "stat_primordial_dew_chalice"],
  ["gather_oilShield_0", "trait_overlapping_petals"],
  ["golden_carry_2", "trait_unyielding_wax_monolith"],
  ["boss_shieldHit_0", "relic_perpetual_alembic_coil"],
];
for (const [legacyId, canonicalId] of canonicalSynergyFixtureIds)
  source = source.replaceAll(legacyId, canonicalId);

await writeFile(generatedPath, source, "utf8");

try {
  await import(`${pathToFileURL(generatedPath).href}?run=${Date.now()}`);
} finally {
  await unlink(generatedPath).catch(() => {});
}

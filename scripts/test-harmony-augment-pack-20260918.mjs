import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import {
  CARDS,
  ITEMS,
} from "../games/harmony/data.js";
import {
  NEW_AUGMENT_CARDS,
  NEW_AUGMENT_ITEMS,
  NEW_AUGMENT_IDS,
} from "../games/harmony/augment-pack-20260918.js";
import {
  acquisitionAllows,
  cardBaseAp,
  effectiveAttackPattern,
  isEffectiveImpurity,
  isPhysicalImpurity,
} from "../games/harmony/augment-event-runtime.js";
import { ATELIER_TIER_PRICES } from "../games/harmony/atelier-shop.js";
import { createCardPresentation } from "../games/harmony/card-presentation-base.js";

const cardIds = Object.keys(NEW_AUGMENT_CARDS);
const itemIds = Object.keys(NEW_AUGMENT_ITEMS);

assert.equal(cardIds.length, 4, "official augment pack must contain exactly 4 cards");
assert.equal(itemIds.length, 32, "official augment pack must contain exactly 32 items");
assert.equal(NEW_AUGMENT_IDS.length, 36, "official augment pack must expose exactly 36 IDs");
assert.equal(new Set(NEW_AUGMENT_IDS).size, 36, "official augment IDs must be unique");
assert.deepEqual(new Set([...cardIds, ...itemIds]), new Set(NEW_AUGMENT_IDS));
assert.deepEqual(cardIds.filter((id) => itemIds.includes(id)), [], "card/item IDs must not overlap");

for (const id of cardIds) {
  assert.equal(CARDS[id], NEW_AUGMENT_CARDS[id], `${id} must be in canonical CARDS`);
  assert.equal(CARDS[id].id, id);
  assert.equal(CARDS[id].acquisition.shop, true, `${id} must be available in Atelier`);
  assert.deepEqual(CARDS[id].acquisition.rewardSources, ["combat"]);
  assert.equal(
    ATELIER_TIER_PRICES[CARDS[id].tier],
    CARDS[id].tier === 1 ? 30 : 55,
    `${id} shop price must follow canonical tier price`,
  );
}
for (const id of itemIds) {
  const item = ITEMS[id];
  assert.equal(item, NEW_AUGMENT_ITEMS[id], `${id} must be in canonical ITEMS`);
  assert.equal(item.id, id);
  assert.ok(["trait", "relic"].includes(item.kind), `${id} must be trait/relic`);
  assert.equal(item.tier, item.sheetTier - 1, `${id} sheet tier must normalize once`);
  assert.equal(item.price, ATELIER_TIER_PRICES[item.sheetTier], `${id} price mismatch`);
  assert.ok(item.maxOwned >= 1, `${id} maxOwned must be positive`);
  assert.ok(typeof item.effect === "string" && item.effect.length, `${id} effect key missing`);
  assert.ok(item.acquisition && typeof item.acquisition === "object", `${id} acquisition missing`);
}

// Fixed balance values from the 2026-09-18 sheet review.
assert.equal(CARDS.cycle_redistillation_recovery_fluid.cost, 1);
assert.equal(ITEMS.relic_fractional_cost_reducer.sheetTier, 3);
assert.equal(ITEMS.relic_fractional_cost_reducer.tier, 2);
assert.equal(ITEMS.relic_fractional_cost_reducer.price, 90);
assert.equal(ITEMS.trait_waste_fragrance_chain_reaction.value, 3);

// Card definitions and upgrades.
assert.deepEqual(
  [
    E.cardDefinition({ id: "noncontact_broken_scent_sample", level: 0 }),
    E.cardDefinition({ id: "noncontact_broken_scent_sample", level: 1 }),
    E.cardDefinition({ id: "noncontact_broken_scent_sample", level: 2 }),
    E.cardDefinition({ id: "noncontact_broken_scent_sample", level: 3 }),
  ].map((card) => [card.cost, card.attack, card.discardedGainShield]),
  [[0, 3, 5], [0, 4, 6], [0, 5, 7], [0, 6, 8]],
);
assert.deepEqual(
  [
    E.cardDefinition({ id: "absorb_volatile_residue", level: 0 }),
    E.cardDefinition({ id: "absorb_volatile_residue", level: 1 }),
    E.cardDefinition({ id: "absorb_volatile_residue", level: 2 }),
    E.cardDefinition({ id: "absorb_volatile_residue", level: 3 }),
  ].map((card) => [card.cost, card.absorb, card.discardedDrawOne, card.discardedExtraDrawChance]),
  [[0, 2, 1, 0], [0, 3, 1, 0], [0, 4, 1, 0.25], [0, 5, 1, 0.5]],
);
assert.deepEqual(
  [
    E.cardDefinition({ id: "noncontact_ignitable_waste_blotter", level: 0 }),
    E.cardDefinition({ id: "noncontact_ignitable_waste_blotter", level: 1 }),
    E.cardDefinition({ id: "noncontact_ignitable_waste_blotter", level: 2 }),
  ].map((card) => [card.cost, card.attack, card.discardedRandomBurn]),
  [[1, 8, 3], [1, 10, 4], [0, 10, 4]],
);
assert.deepEqual(
  [
    E.cardDefinition({ id: "cycle_redistillation_recovery_fluid", level: 0 }),
    E.cardDefinition({ id: "cycle_redistillation_recovery_fluid", level: 1 }),
    E.cardDefinition({ id: "cycle_redistillation_recovery_fluid", level: 2 }),
  ].map((card) => [
    card.cost,
    card.draw,
    card.discard,
    card.augmentDiscardMinBaseAp,
    card.augmentDiscardShield,
    card.augmentDiscardAbsorb,
  ]),
  [[1, 2, 1, 0, 0, 0], [1, 2, 1, 2, 4, 0], [1, 2, 1, 2, 6, 2]],
);

// Canonical base AP is independent from upgrade/current discounts.
assert.equal(cardBaseAp(CARDS, { id: "noncontact_ignitable_waste_blotter", level: 2 }), 1);

// Acquisition contracts.
const rareIds = [
  "relic_turn_zero_ap_chance",
  "relic_spectral_striker",
  "trait_hypercycle_fragrance_engine",
  "relic_lossless_redistiller",
  "trait_complete_contamination_adaptation",
];
for (const id of rareIds) {
  const item = ITEMS[id];
  assert.equal(item.acquisition.rareOnly, true, `${id} must be rare-only`);
  assert.equal(acquisitionAllows(item, { shop: true }), false);
  assert.equal(acquisitionAllows(item, { source: "combat" }), false);
  assert.equal(acquisitionAllows(item, { source: "boss" }), true);
}
const eventContracts = {
  relic_overflow_fragrance_recovery_tube: ["mystery", "smuggler"],
  relic_phase_crossing_lens: ["lab"],
  relic_impurity_reaction_roulette: ["dice_altar"],
  relic_contaminated_perfumery_essence: ["curse_pit", "mercury_still"],
  relic_turbid_distillation_core: ["dice_altar"],
};
for (const [id, rooms] of Object.entries(eventContracts)) {
  const item = ITEMS[id];
  assert.equal(item.acquisition.shop, false, `${id} must not appear in Atelier`);
  assert.deepEqual(item.acquisition.rewardSources, [], `${id} must not appear in generic rewards`);
  for (const room of rooms)
    assert.equal(acquisitionAllows(item, { eventRoom: room, state: { inventory: ["relic_impurity_reaction_roulette"] } }), true);
  assert.equal(acquisitionAllows(item, { source: "boss", state: { inventory: ["relic_impurity_reaction_roulette"] } }), false);
}
assert.equal(
  acquisitionAllows(ITEMS.relic_turbid_distillation_core, {
    eventRoom: "dice_altar",
    state: { inventory: [] },
  }),
  false,
  "Turbid Core requires Roulette",
);

// Physical/effective impurity and one-shot phase inversion helpers.
const normalCard = { id: "noncontact_broken_scent_sample", level: 0 };
assert.equal(isPhysicalImpurity({ id: "impurity" }), true);
assert.equal(isPhysicalImpurity(normalCard), false);
assert.equal(isEffectiveImpurity({ inventory: [] }, normalCard, CARDS), false);
assert.equal(
  isEffectiveImpurity(
    { inventory: ["relic_contaminated_perfumery_essence"] },
    normalCard,
    CARDS,
  ),
  true,
);
assert.equal(
  effectiveAttackPattern(
    { inventory: ["relic_phase_crossing_lens"] },
    CARDS.noncontact_broken_scent_sample,
    "cardDirectAttack",
  ),
  "contact",
);
assert.equal(
  effectiveAttackPattern(
    { inventory: ["relic_phase_crossing_lens"] },
    CARDS.contact_glass_dropper_strike,
    "cardDirectAttack",
  ),
  "nonContact",
);
assert.equal(
  effectiveAttackPattern(
    { inventory: ["relic_phase_crossing_lens"] },
    CARDS.contact_glass_dropper_strike,
    "relicDamage",
  ),
  "contact",
  "Phase Lens must not invert non-card damage",
);

// New card compact/detail renderer must describe upgrade-specific mechanics.
const presentation = createCardPresentation({
  engine: E,
  cards: CARDS,
  statusDefinitions: S.STATUS_DEFINITIONS,
  getRun: () => null,
  getStarted: () => false,
  tierStars: () => "",
});
for (const [card, snippets] of [
  [{ id: "noncontact_broken_scent_sample", level: 3 }, ["피해", "버림→방어막", "+8"]],
  [{ id: "absorb_volatile_residue", level: 3 }, ["흡수", "버림→드로우", "50%"]],
  [{ id: "noncontact_ignitable_waste_blotter", level: 2 }, ["피해", "버림→연소", "+4"]],
  [{ id: "cycle_redistillation_recovery_fluid", level: 2 }, ["카드", "선택 버리기", "방어막 +6", "흡수 +2"]],
]) {
  const compact = presentation.compactCardEffectSummary(card);
  const detail = presentation.cardEffectText(card, true);
  assert.ok(compact, `${card.id} must have compact summary`);
  const combined = `${compact.body} ${detail}`;
  for (const snippet of snippets)
    assert.ok(combined.includes(snippet), `${card.id} UI missing: ${snippet}`);
}
assert.equal(E.cardDefinition({ id: "noncontact_ignitable_waste_blotter", level: 2 }).cost, 0);

// Runtime card UI: Phase Lens, effective impurity and temporary AP must be
// visible without mutating the canonical card definition.
{
  const meta = E.freshMeta(),
    state = E.newRun(
      4101,
      Array(10).fill("noncontact_ignitable_waste_blotter"),
      meta,
    );
  state.route = Array(12).fill("combat");
  state.route[11] = "boss";
  state.resolvedRooms[0] = "battle";
  E.enter(state, meta);
  state.inventory.push(
    "relic_phase_crossing_lens",
    "relic_contaminated_perfumery_essence",
  );
  const instance = {
    id: "noncontact_ignitable_waste_blotter",
    level: 0,
    _augmentTempCostReduction: 1,
    _augmentTempCostTurn: state.battle.turn,
  };
  state.battle.hand = [instance];
  state.battle.ap = 8;
  const runtimePresentation = createCardPresentation({
      engine: E,
      cards: CARDS,
      statusDefinitions: S.STATUS_DEFINITIONS,
      getRun: () => state,
      getStarted: () => true,
      tierStars: () => "",
    }),
    html = runtimePresentation.cardHtml(instance, 0),
    detail = runtimePresentation.cardEffectText(instance, true);

  assert.match(html, /pattern-contact pattern-inverted/);
  assert.match(html, /원본: 비접촉 · 현재 판정: 접촉 \(반전\)/);
  assert.match(html, /불순물 판정/);
  assert.match(html, /실제 불순물 카드는 아님/);
  assert.match(html, /card-runtime-value-changed/);
  assert.match(html, /카드 자체 AP 1 · 현재 최종 비용 0 AP/);
  assert.match(html, /←1/);
  assert.match(detail, /원본 공격방식은 <b>비접촉<\/b>/);
  assert.match(detail, /현재 전투 판정은 <b class="semantic-gain">접촉 \(반전\)<\/b>/);
  assert.match(detail, /현재 이 카드는 <b class="semantic-gain">불순물 판정<\/b>/);

  assert.equal(
    CARDS.noncontact_ignitable_waste_blotter.cost,
    1,
    "temporary AP UI must not mutate base AP",
  );
  assert.equal(
    CARDS.noncontact_ignitable_waste_blotter.attackPattern,
    "nonContact",
    "Phase Lens UI must not mutate canonical attack pattern",
  );
}

// Codex/discovery registry is automatic and persists valid new IDs in metadata.
{
  const meta = E.freshMeta();
  const state = E.newRun(101, Array(10).fill("noncontact_broken_scent_sample"), meta);
  assert.equal(meta.discovered.includes("relic_phase_crossing_lens"), false);
  assert.equal(E.addInventoryItem(state, "relic_phase_crossing_lens", meta), true);
  assert.equal(meta.discovered.includes("relic_phase_crossing_lens"), true);
  assert.ok(Object.values(ITEMS).some((item) => item.id === "relic_phase_crossing_lens"));
  assert.ok(Object.values(CARDS).some((card) => card.id === "noncontact_broken_scent_sample"));
}

console.log("PASS Harmony augment pack registry/data/UI: 36 unique canonical IDs, exact fixed values, acquisitions, upgrades, classifications and discovery.");

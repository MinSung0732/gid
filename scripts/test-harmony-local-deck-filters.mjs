import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CARDS, TEST_ITEMS } from "../games/harmony/data.js";
import { STATUS_DEFINITIONS } from "../games/harmony/statuses.js";
import { STAGED_AUGMENT_CARDS, STAGED_AUGMENT_ITEMS } from "../games/harmony/staged-augments.js";
import { NEW_AUGMENT_CARDS, NEW_AUGMENT_ITEMS } from "../games/harmony/augment-pack-20260918.js";
import {
  buildCardFilterRegistry,
  buildItemFilterRegistry,
  classifyCard,
  classifyItem,
  createFilterState,
  matchesFilterState,
} from "../games/harmony/local-deck-filter-registry.js";

const categoryOf = (card) => ["attack", "defense", "absorb", "heal"].includes(card.category)
  ? card.category
  : card.attack || card.burst || card.weight ? "attack"
    : card.heal || card.missingHpHealRatio ? "heal"
      : card.shield ? "defense" : "absorb";

const enumerableCards = Object.values(CARDS).filter((card) => card.id !== "impurity");
const categoryCounts = Object.fromEntries(["attack", "defense", "absorb", "heal"].map((category) => [
  category,
  enumerableCards.filter((card) => categoryOf(card) === category).length,
]));
assert.equal(Object.values(categoryCounts).reduce((sum, count) => sum + count, 0), enumerableCards.length, "every card must have exactly one base category");
assert.ok(Object.values(categoryCounts).every((count) => count > 0), "all four card categories must remain populated");

const cardRegistry = buildCardFilterRegistry(CARDS, STATUS_DEFINITIONS, categoryOf);
for (const [category, groups] of Object.entries(cardRegistry)) {
  const categoryCards = enumerableCards.filter((card) => categoryOf(card) === category);
  assert.ok(groups.length > 1, `${category} should have basic and detailed filter groups`);
  assert.equal(groups[0].id, "basic");
  assert.equal(groups[0].defaultOpen, true);
  for (const group of groups) for (const entrySection of group.sections) for (const entryOption of entrySection.options) {
    assert.ok(entryOption.count > 0, `${category}/${entryOption.id} must not be stale`);
    assert.equal(
      categoryCards.filter((card) => classifyCard(card, STATUS_DEFINITIONS).has(entryOption.id)).length,
      entryOption.count,
      `${category}/${entryOption.id} count should come from actual card properties`,
    );
  }
}

const tier1Cards = Object.fromEntries(enumerableCards.filter((card) => card.tier === 1).map((card) => [card.id, card]));
const standardRegistry = buildCardFilterRegistry(tier1Cards, STATUS_DEFINITIONS, categoryOf, { omitRedundantTier: true });
for (const [category, groups] of Object.entries(standardRegistry)) {
  const categoryCards = Object.values(tier1Cards).filter((card) => categoryOf(card) === category);
  assert.ok(categoryCards.length > 0, `${category} should remain available in the standard tier-1 builder`);
  assert.ok(groups.some((group) => group.id !== "basic"), `${category} should retain meaningful detailed filters`);
  assert.equal(groups.flatMap((group) => group.sections).some((entrySection) => entrySection.id === "tier"), false, "the universal tier-1 option should be omitted");
  for (const group of groups) for (const entrySection of group.sections) for (const entryOption of entrySection.options) {
    assert.ok(entryOption.count > 0, `standard ${category}/${entryOption.id} must not be stale`);
    assert.equal(
      categoryCards.filter((card) => classifyCard(card, STATUS_DEFINITIONS).has(entryOption.id)).length,
      entryOption.count,
      `standard ${category}/${entryOption.id} count must use tier-1 cards only`,
    );
  }
}
const standardState = createFilterState(standardRegistry.attack), testState = createFilterState(cardRegistry.attack);
assert.equal(standardState.panelOpen, false, "filter popovers should start closed");
standardState.selected.note.add("note-top");
assert.equal(testState.selected.note.size, 0, "standard and LOCAL filter state must be independent");

for (const card of enumerableCards) {
  const tags = classifyCard(card, STATUS_DEFINITIONS);
  assert.ok(tags.has(`tier-${card.tier}`), `${card.id} should expose its real tier`);
  if (card.note) assert.ok(tags.has(`note-${card.note}`), `${card.id} should expose its real note`);
}

const dynamicStatusCard = { id: "dynamic", tier: 1, note: "top", category: "attack", applyEnemy: { future_status: 2 } };
const dynamicRegistry = buildCardFilterRegistry(
  { dynamic: dynamicStatusCard },
  { future_status: { name: "미래 상태", icon: "☆" } },
  categoryOf,
);
assert.ok(dynamicRegistry.attack.flatMap((group) => group.sections).flatMap((entry) => entry.options).some((entry) => entry.id === "status-future_status"));

const itemRegistry = buildItemFilterRegistry(TEST_ITEMS);
for (const kind of ["stat", "trait", "relic", "curse"]) {
  const items = Object.values(TEST_ITEMS).filter((item) => item.kind === kind);
  assert.ok(items.length > 0, `${kind} must remain populated`);
  assert.ok(itemRegistry[kind].length > 1, `${kind} should have detailed groups`);
  for (const item of items) {
    const tags = classifyItem(item);
    assert.ok(tags.has(`tier-${item.tier}`), `${item.id} should be included by its real category/tier`);
    assert.ok([...tags].some((tag) => tag.startsWith("item-")), `${item.id}/${item.effect} should have a detailed effect classification`);
  }
  for (const group of itemRegistry[kind]) for (const entrySection of group.sections) for (const entryOption of entrySection.options)
    assert.ok(entryOption.count > 0, `${kind}/${entryOption.id} must not be stale`);
}

for (const collection of [STAGED_AUGMENT_CARDS, NEW_AUGMENT_CARDS])
  for (const id of Object.keys(collection)) assert.ok(CARDS[id], `${id} must be present in the current card catalog`);
for (const collection of [STAGED_AUGMENT_ITEMS, NEW_AUGMENT_ITEMS])
  for (const id of Object.keys(collection)) assert.ok(TEST_ITEMS[id], `${id} must be present in the current item catalog`);

const attackGroups = cardRegistry.attack;
const state = createFilterState(attackGroups);
const sample = enumerableCards.find((card) => categoryOf(card) === "attack" && card.tier === 1 && card.note);
state.selected.tier.add("tier-1");
state.selected.note.add(`note-${sample.note}`);
assert.equal(matchesFilterState(classifyCard(sample, STATUS_DEFINITIONS), attackGroups, state), true, "different sections should combine with AND");
state.selected.tier.add("tier-4");
assert.equal(matchesFilterState(classifyCard(sample, STATUS_DEFINITIONS), attackGroups, state), true, "tier alternatives in the same section should combine with OR");

const source = await readFile(new URL("../games/harmony/local-deck-filter-registry.js", import.meta.url), "utf8");
assert.doesNotMatch(source, /(?:card|item)\.(?:name|text|description)\.(?:includes|match)/, "classification must not infer tags from display strings");
assert.match(source, /deriveCardMechanics\(card\)/, "card filters must reuse the canonical mechanic metadata");
const styles = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");
assert.match(styles, /\.builder-filter-summary\[aria-expanded="true"\]/);
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.builder-filter-section/);
assert.match(styles, /\.starting-deck-builder > \.builder-catalog[\s\S]*?overflow-y: auto/);
assert.match(styles, /\.builder-filter-popover\s*\{[\s\S]*?position:absolute/);
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.builder-filter-popover\s*\{[\s\S]*?position:fixed/);

console.log(`PASS Harmony local deck filters: ${enumerableCards.length} cards, ${Object.values(TEST_ITEMS).length} items, data-driven taxonomies, accordion state, and zero stale options.`);

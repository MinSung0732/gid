import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { CARDS, getTier1Cards } from "../games/harmony/data.js";
import { CONTACT_TIER3_CARDS } from "../games/harmony/contact-tier3-cards.js";
import { saveGame, loadGame } from "../games/harmony/persistence.js";

function setup(id, level = 0) {
  const run = E.newRun(101), meta = E.freshMeta();
  run.route[0] = "battle"; E.enter(run, meta);
  run.battle.enemies = [run.battle.enemies[0]]; E.attachEnemyAliases(run.battle);
  const b = run.battle, enemy = b.enemies[0];
  Object.assign(enemy, { hp: 1000, maxHp: 1000, shield: 0, statuses: {}, isBoss: false });
  b.ap = 4; b.hand = [{ id, level }]; b.absorb = 0;
  return { run, meta, b, enemy, play: () => E.play(run, 0, meta) };
}
assert.equal(Object.keys(CONTACT_TIER3_CARDS).length, 8);
assert.equal(CARDS.contact_reed_frenzy, undefined);
assert.equal(CARDS.contact_wax_bastion_crush, undefined);
assert.equal(CARDS.contact_basalt_impact.note, "base");
assert.equal(CARDS.contact_cauterizing_brand.note, "top");
assert.equal(CARDS.contact_volatile_reaction.note, "top");
for (const id of ["contact_infinite_resonance", "contact_obsidian_breaker", "contact_essence_spear", "contact_pure_absorb_overload", "contact_alchemical_transmute"])
  assert.equal(CARDS[id].note, "middle");
for (const id of Object.keys(CONTACT_TIER3_CARDS)) {
  assert.equal(CARDS[id].tier, 3);
  assert.equal(CARDS[id].maxCopies, 2);
  assert.equal(CARDS[id].maxUpgrade, 2);
  assert.ok(!getTier1Cards().some((card) => card.id === id));
}
for (let level = 0; level <= 2; level++) {
  let ctx = setup("contact_basalt_impact", level);
  ctx.enemy.shield = 100; ctx.play();
  assert.equal(ctx.enemy.hp, 1000 - [24, 28, 33][level]);
  assert.equal(ctx.enemy.shield, 100); assert.equal(S.stacks(ctx.enemy, "stun"), 1);

  ctx = setup("contact_infinite_resonance", level);
  ctx.b.contactCardsPlayedThisBattle = 7; ctx.play();
  assert.equal(ctx.enemy.hp, 1000 - ([5, 6, 7][level] + 7) * 3);
  assert.equal(ctx.b.contactCardsPlayedThisBattle, 8);
  E.endTurn(ctx.run, ctx.meta);
  assert.equal(ctx.b.contactCardsPlayedThisBattle, 8);

  for (const shield of [0, 1, [16, 19, 23][level], 100]) {
    ctx = setup("contact_obsidian_breaker", level);
    ctx.enemy.shield = shield; ctx.play();
    const broke = shield > 0 && shield <= [16, 19, 23][level];
    assert.equal(ctx.b.ap, broke ? 5 : 3);
    assert.equal(ctx.b.hand.length, broke ? 1 : 0);
  }
  for (const discardedId of [null, "impurity", "contact_basalt_impact", "contact_glass_dropper_strike"]) {
    ctx = setup("contact_volatile_reaction", level);
    if (discardedId) ctx.b.hand.push({ id: discardedId, level: 0 });
    ctx.play();
    assert.equal(ctx.enemy.hp, 1000 - [13, 16, 20][level]);
    assert.equal(ctx.b.hand.length, 0); assert.ok(!ctx.b.pendingDiscard);
    assert.equal(ctx.b.ap, discardedId && discardedId !== "impurity" ? 5 : 4);
    if (discardedId) assert.equal(ctx.b.discard.at(-1).id, discardedId);
  }
  ctx = setup("contact_essence_spear", level);
  for (const id of ["burning", "bleed", "poison"]) S.applyStatus(ctx.enemy, id, 2);
  ctx.play(); assert.equal(ctx.enemy.hp, 1000 - [46, 57, 68][level]);

  ctx = setup("contact_pure_absorb_overload", level);
  const required = [20, 20, 18][level]; ctx.b.absorb = required - 1;
  assert.equal(ctx.play(), false); assert.equal(ctx.b.ap, 4); assert.equal(ctx.b.hand.length, 1);
  ctx.b.absorb = required; assert.equal(ctx.play(), true);
  assert.equal(ctx.b.absorb, 0); assert.equal(ctx.enemy.hp, 1000 - [34, 40, 46][level]);

  for (const burning of [0, 10]) {
    ctx = setup("contact_cauterizing_brand", level);
    S.applyStatus(ctx.enemy, "burning", burning); ctx.play();
    assert.equal(ctx.enemy.hp, 1000 - [22, 26, 31][level] - burning * [2, 2, 2.5][level]);
    assert.equal(S.stacks(ctx.enemy, "burning"), burning + [6, 7, 8][level]);
  }
  for (const lethal of [false, true]) {
    ctx = setup("contact_alchemical_transmute", level);
    // Keep another enemy alive to isolate the kill reward from victory rewards.
    ctx.b.enemies.push({ ...ctx.enemy, statuses: {} });
    if (lethal) ctx.enemy.hp = [15, 18, 22][level];
    const maxHp = ctx.run.maxHp, hp = ctx.run.hp; ctx.play();
    assert.equal(ctx.run.maxHp, maxHp + (lethal ? [2, 3, 4][level] : 0));
    assert.equal(ctx.run.hp, hp);
    assert.equal(ctx.enemy.hp, lethal ? 0 : 1000 - [15, 18, 22][level]);
  }
}
{
  const ctx = setup("contact_alchemical_transmute", 2);
  ctx.b.enemies.push({ ...ctx.enemy, statuses: {} });
  ctx.enemy.hp = 1; ctx.play();
  ctx.b.hand = [{ id: "contact_infinite_resonance", level: 2 }];
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  saveGame(storage, { run: ctx.run, meta: ctx.meta });
  const restored = loadGame(storage).run;
  assert.equal(restored.maxHp, ctx.run.maxHp);
  assert.equal(restored.battle.contactCardsPlayedThisBattle, 1);
  restored.battle.selectedTarget = 1;
  E.play(restored, 0, ctx.meta);
  assert.equal(restored.battle.enemies[1].hp, 1000 - 24);
  restored.phase = "map"; restored.route[restored.node] = "battle";
  E.enter(restored, ctx.meta);
  assert.equal(restored.battle.contactCardsPlayedThisBattle, 0);
  assert.equal(restored.maxHp, ctx.run.maxHp);
}
console.log("PASS contact tier 3: eight cards, redistributed notes, removals, upgrades, penetration, scaling, discard, DOT, absorb requirement and kill rewards.");

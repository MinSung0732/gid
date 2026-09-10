import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { BENEFICIAL_TRAITS } from "../games/harmony/beneficial-traits.js";
import { CURSE_TRAITS } from "../games/harmony/curse-traits.js";
import { CARDS } from "../games/harmony/data.js";

const cards = Object.values(CARDS).filter((card) => card.id !== "impurity");
const samples = [
  cards.find((card) => card.oil),
  cards.find((card) => card.shield),
  cards.find((card) => card.absorb),
  cards.find((card) => card.attack && card.attackPattern === "contact" && (card.hits || 1) >= 2),
  cards.find((card) => card.attack && card.attackPattern === "nonContact" && card.target === "all"),
].filter(Boolean);
assert.ok(samples.length >= 4);

for (const trait of [...Object.values(BENEFICIAL_TRAITS), ...Object.values(CURSE_TRAITS)]) {
  const run = E.newRun(9900, samples.map((card) => card.id));
  run.inventory = [trait.id];
  run.route[0] = "battle";
  const meta = E.freshMeta();
  E.enter(run, meta);
  run.battle.hand = samples.map((card) => ({ id: card.id, level: 0 }));
  run.battle.ap = 20;
  for (let index = run.battle.hand.length - 1; index >= 0 && run.phase === "battle"; index--)
    if (E.canPlay(run, run.battle.hand[index])) E.play(run, index, meta);
  if (run.phase === "battle" && !run.battle.pendingDiscard) E.endTurn(run, meta);
  assert.ok(Number.isFinite(run.hp) && Number.isFinite(run.maxHp), `${trait.id} keeps health finite`);
  if (run.battle) assert.ok(Number.isFinite(run.battle.absorb) && Number.isFinite(run.battle.shield), `${trait.id} keeps resources finite`);
}

console.log("PASS all trait smoke: 152 beneficial/curse traits survive battle entry, card play and turn resolution.");

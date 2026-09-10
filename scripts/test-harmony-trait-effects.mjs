import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { CARDS } from "../games/harmony/data.js";

const setup = (inventory, seed = 8801) => {
  const run = E.newRun(seed);
  run.inventory = inventory;
  run.route[0] = "battle";
  E.enter(run, E.freshMeta());
  return run;
};

let run = setup(["trait_porous_grain", "trait_porous_grain", "trait_porous_grain"]);
run.battle.ap = 2;
assert.equal(E.executePlayerTurnEnd(run, E.freshMeta()), true);
assert.equal(run.battle.absorb, 6, "다공성 결은 남은 AP × 중첩만큼 흡수를 획득한다");

run = setup(["curse_trait_trembling_breath", "curse_trait_zero_point_freeze", "trait_first_turn_mastery"]);
assert.equal(E.handLimit(run), 6);
assert.equal(run.battle.ap, 3, "턴 AP 감소와 첫 턴 AP 증가가 함께 계산된다");

CARDS.test_trait_guard = { id: "test_trait_guard", name: "test", cost: 1, tier: 1, maxCopies: 4, maxUpgrade: 0, category: "defense", shield: 5 };
run = setup(["curse_trait_the_lost_vow"]);
run.battle.hand = [{ id: "test_trait_guard", level: 0 }];
run.battle.ap = 3;
E.play(run, 0, E.freshMeta());
assert.equal(run.battle.shield, 0, "상실자의 맹세는 모든 방어막 획득을 막는다");
delete CARDS.test_trait_guard;

run = E.newRun(8802);
run.inventory = ["trait_accord_cadence", "trait_accord_cadence", "curse_trait_scattered_notes"];
assert.equal(E.resolveHarmonyEffect(run).damage, 4, "하모니 증폭과 감소가 중첩 계산된다");

run.inventory = ["curse_trait_greed_bankruptcy"];
assert.equal(E.shopPrice(run, 25), 75);

console.log("PASS trait effects: end-turn absorb, hand/AP limits, shield lock, harmony modifiers and shop penalty.");

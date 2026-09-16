import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { CARDS, ITEMS } from "../games/harmony/data.js";
import { createCardPresentation } from "../games/harmony/card-presentation.js";

function combat(seed, cardId, { level = 0, inventory = [], extraHand = [] } = {}) {
  const run = E.newRun(seed), meta = E.freshMeta();
  run.inventory = [...inventory];
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemies = [run.battle.enemies[0]];
  E.attachEnemyAliases(run.battle);
  const enemy = run.battle.enemies[0];
  Object.assign(enemy, {
    hp: 1000,
    maxHp: 1000,
    shield: 0,
    statuses: {},
    isBoss: false,
    intent: { type: "guard", value: 0 },
  });
  run.battle.selectedTarget = 0;
  run.battle.ap = 10;
  run.battle.hand = [{ id: cardId, level }, ...extraHand];
  delete run._damageFeedback;
  delete run._enemyHitFeedback;
  delete run._statusProcFeedback;
  return { run, meta, enemy, battle: run.battle };
}

function play(ctx) {
  assert.equal(E.play(ctx.run, 0, ctx.meta), true);
}

{
  const ctx = combat(8101, "contact_fierce_rub", { inventory: ["trait_cauterizing_strike"] });
  ctx.run.hp = ctx.run.maxHp - 10;
  E.addStatus(ctx.run, "enemy", "bleed", 1);
  play(ctx);
  assert.equal(S.stacks(ctx.enemy, "bleed"), 0);
  assert.equal(ctx.run.hp, ctx.run.maxHp - 8, "마지막 출혈을 소비해도 다단히트 카드당 회복은 한 번이다");
}

{
  const ctx = combat(8102, "contact_beveled_scent_strip", { inventory: ["trait_cauterizing_strike"] });
  ctx.run.hp = ctx.run.maxHp - 10;
  play(ctx);
  assert.equal(S.stacks(ctx.enemy, "bleed"), 2);
  assert.equal(ctx.run.hp, ctx.run.maxHp - 10, "같은 카드가 새로 부여한 출혈은 회복 조건이 아니다");
}

{
  const zero = combat(8103, "contact_beveled_scent_strip", { inventory: ["trait_searing_friction"] });
  play(zero);
  assert.equal(S.stacks(zero.enemy, "burning"), 0);
  const one = combat(8104, "contact_glass_dropper_strike", { inventory: ["trait_searing_friction"] });
  one.battle.hand[0].costReduction = 1;
  play(one);
  assert.equal(S.stacks(one.enemy, "burning"), 2, "실제 지불 비용이 0이어도 원본 1 AP 카드면 발동한다");
}

{
  const ignite = combat(8105, "contact_glass_dropper_strike", { inventory: ["trait_friction_spark"] });
  play(ignite);
  assert.equal(S.stacks(ignite.enemy, "burning"), 1);
  const splinters = combat(8106, "contact_glass_dropper_strike", { inventory: ["trait_glass_splinters"] });
  splinters.enemy.shield = 1;
  play(splinters);
  assert.equal(S.stacks(splinters.enemy, "bleed"), 1);
  assert.equal((splinters.run._statusProcFeedback || []).length, 0);
}

{
  const ctx = combat(8107, "contact_glass_dropper_strike", {
    inventory: ["trait_open_wound_scent", "trait_bloodletting_torrent"],
  });
  ctx.run.hp = ctx.run.maxHp - 10;
  ctx.enemy.hp = 1;
  E.addStatus(ctx.run, "enemy", "bleed", 1);
  play(ctx);
  assert.equal(ctx.enemy.hp, 0);
  assert.equal(S.stacks(ctx.enemy, "bleed"), 0);
  assert.equal(ctx.run.hp, ctx.run.maxHp - 9, "처치타 출혈 proc도 흡혈 보상을 준다");
  assert.equal(ctx.battle.shield, 3, "처치타 출혈 proc도 방어막 보상을 준다");
  assert.equal((ctx.run._statusProcFeedback || []).filter((event) => event.statusId === "bleed").length, 1);
}

for (const [burning, expectedBleed] of [[0, 1], [2, 2]]) {
  const ctx = combat(8110 + burning, "contact_censer_shove");
  if (burning) E.addStatus(ctx.run, "enemy", "burning", burning);
  play(ctx);
  assert.equal(S.stacks(ctx.enemy, "bleed"), expectedBleed);
  assert.equal(S.stacks(ctx.enemy, "burning"), burning);
  assert.equal((ctx.run._statusProcFeedback || []).filter((event) => event.statusId === "bleed").length, 0);
}

{
  const ctx = combat(8113, "contact_volatile_overheat", {
    extraHand: [{ id: "contact_glass_dropper_strike", level: 0 }],
  });
  E.addStatus(ctx.run, "enemy", "burning", 2);
  play(ctx);
  assert.equal(ctx.run._enemyHitFeedback[0].attackPattern, "nonContact");
  assert.equal(S.stacks(ctx.enemy, "burning"), 1);
  assert.equal(E.discardFromHand(ctx.run, 0), true);
  assert.equal(S.stacks(ctx.enemy, "burning"), 4);
}

for (const burning of [0, 1, 2, 3, 4]) {
  const ctx = combat(8120 + burning, "contact_cauterizing_brand");
  if (burning) E.addStatus(ctx.run, "enemy", "burning", burning);
  play(ctx);
  const procCount = (ctx.run._statusProcFeedback || []).filter((event) => event.statusId === "burning").length;
  assert.equal(procCount, Math.min(3, burning), `연소 ${burning}에서 최대 3회만 발동`);
  assert.equal(S.stacks(ctx.enemy, "burning"), Math.max(0, burning - 3) + 6);
  assert.equal(ctx.run._enemyHitFeedback[0].attackPattern, "nonContact");
}

for (const [level, burn] of [[0, 6], [1, 7], [2, 8]]) {
  const ctx = combat(8130 + level, "contact_cauterizing_brand", { level });
  play(ctx);
  assert.equal(S.stacks(ctx.enemy, "burning"), burn);
}

{
  const ctx = combat(8134, "contact_cauterizing_brand");
  E.addStatus(ctx.run, "enemy", "burning", 99);
  play(ctx);
  assert.equal(S.stacks(ctx.enemy, "burning"), 18, "소비 후 재부여도 연소 최대 18을 넘지 않는다");
}

{
  const bleed = combat(8140, "contact_glass_dropper_strike", { inventory: ["trait_hemorrhage_cascade"] });
  E.addStatus(bleed.run, "enemy", "bleed", 1);
  play(bleed);
  assert.equal(bleed.run._enemyHitFeedback[0].damage, 9);
  const burnFlat = combat(8141, "noncontact_supercritical_beam", { inventory: ["trait_combustion_acceleration"] });
  E.addStatus(burnFlat.run, "enemy", "burning", 1);
  play(burnFlat);
  assert.equal(burnFlat.run._statusProcFeedback[0].amount, 7);
  const burnMultiplier = combat(8142, "noncontact_supercritical_beam", { inventory: ["trait_conflagration_inferno"] });
  E.addStatus(burnMultiplier.run, "enemy", "burning", 1);
  play(burnMultiplier);
  assert.equal(burnMultiplier.run._statusProcFeedback[0].amount, 8);

  const residue = combat(8143, "contact_glass_dropper_strike", { inventory: ["trait_kindling_residue"] });
  E.addStatus(residue.run, "enemy", "burning", 1);
  play(residue);
  assert.equal(residue.run._enemyHitFeedback[0].damage, 9);
}

{
  const ctx = combat(8144, "contact_glass_dropper_strike", {
    inventory: ["trait_eternal_sillage_storm"],
    extraHand: [
      { id: "contact_fierce_rub", level: 0 },
      { id: "contact_censer_shove", level: 0 },
    ],
  });
  play(ctx);
  play(ctx);
  play(ctx);
  assert.equal(S.stacks(ctx.enemy, "burning"), 5, "하모니 발동 시 영겁의 잔향 폭풍이 연소 5를 부여한다");
}

{
  const selfBurn = combat(8150, "noncontact_fine_mist_spray", { inventory: ["curse_trait_volatile_fume_cough"] });
  play(selfBurn);
  assert.equal(S.stacks(selfBurn.run, "burning"), 1);
  const selfBleed = combat(8151, "contact_glass_dropper_strike", { inventory: ["curse_trait_glass_recoil"] });
  play(selfBleed);
  assert.equal(S.stacks(selfBleed.run, "bleed"), 1);
  const doubled = combat(8152, "guard");
  doubled.run.inventory = ["curse_trait_double_debuff_agony"];
  E.addStatus(doubled.run, "player", "burning", 1);
  assert.equal(S.stacks(doubled.run, "burning"), 2);
}

{
  const mirrored = combat(8153, "contact_glass_dropper_strike", { inventory: ["curse_trait_brittle_veins"] });
  mirrored.run.hp = 80;
  E.addStatus(mirrored.run, "enemy", "bleed", 1);
  play(mirrored);
  assert.equal(mirrored.run.hp, 78);
  const backfire = combat(8154, "noncontact_supercritical_beam", { inventory: ["curse_trait_combustion_backdraft"] });
  backfire.run.hp = 80;
  E.addStatus(backfire.run, "enemy", "burning", 1);
  play(backfire);
  assert.equal(backfire.run.hp, 77);
}

{
  const run = E.newRun(8155), meta = E.freshMeta();
  run.inventory = ["curse_trait_feverish_metabolism"];
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemies.slice(1).forEach((enemy) => (enemy.hp = 0));
  const enemy = run.battle.enemies[0];
  enemy.hp = 50;
  enemy.maxHp = 100;
  enemy.intent = { type: "guard", value: 0 };
  E.addStatus(run, "enemy", "burning", 2);
  E.endTurn(run, meta);
  assert.equal(S.stacks(enemy, "burning"), 1);
  assert.equal(enemy.hp, 55);
}

{
  const startWith = (seed, inventory) => {
    const run = E.newRun(seed), meta = E.freshMeta();
    run.inventory = inventory;
    run.route[0] = "battle";
    E.enter(run, meta);
    return run;
  };
  const matches = startWith(8160, ["relic_old_incense_matches"]);
  assert.equal(matches.battle.enemies.reduce((sum, enemy) => sum + S.stacks(enemy, "burning"), 0), 1);
  const censer = startWith(8161, ["relic_eternal_incense_censer"]);
  assert.ok(censer.battle.enemies.every((enemy) => S.stacks(enemy, "burning") === 3));
  const wick = combat(8162, "guard");
  wick.run.inventory = ["relic_scented_candle_wick"];
  wick.run.rng = 1972;
  E.addStatus(wick.run, "enemy", "burning", 17);
  assert.equal(S.stacks(wick.enemy, "burning"), 18);
}

{
  const synergy = combat(8163, "noncontact_supercritical_beam", {
    inventory: ["gather_defense_0", "gather_pressureValve_0"],
  });
  E.addStatus(synergy.run, "enemy", "burning", 1);
  play(synergy);
  assert.equal(synergy.run._statusProcFeedback[0].amount, 6, "가압 기류가 연소 proc 피해를 20% 증폭한다");
  assert.equal(S.stacks(synergy.enemy, "burning"), 2, "가압 기류가 proc 이후 연소 2를 부여한다");
}

assert.equal(CARDS.contact_censer_shove.text, "접촉 피해 7 · 출혈 +1 · 대상이 연소 상태였다면 출혈 +1 추가");
assert.equal(CARDS.contact_volatile_overheat.name, "과열 휘발 분사");
assert.equal(CARDS.contact_volatile_overheat.attackPattern, "nonContact");
assert.equal(CARDS.contact_cauterizing_brand.name, "초고온 밀랍 분사");
assert.equal(CARDS.contact_cauterizing_brand.attackPattern, "nonContact");
assert.equal(CARDS.contact_cauterizing_brand.burnProcCount, 3);
assert.equal(CARDS.contact_cauterizing_brand.detonateBurning, undefined);
assert.equal(CARDS.contact_blazing_wick_brand.attackPattern, "contact", "T4 타오르는 목화 심지 낙인은 유지한다");
assert.equal(ITEMS.trait_searing_friction.description, "1코스트 이상 접촉 적중 시 적에게 장당 연소 2 부여");

{
  const presentation = createCardPresentation({
    engine: E,
    cards: CARDS,
    statusDefinitions: S.STATUS_DEFINITIONS,
    getRun: () => null,
    getStarted: () => false,
    tierStars: () => "",
  });
  assert.match(presentation.cardEffectText({ id: "contact_censer_shove", level: 0 }, true), /연소 상태였다면 출혈 \+1 추가/);
  assert.match(presentation.cardEffectText({ id: "contact_cauterizing_brand", level: 0 }, true), /기존 연소를 최대 3회 발동/);
  assert.match(presentation.cardEffectText({ id: "contact_cauterizing_brand", level: 0 }, true), /연소 \+6/);
}

console.log("PASS Harmony status-linked content: proc events, traits, curses, relics, synergies, and three card reworks.");

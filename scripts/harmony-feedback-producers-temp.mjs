import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { CARDS } from "../games/harmony/data.js";

const feedbackKeys = [
  "_absorbFeedback",
  "_absorbLossFeedback",
  "_shieldGainFeedback",
  "_healingFeedback",
  "_playerDamageFeedback",
  "_enemyHitFeedback",
  "_damageFeedback",
  "_statusProcFeedback",
  "_drawFeedback",
  "_shuffleFeedback",
];

function clearFeedback(run) {
  for (const key of feedbackKeys) delete run[key];
}

function combat(seed) {
  const meta = E.freshMeta();
  const run = E.newRun(seed);
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemies.slice(1).forEach((enemy) => (enemy.hp = 0));
  const enemy = run.battle.enemies[0];
  enemy.hp = 500;
  enemy.maxHp = 500;
  enemy.shield = 0;
  enemy.statuses = {};
  enemy.intent = { type: "guard", value: 0 };
  run.battle.selectedTarget = 0;
  run.battle.ap = 0;
  clearFeedback(run);
  return { run, meta, enemy };
}

function add(run, meta, id) {
  assert.equal(E.addInventoryItem(run, id, meta), true, `failed to add ${id}`);
}

function prepareRoundEnd(run, meta) {
  run.battle.ap = 0;
  assert.equal(E.executePlayerTurnEnd(run, meta), true);
  clearFeedback(run);
}

function play(run, meta, id) {
  run.battle.hand = [{ id, level: 0 }];
  run.battle.ap = 99;
  run.battle.selectedTarget = 0;
  clearFeedback(run);
  assert.equal(E.play(run, 0, meta), true, `failed to play ${id}`);
}

// 1. 운동 에너지 흡수벽
{
  const { run, meta, enemy } = combat(9101);
  add(run, meta, "trait_aegis_kinetic_absorption");
  run.battle.shield = 50;
  assert.equal(E.executePlayerTurnEnd(run, meta), true);
  clearFeedback(run);
  enemy.intent = { type: "attack", value: 20, hits: 1, attackPattern: "contact", name: "검증 타격" };
  const outcome = E.executeSingleEnemyAction(run, 0, meta);
  assert.equal(outcome.damage, 0);
  assert.equal(outcome.blocked, 20);
  assert.equal(run._absorbFeedback, 4);
}

// 2. 초임계 저장 앰플 — 2/3턴 이후도 매 Turn Start
{
  const { run, meta } = combat(9102);
  add(run, meta, "relic_supercritical_storage_ampoule");
  for (const expectedTurn of [2, 3, 4]) {
    prepareRoundEnd(run, meta);
    E.executeRoundEnd(run, meta);
    assert.equal(run.battle.turn, expectedTurn);
    assert.equal(run._absorbFeedback, 8, `turn ${expectedTurn} turnStartAbsorb feedback`);
    clearFeedback(run);
  }
}

// 3. 잔향의 기억
{
  const { run, meta } = combat(9103);
  add(run, meta, "trait_scent_memory_echo");
  run.battle.pendingDiscard = 1;
  run.battle.hand = [{ id: "guard", level: 0 }];
  clearFeedback(run);
  assert.equal(E.discardFromHand(run, 0, meta), true);
  assert.equal(run._absorbFeedback, 1);
}

// 4. 포화 분출
{
  const { run, meta } = combat(9104);
  add(run, meta, "trait_saturated_spillover");
  run.battle.absorb = 30;
  run.battle.shield = 0;
  clearFeedback(run);
  assert.equal(E.executePlayerTurnEnd(run, meta), true);
  assert.equal(run._shieldGainFeedback, 3);
}

// 5. 베이스 우디 고정
{
  const { run, meta } = combat(9105);
  add(run, meta, "trait_base_woody_anchor");
  play(run, meta, "guard");
  assert.equal(run.battle.nextTurnShield, 5);
  clearFeedback(run);
  run.battle.ap = 0;
  assert.equal(E.executePlayerTurnEnd(run, meta), true);
  clearFeedback(run);
  E.executeRoundEnd(run, meta);
  assert.equal(run._shieldGainFeedback, 5);
}

// 6. 안정 대사 작용
{
  const { run, meta } = combat(9106);
  add(run, meta, "relic_dewdrop_collector_funnel");
  add(run, meta, "trait_steady_metabolism");
  run.hp = 40;
  prepareRoundEnd(run, meta);
  E.executeRoundEnd(run, meta);
  assert.equal(run._healingFeedback, 2);
  assert.equal(run._shieldGainFeedback, 2);
}

// 7. 세포 분열 촉진
{
  const { run, meta } = combat(9107);
  add(run, meta, "relic_dewdrop_collector_funnel");
  add(run, meta, "trait_cell_regeneration_boost");
  run.hp = 40;
  prepareRoundEnd(run, meta);
  E.executeRoundEnd(run, meta);
  assert.equal(run._healingFeedback, 2);
  assert.equal(run._shieldGainFeedback, 3);
}

// 8. 이슬받이 깔때기
{
  const { run, meta } = combat(9108);
  add(run, meta, "relic_dewdrop_collector_funnel");
  run.hp = 40;
  prepareRoundEnd(run, meta);
  E.executeRoundEnd(run, meta);
  assert.equal(run._healingFeedback, 2);
}

// 9. 영원한 이슬 받침
{
  const { run, meta } = combat(9109);
  add(run, meta, "relic_dew_of_eternity");
  run.hp = 40;
  prepareRoundEnd(run, meta);
  E.executeRoundEnd(run, meta);
  assert.equal(run._healingFeedback, 4);
}

// 10. 플레이어 regeneration 상태
{
  const { run, meta } = combat(9110);
  run.hp = 40;
  E.addStatus(run, "player", "regeneration", 3);
  prepareRoundEnd(run, meta);
  E.executeRoundEnd(run, meta);
  assert.ok((run._healingFeedback || 0) >= 3);
}

// 11. Round End victory battleEndHeal
{
  const { run, meta, enemy } = combat(9111);
  add(run, meta, "relic_dried_chamomile_flower");
  run.hp = 40;
  enemy.hp = 1;
  E.addStatus(run, "enemy", "poison", 1);
  prepareRoundEnd(run, meta);
  E.executeRoundEnd(run, meta);
  assert.equal(run.phase, "reward");
  assert.equal(run._healingFeedback, 2);
}

// 12. 불안정한 용매
{
  const { run, meta } = combat(9112);
  add(run, meta, "curse_trait_unstable_solvent");
  run.hp = 50;
  run.battle.pendingDiscard = 1;
  run.battle.hand = [{ id: "guard", level: 0 }];
  clearFeedback(run);
  assert.equal(E.discardFromHand(run, 0, meta), true);
  assert.equal(run._playerDamageFeedback, 1);
  assert.equal(run._damageFeedback, undefined);
}

// 13. 심연의 도플갱어 꼭두각시
{
  const { run, meta } = combat(9113);
  add(run, meta, "curse_trait_abyssal_mirror_puppet");
  run.hp = 60;
  run.battle.shield = 0;
  run.battle.cardsPlayedDefinitions = [{ ...CARDS.strike, id: "strike" }];
  prepareRoundEnd(run, meta);
  E.executeRoundEnd(run, meta);
  assert.equal(run._playerDamageFeedback, CARDS.strike.attack);
}

// 14. 방패의 검신 연금술
{
  const { run, meta, enemy } = combat(9114);
  add(run, meta, "trait_shield_to_blade_transmute");
  run.battle.shield = 20;
  enemy.hp = 100;
  clearFeedback(run);
  assert.equal(E.executePlayerTurnEnd(run, meta), true);
  const hits = run._enemyHitFeedback || [];
  assert.equal(hits.length, 1);
  assert.equal(hits[0].damage, 4);
  assert.equal(enemy.hp, 96);
}

// 15. 일반 Absorb 카드
{
  const { run, meta } = combat(9115);
  play(run, meta, "oil");
  assert.equal(run._absorbFeedback, 5);
}

// 16. 일반 Defense 카드
{
  const { run, meta } = combat(9116);
  play(run, meta, "guard");
  assert.equal(run._shieldGainFeedback, 7);
}

// 17. 일반 Heal 카드
{
  const { run, meta } = combat(9117);
  run.hp = 40;
  play(run, meta, "heal");
  assert.equal(run._healingFeedback, 6);
}

// 18. 일반 Enemy Attack
{
  const { run, meta, enemy } = combat(9118);
  run.battle.shield = 0;
  assert.equal(E.executePlayerTurnEnd(run, meta), true);
  clearFeedback(run);
  enemy.intent = { type: "attack", value: 5, hits: 1, attackPattern: "contact", name: "검증 타격" };
  const outcome = E.executeSingleEnemyAction(run, 0, meta);
  assert.equal(outcome.damage, 5);
  assert.equal(run._playerDamageFeedback, 5);
  assert.equal(run._damageFeedback, undefined);
}

// 19. Status Damage remains separate
{
  const { run, meta } = combat(9119);
  E.addStatus(run, "player", "poison", 3);
  prepareRoundEnd(run, meta);
  E.executeRoundEnd(run, meta);
  const poison = (run._damageFeedback || []).filter((hit) => hit.target === "player" && hit.statusId === "poison");
  assert.ok(poison.length >= 1);
  assert.equal(run._playerDamageFeedback, undefined);
}

console.log("PASS Harmony named feedback producer scenarios: absorb, shield, heal, direct damage, enemy hit, and status separation.");

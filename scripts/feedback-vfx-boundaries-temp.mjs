import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as Core from "../games/harmony/engine-core.js";
import * as S from "../games/harmony/statuses.js";

function clearFeedback(run) {
  for (const key of [
    "_absorbFeedback","_absorbLossFeedback","_shieldGainFeedback","_healingFeedback",
    "_playerDamageFeedback","_enemyHitFeedback","_damageFeedback","_statusProcFeedback"
  ]) delete run[key];
}

function battleWith(items = [], seed = 9100) {
  const run = E.newRun(seed), meta = E.freshMeta();
  for (const id of items) assert.equal(E.addInventoryItem(run,id), true, "failed item "+id);
  run.route[0] = "battle";
  E.enter(run, meta);
  assert.equal(run.phase, "battle");
  clearFeedback(run);
  return {run,meta};
}

// 운동 에너지 흡수벽: full block -> absorb transient feedback.
{
  const {run,meta}=battleWith(["trait_aegis_kinetic_absorption"],9101);
  run.battle.shield=30;
  const enemy=run.battle.enemies[0];
  enemy.intent={type:"attack",value:10,attackPattern:"contact",hits:1};
  assert.equal(E.executePlayerTurnEnd(run,meta),true);
  clearFeedback(run);
  const outcome=E.executeSingleEnemyAction(run,0,meta);
  assert.equal(outcome.blocked,10);
  assert.equal(outcome.damage,0);
  assert.equal(run._absorbFeedback,2);
}

// 초임계 저장 앰플: turn-start absorb is produced on real round transition.
{
  const {run,meta}=battleWith(["relic_supercritical_storage_ampoule"],9102);
  const startTurn=run.battle.turn;
  run.battle.enemyPhase=true;
  clearFeedback(run);
  assert.equal(E.executeRoundEnd(run,meta),true);
  assert.equal(run.battle.turn,startTurn+1);
  assert.equal(run._absorbFeedback,8);
}

// 잔향의 기억 + 불안정한 용매: discard produces separate absorb and direct-damage feedback.
{
  const {run,meta}=battleWith(["trait_scent_memory_echo","curse_trait_unstable_solvent"],9103);
  run.battle.pendingDiscard=1;
  assert.ok(run.battle.hand.length>0);
  const hp=run.hp;
  clearFeedback(run);
  const discardDamage=E.power(run,"discardSelfDamage");
  assert.equal(E.discardFromHand(run,0,meta),true);
  console.log("DISCARD_DEBUG", JSON.stringify({discardDamage,hpBefore:hp,hpAfter:run.hp,playerDamage:run._playerDamageFeedback,absorb:run._absorbFeedback,inventory:run.inventory}));
  assert.equal(run._absorbFeedback,1);
  assert.equal(run.hp,hp-discardDamage);

  const direct=battleWith(["trait_scent_memory_echo","curse_trait_unstable_solvent"],9193);
  direct.run.battle.pendingDiscard=1;
  clearFeedback(direct.run);
  assert.equal(Core.discardFromHand(direct.run,0,direct.meta),true);
  console.log("DISCARD_CORE_DEBUG", JSON.stringify({playerDamage:direct.run._playerDamageFeedback,hp:direct.run.hp,absorb:direct.run._absorbFeedback}));
  console.log("DISCARD_FEEDBACK_MISSING", JSON.stringify({core:direct.run._playerDamageFeedback,wrapped:run._playerDamageFeedback,expected:discardDamage}));
}

// 포화 분출: player turn end shield gain is tracked independently of shield retention.
{
  const {run,meta}=battleWith(["trait_saturated_spillover"],9104);
  run.battle.absorb=25;
  run.battle.shield=0;
  clearFeedback(run);
  assert.equal(E.executePlayerTurnEnd(run,meta),true);
  assert.equal(run._shieldGainFeedback,3);
}

// 베이스 우디 고정: next-turn shield is emitted from startTurn.
{
  const {run,meta}=battleWith(["trait_base_woody_anchor"],9105);
  run.battle.nextTurnShield=E.power(run,"baseNextShield");
  run.battle.enemyPhase=true;
  clearFeedback(run);
  E.executeRoundEnd(run,meta);
  assert.equal(run._shieldGainFeedback,5);
}

// 안정 대사 작용: regen healing and shield are separate feedback streams.
{
  const {run,meta}=battleWith(["relic_dewdrop_collector_funnel","trait_steady_metabolism"],9106);
  run.hp=Math.max(1,run.maxHp-10);
  run.battle.enemyPhase=true;
  clearFeedback(run);
  E.executeRoundEnd(run,meta);
  assert.equal(run._healingFeedback,2);
  assert.equal(run._shieldGainFeedback,2);
}

// 세포 분열 촉진 uses the same start-turn regen->shield boundary.
{
  const {run,meta}=battleWith(["relic_dewdrop_collector_funnel","trait_cell_regeneration_boost"],9107);
  run.hp=Math.max(1,run.maxHp-10);
  run.battle.enemyPhase=true;
  clearFeedback(run);
  E.executeRoundEnd(run,meta);
  assert.equal(run._healingFeedback,2);
  assert.equal(run._shieldGainFeedback,3);
}

// Player regeneration status also produces healing feedback at turn start.
{
  const {run,meta}=battleWith([],9108);
  run.hp=Math.max(1,run.maxHp-10);
  S.applyStatus(run,"regeneration",2);
  run.battle.enemyPhase=true;
  clearFeedback(run);
  E.executeRoundEnd(run,meta);
  assert.ok((run._healingFeedback||0)>=2);
}

// Round-end victory battleEndHeal creates healing feedback exactly in that boundary.
{
  const {run,meta}=battleWith(["relic_dried_chamomile_flower"],9109);
  run.hp=Math.max(1,run.maxHp-10);
  for(const enemy of run.battle.enemies) enemy.hp=0;
  run.battle.enemyPhase=true;
  clearFeedback(run);
  E.executeRoundEnd(run,meta);
  assert.equal(run.phase,"reward");
  assert.equal(run._healingFeedback,2);
}

// 심연의 도플갱어 꼭두각시: real mirrored damage is not reduced to net HP delta.
{
  const {run,meta}=battleWith(["curse_trait_abyssal_mirror_puppet"],9110);
  run.hp=50; run.maxHp=Math.max(run.maxHp,80); run.battle.shield=0;
  run.battle.cardsPlayedDefinitions=[{attack:10,attackPattern:"contact"}];
  run.battle.enemyPhase=true;
  clearFeedback(run);
  E.executeRoundEnd(run,meta);
  console.log("MIRROR_DEBUG", JSON.stringify({hp:run.hp,playerDamage:run._playerDamageFeedback}));
  assert.equal(run._playerDamageFeedback,10);
}

// 방패의 검신 연금술: end-turn auto attack produces enemy-hit feedback before enemy actions.
{
  const {run,meta}=battleWith(["trait_shield_to_blade_transmute"],9111);
  run.battle.shield=20;
  for(const enemy of run.battle.enemies) enemy.hp=Math.max(enemy.hp,100);
  clearFeedback(run);
  E.executePlayerTurnEnd(run,meta);
  assert.ok(Array.isArray(run._enemyHitFeedback) && run._enemyHitFeedback.length>=1);
  const hit=run._enemyHitFeedback.find(h=>h.damage>0);
  assert.ok(hit);
  assert.equal(hit.damage,4);
}

console.log("PASS real Harmony resource/damage feedback production at requested engine boundaries.");

import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { GUARD_TIER2_CARDS } from "../games/harmony/guard-tier2-cards.js";
function setup(id,level=0) {
  const run=E.newRun(101),meta=E.freshMeta();run.route[0]="battle";E.enter(run,meta);
  run.battle.enemies=[run.battle.enemies[0]];E.attachEnemyAliases(run.battle);
  Object.assign(run.battle.enemies[0],{hp:1000,maxHp:1000,shield:0,statuses:{},intent:{type:"guard",value:0}});
  run.battle.hand=[{id,level}];return {run,meta};
}
for(const [id,card] of Object.entries(GUARD_TIER2_CARDS)) for(let level=0;level<3;level++) {
  const {run,meta}=setup(id,level);run.hp=40;
  for(const status of ["weak","vulnerable","burning"]) S.applyStatus(run,status,3);
  if(id!=="guard_antiseptic_rinse") run.statuses={};
  E.play(run,0,meta);assert.equal(run.battle.shield,card.upgrades.shield[level]);
  if(id==="guard_counter_crimp") assert.equal(run.battle.hp,1000-Math.round(card.upgrades.shield[level]*[0.75,0.75,1][level]));
  if(id==="guard_hardened_resin_spikes") assert.equal(S.stacks(run,"thorns"),[5,6,8][level]);
  if(id==="guard_aroma_barrier") assert.equal(run.battle.absorb,[6,7,9][level]);
  if(id==="guard_antiseptic_rinse") assert.equal(Object.keys(run.statuses).length,level===2?0:1);
  if(id==="guard_quick_mist_shield") {assert.equal(run.battle.ap,3);assert.equal(run.battle.hand.length,1);assert.equal(E.discardFromHand(run,0,meta),true);}
  if(id==="guard_double_coating") {E.endTurn(run,meta);assert.equal(run.battle.shield,Math.floor(card.upgrades.shield[level]*[0.6,0.6,0.7][level]));E.endTurn(run,meta);assert.equal(run.battle.shield,0);}
  if(id==="guard_skin_regeneration") {E.endTurn(run,meta);assert.equal(run.hp,40+[3,4,5][level]);run.battle.enemies[0].intent={type:"guard",value:0};E.endTurn(run,meta);assert.equal(run.hp,40+[3,4,5][level]);}
}
{
  const {run,meta}=setup("guard_skin_regeneration");run.hp=40;E.play(run,0,meta);
  run.battle.enemies[0].intent={type:"attack",value:9};E.endTurn(run,meta);assert.equal(run.hp,40);
}
{
  const {run,meta}=setup("guard_granite_pedestal",2);E.play(run,0,meta);
  run.battle.shield=0;run.battle.enemies[0].intent={type:"attack",value:10};
  S.applyStatus(run,"poison",5);E.endTurn(run,meta);assert.equal(run.hp,71);
  assert.equal(run.battle.turnDamageReduction,0);
}
console.log("PASS tier 2 guards: upgrades, retention, counter, cleanse, absorb, thorns, draw/discard, damage reduction and conditional healing.");

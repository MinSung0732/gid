import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { NONCONTACT_TIER2_CARDS } from "../games/harmony/noncontact-tier2-cards.js";
import { CARDS, getTier1Cards } from "../games/harmony/data.js";
function setup(id,level) {
  const run=E.newRun(101),meta=E.freshMeta();run.route[0]="battle";E.enter(run,meta);
  const template=run.battle.enemies[0];
  run.battle.enemies=Array.from({length:3},()=>({...template,hp:100,maxHp:100,shield:0,statuses:{},isBoss:false}));
  E.attachEnemyAliases(run.battle);run.battle.ap=3;
  run.battle.enemies.forEach(e=>S.applyStatus(e,"thorns",3));
  run.battle.hand=[{id,level},{id:"guard_marble_stand",level:0}];return {run,meta};
}
for(const id of Object.keys(NONCONTACT_TIER2_CARDS)) {
  assert.equal(CARDS[id].tier,2);assert.equal(CARDS[id].maxCopies,2);assert.equal(CARDS[id].maxUpgrade,2);
  assert.ok(!getTier1Cards().some(c=>c.id===id));
}
for(let level=0;level<3;level++) {
  let {run,meta}=setup("noncontact_aerosol_sweep",level);E.play(run,0,meta);
  assert.deepEqual(run.battle.enemies.map(e=>e.hp),Array(3).fill(100-[11,13,16][level]));
  assert.ok(run.battle.enemies.every(e=>S.stacks(e,"vulnerable")===[1,1,2][level]));assert.equal(run.hp,80);
  ({run,meta}=setup("noncontact_toxic_vapor",level));E.selectTarget(run,1);E.play(run,0,meta);
  assert.deepEqual(run.battle.enemies.map(e=>e.hp),[100,100-[7,9,11][level],100]);
  assert.equal(S.stacks(run.battle.enemies[1],"poison"),[5,6,8][level]);assert.equal(run.hp,80);
  for(const offset of [-1,0]) {
    ({run,meta}=setup("noncontact_solvent_jet",level));const absorb=[20,20,15][level]+offset;
    run.battle.absorb=absorb;E.play(run,0,meta);assert.equal(run.battle.ap,offset===0?3:2);
    assert.equal(run.battle.absorb,absorb);assert.equal(run.battle.hp,100-[12,15,18][level]);
  }
  ({run,meta}=setup("noncontact_diffusing_mist",level));E.play(run,0,meta);
  E.selectTarget(run,1);E.discardFromHand(run,0,meta);
  assert.deepEqual(run.battle.enemies.map(e=>e.hp),[100-[8,10,12][level]-2*[4,5,6][level],100,100]);assert.equal(run.hp,80);
}
{
  const {run,meta}=setup("noncontact_diffusing_mist",0);
  run.battle.enemies.forEach(e=>e.hp=0);run.battle.enemies[0].hp=16;
  E.play(run,0,meta);assert.equal(run.phase,"battle");E.discardFromHand(run,0,meta);assert.equal(run.phase,"reward");
}
console.log("PASS noncontact tier 2: upgrades, AoE, selected target, poison, thorns immunity, refund boundaries, discard damage and victory.");

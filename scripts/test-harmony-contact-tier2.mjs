import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { CARDS, getTier1Cards } from "../games/harmony/data.js";
import { CONTACT_TIER2_CARDS } from "../games/harmony/contact-tier2-cards.js";
function setup(id, level) {
  const run=E.newRun(101), meta=E.freshMeta(); run.route[0]="battle"; E.enter(run,meta);
  run.battle.enemies=[run.battle.enemies[0]]; E.attachEnemyAliases(run.battle);
  Object.assign(run.battle.enemies[0],{hp:1000,maxHp:1000,shield:0,statuses:{},isBoss:false});
  run.battle.ap=8; run.battle.hand=[{id,level},{id:"contact_glass_dropper_strike",level:0}];
  return {run,meta};
}
assert.equal(Object.keys(CONTACT_TIER2_CARDS).length,8);
for(const id of Object.keys(CONTACT_TIER2_CARDS)) {
  assert.equal(CARDS[id].tier,2); assert.equal(CARDS[id].maxCopies,2); assert.equal(CARDS[id].maxUpgrade,2);
  assert.ok(!getTier1Cards().some(c=>c.id===id));
}
for(let level=0;level<3;level++) {
  for(const [id,damage] of Object.entries({contact_pestle_grind:[12,14,16],contact_heavy_crimp:[26,29,33],contact_glass_cleaver:[10,12,14],contact_volatile_overheat:[11,13,16],contact_resin_smash:[9,11,13],contact_steel_pierce:[9,11,13],contact_friction_combustion:[8,10,13],contact_execution_stamp:[20,24,28]})) {
    const {run,meta}=setup(id,level); if(id==="contact_heavy_crimp") run.battle.shield=20;
    E.play(run,0,meta); assert.equal(1000-run.battle.hp,damage[level],`${id} +${level}`);
    if(id==="contact_heavy_crimp") assert.equal(run.battle.shield,20+[6,8,10][level]);
    if(id==="contact_pestle_grind") assert.equal(run.battle.absorb,3);
    if(id==="contact_steel_pierce") {
      assert.equal(S.stacks(run.battle.enemies[0],"weak"),[1,2,2][level]);
      assert.equal(S.stacks(run.battle.enemies[0],"vulnerable"),[2,2,3][level]);
    }
    if(id==="contact_volatile_overheat") {
      assert.equal(E.discardFromHand(run,0),true);
      assert.equal(S.stacks(run.battle.enemies[0],"burning"),3+level);
    }
  }
  let ctx=setup("contact_resin_smash",level); ctx.run.battle.absorb=8; E.play(ctx.run,0,ctx.meta);
  assert.equal(ctx.run.battle.hp,1000-[17,20,24][level]); assert.equal(ctx.run.battle.absorb,0);
  ctx=setup("contact_execution_stamp",level); ctx.run.battle.hp=500; E.play(ctx.run,0,ctx.meta);
  assert.equal(ctx.run.battle.hp,500-[30,36,42][level]);
  ctx=setup("contact_friction_combustion",level);
  for(const id of ["burning","bleed","poison"]) S.applyStatus(ctx.run.battle.enemies[0],id,2);
  E.play(ctx.run,0,ctx.meta); assert.equal(ctx.run.battle.hp,1000-[8,10,13][level]-6);
}
for(const shield of [0,10,20,30]) {
  const {run,meta}=setup("contact_glass_cleaver",0); run.battle.enemyShield=shield;
  E.play(run,0,meta); assert.equal(run.battle.enemyShield,Math.max(0,shield-20));
  assert.equal(run.battle.hp,1000-Math.max(0,10-shield/2));
  assert.equal(run.battle.ap,shield>0&&shield<=20?8:7);
}
{
  const {run,meta}=setup("contact_volatile_overheat",0);
  run.battle.hand[1]={id:"guard_paraffin_seal",level:0}; E.play(run,0,meta); E.discardFromHand(run,0);
  assert.equal(S.stacks(run.battle.enemies[0],"burning"),0);
}
console.log("PASS contact tier 2: eight cards, upgrades, shield damage/refund, discard burn, absorb spending, debuffs and execution.");

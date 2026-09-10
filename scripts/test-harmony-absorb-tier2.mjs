import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { CARDS, getTier1Cards } from "../games/harmony/data.js";
function setup(id, level, absorb=0) {
  const run=E.newRun(101),meta=E.freshMeta();run.route[0]="battle";E.enter(run,meta);
  run.battle.absorb=absorb;run.battle.hand=[{id,level}];run.battle.draw=[];run.battle.discard=[];
  return {run,meta};
}
for(const id of ["absorb_vacuum_distill","absorb_resonance_catalyst"]) {
  assert.equal(CARDS[id].tier,2);assert.equal(CARDS[id].maxCopies,2);assert.equal(CARDS[id].maxUpgrade,2);
  assert.ok(!getTier1Cards().some(c=>c.id===id));
}
for(let level=0;level<3;level++) {
  const {run,meta}=setup("absorb_vacuum_distill",level);
  const finisher={id:"burst_spatial_diffusion",level:1};
  run.battle.draw=[{id:"guard_paraffin_seal",level:0},finisher];
  E.play(run,0,meta);assert.equal(run.battle.absorb,[12,15,18][level]);
  assert.deepEqual(run.battle.hand,[finisher]);assert.equal(run.battle.draw.length,1);
  for(const starting of [0,19-[6,8,10][level],20-[6,8,10][level],20,90]) {
    const ctx=setup("absorb_resonance_catalyst",level,starting);
    E.play(ctx.run,0,ctx.meta);
    const base=Math.min(100,starting+[6,8,10][level]);
    assert.equal(ctx.run.battle.absorb,Math.min(100,base+(base>=20?Math.round(base*[0.5,0.5,0.6][level]):0)));
  }
}
{
  const {run,meta}=setup("absorb_vacuum_distill",0);
  run.battle.discard=[{id:"burst_spatial_diffusion",level:0}];
  E.play(run,0,meta);assert.equal(run.battle.hand.length,0);assert.equal(run.battle.absorb,12);
}
{
  const {run,meta}=setup("absorb_vacuum_distill",0);
  run.battle.hand.push(...Array.from({length:E.handLimit(run)},()=>({id:"guard_paraffin_seal",level:0})));
  run.battle.draw=[{id:"burst_spatial_diffusion",level:0}];
  E.play(run,0,meta);assert.equal(run.battle.draw.length,1);assert.equal(run.battle.hand.length,E.handLimit(run));
}
console.log("PASS tier 2 absorb: upgrades, exact draw-pile search, retained upgrade, full hand, threshold boundaries and absorb cap.");

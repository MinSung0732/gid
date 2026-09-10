import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import { getTier1Cards } from "../games/harmony/data.js";
function combat() {
  const run = E.newRun(101), meta = E.freshMeta();
  run.route[0] = "battle"; E.enter(run, meta);
  run.battle.enemies = [run.battle.enemies[0]]; E.attachEnemyAliases(run.battle);
  Object.assign(run.battle.enemies[0], { hp: 1000, maxHp: 1000, shield: 0, statuses: {}, intent: { type: "guard", value: 0 } });
  return { run, meta };
}
function play(ctx, id, level = 0) {
  ctx.run.battle.hand = [{ id, level }]; ctx.run.battle.ap = 8;
  assert.equal(E.play(ctx.run, 0, ctx.meta), true);
}
assert.equal(getTier1Cards().filter(c => c.id.startsWith("absorb_")).length, 5);
for (const [id, values] of Object.entries({
  absorb_precision_pipette: [8,10,13,16], absorb_cold_maceration: [5,7,9,11],
  absorb_pure_oil_drop: [4,5,6,8], absorb_solvent_percolation: [6,7,8,10],
  absorb_fragrance_primer: [4,6,8,10],
})) for(let level=0;level<4;level++) {
  const ctx=combat(); play(ctx,id,level);
  assert.equal(ctx.run.battle.absorb,values[level],`${id} +${level}`);
  if(id === "absorb_solvent_percolation") assert.equal(ctx.run.battle.hp,1000-[4,6,8,10][level]);
  if(id === "absorb_pure_oil_drop") { assert.equal(ctx.run.battle.ap,8); assert.equal(ctx.run.battle.hand.length,1); }
  if(id === "absorb_fragrance_primer") {
    play(ctx,"guard_base_anchor");
    assert.equal(ctx.run.battle.absorb,values[level]+4+3+level);
    play(ctx,"absorb_solvent_percolation");
    assert.equal(ctx.run.battle.absorb,values[level]+10+2*(3+level));
    play(ctx,"absorb_precision_pipette");
    assert.equal(ctx.run.battle.absorb,values[level]+18+2*(3+level));
  }
}
{
  const ctx=combat(); ctx.run.battle.absorb=50;
  play(ctx,"absorb_cold_maceration"); E.endTurn(ctx.run,ctx.meta);
  assert.equal(ctx.run.battle.absorb,55);
  E.endTurn(ctx.run,ctx.meta); assert.equal(ctx.run.battle.absorb,49);
}
{
  const ctx=combat(); play(ctx,"absorb_fragrance_primer");
  play(ctx,"guard_paraffin_seal"); play(ctx,"guard_paraffin_seal");
  play(ctx,"absorb_precision_pipette"); assert.equal(ctx.run.battle.absorb,12);
  play(ctx,"absorb_fragrance_primer"); E.endTurn(ctx.run,ctx.meta);
  assert.deepEqual(ctx.run.battle.absorbBoosters,[]);
}
console.log("PASS Harmony absorb: five cards, every upgrade, attack, free draw, one-turn preservation and two-card booster.");

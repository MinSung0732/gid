import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { getTier1Cards } from "../games/harmony/data.js";
import { saveGame, loadGame } from "../games/harmony/persistence.js";

function combat(id, level = 0) {
  const run = E.newRun(101), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemies = [run.battle.enemies[0]];
  E.attachEnemyAliases(run.battle);
  Object.assign(run.battle.enemies[0], { hp: 1000, maxHp: 1000, shield: 0, statuses: {}, intent: { type: "guard", value: 0 } });
  run.battle.hand = [{ id, level }, { id: "guard_paraffin_seal", level: 0 }];
  return { run, meta };
}
const shields = {
  guard_paraffin_seal: [8,10,12,14], guard_wax_coating: [6,8,10,12],
  guard_marble_stand: [15,18,21,25], guard_alcohol_rinse: [5,7,9,11],
  guard_kraft_wrapping: [6,8,10,12], guard_amber_resin: [6,8,10,12],
  guard_base_anchor: [5,7,9,11], guard_solvent_purge: [4,6,8,10],
  guard_aroma_veil: [6,8,10,12],
};
assert.equal(getTier1Cards().filter(c => c.category === "defense").length, 10);
for (const [id, values] of Object.entries(shields)) {
  for (let level=0; level<4; level++) {
    const {run,meta}=combat(id,level);
    S.applyStatus(run,"weak",2); S.applyStatus(run,"vulnerable",2);
    assert.equal(E.play(run,0,meta),true);
    assert.equal(run.battle.shield,values[level],`${id} +${level}`);
    if(id === "guard_amber_resin") assert.equal(S.stacks(run,"thorns"),3+level);
    if(id === "guard_base_anchor") assert.equal(run.battle.absorb,[4,5,6,8][level]);
    if(id === "guard_alcohol_rinse") assert.equal(Object.keys(run.statuses).length,level===3?0:1);
    if(id === "guard_kraft_wrapping") assert.equal(run.battle.hand.length,2);
    if(id === "guard_aroma_veil") assert.equal(S.directDamage(10,run.battle.enemies[0],{statuses:{}}),10-[2,2,3,4][level]);
  }
}
for(let level=0;level<4;level++) {
  const {run,meta}=combat("guard_heavy_pestle",level);
  run.battle.shield=20;
  E.play(run,0,meta);
  assert.equal(run.battle.hp,1000-10-[5,7,9,12][level]);
  assert.equal(run.battle.shield,20);
}
{
  const {run,meta}=combat("guard_wax_coating");
  E.play(run,0,meta); E.endTurn(run,meta);
  assert.equal(run.battle.shield,3);
  E.endTurn(run,meta); assert.equal(run.battle.shield,0);
}
{
  const {run,meta}=combat("guard_aroma_veil");
  E.play(run,0,meta); E.endTurn(run,meta);
  assert.equal(S.stacks(run.battle.enemies[0],"intimidated"),0);
}
{
  const {run,meta}=combat("guard_solvent_purge");
  run.battle.ap=0;
  E.play(run,0,meta);
  assert.equal(E.executePlayerTurnEnd(run,meta),false);
  const storage = { data:new Map(), getItem(k){return this.data.get(k)??null;}, setItem(k,v){this.data.set(k,v);}, removeItem(k){this.data.delete(k);} };
  saveGame(storage,{run,meta});
  const restored=loadGame(storage).run;
  assert.equal(restored.battle.pendingDiscard,1);
  assert.equal(E.discardFromHand(restored,0),true);
  assert.equal(restored.battle.pendingDiscard,0);
  assert.equal(restored.battle.hand.length,0);
  assert.equal(E.executePlayerTurnEnd(restored,meta),true);
}
console.log("PASS Harmony guards: all upgrade values, shield scaling, cleanse, draw, thorns, absorb, retention, intimidation and saved discard choice.");

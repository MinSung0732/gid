import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../games/harmony/engine.js";

const styles = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8");
const supportStyles = await readFile(
  new URL("../games/harmony/player-support-ui.css", import.meta.url),
  "utf8",
);
const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8");
assert.match(
  styles,
  /\.battle > \.hand \.card \.card-symbol\s*\{[^}]*grid-row:\s*2;[^}]*grid-column:\s*1;/s,
  "the hand card icon stays pinned under the unavailable-reason overlay",
);
assert.match(main, /disabled\s*\?\s*" card-ap-unavailable"\s*:\s*" card-ap-available"/s);
assert.match(supportStyles, /\.card-ap-value\.card-ap-available\s*\{[^}]*color:\s*#086b45;[^}]*background:\s*transparent\s*!important;/s);
assert.match(supportStyles, /\.card-ap-value\.card-ap-unavailable\s*\{[^}]*color:\s*#ad2929;[^}]*background:\s*transparent\s*!important;/s);
assert.match(supportStyles, /content:\s*"회복약 인벤토리"/);
assert.match(supportStyles, /content:\s*"내 상태 정보"/);
assert.match(supportStyles, /\.player-effects-side \.status-list\s*\{[^}]*overflow-y:\s*auto;/s);

function combat(cardId, seed = 7310) {
  const run = E.newRun(seed), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemyPhase = false;
  run.battle.pendingDiscard = 0;
  run.battle.ap = 99;
  run.battle.absorb = 99;
  run.battle.hand = [{ id: cardId, level: 0 }];
  run.hp = run.maxHp - 1;
  return run;
}

{
  const run = combat("strike"), card = run.battle.hand[0];
  run.battle.ap = 0;
  assert.equal(E.cardPlayBlockReason(run, card), "1 AP 필요 · 현재 0");
  assert.equal(E.canPlay(run, card), false);
}
{
  const run = combat("heal_aloe_salve"), card = run.battle.hand[0];
  run.hp = run.maxHp;
  assert.equal(E.cardPlayBlockReason(run, card), "체력이 이미 최대");
}
{
  const run = combat("contact_pure_absorb_overload"), card = run.battle.hand[0];
  run.battle.absorb = 7;
  assert.equal(E.cardPlayBlockReason(run, card), "흡수 20 필요 · 현재 7");
}
{
  const run = combat("strike"), card = run.battle.hand[0];
  run.statuses.stun = { stacks: 1 };
  assert.equal(E.cardPlayBlockReason(run, card), "기절 · 행동 불가");
}
{
  const run = combat("strike"), card = run.battle.hand[0];
  run.statuses.disarm = { stacks: 1, turns: 1 };
  assert.equal(E.cardPlayBlockReason(run, card), "무장 해제 · 공격 카드 사용 불가");
}
{
  const run = combat("strike"), card = run.battle.hand[0];
  run.statuses.seal = { stacks: 1, turns: 1, cardIds: ["strike"] };
  assert.equal(E.cardPlayBlockReason(run, card), "봉인 · 이 카드 사용 불가");
}
{
  const run = combat("strike"), card = run.battle.hand[0];
  card.traitLocked = run.battle.turn;
  assert.equal(E.cardPlayBlockReason(run, card), "특성 효과로 이번 턴 잠김");
}
{
  const run = combat("impurity");
  run.statuses.impurityLock = { stacks: 1, turns: 1 };
  assert.equal(
    E.cardDiscardBlockReason(run, run.battle.hand[0]),
    "불순물 고정 · 버리기 불가",
  );
  assert.equal(E.canDiscard(run, run.battle.hand[0]), false);
}

console.log("PASS Harmony card block reasons and sidebar support styling are wired.");

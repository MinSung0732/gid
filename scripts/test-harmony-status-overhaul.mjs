import assert from "node:assert/strict";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";
import { CARDS } from "../games/harmony/data.js";
import { LATE_GAME_ACTS } from "../games/harmony/late-game-content.js";
import { normalizeGamePayload } from "../games/harmony/persistence.js";

function combat(seed, cardId = "strike") {
  const run = E.newRun(seed), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemies.slice(1).forEach((enemy) => (enemy.hp = 0));
  const enemy = run.battle.enemies[0];
  enemy.hp = 300;
  enemy.maxHp = 300;
  enemy.shield = 0;
  enemy.intent = { type: "guard", value: 0 };
  run.battle.selectedTarget = 0;
  run.battle.hand = [{ id: cardId, level: 0 }];
  run.battle.ap = 10;
  delete run._damageFeedback;
  delete run._enemyHitFeedback;
  return { run, meta, enemy };
}

assert.equal(Object.keys(S.STATUS_DEFINITIONS).length, 23, "Status codex contains 23 live statuses");
for (const id of ["intimidated", "scentBlock", "noteCollapse"])
  assert.equal(S.STATUS_DEFINITIONS[id], undefined, `${id} is removed from live status definitions`);
assert.equal(S.STATUS_DEFINITIONS.bleed.maxStacks, 8);
assert.equal(S.STATUS_DEFINITIONS.bleed.durationType, "triggerConsume");
assert.equal(S.STATUS_DEFINITIONS.burning.maxStacks, 18);
assert.equal(S.STATUS_DEFINITIONS.burning.durationType, "triggerConsume");
assert.equal(S.STATUS_DEFINITIONS.poison.durationType, "stackDecay");
for (const id of ["bleed", "burning", "poison", "corrosion"])
  assert.equal(
    S.STATUS_DEFINITIONS[id].persistsBetweenBattles,
    true,
    `${id} is explicitly marked to persist between combat rooms`,
  );
for (const id of ["weak", "strength", "protection", "confusion", "interference"])
  assert.notEqual(
    S.STATUS_DEFINITIONS[id].persistsBetweenBattles,
    true,
    `${id} remains combat-scoped`,
  );
assert.equal(S.STATUS_DEFINITIONS.confusion.failureChance, 0.222);
assert.equal(S.STATUS_DEFINITIONS.confusion.maxStacks, 1);
assert.equal(S.STATUS_DEFINITIONS.interference.secondaryFailurePerStack, 0.1);
assert.equal(S.STATUS_DEFINITIONS.regeneration.stackRule, "add");
assert.equal(S.STATUS_DEFINITIONS.regeneration.durationRule, "refresh");

function enemyTurnRun(seed = 4190) {
  const run = E.newRun(seed), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.battle.enemyPhase = true;
  run.battle.completedEnemies = [];
  run.battle.shield = 0;
  return { run, meta };
}

// Enemy regeneration heals only the missing HP, reports the actual restored amount,
// and consumes one afterTrigger duration tick.
{
  const { run, meta } = enemyTurnRun(4191), enemy = run.battle.enemies[0];
  run.battle.enemies.splice(1);
  enemy.hp = 40;
  enemy.maxHp = 100;
  enemy.shield = 0;
  enemy.intent = { type: "guard", value: 0 };
  enemy.statuses = {};
  S.applyStatus(enemy, "regeneration", { stacks: 5, turns: 1 });
  const outcome = E.executeSingleEnemyAction(run, 0, meta);
  assert.equal(enemy.hp, 45, "enemy regeneration restores exactly its stack amount");
  assert.equal(outcome.regenerationRestored, 5);
  assert.equal(S.stacks(enemy, "regeneration"), 0, "one-turn regeneration expires after triggering");
}

// Regeneration near max HP reports only the effective heal instead of the stack value.
{
  const { run, meta } = enemyTurnRun(4192), enemy = run.battle.enemies[0];
  run.battle.enemies.splice(1);
  enemy.hp = 98;
  enemy.maxHp = 100;
  enemy.shield = 0;
  enemy.intent = { type: "guard", value: 0 };
  enemy.statuses = {};
  S.applyStatus(enemy, "regeneration", { stacks: 5, turns: 1 });
  const outcome = E.executeSingleEnemyAction(run, 0, meta);
  assert.equal(enemy.hp, 100);
  assert.equal(outcome.regenerationRestored, 2, "UI feedback contract uses actual restored HP");
}

// Add + refresh stacking remains intact: 5/1 + 3/2 => 8 stacks / 2 turns,
// then the trigger heals 8 and leaves one turn.
{
  const { run, meta } = enemyTurnRun(4193), enemy = run.battle.enemies[0];
  run.battle.enemies.splice(1);
  enemy.hp = 50;
  enemy.maxHp = 100;
  enemy.shield = 0;
  enemy.intent = { type: "guard", value: 0 };
  enemy.statuses = {};
  S.applyStatus(enemy, "regeneration", { stacks: 5, turns: 1 });
  S.applyStatus(enemy, "regeneration", { stacks: 3, turns: 2 });
  assert.equal(S.stacks(enemy, "regeneration"), 8);
  assert.equal(S.turns(enemy, "regeneration"), 2);
  const outcome = E.executeSingleEnemyAction(run, 0, meta);
  assert.equal(enemy.hp, 58);
  assert.equal(outcome.regenerationRestored, 8);
  assert.equal(S.stacks(enemy, "regeneration"), 8);
  assert.equal(S.turns(enemy, "regeneration"), 1);
}

// Symbiotic applyAllies grants independent regeneration state. The acting healer
// does not cause an ally heal until that ally's own action starts.
{
  const { run, meta } = enemyTurnRun(4194),
    template = LATE_GAME_ACTS.act5.normals.symbiotic_mycelium,
    healer = {
      ...structuredClone(template),
      hp: 50, maxHp: 100, shield: 0, statuses: {},
      intent: structuredClone(template.pattern[0]),
    },
    ally = {
      id: "regen-test-ally", name: "재생 테스트 아군", hp: 50, maxHp: 100,
      shield: 0, statuses: {}, intent: { type: "guard", value: 0 }, pattern: [],
    };
  run.battle.enemies = [healer, ally];
  run.battle.completedEnemies = [];
  const healerOutcome = E.executeSingleEnemyAction(run, 0, meta);
  assert.equal(healerOutcome.regenerationRestored, 0);
  assert.equal(healer.hp, 50);
  assert.equal(ally.hp, 50);
  assert.equal(S.stacks(healer, "regeneration"), 5);
  assert.equal(S.stacks(ally, "regeneration"), 5);
  const allyOutcome = E.executeSingleEnemyAction(run, 1, meta);
  assert.equal(allyOutcome.regenerationRestored, 5);
  assert.equal(ally.hp, 55);
  assert.equal(healer.hp, 50, "one enemy regeneration must not mutate another enemy HP");
  assert.equal(S.stacks(ally, "regeneration"), 0);
  assert.equal(S.stacks(healer, "regeneration"), 5);
}

assert.equal(S.interferenceFailureChance({ statuses: { interference: { stacks: 5 } } }), 0.5);
assert.equal(
  S.cardRestricted({ statuses: { seal: { stacks: 1, blockNoteGain: true, blockHarmony: true } } }, { ...CARDS.strike, id: "strike" }),
  false,
  "A note/harmony-only Seal does not also disable card use",
);
assert.equal(
  S.cardRestricted({ statuses: { seal: { stacks: 1, notes: ["top"] } } }, { ...CARDS.strike, id: "strike" }),
  true,
  "Seal still supports note-specific card restrictions",
);

{
  const target = { statuses: {} };
  S.applyStatus(target, "bleed", 99);
  S.applyStatus(target, "burning", 99);
  assert.equal(S.stacks(target, "bleed"), 8, "Bleed caps at 8 stacks");
  assert.equal(S.stacks(target, "burning"), 18, "Burning caps at 18 stacks");
  assert.equal(S.turns(target, "bleed"), 0, "Bleed has no duration");
  assert.equal(S.turns(target, "burning"), 0, "Burning has no duration");
}

{
  const { run, meta, enemy } = combat(4101, "contact_fierce_rub");
  E.addStatus(run, "enemy", "bleed", 5);
  E.play(run, 0, meta);
  assert.equal(S.stacks(enemy, "bleed"), 2, "Three contact hits consume three Bleed stacks");
  assert.equal(
    (run._damageFeedback || []).filter((hit) => hit.statusId === "bleed").length,
    3,
    "Each contact hit emits a separate Bleed proc event",
  );
  assert.ok(
    (run._damageFeedback || []).filter((hit) => hit.statusId === "bleed").every((hit) => hit.amount >= 1),
    "Positive Bleed procs remain visible as integer damage",
  );
}

{
  const { run, meta, enemy } = combat(4102, "noncontact_rapid_aerosol_burst");
  E.addStatus(run, "enemy", "burning", 5);
  E.play(run, 0, meta);
  assert.equal(S.stacks(enemy, "burning"), 2, "Three non-contact hits consume three Burning stacks");
  assert.equal(
    (run._damageFeedback || []).filter((hit) => hit.statusId === "burning").length,
    3,
    "Each non-contact hit emits a separate Burning proc event",
  );
}

{
  const { run, meta, enemy } = combat(41025, "strike");
  run.maxHp = 100;
  run.hp = 80;
  S.removeStatus(enemy, "thorns", Number.MAX_SAFE_INTEGER);
  S.applyStatus(enemy, "thorns", 2);
  E.play(run, 0, meta);
  assert.equal(run.hp, 78, "Enemy Thorns 2 should deal 2 bypass-shield retaliation damage on a contact hit");
  assert.equal(S.stacks(enemy, "thorns"), 1, "Enemy Thorns should consume exactly one stack per contact hit");
}

{
  const contact = combat(4103, "strike");
  E.addStatus(contact.run, "enemy", "burning", 4);
  E.play(contact.run, 0, contact.meta);
  assert.equal(S.stacks(contact.enemy, "burning"), 4, "Contact attacks do not consume Burning");

  const ranged = combat(4104, "noncontact_fine_mist_spray");
  E.addStatus(ranged.run, "enemy", "bleed", 4);
  E.play(ranged.run, 0, ranged.meta);
  assert.equal(S.stacks(ranged.enemy, "bleed"), 4, "Non-contact attacks do not consume Bleed");
}

{
  const { run, meta, enemy } = combat(4105, "contact_beveled_scent_strip");
  E.addStatus(run, "enemy", "bleed", 2);
  E.play(run, 0, meta);
  assert.equal(
    S.stacks(enemy, "bleed"),
    3,
    "A hit consumes an existing Bleed stack before the same card applies new Bleed",
  );
  assert.equal(
    (run._damageFeedback || []).filter((hit) => hit.statusId === "bleed").length,
    1,
    "Secondary Bleed damage does not recursively consume another Bleed stack",
  );
}

{
  const run = E.newRun(4106), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.hp = 80;
  run.maxHp = 100;
  run.battle.shield = 0;
  run.battle.enemies.slice(1).forEach((enemy) => (enemy.hp = 0));
  run.battle.enemies[0].intent = { type: "attack", value: 10, attackPattern: "contact" };
  E.addStatus(run, "player", "bleed", 3);
  delete run._damageFeedback;
  E.endTurn(run, meta);
  assert.equal(S.stacks(run, "bleed"), 2, "Enemy contact attacks consume player Bleed");
  assert.equal((run._damageFeedback || []).filter((hit) => hit.statusId === "bleed").length, 1);
}

{
  const run = E.newRun(4107), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  run.hp = 80;
  run.maxHp = 100;
  run.battle.shield = 0;
  run.battle.enemies.slice(1).forEach((enemy) => (enemy.hp = 0));
  run.battle.enemies[0].intent = { type: "attack", value: 10, attackPattern: "nonContact" };
  E.addStatus(run, "player", "burning", 3);
  delete run._damageFeedback;
  E.endTurn(run, meta);
  assert.equal(S.stacks(run, "burning"), 2, "Enemy non-contact attacks consume player Burning");
  assert.equal((run._damageFeedback || []).filter((hit) => hit.statusId === "burning").length, 1);
}

{
  const { run, meta, enemy } = combat(4108, "strike");
  run.maxHp = 100;
  run.hp = 80;
  E.addStatus(run, "player", "confusion", { stacks: 1, turns: 2 });
  run.rng = 1972; // next LCG sample is below 22.2%
  const enemyHp = enemy.hp, ap = run.battle.ap;
  assert.equal(E.play(run, 0, meta), true);
  assert.equal(enemy.hp, enemyHp, "Confusion cancels the entire selected card effect");
  assert.equal(run.battle.ap, ap - CARDS.strike.cost, "Confusion still spends AP");
  assert.equal(run.battle.hand.length, 0, "Confusion still consumes the card");
  assert.equal(run.hp, 75, "Confusion self-damage is 5% of max HP with integer damage");
  assert.deepEqual(run._controlFeedback, { statusId: "confusion", title: "혼란!", detail: "카드 사용 실패" });
}

{
  const { run, meta, enemy } = combat(4109, "contact_beveled_scent_strip");
  E.addStatus(run, "player", "interference", { stacks: 5, turns: 2 });
  run.rng = 0; // first LCG sample is below 50%
  const hp = enemy.hp;
  assert.equal(E.play(run, 0, meta), true);
  assert.equal(hp - enemy.hp, 3, "Interference preserves the card's base damage");
  assert.equal(S.stacks(enemy, "bleed"), 0, "Interference suppresses the card's secondary status");
  assert.equal(run.battle.notes.length, 1, "Interference does not suppress note gain");
  assert.equal(run._controlFeedback.detail, "출혈 부여 실패");
}

{
  const { run, meta } = combat(4110, "guard_kraft_wrapping");
  run.battle.draw = [{ id: "strike", level: 0 }, { id: "guard", level: 0 }];
  E.addStatus(run, "player", "interference", { stacks: 5, turns: 2 });
  run.rng = 0;
  E.play(run, 0, meta);
  assert.equal(run.battle.shield, 6, "Interference preserves the card's base shield");
  assert.equal(run.battle.hand.length, 0, "Interference suppresses a secondary draw");
  assert.equal(run._controlFeedback.detail, "카드 드로우 실패");
}

{
  const { run, meta, enemy } = combat(4111, "contact_glass_cleaver");
  enemy.shield = 5;
  run.battle.ap = 5;
  E.addStatus(run, "player", "interference", { stacks: 5, turns: 2 });
  run.rng = 0;
  E.play(run, 0, meta);
  assert.equal(enemy.shield, 0, "Interference preserves the shield-breaking base hit");
  assert.equal(run.battle.ap, 4, "Interference suppresses the conditional AP refund");
  assert.equal(run._controlFeedback.detail, "AP 환급 실패");
}

{
  const run = E.newRun(41115), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);

  E.addStatus(run, "player", "bleed", 3);
  E.addStatus(run, "player", "burning", 5);
  E.addStatus(run, "player", "poison", 2);
  E.addStatus(run, "player", "corrosion", 4);
  E.addStatus(run, "player", "thorns", 3);
  E.addStatus(run, "player", "weak", 2);
  E.addStatus(run, "player", "protection", { stacks: 1, turns: 2 });

  run.battle.enemies.forEach((enemy) => {
    enemy.hp = 0;
    enemy.statuses = {};
  });
  run.battle.enemies[0].hp = 1;
  run.battle.enemies[0].maxHp = 1;
  run.battle.enemies[0].shield = 0;
  run.battle.selectedTarget = 0;
  run.battle.hand = [{ id: "strike", level: 0 }];
  run.battle.ap = 10;

  assert.equal(E.play(run, 0, meta), true);
  assert.equal(run.phase, "reward");
  assert.equal(E.skipReward(run, meta), true);
  assert.equal(run.phase, "map");

  assert.deepEqual(
    {
      bleed: S.stacks(run, "bleed"),
      burning: S.stacks(run, "burning"),
      poison: S.stacks(run, "poison"),
      corrosion: S.stacks(run, "corrosion"),
    },
    { bleed: 3, burning: 5, poison: 2, corrosion: 4 },
    "wound and contamination statuses survive combat reward completion unchanged",
  );
  assert.equal(S.stacks(run, "weak"), 0, "Weak is cleared after combat");
  assert.equal(S.stacks(run, "protection"), 0, "Protection is cleared after combat");
  assert.equal(S.stacks(run, "thorns"), 0, "Thorns is a combat buff and is cleared after combat");

  run.route[1] = "mystery";
  const beforeEvent = {
    bleed: S.stacks(run, "bleed"),
    burning: S.stacks(run, "burning"),
    poison: S.stacks(run, "poison"),
    corrosion: S.stacks(run, "corrosion"),
  };
  E.enter(run, meta);
  assert.equal(run.phase, "mystery");
  assert.deepEqual(
    {
      bleed: S.stacks(run, "bleed"),
      burning: S.stacks(run, "burning"),
      poison: S.stacks(run, "poison"),
      corrosion: S.stacks(run, "corrosion"),
    },
    beforeEvent,
    "event rooms neither clear nor tick battle-persistent statuses",
  );

  run.specialResult = { text: "test event complete" };
  assert.equal(E.leaveSpecial(run), true);
  assert.equal(run.phase, "map");
  run.route[2] = "battle";
  E.enter(run, meta);
  assert.equal(run.phase, "battle");
  assert.deepEqual(
    {
      bleed: S.stacks(run, "bleed"),
      burning: S.stacks(run, "burning"),
      poison: S.stacks(run, "poison"),
      corrosion: S.stacks(run, "corrosion"),
    },
    beforeEvent,
    "the next combat starts with the same carried stacks",
  );
}

{
  const normalized = normalizeGamePayload({
    meta: E.freshMeta(),
    run: {
      ...E.newRun(4112),
      statuses: {
        intimidated: { stacks: 4, turns: 1 },
        scentBlock: { stacks: 1, turns: 2 },
        noteCollapse: { stacks: 1, turns: 1 },
      },
    },
  });
  assert.equal(S.stacks(normalized.run, "weak"), 2, "Legacy Intimidated migrates to Weak");
  assert.equal(S.stacks(normalized.run, "seal"), 1, "Legacy Scent Block migrates to Seal");
  assert.equal(normalized.run.statuses.seal.blockNoteGain, true);
  assert.equal(normalized.run.statuses.seal.blockHarmony, true);
  assert.equal(normalized.run.statuses.noteCollapse, undefined, "Legacy Note Collapse is discarded safely");
}

console.log("PASS Harmony status overhaul: 23-status model, trigger-consume Bleed/Burning, symmetric procs, Confusion, Interference, cross-combat wound persistence, event-room neutrality, and legacy-save migration.");

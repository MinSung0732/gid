import assert from "node:assert/strict";
import fs from "node:fs";
import * as E from "../games/harmony/engine.js";
import * as S from "../games/harmony/statuses.js";

function battle(seed = 6210) {
  const run = E.newRun(seed), meta = E.freshMeta();
  run.route[0] = "battle";
  E.enter(run, meta);
  return { run, meta };
}

function enemyActor(template, id) {
  return {
    ...structuredClone(template),
    id,
    name: id,
    hp: 100,
    maxHp: 100,
    shield: 0,
    statuses: {},
    intent: { type: "attack", value: 5, attackPattern: "contact" },
  };
}

// Enemy-owned Thorns retains one proc per real contact hit and records the exact
// enemy source rather than leaving presentation to infer it from selectedTarget.
{
  const { run, meta } = battle(6211), enemy = run.battle.enemies[0];
  run.battle.enemies.splice(1);
  enemy.hp = 100;
  enemy.maxHp = 100;
  enemy.shield = 0;
  enemy.statuses = {};
  S.applyStatus(enemy, "thorns", 5);
  run.hp = 100;
  run.maxHp = 100;
  run.battle.hand = [{ id: "contact_fierce_rub", level: 0 }];
  run.battle.ap = 10;
  delete run._damageFeedback;
  delete run._thornsFeedback;
  E.play(run, 0, meta);
  assert.equal(run._thornsFeedback.length, 3);
  assert.deepEqual(
    run._thornsFeedback.map(({ sourceIndex, stackBefore, stackAfter }) => ({
      sourceIndex,
      stackBefore,
      stackAfter,
    })),
    [
      { sourceIndex: 0, stackBefore: 5, stackAfter: 4 },
      { sourceIndex: 0, stackBefore: 4, stackAfter: 3 },
      { sourceIndex: 0, stackBefore: 3, stackAfter: 2 },
    ],
  );
  assert.ok(run._thornsFeedback.every((event) =>
    event.source === "enemy" &&
    event.targets.length === 1 &&
    event.targets[0].target === "player" &&
    Number.isInteger(event.sourceImpactId)
  ));
  assert.equal(
    run._damageFeedback.filter((hit) => hit.statusId === "thorns").length,
    3,
    "existing status damage popup data remains the only reflected damage number",
  );
}

// Non-contact attacks do not create damage, consume stacks, or emit presentation.
{
  const { run, meta } = battle(6212), enemy = run.battle.enemies[0];
  run.battle.enemies.splice(1);
  enemy.hp = 100;
  enemy.maxHp = 100;
  enemy.shield = 0;
  enemy.statuses = {};
  S.applyStatus(enemy, "thorns", 4);
  run.battle.hand = [{ id: "noncontact_fine_mist_spray", level: 0 }];
  run.battle.ap = 10;
  delete run._thornsFeedback;
  E.play(run, 0, meta);
  assert.equal(run._thornsFeedback, undefined);
  assert.equal(S.stacks(enemy, "thorns"), 4);
}

// Player-owned Thorns points back to the actual acting enemy and still presents
// when the contact hit is completely absorbed by shield.
{
  const { run, meta } = battle(6213), template = run.battle.enemies[0];
  run.battle.enemies = [
    enemyActor(template, "decoy"),
    enemyActor(template, "actual-attacker"),
  ];
  run.battle.selectedTarget = 0;
  run.battle.enemyPhase = true;
  run.battle.completedEnemies = [];
  run.battle.shield = 100;
  S.applyStatus(run, "thorns", 5);
  delete run._thornsFeedback;
  const outcome = E.executeSingleEnemyAction(run, 1, meta),
    [event] = run._thornsFeedback;
  assert.equal(outcome.damage, 0);
  assert.equal(event.source, "player");
  assert.equal(event.sourceIndex, null);
  assert.deepEqual(event.targets.map((target) => target.targetIndex), [1]);
  assert.equal(event.stackBefore, 5);
  assert.equal(event.stackAfter, 4);
  assert.equal(event.nova, false);
  assert.equal(event.sourceImpactId, outcome.hits[0].impactId);
}

// Multi-hit enemy attacks emit one event per actual hit without serializing any
// gameplay calculation into the presentation queue.
{
  const { run, meta } = battle(6214), template = run.battle.enemies[0];
  run.battle.enemies = [enemyActor(template, "multi-attacker")];
  run.battle.enemies[0].intent.hits = 3;
  run.battle.enemyPhase = true;
  run.battle.completedEnemies = [];
  run.hp = 100;
  run.maxHp = 100;
  S.applyStatus(run, "thorns", 5);
  E.executeSingleEnemyAction(run, 0, meta);
  assert.deepEqual(
    run._thornsFeedback.map((event) => [event.stackBefore, event.stackAfter]),
    [[5, 4], [4, 3], [3, 2]],
  );
}

// Nova uses precisely the engine's live targets and packages them in one
// directional event for the shared player burst.
{
  const { run, meta } = battle(6215), template = run.battle.enemies[0];
  run.battle.enemies = [0, 1, 2].map((index) =>
    enemyActor(template, `nova-target-${index}`),
  );
  run.battle.enemyPhase = true;
  run.battle.completedEnemies = [];
  run.inventory.push("trait_retaliatory_nova");
  S.applyStatus(run, "thorns", 5);
  E.executeSingleEnemyAction(run, 1, meta);
  const [event] = run._thornsFeedback;
  assert.equal(event.nova, true);
  assert.deepEqual(event.targets.map((target) => target.targetIndex), [0, 1, 2]);
}

const feedbackSource = fs.readFileSync(
    new URL("../games/harmony/combat-feedback-vfx.js", import.meta.url),
    "utf8",
  ),
  styles = fs.readFileSync(
    new URL("../games/harmony/styles.css", import.meta.url),
    "utf8",
  ),
  cardOrchestrator = fs.readFileSync(
    new URL("../games/harmony/combat-card-orchestrator.js", import.meta.url),
    "utf8",
  ),
  turnOrchestrator = fs.readFileSync(
    new URL("../games/harmony/combat-turn-orchestrator.js", import.meta.url),
    "utf8",
  );

assert.match(feedbackSource, /async function showThornsRetaliationVfx\(event\)/);
assert.match(feedbackSource, /getPlayerImpactPoint\(\)/);
assert.match(feedbackSource, /\.status-chip\[data-status-id="thorns"\]/);
assert.match(feedbackSource, /hit\.target === "player" && hit\.statusId !== "thorns"/);
assert.doesNotMatch(
  feedbackSource.match(/async function showThornsRetaliationVfx[\s\S]*?\n  }/)?.[0] || "",
  /showHitFeedback|showStatusDamagePopup/,
  "Thorns physical VFX must not create a second damage number",
);
assert.match(cardOrchestrator, /queueThornsForHit\(hit\)/);
assert.match(turnOrchestrator, /queueThornsForHit\(hit\)/);
for (const className of [
  "hmy-thorns-retaliate",
  "hmy-thorns-source",
  "hmy-thorns-trail",
  "hmy-thorns-impact",
  "hmy-thorns-consume",
])
  assert.match(styles, new RegExp(`\\.${className}`));
assert.match(styles, /\.hmy-thorns-retaliate[\s\S]*?pointer-events:\s*none/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.hmy-thorns-trail/);

console.log("PASS Harmony Thorns retaliation VFX: exact engine source/targets, real stack transitions, multi-hit/Nova metadata, popup reuse, FX routing, and reduced motion.");

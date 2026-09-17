import assert from "node:assert/strict";
import {
  DEFAULT_PATTERN_REPEAT_DECAY,
  chooseEnemyPattern,
  chooseEnemyPatternV2,
  enemyPatternV2TargetPhaseIndex,
  enemyPatternWeights,
  syncEnemyPatternV2Phase,
} from "../games/harmony/enemy-patterns.js";
import {
  INTENT_VISIBILITY,
  enemyIntentVisibility,
  projectEnemyIntent,
  refreshEnemyIntentView,
} from "../games/harmony/enemy-intent.js";

const pattern = [
  { patternKey: "jab", type: "attack", value: 6 },
  { patternKey: "guard", type: "guard", value: 8 },
  { patternKey: "blast", type: "attack", value: 10, attackPattern: "nonContact" },
];

{
  const enemy = {
    pattern: structuredClone(pattern),
    patternFixedTurns: 0,
    patternState: { lastKey: "jab", repeatCount: 1 },
  };
  assert.deepEqual(enemyPatternWeights(enemy), [DEFAULT_PATTERN_REPEAT_DECAY, 1, 1]);
  enemy.patternState.repeatCount = 2;
  assert.deepEqual(
    enemyPatternWeights(enemy).map((value) => Number(value.toFixed(4))),
    [0.3025, 1, 1],
    "repeating the same pattern lowers its next random weight again",
  );
}

{
  const enemy = {
    pattern: structuredClone(pattern),
    patternFixedTurns: 0,
    patternState: { lastKey: "jab", repeatCount: 1 },
  };
  const action = chooseEnemyPattern(enemy, 9, () => 0.99);
  assert.equal(action.value, 10);
  assert.equal("patternKey" in action, false, "selection metadata does not leak into combat intent");
}

{
  let rngCalls = 0;
  const enemy = { loopPattern: true, pattern: structuredClone(pattern) };
  const action = chooseEnemyPattern(enemy, 4, () => {
    rngCalls++;
    return 0.5;
  });
  assert.equal(action.value, 6, "loop patterns keep their existing deterministic order");
  assert.equal(rngCalls, 0, "deterministic patterns do not consume random rolls");
}

{
  const enemy = { patternFixedTurns: 0, pattern: structuredClone(pattern) };
  enemy.pattern.push({ patternKey: "heal", type: "heal", value: 5 });
  assert.equal(enemyPatternWeights(enemy).length, 4, "adding a pattern needs no engine index changes");
  enemy.pattern.splice(1, 1);
  assert.equal(enemyPatternWeights(enemy).length, 3, "removing a pattern needs no engine index changes");
}

{
  const enemy = {
    patternFixedTurns: 0,
    patternRepeatDecay: 1,
    pattern: structuredClone(pattern),
    patternState: { lastKey: "jab", repeatCount: 4 },
  };
  assert.deepEqual(enemyPatternWeights(enemy), [1, 1, 1], "decay 1 restores legacy uniform RNG");
}

const raidEnemy = () => ({
  hp: 100,
  maxHp: 100,
  statuses: {},
  phases: [
    {
      id: "phase1",
      hpAbove: 0.7,
      opening: [
        { type: "attack", value: 5, name: "A" },
        { type: "guard", value: 6, name: "B" },
      ],
      cycle: [
        { type: "attack", value: 7, name: "C" },
        {
          random: [
            { patternKey: "R1", type: "attack", value: 8, name: "R1" },
            { patternKey: "R2", type: "debuff", value: 1, name: "R2" },
          ],
        },
      ],
    },
    {
      id: "phase2",
      hpAbove: 0.35,
      onEnter: { type: "debuff", value: 1, name: "E" },
      cycle: [
        { type: "attack", value: 12, name: "D" },
        { type: "guard", value: 10, name: "G" },
      ],
      conditionalActions: [
        {
          id: "pierce",
          condition: { playerShieldAtLeast: 30 },
          action: { type: "attack", value: 15, name: "P" },
          cooldown: 2,
        },
      ],
    },
    {
      id: "phase3",
      hpAbove: 0,
      onEnter: { type: "attack", value: 20, name: "F", forceTelegraph: true },
      cycle: [{ type: "attack", value: 14, name: "Z" }],
    },
  ],
});

{
  const enemy = raidEnemy(), context = { turn: 1, player: { hp: 100, maxHp: 100 }, battle: { shield: 0 } };
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "A");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "B");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "C");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "R1");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0.99).name, "C");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0.99).name, "R2");
}

{
  const enemy = raidEnemy(), context = { turn: 4, player: { hp: 100, maxHp: 100 }, battle: { shield: 0 } };
  chooseEnemyPatternV2(enemy, context, () => 0);
  enemy.hp = 70;
  assert.equal(enemyPatternV2TargetPhaseIndex(enemy), 1, "exactly 70% enters phase2");
  const transition = syncEnemyPatternV2Phase(enemy);
  assert.equal(transition.transitioned, true);
  assert.equal(transition.state.phaseId, "phase2");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "E", "phase onEnter runs first");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "D", "new phase cycle starts at index 0");
  enemy.hp = 90;
  assert.equal(syncEnemyPatternV2Phase(enemy).state.phaseId, "phase2", "healing never rolls a phase backward");
}

{
  const enemy = raidEnemy(), context = { turn: 5, player: { hp: 100, maxHp: 100 }, battle: { shield: 0 } };
  chooseEnemyPatternV2(enemy, context, () => 0);
  enemy.hp = 28;
  const transition = syncEnemyPatternV2Phase(enemy);
  assert.equal(transition.state.phaseId, "phase3", "large damage skips straight to the final HP phase");
  assert.deepEqual(transition.state.enteredPhases, ["phase1", "phase3"], "skipped phase is not recorded as entered");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "F", "only final phase onEnter is selected");
}

{
  const enemy = raidEnemy(), context = { turn: 6, player: { hp: 100, maxHp: 100 }, battle: { shield: 35 } };
  chooseEnemyPatternV2(enemy, context, () => 0);
  enemy.hp = 60;
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "E");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "P", "conditional action overrides cycle");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "D", "conditional action does not consume cycle position");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "G");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "P", "conditional becomes available after two cooldown actions pass");
  assert.equal(chooseEnemyPatternV2(enemy, context, () => 0).name, "D", "conditional action still does not consume cycle position after cooldown");
}

{
  const action = { type: "attack", value: 24, attackPattern: "contact", applyPlayer: { bleed: 2 } };
  const enemy = { nextAction: structuredClone(action), intentVisibility: INTENT_VISIBILITY.HIDDEN };
  const player = {};
  assert.equal(enemyIntentVisibility(player, enemy), INTENT_VISIBILITY.HIDDEN);
  assert.deepEqual(projectEnemyIntent(action, INTENT_VISIBILITY.HIDDEN), {
    type: "hidden",
    visibility: "hidden",
    hidden: true,
  });
  const hidden = refreshEnemyIntentView(player, enemy);
  assert.equal(hidden.hidden, true);
  assert.deepEqual(enemy.nextAction, action, "hiding intent never changes the planned action");
  enemy.intentVisibility = INTENT_VISIBILITY.FULL;
  const visible = refreshEnemyIntentView(player, enemy);
  assert.equal(visible.value, 24, "revealing intent shows the same already-planned action");
}

{
  const forced = { type: "attack", value: 99, forceTelegraph: true };
  const enemy = { nextAction: forced, intentVisibility: INTENT_VISIBILITY.HIDDEN };
  const player = { enemyIntentVisibility: INTENT_VISIBILITY.HIDDEN };
  assert.equal(enemyIntentVisibility(player, enemy, forced), INTENT_VISIBILITY.FULL);
  assert.equal(refreshEnemyIntentView(player, enemy).value, 99, "forceTelegraph overrides hidden visibility");
}

console.log("PASS Harmony adaptive + V2 enemy pattern selection and intent visibility.");

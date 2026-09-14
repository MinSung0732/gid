import assert from "node:assert/strict";
import {
  DEFAULT_PATTERN_REPEAT_DECAY,
  chooseEnemyPattern,
  enemyPatternWeights,
} from "../games/harmony/enemy-patterns.js";

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

console.log("PASS Harmony adaptive enemy pattern selection.");

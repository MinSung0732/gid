export function prepareLateBossPattern(enemy) {
  if (!enemy?.isBoss || !Array.isArray(enemy.pattern) || !enemy.pattern.length) return enemy;
  if (!Array.isArray(enemy.phases) || !enemy.phases.length) {
    enemy.phases = [
      {
        id: "late-main",
        hpAbove: 0,
        opening: enemy.pattern.map((action) => structuredClone(action)),
        cycle: enemy.pattern.map((action) => structuredClone(action)),
      },
    ];
  }
  // engine-core's legacy bosses gain an unrelated 50%-HP rage phase. Late-game
  // bosses use explicit authored patterns, so mark the compatibility flag as
  // already consumed. The V2 planner owns their actual action sequence.
  enemy.phase2 = true;
  return enemy;
}

export function prepareLateBosses(run) {
  for (const enemy of run?.battle?.enemies || []) prepareLateBossPattern(enemy);
  return run;
}

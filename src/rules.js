export function judgeDrop(x, previousCombo) {
  const distance = Math.abs(x - 240);
  const grade = distance <= 8.5 ? 'PERFECT'
    : distance <= 24 ? 'EXCELLENT'
    : distance <= 44 ? 'GOOD'
    : distance <= 66 ? 'NOT BAD' : 'BAD';
  const base = { PERFECT: 100, EXCELLENT: 80, GOOD: 50, 'NOT BAD': 25, BAD: 0 }[grade];
  return {
    grade,
    timeDelta: grade === 'PERFECT' ? 2 : grade === 'BAD' ? -1 : 0,
    points: base ? base + Math.min(previousCombo, 10) * 10 : 0,
    combo: base ? previousCombo + (grade === 'PERFECT' ? 2 : 1) : 0,
    perfect: grade === 'PERFECT',
  };
}

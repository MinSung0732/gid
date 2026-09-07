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

export function resultRank(score) {
  if (score >= 4000) return { name: '결이든 마스터', recommendation: '깊고 차분한 볼케닉으로 공간의 결을 완성해보세요.' };
  if (score >= 2000) return { name: '공간 조향사', recommendation: '싱그러운 그린 크리스탈이 당신의 감각과 잘 어울려요.' };
  return { name: '향기 새싹', recommendation: '부드러운 핑크 크리스탈로 작은 향기부터 시작해보세요.' };
}

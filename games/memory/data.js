export const levels = [
  { level: 1, pairs: 3, seconds: 25, preview: 2000 },
  { level: 2, pairs: 4, seconds: 28, preview: 1800 },
  { level: 3, pairs: 6, seconds: 38, preview: 1500 },
  { level: 4, pairs: 8, seconds: 50, preview: 1200 },
  { level: 5, pairs: 10, seconds: 60, preview: 1000 }
];

export const motifs = [
  { id: 'black-cherry', code: '01', symbol: '●', accent: '#751f35', label: '블랙체리', image: '../../public/assets/memory/black-cherry.png', position: '50% 50%', size: 'cover' },
  { id: 'cherry-blossom', code: '02', symbol: '✿', accent: '#d8658a', label: '체리꽃', image: '../../public/assets/memory/cherry-blossom.png', position: '50% 50%', size: 'cover' },
  { id: 'blossom-bouquet', code: '03', symbol: '✦', accent: '#8d5aa7', label: '블로썸부케', image: '../../public/assets/memory/blossom-bouquet.png', position: '50% 50%', size: 'cover' },
  { id: 'soft-petal', code: '04', symbol: '◒', accent: '#ef765f', label: '부드러운 꽃잎', image: '../../public/assets/memory/soft-petal.png', position: '50% 50%', size: 'cover' },
  { id: 'skylight', code: '05', symbol: '▱', accent: '#246bb3', label: '스카이라이트', image: '../../public/assets/memory/skylight.png', position: '50% 50%', size: 'cover' },
  { id: 'dew-drop', code: '06', symbol: '◆', accent: '#00a4b8', label: '맑은 물방울', image: '../../public/assets/memory/dew-drop.png', position: '50% 50%', size: 'cover' },
  { id: 'sandalwood', code: '07', symbol: '╳', accent: '#a85120', label: '샌달우드', image: '../../public/assets/memory/sandalwood.png', position: '50% 50%', size: 'cover' },
  { id: 'tree-ring', code: '08', symbol: '◎', accent: '#715026', label: '나이테', image: '../../public/assets/memory/tree-ring.png', position: '50% 50%', size: 'cover' },
  { id: 'baby-cloud', code: '09', symbol: '☁', accent: '#688eac', label: '베이비클라우드', image: '../../public/assets/memory/baby-cloud.png', position: '50% 50%', size: 'cover' },
  { id: 'soft-feather', code: '10', symbol: '⌁', accent: '#6372a8', label: '포근한 깃털', image: '../../public/assets/memory/soft-feather.png', position: '50% 50%', size: 'cover' }
];

export function challengeConfig(level) {
  const completedFiveLevelBlocks = Math.floor(Math.max(0, level - 6) / 5);
  return {
    level,
    pairs: 10,
    seconds: null,
    preview: 0,
    mismatchDelay: Math.max(300, 650 - completedFiveLevelBlocks * 50),
    hideCode: level >= 11,
    hideSymbol: level >= 16,
    hideLabel: level >= 21
  };
}

export function clearScore(level, remaining, remainingLives = 0) {
  return level * 200 + Math.max(0, Math.ceil(remaining)) * 25 + Math.max(0, remainingLives) * 300;
}

export function shuffled(values, random = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function buildDeck(pairCount, random = Math.random) {
  const selected = shuffled(motifs, random).slice(0, pairCount);
  return shuffled(selected.flatMap(motif => [
    { ...motif, cardId: `${motif.id}-a` },
    { ...motif, cardId: `${motif.id}-b` }
  ]), random);
}

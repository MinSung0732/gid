import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { levels, motifs, shuffled, buildDeck, challengeConfig, clearScore } from '../games/memory/data.js';

assert.equal(levels.length, 5);
assert.deepEqual(levels.map(level => level.pairs), [3, 4, 6, 8, 10]);
assert.ok(levels.every((level, index) => index === 0 || level.seconds > levels[index - 1].seconds));
assert.equal(motifs.length, 10);
assert.equal(new Set(motifs.map(motif => motif.image)).size, motifs.length);
assert.equal(new Set(motifs.map(motif => motif.code)).size, motifs.length);
assert.equal(new Set(motifs.map(motif => motif.symbol)).size, motifs.length);
assert.ok(motifs.every(motif => /^#[0-9a-f]{6}$/i.test(motif.accent)));
assert.equal(challengeConfig(6).pairs, 10);
assert.equal(challengeConfig(6).seconds, null);
assert.equal(challengeConfig(6).preview, 2000);
assert.equal(challengeConfig(10).preview, 2000);
assert.equal(challengeConfig(11).preview, 1900);
assert.equal(challengeConfig(100).preview, 550);
assert.ok(clearScore(7, 10) > clearScore(6, 10));
assert.ok(clearScore(6, 20) > clearScore(6, 10));
assert.equal(clearScore(6, 10, 3) - clearScore(6, 10, 0), 900);
assert.equal(clearScore(6, 10, 2) - clearScore(6, 10, 1), 300);
await Promise.all(motifs.map(motif => access(new URL(`../games/memory/${motif.image}`, import.meta.url))));
assert.deepEqual(shuffled([1, 2, 3], () => .999), [1, 2, 3]);

for (const level of levels) {
  const deck = buildDeck(level.pairs, () => .5);
  assert.equal(deck.length, level.pairs * 2);
  assert.equal(new Set(deck.map(card => card.cardId)).size, deck.length);
  const grouped = deck.reduce((result, card) => ({ ...result, [card.id]: (result[card.id] || 0) + 1 }), {});
  const counts = Object.values(grouped);
  assert.ok(counts.every(count => count === 2));
}

console.log('PASS: five memory levels, distinct artwork, increasing limits, and exact matching pairs.');

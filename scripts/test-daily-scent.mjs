import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { scents, questions, decideScent, messageIndex } from '../games/daily-scent/data.js';
import { shareText, threadsUrl } from '../games/daily-scent/share.js';

assert.equal(Object.keys(scents).length, 5);
for (const [id, scent] of Object.entries(scents)) {
  assert.equal(scent.messages.length, 10, `${id} should have 10 messages`);
  assert.equal(new Set(scent.messages).size, 10, `${id} messages should be unique`);
  const first = messageIndex(id, '2026-09-07');
  assert.equal(first, messageIndex(id, '2026-09-07'));
  assert.equal(messageIndex(id, '2026-09-07', 1), (first + 1) % 10);
  await access(new URL(`../games/daily-scent/${scent.image}`, import.meta.url));
}

assert.equal(questions.length, 5);
for (const question of questions) {
  assert.equal(question.options.length, 4);
  for (const option of question.options) {
    for (const id of Object.keys(scents)) assert.ok((option.scores[id] || 1) >= 1 && (option.scores[id] || 1) <= 3);
  }
}

const ids = Object.keys(scents);
const base = Object.fromEntries(ids.map(id => [id, 1]));
assert.equal(decideScent([{ scores: { ...base, sandalwood: 3 } }], () => 0), 'sandalwood');
assert.equal(decideScent([
  { scores: { ...base, 'black-cherry': 3 } },
  { scores: { ...base, 'blossom-bouquet': 3 } }
], () => 0), 'blossom-bouquet');
assert.equal(decideScent([{ scores: base }], () => 0), ids[0]);
assert.match(shareText(scents.sandalwood, '따뜻한 한마디'), /샌달우드/);
const threadIntent = new URL(threadsUrl(scents.sandalwood, '따뜻한 한마디'));
assert.equal(threadIntent.hostname, 'www.threads.com');
assert.match(threadIntent.searchParams.get('text'), /따뜻한 한마디/);

console.log('PASS: scored scent quiz, last-answer tie break, random fallback, daily messages, and image assets.');

import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games/_template/game.js';

test('the daily number is deterministic, in range, and does not repeat within a cycle', () => {
  const cycle = G.NUMBERS.map((_, i) => G.secretForDay(i + 1));
  assert.deepEqual([...cycle].sort((a, b) => a - b), G.NUMBERS);
  assert.notDeepEqual(cycle, G.NUMBERS, 'the order is shuffled');
  assert.equal(G.secretForDay(11), G.secretForDay(1));
  // Before the epoch day numbers are zero or negative; the game must still have a puzzle.
  assert.ok(G.NUMBERS.includes(G.secretForDay(0)) && G.NUMBERS.includes(G.secretForDay(-3)));
});

test('feedback and end of game', () => {
  assert.equal(G.evaluate(5, 5), 'right');
  assert.equal(G.evaluate(3, 5), 'higher');
  assert.equal(G.evaluate(8, 5), 'lower');
  assert.equal(G.isOver([1, 2], 5), false);
  assert.equal(G.isOver([1, 5], 5), true);
  assert.equal(G.isWon([1, 2, 3], 5), false);
  assert.equal(G.isOver([1, 2, 3], 5), true);
});

test('share text has the name, day, score and link, and never the number', () => {
  const text = G.shareText({ day: 7, guesses: [2, 9, 6], secret: 6, url: 'https://example.test/games/x/' });
  assert.equal(text, 'מספר היום #7 3/3\n⬆️⬇️🟩\nhttps://example.test/games/x/');
  assert.ok(G.shareText({ day: 1, guesses: [1, 2, 3], secret: 9, url: 'u' }).startsWith('מספר היום #1 X/3\n⬆️⬆️⬆️'));
  assert.equal(G.summary([4], 4), '1/3');
});

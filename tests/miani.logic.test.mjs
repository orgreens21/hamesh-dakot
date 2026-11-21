import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games/miani/game.js';
import { PUZZLES, DECOYS, CATEGORIES, SOURCE } from '../games/miani/data.js';
import { normalizeHebrew } from '../shared/core.js';
import { STEPS, POINTS } from '../shared/reveal.js';

const DAYS = [-40, -1, 0, ...Array.from({ length: 400 }, (_, i) => i + 1)];

test('data: at least sixty complete puzzles, five clues each, no answer given away', () => {
  assert.match(SOURCE.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(SOURCE.url.startsWith('https://he.wikipedia.org'));
  assert.ok(PUZZLES.length >= 60, `${PUZZLES.length} puzzles`);
  assert.equal(new Set(PUZZLES.map((p) => p.answer)).size, PUZZLES.length, 'an answer appears twice');
  for (const p of PUZZLES) {
    assert.ok(CATEGORIES[p.cat], `${p.answer}: unknown category ${p.cat}`);
    assert.equal(p.clues.length, STEPS, `${p.answer} needs five clues`);
    const names = [p.answer, ...(p.alts || [])].map(normalizeHebrew).filter((n) => n.length >= 3);
    for (const clue of p.clues) {
      assert.ok(typeof clue === 'string' && clue.trim() === clue && clue.length >= 8, `${p.answer}: "${clue}"`);
      assert.ok(!/\?\s*לא/.test(clue), `${p.answer}: a clue that argues with itself: "${clue}"`);
      for (const n of names) assert.ok(!normalizeHebrew(clue).includes(n), `${p.answer}: clue "${clue}" names the answer`);
    }
    assert.equal(new Set(p.clues).size, STEPS, `${p.answer}: a clue repeats`);
  }
  // Every category comes up often enough to be a real "today's kind".
  for (const cat of Object.keys(CATEGORIES)) assert.ok(PUZZLES.filter((p) => p.cat === cat).length >= 8, cat);
});

test('the suggestion list: every answer once, decoys never shadow an answer, answers are not the only names', () => {
  const names = G.ENTRIES.map((e) => e.name);
  assert.equal(new Set(names).size, names.length);
  for (const p of PUZZLES) assert.ok(G.isName(p.answer), p.answer);
  const decoys = Object.values(DECOYS).flat();
  assert.ok(decoys.length >= 80, 'enough decoys that the list does not give the answers away');
  for (const d of decoys) assert.ok(!PUZZLES.some((p) => p.answer === d), `decoy ${d} is also an answer`);
  assert.equal(G.isName('לא קיים'), false);
});

test('search: by the start of a name first, by any part of it, and by other spellings', () => {
  assert.equal(G.search('').length, 0);
  assert.equal(G.search('   ').length, 0);
  assert.equal(G.search('בן גוריון')[0].name, 'דוד בן-גוריון', 'an other spelling finds the answer');
  assert.equal(G.search('פלאפ')[0].name, 'פלאפל');
  assert.ok(G.search('יהודה').some((e) => e.name === 'אליעזר בן-יהודה'), 'a word in the middle finds it too');
  assert.ok(G.search('א').length <= 8);
  assert.equal(G.search('פלאפל')[0].label, 'מאכל');
});

test('daily puzzle: the same for everyone, every puzzle once before any repeats, works before the epoch', () => {
  for (const day of DAYS) assert.equal(G.puzzleForDay(day), G.puzzleForDay(day));
  const cycle = Array.from({ length: PUZZLES.length }, (_, i) => G.puzzleForDay(i + 1).answer);
  assert.equal(new Set(cycle).size, PUZZLES.length);
  assert.ok(G.puzzleForDay(0) && G.puzzleForDay(-5));
});

test('moves: wrong guesses and skips open the next clue; the score is the stage it was found at', () => {
  const p = G.puzzleForDay(3);
  const wrong = G.ENTRIES.find((e) => e.name !== p.answer).name;
  assert.equal(G.opened(p, []), 1);
  assert.equal(G.opened(p, [wrong]), 2);
  assert.equal(G.opened(p, [wrong, null]), 3);
  assert.equal(G.isOver(p, [wrong, null]), false);

  const won = [wrong, null, p.answer];
  assert.equal(G.isWon(p, won), true);
  assert.equal(G.isOver(p, won), true);
  assert.equal(G.opened(p, won), 5, 'every clue is shown at the end');
  assert.equal(G.solvedAt(p, won), 3);
  assert.equal(G.summary(p, won), '3/5');
  assert.equal(G.points(p, won), 60);
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => G.points(p, [...Array(n - 1).fill(null), p.answer])), POINTS);

  const lost = [wrong, null, null, null, null];
  assert.equal(G.isOver(p, lost), true);
  assert.equal(G.isWon(p, lost), false);
  assert.equal(G.summary(p, lost), 'X/5');
  assert.equal(G.points(p, lost), 0);
  assert.equal(G.endTitle(0), 'לא הפעם');
  assert.equal(G.endTitle(1), 'בול מהרמז הראשון!');
});

test('saved moves are cleaned: unknown names out, at most five, nothing after the answer', () => {
  const p = G.puzzleForDay(9);
  const wrong = G.ENTRIES.find((e) => e.name !== p.answer).name;
  assert.deepEqual(G.cleanMoves('junk', p), []);
  assert.deepEqual(G.cleanMoves([wrong, 'שטויות', 5, null, p.answer, wrong], p), [wrong, null, p.answer]);
  assert.equal(G.cleanMoves(Array(20).fill(null), p).length, 5);
});

test('share text: name, day, score, five squares, link, and no spoilers', () => {
  const p = G.puzzleForDay(12);
  const wrong = G.ENTRIES.find((e) => e.name !== p.answer).name;
  const text = G.shareText({ day: 12, puzzle: p, moves: [wrong, null, p.answer], url: 'https://example.test/games/miani/' });
  assert.equal(text, 'מי אני? #12 3/5\n🟥⬛🟩⬜⬜\nhttps://example.test/games/miani/');
  assert.ok(!text.includes(p.answer) && !text.includes(wrong));
  for (const clue of p.clues) assert.ok(!text.includes(clue));
  assert.equal(G.shareText({ day: 0, puzzle: p, moves: [null, null, null, null, null], url: 'u' }), 'מי אני? #0 X/5\n⬛⬛⬛⬛⬛\nu');
  assert.equal(G.kicker(p), `היום: ${CATEGORIES[p.cat]}`);
});

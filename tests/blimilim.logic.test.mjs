import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games/blimilim/game.js';
import { PUZZLES, DECOYS, KINDS, SOURCE } from '../games/blimilim/data.js';
import { normalizeHebrew } from '../shared/core.js';

// One user-perceived character: a single emoji, with its variation selector, keycap, flag pair or ZWJ sequence.
const segmenter = new Intl.Segmenter('he', { granularity: 'grapheme' });
const graphemes = (text) => [...segmenter.segment(text)].length;

test('data: at least sixty complete puzzles of six emoji and a hint', () => {
  assert.match(SOURCE.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(PUZZLES.length >= 60, `${PUZZLES.length} puzzles`);
  assert.equal(new Set(PUZZLES.map((p) => p.answer)).size, PUZZLES.length, 'an answer appears twice');
  for (const p of PUZZLES) {
    assert.ok(KINDS[p.kind], `${p.answer}: unknown kind ${p.kind}`);
    assert.equal(p.emoji.length, 6, `${p.answer} needs six emoji`);
    for (const e of p.emoji) {
      assert.equal(graphemes(e), 1, `${p.answer}: "${e}" is not one symbol`);
      assert.ok(!/[א-ת]/.test(e), `${p.answer}: a letter among the emoji`);
    }
    // The first three must not already be the whole story: at least two different symbols.
    assert.ok(new Set(p.emoji.slice(0, 3)).size >= 2, `${p.answer}: the first stage repeats one symbol`);
    assert.ok(typeof p.hint === 'string' && p.hint.length >= 4, `${p.answer}: hint`);
    const names = [p.answer, ...(p.alts || [])].map(normalizeHebrew).filter((n) => n.length >= 3);
    for (const n of names) assert.ok(!normalizeHebrew(p.hint).includes(n), `${p.answer}: the hint names it`);
  }
  for (const kind of Object.keys(KINDS)) assert.ok(PUZZLES.filter((p) => p.kind === kind).length >= 8, kind);
});

test('the suggestion list: every answer once, decoys are other titles', () => {
  const names = G.ENTRIES.map((e) => e.name);
  assert.equal(new Set(names).size, names.length);
  for (const p of PUZZLES) assert.ok(G.isName(p.answer), p.answer);
  const decoys = Object.values(DECOYS).flat();
  assert.ok(decoys.length >= 60);
  for (const d of decoys) assert.ok(!PUZZLES.some((p) => p.answer === d), `decoy ${d} is also an answer`);
  assert.equal(G.search('גבעת חלפון')[0].name, 'גבעת חלפון אינה עונה');
  assert.equal(G.search('צרלי')[0].name, 'צ׳רלי וחצי', 'typed without the geresh');
  assert.equal(G.search('אבניבי')[0].name, 'א־ב־ני־בי');
});

test('stages: three emoji first, one more per stage, the hint last', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(G.emojiOpen), [3, 4, 5, 6, 6]);
  assert.deepEqual([1, 2, 3, 4, 5].map(G.hintOpen), [false, false, false, false, true]);
  const p = G.puzzleForDay(4);
  assert.equal(G.opened(p, [null, null]), 3);
  assert.equal(G.opened(p, [p.answer]), 5, 'a win opens everything');
  assert.equal(G.kicker(p), `היום: ${KINDS[p.kind].today}`);
});

test('daily puzzle: deterministic, every puzzle once a cycle, differs from מי אני?', () => {
  const cycle = Array.from({ length: PUZZLES.length }, (_, i) => G.puzzleForDay(i + 1).answer);
  assert.equal(new Set(cycle).size, PUZZLES.length);
  for (const day of [-3, 0, 1, 77]) assert.equal(G.puzzleForDay(day), G.puzzleForDay(day));
});

test('share text: name, day, score, five squares and link, no title and no emoji of the puzzle', () => {
  const p = G.puzzleForDay(20);
  const text = G.shareText({ day: 20, puzzle: p, moves: [p.answer], url: 'https://example.test/games/blimilim/' });
  assert.equal(text, 'בלי מילים #20 1/5\n🟩⬜⬜⬜⬜\nhttps://example.test/games/blimilim/');
  for (const e of p.emoji) assert.ok(!text.includes(e));
  assert.equal(G.points(p, [p.answer]), 100);
});

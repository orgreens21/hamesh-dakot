import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games/arba/game.js';
import { RAW_PUZZLES } from '../games/arba/data.js';
import { normalizeHebrew } from '../shared/core.js';

const P = G.ALL_PUZZLES;
const where = (p, extra = '') => `puzzle ${p.id}${extra ? ' ' + extra : ''}`;
// Final letters are the same letter for wordplay purposes (מלח / לחם).
const letters = (w) => normalizeHebrew(w);
const sorted = (w) => [...letters(w)].sort().join('');

// ---------- content ----------

test('there are at least three months of puzzles', () => {
  assert.ok(P.length >= 90, `only ${P.length} puzzles`);
  assert.equal(P.length, RAW_PUZZLES.length);
});

test('every puzzle is four groups of four in tiers 1–4, sixteen different entries', () => {
  for (const p of P) {
    assert.equal(p.groups.length, G.GROUPS, where(p));
    assert.deepEqual(p.groups.map((g) => g.tier), [1, 2, 3, 4], where(p));
    assert.equal(new Set(p.groups.map((g) => g.title)).size, G.GROUPS, where(p, 'repeats a title'));
    for (const g of p.groups) {
      assert.ok(typeof g.title === 'string' && g.title.trim() === g.title && g.title.length >= 2 && g.title.length <= 36, where(p, `title "${g.title}"`));
      assert.equal(g.words.length, G.SIZE, where(p, g.title));
    }
    assert.equal(p.words.length, 16, where(p));
    assert.equal(new Set(p.words).size, 16, where(p, 'repeats a word'));
    assert.equal(new Set(p.words.map(letters)).size, 16, where(p, 'has two entries that differ only in spacing or punctuation'));
  }
});

test('entries are short enough for a tile, trimmed, and plain unpointed Hebrew', () => {
  for (const p of P) {
    for (const w of p.words) {
      assert.ok(w.length >= 2 && w.length <= G.MAX_ENTRY, where(p, `"${w}" is ${w.length} characters`));
      assert.ok(w.split(' ').every((part) => part.length >= 1 && part.length <= G.MAX_WORD), where(p, `"${w}" has a word longer than ${G.MAX_WORD}`));
      assert.equal(w, w.trim().replace(/\s+/g, ' '), where(p, `"${w}" has stray spaces`));
      assert.match(w, /^[א-ת'" ]+$/, where(p, `"${w}" has characters that are not Hebrew letters`));
    }
    for (const g of p.groups) assert.doesNotMatch(g.title, /[֑-ֽֿ-ׇ]/, where(p, 'title has niqqud'));
  }
});

test('no puzzle or group is repeated, and puzzles do not lean on each other', () => {
  const groups = new Map();
  for (const p of P) {
    for (const g of p.groups) {
      const key = [...g.words].sort().join('|');
      assert.ok(!groups.has(key), `${where(p)} repeats the group "${g.title}" from puzzle ${groups.get(key)}`);
      groups.set(key, p.id);
    }
  }
  for (let a = 0; a < P.length; a++) {
    for (let b = a + 1; b < P.length; b++) {
      const shared = P[a].words.filter((w) => P[b].words.includes(w)).length;
      assert.ok(shared <= 5, `puzzles ${P[a].id} and ${P[b].id} share ${shared} words`);
    }
  }
});

test('a category title is used at most twice across all puzzles', () => {
  const count = new Map();
  for (const p of P) for (const g of p.groups) count.set(g.title, (count.get(g.title) || 0) + 1);
  const overused = [...count].filter(([, n]) => n > 2);
  assert.deepEqual(overused, []);
});

test('pattern groups hold for their four words and for no other word in the puzzle', () => {
  let checked = 0;
  for (const p of P) {
    for (const g of p.groups) {
      const others = p.words.filter((w) => !g.words.includes(w));
      const only = (fits, what) => {
        checked++;
        for (const w of g.words) assert.ok(fits(w), where(p, `"${w}" does not fit "${g.title}"`));
        for (const w of others) assert.ok(!fits(w), where(p, `"${w}" also fits "${g.title}" (${what})`));
      };
      let m;
      if (g.title.startsWith('אותן אותיות')) {
        const key = sorted(g.words[0]);
        only((w) => sorted(w) === key, 'anagram');
      } else if (g.title.startsWith('נקראות אותו דבר משני הכיוונים')) {
        only((w) => letters(w) === [...letters(w)].reverse().join(''), 'palindrome');
      } else if ((m = g.title.match(/^מסתתר בהן (?:הצבע )?(צב|קוף|שור|פיל|חום)$/))) {
        const hidden = letters(m[1]);
        only((w) => letters(w).includes(hidden), 'hidden word');
      } else if ((m = g.title.match(/^מתחילות ב"(.+)"$/))) {
        const start = letters(m[1]);
        only((w) => letters(w).startsWith(start), 'prefix');
      }
    }
  }
  assert.ok(checked >= 10, `only ${checked} pattern groups were recognised; a title was probably reworded`);
});

// ---------- daily selection ----------

test('the daily puzzle is deterministic, the openers come first, nothing repeats within a cycle', () => {
  const cycle = P.map((_, i) => G.puzzleForDay(i + 1));
  assert.equal(new Set(cycle.map((p) => p.id)).size, P.length);
  assert.equal(G.OPENER_IDS.length, 14);
  assert.equal(new Set(G.OPENER_IDS).size, 14);
  assert.deepEqual(cycle.slice(0, 14).map((p) => p.id), G.OPENER_IDS);
  assert.notDeepEqual(cycle.slice(14).map((p) => p.id), P.filter((p) => !G.OPENER_IDS.includes(p.id)).map((p) => p.id), 'the rest is shuffled');
  assert.equal(G.puzzleForDay(P.length + 1), G.puzzleForDay(1));
  // Before the epoch day numbers are zero or negative; the game must still have a puzzle.
  for (const day of [0, -1, -400]) assert.equal(G.puzzleForDay(day).words.length, 16);
});

test('the opening layout is a fixed shuffle that never hands over a finished row', () => {
  for (const day of [-3, 0, 1, 2, 50, 200]) {
    const order = G.initialOrder(day);
    assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: 16 }, (_, i) => i));
    assert.deepEqual(order, G.initialOrder(day));
    for (let r = 0; r < 16; r += 4) assert.ok(new Set(order.slice(r, r + 4).map(G.groupOf)).size > 1);
  }
  assert.notDeepEqual(G.initialOrder(1), G.initialOrder(2));
});

// ---------- rules ----------

const g = (n) => [0, 1, 2, 3].map((i) => n * 4 + i);

test('evaluate: a full group, one away, and plain wrong', () => {
  assert.deepEqual(G.evaluate([4, 6, 5, 7]), { correct: true, group: 1, oneAway: false });
  assert.deepEqual(G.evaluate([0, 1, 2, 4]), { correct: false, group: -1, oneAway: true });
  assert.deepEqual(G.evaluate([0, 1, 4, 5]), { correct: false, group: -1, oneAway: false });
  assert.deepEqual(G.evaluate([0, 4, 8, 12]), { correct: false, group: -1, oneAway: false });
});

test('mistakes, win, loss and what is revealed', () => {
  const win = [g(2), [0, 1, 2, 4], g(0), g(3), g(1)];
  assert.equal(G.mistakes(win), 1);
  assert.deepEqual(G.solvedGroups(win), [2, 0, 3, 1]);
  assert.equal(G.isWon(win) && G.isOver(win) && !G.isLost(win), true);
  assert.equal(G.isOver(win.slice(0, 4)), false);

  const loss = [g(1), [0, 1, 2, 8], [0, 1, 8, 9], [0, 8, 12, 13], [2, 3, 12, 13]];
  assert.equal(G.mistakes(loss), 4);
  assert.equal(G.isLost(loss) && G.isOver(loss) && !G.isWon(loss), true);
  assert.deepEqual(G.missedGroups(loss), [0, 2, 3]);
  assert.equal(G.isRepeat(loss, [8, 2, 1, 0]), true);
  assert.equal(G.isRepeat(loss, [8, 2, 1, 3]), false);
});

test('stored guesses are cleaned: junk, repeats, solved words and anything after the end are dropped', () => {
  assert.deepEqual(G.cleanGuesses(null), []);
  assert.deepEqual(G.cleanGuesses('x'), []);
  assert.deepEqual(G.cleanGuesses([[0, 1, 2], [0, 1, 2, 2], [0, 1, 2, 99], 'no', [0, 1, 2, 3.5]]), []);
  assert.deepEqual(G.cleanGuesses([g(0), g(0), [0, 5, 6, 7], [4, 5, 6, 8], [8, 6, 5, 4]]), [g(0), [4, 5, 6, 8]]);
  const done = [g(0), g(1), g(2), g(3)];
  assert.deepEqual(G.cleanGuesses([...done, [0, 4, 8, 12]]), done);
});

test('summary and share text: name, day, result, coloured squares, link, and never a word', () => {
  const guesses = [g(2), [0, 1, 2, 4], g(0), g(3), g(1)];
  assert.equal(G.summary(guesses), 'טעות אחת');
  assert.equal(G.summary([g(0), g(1), g(2), g(3)]), 'בלי טעויות');
  assert.equal(G.summary([[0, 1, 2, 4], [0, 1, 2, 5], g(0), g(1), g(2), g(3)]), '2 טעויות');
  // The result is worded to follow a verb: "פתרתם עם טעות אחת", never "פתרתם טעות אחת".
  assert.deepEqual([0, 1, 3].map(G.mistakesText), ['בלי טעויות', 'עם טעות אחת', 'עם 3 טעויות']);
  const text = G.shareText({ day: 7, guesses, url: 'https://example.test/games/arba/' });
  assert.equal(text, [
    'ארבע על ארבע #7', 'נפתר: טעות אחת',
    '🟥🟥🟥🟥', '🟦🟦🟦🟧', '🟦🟦🟦🟦', '⬛⬛⬛⬛', '🟧🟧🟧🟧',
    'https://example.test/games/arba/',
  ].join('\n'));

  const loss = [g(1), [0, 1, 2, 8], [0, 1, 8, 9], [0, 8, 12, 13], [2, 3, 12, 13]];
  assert.equal(G.summary(loss), '1/4');
  assert.ok(G.summary(loss).length <= 10 && G.summary(guesses).length <= 10, 'the hub puts the summary on one line with the name');
  const lossText = G.shareText({ day: -2, guesses: loss, url: 'u' });
  assert.ok(lossText.startsWith('ארבע על ארבע #-2\n1/4 קבוצות\n🟧🟧🟧🟧\n🟦🟦🟦🟥\n'));
  // Spoiler check against a real puzzle: no entry and no title of any puzzle may appear.
  const squares = text.split('\n').slice(2, -1).join('');
  assert.match(squares, /^(🟦|🟧|🟥|⬛)+$/u);
  assert.equal(new Set(G.TIERS.map((t) => t.emoji)).size, 4);
});

test('no result line contains an entry or a title of any puzzle as a word of its own', () => {
  // "בלי אף טעות" used to be the line for a perfect game, and "אף" is an entry in one puzzle.
  // Wrong guesses take words from the last two groups only, so they stay possible after groups 0 and 1 are found.
  const wrong = [[8, 9, 10, 12], [8, 9, 10, 13], [8, 9, 10, 14], [8, 9, 10, 15]];
  const wins = [0, 1, 2, 3].map((n) => [...wrong.slice(0, n), g(0), g(1), g(2), g(3)]);
  const losses = [0, 1, 2].map((found) => [...[g(0), g(1)].slice(0, found), ...wrong]);
  assert.ok(wins.every(G.isWon) && losses.every(G.isLost));
  const lines = new Set([...wins, ...losses].map(G.resultLine));
  assert.equal(lines.size, 7, [...lines].join(' | '));
  // An entry or a title counts when it appears whole, word for word; letters inside a longer word do not.
  const spaced = (text) => ` ${text.split(/[^א-ת_]+/).filter(Boolean).join(" ")} `;
  for (const puzzle of G.ALL_PUZZLES) {
    for (const secret of [...puzzle.words, ...puzzle.groups.map((x) => x.title)]) {
      for (const line of lines) assert.ok(!spaced(line).includes(spaced(secret)), `puzzle ${puzzle.id}: "${secret}" is in the result line "${line}"`);
    }
  }
});

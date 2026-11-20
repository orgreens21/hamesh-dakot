// Pure rules for ארבע על ארבע: sixteen words, four hidden groups of four, four mistakes allowed.
// No DOM here, so tests/arba.logic.test.mjs can import it in Node.
import { seededShuffle, pickDaily } from '../../shared/core.js';
import { RAW_PUZZLES } from './data.js';

export const NAME = 'ארבע על ארבע';
export const MAX_MISTAKES = 4;
export const GROUPS = 4;
export const SIZE = 4;
export const MAX_ENTRY = 14; // characters in a tile, spaces included
export const MAX_WORD = 9; // characters in one unbroken word, which is what has to fit a tile's width

/** The four difficulty tiers, easiest first. `emoji` is the square used in the share text. */
export const TIERS = [
  { tier: 1, name: 'חימום', emoji: '🟦' },
  { tier: 2, name: 'רגיל', emoji: '🟧' },
  { tier: 3, name: 'מאתגר', emoji: '🟥' },
  { tier: 4, name: 'ערמומי', emoji: '⬛' },
];

/**
 * A puzzle is { id, groups: [{ tier, title, words[4] }], words[16] }.
 * A word is known everywhere else by its index 0–15: group = floor(index / 4), so tier = group + 1.
 */
export const ALL_PUZZLES = RAW_PUZZLES.map((groups, i) => {
  const built = groups.map(([title, words], g) => ({ tier: g + 1, title, words: String(words).split('|') }));
  return { id: i + 1, groups: built, words: built.flatMap((g) => g.words) };
});

// The first two weeks are hand-picked (the puzzles an independent review rated strongest, mixed by kind);
// everything after is shuffled once with a fixed seed so similar kinds of puzzle do not come in a row.
export const OPENER_IDS = [13, 3, 22, 80, 41, 18, 47, 29, 78, 35, 52, 28, 60, 48];
const openers = OPENER_IDS.map((id) => ALL_PUZZLES[id - 1]);
const POOL = [...openers, ...seededShuffle(ALL_PUZZLES.filter((p) => !OPENER_IDS.includes(p.id)), 20261114)];

export const puzzleForDay = (day) => pickDaily(POOL, day);

export const groupOf = (index) => Math.floor(index / SIZE);

/** The order the sixteen tiles are first laid out in: the same for everyone on a given day. */
export function initialOrder(day) {
  const indexes = Array.from({ length: GROUPS * SIZE }, (_, i) => i);
  for (let attempt = 0; attempt < 20; attempt++) {
    const order = seededShuffle(indexes, 7919 * (day + 1000) + attempt);
    // A row that is already a finished group would be a giveaway.
    const giveaway = [0, 4, 8, 12].some((r) => new Set(order.slice(r, r + SIZE).map(groupOf)).size === 1);
    if (!giveaway) return order;
  }
  return seededShuffle(indexes, day);
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/** Keeps only well-formed guesses from storage: four different indexes each, and never past the end of the game. */
export function cleanGuesses(raw) {
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const g of raw) {
    if (isOver(out)) break;
    if (!Array.isArray(g) || g.length !== SIZE) continue;
    if (!g.every((i) => Number.isInteger(i) && i >= 0 && i < GROUPS * SIZE) || new Set(g).size !== SIZE) continue;
    if (out.some((old) => sameSet(old, g)) || g.some((i) => solvedGroups(out).includes(groupOf(i)))) continue;
    out.push([...g]);
  }
  return out;
}

/** What a selection of four is worth: the group it completes, or how close it came. */
export function evaluate(selection) {
  const counts = [0, 0, 0, 0];
  for (const i of selection) counts[groupOf(i)]++;
  const best = Math.max(...counts);
  if (best === SIZE) return { correct: true, group: counts.indexOf(SIZE), oneAway: false };
  return { correct: false, group: -1, oneAway: best === SIZE - 1 };
}

export const isRepeat = (guesses, selection) => guesses.some((g) => sameSet(g, selection));

/** Group numbers in the order the player found them. */
export function solvedGroups(guesses) {
  return guesses.map((g) => evaluate(g)).filter((r) => r.correct).map((r) => r.group);
}
export const mistakes = (guesses) => guesses.filter((g) => !evaluate(g).correct).length;
export const isWon = (guesses) => solvedGroups(guesses).length === GROUPS;
export const isLost = (guesses) => mistakes(guesses) >= MAX_MISTAKES;
export const isOver = (guesses) => isWon(guesses) || isLost(guesses);

/** Groups the player did not find, easiest first: what is revealed after a loss. */
export function missedGroups(guesses) {
  const solved = solvedGroups(guesses);
  return [0, 1, 2, 3].filter((g) => !solved.includes(g));
}

/** How a win went, worded to follow "פתרתם": "פתרתם בלי טעויות", "פתרתם עם טעות אחת". */
export function mistakesText(n) {
  return n === 0 ? 'בלי טעויות' : n === 1 ? 'עם טעות אחת' : `עם ${n} טעויות`;
}

/** What the hub stamps next to the game's name once it is finished. Short: the two share one line. */
export function summary(guesses) {
  if (!isWon(guesses)) return `${solvedGroups(guesses).length}/${GROUPS}`;
  const n = mistakes(guesses);
  return n === 0 ? 'בלי טעויות' : n === 1 ? 'טעות אחת' : `${n} טעויות`;
}

/**
 * The result line of the share text. Its words are fixed, and none of them is an entry in any puzzle
 * (a test checks), so the line can never look like a hint.
 */
export function resultLine(guesses) {
  return isWon(guesses) ? `נפתר: ${summary(guesses)}` : `${solvedGroups(guesses).length}/${GROUPS} קבוצות`;
}

/**
 * Name, day number, result, one row of four squares per guess (each square is the tier colour of a
 * chosen word), link. Colours only: no word and no group title, so nothing is given away.
 */
export function shareText({ day, guesses, url }) {
  const rows = guesses.map((g) => g.map((i) => TIERS[groupOf(i)].emoji).join(''));
  return [`${NAME} #${day}`, resultLine(guesses), ...rows, url].join('\n');
}

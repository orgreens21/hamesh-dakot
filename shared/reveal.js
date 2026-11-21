// Pure rules shared by the two "one more clue" games (מי אני? and בלי מילים): a hidden answer, five
// stages that open one at a time, and a typed guess picked from an autocomplete list. A wrong guess
// or a skip opens the next stage; the score is the stage the answer was found at.
// No DOM here, so Node tests can import it.
import { seededShuffle, pickDaily, normalizeHebrew } from './core.js';

export const STEPS = 5;

/** 100 at the first stage, 20 less for each stage after it, 0 when not found. */
export const POINTS = [100, 80, 60, 40, 20];

const TITLES = ['בול מהרמז הראשון!', 'מרשים מאוד', 'יפה מאוד', 'הגעתם לזה', 'ברגע האחרון!'];

/**
 * Builds one game from its puzzles.
 *   puzzles  [{ answer, alts?, label, ... }]  label is what the autocomplete shows next to the name
 *   decoys   [{ name, label }]                more names in the list, so it does not give the answers away
 */
export function createGame({ name, puzzles, decoys = [], seed = 20261114 }) {
  const pool = seededShuffle(puzzles, seed);
  const puzzleForDay = (day) => pickDaily(pool, day);

  // Every name a player can pick. An answer's other spellings find it but are not listed on their own.
  const byName = new Map();
  const add = (entry, alts = []) => {
    if (byName.has(entry.name)) return;
    byName.set(entry.name, { ...entry, keys: [entry.name, ...alts].map(normalizeHebrew) });
  };
  puzzles.forEach((p) => add({ name: p.answer, label: p.label }, p.alts));
  decoys.forEach((d) => add(d));
  const entries = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'));

  /** Names that start with what was typed come first, then names that contain it anywhere. */
  function search(query, limit = 8) {
    const q = normalizeHebrew(query);
    if (!q) return [];
    const starts = [];
    const contains = [];
    for (const entry of entries) {
      const at = Math.min(...entry.keys.map((k) => { const i = k.indexOf(q); return i < 0 ? Infinity : i; }));
      if (at === 0) starts.push(entry);
      else if (at < Infinity) contains.push(entry);
    }
    return [...starts, ...contains].slice(0, limit);
  }

  const isName = (value) => typeof value === 'string' && byName.has(value);

  /**
   * A move is a picked name, or null for "one more clue". Whatever was in storage is cut down to
   * known names, at most five moves, and nothing after the right answer.
   */
  function cleanMoves(saved, puzzle) {
    if (!Array.isArray(saved)) return [];
    const moves = [];
    for (const move of saved) {
      if (moves.length >= STEPS) break;
      if (move !== null && !isName(move)) continue;
      moves.push(move);
      if (move === puzzle.answer) break;
    }
    return moves;
  }

  const isWon = (puzzle, moves) => moves.includes(puzzle.answer);
  const isOver = (puzzle, moves) => isWon(puzzle, moves) || moves.length >= STEPS;
  /** 1–5: the stage the answer was found at; 0 when it was not. */
  const solvedAt = (puzzle, moves) => (isWon(puzzle, moves) ? moves.indexOf(puzzle.answer) + 1 : 0);
  /** How many stages are open: one more than the moves so far, and all of them once the game is over. */
  const opened = (puzzle, moves) => (isOver(puzzle, moves) ? STEPS : Math.min(STEPS, moves.length + 1));

  const summary = (puzzle, moves) => `${solvedAt(puzzle, moves) || 'X'}/${STEPS}`;
  const points = (puzzle, moves) => (isWon(puzzle, moves) ? POINTS[solvedAt(puzzle, moves) - 1] : 0);
  const endTitle = (at) => (at ? TITLES[at - 1] : 'לא הפעם');

  /** One square per stage: right, wrong guess, skipped, not needed. Never a name. */
  function marks(puzzle, moves) {
    return Array.from({ length: STEPS }, (_, i) => {
      if (i >= moves.length) return '⬜';
      if (moves[i] === puzzle.answer) return '🟩';
      return moves[i] === null ? '⬛' : '🟥';
    }).join('');
  }

  function shareText({ day, puzzle, moves, url }) {
    return [`${name} #${day} ${summary(puzzle, moves)}`, marks(puzzle, moves), url].join('\n');
  }

  return {
    NAME: name, STEPS, BUCKETS: STEPS, PUZZLES: puzzles, ENTRIES: entries,
    puzzleForDay, search, isName, cleanMoves, isWon, isOver, solvedAt, opened, summary, points, endTitle, marks, shareText,
  };
}

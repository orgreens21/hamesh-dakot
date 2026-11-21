// Pure rules for מי אני?: five clues about one Israeli answer, hardest first. The engine (stages,
// moves, score, share text) is shared with בלי מילים in shared/reveal.js.
// No DOM here, so tests/miani.logic.test.mjs can import it in Node.
import { createGame } from '../../shared/reveal.js';
import { PUZZLES, DECOYS, CATEGORIES, SOURCE } from './data.js';

export { SOURCE, CATEGORIES };

const puzzles = PUZZLES.map((p) => ({ ...p, label: CATEGORIES[p.cat] }));
const decoys = Object.entries(DECOYS).flatMap(([cat, names]) => names.map((name) => ({ name, label: CATEGORIES[cat] })));

const G = createGame({ name: 'מי אני?', puzzles, decoys, seed: 20261121 });

export const {
  NAME, STEPS, BUCKETS, PUZZLES: ALL, ENTRIES,
  puzzleForDay, search, isName, cleanMoves, isWon, isOver, solvedAt, opened, summary, points, endTitle, marks, shareText,
} = G;
export default G;

/** The line above the clues: what kind of answer today's is. */
export const kicker = (puzzle) => `היום: ${CATEGORIES[puzzle.cat]}`;

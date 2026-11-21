// Pure rules for בלי מילים: an Israeli title told in emoji. Stage one shows three emoji, each stage
// after it adds one, and the fifth adds a written hint. The engine (moves, score, share text) is
// shared with מי אני? in shared/reveal.js.
// No DOM here, so tests/blimilim.logic.test.mjs can import it in Node.
import { createGame } from '../../shared/reveal.js';
import { PUZZLES, DECOYS, KINDS, SOURCE } from './data.js';

export { SOURCE, KINDS };

const puzzles = PUZZLES.map((p) => ({ ...p, label: KINDS[p.kind].label }));
const decoys = Object.entries(DECOYS).flatMap(([kind, names]) => names.map((name) => ({ name, label: KINDS[kind].label })));

const G = createGame({ name: 'בלי מילים', puzzles, decoys, seed: 20261122 });

export const {
  NAME, STEPS, BUCKETS, PUZZLES: ALL, ENTRIES,
  puzzleForDay, search, isName, cleanMoves, isWon, isOver, solvedAt, opened, summary, points, endTitle, marks, shareText,
} = G;
export default G;

export const FIRST = 3; // emoji open on the first stage

/** How many emoji are open after `opened` stages: 3, 4, 5, 6, and still 6 with the hint. */
export const emojiOpen = (opened) => Math.min(6, FIRST + opened - 1);
/** The written hint opens on the last stage only. */
export const hintOpen = (opened) => opened >= STEPS;

export const kicker = (puzzle) => `היום: ${KINDS[puzzle.kind].today}`;

// Pure rules for על הציר: one event starts on the timeline, six more are placed one at a time.
// No DOM here, so tests/tzir.logic.test.mjs can import it in Node.
import { mulberry32, seededShuffle } from '../../shared/core.js';
import { EVENTS, SOURCE } from './data.js';

export { EVENTS, SOURCE };
export const NAME = 'על הציר';
export const ROUNDS = 6; // events the player places
export const LIVES = 3;
export const SET_SIZE = ROUNDS + 1;

// What makes a set fair and interesting. The logic test checks every daily set against these.
export const MIN_SPAN = 60; // years between the earliest and latest event
export const CLOSE_GAP = 4; // two neighbours this close in time count as a "close pair"
export const MIN_CLOSE_PAIRS = 2;
export const MIN_PER_REGION = 2; // at least this many Israeli and this many world events
export const MAX_PER_TOPIC = 3;

// Days in one cycle. No event repeats inside a cycle; the next cycle reshuffles everything, so the
// same event comes back in different company. Kept well under EVENTS.length / SET_SIZE so the
// last days of a cycle still have plenty to choose from.
export const CYCLE = Math.min(80, Math.floor(EVENTS.length / SET_SIZE) - 8);

const byYear = (a, b) => a.year - b.year;

/** Number of neighbouring pairs (in time order) that are at most CLOSE_GAP years apart. */
export function closePairs(events) {
  const years = events.map((e) => e.year).sort((a, b) => a - b);
  return years.slice(1).filter((y, i) => y - years[i] <= CLOSE_GAP).length;
}

/** The reasons a set of events is not a legal puzzle; an empty list means it is fine. */
export function setProblems(events) {
  const problems = [];
  const years = events.map((e) => e.year);
  if (events.length !== SET_SIZE) problems.push('size');
  if (new Set(events.map((e) => e.id)).size !== events.length) problems.push('repeated event');
  if (new Set(years).size !== years.length) problems.push('two events in the same year');
  if (Math.max(...years) - Math.min(...years) < MIN_SPAN) problems.push('span too narrow');
  if (closePairs(events) < MIN_CLOSE_PAIRS) problems.push('too few close pairs');
  const israeli = events.filter((e) => e.il).length;
  if (israeli < MIN_PER_REGION || events.length - israeli < MIN_PER_REGION) problems.push('region balance');
  const perTopic = {};
  for (const e of events) perTopic[e.topic] = (perTopic[e.topic] || 0) + 1;
  if (Object.values(perTopic).some((n) => n > MAX_PER_TOPIC)) problems.push('one topic dominates');
  return problems;
}

/**
 * Draws one legal set from the pool, or null if a few hundred tries find none.
 * Two events are drawn each with a near neighbour (that is where the difficulty comes from),
 * the rest at random; then the whole set is checked.
 */
function drawSet(random, pool) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  for (let attempt = 0; attempt < 400; attempt++) {
    const set = [];
    const free = (e) => !set.some((s) => s.id === e.id || s.year === e.year);
    for (let pair = 0; pair < MIN_CLOSE_PAIRS; pair++) {
      const first = pick(pool.filter(free));
      if (!first) break;
      set.push(first);
      const partner = pick(pool.filter((e) => free(e) && Math.abs(e.year - first.year) <= CLOSE_GAP));
      if (partner) set.push(partner);
    }
    while (set.length < SET_SIZE) {
      const next = pick(pool.filter(free));
      if (!next) break;
      set.push(next);
    }
    if (setProblems(set).length === 0) return set;
  }
  return null;
}

/** Shuffles a set into play order: the first event starts on the timeline, the rest arrive one by one. */
function toPuzzle(set, random) {
  const order = [...set];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { anchor: order[0], queue: order.slice(1) };
}

const cycles = new Map();

/** All the puzzles of one cycle, built together so that no event is used twice in it. */
function cyclePuzzles(cycle) {
  if (cycles.has(cycle)) return cycles.get(cycle);
  // The multiplier spreads neighbouring cycle numbers (negative ones too) over the seed space.
  const seed = (20261114 + Math.imul(cycle, 2654435761)) >>> 0;
  const random = mulberry32(seed);
  let pool = seededShuffle(EVENTS, seed);
  const puzzles = [];
  for (let i = 0; i < CYCLE; i++) {
    // If the leftovers ever cannot make a legal set, fall back to the whole list rather than break a rule.
    const set = drawSet(random, pool) || drawSet(random, EVENTS);
    const used = new Set(set.map((e) => e.id));
    pool = pool.filter((e) => !used.has(e.id));
    puzzles.push(toPuzzle(set, random));
  }
  cycles.set(cycle, puzzles);
  return puzzles;
}

/** Today's puzzle: { anchor, queue }. The same for everyone; works for day 0 and below. */
export function puzzleForDay(day) {
  const cycle = Math.floor((day - 1) / CYCLE);
  return cyclePuzzles(cycle)[day - 1 - cycle * CYCLE];
}

/** A practice puzzle from the whole list, under the same rules as a daily one. */
export function randomPuzzle(random = Math.random) {
  return toPuzzle(drawSet(random, EVENTS), random);
}

// ---------- a game in progress is just the list of results so far: true = placed correctly ----------

/** Keeps only what can be a real game: booleans, at most ROUNDS of them, nothing after the last life. */
export function cleanResults(saved) {
  const out = [];
  if (!Array.isArray(saved)) return out;
  for (const r of saved) {
    if (typeof r !== 'boolean' || isOver(out)) break;
    out.push(r);
  }
  return out;
}

export const mistakes = (results) => results.filter((r) => !r).length;
export const score = (results) => results.filter(Boolean).length;
export const livesLeft = (results) => LIVES - mistakes(results);
export const isOver = (results) => results.length >= ROUNDS || mistakes(results) >= LIVES;
export const isWon = (results) => results.length >= ROUNDS && mistakes(results) < LIVES;
export const isPerfect = (results) => isWon(results) && mistakes(results) === 0;

/** The event waiting to be placed, or null when the game is over. */
export function currentEvent(puzzle, results) {
  return isOver(results) ? null : puzzle.queue[results.length];
}

/**
 * The timeline as it stands, earliest first. Each entry is { event, status }:
 * 'anchor' (was there from the start), 'right' or 'wrong' (how the player placed it).
 * A wrongly placed event still appears, in its true position.
 */
export function timeline(puzzle, results) {
  const rows = [{ event: puzzle.anchor, status: 'anchor' }];
  results.forEach((ok, i) => rows.push({ event: puzzle.queue[i], status: ok ? 'right' : 'wrong' }));
  return rows.sort((a, b) => byYear(a.event, b.event));
}

/** Everything, earliest first, for the end of the game; events the player never reached are 'missed'. */
export function fullTimeline(puzzle, results) {
  const rows = timeline(puzzle, results);
  for (const event of puzzle.queue.slice(results.length)) rows.push({ event, status: 'missed' });
  return rows.sort((a, b) => byYear(a.event, b.event));
}

/** Gap g sits before row g: 0 is "before everything", rows.length is "after everything". */
export function correctGap(rows, event) {
  return rows.filter((r) => r.event.year < event.year).length;
}

/** Plays one move. Returns the new results plus what happened; results are unchanged if the game is over. */
export function place(puzzle, results, gap) {
  const event = currentEvent(puzzle, results);
  if (!event) return { results, event: null, correct: false, gap: -1 };
  const answer = correctGap(timeline(puzzle, results), event);
  const correct = gap === answer;
  return { results: [...results, correct], event, correct, gap: answer };
}

/** What the hub shows next to a finished game. */
export const summary = (results) => `${score(results)}/${ROUNDS}`;

/** One square per event, in the order they arrived: right, wrong, or never reached. No years, no names. */
export function shareText({ day, results, url }) {
  const marks = Array.from({ length: ROUNDS }, (_, i) => (i >= results.length ? '⬜' : results[i] ? '🟩' : '🟥')).join('');
  return [`${NAME} #${day} ${summary(results)}`, marks, url].join('\n');
}

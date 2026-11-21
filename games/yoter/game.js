// Pure rules for יותר או פחות: themes, the daily chain, scoring and share text.
// No DOM here, so tests/yoter.logic.test.mjs can import it in Node.
import { mulberry32, seededShuffle } from '../../shared/core.js';
import { DATA, SOURCE } from './data.js';

export { SOURCE };
export const NAME = 'יותר או פחות';
export const ROUNDS = 10;
export const WIN_SCORE = 7; // a day counts towards the streak from seven right answers
export const BUCKETS = ROUNDS + 1; // one stats bar per score, 0 to 10

const SEED = 20261114;
const group = (n) => Math.abs(n).toLocaleString('en-US'); // 1,208: the way numbers are written in Hebrew too

/**
 * Every theme compares one kind of number.
 *   kind 'year'    two items are never paired closer than `gap` years
 *   kind 'amount'  …or closer than `gap` as a share of the larger value
 * The gaps are wider than the site-wide 3% where the source is less exact: population figures in
 * Wikidata come from different years, and a founding year can mean the first tent or the first house.
 */
const THEME_LIST = [
  {
    id: 'population', title: 'כמה תושבים יש בעיר?', short: 'מספר התושבים בערים', kind: 'amount', gap: 0.1,
    more: 'יותר תושבים', less: 'פחות תושבים', suffix: 'תושבים',
  },
  {
    id: 'founded', title: 'מתי הוקם היישוב?', short: 'שנת ההקמה של יישובים', kind: 'year', gap: 5,
    more: 'מאוחר יותר', less: 'מוקדם יותר', prefix: 'שנת הקמה',
  },
  {
    id: 'north', title: 'כמה צפונה מאילת?', short: 'המרחק צפונה מאילת', kind: 'amount', gap: 0.03,
    more: 'צפונה יותר', less: 'דרומה יותר', suffix: 'ק״מ צפונה מאילת',
  },
  {
    id: 'films', title: 'מתי יצא הסרט?', short: 'שנת היציאה של סרטים ישראליים', kind: 'year', gap: 3,
    more: 'מאוחר יותר', less: 'מוקדם יותר', prefix: 'יצא בשנת',
  },
  {
    id: 'tv', title: 'מתי עלתה הסדרה?', short: 'שנת העלייה לשידור של סדרות ישראליות', kind: 'year', gap: 3,
    more: 'מאוחר יותר', less: 'מוקדם יותר', prefix: 'עלתה בשנת',
  },
  {
    id: 'peaks', title: 'מה גובה ההר?', short: 'גובה ההרים מעל פני הים', kind: 'amount', gap: 0.03,
    more: 'גבוה יותר', less: 'נמוך יותר', suffix: 'מ׳ מעל פני הים',
  },
  {
    id: 'born', title: 'מתי הם נולדו?', short: 'שנת הלידה של אמנים ישראלים', kind: 'year', gap: 3,
    more: 'מאוחר יותר', less: 'מוקדם יותר', prefix: 'שנת לידה',
  },
];

export const THEMES = THEME_LIST.map((t) => ({ ...t, items: DATA[t.id].map(([name, value]) => ({ name, value })) }));
export const themeById = (id) => THEMES.find((t) => t.id === id) || null;

/** The pieces of a displayed value: { prefix, number, suffix }. The interface animates `number`. */
export function valueParts(theme, value) {
  const number = theme.kind === 'year' ? String(value) : (value < 0 ? '-' : '') + group(value);
  return { prefix: theme.prefix || '', number, suffix: theme.suffix || '' };
}
export function formatValue(theme, value) {
  const p = valueParts(theme, value);
  return [p.prefix, p.number, p.suffix].filter(Boolean).join(' ');
}

/** Two values may share a round only when the answer is not a coin toss. */
export function farEnough(theme, a, b) {
  const diff = Math.abs(a - b);
  if (theme.kind === 'year') return diff >= theme.gap;
  return diff > theme.gap * Math.max(Math.abs(a), Math.abs(b));
}

// ---------- the theme of the day ----------

const mod = (n, m) => ((n % m) + m) % m;
const weekOrder = (week) => seededShuffle(THEMES, (SEED + week * 7919) >>> 0);

/**
 * Themes come in shuffled rounds of seven, so each one appears once a "week" but not on a fixed
 * weekday. If a round would open with the theme the previous one closed on, its first two swap.
 */
export function themeForDay(day) {
  const n = THEMES.length;
  const week = Math.floor((day - 1) / n);
  const order = weekOrder(week);
  if (order[0] === weekOrder(week - 1)[n - 1]) [order[0], order[1]] = [order[1], order[0]];
  return order[mod(day - 1, n)];
}

// ---------- chains ----------

// How one day is paced: mostly comfortable gaps, a few that need thought, a few tight ones.
const DAILY_LEVELS = ['easy', 'easy', 'easy', 'easy', 'mid', 'mid', 'mid', 'tight', 'tight', 'tight'];
// Where each level sits in the list of candidates ordered from closest to farthest.
const BANDS = { tight: [0, 0.15], mid: [0.15, 0.5], easy: [0.5, 1] };

/**
 * The next item of a chain: unused, far enough from the current one, and as close as `level` asks.
 * The direction is drawn first so that "more" and "less" come up about equally; without that a chain
 * that reaches a very large value would answer "less" for the rest of the day.
 * Returns null when nothing is left to pair with.
 */
export function nextItem(theme, current, used, random, level = 'mid') {
  const pool = theme.items.filter((it) => !used.has(it.name) && farEnough(theme, current.value, it.value));
  if (!pool.length) return null;
  const up = random() < 0.5;
  const sameWay = pool.filter((it) => (it.value > current.value) === up);
  const candidates = (sameWay.length >= 4 ? sameWay : pool)
    .map((it) => ({ it, d: Math.abs(it.value - current.value) }))
    .sort((a, b) => a.d - b.d || a.it.name.localeCompare(b.it.name))
    .map((c) => c.it);
  const [from, to] = BANDS[level] || BANDS.mid;
  const start = Math.min(candidates.length - 1, Math.floor(from * candidates.length));
  const end = Math.max(start + 1, Math.ceil(to * candidates.length));
  return candidates[start + Math.floor(random() * (end - start))];
}

/** Eleven items for ten rounds, the same for everyone on the same day. */
export function chainForDay(day) {
  const theme = themeForDay(day);
  const random = mulberry32((SEED ^ Math.imul(day, 2654435761)) >>> 0);
  const levels = seededShuffle(DAILY_LEVELS, Math.floor(random() * 2 ** 31));
  // Open gently: the first round should not be the hardest of the day.
  const firstEasy = levels.indexOf('easy');
  [levels[0], levels[firstEasy]] = [levels[firstEasy], levels[0]];

  const items = [theme.items[Math.floor(random() * theme.items.length)]];
  const used = new Set([items[0].name]);
  for (const level of levels) {
    const next = nextItem(theme, items[items.length - 1], used, random, level);
    if (!next) throw new Error(`chain for day ${day} ran out of items`);
    items.push(next);
    used.add(next.name);
  }
  return { theme, items, levels };
}

const PRACTICE_LEVELS = ['easy', 'easy', 'mid', 'mid', 'tight'];

/**
 * The sudden-death run: grows one item at a time for as long as the player keeps answering right.
 * When a theme runs dry the used list starts over, so a very long run can meet an item again.
 */
export function createRun(theme, random = Math.random) {
  const first = theme.items[Math.floor(random() * theme.items.length)];
  const used = new Set([first.name]);
  const draw = (current) => {
    const level = PRACTICE_LEVELS[Math.floor(random() * PRACTICE_LEVELS.length)];
    let next = nextItem(theme, current, used, random, level);
    if (!next) {
      used.clear();
      used.add(current.name);
      next = nextItem(theme, current, used, random, level);
    }
    used.add(next.name);
    return next;
  };
  const items = [first, draw(first)];
  return { theme, items, extend: () => { items.push(draw(items[items.length - 1])); return items; } };
}

// ---------- answers and score ----------

export const ANSWERS = ['more', 'less'];

/** Is `answer` right for the step from `known` to `hidden`? */
export function isRight(known, hidden, answer) {
  return (hidden.value > known.value) === (answer === 'more');
}

/** One boolean per answered round. */
export function results(items, answers) {
  return answers.map((answer, i) => isRight(items[i], items[i + 1], answer));
}
export const score = (items, answers) => results(items, answers).filter(Boolean).length;
export const isOver = (answers) => answers.length >= ROUNDS;
export const isWon = (items, answers) => isOver(answers) && score(items, answers) >= WIN_SCORE;

/** Only known answers, and never more than a day has rounds: whatever was in storage. */
export function cleanAnswers(saved) {
  return Array.isArray(saved) ? saved.filter((a) => ANSWERS.includes(a)).slice(0, ROUNDS) : [];
}

/** What the hub shows next to a finished game. */
export const summary = (items, answers) => `${score(items, answers)}/${ROUNDS}`;

export function endTitle(points) {
  if (points === ROUNDS) return 'עשר מעשר!';
  if (points >= 8) return 'כמעט מושלם';
  if (points >= WIN_SCORE) return 'יפה מאוד';
  if (points >= 4) return 'לא רע בכלל';
  return 'מחר יום חדש';
}

/** Name, day number, score, ten squares, link. Squares say right or wrong, never which way. */
export function shareText({ day, items, answers, url }) {
  const squares = results(items, answers).map((ok) => (ok ? '🟩' : '🟥')).join('');
  return [`${NAME} #${day} ${summary(items, answers)}`, squares, url].join('\n');
}

// ---------- points for the group boards (0–100, higher is better; see games/README.md) ----------

/** Ten points for every right answer of the day's ten. The sudden-death practice never counts. */
export const points = (items, answers) => score(items, answers.slice(0, ROUNDS)) * 10;

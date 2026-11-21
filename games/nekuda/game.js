// Pure game logic. No DOM access here, so it runs in Node for tests.
import * as core from '../../shared/core.js';

export { israelDate, msUntilNextPuzzle, currentStreak } from '../../shared/core.js';

export const MAX_GUESSES = 6;
export const EPOCH = '2026-11-13'; // puzzle #1
export const MIN_TARGET_POPULATION = 5000;
export const MAX_DISTANCE_KM = 450; // roughly Metula to Eilat
const SHUFFLE_SEED = 20261113;

export const TYPE_LABELS = ['עיר', 'מועצה מקומית', 'קיבוץ', 'מושב', 'יישוב קהילתי', 'יישוב'];
export const DIRECTION_NAMES = ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'];
export const DIRECTION_EMOJI = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];

export const normalize = core.normalizeHebrew;

export function toLocality(row) {
  return { name: row[0], lat: row[1], lon: row[2], pop: row[3], type: row[4] };
}

const rad = (deg) => (deg * Math.PI) / 180;

export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Compass bearing in degrees (0 = north, 90 = east) from a to b. */
export function bearing(a, b) {
  const dLon = rad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function directionIndex(degrees) {
  return Math.round(degrees / 45) % 8;
}

/** 0–100 closeness score. The square root spreads out short distances, which is where a small country's guesses land. */
export function proximity(km) {
  return Math.max(0, Math.min(100, Math.round((1 - Math.sqrt(km / MAX_DISTANCE_KM)) * 100)));
}

export function evaluateGuess(guess, target) {
  const win = guess.name === target.name;
  const km = win ? 0 : Math.max(1, Math.round(distanceKm(guess, target)));
  const deg = win ? 0 : bearing(guess, target);
  return { name: guess.name, km, deg, dir: directionIndex(deg), pct: win ? 100 : Math.min(99, proximity(km)), win };
}

/** This game started a day before the rest of the site, so it counts days from its own epoch. */
export function dayNumber(dateString) {
  return core.dayNumber(dateString, EPOCH);
}

/** Well-known localities in a fixed shuffled order: one per day, no repeats until the list runs out. */
export function buildTargetPool(localities) {
  const pool = localities.filter((l) => l.pop >= MIN_TARGET_POPULATION).sort((a, b) => (a.name < b.name ? -1 : 1));
  return core.seededShuffle(pool, SHUFFLE_SEED);
}

export const targetForDay = core.pickDaily;

/** Prefix matches first, then matches anywhere in the name; bigger places first within each group. */
export function searchLocalities(index, query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const entry of index) {
    const at = entry.key.indexOf(q);
    if (at === 0) starts.push(entry);
    else if (at > 0) contains.push(entry);
  }
  const byPop = (a, b) => b.locality.pop - a.locality.pop;
  return [...starts.sort(byPop), ...contains.sort(byPop)].slice(0, limit).map((e) => e.locality);
}

export function buildSearchIndex(localities) {
  return localities.map((locality) => ({ key: normalize(locality.name), locality }));
}

export function populationBand(pop) {
  if (!pop) return 'לא ידוע';
  if (pop >= 200000) return 'מעל 200 אלף';
  if (pop >= 100000) return '100–200 אלף';
  if (pop >= 50000) return '50–100 אלף';
  if (pop >= 20000) return '20–50 אלף';
  if (pop >= 10000) return '10–20 אלף';
  if (pop >= 5000) return '5–10 אלף';
  return 'פחות מ-5 אלף';
}

/** Hints unlock as guesses are used up. Each returns null while still locked. */
export function hintsFor(target, guessesUsed, finished = false) {
  const open = (after) => finished || guessesUsed >= after;
  return [
    { label: 'סוג', unlockAfter: 2, value: open(2) ? TYPE_LABELS[target.type] : null },
    { label: 'תושבים', unlockAfter: 3, value: open(3) ? populationBand(target.pop) : null },
    { label: 'אות ראשונה', unlockAfter: 4, value: open(4) ? target.name[0] : null },
  ];
}

export function shareText({ title, day, results, url }) {
  const won = results.some((r) => r.win);
  const score = won ? results.length : 'X';
  const lines = results.map((r) => {
    if (r.win) return '🟩🟩🟩🟩🟩 🎯';
    const filled = Math.round(r.pct / 20);
    return '🟧'.repeat(filled) + '⬜'.repeat(5 - filled) + ' ' + DIRECTION_EMOJI[r.dir];
  });
  return [`${title} #${day} 🧭 ${score}/${MAX_GUESSES}`, ...lines, url].join('\n');
}

export function emptyStats() {
  return core.emptyStats(MAX_GUESSES);
}

/** Returns new stats after a finished daily game; a win in N guesses lands in bar N of the chart. */
export function recordResult(stats, day, won, guessCount) {
  return core.recordResult(stats, day, won, guessCount - 1);
}

/** The line the hub shows next to a finished game. */
export function summary(results) {
  return `${results.some((r) => r.win) ? results.length : 'X'}/${MAX_GUESSES}`;
}

// ---------- points for the group boards (0–100, higher is better; see games/README.md) ----------

/** Found in one guess: 100, then 15 less for every extra guess (25 in the sixth). Not found: 0. */
export const POINTS_BY_GUESS = [100, 85, 70, 55, 40, 25];
export function points(results) {
  const n = results.length;
  return results.some((r) => r.win) && n >= 1 && n <= MAX_GUESSES ? POINTS_BY_GUESS[n - 1] : 0;
}

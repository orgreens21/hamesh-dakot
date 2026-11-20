// Pure helpers shared by every game. No DOM access here, so they run in Node for tests.

/** Puzzle #1 for every game added after the first one. A game may pass its own epoch instead. */
export const DEFAULT_EPOCH = '2026-11-14';

const FINAL_LETTERS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/** Strips everything that makes typing Hebrew fiddly: niqqud, final letters, spaces and punctuation. */
export function normalizeHebrew(text) {
  return String(text)
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c])
    .replace(/[^א-תa-zA-Z0-9]/g, '');
}

// ---------- the daily clock ----------

/** Calendar date in Israel, as YYYY-MM-DD, so everyone in the country flips to the next puzzle at midnight. */
export function israelDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const toDays = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;

/** 1 on the epoch date, 2 the day after. Zero or negative before the epoch, so callers must not assume day >= 1. */
export function dayNumber(dateString = israelDate(), epoch = DEFAULT_EPOCH) {
  return toDays(dateString) - toDays(epoch) + 1;
}

/** The calendar date of a puzzle day. Noon UTC is the same date in Israel whatever the season. */
export function dateOfDay(day, epoch = DEFAULT_EPOCH) {
  return new Date(Date.UTC(+epoch.slice(0, 4), +epoch.slice(5, 7) - 1, +epoch.slice(8, 10) + day - 1, 12));
}

/** "13 בנובמבר", for puzzle labels. */
export function hebrewDate(date = new Date(), options = { day: 'numeric', month: 'long' }) {
  return new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', ...options }).format(date);
}

const WALL_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
/** Israel's wall clock at an instant, read as if it were UTC: [ms, year, month, day]. */
function israelWallClock(date) {
  const p = Object.fromEntries(WALL_CLOCK.formatToParts(date).map((part) => [part.type, Number(part.value)]));
  return [Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second), p.year, p.month, p.day];
}

/**
 * Milliseconds until the next Israel midnight. The clock change days are 23 and 25 hours long, so
 * the zone's offset is read again at the midnight itself rather than assumed to be today's.
 */
export function msUntilNextPuzzle(now = new Date()) {
  const whole = Math.floor(now.getTime() / 1000) * 1000;
  const [wall, year, month, day] = israelWallClock(now);
  const midnight = Date.UTC(year, month - 1, day + 1);
  let instant = midnight - (wall - whole);
  instant = midnight - (israelWallClock(new Date(instant))[0] - instant);
  return Math.max(0, instant - now.getTime());
}

/** 3723000 -> "01:02:03" */
export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// ---------- seeded randomness: the same puzzle for everyone, with no server ----------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates with a seeded generator. Returns a new array; the input is left alone. */
export function seededShuffle(array, seed) {
  const out = [...array];
  const random = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Walks a pool one item per day with no repeats until it runs out, then starts over.
 * Shuffle the pool once with seededShuffle (fixed seed) so the order is not the order of the data file.
 * Works for day <= 0 too.
 */
export function pickDaily(pool, day) {
  return pool[(((day - 1) % pool.length) + pool.length) % pool.length];
}

// ---------- stats ----------

/** lastWinDay / lastPlayedDay start as null, not 0: day numbers can be 0 or negative before a game's epoch. */
export function emptyStats(buckets = 6) {
  return { played: 0, wins: 0, streak: 0, maxStreak: 0, lastWinDay: null, lastPlayedDay: null, distribution: Array(buckets).fill(0) };
}

/**
 * Returns new stats after a finished daily game. Replaying the same day never counts twice.
 * bucketIndex is the 0-based bar of the distribution chart a win lands in (ignored for a loss).
 */
export function recordResult(stats, day, won, bucketIndex = 0) {
  if (stats.lastPlayedDay === day) return stats;
  const next = { ...stats, distribution: [...stats.distribution], played: stats.played + 1, lastPlayedDay: day };
  if (won) {
    next.wins += 1;
    next.streak = stats.lastWinDay === day - 1 ? stats.streak + 1 : 1;
    next.maxStreak = Math.max(next.maxStreak, next.streak);
    next.lastWinDay = day;
    if (bucketIndex >= 0 && bucketIndex < next.distribution.length) next.distribution[bucketIndex] += 1;
  } else {
    next.streak = 0;
  }
  return next;
}

/** A streak only shows as alive if the last win was today or yesterday. */
export function currentStreak(stats, day) {
  return stats && stats.lastWinDay != null && stats.lastWinDay >= day - 1 ? stats.streak : 0;
}

export function winRate(stats) {
  return stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
}

// ---------- the saved state every game shares (see games/README.md) ----------

/**
 * Turns whatever was in storage into today's state. Stats and seenHelp carry over from day to day;
 * progress, finished, won and summary belong to one day and are dropped when the day changes.
 */
export function dailyState(saved, today, buckets = 6) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const stats = { ...emptyStats(buckets), ...(s.stats && typeof s.stats === 'object' ? s.stats : {}) };
  if (!Array.isArray(stats.distribution) || stats.distribution.length !== buckets) stats.distribution = emptyStats(buckets).distribution;
  const sameDay = s.day === today;
  return {
    day: today,
    finished: sameDay && !!s.finished,
    won: sameDay && !!s.won,
    summary: sameDay && typeof s.summary === 'string' ? s.summary : '',
    progress: sameDay && s.progress != null ? s.progress : null,
    stats,
    seenHelp: !!s.seenHelp,
  };
}

const isEmpty = (v) => v == null || (typeof v === 'object' && Object.keys(v).length === 0);

/** What the hub shows for a game today: 'new' | 'playing' | 'won' | 'lost'. */
export function dailyStatus(saved, today) {
  if (!saved || typeof saved !== 'object' || saved.day !== today) return 'new';
  if (saved.finished) return saved.won ? 'won' : 'lost';
  return isEmpty(saved.progress) ? 'new' : 'playing';
}

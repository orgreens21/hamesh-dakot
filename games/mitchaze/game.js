// Rules of המתחזה, with no DOM, so Node can test them.
// Every function that needs chance takes an `rng` (a function returning a number in [0, 1));
// the page uses cryptoRandom, the tests pass a seeded generator.
import { PACKS } from './words.js';
import { normalizeHebrew } from '../../shared/core.js';

export { PACKS };

export const NAME = 'המתחזה';
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const DEFAULT_PLAYERS = 4;
export const MAX_NAME_LENGTH = 14;
export const TIMER_OPTIONS = [0, 2, 3, 5]; // minutes; 0 is "no timer"
export const MIN_PACK_SIZE = 50;
// How many played words are remembered between visits. Roughly a third of the full list,
// so a regular group goes many evenings without a repeat and still never runs dry.
export const RECENT_LIMIT = 200;

export const POINTS = { civilians: 1, escaped: 2, guessed: 1 };

// ---------- chance ----------

/** Uniform in [0, 1) from the platform's cryptographic generator (browser and Node 19+). */
export function cryptoRandom() {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
}

export function randomInt(n, rng = cryptoRandom) {
  // The clamp only matters for a broken injected rng that returns exactly 1.
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** Fisher–Yates; returns a new array. */
export function shuffle(items, rng = cryptoRandom) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- players and settings ----------

/** Impostors must stay a clear minority: 1 for 3–4 players, up to 2 for 5–6, up to 3 from 7. */
export function maxImpostors(players) {
  return Math.max(1, Math.min(3, Math.floor((players - 1) / 2)));
}

export function clampImpostors(count, players) {
  const n = Number.isInteger(count) ? count : 1;
  return Math.max(1, Math.min(maxImpostors(players), n));
}

export const defaultName = (index) => `שחקן ${index + 1}`;

export function cleanName(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

/** The names as they are shown in the game: blanks become "שחקן N". */
export function resolveNames(names) {
  return names.map((name, i) => cleanName(name) || defaultName(i));
}

/** The first name that appears twice (two players nobody could tell apart when voting), or null. */
export function duplicateName(names) {
  const seen = new Set();
  for (const name of resolveNames(names)) {
    const key = name.toLocaleLowerCase('he');
    if (seen.has(key)) return name;
    seen.add(key);
  }
  return null;
}

export function defaultSettings() {
  return {
    names: Array.from({ length: DEFAULT_PLAYERS }, () => ''),
    impostors: 1,
    packs: PACKS.map((p) => p.id),
    hint: false,
    timer: 3,
  };
}

/** Whatever was in storage, turned into settings the game can run with. */
export function sanitizeSettings(saved) {
  const base = defaultSettings();
  if (!saved || typeof saved !== 'object') return base;
  let names = Array.isArray(saved.names) ? saved.names.slice(0, MAX_PLAYERS).map(cleanName) : base.names;
  while (names.length < MIN_PLAYERS) names.push('');
  const known = new Set(PACKS.map((p) => p.id));
  const packs = Array.isArray(saved.packs) ? [...new Set(saved.packs.filter((id) => known.has(id)))] : base.packs;
  return {
    names,
    impostors: clampImpostors(saved.impostors, names.length),
    packs: packs.length ? packs : base.packs,
    hint: saved.hint === true,
    timer: TIMER_OPTIONS.includes(saved.timer) ? saved.timer : base.timer,
  };
}

export function sanitizeRecent(saved) {
  if (!Array.isArray(saved)) return [];
  return saved.filter((w) => typeof w === 'string' && w).slice(-RECENT_LIMIT);
}

/** One score per player; anything unusable becomes 0. */
export function sanitizeScores(saved, players) {
  const list = Array.isArray(saved) ? saved : [];
  return Array.from({ length: players }, (_, i) => (Number.isInteger(list[i]) && list[i] >= 0 ? list[i] : 0));
}

// ---------- words ----------

export function wordPool(packIds) {
  const wanted = new Set(packIds);
  return PACKS.filter((p) => wanted.has(p.id)).flatMap((p) => p.words.map((word) => ({ word, packId: p.id, packName: p.name })));
}

/**
 * Picks the secret word.
 *   used    words already played in this session: never repeated while anything else is left
 *   recent  words played lately on this phone, oldest first: avoided while anything else is left
 * `exhausted` is true when every word of the chosen packs was played this session and the cycle restarts.
 */
export function pickWord({ packIds, used = [], recent = [], rng = cryptoRandom }) {
  const pool = wordPool(packIds);
  if (!pool.length) throw new Error('no words in the chosen packs');
  const usedSet = new Set(used);
  const age = new Map(recent.map((w, i) => [w, i]));
  const unused = pool.filter((e) => !usedSet.has(e.word));
  let candidates = unused.filter((e) => !age.has(e.word));
  let exhausted = false;
  if (!candidates.length && unused.length) {
    // Everything left was played lately: fall back to the third that was played longest ago.
    const oldestFirst = unused.slice().sort((a, b) => age.get(a.word) - age.get(b.word));
    candidates = oldestFirst.slice(0, Math.ceil(oldestFirst.length / 3));
  }
  if (!candidates.length) {
    exhausted = true;
    const last = used[used.length - 1];
    candidates = pool.length > 1 ? pool.filter((e) => e.word !== last) : pool;
  }
  return { ...candidates[randomInt(candidates.length, rng)], exhausted };
}

export function rememberWord(recent, word, limit = RECENT_LIMIT) {
  return [...recent.filter((w) => w !== word), word].slice(-limit);
}

// ---------- a round ----------

/**
 * Deals one round: the word, who the impostors are (player indexes, ascending) and who speaks first.
 */
export function dealRound({ players, impostors = 1, packIds, used = [], recent = [], rng = cryptoRandom }) {
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS) throw new Error('bad player count');
  const picked = pickWord({ packIds, used, recent, rng });
  const seats = shuffle(Array.from({ length: players }, (_, i) => i), rng);
  const count = clampImpostors(impostors, players);
  return {
    word: picked.word,
    packId: picked.packId,
    packName: picked.packName,
    exhausted: picked.exhausted,
    impostors: seats.slice(0, count).sort((a, b) => a - b),
    starter: randomInt(players, rng),
  };
}

export const isImpostor = (round, player) => round.impostors.includes(player);

/** The group caught the impostors only if it accused exactly them. */
export function isCaught(impostors, accused) {
  return accused.length === impostors.length && accused.every((p) => impostors.includes(p));
}

/**
 * The result of a round.
 *   accused      the player indexes the group pointed at (as many as there are impostors)
 *   guessedWord  after being caught, did the impostors name the secret word?
 * Returns { caught, winner: 'civilians' | 'impostors', reason: 'caught' | 'guessed' | 'escaped', points: number[] }.
 */
export function judge({ players, impostors, accused, guessedWord = false }) {
  const caught = isCaught(impostors, accused);
  const reason = !caught ? 'escaped' : guessedWord ? 'guessed' : 'caught';
  const winner = reason === 'caught' ? 'civilians' : 'impostors';
  const points = Array.from({ length: players }, (_, p) => {
    const impostor = impostors.includes(p);
    if (winner === 'civilians') return impostor ? 0 : POINTS.civilians;
    return impostor ? POINTS[reason] : 0;
  });
  return { caught, winner, reason, points };
}

export function addScores(scores, points) {
  return points.map((p, i) => (scores[i] || 0) + p);
}

/** Score table rows, best first; players with equal scores keep their seating order. */
export function ranking(names, scores) {
  return names.map((name, index) => ({ name, index, score: scores[index] || 0 })).sort((a, b) => b.score - a.score || a.index - b.index);
}

// ---------- text ----------

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "דנה", "דנה ויוסי", "דנה, יוסי ומיכל" */
export function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' ו' + names[names.length - 1];
}

export function inviteText(url) {
  return `בואו לשחק ${NAME}! טלפון אחד עובר בין כולם, כל אחד מקבל מילה סודית, ורק המתחזה לא יודע מה היא.\n${url}`;
}

// ---------- data checks ----------

/** Problems in the word packs, as readable strings; empty when the data is sound. */
export function validatePacks(packs = PACKS) {
  const problems = [];
  const ids = new Set();
  const seen = new Map();
  for (const pack of packs) {
    if (!pack.id || !pack.name) problems.push(`pack without id or name: ${JSON.stringify(pack.id)}`);
    if (ids.has(pack.id)) problems.push(`duplicate pack id: ${pack.id}`);
    ids.add(pack.id);
    if (!Array.isArray(pack.words) || pack.words.length < MIN_PACK_SIZE) problems.push(`${pack.id}: only ${pack.words?.length ?? 0} words`);
    for (const word of pack.words || []) {
      if (typeof word !== 'string' || word !== word.trim() || word.length < 2 || word.length > 24 || /\s{2,}/.test(word)) {
        problems.push(`${pack.id}: malformed word ${JSON.stringify(word)}`);
        continue;
      }
      const key = normalizeHebrew(word);
      if (seen.has(key)) problems.push(`"${word}" appears in ${seen.get(key)} and ${pack.id}`);
      else seen.set(key, pack.id);
    }
  }
  return problems;
}

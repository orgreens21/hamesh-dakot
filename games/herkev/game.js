// Pure rules for צומת: a daily 3×3 grid on one topic a day. Every cell is where a row and a column
// meet, and the answer is something that fits both. No DOM here, so Node can test it.
import { normalizeHebrew, pickDaily } from '../../shared/core.js';
import { GRIDS, CRITERIA, MIN_ANSWERS, RETRIEVED } from './grids.js';
import { TOPICS, TOPIC_IDS } from './topics.js';
import { SIZE, CELLS, cellCriteria, matches, validItems, assignDistinct, itemsFromRows } from './rules.js';

export { MIN_ANSWERS, RETRIEVED, SIZE, CELLS, TOPICS, TOPIC_IDS, cellCriteria, matches, assignDistinct };
export { sharedCriteria, cellPairs } from './rules.js';

export const NAME = 'צומת';
/** One guess per cell on average: every guess, right or wrong, uses one up. */
export const MAX_GUESSES = CELLS;
/** A day counts as a win (and keeps the streak) from this many filled cells. */
export const WIN_CELLS = 5;
/** Stats buckets: 0 to 9 cells filled. */
export const BUCKETS = CELLS + 1;
/** How many earlier days the archive offers. */
export const ARCHIVE_DAYS = 30;
export const GRID_DAYS = GRIDS.length;

/** What the page needs to draw a criterion: { id, name, detail, icon? , colors? }. */
export function criterion(id) {
  const c = CRITERIA[id];
  return c ? { id, name: c[0], detail: c[1], ...(Array.isArray(c[2]) ? { colors: c[2] } : { icon: c[2] }) } : null;
}

// ---------- the daily grid ----------

const ALL_GRIDS = GRIDS.map(([topic, rows, cols]) => ({ topic, rows, cols }));

/** The grids are generated in day order (the topics rotate and neighbouring days are checked against each other), so no shuffle here. */
export const gridForDay = (day) => pickDaily(ALL_GRIDS, day);
export const topicOf = (grid) => TOPICS[grid.topic];

// ---------- the answer lists, one file per topic, loaded on demand ----------

const LOADED = new Map(); // topic id -> { meta, items, byId }

/** Loads a topic's answer list (once). Everything below that looks at answers needs it loaded first. */
export async function loadTopic(topicId) {
  if (!LOADED.has(topicId)) {
    const data = await TOPICS[topicId].load();
    const items = itemsFromRows(data.CRITERIA, data.ITEMS);
    LOADED.set(topicId, { meta: data.META, items, byId: new Map(items.map((item) => [item.id, item])) });
  }
  return LOADED.get(topicId);
}

const loaded = (topicId) => {
  const topic = LOADED.get(topicId);
  if (!topic) throw new Error(`topic ${topicId} is not loaded yet: await loadTopic('${topicId}') first`);
  return topic;
};
export const itemsOf = (topicId) => loaded(topicId).items;
export const metaOf = (topicId) => loaded(topicId).meta;
export const itemById = (topicId, id) => loaded(topicId).byId.get(id) || null;

/** Every item that fits a cell, best-known first. */
export const answersFor = (grid, cell) => validItems(itemsOf(grid.topic), grid, cell);

/** Nine different items that fill the grid, or null. Used by the tests to play a perfect game. */
export const solve = (grid) => assignDistinct(Array.from({ length: CELLS }, (_, cell) => answersFor(grid, cell)));

/** Earlier days that can be replayed, newest first. Nothing before puzzle #1. */
export function archiveDays(today) {
  const days = [];
  for (let day = today - 1; day >= 1 && day >= today - ARCHIVE_DAYS; day--) days.push(day);
  return days;
}

/** The ?day=N of an archive link, or null when it is missing, malformed, today, or out of range. */
export function archiveDayFromQuery(search, today) {
  const raw = new URLSearchParams(search).get('day');
  if (raw == null || !/^\d+$/.test(raw)) return null;
  const day = Number(raw);
  return archiveDays(today).includes(day) ? day : null;
}

// ---------- playing ----------

/**
 * Replays a list of guesses ([cell, itemId] pairs, in order) and returns where the game stands.
 * Guesses that could not have been made (an id that is not in today's topic, a filled cell, a
 * ninth-plus guess) are skipped, which is also what makes it safe to feed this whatever was found in
 * storage, including progress saved for a different grid.
 */
export function replay(grid, guesses) {
  const { byId } = loaded(grid.topic);
  const filled = Array(CELLS).fill(null); // item id per cell
  const misses = Array.from({ length: CELLS }, () => []); // wrong item ids per cell
  const placed = new Set();
  const accepted = [];
  for (const entry of Array.isArray(guesses) ? guesses : []) {
    if (!Array.isArray(entry) || accepted.length >= MAX_GUESSES) continue;
    const [cell, itemId] = entry;
    const item = byId.get(itemId);
    if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS || !item) continue;
    if (filled[cell] != null || placed.has(itemId) || misses[cell].includes(itemId)) continue;
    const [row, col] = cellCriteria(grid, cell);
    if (matches(item, row) && matches(item, col)) {
      filled[cell] = itemId;
      placed.add(itemId);
    } else {
      misses[cell].push(itemId);
    }
    accepted.push([cell, itemId]);
  }
  const solved = filled.filter((id) => id != null).length;
  return { guesses: accepted, filled, misses, placed, solved, left: MAX_GUESSES - accepted.length };
}

/**
 * What would happen if this item were guessed for this cell now:
 * 'right' | 'wrong' (both use up a guess), or a refusal that costs nothing:
 * 'over', 'filled', 'placed' (already sits in another cell), 'repeat' (already tried here), 'unknown'.
 */
export function judge(grid, guesses, cell, itemId, gaveUp = false) {
  const state = replay(grid, guesses);
  if (gaveUp || state.left <= 0 || state.solved === CELLS) return 'over';
  const item = itemById(grid.topic, itemId);
  if (!item || !Number.isInteger(cell) || cell < 0 || cell >= CELLS) return 'unknown';
  if (state.filled[cell] != null) return 'filled';
  if (state.placed.has(itemId)) return 'placed';
  if (state.misses[cell].includes(itemId)) return 'repeat';
  const [row, col] = cellCriteria(grid, cell);
  return matches(item, row) && matches(item, col) ? 'right' : 'wrong';
}

export function isOver(grid, guesses, gaveUp = false) {
  const state = replay(grid, guesses);
  return gaveUp || state.left <= 0 || state.solved === CELLS;
}

export const solvedCount = (grid, guesses) => replay(grid, guesses).solved;
export const isWon = (grid, guesses) => solvedCount(grid, guesses) >= WIN_CELLS;

/** What the hub shows next to a finished game. */
export const summary = (grid, guesses) => `${solvedCount(grid, guesses)}/${CELLS}`;

export function endTitle(solved) {
  if (solved === CELLS) return 'רשת מושלמת!';
  if (solved >= 7) return 'כמעט הכול!';
  if (solved >= WIN_CELLS) return 'יפה מאוד!';
  if (solved >= 1) return 'לא נורא, מחר נושא חדש';
  return 'הפעם זה לא הלך';
}

/**
 * Name, day, score and the day's topic on the first line, the grid as squares, the link.
 * The topic is on the poster anyway; no answer and no criterion is given away.
 */
export function shareText({ day, grid, guesses, url }) {
  const { filled, solved } = replay(grid, guesses);
  const rows = [];
  for (let r = 0; r < SIZE; r++) rows.push(filled.slice(r * SIZE, r * SIZE + SIZE).map((id) => (id != null ? '🟩' : '⬜')).join(''));
  return [`${NAME} #${day} ${solved}/${CELLS} · ${topicOf(grid).label}`, ...rows, url].join('\n');
}

// ---------- search ----------

// Foreign names have no single Hebrew spelling (ט/ת, ק/כ, with or without a vowel letter), so there
// are two looser keys that ignore exactly those differences. They are consulted after the strict one.
const swapLetters = (key) => key.replace(/ט/g, 'ת').replace(/ק/g, 'כ');
const dropVowels = (key) => swapLetters(key).replace(/[אהוי]/g, '');
// Without its vowel letters a short word matches half the list, so that key needs a few consonants.
const MIN_CONSONANTS = 3;

const spelling = (name) => {
  const words = String(name).split(/[\s־-]+/).map(normalizeHebrew).filter(Boolean);
  return { key: words.join(''), words, swapped: words.map(swapLetters), bare: words.map(dropVowels) };
};

/** A search index over a topic's items: the name and every other name the item is known by. */
export function buildSearchIndex(items) {
  return items.map((item) => ({ item, names: [item.name, ...(item.aliases || [])].map(spelling) }));
}

/**
 * Items whose name (or another name they go by) fits what was typed, in any word order. Names whose
 * words start with the text come first, then names containing it, then the two loose spellings;
 * within each group the index order (best-known first) is kept.
 */
export function searchItems(index, query, limit = 8) {
  const tokens = String(query).split(/[\s־-]+/).map(normalizeHebrew).filter(Boolean);
  if (!tokens.length) return [];
  const swapped = tokens.map(swapLetters);
  const bare = tokens.map(dropVowels);
  const bareUsable = bare.every((t) => t.length >= MIN_CONSONANTS);
  const starts = (words, wanted) => wanted.every((t) => words.some((w) => w.startsWith(t)));
  const rank = (name) => {
    if (tokens.every((t) => name.key.includes(t))) return starts(name.words, tokens) ? 0 : 1;
    if (starts(name.swapped, swapped)) return 2;
    if (bareUsable && starts(name.bare, bare)) return 3;
    return 4;
  };
  const groups = [[], [], [], []];
  for (const entry of index) {
    const best = Math.min(...entry.names.map(rank));
    if (best < 4) groups[best].push(entry.item);
  }
  return groups.flat().slice(0, limit);
}

// ---------- points for the group boards (0–100, higher is better; see games/README.md) ----------

/** The share of the nine cells filled: 100 for a full grid, about 11 a cell. The topic must be loaded. */
export const points = (grid, guesses) => Math.round((solvedCount(grid, guesses) * 100) / CELLS);

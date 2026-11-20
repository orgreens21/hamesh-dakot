// Pure rules for בערך: guess the shelf price of five supermarket products a day.
// No DOM here, so tests/beerech.logic.test.mjs can import it in Node.
import { seededShuffle } from '../../shared/core.js';
import { PRODUCTS, SOURCE } from './data.js';

export { PRODUCTS, SOURCE };
export const NAME = 'בערך';
export const ROUND_SIZE = 5;
export const MAX_ITEM = 100;
export const MAX_TOTAL = ROUND_SIZE * MAX_ITEM;
/** Half the points counts as a good day: it is what keeps the streak alive. */
export const WIN_TOTAL = 250;
export const BUCKET_LABELS = ['250+', '300+', '350+', '400+', '450+'];
export const BUCKETS = BUCKET_LABELS.length;
export const MAX_GUESS = 9999;

const SEED = 20261114;

// ---------- daily selection ----------

export const ROUNDS_PER_CYCLE = Math.floor(PRODUCTS.length / ROUND_SIZE);

const cycles = new Map();
/** Every cycle walks the whole list once in its own shuffled order, so a product returns in different company. */
function cycleOrder(cycle) {
  if (!cycles.has(cycle)) cycles.set(cycle, seededShuffle(PRODUCTS, SEED + cycle));
  return cycles.get(cycle);
}

/** The five products of a puzzle day. Works for day 0 and below (before the site's epoch). */
export function roundForDay(day) {
  const index = day - 1;
  const cycle = Math.floor(index / ROUNDS_PER_CYCLE);
  const slot = index - cycle * ROUNDS_PER_CYCLE;
  return cycleOrder(cycle).slice(slot * ROUND_SIZE, (slot + 1) * ROUND_SIZE);
}

/** Five random products for a practice round, avoiding the ids in `exclude` (today's daily products). */
export function practiceRound(random = Math.random, exclude = []) {
  const skip = new Set(exclude);
  const pool = PRODUCTS.filter((p) => !skip.has(p.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, ROUND_SIZE);
}

// ---------- guesses ----------

/**
 * Turns what was typed into shekels, or null when it is not a usable price.
 * A comma is accepted as the decimal mark because many phone keypads offer only that.
 */
export function parseGuess(text) {
  const clean = String(text ?? '').replace(/[\s₪‎‏]/g, '').replace(',', '.');
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(clean)) return null;
  const value = Number(clean);
  return value > 0 && value <= MAX_GUESS ? value : null;
}

/** Why a typed value was refused, in the player's words. */
export function guessProblem(text) {
  const clean = String(text ?? '').replace(/[\s₪‎‏]/g, '');
  if (!clean) return 'הקלידו מחיר בשקלים';
  if (parseGuess(text) != null) return '';
  const value = Number(clean.replace(',', '.'));
  if (Number.isFinite(value) && value > MAX_GUESS) return `עד ${MAX_GUESS.toLocaleString('en-US')} ש״ח, בבקשה`;
  if (Number.isFinite(value) && value <= 0) return 'המחיר צריך להיות גדול מאפס';
  if (/^\d+[.,]\d{3,}$/.test(clean)) return 'עד שתי ספרות אחרי הנקודה';
  return 'רק מספר, למשל 12.90';
}

/** Whatever was in storage, reduced to at most five usable guesses. */
export function sanitizeGuesses(saved) {
  if (!Array.isArray(saved)) return [];
  const out = [];
  for (const g of saved) {
    if (typeof g !== 'number' || !Number.isFinite(g) || g <= 0 || g > MAX_GUESS) break;
    out.push(g);
    if (out.length === ROUND_SIZE) break;
  }
  return out;
}

// ---------- scoring ----------

/** How far the guess is from the price, as a fraction of the price (0.1 = ten percent off, either way). */
export const errorOf = (guess, price) => Math.abs(guess - price) / price;

/** 100 for the exact price, two points less for every percent off, nothing from 50% off. */
export function scoreFor(guess, price) {
  return Math.max(0, Math.round(MAX_ITEM - 200 * errorOf(guess, price)));
}

/** Signed whole percent: +12 means the guess was 12% above the price. */
export const percentOff = (guess, price) => Math.round(((guess - price) / price) * 100);

/** 'bull' | 'near' | 'mid' | 'far': the colour of an item's square. */
export function grade(score) {
  if (score >= 90) return 'bull';
  if (score >= 70) return 'near';
  if (score >= 40) return 'mid';
  return 'far';
}

export const GRADE_WORD = { bull: 'בול!', near: 'קרוב מאוד', mid: 'בערך…', far: 'רחוק' };

export function diffLabel(guess, price) {
  if (guess === price) return 'בדיוק המחיר';
  const pct = percentOff(guess, price);
  if (pct === 0) return 'פחות מאחוז מהמחיר';
  // "126470% above" is noise; past ten times the price the multiple says it better.
  if (pct >= 900) return `פי ${Math.round(guess / price)} מהמחיר`;
  return pct > 0 ? `${pct}% מעל המחיר` : `${-pct}% מתחת למחיר`;
}

export const scores = (guesses, round) => guesses.map((g, i) => scoreFor(g, round[i].price));
export const total = (guesses, round) => scores(guesses, round).reduce((a, b) => a + b, 0);
export const isOver = (guesses) => guesses.length >= ROUND_SIZE;
export const isWon = (guesses, round) => isOver(guesses) && total(guesses, round) >= WIN_TOTAL;

/** The bar of the stats chart a winning total lands in. */
export const bucketIndex = (points) => Math.min(BUCKETS - 1, Math.max(0, Math.floor((points - WIN_TOTAL) / 50)));

/** What the hub shows next to a finished game. */
export const summary = (guesses, round) => `${total(guesses, round)}/${MAX_TOTAL}`;

export function endTitle(points) {
  if (points >= 450) return 'קופה רושמת בראש';
  if (points >= 350) return 'אתם מכירים את המדף';
  if (points >= WIN_TOTAL) return 'בערך, בערך';
  return 'טוב שיש קופה';
}

// ---------- formatting ----------

/** Shelf prices always show agorot; a typed guess shows them only if it has any. */
export const formatPrice = (n) => n.toFixed(2);
export const formatGuess = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const SQUARE = { bull: '🟩', near: '🟨', mid: '🟧', far: '🟥' };

/** Name, day number, total, one square per product, link. Squares show accuracy only: no product and no price. */
export function shareText({ day, guesses, round, url }) {
  const squares = scores(guesses, round).map((s) => SQUARE[grade(s)]).join('');
  return [`${NAME} #${day} · ${summary(guesses, round)}`, squares, url].join('\n');
}

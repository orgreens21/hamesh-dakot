// Pure rules for the template game: guess today's number (1–10) in three tries.
// No DOM here, so tests/_template.logic.test.mjs can import it in Node.
import { seededShuffle, pickDaily } from '../../shared/core.js';

export const NAME = 'מספר היום';
export const MAX_TRIES = 3;
export const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Shuffled once with a fixed seed: the same order for every player, and not simply 1, 2, 3…
const POOL = seededShuffle(NUMBERS, 20261114);

export function secretForDay(day) {
  return pickDaily(POOL, day);
}

/** 'right', or which way the secret lies from the guess. */
export function evaluate(guess, secret) {
  if (guess === secret) return 'right';
  return secret > guess ? 'higher' : 'lower';
}

export const isWon = (guesses, secret) => guesses.includes(secret);
export const isOver = (guesses, secret) => isWon(guesses, secret) || guesses.length >= MAX_TRIES;

/** What the hub shows next to a finished game. */
export function summary(guesses, secret) {
  return `${isWon(guesses, secret) ? guesses.length : 'X'}/${MAX_TRIES}`;
}

const EMOJI = { right: '🟩', higher: '⬆️', lower: '⬇️' };

/** Name, day number, score, one emoji per try, link. The arrows give nothing away without the guesses. */
export function shareText({ day, guesses, secret, url }) {
  const marks = guesses.map((g) => EMOJI[evaluate(g, secret)]).join('');
  return [`${NAME} #${day} ${summary(guesses, secret)}`, marks, url].join('\n');
}

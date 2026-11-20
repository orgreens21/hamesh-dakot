import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games/beerech/game.js';
import { ART } from '../games/beerech/art.js';

const round = [10, 20, 40, 5.9, 100].map((price, i) => ({ id: String(i), name: 'מוצר סודי ' + i, size: '1', cat: 'pantry', price }));

test('data: real source recorded, every product complete, no duplicates', () => {
  assert.equal(G.SOURCE.chain, 'שופרסל');
  assert.match(G.SOURCE.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(G.SOURCE.store && G.SOURCE.file.startsWith('PriceFull') && G.SOURCE.portal.startsWith('https://'));
  assert.ok(G.PRODUCTS.length >= 150 && G.PRODUCTS.length <= 250, `150–250 products, got ${G.PRODUCTS.length}`);
  assert.equal(new Set(G.PRODUCTS.map((p) => p.id)).size, G.PRODUCTS.length, 'barcodes are unique');
  assert.equal(new Set(G.PRODUCTS.map((p) => p.name + '|' + p.size)).size, G.PRODUCTS.length, 'no two products look the same');
  for (const p of G.PRODUCTS) {
    assert.match(p.id, /^\d{8,13}$/, p.name);
    assert.ok(p.name.length >= 2 && p.name.length <= 40 && /[א-ת]/.test(p.name), p.name);
    assert.ok(p.size.length > 0, p.name);
    assert.ok(ART[p.cat], `drawing for category ${p.cat}`);
    assert.ok(Number.isFinite(p.price) && p.price >= 1 && p.price <= 500, `${p.name}: ${p.price}`);
    assert.equal(Math.round(p.price * 100) / 100, p.price, 'whole agorot');
  }
});

test('the daily round is deterministic, five distinct products, and nothing repeats within a cycle', () => {
  assert.deepEqual(G.roundForDay(7), G.roundForDay(7));
  const seen = new Set();
  for (let day = 1; day <= G.ROUNDS_PER_CYCLE; day++) {
    const r = G.roundForDay(day);
    assert.equal(r.length, G.ROUND_SIZE);
    for (const p of r) { assert.ok(!seen.has(p.id), `repeat on day ${day}`); seen.add(p.id); }
  }
  assert.ok(G.ROUNDS_PER_CYCLE >= 30);
  // The next cycle is shuffled differently, and days before the epoch still get a full round.
  assert.notDeepEqual(G.roundForDay(G.ROUNDS_PER_CYCLE + 1), G.roundForDay(1));
  for (const day of [0, -1, -40, -500]) {
    const r = G.roundForDay(day);
    assert.equal(new Set(r.map((p) => p.id)).size, G.ROUND_SIZE, `day ${day}`);
  }
  assert.notDeepEqual(G.roundForDay(0), G.roundForDay(1));
});

test('practice rounds avoid the excluded products', () => {
  const exclude = G.roundForDay(1).map((p) => p.id);
  for (let i = 0; i < 20; i++) {
    const r = G.practiceRound(Math.random, exclude);
    assert.equal(new Set(r.map((p) => p.id)).size, G.ROUND_SIZE);
    assert.ok(r.every((p) => !exclude.includes(p.id)));
  }
});

test('parsing a typed price', () => {
  assert.equal(G.parseGuess('12'), 12);
  assert.equal(G.parseGuess(' 12.9 '), 12.9);
  assert.equal(G.parseGuess('12,90'), 12.9);
  assert.equal(G.parseGuess('₪7.5'), 7.5);
  assert.equal(G.parseGuess('.5'), 0.5);
  assert.equal(G.parseGuess('5.'), 5);
  assert.equal(G.parseGuess('9999'), 9999);
  for (const bad of ['', ' ', 'abc', '0', '0.00', '-5', '1.234', '1.2.3', '10000', '1e3', '12 ש"ח', null, undefined]) {
    assert.equal(G.parseGuess(bad), null, String(bad));
    assert.ok(G.guessProblem(bad).length > 0, String(bad));
  }
  assert.equal(G.guessProblem('12.90'), '');
  assert.deepEqual(G.sanitizeGuesses([3, 4.5, 'x', 7]), [3, 4.5]);
  assert.deepEqual(G.sanitizeGuesses([1, 2, 3, 4, 5, 6]), [1, 2, 3, 4, 5]);
  assert.deepEqual(G.sanitizeGuesses([-1]), []);
  assert.deepEqual(G.sanitizeGuesses('junk'), []);
  assert.deepEqual(G.sanitizeGuesses(null), []);
});

test('scoring: two points per percent, nothing from 50% off', () => {
  assert.equal(G.scoreFor(10, 10), 100);
  assert.equal(G.scoreFor(10.5, 10), 90);
  assert.equal(G.scoreFor(9.5, 10), 90);
  assert.equal(G.scoreFor(12.5, 10), 50);
  assert.equal(G.scoreFor(5, 10), 0);
  assert.equal(G.scoreFor(15, 10), 0);
  assert.equal(G.scoreFor(9999, 10), 0);
  assert.equal(G.scoreFor(6, 5.9), 97);
  assert.equal(G.percentOff(11.2, 10), 12);
  assert.equal(G.percentOff(8, 10), -20);
  assert.deepEqual([100, 90, 89, 70, 69, 40, 39, 0].map(G.grade), ['bull', 'bull', 'near', 'near', 'mid', 'mid', 'far', 'far']);
  assert.equal(G.diffLabel(10, 10), 'בדיוק המחיר');
  assert.equal(G.diffLabel(10.01, 10), 'פחות מאחוז מהמחיר');
  assert.equal(G.diffLabel(11.2, 10), '12% מעל המחיר');
  assert.equal(G.diffLabel(8, 10), '20% מתחת למחיר');
  assert.equal(G.diffLabel(9999, 7.9), 'פי 1266 מהמחיר');
});

test('totals, winning and the stats bucket', () => {
  const guesses = [10, 22, 50, 5.9, 300]; // 100, 80, 50, 100, 0
  assert.deepEqual(G.scores(guesses, round), [100, 80, 50, 100, 0]);
  assert.equal(G.total(guesses, round), 330);
  assert.equal(G.isOver(guesses.slice(0, 4)), false);
  assert.equal(G.isWon(guesses.slice(0, 4), round), false, 'not won before the last product');
  assert.equal(G.isWon(guesses, round), true);
  assert.equal(G.isWon([10, 20, 40, 100, 1], round), true); // 300
  assert.equal(G.isWon([10, 20, 1, 100, 1], round), false); // 200
  assert.equal(G.summary(guesses, round), '330/500');
  assert.deepEqual([250, 299, 300, 449, 450, 500].map(G.bucketIndex), [0, 0, 1, 3, 4, 4]);
  assert.equal(G.BUCKET_LABELS.length, G.BUCKETS);
  assert.notEqual(G.endTitle(500), G.endTitle(100));
  assert.equal(G.formatPrice(5.9), '5.90');
  assert.equal(G.formatGuess(12), '12');
  assert.equal(G.formatGuess(12.5), '12.50');
});

test('share text: exact string, and no product or price in it', () => {
  const guesses = [10, 22, 50, 5.9, 300];
  const text = G.shareText({ day: 7, guesses, round, url: 'https://example.test/games/beerech/' });
  assert.equal(text, 'בערך #7 · 330/500\n🟩🟨🟧🟩🟥\nhttps://example.test/games/beerech/');
  assert.ok(!text.includes('מוצר סודי'));
  assert.ok(!/\d/.test(text.split('\n')[1]));
  assert.ok(G.shareText({ day: 0, guesses: [1, 1, 1, 1, 1], round, url: 'u' }).startsWith('בערך #0 · '));
});

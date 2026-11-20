import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALITIES } from '../games/nekuda/data.js';
import * as G from '../games/nekuda/game.js';
import { LAKES, coastLonAt, pointInPolygon } from '../games/nekuda/mapshapes.js';

const all = LOCALITIES.map(G.toLocality);
const byName = (name) => all.find((l) => l.name === name);
const index = G.buildSearchIndex(all);
const pool = G.buildTargetPool(all);

test('data is sane', () => {
  assert.ok(all.length > 1000);
  assert.equal(new Set(all.map((l) => l.name)).size, all.length, 'names are unique');
  for (const l of all) {
    assert.ok(l.lat > 29.4 && l.lat < 33.4 && l.lon > 34.2 && l.lon < 35.95, l.name);
    assert.ok(l.type >= 0 && l.type <= 5, l.name);
    assert.ok(G.normalize(l.name).length > 0, l.name);
  }
  for (const name of ['ירושלים', 'תל אביב-יפו', 'חיפה', 'באר שבע', 'אילת']) assert.ok(byName(name), name);
});

test('distance and bearing match known geography', () => {
  const tlv = byName('תל אביב-יפו');
  const jlm = byName('ירושלים');
  const eilat = byName('אילת');
  const haifa = byName('חיפה');
  const d = G.distanceKm(tlv, jlm);
  assert.ok(d > 50 && d < 60, `Tel Aviv–Jerusalem ${d}`);
  assert.ok(Math.abs(G.distanceKm(tlv, eilat) - 281) < 10);
  assert.equal(G.directionIndex(G.bearing(tlv, haifa)), 0, 'Haifa is north of Tel Aviv');
  assert.equal(G.directionIndex(G.bearing(tlv, eilat)), 4, 'Eilat is south of Tel Aviv');
  assert.equal(G.directionIndex(G.bearing(tlv, jlm)), 3, 'Jerusalem is south-east of Tel Aviv');
  assert.equal(G.directionIndex(359), 0);
});

test('evaluateGuess', () => {
  const tlv = byName('תל אביב-יפו');
  const win = G.evaluateGuess(tlv, tlv);
  assert.deepEqual([win.win, win.km, win.pct], [true, 0, 100]);
  const miss = G.evaluateGuess(byName('רמת גן'), tlv);
  assert.equal(miss.win, false);
  assert.ok(miss.km >= 1 && miss.pct <= 99 && miss.pct > 85);
  assert.deepEqual([7, 62, 114, 303].map(G.proximity), [88, 63, 50, 18]);
  assert.equal(G.evaluateGuess(byName('אילת'), byName('מטולה')).pct < 15, true);
});

test('daily puzzle is deterministic and does not repeat within a cycle', () => {
  assert.ok(pool.length >= 150);
  assert.ok(pool.every((l) => l.pop >= G.MIN_TARGET_POPULATION));
  const again = G.buildTargetPool(all);
  assert.deepEqual(pool.map((l) => l.name), again.map((l) => l.name));
  const names = new Set();
  for (let d = 1; d <= pool.length; d++) names.add(G.targetForDay(pool, d).name);
  assert.equal(names.size, pool.length);
  assert.equal(G.targetForDay(pool, pool.length + 1).name, G.targetForDay(pool, 1).name);
  assert.ok(G.targetForDay(pool, 0) && G.targetForDay(pool, -5));
});

test('dates follow the Israel calendar', () => {
  assert.equal(G.dayNumber(G.EPOCH), 1);
  assert.equal(G.dayNumber('2026-11-14'), 2);
  assert.equal(G.dayNumber('2027-11-13'), 366);
  // 22:30 UTC is already the next day in Israel (UTC+2 in winter).
  assert.equal(G.israelDate(new Date('2026-11-13T22:30:00Z')), '2026-11-14');
  assert.equal(G.israelDate(new Date('2026-11-13T21:30:00Z')), '2026-11-13');
  assert.equal(G.msUntilNextPuzzle(new Date('2026-11-13T21:30:00Z')), 30 * 60 * 1000);
  // Summer time (UTC+3)
  assert.equal(G.israelDate(new Date('2027-07-01T21:30:00Z')), '2027-07-02');
});

test('search is forgiving about punctuation and final letters', () => {
  const names = (q) => G.searchLocalities(index, q).map((l) => l.name);
  assert.equal(names('תל אב')[0], 'תל אביב-יפו');
  assert.equal(names('תלאביב')[0], 'תל אביב-יפו');
  assert.ok(names('יפו').includes('תל אביב-יפו'), 'matches inside the name');
  assert.ok(names('מודיעין מכבים').includes('מודיעין-מכבים-רעות'));
  assert.equal(names('ירושלי')[0], 'ירושלים', 'non-final mem matches final mem');
  assert.deepEqual(names(''), []);
  assert.deepEqual(names('   '), []);
  assert.deepEqual(names('זזזזזזז'), []);
  assert.ok(names('כ').length <= 8);
});

test('hints unlock progressively', () => {
  const t = byName('חיפה');
  assert.deepEqual(G.hintsFor(t, 0).map((h) => h.value), [null, null, null]);
  assert.deepEqual(G.hintsFor(t, 2).map((h) => h.value), ['עיר', null, null]);
  assert.deepEqual(G.hintsFor(t, 4).map((h) => h.value), ['עיר', 'מעל 200 אלף', 'ח']);
  assert.ok(G.hintsFor(t, 0, true).every((h) => h.value));
});

test('share text', () => {
  const text = G.shareText({
    title: 'נקודת ציון', day: 7, url: 'https://example.test/',
    results: [{ pct: 38, dir: 1, win: false }, { pct: 100, dir: 0, win: true }],
  });
  assert.equal(text, 'נקודת ציון #7 🧭 2/6\n🟧🟧⬜⬜⬜ ↗️\n🟩🟩🟩🟩🟩 🎯\nhttps://example.test/');
  const lost = G.shareText({ title: 'x', day: 1, url: 'u', results: Array(6).fill({ pct: 0, dir: 4, win: false }) });
  assert.ok(lost.startsWith('x #1 🧭 X/6\n⬜⬜⬜⬜⬜ ⬇️'));
});

test('stats and streaks', () => {
  let s = G.emptyStats();
  s = G.recordResult(s, 10, true, 3);
  assert.deepEqual([s.played, s.wins, s.streak, s.distribution[2]], [1, 1, 1, 1]);
  assert.equal(G.recordResult(s, 10, true, 3), s, 'same day is not counted twice');
  s = G.recordResult(s, 11, true, 1);
  assert.deepEqual([s.streak, s.maxStreak], [2, 2]);
  assert.equal(G.currentStreak(s, 12), 2, 'still alive the next day');
  assert.equal(G.currentStreak(s, 13), 0, 'dead after a skipped day');
  s = G.recordResult(s, 13, true, 6);
  assert.deepEqual([s.streak, s.maxStreak], [1, 2]);
  s = G.recordResult(s, 14, false, 6);
  assert.deepEqual([s.played, s.wins, s.streak, s.maxStreak], [4, 3, 0, 2]);
});

test('no locality is drawn in the water', () => {
  for (const l of all) {
    const coast = coastLonAt(l.lat);
    assert.ok(coast === null || l.lon > coast, `${l.name} is west of the coastline`);
    assert.ok(!LAKES.some((lake) => pointInPolygon(l.lat, l.lon, lake)), `${l.name} is inside a lake`);
  }
});

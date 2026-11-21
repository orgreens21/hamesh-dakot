import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as C from '../shared/core.js';
import { GAMES, gameBySlug } from '../shared/registry.js';

const css = readFileSync(new URL('../shared/base.css', import.meta.url), 'utf8');

test('dates follow the Israel calendar', () => {
  assert.equal(C.dayNumber(C.DEFAULT_EPOCH), 1);
  assert.equal(C.dayNumber('2026-11-13'), 0, 'the day before the epoch is day 0');
  assert.equal(C.dayNumber('2026-11-14', '2026-11-13'), 2, 'a game can count from its own epoch');
  assert.equal(C.dayNumber('2027-11-14'), 366);
  // 22:30 UTC is already the next day in Israel (UTC+2 in winter, UTC+3 in summer).
  assert.equal(C.israelDate(new Date('2026-11-13T22:30:00Z')), '2026-11-14');
  assert.equal(C.israelDate(new Date('2026-11-13T21:30:00Z')), '2026-11-13');
  assert.equal(C.israelDate(new Date('2027-07-01T21:30:00Z')), '2027-07-02');
  assert.equal(C.msUntilNextPuzzle(new Date('2026-11-13T21:30:00Z')), 30 * 60 * 1000);
  assert.equal(C.formatCountdown(3723000), '01:02:03');
  assert.equal(C.formatCountdown(-5), '00:00:00');
  for (const day of [-2, 0, 1, 200]) assert.equal(C.dayNumber(C.israelDate(C.dateOfDay(day))), day);
  assert.equal(C.hebrewDate(C.dateOfDay(1)), '14 בנובמבר');
});

test('seeded shuffle and daily pick', () => {
  const items = Array.from({ length: 40 }, (_, i) => i);
  const a = C.seededShuffle(items, 7);
  assert.deepEqual(a, C.seededShuffle(items, 7), 'same seed, same order');
  assert.notDeepEqual(a, C.seededShuffle(items, 8));
  assert.deepEqual(items, Array.from({ length: 40 }, (_, i) => i), 'input is not mutated');
  assert.deepEqual([...a].sort((x, y) => x - y), items);
  const seen = new Set(items.map((_, i) => C.pickDaily(a, i + 1)));
  assert.equal(seen.size, items.length, 'no repeats within a cycle');
  assert.equal(C.pickDaily(a, 41), C.pickDaily(a, 1));
  assert.equal(C.pickDaily(a, 0), a[39]);
  assert.equal(C.pickDaily(a, -39), a[0]);
  const r = C.mulberry32(1);
  const values = [r(), r(), r()];
  assert.ok(values.every((v) => v >= 0 && v < 1) && new Set(values).size === 3);
});

test('normalizeHebrew', () => {
  assert.equal(C.normalizeHebrew('תֵּל אָבִיב-יָפוֹ'), 'תלאביביפו');
  assert.equal(C.normalizeHebrew('ירושלים'), C.normalizeHebrew('ירושלימ'));
  assert.equal(C.normalizeHebrew('  ק״מ 12! '), 'קמ12');
});

test('stats and streaks, including day numbers at or below zero', () => {
  let s = C.emptyStats(4);
  assert.equal(s.distribution.length, 4);
  s = C.recordResult(s, 0, true, 1);
  assert.deepEqual([s.played, s.wins, s.streak, s.distribution], [1, 1, 1, [0, 1, 0, 0]], 'day 0 counts');
  assert.equal(C.recordResult(s, 0, true, 1), s, 'same day is not counted twice');
  s = C.recordResult(s, 1, true, 0);
  assert.deepEqual([s.streak, s.maxStreak], [2, 2]);
  assert.equal(C.currentStreak(s, 2), 2, 'still alive the next day');
  assert.equal(C.currentStreak(s, 3), 0, 'dead after a skipped day');
  s = C.recordResult(s, 3, false);
  assert.deepEqual([s.played, s.wins, s.streak, s.maxStreak], [3, 2, 0, 2]);
  assert.equal(C.winRate(s), 67);
  assert.equal(C.currentStreak(C.emptyStats(), 0), 0);
  assert.equal(C.currentStreak(undefined, 5), 0);
  assert.equal(C.recordResult(C.emptyStats(3), 5, true, 9).distribution.join(), '0,0,0', 'an out-of-range bucket is ignored');
});

test('dailyState keeps stats across days and drops yesterday\'s progress', () => {
  const stats = { ...C.emptyStats(3), played: 4 };
  const saved = { day: 9, finished: true, won: true, summary: '2/3', progress: { guesses: [1] }, stats, seenHelp: true };
  assert.deepEqual(C.dailyState(saved, 9, 3), { day: 9, finished: true, won: true, summary: '2/3', progress: { guesses: [1] }, stats, seenHelp: true });
  assert.deepEqual(C.dailyState(saved, 10, 3), { day: 10, finished: false, won: false, summary: '', progress: null, stats, seenHelp: true });
  for (const junk of [null, undefined, 'x', 5, {}, { stats: 'bad' }]) {
    assert.deepEqual(C.dailyState(junk, 1, 3), { day: 1, finished: false, won: false, summary: '', progress: null, stats: C.emptyStats(3), seenHelp: false });
  }
  assert.equal(C.dailyState({ stats: { distribution: [1, 2] } }, 1, 5).stats.distribution.length, 5, 'a wrong-sized chart is reset');
});

test('dailyStatus is what the hub shows', () => {
  assert.equal(C.dailyStatus({}, 3), 'new');
  assert.equal(C.dailyStatus(null, 3), 'new');
  assert.equal(C.dailyStatus({ day: 3, progress: null }, 3), 'new');
  assert.equal(C.dailyStatus({ day: 3, progress: {} }, 3), 'new');
  assert.equal(C.dailyStatus({ day: 3, progress: { guesses: [1] } }, 3), 'playing');
  assert.equal(C.dailyStatus({ day: 3, progress: [1] }, 3), 'playing');
  assert.equal(C.dailyStatus({ day: 3, finished: true, won: true }, 3), 'won');
  assert.equal(C.dailyStatus({ day: 3, finished: true, won: false }, 3), 'lost');
  assert.equal(C.dailyStatus({ day: 2, finished: true, won: true }, 3), 'new');
});

// ---------- registry ----------

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('registry is complete and consistent', () => {
  assert.deepEqual(GAMES.map((g) => g.slug), ['nekuda', 'beerech', 'miani', 'tzir', 'herkev', 'yoter', 'blimilim']);
  assert.deepEqual(GAMES.map((g) => g.port), [4179, 4181, 4182, 4184, 4185, 4186, 4183]);
  assert.ok(GAMES.every((g) => g.kind === 'daily'), 'every game is a solo daily puzzle');
  assert.equal(new Set(GAMES.map((g) => g.port)).size, GAMES.length);
  for (const g of GAMES) {
    assert.ok(g.name && g.tagline && g.mark.startsWith('<'), g.slug);
    assert.match(g.epoch, /^\d{4}-\d\d-\d\d$/);
    assert.equal(g.epoch, g.slug === 'nekuda' ? '2026-11-13' : C.DEFAULT_EPOCH);
  }
  assert.equal(gameBySlug('tzir').name, 'על הציר');
  assert.equal(gameBySlug('nope'), null);
});

test('accents match base.css and are readable on paper in both themes', () => {
  const [lightCss, darkCss] = css.split('/* ---------- reset')[0].split(/@media \(prefers-color-scheme: dark\) \{\s*\[data-game/);
  const token = (block, name) => new RegExp(`--${name}: (#[0-9a-f]{6})`).exec(block)[1];
  const light = { paper: token(css, 'paper'), sheet: token(css, 'sheet'), on: '#ffffff' };
  const darkRoot = css.split('@media (prefers-color-scheme: dark)')[1];
  const dark = { paper: token(darkRoot, 'paper'), sheet: token(darkRoot, 'sheet'), on: token(darkRoot, 'on-color') };
  for (const g of GAMES) {
    const rule = `[data-game="${g.slug}"] { --accent: `;
    assert.ok(lightCss.includes(rule + g.accent), `${g.slug} light accent in base.css`);
    assert.ok(('[data-game' + darkCss).includes(rule + g.accentDark), `${g.slug} dark accent in base.css`);
    for (const [theme, accent, t] of [['light', g.accent, light], ['dark', g.accentDark, dark]]) {
      for (const against of ['paper', 'sheet', 'on']) {
        const ratio = contrast(accent, t[against]);
        assert.ok(ratio >= 4.5, `${g.slug} ${theme} accent ${accent} vs ${against}: ${ratio.toFixed(2)}`);
      }
    }
  }
});

test('text printed on a signal colour is readable: --on-color holds 4.5:1 on every one, in both themes', () => {
  // --mid and --near used to be #b3780c and #d4551a: 3.7:1 and 4.1:1 under white (the numbers on the map pins).
  const token = (block, name) => new RegExp(`--${name}: (#[0-9a-f]{6})`).exec(block)[1];
  const [lightRoot, darkRoot] = css.split('@media (prefers-color-scheme: dark)');
  for (const [theme, block] of [['light', lightRoot], ['dark', darkRoot]]) {
    for (const name of ['far', 'mid', 'near', 'close', 'found']) {
      const ratio = contrast(token(block, name), token(block, 'on-color'));
      assert.ok(ratio >= 4.5, `${theme} --${name} under --on-color: ${ratio.toFixed(2)}`);
    }
    for (const name of ['ink', 'ink-soft']) for (const paper of ['paper', 'sheet', 'desk']) {
      const ratio = contrast(token(block, name), token(block, paper));
      assert.ok(ratio >= 4.5, `${theme} --${name} on --${paper}: ${ratio.toFixed(2)}`);
    }
  }
});

test('every game has a three-layer emblem', async () => {
  const { EMBLEMS } = await import('../shared/emblems.js');
  assert.deepEqual(Object.keys(EMBLEMS).sort(), GAMES.map((g) => g.slug).sort());
  for (const [slug, layers] of Object.entries(EMBLEMS)) {
    assert.equal(layers.length, 3, slug);
    for (const layer of layers) assert.ok(layer.startsWith('<') && !/#[0-9a-f]{3,6}\b/i.test(layer), `${slug}: colours come from the .em-* classes`);
  }
});

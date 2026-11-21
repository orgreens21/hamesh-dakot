// Checks on the site as one product: things no single game owns.
// Usage: node --test tests/site.logic.test.mjs   (part of npm test)
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../shared/core.js';
import { GAMES, SITE } from '../shared/registry.js';
import * as nekuda from '../games/nekuda/game.js';
import { LOCALITIES } from '../games/nekuda/data.js';
import * as beerech from '../games/beerech/game.js';
import * as miani from '../games/miani/game.js';
import * as blimilim from '../games/blimilim/game.js';
import * as tzir from '../games/tzir/game.js';
import * as herkev from '../games/herkev/game.js';
import * as yoter from '../games/yoter/game.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const PAGES = ['index.html', ...GAMES.map((g) => `games/${g.slug}/index.html`), 'games/_template/index.html', 'brand/index.html', 'groups/index.html'];

// ---------- the clock ----------

test('the countdown reaches zero exactly at Israel midnight, on the clock-change days too', () => {
  // Israel moves to summer time on the Friday before the last Sunday of March and back on the last
  // Sunday of October, at 02:00. Those days are 23 and 25 hours long.
  assert.equal(C.msUntilNextPuzzle(new Date('2027-03-25T22:30:00Z')), 22.5 * 3600e3, '00:30 on the short day');
  assert.equal(C.msUntilNextPuzzle(new Date('2027-10-30T21:30:00Z')), 24.5 * 3600e3, '00:30 on the long day');
  assert.equal(C.msUntilNextPuzzle(new Date('2027-03-26T12:00:00Z')), 9 * 3600e3, 'after the change the offset is the new one');
  assert.equal(C.msUntilNextPuzzle(new Date('2026-11-14T10:00:00.250Z')), 12 * 3600e3 - 250, 'milliseconds count');
  // Sampled through a whole year, and every few minutes through both clock-change weekends: the date
  // flips at the promised instant and not a millisecond before.
  const samples = [];
  for (let t = Date.UTC(2026, 10, 13); t < Date.UTC(2027, 11, 1); t += 211 * 60e3 + 1234) samples.push(t);
  for (const [from, to] of [[Date.UTC(2027, 2, 25, 12), Date.UTC(2027, 2, 27, 12)], [Date.UTC(2027, 9, 30, 12), Date.UTC(2027, 10, 1, 12)]]) {
    for (let t = from; t < to; t += 7 * 60e3 + 321) samples.push(t);
  }
  for (const t of samples) {
    const now = new Date(t);
    const ms = C.msUntilNextPuzzle(now);
    assert.ok(ms > 0 && ms <= 25 * 3600e3, now.toISOString());
    assert.notEqual(C.israelDate(new Date(t + ms)), C.israelDate(now), `${now.toISOString()}: a new day starts when the countdown ends`);
    assert.equal(C.israelDate(new Date(t + ms - 1)), C.israelDate(now), `${now.toISOString()}: and not before`);
  }
});

test('the hub and every game agree on the day number, around midnight and across the clock changes', () => {
  assert.equal(nekuda.EPOCH, GAMES.find((g) => g.slug === 'nekuda').epoch, 'the registry (which the hub reads) and the game count from the same day');
  for (const g of GAMES) if (g.slug !== 'nekuda') assert.equal(g.epoch, C.DEFAULT_EPOCH, g.slug);
  const instants = ['2026-11-14T21:59:59Z', '2026-11-14T22:00:00Z', '2027-03-25T21:59:59Z', '2027-03-25T22:00:00Z', '2027-03-26T20:59:59Z', '2027-03-26T21:00:00Z', '2027-10-30T20:59:59Z', '2027-10-30T21:00:00Z', '2027-10-31T21:59:59Z', '2027-10-31T22:00:00Z'];
  const days = instants.map((iso) => C.dayNumber(C.israelDate(new Date(iso))));
  // Each pair straddles a midnight: the day moves on by exactly one, summer or winter.
  for (let i = 0; i < days.length; i += 2) assert.equal(days[i + 1], days[i] + 1, instants[i]);
  for (const iso of instants) {
    const date = C.israelDate(new Date(iso));
    assert.equal(nekuda.dayNumber(date), C.dayNumber(date) + 1, 'nekuda started a day earlier and stays one ahead');
    assert.equal(C.israelDate(C.dateOfDay(C.dayNumber(date))), date, 'the date printed for a puzzle is the date it is played on');
  }
});

// ---------- share texts ----------

/** True when `secret` appears in `text` whole, word for word (letters inside a longer word do not count). */
const says = (text, secret) => {
  const spaced = (s) => ` ${String(s).split(/[^א-ת0-9_]+/).filter(Boolean).join(' ')} `;
  return spaced(secret).trim() !== '' && spaced(text).includes(spaced(secret));
};

test('every share text has the game name, the day number and the link, and never the answer', async () => {
  const day = 37;
  const url = 'https://example.test/sub/games/x/';
  const name = (slug) => GAMES.find((g) => g.slug === slug).name;
  const check = (slug, text, secrets) => {
    const lines = text.split('\n');
    assert.ok(lines[0].startsWith(name(slug)), `${slug}: starts with the game's name: ${lines[0]}`);
    assert.ok(lines[0].includes(`#${day}`), `${slug}: has the day number`);
    assert.equal(lines.at(-1), url, `${slug}: the link is the last line`);
    const body = lines.slice(1, -1).join('\n');
    for (const secret of secrets) assert.ok(!says(body, secret), `${slug}: the share text gives away "${secret}"`);
  };

  const localities = LOCALITIES.map(nekuda.toLocality);
  const pool = nekuda.buildTargetPool(localities);
  const target = nekuda.targetForDay(pool, day);
  const misses = localities.filter((l) => l.name !== target.name).slice(0, 6).map((l) => nekuda.evaluateGuess(l, target));
  for (const results of [[...misses.slice(0, 2), nekuda.evaluateGuess(target, target)], misses]) {
    check('nekuda', nekuda.shareText({ title: name('nekuda'), day, results, url }), [target.name, ...results.map((r) => r.name), ...results.map((r) => `${r.km}`)]);
  }

  const round = beerech.roundForDay(day);
  for (const factor of [1, 1.3, 4]) {
    const guesses = round.map((p) => Math.round(p.price * factor * 100) / 100);
    check('beerech', beerech.shareText({ day, guesses, round, url }), round.flatMap((p) => [p.name, beerech.formatPrice(p.price)]));
  }

  for (const [slug, G] of [['miani', miani], ['blimilim', blimilim]]) {
    const puzzle = G.puzzleForDay(day);
    const wrong = G.ENTRIES.filter((e) => e.name !== puzzle.answer).slice(0, 5).map((e) => e.name);
    const secrets = [puzzle.answer, ...wrong, ...(puzzle.clues || []), ...(puzzle.emoji || []), puzzle.hint].filter(Boolean);
    for (const moves of [[puzzle.answer], [wrong[0], null, puzzle.answer], [null, ...wrong.slice(0, 4)]]) {
      check(slug, G.shareText({ day, puzzle, moves, url }), secrets);
    }
  }

  const timeline = tzir.puzzleForDay(day);
  const events = [timeline.anchor, ...timeline.queue];
  for (const results of [[true, true, true, true, true, true], [true, false, false, false]]) {
    check('tzir', tzir.shareText({ day, results, url }), events.flatMap((e) => [e.text, e.year]));
  }

  const grid = herkev.gridForDay(day);
  await herkev.loadTopic(grid.topic);
  const solution = herkev.solve(grid);
  for (const cells of [9, 3]) {
    const guesses = solution.slice(0, cells).map((p, cell) => [cell, p.id]);
    check('herkev', herkev.shareText({ day, grid, guesses, url }), [...solution.map((p) => p.name), ...[...grid.rows, ...grid.cols].map((id) => herkev.criterion(id).name)]);
  }

  const chain = yoter.chainForDay(day);
  const right = chain.items.slice(1).map((item, i) => (item.value > chain.items[i].value ? 'more' : 'less'));
  for (const answers of [right, right.map((a, i) => (i % 2 ? a : a === 'more' ? 'less' : 'more'))]) {
    check('yoter', yoter.shareText({ day, items: chain.items, answers, url }), chain.items.flatMap((item) => [item.name, yoter.formatValue(chain.theme, item.value)]));
  }

});

// ---------- files: everything is relative and everything exists ----------

const walk = (dir) => readdirSync(join(ROOT, dir)).flatMap((entry) => {
  const path = join(dir, entry);
  if (statSync(join(ROOT, path)).isDirectory()) return walk(path);
  return [path];
});
const SOURCES = ['index.html', 'manifest.webmanifest', ...walk('shared'), ...walk('games'), ...walk('brand'), ...walk('groups')].filter((p) => /\.(html|css|js|webmanifest)$/.test(p));
// %23 is an escaped #: a filter reference inside an inline SVG image, not a file.
const isLocal = (ref) => !/^(https?:|data:|mailto:|tel:|#|%23|\?|javascript:)/.test(ref) && !ref.includes('${');

function references(path, text) {
  const refs = [];
  if (path.endsWith('.html')) for (const m of text.matchAll(/\s(?:href|src)="([^"]*)"/g)) refs.push(m[1]);
  if (path.endsWith('.css') || path.endsWith('.html')) for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) refs.push(m[1]);
  if (path.endsWith('.js')) {
    // Usage examples in comments are written from a game's point of view; only real code counts.
    const code = text.split('\n').filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line)).join('\n');
    for (const m of code.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) refs.push(m[1]);
  }
  if (path.endsWith('.webmanifest')) refs.push(...JSON.parse(text).icons.map((i) => i.src), JSON.parse(text).start_url);
  return refs.filter(isLocal);
}

test('every path is relative and points at a file that exists, so the site works from any folder', () => {
  let checked = 0;
  for (const path of SOURCES) {
    const text = read(path);
    for (const ref of references(path, text)) {
      assert.ok(!ref.startsWith('/'), `${path}: "${ref}" starts at the server root; the site may live in a sub-folder`);
      const clean = ref.split(/[?#]/)[0];
      const target = join(ROOT, dirname(path), clean);
      const file = clean === '' || clean === '.' || clean.endsWith('/') ? join(target, 'index.html') : target;
      assert.ok(file.startsWith(ROOT), `${path}: "${ref}" leaves the site`);
      assert.ok(existsSync(file), `${path}: "${ref}" does not exist (${relative(ROOT, file)})`);
      checked++;
    }
    // Addresses built in script: never from the server root either.
    if (path.endsWith('.js')) assert.ok(!/(?:href|src)\s*=\s*['"`]\/(?!\/)/.test(text) && !/location\.(?:assign|replace)\(\s*['"`]\//.test(text), `${path}: an address is built from the server root`);
  }
  assert.ok(checked > 120, `only ${checked} references were found; the scan is broken`);
});

test('every page is Hebrew, right-to-left, and carries its own title, description and preview tags', () => {
  const titles = new Set();
  for (const path of PAGES) {
    const html = read(path);
    assert.match(html, /<html lang="he" dir="rtl"/, path);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/, path);
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
    assert.ok(title && title.length > 5, `${path}: title`);
    if (path.includes('_template') || path.startsWith('brand')) continue;
    assert.ok(!titles.has(title), `${path}: the title "${title}" is used by another page`);
    titles.add(title);
    for (const tag of ['name="description"', 'property="og:title"', 'property="og:description"', 'property="og:image"', 'property="og:locale" content="he_IL"', 'name="twitter:card"', 'rel="manifest"', 'rel="apple-touch-icon"', 'rel="icon"']) {
      assert.ok(html.includes(tag), `${path}: missing ${tag}`);
    }
    assert.equal((html.match(/<meta name="theme-color"/g) || []).length, 2, `${path}: one theme colour per colour scheme`);
    const game = GAMES.find((g) => path === `games/${g.slug}/index.html`);
    if (game) {
      assert.ok(title.includes(game.name), `${path}: the title names the game`);
      assert.ok(html.includes(`data-game="${game.slug}"`), `${path}: data-game switches the accent on before any script runs`);
      assert.ok(/<a href="\.\.\/\.\.\/">[^<]*חמש דקות/.test(html), `${path}: the footer links back to the hub`);
    } else {
      assert.ok(title.includes(SITE.name), path);
    }
  }
});

test('the manifest, the icons and robots.txt describe the hub', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.short_name, SITE.name);
  assert.deepEqual([manifest.lang, manifest.dir, manifest.start_url, manifest.scope, manifest.display], ['he', 'rtl', './', './', 'standalone']);
  const hub = read('index.html');
  // The installed app opens on the map hub: the status bar matches its sand top bar
  // and the splash screen its sea, so the app opens without a flash of another colour.
  const bar = /<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: light\)">/.exec(hub)[1];
  assert.equal(manifest.theme_color, bar);
  const sea = /--sea: (#[0-9a-f]{6})/.exec(read('shared/hub.css'))[1];
  assert.equal(manifest.background_color, sea);
  const size = (path) => { const png = readFileSync(join(ROOT, path)); return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`; };
  for (const icon of manifest.icons.filter((i) => i.type === 'image/png')) assert.equal(size(icon.src), icon.sizes, icon.src);
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose.includes('maskable')), 'Android needs a maskable 512px icon');
  assert.equal(size('assets/icon-180.png'), '180x180', 'apple-touch-icon');
  assert.equal(size('assets/og.png'), '1200x630', 'social preview');
});

test('link previews (WhatsApp, Facebook) get an absolute image address and a page address', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const page of ['index.html', ...['nekuda', 'beerech', 'miani', 'tzir', 'herkev', 'yoter', 'blimilim'].map((s) => `games/${s}/index.html`)]) {
    const html = await readFile(new URL('../' + page, import.meta.url), 'utf8');
    assert.match(html, /property="og:image" content="https:\/\/[^"]+\/assets\/og\.png"/, page);
    assert.match(html, /property="og:url" content="https:\/\/[^"]+"/, page);
  }
  assert.match(read('robots.txt'), /User-agent: \*\s+Allow: \//);
});

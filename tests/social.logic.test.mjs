// Leaderboards and groups: each game's points, the client (queue, retry, dedupe, offline, switched
// off), invite codes and links, and the "how everyone did" numbers. The SQL itself is checked by
// supabase/check-sql.mjs against a real Postgres.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dayNumber, israelDate, DEFAULT_EPOCH } from '../shared/core.js';
import { GAMES } from '../shared/registry.js';
import { BACKEND } from '../shared/config.js';
import {
  createSocial, social, SCORED_GAMES, normalizeCode, joinCodeFromSearch, inviteLink, inviteText, cleanNickname, cleanGroupName,
  summarizeDayStats, bucketOf, playersText, CODE_ALPHABET,
} from '../shared/social.js';
import { createMockBackend, mockFetch, MOCK_URL, MOCK_KEY } from './mock-backend.mjs';
import * as nekuda from '../games/nekuda/game.js';
import * as beerech from '../games/beerech/game.js';
import * as miani from '../games/miani/game.js';
import * as blimilim from '../games/blimilim/game.js';
import * as tzir from '../games/tzir/game.js';
import * as herkev from '../games/herkev/game.js';
import * as yoter from '../games/yoter/game.js';

// ---------- points ----------

test('the scored games are exactly the daily games of the registry; retired games are left out', () => {
  assert.deepEqual([...SCORED_GAMES].sort(), GAMES.filter((g) => g.kind === 'daily').map((g) => g.slug).sort());
  for (const retired of ['arba', 'mitchaze']) assert.ok(!SCORED_GAMES.includes(retired));
  const sql = readFileSync(new URL('../supabase/setup.sql', import.meta.url), 'utf8');
  for (const g of GAMES.filter((x) => x.kind === 'daily')) {
    assert.match(sql, new RegExp(`\\('${g.slug}',\\s*'${g.epoch}'\\)`), `setup.sql knows ${g.slug} and its epoch`);
  }
  assert.ok(!sql.includes("'mitchaze'"), 'the old party game never had a score');
});

const isPoints = (p) => Number.isInteger(p) && p >= 0 && p <= 100;

test('נקודת ציון: 100 in one guess, 15 less a guess, 0 when not found', () => {
  const miss = { win: false };
  const hit = { win: true };
  const tries = (n, win = true) => [...Array(n - 1).fill(miss), win ? hit : miss];
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => nekuda.points(tries(n))), [100, 85, 70, 55, 40, 25]);
  assert.equal(nekuda.points(tries(6, false)), 0);
  assert.equal(nekuda.points([]), 0);
});

test('בערך: the total out of 500, divided by five', () => {
  const round = beerech.roundForDay(10);
  const exact = round.map((p) => p.price);
  assert.equal(beerech.points(exact, round), 100);
  assert.equal(beerech.points(round.map((p) => p.price * 10), round), 0);
  const some = round.map((p, i) => (i < 2 ? p.price : p.price * 10));
  assert.equal(beerech.points(some, round), Math.round(beerech.total(some, round) / 5));
  assert.equal(beerech.points(some, round), 40);
});

test('מי אני? and בלי מילים: 100 at the first stage, 20 less for each one after it, 0 when not found', () => {
  for (const G of [miani, blimilim]) {
    const p = G.puzzleForDay(5);
    assert.deepEqual([1, 2, 3, 4, 5].map((n) => G.points(p, [...Array(n - 1).fill(null), p.answer])), [100, 80, 60, 40, 20]);
    assert.equal(G.points(p, Array(5).fill(null)), 0);
    assert.equal(G.points(p, []), 0);
  }
});

test('על הציר: the share of six events placed right', () => {
  assert.equal(tzir.points([true, true, true, true, true, true]), 100);
  assert.equal(tzir.points([true, false, true, true, true, true]), 83);
  assert.equal(tzir.points([false, false, false]), 0);
  assert.equal(tzir.points([true, false, true, false, false]), 33);
});

test('צומת: the share of nine cells filled', async () => {
  const day = 5;
  const grid = herkev.gridForDay(day);
  await herkev.loadTopic(grid.topic);
  const answers = herkev.solve(grid);
  const full = answers.map((item, cell) => [cell, item.id]);
  assert.equal(herkev.points(grid, full), 100);
  assert.equal(herkev.points(grid, full.slice(0, 5)), 56);
  assert.equal(herkev.points(grid, []), 0);
});

test('יותר או פחות: ten points a right answer', () => {
  const chain = yoter.chainForDay(3);
  const right = chain.items.slice(1).map((item, i) => (item.value > chain.items[i].value ? 'more' : 'less'));
  const flip = (a) => (a === 'more' ? 'less' : 'more');
  assert.equal(yoter.points(chain.items, right), 100);
  assert.equal(yoter.points(chain.items, right.map((a, i) => (i < 3 ? flip(a) : a))), 70);
  assert.equal(yoter.points(chain.items, right.map(flip)), 0);
});

test('every game\'s points are whole numbers from 0 to 100', () => {
  const round = beerech.roundForDay(1);
  for (let i = 0; i < 200; i++) {
    const guesses = round.map((p) => +(p.price * (0.2 + Math.random() * 2)).toFixed(2));
    assert.ok(isPoints(beerech.points(guesses, round)));
  }
});

// ---------- codes, links, names ----------

test('invite codes: six characters without look-alikes, typed or pasted any way', () => {
  assert.ok(!/[01OIL]/.test(CODE_ALPHABET));
  assert.equal(normalizeCode('abcdef'), 'ABCDEF');
  assert.equal(normalizeCode(' abc-def '), 'ABCDEF');
  assert.equal(normalizeCode('https://example.com/hd/groups/?join=XY23ZK'), 'XY23ZK');
  assert.equal(normalizeCode('בואו לקבוצה https://x.y/groups/?join=xy23zk&utm=1'), 'XY23ZK');
  assert.equal(normalizeCode('ABCDE'), null);
  assert.equal(normalizeCode('ABCDEFG'), null);
  assert.equal(normalizeCode('ABCDE0'), null, 'zero is not in the alphabet');
  assert.equal(normalizeCode('ABCDEI'), null);
  assert.equal(normalizeCode(null), null);
  assert.equal(joinCodeFromSearch('?join=xy23zk'), 'XY23ZK');
  assert.equal(joinCodeFromSearch('?join=nope'), null);
  assert.equal(joinCodeFromSearch(''), null);
});

test('invite links keep the site folder and replace any query', () => {
  assert.equal(inviteLink('XY23ZK', 'https://example.github.io/hamesh-dakot/groups/?join=OLD#x'), 'https://example.github.io/hamesh-dakot/groups/?join=XY23ZK');
  const text = inviteText('המשפחה', 'https://e.x/groups/?join=XY23ZK');
  assert.ok(text.includes('״המשפחה״') && text.endsWith('https://e.x/groups/?join=XY23ZK'));
  assert.equal(normalizeCode(text), 'XY23ZK', 'the whole invite message can be pasted as a code');
});

test('nicknames and group names are trimmed and measured as the server does', () => {
  assert.equal(cleanNickname('  נועה   כהן‮ '), 'נועה כהן');
  assert.equal(cleanNickname('א'), null);
  assert.equal(cleanNickname('א'.repeat(20)), 'א'.repeat(20));
  assert.equal(cleanNickname('א'.repeat(21)), null);
  assert.equal(cleanGroupName('ש'.repeat(30)), 'ש'.repeat(30));
  assert.equal(cleanGroupName('  '), null);
});

// ---------- "how everyone did" ----------

test('the day statistics: better than X% of the others, ten buckets, too few players', () => {
  assert.deepEqual(summarizeDayStats({ total: 3 }, 50), { enough: false, total: 3 });
  assert.deepEqual(summarizeDayStats(null, 50), { enough: false, total: 0 });
  const stats = { total: 11, won: 8, points: [[0, 1], [20, 1], [40, 2], [60, 1], [80, 4], [100, 2]] };
  const s = summarizeDayStats(stats, 80);
  // Below 80: 5 players; the others are 10 (the player is one of the four on 80).
  assert.equal(s.betterThan, 50);
  assert.equal(s.top, false);
  assert.equal(s.mine, 8);
  assert.deepEqual(s.buckets, [1, 0, 1, 0, 2, 0, 1, 0, 4, 2]);
  assert.equal(s.winRate, 73);
  const best = summarizeDayStats(stats, 100);
  assert.equal(best.betterThan, 90);
  assert.equal(best.top, true);
  assert.equal(bucketOf(100), 9);
  assert.equal(bucketOf(95), 9);
  assert.equal(bucketOf(9), 0);
  assert.equal(summarizeDayStats(stats, 0).betterThan, 0);
  assert.equal(playersText(1), 'שחקן אחד');
  assert.equal(playersText(1204), '1,204 שחקנים');
});

// ---------- the client ----------

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

function setup({ online = true, fail } = {}) {
  const backend = createMockBackend();
  const storage = memoryStorage();
  const state = { online };
  const client = createSocial({ backend: { url: MOCK_URL, key: MOCK_KEY }, storage, fetch: mockFetch(backend, { fail }), online: () => state.online, timeout: 200 });
  return { backend, storage, client, state };
}
const today = (game) => dayNumber(israelDate(), GAMES.find((g) => g.slug === game).epoch);
const result = (game = 'miani', points = 80) => ({ game, day: today(game), points, won: true, summary: 'בלי טעויות' });
const sends = (backend) => backend.calls.filter((c) => c.name === 'submit_result').length;

test('shared/config.js is either switched off or a Supabase project with its public key, never a secret one', () => {
  const { url, key } = BACKEND;
  if (!url && !key) return;
  assert.match(url, /^https:\/\/[a-z0-9]+\.supabase\.co$/, 'the Project URL, no trailing slash');
  assert.ok(/^sb_publishable_/.test(key) || /^eyJ/.test(key), 'the publishable (or legacy anon) key');
  assert.ok(!/^sb_secret_/.test(key) && !/service_role/.test(Buffer.from(key.split('.')[1] || '', 'base64').toString()), 'never the secret / service_role key');
});

test('switched off (an empty config): nothing is sent and nothing is stored', async () => {
  let fetched = 0;
  const storage = memoryStorage();
  const off = createSocial({ backend: { url: '', key: '' }, storage, fetch: () => { fetched++; } });
  assert.equal(off.enabled, false);
  assert.deepEqual(await off.submitResult(result()), { sent: 0, pending: 0 });
  assert.deepEqual(await off.flush(), { sent: 0, pending: 0 });
  await assert.rejects(off.dayStats('miani', 1), { code: 'disabled' });
  await assert.rejects(off.myGroups(), { code: 'disabled' });
  assert.equal(fetched, 0);
  assert.equal(storage.data.size, 0);
});

test('the first result registers the player once and sends the result', async () => {
  const { backend, client, storage } = setup();
  assert.equal(client.me(), null);
  assert.deepEqual(await client.submitResult(result()), { sent: 1, pending: 0 });
  const me = client.me();
  assert.match(me.secret, /^[0-9a-f]{64}$/);
  assert.equal(backend.results.length, 1);
  assert.equal(backend.results[0].points, 80);
  assert.equal(backend.calls.filter((c) => c.name === 'register').length, 1);
  assert.ok(storage.data.has('hd:me'));
  // Two at once still make one player.
  const second = setup();
  await Promise.all([second.client.submitResult(result('miani')), second.client.submitResult(result('tzir', 50))]);
  assert.equal(second.backend.calls.filter((c) => c.name === 'register').length, 1);
  assert.equal(second.backend.results.length, 2);
});

test('the same game and day is sent once, however often the end screen is drawn', async () => {
  const { backend, client } = setup();
  await client.submitResult(result());
  await client.submitResult(result());
  await client.submitResult({ ...result(), points: 100 });
  assert.equal(sends(backend), 1);
  assert.equal(backend.results[0].points, 80);
});

test('offline: the result waits in the queue and goes out when the connection is back', async () => {
  const { backend, client, state, storage } = setup({ online: false });
  assert.deepEqual(await client.submitResult(result()), { sent: 0, pending: 1 });
  assert.equal(client.isPending('miani', today('miani')), true);
  assert.equal(backend.calls.length, 0);
  assert.equal(JSON.parse(storage.data.get('hd:social-queue')).length, 1);
  await client.submitResult(result());
  assert.equal(JSON.parse(storage.data.get('hd:social-queue')).length, 1, 'queued once');
  state.online = true;
  assert.deepEqual(await client.flush(), { sent: 1, pending: 0 });
  assert.equal(client.isPending('miani', today('miani')), false);
  assert.equal(backend.results.length, 1);
});

test('network trouble and server errors keep the result for later; a refusal drops it', async () => {
  let mode = 'network';
  const { backend, client } = setup({ fail: () => mode });
  assert.deepEqual(await client.submitResult(result()), { sent: 0, pending: 1 });
  mode = 'hang';
  assert.deepEqual(await client.flush(), { sent: 0, pending: 1 }, 'a timeout keeps it');
  mode = null;
  backend.setDown(true);
  assert.deepEqual(await client.flush(), { sent: 0, pending: 1 }, 'a 503 keeps it');
  backend.setDown(false);
  assert.deepEqual(await client.flush(), { sent: 1, pending: 0 });
  // A day the server will not take (a stale phone clock, say) is not retried forever.
  assert.deepEqual(await client.submitResult({ ...result('tzir'), day: today('tzir') - 5 }), { sent: 0, pending: 0 });
  assert.deepEqual(await client.flush(), { sent: 0, pending: 0 });
  assert.equal(backend.results.length, 1);
});

test('junk is never queued: unknown games (the party game), bad days and points', async () => {
  const { backend, client } = setup();
  for (const bad of [{ ...result(), game: 'arba' }, { ...result(), day: 1.5 }, { ...result(), points: 101 }, { ...result(), points: -1 }, { ...result(), points: '80' }]) {
    assert.deepEqual(await client.submitResult(bad), { sent: 0, pending: 0 });
  }
  assert.equal(backend.calls.length, 0);
});

test('junk in storage never breaks the client', async () => {
  const backend = createMockBackend();
  const storage = memoryStorage({ 'hd:me': '{nope', 'hd:social-queue': '[1, {"game":"x"}]', 'hd:social-sent': '"str"' });
  const client = createSocial({ backend: { url: MOCK_URL, key: MOCK_KEY }, storage, fetch: mockFetch(backend) });
  assert.equal(client.me(), null);
  assert.deepEqual(await client.submitResult(result()), { sent: 1, pending: 0 });
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const noStorage = createSocial({ backend: { url: MOCK_URL, key: MOCK_KEY }, storage: throwing, fetch: mockFetch(backend) });
  // Storage switched off: kept in memory for the page, and still sent.
  assert.deepEqual(await noStorage.submitResult(result('tzir')), { sent: 1, pending: 0 });
});

test('a player the server no longer knows starts over once, transparently', async () => {
  const { backend, client } = setup();
  await client.submitResult(result());
  const old = client.me().id;
  backend.players.clear();
  await client.setNickname('נועה');
  assert.notEqual(client.me().id, old);
  assert.equal(client.me().nickname, 'נועה');
});

test('groups: nickname, create, join by link, board, leave, forget', async () => {
  const backend = createMockBackend();
  const make = () => createSocial({ backend: { url: MOCK_URL, key: MOCK_KEY }, storage: memoryStorage(), fetch: mockFetch(backend) });
  const noa = make();
  const dan = make();
  await assert.rejects(noa.createGroup('המשפחה'), { code: 'no_nickname' });
  await assert.rejects(noa.setNickname('x'), { code: 'bad_name' });
  assert.equal(await noa.setNickname('  נועה '), 'נועה');
  await assert.rejects(noa.createGroup(' '), { code: 'bad_name' });
  const group = await noa.createGroup('המשפחה');
  assert.match(group.code, /^[A-Z2-9]{6}$/);
  await dan.setNickname('דן');
  const link = inviteLink(group.code, 'https://e.x/hd/groups/');
  assert.equal((await dan.joinGroup(link)).members, 2);
  await assert.rejects(dan.joinGroup('ZZZZZZ'), { code: 'not_found' });
  await assert.rejects(dan.joinGroup('nonsense'), { code: 'not_found' });
  await noa.submitResult(result('miani', 80));
  await dan.submitResult(result('miani', 60));
  await dan.submitResult(result('tzir', 50));
  const board = await dan.groupBoard(group.code, 'day');
  assert.deepEqual(board.members.map((m) => [m.nickname, m.rank, m.total, m.me]), [['דן', 1, 110, true], ['נועה', 2, 80, false]]);
  const mine = await noa.myGroups();
  assert.deepEqual(mine, { nickname: 'נועה', groups: [{ code: group.code, name: 'המשפחה', members: 2 }] });
  await dan.leaveGroup(group.code);
  await assert.rejects(dan.groupBoard(group.code), { code: 'not_member' });
  await noa.forgetMe();
  assert.equal(noa.me(), null);
  assert.equal(backend.groups.size, 0, 'the last one out takes the group');
});

test('requests carry the key; a legacy JWT key goes in Authorization as well, a publishable key does not', async () => {
  const seen = [];
  const capture = (url, init) => { seen.push({ url, headers: init.headers, body: JSON.parse(init.body) }); return Promise.resolve({ ok: true, status: 200, json: async () => ({ game: 'miani', day: 1, total: 0 }) }); };
  await createSocial({ backend: { url: 'https://p.supabase.co/', key: 'sb_publishable_x' }, storage: memoryStorage(), fetch: capture }).dayStats('miani', 1);
  await createSocial({ backend: { url: 'https://p.supabase.co', key: 'eyJhbGciOi.x.y' }, storage: memoryStorage(), fetch: capture }).dayStats('miani', 1);
  assert.equal(seen[0].url, 'https://p.supabase.co/rest/v1/rpc/day_stats');
  assert.deepEqual(seen[0].body, { p_game: 'miani', p_day: 1 });
  assert.equal(seen[0].headers.apikey, 'sb_publishable_x');
  assert.equal(seen[0].headers.Authorization, undefined);
  assert.equal(seen[1].headers.Authorization, 'Bearer eyJhbGciOi.x.y');
});

test('the service worker leaves the database alone: other origins are never cached or answered', () => {
  const sw = readFileSync(new URL('../scripts/sw-template.js', import.meta.url), 'utf8');
  assert.match(sw, /origin !== self\.location\.origin\) return/);
  assert.match(sw, /request\.method !== 'GET'/);
});

test('the epochs the server checks days against are the ones the games count from', () => {
  assert.equal(GAMES.find((g) => g.slug === 'nekuda').epoch, nekuda.EPOCH);
  for (const g of GAMES.filter((x) => x.slug !== 'nekuda')) assert.equal(g.epoch, DEFAULT_EPOCH);
});

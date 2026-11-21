// An in-memory stand-in for the database functions in supabase/setup.sql, for the tests.
// Same names, same arguments, same answers and the same error codes (as PostgREST sends them:
// HTTP 400 with { message: '<code>' }). supabase/check-sql.mjs tests the real SQL; this lets the
// client and the pages be tested without a database.
//
//   const backend = createMockBackend({ epochs })
//   backend.handle(name, args) -> { status, body }
//   backend.route(page | context)  serves MOCK_URL/rest/v1/rpc/* from it (Playwright)
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { israelDate } from '../shared/core.js';

export const MOCK_URL = 'https://backend.test';
export const MOCK_KEY = 'sb_publishable_test_key';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DEFAULT_EPOCHS = { nekuda: '2026-11-13', beerech: '2026-11-14', miani: '2026-11-14', tzir: '2026-11-14', herkev: '2026-11-14', yoter: '2026-11-14', blimilim: '2026-11-14' };

const days = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
const iso = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const clean = (text, min, max) => {
  const t = String(text ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  return [...t].length >= min && [...t].length <= max ? t : null;
};

class Refusal extends Error {}
const refuse = (code) => { throw new Refusal(code); };

export function createMockBackend({ epochs = DEFAULT_EPOCHS, today = () => israelDate(), minPlayers = 5 } = {}) {
  const players = new Map(); // id -> { hash, nickname }
  const results = []; // { player, game, day, on, points, won, summary }
  const groups = new Map(); // code -> { name, members: Map(id -> joinedAt) }
  const calls = [];
  let down = false;

  const hash = (secret) => createHash('sha256').update(String(secret)).digest('hex');
  const auth = ({ p_id: id, p_secret: secret }) => {
    const p = players.get(id);
    if (!p || typeof secret !== 'string' || p.hash !== hash(secret)) refuse('bad_player');
    return { id, ...p };
  };
  const member = (me, code) => {
    const g = groups.get(String(code ?? '').trim().toUpperCase());
    if (!g || !g.members.has(me.id)) refuse('not_member');
    return g;
  };
  const todayDays = () => days(today());
  const streak = (id) => {
    const dates = new Set(results.filter((r) => r.player === id).map((r) => days(r.on)));
    let d = todayDays();
    if (!dates.has(d)) d -= 1;
    let n = 0;
    while (dates.has(d)) { n++; d--; }
    return n;
  };

  const API = {
    register() {
      const id = randomUUID();
      const secret = randomBytes(32).toString('hex');
      players.set(id, { hash: hash(secret), nickname: null });
      return { id, secret };
    },
    set_nickname(args) {
      const me = auth(args);
      const nickname = clean(args.p_nickname, 2, 20) ?? refuse('bad_name');
      players.get(me.id).nickname = nickname;
      return { nickname };
    },
    submit_result(args) {
      const me = auth(args);
      const epoch = epochs[args.p_game] ?? refuse('bad_game');
      const expected = todayDays() - days(epoch) + 1;
      if (!Number.isInteger(args.p_day) || Math.abs(args.p_day - expected) > 1) refuse('bad_day');
      if (!Number.isInteger(args.p_points) || args.p_points < 0 || args.p_points > 100 || typeof args.p_won !== 'boolean') refuse('bad_points');
      if (results.some((r) => r.player === me.id && r.game === args.p_game && r.day === args.p_day)) return { accepted: false };
      results.push({
        player: me.id, game: args.p_game, day: args.p_day, on: iso(days(epoch) + args.p_day - 1),
        points: args.p_points, won: args.p_won, summary: clean(args.p_summary, 0, 24) ?? '',
      });
      return { accepted: true };
    },
    day_stats({ p_game: game, p_day: day }) {
      if (!epochs[game]) refuse('bad_game');
      const rows = results.filter((r) => r.game === game && r.day === day);
      if (rows.length < minPlayers) return { game, day, total: rows.length };
      const counts = new Map();
      for (const r of rows) counts.set(r.points, (counts.get(r.points) || 0) + 1);
      return { game, day, total: rows.length, won: rows.filter((r) => r.won).length, points: [...counts].sort((a, b) => a[0] - b[0]) };
    },
    create_group(args) {
      const me = auth(args);
      if (!me.nickname) refuse('no_nickname');
      const name = clean(args.p_name, 2, 30) ?? refuse('bad_name');
      let code;
      do code = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');
      while (groups.has(code));
      groups.set(code, { name, members: new Map([[me.id, Date.now()]]) });
      return { code, name, members: 1 };
    },
    join_group(args) {
      const me = auth(args);
      if (!me.nickname) refuse('no_nickname');
      const code = String(args.p_code ?? '').trim().toUpperCase();
      const g = groups.get(code);
      if (!g) return { error: 'not_found' };
      if (!g.members.has(me.id)) {
        if (g.members.size >= 50) return { error: 'group_full' };
        g.members.set(me.id, Date.now());
      }
      return { code, name: g.name, members: g.members.size };
    },
    leave_group(args) {
      const me = auth(args);
      const g = member(me, args.p_code);
      g.members.delete(me.id);
      if (!g.members.size) groups.delete(String(args.p_code).trim().toUpperCase());
      return { left: true };
    },
    my_groups(args) {
      const me = auth(args);
      const mine = [...groups].filter(([, g]) => g.members.has(me.id)).sort((a, b) => a[1].members.get(me.id) - b[1].members.get(me.id));
      return { nickname: me.nickname, groups: mine.map(([code, g]) => ({ code, name: g.name, members: g.members.size })) };
    },
    group_board(args) {
      const me = auth(args);
      const g = member(me, args.p_code);
      const period = args.p_period ?? 'day';
      const date = days(args.p_date ?? today());
      let from = null;
      let to = null;
      if (period === 'day') [from, to] = [date, date];
      else if (period === 'week') { from = date - new Date(date * 86400000).getUTCDay(); to = from + 6; }
      else if (period !== 'all') refuse('bad_period');
      const rows = [...g.members.keys()].map((id) => {
        const mine = results.filter((r) => r.player === id && (from == null || (days(r.on) >= from && days(r.on) <= to)));
        const games = {};
        for (const r of mine) games[r.game] = (games[r.game] || 0) + r.points;
        return { id, nickname: players.get(id).nickname ?? '?', me: id === me.id, total: mine.reduce((s, r) => s + r.points, 0), played: mine.length, games, streak: streak(id) };
      });
      const played = rows.filter((r) => r.played > 0).sort((a, b) => b.total - a.total);
      for (const r of rows) r.rank = r.played > 0 ? played.filter((x) => x.total > r.total).length + 1 : null;
      rows.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.nickname.localeCompare(b.nickname));
      return {
        code: args.p_code.trim().toUpperCase(), name: g.name, period, from: from == null ? null : iso(from), to: to == null ? null : iso(to), today: today(),
        members: rows.map(({ id, ...r }) => r),
      };
    },
    forget_me(args) {
      const me = auth(args);
      players.delete(me.id);
      for (let i = results.length - 1; i >= 0; i--) if (results[i].player === me.id) results.splice(i, 1);
      for (const [code, g] of groups) { g.members.delete(me.id); if (!g.members.size) groups.delete(code); }
      return { forgotten: true };
    },
  };

  function handle(name, args = {}) {
    calls.push({ name, args });
    if (down) return { status: 503, body: { message: 'Service Unavailable' } };
    const fn = API[name];
    if (!fn) return { status: 404, body: { code: 'PGRST202', message: `Could not find the function public.${name}` } };
    try {
      return { status: 200, body: fn(args) };
    } catch (err) {
      if (err instanceof Refusal) return { status: 400, body: { code: 'P0001', message: err.message } };
      throw err;
    }
  }

  /** Answers the site's calls in a Playwright page or context. Also serves a config.js pointing at the mock. */
  async function route(target) {
    await target.route('**/shared/config.js', (r) => r.fulfill({
      contentType: 'text/javascript', body: `export const BACKEND = { url: '${MOCK_URL}', key: '${MOCK_KEY}' };\n`,
    }));
    await target.route(`${MOCK_URL}/rest/v1/rpc/*`, async (r) => {
      const request = r.request();
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, apikey, authorization', 'access-control-allow-methods': 'POST' };
      if (request.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      if (request.headers().apikey !== MOCK_KEY) return r.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{"message":"Invalid API key"}' });
      const name = new URL(request.url()).pathname.split('/').pop();
      const { status, body } = handle(name, request.postDataJSON() ?? {});
      return r.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    });
  }

  return {
    handle,
    route,
    calls,
    results,
    players,
    groups,
    setDown(value) { down = value; },
    /** Adds finished games by made-up players, so a day has enough players for the statistics. */
    seed(game, day, pointsList) {
      for (const points of pointsList) {
        const { id, secret } = API.register();
        const r = handle('submit_result', { p_id: id, p_secret: secret, p_game: game, p_day: day, p_points: points, p_won: points >= 50 });
        if (r.status !== 200) throw new Error(`seed failed: ${JSON.stringify(r.body)}`);
      }
    },
  };
}

/** A fetch() that talks to the mock directly, for logic tests in Node. */
export function mockFetch(backend, { fail = () => null } = {}) {
  return async (url, init) => {
    const problem = fail(url, init);
    if (problem === 'network') throw new TypeError('Failed to fetch');
    if (problem === 'hang') return new Promise((resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    const name = new URL(url).pathname.split('/').pop();
    const { status, body } = backend.handle(name, JSON.parse(init.body));
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
}

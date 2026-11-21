// Runs supabase/setup.sql against a real Postgres (PGlite: Postgres compiled to WebAssembly, in
// memory) and exercises every function as the anon role, the way the site calls them.
// Not part of `npm test`, because it needs a package the site does not:
//   npm install --no-save @electric-sql/pglite && node supabase/check-sql.mjs
// or point PGLITE at an installed copy: PGLITE=/path/to/pglite/dist/index.js node supabase/check-sql.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(process.env.PGLITE ? pathToFileURL(process.env.PGLITE).href : '@electric-sql/pglite');
const sql = await readFile(new URL('./setup.sql', import.meta.url), 'utf8');
const db = new PGlite();

let passed = 0;
async function step(name, fn) {
  try { await fn(); passed++; console.log('✔', name); } catch (err) { console.log('✖', name); throw err; }
}

// Calls an API function as the anon role, like PostgREST does: named arguments, one jsonb back.
async function rpc(fn, args = {}) {
  const names = Object.keys(args);
  const call = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
  await db.exec('set role anon');
  try {
    const { rows } = await db.query(call, Object.values(args));
    return rows[0].r;
  } finally {
    await db.exec('reset role');
  }
}
async function rpcError(fn, args) {
  try { await rpc(fn, args); } catch (err) { return err.message; }
  throw new Error(`${fn} should have failed`);
}
const today = async (game) => (await db.query(`select (now() at time zone 'Asia/Jerusalem')::date - epoch + 1 as d from games where slug = $1`, [game])).rows[0].d;

await step('setup.sql runs, and runs again without complaint', async () => {
  await db.exec(sql);
  await db.exec(sql);
  const { rows } = await db.query('select count(*)::int as n from games');
  assert.equal(rows[0].n, 6);
});

await step('the anon role can touch no table and no helper directly', async () => {
  await db.exec('set role anon');
  try {
    for (const table of ['players', 'results', 'groups', 'group_members', 'rate_events', 'games']) {
      await assert.rejects(db.query(`select * from public.${table}`), /permission denied/, table);
      await assert.rejects(db.query(`delete from public.${table}`), /permission denied/, table);
    }
    await assert.rejects(db.query(`insert into public.results values (gen_random_uuid(), 'miani', 1, now()::date, 100, true, '')`), /permission denied/);
    for (const helper of ["_auth(gen_random_uuid(), 'x')", '_israel_today()', "_streak(gen_random_uuid(), now()::date)"]) {
      await assert.rejects(db.query(`select public.${helper}`), /permission denied/, helper);
    }
  } finally {
    await db.exec('reset role');
  }
  const { rows } = await db.query(`select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`);
  assert.deepEqual(rows, [], 'row level security on every table');
});

const players = [];
await step('register: a random id and secret; only a hash of the secret is stored', async () => {
  for (let i = 0; i < 7; i++) players.push(await rpc('register'));
  const [a] = players;
  assert.match(a.id, /^[0-9a-f-]{36}$/);
  assert.match(a.secret, /^[0-9a-f]{64}$/);
  assert.equal(new Set(players.map((p) => p.secret)).size, 7);
  const { rows } = await db.query('select encode(secret_hash, $$hex$$) as h from players where id = $1', [a.id]);
  assert.notEqual(rows[0].h, a.secret);
  assert.equal(rows[0].h.length, 64);
});

const auth = (p) => ({ p_id: p.id, p_secret: p.secret });

await step('a wrong secret is refused everywhere', async () => {
  const [a, b] = players;
  const wrong = { p_id: a.id, p_secret: b.secret };
  assert.match(await rpcError('set_nickname', { ...wrong, p_nickname: 'גנב' }), /bad_player/);
  assert.match(await rpcError('my_groups', wrong), /bad_player/);
  assert.match(await rpcError('my_groups', { p_id: a.id, p_secret: 'short' }), /bad_player/);
  assert.match(await rpcError('submit_result', { ...wrong, p_game: 'miani', p_day: await today('miani'), p_points: 100, p_won: true }), /bad_player/);
});

await step('set_nickname trims, collapses spaces, strips control characters and checks the length', async () => {
  const [a] = players;
  assert.deepEqual(await rpc('set_nickname', { ...auth(a), p_nickname: '  נועה   כהן ‮ ' }), { nickname: 'נועה כהן' });
  assert.match(await rpcError('set_nickname', { ...auth(a), p_nickname: ' x ' }), /bad_name/);
  assert.match(await rpcError('set_nickname', { ...auth(a), p_nickname: 'א'.repeat(21) }), /bad_name/);
  assert.deepEqual(await rpc('set_nickname', { ...auth(a), p_nickname: 'נועה' }), { nickname: 'נועה' });
});

await step('submit_result: today only (±1 day), known games, points 0–100, first submission wins', async () => {
  const [a] = players;
  const day = await today('miani');
  const base = { ...auth(a), p_game: 'miani', p_won: true, p_summary: 'בלי טעויות' };
  assert.match(await rpcError('submit_result', { ...base, p_day: day - 2, p_points: 50 }), /bad_day/);
  assert.match(await rpcError('submit_result', { ...base, p_day: day + 2, p_points: 50 }), /bad_day/);
  assert.match(await rpcError('submit_result', { ...base, p_game: 'mitchaze', p_day: day, p_points: 50 }), /bad_game/);
  assert.match(await rpcError('submit_result', { ...base, p_day: day, p_points: 101 }), /bad_points/);
  assert.match(await rpcError('submit_result', { ...base, p_day: day, p_points: -1 }), /bad_points/);
  assert.deepEqual(await rpc('submit_result', { ...base, p_day: day, p_points: 80 }), { accepted: true });
  assert.deepEqual(await rpc('submit_result', { ...base, p_day: day, p_points: 100 }), { accepted: false });
  const { rows } = await db.query('select points, summary from results where player_id = $1', [a.id]);
  assert.deepEqual(rows, [{ points: 80, summary: 'בלי טעויות' }]);
  // נקודת ציון counts from its own epoch, a day earlier, so its puzzle number is one higher.
  assert.equal(await today('nekuda'), day + 1);
  assert.deepEqual(await rpc('submit_result', { ...auth(a), p_game: 'nekuda', p_day: day + 1, p_points: 70, p_won: true }), { accepted: true });
  const dates = await db.query('select count(distinct played_on)::int as n from results where player_id = $1', [a.id]);
  assert.equal(dates.rows[0].n, 1, 'both land on the same calendar date');
});

await step('day_stats: nothing below five players, then anonymous counts per score', async () => {
  const day = await today('miani');
  const few = await rpc('day_stats', { p_game: 'miani', p_day: day });
  assert.deepEqual(few, { game: 'miani', day, total: 1 });
  const points = [20, 40, 40, 100, 0, 60];
  for (let i = 1; i < players.length; i++) {
    await rpc('submit_result', { ...auth(players[i]), p_game: 'miani', p_day: day, p_points: points[i - 1], p_won: points[i - 1] > 0 });
  }
  const stats = await rpc('day_stats', { p_game: 'miani', p_day: day });
  assert.equal(stats.total, 7);
  assert.equal(stats.won, 6);
  assert.deepEqual(stats.points, [[0, 1], [20, 1], [40, 2], [60, 1], [80, 1], [100, 1]]);
  assert.ok(!JSON.stringify(stats).includes(players[0].id), 'no player ids');
  assert.match(await rpcError('day_stats', { p_game: 'nope', p_day: day }), /bad_game/);
});

let code;
await step('create_group needs a nickname and a name; the code avoids look-alike characters', async () => {
  const [a, b] = players;
  assert.match(await rpcError('create_group', { ...auth(b), p_name: 'משפחה' }), /no_nickname/);
  assert.match(await rpcError('create_group', { ...auth(a), p_name: 'מ' }), /bad_name/);
  const group = await rpc('create_group', { ...auth(a), p_name: '  המשפחה  ' });
  assert.match(group.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
  assert.equal(group.name, 'המשפחה');
  code = group.code;
});

await step('join_group: by code, any case, idempotent; a wrong code is answered and counted', async () => {
  const [, b, c] = players;
  assert.match(await rpcError('join_group', { ...auth(b), p_code: code }), /no_nickname/);
  await rpc('set_nickname', { ...auth(b), p_nickname: 'אבא' });
  assert.deepEqual(await rpc('join_group', { ...auth(b), p_code: ` ${code.toLowerCase()} ` }), { code, name: 'המשפחה', members: 2 });
  assert.deepEqual(await rpc('join_group', { ...auth(b), p_code: code }), { code, name: 'המשפחה', members: 2 });
  await rpc('set_nickname', { ...auth(c), p_nickname: 'סבתא' });
  assert.deepEqual(await rpc('join_group', { ...auth(c), p_code: 'ZZZZZZ' }), { error: 'not_found' });
  const { rows } = await db.query(`select count(*)::int as n from rate_events where player_id = $1 and kind = 'join'`, [c.id]);
  assert.equal(rows[0].n, 1, 'the failed attempt was recorded');
});

await step('join attempts are limited to 30 an hour', async () => {
  const [, , c] = players;
  for (let i = 0; i < 29; i++) await rpc('join_group', { ...auth(c), p_code: 'ZZZZZZ' });
  assert.match(await rpcError('join_group', { ...auth(c), p_code: code }), /rate_limited/);
  await db.query(`update rate_events set at = at - interval '2 hours' where player_id = $1`, [c.id]);
  assert.equal((await rpc('join_group', { ...auth(c), p_code: code })).members, 3);
});

await step('group_board: members only; day, week and all; ranks with ties; me marked', async () => {
  const [a, b, , d] = players;
  assert.match(await rpcError('group_board', { ...auth(d), p_code: code, p_period: 'day' }), /not_member/);
  assert.match(await rpcError('group_board', { ...auth(a), p_code: code, p_period: 'year' }), /bad_period/);
  const board = await rpc('group_board', { ...auth(a), p_code: code, p_period: 'day' });
  assert.equal(board.name, 'המשפחה');
  const rows = board.members.map((m) => [m.nickname, m.rank, m.total, m.played, m.me]);
  // נועה: 80 + 70; אבא: 20; סבתא: 40.
  assert.deepEqual(rows, [['נועה', 1, 150, 2, true], ['סבתא', 2, 40, 1, false], ['אבא', 3, 20, 1, false]]);
  assert.deepEqual(board.members[0].games, { miani: 80, nekuda: 70 });
  assert.equal(board.members[0].streak, 1);
  assert.ok(!JSON.stringify(board).includes(a.id), 'no player ids on the board');
  const week = await rpc('group_board', { ...auth(b), p_code: code, p_period: 'week' });
  assert.equal(week.members.find((m) => m.me).nickname, 'אבא');
  const from = new Date(week.from + 'T12:00:00Z');
  assert.equal(from.getUTCDay(), 0, 'weeks start on Sunday');
  const all = await rpc('group_board', { ...auth(b), p_code: code, p_period: 'all' });
  assert.equal(all.members[0].total, 150);
  // A tie shares the rank.
  await db.query(`update results set points = 40 where player_id = $1`, [b.id]);
  const tied = await rpc('group_board', { ...auth(a), p_code: code, p_period: 'day' });
  assert.deepEqual(tied.members.map((m) => m.rank), [1, 2, 2]);
});

await step('a member who has not played yet is listed without a rank; yesterday keeps a streak alive', async () => {
  const [a, , , , e] = players;
  await rpc('set_nickname', { ...auth(e), p_nickname: 'דני' });
  await rpc('join_group', { ...auth(e), p_code: code });
  await db.query(`delete from results where player_id = $1`, [e.id]);
  const board = await rpc('group_board', { ...auth(a), p_code: code, p_period: 'day' });
  const dani = board.members.find((m) => m.nickname === 'דני');
  assert.equal(dani.rank, null);
  assert.equal(dani.played, 0);
  assert.equal(board.members.at(-1).nickname, 'דני');
  await db.query(`insert into results (player_id, game, day, played_on, points, won)
                  select $1, 'miani', d::date - date '2026-11-14' + 1, d::date, 50, true
                    from generate_series(public._israel_today() - 3, public._israel_today() - 1, interval '1 day') d`, [e.id]);
  const later = await rpc('group_board', { ...auth(a), p_code: code, p_period: 'all' });
  assert.equal(later.members.find((m) => m.nickname === 'דני').streak, 3);
});

await step('limits: five new groups a day, twenty groups a player, fifty members a group', async () => {
  const [a] = players;
  for (let i = 0; i < 4; i++) await rpc('create_group', { ...auth(a), p_name: `קבוצה ${i}` });
  assert.match(await rpcError('create_group', { ...auth(a), p_name: 'עוד אחת' }), /rate_limited/);
  const big = await rpc('create_group', { ...auth(players[1]), p_name: 'גדולה' });
  const { rows } = await db.query(`select id from groups where code = $1`, [big.code]);
  await db.query(`insert into players (id, secret_hash) select gen_random_uuid(), '\\x00' from generate_series(1, 49)`);
  await db.query(`insert into group_members (group_id, player_id) select $1, id from players where secret_hash = '\\x00'`, [rows[0].id]);
  assert.deepEqual(await rpc('join_group', { ...auth(a), p_code: big.code }), { error: 'group_full' });
});

await step('leave_group; the last one out removes the group', async () => {
  const [, b] = players;
  const before = await rpc('my_groups', auth(b));
  assert.equal(before.nickname, 'אבא');
  assert.ok(before.groups.some((g) => g.code === code));
  await rpc('leave_group', { ...auth(b), p_code: code });
  const after = await rpc('my_groups', auth(b));
  assert.ok(!after.groups.some((g) => g.code === code));
  assert.match(await rpcError('leave_group', { ...auth(b), p_code: code }), /not_member/);
  const solo = await rpc('create_group', { ...auth(b), p_name: 'רק אני' });
  await rpc('leave_group', { ...auth(b), p_code: solo.code });
  const { rows } = await db.query('select count(*)::int as n from groups where code = $1', [solo.code]);
  assert.equal(rows[0].n, 0);
});

await step('forget_me deletes the player and everything that is theirs', async () => {
  const [a] = players;
  await rpc('forget_me', auth(a));
  for (const table of ['players where id', 'results where player_id', 'group_members where player_id']) {
    const { rows } = await db.query(`select count(*)::int as n from ${table} = $1`, [a.id]);
    assert.equal(rows[0].n, 0, table);
  }
  assert.match(await rpcError('my_groups', auth(a)), /bad_player/);
});

console.log(`\nsetup.sql: ${passed} checks passed against PostgreSQL ${(await db.query('show server_version')).rows[0].server_version}.`);

-- חמש דקות: leaderboards and groups.
--
-- Paste this whole file into Supabase → SQL Editor → New query, and press Run. Running it again is
-- safe: it creates what is missing and replaces the functions with the current version.
--
-- Security model
--   * There are no accounts and no Supabase Auth. The site talks to the database with the public
--     anon (publishable) key, which anyone can read from the site's source. That is fine because:
--   * Row Level Security is on for every table and there are NO policies, so the anon key can neither
--     read nor write any table directly.
--   * Everything goes through the SECURITY DEFINER functions at the bottom, called as
--     POST <project>/rest/v1/rpc/<function>. Only those are executable by the anon role, and each
--     one checks its input.
--   * A player is a random id plus a random secret, both made here by register(). The database keeps
--     only the SHA-256 of the secret; every write must present the secret. Nobody can act as someone
--     else without the secret, which never leaves that player's browser.
--   * What is stored: the random id, an optional nickname, and per game per day the points, win/loss
--     and the short summary the hub shows ("3/6"). No e-mail, phone, IP address or device data.
--   * Nicknames are shown only to members of a group the player joined. Everything else (how everyone
--     did today) is an anonymous count.

-- Supabase has these roles already; a plain Postgres (for testing this file) does not.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

-- ---------- tables ----------

-- The scored games and the date of each one's puzzle #1 (shared/registry.js). A new scored game needs
-- a row here too. Rows of retired games (arba) stay, so their old results still make sense.
create table if not exists public.games (
  slug  text primary key,
  epoch date not null
);
insert into public.games (slug, epoch) values
  ('nekuda',  '2026-11-13'),
  ('beerech', '2026-11-14'),
  ('arba',    '2026-11-14'),
  ('miani',   '2026-11-14'),
  ('tzir',    '2026-11-14'),
  ('herkev',  '2026-11-14'),
  ('yoter',   '2026-11-14'),
  ('blimilim', '2026-11-14')
on conflict (slug) do update set epoch = excluded.epoch;

create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  secret_hash bytea not null,
  nickname    text check (nickname is null or char_length(nickname) between 2 and 20),
  created_at  timestamptz not null default now()
);
create index if not exists players_created_at on public.players (created_at);

-- One row per player, game and puzzle day. The first submission wins: a replay cannot improve it.
create table if not exists public.results (
  player_id  uuid not null references public.players (id) on delete cascade,
  game       text not null references public.games (slug),
  day        int not null,
  played_on  date not null, -- the Israeli calendar date of that puzzle, for weeks and streaks
  points     smallint not null check (points between 0 and 100),
  won        boolean not null,
  summary    text not null default '' check (char_length(summary) <= 24),
  created_at timestamptz not null default now(),
  primary key (player_id, game, day)
);
create index if not exists results_game_day on public.results (game, day);
create index if not exists results_player_date on public.results (player_id, played_on);

create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$'),
  name       text not null check (char_length(name) between 2 and 30),
  owner      uuid references public.players (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, player_id)
);
create index if not exists group_members_player on public.group_members (player_id);

-- Recent actions per player, for the abuse limits (create a group, try a code).
create table if not exists public.rate_events (
  player_id uuid not null references public.players (id) on delete cascade,
  kind      text not null,
  at        timestamptz not null default now()
);
create index if not exists rate_events_lookup on public.rate_events (player_id, kind, at);

-- Locked: RLS on and no policy means the anon key sees and changes nothing directly.
alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.results enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.rate_events enable row level security;
revoke all on public.games, public.players, public.results, public.groups, public.group_members, public.rate_events
  from public, anon, authenticated;

-- ---------- limits ----------
-- Members per group 50; groups per player 20; new groups per player per day 5; join attempts per
-- player per hour 30 (a code has 31^6, about 887 million, values); new players site-wide per minute 300.

-- ---------- internal helpers (not callable through the API) ----------

create or replace function public._israel_today() returns date
language sql stable set search_path = public, pg_temp as $$
  select (now() at time zone 'Asia/Jerusalem')::date
$$;

-- Raises unless the id and secret belong together.
create or replace function public._auth(p_id uuid, p_secret text) returns public.players
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  me public.players;
begin
  if p_id is null or p_secret is null or char_length(p_secret) <> 64 then
    raise exception 'bad_player';
  end if;
  select * into me from public.players where id = p_id and secret_hash = sha256(convert_to(p_secret, 'UTF8'));
  if not found then
    raise exception 'bad_player';
  end if;
  return me;
end $$;

-- Records one action and refuses when there were already p_max of them in the window.
create or replace function public._limit(p_player uuid, p_kind text, p_max int, p_window interval) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.rate_events where player_id = p_player and at < now() - interval '2 days';
  if (select count(*) from public.rate_events where player_id = p_player and kind = p_kind and at > now() - p_window) >= p_max then
    raise exception 'rate_limited';
  end if;
  insert into public.rate_events (player_id, kind) values (p_player, p_kind);
end $$;

-- Trims, collapses spaces, drops control and direction-override characters; null if the length is wrong.
create or replace function public._clean_text(p_text text, p_min int, p_max int) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case when char_length(t) between p_min and p_max then t end
  from (select btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]​-‏‪-‮⁦-⁩]', '', 'g'), '\s+', ' ', 'g')) as t) s
$$;

-- Days in a row, up to today, on which the player finished at least one game. Yesterday still counts
-- as "alive" (today is not over yet).
create or replace function public._streak(p_player uuid, p_today date) returns int
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  d date := p_today;
  n int := 0;
begin
  if not exists (select 1 from public.results where player_id = p_player and played_on = d) then
    d := d - 1;
  end if;
  while n < 400 and exists (select 1 from public.results where player_id = p_player and played_on = d) loop
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end $$;

create or replace function public._group_for_member(p_player uuid, p_code text) returns public.groups
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  g public.groups;
begin
  select gr.* into g from public.groups gr
    join public.group_members m on m.group_id = gr.id and m.player_id = p_player
   where gr.code = upper(btrim(coalesce(p_code, '')));
  if not found then
    raise exception 'not_member';
  end if;
  return g;
end $$;

-- ---------- the API ----------

-- A new anonymous player. The secret is returned once and never stored.
create or replace function public.register() returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_secret text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id uuid;
begin
  if (select count(*) from public.players where created_at > now() - interval '1 minute') >= 300 then
    raise exception 'busy';
  end if;
  insert into public.players (secret_hash) values (sha256(convert_to(v_secret, 'UTF8'))) returning id into v_id;
  return jsonb_build_object('id', v_id, 'secret', v_secret);
end $$;

create or replace function public.set_nickname(p_id uuid, p_secret text, p_nickname text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  me public.players := public._auth(p_id, p_secret);
  v_name text := public._clean_text(p_nickname, 2, 20);
begin
  if v_name is null then
    raise exception 'bad_name';
  end if;
  update public.players set nickname = v_name where id = me.id;
  return jsonb_build_object('nickname', v_name);
end $$;

-- p_day is the game's own puzzle number (each game counts from its own epoch). It must be today's
-- puzzle in Israel, give or take one day for a phone clock that is a little off around midnight.
create or replace function public.submit_result(p_id uuid, p_secret text, p_game text, p_day int, p_points int, p_won boolean, p_summary text default '')
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  me public.players := public._auth(p_id, p_secret);
  v_epoch date;
  v_today int;
  v_count int;
begin
  select epoch into v_epoch from public.games where slug = p_game;
  if not found then
    raise exception 'bad_game';
  end if;
  v_today := public._israel_today() - v_epoch + 1;
  if p_day is null or p_day < v_today - 1 or p_day > v_today + 1 then
    raise exception 'bad_day';
  end if;
  if p_points is null or p_points < 0 or p_points > 100 or p_won is null then
    raise exception 'bad_points';
  end if;
  insert into public.results (player_id, game, day, played_on, points, won, summary)
  values (me.id, p_game, p_day, v_epoch + p_day - 1, p_points, p_won, coalesce(public._clean_text(p_summary, 0, 24), ''))
  on conflict (player_id, game, day) do nothing;
  get diagnostics v_count = row_count;
  return jsonb_build_object('accepted', v_count = 1);
end $$;

-- How everyone did on one puzzle: anonymous counts only, and none at all below five players.
create or replace function public.day_stats(p_game text, p_day int) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_total int;
  v_won int;
  v_points jsonb;
begin
  if not exists (select 1 from public.games where slug = p_game) then
    raise exception 'bad_game';
  end if;
  select count(*), count(*) filter (where won) into v_total, v_won from public.results where game = p_game and day = p_day;
  if v_total < 5 then
    return jsonb_build_object('game', p_game, 'day', p_day, 'total', v_total);
  end if;
  select jsonb_agg(jsonb_build_array(points, n) order by points) into v_points
    from (select points, count(*) as n from public.results where game = p_game and day = p_day group by points) s;
  return jsonb_build_object('game', p_game, 'day', p_day, 'total', v_total, 'won', v_won, 'points', v_points);
end $$;

-- A new group with the caller as its first member. Needs a nickname, since members see each other's.
create or replace function public.create_group(p_id uuid, p_secret text, p_name text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  me public.players := public._auth(p_id, p_secret);
  v_name text := public._clean_text(p_name, 2, 30);
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_bytes bytea;
  v_group uuid;
begin
  if me.nickname is null then
    raise exception 'no_nickname';
  end if;
  if v_name is null then
    raise exception 'bad_name';
  end if;
  if (select count(*) from public.group_members where player_id = me.id) >= 20 then
    raise exception 'too_many_groups';
  end if;
  perform public._limit(me.id, 'create', 5, interval '1 day');
  -- The code is the key to the group, so it comes from the strong random source behind
  -- gen_random_uuid() rather than random().
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, 1 + get_byte(v_bytes, i) % length(v_alphabet), 1);
    end loop;
    exit when not exists (select 1 from public.groups where code = v_code);
  end loop;
  insert into public.groups (code, name, owner) values (v_code, v_name, me.id) returning id into v_group;
  insert into public.group_members (group_id, player_id) values (v_group, me.id);
  return jsonb_build_object('code', v_code, 'name', v_name, 'members', 1);
end $$;

-- Joining with an invite code. A wrong code is answered, not raised, so the attempt still counts
-- towards the hourly limit (an exception would roll the count back).
create or replace function public.join_group(p_id uuid, p_secret text, p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  me public.players := public._auth(p_id, p_secret);
  g public.groups;
  v_members int;
begin
  if me.nickname is null then
    raise exception 'no_nickname';
  end if;
  perform public._limit(me.id, 'join', 30, interval '1 hour');
  select * into g from public.groups where code = upper(btrim(coalesce(p_code, '')));
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  select count(*) into v_members from public.group_members where group_id = g.id;
  if not exists (select 1 from public.group_members where group_id = g.id and player_id = me.id) then
    if v_members >= 50 then
      return jsonb_build_object('error', 'group_full');
    end if;
    if (select count(*) from public.group_members where player_id = me.id) >= 20 then
      return jsonb_build_object('error', 'too_many_groups');
    end if;
    insert into public.group_members (group_id, player_id) values (g.id, me.id);
    v_members := v_members + 1;
  end if;
  return jsonb_build_object('code', g.code, 'name', g.name, 'members', v_members);
end $$;

-- The last member to leave takes the group with them.
create or replace function public.leave_group(p_id uuid, p_secret text, p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  me public.players := public._auth(p_id, p_secret);
  g public.groups := public._group_for_member(me.id, p_code);
begin
  delete from public.group_members where group_id = g.id and player_id = me.id;
  if not exists (select 1 from public.group_members where group_id = g.id) then
    delete from public.groups where id = g.id;
  end if;
  return jsonb_build_object('left', true);
end $$;

create or replace function public.my_groups(p_id uuid, p_secret text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  me public.players := public._auth(p_id, p_secret);
begin
  return jsonb_build_object(
    'nickname', me.nickname,
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('code', g.code, 'name', g.name, 'members',
               (select count(*) from public.group_members x where x.group_id = g.id)) order by m.joined_at)
        from public.group_members m join public.groups g on g.id = m.group_id
       where m.player_id = me.id), '[]'::jsonb));
end $$;

-- The board of one group, for its members only.
--   p_period  'day' (p_date), 'week' (the Sunday-to-Saturday week of p_date) or 'all'
--   p_date    an Israeli calendar date; default today
-- Each member: nickname, points per game and in total for the period, how many games that was, the
-- current run of days with at least one game, and a rank among those who played (ties share a rank).
create or replace function public.group_board(p_id uuid, p_secret text, p_code text, p_period text default 'day', p_date date default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  me public.players := public._auth(p_id, p_secret);
  g public.groups := public._group_for_member(me.id, p_code);
  v_today date := public._israel_today();
  v_date date := coalesce(p_date, v_today);
  v_from date;
  v_to date;
  v_members jsonb;
begin
  if v_date < v_today - 400 or v_date > v_today + 1 then
    raise exception 'bad_date';
  end if;
  if p_period = 'day' then
    v_from := v_date; v_to := v_date;
  elsif p_period = 'week' then
    v_from := v_date - extract(dow from v_date)::int; v_to := v_from + 6;
  elsif p_period = 'all' then
    v_from := null; v_to := null;
  else
    raise exception 'bad_period';
  end if;

  with members as (
    select p.id, p.nickname from public.group_members m join public.players p on p.id = m.player_id where m.group_id = g.id
  ), scored as (
    select r.player_id, r.game, sum(r.points)::int as points, count(*)::int as n
      from public.results r join members mb on mb.id = r.player_id
     where v_from is null or r.played_on between v_from and v_to
     group by r.player_id, r.game
  ), totals as (
    select mb.id, mb.nickname,
           coalesce(sum(s.points), 0)::int as total,
           coalesce(sum(s.n), 0)::int as played,
           coalesce(jsonb_object_agg(s.game, s.points) filter (where s.game is not null), '{}'::jsonb) as games
      from members mb left join scored s on s.player_id = mb.id
     group by mb.id, mb.nickname
  ), ranked as (
    select t.*, case when t.played > 0 then rank() over (partition by t.played > 0 order by t.total desc) end as rank
      from totals t
  )
  select jsonb_agg(jsonb_build_object(
           'nickname', coalesce(r.nickname, '?'),
           'me', r.id = me.id,
           'rank', r.rank,
           'total', r.total,
           'played', r.played,
           'games', r.games,
           'streak', public._streak(r.id, v_today))
         order by r.rank nulls last, r.nickname)
    into v_members from ranked r;

  return jsonb_build_object('code', g.code, 'name', g.name, 'period', p_period,
    'from', v_from, 'to', v_to, 'today', v_today, 'members', coalesce(v_members, '[]'::jsonb));
end $$;

-- Deletes the player, their results and memberships. Groups left empty go too.
create or replace function public.forget_me(p_id uuid, p_secret text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  me public.players := public._auth(p_id, p_secret);
begin
  delete from public.players where id = me.id;
  delete from public.groups g where not exists (select 1 from public.group_members m where m.group_id = g.id);
  return jsonb_build_object('forgotten', true);
end $$;

-- ---------- who may call what ----------

-- Supabase grants new functions to everyone by default; take that back, then open only the API.
revoke all on function
  public._israel_today(), public._auth(uuid, text), public._limit(uuid, text, int, interval),
  public._clean_text(text, int, int), public._streak(uuid, date), public._group_for_member(uuid, text),
  public.register(), public.set_nickname(uuid, text, text),
  public.submit_result(uuid, text, text, int, int, boolean, text), public.day_stats(text, int),
  public.create_group(uuid, text, text), public.join_group(uuid, text, text), public.leave_group(uuid, text, text),
  public.my_groups(uuid, text), public.group_board(uuid, text, text, text, date), public.forget_me(uuid, text)
  from public, anon, authenticated;

-- Does not rely on Supabase's "grant API access to new tables/functions automatically" setting:
-- the schema and every function the site calls are granted here, explicitly.
grant usage on schema public to anon;

grant execute on function
  public.register(), public.set_nickname(uuid, text, text),
  public.submit_result(uuid, text, text, int, int, boolean, text), public.day_stats(text, int),
  public.create_group(uuid, text, text), public.join_group(uuid, text, text), public.leave_group(uuid, text, text),
  public.my_groups(uuid, text), public.group_board(uuid, text, text, text, date), public.forget_me(uuid, text)
  to anon;

-- PostgREST caches the list of functions; tell it to look again.
notify pgrst, 'reload schema';

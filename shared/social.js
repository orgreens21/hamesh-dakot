// The leaderboards-and-groups client: a few fetch calls to the database functions in
// supabase/setup.sql (POST <url>/rest/v1/rpc/<name>). No SDK, no DOM, so Node can test it.
//
// - Switched off when shared/config.js is empty: `enabled` is false, nothing is sent, and every
//   call rejects with code 'disabled' without touching the network.
// - Never throws into game code: submitResult() and flush() always resolve.
// - A finished daily puzzle goes into a queue in localStorage first and is sent from there, so a
//   result made offline (or when the server is down) is sent on the next page load or when the
//   phone is back online. The same game and day is never queued or sent twice.
// - The player is a random id + secret made by the server on first use, kept in localStorage
//   under hd:me. Nothing else identifies them.
import { BACKEND } from './config.js';

/** The games that have a score: every daily game. A party game would have none and never send anything. */
export const SCORED_GAMES = ['nekuda', 'beerech', 'miani', 'tzir', 'herkev', 'yoter', 'blimilim'];
/** Invite codes: six characters with no look-alikes (no 0/O, 1/I/L). The server makes them. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
/** Below this many players the server gives a count only, and the page says "too early". */
export const MIN_PLAYERS = 5;
export const NICKNAME = { min: 2, max: 20 };
export const GROUP_NAME = { min: 2, max: 30 };

const ME_KEY = 'hd:me';
const QUEUE_KEY = 'hd:social-queue';
const SENT_KEY = 'hd:social-sent';
const SENT_KEEP = 120; // game:day keys remembered as sent: two weeks of seven games, and then some
const QUEUE_MAX_AGE = 3 * 86400000; // the server only takes today's puzzle anyway

export class SocialError extends Error {
  /** code: 'disabled' | 'offline' | 'timeout' | 'network' | 'server' | a code from the database ('bad_player', 'not_found'…) */
  constructor(code, retry = false) {
    super(code);
    this.name = 'SocialError';
    this.code = code;
    this.retry = retry; // true when the same call may work later (no connection, server trouble)
  }
}

// ---------- pure helpers ----------

/** Trims and collapses spaces, drops control and direction characters, as the server does. */
export function cleanText(text) {
  return String(text ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const within = (text, { min, max }) => {
  const clean = cleanText(text);
  return [...clean].length >= min && [...clean].length <= max ? clean : null;
};
/** A usable nickname, or null. */
export const cleanNickname = (text) => within(text, NICKNAME);
/** A usable group name, or null. */
export const cleanGroupName = (text) => within(text, GROUP_NAME);

/** What was typed or pasted, as an invite code, or null: "abc-def", " ABCDEF ", or a whole invite link. */
export function normalizeCode(text) {
  const raw = String(text ?? '');
  const fromLink = /[?&]join=([^&#\s]+)/.exec(raw);
  const code = (fromLink ? decodeURIComponent(fromLink[1]) : raw).toUpperCase().replace(/[\s-]/g, '');
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

/** The invite code in a page's query string (?join=CODE), or null. */
export function joinCodeFromSearch(search) {
  const value = new URLSearchParams(search).get('join');
  return value == null ? null : normalizeCode(value);
}

/** The link to send friends: the groups page with ?join=CODE. `groupsPage` is that page's address. */
export function inviteLink(code, groupsPage) {
  const url = new URL(groupsPage);
  url.search = '';
  url.hash = '';
  url.searchParams.set('join', code);
  return url.href;
}

/** The text of a WhatsApp invite. */
export function inviteText(name, link) {
  return `בואו לשחק איתי בחמש דקות ולהשוות תוצאות בקבוצה ״${name}״:\n${link}`;
}

/**
 * Turns the server's day_stats into what the end screen shows.
 *   stats   { total, won?, points?: [[points, count], …] }   (points only from MIN_PLAYERS up)
 *   mine    this player's points
 * Returns { enough: false, total } or
 *   { enough: true, total, betterThan (whole %), top (nobody did better), buckets[10], mine (bucket index), winRate }
 * The ten buckets are 0–9, 10–19 … 80–89 and 90–100.
 */
export function summarizeDayStats(stats, mine) {
  const total = Number.isInteger(stats?.total) ? stats.total : 0;
  if (total < MIN_PLAYERS || !Array.isArray(stats.points)) return { enough: false, total };
  const buckets = Array(10).fill(0);
  let below = 0;
  let same = 0;
  let best = 0;
  for (const pair of stats.points) {
    if (!Array.isArray(pair)) continue;
    const [p, n] = pair.map(Number);
    if (!Number.isFinite(p) || !Number.isFinite(n)) continue;
    buckets[bucketOf(p)] += n;
    if (p < mine) below += n;
    if (p === mine) same += n;
    best = Math.max(best, p);
  }
  // The player is (normally) one of the counted; "better than" is about everyone else.
  const others = total - (same > 0 ? 1 : 0);
  const betterThan = others > 0 ? Math.max(0, Math.min(100, Math.round((below / others) * 100))) : 0;
  const won = Number.isInteger(stats.won) ? stats.won : null;
  return {
    enough: true, total, betterThan, top: mine >= best, buckets, mine: bucketOf(mine),
    winRate: won == null ? null : Math.round((won / total) * 100),
  };
}
export const bucketOf = (points) => Math.max(0, Math.min(9, Math.floor(points / 10)));

/** "שחקן אחד", "12 שחקנים", "1,204 שחקנים". */
export function playersText(n) {
  return n === 1 ? 'שחקן אחד' : `${n.toLocaleString('en-US')} שחקנים`;
}

// ---------- the client ----------

// With storage switched off (some private modes) everything is kept in memory for this page instead:
// the result is still sent, only the identity does not survive a reload.
function jsonStore(storage) {
  const memory = new Map();
  return {
    get(key, fallback) {
      let raw;
      try { raw = storage ? storage.getItem(key) : memory.get(key); } catch { raw = memory.get(key); }
      try { return JSON.parse(raw ?? 'null') ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      memory.set(key, raw);
      try { storage?.setItem(key, raw); } catch { /* memory only */ }
    },
    remove(key) {
      memory.delete(key);
      try { storage?.removeItem(key); } catch { /* nothing stored, nothing to remove */ }
    },
  };
}

const validMe = (me) => me && typeof me === 'object' && typeof me.id === 'string' && /^[0-9a-f]{64}$/.test(me.secret ?? '');
const validResult = (r) => r && SCORED_GAMES.includes(r.game) && Number.isInteger(r.day)
  && Number.isInteger(r.points) && r.points >= 0 && r.points <= 100;

/**
 * backend   { url, key } (shared/config.js)
 * storage   a localStorage-like object (may be missing or throw)
 * fetch     the fetch function
 * online    () => boolean
 * now       () => ms
 * timeout   ms per request
 */
export function createSocial({ backend = BACKEND, storage, fetch: fetchImpl, online = () => true, now = () => Date.now(), timeout = 8000 } = {}) {
  const base = String(backend?.url || '').replace(/\/+$/, '');
  const key = String(backend?.key || '');
  const enabled = Boolean(base && key && typeof fetchImpl === 'function');
  const store = jsonStore(storage);

  const headers = { 'Content-Type': 'application/json', apikey: key };
  // The legacy anon key is a JWT and goes in Authorization as well; the newer publishable keys
  // (sb_publishable_…) are not JWTs and must not.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;

  async function rpc(name, args = {}) {
    if (!enabled) throw new SocialError('disabled');
    if (!online()) throw new SocialError('offline', true);
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller?.abort(); }, timeout);
    let response;
    try {
      response = await fetchImpl(`${base}/rest/v1/rpc/${name}`, {
        method: 'POST', headers, body: JSON.stringify(args), signal: controller?.signal, cache: 'no-store', credentials: 'omit',
      });
    } catch {
      throw new SocialError(timedOut ? 'timeout' : 'network', true);
    } finally {
      clearTimeout(timer);
    }
    let body = null;
    try { body = await response.json(); } catch { /* an empty or broken body */ }
    if (!response.ok) {
      const transient = response.status >= 500 || response.status === 429 || response.status === 408;
      const code = typeof body?.message === 'string' && /^[a-z_]{3,30}$/.test(body.message) ? body.message : transient ? 'server' : 'rejected';
      throw new SocialError(code, transient);
    }
    // Some refusals come back as an answer rather than an error (see join_group in setup.sql).
    if (body && typeof body === 'object' && typeof body.error === 'string') throw new SocialError(body.error);
    return body;
  }

  // ---------- who I am ----------

  let registering = null;
  const me = () => {
    const saved = store.get(ME_KEY, null);
    return validMe(saved) ? saved : null;
  };
  async function ensureMe() {
    const saved = me();
    if (saved) return saved;
    registering ??= rpc('register').then((made) => {
      if (!made || typeof made.id !== 'string' || !/^[0-9a-f]{64}$/.test(made.secret ?? '')) throw new SocialError('server', true);
      const fresh = { id: made.id, secret: made.secret, nickname: null };
      store.set(ME_KEY, fresh);
      return fresh;
    }).finally(() => { registering = null; });
    return registering;
  }
  /** A call as me. If the server no longer knows me (the database was reset), start over once. */
  async function asMe(name, args = {}) {
    let player = await ensureMe();
    try {
      return await rpc(name, { p_id: player.id, p_secret: player.secret, ...args });
    } catch (err) {
      if (err.code !== 'bad_player') throw err;
      store.remove(ME_KEY);
      player = await ensureMe();
      return rpc(name, { p_id: player.id, p_secret: player.secret, ...args });
    }
  }
  const rememberNickname = (nickname) => {
    const saved = me();
    if (saved && saved.nickname !== nickname) store.set(ME_KEY, { ...saved, nickname: nickname ?? null });
  };

  // ---------- results: queue, send, never twice ----------

  const resultKey = (r) => `${r.game}:${r.day}`;
  const queue = () => store.get(QUEUE_KEY, []).filter(validResult);
  const sent = () => {
    const list = store.get(SENT_KEY, []);
    return Array.isArray(list) ? list.filter((k) => typeof k === 'string') : [];
  };
  const markSent = (k) => store.set(SENT_KEY, [...sent().filter((x) => x !== k), k].slice(-SENT_KEEP));

  let flushing = null;
  /** Sends whatever is queued. Resolves to { sent, pending }; never rejects. */
  function flush() {
    if (!enabled) return Promise.resolve({ sent: 0, pending: 0 });
    flushing ??= (async () => {
      let count = 0;
      for (const item of queue()) {
        const k = resultKey(item);
        const drop = () => store.set(QUEUE_KEY, queue().filter((x) => resultKey(x) !== k));
        if (sent().includes(k) || now() - (item.at || 0) > QUEUE_MAX_AGE) { drop(); continue; }
        try {
          await asMe('submit_result', { p_game: item.game, p_day: item.day, p_points: item.points, p_won: !!item.won, p_summary: String(item.summary || '').slice(0, 24) });
          markSent(k);
          drop();
          count++;
        } catch (err) {
          if (err.retry) break; // offline or the server is struggling: keep the rest for later
          // Refused for good (a day the server no longer takes…): resending would never work.
          markSent(k);
          drop();
        }
      }
      return { sent: count, pending: queue().length };
    })().catch(() => ({ sent: 0, pending: queue().length })).finally(() => { flushing = null; });
    return flushing;
  }

  /**
   * Called when a daily puzzle (not an archive or practice round) is finished. Safe to call on every
   * render of a finished game: a game and day is queued once. Resolves to { sent, pending }.
   */
  function submitResult({ game, day, points, won, summary = '' }) {
    if (!enabled) return Promise.resolve({ sent: 0, pending: 0 });
    const item = { game, day, points, won: !!won, summary: String(summary).slice(0, 24), at: now() };
    if (!validResult(item)) return Promise.resolve({ sent: 0, pending: queue().length });
    const k = resultKey(item);
    if (!sent().includes(k) && !queue().some((x) => resultKey(x) === k)) store.set(QUEUE_KEY, [...queue(), item]);
    // A send already under way may have read the queue before this item joined it.
    return flushing ? flushing.then(() => flush()) : flush();
  }

  /** True while this game and day is waiting to be sent. */
  const isPending = (game, day) => queue().some((x) => x.game === game && x.day === day);

  return {
    enabled,
    rpc,
    me,
    ensureMe,
    flush,
    submitResult,
    isPending,
    dayStats: (game, day) => rpc('day_stats', { p_game: game, p_day: day }),
    async setNickname(text) {
      const nickname = cleanNickname(text);
      if (!nickname) throw new SocialError('bad_name');
      const answer = await asMe('set_nickname', { p_nickname: nickname });
      rememberNickname(answer?.nickname ?? nickname);
      return answer?.nickname ?? nickname;
    },
    async myGroups() {
      const answer = await asMe('my_groups');
      rememberNickname(answer?.nickname ?? null);
      return { nickname: answer?.nickname ?? null, groups: Array.isArray(answer?.groups) ? answer.groups : [] };
    },
    async createGroup(text) {
      const name = cleanGroupName(text);
      if (!name) throw new SocialError('bad_name');
      return asMe('create_group', { p_name: name });
    },
    async joinGroup(text) {
      const code = normalizeCode(text);
      if (!code) throw new SocialError('not_found');
      return asMe('join_group', { p_code: code });
    },
    leaveGroup: (code) => asMe('leave_group', { p_code: code }),
    groupBoard: (code, period = 'day') => asMe('group_board', { p_code: code, p_period: period }),
    async forgetMe() {
      if (me()) await rpc('forget_me', { p_id: me().id, p_secret: me().secret });
      for (const k of [ME_KEY, QUEUE_KEY, SENT_KEY]) store.remove(k);
    },
  };
}

// ---------- the page's own client ----------

const inBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
let storage = null;
try { storage = inBrowser ? window.localStorage : null; } catch { /* storage switched off */ }

export const social = createSocial({
  backend: BACKEND,
  storage,
  fetch: inBrowser && typeof fetch === 'function' ? fetch.bind(window) : undefined,
  online: () => !inBrowser || navigator.onLine !== false,
});

/** The groups page, wherever the site is hosted. */
export const GROUPS_PAGE = new URL('../groups/', import.meta.url).href;

// Anything left in the queue from an earlier visit goes out once the page has loaded, and again
// whenever the connection comes back.
if (inBrowser && social.enabled) {
  const retry = () => { social.flush(); };
  if (document.readyState === 'complete') setTimeout(retry, 0);
  else window.addEventListener('load', retry, { once: true });
  window.addEventListener('online', retry);
}

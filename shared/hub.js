// The hub: an illustrated map of the country, scrolled north to south. Each daily game is a stop on a
// dotted trail, with today's status read from its store; the party game waits at the southern end.
// A story deck (shared/hub-stories.js) plays through today's unplayed games one at a time.
import { GAMES, SITE } from './registry.js';
import { israelDate, dayNumber, dailyStatus, currentStreak, hebrewDate } from './core.js';
import { createStore, html, svg, startCountdown } from './ui.js';
import { drawMap, drawTrail, toPercent } from './hub-map.js';
import { createDeck } from './hub-stories.js';

// Where each game lives on the map, which side of its pin the label sits on, and a rough playing time.
const PLACES = {
  nekuda: { at: [33.2, 35.74], side: 'left', place: 'התצפית בחרמון', minutes: 3 },
  beerech: { at: [32.79, 35.01], side: 'left', place: 'השוק בחיפה', minutes: 2 },
  arba: { at: [32.08, 34.8], side: 'right', place: 'בית הקפה בתל אביב', minutes: 4 },
  tzir: { at: [31.78, 35.19], side: 'left', place: 'המוזיאון בירושלים', minutes: 3 },
  herkev: { at: [31.25, 34.8], side: 'right', place: 'הצומת בבאר שבע', minutes: 4 },
  yoter: { at: [30.6, 34.84], side: 'right', place: 'המכתש במצפה רמון', minutes: 2 },
  mitchaze: { at: [29.62, 34.96], side: 'right', place: 'החוף באילת', minutes: 10 },
};

const STATUS_TEXT = { new: 'חדש היום', playing: 'באמצע', won: 'נפתר', lost: 'לא הפעם', party: 'עם חברים' };
const withPlace = (g) => ({ ...g, ...PLACES[g.slug] });
const DAILY = GAMES.filter((g) => g.kind !== 'party').map(withPlace);
const PARTY = GAMES.filter((g) => g.kind === 'party').map(withPlace);
const STOPS = [...DAILY, ...PARTY];
const isDone = (status) => status === 'won' || status === 'lost';
const dark = matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- reading each game's store (exactly what the games write; see games/README.md) ----------

function statusFor(game) {
  if (game.kind === 'party') return { status: 'party', summary: '', streak: 0 };
  const saved = createStore(game.slug).load();
  const today = dayNumber(israelDate(), game.epoch);
  const status = dailyStatus(saved, today);
  return {
    status,
    summary: isDone(status) && typeof saved.summary === 'string' ? saved.summary : '',
    streak: currentStreak(saved.stats, today),
  };
}
const readStates = () => new Map(STOPS.map((g) => [g.slug, statusFor(g)]));

// sessionStorage may be switched off entirely (private mode); nothing here may throw.
const session = {
  get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, value); } catch { /* nothing to remember */ } },
  remove(key) { try { sessionStorage.removeItem(key); } catch { /* nothing to forget */ } },
};
const SEEN_KEY = 'hd:hub-seen'; // what the map showed last time in this tab, so a new result can pop in
const RUN_KEY = 'hd:hub-run'; // the game a story was started for, so coming back can offer the next one

// ---------- the map ----------

const mapArt = document.getElementById('map-art');
const pins = document.getElementById('games');
drawMap(mapArt);
drawTrail(mapArt, DAILY.map((g) => g.at), PARTY[0]?.at);

function statusNode(game, state) {
  const node = html('span', 'game-status');
  if (state.status === 'party') {
    node.textContent = 'משחק חברה';
    return node;
  }
  node.append(html('span', 'game-status-label', STATUS_TEXT[state.status]));
  if (state.summary) node.append(html('span', 'game-status-sep', ' · '), html('bdi', 'game-status-detail', state.summary));
  return node;
}

function mark(game, className) {
  const node = svg('svg', { viewBox: '0 0 28 28', 'aria-hidden': 'true', class: className });
  node.innerHTML = game.mark;
  return node;
}

const BADGES = {
  won: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  lost: '<path d="M7 7l10 10M17 7 7 17"/>',
};

function pin(game, state, { isNext, isNews, order }) {
  const li = html('li', 'game pin');
  li.dataset.game = game.slug;
  li.dataset.status = state.status;
  li.dataset.side = game.side;
  if (isNext) li.classList.add('is-next');
  const [x, y] = toPercent(game.at);
  li.style.left = x.toFixed(2) + '%';
  li.style.top = y.toFixed(2) + '%';
  li.style.setProperty('--accent', game.accent);
  li.style.setProperty('--accent-dark', game.accentDark);
  li.style.setProperty('--i', order);

  const dot = html('span', 'pin-dot');
  dot.setAttribute('aria-hidden', 'true');
  const place = html('span', 'pin-place', game.place);
  place.setAttribute('aria-hidden', 'true');

  const link = html('a', 'game-link');
  link.href = `games/${game.slug}/`;
  const card = html('span', 'game-card');
  const iconTile = html('span', 'pin-icon');
  iconTile.append(mark(game, 'pin-mark'));
  const text = html('span', 'pin-text');
  text.append(html('span', 'game-name', game.name), statusNode(game, state));
  card.append(iconTile, text, html('span', 'visually-hidden', `. ${game.place}`));
  if (BADGES[state.status]) {
    const badge = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'pin-badge' + (isNews ? ' is-news' : '') });
    badge.innerHTML = BADGES[state.status];
    card.append(badge);
  }
  link.append(card);
  li.append(dot, place, link);
  return li;
}

// Labels sit beside their pin; on a narrow screen one may be nudged back inside the map.
function fitLabels() {
  const box = pins.getBoundingClientRect();
  for (const li of pins.children) {
    const link = li.querySelector('.game-link');
    link.style.removeProperty('--nudge');
    const r = link.getBoundingClientRect();
    const margin = 8;
    let nudge = 0;
    if (r.left < box.left + margin) nudge = box.left + margin - r.left;
    else if (r.right > box.right - margin) nudge = box.right - margin - r.right;
    if (nudge) link.style.setProperty('--nudge', nudge.toFixed(1) + 'px');
  }
}

// ---------- the top bar and the call to action ----------

function renderBar(states) {
  const done = DAILY.filter((g) => isDone(states.get(g.slug).status)).length;
  const total = DAILY.length;
  const best = Math.max(0, ...DAILY.map((g) => states.get(g.slug).streak));
  document.getElementById('dateline').textContent = hebrewDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
  const progress = document.getElementById('progress');
  progress.style.setProperty('--done', done / total);
  progress.dataset.done = done === total ? 'all' : done ? 'some' : 'none';
  document.getElementById('progress-text').textContent = `${done}/${total} היום`;
  progress.setAttribute('aria-label', `סיימתם ${done} מתוך ${total} חידות היום`);

  const streak = document.getElementById('streak');
  streak.hidden = best < 2;
  streak.replaceChildren();
  if (best >= 2) {
    const flame = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'chip-icon' });
    flame.innerHTML = '<path d="M12 21.5c-4 0-6.5-2.6-6.5-6.2 0-3.4 2.3-5.2 3.6-8.3.4 1.9 1.4 3 2.5 3.6-.2-3 1-5.6 3.4-7.6-.2 3.2 1.4 5.2 2.6 7 .9 1.4 1.4 3 1.4 4.9 0 4-3 6.6-7 6.6Z"/>';
    streak.append(flame, html('span', '', `רצף ${best}`));
    streak.setAttribute('aria-label', `הרצף הארוך שלכם: ${best} ימים`);
  }

  const next = DAILY.find((g) => !isDone(states.get(g.slug).status));
  const label = document.getElementById('stories-label');
  const lede = document.getElementById('intro-lede');
  const cta = document.getElementById('stories-btn');
  cta.dataset.done = progress.dataset.done;
  if (done === 0) {
    label.textContent = 'שחקו את חידות היום';
    lede.textContent = 'חידה חדשה בכל תחנה, כל יום בחצות.';
  } else if (next) {
    label.textContent = `המשיכו: ${next.name}`;
    lede.textContent = `סיימתם ${done} מתוך ${total}. נשארו עוד ${total - done} תחנות.`;
  } else {
    label.textContent = 'סיכום היום ושיתוף';
    lede.textContent = 'סיימתם את כל התחנות של היום. כל הכבוד!';
  }
}

// ---------- share text: the site, the date, each game's short result, the link; never an answer ----------

function shareText() {
  const states = readStates();
  const done = DAILY.filter((g) => isDone(states.get(g.slug).status)).length;
  const lines = DAILY.map((g) => {
    const s = states.get(g.slug);
    const result = isDone(s.status) ? (s.summary || STATUS_TEXT[s.status]) : 'עוד לא';
    return `${s.status === 'won' ? '✓' : s.status === 'lost' ? '✗' : '·'} ${g.name}: ${result}`;
  });
  const date = hebrewDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' });
  return [`${SITE.name} · ${date}`, `${done}/${DAILY.length} חידות היום`, ...lines, location.origin + location.pathname].join('\n');
}

// ---------- putting it together ----------

const deck = createDeck({
  games: DAILY,
  getStates: readStates,
  shareText,
  onStart: (slug) => session.set(RUN_KEY, slug),
});

let lastStates = new Map();

function render({ first = false } = {}) {
  const states = readStates();
  lastStates = states;
  let seen = {};
  try { seen = JSON.parse(session.get(SEEN_KEY)) || {}; } catch { /* junk: treat as unseen */ }
  const today = israelDate();
  const key = (slug) => `${today}:${states.get(slug).status}`;
  const next = DAILY.find((g) => !isDone(states.get(g.slug).status));

  pins.classList.toggle('is-entering', first && !reducedMotion());
  pins.replaceChildren(...STOPS.map((g, i) => pin(g, states.get(g.slug), {
    isNext: g === next,
    isNews: seen[g.slug] !== undefined && seen[g.slug] !== key(g.slug),
    order: i,
  })));
  session.set(SEEN_KEY, JSON.stringify(Object.fromEntries(STOPS.map((g) => [g.slug, key(g.slug)]))));
  renderBar(states);
  mapArt.classList.toggle('is-drawing', first && !reducedMotion());
  fitLabels();
}

// Back from a game that was started from a story: if it is finished now, offer the next one.
function offerNext() {
  const params = new URLSearchParams(location.search);
  const asked = params.has('next');
  if (asked) {
    params.delete('next');
    const query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
  }
  const ran = session.get(RUN_KEY);
  session.remove(RUN_KEY);
  const finished = ran && DAILY.find((g) => g.slug === ran && isDone(lastStates.get(g.slug).status));
  if (finished) {
    const left = DAILY.some((g) => !isDone(lastStates.get(g.slug).status));
    deck.open({ message: left ? `סיימתם את ${finished.name}. הבא בתור:` : `סיימתם את ${finished.name}, וזו הייתה האחרונה להיום.` });
  } else if (asked) {
    deck.open();
  }
}

document.getElementById('stories-btn').addEventListener('click', () => deck.open());

render({ first: true });
offerNext();
startCountdown(document.getElementById('countdown'));

addEventListener('resize', () => requestAnimationFrame(fitLabels), { passive: true });
document.fonts?.ready.then(fitLabels);
// The deck is closed on the way out, so the page restored by the back button shows the map.
addEventListener('pagehide', () => deck.close());
// Coming back with the back button restores this page from cache; the statuses must catch up.
addEventListener('pageshow', (e) => { if (e.persisted) { render(); offerNext(); } });
dark.addEventListener?.('change', fitLabels);

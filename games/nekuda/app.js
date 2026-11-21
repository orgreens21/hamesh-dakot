import { LOCALITIES } from './data.js';
import * as G from './game.js';
import { MED_COAST, LAKES, JORDAN_RIVER } from './mapshapes.js';
import { dateOfDay, hebrewDate } from '../../shared/core.js';
import { tilt, stamp, celebrate, countUp } from '../../shared/fx.js';
import { createStore, mountHeader, html, svg, toast, shareResult, whatsappLink, gameUrl, startCountdown, wireDialog, renderStats } from '../../shared/ui.js';
import { dayStatsPanel } from '../../shared/social-ui.js';

const TITLE = 'נקודת ציון';

// Map projection: equirectangular, squeezed east-west for Israel's latitude.
const MAP = { north: 33.4, south: 29.4, west: 34.2, east: 35.95, scale: 100, squeeze: 0.8535 };
MAP.width = (MAP.east - MAP.west) * MAP.scale * MAP.squeeze;
MAP.height = (MAP.north - MAP.south) * MAP.scale;
const project = (l) => [(l.lon - MAP.west) * MAP.scale * MAP.squeeze, (MAP.north - l.lat) * MAP.scale];
const kmToMapUnits = (km) => (km / 111.19) * MAP.scale;

const localities = LOCALITIES.map(G.toLocality);
const byName = new Map(localities.map((l) => [l.name, l]));
const searchIndex = G.buildSearchIndex(localities);
const pool = G.buildTargetPool(localities);

const $ = (id) => document.getElementById(id);
const el = {
  input: $('guess-input'), suggestions: $('suggestions'), hints: $('hints'), guesses: $('guesses'), map: $('map'), mapWrap: $('map-wrap'),
  end: $('end'), endStamp: $('end-stamp'), endTrail: $('end-trail'), endTitle: $('end-title'), endSub: $('end-sub'), endStreak: $('end-streak'), shareBtn: $('share-btn'), whatsappBtn: $('whatsapp-btn'),
  nextWrap: $('next-wrap'), countdown: $('countdown'), practiceBtn: $('practice-btn'), banner: $('mode-banner'),
  helpDialog: $('help-dialog'),
};
const header = mountHeader({ slug: 'nekuda', onHelp: openHelp, onStats: openStats });

// ---------- persistence ----------

const store = createStore('nekuda');
const today = G.dayNumber(G.israelDate());
const saved = store.loadDaily(today, G.MAX_GUESSES);
let stats = saved.stats;
let seenHelp = saved.seenHelp;
let dailyGuesses = Array.isArray(saved.progress?.guesses) ? saved.progress.guesses.filter((n) => byName.has(n)).slice(0, G.MAX_GUESSES) : [];

/** Only the daily game is ever saved; the top-level fields are the ones the hub reads. */
function save() {
  const results = dailyGuesses.map((n) => G.evaluateGuess(byName.get(n), G.targetForDay(pool, today)));
  const won = results.some((r) => r.win);
  const finished = won || results.length >= G.MAX_GUESSES;
  store.save({
    day: today, finished, won, summary: finished ? G.summary(results) : '', stats, seenHelp,
    progress: dailyGuesses.length ? { guesses: dailyGuesses } : null,
  });
}

// ---------- game state ----------

// mode: 'daily' counts toward stats; 'archive' (?day=N) and 'practice' do not.
// `focus` is the guess whose range ring the player asked to see again; null follows the latest guess.
const game = { mode: 'daily', day: today, target: null, results: [], focus: null };

function startDaily() {
  const requested = Number(new URLSearchParams(location.search).get('day'));
  if (Number.isInteger(requested) && requested >= 1 && requested < today) {
    Object.assign(game, { mode: 'archive', day: requested, target: G.targetForDay(pool, requested), results: [], focus: null });
  } else {
    const target = G.targetForDay(pool, today);
    Object.assign(game, { mode: 'daily', day: today, target, results: dailyGuesses.map((n) => G.evaluateGuess(byName.get(n), target)), focus: null });
  }
  render();
}

function startPractice() {
  let target;
  do target = pool[Math.floor(Math.random() * pool.length)];
  while (target === game.target);
  Object.assign(game, { mode: 'practice', day: 0, target, results: [], focus: null });
  render();
  if (!matchMedia('(pointer: coarse)').matches) el.input.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const isWon = () => game.results.some((r) => r.win);
const isOver = () => isWon() || game.results.length >= G.MAX_GUESSES;

function submitGuess(locality) {
  if (isOver()) return;
  if (game.results.some((r) => r.name === locality.name)) return toast('כבר ניחשתם את ' + locality.name);
  game.results.push(G.evaluateGuess(locality, game.target));
  game.focus = null;
  if (game.mode === 'daily') {
    dailyGuesses = game.results.map((r) => r.name);
    if (isOver()) stats = G.recordResult(stats, today, isWon(), game.results.length);
    save();
  }
  el.input.value = '';
  closeSuggestions();
  if (matchMedia('(pointer: coarse)').matches || isOver()) el.input.blur();
  render({ animateLast: true });
  if (isOver()) {
    el.end.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // The field is switched off now; a keyboard player lands on the result rather than nowhere.
    if (!matchMedia('(pointer: coarse)').matches) el.endTitle.focus({ preventScroll: true });
  }
  if (isWon()) celebrate({ origin: el.endStamp });
}

// ---------- rendering ----------

function heat(result) {
  if (result.win) return 'var(--found)';
  if (result.pct >= 85) return 'var(--close)'; // within ~10 km
  if (result.pct >= 70) return 'var(--near)'; // within ~40 km
  if (result.pct >= 50) return 'var(--mid)'; // within ~110 km
  return 'var(--far)';
}

/** The guess whose ring is drawn in full: the one the player picked, else the latest miss while playing. */
function shownIndex() {
  if (game.focus != null) return game.focus;
  if (isOver()) return -1;
  return game.results.length - 1;
}

function renderGuesses(animateLast) {
  el.guesses.replaceChildren();
  const shown = shownIndex();
  for (let i = 0; i < G.MAX_GUESSES; i++) {
    const r = game.results[i];
    const li = html('li', 'guess ' + (r ? 'filled' : 'empty'));
    const n = html('span', 'n', i + 1);
    if (!r) {
      if (i === game.results.length && !isOver()) li.classList.add('upnext');
      li.append(n);
      el.guesses.append(li);
      continue;
    }
    const fresh = animateLast && i === game.results.length - 1;
    if (fresh) li.classList.add('fresh');
    li.style.setProperty('--pct', r.pct + '%');
    li.style.setProperty('--heat', heat(r));
    const body = html('div', 'body');
    const km = html('span', 'km');
    body.append(html('span', 'name', r.name), km);
    let dial;
    if (r.win) {
      km.textContent = 'בול!';
      li.classList.add('win');
      dial = html('span', 'arrow');
      const icon = svg('svg', { viewBox: '0 0 36 36' });
      icon.append(svg('path', { d: 'm11 18.5 5 5 9.5-10.5' }));
      dial.append(icon);
      li.setAttribute('aria-label', `ניחוש ${i + 1}: ${r.name}, נכון`);
    } else {
      // Two pieces, so a long direction drops to its own line on a narrow phone instead of running into the compass.
      const num = html('span', 'num', r.km);
      const dist = html('span', 'len'); // not 'dist': that class is the stats chart
      dist.append(num, ' ק״מ');
      km.append(dist, html('span', 'dir', G.DIRECTION_NAMES[r.dir]));
      // The distance runs up like an odometer while the ring is swept on the map.
      if (fresh) countUp(num, r.km, { duration: 650 });
      // A compass needle: the coloured half points toward the hidden locality.
      dial = html('button', 'arrow fx-press');
      dial.type = 'button';
      dial.setAttribute('aria-label', `הצגת הטווח של ${r.name} על המפה`);
      dial.setAttribute('aria-pressed', String(i === shown));
      const deg = Math.round(r.deg);
      const icon = svg('svg', { viewBox: '0 0 36 36', style: `--deg: ${deg}deg; transform: rotate(${deg}deg)` });
      icon.append(svg('path', { class: 'needle-n', d: 'M18 4.5 22.5 18h-9Z' }), svg('path', { class: 'needle-s', d: 'M18 31.5 22.5 18h-9Z' }));
      dial.append(icon);
      li.dataset.index = i;
      li.setAttribute('aria-label', `ניחוש ${i + 1}: ${r.name}, ${r.km} קילומטר, כיוון ${G.DIRECTION_NAMES[r.dir]}`);
    }
    li.append(body, n, dial);
    el.guesses.append(li);
  }
}

/** Tapping a written entry (or its compass) puts that guess's ring back on the map; tapping it again lets go. */
el.guesses.addEventListener('click', (e) => {
  const li = e.target.closest('.guess[data-index]');
  if (!li) return;
  const i = Number(li.dataset.index);
  const latest = isOver() ? -1 : game.results.length - 1;
  game.focus = i === shownIndex() || i === latest ? null : i;
  const shown = shownIndex();
  // Updated in place so the pressed compass keeps the keyboard focus.
  for (const row of el.guesses.querySelectorAll('.guess[data-index]')) {
    row.querySelector('.arrow').setAttribute('aria-pressed', String(Number(row.dataset.index) === shown));
  }
  renderMap(false);
});

const points = (list) => list.map((p) => project({ lat: p[0], lon: p[1] }).map((v) => v.toFixed(1)).join(',')).join(' L');

/** Everything on the map that never changes: water, grid, scale bar and the locality dots. */
function buildMapBase() {
  const base = svg('g');
  const lastCoastY = project({ lat: MED_COAST.at(-1)[0], lon: MAP.west })[1].toFixed(1);
  const water = `M0,0 L${points(MED_COAST)} L0,${lastCoastY} Z ` + LAKES.map((lake) => `M${points(lake)} Z`).join(' ');
  base.append(svg('path', { class: 'sea', d: water }), svg('path', { class: 'river', d: 'M' + points(JORDAN_RIVER) }));

  const grid = svg('g', { class: 'grid' });
  const furniture = svg('g', { class: 'furniture' });
  for (let lat = 30; lat <= 33; lat += 0.5) {
    const y = project({ lat, lon: MAP.west })[1];
    grid.append(svg('line', { x1: 0, x2: MAP.width, y1: y, y2: y }));
    if (Number.isInteger(lat) && lat < 33) furniture.append(svg('text', { x: 3, y: y - 2.5 }, lat + '°'));
  }
  for (let lon = 34.5; lon <= 35.5; lon += 0.5) {
    const x = project({ lat: MAP.north, lon })[0];
    grid.append(svg('line', { x1: x, x2: x, y1: 0, y2: MAP.height }));
  }
  // Scale bar (50 km) in the empty south-west corner, north arrow out at sea.
  const bar = kmToMapUnits(50);
  furniture.append(
    svg('path', { d: `M8,386 v4 h${bar.toFixed(1)} v-4` }),
    svg('text', { x: 8 + bar / 2, y: 383, 'text-anchor': 'middle' }, '50 ק״מ'),
    svg('path', { d: 'M14,36 V13 M9.5,19.5 14,12.5 18.5,19.5' }),
    svg('text', { x: 14, y: 46, 'text-anchor': 'middle' }, 'צ'),
  );

  const dots = svg('g', { class: 'bg' });
  for (const l of localities) {
    const [x, y] = project(l);
    dots.append(svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: l.pop >= 50000 ? 1.9 : 1.1 }));
  }
  base.append(grid, furniture, dots);
  return base;
}

let mapBase;
function renderMap(animateLast) {
  if (!mapBase) {
    el.map.setAttribute('viewBox', `0 0 ${MAP.width.toFixed(1)} ${MAP.height}`);
    mapBase = buildMapBase();
  }
  const layer = svg('g', { class: animateLast ? 'fresh' : '' });
  const over = isOver();
  const shown = shownIndex();
  const last = game.results.length - 1;
  const misses = game.results.map((r, i) => ({ r, i, at: project(byName.get(r.name)) })).filter((g) => !g.r.win);
  for (const { r, i, at } of misses) {
    // After the end the rings are gone, unless the player asks to see one again.
    if (over && i !== shown) continue;
    const radius = kmToMapUnits(r.km);
    const fresh = animateLast && i === last && !over;
    const ring = svg('circle', { class: 'ring' + (i === last ? ' latest' : '') + (i === shown ? ' shown' : '') + (fresh ? ' fresh' : ''), cx: at[0], cy: at[1], r: radius, stroke: heat(r) });
    layer.append(ring);
    if (fresh) {
      // Drawn like a pair of compasses: the arm turns once around the pin while the circle follows it.
      ring.style.setProperty('--len', (2 * Math.PI * radius).toFixed(1));
      layer.append(svg('line', { class: 'sweep', x1: at[0], y1: at[1], x2: at[0] + radius, y2: at[1], stroke: heat(r), style: `transform-origin: ${at[0]}px ${at[1]}px` }));
    }
  }
  if (over) {
    const [x, y] = project(game.target);
    misses.forEach(({ at }, order) => {
      layer.append(svg('line', { class: 'route', x1: at[0], y1: at[1], x2: x, y2: y, style: `--i: ${order}` }));
    });
  }
  for (const { r, i, at } of misses) {
    const pin = svg('g', { class: 'pin' + (animateLast && i === last ? ' fresh' : '') });
    pin.append(svg('circle', { cx: at[0], cy: at[1], r: 7.5, fill: heat(r) }), svg('text', { x: at[0], y: at[1] + 0.5 }, i + 1));
    layer.append(pin);
  }
  if (over) {
    // The answer is planted as a survey-point triangle, the same mark as the logo, with its name under it.
    const [x, y] = project(game.target);
    const target = svg('g', { class: 'target' });
    const mark = svg('g', { class: 'mark' });
    mark.append(svg('path', { d: `M${x},${y - 12} ${x + 10.5},${y + 6} ${x - 10.5},${y + 6}Z` }), svg('circle', { class: 'dot', cx: x, cy: y + 0.5, r: 2.4 }));
    const half = game.target.name.length * 2.9 + 3; // rough half-width of the label, to keep it on the sheet
    const labelX = Math.min(MAP.width - half, Math.max(half, x));
    const label = svg('text', { class: 'label', x: labelX.toFixed(1), y: y > MAP.height - 26 ? y - 17 : y + 18 }, game.target.name);
    target.append(svg('circle', { class: 'pulse', cx: x, cy: y, r: 7 }), mark, label);
    layer.append(target);
  }
  el.map.replaceChildren(mapBase, layer);
}

let hintsOpen = 0;
function renderHints(animate) {
  el.hints.replaceChildren();
  const hints = G.hintsFor(game.target, game.results.length, isOver());
  hints.forEach((hint, i) => {
    // Only a card that opened with this move turns over; the rest are already lying face up.
    const li = html('li', hint.value ? (animate && i >= hintsOpen ? 'open fresh' : 'open') : '');
    li.append(hint.label, html('b', '', hint.value ?? `אחרי ניחוש ${hint.unlockAfter}`));
    el.hints.append(li);
  });
  hintsOpen = hints.filter((hint) => hint.value).length;
}

const CHECK = 'm5 12.5 4.5 4.5L19 7';

function renderEnd(animate) {
  const over = isOver();
  el.end.hidden = !over;
  el.input.disabled = over;
  el.input.placeholder = over ? 'המשחק הסתיים' : `ניחוש ${game.results.length + 1} מתוך ${G.MAX_GUESSES}: שם של יישוב…`;
  if (!over) return;
  const n = game.results.length;
  const praise = ['מטורף! ניחוש ראשון', 'נווט מלידה!', 'יפה מאוד!', 'כל הכבוד!', 'מצאתם!', 'ברגע האחרון!'];
  el.endTitle.textContent = isWon() ? praise[n - 1] : 'לא נורא, מחר יום חדש';

  // The same stamp the hub puts on this game's sheet.
  el.endStamp.replaceChildren();
  const mark = stamp(el.endStamp, isWon()
    ? { text: `נפתר ${G.summary(game.results)}`, tone: 'found', big: true, icon: 'check', delay: 500 }
    : { text: 'לא הפעם', tone: 'ink', big: true, delay: 500 });
  if (!animate) mark.classList.remove('fx-stamp-in');

  el.endTrail.replaceChildren();
  for (let i = 0; i < G.MAX_GUESSES; i++) {
    const r = game.results[i];
    const li = html('li', r ? '' : 'unused');
    const dot = html('i');
    if (r) dot.style.setProperty('--heat', heat(r));
    if (r?.win) {
      const tick = svg('svg', { viewBox: '0 0 24 24' });
      tick.append(svg('path', { d: CHECK }));
      dot.append(tick);
    }
    li.append(dot, r ? (r.win ? 'בול' : `${r.km} ק״מ`) : '');
    el.endTrail.append(li);
  }

  el.endSub.replaceChildren(isWon() ? `מצאתם את ` : 'היישוב היה ');
  const link = html('a', '', game.target.name);
  link.href = 'https://he.wikipedia.org/wiki/' + encodeURIComponent(game.target.name.replace(/ /g, '_'));
  link.target = '_blank';
  link.rel = 'noopener';
  el.endSub.append(link, isWon() ? ` ב-${n} ${n === 1 ? 'ניחוש' : 'ניחושים'}` : '');
  const streak = game.mode === 'daily' && isWon() ? G.currentStreak(stats, today) : 0;
  el.endStreak.hidden = streak < 2;
  el.endStreak.textContent = `רצף של ${streak} ימים`;
  const shareable = game.mode !== 'practice';
  el.shareBtn.hidden = !shareable;
  el.whatsappBtn.hidden = !shareable;
  if (shareable) el.whatsappBtn.href = whatsappLink(buildShareText());
  el.nextWrap.hidden = game.mode === 'practice';
  el.practiceBtn.textContent = game.mode === 'practice' ? 'עוד סיבוב' : 'עוד סיבוב לאימון';
  // Today's result goes to the group boards; archive and practice rounds never do.
  dayStatsPanel(el.end, game.mode === 'daily'
    ? { game: 'nekuda', day: game.day, points: G.points(game.results), won: isWon(), summary: G.summary(game.results) }
    : null);
}

function renderPuzzleLabel() {
  if (game.mode === 'practice') { header.setLabel('סיבוב אימון'); return; }
  header.setLabel(`חידה ${game.day} · ${hebrewDate(dateOfDay(game.day, G.EPOCH))}`);
}

function renderBanner() {
  el.banner.hidden = game.mode === 'daily';
  el.banner.replaceChildren();
  if (game.mode === 'daily') return;
  el.banner.append(game.mode === 'practice' ? 'מצב אימון – לא נספר בסטטיסטיקה · ' : `חידה מהארכיון #${game.day} · `);
  const back = html('button', 'link', 'חזרה לחידה היומית');
  back.addEventListener('click', () => { history.replaceState(null, '', location.pathname); startDaily(); });
  el.banner.append(back);
}

function render({ animateLast = false } = {}) {
  renderBanner();
  renderPuzzleLabel();
  renderGuesses(animateLast);
  renderMap(animateLast);
  renderHints(animateLast);
  renderEnd(animateLast);
}

// ---------- autocomplete ----------

let matches = [];
let active = -1;

function closeSuggestions() {
  matches = [];
  active = -1;
  el.suggestions.hidden = true;
  el.suggestions.replaceChildren();
  el.input.setAttribute('aria-expanded', 'false');
  el.input.removeAttribute('aria-activedescendant');
}

function renderSuggestions() {
  const query = el.input.value;
  matches = G.searchLocalities(searchIndex, query);
  if (!G.normalize(query)) return closeSuggestions();
  active = matches.length ? 0 : -1;
  el.suggestions.replaceChildren();
  if (!matches.length) el.suggestions.append(html('li', 'none', 'לא מצאנו יישוב כזה'));
  const used = new Set(game.results.map((r) => r.name));
  matches.forEach((l, i) => {
    const li = html('li', used.has(l.name) ? 'used' : '', l.name);
    li.id = 'sg-' + i;
    li.setAttribute('role', 'option');
    li.append(html('small', '', G.TYPE_LABELS[l.type]));
    // mousedown fires before the input loses focus, so the tap is never swallowed by blur.
    li.addEventListener('mousedown', (e) => { e.preventDefault(); submitGuess(l); });
    el.suggestions.append(li);
  });
  el.suggestions.hidden = false;
  el.input.setAttribute('aria-expanded', 'true');
  highlight();
}

function highlight() {
  [...el.suggestions.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
  if (active >= 0) {
    el.input.setAttribute('aria-activedescendant', 'sg-' + active);
    el.suggestions.children[active]?.scrollIntoView({ block: 'nearest' });
  }
}

// Closing is delayed so a tap on a suggestion lands first; typing again cancels a pending close.
let closeTimer;
const showSuggestions = () => { clearTimeout(closeTimer); renderSuggestions(); };
el.input.addEventListener('input', showSuggestions);
el.input.addEventListener('focus', showSuggestions);
el.input.addEventListener('blur', () => { closeTimer = setTimeout(closeSuggestions, 120); });
el.input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!matches.length) return;
    e.preventDefault();
    active = (active + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
    highlight();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (matches[active]) submitGuess(matches[active]);
    else if (G.normalize(el.input.value)) toast('בחרו יישוב מהרשימה');
  } else if (e.key === 'Escape') {
    closeSuggestions();
  }
});

// ---------- sharing, stats, dialogs ----------

function buildShareText() {
  const url = gameUrl() + (game.mode === 'archive' ? `?day=${game.day}` : '');
  return G.shareText({ title: TITLE, day: game.day, results: game.results, url });
}

function openStats() {
  const wonToday = stats.lastWinDay === today ? dailyGuesses.length : 0;
  renderStats({ stats, day: today, distTitle: 'באיזה ניחוש מצאתי', highlight: wonToday - 1 }).showModal();
}

function openHelp() { el.helpDialog.showModal(); }
$('help-link').addEventListener('click', openHelp);
el.shareBtn.addEventListener('click', () => shareResult(buildShareText()));
el.practiceBtn.addEventListener('click', startPractice);
el.helpDialog.addEventListener('close', () => {
  // On a first visit the map unfolds once the rules are out of the way, where it can be seen.
  if (!seenHelp) settleMap();
  seenHelp = true;
  save();
});
wireDialog(el.helpDialog);

/** The map lands on the desk at an angle and settles flat. */
function settleMap() {
  el.mapWrap.classList.remove('settle');
  void el.mapWrap.offsetWidth;
  el.mapWrap.classList.add('settle');
}

// The sheet leans toward the pointer, or with the phone where the browser allows it without asking.
tilt(el.mapWrap, { gyro: true });

startDaily();
startCountdown(el.countdown);
if (!seenHelp) openHelp();
else settleMap();

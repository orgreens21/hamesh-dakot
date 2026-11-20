// DOM helpers shared by every game: storage, header, dialogs, sharing, countdown, stats.
// Styles for everything rendered here live in shared/base.css.
import { israelDate, msUntilNextPuzzle, formatCountdown, currentStreak, winRate, dailyState } from './core.js';
import { gameBySlug } from './registry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Every page imports this module, and a page's own script draws the game as it is evaluated. This
// microtask runs right after that, before anything is painted: the frame in the HTML is revealed
// only once it is filled (see .is-ready in base.css).
queueMicrotask(() => document.documentElement.classList.add('is-ready'));

// ---------- element builders ----------

export function html(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

// Line icons on a 24×24 grid, drawn so that no emoji is ever needed as an interface icon.
const ICONS = {
  help: '<circle cx="12" cy="12" r="9.25"/><path d="M9.4 9.3a2.7 2.7 0 1 1 4.1 2.3c-.9.6-1.5 1.1-1.5 2.2"/><circle cx="12" cy="17.1" r=".7" class="solid"/>',
  stats: '<path d="M5 20v-6M12 20V4M19 20V9"/>',
  share: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 13v6.5h14V13"/>',
  // "Back" points right because the whole site reads right to left.
  back: '<path d="m9.5 5 7 7-7 7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  cross: '<path d="M6 6l12 12M18 6 6 18"/>',
  up: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>',
  down: '<path d="M12 5v14M5.5 12.5 12 19l6.5-6.5"/>',
  again: '<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5M19.5 4v4.5H15"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
};

/** A drawn icon: help, stats, share, back, check, cross, up, down, again, search. */
export function icon(name) {
  const node = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'icon' });
  node.innerHTML = ICONS[name] || '';
  return node;
}

// ---------- storage ----------

/**
 * One JSON object per game under localStorage key "hd:<slug>".
 * Storage can be missing (private mode) or hold junk; neither may break a game, so load()
 * falls back to {} and save() reports failure instead of throwing.
 */
export function createStore(slug) {
  const key = 'hd:' + slug;
  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
    } catch { /* private mode or corrupted value: start fresh */ }
    return {};
  };
  return {
    key,
    load,
    /** Today's state with the standard fields filled in (see dailyState in core.js). */
    loadDaily: (today, buckets = 6) => dailyState(load(), today, buckets),
    save(state) {
      try { localStorage.setItem(key, JSON.stringify(state)); return true; } catch { return false; }
    },
  };
}

// ---------- toast ----------

let toastTimer;
export function toast(message, ms = 2200) {
  let node = document.getElementById('toast');
  if (!node) {
    node = html('div', 'toast');
    node.id = 'toast';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    document.body.append(node);
  }
  node.textContent = message;
  // Reading layout forces the hidden state to be painted first, so a brand-new toast still slides in.
  void node.offsetWidth;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), ms);
}

// ---------- sharing ----------

/** The address to put in share text: this game's page, without query or hash. */
export function gameUrl() {
  return location.origin + location.pathname;
}

export function whatsappLink(text) {
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}

/** Resolves to 'shared', 'cancelled', 'copied' or 'failed'. Shows its own toast after copying. */
export async function shareResult(text, copiedMessage = 'התוצאה הועתקה – הדביקו בקבוצה') {
  // The native share sheet is only worth it on phones; on desktop, copying is what people expect.
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ text }); return 'shared'; } catch (err) { if (err.name === 'AbortError') return 'cancelled'; }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(copiedMessage);
    return 'copied';
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    toast(ok ? copiedMessage : 'לא הצלחנו להעתיק');
    return ok ? 'copied' : 'failed';
  }
}

// ---------- countdown ----------

/**
 * Writes HH:MM:SS until the next Israel midnight into the element, every second.
 * When the date flips while the tab is open, onNewDay runs once (default: reload into the new puzzle).
 * Returns a function that stops the timer.
 */
export function startCountdown(element, onNewDay = () => location.reload()) {
  const startedOn = israelDate();
  let timer;
  const tick = () => {
    if (israelDate() !== startedOn) { clearInterval(timer); onNewDay(); return; }
    element.textContent = formatCountdown(msUntilNextPuzzle());
  };
  tick();
  timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}

// ---------- dialogs ----------

/**
 * Clicking the dimmed area around a dialog closes it. Escape already does, natively.
 * Two details of opening:
 * - A dialog taller than the screen opens at its top: the browser focuses the first button, which
 *   is the one at the bottom, and would otherwise scroll the rules past their own heading.
 * - The second half of a double tap on whatever opened the dialog lands on the dimmed area. For the
 *   first moments that does not count as "close", or the dialog would flash and vanish.
 */
export function wireDialog(dialog) {
  let openedAt = -Infinity;
  dialog.addEventListener('click', (e) => { if (e.target === dialog && performance.now() - openedAt > 400) dialog.close(); });
  const showModal = dialog.showModal.bind(dialog);
  dialog.showModal = () => {
    showModal();
    openedAt = performance.now();
    dialog.scrollTop = 0;
    // Safari brings the focused button into view a frame later.
    requestAnimationFrame(() => { dialog.scrollTop = 0; });
  };
  return dialog;
}

/**
 * Fills the standard stats dialog (created on first use as #stats-dialog) and returns it; call .showModal() on it.
 *   stats      the stats object from the store
 *   day        today's day number (decides whether the streak is still alive)
 *   distTitle  heading above the distribution chart; pass null to leave the chart out
 *   labels     one label per distribution bucket (default 1, 2, 3…)
 *   highlight  index of the bucket today's win landed in, or -1
 */
export function renderStats({ stats, day, distTitle = 'באיזה ניחוש הצלחתי', labels, highlight = -1, title = 'הסטטיסטיקה שלי' }) {
  let dialog = document.getElementById('stats-dialog');
  if (!dialog) {
    dialog = html('dialog', 'sheet');
    dialog.id = 'stats-dialog';
    document.body.append(dialog);
    wireDialog(dialog);
  }
  const grid = html('div', 'stat-grid');
  const cells = [[stats.played, 'משחקים'], [winRate(stats), '% הצלחה'], [currentStreak(stats, day), 'רצף נוכחי'], [stats.maxStreak, 'שיא רצף']];
  for (const [value, label] of cells) {
    const cell = html('div');
    cell.append(html('b', '', value), html('span', '', label));
    grid.append(cell);
  }
  dialog.replaceChildren(html('h2', '', title), grid);

  if (distTitle != null) {
    const names = labels || stats.distribution.map((_, i) => String(i + 1));
    const max = Math.max(1, ...stats.distribution);
    const dist = html('ol', 'stat-dist');
    dist.id = 'dist';
    // Every row is its own grid, so the label column needs one explicit width to line the bars up.
    dist.style.setProperty('--dist-label', Math.max(...names.map((n) => String(n).length)) + 'ch');
    stats.distribution.forEach((count, i) => {
      // <bdi>: a label such as "250+" keeps its plus sign after the number on a right-to-left page.
      const li = html('li');
      li.append(html('bdi', '', names[i]));
      const bar = html('span', 'bar' + (highlight === i ? ' today' : ''), count);
      bar.style.setProperty('--w', Math.round((count / max) * 100) + '%');
      li.append(bar);
      dist.append(li);
    });
    dialog.append(html('h3', '', distTitle), dist);
  }

  const form = html('form');
  form.method = 'dialog';
  form.append(html('button', 'btn ghost', 'סגירה'));
  dialog.append(form);
  return dialog;
}

// ---------- header ----------

/**
 * Renders the standard game header into the placeholder (default: the element with id="header").
 *   slug     the game's slug; name and mark come from shared/registry.js
 *   onHelp   click handler for the help button
 *   onStats  click handler for the stats button; leave it out and the button is not rendered (party games)
 *   name, mark  only for a game that is not in the registry (the template)
 * Returns { root, setLabel(text), helpButton, statsButton }.
 */
export function mountHeader({ slug, onHelp, onStats, name, mark, target = '#header', hubUrl = '../../' }) {
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  const game = gameBySlug(slug) || {};
  // base.css keys the accent colour off this attribute; pages should also set it in their HTML to avoid a flash.
  document.documentElement.dataset.game = slug;
  root.classList.add('top');

  const back = html('a', 'icon-btn back');
  back.href = hubUrl;
  back.setAttribute('aria-label', 'חזרה לכל המשחקים');
  back.append(icon('back'));

  const brand = html('div', 'brand');
  const h1 = html('h1');
  const markSvg = svg('svg', { class: 'brand-mark', viewBox: '0 0 28 28', 'aria-hidden': 'true' });
  markSvg.innerHTML = mark ?? game.mark ?? '';
  h1.append(markSvg, name ?? game.name ?? slug);
  const label = html('p', 'puzzle-label');
  label.id = 'puzzle-label';
  brand.append(h1, label);

  const actions = html('div', 'top-actions');
  const button = (id, text, iconName, handler) => {
    const b = html('button', 'icon-btn');
    b.id = id;
    b.type = 'button';
    b.setAttribute('aria-label', text);
    b.append(icon(iconName));
    b.addEventListener('click', handler);
    actions.append(b);
    return b;
  };
  const helpButton = onHelp ? button('help-btn', 'איך משחקים', 'help', onHelp) : null;
  const statsButton = onStats ? button('stats-btn', 'סטטיסטיקה', 'stats', onStats) : null;

  root.replaceChildren(back, brand, actions);
  return { root, helpButton, statsButton, setLabel: (text) => { label.textContent = text; } };
}

// ---------- end-of-game panel ----------

const countdownStops = new WeakMap();

/**
 * Fills the standard end panel: title, one line of detail, streak, share + WhatsApp, countdown, extra buttons.
 *   container  a <section> in the page (it gets class "end" and is un-hidden)
 *   title      short headline
 *   sub        string or DOM node under the title (the place for the answer)
 *   streak     current streak; shown from 2 up
 *   shareText  string, or a function returning one; leave out to hide both share buttons (practice rounds)
 *   countdown  false hides "next puzzle in…" (practice rounds, party games)
 *   actions    extra nodes (usually .btn.ghost buttons) placed under the countdown
 * Returns { shareButton, whatsappButton, countdownEl }.
 */
export function renderEnd(container, { title, sub, streak = 0, shareText, countdown = true, actions = [] }) {
  countdownStops.get(container)?.();
  container.classList.add('end');
  container.hidden = false;

  const h2 = html('h2', 'end-title', title);
  h2.id = 'end-title';
  h2.tabIndex = -1; // not a tab stop, but a game can hand the keyboard focus to the result when its last control goes away
  const subEl = html('p', 'end-sub');
  subEl.id = 'end-sub';
  if (sub != null) subEl.append(sub);
  container.replaceChildren(h2, subEl);

  if (streak >= 2) {
    const streakEl = html('p', 'end-streak', `רצף של ${streak} ימים`);
    streakEl.id = 'end-streak';
    container.append(streakEl);
  }

  let shareButton = null;
  let whatsappButton = null;
  if (shareText) {
    const text = () => (typeof shareText === 'function' ? shareText() : shareText);
    const row = html('div', 'end-actions');
    shareButton = html('button', 'btn primary');
    shareButton.id = 'share-btn';
    shareButton.type = 'button';
    shareButton.append(icon('share'), 'שיתוף התוצאה');
    shareButton.addEventListener('click', () => shareResult(text()));
    whatsappButton = html('a', 'btn whatsapp', 'שליחה בוואטסאפ');
    whatsappButton.id = 'whatsapp-btn';
    whatsappButton.target = '_blank';
    whatsappButton.rel = 'noopener';
    whatsappButton.href = whatsappLink(text());
    row.append(shareButton, whatsappButton);
    container.append(row);
  }

  let countdownEl = null;
  if (countdown) {
    const next = html('p', 'next', 'החידה הבאה בעוד ');
    countdownEl = html('span', '', '--:--:--');
    countdownEl.id = 'countdown';
    countdownEl.dir = 'ltr';
    next.append(countdownEl);
    container.append(next);
    countdownStops.set(container, startCountdown(countdownEl));
  }

  container.append(...actions);
  return { shareButton, whatsappButton, countdownEl };
}

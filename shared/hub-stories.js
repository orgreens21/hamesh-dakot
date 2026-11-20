// The story deck: today's unplayed games one at a time, full screen, in trail order.
// Swipe, tap the sides, use the arrow buttons or the arrow keys. When the day is done, one last card
// sums it up with the countdown and a share button.
import { html, svg, startCountdown, shareResult, whatsappLink } from './ui.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDone = (s) => s.status === 'won' || s.status === 'lost';
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * games   the daily games in trail order, each with { slug, name, tagline, accent, mark, place, minutes }
 * getStates()  a Map slug -> { status, summary }, read fresh whenever the deck opens
 * shareText()  the text of the day's share
 * onStart(slug)  called just before a story's start link is followed
 */
export function createDeck({ games, getStates, shareText, onStart }) {
  const $ = (id) => document.getElementById(id);
  const dialog = $('deck');
  const stage = $('deck-stage');
  const bars = $('deck-bars');
  const count = $('deck-count');
  const hint = $('deck-hint');
  const intro = $('deck-intro');
  const prevBtn = $('deck-prev');
  const nextBtn = $('deck-next');

  let cards = []; // slugs of unplayed games, then 'done' when nothing is left
  let index = 0;
  let states = new Map();
  let opener = null;
  let stopCountdown = () => {};

  function build() {
    states = getStates();
    const left = games.filter((g) => !isDone(states.get(g.slug)));
    cards = left.length ? left.map((g) => g.slug) : ['done'];
  }

  function renderBars() {
    const current = cards[index];
    bars.replaceChildren(...games.map((g) => {
      const li = html('li');
      li.dataset.state = isDone(states.get(g.slug)) ? 'done' : g.slug === current ? 'current' : 'todo';
      return li;
    }));
  }

  function storyCard(game) {
    const state = states.get(game.slug);
    const position = games.indexOf(game) + 1;
    const card = html('article', 'story');
    card.dataset.game = game.slug;
    card.style.setProperty('--accent', game.accent);
    card.setAttribute('aria-labelledby', 'story-name');

    const meta = html('p', 'story-meta', `תחנה ${position} מתוך ${games.length} · ${game.place}`);
    const art = html('div', 'story-art');
    const mark = svg('svg', { viewBox: '0 0 28 28', 'aria-hidden': 'true', class: 'story-mark' });
    mark.innerHTML = game.mark;
    art.append(mark);
    const name = html('h3', 'story-name', game.name);
    name.id = 'story-name';
    const pitch = html('p', 'story-pitch', game.tagline);
    const chips = html('p', 'story-chips');
    chips.append(html('span', '', `כ־${game.minutes} דקות`));
    if (state.status === 'playing') chips.append(html('span', 'is-playing', 'התחלתם כבר'));

    const start = html('a', 'story-start');
    start.id = 'story-start';
    start.href = `games/${game.slug}/`;
    start.append(svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }), state.status === 'playing' ? 'המשיכו לשחק' : 'התחילו');
    start.firstChild.innerHTML = '<path d="M8 5.5v13l10.5-6.5Z"/>';
    start.addEventListener('click', () => onStart(game.slug));

    const body = html('div', 'story-body');
    body.append(art, name, pitch, chips);
    card.append(meta, body, start);
    return card;
  }

  function doneCard() {
    const card = html('article', 'story story-done');
    card.setAttribute('aria-labelledby', 'story-name');
    const badge = html('div', 'story-art done-art');
    const check = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'story-mark' });
    check.innerHTML = '<path d="m5 12.5 4.5 4.5L19 7"/>';
    badge.append(check);
    const name = html('h3', 'story-name', 'סיימתם להיום!');
    name.id = 'story-name';
    const list = html('ul', 'day-results');
    list.id = 'day-results';
    for (const g of games) {
      const s = states.get(g.slug);
      const li = html('li');
      li.dataset.game = g.slug;
      li.dataset.status = s.status;
      li.style.setProperty('--accent', g.accent);
      const m = svg('svg', { viewBox: '0 0 28 28', 'aria-hidden': 'true', class: 'day-mark' });
      m.innerHTML = g.mark;
      li.append(m, html('span', 'day-name', g.name), html('span', 'day-score', s.summary || (s.status === 'won' ? 'נפתר' : 'לא הפעם')));
      list.append(li);
    }
    const next = html('p', 'day-next', 'חידות חדשות בעוד ');
    const clock = html('span', '', '--:--:--');
    clock.id = 'deck-countdown';
    clock.dir = 'ltr';
    next.append(clock);

    const actions = html('div', 'day-actions');
    const share = html('button', 'story-start');
    share.id = 'day-share';
    share.type = 'button';
    share.append(svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'line' }), 'שיתוף היום שלי');
    share.firstChild.innerHTML = '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 13v6.5h14V13"/>';
    share.addEventListener('click', () => shareResult(shareText(), 'הסיכום הועתק – הדביקו בקבוצה'));
    const wa = html('a', 'day-wa', 'שליחה בוואטסאפ');
    wa.id = 'day-whatsapp';
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.href = whatsappLink(shareText());
    actions.append(share, wa);

    card.append(badge, name, list, next, actions);
    stopCountdown = startCountdown(clock);
    return card;
  }

  function render(direction = 0) {
    stopCountdown();
    stopCountdown = () => {};
    const slug = cards[index];
    const game = games.find((g) => g.slug === slug);
    const card = game ? storyCard(game) : doneCard();
    if (direction && !reduced()) card.classList.add(direction > 0 ? 'from-next' : 'from-prev');
    const hadFocusInCard = stage.contains(document.activeElement);
    stage.replaceChildren(card);
    renderBars();

    const left = cards.filter((c) => c !== 'done').length;
    const doneCount = games.length - left;
    count.textContent = slug === 'done' ? `${games.length}/${games.length} הושלמו` : `${doneCount}/${games.length} הושלמו`;
    const following = cards[index + 1] && games.find((g) => g.slug === cards[index + 1]);
    hint.textContent = following ? `הבא בתור: ${following.name}` : slug === 'done' ? 'נתראה מחר' : 'זו התחנה האחרונה להיום';
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index >= cards.length - 1;
    dialog.dataset.card = slug;
    if (hadFocusInCard || (document.activeElement && document.activeElement.disabled)) card.querySelector('.story-start').focus();
  }

  function go(step) {
    const target = index + step;
    if (target < 0 || target >= cards.length) return;
    index = target;
    intro.hidden = true;
    render(step);
  }

  /** at: a slug to start on (falls back to the first unplayed card); message: a line above the first card. */
  function open({ at, message } = {}) {
    build();
    index = Math.max(0, cards.indexOf(at));
    intro.hidden = !message;
    intro.textContent = message || '';
    if (!dialog.open) {
      opener = document.activeElement;
      dialog.showModal();
      document.documentElement.classList.add('deck-open');
    }
    render(0);
    dialog.querySelector('.story-start').focus();
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener('close', () => {
    stopCountdown();
    document.documentElement.classList.remove('deck-open');
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  });

  $('deck-close').addEventListener('click', () => close());
  prevBtn.addEventListener('click', () => go(-1));
  nextBtn.addEventListener('click', () => go(1));

  dialog.addEventListener('keydown', (e) => {
    // Right to left: the next story lies to the left.
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(-1); }
    else if (e.key === 'Tab') {
      // Keep the keyboard inside the deck.
      const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  });

  // Swipe and tap. A horizontal drag of 40px moves one card (dragging right brings the next one in from
  // the left); a tap on the outer third of the card does the same, unless it lands on a control.
  let touch = null;
  stage.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    touch = { x: e.clientX, y: e.clientY, onControl: !!e.target.closest('a, button') };
  });
  stage.addEventListener('pointerup', (e) => {
    if (!touch) return;
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    const t = touch;
    touch = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      dialog.dataset.swiped = '1';
      setTimeout(() => { delete dialog.dataset.swiped; }, 0);
      go(dx > 0 ? 1 : -1);
      return;
    }
    if (t.onControl || Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
    const box = stage.getBoundingClientRect();
    const rel = (e.clientX - box.left) / box.width;
    if (rel < 0.33) go(1);
    else if (rel > 0.67) go(-1);
  });
  stage.addEventListener('pointercancel', () => { touch = null; });
  // A swipe that starts on the start link must not also follow it.
  stage.addEventListener('click', (e) => {
    if (dialog.dataset.swiped) e.preventDefault();
  }, true);

  return { open, close, get isOpen() { return dialog.open; } };
}

// Interface for על הציר. State lives in the store; every render is drawn from it.
import * as G from './game.js';
import { israelDate, dayNumber, dateOfDay, hebrewDate, recordResult, currentStreak } from '../../shared/core.js';
import { createStore, mountHeader, html, svg, icon, wireDialog, renderStats, renderEnd, gameUrl } from '../../shared/ui.js';
import { dayStatsPanel } from '../../shared/social-ui.js';
import { stamp, celebrate } from '../../shared/fx.js';
import { emblem } from '../../shared/emblems.js';

const SLUG = 'tzir';
const BUCKETS = G.LIVES; // a win lands in the bar for its number of mistakes: 0, 1 or 2
const $ = (id) => document.getElementById(id);
const el = {
  banner: $('mode-banner'), dock: $('dock'), progress: $('progress'), lives: $('lives'), card: $('card'),
  cardText: $('card-text'), feedback: $('feedback'), timeline: $('timeline'), end: $('end'),
  offer: $('practice-offer'), practiceLink: $('practice-link'), help: $('help-dialog'), sourceDate: $('source-date'),
};

// ---------- saved state ----------

const store = createStore(SLUG);
const today = dayNumber(israelDate());
const state = store.loadDaily(today, BUCKETS);
const dailyPuzzle = G.puzzleForDay(today);
let dailyResults = G.cleanResults(state.progress?.results);

// mode 'daily' is saved and counted; 'practice' is neither.
const game = { mode: 'daily', puzzle: dailyPuzzle, results: dailyResults };
// What the last move did, so the next render can point at it. Never saved.
let last = null;

function saveDaily() {
  state.finished = G.isOver(dailyResults);
  state.won = G.isWon(dailyResults);
  state.summary = state.finished ? G.summary(dailyResults) : '';
  // progress stays null until the first move, which is how the hub tells "new" from "in progress".
  state.progress = dailyResults.length ? { results: dailyResults } : null;
  store.save(state);
}

// ---------- header + dialogs ----------

const header = mountHeader({
  slug: SLUG,
  onHelp: () => el.help.showModal(),
  onStats: () => renderStats({
    stats: state.stats, day: today, distTitle: 'כמה טעויות היו לי בניצחונות',
    labels: ['בלי טעויות', 'טעות אחת', 'שתי טעויות'],
    highlight: state.won ? G.mistakes(dailyResults) : -1,
  }).showModal(),
});

wireDialog(el.help);
// The same drawing the hub shows for this game, so the rules feel like the back of that card.
el.help.prepend(emblem(SLUG));
el.help.addEventListener('close', () => { state.seenHelp = true; store.save(state); });

el.sourceDate.textContent = `, נכון ל-${hebrewDate(new Date(G.SOURCE.retrieved + 'T12:00:00Z'), { day: 'numeric', month: 'long', year: 'numeric' })}`;

// ---------- moves ----------

// The second half of a double tap lands on whichever gap is now under the thumb and would place the
// next event before it has even been read. For a moment after a move the timeline takes no taps;
// data-settling says so (tests wait for it to clear instead of sleeping).
const SETTLE_MS = 250;
let settleTimer = 0;
function settle(on) {
  clearTimeout(settleTimer);
  if (on) {
    el.timeline.dataset.settling = 'true';
    settleTimer = setTimeout(() => settle(false), SETTLE_MS);
  } else delete el.timeline.dataset.settling;
}

function place(gap) {
  if (el.timeline.dataset.settling) return;
  const move = G.place(game.puzzle, game.results, gap);
  if (!move.event) return;
  // Keyboard players should keep their place on the timeline after the list is redrawn.
  const hadFocus = el.timeline.contains(document.activeElement);
  game.results = move.results;
  if (game.mode === 'daily') {
    dailyResults = move.results;
    if (G.isOver(dailyResults)) state.stats = recordResult(state.stats, today, G.isWon(dailyResults), G.mistakes(dailyResults));
    saveDaily();
  }
  // Where the card was dropped, so a misplaced event can be seen sliding along the rail to its true place.
  const droppedAt = el.timeline.querySelectorAll('.gap-btn')[gap]?.getBoundingClientRect().top;
  // After the insert, every gap at or below the new row has moved down by one.
  last = { id: move.event.id, correct: move.correct, year: move.event.year, picked: move.correct ? -1 : gap > move.gap ? gap + 1 : gap };
  render();
  settle(true);

  const over = G.isOver(game.results);
  const row = el.timeline.querySelector('.event.just');
  if (row && !move.correct && droppedAt != null) row.style.setProperty('--from-y', `${Math.round(droppedAt - row.getBoundingClientRect().top)}px`);
  if (over) el.end.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  else row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (hadFocus) {
    if (over) el.end.querySelector('#end-title')?.focus();
    else el.timeline.querySelectorAll('.gap-btn')[move.gap]?.focus({ preventScroll: true });
  }
}

function startPractice() {
  Object.assign(game, { mode: 'practice', puzzle: G.randomPuzzle(), results: [] });
  last = null;
  settle(false);
  render();
  scrollTo({ top: 0 });
}

function backToDaily() {
  Object.assign(game, { mode: 'daily', puzzle: dailyPuzzle, results: dailyResults });
  last = null;
  settle(false);
  render();
  scrollTo({ top: 0 });
}

el.practiceLink.addEventListener('click', startPractice);

// ---------- rendering ----------

const HEART = 'M12 20.5S3.5 15 3.5 9.2A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.5 2.6c0 5.8-8.5 11.3-8.5 11.3Z';
const GRIP = '<circle cx="4" cy="4" r="1.8"/><circle cx="10" cy="4" r="1.8"/><circle cx="4" cy="11" r="1.8"/><circle cx="10" cy="11" r="1.8"/><circle cx="4" cy="18" r="1.8"/><circle cx="10" cy="18" r="1.8"/>';
const STATUS_TEXT = { anchor: 'האירוע הפותח', right: 'מיקמתם נכון', wrong: 'מיקמתם לא נכון', missed: 'לא הגעתם אליו' };

function gapLabel(rows, i) {
  if (i === 0) return `למקם כאן, לפני: ${rows[0].event.text}`;
  if (i === rows.length) return `למקם כאן, אחרי: ${rows[rows.length - 1].event.text}`;
  return `למקם כאן, בין: ${rows[i - 1].event.text} לבין: ${rows[i].event.text}`;
}

function renderDock(over) {
  el.dock.hidden = over;
  if (over) return;
  const event = G.currentEvent(game.puzzle, game.results);
  el.progress.textContent = `אירוע ${game.results.length + 1} מתוך ${G.ROUNDS}`;

  const left = G.livesLeft(game.results);
  el.lives.setAttribute('aria-label', `חיים: ${left} מתוך ${G.LIVES}`);
  el.lives.replaceChildren(...Array.from({ length: G.LIVES }, (_, i) => {
    // The heart that the last move cost is the first spent one.
    const heart = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: i < left ? '' : i === left && last && !last.correct ? 'spent lost' : 'spent' });
    heart.append(svg('path', { d: HEART }));
    return heart;
  }));

  const changed = el.cardText.textContent !== event.text;
  el.cardText.textContent = event.text;
  if (!el.card.querySelector('.grip')) {
    const grip = svg('svg', { viewBox: '0 0 14 22', 'aria-hidden': 'true', class: 'grip' });
    grip.innerHTML = GRIP;
    el.card.append(grip);
  }
  // Restarting the class replays the entry animation for each new event.
  el.card.classList.remove('fresh');
  if (changed) { void el.card.offsetWidth; el.card.classList.add('fresh'); }

  el.feedback.className = 'feedback' + (last ? (last.correct ? ' right' : ' wrong') : '');
  if (!last) el.feedback.textContent = 'מתי זה קרה? הקישו על "כאן" במקום המתאים, או גררו את הכרטיס.';
  // Worded as news about the previous event, because it sits under the card of the next one.
  else el.feedback.replaceChildren(last.correct ? 'האירוע הקודם: נכון, ' : 'האירוע הקודם: טעות. זה קרה ב-', html('b', '', last.year), last.correct ? '' : ', והוא עבר למקומו');
}

function renderTimeline(over) {
  const rows = over ? G.fullTimeline(game.puzzle, game.results) : G.timeline(game.puzzle, game.results);
  const gap = (i) => {
    const li = html('li', 'gap');
    const button = html('button', 'gap-btn' + (last && last.picked === i ? ' missed-here' : ''));
    button.type = 'button';
    button.dataset.gap = i;
    button.setAttribute('aria-label', gapLabel(rows, i));
    button.append(html('span', 'tick'), html('span', 'here', 'כאן'));
    button.addEventListener('click', () => place(i));
    li.append(button);
    return li;
  };
  el.timeline.replaceChildren();
  rows.forEach(({ event, status }, i) => {
    if (!over) el.timeline.append(gap(i));
    const li = html('li', `event ${status}` + (last && last.id === event.id ? ' just' : ''));
    const mark = html('span', 'mark');
    if (status === 'right') mark.append(icon('check'));
    if (status === 'wrong') mark.append(icon('cross'));
    li.append(html('span', 'year', event.year), mark, html('span', 'text', event.text), html('span', 'visually-hidden', ` (${STATUS_TEXT[status]})`));
    el.timeline.append(li);
  });
  if (!over) el.timeline.append(gap(rows.length));
}

function renderEndPanel(over) {
  el.end.hidden = !over;
  if (!over) return;
  const { results, mode } = game;
  const won = G.isWon(results);
  const again = html('button', 'btn ghost', mode === 'practice' ? 'עוד סיבוב' : 'עוד סיבוב לאימון');
  again.id = 'practice-btn';
  again.type = 'button';
  again.addEventListener('click', startPractice);

  const sub = html('span');
  sub.append('מיקמתם נכון ', html('b', '', `${G.score(results)} מתוך ${G.ROUNDS}`), won ? ' אירועים' : ' אירועים. הציר המלא למעלה');
  renderEnd(el.end, {
    title: G.isPerfect(results) ? 'ציר מושלם!' : won ? ['', 'כמעט מושלם!', 'הציר הושלם'][G.mistakes(results)] : 'נגמרו החיים',
    sub,
    streak: mode === 'daily' && won ? currentStreak(state.stats, today) : 0,
    shareText: mode === 'daily' ? () => G.shareText({ day: today, results, url: gameUrl() }) : null,
    countdown: mode === 'daily',
    actions: [again],
  });
  // Today's result goes to the group boards; practice rounds never do.
  dayStatsPanel(el.end, mode === 'daily' ? { game: SLUG, day: today, points: G.points(results), won, summary: G.summary(results) } : null);
  // The score is stamped on the sheet. It only slams down (and the paper only flies) at the moment the
  // game ends, not when a finished game is opened again.
  const holder = html('p', 'end-stamp');
  holder.setAttribute('aria-hidden', 'true'); // the same score is in the line under the title
  el.end.prepend(holder);
  const mark = stamp(holder, { text: G.summary(results), tone: won ? 'found' : 'ink', big: true, angle: -6 });
  if (!last) mark.classList.remove('fx-stamp-in');
  // The paper flies once the stamp has landed and the page has finished scrolling to it.
  else if (won) setTimeout(() => celebrate({ origin: mark }), 400);
}

function render() {
  const over = G.isOver(game.results);
  header.setLabel(game.mode === 'practice' ? 'סיבוב אימון' : `חידה ${today} · ${hebrewDate(dateOfDay(today))}`);

  el.banner.hidden = game.mode === 'daily';
  el.banner.replaceChildren();
  if (game.mode === 'practice') {
    const back = html('button', 'link', 'חזרה לחידה היומית');
    back.type = 'button';
    back.addEventListener('click', backToDaily);
    el.banner.append('מצב אימון – לא נספר בסטטיסטיקה · ', back);
  }
  // Once a game is over the end panel carries the practice button, so the link under the board goes.
  el.offer.hidden = game.mode === 'practice' || over;

  renderDock(over);
  renderTimeline(over);
  renderEndPanel(over);
}

// ---------- keyboard: arrows walk the gaps ----------

el.timeline.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const gaps = [...el.timeline.querySelectorAll('.gap-btn')];
  const at = gaps.indexOf(document.activeElement);
  if (at < 0) return;
  e.preventDefault();
  gaps[Math.max(0, Math.min(gaps.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))].focus();
});

// ---------- dragging the card onto a gap (an extra; tapping "כאן" always works) ----------

let drag = null;

function dragTarget(y) {
  // Over the pinned card itself nothing is targeted, so letting go there cancels the drag.
  if (y < el.dock.getBoundingClientRect().bottom) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const button of el.timeline.querySelectorAll('.gap-btn')) {
    const box = button.getBoundingClientRect();
    const distance = Math.abs(y - (box.top + box.height / 2));
    if (distance < bestDistance) { best = button; bestDistance = distance; }
  }
  return best;
}

function dragFrame() {
  if (!drag?.ghost) return;
  // Near the bottom edge, or just under the pinned card, the page scrolls so far-away gaps can be reached.
  const dockBottom = el.dock.getBoundingClientRect().bottom;
  if (drag.y > innerHeight - 56) scrollBy(0, 9);
  else if (drag.y > dockBottom && drag.y < dockBottom + 28) scrollBy(0, -9);
  const target = dragTarget(drag.y);
  if (target !== drag.target) {
    drag.target?.classList.remove('over');
    target?.classList.add('over');
    drag.target = target;
  }
  drag.ghost.style.transform = `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px) rotate(-1.5deg)`;
  drag.frame = requestAnimationFrame(dragFrame);
}

function endDrag(drop) {
  if (!drag) return;
  const { ghost, target, frame } = drag;
  drag = null;
  cancelAnimationFrame(frame);
  ghost?.remove();
  target?.classList.remove('over');
  el.card.classList.remove('lifted');
  document.body.classList.remove('dragging');
  if (drop && ghost && target) place(Number(target.dataset.gap));
}

el.card.addEventListener('pointerdown', (e) => {
  if (e.button > 0 || drag) return;
  const box = el.card.getBoundingClientRect();
  drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, dx: e.clientX - box.left, dy: e.clientY - box.top, ghost: null, target: null };
  el.card.setPointerCapture(e.pointerId);
});
el.card.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pointer) return;
  drag.x = e.clientX;
  drag.y = e.clientY;
  // A few pixels of slack, so a tap or a shaky press is not a drag.
  if (drag.ghost || Math.hypot(drag.x - drag.x0, drag.y - drag.y0) < 8) return;
  const ghost = el.card.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  ghost.className = 'card ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.width = el.card.offsetWidth + 'px';
  document.body.append(ghost);
  drag.ghost = ghost;
  el.card.classList.add('lifted');
  document.body.classList.add('dragging');
  dragFrame();
});
el.card.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.pointer) endDrag(true); });
el.card.addEventListener('pointercancel', () => endDrag(false));

// The pinned block's height varies with the length of the event text; rows scrolled into view must clear it.
new ResizeObserver(() => el.timeline.style.setProperty('--dock-h', el.dock.offsetHeight + 'px')).observe(el.dock);

render();
if (!state.seenHelp) el.help.showModal();

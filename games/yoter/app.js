// Interface for יותר או פחות. The rules live in game.js; this file loads state, draws it, and saves on every answer.
import * as G from './game.js';
import { israelDate, dayNumber, dateOfDay, hebrewDate, recordResult, currentStreak } from '../../shared/core.js';
import { createStore, mountHeader, html, icon, wireDialog, renderStats, renderEnd, gameUrl } from '../../shared/ui.js';
import { tilt, stamp, celebrate } from '../../shared/fx.js';
import { emblem } from '../../shared/emblems.js';

const SLUG = 'yoter';
const $ = (id) => document.getElementById(id);
const el = {
  banner: $('mode-banner'), themeSelect: $('theme-select'), backToDaily: $('back-to-daily'),
  kicker: $('theme-kicker'), title: $('theme-title'), pips: $('pips'), run: $('run'),
  duel: $('duel'), verdict: $('verdict'),
  known: $('card-known'), knownName: $('known-name'), knownValue: $('known-value'),
  hidden: $('card-hidden'), hiddenName: $('hidden-name'), hiddenValue: $('hidden-value'),
  bar: $('answer-bar'), more: $('more-btn'), less: $('less-btn'),
  end: $('end'), recap: $('recap'), recapList: $('recap-list'), practiceLink: $('practice-link'), help: $('help-dialog'),
};

// The rolling number and the pause after it are decoration: the answer is saved before either starts.
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COUNT_MS = calm ? 0 : 950;
const HOLD_MS = calm ? 350 : 1200;
// The paper flies once the end stamp has landed and the page has finished scrolling to it.
const CELEBRATE_AFTER = 400;

// ---------- saved state ----------

const store = createStore(SLUG);
const today = dayNumber(israelDate());
const state = store.loadDaily(today, G.BUCKETS);
const daily = G.chainForDay(today);
const dailyAnswers = G.cleanAnswers(state.progress?.answers);

// Best sudden-death runs sit under their own key: the shared daily state keeps only its standard fields.
const BEST_KEY = `hd:${SLUG}:best`;
function loadBest() {
  try {
    const saved = JSON.parse(localStorage.getItem(BEST_KEY));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
  } catch { /* private mode or junk: no records yet */ }
  return {};
}
const best = loadBest();
const bestFor = (theme) => (Number.isInteger(best[theme.id]) && best[theme.id] > 0 ? best[theme.id] : 0);
function saveBest(theme, length) {
  best[theme.id] = length;
  try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* nothing to do without storage */ }
}

// mode 'daily' is saved and counted; 'practice' (sudden death) only remembers its best run.
// `turn` changes whenever the board is replaced, so a reveal still in flight knows it is stale.
const game = { mode: 'daily', theme: daily.theme, items: daily.items, answers: dailyAnswers, run: null, busy: false, turn: 0, newBest: false };

const isPractice = () => game.mode === 'practice';
const results = () => G.results(game.items, game.answers);
const isOver = () => (isPractice() ? results().includes(false) : G.isOver(game.answers));

function saveDaily() {
  const points = G.score(daily.items, dailyAnswers);
  state.finished = G.isOver(dailyAnswers);
  state.won = G.isWon(daily.items, dailyAnswers);
  state.summary = state.finished ? G.summary(daily.items, dailyAnswers) : '';
  // progress stays null until the first answer, which is how the hub tells "new" from "in progress".
  state.progress = dailyAnswers.length ? { answers: dailyAnswers } : null;
  if (state.finished && state.stats.lastPlayedDay !== today) {
    state.stats = recordResult(state.stats, today, state.won, points);
    // recordResult only fills the chart for wins, and this chart is "how many did I get right" for every day.
    if (!state.won) state.stats.distribution[points] += 1;
  }
  store.save(state);
}

// ---------- header + dialogs ----------

const header = mountHeader({
  slug: SLUG,
  onHelp: () => el.help.showModal(),
  onStats: () => renderStats({
    stats: state.stats, day: today, distTitle: 'כמה צדקתי מתוך 10',
    labels: Array.from({ length: G.BUCKETS }, (_, i) => String(i)),
    highlight: state.finished ? G.score(daily.items, dailyAnswers) : -1,
  }).showModal(),
});

wireDialog(el.help);
// The same drawing the hub shows for this game, so the rules feel like the back of that card.
el.help.prepend(emblem(SLUG));
el.help.addEventListener('close', () => { state.seenHelp = true; store.save(state); });

$('source-date').textContent = hebrewDate(new Date(G.SOURCE.retrieved + 'T12:00:00Z'), { day: 'numeric', month: 'long', year: 'numeric' });

for (const theme of G.THEMES) {
  const option = html('option', '', theme.short);
  option.value = theme.id;
  el.themeSelect.append(option);
}

// ---------- drawing ----------

function fillValue(target, theme, value, revealed = true) {
  const parts = G.valueParts(theme, value);
  const num = html('span', revealed ? 'num' : 'num unknown', revealed ? parts.number : '?');
  num.dir = 'ltr'; // keeps the minus sign of a below-sea-level height on the correct side
  target.replaceChildren();
  if (parts.prefix) target.append(html('span', '', parts.prefix));
  target.append(num);
  if (parts.suffix) target.append(html('span', '', parts.suffix));
  return num;
}

function fillName(target, name) {
  target.textContent = name;
  target.classList.toggle('long', name.length > 15);
}

function setVerdict(result) {
  el.verdict.className = 'verdict fx-layer' + (result == null ? '' : result ? ' right' : ' wrong');
  if (result == null) return el.verdict.replaceChildren('או');
  el.verdict.replaceChildren(icon(result ? 'check' : 'cross'), html('span', 'visually-hidden', result ? 'נכון' : 'טעות'));
}

/** Draws round `index`: the known item on top, the hidden one below, revealed or not. */
function drawRound(index, revealed) {
  const known = game.items[index];
  const hidden = game.items[index + 1];
  const result = revealed ? G.isRight(known, hidden, game.answers[index]) : null;
  fillName(el.knownName, known.name);
  fillValue(el.knownValue, game.theme, known.value);
  fillName(el.hiddenName, hidden.name);
  fillValue(el.hiddenValue, game.theme, hidden.value, revealed);
  el.hidden.className = 'card fx-paper' + (result == null ? '' : result ? ' right' : ' wrong');
  el.hidden.querySelector('.card-stamp')?.remove();
  setVerdict(result);
}

/** The ruling lands on the card that was just revealed, the way a clerk stamps a form. */
function stampCard(result) {
  const holder = html('span', 'card-stamp');
  holder.setAttribute('aria-hidden', 'true'); // the verdict badge already announces it
  el.hidden.append(holder);
  stamp(holder, { text: result ? 'נכון' : 'טעות', tone: result ? 'found' : 'close', big: true, angle: result ? -7 : 6 });
}

function drawProgress() {
  const marks = results();
  el.pips.hidden = isPractice();
  el.run.hidden = !isPractice();
  if (isPractice()) {
    el.run.replaceChildren('רצף נוכחי ', html('b', '', marks.filter(Boolean).length), ' · השיא בנושא הזה ', html('b', '', bestFor(game.theme)));
    return;
  }
  el.pips.replaceChildren();
  for (let i = 0; i < G.ROUNDS; i++) {
    const mark = i < marks.length ? (marks[i] ? 'right' : 'wrong') : i === marks.length ? 'now' : '';
    const pip = html('li', mark);
    pip.append(html('span', 'visually-hidden', `סיבוב ${i + 1}: ${{ right: 'נכון', wrong: 'טעות', now: 'הסיבוב הנוכחי' }[mark] || 'עוד לא שוחק'}`));
    el.pips.append(pip);
  }
}

function drawButtons(enabled) {
  el.more.replaceChildren(icon('up'), game.theme.more);
  el.less.replaceChildren(icon('down'), game.theme.less);
  el.more.disabled = el.less.disabled = !enabled;
}

function drawRecap() {
  const marks = results();
  el.recapList.replaceChildren();
  game.items.forEach((item, i) => {
    const li = html('li', i === 0 ? '' : marks[i - 1] ? 'right' : 'wrong');
    li.append(i === 0 ? html('span') : icon(marks[i - 1] ? 'check' : 'cross'), html('b', '', item.name), html('span', '', G.formatValue(game.theme, item.value)));
    el.recapList.append(li);
  });
}

function actionButton(id, className, label, handler) {
  const button = html('button', className, label);
  button.id = id;
  button.type = 'button';
  button.addEventListener('click', handler);
  return button;
}

/** A big stamp with the score heads the end panel; `fresh` is true only at the moment the game ends. */
function stampEnd(text, tone, fresh) {
  const holder = html('p', 'end-stamp');
  holder.setAttribute('aria-hidden', 'true'); // the same score is in the line under the title
  el.end.prepend(holder);
  const node = stamp(holder, { text, tone, big: true, angle: -6 });
  if (!fresh) node.classList.remove('fx-stamp-in');
  return node;
}

function drawEnd(fresh) {
  if (isPractice()) {
    const length = results().filter(Boolean).length;
    renderEnd(el.end, {
      title: length ? `${length} ברצף` : 'נפלתם כבר בראשון',
      sub: game.newBest ? 'עוד לא הגעתם רחוק כל כך בנושא הזה' : `השיא שלכם בנושא הזה: ${bestFor(game.theme)}`,
      countdown: false,
      actions: [
        actionButton('again-btn', 'btn accent block', 'עוד ניסיון', () => startPractice(game.theme)),
        actionButton('daily-btn', 'btn ghost', 'חזרה לחידה היומית', backToDaily),
      ],
    });
    if (game.newBest) {
      const node = stampEnd('שיא חדש', 'accent', fresh);
      if (fresh) setTimeout(() => celebrate({ origin: node }), CELEBRATE_AFTER);
    }
    return;
  }
  const points = G.score(game.items, game.answers);
  const sub = html('span');
  sub.append(html('b', '', `${points} מתוך ${G.ROUNDS}`), ` · ${game.theme.short}`);
  renderEnd(el.end, {
    title: G.endTitle(points),
    sub,
    streak: state.won ? currentStreak(state.stats, today) : 0,
    shareText: () => G.shareText({ day: today, items: game.items, answers: game.answers, url: gameUrl() }),
    actions: [actionButton('practice-btn', 'btn ghost', 'מוות פתאומי: כמה תצליחו ברצף?', () => startPractice(game.theme))],
  });
  const node = stampEnd(`${points}/${G.ROUNDS}`, state.won ? 'found' : 'ink', fresh);
  if (fresh && state.won) setTimeout(() => celebrate({ origin: node }), CELEBRATE_AFTER);
}

/** Everything on screen, from the current state. `advance` plays the slide into the next round. */
function render(advance = false) {
  const over = isOver();
  const practice = isPractice();

  header.setLabel(practice ? 'מוות פתאומי · אימון' : `חידה ${today} · ${hebrewDate(dateOfDay(today))}`);
  el.banner.hidden = !practice;
  el.themeSelect.value = game.theme.id;
  el.kicker.textContent = practice ? 'נושא האימון' : 'הנושא של היום';
  el.title.textContent = game.theme.title;
  el.practiceLink.hidden = practice || over;
  drawProgress();

  // A finished day shows its whole chain instead of the board; a finished run keeps the pair that ended it.
  el.duel.hidden = over && !practice;
  el.bar.hidden = over;
  el.recap.hidden = !(over && !practice);
  el.end.hidden = !over;
  drawButtons(!over);

  // The card that has done its job leaves upwards while the revealed one climbs into its place.
  el.duel.querySelector('.card.leaving')?.remove();
  if (advance && !over && !calm) {
    const leaving = el.known.cloneNode(true);
    leaving.removeAttribute('id');
    leaving.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    leaving.className = 'card fx-paper leaving';
    leaving.setAttribute('aria-hidden', 'true');
    leaving.style.height = el.known.offsetHeight + 'px';
    el.duel.append(leaving);
    leaving.addEventListener('animationend', () => leaving.remove(), { once: true });
  }

  if (!el.duel.hidden) {
    drawRound(over ? game.answers.length - 1 : game.answers.length, over);
    if (over) stampCard(results().at(-1));
  }
  el.duel.classList.remove('advance');
  if (advance && !over) {
    void el.duel.offsetWidth; // restart the animation even when two rounds follow each other quickly
    el.duel.classList.add('advance');
  }

  if (!over) return;
  if (!practice) drawRecap();
  drawEnd(advance);
}

// ---------- the reveal ----------

/**
 * Rolls the number in like an odometer: every digit is a strip of 0-9 that turns once and stops on its
 * digit, the leftmost first. Timed with setTimeout rather than transition events, so nothing depends on
 * the animation finishing; the caller redraws the plain number afterwards.
 */
function rollNumber(node, text) {
  if (!COUNT_MS) return Promise.resolve();
  const digits = [...text].filter((ch) => ch >= '0' && ch <= '9').length;
  const roll = html('span', 'odo');
  let column = 0;
  for (const ch of text) {
    if (ch < '0' || ch > '9') { roll.append(html('span', 'odo-static', ch)); continue; }
    const col = html('span', 'odo-col');
    const strip = html('span', 'odo-strip');
    for (let i = 0; i <= 10 + Number(ch); i++) strip.append(html('span', '', i % 10));
    strip.style.setProperty('--to', 10 + Number(ch));
    strip.style.setProperty('--delay', `${Math.round(column * Math.min(70, 320 / Math.max(1, digits - 1)))}ms`);
    column++;
    col.append(strip);
    roll.append(col);
  }
  node.replaceChildren(roll);
  node.classList.add('rolling');
  void roll.offsetWidth;
  roll.classList.add('go');
  return wait(COUNT_MS);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function answer(choice) {
  if (game.busy || isOver() || document.querySelector('dialog[open]')) return;
  const index = game.answers.length;
  const hidden = game.items[index + 1];
  const right = G.isRight(game.items[index], hidden, choice);
  const turn = game.turn;

  game.busy = true;
  game.answers.push(choice);
  if (isPractice()) {
    const length = results().filter(Boolean).length;
    if (right && length > bestFor(game.theme)) { saveBest(game.theme, length); game.newBest = true; }
  } else {
    saveDaily();
  }

  const picked = choice === 'more' ? el.more : el.less;
  // The buttons are switched off while the number rolls, which drops the focus of a keyboard player.
  const hadFocus = document.activeElement === picked;
  drawButtons(false);
  picked.classList.add('picked');
  const num = fillValue(el.hiddenValue, game.theme, hidden.value);
  await rollNumber(num, num.textContent);
  if (turn !== game.turn) return;
  drawRound(index, true);
  stampCard(right);
  drawProgress();
  await wait(HOLD_MS);
  if (turn !== game.turn) return;

  el.more.classList.remove('picked');
  el.less.classList.remove('picked');
  game.busy = false;
  if (isPractice() && right) game.run.extend();
  render(true);
  if (isOver()) el.end.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'nearest' });
  if (hadFocus) (isOver() ? el.end.querySelector('#end-title') : picked)?.focus({ preventScroll: true });
}

// ---------- modes ----------

function startPractice(theme) {
  const run = G.createRun(theme);
  Object.assign(game, { mode: 'practice', theme, run, items: run.items, answers: [], busy: false, turn: game.turn + 1, newBest: false });
  render();
  scrollTo({ top: 0 });
}

function backToDaily() {
  Object.assign(game, { mode: 'daily', theme: daily.theme, run: null, items: daily.items, answers: dailyAnswers, busy: false, turn: game.turn + 1, newBest: false });
  render();
  scrollTo({ top: 0 });
}

el.more.addEventListener('click', () => answer('more'));
el.less.addEventListener('click', () => answer('less'));
el.practiceLink.addEventListener('click', () => startPractice(game.theme));
el.backToDaily.addEventListener('click', backToDaily);
el.themeSelect.addEventListener('change', () => startPractice(G.themeById(el.themeSelect.value) || game.theme));

// Arrow up says "more", arrow down says "less". Inside the theme list the arrows belong to the list.
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target === el.themeSelect || document.querySelector('dialog[open]')) return;
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  if (isOver()) return; // leave the arrows to scrolling once there is nothing to answer
  e.preventDefault();
  answer(e.key === 'ArrowUp' ? 'more' : 'less');
});

// The pair of cards leans a little towards the pointer, or with the phone.
tilt(el.duel, { gyro: true });

render();
if (!state.seenHelp) el.help.showModal();

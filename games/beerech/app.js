// Interface for בערך. State lives in `state` (saved, daily) and `game` (what is on screen right now).
import * as G from './game.js';
import { ART } from './art.js';
import { israelDate, dayNumber, dateOfDay, hebrewDate, recordResult, currentStreak } from '../../shared/core.js';
import { tilt, flip, stamp, celebrate, countUp, reducedMotion } from '../../shared/fx.js';
import { createStore, mountHeader, html, svg, wireDialog, renderStats, renderEnd, gameUrl } from '../../shared/ui.js';

const SLUG = 'beerech';
const $ = (id) => document.getElementById(id);
const el = {
  banner: $('mode-banner'), steps: $('steps'), card: $('card'), art: $('art'), kicker: $('card-kicker'),
  name: $('product-name'), size: $('product-size'), form: $('guess-form'), field: $('price-field'), input: $('guess-input'),
  error: $('guess-error'), reveal: $('reveal'), verdict: $('verdict'), real: $('real-price'), diff: $('diff'),
  points: $('points'), next: $('next-btn'), logWrap: $('log-wrap'), logTitle: $('log-title'), log: $('log'),
  end: $('end'), help: $('help-dialog'),
  tagHang: $('tag-hang'), tag: $('tag'), backName: $('back-name'), after: $('after'), you: $('gauge-you'),
  receipt: $('receipt'), totalLabel: $('log-total-label'), total: $('log-total'), receiptFoot: $('receipt-foot'), thanks: $('receipt-thanks'),
};

// ---------- saved state ----------

const store = createStore(SLUG);
const today = dayNumber(israelDate());
const state = store.loadDaily(today, G.BUCKETS);
const dailyRound = G.roundForDay(today);
const dailyGuesses = G.sanitizeGuesses(state.progress?.guesses);

// mode 'daily' is saved and counted; 'practice' is neither.
// `revealed` is the index of the product whose real price is on screen, waiting for "next"; it is not
// saved, so a reload lands on the next product (or on the summary) with the answer in the list below.
const game = { mode: 'daily', round: dailyRound, guesses: dailyGuesses, revealed: null };

function saveDaily() {
  state.finished = G.isOver(dailyGuesses);
  state.won = G.isWon(dailyGuesses, dailyRound);
  state.summary = state.finished ? G.summary(dailyGuesses, dailyRound) : '';
  // progress stays null until the first guess, which is how the hub tells "new" from "in progress".
  state.progress = dailyGuesses.length ? { guesses: dailyGuesses } : null;
  store.save(state);
}

// ---------- header, dialogs, footer ----------

const header = mountHeader({
  slug: SLUG,
  onHelp: () => el.help.showModal(),
  onStats: () => renderStats({
    stats: state.stats, day: today, distTitle: 'כמה נקודות צברתי', labels: G.BUCKET_LABELS,
    highlight: state.won ? G.bucketIndex(G.total(dailyGuesses, dailyRound)) : -1,
  }).showModal(),
});

wireDialog(el.help);
el.help.addEventListener('close', () => {
  // On a first visit the tag swings in once the rules are out of the way, where it can be seen.
  if (!state.seenHelp && !el.card.hidden && game.revealed == null) replay(el.tagHang, 'swing');
  state.seenHelp = true;
  store.save(state);
  focusInput();
});
$('help-link').addEventListener('click', () => el.help.showModal());
$('practice-link').addEventListener('click', startPractice);

const sourceDate = hebrewDate(new Date(G.SOURCE.date + 'T12:00:00Z'), { day: 'numeric', month: 'long', year: 'numeric' });
$('source-line').textContent = `מחירים מ־${G.SOURCE.chain}, נכון ל־${sourceDate}`;
$('help-source').textContent = `המחירים אמיתיים: מחירי המדף בסניף ${G.SOURCE.store}, מתוך קובצי שקיפות המחירים שהרשת מפרסמת, נכון ל־${sourceDate}. בלי מבצעים ומחירי מועדון, ובסניף שלכם המחיר יכול להיות אחר.`;

// ---------- moves ----------

function setError(message) {
  el.error.textContent = message;
  el.input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (!message) return;
  el.field.classList.remove('shake');
  void el.field.offsetWidth; // restart the animation when the same mistake is made twice
  el.field.classList.add('shake');
}

function submitGuess() {
  if (G.isOver(game.guesses) || game.revealed != null) return;
  const value = G.parseGuess(el.input.value);
  if (value == null) { setError(G.guessProblem(el.input.value)); el.input.focus(); return; }
  game.guesses.push(value);
  game.revealed = game.guesses.length - 1;
  if (game.mode === 'daily') {
    if (G.isOver(game.guesses)) {
      const points = G.total(game.guesses, game.round);
      state.stats = recordResult(state.stats, today, points >= G.WIN_TOTAL, G.bucketIndex(points));
    }
    saveDaily();
  }
  render(false, true);
  el.next.focus({ preventScroll: true });
  el.card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function next() {
  game.revealed = null;
  render(true, false, G.isOver(game.guesses));
  if (G.isOver(game.guesses)) {
    scrollTo({ top: 0, behavior: 'smooth' });
    // The button that was just pressed is gone with the card; the focus moves on to the result.
    el.end.querySelector('#end-title')?.focus({ preventScroll: true });
  } else focusInput(true);
}

function startPractice() {
  Object.assign(game, { mode: 'practice', round: G.practiceRound(Math.random, dailyRound.map((p) => p.id)), guesses: [], revealed: null });
  render(true);
  scrollTo({ top: 0, behavior: 'smooth' });
  focusInput();
}

function backToDaily() {
  Object.assign(game, { mode: 'daily', round: dailyRound, guesses: dailyGuesses, revealed: null });
  render(true);
  scrollTo({ top: 0, behavior: 'smooth' });
}

/** On a phone, focusing opens the keypad, so it only happens right after a tap (`fromTap`), never on page load. */
function focusInput(fromTap = false) {
  if (el.card.hidden || el.form.hidden || document.querySelector('dialog[open]')) return;
  if (fromTap || !matchMedia('(pointer: coarse)').matches) el.input.focus({ preventScroll: true });
}

// ---------- rendering ----------

const shekel = (text) => {
  const span = html('span', 'nis', '₪' + text);
  span.dir = 'ltr';
  return span;
};

const price = (n) => '₪' + G.formatPrice(n);

/** Replays a one-shot CSS animation that a class switches on. */
function replay(node, className, on = true) {
  node.classList.remove(className);
  if (!on) return;
  void node.offsetWidth;
  node.classList.add(className);
}

function renderSteps(showing, justRevealed) {
  el.steps.replaceChildren();
  game.round.forEach((product, i) => {
    const li = html('li');
    if (i < game.guesses.length) {
      const score = G.scoreFor(game.guesses[i], product.price);
      li.className = 'done ' + G.grade(score);
      if (justRevealed && i === game.revealed) li.classList.add('fresh');
      const number = html('span', '', score);
      number.setAttribute('aria-hidden', 'true');
      li.append(number, html('span', 'visually-hidden', `מוצר ${i + 1}: ${score} נקודות`));
    } else {
      li.textContent = i + 1;
      if (i === showing) { li.className = 'now'; li.setAttribute('aria-current', 'step'); }
    }
    el.steps.append(li);
  });
}

let revealRun = null;

function renderCard(showing, fresh, justRevealed) {
  el.card.hidden = showing == null;
  revealRun = null;
  if (showing == null) return;
  const product = game.round[showing];
  const drawing = svg('svg', { viewBox: '0 0 96 96' });
  drawing.innerHTML = ART[product.cat] || ART.pantry; // our own static drawings, never user input
  el.art.replaceChildren(drawing);
  el.kicker.textContent = `מוצר ${showing + 1} מתוך ${G.ROUND_SIZE}`;
  el.name.textContent = product.name;
  el.size.textContent = product.size;

  const revealed = game.revealed === showing;
  el.form.hidden = revealed;
  el.after.hidden = !revealed;
  el.reveal.hidden = !revealed;
  // Turning over to the price is animated; coming back to the front is a new tag swinging in.
  el.tag.classList.toggle('no-turn', !revealed);
  flip(el.tag, revealed);
  if (!revealed) {
    void el.tag.offsetWidth;
    el.tag.classList.remove('no-turn');
    replay(el.tagHang, 'swing', fresh);
    // Nothing of the last answer stays in the page while the next product is being guessed.
    for (const node of [el.real, el.verdict, el.points, el.backName, el.diff]) node.textContent = '';
    el.input.value = '';
    setError('');
    return;
  }
  const guess = game.guesses[showing];
  const score = G.scoreFor(guess, product.price);
  const grade = G.grade(score);
  el.backName.textContent = `${product.name} · ${product.size}`;
  el.verdict.textContent = G.GRADE_WORD[grade];
  el.verdict.className = 'verdict ' + grade;
  el.points.textContent = `${score} נקודות`;
  el.points.className = 'points fx-stamp ' + grade;
  el.diff.replaceChildren('ניחשתם ', shekel(G.formatGuess(guess)), ' · ', html('b', '', G.diffLabel(guess, product.price)));
  // The real price sits in the middle of the scale; twice the price or more is the far end.
  el.you.style.setProperty('--at', Math.min(100, (guess / product.price) * 50).toFixed(1) + '%');
  replay(el.you, 'fresh', justRevealed);
  const last = showing === G.ROUND_SIZE - 1;
  el.next.textContent = last ? 'לסיכום' : 'למוצר הבא';

  el.real.dataset.value = price(product.price);
  if (!justRevealed || reducedMotion() || guess === product.price) {
    el.real.textContent = price(product.price);
    if (justRevealed) stamp(el.points, { delay: 500 });
    return;
  }
  // The tag turns over still showing the guess, and the number rolls to the price on the shelf.
  // Then the score is stamped on it.
  const run = revealRun = Symbol('reveal');
  el.real.textContent = price(guess);
  stamp(el.points, { delay: 1250 });
  setTimeout(() => {
    if (revealRun === run) countUp(el.real, product.price, { from: guess, duration: 800, format: price });
  }, 420);
}

function renderLog(over, justEnded) {
  // The product whose price is on screen right now is not repeated in the list.
  const rows = game.guesses.map((guess, i) => ({ guess, product: game.round[i], i })).filter((r) => r.i !== game.revealed);
  const summary = over && game.revealed == null;
  el.logWrap.hidden = rows.length === 0;
  el.logTitle.textContent = summary ? 'המחירים האמיתיים' : 'עד עכשיו';
  el.log.replaceChildren();
  let points = 0;
  for (const { guess, product } of rows) {
    const score = G.scoreFor(guess, product.price);
    points += score;
    const li = html('li', 'row');
    const name = html('span', 'name', product.name + ' ');
    name.append(html('small', '', product.size));
    const yours = html('span', 'yours');
    yours.append('ניחשתם ', shekel(G.formatGuess(guess)), ' · ' + G.diffLabel(guess, product.price));
    const body = html('div', 'body');
    body.append(name, yours);
    const nums = html('div', 'nums');
    const real = html('span', 'price', price(product.price));
    real.dir = 'ltr';
    nums.append(real, html('span', 'score', `${score} נק׳`));
    li.append(html('i', 'sq ' + G.grade(score)), body, nums);
    el.log.append(li);
  }
  // The bottom line of the receipt: the running total, and at the end the total out of 500.
  const total = (n) => (summary ? `${Math.round(n)}/${G.MAX_TOTAL}` : String(Math.round(n)));
  el.totalLabel.textContent = summary ? 'סך הכול נקודות' : 'נקודות עד עכשיו';
  el.receiptFoot.hidden = !summary;
  el.thanks.textContent = game.mode === 'daily' ? 'תודה, ולהתראות מחר' : 'תודה, ולהתראות';
  const printing = summary && justEnded;
  replay(el.receipt, 'printing', printing);
  if (printing) countUp(el.total, points, { duration: 1100, format: total });
  else { el.total.fxCount = null; el.total.textContent = el.total.dataset.value = total(points); }
}

function renderEndPanel(over, justEnded) {
  const show = over && game.revealed == null;
  el.end.hidden = !show;
  if (!show) return;
  const points = G.total(game.guesses, game.round);
  const daily = game.mode === 'daily';
  const won = points >= G.WIN_TOTAL;
  const again = html('button', 'btn ghost', daily ? 'עוד סיבוב לאימון' : 'עוד סיבוב');
  again.id = 'practice-btn';
  again.type = 'button';
  again.addEventListener('click', startPractice);
  const sub = html('span');
  sub.append('צברתם ', html('b', '', points), ` מתוך ${G.MAX_TOTAL} נקודות`);
  renderEnd(el.end, {
    title: G.endTitle(points),
    sub,
    streak: daily && state.won ? currentStreak(state.stats, today) : 0,
    shareText: daily ? () => G.shareText({ day: today, guesses: game.guesses, round: game.round, url: gameUrl() }) : null,
    countdown: daily,
    actions: [again],
  });
  // The same stamp the hub puts on this game's sheet.
  const holder = html('p', 'end-stamp');
  el.end.prepend(holder);
  const mark = stamp(holder, won
    ? { text: `נפתר ${G.summary(game.guesses, game.round)}`, tone: 'found', big: true, icon: 'check', delay: 450 }
    : { text: 'לא הפעם', tone: 'ink', big: true, delay: 450 });
  if (!justEnded) mark.classList.remove('fx-stamp-in');
  else if (won) celebrate({ origin: holder });
}

/**
 * fresh         a new product or screen was dealt (next, practice, back to daily): entrances play
 * justRevealed  a guess was just made: the tag turns over and the result lands
 * justEnded     the round was just finished: the receipt prints and the result is stamped, once
 */
function render(fresh = false, justRevealed = false, justEnded = false) {
  const over = G.isOver(game.guesses);
  const showing = game.revealed != null ? game.revealed : over ? null : game.guesses.length;

  header.setLabel(game.mode === 'practice' ? 'סיבוב אימון' : `חידה ${today} · ${hebrewDate(dateOfDay(today))}`);

  el.banner.hidden = game.mode === 'daily';
  el.banner.replaceChildren();
  if (game.mode === 'practice') {
    const back = html('button', 'link', 'חזרה לחידה היומית');
    back.type = 'button';
    back.addEventListener('click', backToDaily);
    el.banner.append('מצב אימון – לא נספר בסטטיסטיקה · ', back);
  }

  renderSteps(showing, justRevealed);
  renderCard(showing, fresh, justRevealed);
  renderLog(over, justEnded);
  renderEndPanel(over, justEnded);
}

// The tag leans toward the pointer, or with the phone where the browser allows it without asking.
tilt(el.tagHang, { gyro: true });

el.form.addEventListener('submit', (e) => { e.preventDefault(); submitGuess(); });
el.input.addEventListener('input', () => { if (el.error.textContent) setError(''); });
el.next.addEventListener('click', next);

render();
if (!state.seenHelp) el.help.showModal();
else { replay(el.tagHang, 'swing'); focusInput(); }

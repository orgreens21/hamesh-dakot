// Interface for the template game. Copy this file's shape: load state, render from state, save on every move.
import * as G from './game.js';
import { israelDate, dayNumber, dateOfDay, hebrewDate, recordResult, currentStreak } from '../../shared/core.js';
import { createStore, mountHeader, html, icon, toast, wireDialog, renderStats, renderEnd, gameUrl } from '../../shared/ui.js';

const SLUG = '_template';
const $ = (id) => document.getElementById(id);
const el = { board: $('board'), tries: $('tries'), log: $('log'), end: $('end'), banner: $('mode-banner'), help: $('help-dialog') };

// ---------- saved state ----------

const store = createStore(SLUG);
const today = dayNumber(israelDate()); // the site-wide epoch; nothing to configure
const state = store.loadDaily(today, G.MAX_TRIES); // { day, finished, won, summary, progress, stats, seenHelp }
const dailyGuesses = Array.isArray(state.progress?.guesses) ? state.progress.guesses.filter((n) => G.NUMBERS.includes(n)).slice(0, G.MAX_TRIES) : [];

// mode 'daily' is saved and counted; 'practice' is neither.
const game = { mode: 'daily', secret: G.secretForDay(today), guesses: dailyGuesses };

function saveDaily() {
  state.finished = G.isOver(dailyGuesses, game.secret);
  state.won = G.isWon(dailyGuesses, game.secret);
  state.summary = state.finished ? G.summary(dailyGuesses, game.secret) : '';
  // progress stays null until the first move, which is how the hub tells "new" from "in progress".
  state.progress = dailyGuesses.length ? { guesses: dailyGuesses } : null;
  store.save(state);
}

// ---------- header + dialogs ----------

const header = mountHeader({
  slug: SLUG,
  // Only the template passes name and mark; a real game gets both from shared/registry.js.
  name: G.NAME,
  mark: '<circle cx="14" cy="14" r="10"/><path d="M14 8.5v11M10.5 11.5 14 8.5"/>',
  onHelp: () => el.help.showModal(),
  onStats: () => renderStats({
    stats: state.stats, day: today, distTitle: 'באיזה ניסיון הצלחתי',
    highlight: state.won ? dailyGuesses.length - 1 : -1,
  }).showModal(),
});

wireDialog(el.help);
el.help.addEventListener('close', () => { state.seenHelp = true; store.save(state); });

// ---------- moves ----------

function guess(n) {
  if (G.isOver(game.guesses, game.secret)) return;
  if (game.guesses.includes(n)) return toast(`כבר ניסיתם את ${n}`);
  game.guesses.push(n);
  if (game.mode === 'daily') {
    if (G.isOver(game.guesses, game.secret)) {
      state.stats = recordResult(state.stats, today, G.isWon(game.guesses, game.secret), game.guesses.length - 1);
    }
    saveDaily();
  }
  render();
  if (G.isOver(game.guesses, game.secret)) el.end.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function startPractice() {
  let secret;
  do secret = G.NUMBERS[Math.floor(Math.random() * G.NUMBERS.length)];
  while (secret === game.secret);
  Object.assign(game, { mode: 'practice', secret, guesses: [] });
  render();
}

function backToDaily() {
  Object.assign(game, { mode: 'daily', secret: G.secretForDay(today), guesses: dailyGuesses });
  render();
}

// ---------- rendering ----------

const FEEDBACK = { right: 'בול!', higher: 'המספר גדול יותר', lower: 'המספר קטן יותר' };

function render() {
  const over = G.isOver(game.guesses, game.secret);
  const won = G.isWon(game.guesses, game.secret);

  header.setLabel(game.mode === 'practice' ? 'סיבוב אימון' : `חידה ${today} · ${hebrewDate(dateOfDay(today))}`);

  el.banner.hidden = game.mode === 'daily';
  el.banner.replaceChildren();
  if (game.mode === 'practice') {
    const back = html('button', 'link', 'חזרה לחידה היומית');
    back.addEventListener('click', backToDaily);
    el.banner.append('מצב אימון – לא נספר בסטטיסטיקה · ', back);
  }

  el.tries.textContent = over ? 'המשחק הסתיים' : `ניסיון ${game.guesses.length + 1} מתוך ${G.MAX_TRIES}`;

  el.board.replaceChildren();
  for (const n of G.NUMBERS) {
    const tile = html('button', 'tile', n);
    tile.type = 'button';
    const result = game.guesses.includes(n) ? G.evaluate(n, game.secret) : null;
    if (result === 'right' || (over && n === game.secret)) tile.classList.add('right');
    else if (result) tile.classList.add('wrong');
    tile.disabled = over || !!result;
    tile.addEventListener('click', () => guess(n));
    el.board.append(tile);
  }

  el.log.replaceChildren();
  game.guesses.forEach((n) => {
    const result = G.evaluate(n, game.secret);
    const li = html('li', 'try ' + result);
    li.append(html('b', '', n), icon(result === 'right' ? 'check' : result === 'higher' ? 'up' : 'down'), html('span', '', FEEDBACK[result]));
    el.log.append(li);
  });

  el.end.hidden = !over;
  if (!over) return;
  const again = html('button', 'btn ghost', game.mode === 'practice' ? 'עוד סיבוב' : 'עוד סיבוב לאימון');
  again.id = 'practice-btn';
  again.type = 'button';
  again.addEventListener('click', startPractice);
  const sub = html('span');
  sub.append('המספר היה ', html('b', '', game.secret));
  renderEnd(el.end, {
    title: won ? ['ניחוש ראשון!', 'יפה מאוד!', 'ברגע האחרון!'][game.guesses.length - 1] : 'לא נורא, מחר יום חדש',
    sub,
    streak: game.mode === 'daily' && won ? currentStreak(state.stats, today) : 0,
    shareText: game.mode === 'daily' ? () => G.shareText({ day: today, guesses: game.guesses, secret: game.secret, url: gameUrl() }) : null,
    countdown: game.mode === 'daily',
    actions: [again],
  });
}

// Number keys play too: 1–9, and 0 for ten.
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (/^[0-9]$/.test(e.key)) guess(e.key === '0' ? 10 : Number(e.key));
});

render();
if (!state.seenHelp) el.help.showModal();

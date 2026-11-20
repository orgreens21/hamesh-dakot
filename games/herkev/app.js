// Interface for צומת. State lives in a list of guesses; everything on screen is derived from it.
// The grid and its criteria are drawn at once; the day's answer list (one file per topic) is loaded
// next, and the cells come alive when it arrives.
import * as G from './game.js';
import { israelDate, dayNumber, dateOfDay, hebrewDate, recordResult, currentStreak, normalizeHebrew } from '../../shared/core.js';
import { createStore, mountHeader, html, svg, icon, toast, wireDialog, renderStats, renderEnd, gameUrl } from '../../shared/ui.js';
import { stamp, celebrate } from '../../shared/fx.js';
import { emblem } from '../../shared/emblems.js';

const SLUG = 'herkev';
const $ = (id) => document.getElementById(id);
const el = {
  banner: $('mode-banner'), topic: $('topic'), grid: $('grid'), tokens: $('tokens'), giveUp: $('giveup-btn'), archiveBtn: $('archive-btn'), end: $('end'),
  answers: $('answers'), answersList: $('answers-list'),
  help: $('help-dialog'), guess: $('guess-dialog'), criteria: $('guess-criteria'), input: $('player-input'),
  suggestions: $('suggestions'), note: $('guess-note'), tried: $('guess-tried'),
  archive: $('archive-dialog'), archiveList: $('archive-list'),
};

// ---------- saved state ----------

const store = createStore(SLUG);
const today = dayNumber(israelDate());
const state = store.loadDaily(today, G.BUCKETS);

// An archive link (?day=N) replays an earlier grid in memory only: nothing is saved or counted.
const archiveDay = G.archiveDayFromQuery(location.search, today);
const mode = archiveDay == null ? 'daily' : 'archive';
const day = archiveDay ?? today;
const grid = G.gridForDay(day);
const topic = G.topicOf(grid);
const game = { guesses: [], gaveUp: false, ready: false };

const isOver = () => game.ready && G.isOver(grid, game.guesses, game.gaveUp);

function saveDaily() {
  const over = isOver();
  if (over) {
    const solved = G.solvedCount(grid, game.guesses);
    const won = G.isWon(grid, game.guesses);
    const before = state.stats;
    state.stats = recordResult(before, today, won, solved);
    // recordResult only charts wins; this game charts every finished day by cells filled.
    if (state.stats !== before && !won) state.stats.distribution[solved] += 1;
  }
  state.finished = over;
  state.won = over && G.isWon(grid, game.guesses);
  state.summary = over ? G.summary(grid, game.guesses) : '';
  // progress stays null until the first move, which is how the hub tells "new" from "in progress".
  state.progress = game.guesses.length || game.gaveUp ? { guesses: game.guesses, gaveUp: game.gaveUp } : null;
  store.save(state);
}

// ---------- header + dialogs ----------

const header = mountHeader({
  slug: SLUG,
  onHelp: () => el.help.showModal(),
  onStats: () => renderStats({
    stats: state.stats, day: today, distTitle: 'כמה משבצות מילאתי',
    labels: Array.from({ length: G.BUCKETS }, (_, n) => String(n)),
    highlight: state.finished && game.ready && mode === 'daily' ? G.solvedCount(grid, state.progress?.guesses) : -1,
  }).showModal(),
});

[el.help, el.guess, el.archive].forEach(wireDialog);
// The same drawing the hub shows for this game, so the rules feel like the back of that card.
el.help.prepend(emblem(SLUG));
el.help.addEventListener('close', () => { state.seenHelp = true; store.save(state); });

const retrieved = hebrewDate(new Date(G.RETRIEVED + 'T12:00:00Z'), { day: 'numeric', month: 'long', year: 'numeric' });
document.querySelectorAll('.retrieved').forEach((node) => { node.textContent = retrieved; });

// ---------- drawing criteria ----------

// Line icons on the same 24×24 grid as shared/ui.js, for criteria and topics.
const ICONS = {
  flag: '<path d="M6 21V4M6 5h12l-2.5 3.5L18 12H6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.4 3.2 14.6 0 18M12 3c-3.2 3.4-3.2 14.6 0 18"/>',
  plane: '<path d="M21 3 3 10.5l7 2.5 2.5 7L21 3ZM10 13l4.5-4.5"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="1.5"/><path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  speech: '<path d="M4 5.5h16v10H11l-4.5 4v-4H4Z"/><path d="M8 9.5h8M8 12.5h5"/>',
  stars: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="1.6 3.3"/><path d="m12 8.5 1.1 2.3 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3Z"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.4 3.1 8 7.5 9.5 4.4-1.5 7.5-5.1 7.5-9.5V6Z"/><path d="M12 7.5v9M8 12h8"/>',
  crown: '<path d="M4 17.5 3 7.5l5 4 4-6 4 6 5-4-1 10Z"/><path d="M4.5 20.5h15"/>',
  border: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20Z"/><path d="M9 4v13.5M15 6.5V20" stroke-dasharray="2 2.2"/>',
  mountain: '<path d="M2.5 19.5 9 8l3.5 6 2.5-4 6.5 9.5Z"/><path d="m7.2 11.2 1.8 1.3 1.5-1.4"/>',
  island: '<path d="M3 19c2 0 2-1.2 4.5-1.2S9.5 19 12 19s2.5-1.2 4.5-1.2S19 19 21 19"/><path d="M7 15.5c1.5-1.4 3.4-2 5-2s3.5.6 5 2M12 13.5V5.5M12 5.5c-1.6-1.4-4.2-1.4-6 .5M12 5.5c1.6-1.4 4.2-1.4 6 .5"/>',
  waves: '<path d="M3 9c2 0 2-1.5 4.5-1.5S9.5 9 12 9s2.5-1.5 4.5-1.5S19 9 21 9M3 14c2 0 2-1.5 4.5-1.5S9.5 14 12 14s2.5-1.5 4.5-1.5S19 14 21 14M3 19c2 0 2-1.5 4.5-1.5S9.5 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19"/>',
  car: '<path d="M4 16.5V12l2-5h12l2 5v4.5Z"/><path d="M4 12h16"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.6a4.2 4.2 0 1 0 0 6.8M7 10.8h6M7 13.2h6"/>',
  torch: '<path d="M8.5 10.5h7l-2 10h-3Z"/><path d="M12 8c-2-1.6-1.6-3.6 0-5.5 1.6 1.9 2 3.9 0 5.5Z"/>',
  ball: '<circle cx="12" cy="12" r="8.5"/><path d="m12 8.2 3.2 2.3-1.2 3.8h-4l-1.2-3.8ZM12 3.5v4.7M15.2 10.5l4.3-1.6M14 14.3l2.7 3.8M10 14.3l-2.7 3.8M8.8 10.5 4.5 8.9"/>',
  people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M15.5 14.2c3 0 5 2 5 5.3"/>',
  ruler: '<path d="m3.5 15.5 12-12 5 5-12 12Z"/><path d="m7 12 2 2M9.5 9.5l1.5 1.5M12 7l2 2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>',
  mask: '<path d="M4 5.5c5 1.6 11 1.6 16 0V11c0 5-3.6 8.5-8 8.5S4 16 4 11Z"/><path d="M7.5 10.5c.8-.7 2-.7 2.8 0M13.7 10.5c.8-.7 2-.7 2.8 0M9 14.5c1.8 1.4 4.2 1.4 6 0"/>',
  pen: '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5Z"/><path d="m13.5 7 3 3"/>',
  tv: '<rect x="3" y="6.5" width="18" height="12" rx="1.5"/><path d="m8.5 2.5 3.5 4 3.5-4M8 21.5h8"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10.7 5.5 3h4l2.5 5.5L14.5 3h4l-3 7.7"/><path d="m12 12.5.8 1.7 1.8.2-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2Z"/>',
  note: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/><path d="M9 9.5l11-2"/>',
  keys: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M7.5 5v9M12 5v9M16.5 5v9M5.5 5v7.5M9.5 5v7.5M14.5 5v7.5M18.5 5v7.5M7.5 14v5M12 14v5M16.5 14v5"/>',
  guitar: '<path d="m20.5 3.5-8 8"/><path d="m18.5 2.5 3 3"/><path d="M12 9.5c-1.4-.3-2.9.1-3.6 1.5-.5 1-1.5 1.3-2.6 1.5-2.6.6-3.4 4-1.3 6.1s5.5 1.3 6.1-1.3c.2-1.1.5-2.1 1.5-2.6 1.4-.7 1.8-2.2 1.5-3.6"/><circle cx="9" cy="15" r="1.4"/>',
  pin: '<path d="M12 21s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.4"/>',
  film: '<rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M7.5 4v16M16.5 4v16M3.5 8h4M3.5 12h4M3.5 16h4M16.5 8h4M16.5 12h4M16.5 16h4"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4c0 3 1.2 4.5 3.3 4.8M17 6h3c0 3-1.2 4.5-3.3 4.8M12 14v3.5M8 20.5h8M9.5 17.5h5"/>',
  clapper: '<path d="M3.5 10h17v10h-17Z"/><path d="m3.5 10-.6-3.6 16.2-2.8.6 3.6M8 9.4l2-3.4M13.3 8.5l2-3.4"/>',
  map: '<path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2Z"/><path d="M9 4.5v13M15 6.5v13"/>',
  house: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5M10 20v-5.5h4V20"/>',
  person: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5c0-4 3.1-7 7-7s7 3 7 7"/>',
  train: '<rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 10h12M9.5 13.2h.01M14.5 13.2h.01M8.5 16 6 21M15.5 16l2.5 5M7.3 18.5h9.4"/>',
};

function drawn(name, className = 'icon') {
  const node = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: className });
  node.innerHTML = ICONS[name] || '';
  return node;
}

/** A criterion with two colours (a club's kit, a flag colour) is an enamel chip; any other is a small drawn icon. */
function chip(criterion) {
  if (!criterion.colors) return drawn(criterion.icon, 'icon chip-icon');
  const node = html('span', 'chip');
  node.style.setProperty('--c1', criterion.colors[0]);
  node.style.setProperty('--c2', criterion.colors[1]);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

const rows = grid.rows.map(G.criterion);
const cols = grid.cols.map(G.criterion);
const criteriaOf = (cell) => [rows[Math.floor(cell / G.SIZE)], cols[cell % G.SIZE]];

// ---------- the grid ----------

// Built once and updated in place, so a cell keeps the keyboard focus when its content changes.
// Every cell is a two-sided card: the front is an empty slot on the board, the back is the answer's
// sticker. A right answer turns the card over.
const corner = html('div', 'corner');
const cellButtons = [];
const cellFaces = [];
// Stickers are put down by hand, so none of them sits quite straight.
const LEAN = [-1.6, 1.1, -0.7, 1.4, -1.2, 0.8, -1, 1.7, -1.4];

function buildGrid() {
  const at = (node, row, col) => { node.style.gridArea = `${row} / ${col}`; return node; };
  const headCell = (criterion, side) => {
    const node = html('div', 'head ' + side);
    node.append(chip(criterion), html('span', '', criterion.name));
    node.title = criterion.detail;
    return node;
  };
  // The board lies under the nine cells only; the criteria stay on the paper around it.
  const board = html('div', 'board');
  board.setAttribute('aria-hidden', 'true');
  el.grid.append(at(corner, 1, 1), board, ...cols.map((c, i) => at(headCell(c, 'col'), 1, i + 2)));
  rows.forEach((row, r) => {
    el.grid.append(at(headCell(row, 'row'), r + 2, 1));
    for (let c = 0; c < G.SIZE; c++) {
      const cell = r * G.SIZE + c;
      const button = html('button', 'cell fx-flip');
      button.type = 'button';
      button.id = 'cell-' + cell;
      button.style.setProperty('--lean', LEAN[cell] + 'deg');
      const inner = html('span', 'fx-flip-inner');
      const front = html('span', 'fx-face fx-front slot');
      const back = html('span', 'fx-face fx-back sticker');
      inner.append(front, back);
      button.append(inner);
      button.disabled = true; // until the answer list has arrived
      button.addEventListener('click', () => openGuess(cell));
      cellButtons.push(button);
      cellFaces.push({ front, back });
      el.grid.append(at(button, r + 2, c + 2));
    }
  });
}

function renderGrid(position, over) {
  corner.replaceChildren(html('b', '', position.left), position.left === 1 ? 'ניחוש נותר' : 'ניחושים נותרו');
  corner.id = 'tries';
  cellButtons.forEach((button, cell) => {
    const [row, col] = criteriaOf(cell);
    const { front, back } = cellFaces[cell];
    const player = G.itemById(grid.topic, position.filled[cell]);
    const missed = position.misses[cell].length;
    button.className = 'cell fx-flip' + (player ? ' right is-flipped' : over ? ' missed' : '');
    button.disabled = over || !!player;
    front.replaceChildren(over && !player ? icon('cross') : drawn('plus'));
    back.replaceChildren();
    if (player) {
      back.append(player.name);
    } else if (missed) {
      // One small red card per wrong guess spent on the cell.
      const cards = html('span', 'misses');
      for (let i = 0; i < missed; i++) cards.append(html('i'));
      front.append(cards);
    }
    const status = player ? player.name : over ? 'נשארה ריקה' : missed ? `ריקה, ${missed} ניחושים שגויים` : 'ריקה';
    button.setAttribute('aria-label', `${row.name} ו${col.name}: ${status}`);
  });
}

/** The nine guesses as a row of counters: still in hand, spent on a right answer, or spent on a miss. */
function renderTokens(position) {
  // Walk the guesses in the order they were made; a guess was right if it is the one sitting in its cell.
  const spent = game.guesses.map(([cell, id]) => position.filled[cell] === id);
  const right = spent.filter(Boolean).length;
  el.tokens.setAttribute('aria-label', `ניחושים: ${right} נכונים, ${spent.length - right} שגויים, ${position.left} נותרו`);
  el.tokens.replaceChildren(...Array.from({ length: G.MAX_GUESSES }, (_, i) => {
    const token = html('li', i < spent.length ? (spent[i] ? 'spent hit' : 'spent miss') : '');
    if (i < spent.length && spent[i]) token.append(icon('check'));
    return token;
  }));
}

// ---------- guessing ----------

let searchIndex = [];
let openCell = -1;
let matches = [];
let active = -1;

function openGuess(cell) {
  if (isOver()) return;
  openCell = cell;
  el.criteria.replaceChildren(...criteriaOf(cell).map((criterion) => {
    const li = html('li');
    li.append(chip(criterion), html('b', '', criterion.name), html('small', '', criterion.detail));
    return li;
  }));
  const tried = G.replay(grid, game.guesses).misses[cell].map((id) => G.itemById(grid.topic, id).name);
  el.tried.hidden = !tried.length;
  el.tried.textContent = tried.length ? `כבר ניסיתם כאן: ${tried.join(', ')}` : '';
  el.input.value = '';
  el.note.textContent = '';
  closeSuggestions();
  el.guess.showModal();
  el.input.focus();
}

function submitGuess(player) {
  const verdict = G.judge(grid, game.guesses, openCell, player.id, game.gaveUp);
  if (verdict === 'placed') { el.note.textContent = `את ${player.name} כבר שיבצתם במשבצת אחרת`; return; }
  if (verdict === 'repeat') { el.note.textContent = `כבר ניסיתם את ${player.name} במשבצת הזאת`; return; }
  if (verdict !== 'right' && verdict !== 'wrong') { el.guess.close(); return; }

  const cell = openCell;
  game.guesses.push([cell, player.id]);
  if (mode === 'daily') saveDaily();
  el.guess.close();
  render(true);
  const button = cellButtons[cell];
  // A right answer turns the card over by itself (the class set in renderGrid). A miss shakes the slot
  // and a red card drops onto it.
  if (verdict === 'wrong') {
    button.classList.add('shake');
    button.addEventListener('animationend', () => button.classList.remove('shake'), { once: true });
    button.querySelector('.misses i:last-child')?.classList.add('new');
  }
  el.tokens.children[game.guesses.length - 1]?.classList.add('new');
  toast(verdict === 'right' ? `${player.name} בפנים!` : `${player.name}: לא מתאים למשבצת הזאת`);
  if (isOver()) el.end.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Closing the dialog gives the focus back to the cell, and a filled cell is disabled. A keyboard
  // player goes on to the next open cell (or to the result) instead of starting again from the top.
  // (Not on a touch screen: after typing, the browser would draw a focus ring on that next cell,
  // and it would look like the game had picked it.)
  if (button.disabled) {
    const next = [...cellButtons.slice(cell + 1), ...cellButtons.slice(0, cell)].find((b) => !b.disabled);
    if (isOver()) el.end.querySelector('#end-title')?.focus({ preventScroll: true });
    else if (!matchMedia('(pointer: coarse)').matches) next?.focus({ preventScroll: true });
  }
}

function closeSuggestions() {
  matches = [];
  active = -1;
  el.suggestions.hidden = true;
  el.suggestions.replaceChildren();
  el.input.setAttribute('aria-expanded', 'false');
  el.input.removeAttribute('aria-activedescendant');
}

function renderSuggestions() {
  el.note.textContent = '';
  if (!normalizeHebrew(el.input.value)) return closeSuggestions();
  matches = G.searchItems(searchIndex, el.input.value);
  active = matches.length ? 0 : -1;
  el.suggestions.replaceChildren();
  if (!matches.length) el.suggestions.append(html('li', 'none', topic.none));
  const position = G.replay(grid, game.guesses);
  matches.forEach((player, i) => {
    const spent = position.placed.has(player.id) || position.misses[openCell]?.includes(player.id);
    const li = html('li', spent ? 'used' : '', player.name);
    li.id = 'sg-' + i;
    li.setAttribute('role', 'option');
    // Only namesakes carry a hint (their birth year), to tell them apart.
    if (player.hint) li.append(html('small', '', player.hint));
    // mousedown fires before the input loses focus, so the tap is never swallowed by blur.
    li.addEventListener('mousedown', (e) => e.preventDefault());
    li.addEventListener('click', () => submitGuess(player));
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

el.input.addEventListener('input', renderSuggestions);
el.input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!matches.length) return;
    e.preventDefault();
    active = (active + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
    highlight();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (matches[active]) submitGuess(matches[active]);
    else if (normalizeHebrew(el.input.value)) el.note.textContent = 'בחרו שם מהרשימה';
  }
});

// ---------- giving up ----------

// Two taps, so a slip of the thumb does not end the day's game.
let armedTimer;
function disarm() {
  clearTimeout(armedTimer);
  el.giveUp.classList.remove('armed');
  el.giveUp.textContent = 'סיימתי, הראו לי תשובות';
}
el.giveUp.addEventListener('click', () => {
  if (isOver()) return;
  if (!el.giveUp.classList.contains('armed')) {
    el.giveUp.classList.add('armed');
    el.giveUp.textContent = 'בטוחים? לחצו שוב כדי לסיים';
    armedTimer = setTimeout(disarm, 4000);
    return;
  }
  disarm();
  game.gaveUp = true;
  if (mode === 'daily') saveDaily();
  render(true);
  el.end.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------- archive ----------

const dayLabel = (n) => hebrewDate(dateOfDay(n));
const archive = G.archiveDays(today);
el.archiveBtn.hidden = archive.length === 0;
el.archiveBtn.addEventListener('click', () => {
  el.archiveList.replaceChildren(...archive.map((n) => {
    const li = html('li');
    const a = html('a');
    a.href = `?day=${n}`;
    a.append(html('b', '', `${G.NAME} ${n}`), html('span', 'muted', `${G.topicOf(G.gridForDay(n)).label} · ${dayLabel(n)}`));
    if (n === day) a.setAttribute('aria-current', 'page');
    li.append(a);
    return li;
  }));
  el.archive.showModal();
});

// ---------- after the game ----------

const SHOWN_ANSWERS = 5;

function renderAnswers(position) {
  el.answersList.replaceChildren();
  for (let cell = 0; cell < G.CELLS; cell++) {
    const [row, col] = criteriaOf(cell);
    const mine = position.filled[cell];
    const valid = G.answersFor(grid, cell);
    const others = valid.filter((p) => p.id !== mine).slice(0, SHOWN_ANSWERS);
    const li = html('li');
    li.id = 'answer-' + cell;
    const head = html('p', 'answer-head');
    const mark = icon(mine != null ? 'check' : 'cross');
    mark.classList.add(mine != null ? 'hit' : 'miss');
    head.append(mark, `${row.name} × ${col.name}`);
    const names = html('p', 'answer-names');
    if (mine != null) names.append(html('b', '', G.itemById(grid.topic, mine).name), ' · ');
    names.append(others.map((p) => p.name).join(' · '));
    const rest = valid.length - others.length - (mine != null ? 1 : 0);
    if (rest > 0) names.append(' ', html('span', 'more', `ועוד ${rest}`));
    li.append(head, names);
    el.answersList.append(li);
  }
}

/** Everything on screen, from the current state. `fresh` is true when a move has just been made. */
function render(fresh = false) {
  const position = G.replay(grid, game.guesses);
  const over = isOver();

  header.setLabel(`${G.NAME} ${day} · ${dayLabel(day)}`);

  el.banner.hidden = mode === 'daily';
  if (mode === 'archive' && !el.banner.childNodes.length) {
    const back = html('a', '', 'חזרה לרשת של היום');
    back.href = './';
    el.banner.append('רשת מהארכיון – לא נספרת בסטטיסטיקה · ', back);
  }

  renderGrid(position, over);
  renderTokens(position);
  el.giveUp.hidden = over;
  el.end.hidden = !over;
  el.answers.hidden = !over;
  if (!over) return;

  const actions = [];
  if (mode === 'archive') {
    const back = html('a', 'btn ghost', 'לרשת של היום');
    back.id = 'today-btn';
    back.href = './';
    actions.push(back);
  }
  renderEnd(el.end, {
    title: G.endTitle(position.solved),
    sub: `מילאתם ${position.solved} מתוך ${G.CELLS} משבצות`,
    streak: mode === 'daily' && state.won ? currentStreak(state.stats, today) : 0,
    shareText: mode === 'daily' ? () => G.shareText({ day, grid, guesses: game.guesses, url: gameUrl() }) : null,
    countdown: mode === 'daily',
    actions,
  });
  // The score is stamped on the sheet. It only slams down (and the paper only flies) at the moment the
  // game ends, not when a finished game is opened again.
  const holder = html('p', 'end-stamp');
  holder.setAttribute('aria-hidden', 'true'); // the same score is in the line under the title
  el.end.prepend(holder);
  const won = G.isWon(grid, game.guesses);
  const mark = stamp(holder, { text: G.summary(grid, game.guesses), tone: won ? 'found' : 'ink', big: true, angle: -6 });
  if (!fresh) mark.classList.remove('fx-stamp-in');
  // The paper flies once the stamp has landed and the page has finished scrolling to it.
  else if (won) setTimeout(() => celebrate({ origin: mark }), 400);
  renderAnswers(position);
}

function drawTopic() {
  $('kit-note').hidden = grid.topic !== 'football';
  el.input.placeholder = topic.placeholder;
  el.input.setAttribute('aria-label', `שם של ${topic.noun}`);
  $('help-today').replaceChildren(mode === 'daily' ? 'הנושא היום: ' : 'הנושא: ', html('b', '', topic.label), ` – ${topic.example}.`);
  el.topic.replaceChildren(drawn(topic.icon, 'icon topic-icon'), html('span', 'topic-kicker', mode === 'daily' ? 'נושא היום' : 'הנושא'), html('b', 'topic-name', topic.label));
}

/** Before the answer list arrives: the topic, the criteria and nine closed cells, nothing to play yet. */
function renderWaiting() {
  header.setLabel(`${G.NAME} ${day} · ${dayLabel(day)}`);
  corner.replaceChildren(html('b', '', G.MAX_GUESSES), 'ניחושים נותרו');
  corner.id = 'tries';
  cellFaces.forEach(({ front }, cell) => {
    front.replaceChildren(drawn('plus'));
    const [row, col] = criteriaOf(cell);
    cellButtons[cell].setAttribute('aria-label', `${row.name} ו${col.name}`);
  });
  el.tokens.replaceChildren(...Array.from({ length: G.MAX_GUESSES }, () => html('li')));
  el.giveUp.hidden = true;
}

drawTopic();
buildGrid();
// The board does not lean with the phone: its criteria are text, read while the cells are played.
renderWaiting();
if (!state.seenHelp) el.help.showModal();

G.loadTopic(grid.topic).then((data) => {
  searchIndex = G.buildSearchIndex(data.items);
  // replay() keeps only guesses that could really have been made, whatever was in storage
  // (including progress saved for a different grid, which leaves nothing).
  if (mode === 'daily') {
    game.guesses = G.replay(grid, state.progress?.guesses).guesses;
    game.gaveUp = state.progress?.gaveUp === true;
  }
  game.ready = true;
  el.grid.dataset.ready = 'true';
  render();
}, () => {
  el.topic.append(html('span', 'topic-error', 'לא הצלחנו לטעון את רשימת התשובות. נסו לרענן את הדף.'));
});

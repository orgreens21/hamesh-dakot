// Interface for ארבע על ארבע: load state, render from state, save on every move.
import * as G from './game.js';
import { israelDate, dayNumber, dateOfDay, hebrewDate, recordResult, currentStreak, seededShuffle } from '../../shared/core.js';
import { createStore, mountHeader, html, toast, wireDialog, renderStats, renderEnd, gameUrl } from '../../shared/ui.js';
import { tilt, stamp, celebrate, reducedMotion } from '../../shared/fx.js';
import { emblem } from '../../shared/emblems.js';

const SLUG = 'arba';
const $ = (id) => document.getElementById(id);
const el = {
  banner: $('mode-banner'), lead: $('lead'), bands: $('bands'), grid: $('grid'), status: $('status'), lives: $('lives'),
  count: $('picked-count'), controls: $('controls'), shuffle: $('shuffle-btn'), clear: $('clear-btn'), submit: $('submit-btn'),
  tray: $('tray'), end: $('end'), help: $('help-dialog'), archive: $('archive-dialog'), archiveList: $('archive-list'),
};

// ---------- saved state ----------

const store = createStore(SLUG);
const today = dayNumber(israelDate());
const BUCKETS = G.MAX_MISTAKES; // a win lands in the bar for 0, 1, 2 or 3 mistakes
const state = store.loadDaily(today, BUCKETS);

const ALL = Array.from({ length: G.GROUPS * G.SIZE }, (_, i) => i);
const isLayout = (o) => Array.isArray(o) && o.length === ALL.length && ALL.every((i) => o.includes(i));

// ?day=N opens an earlier puzzle from the archive: played for fun, never saved and never counted.
const asked = Number(new URLSearchParams(location.search).get('day'));
const archiveDay = Number.isInteger(asked) && asked >= 1 && asked < today ? asked : null;

const game = archiveDay != null
  ? { mode: 'archive', day: archiveDay, guesses: [], order: G.initialOrder(archiveDay) }
  : {
    mode: 'daily', day: today,
    guesses: G.cleanGuesses(state.progress?.guesses),
    order: isLayout(state.progress?.order) ? state.progress.order : G.initialOrder(today),
  };
game.puzzle = G.puzzleForDay(game.day);
let picked = [];
let fresh = -1; // the group that was just found, so only its band animates
let shuffles = 0;

function saveDaily() {
  if (game.mode !== 'daily') return;
  state.finished = G.isOver(game.guesses);
  state.won = G.isWon(game.guesses);
  state.summary = state.finished ? G.summary(game.guesses) : '';
  // progress stays null until the first guess, which is how the hub tells "new" from "in progress".
  state.progress = game.guesses.length ? { guesses: game.guesses, order: game.order } : null;
  store.save(state);
}

// ---------- header + dialogs ----------

// The rules open with the same drawing the hub shows for this game, so the two pages read as one object.
const helpEmblem = emblem(SLUG);
el.help.prepend(helpEmblem);
function openHelp() {
  el.help.showModal();
  helpEmblem.classList.remove('is-playing');
  void helpEmblem.offsetWidth;
  helpEmblem.classList.add('is-playing');
}

const header = mountHeader({
  slug: SLUG,
  onHelp: openHelp,
  onStats: () => renderStats({
    stats: state.stats, day: today, distTitle: 'בכמה טעויות פתרתי', labels: ['0', '1', '2', '3'],
    highlight: state.won ? G.mistakes(G.cleanGuesses(state.progress?.guesses)) : -1,
  }).showModal(),
});

wireDialog(el.help);
wireDialog(el.archive);
el.help.addEventListener('close', () => { state.seenHelp = true; store.save(state); });

function openArchive() {
  el.archiveList.replaceChildren();
  // Newest first. Capped so the list stays a list and not a scroll through the whole year.
  for (let day = today - 1; day >= Math.max(1, today - 120); day--) {
    const li = html('li');
    const a = html('a');
    a.href = `?day=${day}`;
    a.append(html('b', '', `חידה ${day}`), html('span', 'muted', hebrewDate(dateOfDay(day))));
    li.append(a);
    el.archiveList.append(li);
  }
  if (!el.archiveList.children.length) el.archiveList.append(html('li', 'empty', 'הארכיון ייפתח מחר, עם החידה הראשונה שתעבור אליו.'));
  el.archive.showModal();
}

// ---------- moves ----------

const remaining = () => {
  const solved = G.solvedGroups(game.guesses);
  return game.order.filter((i) => !solved.includes(G.groupOf(i)));
};

function toggle(index) {
  if (G.isOver(game.guesses)) return;
  if (picked.includes(index)) picked = picked.filter((i) => i !== index);
  else if (picked.length < G.SIZE) picked.push(index);
  else return toast('אפשר לסמן רק ארבע מילים');
  syncSelection();
}

function submit() {
  if (picked.length !== G.SIZE || G.isOver(game.guesses)) return;
  if (G.isRepeat(game.guesses, picked)) return toast('את הצירוף הזה כבר ניסיתם');
  const result = G.evaluate(picked);
  const hadFocus = document.activeElement === el.submit;
  game.guesses.push([...picked]);
  const over = G.isOver(game.guesses);
  if (game.mode === 'daily' && over) {
    state.stats = recordResult(state.stats, today, G.isWon(game.guesses), G.mistakes(game.guesses));
  }
  saveDaily();

  const from = rects();
  if (result.correct) {
    const chosen = [...picked];
    picked = [];
    fresh = result.group;
    render({ from, ended: over });
    fresh = -1;
    fuse(chosen, from);
    if (over) setTimeout(() => celebrate({ origin: el.bands.lastElementChild }), FUSE_MS - 250);
  } else if (over) {
    picked = [];
    render({ from, ended: true });
  } else {
    // The selection stays, so after "one away" the player can swap a single word.
    renderStatus(true);
    for (const tile of el.grid.querySelectorAll('.tile[aria-pressed="true"]')) {
      tile.classList.remove('shake');
      void tile.offsetWidth; // restart the animation when the same tiles are wrong twice in a row
      tile.classList.add('shake');
    }
    toast(result.oneAway ? 'כמעט! רק מילה אחת לא שייכת' : 'לא הפעם');
  }
  if (over) el.end.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // A found group empties the selection, which disables the button a keyboard player has just pressed.
  // The focus goes on to the grid (or to the result) instead of being dropped at the top of the page.
  if (hadFocus && (result.correct || over)) (over ? el.end.querySelector('#end-title') : el.grid.querySelector('.tile'))?.focus({ preventScroll: true });
}

function shuffle() {
  const solved = G.solvedGroups(game.guesses);
  const rest = seededShuffle(remaining(), Date.now() + shuffles++);
  game.order = [...game.order.filter((i) => solved.includes(G.groupOf(i))), ...rest];
  if (game.guesses.length) saveDaily();
  const from = rects();
  renderGrid();
  slide(from);
}

$('archive-open').addEventListener('click', openArchive);
el.submit.addEventListener('click', submit);
el.shuffle.addEventListener('click', shuffle);
el.clear.addEventListener('click', () => { picked = []; syncSelection(); });

// Arrow keys walk the grid. The page is right-to-left, so the left arrow moves to the next tile.
el.grid.addEventListener('keydown', (e) => {
  const step = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: G.SIZE, ArrowUp: -G.SIZE }[e.key];
  if (!step) return;
  const tiles = [...el.grid.querySelectorAll('.tile')];
  const next = tiles[tiles.indexOf(document.activeElement) + step];
  if (next) { e.preventDefault(); next.focus(); }
});

// ---------- rendering ----------

function band(group, missed) {
  const g = game.puzzle.groups[group];
  const li = html('li', `band t${g.tier}${missed ? ' missed' : ''}${group === fresh ? ' fresh' : ''}`);
  li.dataset.tier = g.tier;
  li.append(
    html('span', 'band-tier', G.TIERS[group].name),
    html('h3', 'band-title', g.title),
    html('p', 'band-words', g.words.join(' · ')),
  );
  return li;
}

/** Shrinks a tile's text until its longest word fits the width and the whole entry fits the height. */
function fit(tile) {
  const label = tile.firstElementChild;
  let size = 18;
  tile.style.fontSize = '';
  while (size > 9 && (label.scrollWidth > label.clientWidth || label.scrollHeight > tile.clientHeight - 6)) {
    size -= 0.5;
    tile.style.fontSize = size + 'px';
  }
}
const fitAll = () => { for (const tile of el.grid.children) fit(tile); };

// ---------- motion: tiles are blocks that slide, and a found group fuses into one band ----------
// All of it is decoration on top of a page that is already in its final state: nothing waits for it.

const EASE = 'cubic-bezier(.16, 1, .3, 1)';
const FUSE_MS = 1050;

/** Where every tile is on screen right now, by word index. */
const rects = () => new Map([...el.grid.children].map((t) => [Number(t.dataset.index), t.getBoundingClientRect()]));

/** Tiles that were somewhere else a moment ago slide from there to where they are now. */
function slide(from) {
  if (reducedMotion()) return;
  for (const tile of el.grid.children) {
    const was = from.get(Number(tile.dataset.index));
    if (!was) continue;
    const now = tile.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    tile.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 460, easing: EASE });
  }
}

/**
 * The four chosen tiles fly from where they stood into one row over the new band, the row tips over,
 * and the band turns up in its colour. The flying copies are decoration (aria-hidden) and are removed.
 */
function fuse(chosen, from) {
  const band = el.bands.querySelector('.band.fresh');
  if (!band || reducedMotion() || !band.animate) return;
  const sources = chosen.map((i) => ({ rect: from.get(i), word: game.puzzle.words[i] })).filter((s) => s.rect)
    .sort((a, b) => b.rect.left - a.rect.left || a.rect.top - b.rect.top);
  if (sources.length !== G.SIZE) return;

  const home = band.getBoundingClientRect();
  const trayBox = el.tray.getBoundingClientRect();
  const layer = html('div', 'fuse');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.top = `${home.top - trayBox.top}px`;
  layer.style.left = `${home.left - trayBox.left}px`;
  layer.style.width = `${home.width}px`;
  layer.style.height = `${home.height}px`;
  for (const s of sources) layer.append(html('span', 'fuse-chip', s.word));
  el.tray.append(layer);

  const fly = 430;
  const gap = 45;
  const landed = fly + gap * (G.SIZE - 1);
  [...layer.children].forEach((chip, k) => {
    const to = chip.getBoundingClientRect();
    const { rect } = sources[k];
    chip.animate([
      { transform: `translate(${rect.left - to.left}px, ${rect.top - to.top}px) scale(${rect.width / to.width}, ${rect.height / to.height})` },
      { transform: 'translate(0, -7px) scale(1.04)', offset: 0.75 },
      { transform: 'none' },
    ], { duration: fly, delay: k * gap, easing: EASE, fill: 'backwards' });
  });
  const tip = layer.animate([{ transform: 'perspective(700px) rotateX(0)' }, { transform: 'perspective(700px) rotateX(-90deg)' }],
    { duration: 170, delay: landed, easing: 'ease-in', fill: 'forwards' });
  band.animate([
    { transform: 'perspective(700px) rotateX(90deg)', opacity: 0 },
    { transform: 'perspective(700px) rotateX(90deg)', opacity: 1, offset: 0.01 },
    { transform: 'perspective(700px) rotateX(-9deg)', opacity: 1, offset: 0.6 },
    { transform: 'perspective(700px) rotateX(0)', opacity: 1 },
  ], { duration: FUSE_MS - landed - 170, delay: landed + 170, easing: 'ease-out', fill: 'backwards' });
  const done = () => layer.remove();
  tip.finished.then(done, done);
}

function renderGrid({ deal = false } = {}) {
  const focused = document.activeElement?.dataset?.index;
  el.grid.replaceChildren();
  el.grid.classList.toggle('deal', deal);
  if (G.isOver(game.guesses)) return;
  for (const [n, index] of remaining().entries()) {
    const tile = html('button', 'tile');
    tile.type = 'button';
    tile.dataset.index = index;
    tile.style.setProperty('--i', n);
    tile.setAttribute('aria-pressed', String(picked.includes(index)));
    tile.append(html('span', '', game.puzzle.words[index]));
    tile.addEventListener('click', () => toggle(index));
    el.grid.append(tile);
  }
  fitAll();
  if (focused != null) el.grid.querySelector(`[data-index="${focused}"]`)?.focus();
}

function syncSelection() {
  for (const tile of el.grid.children) tile.setAttribute('aria-pressed', String(picked.includes(Number(tile.dataset.index))));
  renderStatus();
}

/** The mistakes left are a strip of tickets; `tear` rips off the one that was just spent. */
function renderStatus(tear = false) {
  const left = G.MAX_MISTAKES - G.mistakes(game.guesses);
  const dots = html('span', 'tickets');
  for (let i = 0; i < G.MAX_MISTAKES; i++) dots.append(html('i', i < left ? '' : i === left && tear ? 'spent torn' : 'spent'));
  el.lives.replaceChildren('טעויות שנשארו', dots);
  el.lives.setAttribute('aria-label', `נשארו ${left} טעויות מתוך ${G.MAX_MISTAKES}`);
  el.lives.dataset.left = left;
  el.count.textContent = `${picked.length}/${G.SIZE} מסומנות`;
  el.submit.disabled = picked.length !== G.SIZE;
  el.clear.disabled = picked.length === 0;
}

function trail() {
  const box = html('div', 'trail');
  box.setAttribute('aria-hidden', 'true');
  box.classList.add('fx-layer');
  for (const guess of game.guesses) {
    const row = html('div');
    for (const i of guess) row.append(html('i', `t${G.groupOf(i) + 1}`));
    box.append(row);
  }
  return box;
}

let stopTilt = null;

/**
 * from   tile positions before the move, so the tiles that stay slide instead of jumping
 * deal   the first paint: tiles are dealt onto the tray
 * ended  the game ended with this move (as opposed to a finished game being reopened)
 */
function render({ from = null, deal = false, ended = false } = {}) {
  const over = G.isOver(game.guesses);
  const won = G.isWon(game.guesses);
  const archive = game.mode === 'archive';

  header.setLabel(`${archive ? 'מהארכיון: ' : ''}חידה ${game.day} · ${hebrewDate(dateOfDay(game.day))}`);

  el.banner.hidden = !archive;
  el.banner.replaceChildren();
  if (archive) {
    const back = html('a', 'link', 'חזרה לחידה של היום');
    back.id = 'back-today';
    back.href = './';
    el.banner.append('חידה מהארכיון – לא נספרת בסטטיסטיקה · ', back);
  }

  el.bands.replaceChildren(
    ...G.solvedGroups(game.guesses).map((g) => band(g, false)),
    ...(over && !won ? G.missedGroups(game.guesses).map((g) => band(g, true)) : []),
  );
  el.lead.hidden = el.bands.children.length > 0;
  el.tray.classList.toggle('done', over);
  renderGrid({ deal });
  if (from) slide(from);
  renderStatus(ended && !won);
  el.status.hidden = over;
  el.controls.hidden = over;

  el.end.hidden = !over;
  if (!over) return;

  const wrong = G.mistakes(game.guesses);
  const sub = html('span');
  sub.append(won ? `פתרתם ${G.mistakesText(wrong)}` : `מצאתם ${G.solvedGroups(game.guesses).length} מתוך ${G.GROUPS} קבוצות`, trail());

  const actions = [];
  if (archive) {
    const backButton = html('a', 'btn ghost', 'לחידה של היום');
    backButton.href = './';
    actions.push(backButton);
  }

  renderEnd(el.end, {
    title: won ? ['מושלם!', 'כמעט מושלם', 'יפה מאוד', 'ברגע האחרון!'][wrong] : 'לא נורא, מחר יש חדשה',
    sub,
    streak: !archive && won ? currentStreak(state.stats, today) : 0,
    shareText: archive ? null : () => G.shareText({ day: game.day, guesses: game.guesses, url: gameUrl() }),
    countdown: !archive,
    actions,
  });

  // The result is a sheet of its own: stamped like the hub's card for this game, and it leans with the phone.
  const mark = html('p', 'end-stamp');
  stamp(mark, won ? { text: 'נפתר', icon: 'check', big: true } : { text: 'לא הפעם', tone: 'close', big: true, angle: 4 });
  if (!ended) mark.firstElementChild.classList.remove('fx-stamp-in');
  el.end.prepend(mark);
  el.end.classList.add('fx-paper', 'fx-tilt');
  stopTilt ??= tilt(el.end, { gyro: true });
}

// The serif face arrives after the first paint and is wider than the fallback; a rotated phone changes the tile width.
document.fonts?.ready.then(fitAll);
addEventListener('resize', fitAll);

render({ deal: true });
if (!state.seenHelp && !archiveDay) openHelp();

// The interface shared by the two "one more clue" games (rules in shared/reveal.js). Each game's
// app.js calls mountRevealGame() with its rules and one function that draws its stages (clue lines
// or emoji). Everything else is the same: the daily store, the guess box with its suggestion list,
// "one more clue", the log, the end panel, stats, and a round from the archive.
//
// The page must hold these ids: mode-banner, kicker, steps, stage, guess-form, guess-input,
// suggestions, skip-btn, log, end, help-dialog.
import { israelDate, dayNumber, dateOfDay, hebrewDate, recordResult, currentStreak, normalizeHebrew } from './core.js';
import { createStore, mountHeader, html, icon, toast, wireDialog, renderStats, renderEnd, gameUrl } from './ui.js';
import { dayStatsPanel } from './social-ui.js';
import { stamp, celebrate, enter } from './fx.js';
import { emblem } from './emblems.js';

/**
 *   slug        the game's slug
 *   G           the object shared/reveal.js createGame() returned
 *   drawStage   (container, puzzle, opened, over) => void   draws the open clues into #stage
 *   kicker      (puzzle) => string                          the line above the stages ("היום: מקום")
 *   answerNote  (puzzle) => string | null                    a line under the answer at the end
 *   words       { placeholder, none, pick, skip, giveUp }   the few texts that differ between games
 */
export function mountRevealGame({ slug, G, drawStage, kicker, answerNote = () => null, words }) {
  const $ = (id) => document.getElementById(id);
  const el = {
    banner: $('mode-banner'), kicker: $('kicker'), steps: $('steps'), stage: $('stage'),
    form: $('guess-form'), input: $('guess-input'), suggestions: $('suggestions'), skip: $('skip-btn'),
    log: $('log'), end: $('end'), help: $('help-dialog'),
  };
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- saved state ----------

  const store = createStore(slug);
  const today = dayNumber(israelDate());
  const state = store.loadDaily(today, G.BUCKETS);
  const dailyPuzzle = G.puzzleForDay(today);
  const dailyMoves = G.cleanMoves(state.progress?.moves, dailyPuzzle);

  // 'daily' is saved and counted; 'archive' (an earlier day's puzzle) is neither.
  const game = { mode: 'daily', day: today, puzzle: dailyPuzzle, moves: dailyMoves };
  const isDaily = () => game.mode === 'daily';
  const over = () => G.isOver(game.puzzle, game.moves);

  function saveDaily() {
    state.finished = G.isOver(dailyPuzzle, dailyMoves);
    state.won = G.isWon(dailyPuzzle, dailyMoves);
    state.summary = state.finished ? G.summary(dailyPuzzle, dailyMoves) : '';
    // progress stays null until the first move, which is how the hub tells "new" from "in progress".
    state.progress = dailyMoves.length ? { moves: dailyMoves } : null;
    if (state.finished) state.stats = recordResult(state.stats, today, state.won, Math.max(0, G.solvedAt(dailyPuzzle, dailyMoves) - 1));
    store.save(state);
  }

  // ---------- header + dialogs ----------

  const header = mountHeader({
    slug,
    onHelp: () => el.help.showModal(),
    onStats: () => renderStats({
      stats: state.stats, day: today, distTitle: 'באיזה שלב גיליתי',
      highlight: state.won ? G.solvedAt(dailyPuzzle, dailyMoves) - 1 : -1,
    }).showModal(),
  });
  wireDialog(el.help);
  el.help.prepend(emblem(slug));
  el.help.addEventListener('close', () => { state.seenHelp = true; store.save(state); });

  // ---------- moves ----------

  function play(move) {
    if (over() || document.querySelector('dialog[open]')) return;
    if (move !== null && game.moves.includes(move)) {
      el.input.value = '';
      closeSuggestions();
      toast('כבר ניסיתם את זה');
      return;
    }
    game.moves.push(move);
    if (isDaily()) saveDaily();
    el.input.value = '';
    closeSuggestions();
    const right = move === game.puzzle.answer;
    if (!right && move !== null) {
      el.form.classList.remove('shake');
      void el.form.offsetWidth;
      el.form.classList.add('shake');
    }
    render(true);
    if (over()) {
      el.input.blur();
      el.end.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'nearest' });
      el.end.querySelector('#end-title')?.focus({ preventScroll: true });
    }
  }

  function startArchive() {
    // Any earlier day the player could have met, never today or a day still to come.
    const day = 1 + Math.floor(Math.random() * (today - 1));
    Object.assign(game, { mode: 'archive', day, puzzle: G.puzzleForDay(day), moves: [] });
    render();
    scrollTo({ top: 0 });
  }

  function backToDaily() {
    Object.assign(game, { mode: 'daily', day: today, puzzle: dailyPuzzle, moves: dailyMoves });
    render();
    scrollTo({ top: 0 });
  }

  // ---------- drawing ----------

  function drawSteps() {
    el.steps.replaceChildren();
    const at = G.solvedAt(game.puzzle, game.moves);
    for (let i = 0; i < G.STEPS; i++) {
      const move = game.moves[i];
      let mark = '';
      if (i < game.moves.length) mark = move === game.puzzle.answer ? 'right' : move === null ? 'skip' : 'wrong';
      else if (!over() && i === game.moves.length) mark = 'now';
      const li = html('li', mark, String(i + 1));
      const said = { right: 'נמצא', wrong: 'ניחוש שגוי', skip: 'דילגתם', now: 'השלב הנוכחי' }[mark] || (at ? 'לא נדרש' : 'עוד לא נפתח');
      li.setAttribute('aria-label', `שלב ${i + 1}: ${said}`);
      el.steps.append(li);
    }
  }

  function drawLog() {
    el.log.replaceChildren();
    game.moves.forEach((move, i) => {
      if (move === game.puzzle.answer) return;
      const li = html('li', move === null ? 'skip' : 'wrong');
      li.append(icon(move === null ? 'again' : 'cross'), html('span', '', move === null ? `שלב ${i + 1}: ${words.skip}` : move));
      el.log.append(li);
    });
    el.log.hidden = !el.log.children.length;
  }

  function drawEnd(fresh) {
    const at = G.solvedAt(game.puzzle, game.moves);
    const sub = html('span', 'answer-line');
    sub.append(at ? 'התשובה: ' : 'התשובה הייתה ', html('b', '', game.puzzle.answer));
    const note = answerNote(game.puzzle);
    if (note) sub.append(html('small', '', note));

    const actions = [];
    if (today > 1) {
      const archive = html('button', 'btn ghost', isDaily() ? 'חידה מהארכיון' : 'עוד חידה מהארכיון');
      archive.id = 'archive-btn';
      archive.type = 'button';
      archive.addEventListener('click', startArchive);
      actions.push(archive);
    }
    if (!isDaily()) {
      const back = html('button', 'btn ghost', 'חזרה לחידה היומית');
      back.id = 'daily-btn';
      back.type = 'button';
      back.addEventListener('click', backToDaily);
      actions.push(back);
    }

    renderEnd(el.end, {
      title: G.endTitle(at),
      sub,
      streak: isDaily() && state.won ? currentStreak(state.stats, today) : 0,
      shareText: isDaily() ? () => G.shareText({ day: today, puzzle: game.puzzle, moves: game.moves, url: gameUrl() }) : null,
      countdown: isDaily(),
      actions,
    });
    dayStatsPanel(el.end, isDaily()
      ? { game: slug, day: today, points: G.points(dailyPuzzle, dailyMoves), won: state.won, summary: G.summary(dailyPuzzle, dailyMoves) }
      : null);

    const holder = html('p', 'end-stamp');
    holder.setAttribute('aria-hidden', 'true'); // the title already says it
    el.end.prepend(holder);
    const node = stamp(holder, { text: G.summary(game.puzzle, game.moves), tone: at ? 'found' : 'ink', big: true, angle: -6 });
    if (!fresh) node.classList.remove('fx-stamp-in');
    else if (at) setTimeout(() => celebrate({ origin: node }), 400);
  }

  function render(fresh = false) {
    const done = over();
    header.setLabel(isDaily() ? `חידה ${today} · ${hebrewDate(dateOfDay(today))}` : `מהארכיון · חידה ${game.day}`);
    el.banner.hidden = isDaily();
    el.banner.replaceChildren();
    if (!isDaily()) {
      const back = html('button', 'link', 'חזרה לחידה היומית');
      back.type = 'button';
      back.addEventListener('click', backToDaily);
      el.banner.append(`חידה ${game.day} מהארכיון – לא נספרת בסטטיסטיקה · `, back);
    }

    el.kicker.textContent = kicker(game.puzzle);
    drawSteps();
    const opened = G.opened(game.puzzle, game.moves);
    drawStage(el.stage, game.puzzle, opened, done);
    // Only the stage that has just opened rises in (drawStage tags its pieces with data-stage).
    if (fresh && !calm) el.stage.querySelectorAll(`[data-stage="${opened - 1}"]`).forEach((n) => n.classList.add('fresh'));
    drawLog();

    el.form.hidden = done;
    el.skip.hidden = done;
    const last = game.moves.length === G.STEPS - 1;
    el.skip.replaceChildren(icon(last ? 'cross' : 'again'), last ? words.giveUp : words.skip);
    el.end.hidden = !done;
    if (done) drawEnd(fresh);
  }

  // ---------- the guess box ----------

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
    if (!normalizeHebrew(query)) return closeSuggestions();
    matches = G.search(query);
    active = matches.length ? 0 : -1;
    el.suggestions.replaceChildren();
    if (!matches.length) el.suggestions.append(html('li', 'none', words.none));
    matches.forEach((entry, i) => {
      const li = html('li', game.moves.includes(entry.name) ? 'used' : '', entry.name);
      li.id = 'sg-' + i;
      li.setAttribute('role', 'option');
      li.append(html('small', '', entry.label));
      // mousedown comes before the input loses focus, so the tap is never swallowed by blur.
      li.addEventListener('mousedown', (e) => { e.preventDefault(); play(entry.name); });
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
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  });
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (matches[active]) play(matches[active].name);
    else if (normalizeHebrew(el.input.value)) {
      // "Nothing like that" would otherwise go on covering the clue button under it.
      closeSuggestions();
      toast(words.pick);
    }
  });

  // A double tap must not cost two clues: the second tap within half a second is ignored.
  let lastSkip = 0;
  el.skip.addEventListener('click', () => {
    if (Date.now() - lastSkip < 500) return;
    lastSkip = Date.now();
    play(null);
  });

  render();
  enter(el.stage);
  if (!state.seenHelp) el.help.showModal();
}

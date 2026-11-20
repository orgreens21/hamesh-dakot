// Interface for המתחזה. The rules live in game.js; this file moves one phone through five screens:
// setup → deal (pass the phone) → talk → vote → reveal.
import * as G from './game.js';
import { createStore, mountHeader, html, svg, icon, toast, wireDialog, shareResult, whatsappLink, gameUrl } from '../../shared/ui.js';
import { tilt, stamp, celebrate, reducedMotion } from '../../shared/fx.js';
import { emblem } from '../../shared/emblems.js';

const SLUG = 'mitchaze';
const $ = (id) => document.getElementById(id);
const SCREENS = ['setup', 'deal', 'talk', 'vote', 'reveal'];

// ---------- saved state ----------
// Only settings, scores and the list of recently played words are stored. A round in progress
// never is: a reload in the middle of a round must not be a way to see the cards again.

const store = createStore(SLUG);
const saved = store.load();
let settings = G.sanitizeSettings(saved.settings);
let recent = G.sanitizeRecent(saved.recent);
let scores = G.sanitizeScores(saved.scores, settings.names.length);
let rounds = Number.isInteger(saved.rounds) && saved.rounds > 0 ? saved.rounds : 0;
let seenHelp = saved.seenHelp === true;

const usedThisSession = [];
let round = null; // { word, packName, impostors, starter, names, dealIndex, seen, accused }

function save() {
  store.save({ seenHelp, settings: { ...settings, names: settings.names.map(G.cleanName) }, scores, rounds, recent });
}

// ---------- header, help, screens ----------

const helpDialog = wireDialog($('help-dialog'));
// The hub's drawing for this game opens the rules and heads the setup screen, so the pages read as one object.
const helpEmblem = emblem(SLUG);
helpDialog.prepend(helpEmblem);
function openHelp() {
  helpDialog.showModal();
  helpEmblem.classList.remove('is-playing');
  void helpEmblem.offsetWidth;
  helpEmblem.classList.add('is-playing');
}
const header = mountHeader({ slug: SLUG, onHelp: openHelp });
$('help-link').addEventListener('click', openHelp);
$('hero-emblem').replaceWith(emblem(SLUG));
tilt($('hero'), { gyro: true });
helpDialog.addEventListener('close', () => {
  if (!seenHelp) { seenHelp = true; save(); }
});

function show(name) {
  // A keyboard player whose button vanished with its screen goes on from the new screen's heading,
  // not from the top of the page.
  const hadFocus = document.activeElement !== document.body && !!document.activeElement?.closest('.screen');
  for (const id of SCREENS) $(id).hidden = id !== name;
  header.setLabel(name === 'setup' ? `משחק חברה · ${G.MIN_PLAYERS} עד ${G.MAX_PLAYERS} שחקנים` : `סיבוב ${rounds + (name === 'reveal' && round?.done ? 0 : 1)}`);
  window.scrollTo(0, 0);
  if (hadFocus && !$(name).contains(document.activeElement)) focusQuietly($(name).querySelector('h2'));
}

function focusQuietly(node) {
  if (!node) return;
  if (!node.hasAttribute('tabindex')) node.tabIndex = -1;
  node.focus({ preventScroll: true });
}

// ---------- keeping the screen on ----------
// The phone lies on the table during the discussion; a locked screen would stop the game.
// Not every browser has the Wake Lock API and it may refuse (battery saver), so every failure is silent.

let wakeLock = null;
let wantAwake = false;

async function keepAwake(on) {
  wantAwake = on;
  try {
    if (on && !wakeLock && document.visibilityState === 'visible' && navigator.wakeLock) {
      const lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
      wakeLock = lock;
      if (!wantAwake) keepAwake(false);
    } else if (!on && wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      await lock.release();
    }
  } catch { wakeLock = null; }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) hideCard();
  else if (wantAwake) keepAwake(true); // the browser drops the lock whenever the tab is hidden
});
// Leaving the page (back to the hub, another app) must not leave a revealed card in the back/forward cache.
window.addEventListener('pagehide', hideCard);

// ---------- setup ----------

const el = {
  names: $('names'), playerCount: $('player-count'), addPlayer: $('add-player'),
  impostors: $('impostor-count'), impostorNote: $('impostor-note'),
  packs: $('packs'), packsAll: $('packs-all'), timer: $('timer'), hint: $('hint-toggle'), start: $('start-btn'),
  setupBoard: $('setup-board'), setupScores: $('setup-scores'),
  dealStep: $('deal-step'), dealName: $('deal-name'), card: $('card'), cardBack: $('card-back'), cardFront: $('card-front'),
  cardPrompt: $('card-prompt'), dealNext: $('deal-next'), dealTip: $('deal-tip'),
  deck: $('deck'), dial: $('dial'), revealStamp: $('reveal-stamp'),
  starter: $('starter'), clockWrap: $('clock-wrap'), clock: $('clock'), clockNote: $('clock-note'),
  voteTitle: $('vote-title'), voteNote: $('vote-note'), voteList: $('vote-list'), voteConfirm: $('vote-confirm'),
  revealKicker: $('reveal-kicker'), revealLead: $('reveal-lead'), revealNames: $('reveal-names'), verdict: $('verdict'),
  guess: $('guess'), guessPrompt: $('guess-prompt'), secret: $('secret'), secretWord: $('secret-word'), secretPack: $('secret-pack'),
  guessVerdict: $('guess-verdict'), result: $('result'), winner: $('winner'), winnerSub: $('winner-sub'), scores: $('scores'),
};

function renderNames(focusIndex = -1) {
  el.names.replaceChildren();
  const canRemove = settings.names.length > G.MIN_PLAYERS;
  settings.names.forEach((name, i) => {
    const li = html('li');
    const input = html('input', 'field name-input');
    input.type = 'text';
    input.value = name;
    input.placeholder = G.defaultName(i);
    input.maxLength = G.MAX_NAME_LENGTH;
    input.autocomplete = 'off';
    input.enterKeyHint = 'done';
    input.setAttribute('aria-label', `השם של ${G.defaultName(i)}`);
    const renamed = () => { remove.setAttribute('aria-label', `הסרת ${G.cleanName(input.value) || G.defaultName(i)}`); renderBoards(); };
    input.addEventListener('input', () => { settings.names[i] = input.value; save(); renamed(); });
    input.addEventListener('change', () => { settings.names[i] = input.value = G.cleanName(input.value); save(); renamed(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    const remove = html('button', 'icon-btn remove-player');
    remove.type = 'button';
    remove.disabled = !canRemove;
    remove.setAttribute('aria-label', `הסרת ${G.cleanName(name) || G.defaultName(i)}`);
    remove.append(icon('cross'));
    remove.addEventListener('click', () => {
      settings.names.splice(i, 1);
      scores.splice(i, 1); // the score table follows the seats
      playersChanged();
    });
    li.append(input, remove);
    el.names.append(li);
    if (i === focusIndex) input.focus();
  });
  el.playerCount.textContent = `${settings.names.length} שחקנים`;
  el.addPlayer.disabled = settings.names.length >= G.MAX_PLAYERS;
}

function playersChanged(focusIndex) {
  settings.impostors = G.clampImpostors(settings.impostors, settings.names.length);
  scores = G.sanitizeScores(scores, settings.names.length);
  save();
  renderNames(focusIndex);
  renderImpostors();
  renderBoards();
}

el.addPlayer.addEventListener('click', () => {
  if (settings.names.length >= G.MAX_PLAYERS) return;
  settings.names.push('');
  playersChanged(settings.names.length - 1);
});

/** Fills a segmented control; exactly one option is pressed. */
function renderSegment(container, options, current, onPick) {
  container.replaceChildren();
  for (const { value, label, disabled = false, aria } of options) {
    const b = html('button', '', label);
    b.type = 'button';
    b.dataset.value = value;
    b.disabled = disabled;
    b.setAttribute('aria-pressed', String(value === current));
    if (aria) b.setAttribute('aria-label', aria);
    b.addEventListener('click', () => onPick(value));
    container.append(b);
  }
}

function renderImpostors() {
  const max = G.maxImpostors(settings.names.length);
  renderSegment(el.impostors, [1, 2, 3].map((n) => ({ value: n, label: String(n), disabled: n > max, aria: n === 1 ? 'מתחזה אחד' : `${n} מתחזים` })),
    settings.impostors, (n) => { settings.impostors = n; save(); renderImpostors(); });
  el.impostorNote.textContent = max === 1 ? 'שניים מ־5 שחקנים' : max === 2 ? 'שלושה מ־7 שחקנים' : '';
}

function renderTimer() {
  renderSegment(el.timer, G.TIMER_OPTIONS.map((m) => ({ value: m, label: m ? `${m} דק׳` : 'בלי', aria: m ? `${m} דקות` : 'בלי שעון' })),
    settings.timer, (m) => { settings.timer = m; save(); renderTimer(); });
}

function renderPacks() {
  el.packs.replaceChildren();
  for (const pack of G.PACKS) {
    const b = html('button', 'tile', pack.name);
    b.type = 'button';
    b.dataset.pack = pack.id;
    b.setAttribute('aria-pressed', String(settings.packs.includes(pack.id)));
    b.addEventListener('click', () => {
      const on = settings.packs.includes(pack.id);
      if (on && settings.packs.length === 1) return toast('צריך לפחות חבילה אחת');
      settings.packs = on ? settings.packs.filter((id) => id !== pack.id) : G.PACKS.map((p) => p.id).filter((id) => id === pack.id || settings.packs.includes(id));
      save();
      renderPacks();
    });
    el.packs.append(b);
  }
  el.packsAll.hidden = settings.packs.length === G.PACKS.length;
}

el.packsAll.addEventListener('click', () => {
  settings.packs = G.PACKS.map((p) => p.id);
  save();
  renderPacks();
});

el.hint.checked = settings.hint;
el.hint.addEventListener('change', () => { settings.hint = el.hint.checked; save(); });

$('share-btn').addEventListener('click', () => shareResult(G.inviteText(gameUrl()), 'ההזמנה הועתקה – הדביקו בקבוצה'));
$('whatsapp-btn').href = whatsappLink(G.inviteText(gameUrl()));

// ---------- score table (setup screen and result screen) ----------

function renderScoreList(list, gains) {
  const rows = G.ranking(G.resolveNames(settings.names), scores);
  const top = rows[0]?.score || 0;
  list.replaceChildren();
  for (const row of rows) {
    const li = html('li', top > 0 && row.score === top ? 'lead' : '');
    li.dataset.player = row.index;
    const gain = gains?.[row.index];
    const gained = html('span', 'gain', gain ? `+${gain}` : '');
    gained.dir = 'ltr'; // otherwise the plus sign lands after the digit
    li.append(html('span', 'who', row.name), tally(row.score, gain || 0), gained, html('span', 'pts', row.score));
    list.append(li);
  }
  // Past twenty points the strokes stop being readable at a glance; the numbers carry on alone.
  list.classList.toggle('no-tally', top > TALLY_MAX);
}

const TALLY_MAX = 20;

/** A score as tally marks, in fives. The strokes won this round are drawn in as the table appears. */
function tally(score, gain) {
  const box = html('span', 'tally');
  box.setAttribute('aria-hidden', 'true'); // the number next to it says the same thing
  const shown = Math.min(score, TALLY_MAX);
  for (let start = 0; start < shown; start += 5) {
    const group = svg('svg', { viewBox: '0 0 26 20' });
    for (let k = start; k < Math.min(shown, start + 5); k++) {
      const n = k - start;
      const mark = svg('path', { d: n < 4 ? `M${4 + n * 5.5} 2.5v15` : 'M1 15.5 24.5 4.5', pathLength: 1 });
      if (k >= score - gain) {
        mark.setAttribute('class', 'new');
        mark.style.setProperty('--n', k - (score - gain));
      }
      group.append(mark);
    }
    box.append(group);
  }
  return box;
}

function renderBoards(gains) {
  el.setupBoard.hidden = rounds === 0 && !scores.some(Boolean);
  renderScoreList(el.setupScores);
  renderScoreList(el.scores, gains);
}

// Resetting takes two taps on the same button, so a stray thumb cannot wipe an evening's table.
for (const button of document.querySelectorAll('.reset-scores')) {
  let armedTimer = 0;
  const disarm = () => { clearTimeout(armedTimer); armedTimer = 0; button.textContent = 'איפוס ניקוד'; };
  button.addEventListener('click', () => {
    if (!armedTimer) {
      button.textContent = 'בטוחים? הקישו שוב';
      armedTimer = setTimeout(disarm, 4000);
      return;
    }
    disarm();
    scores = G.sanitizeScores([], settings.names.length);
    rounds = 0;
    save();
    renderBoards();
    toast('הניקוד אופס');
  });
}

// ---------- starting and leaving a round ----------

function startRound() {
  const names = G.resolveNames(settings.names);
  const twice = G.duplicateName(settings.names);
  if (twice) return toast(`יש שני שחקנים בשם ${twice}`);
  if (round?.done) round = null;

  const deal = G.dealRound({ players: names.length, impostors: settings.impostors, packIds: settings.packs, used: usedThisSession, recent });
  if (deal.exhausted) usedThisSession.length = 0;
  usedThisSession.push(deal.word);
  recent = G.rememberWord(recent, deal.word);
  save();

  round = { ...deal, names, hint: settings.hint, timer: settings.timer, dealIndex: 0, seen: false, accused: [], done: false };
  keepAwake(true);
  stopCardTilt ??= tilt(el.card, { gyro: true });
  show('deal');
  renderDeal();
}

function leaveRound() {
  stopTimer();
  hideCard();
  round = null;
  keepAwake(false);
  renderNames();
  renderBoards();
  show('setup');
}

el.start.addEventListener('click', startRound);
for (const b of document.querySelectorAll('.quit')) b.addEventListener('click', leaveRound);

// ---------- deal: pass the phone ----------
// The secret exists in the page only while the card is face up. Turning it down removes the text
// from the DOM, and once a player has moved on there is no control that leads back to their card.

let stopCardTilt = null;

function renderDeal() {
  const i = round.dealIndex;
  round.seen = false;
  // The deck under the card thins out as the cards are dealt, and each new card is slid off the top of it.
  el.deck.dataset.left = Math.min(2, round.names.length - 1 - i);
  el.card.classList.remove('dealt');
  void el.card.offsetWidth;
  el.card.classList.add('dealt');
  el.dealStep.textContent = `קלף ${i + 1} מתוך ${round.names.length}`;
  el.dealName.textContent = round.names[i];
  el.cardPrompt.textContent = 'הקישו כדי להציץ';
  el.dealNext.textContent = i + 1 < round.names.length ? `הסתרתי · מעבירים ל${round.names[i + 1]}` : 'כולם ראו · מתחילים';
  hideCard();
}

function showCard() {
  const impostor = G.isImpostor(round, round.dealIndex);
  const word = html('span', 'card-word', impostor ? 'אתם המתחזים!' : round.word);
  word.id = 'card-word';
  el.cardFront.replaceChildren(html('span', 'kicker', impostor ? 'אין לכם מילה' : 'המילה הסודית'), word);
  if (impostor && round.hint) {
    const hint = html('span', 'card-hint', `החבילה: ${round.packName}`);
    hint.id = 'card-hint';
    el.cardFront.append(hint);
  }
  el.cardFront.append(html('small', '', 'הקישו שוב כדי להסתיר'));
  el.cardFront.dataset.role = impostor ? 'impostor' : 'word';
  // The card turns over by itself (aria-pressed drives the flip); the prompt on its back is no longer read out.
  el.cardBack.setAttribute('aria-hidden', 'true');
  el.card.setAttribute('aria-pressed', 'true');
  el.dealNext.hidden = true;
  el.dealTip.hidden = false;
  round.seen = true;
}

// The face is emptied at once and only then turns away: no frame of the turn has anything on it to read.
function hideCard() {
  el.cardFront.replaceChildren();
  delete el.cardFront.dataset.role;
  el.cardBack.removeAttribute('aria-hidden');
  el.card.setAttribute('aria-pressed', 'false');
  const seen = Boolean(round?.seen);
  if (seen) el.cardPrompt.textContent = 'שכחתם? הקישו שוב';
  el.dealNext.hidden = !seen;
  el.dealTip.hidden = seen;
}

el.card.addEventListener('click', () => {
  if (!round || round.done || $('deal').hidden) return;
  if (el.card.getAttribute('aria-pressed') === 'true') hideCard();
  else showCard();
});

el.dealNext.addEventListener('click', () => {
  if (!round || !round.seen) return;
  hideCard();
  if (round.dealIndex + 1 < round.names.length) {
    round.dealIndex++;
    renderDeal();
  } else {
    startTalk();
  }
});

// ---------- talk ----------

let timerId = 0;
let deadline = 0;
let total = 0;
let buzzed = false;

function startTalk() {
  el.starter.textContent = round.names[round.starter];
  el.clockWrap.hidden = !round.timer;
  stopTimer();
  if (round.timer) {
    // A deadline in wall-clock time, not a count of ticks: timers are throttled when the screen dims.
    deadline = Date.now() + round.timer * 60000;
    total = round.timer * 60;
    buzzed = false;
    tick();
    timerId = setInterval(tick, 250);
  }
  show('talk');
}

function tick() {
  const left = Math.max(0, (deadline - Date.now()) / 1000);
  el.clock.textContent = G.formatClock(left);
  el.dial.style.setProperty('--left', (total ? left / total : 0).toFixed(4)); // how much of the ring is still inked
  el.clockWrap.classList.toggle('low', left > 0 && left <= 30);
  el.clockWrap.classList.toggle('over', left <= 0);
  el.clockNote.textContent = left <= 0 ? 'הזמן נגמר! מצביעים' : 'זמן לדיון';
  if (left <= 0 && !buzzed) {
    buzzed = true;
    stopTimer();
    try { navigator.vibrate?.([200, 120, 200]); } catch { /* not allowed without a user gesture on some phones */ }
    toast('הזמן נגמר! עוברים להצבעה');
  }
}

function stopTimer() {
  clearInterval(timerId);
  timerId = 0;
}

$('to-vote').addEventListener('click', () => {
  stopTimer();
  renderVote();
  show('vote');
});

// ---------- vote ----------

function renderVote() {
  const need = round.impostors.length;
  round.accused = [];
  el.voteTitle.textContent = need === 1 ? 'מי המתחזה?' : 'מי המתחזים?';
  el.voteNote.textContent = need === 1 ? 'החליטו יחד והקישו על השם.' : `החליטו יחד ובחרו ${need} שמות.`;
  el.voteList.replaceChildren();
  round.names.forEach((name, i) => {
    const b = html('button', 'tile', name);
    b.type = 'button';
    b.dataset.player = i;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => toggleAccused(i));
    el.voteList.append(b);
  });
  syncVote();
}

function toggleAccused(i) {
  const need = round.impostors.length;
  if (round.accused.includes(i)) round.accused = round.accused.filter((p) => p !== i);
  else if (need === 1) round.accused = [i]; // one suspect: a new tap simply replaces the choice
  else if (round.accused.length >= need) return toast(`אפשר לבחור רק ${need}. בטלו בחירה כדי להחליף`);
  else round.accused.push(i);
  syncVote();
}

function syncVote() {
  for (const b of el.voteList.children) b.setAttribute('aria-pressed', String(round.accused.includes(Number(b.dataset.player))));
  el.voteConfirm.disabled = round.accused.length !== round.impostors.length;
}

el.voteConfirm.addEventListener('click', () => {
  if (round.accused.length !== round.impostors.length) return;
  renderReveal();
  show('reveal');
});

// ---------- reveal and result ----------

function renderReveal() {
  const many = round.impostors.length > 1;
  const caught = G.isCaught(round.impostors, round.accused);
  const impostorNames = G.joinNames(round.impostors.map((p) => round.names[p]));
  el.revealKicker.textContent = 'רגע האמת';
  el.revealLead.textContent = many ? 'המתחזים הם…' : 'המתחזה הוא…';
  // One name per line: a joined list of long names breaks in ugly places at this size.
  el.revealNames.replaceChildren(...round.impostors.map((p) => html('span', '', round.names[p])));
  el.revealNames.classList.toggle('many', many);
  // Three names fill the card, so they are set smaller and higher, clear of the stamp in its corner.
  $('unmask').dataset.count = round.impostors.length;
  // When caught, the stamp on the card already says so; the line under it is kept for screen readers only.
  el.verdict.className = 'verdict ' + (caught ? 'caught visually-hidden' : 'escaped');
  el.revealStamp.replaceChildren();
  stamp(el.revealStamp, caught
    ? { text: many ? 'נתפסו' : 'נתפס', tone: 'found', big: true, icon: 'check', angle: -8 }
    : { text: many ? 'חמקו' : 'חמק', tone: 'close', big: true, angle: 7 });
  el.verdict.textContent = caught ? 'תפסתם!' : `פספסתם. הצבעתם על ${G.joinNames(round.accused.slice().sort((a, b) => a - b).map((p) => round.names[p]))}.`;

  el.secret.hidden = true;
  el.secretWord.textContent = '';
  el.secretPack.textContent = '';
  el.guessVerdict.hidden = true;
  el.result.hidden = true;
  el.guess.hidden = !caught;
  el.guessPrompt.textContent = `${impostorNames}, נשאר לכם ניחוש אחד: אמרו בקול מה המילה הסודית.`;

  // An impostor who got away wins on the spot. A caught one still gets to guess, so the word stays out of the page for now.
  if (!caught) {
    revealWord(true);
    finish(false, true);
  }
}

function revealWord(late) {
  el.secretWord.textContent = round.word;
  el.secretPack.textContent = `מהחבילה: ${round.packName}`;
  el.secret.classList.toggle('late', late);
  el.secret.hidden = false;
}

$('show-word').addEventListener('click', () => {
  const hadFocus = el.guess.contains(document.activeElement);
  el.guess.hidden = true;
  revealWord(false);
  el.guessVerdict.hidden = false;
  if (hadFocus) focusQuietly(el.secretWord);
});
$('guess-right').addEventListener('click', () => finish(true, false));
$('guess-wrong').addEventListener('click', () => finish(false, false));

function finish(guessedWord, late) {
  if (round.done) return;
  const hadFocus = $('reveal').contains(document.activeElement); // read before the pressed button is hidden
  const outcome = G.judge({ players: round.names.length, impostors: round.impostors, accused: round.accused, guessedWord });
  round.done = true;
  const finished = round; // the burst below belongs to this round only
  scores = G.addScores(scores, outcome.points);
  rounds++;
  save();
  keepAwake(false);

  const many = round.impostors.length > 1;
  const titles = {
    caught: ['הקבוצה ניצחה!', 'נקודה לכל מי שלא התחזה.'],
    guessed: [many ? 'המתחזים ניצחו!' : 'המתחזה ניצח!', many ? 'נתפסו, אבל ניחשו את המילה. נקודה לכל מתחזה.' : 'נתפס, אבל ניחש את המילה. נקודה למתחזה.'],
    escaped: [many ? 'המתחזים ניצחו!' : 'המתחזה ניצח!', many ? 'הם חמקו מכם. 2 נקודות לכל מתחזה.' : 'הוא חמק מכם. 2 נקודות למתחזה.'],
  };
  [el.winner.textContent, el.winnerSub.textContent] = titles[outcome.reason];
  el.guessVerdict.hidden = true;
  el.result.dataset.winner = outcome.winner;
  el.result.classList.toggle('late', late);
  el.result.hidden = false;
  if (hadFocus && !el.result.contains(document.activeElement)) focusQuietly(el.winner);
  renderBoards(outcome.points);
  header.setLabel(`סיבוב ${rounds}`);
  // Every round ends with somebody winning. When the result waits for the staged reveal, so does the burst.
  setTimeout(() => { if (finished === round && !$('reveal').hidden) celebrate({ origin: el.winner }); }, late && !reducedMotion() ? 3000 : 150);
}

$('next-round').addEventListener('click', startRound);
$('to-setup').addEventListener('click', leaveRound);

// ---------- go ----------

renderNames();
renderImpostors();
renderPacks();
renderTimer();
renderBoards();
show('setup');
if (!seenHelp) openHelp();

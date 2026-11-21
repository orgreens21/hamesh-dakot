// The groups page: a nickname, my groups, create / join, and one group's board (today, this week,
// all time). Everything goes through shared/social.js; with no backend configured the page only
// says that groups are not open yet.
import { GAMES } from '../shared/registry.js';
import { hebrewDate } from '../shared/core.js';
import { html, svg, toast, wireDialog, whatsappLink } from '../shared/ui.js';
import { social, cleanNickname, cleanGroupName, normalizeCode, joinCodeFromSearch, inviteLink, inviteText, GROUPS_PAGE, NICKNAME } from '../shared/social.js';

const $ = (id) => document.getElementById(id);
const SCORED = GAMES.filter((g) => g.kind === 'daily');
const VIEWS = ['view-off', 'view-join', 'view-home', 'view-board'];
const PERIOD_EMPTY = { day: 'עוד אף אחד לא שיחק היום. אולי אתם הראשונים?', week: 'עוד אף אחד לא שיחק השבוע.', all: 'עוד אין תוצאות בקבוצה.' };

const ERRORS = {
  offline: 'אין חיבור לאינטרנט. נסו שוב כשתחזרו לרשת.',
  timeout: 'השרת לא ענה בזמן. נסו שוב בעוד רגע.',
  network: 'אין חיבור לשרת. נסו שוב בעוד רגע.',
  not_found: 'לא מצאנו קבוצה עם הקוד הזה. בדקו אותו ונסו שוב.',
  group_full: 'הקבוצה הזו מלאה: יש בה כבר 50 חברים.',
  too_many_groups: 'אפשר להיות בעד 20 קבוצות. צאו מאחת כדי להצטרף לחדשה.',
  rate_limited: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
  no_nickname: 'קודם בחרו כינוי.',
  not_member: 'אתם כבר לא בקבוצה הזו.',
  busy: 'יש עומס כרגע. נסו שוב בעוד דקה.',
};
const errorText = (err, context = {}) => context[err?.code] || ERRORS[err?.code] || 'משהו השתבש. נסו שוב בעוד רגע.';

const status = $('status');
const setStatus = (text) => { status.textContent = text; status.hidden = !text; };
function show(view) {
  for (const id of VIEWS) $(id).hidden = id !== view;
  setStatus('');
}

// ---------- the nickname ----------

let nickname = social.me()?.nickname ?? null;
function renderNickname() {
  $('me-chip').hidden = !nickname;
  $('me-name').textContent = nickname || '';
  $('nick-input').value = nickname || '';
  $('nick-btn').textContent = nickname ? 'שינוי' : 'שמירה';
  $('join-nick-wrap').hidden = !!nickname;
  $('forget-btn').hidden = !social.me();
}

async function saveNickname(text, errorEl) {
  const clean = cleanNickname(text);
  if (!clean) {
    errorEl.textContent = `כינוי של ${NICKNAME.min} עד ${NICKNAME.max} תווים, בבקשה.`;
    return false;
  }
  try {
    nickname = await social.setNickname(clean);
    renderNickname();
    return true;
  } catch (err) {
    errorEl.textContent = errorText(err, { bad_name: `כינוי של ${NICKNAME.min} עד ${NICKNAME.max} תווים, בבקשה.` });
    return false;
  }
}

/** Runs a form's action with its button disabled, so a double tap sends once. */
function busyForm(form, action) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    form.querySelector('.grp-error').textContent = '';
    button.disabled = true;
    try { await action(); } finally { button.disabled = false; }
  });
}

busyForm($('nick-form'), async () => {
  if (await saveNickname($('nick-input').value, $('nick-error'))) toast('הכינוי נשמר');
});
$('me-chip').addEventListener('click', () => {
  goHome();
  $('nick-input').focus();
  $('nick-input').select();
});

// ---------- my groups ----------

let groups = [];

function groupItem(g) {
  const li = html('li');
  const button = html('button', 'grp-item');
  button.type = 'button';
  button.dataset.code = g.code;
  const text = html('span', 'grp-item-text');
  text.append(html('span', 'grp-item-name', g.name), html('span', 'grp-item-sub', g.members === 1 ? 'רק אתם, בינתיים' : `${g.members} חברים`));
  const arrow = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'grp-arrow' });
  arrow.innerHTML = '<path d="m14.5 5-7 7 7 7"/>';
  button.append(text, arrow);
  button.addEventListener('click', () => openBoard(g.code, g));
  li.append(button);
  return li;
}

function renderGroups() {
  $('group-list').replaceChildren(...groups.map(groupItem));
  $('group-list').hidden = !groups.length;
  $('groups-empty').hidden = groups.length > 0;
}

async function loadHome() {
  show('view-home');
  renderNickname();
  renderGroups();
  if (!social.me()) { renderGroups(); return; } // nobody yet: nothing to ask the server
  setStatus('טוען את הקבוצות…');
  try {
    const answer = await social.myGroups();
    nickname = answer.nickname;
    groups = answer.groups;
    setStatus('');
  } catch (err) {
    setStatus(errorText(err));
  }
  renderNickname();
  renderGroups();
}

function goHome() {
  if (location.search) history.pushState(null, '', './');
  loadHome();
}

busyForm($('create-form'), async () => {
  const error = $('create-error');
  if (!nickname) { error.textContent = 'קודם בחרו כינוי (למעלה).'; $('nick-input').focus(); return; }
  const name = cleanGroupName($('create-input').value);
  if (!name) { error.textContent = 'שם של 2 עד 30 תווים, בבקשה.'; return; }
  try {
    const group = await social.createGroup(name);
    $('create-input').value = '';
    groups = [...groups, group];
    openBoard(group.code, group, { fresh: true });
  } catch (err) {
    error.textContent = errorText(err);
  }
});

busyForm($('code-form'), async () => {
  const error = $('code-error');
  if (!nickname) { error.textContent = 'קודם בחרו כינוי (למעלה).'; $('nick-input').focus(); return; }
  const code = normalizeCode($('code-input').value);
  if (!code) { error.textContent = 'הקוד הוא 6 אותיות ומספרים באנגלית, למשל K7MXQ2.'; return; }
  try {
    const group = await social.joinGroup(code);
    $('code-input').value = '';
    openBoard(group.code, group);
  } catch (err) {
    error.textContent = errorText(err);
  }
});

// ---------- joining from an invite link ----------

function showJoin(code) {
  show('view-join');
  renderNickname();
  $('join-code').textContent = code;
  $('join-title').textContent = 'הצטרפות לקבוצה';
  if (!nickname) $('join-nick').focus({ preventScroll: true });
}

busyForm($('join-form'), async () => {
  const code = joinCodeFromSearch(location.search);
  const error = $('join-error');
  if (!nickname && !(await saveNickname($('join-nick').value, error))) { $('join-nick').focus(); return; }
  try {
    const group = await social.joinGroup(code);
    toast(`הצטרפתם ל״${group.name}״`);
    openBoard(group.code, group);
  } catch (err) {
    error.textContent = errorText(err);
  }
});

// ---------- a board ----------

let board = { code: null, period: 'day', group: null, request: 0 };

const markOf = (slug) => {
  const g = GAMES.find((x) => x.slug === slug);
  const tile = html('span', 'grp-mark');
  tile.style.setProperty('--accent', g.accent);
  tile.style.setProperty('--accent-dark', g.accentDark);
  const mark = svg('svg', { viewBox: '0 0 28 28', 'aria-hidden': 'true' });
  mark.innerHTML = g.mark;
  tile.append(mark);
  return tile;
};

const RANK_NAMES = ['ראשון', 'שני', 'שלישי'];
function memberRow(m, i) {
  const li = html('li', 'grp-member');
  li.style.setProperty('--n', i);
  if (m.me) li.classList.add('is-me');
  if (m.rank == null) li.classList.add('is-waiting');
  const rank = html('span', 'grp-rank', m.rank == null ? '–' : String(m.rank));
  if (m.rank != null && m.rank <= 3) rank.dataset.medal = String(m.rank);
  rank.setAttribute('aria-label', m.rank == null ? 'בלי מקום' : `מקום ${RANK_NAMES[m.rank - 1] ?? m.rank}`);

  const who = html('span', 'grp-who');
  const name = html('span', 'grp-name');
  name.append(html('bdi', '', m.nickname));
  if (m.me) name.append(html('span', 'grp-you', 'אתם'));
  who.append(name);

  const games = html('ul', 'grp-games');
  games.setAttribute('aria-label', 'נקודות לפי משחק');
  // Only the games played in the period, in the hub's order: a row of six dashes says nothing.
  for (const g of SCORED) {
    const points = m.games?.[g.slug];
    if (points == null) continue;
    const cell = html('li');
    cell.append(markOf(g.slug), html('span', 'grp-game-points', String(points)));
    cell.setAttribute('aria-label', `${g.name}: ${points} נקודות`);
    games.append(cell);
  }
  if (games.children.length) who.append(games);

  const total = html('span', 'grp-total');
  total.append(html('b', '', m.total.toLocaleString('en-US')), html('span', '', 'נק׳'));
  if (m.streak >= 2) {
    const streak = html('span', 'grp-streak');
    const flame = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    flame.innerHTML = '<path d="M12 21.5c-4 0-6.5-2.6-6.5-6.2 0-3.4 2.3-5.2 3.6-8.3.4 1.9 1.4 3 2.5 3.6-.2-3 1-5.6 3.4-7.6-.2 3.2 1.4 5.2 2.6 7 .9 1.4 1.4 3 1.4 4.9 0 4-3 6.6-7 6.6Z"/>';
    streak.append(flame, `${m.streak}`);
    streak.setAttribute('aria-label', `${m.streak} ימים ברצף`);
    total.append(streak);
  }
  li.append(rank, who, total);
  return li;
}

const fmt = (iso, options) => hebrewDate(new Date(iso + 'T12:00:00Z'), options);
function periodText(answer) {
  if (answer.period === 'day') return `היום, ${fmt(answer.today, { weekday: 'long', day: 'numeric', month: 'long' })}`;
  if (answer.period === 'week') return `${fmt(answer.from, { day: 'numeric', month: 'long' })} – ${fmt(answer.to, { day: 'numeric', month: 'long' })}`;
  return 'כל התוצאות מאז שהקבוצה התחילה';
}

function renderInvite(code, name) {
  const link = inviteLink(code, GROUPS_PAGE);
  const text = inviteText(name, link);
  $('invite-code').textContent = code;
  $('invite-whatsapp').href = whatsappLink(text);
  $('invite-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(link); toast('הקישור הועתק'); } catch { toast(link, 5000); }
  };
  const share = $('invite-share');
  share.hidden = typeof navigator.share !== 'function';
  share.onclick = () => navigator.share({ title: 'חמש דקות', text }).catch(() => {});
}

async function loadBoard() {
  const request = ++board.request;
  const list = $('board');
  list.setAttribute('aria-busy', 'true');
  list.classList.add('is-loading');
  $('board-waiting').hidden = true;
  if (!list.children.length) setStatus('טוען את הטבלה…');
  let answer;
  try {
    answer = await social.groupBoard(board.code, board.period);
  } catch (err) {
    if (request !== board.request) return;
    list.setAttribute('aria-busy', 'false');
    list.classList.remove('is-loading');
    if (err.code === 'not_member') { groups = groups.filter((g) => g.code !== board.code); goHome(); toast(ERRORS.not_member); return; }
    setStatus(errorText(err));
    return;
  }
  if (request !== board.request) return;
  setStatus('');
  list.setAttribute('aria-busy', 'false');
  list.classList.remove('is-loading');
  board.group = { code: answer.code, name: answer.name, members: answer.members.length };
  $('board-title').textContent = answer.name;
  $('board-sub').textContent = answer.members.length === 1 ? 'רק אתם בקבוצה, בינתיים. שלחו את הקישור למטה.' : `${answer.members.length} חברים בקבוצה`;
  $('board-period').textContent = periodText(answer);
  const played = answer.members.filter((m) => m.rank != null);
  const waiting = answer.members.filter((m) => m.rank == null);
  list.replaceChildren(...played.map(memberRow));
  list.hidden = !played.length;
  const note = $('board-waiting');
  note.hidden = false;
  note.textContent = !played.length
    ? PERIOD_EMPTY[answer.period]
    : waiting.length ? `${answer.period === 'day' ? 'עוד לא שיחקו היום' : 'עוד לא שיחקו'}: ${waiting.map((m) => m.nickname + (m.me ? ' (אתם)' : '')).join(', ')}` : '';
  note.hidden = !note.textContent;
  renderInvite(answer.code, answer.name);
}

function openBoard(code, group = null, { fresh = false, push = true } = {}) {
  if (push && new URLSearchParams(location.search).get('g') !== code) history.pushState(null, '', `?g=${code}`);
  board = { code, period: 'day', group, request: board.request };
  show('view-board');
  renderNickname();
  $('board-title').textContent = group?.name ?? '';
  $('board-sub').textContent = '';
  $('board-period').textContent = '';
  $('board').replaceChildren();
  $('board-waiting').hidden = true;
  for (const tab of document.querySelectorAll('.grp-tab')) tab.setAttribute('aria-pressed', String(tab.dataset.period === 'day'));
  if (group) renderInvite(code, group.name);
  $('invite').classList.toggle('is-fresh', fresh);
  window.scrollTo({ top: 0 });
  $('board-title').focus?.({ preventScroll: true });
  loadBoard();
}

for (const tab of document.querySelectorAll('.grp-tab')) {
  tab.addEventListener('click', () => {
    if (board.period === tab.dataset.period) return;
    board.period = tab.dataset.period;
    for (const t of document.querySelectorAll('.grp-tab')) t.setAttribute('aria-pressed', String(t === tab));
    loadBoard();
  });
}
$('board-back').addEventListener('click', goHome);

// ---------- leaving, forgetting ----------

const confirmDialog = wireDialog($('confirm'));
function confirmAction({ title, text, ok }) {
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  $('confirm-ok').textContent = ok;
  confirmDialog.returnValue = '';
  confirmDialog.showModal();
  return new Promise((resolve) => confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'ok'), { once: true }));
}

$('leave-btn').addEventListener('click', async () => {
  const name = board.group?.name ?? '';
  if (!(await confirmAction({ title: `לצאת מ״${name}״?`, text: 'התוצאות שלכם יישארו שלכם, אבל לא תופיעו בטבלה של הקבוצה. אפשר לחזור עם הקישור.', ok: 'יציאה' }))) return;
  try {
    await social.leaveGroup(board.code);
    groups = groups.filter((g) => g.code !== board.code);
    toast(`יצאתם מ״${name}״`);
    goHome();
  } catch (err) {
    toast(errorText(err));
  }
});

$('forget-btn').addEventListener('click', async () => {
  if (!(await confirmAction({ title: 'למחוק את הנתונים שלכם?', text: 'הכינוי, הנקודות והחברות בקבוצות יימחקו מהשרת. ההתקדמות והסטטיסטיקה בדפדפן הזה נשארות.', ok: 'מחיקה' }))) return;
  try {
    await social.forgetMe();
    nickname = null;
    groups = [];
    toast('הנתונים נמחקו');
    goHome();
  } catch (err) {
    toast(errorText(err));
  }
});

// ---------- where to start ----------

function route() {
  const params = new URLSearchParams(location.search);
  const join = joinCodeFromSearch(location.search);
  const open = normalizeCode(params.get('g'));
  if (join) showJoin(join);
  else if (params.has('join')) { goHome(); $('code-error').textContent = ERRORS.not_found; }
  else if (open) openBoard(open, groups.find((g) => g.code === open) ?? null, { push: false });
  else loadHome();
}

if (!social.enabled) {
  show('view-off');
  document.querySelector('.foot').textContent = 'ההתקדמות והסטטיסטיקה נשמרות רק בדפדפן שלכם.';
  for (const id of ['points', 'privacy']) $(id).hidden = true;
} else {
  addEventListener('popstate', route);
  route();
}

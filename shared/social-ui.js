// "How everyone did today": the block under a finished daily puzzle. It sends the result (once; see
// shared/social.js), then shows how the player compares with everyone else who played the same
// puzzle, and a way to the group boards. Draws nothing at all when the backend is not configured.
// Styles: .day-stats in shared/base.css.
import { social, summarizeDayStats, playersText, GROUPS_PAGE } from './social.js';
import { html } from './ui.js';

const ID = 'day-stats';
let token = 0;

/**
 * Puts the block into a game's end panel, or takes it away.
 *   container  the end panel (it goes before the countdown line when there is one)
 *   result     { game, day, points, won, summary } for today's finished daily puzzle; null for an
 *              archive or practice round, which are never sent
 */
export function dayStatsPanel(container, result) {
  container.querySelector(`#${ID}`)?.remove();
  if (!social.enabled || !result) return null;

  const mine = ++token;
  const panel = html('section', 'day-stats');
  panel.id = ID;
  panel.setAttribute('aria-labelledby', 'day-stats-title');
  const title = html('h3', 'kicker', 'איך הלך לכולם היום');
  title.id = 'day-stats-title';
  const body = html('div', 'ds-body');
  body.setAttribute('aria-live', 'polite');
  body.append(html('p', 'ds-sub', 'בודקים איך הלך לכולם…'));
  panel.dataset.state = 'loading';

  const points = html('p', 'ds-points');
  const how = html('a', '', 'איך סופרים?');
  how.href = GROUPS_PAGE + '#points';
  points.append(`קיבלתם ${result.points} נקודות מתוך 100 · `, how);

  const groups = html('a', 'btn ghost small ds-groups', 'השוו עם החברים בקבוצה');
  groups.id = 'groups-btn';
  groups.href = GROUPS_PAGE;

  panel.append(title, body, points, groups);
  const before = [...container.children].find((child) => child.classList.contains('next'));
  container.insertBefore(panel, before ?? null);

  const show = (state, ...nodes) => {
    if (mine !== token) return; // a newer render took over
    panel.dataset.state = state;
    body.replaceChildren(...nodes);
  };

  (async () => {
    await social.submitResult(result);
    if (social.isPending(result.game, result.day)) {
      show('offline', html('p', 'ds-lead small', 'אין חיבור כרגע'), html('p', 'ds-sub', 'התוצאה תישלח כשתחזרו לרשת, ואז תראו איך הלך לכולם.'));
      return;
    }
    let stats;
    try {
      stats = await social.dayStats(result.game, result.day);
    } catch (err) {
      show(err.code === 'offline' ? 'offline' : 'error', html('p', 'ds-sub', err.code === 'offline'
        ? 'אין חיבור כרגע. נסו שוב כשתחזרו לרשת.'
        : 'לא הצלחנו להביא את נתוני היום. נסו שוב מאוחר יותר.'));
      return;
    }
    const s = summarizeDayStats(stats, result.points);
    if (!s.enough) {
      show('early', html('p', 'ds-lead small', 'מוקדם מדי, חזרו מאוחר יותר'),
        html('p', 'ds-sub', s.total <= 1 ? 'אתם מהראשונים שסיימו היום.' : `עד עכשיו סיימו ${playersText(s.total)}.`));
      return;
    }
    const lead = html('p', 'ds-lead');
    lead.id = 'ds-lead';
    if (s.top) lead.append('אף אחד לא עשה יותר טוב מכם היום');
    else lead.append('עשיתם יותר טוב מ־', html('b', '', `${s.betterThan}%`), ' מהשחקנים');
    const sub = html('p', 'ds-sub', `${playersText(s.total)} סיימו את החידה היום` + (s.winRate == null ? '' : ` · ${s.winRate}% הצליחו`));
    show('ready', lead, histogram(s), sub);
  })();

  return panel;
}

/** Ten bars, 0–9 points on the right through 90–100 on the left (it reads right to left), mine marked. */
function histogram(s) {
  const wrap = html('figure', 'ds-chart');
  const max = Math.max(1, ...s.buckets);
  const bars = html('ol', 'ds-hist');
  bars.setAttribute('aria-hidden', 'true');
  s.buckets.forEach((count, i) => {
    const li = html('li', i === s.mine ? 'me' : '');
    li.style.setProperty('--h', `${Math.round((count / max) * 100)}%`);
    if (i === s.mine) li.append(html('span', 'ds-you', 'אתם'));
    bars.append(li);
  });
  const axis = html('figcaption', 'ds-axis');
  axis.append(html('span', '', '0 נק׳'), html('span', 'visually-hidden', `התוצאה שלכם בעמודה ${s.mine + 1} מתוך 10.`), html('span', '', '100 נק׳'));
  wrap.append(bars, axis);
  return wrap;
}

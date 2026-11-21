// Fills the brand sheet from the live sources: tokens from shared/base.css, games from the registry,
// components from shared/ui.js and the motion kit from shared/fx.js.
import { GAMES } from '../shared/registry.js';
import { html, svg, icon, renderEnd } from '../shared/ui.js';
import { emblem } from '../shared/emblems.js';
import { tilt, flip, stamp, celebrate, countUp, enter, leaveTo } from '../shared/fx.js';

const ROLES = {
  paper: 'הדף: רקע העמוד',
  sheet: 'גיליון: כרטיסים, שדות, אריחים',
  desk: 'השולחן שמתחת לדפים',
  ink: 'דיו: טקסט וקווים עבים',
  'ink-soft': 'דיו בהיר: טקסט משני',
  rule: 'קו דק בין פריטים',
  'rule-strong': 'קו דק מודגש, מסגרת כבויה',
  brand: 'צבע המותג: הסמל',
  found: 'נכון, נפתר',
  close: 'שגוי, קרוב מאוד',
  near: 'אות: קרוב',
  mid: 'אות: באמצע',
  far: 'אות: רחוק',
  'on-color': 'טקסט על צבע',
};

// Reads the hex tokens of the light :root block and the dark one straight out of the stylesheet.
function readTokens(css) {
  const grab = (block) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\b/g)].map((m) => [m[1], m[2]]));
  const [light, rest] = css.split('@media (prefers-color-scheme: dark)');
  return { light: grab(light.slice(0, light.lastIndexOf('}') + 1)), dark: grab(rest.slice(0, rest.indexOf('[data-game]'))) };
}

// Black or white, whichever reads better on the colour.
function readable(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#1e2328' : '#ffffff';
}

function chip(hex) {
  const node = html('span', '', hex);
  node.style.background = hex;
  node.style.color = readable(hex);
  return node;
}

async function renderSwatches() {
  const css = await (await fetch('../shared/base.css')).text();
  const { light, dark } = readTokens(css);
  const list = document.getElementById('swatches');
  for (const [name, role] of Object.entries(ROLES)) {
    if (!light[name]) continue;
    const li = html('li', 'swatch fx-paper');
    const chips = html('div', 'chips');
    chips.append(chip(light[name]), chip(dark[name] || light[name]));
    const meta = html('div', 'meta');
    meta.append(html('b', '', '--' + name), role);
    li.append(chips, meta);
    list.append(li);
  }
}

const HINTS = {
  nekuda: 'סיכה וטבעות מרחק', beerech: 'תווית מחיר', miani: 'כרטיס רמזים וסימן שאלה',
  blimilim: 'אריחי אימוג׳י, אחד הפוך', tzir: 'אירועים על ציר', herkev: 'רשת של דרכים, משבצת בצומת', yoter: 'חץ למעלה, חץ למטה',
};

function renderAccents() {
  const list = document.getElementById('accents');
  for (const game of GAMES) {
    const li = html('li');
    const card = html('button', 'accent-card fx-paper fx-lift');
    card.type = 'button';
    card.dataset.game = game.slug;
    const mark = svg('svg', { class: 'brand-mark', viewBox: '0 0 28 28', 'aria-hidden': 'true' });
    mark.innerHTML = game.mark;
    const hexes = html('span', 'hexes');
    hexes.append(chip(game.accent), chip(game.accentDark));
    card.append(emblem(game.slug), html('b', '', game.name), html('span', 'hint', HINTS[game.slug]), mark, hexes);
    tilt(card);
    // A tap replays the emblem's own move (hover does it by itself where there is a pointer).
    card.addEventListener('click', () => {
      const em = card.querySelector('.emblem');
      em.classList.remove('is-playing');
      void em.offsetWidth;
      em.classList.add('is-playing');
    });
    li.append(card);
    list.append(li);
  }
}

function sampleCard(slug, status, label, detail, streak) {
  const game = GAMES.find((g) => g.slug === slug);
  const li = html('li', 'game');
  li.dataset.game = slug;
  li.dataset.status = status;
  const card = html('span', 'game-card' + (status === 'new' ? ' fx-corner' : ''));
  const finished = status === 'won' || status === 'lost';
  const state = html('span', 'game-status' + (finished ? ' fx-stamp' : ''));
  if (finished) state.dataset.tone = status === 'won' ? 'found' : 'ink';
  if (status === 'won') state.append(icon('check'));
  state.append(html('span', 'game-status-label', label));
  if (detail) state.append(html('span', 'game-status-detail', detail));
  const head = html('span', 'game-head');
  head.append(html('span', 'game-name', game.name), state);
  const sub = html('span', 'game-sub');
  sub.append(html('span', 'game-tagline', game.tagline));
  if (streak) sub.append(html('span', 'game-streak', `רצף ${streak}`));
  const text = html('span', 'game-text');
  text.append(head, sub);
  card.append(emblem(slug), text);
  li.append(card);
  return li;
}

function renderParts() {
  document.getElementById('card-samples').append(
    sampleCard('tzir', 'new', 'חדש היום'),
    sampleCard('beerech', 'playing', 'באמצע משחק', '', 2),
    sampleCard('nekuda', 'won', 'נפתר', '3/6', 4),
    sampleCard('miani', 'lost', 'לא הפעם', 'X/5'),
  );
  renderEnd(document.getElementById('end-sample'), {
    title: 'מצאתם!',
    sub: 'היישוב היה מצפה רמון',
    streak: 4,
    shareText: 'חמש דקות – דוגמה',
    countdown: false,
  });
}

function wireDemos() {
  const tiltCard = document.getElementById('demo-tilt');
  tiltCard.append(emblem('tzir'));
  tilt(tiltCard, { gyro: true });

  const flipCard = document.getElementById('demo-flip');
  flipCard.addEventListener('click', () => flip(flipCard));

  const pad = document.getElementById('demo-stamp-pad');
  const tones = [['נפתר', 'found'], ['לא הפעם', 'ink'], ['שיא חדש', 'accent']];
  let turn = 0;
  const press = () => {
    pad.replaceChildren();
    const [text, tone] = tones[turn++ % tones.length];
    stamp(pad, { text, tone, big: true, angle: -8 + (turn % 3) * 5 });
  };
  document.getElementById('demo-stamp').addEventListener('click', press);
  press();

  const party = document.getElementById('demo-celebrate');
  party.addEventListener('click', () => celebrate({ origin: party }));

  const number = document.getElementById('demo-count');
  document.getElementById('demo-count-btn').addEventListener('click', () => countUp(number, 87, { duration: 900 }));

  const lines = document.getElementById('demo-enter');
  document.getElementById('demo-enter-btn').addEventListener('click', () => enter(lines));

  const leave = document.getElementById('demo-leave');
  leave.addEventListener('click', () => leaveTo('../', { origin: leave }));
}

renderAccents();
renderParts();
wireDemos();
renderSwatches();

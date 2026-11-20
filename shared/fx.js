// The motion and depth kit: paper that lifts, tilts, flips, gets stamped and celebrates.
// Styles live at the end of shared/base.css ("depth and motion kit"). Nothing here is required
// for a page to work: every effect starts from the finished state, does nothing harmful when it
// is called twice, and is skipped (or jumps straight to its end) under prefers-reduced-motion.
//
// CLASS ONLY (no script)
//   .fx-paper            a sheet of paper: --sheet background, grain, resting shadow, 10px radius
//   .fx-lift             with a pointer, the element rises off the desk on hover (pair with .fx-paper)
//   .fx-corner           folded corner at the bottom end; set --fx-corner-bg to the colour underneath
//   .fx-press            press-down feel for anything tappable: <button class="tile fx-press">
//                        (.btn.primary / .accent / .whatsapp already have it)
//   .fx-enter            on a container: its children rise in one after another when it appears
//   .fx-flip             3D card flip. Markup:
//                          <button class="fx-flip" aria-pressed="false">
//                            <span class="fx-flip-inner">
//                              <span class="fx-face fx-front">…</span><span class="fx-face fx-back">…</span>
//                            </span>
//                          </button>
//                        Flipped when aria-pressed="true" or .is-flipped is set; flip(el) toggles both.
//   .fx-stamp            a rubber-stamp label: <span class="fx-stamp" data-tone="found">נפתר</span>
//                        tones: found (green, default), close (red), ink, accent. Add .big for a headline
//                        stamp, .fx-stamp-in to slam it down. --stamp-angle changes the tilt (-5deg).
//   .fx-tilt + .fx-layer a surface that tilt() rotates, and children that float above it (--fx-z: 20px)
//
// ONE CALL
//   tilt(el, { max, gyro })        pointer (and optionally phone-tilt) response. Writes --fx-tx / --fx-ty
//                                  (-1…1) on el; .fx-tilt and every .emblem inside read them. Returns stop().
//   flip(el, flipped?)             toggles a .fx-flip; returns the new state
//   stamp(target, { text, tone, big, angle, icon, delay })
//                                  appends a stamp to target and slams it down (after `delay` ms);
//                                  returns the stamp. stamp(existingStamp, { delay }) replays the slam.
//   celebrate({ origin, colors, count })
//                                  punched paper dots, torn scraps and ink drops burst from origin (an
//                                  element, default: the top third of the screen). Returns a promise.
//                                  It ends early when origin leaves the screen (the player moved on),
//                                  and a new burst replaces one that is still falling.
//   countUp(el, to, { from, duration, format })
//                                  counts el's text up to `to`. The final text is also put in
//                                  el.dataset.value straight away, so nothing has to wait for it.
//   enter(el)                      replays .fx-enter on a container (for content swapped in later)
//   leaveTo(url, { origin })       covers the page with paper growing from origin, then navigates; the
//                                  next page fades in on the same paper (.app does that by itself).
//   reducedMotion()                true when the player asked for less motion

import { html, icon } from './ui.js';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (value, min = -1, max = 1) => Math.min(max, Math.max(min, value));

// ---------- tilt ----------

// One orientation listener feeds every element that asked for it.
const gyroTargets = new Set();
let gyroBase = null;
function onOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  // The way the phone is held right now is "flat"; the baseline drifts after it so a new grip settles.
  if (!gyroBase) gyroBase = { beta: e.beta, gamma: e.gamma };
  gyroBase.beta += (e.beta - gyroBase.beta) * 0.02;
  gyroBase.gamma += (e.gamma - gyroBase.gamma) * 0.02;
  const tx = clamp((e.gamma - gyroBase.gamma) / 18);
  const ty = clamp((e.beta - gyroBase.beta) / 18);
  for (const set of gyroTargets) set(tx, ty);
}

/**
 * Makes an element answer the pointer, and optionally the phone being tilted.
 *   max   multiplies the response; 1 uses the full -1…1 range (default)
 *   gyro  also follow device orientation where the browser gives it without asking. Browsers that need
 *         a permission prompt (iOS) are left alone: nothing is requested, nothing is shown.
 * The element gets --fx-tx and --fx-ty and, while moving, the class fx-tilting. Returns a function that stops it.
 */
export function tilt(el, { max = 1, gyro = false, pointer = true } = {}) {
  if (reducedMotion()) return () => {};
  let frame = 0;
  let next = null;
  const write = () => {
    frame = 0;
    if (!next) return;
    el.style.setProperty('--fx-tx', next[0].toFixed(3));
    el.style.setProperty('--fx-ty', next[1].toFixed(3));
  };
  const set = (tx, ty) => {
    next = [tx * max, ty * max];
    if (!frame) frame = requestAnimationFrame(write);
  };
  const move = (e) => {
    if (e.pointerType === 'touch') return;
    const box = el.getBoundingClientRect();
    el.classList.add('fx-tilting');
    set(clamp(((e.clientX - box.left) / box.width) * 2 - 1), clamp(((e.clientY - box.top) / box.height) * 2 - 1));
  };
  const leave = () => {
    el.classList.remove('fx-tilting');
    set(0, 0);
  };
  if (pointer) {
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
  }
  // Firefox logs a deprecation warning for every deviceorientation listener, so it gets no gyro either.
  const canGyro = gyro && 'DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function'
    && matchMedia('(pointer: coarse)').matches && !/\bGecko\/\d/.test(navigator.userAgent);
  if (canGyro) {
    if (!gyroTargets.size) addEventListener('deviceorientation', onOrientation, { passive: true });
    gyroTargets.add(set);
  }
  return () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerleave', leave);
    gyroTargets.delete(set);
    if (!gyroTargets.size) { removeEventListener('deviceorientation', onOrientation); gyroBase = null; }
    cancelAnimationFrame(frame);
    el.classList.remove('fx-tilting');
    el.style.removeProperty('--fx-tx');
    el.style.removeProperty('--fx-ty');
  };
}

// ---------- flip ----------

/** Turns a .fx-flip over (or to the given side). Keeps aria-pressed in step when the element has it. */
export function flip(el, flipped = !el.classList.contains('is-flipped')) {
  el.classList.toggle('is-flipped', flipped);
  if (el.hasAttribute('aria-pressed')) el.setAttribute('aria-pressed', String(flipped));
  return flipped;
}

// ---------- stamp ----------

function slam(node, delay) {
  node.classList.remove('fx-stamp-in');
  node.style.animationDelay = delay ? `${delay}ms` : '';
  // Reading layout lets the same animation start again.
  void node.offsetWidth;
  node.classList.add('fx-stamp-in');
  return node;
}

/**
 * stamp(target, { text, tone, big, angle, icon, delay }) appends a rubber stamp to target and slams it down.
 * stamp(existingStamp, { delay }) replays the slam on a stamp that is already in the page.
 *   delay  milliseconds to wait before the slam, so it can land after whatever it is stamped on
 */
export function stamp(target, { text, tone = 'found', big = false, angle, icon: iconName, delay = 0 } = {}) {
  if (text == null && target.classList.contains('fx-stamp')) return slam(target, delay);
  const node = html('span', 'fx-stamp' + (big ? ' big' : ''), text);
  node.dataset.tone = tone;
  if (iconName) node.prepend(icon(iconName));
  if (angle != null) node.style.setProperty('--stamp-angle', angle + 'deg');
  target.append(node);
  return slam(node, delay);
}

// ---------- enter ----------

/** Replays the staggered entrance of a .fx-enter container, for content that was swapped in after load. */
export function enter(el) {
  el.classList.remove('fx-enter');
  void el.offsetWidth;
  el.classList.add('fx-enter');
  return el;
}

// ---------- count up ----------

/**
 * Counts the element's text from `from` to `to`.
 *   format  (n) => string, default: the whole number
 * dataset.value holds the final text from the start; with reduced motion the text is final at once.
 * Returns a promise that resolves when the count is done.
 */
export function countUp(el, to, { from = 0, duration = 700, format = (n) => String(Math.round(n)) } = {}) {
  el.classList.add('fx-count');
  el.dataset.value = format(to);
  if (reducedMotion() || from === to || duration <= 0) {
    el.textContent = format(to);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const started = performance.now();
    const run = el.fxCount = Symbol('count');
    const step = (now) => {
      // A newer count on the same element takes over.
      if (el.fxCount !== run) return resolve();
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = format(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
      else { el.textContent = format(to); resolve(); }
    };
    el.textContent = format(from);
    requestAnimationFrame(step);
  });
}

// ---------- celebrate ----------

const cssColor = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

/**
 * A burst of what is left on the desk after a good day: punched paper dots, torn scraps, drops of ink.
 *   origin  element the burst comes from (also where --accent is read); default: top third of the screen
 *   colors  list of CSS colours; default: the accent, ink, sheet and the "solved" green
 *   count   number of pieces (default 80; kept small on purpose)
 * One canvas, removed when the last piece has fallen. Resolves when done; immediately with reduced motion.
 * The burst belongs to the screen it started on: once `origin` is hidden or gone (next round, practice,
 * back to the daily puzzle) it fades out at once instead of raining on the next screen. A second call
 * while one is still falling replaces it.
 */
let stopCelebration = null;
export function celebrate({ origin, colors, count = 80 } = {}) {
  if (reducedMotion()) return Promise.resolve();
  stopCelebration?.();
  const source = origin || document.documentElement;
  const palette = colors || ['--accent', '--accent', '--ink', '--sheet', '--found'].map((name) => cssColor(source, name)).filter(Boolean);
  const ink = cssColor(source, '--ink') || '#1e2328';
  const canvas = html('canvas', 'fx-confetti');
  canvas.setAttribute('aria-hidden', 'true');
  // Twice the pixels is plenty for moving specks, even on a 3x screen.
  const ratio = Math.min(2, devicePixelRatio || 1);
  const width = innerWidth;
  const height = innerHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);

  const box = origin?.getBoundingClientRect();
  const ox = box ? box.left + box.width / 2 : width / 2;
  const oy = box ? box.top + box.height / 2 : height * 0.3;
  const random = (min, max) => min + Math.random() * (max - min);
  const pieces = Array.from({ length: count }, (_, i) => {
    const drop = i % 5 === 4;
    const angle = random(-Math.PI * 0.95, -Math.PI * 0.05);
    const speed = drop ? random(520, 980) : random(260, 760);
    return {
      drop,
      round: i % 3 !== 0,
      x: ox, y: oy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      size: drop ? random(1.5, 3.5) : random(5, 9),
      turn: random(0, Math.PI * 2), spin: random(-9, 9),
      lean: random(0, Math.PI * 2),
      color: drop ? ink : palette[i % palette.length],
    };
  });

  const life = 1900;
  const fade = 400;
  return new Promise((resolve) => {
    const started = performance.now();
    let last = started;
    let end = started + life;
    let request = 0;
    const finish = () => {
      cancelAnimationFrame(request);
      canvas.remove();
      if (stopCelebration === finish) stopCelebration = null;
      resolve();
    };
    stopCelebration = finish;
    const frame = (now) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      // The screen that was being celebrated is no longer showing: wind down quickly.
      if (origin && end - now > 180 && !origin.getClientRects().length) end = now + 180;
      ctx.clearRect(0, 0, width, height);
      const alpha = Math.min(1, Math.max(0, (end - now) / fade));
      ctx.globalAlpha = alpha;
      for (const p of pieces) {
        // Paper is light: it loses speed quickly and then drifts down. Ink is heavy and just falls.
        const drag = p.drop ? 0.6 : 2.6;
        p.vx -= p.vx * drag * dt;
        p.vy += (p.drop ? 1900 : 900) * dt - p.vy * drag * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.turn += p.spin * dt;
        ctx.fillStyle = p.color;
        if (p.drop) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        // A flat scrap tumbling: its width narrows and widens as it turns over.
        const squash = Math.cos(p.turn);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.lean + p.turn * 0.3);
        ctx.scale(squash, 1);
        ctx.beginPath();
        if (p.round) ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        else ctx.rect(-p.size / 2, -p.size * 0.8, p.size, p.size * 1.6);
        ctx.fill();
        ctx.lineWidth = 0.75;
        ctx.strokeStyle = ink;
        ctx.globalAlpha = alpha * 0.35;
        ctx.stroke();
        ctx.restore();
      }
      if (now < end) request = requestAnimationFrame(frame);
      else finish();
    };
    request = requestAnimationFrame(frame);
  });
}

// ---------- leaving a page ----------

/**
 * Covers the page with a sheet of paper that grows from `origin` (an element, usually what was tapped),
 * then goes to `url`. The next page fades in on the same paper, so the two join up.
 * With reduced motion it navigates straight away. Coming back with the back button removes the cover.
 */
export function leaveTo(url, { origin, delay = 380 } = {}) {
  if (reducedMotion()) { location.assign(url); return; }
  const cover = html('div', 'fx-cover');
  const box = origin?.getBoundingClientRect();
  if (box) {
    cover.style.setProperty('--fx-x', `${box.left + box.width / 2}px`);
    cover.style.setProperty('--fx-y', `${box.top + box.height / 2}px`);
  }
  document.body.append(cover);
  void cover.offsetWidth;
  cover.classList.add('is-on');
  setTimeout(() => location.assign(url), delay);
  // A page restored from the back-forward cache would otherwise still be covered.
  addEventListener('pageshow', () => cover.remove(), { once: true });
}

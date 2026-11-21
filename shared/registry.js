// The list of games, in the order the hub shows them. Pure data, importable from Node.
// The accents are repeated in shared/base.css (as [data-game] rules, so pages get their colour
// before any script runs); tests/shared.logic.test.mjs fails if the two drift apart.
import { DEFAULT_EPOCH } from './core.js';

// Marks are drawn on a 28×28 grid. Shapes are stroked in the accent colour by default;
// class="solid" fills instead. See .brand-mark in shared/base.css.
export const GAMES = [
  {
    slug: 'nekuda', name: 'נקודת ציון', tagline: 'מצאו את היישוב הנסתר לפי מרחק וכיוון',
    kind: 'daily', accent: '#c22f25', accentDark: '#ee5548', epoch: '2026-11-13', port: 4179,
    mark: '<path d="M14 3.5 25.5 23.5h-23Z"/><circle class="solid" cx="14" cy="17" r="2.6"/>',
  },
  {
    slug: 'beerech', name: 'בערך', tagline: 'כמה זה עולה? נחשו את המחיר',
    kind: 'daily', accent: '#1c7346', accentDark: '#45b57c', epoch: DEFAULT_EPOCH, port: 4181,
    mark: '<path d="M4 11.5c3.3-4.6 6.7-4.6 10 0s6.7 4.6 10 0M4 19.5c3.3-4.6 6.7-4.6 10 0s6.7 4.6 10 0"/>',
  },
  {
    slug: 'miani', name: 'מי אני?', tagline: 'חמישה רמזים, תשובה ישראלית אחת',
    kind: 'daily', accent: '#6b3fa0', accentDark: '#b08ae6', epoch: DEFAULT_EPOCH, port: 4182,
    mark: '<circle cx="14" cy="14" r="10.5"/><path d="M10.6 11.2a3.5 3.5 0 1 1 4.9 3.2c-1 .5-1.5 1.2-1.5 2.4"/><circle class="solid" cx="14" cy="20.2" r="1.6"/>',
  },
  {
    slug: 'tzir', name: 'על הציר', tagline: 'סדרו את האירועים לפי הזמן',
    kind: 'daily', accent: '#2c5f9e', accentDark: '#6a9fe0', epoch: DEFAULT_EPOCH, port: 4184,
    mark: '<path d="M2.5 14h23M7 9.5v9M21 9.5v9"/><circle class="solid" cx="14" cy="14" r="3.4"/>',
  },
  {
    slug: 'herkev', name: 'צומת', tagline: 'נושא חדש כל יום: מה מתאים גם לשורה וגם לעמודה?',
    kind: 'daily', accent: '#0f766e', accentDark: '#35b5a8', epoch: DEFAULT_EPOCH, port: 4185,
    mark: '<path d="M3 9.5h22M3 18.5h22M9.5 3v22M18.5 3v22"/><circle class="solid" cx="18.5" cy="18.5" r="3.4"/>',
  },
  {
    slug: 'yoter', name: 'יותר או פחות', tagline: 'מה גדול יותר?',
    kind: 'daily', accent: '#8f5f08', accentDark: '#e0a83a', epoch: DEFAULT_EPOCH, port: 4186,
    mark: '<path d="M5.5 12 14 4.5 22.5 12"/><path d="M5.5 16 14 23.5 22.5 16"/>',
  },
  {
    slug: 'blimilim', name: 'בלי מילים', tagline: 'סרט, סדרה או שיר ישראלי, רק באימוג׳י',
    kind: 'daily', accent: '#b83d0b', accentDark: '#f0783c', epoch: DEFAULT_EPOCH, port: 4183,
    mark: '<rect x="4" y="4" width="20" height="20" rx="4.5"/><circle class="solid" cx="10.5" cy="12" r="1.7"/><circle class="solid" cx="17.5" cy="12" r="1.7"/><path d="M9.5 16.5c2.5 2.6 6.5 2.6 9 0"/>',
  },
];

export const SITE = {
  name: 'חמש דקות',
  tagline: 'משחקים קצרים בעברית. חידה חדשה בכל משחק, כל יום בחצות.',
};

export function gameBySlug(slug) {
  return GAMES.find((g) => g.slug === slug) || null;
}

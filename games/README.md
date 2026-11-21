# Writing a game for חמש דקות

חמש דקות ("Five Minutes") is a static site of short daily Hebrew games. This file is everything you
need to add one. Read it once, then copy `games/_template/` and change it.

The stack is fixed: plain static files, vanilla ES modules, no build step, no framework, no backend,
no runtime npm packages. Hebrew, `dir="rtl"`, phone first, light and dark through
`prefers-color-scheme`.

## 1. What you may touch

You own exactly two places:

```
games/<your-slug>/            index.html, style.css, app.js, game.js, data files, anything else you need
tests/<your-slug>.*           <slug>.logic.test.mjs and <slug>.e2e.mjs (more files with that prefix are fine)
```

Never edit `shared/`, `shared/registry.js`, the hub (`/index.html`), `package.json`, `scripts/`,
`tests/helpers.mjs`, `tests/run-e2e.mjs`, or another game's directory. Other authors are working at
the same time and those files are shared. If the shared layer is missing something, build it inside
your own directory and say so in your report.

Screenshots go to `tests/screenshots/<slug>/` (git-ignored). A dev server may be running on port 4173;
leave it alone and never use that port in tests.

## 2. The registry

`shared/registry.js` already lists your game: slug, Hebrew name, tagline, kind, accent colours, epoch,
test port and the header mark. You do not add or change anything there.

| slug | name | kind | accent light / dark | e2e port |
|---|---|---|---|---|
| nekuda | נקודת ציון | daily | `#c22f25` / `#ee5548` | 4179 |
| beerech | בערך | daily | `#1c7346` / `#45b57c` | 4181 |
| miani | מי אני? | daily | `#6b3fa0` / `#b08ae6` | 4182 |
| tzir | על הציר | daily | `#2c5f9e` / `#6a9fe0` | 4184 |
| herkev | צומת | daily | `#0f766e` / `#35b5a8` | 4185 |
| yoter | יותר או פחות | daily | `#8f5f08` / `#e0a83a` | 4186 |
| blimilim | בלי מילים | daily | `#b83d0b` / `#f0783c` | 4183 |

(4180 is the template's port, 4187 the hub's, 4188 and 4189 belong to `tests/site.e2e.mjs` and `tests/pwa.e2e.mjs`, 4190 to `tests/social.e2e.mjs`.)

Every accent has at least 4.5:1 contrast against `--paper` and `--sheet` as text, and under
`--on-accent` as a fill, in both themes; a test enforces it. To get there, three light accents were
darkened from the first draft of the palette: beerech `#1f7a4d` → `#1c7346`, `#c2410c` → `#b83d0b`
(now בלי מילים), yoter `#b3780c` → `#8f5f08`. Use `var(--accent)`, never the hex.

## 3. Page skeleton

Copy `games/_template/index.html`. The parts that matter:

```html
<html lang="he" dir="rtl" data-game="<slug>">        <!-- data-game switches on your accent -->
  ...
  <link rel="stylesheet" href="../../shared/fonts.css">     <!-- bundled fonts, never Google at runtime -->
  <script type="module" src="../../shared/pwa.js"></script>  <!-- offline support + install -->
  <link rel="stylesheet" href="../../shared/base.css">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app">
    <header class="top" id="header"></header>          <!-- filled by mountHeader() -->
    <main> ... your game ... </main>
    <footer class="foot"> ... sources, credits ... </footer>
  </div>
  <dialog id="help-dialog" class="sheet"> ... rules ... </dialog>
  <script type="module" src="app.js"></script>
</body>
```

- Keep the `shared/fonts.css` link, the `shared/pwa.js` script, the two `theme-color` metas, the icon
  and manifest links and the `apple-mobile-web-app-*` metas from the template (`npm test` checks the
  font, script and manifest lines on every page).
- The site works offline from a cache of every file. A new game's files join it when someone runs
  `npm run build:sw` (the lead does this; `npm test` fails until it's done). Load data from files
  inside your directory with relative paths, and never from another site at runtime, or it won't
  work offline.
- Give the page its own `<title>`, description and Open Graph title/description (`<name> – חמש דקות`).
- All paths are relative (`../../shared/…`, `../../assets/…`). The site may be served from a
  sub-folder, so never start a path with `/`.
- Split the code the way the template does: `game.js` holds pure rules with no DOM (so Node can test
  it), `app.js` holds the interface.
- Draw the first state of the game while `app.js` is being evaluated (no `setTimeout`, no top-level
  `await` before the first render). Until then `main` and the footer are kept unseen by `base.css`,
  and `shared/ui.js` reveals them the moment your script has run, so a slow connection never shows a
  half-built page that then jumps. A page that does not import `shared/ui.js` would stay blank.

## 4. `shared/core.js` (pure, works in Node)

```js
DEFAULT_EPOCH                                  // '2026-11-14', puzzle #1 for every new game
israelDate(now = new Date())                   // 'YYYY-MM-DD' in Israel
dayNumber(dateString = israelDate(), epoch = DEFAULT_EPOCH)   // 1 on the epoch date
dateOfDay(day, epoch = DEFAULT_EPOCH)          // Date for a puzzle day
hebrewDate(date, options?)                     // '14 בנובמבר'
msUntilNextPuzzle(now = new Date())            // ms to the next Israel midnight; right on the 23- and 25-hour clock-change days too
formatCountdown(ms)                            // '01:02:03'
mulberry32(seed)                               // () => number in [0, 1)
seededShuffle(array, seed)                     // new array, input untouched
pickDaily(pool, day)                           // one item per day, no repeats until the pool runs out, then wraps
normalizeHebrew(text)                          // strips niqqud, final letters, spaces, punctuation
emptyStats(buckets = 6)                        // { played, wins, streak, maxStreak, lastWinDay, lastPlayedDay, distribution }
recordResult(stats, day, won, bucketIndex = 0) // new stats; the same day never counts twice; bucketIndex is 0-based
currentStreak(stats, day)                      // 0 once a day has been skipped
winRate(stats)                                 // whole percent
dailyState(saved, today, buckets = 6)          // today's state object from whatever was stored
dailyStatus(saved, today)                      // 'new' | 'playing' | 'won' | 'lost' (what the hub shows)
```

## 5. `shared/ui.js` (DOM)

```js
createStore(slug)        // { key, load(), loadDaily(today, buckets = 6), save(state) }
mountHeader({ slug, onHelp, onStats })   // -> { root, setLabel(text), helpButton, statsButton }
renderStats({ stats, day, distTitle?, labels?, highlight? })   // -> the <dialog>; call .showModal()
renderEnd(container, { title, sub, streak, shareText, countdown, actions })   // -> { shareButton, whatsappButton, countdownEl }
shareResult(text)        // native share sheet on touch devices, else clipboard, else textarea fallback; toasts when copied
whatsappLink(text)       // 'https://wa.me/?text=…'
gameUrl()                // this page's address without query or hash, for share text
startCountdown(element, onNewDay?)   // HH:MM:SS every second; reloads the page at midnight by default; returns stop()
toast(message, ms = 2200)
wireDialog(dialog)       // click on the backdrop closes it; the dialog opens scrolled to its top; call it on every <dialog>
html(tag, className?, text?)   svg(tag, attrs?, text?)   // element builders
icon(name)               // drawn SVG icon: help, stats, share, back, check, cross, up, down, again, search
```

Notes:

- **`mountHeader`** renders the back-to-hub link, your name and mark (from the registry), the
  puzzle-label slot, and the help and stats buttons. Every header on the site is this one function;
  do not build your own. Leave `onStats` out and no stats button is drawn (the party game).
- **`renderStats`** builds the standard stats dialog on first use. `distTitle` is the heading over the
  distribution chart (pass `null` to drop the chart), `labels` names the bars (default 1, 2, 3…),
  `highlight` is the index of the bar today's win landed in. Each label sits in a `<bdi>`, so `250+`
  keeps its plus after the number.
- **`wireDialog`** does three things for a `<dialog class="sheet">`: a tap on the dimmed area closes
  it (but not in the first 400 ms, which is the second half of a double tap on whatever opened it), it
  opens at its top however long the rules are, and with the shared styles its last `<form>` (the
  closing button) stays pinned to the bottom edge while the text scrolls. Rules are taller than a
  360×640 screen more often than not, so call it on every dialog and keep the closing form last.
- **`renderEnd`** fills a `<section id="end" hidden>` with the standard end panel. `sub` is a string
  or a DOM node. `shareText` is a string or a function returning one; leave it out to hide both share
  buttons. `countdown: false` hides "next puzzle in…". `actions` are extra nodes (usually
  `.btn.ghost` buttons) placed under it. You may write the panel by hand instead, with the `.end*`
  classes, if you need a different arrangement. The title (`#end-title`) can take focus but is not a
  tab stop: when the game ends and the control the player was on disappears, move the focus there
  (`container.querySelector('#end-title').focus({ preventScroll: true })`) instead of letting it fall
  back to the top of the page.
- These ids are created by the shared helpers. Do not use them for anything else, and use them in
  tests: `header`, `help-btn`, `stats-btn`, `puzzle-label`, `stats-dialog`, `dist`, `toast`,
  `end-title`, `end-sub`, `end-streak`, `share-btn`, `whatsapp-btn`, `countdown`.

## 6. The store

One JSON object per game in `localStorage` under `hd:<slug>`. The hub reads the top-level fields of
every game, so they are the same everywhere:

```js
{
  day: 12,            // the day number this progress belongs to
  finished: false,    // today's puzzle is over
  won: false,         // …and was solved
  summary: '',        // optional short result shown on the hub when finished: '3/6', 'X/4', '8 מתוך 10'
  stats: { … },       // emptyStats() / recordResult()
  seenHelp: true,     // the rules dialog was closed at least once
  progress: null      // anything game-specific: guesses, picked tiles, order…
}
```

```js
const store = createStore('<slug>');
const today = dayNumber(israelDate());
const state = store.loadDaily(today, BUCKETS);   // always a complete object, whatever was stored
// … mutate state …
store.save(state);
```

`loadDaily` keeps `stats` and `seenHelp` from earlier days and resets `finished`, `won`, `summary` and
`progress` when the stored `day` is not today.

Things that trip people up:

- **Keep `progress` at `null` until the player's first move.** The hub shows "in progress" when
  `progress` is non-empty and `finished` is false.
- **Save after every move**, not only at the end, so a reload mid-game loses nothing.
- **Call `recordResult` once, when the daily game ends.** It ignores a second call for the same day,
  which is what makes a reload safe. Practice and archive rounds never touch the store.
- **Day numbers can be zero or negative.** New games count from 14 November 2026; before that date
  `dayNumber()` returns 0, -1, … `pickDaily` and the stats functions handle this. Your own code must
  too: never treat `day` as truthy/falsy, and never index an array with `day - 1` directly.
- Stored data may be junk or missing (private mode). `load()` and `loadDaily()` never throw; validate
  what you read from `progress` (`Array.isArray`, known values only) before using it.

## 7. Daily selection

Everyone must get the same puzzle on the same day with no server:

```js
const POOL = seededShuffle(PUZZLES, 20261114);   // fixed seed, shuffled once at module load
export const puzzleForDay = (day) => pickDaily(POOL, day);
```

- The day flips at midnight Israel time (`israelDate()`), not at the player's local midnight.
- Aim for a pool of at least 60 puzzles so nothing repeats for two months. Adding puzzles to the end
  of the source list reshuffles future days; do not do it casually once the site is live.
- `startCountdown` reloads the page when the date changes while the tab is open. `renderEnd` starts it
  for you.
- An archive link (`?day=N` for an earlier day, not counted in stats) or a practice round is welcome
  when the game has enough content for it. Label the mode clearly (`.mode-banner`) and offer a way
  back to today's puzzle.

## 7a. Points for the group boards

When the site has a leaderboards backend (README.md, "Leaderboards and groups"), every finished
**daily** puzzle is sent as 0–100 points, higher is better. Each scored game exports a pure
`points(...)` from its `game.js` (same arguments as its `summary`), tested in
`tests/social.logic.test.mjs`, and explained to players on `groups/` (keep the two in step):

| game | `points(...)` | rule |
|---|---|---|
| nekuda | `points(results)` | found in guess N: 100, 85, 70, 55, 40, 25; not found: 0 |
| beerech | `points(guesses, round)` | the day's total (0–500) / 5 |
| miani, blimilim | `points(puzzle, moves)` | found at stage N: 100, 80, 60, 40, 20; not found: 0 (shared/reveal.js) |
| tzir | `points(results)` | round(100 × placed right / 6) |
| herkev | `points(grid, guesses)` | round(100 × cells filled / 9) (the topic must be loaded) |
| yoter | `points(items, answers)` | 10 × right answers of the day's ten |

The end panel calls `dayStatsPanel(container, { game, day, points, won, summary })` from
`shared/social-ui.js` right after `renderEnd`, and `dayStatsPanel(container, null)` for archive and
practice rounds. It sends the result (once per game and day, queued offline) and shows how everyone
did; with no backend configured it draws nothing. A new scored game also needs a row in the `games`
table of `supabase/setup.sql` and its slug in `SCORED_GAMES` in `shared/social.js`.

## 8. Styles

`shared/base.css` gives you the paper-and-ink look. Your `style.css` adds only what is special to your
game. The idea is the puzzle page of a newspaper: cream paper, black ink, hairline rules instead of
card boxes and shadows, a serif display face for titles and the content the player looks at, small
radii, a thick ink rule under the header.

Tokens (all switch automatically in dark mode):

| token | use |
|---|---|
| `--paper`, `--sheet` | page background; slightly lighter surface for fields, tiles, maps |
| `--ink`, `--ink-soft` | text; secondary text |
| `--rule`, `--rule-strong` | hairlines between items; stronger hairlines and disabled borders |
| `--accent`, `--on-accent` | your game's colour; text on top of it |
| `--found`, `--close` | right / wrong (green, red); readable as text |
| `--far`, `--near`, `--mid` | blue, orange, amber signal colours for fills and strokes. Text in `--on-color` is readable on all five signal colours (4.5:1, tested); as small text on paper, `--mid` and `--near` are too light in light mode |
| `--on-color` | text on top of any signal colour |
| `--display`, `--text` | Frank Ruhl Libre (serif, titles and key content); Heebo (interface) |
| `--ease`, `--lift` | the easing curve; the one shadow (floating layers only: dialogs, toast, dropdown) |
| `--desk` | the table under the paper (the hub's background, wells, punched holes) |
| `--shadow-rest`, `--shadow-raised`, `--shadow-pressed`, `--edge` | paper lying on the desk, lifted off it, pressed into it; the light top edge of a sheet |
| `--accent-deep`, `--accent-pale` | the accent darkened (the side of a raised shape) and washed out on paper (fills only, not text) |
| `--brand`, `--ease-spring`, `--grain` | the logo's red; an easing with a little overshoot; the paper-grain image |

Component classes:

| class | what it is |
|---|---|
| `.app`, `.app > main` | the 480px page column; `main` is a one-column grid with 12px gaps (override the columns if you need two) |
| `.top`, `.brand`, `.puzzle-label`, `.icon-btn` | the header (rendered for you) |
| `.btn` + `.primary` / `.accent` / `.ghost` / `.whatsapp`, `.block`, `.small` | buttons; `.ghost` is full width; `:disabled` is styled |
| `.tile` | a tappable answer (word, option, card). States: `aria-pressed="true"` or `.picked`, `.right`, `.wrong`, `:disabled` |
| `.link` | a button that looks like an underlined link |
| `.field`, `.search` + `.search-icon`, `.suggestions` | text input; the same with a leading icon; the autocomplete list (`li[aria-selected="true"]`, `.used`, `.none`) |
| `.hints` | one ruled strip of equal cells (`li` label + `<b>` value, `li.open` once revealed) |
| `.mode-banner` | dashed note for practice / archive mode; a link inside it is ink, not link blue |
| `.end`, `.end-title`, `.end-sub`, `.end-streak`, `.end-actions`, `.next` | the end panel |
| `.end.paper`, `.end-stamp` | the end panel as a sheet of its own (`<section id="end" class="paper" hidden>`), and the line at its head that holds the score stamp |
| `.sheet` | `<dialog>` styling (help, stats, anything modal). End it with `<form method="dialog">` and the closing button; that form stays in view |
| `.stat-grid`, `.stat-dist`, `.bar`, `.bar.today` | stats (rendered for you; the chart also has `id="dist"`) |
| `.toast` | rendered for you |
| `.foot` | small centred footer |
| `.display`, `.muted`, `.kicker`, `.rule`, `.rule.strong`, `.visually-hidden`, `.icon` | text helpers |
| `.shake`, `.pop` | one-shot animations; keyframes `reveal`, `unfold`, `drop`, `grow`, `shake`, `pop` are available |

Your accent: put `data-game="<slug>"` on `<html>` and use `var(--accent)` / `var(--on-accent)`.
That is all. Do not redefine the tokens. If your game needs more colours, define new variables in your
own `style.css` with a light and a dark value, and check their contrast.

Animations are switched off globally under `prefers-reduced-motion`; nothing may depend on an
animation finishing.

Two rules that the shared styles follow and yours must too:

- **Hover styles go inside `@media (hover: hover)`.** On a touch screen `:hover` sticks to whatever
  lies under the last tap, so a button that appears under the thumb looks pressed. The shared `.btn`
  and `.icon-btn` hover fills are written that way, and only for buttons that are not disabled.
- **Design for 360×640 as well as 390×844.** A phone browser's bars leave 640–750px of height on most
  phones. Anything pinned to a corner of a card (a stamp, a badge) must be checked at that height
  with the longest content it can meet.

## 8a. Motion and depth kit

The site is paper on a desk, and things you touch behave like paper: they lift, press, flip and get
stamped. The classes are in `shared/base.css`, the functions in `shared/fx.js` (usage notes at the top
of that file), and `brand/index.html` shows every one of them live. Adopt them with a class or one call:

```js
import { tilt, flip, stamp, celebrate, countUp, enter, leaveTo, reducedMotion } from '../../shared/fx.js';
import { emblem } from '../../shared/emblems.js';
```

| effect | how to use it |
|---|---|
| paper surface | `.fx-paper` (sheet colour, grain, resting shadow). Add `.fx-lift` to rise on hover, `.fx-corner` for a folded corner (set `--fx-corner-bg` to the colour underneath) |
| press | `.fx-press` on anything tappable (`<button class="tile fx-press">`). Filled `.btn`s already have it |
| tilt | `tilt(el)`; add `{ gyro: true }` to follow the phone as well. It writes `--fx-tx` / `--fx-ty` (-1…1) on `el`. Give `el` the class `.fx-tilt` to rotate it, and children `.fx-layer` (with `--fx-z: 20px`) to float above it; any emblem inside leans by itself. Returns a function that stops it |
| card flip | `.fx-flip > .fx-flip-inner > .fx-face.fx-front + .fx-face.fx-back`; flipped while `aria-pressed="true"` or `.is-flipped`. `flip(el)` toggles both. `.fx-flip` is `display: block` unless your own rule says otherwise |
| stamp | `<span class="fx-stamp" data-tone="found">נפתר</span>`; tones `found`, `close`, `ink`, `accent`; `.big` for a headline. `stamp(container, { text, tone, big, angle, icon, delay })` adds one and slams it down after `delay` ms; `stamp(existingStamp, { delay })` replays |
| celebration | `celebrate({ origin: element })`: punched paper dots, scraps and ink drops on one canvas, gone after two seconds, or at once when `origin` is hidden or removed (the player moved on to practice or the next round). A new call replaces one still falling. Call it once, on a win |
| count up | `countUp(el, 87)`; options `from`, `duration`, `format`. The final text is in `el.dataset.value` at once |
| entrance | `.fx-enter` on a container staggers its children in; `enter(el)` replays it for content swapped in later |
| page change | every `.app` fades in by itself. `leaveTo(url, { origin })` covers the page with paper growing from `origin` before navigating |
| emblem | `emblem('<slug>')` returns the game's layered drawing (64px; set `--emblem-size` and `--emblem-depth`). Inside a link or button it plays its move on hover and focus; add `.is-playing` to play it yourself |

Rules that keep it fast and honest:

- Every effect starts from the finished state. With `prefers-reduced-motion` the functions jump to the
  end or do nothing, and the classes do not animate. Never wait for an animation before saving state,
  and in tests read `dataset.value` (or wait for the text) rather than a number mid-count.
- A stamp starts large before it lands. Put `overflow-x: clip` on the page column if a stamp sits near
  the edge of the screen.
- Animate `transform` and `opacity`. One celebration at a time. No tilt on things the player types into.
- `tilt({ gyro: true })` never asks for permission: where the browser would show a prompt (iOS), it
  simply does not follow the phone. Firefox gets no gyro either (it logs a deprecation warning for the
  sensor).
- Depth comes from `--shadow-rest` / `--shadow-raised` / `--shadow-pressed`, not from new shadows.
  `--lift` stays for floating layers.

## 9. Checklist for a daily game

- [ ] Rules dialog opens on the first visit only (`seenHelp`) and from the header's help button.
- [ ] Today's puzzle is chosen by Israel date and is the same for everyone.
- [ ] Progress is saved after every move and restored after a reload, including a finished game.
- [ ] Stats dialog from the header; a finished day is counted exactly once.
- [ ] Streak shown at the end (from 2) and in the stats.
- [ ] End panel: result, the answer, share button, WhatsApp button, countdown to the next puzzle.
- [ ] Share text is spoiler-free and has the game's name, `#<day number>`, the result, and
      `gameUrl()` on the last line. Emoji are fine here.
- [ ] `summary` is set when the game ends, so the hub can show the result.
- [ ] Practice round or archive, if the content allows it; never counted in stats.
- [ ] Light and dark both look right. Check both screenshots.
- [ ] 360×640 phone: no horizontal scroll, nothing clipped or covered, tap targets at least 44px, the
      rules dialog readable from its first line.
- [ ] A double tap never costs the player anything (a guess, a life, a round).
- [ ] Everything works from the keyboard; focus is visible and is never dropped when a control is
      disabled or removed by a move; controls are real `<button>` / `<input>` / `<a>` elements with
      Hebrew `aria-label`s where there is no text. The result is in an `aria-live="polite"` region.
- [ ] No console errors or warnings from your code.

A party game (there is none at the moment) would have no daily puzzle: it skips the daily store
fields, stats, streak and countdown, and calls `mountHeader` without `onStats`. Everything else applies.

**One more clue** games: `miani` and `blimilim` share their rules (`shared/reveal.js`), interface
(`shared/reveal-ui.js`), styles (`shared/reveal.css`) and browser scenarios (`tests/reveal-shared.mjs`).
A third game of that kind needs only its data, a `drawStage` function and its page.

## 10. Tests

Two files per game. Model them on `tests/_template.logic.test.mjs` and `tests/_template.e2e.mjs`.

**`tests/<slug>.logic.test.mjs`** uses Node's built-in runner (`node:test`, `node:assert/strict`) and
imports only your `game.js` and data. Cover the rules, the daily selection (deterministic, no repeats
within a cycle, works for day 0 and below), the share text (exact string, no spoilers) and the sanity
of your data (no duplicates, every entry complete, sources present).

**`tests/<slug>.e2e.mjs`** drives the real page in Chrome through `tests/helpers.mjs`:

```js
import assert from 'node:assert/strict';
import { createSession, horizontalOverflow, shareToClipboard, isDialogOpen, readStore } from './helpers.mjs';

const session = await createSession({ slug: '<slug>', port: <your port> });
const { open, step, shot } = session;

await session.run(async () => {
  await step('first visit shows the rules once', async () => {
    const { context, page } = await open();              // fresh profile, 390×844 phone, Hebrew locale
    assert.equal(await isDialogOpen(page, '#help-dialog'), true);
    await shot(page, '01-help');                          // tests/screenshots/<slug>/01-help.png
    await context.close();
  });
});
```

- `open(options, subPath)` takes any Playwright context option (`colorScheme: 'dark'`,
  `viewport: { width: 360, height: 640 }`, `isMobile: false`…) plus `fixedTime: new Date(…)` to freeze
  the page clock; move it later with `page.clock.setFixedTime(…)` and reload to test the next day.
- `session.url` is your game's address (what `gameUrl()` returns in the page), `session.root` the site root.
- `session.run` fails the file if any page logged a console error, so you do not assert that yourself.
- `shareToClipboard(page)` clicks `#share-btn` and returns the copied text.
- Cover at least: first visit, a win, a loss, reload mid-game and after the end, share text, stats, a
  new day keeping the streak, dark mode, 360px width with `horizontalOverflow(page) === 0`, corrupted
  storage (`localStorage.setItem('hd:<slug>', '{not json')`).
- Compute the expected answer in the test from your own `game.js` (as the template does) rather than
  hard-coding it; the tests must pass on any date, including before the epoch.

`tests/site.logic.test.mjs` and `tests/site.e2e.mjs` check the site as one product (the countdown
across the clock changes, share texts, relative paths, hosting in a sub-folder, storage switched off,
dialogs on a short phone, keyboard focus) and hold the regression tests of the final QA pass. They
import every game; if you rename an export of your `game.js` that they use, update them.

Run them:

```
npm test                              # every tests/*.logic.test.mjs
node --test tests/<slug>.logic.test.mjs
npm run test:e2e -- <slug>            # only yours
npm run test:e2e                      # every tests/*.e2e.mjs, one after another
npm run dev                           # http://localhost:4173 (if it is not already running)
```

Chrome is expected at `/usr/bin/google-chrome`; set `CHROME_PATH` to use another binary. Look at your
screenshots before you call the game done.

## 11. Content rules

- All text is natural, everyday Hebrew, addressed to the player in the plural (שחקו, נחשו). No
  translated-sounding phrases, no English in the interface.
- Names, visuals and puzzle content must be original. Borrowing a mechanic from a well-known game is
  fine; borrowing its name, artwork, layout signature or puzzles is not.
- Anything shown as a fact (a price, a date, a statistic, a club a player played for) must come from
  a named source. Record the source and the date you retrieved it in the data file, next to the data
  or in a header comment, and credit the source in the page footer.
- No emoji as interface icons. Draw an SVG (`icon()` covers the common ones; draw your own for the
  rest, in the same 24×24 line style). Emoji are fine inside share text.
- Code comments explain why, not what.

# חמש דקות (Hamesh Dakot)

A hub of seven short daily Hebrew games: "the puzzle page of a newspaper". Each is a solo puzzle of a
few minutes that changes at midnight Israel time and is the same for everyone, and together they ask
one question: how well do you know the country and its culture? Every game shares the same paper, ink and type, and has its own accent colour.

It is a static site: no build step, no accounts, no analytics. Progress, streaks and statistics live
in the player's browser (`localStorage`). The optional leaderboards and groups (see below) send each
finished daily puzzle's points, anonymously, to a small database; until that is set up nothing leaves
the browser. Hebrew, right-to-left, phone first, light and dark.

## The games

| Slug | Name | What you do | Extras |
|---|---|---|---|
| `nekuda` | נקודת ציון | Find the hidden Israeli locality in six guesses; each guess gives distance and direction on a map | Practice rounds, `?day=N` archive |
| `beerech` | בערך | Guess the supermarket shelf price of five products; up to 100 points each | Practice rounds |
| `miani` | מי אני? | Five clues, hardest first, about one Israeli person, place, food, invention or symbol; type a guess, and every miss opens the next clue | Archive of earlier puzzles |
| `tzir` | על הציר | Place six events on a timeline, three lives | Practice rounds |
| `herkev` | צומת | 3×3 grid on one topic a day (countries, film and TV, Israeli music, Israeli localities, Israeli football): name an answer that fits both the row and the column, nine guesses | Archive of the last 30 days |
| `yoter` | יותר או פחות | Ten rounds of "is the hidden number bigger or smaller?" on one theme a day | Sudden-death practice per theme |
| `blimilim` | בלי מילים | An Israeli film, TV show, song or children's book told in six emoji; three open at first, every miss opens one more, then a written hint | Archive of earlier puzzles |

Every daily game shows its rules on the first visit, saves after every move, keeps statistics and a
streak, and ends with a spoiler-free result to share (native share sheet, clipboard or WhatsApp).
The hub shows today's status of every game, a punch card for the day and the countdown to midnight.

Puzzle #1 of נקודת ציון was 13 November 2026 (`EPOCH` in `games/nekuda/game.js`); every other game
counts from 14 November 2026 (`DEFAULT_EPOCH` in `shared/core.js`). That is why נקודת ציון is always
one puzzle number ahead of the rest.

## Run locally

```
npm install        # only needed for the browser tests and for rendering the icons
npm run dev        # http://localhost:4173
```

Any static file server works just as well (`python3 -m http.server`, `npx serve`). The pages use ES
modules, so they must be served over HTTP: opening `index.html` from the file system does not work.

## Test

```
npm test                     # logic tests (Node's built-in runner), under two seconds
npm run test:e2e             # every game, the hub and the whole-site checks in headless Chrome at phone size, about eight minutes
npm run test:e2e -- nekuda   # only the named files: a game's slug, hub, site, _template
```

- The browser tests use `playwright-core` with the Chrome that is already installed: `/usr/bin/google-chrome`,
  or whatever `CHROME_PATH` points at. Nothing is downloaded.
- Each test file starts its own server on its own port (4179–4190), so the dev server can stay up.
- Screenshots are written to `tests/screenshots/<name>/` (git-ignored). Look at them: a passing test
  does not mean the page looks right.
- `tests/site.logic.test.mjs` and `tests/site.e2e.mjs` check the site as one product: the countdown
  across the clock changes, share texts, relative paths, hosting in a sub-folder, storage switched off,
  dialogs on a short phone, keyboard focus.
- Firefox and WebKit are not part of the suite. They were checked by hand with the Playwright builds
  (see "Browsers" below).

## Deploy

Upload the repository to any static host. Nothing needs to be built, and every path in the site is
relative, so it works from the root of a domain and from a sub-folder alike (a test serves it from
`/apps/hamesh-dakot/` to make sure).

- **Cloudflare Pages / Netlify / Vercel:** connect the Git repository, leave the build command empty,
  set the output directory to the repository root.
- **GitHub Pages:** Settings → Pages → deploy from the branch root. A project site
  (`user.github.io/repo/`) works as is.
- `node_modules/`, `tests/`, `scripts/` and the `build-data.mjs` / `candidates.mjs` files are not
  needed on the server, and nothing breaks if they are there.

After the first deploy, three things by hand:

1. **Preview image.** Change `og:image` in `index.html` and in each `games/<slug>/index.html` from the
   relative `assets/og.png` to the full address (`https://your-domain/assets/og.png`). WhatsApp and
   Facebook ignore relative image paths, so without this a shared link shows no picture. Adding
   `og:url` with each page's full address at the same time does no harm.
2. **Caching.** The files have no version in their names. Let the host revalidate HTML, JS and CSS
   (`Cache-Control: no-cache`, which is the default on the hosts above) rather than cache them for
   days, or players will mix an old script with new data. This matters most for **`sw.js`**: if the
   host caches it, installed copies won't learn about a new version.
3. **Open it on a real phone**, in light and dark, and send yourself a result on WhatsApp.

### Installable app and offline play

The site is an installable web app. `sw.js` (a service worker) caches every file the games need on
the first visit, so afterwards everything opens instantly and works with no connection, and
`manifest.webmanifest` gives it an icon, a splash screen and a full-screen window when installed.
Fonts are bundled in `assets/fonts/` (no calls to Google at runtime).

- **Android / desktop Chrome and Edge:** the hub shows an "התקנה" card under the play button when the
  browser offers installing; one tap installs it. Long-pressing the installed icon offers shortcuts
  (today's puzzles, three of the games).
- **iPhone / iPad:** the same card opens a short how-to (Safari → Share → Add to Home Screen). Inside
  WhatsApp's own browser installing isn't possible; the sheet says to open the link in Safari.
- **After changing any site file, run `npm run build:sw`.** It rewrites `sw.js` with the new file list
  and a new version stamp, which is how installed copies find out about the update (they switch to it
  on the next page they open). `npm test` fails if you forget.
- Service workers only run over HTTPS (and on `localhost`), which every host above provides.

## Leaderboards and groups

Players can see how they did against everyone who played the same puzzle ("you did better than 68% of
players", with a small chart, under every finished daily puzzle), and can open private groups for
family and friends with a shared board for today, this week and all time. It is **off until the owner
sets it up** (below): with `shared/config.js` empty, nothing is sent and none of it is shown.

**How it works.** The database is a free [Supabase](https://supabase.com) project. The site calls it
directly with `fetch` (`shared/social.js`, no SDK): `POST <project>/rest/v1/rpc/<function>`. There is
no sign-up. On first use the server makes a random player id and secret; the browser keeps both in
`localStorage` (`hd:me`) and the database keeps only a hash of the secret. When a daily puzzle ends,
its points (0–100 per game, rules on the groups page and in `games/README.md`) go into a queue in
`localStorage` and are sent from there, so a game finished offline is sent on the next page load or
when the connection returns. Archive and practice rounds are never sent; a game and day is sent once
and the first result is the one that counts.

- `supabase/setup.sql` everything on the server: tables, limits and the functions the site calls.
- `shared/config.js` the project address and key (empty = off).
- `shared/social.js` the client; `shared/social-ui.js` the "how everyone did" block on end panels.
- `groups/` the groups page: nickname, my groups, create, invite (WhatsApp / link / code), join from
  `groups/?join=CODE`, the board, leave, delete my data. The hub links to it only when configured.

**Security.** The anon (publishable) key in `shared/config.js` is public by design: anyone can read it
from the site. It is safe because every table has Row Level Security switched on with no policies, so
the key can read or write nothing directly; all it can do is call the `SECURITY DEFINER` functions in
`setup.sql`, which check everything (the secret, the game, that the day is today's puzzle in Israel ±1
day, points 0–100, name lengths) and enforce limits (50 members a group, 20 groups a player, 5 new
groups a day, 30 join attempts an hour). Invite codes are six characters from 31 (no 0/O/1/I/L).

**Privacy.** Stored: the random id, the nickname if the player chooses one, and per game and day the
points, won/lost and the short result ("3/6"). No e-mail, phone, IP address or device details.
Nicknames are visible only to members of the same group; the "everyone" numbers are anonymous counts,
and shown only once five players have finished. "מחיקת הנתונים שלי" on the groups page deletes the
player and everything linked to them. There is no public leaderboard of strangers.

**Setting it up (once, about five minutes):**

1. Create a free project at supabase.com (any name; pick the region nearest Israel, e.g. Frankfurt).
2. In the project: **SQL Editor → New query**, paste the whole of `supabase/setup.sql`, press **Run**.
   It should end with "Success. No rows returned". Running it again later is safe.
3. **Project Settings → API** (or **API Keys**): copy the **Project URL** and the **anon public** key
   (on newer projects called the **publishable** key, `sb_publishable_…`). Never use the
   `service_role` / secret key.
4. Put them in `shared/config.js`: `export const BACKEND = { url: 'https://xxxx.supabase.co', key: '…' };`
5. `npm run build:sw`, then `npm test`, then deploy as usual.

To check the SQL without Supabase: `npm install --no-save @electric-sql/pglite && node supabase/check-sql.mjs`
runs `setup.sql` in an in-memory Postgres and exercises every function as the anon role. The browser
tests (`npm run test:e2e -- social`) use an in-memory copy of the API (`tests/mock-backend.mjs`),
served to the test browser only; the shipped config stays empty.

Free-tier notes: a Supabase project on the free plan is paused after a week with no requests; daily
players keep it awake, and a paused project only means the stats block says it could not load (the
games are unaffected and results wait in the queue for three days).

## Layout

| Path | Purpose |
|---|---|
| `index.html`, `shared/hub.js`, `shared/hub.css` | The hub: the games as sheets on a desk, with today's status, streak and a punch-card summary of the day |
| `shared/registry.js` | The list of games: slug, name, tagline, accent, epoch, test port, mark |
| `shared/base.css` | Design tokens (light and dark) and every reusable component style |
| `shared/core.js` | Pure helpers: Israel date, day numbers, countdown, seeded shuffle, daily pick, stats |
| `shared/ui.js` | DOM helpers: storage, header, dialogs, stats, end panel, sharing, countdown, toast |
| `shared/fx.js` | The motion and depth kit: tilt, flip, press, stamp, celebration, count-up, page transitions |
| `shared/emblems.js` | The seven layered game emblems |
| `brand/index.html` | The brand sheet: logo, colours, emblems, type, components and the motion kit, all live |
| `games/README.md` | **The contract for adding or changing a game**, and the reference for everything in `shared/` |
| `games/_template/` | A tiny complete game that uses every shared piece; copy it to start a new one |
| `games/<slug>/` | One directory per game: `index.html`, `style.css`, `app.js` (interface), `game.js` (rules, no DOM), data |
| `tests/<slug>.logic.test.mjs`, `tests/<slug>.e2e.mjs` | Tests per game; `shared.*`, `hub.*` and `site.*` cover the platform and the site as a whole |
| `tests/helpers.mjs`, `tests/run-e2e.mjs` | Browser-test plumbing and runner |
| `scripts/serve.mjs` | Static file server for development and tests |
| `scripts/build-assets.mjs` | Renders the PNG icons and the social preview image from `assets/icon.svg` and the registry |
| `groups/`, `shared/social.js`, `shared/social-ui.js`, `shared/config.js`, `supabase/` | Leaderboards and groups (see that section) |
| `sw.js`, `scripts/build-sw.mjs`, `scripts/sw-template.js` | Offline support: the generated service worker, its generator and its source |
| `shared/pwa.js`, `shared/hub-install.js` | Registers the service worker on every page; the hub's install card and iPhone how-to |
| `shared/fonts.css`, `assets/fonts/`, `scripts/build-fonts.mjs` | The bundled fonts (Heebo, Frank Ruhl Libre, Secular One; SIL Open Font License) and the script that fetches them |
| `assets/` | `icon.svg`, `icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `og.png`, `fonts/` |

Each game saves one JSON object in `localStorage` under `hd:<slug>`; the hub reads the standard
fields (`day`, `finished`, `won`, `summary`, `stats`) to show today's status. יותר או פחות also keeps
its best practice runs under `hd:yoter:best`.

## Refreshing the data

Everything shown as a fact comes from a named source, recorded in the data file and credited in the
game's footer. The data files are generated; never edit them by hand. All the scripts need network
access and Node 18 or later.

**Read this first:** the daily puzzle is picked by position in the data (a fixed shuffle, or the order
of a list). Rebuilding can add, drop or reorder entries and so change which puzzle falls on which
future day; it never changes a day that has already been played on a player's phone, but two players
who loaded the site before and after a rebuild may see different puzzles that day. Rebuild at a quiet
hour, deploy at once, and run `npm test` first: the logic tests check every generated file.

| Game | Source | How to refresh | Notes |
|---|---|---|---|
| `nekuda` | Wikidata: localities with an Israeli CBS code | `npm run build:data` (writes `games/nekuda/data.js`) | Changes the list of localities and therefore the order of future puzzles |
| `beerech` | Shufersal's public price file for one store (price-transparency law) | `node games/beerech/build-data.mjs` | **Prices go stale.** The footer shows the date they were read; refresh every month or two. The products are the hand-picked barcodes in `PICKS` in that script; add new ones at the end |
| `miani` | Written for this site; facts checked against Hebrew Wikipedia | Edit `games/miani/data.js` | A puzzle is known by its position: add new puzzles at the end, never reorder or delete |
| `blimilim` | Written for this site; years and credits checked against Hebrew Wikipedia | Edit `games/blimilim/data.js` | Same as מי אני? |
| `tzir` | Wikidata years for hand-curated events | Edit `games/tzir/candidates.mjs`, then `node games/tzir/build-data.mjs` | An event is kept only when Wikidata's year agrees with the curator's; the script prints what it dropped and why |
| `herkev` | Wikidata (countries, cast lists and awards, Israeli singers, localities with a CBS code, squad memberships), football kit colours from Wikipedia | `node games/herkev/build-data.mjs` (`--cache <dir>` keeps the raw answers, `--only countries,music` refetches some topics, `--grids-only` regenerates the grids from the data on disk) | Writes `data/<topic>.js` (one answer list per topic, loaded only on that topic's days) and `grids.js`; regenerating the grids changes every future day |
| `yoter` | Wikidata (and the locality list of `nekuda`) | `node games/yoter/build-data.mjs` | Run after `npm run build:data` if both are refreshed |
| icons, preview | `assets/icon.svg`, `shared/registry.js` | `npm run build:assets` | Needs Chrome |

## Browsers

Built for current iPhone Safari and Android Chrome; works in desktop Chrome, Firefox and Safari.

- The automated suite runs in Chrome only.
- WebKit and Firefox (the Playwright builds) were driven through the hub and a full game of each of the
  seven games, including double taps, reloads in the middle of an animation and keyboard play, with no
  errors. The Playwright WebKit build is the nearest thing to iPhone Safari that runs on Linux; it is
  not Safari on a phone.
- The site uses `<dialog>`, `color-mix()`, `dvh` units, `:has()` (one cosmetic rule) and individual
  transform properties: Safari 16.4 / iOS 16.4 and later, Chrome 111 and later, Firefox 121 and later.
  Older browsers are not supported and get no fallback.

## Known limitations

- **No sync.** Progress and statistics stay in one browser on one device (and so does the group
  identity: a second phone is a second player). Clearing site data, or
  private browsing, starts from zero (the games still work).
- **A puzzle belongs to the day the page was opened.** Someone who starts before midnight and finishes
  after it finishes yesterday's puzzle; the hub then shows today's as new. In נקודת ציון the page
  reloads at midnight instead, and an unfinished game from the day before is gone.
- **צומת accepts only what Wikidata knows.** Cast lists, genres, memberships and squad histories there
  are incomplete (and now and then wrong), so a true answer can be refused. The rules say so, and grids
  are chosen so that every cell has at least ten accepted answers.
- **בערך's prices are one store on one day**, without club or multi-buy discounts.
- **Share previews** need the absolute `og:image` described under "Deploy".
- **Tilt with the phone** (the small 3D lean of cards and emblems) works on Android Chrome only. iOS
  asks for permission before giving motion data and the site never asks; Firefox is skipped as well.
- **מי אני? and בלי מילים are hand-written.** Their facts, years and credits were checked against
  Hebrew Wikipedia, and their emoji are drawn by the player's phone, so they look a little different
  on each system.
- **Offline needs one online visit first.** The first visit caches the site; a phone that has never
  opened it online can't play offline. An installed copy picks up a new version on the next page it
  opens after the update reaches it, not instantly.
- **Share text direction.** The rows of emoji squares in a shared result have no letters, so a chat
  app may lay them out left to right. Nothing is given away either way; צומת's 3×3 grid may appear
  mirrored.

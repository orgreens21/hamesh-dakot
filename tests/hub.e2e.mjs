// End-to-end test for the hub page: the map of today's stops and the story deck.
import assert from 'node:assert/strict';
import { createSession, horizontalOverflow, shareToClipboard } from './helpers.mjs';
import { GAMES } from '../shared/registry.js';
import { dayNumber, israelDate } from '../shared/core.js';

const DAILY = GAMES.filter((g) => g.kind !== 'party');
const PARTY = GAMES.filter((g) => g.kind === 'party');
const STOPS = [...DAILY, ...PARTY]; // the map's order: the daily trail north to south, then the party stop
const session = await createSession({ slug: 'hub', port: 4187, path: '' });
const { open, step, shot } = session;

const DESKTOP = { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 };
const NARROW = { viewport: { width: 360, height: 640 } };
const today = (slug) => dayNumber(israelDate(), GAMES.find((g) => g.slug === slug).epoch);
const stats = (streak, day) => ({ played: 5, wins: 4, streak, maxStreak: 6, lastWinDay: day, lastPlayedDay: day, distribution: [0, 1, 2, 1, 0, 0] });

/** Writes stores the way the games do, then reloads. entries: { slug: savedObject | rawString } */
async function seed(page, entries) {
  await page.evaluate((list) => {
    localStorage.clear();
    for (const [slug, value] of list) localStorage.setItem('hd:' + slug, typeof value === 'string' ? value : JSON.stringify(value));
  }, Object.entries(entries));
  await page.reload();
}
const HALF_DAY = () => ({
  nekuda: { day: today('nekuda'), finished: true, won: true, summary: '3/6', stats: stats(4, today('nekuda')), progress: { guesses: ['a', 'b', 'c'] } },
  beerech: { day: today('beerech'), finished: false, won: false, stats: stats(2, today('beerech') - 1), progress: { guesses: [10] } },
  arba: { day: today('arba'), finished: true, won: false, summary: 'X/4', stats: stats(0, today('arba') - 3), progress: {} },
  tzir: { day: today('tzir') - 1, finished: true, won: true, summary: '5/5', stats: stats(1, today('tzir') - 1) },
  herkev: '{not json',
  mitchaze: { day: 1, finished: true, won: true },
});
const SUMMARIES = { nekuda: '3/6', beerech: 'בול!', arba: 'X/4', tzir: '5/5', herkev: '8/9', yoter: '7 מתוך 10' };
const FULL_DAY = () => Object.fromEntries(DAILY.map((g) => [g.slug, {
  day: today(g.slug), finished: true, won: g.slug !== 'arba', summary: SUMMARIES[g.slug], stats: stats(6, today(g.slug)), progress: { done: 1 },
}]));

const status = (page, slug) => page.locator(`.game[data-game="${slug}"]`).getAttribute('data-status');
const cardText = (page, slug) => page.locator(`.game[data-game="${slug}"] .game-card`).innerText();
const deckCard = (page) => page.locator('#deck').getAttribute('data-card');
const deckOpen = (page) => page.locator('#deck').evaluate((d) => d.open);
const bars = (page) => page.locator('#deck-bars li').evaluateAll((items) => items.map((li) => li.dataset.state));
const settle = (page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity));

/** Every label is inside the screen and clear of every other label, place sign and dot. */
async function labelsClear(page) {
  return page.evaluate(() => {
    const box = (el) => el.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const cards = [...document.querySelectorAll('.game-card')].map((el) => ({ slug: el.closest('.game').dataset.game, r: box(el) }));
    const others = [...document.querySelectorAll('.pin-place, .pin-dot')].map((el) => ({ slug: el.closest('.game').dataset.game, kind: el.className, r: box(el) }));
    const problems = [];
    for (const c of cards) {
      if (c.r.left < 0 || c.r.right > document.documentElement.clientWidth) problems.push(`${c.slug} leaves the screen`);
      for (const d of cards) if (c !== d && c.slug < d.slug && hit(c.r, d.r)) problems.push(`${c.slug} overlaps ${d.slug}`);
      for (const o of others) if (hit(c.r, o.r) && !(o.slug === c.slug && o.kind === 'pin-dot')) problems.push(`${c.slug} covers ${o.slug} ${o.kind}`);
    }
    return problems;
  });
}

/** Text contrast against what is really behind it (translucent backgrounds are blended down to an opaque one). */
async function lowContrast(page, root = 'body') {
  return page.evaluate((rootSel) => {
    const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
    const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    const background = (el) => {
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.a > 0) layers.push(c);
        if (c.a >= 1) break;
      }
      let out = { r: 255, g: 255, b: 255, a: 1 };
      for (const layer of layers.reverse()) out = over(layer, out);
      return out;
    };
    const lum = ({ r, g, b }) => [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const bad = [];
    const walker = document.createTreeWalker(document.querySelector(rootSel), NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!node.textContent.trim() || el.closest('svg, .visually-hidden, [hidden], noscript, script, style')) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || !el.getClientRects().length) continue;
      const fg = over(parse(style.color), background(el));
      const r = ratio(fg, background(el));
      if (r < 4.5) bad.push(`"${node.textContent.trim().slice(0, 24)}" ${r.toFixed(2)}:1`);
    }
    return bad;
  }, root);
}

await session.run(async () => {
  await step('a first visit: every game is a stop on the map, all new, the party game at the end', async () => {
    const { context, page } = await open();
    assert.equal(await page.locator('h1').innerText(), 'חמש דקות');
    assert.equal(await page.locator('#games .game').count(), GAMES.length);
    assert.deepEqual(await page.locator('.game').evaluateAll((li) => li.map((l) => l.dataset.game)), STOPS.map((g) => g.slug), 'trail order, party last');
    assert.deepEqual(await page.locator('.game-name').allInnerTexts(), STOPS.map((g) => g.name));
    assert.deepEqual(await page.locator('.game-link').evaluateAll((links) => links.map((a) => a.getAttribute('href'))), STOPS.map((g) => `games/${g.slug}/`));
    for (const g of GAMES) assert.equal(await status(page, g.slug), g.kind === 'party' ? 'party' : 'new', g.slug);
    for (const g of DAILY) assert.ok((await cardText(page, g.slug)).includes('חדש היום'), g.slug);
    assert.ok((await cardText(page, 'mitchaze')).includes('משחק חברה'), 'the party stop says what it is');
    assert.equal(await page.locator('.game[data-game="mitchaze"] .pin-badge').count(), 0, 'and has no daily result');
    assert.equal(await page.locator('.pin-badge').count(), 0);
    assert.equal(await page.locator('.game.is-next').getAttribute('data-game'), DAILY[0].slug, 'the first stop is next');
    assert.equal(await page.locator('#progress-text').innerText(), `0/${DAILY.length} היום`);
    assert.equal(await page.locator('#streak').isHidden(), true, 'no streak before there is one');
    assert.equal(await page.locator('#stories-label').innerText(), 'שחקו את חידות היום');
    assert.match(await page.locator('#dateline').innerText(), /\d+ ב/);
    assert.match(await page.locator('#countdown').innerText(), /^\d\d:\d\d:\d\d$/);
    assert.ok(await page.locator('#map-art .m-land').count() === 1 && await page.locator('#map-art .m-lake').count() === 2, 'the land and both lakes are drawn');
    assert.equal(await page.locator('#map-art .m-trail').count(), 1, 'the trail joins the stops');
    await settle(page);
    assert.deepEqual(await labelsClear(page), []);
    assert.equal(await horizontalOverflow(page), 0, 'no horizontal scroll');
    await shot(page, '01-hub-fresh');
    await shot(page, '01-hub-fresh-full', { fullPage: true, settle: 0 });
    await context.close();
  });

  await step('every stop on the map leads to its game', async () => {
    const { context, page } = await open();
    for (const g of STOPS) {
      await page.goto(session.root);
      await page.click(`.game[data-game="${g.slug}"] .game-link`);
      await page.waitForURL(`**/games/${g.slug}/`);
      assert.equal(await page.locator('.brand h1').innerText(), g.name);
    }
    await context.close();
  });

  await step('statuses and results come from each game\'s store', async () => {
    const { context, page } = await open();
    await seed(page, HALF_DAY());
    assert.equal(await status(page, 'nekuda'), 'won');
    assert.ok((await cardText(page, 'nekuda')).includes('נפתר') && (await cardText(page, 'nekuda')).includes('3/6'));
    assert.equal(await page.locator('.game[data-game="nekuda"] .pin-badge').count(), 1, 'a finished stop wears a badge');
    assert.equal(await status(page, 'beerech'), 'playing');
    assert.ok((await cardText(page, 'beerech')).includes('באמצע'));
    assert.equal(await status(page, 'arba'), 'lost');
    assert.ok((await cardText(page, 'arba')).includes('לא הפעם') && (await cardText(page, 'arba')).includes('X/4'));
    assert.equal(await status(page, 'tzir'), 'new', 'yesterday\'s result does not count for today');
    assert.equal(await status(page, 'herkev'), 'new', 'corrupted storage is ignored');
    assert.equal(await status(page, 'mitchaze'), 'party', 'the party game has no daily status');
    assert.equal(await page.locator('.game.is-next').getAttribute('data-game'), 'beerech', 'the first unfinished stop is next');
    const doneBg = await page.locator('.game[data-game="nekuda"] .game-card').evaluate((c) => getComputedStyle(c).backgroundColor);
    const newBg = await page.locator('.game[data-game="tzir"] .game-card').evaluate((c) => getComputedStyle(c).backgroundColor);
    assert.notEqual(doneBg, newBg, 'a finished stop changes colour');
    assert.equal(await page.locator('#progress-text').innerText(), `2/${DAILY.length} היום`);
    assert.equal(await page.locator('#streak').innerText(), 'רצף 4', 'the longest live streak');
    assert.equal(await page.locator('#stories-label').innerText(), 'המשיכו: בערך');
    await settle(page);
    assert.deepEqual(await labelsClear(page), []);
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '02-hub-half-day');
    await context.close();
  });

  await step('the story deck: opens on the first unplayed game and skips the finished ones', async () => {
    const { context, page } = await open();
    await seed(page, HALF_DAY());
    await page.click('#stories-btn');
    assert.equal(await deckOpen(page), true);
    assert.equal(await page.evaluate(() => document.getElementById('deck').contains(document.activeElement)), true, 'focus moves into the deck');
    assert.equal(await deckCard(page), 'beerech');
    assert.deepEqual(await bars(page), ['done', 'current', 'done', 'todo', 'todo', 'todo']);
    assert.ok((await page.locator('.story').innerText()).includes('בערך'));
    assert.equal(await page.locator('#story-start').innerText(), 'המשיכו לשחק', 'a game in progress is continued');
    assert.equal(await page.locator('#deck-prev').isDisabled(), true);
    assert.equal(await page.locator('#deck-hint').innerText(), 'הבא בתור: על הציר');
    await shot(page, '03-deck');

    await page.click('#deck-next');
    assert.equal(await deckCard(page), 'tzir', 'the next button skips nothing unfinished');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await deckCard(page), 'herkev', 'ArrowLeft is forward, right to left');
    await page.keyboard.press('ArrowRight');
    assert.equal(await deckCard(page), 'tzir', 'ArrowRight goes back');

    // Tap the left third of the card: forward. The right third: back.
    const stage = await page.locator('#deck-stage').boundingBox();
    await page.touchscreen.tap(stage.x + stage.width * 0.12, stage.y + stage.height * 0.3);
    assert.equal(await deckCard(page), 'herkev', 'a tap on the left side moves forward');
    await page.touchscreen.tap(stage.x + stage.width * 0.88, stage.y + stage.height * 0.3);
    assert.equal(await deckCard(page), 'tzir', 'a tap on the right side moves back');

    // Swipe: dragging to the right brings the next card in from the left.
    const swipe = async (from, to) => {
      const y = stage.y + stage.height * 0.4;
      await page.mouse.move(stage.x + stage.width * from, y);
      await page.mouse.down();
      await page.mouse.move(stage.x + stage.width * ((from + to) / 2), y, { steps: 3 });
      await page.mouse.move(stage.x + stage.width * to, y, { steps: 3 });
      await page.mouse.up();
    };
    await swipe(0.3, 0.8);
    assert.equal(await deckCard(page), 'herkev', 'a swipe to the right moves forward');
    await swipe(0.8, 0.3);
    assert.equal(await deckCard(page), 'tzir', 'a swipe to the left moves back');
    await page.click('#deck-next');
    await page.click('#deck-next');
    assert.equal(await deckCard(page), 'yoter');
    assert.equal(await page.locator('#deck-next').isDisabled(), true, 'the last unplayed game is the end of the deck');

    // The keyboard stays inside the deck, and Escape returns it to the button that opened it.
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.getElementById('deck').contains(document.activeElement)), true, `Tab ${i + 1} stays in the deck`);
    }
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.getElementById('deck').contains(document.activeElement)), true);
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none', 'focus is visible in the deck');
    await page.keyboard.press('Escape');
    assert.equal(await deckOpen(page), false, 'Escape closes the deck');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'stories-btn', 'focus goes back to the button');

    // The close button works too.
    await page.click('#stories-btn');
    await page.click('#deck-close');
    assert.equal(await deckOpen(page), false);
    await context.close();
  });

  await step('a story starts its game, and finishing it brings the next story back', async () => {
    const { context, page } = await open();
    await seed(page, HALF_DAY());
    await page.click('#stories-btn');
    await page.click('#story-start');
    await page.waitForURL('**/games/beerech/');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('hd:hub-run')), 'beerech');

    // Coming back without finishing: just the map.
    await page.goto(session.root);
    assert.equal(await deckOpen(page), false, 'an unfinished game does not push the next one');

    // Start again, finish (as the game would save it), and come back with the browser's back button.
    await page.click('#stories-btn');
    await page.click('#story-start');
    await page.waitForURL('**/games/beerech/');
    await page.evaluate((day) => {
      const saved = JSON.parse(localStorage.getItem('hd:beerech'));
      localStorage.setItem('hd:beerech', JSON.stringify({ ...saved, day, finished: true, won: true, summary: 'בול!' }));
    }, today('beerech'));
    await page.goBack();
    await page.waitForURL(session.root);
    await page.waitForFunction(() => document.getElementById('deck').open);
    assert.equal(await deckCard(page), 'tzir', 'the next unplayed story is offered');
    assert.ok((await page.locator('#deck-intro').innerText()).includes('סיימתם את בערך'));
    assert.equal(await status(page, 'beerech'), 'won', 'and the map behind it caught up');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('hd:hub-run')), null, 'the offer is made once');
    await shot(page, '04-deck-next');
    await page.keyboard.press('Escape');

    // The same offer by address, for any link that wants to resume the day.
    await page.goto(session.root + '?next=1');
    assert.equal(await deckOpen(page), true);
    assert.equal(await deckCard(page), 'tzir');
    assert.equal(new URL(page.url()).search, '', 'the address is cleaned so a reload does not reopen it');
    await context.close();
  });

  await step('a finished day: the map is all done, the deck sums it up and shares it', async () => {
    const { context, page } = await open();
    await seed(page, FULL_DAY());
    for (const g of DAILY) {
      assert.equal(await status(page, g.slug), g.slug === 'arba' ? 'lost' : 'won', g.slug);
      assert.ok((await cardText(page, g.slug)).includes(SUMMARIES[g.slug]), g.slug);
    }
    assert.equal(await page.locator('.game.is-next').count(), 0, 'nothing left to bob');
    assert.equal(await page.locator('#progress-text').innerText(), `${DAILY.length}/${DAILY.length} היום`);
    assert.equal(await page.locator('#stories-label').innerText(), 'סיכום היום ושיתוף');
    await settle(page);
    assert.deepEqual(await labelsClear(page), []);
    await shot(page, '05-hub-done');
    await page.click('#stories-btn');
    assert.equal(await deckCard(page), 'done');
    assert.deepEqual(await bars(page), DAILY.map(() => 'done'));
    assert.deepEqual(await page.locator('#day-results li').evaluateAll((li) => li.map((l) => l.dataset.game)), DAILY.map((g) => g.slug));
    assert.match(await page.locator('#deck-countdown').innerText(), /^\d\d:\d\d:\d\d$/);
    const text = await shareToClipboard(page, '#day-share');
    const lines = text.split('\n');
    assert.match(lines[0], /^חמש דקות · \d+ ב\S+ \d{4}$/, lines[0]);
    assert.equal(lines[1], `${DAILY.length}/${DAILY.length} חידות היום`);
    DAILY.forEach((g, i) => assert.equal(lines[2 + i], `${g.slug === 'arba' ? '✗' : '✓'} ${g.name}: ${SUMMARIES[g.slug]}`));
    assert.equal(lines.at(-1), session.root, 'the link to the hub');
    assert.equal(lines.length, DAILY.length + 3, 'nothing else: no answers');
    assert.ok(decodeURIComponent(await page.locator('#day-whatsapp').getAttribute('href')).includes(lines[1]));
    await shot(page, '06-deck-done');
    await context.close();
  });

  await step('narrow phone and dark mode: labels stay clear, nothing scrolls sideways', async () => {
    for (const [name, options] of [['07-narrow-light', NARROW], ['08-narrow-dark', { ...NARROW, colorScheme: 'dark' }], ['09-dark', { colorScheme: 'dark' }]]) {
      const { context, page } = await open(options);
      for (const [label, entries] of [['fresh', {}], ['half', HALF_DAY()], ['done', FULL_DAY()]]) {
        await seed(page, entries);
        await settle(page);
        assert.deepEqual(await labelsClear(page), [], `${name} ${label}`);
        assert.equal(await horizontalOverflow(page), 0, `${name} ${label}: no horizontal scroll`);
      }
      await shot(page, name, { fullPage: true });
      await page.click('#stories-btn');
      const story = await page.locator('.story').boundingBox();
      assert.ok(story.y + story.height <= (options.viewport?.height ?? 844), 'the deck fits the screen');
      assert.equal(await page.locator('#day-share').evaluate((b) => b.getBoundingClientRect().bottom <= innerHeight), true, 'the share button is on screen');
      await shot(page, name + '-deck');
      await context.close();
    }
    const { context, page } = await open(DESKTOP);
    await seed(page, HALF_DAY());
    await settle(page);
    assert.deepEqual(await labelsClear(page), []);
    await shot(page, '10-desktop');
    await context.close();
  });

  await step('text contrast is at least 4.5:1 on the map and in the deck, light and dark', async () => {
    for (const colorScheme of ['light', 'dark']) {
      const { context, page } = await open({ colorScheme });
      await seed(page, HALF_DAY());
      await settle(page);
      assert.deepEqual(await lowContrast(page), [], `${colorScheme}: the page`);
      await page.click('#stories-btn');
      await settle(page);
      assert.deepEqual(await lowContrast(page, '#deck'), [], `${colorScheme}: a story`);
      await page.keyboard.press('Escape');
      await seed(page, FULL_DAY());
      await page.click('#stories-btn');
      assert.deepEqual(await lowContrast(page, '#deck'), [], `${colorScheme}: the day's summary`);
      await context.close();
    }
  });

  await step('keyboard: the button first, then every stop in trail order, with a visible focus', async () => {
    const { context, page } = await open(DESKTOP);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'stories-btn');
    for (const g of STOPS) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.closest('.game')?.dataset.game), g.slug);
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none', 'focus is visible');
    }
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await page.waitForURL(`**/games/${STOPS.at(-2).slug}/`);
    await context.close();
  });

  await step('with reduced motion nothing animates, and the deck still works', async () => {
    const { context, page } = await open({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.game').first().evaluate((li) => getComputedStyle(li).animationName), 'none');
    assert.equal(await page.locator('.game.is-next .game-link').evaluate((a) => getComputedStyle(a).animationName), 'none', 'no bob');
    assert.equal(await page.locator('#map-art').evaluate((s) => s.classList.contains('is-drawing')), false, 'the trail is drawn at once');
    await shot(page, '11-reduced-motion', { settle: 0 });
    await page.click('#stories-btn');
    await page.click('#deck-next');
    assert.equal(await page.locator('.story').evaluate((s) => getComputedStyle(s).animationName), 'none', 'cards do not slide');
    await context.close();
  });

  await step('the brand sheet shows the live tokens, the emblems and the motion kit', async () => {
    const { context, page } = await open({ viewport: { width: 360, height: 640 } }, 'brand/');
    await page.waitForSelector('#swatches .swatch');
    assert.ok(await page.locator('#swatches .swatch').count() >= 12, 'colour tokens are read from base.css');
    assert.equal(await page.locator('#accents .emblem').count(), GAMES.length);
    assert.equal(await horizontalOverflow(page), 0, 'no horizontal scroll at 360px');

    // The shared end panel: both buttons keep their label on one line at 360px.
    for (const id of ['#share-btn', '#whatsapp-btn']) {
      const button = page.locator(id);
      await button.scrollIntoViewIfNeeded();
      const { height, lineHeight, fits } = await button.evaluate((b) => ({ height: b.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(b).lineHeight), fits: b.scrollWidth <= b.clientWidth }));
      assert.ok(height <= 52 && fits, `${id} is one line (height ${height}, line ${lineHeight})`);
    }
    await shot(page, '12-brand-end-panel-360');

    await page.click('#demo-flip');
    assert.equal(await page.locator('#demo-flip').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#demo-flip').evaluate((b) => b.classList.contains('is-flipped')), true);
    await page.click('#demo-stamp');
    assert.equal(await page.locator('#demo-stamp-pad .fx-stamp').count(), 1);
    assert.equal(await page.locator('#demo-stamp-pad .fx-stamp').getAttribute('data-tone'), 'ink', 'the second press stamps the second tone');
    await page.click('#demo-count-btn');
    assert.equal(await page.locator('#demo-count').getAttribute('data-value'), '87', 'the final value is there from the start');
    await page.waitForFunction(() => document.getElementById('demo-count').textContent === '87');
    await page.click('#demo-celebrate');
    await page.waitForSelector('canvas.fx-confetti', { state: 'attached' });
    await page.waitForSelector('canvas.fx-confetti', { state: 'detached' });
    await page.click('#demo-enter-btn');
    await context.close();
  });
});

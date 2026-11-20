// End-to-end test for על הציר.
// Usage: node tests/tzir.e2e.mjs   (or: npm run test:e2e -- tzir)
import assert from 'node:assert/strict';
import { createSession, horizontalOverflow, shareToClipboard, isDialogOpen, readStore } from './helpers.mjs';
import * as G from '../games/tzir/game.js';
import { dayNumber, israelDate } from '../shared/core.js';

const session = await createSession({ slug: 'tzir', port: 4184 });
const { open, step, shot } = session;

const byText = new Map(G.EVENTS.map((e) => [e.text, e]));
const shownYears = (page) => page.locator('#timeline .event .year').allInnerTexts().then((ys) => ys.map(Number));
const statNumbers = async (page) => {
  await page.click('#stats-btn');
  const numbers = await page.locator('.stat-grid b').allInnerTexts();
  await page.keyboard.press('Escape');
  return numbers;
};

/** Reads the event in hand and the years on screen, and returns the gap it belongs in plus a gap it does not. */
async function gapsFor(page) {
  // Right after a move the timeline takes no taps for a moment (the double-tap guard); wait it out.
  await page.locator('#timeline:not([data-settling])').waitFor();
  const event = byText.get(await page.locator('#card-text').innerText());
  assert.ok(event, 'the card shows a known event');
  const years = await shownYears(page);
  const right = years.filter((y) => y < event.year).length;
  return { event, right, wrong: (right + 1) % (years.length + 1), count: years.length + 1 };
}

/** Plays one event with a tap, correctly or not, and waits for the timeline to grow. */
async function move(page, correct = true) {
  const { event, right, wrong, count } = await gapsFor(page);
  assert.equal(await page.locator('#timeline .gap-btn').count(), count, 'one gap before, between and after every event');
  await page.locator('#timeline .gap-btn').nth(correct ? right : wrong).tap();
  await page.locator('#timeline .event').nth(count - 1).waitFor();
  return event;
}
const playAll = async (page, marks) => { for (const ok of marks) await move(page, ok); };

await session.run(async () => {
  const today = dayNumber(israelDate());
  const puzzle = G.puzzleForDay(today);

  await step('first visit shows the rules once, then one dated event and the first card', async () => {
    const { context, page } = await open();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true);
    assert.equal(await page.locator('#help-dialog .emblem[data-emblem="tzir"]').count(), 1, 'the rules carry the game emblem');
    await shot(page, '01-help');
    await page.click('#help-close');
    assert.equal(await page.locator('.brand h1').innerText(), G.NAME);
    assert.ok((await page.locator('#puzzle-label').innerText()).includes(`חידה ${today}`));
    assert.deepEqual(await shownYears(page), [puzzle.anchor.year]);
    assert.equal(await page.locator('#timeline .event .text').innerText(), puzzle.anchor.text);
    assert.equal(await page.locator('#card-text').innerText(), puzzle.queue[0].text);
    assert.equal(await page.locator('#timeline .gap-btn').count(), 2);
    assert.equal(await page.locator('#progress').innerText(), 'אירוע 1 מתוך 6');
    assert.equal(await page.locator('#lives').getAttribute('aria-label'), 'חיים: 3 מתוך 3');
    assert.equal(await page.locator('#end').isHidden(), true);
    assert.ok(!(await page.locator('main').innerText()).includes(String(puzzle.queue[0].year)), 'the year of the card is hidden');
    assert.equal((await readStore(page, 'tzir')).progress, null, 'no progress before the first move');
    assert.ok((await page.locator('.foot').innerText()).includes('Wikidata'));
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '02-start');
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), false, 'rules are shown only once');
    await context.close();
  });

  await step('perfect game: years revealed, saved after every move, share, stats, reload', async () => {
    const { context, page } = await open();
    await page.click('#help-close');
    const first = await move(page, true);
    assert.ok((await shownYears(page)).includes(first.year), 'a correct placement reveals its year');
    assert.equal(await page.locator('#timeline .event.right').count(), 1);
    assert.equal(await page.locator('#timeline .event.just.right .year').innerText(), String(first.year), 'the card just placed is the one that drops in and gets its year stamped');
    assert.equal(await page.locator('#feedback').innerText(), `האירוע הקודם: נכון, ${first.year}`);
    let saved = await readStore(page, 'tzir');
    assert.deepEqual([saved.day, saved.finished, saved.progress.results], [today, false, [true]]);

    await playAll(page, [true, true]);
    await shot(page, '03-midgame');
    await page.reload(); // mid-game reload keeps the timeline, the lives and the card
    assert.equal(await page.locator('#timeline .event').count(), 4);
    assert.equal(await page.locator('#progress').innerText(), 'אירוע 4 מתוך 6');
    assert.equal(await page.locator('#card-text').innerText(), puzzle.queue[3].text);

    await playAll(page, [true, true, true]);
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#end-title').innerText(), 'ציר מושלם!');
    assert.ok((await page.locator('#end-sub').innerText()).includes('6 מתוך 6'));
    assert.match(await page.locator('#countdown').innerText(), /^\d\d:\d\d:\d\d$/);
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').innerText(), '6/6', 'the score is stamped on the end sheet');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').getAttribute('data-tone'), 'found');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp.fx-stamp-in').count(), 1, 'the stamp slams down when the game ends');
    assert.equal(await page.locator('#dock').isHidden(), true);
    assert.equal(await page.locator('#timeline .gap-btn').count(), 0);
    const sorted = [puzzle.anchor, ...puzzle.queue].map((e) => e.year).sort((a, b) => a - b);
    assert.deepEqual(await shownYears(page), sorted, 'the finished timeline is in order');

    const copied = await shareToClipboard(page);
    assert.equal(copied, `${G.NAME} #${today} 6/6\n🟩🟩🟩🟩🟩🟩\n${session.url}`);
    for (const e of [puzzle.anchor, ...puzzle.queue]) assert.ok(!copied.includes(String(e.year)) && !copied.includes(e.text), 'share text has no spoilers');
    const wa = await page.locator('#whatsapp-btn').getAttribute('href');
    assert.ok(wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes('6/6'));
    await shot(page, '04-perfect', { fullPage: true });

    saved = await readStore(page, 'tzir');
    assert.deepEqual([saved.day, saved.finished, saved.won, saved.summary, saved.seenHelp], [today, true, true, '6/6', true]);
    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);
    await page.click('#stats-btn');
    assert.equal(await page.locator('#dist .bar.today').innerText(), '1');
    assert.equal(await page.locator('#dist li').first().locator('.bar.today').count(), 1, 'a perfect game lands in the first bar');
    await shot(page, '05-stats');
    await page.keyboard.press('Escape');

    await page.reload(); // a finished game survives a reload and is not counted twice
    assert.equal(await page.locator('#end-title').innerText(), 'ציר מושלם!');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').innerText(), '6/6');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp.fx-stamp-in').count(), 0, 'a finished game opened again is already stamped');
    assert.equal(await page.locator('.fx-confetti').count(), 0, 'and does not celebrate again');
    assert.deepEqual(await shownYears(page), sorted);
    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);
    await context.close();
  });

  await step('game lost on lives (dark): mistakes cost lives, the event moves to its place, full answer shown', async () => {
    const { context, page } = await open({ colorScheme: 'dark' });
    await page.click('#help-close');
    const missed = await move(page, false);
    assert.equal(await page.locator('#lives').getAttribute('aria-label'), 'חיים: 2 מתוך 3');
    assert.equal(await page.locator('#feedback').innerText(), `האירוע הקודם: טעות. זה קרה ב-${missed.year}, והוא עבר למקומו`);
    assert.equal(await page.locator('#timeline .event.wrong').count(), 1);
    // The misplaced card starts where it was dropped and slides to its place: the offset is not zero.
    const slide = await page.locator('#timeline .event.just.wrong').evaluate((row) => parseInt(row.style.getPropertyValue('--from-y'), 10));
    assert.ok(Number.isFinite(slide) && slide !== 0, `the wrong card slides along the rail (${slide}px)`);
    assert.equal(await page.locator('#lives svg.lost').count(), 1, 'the heart that was just lost is marked');
    assert.equal(await page.locator('#timeline .gap-btn.missed-here').count(), 1, 'the gap that was picked is marked');
    const years = await shownYears(page);
    assert.deepEqual(years, [...years].sort((a, b) => a - b), 'a wrongly placed event still lands in order');
    await move(page, true);
    await shot(page, '06-miss-dark');
    await move(page, false);
    await page.reload(); // lives survive a reload
    assert.equal(await page.locator('#lives').getAttribute('aria-label'), 'חיים: 1 מתוך 3');
    await move(page, false);

    assert.equal(await page.locator('#end-title').innerText(), 'נגמרו החיים');
    assert.ok((await page.locator('#end-sub').innerText()).includes('1 מתוך 6'));
    assert.equal(await page.locator('#timeline .event').count(), 7, 'the full timeline is shown');
    assert.equal(await page.locator('#timeline .event.missed').count(), 2);
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').innerText(), '1/6');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').getAttribute('data-tone'), 'ink', 'a lost game is stamped in plain ink');
    assert.equal(await page.locator('.fx-confetti').count(), 0, 'no celebration for a loss');
    assert.deepEqual(await shownYears(page), [puzzle.anchor, ...puzzle.queue].map((e) => e.year).sort((a, b) => a - b));
    assert.equal(await shareToClipboard(page), `${G.NAME} #${today} 1/6\n🟥🟩🟥🟥⬜⬜\n${session.url}`);
    const saved = await readStore(page, 'tzir');
    assert.deepEqual([saved.finished, saved.won, saved.summary], [true, false, '1/6']);
    assert.deepEqual(await statNumbers(page), ['1', '0', '0', '0']);
    await shot(page, '07-lost-dark', { fullPage: true });
    await context.close();
  });

  await step('practice is unlimited and never counted; the daily game is untouched', async () => {
    const { context, page } = await open();
    await page.click('#help-close');
    await move(page, true); // one daily move, then wander off to practise
    await page.click('#practice-link');
    assert.equal(await page.locator('#mode-banner').isVisible(), true);
    assert.equal(await page.locator('#puzzle-label').innerText(), 'סיבוב אימון');
    assert.equal(await page.locator('#timeline .event').count(), 1);
    await playAll(page, [true, false, true, true, true, true]);
    assert.equal(await page.locator('#end-title').innerText(), 'כמעט מושלם!');
    assert.equal(await page.locator('#share-btn').count(), 0);
    assert.equal(await page.locator('#countdown').count(), 0);
    await shot(page, '08-practice-end', { fullPage: true });
    await page.click('#practice-btn'); // and again, straight away
    assert.equal(await page.locator('#timeline .event').count(), 1);
    await playAll(page, [false, false, false]);
    assert.equal(await page.locator('#end-title').innerText(), 'נגמרו החיים');

    await page.click('#mode-banner button');
    assert.equal(await page.locator('#timeline .event').count(), 2, 'back in the daily game where it was left');
    assert.ok((await page.locator('#puzzle-label').innerText()).includes(`חידה ${today}`));
    const saved = await readStore(page, 'tzir');
    assert.deepEqual([saved.finished, saved.progress.results, saved.stats.played], [false, [true], 0]);
    assert.deepEqual(await statNumbers(page), ['0', '0', '0', '0'], 'practice is not counted');
    await context.close();
  });

  await step('a new day clears the timeline and keeps the streak', async () => {
    const { context, page } = await open({ fixedTime: new Date('2026-12-01T10:00:00Z') });
    const day = dayNumber('2026-12-01');
    await page.click('#help-close');
    assert.equal(await page.locator('#timeline .event .text').innerText(), G.puzzleForDay(day).anchor.text);
    await playAll(page, [true, true, false, true, true, true]);
    assert.equal(await page.locator('#end-title').innerText(), 'כמעט מושלם!');
    assert.equal(await page.locator('#end-streak').count(), 0, 'no streak line on the first win');

    await page.clock.setFixedTime(new Date('2026-12-02T10:00:00Z'));
    await page.reload();
    assert.equal(await page.locator('#end').isHidden(), true);
    assert.equal(await page.locator('#timeline .event').count(), 1, "yesterday's timeline is gone");
    assert.equal(await page.locator('#timeline .event .text').innerText(), G.puzzleForDay(day + 1).anchor.text);
    assert.equal((await readStore(page, 'tzir')).day, day, 'nothing is written until the first move');
    await playAll(page, [true, true, true, true, true, true]);
    assert.ok((await page.locator('#end-streak').innerText()).includes('2'));
    assert.deepEqual(await statNumbers(page), ['2', '100', '2', '2']);
    const saved = await readStore(page, 'tzir');
    assert.deepEqual([saved.day, saved.summary, saved.stats.distribution], [day + 1, '6/6', [1, 1, 0]]);
    await context.close();
  });

  await step('narrow phone: a full timeline scrolls under the pinned card, with thumb-sized targets', async () => {
    const { context, page } = await open({ viewport: { width: 360, height: 640 } });
    await page.click('#help-close');
    await playAll(page, [true, true, true, true, true]); // six events on the timeline, one in hand
    assert.equal(await horizontalOverflow(page), 0, 'no horizontal scroll at 360px');
    const sizes = await page.locator('#timeline .gap-btn').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return [r.width, r.height]; }));
    assert.equal(sizes.length, 7);
    for (const [w, h] of sizes) assert.ok(w >= 300 && h >= 44, `gap target ${w}×${h}`);
    await shot(page, '09-narrow-full');

    // Scroll to the very end: the card must still be in view, and the last gap must be tappable below it.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const card = await page.locator('#card').boundingBox();
    assert.ok(card.y >= 0 && card.y + card.height <= 640, 'the card stays pinned while the timeline scrolls');
    const lastGap = await page.locator('#timeline .gap-btn').last().boundingBox();
    assert.ok(lastGap.y >= card.y + card.height && lastGap.y + lastGap.height <= 640, 'the last gap is reachable under the card');
    await shot(page, '10-narrow-scrolled');
    await move(page, true);
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '11-narrow-end-dark-off');
    await context.close();

    const dark = await open({ viewport: { width: 360, height: 640 }, colorScheme: 'dark' });
    await dark.page.click('#help-close');
    await playAll(dark.page, [true, false, true]);
    assert.equal(await horizontalOverflow(dark.page), 0);
    await shot(dark.page, '12-narrow-dark');
    await dark.context.close();
  });

  await step('a double tap places one event, and the next tap counts again once the timeline has settled', async () => {
    const { context, page } = await open();
    await page.click('#help-close');
    // Both taps arrive before the page can draw anything in between: the second half of a double tap.
    await page.evaluate(() => { const gap = document.querySelector('#timeline .gap-btn'); gap.click(); document.querySelector('#timeline .gap-btn').click(); });
    assert.equal(await page.locator('#timeline').getAttribute('data-settling'), 'true');
    assert.equal(await page.locator('#timeline .event').count(), 2, 'one event was placed, not two');
    assert.equal((await readStore(page, 'tzir')).progress.results.length, 1);
    assert.ok((await page.locator('#progress').innerText()).includes('2 מתוך'), 'the second event is still in hand');
    await move(page);
    assert.equal((await readStore(page, 'tzir')).progress.results.length, 2, 'a deliberate tap a moment later is taken');
    // Starting a practice round lifts the guard at once: the new board must not swallow its first tap.
    await page.click('#practice-link');
    assert.equal(await page.locator('#timeline').getAttribute('data-settling'), null);
    await context.close();
  });

  await step('desktop: keyboard play, drag and drop, corrupted storage', async () => {
    const { context, page } = await open({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    await page.evaluate(() => localStorage.setItem('hd:tzir', '{not json'));
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true, 'recovers from corrupted storage');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#timeline .event').count(), 1);

    // Keyboard: focus a gap, walk with the arrows, place with Enter; focus stays on the timeline.
    let g = await gapsFor(page);
    await page.locator('#timeline .gap-btn').first().focus();
    for (let i = 0; i < g.right; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#timeline .event.right').count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement.className.includes('gap-btn')), true, 'focus returns to a gap');

    // Drag the card onto the right gap.
    g = await gapsFor(page);
    const card = await page.locator('#card').boundingBox();
    const target = await page.locator('#timeline .gap-btn').nth(g.right).boundingBox();
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    await page.mouse.down();
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2 + 30, { steps: 3 });
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
    await page.waitForFunction((i) => document.querySelectorAll('#timeline .gap-btn')[i].classList.contains('over'), g.right);
    assert.equal(await page.locator('.card.ghost').count(), 1);
    await shot(page, '13-desktop-drag', { settle: 100 });
    await page.mouse.up();
    assert.equal(await page.locator('#timeline .event.right').count(), 2, 'dropping on the right gap places the event');
    assert.equal(await page.locator('.card.ghost').count(), 0);

    // Letting go over the card itself cancels: nothing is placed, no life is lost.
    await page.mouse.move(card.x + 40, card.y + 20);
    await page.mouse.down();
    await page.mouse.move(card.x + 70, card.y + 30, { steps: 4 });
    await page.mouse.up();
    assert.equal(await page.locator('#timeline .event').count(), 3);
    assert.equal(await page.locator('#lives').getAttribute('aria-label'), 'חיים: 3 מתוך 3');
    assert.deepEqual((await readStore(page, 'tzir')).progress.results, [true, true]);

    // Junk in progress is ignored rather than trusted.
    await page.evaluate((day) => localStorage.setItem('hd:tzir', JSON.stringify({ day, progress: { results: [true, 'x', 7] }, seenHelp: true })), today);
    await page.reload();
    assert.equal(await page.locator('#timeline .event').count(), 2);
    await shot(page, '14-desktop');
    await context.close();
  });
});

// End-to-end test: drives the real page in Chrome at phone size.
// Usage: node tests/nekuda.e2e.mjs   (set CHROME_PATH if Chrome is not at /usr/bin/google-chrome)
import assert from 'node:assert/strict';
import { createSession } from './helpers.mjs';
import { LOCALITIES } from '../games/nekuda/data.js';
import * as G from '../games/nekuda/game.js';

const session = await createSession({ slug: 'nekuda', port: 4179 });
const { open, step } = session;
const URL_BASE = session.url;
const SHOTS = session.shots;
const all = LOCALITIES.map(G.toLocality);
const pool = G.buildTargetPool(all);
const todayTarget = () => G.targetForDay(pool, G.dayNumber(G.israelDate()));
const wrongNames = (target, n) => ['חיפה', 'אילת', 'באר שבע', 'ירושלים', 'טבריה', 'נתניה', 'אשדוד'].filter((x) => x !== target.name).slice(0, n);

async function guess(page, name) {
  await page.fill('#guess-input', name);
  await page.locator('#suggestions li', { hasText: name }).first().dispatchEvent('mousedown');
}

await session.run(async () => {
  const target = todayTarget();

  await step('first visit shows the rules, then an empty board', async () => {
    const { context, page } = await open();
    assert.equal(await page.locator('#help-dialog').evaluate((d) => d.open), true);
    await page.screenshot({ path: SHOTS + '01-help.png' });
    await page.click('#help-close');
    assert.equal(await page.locator('#help-dialog').evaluate((d) => d.open), false);
    assert.equal(await page.locator('.guess.empty').count(), 6);
    assert.equal(await page.locator('#end').isHidden(), true);
    assert.ok((await page.locator('#map .bg circle').count()) > 1000);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, 'no horizontal scroll');
    await page.reload();
    assert.equal(await page.locator('#help-dialog').evaluate((d) => d.open), false, 'rules are shown only once');
    await context.close();
  });

  await step('winning game: clues, hints, map, share, stats, persistence', async () => {
    const { context, page } = await open();
    await page.click('#help-close');
    const [first, second] = wrongNames(target, 2);

    await page.fill('#guess-input', first.slice(0, 3));
    await page.screenshot({ path: SHOTS + '02-autocomplete.png' });
    assert.ok((await page.locator('#suggestions li').count()) >= 1);
    await guess(page, first);
    const expected = G.evaluateGuess(all.find((l) => l.name === first), target);
    assert.equal(await page.locator('.guess.filled').count(), 1);
    // The distance counts up like an odometer; its final value is in data-value from the first frame.
    assert.equal(await page.locator('.guess.filled .km .num').getAttribute('data-value'), String(expected.km));
    await page.waitForFunction((km) => document.querySelector('.guess.filled .km .num').textContent === km, String(expected.km));
    assert.ok((await page.locator('.guess.filled .km').innerText()).startsWith(String(expected.km)));
    assert.equal(await page.locator('.guess.upnext').count(), 1, 'the next empty line is marked');
    assert.ok((await page.locator('.guess.filled .arrow svg').getAttribute('style')).includes(`rotate(${Math.round(expected.deg)}deg)`));
    assert.equal(await page.locator('#map .ring.latest').count(), 1);
    assert.equal(await page.locator('#map .ring.latest.shown.fresh').count(), 1, 'the new ring is swept in');
    assert.equal(await page.locator('#map .sweep').count(), 1);
    assert.equal(await page.locator('#hints li.open').count(), 0);
    assert.equal(await page.inputValue('#guess-input'), '');

    await guess(page, first); // duplicate
    assert.equal(await page.locator('.guess.filled').count(), 1, 'duplicate guess is ignored');
    assert.ok((await page.locator('#toast').innerText()).includes('כבר ניחשתם'));

    await page.fill('#guess-input', 'זזזזזז');
    assert.ok((await page.locator('#suggestions').innerText()).includes('לא מצאנו'));
    await page.press('#guess-input', 'Enter');
    assert.equal(await page.locator('.guess.filled').count(), 1, 'free text is not a guess');

    await page.fill('#guess-input', second);
    await page.press('#guess-input', 'Enter'); // keyboard path picks the top suggestion
    assert.equal(await page.locator('.guess.filled').count(), 2);
    assert.equal(await page.locator('#hints li.open').count(), 1);
    assert.equal(await page.locator('#hints li.open b').innerText(), G.TYPE_LABELS[target.type]);
    assert.equal(await page.locator('#hints li.open.fresh').count(), 1, 'the hint that just opened turns over');

    // Tapping an earlier entry's compass brings its range ring back to the map; again returns to the latest.
    const dials = page.locator('.guess.filled button.arrow');
    assert.deepEqual(await dials.evaluateAll((list) => list.map((b) => b.getAttribute('aria-pressed'))), ['false', 'true']);
    assert.equal(await page.locator('#map .ring.shown.latest').count(), 1);
    await dials.first().click();
    assert.deepEqual(await dials.evaluateAll((list) => list.map((b) => b.getAttribute('aria-pressed'))), ['true', 'false']);
    assert.equal(await page.locator('#map .ring').count(), 2);
    assert.equal(await page.locator('#map .ring.shown:not(.latest)').count(), 1);
    assert.ok((await dials.first().getAttribute('aria-label')).includes(first));
    await dials.first().press('Enter'); // the same from the keyboard, and focus stays on the compass
    assert.equal(await page.locator('#map .ring.shown.latest').count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('arrow')), true);
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOTS + '03-midgame.png' });

    await page.reload(); // mid-game progress survives a reload
    assert.equal(await page.locator('.guess.filled').count(), 2);

    await guess(page, target.name);
    assert.equal(await page.locator('.guess.win').count(), 1);
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.ok((await page.locator('#end-sub').innerText()).includes(target.name));
    assert.ok((await page.locator('#end-sub').innerText()).includes('3 ניחושים'));
    assert.equal(await page.locator('#guess-input').isDisabled(), true);
    assert.equal(await page.locator('#map .target').count(), 1);
    assert.equal(await page.locator('#map .ring').count(), 0);
    assert.equal(await page.locator('#map .route').count(), 2, 'a leg from every miss to the answer');
    assert.equal(await page.locator('#map .target .label').textContent(), target.name);
    assert.equal((await page.locator('#end-stamp .fx-stamp').innerText()).trim(), 'נפתר 3/6');
    assert.equal(await page.locator('#end-trail li').count(), G.MAX_GUESSES);
    assert.equal(await page.locator('#end-trail li.unused').count(), 3);
    await page.locator('.guess.filled button.arrow').first().click(); // a ring can still be looked up after the end
    assert.equal(await page.locator('#map .ring.shown').count(), 1);
    await page.locator('.guess.filled button.arrow').first().click();
    assert.equal(await page.locator('#map .ring').count(), 0);
    assert.match(await page.locator('#countdown').innerText(), /^\d\d:\d\d:\d\d$/);

    // Force the clipboard path (headless Chrome has no native share sheet target).
    await page.evaluate(() => { navigator.share = undefined; });
    await page.click('#share-btn');
    const copied = (await page.evaluate(() => navigator.clipboard.readText())).replaceAll(String.fromCharCode(13), ''); // Windows writes CRLF
    const day = G.dayNumber(G.israelDate());
    assert.ok(copied.startsWith(`נקודת ציון #${day} 🧭 3/6\n`), copied);
    assert.ok(copied.includes('🟩🟩🟩🟩🟩 🎯') && copied.trim().endsWith(URL_BASE));
    assert.ok(!copied.includes(target.name), 'share text must not spoil the answer');
    const wa = await page.locator('#whatsapp-btn').getAttribute('href');
    assert.ok(wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes('3/6'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: SHOTS + '04-win.png', fullPage: true });

    await page.click('#stats-btn');
    assert.deepEqual(await page.locator('.stat-grid b').allInnerTexts(), ['1', '100', '1', '1']);
    assert.equal(await page.locator('#dist .bar.today').innerText(), '1');
    await page.screenshot({ path: SHOTS + '05-stats.png' });
    await page.keyboard.press('Escape');

    await page.reload(); // finished game survives a reload and is not counted twice
    assert.equal(await page.locator('.guess.win').count(), 1);
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal((await page.locator('#end-stamp .fx-stamp').innerText()).trim(), 'נפתר 3/6');
    assert.equal(await page.locator('#end-stamp .fx-stamp-in').count(), 0, 'the stamp does not land again on a reload');
    await page.click('#stats-btn');
    assert.deepEqual(await page.locator('.stat-grid b').allInnerTexts(), ['1', '100', '1', '1']);
    await page.keyboard.press('Escape');

    // Practice round: fresh board, not counted, no share buttons.
    await page.click('#practice-btn');
    assert.equal(await page.locator('.guess.empty').count(), 6);
    assert.equal(await page.locator('#mode-banner').isVisible(), true);
    assert.equal(await page.locator('#guess-input').isDisabled(), false);
    for (const name of ['חיפה', 'אילת', 'באר שבע', 'ירושלים', 'טבריה', 'נתניה']) {
      if (await page.locator('#guess-input').isDisabled()) break;
      await guess(page, name);
    }
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#share-btn').isHidden(), true);
    await page.click('#mode-banner button');
    assert.equal(await page.locator('.guess.win').count(), 1, 'back to the finished daily puzzle');
    await page.click('#stats-btn');
    assert.equal((await page.locator('.stat-grid b').allInnerTexts())[0], '1', 'practice is not counted');
    await context.close();
  });

  await step('losing game reveals the answer and resets the streak', async () => {
    const { context, page } = await open({ colorScheme: 'dark' });
    await page.click('#help-close');
    for (const name of wrongNames(target, 6)) await guess(page, name);
    assert.equal(await page.locator('.guess.filled').count(), 6);
    assert.equal(await page.locator('.guess.win').count(), 0);
    assert.ok((await page.locator('#end-sub').innerText()).includes(target.name));
    assert.equal(await page.locator('#hints li.open').count(), 3);
    assert.equal((await page.locator('#end-stamp .fx-stamp').innerText()).trim(), 'לא הפעם');
    assert.equal(await page.locator('#end-trail li.unused').count(), 0);
    assert.equal(await page.locator('#map .route').count(), 6);
    await page.evaluate(() => { navigator.share = undefined; });
    await page.click('#share-btn');
    assert.ok((await page.evaluate(() => navigator.clipboard.readText())).includes('X/6'));
    await page.click('#stats-btn');
    assert.deepEqual(await page.locator('.stat-grid b').allInnerTexts(), ['1', '0', '0', '0']);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.screenshot({ path: SHOTS + '06-loss-dark.png', fullPage: true });
    await context.close();
  });

  await step('a new day brings a new puzzle and keeps the streak', async () => {
    const { context, page } = await open({ fixedTime: new Date('2026-12-01T10:00:00Z') });
    const dayOne = G.dayNumber('2026-12-01');
    await page.click('#help-close');
    await guess(page, G.targetForDay(pool, dayOne).name);
    assert.equal(await page.locator('.guess.win').count(), 1);
    assert.ok((await page.locator('#end-title').innerText()).includes('ניחוש ראשון'));

    await page.clock.setFixedTime(new Date('2026-12-02T10:00:00Z'));
    await page.reload();
    assert.equal(await page.locator('.guess.filled').count(), 0, "yesterday's guesses are cleared");
    await guess(page, G.targetForDay(pool, dayOne + 1).name);
    await page.click('#stats-btn');
    assert.deepEqual(await page.locator('.stat-grid b').allInnerTexts(), ['2', '100', '2', '2']);
    await page.keyboard.press('Escape');

    // Archive link for an earlier puzzle: playable, labelled, not counted.
    await page.goto(URL_BASE + '?day=3');
    assert.ok((await page.locator('#mode-banner').innerText()).includes('#3'));
    await guess(page, G.targetForDay(pool, 3).name);
    assert.equal(await page.locator('.guess.win').count(), 1);
    await page.click('#stats-btn');
    assert.equal((await page.locator('.stat-grid b').allInnerTexts())[0], '2');
    await context.close();
  });

  await step('desktop layout and corrupted storage', async () => {
    const { context, page } = await open({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    await page.click('#help-close');
    await page.evaluate(() => localStorage.setItem('hd:nekuda', '{not json'));
    await page.reload();
    assert.equal(await page.locator('.guess.empty').count(), 6, 'recovers from corrupted storage');
    await page.keyboard.press('Escape');
    await page.click('#guess-input');
    await page.keyboard.type('תל א');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.guess.filled').count(), 1);
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOTS + '07-desktop.png' });
    await context.close();
  });

  await step('360px phone with reduced motion: complete at once, nothing overflows', async () => {
    const { context, page } = await open({ viewport: { width: 360, height: 640 }, reducedMotion: 'reduce' });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.click('#help-close');
    assert.equal(await overflow(), 0);
    const names = wrongNames(target, 6);
    await guess(page, names[0]);
    const expected = G.evaluateGuess(all.find((l) => l.name === names[0]), target);
    assert.equal(await page.locator('.guess.filled .km .num').textContent(), String(expected.km), 'no counting when motion is off');
    assert.equal(await page.locator('.guess.filled button.arrow').evaluate((b) => getComputedStyle(b).animationName), 'none');
    await page.screenshot({ path: SHOTS + '08-narrow.png' });
    for (const name of names.slice(1)) await guess(page, name);
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await overflow(), 0, 'no horizontal scroll at 360px with a full log and the end sheet');
    const dial = await page.locator('.guess.filled button.arrow').first().boundingBox();
    const body = await page.locator('.guess.filled .body').first().boundingBox();
    assert.ok(body.x >= dial.x + dial.width, 'the text never runs under the compass');
    await page.screenshot({ path: SHOTS + '09-narrow-loss.png', fullPage: true });
    await context.close();
  });

});

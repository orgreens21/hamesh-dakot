// End-to-end test for בערך. Usage: node tests/run-e2e.mjs beerech
import assert from 'node:assert/strict';
import { createSession, horizontalOverflow, shareToClipboard, isDialogOpen, readStore } from './helpers.mjs';
import * as G from '../games/beerech/game.js';
import { dayNumber, israelDate } from '../shared/core.js';

const SLUG = 'beerech';
const session = await createSession({ slug: SLUG, port: 4181 });
const { open, step, shot } = session;

const type = async (page, value) => { await page.fill('#guess-input', String(value)); await page.click('#guess-btn'); };
/** Guess one product and move on. */
const play = async (page, value) => { await type(page, value); await page.click('#next-btn'); };
const statNumbers = async (page) => {
  await page.click('#stats-btn');
  const numbers = await page.locator('.stat-grid b').allInnerTexts();
  await page.keyboard.press('Escape');
  return numbers;
};

await session.run(async () => {
  const today = dayNumber(israelDate());
  const round = G.roundForDay(today);
  const exact = round.map((p) => p.price);

  await step('first visit shows the rules once, then the first product and the price source', async () => {
    const { context, page } = await open();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true);
    assert.ok((await page.locator('#help-dialog').innerText()).includes('כל אחוז של טעות מוריד שתי נקודות'));
    assert.ok((await page.locator('#help-source').innerText()).includes(G.SOURCE.store));
    await shot(page, '01-help');
    await page.click('#help-close');
    assert.equal(await page.locator('#product-name').innerText(), round[0].name);
    assert.equal(await page.locator('#product-size').innerText(), round[0].size);
    assert.equal(await page.locator('#card-kicker').innerText(), 'מוצר 1 מתוך 5');
    assert.equal(await page.locator('#art svg').count(), 1);
    assert.equal(await page.locator('#tag.is-flipped').count(), 0, 'the tag starts face up');
    assert.equal(await page.locator('#real-price').innerText(), '');
    assert.equal(await page.locator('#end').isHidden(), true);
    assert.equal(await page.locator('#log-wrap').isHidden(), true);
    assert.equal(await page.locator('.brand h1').innerText(), G.NAME);
    assert.ok((await page.locator('#puzzle-label').innerText()).includes(`חידה ${today}`));
    assert.match(await page.locator('#source-line').innerText(), /^מחירים מ־שופרסל, נכון ל־\d{1,2} ב[א-ת]+ \d{4}$/);
    assert.ok(!(await page.locator('main').innerText()).includes(G.formatPrice(round[0].price)), 'the price is not on the page before the guess');
    assert.equal(await page.locator('#guess-input').getAttribute('inputmode'), 'decimal');
    assert.equal(await horizontalOverflow(page), 0, 'no horizontal scroll');
    const saved = await readStore(page, SLUG);
    assert.deepEqual([saved.finished, saved.progress, saved.seenHelp], [false, null, true]);
    await shot(page, '02-product');
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), false, 'rules are shown only once');
    await context.close();
  });

  await step('a perfect game: invalid input, reveal, reload, share, stats, practice', async () => {
    const { context, page } = await open();
    await page.click('#help-close');

    for (const bad of ['', 'abc', '0', '1.234', '99999']) { // refused, explained, nothing saved
      await type(page, bad);
      assert.ok((await page.locator('#guess-error').innerText()).length > 0, `"${bad}" is explained`);
      assert.equal(await page.locator('#reveal').isHidden(), true, `"${bad}" is refused`);
    }
    assert.equal(await page.locator('#guess-input').getAttribute('aria-invalid'), 'true');
    assert.equal((await readStore(page, SLUG)).progress, null);

    await page.fill('#guess-input', G.formatPrice(exact[0]).replace('.', ',')); // comma decimal, Enter key
    assert.equal(await page.locator('#guess-error').innerText(), '', 'typing clears the error');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#reveal').isVisible(), true);
    assert.equal(await page.locator('#guess-form').isHidden(), true);
    assert.equal(await page.locator('#real-price').innerText(), '₪' + G.formatPrice(exact[0]));
    assert.ok((await page.locator('#diff').innerText()).includes('בדיוק המחיר'));
    assert.ok((await page.locator('#points').innerText()).includes('100 נקודות'));
    assert.equal(await page.locator('#steps li.done.bull').count(), 1);
    assert.equal(await page.locator('#tag.is-flipped').count(), 1, 'the tag turns over to show the price');
    assert.equal(await page.locator('#steps li.done.bull [aria-hidden]').innerText(), '100', 'the stub carries the score');
    assert.ok((await page.locator('#back-name').innerText()).includes(round[0].name));
    assert.equal(await page.locator('#gauge-you').evaluate((m) => m.style.getPropertyValue('--at')), '50.0%');
    let saved = await readStore(page, SLUG);
    assert.deepEqual([saved.day, saved.finished, saved.progress.guesses.length], [today, false, 1], 'saved after every guess');
    await shot(page, '03-reveal');
    await page.click('#next-btn');
    assert.equal(await page.locator('#product-name').innerText(), round[1].name);
    assert.equal(await page.locator('#tag.is-flipped').count(), 0, 'the next product is face up again');
    assert.ok(!(await page.locator('#card').innerText()).includes(G.formatPrice(exact[0])), 'the last price leaves the tag');

    await play(page, exact[1]);
    await page.reload(); // mid-game reload: third product, two finished rows with their prices
    assert.equal(await page.locator('#card-kicker').innerText(), 'מוצר 3 מתוך 5');
    assert.equal(await page.locator('#product-name').innerText(), round[2].name);
    assert.equal(await page.locator('#log .row').count(), 2);
    assert.ok((await page.locator('#log').innerText()).includes(G.formatPrice(exact[0])));
    assert.equal(await page.locator('#steps li.done').count(), 2);
    assert.equal(await page.locator('#log-total').innerText(), '200', 'the receipt keeps a running total');
    assert.equal(await page.locator('#receipt-foot').isHidden(), true);
    await shot(page, '04-midgame');

    await play(page, exact[2]);
    await play(page, exact[3]);
    await type(page, exact[4]);
    assert.equal(await page.locator('#next-btn').innerText(), 'לסיכום');
    assert.equal(await page.locator('#end').isHidden(), true, 'the last price is shown before the summary');
    saved = await readStore(page, SLUG);
    assert.deepEqual([saved.day, saved.finished, saved.won, saved.summary, saved.seenHelp], [today, true, true, '500/500', true]);
    await page.click('#next-btn');

    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#card').isHidden(), true);
    assert.equal(await page.locator('#end-title').innerText(), G.endTitle(500));
    assert.ok((await page.locator('#end-sub').innerText()).includes('500'));
    assert.equal((await page.locator('#end .end-stamp .fx-stamp').innerText()).trim(), 'נפתר 500/500');
    assert.equal(await page.locator('#log-total').getAttribute('data-value'), '500/500', 'the receipt total, counted up');
    await page.waitForFunction(() => document.getElementById('log-total').textContent === '500/500');
    assert.equal(await page.locator('#receipt-foot').isVisible(), true);
    assert.equal(await page.locator('#log .row').count(), 5);
    for (const p of round) assert.ok((await page.locator('#log').innerText()).includes(p.name), 'the answers are listed');
    assert.match(await page.locator('#countdown').innerText(), /^\d\d:\d\d:\d\d$/);

    const copied = await shareToClipboard(page);
    assert.equal(copied, G.shareText({ day: today, guesses: exact, round, url: session.url }));
    assert.equal(copied, `בערך #${today} · 500/500\n🟩🟩🟩🟩🟩\n${session.url}`);
    for (const p of round) assert.ok(!copied.includes(p.name) && !copied.includes(G.formatPrice(p.price)), 'share text must not spoil');
    const wa = await page.locator('#whatsapp-btn').getAttribute('href');
    assert.ok(wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes('500/500'));
    await shot(page, '05-end', { fullPage: true });

    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);
    await page.click('#stats-btn');
    assert.equal(await page.locator('#dist .bar.today').innerText(), '1');
    assert.equal(await page.locator('#dist li').count(), G.BUCKETS);
    await shot(page, '06-stats');
    await page.keyboard.press('Escape');

    await page.reload(); // a finished game survives a reload and is not counted twice
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#card').isHidden(), true);
    assert.equal(await page.locator('#log .row').count(), 5);
    assert.equal(await page.locator('#log-total').innerText(), '500/500');
    assert.equal(await page.locator('#end .fx-stamp-in').count(), 0, 'the stamp does not land again on a reload');
    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);

    const before = JSON.stringify(await readStore(page, SLUG));
    await page.click('#practice-btn'); // practice: other products, not saved, nothing to share
    assert.equal(await page.locator('#mode-banner').isVisible(), true);
    assert.equal(await page.locator('#puzzle-label').innerText(), 'סיבוב אימון');
    const practiceName = await page.locator('#product-name').innerText();
    assert.ok(G.PRODUCTS.some((p) => p.name === practiceName));
    for (let i = 0; i < G.ROUND_SIZE; i++) await play(page, 1);
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#share-btn').count(), 0);
    assert.equal(await page.locator('#countdown').count(), 0);
    await shot(page, '07-practice-end', { fullPage: true });
    await page.click('#practice-btn'); // unlimited: another round straight away
    assert.equal(await page.locator('#card-kicker').innerText(), 'מוצר 1 מתוך 5');
    await play(page, 1);
    assert.equal(JSON.stringify(await readStore(page, SLUG)), before, 'practice never touches the store');
    await page.click('#mode-banner button');
    assert.equal(await page.locator('#share-btn').count(), 1, 'back to the finished daily puzzle');
    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1'], 'practice is not counted');
    await context.close();
  });

  await step('a poor game in dark mode: zero points, a loss, practice from the footer mid-game', async () => {
    const { context, page } = await open({ colorScheme: 'dark' });
    await page.click('#help-close');
    await shot(page, '08-product-dark');
    await play(page, 9999);

    await page.click('#practice-link'); // leaving for practice mid-game keeps the daily progress
    await play(page, 5);
    await page.click('#mode-banner button');
    assert.equal(await page.locator('#card-kicker').innerText(), 'מוצר 2 מתוך 5');
    assert.equal(await page.locator('#log .row').count(), 1);

    await type(page, 9999);
    assert.ok((await page.locator('#points').innerText()).includes('0 נקודות'));
    assert.ok((await page.locator('#diff').innerText()).includes(G.diffLabel(9999, round[1].price)));
    // The number on the tag rolls from the guess to the shelf price; data-value has the price from the first frame.
    assert.equal(await page.locator('#real-price').getAttribute('data-value'), '₪' + G.formatPrice(round[1].price));
    await page.waitForFunction((text) => document.getElementById('real-price').textContent === text, '₪' + G.formatPrice(round[1].price));
    assert.equal(await page.locator('#gauge-you').evaluate((m) => m.style.getPropertyValue('--at')), '100.0%', 'far guesses stop at the end of the scale');
    await shot(page, '09-reveal-far-dark');
    await page.click('#next-btn');
    for (let i = 2; i < G.ROUND_SIZE; i++) await play(page, 9999);

    assert.equal(await page.locator('#end-title').innerText(), G.endTitle(0));
    assert.equal(await page.locator('#end-streak').count(), 0);
    assert.equal((await page.locator('#end .end-stamp .fx-stamp').innerText()).trim(), 'לא הפעם');
    assert.equal(await page.locator('#steps li.done.far').count(), 5);
    const copied = await shareToClipboard(page);
    assert.equal(copied, `בערך #${today} · 0/500\n🟥🟥🟥🟥🟥\n${session.url}`);
    const saved = await readStore(page, SLUG);
    assert.deepEqual([saved.finished, saved.won, saved.summary], [true, false, '0/500']);
    assert.deepEqual(await statNumbers(page), ['1', '0', '0', '0']);
    await shot(page, '10-poor-dark', { fullPage: true });
    await context.close();
  });

  await step('a new day brings new products and keeps the streak', async () => {
    const { context, page } = await open({ fixedTime: new Date('2026-12-01T10:00:00Z') });
    const day = dayNumber('2026-12-01');
    await page.click('#help-close');
    assert.equal(await page.locator('#product-name').innerText(), G.roundForDay(day)[0].name);
    for (const p of G.roundForDay(day)) await play(page, p.price);
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#end-streak').count(), 0, 'no streak line on the first day');

    await page.clock.setFixedTime(new Date('2026-12-02T10:00:00Z'));
    await page.reload();
    assert.equal(await page.locator('#end').isHidden(), true);
    assert.equal(await page.locator('#log .row').count(), 0, "yesterday's guesses are cleared");
    assert.equal(await page.locator('#steps li.done').count(), 0);
    assert.equal(await page.locator('#product-name').innerText(), G.roundForDay(day + 1)[0].name);
    assert.ok((await page.locator('#puzzle-label').innerText()).includes(`חידה ${day + 1}`));
    // A decent, not perfect, day: 10% off each time is 80 points a product, still a win.
    for (const p of G.roundForDay(day + 1)) await play(page, (p.price * 1.1).toFixed(2));
    assert.ok((await page.locator('#end-streak').innerText()).includes('2'));
    assert.deepEqual(await statNumbers(page), ['2', '100', '2', '2']);
    const saved = await readStore(page, SLUG);
    assert.deepEqual([saved.day, saved.won, saved.summary], [day + 1, true, '400/500']);
    await context.close();
  });

  await step('360px phone, desktop, and corrupted storage', async () => {
    const narrow = await open({ viewport: { width: 360, height: 640 } });
    await narrow.page.click('#help-close');
    assert.equal(await horizontalOverflow(narrow.page), 0, 'no horizontal scroll at 360px');
    for (const id of ['#guess-btn', '#guess-input', '#help-btn', '#stats-btn']) {
      const box = await narrow.page.locator(id).boundingBox();
      assert.ok(box.height >= 44 && box.width >= 44, `${id} is a 44px tap target`);
    }
    await shot(narrow.page, '11-narrow');
    await type(narrow.page, 12.5);
    assert.equal(await horizontalOverflow(narrow.page), 0, 'no horizontal scroll on the reveal');
    await shot(narrow.page, '12-narrow-reveal');
    await narrow.page.click('#next-btn');
    for (let i = 1; i < G.ROUND_SIZE; i++) await play(narrow.page, 12.5);
    assert.equal(await horizontalOverflow(narrow.page), 0, 'no horizontal scroll on the summary');
    await shot(narrow.page, '13-narrow-end', { fullPage: true });
    await narrow.context.close();

    // With motion switched off the tag is simply turned over and the price is there at once.
    const still = await open({ reducedMotion: 'reduce' });
    await still.page.click('#help-close');
    await type(still.page, (round[0].price * 1.2).toFixed(2));
    assert.equal(await still.page.locator('#real-price').innerText(), '₪' + G.formatPrice(round[0].price));
    assert.equal(await still.page.locator('#tag.is-flipped').count(), 1);
    assert.equal(await still.page.locator('#points').evaluate((p) => getComputedStyle(p).animationName), 'none');
    assert.ok((await still.page.locator('#points').innerText()).includes('נקודות'));
    await still.context.close();

    const { context, page } = await open({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    await page.evaluate(() => localStorage.setItem('hd:beerech', '{not json'));
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true, 'recovers from corrupted storage');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#card-kicker').innerText(), 'מוצר 1 מתוך 5');
    await shot(page, '14-desktop');

    // Junk in progress is ignored rather than trusted.
    await page.evaluate((day) => localStorage.setItem('hd:beerech', JSON.stringify({ day, seenHelp: true, progress: { guesses: ['x', -3, null] } })), today);
    await page.reload();
    assert.equal(await page.locator('#card-kicker').innerText(), 'מוצר 1 מתוך 5');
    assert.equal(await page.locator('#log .row').count(), 0);
    await type(page, 10);
    assert.equal(await page.locator('#reveal').isVisible(), true);
    await context.close();
  });
});

// End-to-end test for the template game. Copy this file's shape for a new game.
// Usage: node tests/_template.e2e.mjs   (or: npm run test:e2e -- _template)
import assert from 'node:assert/strict';
import { createSession, horizontalOverflow, shareToClipboard, isDialogOpen, readStore } from './helpers.mjs';
import * as G from '../games/_template/game.js';
import { dayNumber, israelDate } from '../shared/core.js';

const session = await createSession({ slug: '_template', port: 4180 });
const { open, step, shot } = session;

const pick = (page, n) => page.locator('#board .tile', { hasText: new RegExp(`^${n}$`) }).click();
const wrong = (secret, count) => G.NUMBERS.filter((n) => n !== secret).slice(0, count);
const statNumbers = async (page) => {
  await page.click('#stats-btn');
  const numbers = await page.locator('.stat-grid b').allInnerTexts();
  await page.keyboard.press('Escape');
  return numbers;
};

await session.run(async () => {
  const today = dayNumber(israelDate());
  const secret = G.secretForDay(today);

  await step('first visit shows the rules once, then an empty board', async () => {
    const { context, page } = await open();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true);
    await shot(page, '01-help');
    await page.click('#help-close');
    assert.equal(await page.locator('#board .tile').count(), 10);
    assert.equal(await page.locator('#end').isHidden(), true);
    assert.equal(await page.locator('.brand h1').innerText(), G.NAME);
    assert.ok((await page.locator('#puzzle-label').innerText()).includes(`חידה ${today}`));
    assert.equal(await page.locator('.top .back').getAttribute('href'), '../../');
    assert.equal(await horizontalOverflow(page), 0, 'no horizontal scroll');
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), false, 'rules are shown only once');
    await context.close();
  });

  await step('win: feedback, saved progress, share, stats, practice', async () => {
    const { context, page } = await open();
    await page.click('#help-close');
    const [miss] = wrong(secret, 1);
    await pick(page, miss);
    assert.equal(await page.locator('#log .try').count(), 1);
    assert.ok((await page.locator('#log .try').innerText()).includes(secret > miss ? 'גדול יותר' : 'קטן יותר'));
    assert.equal((await readStore(page, '_template')).finished, false);
    await shot(page, '02-midgame');

    await page.reload(); // progress survives a reload
    assert.equal(await page.locator('#log .try').count(), 1);

    await page.keyboard.press(String(miss % 10)); // keyboard: a repeated number is refused with a toast
    assert.equal(await page.locator('#log .try').count(), 1);
    assert.ok((await page.locator('#toast').innerText()).includes('כבר ניסיתם'));

    await page.keyboard.press(String(secret % 10));
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.ok((await page.locator('#end-sub').innerText()).includes(String(secret)));
    assert.match(await page.locator('#countdown').innerText(), /^\d\d:\d\d:\d\d$/);
    assert.equal(await page.locator('#board .tile:not(:disabled)').count(), 0);

    const copied = await shareToClipboard(page);
    assert.ok(copied.startsWith(`${G.NAME} #${today} 2/3\n`), copied);
    assert.ok(copied.trim().endsWith(session.url));
    assert.ok(!copied.split('\n')[1].match(/\d/), 'share text must not spoil the answer');
    const wa = await page.locator('#whatsapp-btn').getAttribute('href');
    assert.ok(wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes('2/3'));
    await shot(page, '03-win', { fullPage: true });

    const saved = await readStore(page, '_template');
    assert.deepEqual([saved.day, saved.finished, saved.won, saved.summary, saved.seenHelp], [today, true, true, '2/3', true]);

    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);
    await page.click('#stats-btn');
    assert.equal(await page.locator('#dist .bar.today').innerText(), '1');
    await shot(page, '04-stats');
    await page.keyboard.press('Escape');

    await page.reload(); // a finished game survives a reload and is not counted twice
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);

    await page.click('#practice-btn'); // practice: fresh board, not counted, nothing to share
    assert.equal(await page.locator('#mode-banner').isVisible(), true);
    assert.equal(await page.locator('#board .tile:not(:disabled)').count(), 10);
    for (const n of G.NUMBERS) {
      if (await page.locator('#end').isVisible()) break;
      await pick(page, n);
    }
    assert.equal(await page.locator('#share-btn').count(), 0);
    assert.equal(await page.locator('#countdown').count(), 0);
    await page.click('#mode-banner button');
    assert.equal(await page.locator('#share-btn').count(), 1, 'back to the finished daily puzzle');
    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1'], 'practice is not counted');
    await context.close();
  });

  await step('loss in dark mode reveals the answer', async () => {
    const { context, page } = await open({ colorScheme: 'dark' });
    await page.click('#help-close');
    for (const n of wrong(secret, 3)) await pick(page, n);
    assert.ok((await page.locator('#end-sub').innerText()).includes(String(secret)));
    assert.equal(await page.locator('#board .tile.right').count(), 1);
    assert.ok((await shareToClipboard(page)).includes('X/3'));
    assert.deepEqual(await statNumbers(page), ['1', '0', '0', '0']);
    await shot(page, '05-loss-dark', { fullPage: true });
    await context.close();
  });

  await step('a new day clears the board and keeps the streak', async () => {
    const { context, page } = await open({ fixedTime: new Date('2026-12-01T10:00:00Z') });
    const day = dayNumber('2026-12-01');
    await page.click('#help-close');
    await pick(page, G.secretForDay(day));
    assert.equal(await page.locator('#end-title').innerText(), 'ניחוש ראשון!');

    await page.clock.setFixedTime(new Date('2026-12-02T10:00:00Z'));
    await page.reload();
    assert.equal(await page.locator('#log .try').count(), 0, "yesterday's tries are cleared");
    assert.equal(await page.locator('#end').isHidden(), true);
    await pick(page, G.secretForDay(day + 1));
    assert.ok((await page.locator('#end-streak').innerText()).includes('2'));
    assert.deepEqual(await statNumbers(page), ['2', '100', '2', '2']);
    await context.close();
  });

  await step('narrow phone, desktop, and corrupted storage', async () => {
    const narrow = await open({ viewport: { width: 360, height: 640 } });
    await narrow.page.click('#help-close');
    assert.equal(await horizontalOverflow(narrow.page), 0, 'no horizontal scroll at 360px');
    await shot(narrow.page, '06-narrow');
    await narrow.context.close();

    const { context, page } = await open({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    await page.evaluate(() => localStorage.setItem('hd:_template', '{not json'));
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true, 'recovers from corrupted storage');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#board .tile:not(:disabled)').count(), 10);
    await shot(page, '07-desktop');
    await context.close();
  });
});

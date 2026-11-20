// End-to-end test for ארבע על ארבע.
// Usage: node tests/arba.e2e.mjs   (or: npm run test:e2e -- arba)
import assert from 'node:assert/strict';
import { createSession, horizontalOverflow, shareToClipboard, isDialogOpen, readStore } from './helpers.mjs';
import * as G from '../games/arba/game.js';
import { dayNumber, israelDate, dailyStatus } from '../shared/core.js';

const SLUG = 'arba';
const session = await createSession({ slug: SLUG, port: 4182 });
const { open, step, shot } = session;

// A word is addressed by its index in the puzzle: group n owns indexes 4n … 4n+3.
const group = (n) => [0, 1, 2, 3].map((i) => n * 4 + i);
const tile = (page, i) => page.locator(`#grid .tile[data-index="${i}"]`);
const pick = async (page, indexes) => { for (const i of indexes) await tile(page, i).click(); };
const guess = async (page, indexes) => { await pick(page, indexes); await page.click('#submit-btn'); };
const clear = (page) => page.click('#clear-btn');
const wrongGuess = async (page, indexes) => { await guess(page, indexes); await clear(page); };
const solveAll = async (page, order = [0, 1, 2, 3]) => { for (const n of order) await guess(page, group(n)); };
const tiles = (page) => page.locator('#grid .tile').count();
const bands = (page, extra = '') => page.locator(`#bands .band${extra}`).count();
const toastText = (page) => page.locator('#toast').innerText();
const livesLeft = (page) => page.locator('#lives').getAttribute('data-left');
const statNumbers = async (page) => {
  await page.click('#stats-btn');
  const numbers = await page.locator('.stat-grid b').allInnerTexts();
  await page.keyboard.press('Escape');
  return numbers;
};
/** Every tile's text must sit inside the tile: no clipped word, no spill below. */
const tilesThatOverflow = (page) => page.evaluate(() => [...document.querySelectorAll('#grid .tile')]
  .filter((t) => t.firstElementChild.scrollWidth > t.firstElementChild.clientWidth || t.firstElementChild.scrollHeight > t.clientHeight || t.scrollWidth > t.clientWidth)
  .map((t) => t.textContent));
// Four different wrong selections that never touch group 2 (indexes 8–11), so they stay playable after it is found.
const MISSES = [[0, 1, 2, 4], [0, 1, 4, 5], [0, 4, 12, 13], [1, 5, 14, 15]];

await session.run(async () => {
  const today = dayNumber(israelDate());
  const puzzle = G.puzzleForDay(today);

  await step('first visit shows the rules once, then sixteen tiles', async () => {
    const { context, page } = await open();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true);
    await shot(page, '01-help');
    await page.click('#help-close');
    assert.equal(await tiles(page), 16);
    assert.deepEqual((await page.locator('#grid .tile').allInnerTexts()).sort(), [...puzzle.words].sort());
    assert.equal(await page.locator('#end').isHidden(), true);
    assert.equal(await page.locator('.brand h1').innerText(), G.NAME);
    assert.ok((await page.locator('#puzzle-label').innerText()).includes(`חידה ${today}`));
    assert.equal(await page.locator('#submit-btn').isDisabled(), true);
    assert.equal(await horizontalOverflow(page), 0, 'no horizontal scroll');
    assert.deepEqual(await tilesThatOverflow(page), []);
    const saved = await readStore(page, SLUG);
    assert.equal(saved.progress, null, 'nothing is "in progress" before the first guess');
    assert.equal(dailyStatus(saved, today), 'new');
    await shot(page, '02-start');
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), false, 'rules are shown only once');
    await context.close();
  });

  await step('perfect game: selection, lock, reload mid-game, share, stats, reload after the end', async () => {
    const { context, page } = await open();
    await page.click('#help-close');

    await pick(page, [0, 1, 2]); // selecting is not a move: nothing is saved yet
    assert.equal(await page.locator('#grid .tile[aria-pressed="true"]').count(), 3);
    assert.equal(await page.locator('#submit-btn').isDisabled(), true);
    await tile(page, 3).click();
    await tile(page, 4).click(); // a fifth word is refused
    assert.equal(await page.locator('#grid .tile[aria-pressed="true"]').count(), 4);
    assert.ok((await toastText(page)).includes('רק ארבע'));
    await shot(page, '03-selected');
    await page.click('#shuffle-btn'); // shuffling keeps the selection and the words
    assert.equal(await page.locator('#grid .tile[aria-pressed="true"]').count(), 4);
    assert.equal(await tiles(page), 16);
    assert.equal((await readStore(page, SLUG)).progress, null);

    await page.click('#submit-btn');
    assert.equal(await bands(page), 1);
    assert.equal(await tiles(page), 12);
    // The four tiles fly into the band as decoration: hidden from screen readers, and gone when it is over.
    assert.equal(await page.locator('#tray .fuse[aria-hidden="true"] .fuse-chip').count(), 4);
    assert.deepEqual((await page.locator('#tray .fuse-chip').allInnerTexts()).sort(), [...puzzle.groups[0].words].sort());
    await page.waitForFunction(() => !document.querySelector('.fuse'));
    assert.equal(await page.locator('#bands .band').evaluate((b) => getComputedStyle(b).opacity), '1');
    assert.equal(await page.locator('#bands .band-title').innerText(), puzzle.groups[0].title);
    for (const w of puzzle.groups[0].words) assert.ok((await page.locator('#bands .band-words').innerText()).includes(w));
    let saved = await readStore(page, SLUG);
    assert.deepEqual([saved.day, saved.finished, saved.won, saved.summary], [today, false, false, '']);
    assert.equal(dailyStatus(saved, today), 'playing');

    await guess(page, group(2));
    await shot(page, '04-midgame', { settle: 1300 });
    await page.reload(); // progress survives a reload
    assert.equal(await bands(page), 2);
    assert.equal(await tiles(page), 8);
    assert.deepEqual(await page.locator('#bands .band').evaluateAll((els) => els.map((e) => e.dataset.tier)), ['1', '3']);
    assert.equal(await livesLeft(page), '4');

    await solveAll(page, [3, 1]);
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#end-title').innerText(), 'מושלם!');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').innerText(), 'נפתר');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp-in').count(), 1, 'the stamp lands when the game ends');
    assert.equal(await page.locator('canvas.fx-confetti').count() <= 1, true);
    assert.equal(await bands(page), 4);
    assert.equal(await tiles(page), 0);
    assert.equal(await page.locator('#controls').isHidden(), true);
    assert.match(await page.locator('#countdown').innerText(), /^\d\d:\d\d:\d\d$/);

    const copied = await shareToClipboard(page);
    assert.equal(copied.trim(), G.shareText({ day: today, guesses: [group(0), group(2), group(3), group(1)], url: session.url }));
    assert.ok(copied.startsWith(`${G.NAME} #${today}\nנפתר: בלי טעויות\n🟦🟦🟦🟦\n🟥🟥🟥🟥\n⬛⬛⬛⬛\n🟧🟧🟧🟧\n`), copied);
    assert.ok(copied.trim().endsWith(session.url));
    // The first line is the game's own name (which contains רבע, a word in one puzzle), so only the result is checked.
    const result = copied.split('\n').slice(1).join('\n');
    // Whole words only: a two-letter entry such as "וי" is not given away by the letters of another word.
    const spaced = (text) => ` ${text.split(/[^א-ת_]+/).filter(Boolean).join(" ")} `;
    for (const w of [...puzzle.words, ...puzzle.groups.map((g) => g.title)]) assert.ok(!spaced(result).includes(spaced(w)), `share text spoils "${w}"`);
    const wa = await page.locator('#whatsapp-btn').getAttribute('href');
    assert.ok(wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes('בלי טעויות'));
    await shot(page, '05-win', { fullPage: true, settle: 3000 });
    assert.equal(await page.locator('canvas.fx-confetti').count(), 0, 'the celebration cleans up after itself');

    saved = await readStore(page, SLUG);
    assert.deepEqual([saved.day, saved.finished, saved.won, saved.summary, saved.seenHelp], [today, true, true, 'בלי טעויות', true]);
    assert.equal(dailyStatus(saved, today), 'won');

    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);
    await page.click('#stats-btn');
    assert.deepEqual(await page.locator('#dist .bar').allInnerTexts(), ['1', '0', '0', '0']);
    assert.equal(await page.locator('#dist .bar.today').innerText(), '1');
    await shot(page, '06-stats');
    await page.keyboard.press('Escape');

    await page.reload(); // a finished game survives a reload and is not counted twice
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await bands(page), 4);
    assert.equal(await page.locator('#end-title').innerText(), 'מושלם!');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').innerText(), 'נפתר');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp-in').count(), 0, 'a reopened result is already stamped');
    await page.waitForTimeout(900);
    assert.equal(await page.locator('canvas.fx-confetti').count(), 0, 'no second celebration after a reload');
    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);
    await context.close();
  });

  await step('one away, a repeated guess, then a loss in dark mode that reveals the rest', async () => {
    const { context, page } = await open({ colorScheme: 'dark' });
    await page.click('#help-close');
    await guess(page, group(2)); // one group found before things go wrong

    await guess(page, MISSES[0]);
    assert.ok((await toastText(page)).includes('כמעט'), 'three of a kind says "one away"');
    assert.equal(await livesLeft(page), '3');
    assert.equal(await page.locator('#grid .tile[aria-pressed="true"]').count(), 4, 'the selection stays after a miss');
    assert.equal(await page.locator('#grid .tile.shake').count(), 4);
    assert.equal(await page.locator('#lives .tickets i').count(), G.MAX_MISTAKES);
    assert.equal(await page.locator('#lives .tickets i.spent').count(), 1, 'one ticket is torn off');
    assert.equal(await page.locator('#lives .tickets i.torn').count(), 1);
    await page.click('#submit-btn'); // the same four again cost nothing
    assert.ok((await toastText(page)).includes('כבר ניסיתם'));
    assert.equal(await livesLeft(page), '3');
    assert.equal(await page.locator('#lives .tickets i.spent').count(), 1);
    await shot(page, '07-one-away-dark');
    await clear(page);
    assert.equal(await page.locator('#grid .tile[aria-pressed="true"]').count(), 0);

    await wrongGuess(page, MISSES[1]);
    assert.ok((await toastText(page)).includes('לא הפעם'));
    await wrongGuess(page, MISSES[2]);
    assert.equal(await livesLeft(page), '1');
    await page.reload(); // mistakes survive a reload too
    assert.equal(await livesLeft(page), '1');
    assert.equal(await bands(page), 1);
    await guess(page, MISSES[3]);

    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#end-title').innerText(), 'לא נורא, מחר יש חדשה');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').innerText(), 'לא הפעם');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').getAttribute('data-tone'), 'close');
    assert.ok((await page.locator('#end-sub').innerText()).includes('1 מתוך 4'));
    assert.equal(await bands(page), 4, 'every group is shown after a loss');
    assert.equal(await bands(page, '.missed'), 3);
    assert.deepEqual(await page.locator('#bands .band-title').allInnerTexts(), [2, 0, 1, 3].map((n) => puzzle.groups[n].title));
    assert.equal(await tiles(page), 0);
    const copied = await shareToClipboard(page);
    assert.ok(copied.startsWith(`${G.NAME} #${today}\n1/4 קבוצות\n🟥🟥🟥🟥\n🟦🟦🟦🟧\n`), copied);
    const saved = await readStore(page, SLUG);
    assert.deepEqual([saved.finished, saved.won, saved.summary], [true, false, '1/4']);
    assert.equal(dailyStatus(saved, today), 'lost');
    assert.deepEqual(await statNumbers(page), ['1', '0', '0', '0']);
    await shot(page, '08-loss-dark', { fullPage: true, settle: 1500 });
    await page.reload();
    assert.equal(await bands(page, '.missed'), 3);
    assert.deepEqual(await statNumbers(page), ['1', '0', '0', '0']);
    await context.close();
  });

  await step('a new day clears the board and keeps the streak', async () => {
    const { context, page } = await open({ fixedTime: new Date('2026-12-01T10:00:00Z') });
    const day = dayNumber('2026-12-01');
    await page.click('#help-close');
    assert.deepEqual((await page.locator('#grid .tile').allInnerTexts()).sort(), [...G.puzzleForDay(day).words].sort());
    await wrongGuess(page, MISSES[0]);
    await solveAll(page);
    assert.equal(await page.locator('#end-title').innerText(), 'כמעט מושלם');
    assert.equal(await page.locator('#end-streak').count(), 0, 'a streak of one is not announced');

    await page.clock.setFixedTime(new Date('2026-12-02T10:00:00Z'));
    await page.reload();
    assert.equal(await bands(page), 0, "yesterday's groups are cleared");
    assert.equal(await tiles(page), 16);
    assert.equal(await livesLeft(page), '4');
    assert.equal(await page.locator('#end').isHidden(), true);
    assert.deepEqual((await page.locator('#grid .tile').allInnerTexts()).sort(), [...G.puzzleForDay(day + 1).words].sort());
    await solveAll(page, [3, 2, 1, 0]);
    assert.ok((await page.locator('#end-streak').innerText()).includes('2'));
    assert.deepEqual(await statNumbers(page), ['2', '100', '2', '2']);
    await page.click('#stats-btn');
    assert.deepEqual(await page.locator('#dist .bar').allInnerTexts(), ['1', '1', '0', '0']);
    await context.close();
  });

  await step('archive: an earlier puzzle can be played but is never saved or counted', async () => {
    const { context, page } = await open({ fixedTime: new Date('2026-12-05T10:00:00Z') });
    const day = dayNumber('2026-12-05');
    await page.click('#help-close');
    await solveAll(page);
    const before = await readStore(page, SLUG);

    await page.click('#archive-open');
    assert.equal(await isDialogOpen(page, '#archive-dialog'), true);
    assert.equal(await page.locator('#archive-list a').count(), day - 1);
    assert.ok((await page.locator('#archive-list a').first().innerText()).includes(`חידה ${day - 1}`));
    await shot(page, '09-archive');
    await page.locator('#archive-list a', { hasText: 'חידה 3 ' }).or(page.locator('#archive-list a[href="?day=3"]')).first().click();
    await page.waitForURL(/\?day=3$/);

    assert.equal(await page.locator('#mode-banner').isVisible(), true);
    assert.ok((await page.locator('#puzzle-label').innerText()).includes('חידה 3'));
    assert.equal(await isDialogOpen(page, '#help-dialog'), false);
    assert.deepEqual((await page.locator('#grid .tile').allInnerTexts()).sort(), [...G.puzzleForDay(3).words].sort());
    await wrongGuess(page, MISSES[0]);
    await solveAll(page);
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#share-btn').count(), 0, 'nothing to share from the archive');
    assert.equal(await page.locator('#countdown').count(), 0);
    await shot(page, '10-archive-end', { fullPage: true });
    assert.deepEqual(await readStore(page, SLUG), before, 'the archive never touches the store');
    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);

    await page.reload(); // archive rounds are not saved
    assert.equal(await tiles(page), 16);
    await page.click('#back-today');
    await page.waitForURL((u) => !u.search);
    assert.equal(await page.locator('#mode-banner').isHidden(), true);
    assert.equal(await page.locator('#share-btn').count(), 1, "back to today's finished puzzle");

    for (const bad of ['?day=999', `?day=${day}`, '?day=0', '?day=abc', '?day=2.5']) {
      await page.goto(session.url + bad);
      assert.equal(await page.locator('#mode-banner').isHidden(), true, `${bad} falls back to today`);
      assert.ok((await page.locator('#puzzle-label').innerText()).includes(`חידה ${day} `));
    }
    await context.close();
  });

  await step('keyboard: arrows move, space selects, enter submits', async () => {
    const { context, page } = await open({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    await page.keyboard.press('Escape'); // closes the rules
    assert.equal(await isDialogOpen(page, '#help-dialog'), false);
    const order = await page.locator('#grid .tile').evaluateAll((els) => els.map((e) => Number(e.dataset.index)));
    await page.locator('#grid .tile').first().focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowLeft'); // right-to-left: the next tile
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    const pressed = await page.locator('#grid .tile[aria-pressed="true"]').evaluateAll((els) => els.map((e) => Number(e.dataset.index)));
    assert.deepEqual(pressed.sort((a, b) => a - b), [order[0], order[1], order[5], order[4]].sort((a, b) => a - b));
    await page.locator('#submit-btn').focus();
    await page.keyboard.press('Enter');
    assert.equal(await livesLeft(page), G.evaluate(pressed).correct ? '4' : '3');
    await shot(page, '11-desktop');
    await context.close();
  });

  await step('360px phone: no sideways scroll and the longest entries fit their tiles', async () => {
    // Open the puzzles with the longest words and the longest phrases through the archive, from a date far enough ahead.
    const future = new Date('2027-09-01T10:00:00Z');
    const todayThen = dayNumber('2027-09-01');
    const days = Array.from({ length: G.ALL_PUZZLES.length }, (_, i) => i + 1);
    const longest = (measure) => [...days].sort((a, b) => measure(G.puzzleForDay(b)) - measure(G.puzzleForDay(a))).slice(0, 4);
    const byWord = longest((p) => Math.max(...p.words.flatMap((w) => w.split(' ')).map((w) => w.length)));
    const byEntry = longest((p) => Math.max(...p.words.map((w) => w.length)));
    assert.ok(todayThen > G.ALL_PUZZLES.length);

    const { context, page } = await open({ viewport: { width: 360, height: 640 }, fixedTime: future });
    await page.click('#help-close');
    assert.equal(await horizontalOverflow(page), 0, 'no horizontal scroll at 360px');
    for (const day of new Set([...byWord, ...byEntry])) {
      await page.goto(`${session.url}?day=${day}`);
      await page.evaluate(() => document.fonts.ready);
      assert.deepEqual(await tilesThatOverflow(page), [], `day ${day}`);
      assert.equal(await horizontalOverflow(page), 0, `day ${day}`);
      const small = await page.locator('#grid .tile').evaluateAll((els) => Math.min(...els.map((e) => parseFloat(getComputedStyle(e).fontSize))));
      assert.ok(small >= 10, `text shrank to ${small}px on day ${day}`);
      const size = await page.locator('#grid .tile').first().boundingBox();
      assert.ok(size.height >= 44 && size.width >= 44, 'tap target');
    }
    await page.goto(`${session.url}?day=${byWord[0]}`);
    await shot(page, '12-narrow-long-words');
    await page.goto(`${session.url}?day=${byEntry[0]}`);
    await guess(page, group(1));
    await pick(page, [0, 1, 8]);
    await shot(page, '13-narrow-long-phrases');
    await clear(page);
    await solveAll(page, [0, 2, 3]);
    assert.equal(await horizontalOverflow(page), 0, 'no horizontal scroll with all four bands');
    await shot(page, '14-narrow-end', { fullPage: true, settle: 1500 });
    await context.close();

    const dark = await open({ viewport: { width: 360, height: 640 }, colorScheme: 'dark' });
    await dark.page.click('#help-close');
    await guess(dark.page, group(3));
    await guess(dark.page, group(0));
    await pick(dark.page, [4, 5, 8]);
    assert.equal(await horizontalOverflow(dark.page), 0);
    await shot(dark.page, '15-narrow-dark');
    await dark.context.close();
  });

  await step('reduced motion: the same game with nothing flying', async () => {
    const { context, page } = await open({ reducedMotion: 'reduce' });
    await page.click('#help-close');
    await guess(page, group(2));
    assert.equal(await bands(page), 1);
    assert.equal(await page.locator('.fuse').count(), 0);
    assert.equal(await page.locator('#bands .band').evaluate((b) => b.getAnimations().length), 0);
    await wrongGuess(page, MISSES[0]);
    assert.equal(await page.locator('#lives .tickets i.spent').count(), 1);
    await solveAll(page, [0, 1, 3]);
    assert.equal(await page.locator('#end-title').innerText(), 'כמעט מושלם');
    assert.equal(await page.locator('canvas.fx-confetti').count(), 0);
    await shot(page, '16-reduced-motion-end', { fullPage: true });
    await context.close();
  });

  await step('corrupted storage', async () => {
    const { context, page } = await open();
    await page.evaluate(() => localStorage.setItem('hd:arba', '{not json'));
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true, 'recovers from corrupted storage');
    await page.keyboard.press('Escape');
    assert.equal(await tiles(page), 16);

    // Valid JSON with a nonsense shape must not break the board either. (Wait for the rules dialog's own save first.)
    await page.waitForFunction(() => (localStorage.getItem('hd:arba') || '').includes('"seenHelp":true'));
    await page.evaluate((day) => localStorage.setItem('hd:arba', JSON.stringify({
      day, seenHelp: true, progress: { guesses: [[0, 1, 2, 3], 'x', [0, 0, 0, 0], [4, 5, 6, 99]], order: [1, 2, 3] }, stats: 'nope',
    })), today);
    await page.reload();
    assert.equal(await bands(page), 1);
    assert.equal(await tiles(page), 12);
    assert.equal(await livesLeft(page), '4');
    await context.close();
  });
});

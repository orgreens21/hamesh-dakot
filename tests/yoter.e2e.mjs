// End-to-end test for יותר או פחות.
// Usage: node tests/yoter.e2e.mjs   (or: npm run test:e2e -- yoter)
import assert from 'node:assert/strict';
import { createSession, horizontalOverflow, shareToClipboard, isDialogOpen, readStore } from './helpers.mjs';
import * as G from '../games/yoter/game.js';
import { dayNumber, israelDate, dailyStatus } from '../shared/core.js';

const session = await createSession({ slug: 'yoter', port: 4186 });
const { open, step, shot } = session;

// Reduced motion skips the count-up and shortens the pause, so ten rounds take a few seconds, not thirty.
const CALM = { reducedMotion: 'reduce' };

const rightAnswers = (items) => items.slice(1).map((it, i) => (it.value > items[i].value ? 'more' : 'less'));
const flip = (answer) => (answer === 'more' ? 'less' : 'more');
const playable = (page) => page.waitForFunction(() => !document.querySelector('#more-btn').disabled || !document.querySelector('#end').hidden);

/** Gives one answer and waits for the reveal to finish and the next round (or the end) to appear. */
async function give(page, answer, { keyboard = false } = {}) {
  if (keyboard) await page.keyboard.press(answer === 'more' ? 'ArrowUp' : 'ArrowDown');
  else await page.click(answer === 'more' ? '#more-btn' : '#less-btn');
  await playable(page);
}
async function giveAll(page, answers) {
  for (const answer of answers) await give(page, answer);
}

/** The correct answer for the pair on screen, looked up by name in the theme's data. */
async function rightNow(page, theme) {
  const [known, hidden] = await Promise.all([page.locator('#known-name').innerText(), page.locator('#hidden-name').innerText()]);
  const value = (name) => theme.items.find((it) => it.name === name).value;
  return value(hidden) > value(known) ? 'more' : 'less';
}

const statNumbers = async (page) => {
  await page.click('#stats-btn');
  const numbers = await page.locator('.stat-grid b').allInnerTexts();
  await page.keyboard.press('Escape');
  return numbers;
};
/** Text of a value line; its prefix, number and unit are separate flex items, which innerText puts on separate lines. */
const flat = async (locator) => (await locator.innerText()).replace(/\s+/g, ' ').trim();
const pips = (page, state) => page.locator(`#pips li.${state}`).count();

await session.run(async () => {
  const today = dayNumber(israelDate());
  const chain = G.chainForDay(today);
  const right = rightAnswers(chain.items);

  await step('first visit shows the rules once, then round one', async () => {
    const { context, page } = await open(CALM);
    assert.equal(await isDialogOpen(page, '#help-dialog'), true);
    assert.equal(await page.locator('#help-dialog .emblem[data-emblem="yoter"]').count(), 1, 'the rules carry the game emblem');
    await shot(page, '01-help');
    await page.keyboard.press('ArrowUp'); // the arrows do nothing while the rules are open
    await page.click('#help-close');
    assert.equal(await page.locator('.brand h1').innerText(), G.NAME);
    assert.ok((await page.locator('#puzzle-label').innerText()).includes(`חידה ${today}`));
    assert.equal(await page.locator('#theme-title').innerText(), chain.theme.title);
    assert.equal(await page.locator('#known-name').innerText(), chain.items[0].name);
    assert.equal(await flat(page.locator('#known-value')), G.formatValue(chain.theme, chain.items[0].value));
    assert.equal(await page.locator('#hidden-name').innerText(), chain.items[1].name);
    assert.ok((await flat(page.locator('#hidden-value'))).includes('?'));
    assert.ok(!(await flat(page.locator('#hidden-value'))).includes(String(chain.items[1].value)), 'the hidden number is not in the page');
    assert.equal(await page.locator('#pips li').count(), 10);
    assert.equal(await pips(page, 'now'), 1);
    assert.equal(await page.locator('#end').isHidden(), true);
    assert.equal(await page.locator('#more-btn').innerText(), chain.theme.more);
    assert.equal(await page.locator('.top .back').getAttribute('href'), '../../');
    assert.ok((await page.locator('.foot').innerText()).includes('ויקינתונים'));
    for (const id of ['#more-btn', '#less-btn', '#practice-link']) {
      const box = await page.locator(id).boundingBox();
      assert.ok(box.height >= 44 && box.width >= 44, `${id} is a thumb-sized target`);
    }
    assert.equal(await horizontalOverflow(page), 0, 'no horizontal scroll');
    assert.equal(dailyStatus(await readStore(page, 'yoter'), today), 'new', 'nothing counts as started before the first answer');
    await shot(page, '02-round-one');
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), false, 'rules are shown only once');
    await context.close();
  });

  await step('perfect day: reload mid-game, 10/10, share, stats, reload after the end', async () => {
    const { context, page } = await open(CALM);
    await page.click('#help-close');
    await give(page, right[0]);
    assert.equal(await page.locator('#known-name').innerText(), chain.items[1].name, 'the revealed item becomes the known one');
    assert.equal(await flat(page.locator('#known-value')), G.formatValue(chain.theme, chain.items[1].value));
    assert.equal(await page.locator('#hidden-name').innerText(), chain.items[2].name);
    await give(page, right[1], { keyboard: true });
    await give(page, right[2], { keyboard: true });
    await give(page, right[3]);
    assert.equal(await pips(page, 'right'), 4);

    let saved = await readStore(page, 'yoter');
    assert.deepEqual([saved.day, saved.finished, saved.won, saved.summary], [today, false, false, '']);
    assert.deepEqual(saved.progress.answers, right.slice(0, 4));
    assert.equal(dailyStatus(saved, today), 'playing');
    await shot(page, '03-midgame');

    await page.reload(); // progress survives a reload
    assert.equal(await isDialogOpen(page, '#help-dialog'), false);
    assert.equal(await pips(page, 'right'), 4);
    assert.equal(await page.locator('#known-name').innerText(), chain.items[4].name);

    await giveAll(page, right.slice(4));
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#end-title').innerText(), 'עשר מעשר!');
    assert.ok((await page.locator('#end-sub').innerText()).includes('10 מתוך 10'));
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').innerText(), '10/10', 'the score is stamped on the end sheet');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').getAttribute('data-tone'), 'found');
    assert.match(await page.locator('#countdown').innerText(), /^\d\d:\d\d:\d\d$/);
    assert.equal(await page.locator('#answer-bar').isHidden(), true);
    assert.equal(await page.locator('#duel').isHidden(), true);
    assert.equal(await page.locator('#end-streak').count(), 0, 'a streak of one is not announced');

    // The answer: the whole chain with its numbers.
    assert.equal(await page.locator('#recap-list li').count(), 11);
    assert.equal(await page.locator('#recap-list li.right').count(), 10);
    const lastRow = await flat(page.locator('#recap-list li').last());
    assert.ok(lastRow.includes(chain.items[10].name) && lastRow.includes(G.formatValue(chain.theme, chain.items[10].value)));

    const copied = await shareToClipboard(page);
    assert.equal(copied, G.shareText({ day: today, items: chain.items, answers: right, url: session.url }));
    assert.equal(copied, `${G.NAME} #${today} 10/10\n${'🟩'.repeat(10)}\n${session.url}`);
    for (const it of chain.items) assert.ok(!copied.includes(it.name), 'share text must not spoil the chain');
    const wa = await page.locator('#whatsapp-btn').getAttribute('href');
    assert.ok(wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes('10/10'));
    await shot(page, '04-perfect', { fullPage: true });

    saved = await readStore(page, 'yoter');
    assert.deepEqual([saved.day, saved.finished, saved.won, saved.summary, saved.seenHelp], [today, true, true, '10/10', true]);
    assert.equal(dailyStatus(saved, today), 'won');
    assert.equal(saved.stats.distribution.length, 11);

    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);
    await page.click('#stats-btn');
    assert.equal(await page.locator('#dist li').count(), 11, 'one bar per score, 0 to 10');
    assert.equal(await page.locator('#dist li').last().locator('.bar.today').innerText(), '1');
    await shot(page, '05-stats');
    await page.keyboard.press('Escape');

    await page.reload(); // a finished day survives a reload and is not counted twice
    assert.equal(await page.locator('#end-title').innerText(), 'עשר מעשר!');
    assert.equal(await page.locator('#recap-list li').count(), 11);
    assert.equal(await page.locator('#answer-bar').isHidden(), true);
    await page.keyboard.press('ArrowUp'); // nothing left to answer
    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);
    assert.deepEqual((await readStore(page, 'yoter')).progress.answers, right);
    await context.close();
  });

  await step('poor day in dark mode: all ten rounds are played, 0/10 is a loss', async () => {
    const { context, page } = await open({ ...CALM, colorScheme: 'dark' });
    await page.click('#help-close');
    await give(page, flip(right[0]));
    assert.equal(await pips(page, 'wrong'), 1);
    assert.equal(await page.locator('#end').isHidden(), true, 'a mistake does not end the daily game');
    await shot(page, '06-dark-midgame');
    await giveAll(page, right.slice(1).map(flip));
    assert.equal(await page.locator('#end-title').innerText(), 'מחר יום חדש');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').innerText(), '0/10');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').getAttribute('data-tone'), 'ink', 'a lost day is stamped in plain ink');
    assert.equal(await page.locator('#recap-list li.wrong').count(), 10);
    const copied = await shareToClipboard(page);
    assert.equal(copied, `${G.NAME} #${today} 0/10\n${'🟥'.repeat(10)}\n${session.url}`);
    const saved = await readStore(page, 'yoter');
    assert.deepEqual([saved.finished, saved.won, saved.summary], [true, false, '0/10']);
    assert.equal(dailyStatus(saved, today), 'lost');
    assert.deepEqual(await statNumbers(page), ['1', '0', '0', '0']);
    await page.click('#stats-btn');
    assert.equal(await page.locator('#dist li').first().locator('.bar').innerText(), '1', 'a low score still lands in the chart');
    await page.keyboard.press('Escape');
    await shot(page, '07-dark-poor', { fullPage: true });
    await context.close();
  });

  await step('new days: the board clears, seven right keeps the streak, six breaks it', async () => {
    const { context, page } = await open({ ...CALM, fixedTime: new Date('2026-12-01T10:00:00Z') });
    const day = dayNumber('2026-12-01');
    const answersFor = (d, wrong) => rightAnswers(G.chainForDay(d).items).map((a, i) => (i < wrong ? flip(a) : a));
    await page.click('#help-close');
    assert.ok((await page.locator('#puzzle-label').innerText()).includes(`חידה ${day}`));
    assert.equal(await page.locator('#theme-title').innerText(), G.themeForDay(day).title);
    await giveAll(page, answersFor(day, 0));
    assert.equal(await page.locator('#end-title').innerText(), 'עשר מעשר!');

    await page.clock.setFixedTime(new Date('2026-12-02T10:00:00Z'));
    await page.reload();
    assert.equal(await pips(page, 'right') + await pips(page, 'wrong'), 0, "yesterday's answers are cleared");
    assert.equal(await page.locator('#end').isHidden(), true);
    assert.equal(await page.locator('#theme-title').innerText(), G.themeForDay(day + 1).title);
    assert.equal(await page.locator('#known-name').innerText(), G.chainForDay(day + 1).items[0].name);
    await giveAll(page, answersFor(day + 1, 3));
    assert.equal(await page.locator('#end-title').innerText(), 'יפה מאוד');
    assert.ok((await page.locator('#end-streak').innerText()).includes('2'));
    assert.equal((await readStore(page, 'yoter')).summary, '7/10');
    assert.deepEqual(await statNumbers(page), ['2', '100', '2', '2']);

    await page.clock.setFixedTime(new Date('2026-12-03T10:00:00Z'));
    await page.reload();
    await giveAll(page, answersFor(day + 2, 4));
    assert.equal(await page.locator('#end-title').innerText(), 'לא רע בכלל');
    assert.equal(await page.locator('#end-streak').count(), 0);
    const saved = await readStore(page, 'yoter');
    assert.deepEqual([saved.day, saved.won, saved.summary], [day + 2, false, '6/10']);
    assert.deepEqual(await statNumbers(page), ['3', '67', '0', '2']);
    assert.deepEqual([saved.stats.distribution[10], saved.stats.distribution[7], saved.stats.distribution[6]], [1, 1, 1]);
    await context.close();
  });

  await step('sudden death: first mistake ends the run, best run is remembered, nothing is counted', async () => {
    const { context, page } = await open(CALM);
    await page.click('#help-close');
    await give(page, right[0]); // one daily answer first, to see that practice leaves it alone
    await page.click('#practice-link');
    assert.equal(await page.locator('#mode-banner').isVisible(), true);
    assert.ok((await page.locator('#puzzle-label').innerText()).includes('מוות פתאומי'));
    assert.equal(await page.locator('#pips').isHidden(), true);
    assert.equal(await page.locator('#theme-select').inputValue(), chain.theme.id, 'practice starts on the theme of the day');
    assert.equal(await page.locator('#theme-select option').count(), G.THEMES.length);

    for (let i = 0; i < 3; i++) await give(page, await rightNow(page, chain.theme));
    assert.ok((await flat(page.locator('#run'))).includes('רצף נוכחי 3'));
    assert.equal(await page.locator('#end').isHidden(), true);
    await shot(page, '08-practice');
    await give(page, flip(await rightNow(page, chain.theme)));
    assert.equal(await page.locator('#end-title').innerText(), '3 ברצף');
    assert.equal(await page.locator('#end-sub').innerText(), 'עוד לא הגעתם רחוק כל כך בנושא הזה', 'the line under the "new record" stamp adds to it instead of repeating it');
    assert.equal(await page.locator('#hidden-value .num.unknown').count(), 0, 'the pair that ended the run stays on screen, revealed');
    assert.equal(await page.locator('#card-hidden.wrong').count(), 1);
    assert.equal(await page.locator('#card-hidden .card-stamp .fx-stamp').innerText(), 'טעות', 'and keeps its stamp');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').innerText(), 'שיא חדש');
    assert.equal(await page.locator('#share-btn').count(), 0);
    assert.equal(await page.locator('#countdown').count(), 0);
    assert.equal(await page.locator('#answer-bar').isHidden(), true);
    await shot(page, '09-practice-over', { fullPage: true });
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('hd:yoter:best'))), { [chain.theme.id]: 3 });

    await page.click('#again-btn'); // a shorter run does not lower the record
    await give(page, await rightNow(page, chain.theme));
    await give(page, flip(await rightNow(page, chain.theme)));
    assert.equal(await page.locator('#end-title').innerText(), '1 ברצף');
    assert.ok((await page.locator('#end-sub').innerText()).includes('3'));

    await page.reload(); // the record survives a reload; the daily game is where it was
    assert.equal(await pips(page, 'right'), 1);
    await page.click('#practice-link');
    assert.ok((await flat(page.locator('#run'))).includes('השיא בנושא הזה 3'));

    const other = G.THEMES.find((t) => t !== chain.theme); // another theme keeps its own record
    await page.selectOption('#theme-select', other.id);
    assert.equal(await page.locator('#theme-title').innerText(), other.title);
    assert.equal(await page.locator('#more-btn').innerText(), other.more);
    assert.ok((await flat(page.locator('#run'))).includes('השיא בנושא הזה 0'));
    await give(page, flip(await rightNow(page, other)));
    assert.equal(await page.locator('#end-title').innerText(), 'נפלתם כבר בראשון');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('hd:yoter:best'))), { [chain.theme.id]: 3 });

    await page.click('#daily-btn');
    assert.equal(await page.locator('#mode-banner').isHidden(), true);
    assert.equal(await page.locator('#theme-title').innerText(), chain.theme.title);
    assert.equal(await page.locator('#known-name').innerText(), chain.items[1].name);
    const saved = await readStore(page, 'yoter');
    assert.deepEqual(saved.progress.answers, [right[0]], 'practice answers never reach the daily store');
    assert.equal(saved.finished, false);
    assert.deepEqual(await statNumbers(page), ['0', '0', '0', '0'], 'practice is not counted');
    await context.close();
  });

  await step('with motion on: the number counts up, the verdict shows, the next round slides in', async () => {
    const { context, page } = await open();
    await page.click('#help-close');
    await page.click(right[0] === 'more' ? '#more-btn' : '#less-btn');
    assert.equal(await page.locator('#more-btn').isDisabled(), true, 'no second answer during a reveal');
    assert.equal((await readStore(page, 'yoter')).progress.answers.length, 1, 'saved before the animation ends');
    // The number rolls in like an odometer: one strip per digit, each ending on its digit.
    const digits = G.valueParts(chain.theme, chain.items[1].value).number.replace(/\D/g, '');
    assert.equal(await page.locator('#hidden-value .odo .odo-col').count(), digits.length);
    assert.equal((await page.locator('#hidden-value .odo-strip span:last-child').allTextContents()).join(''), digits);
    assert.equal(await page.locator('#more-btn.picked, #less-btn.picked').count(), 1, 'the key that was pressed stays down');
    await page.locator('#verdict.right').waitFor();
    assert.equal(await page.locator('#hidden-value .odo').count(), 0, 'the strips are replaced by the plain number');
    assert.equal(await page.locator('#card-hidden .card-stamp .fx-stamp').innerText(), 'נכון', 'the ruling is stamped on the card');
    assert.equal(await flat(page.locator('#hidden-value')), G.formatValue(chain.theme, chain.items[1].value), 'the count-up lands on the exact number');
    assert.equal(await page.locator('#card-hidden.right').count(), 1);
    await shot(page, '10-reveal-right', { settle: 150 });
    await playable(page);
    assert.equal(await page.locator('#duel.advance').count(), 1);
    assert.equal(await page.locator('#known-name').innerText(), chain.items[1].name);
    assert.equal(await page.locator('#card-hidden .card-stamp').count(), 0, 'the new card is clean');
    assert.equal(await page.locator('#duel .card.leaving').count(), 1, 'the old card is on its way out');
    await page.locator('#duel .card.leaving').waitFor({ state: 'detached' });

    await page.keyboard.press(right[1] === 'more' ? 'ArrowDown' : 'ArrowUp');
    await page.keyboard.press('ArrowUp'); // ignored: a reveal is running
    await page.locator('#verdict.wrong').waitFor();
    assert.equal(await page.locator('#card-hidden .card-stamp .fx-stamp').innerText(), 'טעות');
    await shot(page, '11-reveal-wrong', { settle: 150 });
    await playable(page);
    assert.equal(await pips(page, 'right'), 1);
    assert.equal(await pips(page, 'wrong'), 1);
    assert.equal((await readStore(page, 'yoter')).progress.answers.length, 2);
    await context.close();
  });

  await step('narrow phone, desktop, and corrupted storage', async () => {
    const narrow = await open({ ...CALM, viewport: { width: 360, height: 640 } });
    await narrow.page.click('#help-close');
    assert.equal(await horizontalOverflow(narrow.page), 0, 'no horizontal scroll at 360px');
    const bar = await narrow.page.locator('#answer-bar').boundingBox();
    assert.ok(bar.y + bar.height <= 640, 'both answer buttons are on screen without scrolling');
    await shot(narrow.page, '12-narrow');
    await narrow.page.click('#practice-link');
    assert.equal(await horizontalOverflow(narrow.page), 0, 'no horizontal scroll in practice at 360px');
    await shot(narrow.page, '13-narrow-practice');
    await narrow.page.click('#back-to-daily');
    await giveAll(narrow.page, right.map((a, i) => (i % 3 === 0 ? flip(a) : a)));
    assert.equal(await horizontalOverflow(narrow.page), 0, 'no horizontal scroll on the end panel at 360px');
    await shot(narrow.page, '14-narrow-end', { fullPage: true });
    await narrow.context.close();

    // The longest names of every theme must fit the narrow card too.
    const longest = await open({ ...CALM, viewport: { width: 360, height: 640 } });
    await longest.page.click('#help-close');
    await longest.page.click('#practice-link');
    for (const theme of G.THEMES) {
      await longest.page.selectOption('#theme-select', theme.id);
      const name = [...theme.items].sort((a, b) => b.name.length - a.name.length)[0].name;
      await longest.page.evaluate((text) => { for (const id of ['known-name', 'hidden-name']) document.getElementById(id).textContent = text; }, name);
      assert.equal(await horizontalOverflow(longest.page), 0, `"${name}" overflows at 360px`);
    }
    await longest.context.close();

    const { context, page } = await open({ ...CALM, viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    await page.evaluate(() => {
      localStorage.setItem('hd:yoter', '{not json');
      localStorage.setItem('hd:yoter:best', '[1, 2');
    });
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true, 'recovers from corrupted storage');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#known-name').innerText(), chain.items[0].name);
    await page.evaluate(() => localStorage.setItem('hd:yoter', JSON.stringify({ seenHelp: true, day: 'x', progress: { answers: ['more', 7, 'sideways'] }, stats: 5 })));
    await page.reload();
    assert.equal(await pips(page, 'right') + await pips(page, 'wrong'), 0, 'junk progress is ignored');
    await give(page, right[0], { keyboard: true });
    assert.equal(await pips(page, 'right'), 1);
    await shot(page, '15-desktop');
    await context.close();
  });
});

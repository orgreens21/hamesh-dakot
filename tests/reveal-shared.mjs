// The browser scenarios shared by מי אני? and בלי מילים: both run on shared/reveal-ui.js, so they are
// played the same way. tests/miani.e2e.mjs and tests/blimilim.e2e.mjs call this with their own game.
import assert from 'node:assert/strict';
import { createSession, horizontalOverflow, shareToClipboard, isDialogOpen, readStore } from './helpers.mjs';
import { dayNumber, israelDate, dailyStatus } from '../shared/core.js';

/** Noon in Israel on a given puzzle day: puzzle #1 is 14 November 2026. */
const noonOfDay = (day) => new Date(Date.UTC(2026, 10, 14 + day - 1, 10));
const SKIP_GUARD = 560; // a second tap on "one more clue" within half a second is ignored

export async function revealScenarios({ slug, port, G, stage }) {
  const session = await createSession({ slug, port });
  const { open, step, shot } = session;

  const wrongFor = (puzzle) => G.ENTRIES.filter((e) => e.name !== puzzle.answer).map((e) => e.name);

  /** Types a name and picks it from the suggestion list with the keyboard. */
  async function guess(page, name) {
    await page.fill('#guess-input', name);
    const at = G.search(name).findIndex((e) => e.name === name);
    assert.ok(at >= 0, `${name} is offered`);
    for (let i = 0; i < at; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
  }
  async function skip(page) {
    await page.click('#skip-btn');
    await page.waitForTimeout(SKIP_GUARD);
  }
  const statNumbers = async (page) => {
    await page.click('#stats-btn');
    const numbers = await page.locator('.stat-grid b').allInnerTexts();
    await page.keyboard.press('Escape');
    return numbers;
  };

  await session.run(async () => {
    const today = dayNumber(israelDate());
    const puzzle = G.puzzleForDay(today);
    const wrong = wrongFor(puzzle);

    await step('first visit shows the rules once, then the first stage only', async () => {
      const { context, page } = await open();
      assert.equal(await isDialogOpen(page, '#help-dialog'), true);
      assert.equal(await page.locator(`#help-dialog .emblem[data-emblem="${slug}"]`).count(), 1);
      await shot(page, '01-help');
      await page.click('#help-close');
      assert.equal(await page.locator('.brand h1').innerText(), G.NAME);
      assert.ok((await page.locator('#puzzle-label').innerText()).includes(`חידה ${today}`));
      assert.equal(await page.locator('#kicker').innerText(), G.kicker(puzzle));
      assert.equal(await page.locator('#steps li').count(), 5);
      assert.equal(await page.locator('#steps li.now').count(), 1);
      await stage.checkOpened(page, puzzle, 1);
      assert.equal(await page.locator('#end').isHidden(), true);
      for (const id of ['#guess-input', '#skip-btn']) {
        const box = await page.locator(id).boundingBox();
        assert.ok(box.height >= 44, `${id} is a thumb-sized target`);
      }
      assert.equal(await horizontalOverflow(page), 0);
      assert.equal(dailyStatus(await readStore(page, slug), today), 'new');
      await shot(page, '02-first-stage');
      await page.reload();
      assert.equal(await isDialogOpen(page, '#help-dialog'), false, 'rules are shown only once');
      await context.close();
    });

    await step('a win at stage three: a skip, a miss, a reload, the answer; share, stats, reload after the end', async () => {
      const { context, page } = await open();
      await page.click('#help-close');
      await page.fill('#guess-input', 'קקקקקק');
      await page.keyboard.press('Enter'); // nothing in the list: nothing is spent
      assert.equal(await page.locator('#steps li.now').innerText(), '1');
      await skip(page);
      await page.dblclick('#skip-btn'); // a double tap opens one clue, not two
      await page.waitForTimeout(SKIP_GUARD);
      assert.equal(await page.locator('#steps li.skip').count(), 2);
      await page.reload();
      assert.equal(await page.locator('#steps li.skip').count(), 2, 'progress survives a reload');
      await stage.checkOpened(page, puzzle, 3);
      let saved = await readStore(page, slug);
      assert.deepEqual(saved.progress.moves, [null, null]);
      assert.equal(dailyStatus(saved, today), 'playing');
      await guess(page, puzzle.answer);

      assert.equal(await page.locator('#end').isVisible(), true);
      assert.equal(await page.locator('#end-title').innerText(), G.endTitle(3));
      assert.ok((await page.locator('#end-sub').innerText()).includes(puzzle.answer));
      assert.equal(await page.locator('#end .end-stamp .fx-stamp').innerText(), '3/5');
      assert.equal(await page.locator('#guess-form').isHidden(), true);
      assert.equal(await page.locator('#skip-btn').isHidden(), true);
      await stage.checkOpened(page, puzzle, 5);
      const copied = (await shareToClipboard(page)).replace(/\r\n/g, '\n'); // the Windows clipboard writes CRLF
      assert.equal(copied, `${G.NAME} #${today} 3/5\n⬛⬛🟩⬜⬜\n${session.url}`);
      assert.ok(!copied.includes(puzzle.answer));
      await shot(page, '03-won', { fullPage: true });

      saved = await readStore(page, slug);
      assert.deepEqual([saved.finished, saved.won, saved.summary], [true, true, '3/5']);
      assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);
      await page.reload();
      assert.equal(await page.locator('#end-title').innerText(), G.endTitle(3));
      assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1'], 'not counted twice');
      await context.close();
    });

    await step('a loss: misses and skips to the end show the answer, X/5, and an archive round is not counted', async () => {
      const { context, page } = await open();
      await page.click('#help-close');
      await guess(page, wrong[0]);
      assert.equal(await page.locator('#log li.wrong').count(), 1);
      assert.ok((await page.locator('#log').innerText()).includes(wrong[0]));
      await guess(page, wrong[0]);
      assert.equal(await page.locator('#steps li.wrong').count(), 1, 'the same miss twice is not spent again');
      for (let i = 0; i < 3; i++) await skip(page);
      assert.ok((await page.locator('#skip-btn').innerText()).includes('גלו לי'), 'the last skip says what it does');
      await skip(page);
      assert.equal(await page.locator('#end-title').innerText(), 'לא הפעם');
      assert.ok((await page.locator('#end-sub').innerText()).includes(puzzle.answer));
      assert.equal((await readStore(page, slug)).summary, 'X/5');
      assert.deepEqual(await statNumbers(page), ['1', '0', '0', '0']);
      if (today > 1) {
        await page.click('#archive-btn');
        assert.equal(await page.locator('#mode-banner').isVisible(), true);
        assert.equal(await page.locator('#end').isHidden(), true);
        await skip(page);
        assert.equal((await readStore(page, slug)).progress.moves.length, 5, 'the archive leaves today alone');
        await page.click('#mode-banner .link');
        assert.equal(await page.locator('#end-title').innerText(), 'לא הפעם');
      }
      await context.close();
    });

    await step('a new day keeps the streak', async () => {
      const day = Math.max(today, 3);
      const { context, page } = await open({ fixedTime: noonOfDay(day) });
      await page.click('#help-close');
      await guess(page, G.puzzleForDay(day).answer);
      assert.equal(await page.locator('#end-title').innerText(), G.endTitle(1));
      await page.clock.setFixedTime(noonOfDay(day + 1));
      await page.reload();
      assert.ok((await page.locator('#puzzle-label').innerText()).includes(`חידה ${day + 1}`));
      assert.equal(await page.locator('#end').isHidden(), true);
      await guess(page, G.puzzleForDay(day + 1).answer);
      assert.equal(await page.locator('#end-streak').innerText(), 'רצף של 2 ימים');
      await context.close();
    });

    await step('dark mode and a 360px phone; corrupted storage', async () => {
      const { context, page } = await open({ colorScheme: 'dark', viewport: { width: 360, height: 640 } });
      await page.click('#help-close');
      await skip(page);
      await page.fill('#guess-input', puzzle.answer.slice(0, 2));
      assert.equal(await horizontalOverflow(page), 0);
      await shot(page, '04-dark-narrow');
      await page.keyboard.press('Escape');
      await page.evaluate((key) => localStorage.setItem(key, '{not json'), `hd:${slug}`);
      await page.reload();
      assert.equal(await page.locator('#steps li.now').innerText(), '1', 'junk in storage starts the day afresh');
      await context.close();
    });
  });
}

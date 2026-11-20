// End-to-end test for צומת. Usage: node tests/herkev.e2e.mjs   (or: npm run test:e2e -- herkev)
import assert from 'node:assert/strict';
import { createSession, horizontalOverflow, shareToClipboard, isDialogOpen, readStore } from './helpers.mjs';
import * as G from '../games/herkev/game.js';
import { dayNumber, israelDate, dateOfDay } from '../shared/core.js';

const session = await createSession({ slug: 'herkev', port: 4185 });
const { step, shot } = session;

for (const topic of G.TOPIC_IDS) await G.loadTopic(topic);
const indexes = Object.fromEntries(G.TOPIC_IDS.map((t) => [t, G.buildSearchIndex(G.itemsOf(t))]));
const position = (topic, item) => G.searchItems(indexes[topic], item.name).findIndex((p) => p.id === item.id);

/** Opens the page and waits until the day's answer list has loaded and the cells can be played. */
async function open(options, subPath) {
  const opened = await session.open(options, subPath);
  await opened.page.waitForSelector('#grid[data-ready="true"]');
  return opened;
}

/** Opens a cell, types the answer's name and picks that exact answer from the list. */
async function pick(page, cell, item, topic = currentTopic) {
  await page.click(`#cell-${cell}`);
  await page.fill('#player-input', item.name);
  const at = position(topic, item);
  assert.ok(at >= 0, `${item.name} is offered by the search`);
  await page.click(`#sg-${at}`);
}
let currentTopic = null;

/** Answers that do not fit a cell, skipping the ones a test still needs. */
function wrongPlayers(grid, cell, count, skip = []) {
  const valid = new Set(G.answersFor(grid, cell).map((p) => p.id));
  return G.itemsOf(grid.topic).filter((p) => !valid.has(p.id) && !skip.includes(p.id)).slice(0, count);
}

async function playPerfect(page, grid, from = 0) {
  const solution = G.solve(grid);
  for (let cell = from; cell < G.CELLS; cell++) await pick(page, cell, solution[cell], grid.topic);
  return solution;
}

const statNumbers = async (page) => {
  await page.click('#stats-btn');
  const numbers = await page.locator('.stat-grid b').allInnerTexts();
  await page.keyboard.press('Escape');
  return numbers;
};
const triesLeft = (page) => page.locator('#tries b').innerText();
const noon = (day) => new Date(dateOfDay(day).getTime());

await session.run(async () => {
  const today = dayNumber(israelDate());
  const grid = G.gridForDay(today);
  currentTopic = grid.topic;

  await step('first visit shows the rules once, then an empty grid', async () => {
    const { context, page } = await open();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true);
    const rules = await page.locator('#help-dialog').innerText();
    assert.ok(rules.includes('ויקינתונים') && rules.includes('אינו שלם'), 'the rules are upfront about the source and its gaps');
    assert.ok(rules.includes(`הנושא היום: ${G.topicOf(grid).label}`), "the rules name today's topic");
    await shot(page, '01-help');
    await page.click('#help-close');
    assert.equal(await page.locator('#grid .cell').count(), 9);
    assert.equal(await page.locator('#grid .head').count(), 6);
    assert.equal(await page.locator('#grid .board').count(), 1);
    const topicText = await page.locator('#topic').innerText();
    assert.ok(topicText.includes('נושא היום') && topicText.includes(G.topicOf(grid).label), `the day's topic is shown: ${topicText}`);
    assert.equal(await page.locator('#player-input').getAttribute('placeholder'), G.topicOf(grid).placeholder);
    assert.equal(await page.locator('#grid .cell.is-flipped').count(), 0, 'every card shows its empty slot');
    assert.equal(await page.locator('#tokens li').count(), G.MAX_GUESSES, 'one counter per guess');
    assert.equal(await page.locator('#tokens li.spent').count(), 0);
    assert.equal(await page.locator('#help-dialog .emblem[data-emblem="herkev"]').count(), 1, 'the rules carry the game emblem');
    assert.equal(await page.locator('#grid .cell:not(:disabled)').count(), 9);
    assert.equal(await triesLeft(page), '9');
    assert.equal(await page.locator('#end').isHidden(), true);
    assert.equal(await page.locator('#answers').isHidden(), true);
    assert.equal(await page.locator('.brand h1').innerText(), G.NAME);
    assert.ok((await page.locator('#puzzle-label').innerText()).includes(`צומת ${today}`));
    const heads = await page.locator('#grid .head').allInnerTexts();
    assert.deepEqual(heads.map((t) => t.trim()), [...grid.cols, ...grid.rows].map((id) => G.criterion(id).name));
    assert.ok((await page.locator('.foot').innerText()).includes('ויקינתונים'), 'the footer credits the source');
    assert.equal(await horizontalOverflow(page), 0, 'no horizontal scroll');
    const saved = await readStore(page, 'herkev');
    assert.deepEqual([saved.seenHelp, saved.progress, saved.finished], [true, null, false], 'the hub still sees a new game');
    await shot(page, '02-empty');
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), false, 'rules are shown only once');
    await context.close();
  });

  await step('perfect grid: saved after every move, survives reloads, share, stats, other answers', async () => {
    const { context, page } = await open();
    await page.click('#help-close');
    const solution = G.solve(grid);
    for (let cell = 0; cell < 3; cell++) await pick(page, cell, solution[cell]);
    assert.equal(await triesLeft(page), '6');
    assert.equal(await page.locator('#cell-0').innerText(), solution[0].name);
    assert.equal(await page.locator('#cell-0').isDisabled(), true);
    assert.equal(await page.locator('#cell-0.is-flipped .sticker').innerText(), solution[0].name, 'a right answer turns the card over to its sticker');
    assert.equal(await page.locator('#tokens li.spent.hit').count(), 3);
    assert.equal(await page.locator('#tokens li:not(.spent)').count(), 6);
    assert.equal(await page.locator('#tokens').getAttribute('aria-label'), 'ניחושים: 3 נכונים, 0 שגויים, 6 נותרו');
    let saved = await readStore(page, 'herkev');
    assert.deepEqual([saved.day, saved.finished, saved.won, saved.summary], [today, false, false, '']);
    assert.equal(saved.progress.guesses.length, 3, 'the hub sees a game in progress');

    await page.reload(); // mid-game reload loses nothing
    assert.equal(await page.locator('#grid .cell.right').count(), 3);
    assert.equal(await triesLeft(page), '6');
    assert.equal(await page.locator('#cell-1').innerText(), solution[1].name);

    // The guess dialog: criteria of the cell, keyboard pick with Enter.
    await page.click('#cell-3');
    assert.equal(await isDialogOpen(page, '#guess-dialog'), true);
    const [row, col] = G.cellCriteria(grid, 3).map(G.criterion);
    const dialogText = await page.locator('#guess-criteria').innerText();
    assert.ok(dialogText.includes(row.name) && dialogText.includes(col.name));
    await page.fill('#player-input', solution[3].name);
    await shot(page, '03-guess-dialog');
    const at = position(currentTopic, solution[3]);
    for (let i = 0; i < at; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await isDialogOpen(page, '#guess-dialog'), false);
    assert.equal(await page.locator('#cell-3').innerText(), solution[3].name);
    assert.ok((await page.locator('#toast').innerText()).includes('בפנים'));
    await shot(page, '04-midgame');

    await playPerfect(page, grid, 4);
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#end-title').innerText(), 'רשת מושלמת!');
    assert.ok((await page.locator('#end-sub').innerText()).includes('9 מתוך 9'));
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').innerText(), '9/9', 'the score is stamped on the end sheet');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').getAttribute('data-tone'), 'found');
    assert.equal(await page.locator('#tokens li.spent.hit').count(), 9);
    assert.match(await page.locator('#countdown').innerText(), /^\d\d:\d\d:\d\d$/);
    assert.equal(await page.locator('#grid .cell:not(:disabled)').count(), 0);
    assert.equal(await page.locator('#giveup-btn').isHidden(), true);

    // After the game every cell lists other players that would have fitted.
    assert.equal(await page.locator('#answers-list li').count(), 9);
    for (let cell = 0; cell < G.CELLS; cell++) {
      const text = await page.locator(`#answer-${cell} .answer-names`).innerText();
      const others = G.answersFor(grid, cell).filter((p) => p.id !== solution[cell].id).slice(0, 3);
      assert.ok(text.includes(solution[cell].name), `cell ${cell} shows the player's own answer`);
      for (const p of others) assert.ok(text.includes(p.name), `cell ${cell} lists ${p.name}`);
    }

    const copied = await shareToClipboard(page);
    assert.equal(copied, G.shareText({ day: today, grid, guesses: solution.map((p, cell) => [cell, p.id]), url: session.url }));
    assert.ok(copied.startsWith(`${G.NAME} #${today} 9/9 · ${G.topicOf(grid).label}\n🟩🟩🟩\n🟩🟩🟩\n🟩🟩🟩\n`), copied);
    assert.ok(copied.trim().endsWith(session.url));
    for (const p of solution) assert.ok(!copied.includes(p.name), 'share text must not spoil an answer');
    for (const id of [...grid.rows, ...grid.cols]) assert.ok(!copied.includes(G.criterion(id).name), 'share text must not spoil a criterion');
    const wa = await page.locator('#whatsapp-btn').getAttribute('href');
    assert.ok(wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes('9/9'));
    await shot(page, '05-perfect', { fullPage: true });

    saved = await readStore(page, 'herkev');
    assert.deepEqual([saved.day, saved.finished, saved.won, saved.summary, saved.seenHelp], [today, true, true, '9/9', true]);
    assert.equal(saved.stats.distribution.length, 10);

    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);
    await page.click('#stats-btn');
    assert.equal(await page.locator('#dist li').count(), 10);
    assert.equal(await page.locator('#dist .bar.today').innerText(), '1');
    assert.ok((await page.locator('#dist li').nth(9).innerText()).startsWith('9'));
    await shot(page, '06-stats');
    await page.keyboard.press('Escape');

    await page.reload(); // a finished game survives a reload and is not counted twice
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#grid .cell.right').count(), 9);
    assert.equal(await page.locator('#answers-list li').count(), 9);
    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);
    await context.close();
  });

  await step('dark mode: wrong guesses use up attempts, a player cannot be used twice, nine misses end the game', async () => {
    const { context, page } = await open({ colorScheme: 'dark' });
    await page.click('#help-close');
    const solution = G.solve(grid);
    const keep = solution.map((p) => p.id);

    await pick(page, 0, solution[0]);
    assert.equal(await triesLeft(page), '8');

    // The same player in a second cell is refused and costs nothing.
    await pick(page, 1, solution[0]);
    assert.equal(await isDialogOpen(page, '#guess-dialog'), true, 'the dialog stays open');
    assert.ok((await page.locator('#guess-note').innerText()).includes('כבר שיבצתם'));
    assert.equal(await page.locator('#suggestions li.used').count() >= 1, true);
    await page.click('#guess-cancel');
    assert.equal(await triesLeft(page), '8');
    assert.equal(await page.locator('#grid .cell.right').count(), 1);

    // A wrong guess costs one attempt and leaves the cell open.
    const [miss, ...moreMisses] = wrongPlayers(grid, 1, 8, keep);
    await pick(page, 1, miss);
    assert.equal(await isDialogOpen(page, '#guess-dialog'), false);
    assert.ok((await page.locator('#toast').innerText()).includes('לא מתאים'));
    assert.equal(await triesLeft(page), '7');
    assert.equal(await page.locator('#cell-1').isDisabled(), false);
    assert.equal(await page.locator('#cell-1 .misses i').count(), 1);
    assert.equal(await page.locator('#cell-1 .misses i.new').count(), 1, 'the red card that was just shown drops in');
    assert.equal(await page.locator('#cell-1.is-flipped').count(), 0, 'a miss leaves the slot face up');
    assert.deepEqual([await page.locator('#tokens li.spent.hit').count(), await page.locator('#tokens li.spent.miss').count()], [1, 1]);

    // Trying the same wrong player in the same cell again is refused too.
    await pick(page, 1, miss);
    assert.ok((await page.locator('#guess-note').innerText()).includes('כבר ניסיתם'));
    assert.ok((await page.locator('#guess-tried').innerText()).includes(miss.name));
    await shot(page, '07-refused-dark');
    await page.keyboard.press('Escape');
    assert.equal(await triesLeft(page), '7');
    assert.equal((await readStore(page, 'herkev')).progress.guesses.length, 2);

    await page.reload(); // misses survive a reload as well
    assert.equal(await triesLeft(page), '7');
    assert.equal(await page.locator('#cell-1 .misses i').count(), 1);

    for (const p of moreMisses.slice(0, 7)) await pick(page, 1, p);
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await triesLeft(page), '0');
    assert.equal(await page.locator('#grid .cell:not(:disabled)').count(), 0);
    assert.equal(await page.locator('#grid .cell.missed').count(), 8);
    assert.ok((await page.locator('#end-sub').innerText()).includes('1 מתוך 9'));
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').innerText(), '1/9');
    assert.equal(await page.locator('#end .end-stamp .fx-stamp').getAttribute('data-tone'), 'ink', 'a lost day is stamped in plain ink');
    assert.equal(await page.locator('#tokens li.spent.miss').count(), 8);
    assert.equal(await page.locator('#answers-list li').count(), 9);
    const copied = await shareToClipboard(page);
    assert.ok(copied.startsWith(`${G.NAME} #${today} 1/9 · ${G.topicOf(grid).label}\n🟩⬜⬜\n⬜⬜⬜\n⬜⬜⬜\n`), copied);
    const saved = await readStore(page, 'herkev');
    assert.deepEqual([saved.finished, saved.won, saved.summary], [true, false, '1/9']);
    assert.deepEqual(await statNumbers(page), ['1', '0', '0', '0']);
    await page.click('#stats-btn');
    assert.ok((await page.locator('#dist li').nth(1).innerText()).includes('1'), 'a lost day is charted under one cell');
    await page.keyboard.press('Escape');
    await shot(page, '08-loss-dark', { fullPage: true });
    await context.close();
  });

  await step('giving up takes two taps and ends the day with what was filled', async () => {
    const { context, page } = await open();
    await page.click('#help-close');
    const solution = G.solve(grid);
    for (let cell = 0; cell < 5; cell++) await pick(page, cell, solution[cell]);
    await page.click('#giveup-btn');
    assert.equal(await page.locator('#end').isHidden(), true, 'one tap only asks');
    assert.ok((await page.locator('#giveup-btn').innerText()).includes('בטוחים'));
    await page.click('#giveup-btn');
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#end-title').innerText(), G.endTitle(5));
    const saved = await readStore(page, 'herkev');
    assert.deepEqual([saved.finished, saved.won, saved.summary, saved.progress.gaveUp], [true, true, '5/9', true]);
    await page.reload();
    assert.equal(await page.locator('#end').isVisible(), true);
    assert.equal(await page.locator('#grid .cell:not(:disabled)').count(), 0);
    assert.deepEqual(await statNumbers(page), ['1', '100', '1', '1']);
    await context.close();
  });

  await step('a new day clears the grid and keeps the streak', async () => {
    const day = dayNumber('2026-12-01');
    const { context, page } = await open({ fixedTime: new Date('2026-12-01T10:00:00Z') });
    await page.click('#help-close');
    await playPerfect(page, G.gridForDay(day));
    assert.equal(await page.locator('#end-title').innerText(), 'רשת מושלמת!');
    assert.equal(await page.locator('#end-streak').count(), 0, 'no streak line on the first day');

    await page.clock.setFixedTime(new Date('2026-12-02T10:00:00Z'));
    await page.reload();
    assert.ok((await page.locator('#puzzle-label').innerText()).includes(`צומת ${day + 1}`));
    assert.equal(await page.locator('#grid .cell.right').count(), 0, "yesterday's players are cleared");
    assert.equal(await triesLeft(page), '9');
    assert.equal(await page.locator('#end').isHidden(), true);
    assert.notDeepEqual(G.gridForDay(day + 1), G.gridForDay(day));
    const saved = await readStore(page, 'herkev');
    assert.equal(saved.stats.played, 1);
    await playPerfect(page, G.gridForDay(day + 1));
    assert.ok((await page.locator('#end-streak').innerText()).includes('2'));
    assert.deepEqual(await statNumbers(page), ['2', '100', '2', '2']);
    await context.close();
  });

  await step('archive: an earlier grid can be played, and is neither saved nor counted', async () => {
    const day = dayNumber('2026-12-05');
    const { context, page } = await open({ fixedTime: new Date('2026-12-05T10:00:00Z') });
    await page.click('#help-close');
    await page.click('#archive-btn');
    assert.equal(await isDialogOpen(page, '#archive-dialog'), true);
    assert.equal(await page.locator('#archive-list a').count(), day - 1);
    await shot(page, '09-archive-list');
    await page.click(`#archive-list a[href="?day=${day - 2}"]`);
    await page.waitForURL(/\?day=/);

    assert.equal(await page.locator('#mode-banner').isVisible(), true);
    assert.ok((await page.locator('#mode-banner').innerText()).includes('לא נספר'));
    assert.ok((await page.locator('#puzzle-label').innerText()).includes(`צומת ${day - 2}`));
    const old = G.gridForDay(day - 2);
    const heads = await page.locator('#grid .head').allInnerTexts();
    assert.deepEqual(heads.map((t) => t.trim()), [...old.cols, ...old.rows].map((id) => G.criterion(id).name));
    await playPerfect(page, old);
    assert.equal(await page.locator('#end-title').innerText(), 'רשת מושלמת!');
    assert.equal(await page.locator('#share-btn').count(), 0);
    assert.equal(await page.locator('#countdown').count(), 0);
    assert.equal(await page.locator('#answers-list li').count(), 9);
    await shot(page, '10-archive-end', { fullPage: true });
    const saved = await readStore(page, 'herkev');
    assert.deepEqual([saved.finished, saved.progress, saved.stats.played], [false, null, 0], 'nothing was saved');
    assert.deepEqual(await statNumbers(page), ['0', '0', '0', '0']);

    await page.click('#today-btn');
    await page.waitForURL((url) => !url.search);
    assert.equal(await page.locator('#mode-banner').isHidden(), true);
    assert.ok((await page.locator('#puzzle-label').innerText()).includes(`צומת ${day}`));
    assert.equal(await page.locator('#grid .cell:not(:disabled)').count(), 9, "today's grid is untouched");
    await context.close();

    // Bad or out-of-range archive links fall back to today's grid; before puzzle 1 there is no archive.
    for (const query of [`?day=${day}`, `?day=${day + 3}`, '?day=0', '?day=abc']) {
      const bad = await open({ fixedTime: new Date('2026-12-05T10:00:00Z') }, query);
      await bad.page.click('#help-close');
      assert.equal(await bad.page.locator('#mode-banner').isHidden(), true, query);
      assert.ok((await bad.page.locator('#puzzle-label').innerText()).includes(`צומת ${day}`), query);
      await bad.context.close();
    }
    const early = await open({ fixedTime: new Date('2026-11-10T10:00:00Z') });
    await early.page.click('#help-close');
    assert.equal(await early.page.locator('#archive-btn').isHidden(), true);
    assert.equal(await early.page.locator('#grid .cell').count(), 9, 'a grid exists before the epoch too');
    await early.context.close();
  });

  await step('360px phone with the longest club names, light and dark', async () => {
    // The day whose six criteria are longest in total: the worst case for the header cells.
    const length = (d) => { const g = G.gridForDay(d); return [...g.rows, ...g.cols].reduce((sum, id) => sum + G.criterion(id).name.length, 0); };
    let longest = 1;
    for (let d = 2; d <= G.GRID_DAYS; d++) if (length(d) > length(longest)) longest = d;
    const wide = G.gridForDay(longest);
    const solution = G.solve(wide);
    // Long player names are the worst case for the cells themselves.
    const byLength = (cell) => [...G.answersFor(wide, cell)].sort((a, b) => b.name.length - a.name.length);

    for (const colorScheme of ['light', 'dark']) {
      const { context, page } = await open({ viewport: { width: 360, height: 640 }, colorScheme, fixedTime: noon(longest) });
      await page.click('#help-close');
      assert.equal(await horizontalOverflow(page), 0, 'no horizontal scroll at 360px');
      const used = new Set();
      for (let cell = 0; cell < 4; cell++) {
        const player = byLength(cell).find((p) => !used.has(p.id)) || solution[cell];
        used.add(player.id);
        await pick(page, cell, player, wide.topic);
      }
      await pick(page, 4, wrongPlayers(wide, 4, 1, [...used])[0], wide.topic);
      assert.equal(await horizontalOverflow(page), 0);
      for (const box of await page.locator('#grid .cell').evaluateAll((cells) => cells.map((c) => [c.offsetWidth, c.offsetHeight, c.scrollWidth > c.clientWidth + 1]))) {
        assert.ok(box[0] >= 44 && box[1] >= 44, 'cells are at least 44px');
        assert.equal(box[2], false, 'a name is not clipped sideways');
      }
      await shot(page, `11-narrow-${colorScheme}`);
      await page.click('#cell-5');
      await page.fill('#player-input', 'כהן');
      assert.equal(await horizontalOverflow(page), 0);
      await shot(page, `12-narrow-dialog-${colorScheme}`);
      await page.keyboard.press('Escape');
      await page.click('#giveup-btn');
      await page.click('#giveup-btn');
      assert.equal(await page.locator('#answers').isVisible(), true);
      assert.equal(await horizontalOverflow(page), 0, 'no horizontal scroll with the answers shown');
      await shot(page, `13-narrow-end-${colorScheme}`, { fullPage: true });
      await context.close();
    }
  });

  await step('every topic: its label, its criteria, its search, a perfect game (light and dark in turn)', async () => {
    for (const [n, topic] of G.TOPIC_IDS.entries()) {
      // The first day from 1 December 2026 on that has this topic.
      let day = dayNumber('2026-12-01');
      while (G.gridForDay(day).topic !== topic) day++;
      const g = G.gridForDay(day);
      const { context, page } = await open({ fixedTime: noon(day), colorScheme: n % 2 ? 'dark' : 'light' });
      await page.click('#help-close');
      assert.ok((await page.locator('#topic').innerText()).includes(G.TOPICS[topic].label), topic);
      const heads = await page.locator('#grid .head').allInnerTexts();
      assert.deepEqual(heads.map((t) => t.trim()), [...g.cols, ...g.rows].map((id) => G.criterion(id).name));
      assert.equal(await page.locator('#grid .head .chip, #grid .head .chip-icon').count(), 6, `${topic}: every criterion has a chip or an icon`);
      await page.click('#cell-0');
      await page.fill('#player-input', 'קקקקזזזז');
      assert.equal(await page.locator('#suggestions li.none').innerText(), G.TOPICS[topic].none);
      await page.keyboard.press('Escape');
      await shot(page, `15-topic-${topic}`);
      await playPerfect(page, g);
      assert.equal(await page.locator('#end-title').innerText(), 'רשת מושלמת!');
      assert.equal(await horizontalOverflow(page), 0);
      await shot(page, `16-topic-${topic}-end`, { fullPage: true });
      await context.close();
    }
  });

  await step('desktop and corrupted storage', async () => {
    const { context, page } = await open({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    await page.evaluate(() => localStorage.setItem('hd:herkev', '{not json'));
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true, 'recovers from corrupted storage');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#grid .cell:not(:disabled)').count(), 9);

    // Valid JSON with nonsense inside is ignored as well.
    await page.evaluate((day) => localStorage.setItem('hd:herkev', JSON.stringify({ day, seenHelp: true, finished: 'yes', progress: { guesses: [[0, 'x'], 'junk', [44, 1]], gaveUp: 'no' }, stats: 5 })), today);
    await page.reload();
    assert.equal(await page.locator('#grid .cell:not(:disabled)').count(), 9);
    assert.equal(await triesLeft(page), '9');
    assert.deepEqual(await statNumbers(page), ['0', '0', '0', '0']);

    // Keyboard only: Enter on a cell opens the dialog, typing and Enter guess, focus comes back.
    const solution = G.solve(grid);
    await page.focus('#cell-0');
    await page.keyboard.press('Enter');
    assert.equal(await isDialogOpen(page, '#guess-dialog'), true);
    await page.keyboard.type(solution[0].name);
    const at = position(currentTopic, solution[0]);
    for (let i = 0; i < at; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#cell-0').innerText(), solution[0].name);
    await shot(page, '14-desktop');
    await context.close();
  });
});

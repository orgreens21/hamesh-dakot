// End-to-end checks on the site as one product, and regression tests for what the final QA pass fixed.
// Usage: node tests/site.e2e.mjs   (or: npm run test:e2e -- site)
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSession, horizontalOverflow, isDialogOpen, readStore } from './helpers.mjs';
import { GAMES } from '../shared/registry.js';
import { dayNumber, israelDate, emptyStats } from '../shared/core.js';
import * as N from '../games/nekuda/game.js';
import { LOCALITIES } from '../games/nekuda/data.js';
import * as B from '../games/beerech/game.js';
import * as A from '../games/arba/game.js';
import * as H from '../games/herkev/game.js';
import * as Y from '../games/yoter/game.js';

const session = await createSession({ slug: 'site', port: 4188, path: '' });
const { open, step, shot, root } = session;
const SHORT = { viewport: { width: 360, height: 640 } }; // what is left of a phone screen under the browser's bars
const DESKTOP = { viewport: { width: 1100, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 };
const today = dayNumber(israelDate());
const game = (slug) => `games/${slug}/`;
const closeHelp = (page) => page.click('#help-close');
const focused = (page) => page.evaluate(() => { const e = document.activeElement; return e === document.body ? 'body' : `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className).split(' ')[0]}`; });
const background = (page, selector) => page.locator(selector).evaluate((e) => getComputedStyle(e).backgroundColor);

// ---------- playing each game, the short way ----------

const localities = LOCALITIES.map(N.toLocality);
const nekudaIndex = N.buildSearchIndex(localities);
const nekudaTarget = N.targetForDay(N.buildTargetPool(localities), N.dayNumber(israelDate()));
async function nekudaGuess(page, name) {
  await page.fill('#guess-input', name);
  const at = N.searchLocalities(nekudaIndex, name).findIndex((l) => l.name === name);
  assert.ok(at >= 0, `${name} is offered`);
  for (let i = 0; i < at; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}
async function beerechPlay(page, factor = 1) {
  for (const product of B.roundForDay(today)) {
    await page.fill('#guess-input', (product.price * factor).toFixed(2));
    await page.click('#guess-btn');
    await page.click('#next-btn');
  }
}
// צומת loads one answer list per topic; the tests read them all up front.
for (const topic of H.TOPIC_IDS) await H.loadTopic(topic);
const herkevIndexes = Object.fromEntries(H.TOPIC_IDS.map((t) => [t, H.buildSearchIndex(H.itemsOf(t))]));
async function herkevType(page, player, topic = H.gridForDay(today).topic) {
  await page.waitForSelector('#grid[data-ready="true"]');
  await page.keyboard.type(player.name);
  const at = H.searchItems(herkevIndexes[topic], player.name).findIndex((p) => p.id === player.id);
  assert.ok(at >= 0, `${player.name} is offered`);
  for (let i = 0; i < at; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}
const yoterChain = Y.chainForDay(today);
const yoterButton = (round, right = true) => ((yoterChain.items[round + 1].value > yoterChain.items[round].value) === right ? '#more-btn' : '#less-btn');
const yoterSettled = (page) => page.waitForFunction(() => !document.getElementById('more-btn').disabled || !document.getElementById('end').hidden);

/** Serves the repository under a nested address, the way a project site on a shared host is served. */
function nestedServer(port, prefix) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (!path.startsWith(prefix)) throw new Error('outside the site');
      path = path.slice(prefix.length);
      if (path === '' || path.endsWith('/')) path += 'index.html';
      const file = normalize(join(ROOT, path));
      if (!file.startsWith(ROOT)) throw new Error('forbidden');
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

await session.run(async () => {
  await step('hosted in a sub-folder: hub, every game, the way back and the shared link all stay inside it', async () => {
    const prefix = '/apps/hamesh-dakot/';
    const server = await nestedServer(4189, prefix);
    const base = `http://localhost:4189${prefix}`;
    try {
      const { context, page } = await open();
      const missing = [];
      page.on('response', (r) => { if (r.status() >= 400) missing.push(r.url()); });
      for (const g of GAMES) {
        await page.goto(base);
        assert.equal(await page.locator('#games .game').count(), GAMES.length);
        await page.click(`.game[data-game="${g.slug}"] .game-link`);
        await page.waitForURL(`${base}games/${g.slug}/`);
        await page.waitForSelector('#help-dialog[open]');
        assert.equal(await page.locator('.brand h1').innerText(), g.name);
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).fontFamily.includes('Heebo')), true, `${g.slug}: the stylesheet arrived`);
        await closeHelp(page);
        assert.equal(await page.locator('.top .back').evaluate((a) => a.href), base, `${g.slug}: the back link leads to the hub in its folder`);
        assert.equal(await page.locator('link[rel="manifest"]').evaluate((l) => l.href), `${base}manifest.webmanifest`);
      }
      // The story deck starts games inside the folder too.
      await page.goto(base);
      await page.click('#stories-btn');
      assert.equal(await page.locator('#story-start').evaluate((a) => a.href), `${base}games/${GAMES[0].slug}/`);
      await page.click('#story-start');
      await page.waitForURL(`${base}games/${GAMES[0].slug}/`);
      // The link people paste into a group is the game's own address under the folder.
      await page.goto(`${base}games/mitchaze/`);
      const invite = decodeURIComponent(await page.locator('#whatsapp-btn').getAttribute('href'));
      assert.ok(invite.trim().endsWith(`${base}games/mitchaze/`), invite);
      assert.deepEqual(missing, [], 'nothing was requested from outside the folder');
      await context.close();
    } finally {
      server.close();
    }
  });

  await step('storage switched off (private mode, blocked cookies): every page loads, plays and stays quiet', async () => {
    const { context, page } = await open();
    await context.addInitScript(() => {
      for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } });
    });
    await page.goto(root);
    assert.equal(await page.locator('#games .game').count(), GAMES.length);
    for (const g of GAMES) assert.equal(await page.locator(`.game[data-game="${g.slug}"]`).getAttribute('data-status'), g.kind === 'party' ? 'party' : 'new');
    assert.match(await page.locator('#countdown').innerText(), /^\d\d:\d\d:\d\d$/);
    assert.equal(await page.locator('#progress-text').innerText(), `0/${GAMES.filter((g) => g.kind !== 'party').length} היום`, 'the count line');
    await page.click('#stories-btn');
    assert.equal(await page.locator('#deck').getAttribute('data-card'), GAMES[0].slug, 'the story deck opens without storage');
    await page.click('#story-start');
    await page.waitForURL(`**/${game(GAMES[0].slug)}`);
    for (const g of GAMES) {
      await page.goto(root + game(g.slug));
      assert.equal(await isDialogOpen(page, '#help-dialog'), true, `${g.slug}: the rules open`);
      await closeHelp(page);
      assert.equal(await page.locator('.brand h1').innerText(), g.name);
    }
    // One whole game with nowhere to save it.
    await page.goto(root + game('yoter'));
    await closeHelp(page);
    for (let round = 0; round < Y.ROUNDS; round++) { await page.click(yoterButton(round)); await yoterSettled(page); }
    assert.equal(await page.locator('#end-title').innerText(), Y.endTitle(Y.ROUNDS));
    await context.close();
  });

  await step('slow connection: the empty frame of a page stays unseen until its script has drawn the game, and nothing jumps', async () => {
    for (const g of GAMES) {
      const { context, page } = await open();
      await context.addInitScript(() => {
        window.qaShift = 0;
        new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.qaShift += e.value; }).observe({ type: 'layout-shift', buffered: true });
      });
      // The page's own script arrives late, the way it does on a weak mobile connection.
      let release;
      const held = new Promise((resolve) => { release = resolve; });
      await page.route(`**/games/${g.slug}/app.js`, async (route) => { await held; await route.continue(); });
      await page.goto(root + game(g.slug), { waitUntil: 'commit' });
      await page.waitForSelector('.app > main > *', { state: 'attached' });
      await page.waitForFunction(() => document.fonts.status === 'loaded' && getComputedStyle(document.body).fontFamily.includes('Heebo'));
      const before = await page.evaluate(() => [document.documentElement.classList.contains('is-ready'), ...[...document.querySelectorAll('.app > main > *, .app > .foot')].map((el) => getComputedStyle(el).opacity)]);
      assert.equal(before[0], false, g.slug);
      assert.ok(before.slice(1).every((o) => o === '0'), `${g.slug}: the unfilled frame is not shown (${before.slice(1)})`);
      release();
      await page.waitForSelector('html.is-ready');
      await page.waitForSelector('#help-dialog[open]');
      await closeHelp(page);
      await page.waitForFunction(() => document.querySelector('.app > main').getAnimations().every((a) => a.playState === 'finished'));
      assert.equal(await page.locator('.app > main > :not([hidden])').first().evaluate((el) => getComputedStyle(el).opacity), '1');
      assert.ok(await page.evaluate(() => window.qaShift) < 0.02, `${g.slug}: layout shift ${await page.evaluate(() => window.qaShift)}`);
      await context.close();
    }
  });

  await step('touch screens: a hover style never sticks to a button that appeared under the thumb', async () => {
    const { context, page } = await open(SHORT, game('yoter'));
    await closeHelp(page);
    assert.equal(await page.evaluate(() => matchMedia('(hover: hover)').matches), false, 'the test phone has no hover');
    for (let round = 0; round < Y.ROUNDS; round++) { await page.tap(yoterButton(round)); await yoterSettled(page); }
    // The end panel's outlined button now lies where the answer buttons were. It used to pick up the
    // ghost button's hover fill and look pressed.
    await page.hover('#practice-btn');
    assert.equal(await background(page, '#practice-btn'), 'rgba(0, 0, 0, 0)');
    await page.hover('#share-btn');
    const resting = await background(page, '#share-btn');
    await page.hover('#end-title');
    assert.equal(await background(page, '#share-btn'), resting, 'a filled button looks the same under the thumb');
    await shot(page, '01-yoter-end-short-phone', { fullPage: true });
    await context.close();

    // With a real pointer the fills are still there, but never on a disabled button.
    const desktop = await open(DESKTOP, game('arba'));
    await closeHelp(desktop.page);
    assert.equal(await desktop.page.locator('#submit-btn').isDisabled(), true);
    await desktop.page.hover('#submit-btn', { force: true });
    assert.equal(await background(desktop.page, '#submit-btn'), 'rgba(0, 0, 0, 0)', 'a disabled button stays flat');
    await desktop.page.click('#stats-btn');
    await desktop.page.hover('#stats-dialog .btn.ghost');
    await desktop.page.waitForFunction(() => getComputedStyle(document.querySelector('#stats-dialog .btn.ghost')).backgroundColor !== 'rgba(0, 0, 0, 0)');
    await desktop.context.close();
  });

  await step('short phone: every rules dialog opens at its heading with the closing button in view; a double tap does not flash it shut', async () => {
    for (const g of GAMES) {
      const { context, page } = await open(SHORT, game(g.slug));
      // Measured once the sheet has slid in: mid-entrance, the button is still moving on its own.
      await page.waitForFunction(() => document.getElementById('help-dialog').getAnimations({ subtree: true })
        .every((a) => a.playState !== 'running' || a.effect.getComputedTiming().iterations === Infinity));
      const box = await page.evaluate(() => {
        const dialog = document.getElementById('help-dialog');
        const frame = dialog.getBoundingClientRect();
        const heading = dialog.querySelector('h2').getBoundingClientRect();
        const button = dialog.querySelector('#help-close').getBoundingClientRect();
        return { scrollTop: dialog.scrollTop, scrolls: dialog.scrollHeight > dialog.clientHeight, top: frame.top, bottom: frame.bottom, headingTop: heading.top, buttonTop: button.top, buttonBottom: button.bottom, height: innerHeight };
      });
      assert.equal(box.scrollTop, 0, `${g.slug}: the rules start at the top`);
      assert.ok(box.headingTop > box.top, `${g.slug}: the heading is on screen`);
      assert.ok(box.buttonTop > box.headingTop + 100 && box.buttonBottom < Math.min(box.bottom, box.height), `${g.slug}: the button is on screen (${JSON.stringify(box)})`);
      if (box.scrolls) {
        // Read to the end: the button has not moved, the text has gone under it.
        await page.locator('#help-dialog').evaluate((d) => { d.scrollTop = d.scrollHeight; });
        const after = await page.locator('#help-close').evaluate((b) => b.getBoundingClientRect().bottom);
        assert.ok(Math.abs(after - box.buttonBottom) < 2, `${g.slug}: the button stays put while the rules scroll`);
        if (g.slug === 'herkev') await shot(page, '02-rules-short-phone', { settle: 100 });
      }
      await closeHelp(page);
      assert.equal(await horizontalOverflow(page), 0, g.slug);

      // Two quick taps on the help button: the second lands on the dimmed area around the dialog.
      const help = await page.locator('#help-btn').boundingBox();
      await page.touchscreen.tap(help.x + help.width / 2, help.y + help.height / 2);
      await page.touchscreen.tap(help.x + help.width / 2, help.y + help.height / 2);
      assert.equal(await isDialogOpen(page, '#help-dialog'), true, `${g.slug}: still open after a double tap`);
      // A deliberate tap outside, a moment later, closes it as before.
      await page.waitForTimeout(450); // the guard is a matter of time; there is no state to wait for
      await page.touchscreen.tap(8, 8);
      assert.equal(await isDialogOpen(page, '#help-dialog'), false, `${g.slug}: a tap outside closes the dialog`);
      await context.close();
    }
  });

  await step('hub on a narrow phone: a long result sits under the name inside its map label, clear of the other labels', async () => {
    const { context, page } = await open(SHORT);
    await page.evaluate(([day, stats]) => {
      localStorage.setItem('hd:arba', JSON.stringify({ day, finished: true, won: true, summary: 'בלי טעויות', stats, progress: { guesses: [[0, 1, 2, 3]] } }));
      localStorage.setItem('hd:yoter', JSON.stringify({ day, finished: true, won: false, summary: '3/10', stats, progress: { answers: ['more'] } }));
    }, [today, { ...emptyStats(4), played: 1 }]);
    await page.reload();
    // A result that is new since the last look is stamped in; measure once the stamps have landed.
    await page.waitForFunction(() => [...document.querySelectorAll('.game-status, .game')].every((el) => el.getAnimations().every((a) => a.playState === 'finished')));
    for (const slug of ['arba', 'yoter']) {
      const fit = await page.locator(`.game[data-game="${slug}"]`).evaluate((li) => {
        const card = li.querySelector('.game-card').getBoundingClientRect();
        const stamp = li.querySelector('.game-status').getBoundingClientRect();
        const name = li.querySelector('.game-name').getBoundingClientRect();
        // The stamp is tilted, so its box is a little taller than its ink: two pixels of slack.
        const overlap = !(stamp.right <= name.left || stamp.left >= name.right || stamp.bottom <= name.top + 2 || stamp.top >= name.bottom - 2);
        return { inside: stamp.left >= card.left + 4 && stamp.right <= card.right - 4, overlap };
      });
      assert.deepEqual(fit, { inside: true, overlap: false }, `${slug}: the stamp is inside its card and clear of the name`);
    }
    assert.ok((await page.locator('.game[data-game="arba"] .game-status').innerText()).includes('בלי טעויות'));
    const clash = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.game-card')].map((c) => [c.closest('.game').dataset.game, c.getBoundingClientRect()]);
      const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      return cards.flatMap(([n, a], i) => cards.slice(i + 1).filter(([, b]) => hit(a, b)).map(([m]) => `${n}/${m}`))
        .concat(cards.filter(([, r]) => r.left < 0 || r.right > innerWidth).map(([n]) => `${n} off screen`));
    });
    assert.deepEqual(clash, [], 'map labels never overlap or leave the screen');
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '03-hub-long-status', { fullPage: true });
    await context.close();
  });

  await step('stats: a label such as "250+" keeps its plus after the number on a right-to-left page', async () => {
    const { context, page } = await open({}, game('beerech'));
    await closeHelp(page);
    await beerechPlay(page);
    await page.click('#stats-btn');
    assert.deepEqual(await page.locator('#dist li bdi').allInnerTexts(), B.BUCKET_LABELS);
    // Measured, not assumed: in the first label the "+" is drawn to the right of the last digit.
    const order = await page.locator('#dist li bdi').first().evaluate((bdi) => {
      const range = document.createRange();
      const at = (i) => { range.setStart(bdi.firstChild, i); range.setEnd(bdi.firstChild, i + 1); return range.getBoundingClientRect().left; };
      return at(bdi.textContent.indexOf('+')) > at(bdi.textContent.indexOf('+') - 1);
    });
    assert.equal(order, true);
    assert.equal(await page.locator('#dist.stat-dist').count(), 1, 'the chart has its own class name; .dist is free for games');
    await page.keyboard.press('Escape');
    await context.close();
  });

  await step('the celebration belongs to the screen it started on, and there is only ever one', async () => {
    const { context, page } = await open({}, game('nekuda'));
    await closeHelp(page);
    await nekudaGuess(page, nekudaTarget.name);
    await page.waitForSelector('canvas.fx-confetti');
    await page.click('#practice-btn');
    // Paper used to rain on the practice board for two seconds; now it is gone almost at once.
    await page.waitForSelector('canvas.fx-confetti', { state: 'detached', timeout: 900 });
    assert.equal(await page.locator('#end').isHidden(), true);

    const kit = await page.evaluate(async () => {
      const fx = await import('../../shared/fx.js');
      fx.celebrate();
      fx.celebrate();
      const canvases = document.querySelectorAll('canvas.fx-confetti').length;
      const holder = document.createElement('p');
      document.body.append(holder);
      const late = fx.stamp(holder, { text: 'נבדק', delay: 300 });
      const now = fx.stamp(holder, { text: 'נבדק' });
      const flip = document.createElement('span');
      flip.className = 'fx-flip';
      flip.style.display = 'grid';
      document.body.append(flip);
      const plain = document.createElement('span');
      plain.className = 'fx-flip';
      document.body.append(plain);
      return { canvases, late: late.style.animationDelay, now: now.style.animationDelay, replay: fx.stamp(now, { delay: 120 }).style.animationDelay, flip: getComputedStyle(flip).display, plain: getComputedStyle(plain).display };
    });
    assert.deepEqual(kit, { canvases: 1, late: '300ms', now: '', replay: '120ms', flip: 'grid', plain: 'block' });
    await context.close();
  });

  await step('flip cards show the right side even where the browser does not hide back faces', async () => {
    // WebKit painting without its compositor ignores backface-visibility: the blank back of every
    // card covered its front (no product in בערך, no prompt on the secret card). Chrome is put in the
    // same position here by switching the culling off; the faces must then be switched by visibility.
    const NO_CULLING = '* { backface-visibility: visible !important; -webkit-backface-visibility: visible !important; }';
    const faces = (page, flip) => page.locator(flip).evaluate((el) => ['.fx-front', '.fx-back'].map((face) => getComputedStyle(el.querySelector(face)).visibility).join('/'));
    const settled = (page, flip, expected) => page.waitForFunction(([sel, want]) => {
      const el = document.querySelector(sel);
      return ['.fx-front', '.fx-back'].map((face) => getComputedStyle(el.querySelector(face)).visibility).join('/') === want;
    }, [flip, expected]);

    let { context, page } = await open({}, game('beerech'));
    await page.addStyleTag({ content: NO_CULLING });
    await closeHelp(page);
    assert.equal(await faces(page, '#tag'), 'visible/hidden', 'the product is on the side facing the player');
    assert.ok((await page.locator('#product-name').innerText()).length > 2);
    await page.fill('#guess-input', '10');
    await page.click('#guess-btn');
    await settled(page, '#tag', 'hidden/visible');
    await page.click('#next-btn');
    assert.equal(await faces(page, '#tag'), 'visible/hidden', 'a new tag is face up at once');
    await shot(page, '07-beerech-no-backface-culling');
    await context.close();

    ({ context, page } = await open({}, game('herkev')));
    await page.addStyleTag({ content: NO_CULLING });
    await closeHelp(page);
    assert.equal(await faces(page, '#cell-0'), 'visible/hidden', 'an empty cell shows its slot');
    await page.click('#cell-0');
    await herkevType(page, H.solve(H.gridForDay(today))[0]);
    await settled(page, '#cell-0', 'hidden/visible');
    assert.equal(await faces(page, '#cell-1'), 'visible/hidden');
    await context.close();

    ({ context, page } = await open({}, game('mitchaze')));
    await page.addStyleTag({ content: NO_CULLING });
    await closeHelp(page);
    await page.click('#start-btn');
    assert.equal(await faces(page, '#card'), 'visible/hidden', 'the card lies face down, showing its back');
    const impostors = [];
    for (let i = 0; i < 4; i++) {
      await page.click('#card');
      assert.equal(await faces(page, '#card'), 'visible/visible', 'the secret side is switched on as the turn starts');
      await settled(page, '#card', 'hidden/visible');
      if ((await page.locator('#card-front').getAttribute('data-role')) === 'impostor') impostors.push(i);
      await page.click('#card');
      await settled(page, '#card', 'visible/hidden');
      await page.click('#deal-next');
    }
    await page.click('#to-vote');
    await page.click(`#vote-list .tile[data-player="${impostors[0]}"]`);
    await page.click('#vote-confirm');
    assert.equal(await page.locator('.unmask-back').evaluate((el) => getComputedStyle(el).visibility), 'visible', 'the reveal starts with the card face down');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.unmask-back')).visibility === 'hidden');
    assert.equal(await page.locator('.unmask-name').evaluate((el) => getComputedStyle(el).visibility), 'visible', 'and ends on the name');
    await context.close();
  });

  await step('keyboard players keep their place: focus moves on with the game instead of dropping to the top of the page', async () => {
    // arba: a found group disables the button that was just pressed.
    let { context, page } = await open(DESKTOP, game('arba'));
    await page.keyboard.press('Enter');
    for (let g = 0; g < A.GROUPS; g++) {
      for (let i = 0; i < A.SIZE; i++) { await page.focus(`#grid .tile[data-index="${g * A.SIZE + i}"]`); await page.keyboard.press('Space'); }
      await page.focus('#submit-btn');
      await page.keyboard.press('Enter');
      assert.equal(await focused(page), g < A.GROUPS - 1 ? 'button.tile' : 'h2#end-title.end-title', `arba, after group ${g + 1}`);
    }
    await context.close();

    // herkev: a filled cell is disabled; the next open one takes over.
    ({ context, page } = await open(DESKTOP, game('herkev')));
    await page.keyboard.press('Enter');
    const solution = H.solve(H.gridForDay(today));
    await page.waitForSelector('#grid[data-ready="true"]');
    await page.focus('#cell-0');
    for (let cell = 0; cell < H.CELLS; cell++) {
      assert.equal(await focused(page), `button#cell-${cell}.cell`);
      await page.keyboard.press('Enter');
      assert.equal(await focused(page), 'input#player-input.');
      await herkevType(page, solution[cell]);
    }
    assert.equal(await focused(page), 'h2#end-title.end-title', 'herkev, at the end');
    await context.close();

    // yoter: the answer buttons are switched off while the number rolls.
    ({ context, page } = await open(DESKTOP, game('yoter')));
    await page.keyboard.press('Enter');
    for (let round = 0; round < Y.ROUNDS; round++) {
      await page.focus(yoterButton(round));
      await page.keyboard.press('Enter');
      await yoterSettled(page);
      assert.equal(await focused(page), round < Y.ROUNDS - 1 ? `button${yoterButton(round)}.btn` : 'h2#end-title.end-title', `yoter, after round ${round + 1}`);
    }
    await context.close();

    // beerech and nekuda: the last control goes away with the game; the result takes the focus.
    ({ context, page } = await open(DESKTOP, game('beerech')));
    await page.keyboard.press('Enter');
    for (const product of B.roundForDay(today)) { await page.keyboard.type(product.price.toFixed(2)); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); }
    assert.equal(await focused(page), 'h2#end-title.end-title', 'beerech, at the end');
    await context.close();

    ({ context, page } = await open(DESKTOP, game('nekuda')));
    await page.keyboard.press('Enter');
    await page.focus('#guess-input');
    await nekudaGuess(page, nekudaTarget.name);
    assert.equal(await focused(page), 'h2#end-title.end-title', 'nekuda, at the end');
    await context.close();

    // mitchaze: every button that moves the round on is hidden with its own screen.
    ({ context, page } = await open(DESKTOP, game('mitchaze')));
    await page.keyboard.press('Enter');
    await page.focus('#start-btn');
    await page.keyboard.press('Enter');
    assert.equal(await focused(page), 'h2.pass', 'mitchaze, on the deal screen');
    const impostors = [];
    for (let i = 0; i < 4; i++) {
      await page.focus('#card'); await page.keyboard.press('Enter');
      if ((await page.locator('#card-front').getAttribute('data-role')) === 'impostor') impostors.push(i);
      await page.keyboard.press('Enter');
      await page.focus('#deal-next'); await page.keyboard.press('Enter');
    }
    assert.equal(await focused(page), 'h2.pass', 'mitchaze, on the talk screen');
    await page.focus('#to-vote'); await page.keyboard.press('Enter');
    assert.equal(await focused(page), 'h2#vote-title.pass', 'mitchaze, on the vote screen');
    await page.focus(`#vote-list .tile[data-player="${impostors[0]}"]`); await page.keyboard.press('Space');
    await page.focus('#vote-confirm'); await page.keyboard.press('Enter');
    assert.equal(await focused(page), 'h2#reveal-names.culprit', 'mitchaze, on the reveal');
    await page.focus('#show-word'); await page.keyboard.press('Enter');
    assert.equal(await focused(page), 'p#secret-word.secret-word', 'mitchaze, once the word is shown');
    await page.focus('#guess-wrong'); await page.keyboard.press('Enter');
    assert.equal(await focused(page), 'h2#winner.end-title', 'mitchaze, at the result');
    await context.close();
  });

  await step('nekuda on a narrow phone: a direction that drops to its own line does not start with a stray dot', async () => {
    const { context, page } = await open({ ...SHORT, colorScheme: 'dark' }, game('nekuda'));
    await closeHelp(page);
    // Big towns far from the answer: three whose direction is a long one ("צפון-מזרח" wraps at this width) and one short.
    const far = localities.filter((l) => l.pop >= 40000 && l.name !== nekudaTarget.name).map((l) => N.evaluateGuess(l, nekudaTarget)).filter((r) => r.km >= 30);
    const picks = [...far.filter((r) => r.dir % 2 === 1).slice(0, 3), ...far.filter((r) => r.dir % 2 === 0).slice(0, 1)];
    assert.ok(picks.length >= 3, 'enough far guesses for this answer');
    for (const r of picks) await nekudaGuess(page, r.name);
    const rows = await page.locator('.guess.filled:not(.win)').evaluateAll((items) => items.map((li) => {
      const km = li.querySelector('.km').getBoundingClientRect();
      const len = li.querySelector('.len').getBoundingClientRect();
      const dir = li.querySelector('.dir');
      const box = dir.getBoundingClientRect();
      const wrapped = box.top >= len.bottom - 2;
      const dotWidth = parseFloat(getComputedStyle(dir, '::before').width);
      // The dot is drawn just before the direction (to its right, on this right-to-left page).
      return { text: dir.textContent, wrapped, dotInside: box.right + dotWidth <= km.right + 0.5, clips: getComputedStyle(li.querySelector('.km')).overflow };
    }));
    assert.ok(rows.length >= 3);
    for (const row of rows) {
      assert.ok(!row.text.includes('·'), 'the dot is not part of the text any more');
      assert.equal(row.clips, 'hidden');
      assert.equal(row.dotInside, !row.wrapped, `${row.text}: the dot shows between distance and direction, and only there`);
    }
    assert.ok(rows.some((r) => r.wrapped), 'the test reached a direction that wraps');
    await shot(page, '04-nekuda-narrow-directions', { fullPage: true });
    await context.close();
  });

  await step('mitchaze: three impostors with long names fit the card clear of the stamp; the score table follows names as they are typed', async () => {
    const names = ['איתמר־אלכסנדר', 'מקסימיליאן־יו', 'אנסטסיה־ויקטו', 'עמנואל־בנימין', 'שרלוט־אליזבת', 'כריסטופר־רוב', 'אלכסנדרה־מרי'];
    const { context, page } = await open(SHORT, game('mitchaze'));
    await closeHelp(page);
    while ((await page.locator('.name-input').count()) < names.length) await page.click('#add-player');
    for (let i = 0; i < names.length; i++) await page.locator('.name-input').nth(i).fill(names[i]);
    await page.click('#impostor-count button[data-value="3"]');
    await page.click('#start-btn');
    const impostors = [];
    for (let i = 0; i < names.length; i++) {
      await page.click('#card');
      if ((await page.locator('#card-front').getAttribute('data-role')) === 'impostor') impostors.push(i);
      await page.click('#card');
      await page.click('#deal-next');
    }
    assert.equal(impostors.length, 3);
    await page.click('#to-vote');
    for (const p of impostors) await page.click(`#vote-list .tile[data-player="${p}"]`);
    await page.click('#vote-confirm');
    await page.waitForFunction(() => document.querySelector('#reveal-stamp .fx-stamp').getAnimations().every((a) => a.playState === 'finished'));
    const card = await page.evaluate(() => {
      const stamp = document.querySelector('#reveal-stamp .fx-stamp').getBoundingClientRect();
      const face = document.querySelector('.unmask-name').getBoundingClientRect();
      return [...document.querySelectorAll('#reveal-names span')].map((span) => {
        const range = document.createRange();
        range.selectNodeContents(span);
        const rects = [...range.getClientRects()];
        return {
          lines: rects.length,
          inside: rects.every((r) => r.left >= face.left && r.right <= face.right),
          underStamp: rects.some((r) => r.right > stamp.left && r.left < stamp.right && r.bottom > stamp.top + 4 && r.top < stamp.bottom),
        };
      });
    });
    assert.deepEqual(card, Array(3).fill({ lines: 1, inside: true, underStamp: false }));
    // The stamp already says "caught"; the same word in green under it is left to screen readers.
    assert.equal(await page.locator('#verdict').textContent(), 'תפסתם!');
    assert.ok((await page.locator('#verdict').boundingBox()).height <= 1, 'the caught verdict is not printed under the stamp');
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '05-mitchaze-three-long-names', { settle: 200 });

    await page.click('#show-word');
    await page.click('#guess-wrong');
    await page.click('#to-setup');
    await page.locator('.name-input').first().fill('רוני');
    assert.ok((await page.locator('#setup-scores .who').allInnerTexts()).includes('רוני'), 'the table on the setup screen shows the new name at once');
    assert.equal(await page.locator('.remove-player').first().getAttribute('aria-label'), 'הסרת רוני');
    await context.close();
  });

  await step('herkev in the dark: the way back from the archive is ink, not link blue, stickers keep a light frame, and the board holds still', async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600e3);
    const { context, page } = await open({ colorScheme: 'dark', fixedTime: tomorrow }, `${game('herkev')}?day=${dayNumber(israelDate())}`);
    await closeHelp(page);
    const colours = await page.evaluate(() => [getComputedStyle(document.querySelector('#mode-banner a')).color, getComputedStyle(document.getElementById('mode-banner')).color]);
    assert.equal(colours[0], colours[1]);
    const grid = H.gridForDay(dayNumber(israelDate()));
    await page.click('#cell-0');
    await herkevType(page, H.solve(grid)[0], grid.topic);
    const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).map(Number); return rgb.startsWith('color(') ? 0.2126 * r + 0.7152 * g + 0.0722 * b : (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
    const frame = await page.locator('#cell-0 .sticker').evaluate((s) => [getComputedStyle(s).borderTopColor, getComputedStyle(s).backgroundColor]);
    assert.ok(lum(frame[0]) > lum(frame[1]) + 0.2, `the frame (${frame[0]}) is clearly lighter than the face (${frame[1]})`);
    // The criteria are text read during play: the board holds still under the pointer instead of leaning with it.
    const box = await page.locator('#grid').boundingBox();
    await page.mouse.move(box.x + 4, box.y + 4);
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#grid').evaluate((g) => getComputedStyle(g).transform), 'none');
    await shot(page, '06-herkev-archive-dark', { settle: 900 });
    await context.close();
  });

  await step('yoter on a short phone: nothing covers the revealed number, and the result is announced', async () => {
    const { context, page } = await open(SHORT, game('yoter'));
    await closeHelp(page);
    assert.equal(await page.locator('#end').getAttribute('aria-live'), 'polite');
    await page.tap(yoterButton(0, false));
    await page.waitForSelector('#card-hidden.wrong');
    // The corner stamp used to sit on a long unit such as "1,050,151 תושבים" when the cards are this low.
    assert.equal(await page.locator('#card-hidden .card-stamp').evaluate((s) => getComputedStyle(s).display), 'none');
    assert.equal(await page.locator('#verdict.wrong').count(), 1, 'the badge between the cards still gives the ruling');
    await context.close();
    // On a tall screen there is room, and the stamp is back.
    const tall = await open({}, game('yoter'));
    await closeHelp(tall.page);
    await tall.page.tap(yoterButton(0));
    await tall.page.waitForSelector('#card-hidden.right');
    assert.equal(await tall.page.locator('#card-hidden .card-stamp').evaluate((s) => getComputedStyle(s).display), 'block');
    await tall.context.close();
  });

  await step('arba: the result is worded as a sentence, and the hub gets a short form', async () => {
    const { context, page } = await open({}, game('arba'));
    await closeHelp(page);
    const pick = async (indexes) => { for (const i of indexes) await page.click(`#grid .tile[data-index="${i}"]`); await page.click('#submit-btn'); };
    await pick([0, 1, 2, 4]);
    await page.click('#clear-btn');
    for (let g = 0; g < A.GROUPS; g++) await pick([0, 1, 2, 3].map((i) => g * A.SIZE + i));
    assert.ok((await page.locator('#end-sub').innerText()).startsWith('פתרתם עם טעות אחת'), await page.locator('#end-sub').innerText());
    assert.equal((await readStore(page, 'arba')).summary, 'טעות אחת');
    await context.close();
  });

  await step('arba in the dark: the blocks stand clear of the tray they lie in', async () => {
    const { context, page } = await open({ colorScheme: 'dark' }, game('arba'));
    await closeHelp(page);
    const [tile, tray] = await page.evaluate(() => [document.querySelector('#grid .tile'), document.querySelector('.tray')].map((e) => getComputedStyle(e).backgroundColor));
    const lum = (rgb) => rgb.match(/[\d.]+/g).slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (lum(tile) + 0.05) / (lum(tray) + 0.05);
    assert.ok(ratio >= 1.5, `block ${tile} on tray ${tray}: ${ratio.toFixed(2)}:1`);
    await context.close();
  });
});

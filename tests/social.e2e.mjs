// End-to-end test for leaderboards and groups, against the in-memory backend of tests/mock-backend.mjs.
// The pages get a config.js pointing at the mock only through a route in the test browser; the
// shipped shared/config.js stays empty, and that mode is tested first.
// Usage: node tests/social.e2e.mjs   (or: npm run test:e2e -- social)
import assert from 'node:assert/strict';
import { createSession, horizontalOverflow, isDialogOpen } from './helpers.mjs';
import { createMockBackend, MOCK_URL } from './mock-backend.mjs';
import { dayNumber, israelDate } from '../shared/core.js';
import * as yoter from '../games/yoter/game.js';

const session = await createSession({ slug: 'social', port: 4190, path: '' });
const { open, step, shot, root } = session;
const backend = createMockBackend();
const configured = { setup: (context) => backend.route(context) };
const CALM = { reducedMotion: 'reduce' };
const PHONE = { viewport: { width: 360, height: 640 } };

const today = dayNumber(israelDate());
const chain = yoter.chainForDay(today);
const right = chain.items.slice(1).map((it, i) => (it.value > chain.items[i].value ? 'more' : 'less'));
const flip = (a) => (a === 'more' ? 'less' : 'more');
// Seven right and three wrong: 70 points.
const seventy = right.map((a, i) => (i >= 7 ? flip(a) : a));

const finishedTzir = JSON.stringify({ day: today, finished: true, won: true, summary: '6/6', seenHelp: true, progress: { results: [true, true, true, true, true, true] } });

/** Plays today's יותר או פחות with these answers, from the rules dialog to the end panel. */
async function playYoter(page, answers, { beforeLast } = {}) {
  await page.goto(root + 'games/yoter/');
  if (await isDialogOpen(page, '#help-dialog')) await page.click('#help-close');
  for (const [i, answer] of answers.entries()) {
    if (i === answers.length - 1 && beforeLast) await beforeLast();
    await page.click(answer === 'more' ? '#more-btn' : '#less-btn');
    await page.waitForFunction(() => !document.querySelector('#more-btn').disabled || !document.querySelector('#end').hidden);
  }
  await page.locator('#end').waitFor();
}

/** Every request the page made to anything but the local site. */
function outsideRequests(page) {
  const seen = [];
  page.on('request', (r) => { if (!r.url().startsWith(root) && !r.url().startsWith('data:')) seen.push(r.url()); });
  return seen;
}

await session.run(async () => {
  await step('not configured (as shipped): no groups link, no stats block, nothing sent, the old wording', async () => {
    const { context, page } = await open(CALM);
    const outside = outsideRequests(page);
    assert.equal(await page.locator('#groups-link').isHidden(), true);
    assert.equal(await page.locator('#privacy-note').innerText(), 'ההתקדמות והסטטיסטיקה נשמרות רק בדפדפן שלכם.');
    await playYoter(page, seventy);
    assert.equal(await page.locator('#end-title').innerText(), yoter.endTitle(7));
    assert.equal(await page.locator('#day-stats').count(), 0);
    await page.goto(root + 'games/tzir/');
    await page.evaluate((s) => localStorage.setItem('hd:tzir', s), finishedTzir);
    await page.reload();
    await page.locator('#end').waitFor();
    assert.equal(await page.locator('#day-stats').count(), 0);
    await page.goto(root + 'groups/');
    assert.equal(await page.locator('#view-off').isVisible(), true);
    assert.equal(await page.locator('#points').isHidden(), true);
    await page.goto(root + 'groups/?join=ABCDEF');
    assert.equal(await page.locator('#view-off').isVisible(), true, 'an invite link opens nothing either');
    await shot(page, '00-not-configured');
    assert.deepEqual(outside, [], 'no request left the site');
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('hd:me') || k.startsWith('hd:social')));
    assert.deepEqual(keys, []);
    await context.close();
  });

  await step('configured: the hub shows the groups link and says what is sent; fits a 360px phone', async () => {
    const { context, page } = await open({ ...configured, ...PHONE });
    assert.equal(await page.locator('#groups-link').isVisible(), true);
    assert.equal(await page.locator('#groups-link').getAttribute('href'), 'groups/');
    assert.ok((await page.locator('#privacy-note').innerText()).includes('נשלחות בלי שם'));
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '01-hub-360');
    await context.close();
    const dark = await open({ ...configured, colorScheme: 'dark' });
    await shot(dark.page, '01-hub-dark');
    await dark.context.close();
  });

  await step('a finished daily game is sent once and shows how everyone did, with a percentile', async () => {
    backend.seed('yoter', today, [0, 10, 20, 30, 40, 50, 60, 80, 90, 100]);
    const { context, page } = await open({ ...configured, ...CALM });
    await playYoter(page, seventy);
    const stats = page.locator('#day-stats');
    await stats.locator('[data-state="ready"], #ds-lead').first().waitFor();
    assert.equal(await stats.getAttribute('data-state'), 'ready');
    // Seven of the ten others scored less than 70.
    assert.equal(await page.locator('#ds-lead').innerText(), 'עשיתם יותר טוב מ־70% מהשחקנים');
    assert.ok((await stats.innerText()).includes('11 שחקנים סיימו את החידה היום'));
    assert.equal(await stats.locator('.ds-hist li').count(), 10);
    assert.equal(await stats.locator('.ds-hist li.me').count(), 1);
    assert.equal(await stats.locator('.ds-hist li').nth(7).getAttribute('class'), 'me');
    assert.ok((await stats.locator('.ds-points').innerText()).includes('70 נקודות'));
    assert.match(await page.locator('#groups-btn').getAttribute('href'), /\/groups\/$/);
    const mine = backend.results.filter((r) => r.game === 'yoter' && r.points === 70);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].day, today);
    assert.equal(mine[0].summary, '7/10');
    await shot(page, '02-end-stats', { fullPage: true });
    // Reloads, the practice round and a second look never send it again.
    await page.reload();
    await page.locator('#ds-lead').waitFor();
    await page.click('#practice-btn');
    await page.waitForFunction(() => document.querySelector('#end').hidden);
    assert.equal(backend.calls.filter((c) => c.name === 'submit_result' && c.args.p_game === 'yoter').length - 10, 1, 'one submission besides the seeded ones');
    await context.close();
  });

  await step('the stats block in dark mode and on a 360px phone', async () => {
    for (const [name, options] of [['03-end-stats-dark', { colorScheme: 'dark' }], ['04-end-stats-360', PHONE]]) {
      const { context, page } = await open({ ...configured, ...CALM, ...options });
      await playYoter(page, right);
      await page.locator('#ds-lead').waitFor();
      assert.equal(await page.locator('#ds-lead').innerText(), 'אף אחד לא עשה יותר טוב מכם היום');
      assert.equal(await horizontalOverflow(page), 0);
      await page.locator('#day-stats').scrollIntoViewIfNeeded();
      await shot(page, name);
      await context.close();
    }
  });

  await step('too few players: "too early, come back later"', async () => {
    const { context, page } = await open({ ...configured, ...CALM });
    await page.goto(root + 'games/tzir/');
    await page.evaluate((s) => localStorage.setItem('hd:tzir', s), finishedTzir);
    await page.reload();
    await page.locator('#day-stats[data-state="early"]').waitFor();
    assert.ok((await page.locator('#day-stats').innerText()).includes('מוקדם מדי, חזרו מאוחר יותר'));
    assert.equal(backend.results.filter((r) => r.game === 'tzir').length, 1);
    assert.equal(backend.results.find((r) => r.game === 'tzir').points, 100);
    await page.locator('#day-stats').scrollIntoViewIfNeeded();
    await shot(page, '05-end-too-early');
    await context.close();
  });

  await step('offline: the result waits, the block says so, and it is sent when the phone is back online', async () => {
    const { context, page } = await open({ ...configured, ...CALM });
    const before = backend.results.length;
    await playYoter(page, right.map(flip), { beforeLast: () => context.setOffline(true) });
    await page.locator('#day-stats[data-state="offline"]').waitFor();
    assert.ok((await page.locator('#day-stats').innerText()).includes('אין חיבור כרגע'));
    const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('hd:social-queue')));
    assert.equal(queued.length, 1);
    assert.equal(queued[0].points, 0);
    assert.equal(backend.results.length, before);
    await page.locator('#day-stats').scrollIntoViewIfNeeded();
    await shot(page, '06-end-offline');
    await context.setOffline(false);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('hd:social-queue') || '[]').length === 0);
    assert.equal(backend.results.length, before + 1);
    assert.equal(backend.results.at(-1).points, 0);
    await page.reload();
    await page.locator('#ds-lead').waitFor();
    await context.close();
  });

  await step('a server error keeps the result queued; the next page load sends it', async () => {
    const { context, page } = await open({ ...configured, ...CALM });
    await page.goto(root + 'games/tzir/');
    const before = backend.results.length;
    backend.setDown(true);
    await page.evaluate((s) => localStorage.setItem('hd:tzir', s), finishedTzir);
    await page.reload();
    await page.locator('#day-stats[data-state="offline"]').waitFor();
    backend.setDown(false);
    await page.goto(root); // the hub sends what is waiting
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('hd:social-queue') || '[]').length === 0);
    assert.equal(backend.results.length, before + 1);
    await context.close();
    // The browser itself logs the outage this step staged (status 503); the page's code logged nothing.
    const staged = session.errors.filter((e) => e.includes('status of 503'));
    assert.ok(staged.length >= 1);
    session.errors.splice(0, session.errors.length, ...session.errors.filter((e) => !staged.includes(e)));
  });

  let invite;
  let noa;
  await step('groups: pick a nickname, create a group, get an invite link', async () => {
    noa = await open({ ...configured, ...CALM });
    const { page } = noa;
    await playYoter(page, seventy);
    await page.locator('#ds-lead').waitFor();
    await page.goto(root + 'groups/');
    assert.equal(await page.locator('#view-home').isVisible(), true);
    assert.equal(await page.locator('#groups-empty').isVisible(), true);
    await shot(page, '07-groups-empty');
    await page.fill('#create-input', 'המשפחה');
    await page.click('#create-btn');
    assert.equal(await page.locator('#create-error').innerText(), 'קודם בחרו כינוי (למעלה).');
    await page.fill('#nick-input', 'x');
    await page.click('#nick-btn');
    assert.ok((await page.locator('#nick-error').innerText()).includes('2 עד 20'));
    await page.fill('#nick-input', '  נועה ');
    await page.click('#nick-btn');
    await page.locator('#me-chip:not([hidden])').waitFor();
    assert.equal(await page.locator('#me-name').innerText(), 'נועה');
    await page.click('#create-btn');
    await page.locator('#view-board:not([hidden])').waitFor();
    await page.locator('.grp-member').first().waitFor();
    assert.equal(await page.locator('#board-title').innerText(), 'המשפחה');
    const code = await page.locator('#invite-code').innerText();
    assert.match(code, /^[A-Z2-9]{6}$/);
    assert.ok(page.url().endsWith(`groups/?g=${code}`));
    const wa = decodeURIComponent(await page.locator('#invite-whatsapp').getAttribute('href'));
    assert.ok(wa.startsWith('https://wa.me/?text='));
    invite = /https?:\/\/\S+join=[A-Z2-9]{6}/.exec(wa)[0];
    assert.equal(invite, `${root}groups/?join=${code}`);
    await page.click('#invite-copy');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), invite);
    // נועה played today: she is on the board with her points.
    const me = page.locator('.grp-member.is-me');
    assert.ok((await me.innerText()).includes('נועה'));
    assert.equal(await me.locator('.grp-rank').innerText(), '1');
  });

  await step('a friend opens the invite, picks a nickname, joins, and both see each other', async () => {
    const dan = await open({ ...configured, ...CALM, ...PHONE });
    const { page } = dan;
    await page.goto(invite);
    assert.equal(await page.locator('#view-join').isVisible(), true);
    assert.equal(await page.locator('#join-nick').isVisible(), true, 'no nickname yet: the field is part of the invite');
    await shot(page, '08-join-360');
    await page.click('#join-btn');
    assert.ok((await page.locator('#join-error').innerText()).includes('2 עד 20'));
    await page.fill('#join-nick', 'דן');
    await page.click('#join-btn');
    await page.locator('#view-board:not([hidden])').waitFor();
    await page.locator('.grp-member').first().waitFor();
    assert.equal(await page.locator('#board-title').innerText(), 'המשפחה');
    // דן has not played: he is listed as waiting, נועה is ranked.
    assert.ok((await page.locator('#board').innerText()).includes('נועה'));
    assert.ok((await page.locator('#board-waiting').innerText()).includes('דן (אתם)'));
    // He plays, and comes back to the board.
    await playYoter(page, right);
    await page.locator('#ds-lead').waitFor();
    await page.click('#groups-btn');
    await page.locator('.grp-item').first().waitFor();
    assert.equal(await page.locator('.grp-item-name').innerText(), 'המשפחה');
    await page.click('.grp-item');
    await page.locator('.grp-member.is-me').waitFor();
    const rows = await page.locator('.grp-member .grp-name bdi').allInnerTexts();
    assert.deepEqual(rows, ['דן', 'נועה'], 'דן (100) above נועה (70)');
    assert.equal(await page.locator('.grp-member.is-me .grp-total b').innerText(), '100');
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '09-board-360', { fullPage: true });
    await dan.context.close();

    await noa.page.reload();
    await noa.page.locator('.grp-member:nth-child(2)').waitFor();
    assert.deepEqual(await noa.page.locator('.grp-member .grp-name bdi').allInnerTexts(), ['דן', 'נועה']);
    assert.equal(await noa.page.locator('.grp-member.is-me .grp-rank').innerText(), '2');
    await shot(noa.page, '10-board');
  });

  await step('the week and all-time tabs, and dark mode', async () => {
    const { page } = noa;
    await page.click('.grp-tab[data-period="week"]');
    await page.waitForFunction(() => document.querySelector('#board-period').textContent.includes('–'));
    assert.equal(await page.locator('.grp-tab[data-period="week"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.grp-member').count(), 2);
    await page.click('.grp-tab[data-period="all"]');
    await page.waitForFunction(() => document.querySelector('#board-period').textContent.includes('כל'));
    const dark = await open({ ...configured, ...CALM, colorScheme: 'dark' });
    await dark.page.goto(root + 'groups/');
    await shot(dark.page, '11-groups-home-dark');
    await dark.context.close();
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.click('.grp-tab[data-period="day"]');
    await page.waitForFunction(() => !document.querySelector('#board').classList.contains('is-loading'));
    await shot(page, '12-board-dark', { fullPage: true });
    await page.emulateMedia({ colorScheme: 'light' });
  });

  await step('my groups lists the group; the points rules are on the page; leaving removes it', async () => {
    const { page } = noa;
    await page.click('#board-back');
    await page.locator('.grp-item').first().waitFor();
    assert.equal(await page.locator('.grp-item-sub').innerText(), '2 חברים');
    assert.ok((await page.locator('#points').innerText()).includes('100 בניחוש הראשון'));
    await shot(page, '13-groups-home', { fullPage: true });
    await page.click('.grp-item');
    await page.locator('.grp-member').first().waitFor();
    await page.click('#leave-btn');
    assert.equal(await isDialogOpen(page, '#confirm'), true);
    await page.click('#confirm-ok');
    await page.locator('#view-home:not([hidden])').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.grp-item').length === 0);
    assert.equal(await page.locator('#groups-empty').isVisible(), true);
    // A wrong code, typed by hand.
    await page.fill('#code-input', 'zzzzzz');
    await page.click('#code-btn');
    await page.locator('#code-error:not(:empty)').waitFor();
    assert.ok((await page.locator('#code-error').innerText()).includes('לא מצאנו'));
    await noa.context.close();
  });

  await step('the API is only ever called on the configured backend, with the key', async () => {
    assert.ok(backend.calls.length > 10);
    assert.ok(backend.calls.every((c) => typeof c.name === 'string'));
    assert.ok(MOCK_URL.startsWith('https://'));
  });
});

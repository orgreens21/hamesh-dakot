// End-to-end test for המתחזה. The test plays the way a table does: it learns the roles by
// turning over each card, so nothing here depends on a seed or a hook inside the page.
// Usage: node tests/mitchaze.e2e.mjs   (or: npm run test:e2e -- mitchaze)
import assert from 'node:assert/strict';
import { createSession, horizontalOverflow, shareToClipboard, isDialogOpen, readStore } from './helpers.mjs';
import * as G from '../games/mitchaze/game.js';

const SLUG = 'mitchaze';
const session = await createSession({ slug: SLUG, port: 4183 });
const { open, step, shot } = session;

const ALL_WORDS = new Set(G.PACKS.flatMap((p) => p.words));
const FOUR = ['דנה', 'יוסי', 'מיכל', 'אבי'];

/** How many times `text` occurs anywhere in the page: markup, attributes and title included. */
const occurrences = (page, text) => page.evaluate((t) => (document.documentElement.outerHTML + '\n' + document.title).split(t).length - 1, text);
const pageHtml = (page) => page.evaluate(() => document.documentElement.outerHTML + '\n' + document.title);
const count = (haystack, needle) => haystack.split(needle).length - 1;
const visibleScreen = (page) => page.evaluate(() => [...document.querySelectorAll('.screen')].filter((s) => !s.hidden).map((s) => s.id).join(','));
/** What a face-up card looks like, apart from its words: must be identical for every role. */
const faceLook = (page) => page.locator('#card-front').evaluate((face) => {
  const pick = (node, pseudo) => { const c = getComputedStyle(node, pseudo); return [c.backgroundColor, c.backgroundImage, c.color, c.borderColor, c.boxShadow, c.fontFamily].join('|'); };
  return [pick(face), pick(face, '::before'), pick(face.querySelector('.kicker')), pick(face.querySelector('#card-word')), pick(document.getElementById('card'))].join('\n');
});
const scoreOf = async (page, list, name) => Number(await page.locator(`${list} li`, { has: page.locator('.who', { hasText: new RegExp(`^${name}$`) }) }).locator('.pts').innerText());

async function setNames(page, names) {
  while ((await page.locator('.name-input').count()) < names.length) await page.click('#add-player');
  while ((await page.locator('.name-input').count()) > names.length) await page.locator('.remove-player').last().click();
  for (let i = 0; i < names.length; i++) await page.locator('.name-input').nth(i).fill(names[i]);
}

/**
 * Passes the phone around the whole table. Returns the secret word, the impostors' names, the hints the
 * impostors saw, and a snapshot of the page taken every time a card was face down (checked later for leaks).
 */
async function deal(page, names, { peeked = false } = {}) {
  const hidden = [];
  const impostors = [];
  const hints = [];
  const looks = new Set();
  let word = null;
  for (let i = 0; i < names.length; i++) {
    assert.equal(await visibleScreen(page), 'deal');
    assert.equal(await page.locator('#deal-name').innerText(), names[i]);
    assert.ok((await page.locator('#deal-step').innerText()).includes(`${i + 1} מתוך ${names.length}`));
    // `peeked`: the caller already turned the first card over and back (for screenshots).
    assert.equal(await page.locator('#deal-next').isHidden(), !(peeked && i === 0), 'cannot pass the phone on before looking');
    assert.equal(await page.locator('#card-word').count(), 0);
    // The face that is turned away is an empty element: nothing to read through it, at an angle or mid-turn.
    assert.equal(await page.locator('#card-front').evaluate((f) => f.innerHTML + '|' + f.getAttributeNames().sort().join(',')), '|class,id');
    assert.equal(await page.locator('#card.fx-flip .fx-flip-inner > #card-front.fx-back').count(), 1, 'the secret is on the back face of a 3D card');
    hidden.push(await pageHtml(page));

    await page.click('#card');
    looks.add(await faceLook(page));
    assert.equal(await page.locator('#card-back').getAttribute('aria-hidden'), 'true');
    const shown = await page.locator('#card-word').innerText();
    if ((await page.locator('#card-front').getAttribute('data-role')) === 'impostor') {
      assert.equal(shown, 'אתם המתחזים!');
      impostors.push(names[i]);
      hints.push(await page.locator('#card-hint').count() ? await page.locator('#card-hint').innerText() : null);
    } else {
      assert.ok(ALL_WORDS.has(shown), `"${shown}" is a word from the packs`);
      if (word) assert.equal(shown, word, 'every civilian sees the same word');
      word = shown;
      assert.equal(await page.locator('#card-hint').count(), 0);
    }
    assert.equal(await page.locator('#deal-next').isHidden(), true, 'no moving on while the card is face up');

    await page.click('#card'); // face down again: emptied in the same task, before the card has begun to turn
    assert.equal(await page.locator('#card').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#card-word').count(), 0);
    assert.equal(await page.locator('#card-front').evaluate((f) => f.innerHTML), '');
    hidden.push(await pageHtml(page));
    await page.click('#deal-next');
  }
  assert.equal(await visibleScreen(page), 'talk');
  assert.equal(looks.size, 1, 'a word card and an impostor card look exactly alike');
  hidden.push(await pageHtml(page));
  return { word, impostors, hints, hidden };
}

/** The secret may be in the page only while a card is face up: compare against the page before the round. */
function assertNoLeak(snapshots, baseline, word) {
  const expected = count(baseline, word);
  snapshots.forEach((html, i) => assert.equal(count(html, word), expected, `"${word}" leaked into the page (snapshot ${i})`));
  for (const html of snapshots) assert.equal(count(html, 'אתם המתחזים'), 0, 'the impostor card leaves no trace either');
}

async function vote(page, accused) {
  await page.click('#to-vote');
  assert.equal(await page.locator('#vote-confirm').isDisabled(), true);
  for (const name of accused) await page.locator('#vote-list .tile', { hasText: new RegExp(`^${name}$`) }).click();
  assert.equal(await page.locator('#vote-confirm').isDisabled(), false);
}

await session.run(async () => {
  await step('first visit: rules once, then the setup screen with sensible defaults', async () => {
    const { context, page } = await open();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true);
    await shot(page, '01-help');
    await page.click('#help-close');
    assert.equal(await page.title(), 'המתחזה – חמש דקות');
    assert.equal(await page.locator('.brand h1').innerText(), 'המתחזה');
    assert.equal(await page.locator('#stats-btn').count(), 0, 'a party game has no stats button');
    assert.equal(await page.locator('.top .back').getAttribute('href'), '../../');
    assert.equal(await page.locator('.name-input').count(), G.DEFAULT_PLAYERS);
    assert.equal(await page.locator('#packs .tile').count(), G.PACKS.length);
    assert.equal(await page.locator('#packs .tile[aria-pressed="true"]').count(), G.PACKS.length);
    assert.equal(await page.locator('#impostor-count [aria-pressed="true"]').innerText(), '1');
    assert.equal(await page.locator('#impostor-count [data-value="2"]').isDisabled(), true, 'two impostors need five players');
    assert.equal(await page.locator('#setup-board').isHidden(), true);
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '02-setup', { fullPage: true });
    await page.click('#help-btn');
    assert.equal(await isDialogOpen(page, '#help-dialog'), true);
    await page.keyboard.press('Escape');
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), false, 'rules are shown only once');
    assert.equal((await readStore(page, SLUG)).seenHelp, true);
    await context.close();
  });

  await step('four players: caught and a wrong guess, then a second round where the impostor escapes', async () => {
    const { context, page } = await open();
    await page.click('#help-close');
    await setNames(page, FOUR);
    await page.click('#timer [data-value="0"]');
    const baseline = await pageHtml(page);
    const historyBefore = await page.evaluate(() => history.length);

    await page.click('#start-btn');
    await shot(page, '03-deal-hidden');
    await page.click('#card');
    await shot(page, '04-deal-shown', { settle: 900 });
    await page.click('#card');
    await shot(page, '05-deal-seen', { settle: 900 });

    const first = await deal(page, FOUR, { peeked: true });
    assert.equal(first.impostors.length, 1);
    assert.ok(first.word);
    assertNoLeak(first.hidden, baseline, first.word);
    assert.equal(await page.title(), 'המתחזה – חמש דקות', 'the title never changes');
    assert.equal(await page.evaluate(() => history.length), historyBefore, 'no history entries to go back through');
    assert.equal(await page.evaluate(() => location.hash + location.search), '');

    // Talk: who starts, the rules, no clock when the timer is off; the card is out of reach.
    assert.ok(FOUR.includes(await page.locator('#starter').innerText()));
    assert.equal(await page.locator('#clock-wrap').isHidden(), true);
    assert.equal(await page.locator('#card').isVisible(), false);
    await shot(page, '06-talk-no-timer');

    // Vote: one suspect at a time, a new tap replaces the choice.
    const impostor = first.impostors[0];
    const innocent = FOUR.find((n) => n !== impostor);
    await vote(page, [innocent, impostor]);
    assert.deepEqual(await page.locator('#vote-list .tile[aria-pressed="true"]').allInnerTexts(), [impostor]);
    assert.equal(await occurrences(page, first.word), count(baseline, first.word), 'still secret while voting');
    await shot(page, '07-vote');
    await page.click('#vote-confirm');

    // Reveal: caught, so the word stays hidden until the impostor has guessed out loud.
    assert.equal(await page.locator('#reveal-names').innerText(), impostor);
    assert.equal(await page.locator('#verdict').textContent(), 'תפסתם!');
    assert.equal(await page.locator('#unmask .unmask-name #reveal-names').count(), 1, 'the name is on the face of the card that turns over');
    assert.equal(await page.locator('#unmask .unmask-back').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('#reveal-stamp .fx-stamp').innerText(), 'נתפס');
    assert.equal(await page.locator('#reveal-stamp .fx-stamp').getAttribute('data-tone'), 'found');
    assert.equal(await page.locator('#secret').isHidden(), true);
    assert.equal(await page.locator('#result').isHidden(), true);
    assert.equal(await occurrences(page, first.word), count(baseline, first.word), 'the word is not in the page before the guess');
    assert.ok((await page.locator('#guess-prompt').innerText()).startsWith(impostor));
    await shot(page, '08-reveal-caught', { settle: 3200 });
    await page.click('#show-word');
    assert.equal(await page.locator('#secret-word').innerText(), first.word);
    await shot(page, '09-reveal-word');
    await page.click('#guess-wrong');
    assert.equal(await page.locator('#winner').innerText(), 'הקבוצה ניצחה!');
    assert.equal(await page.locator('#result').getAttribute('data-winner'), 'civilians');
    for (const name of FOUR) assert.equal(await scoreOf(page, '#scores', name), name === impostor ? 0 : 1);
    assert.equal(await page.locator('#scores .gain', { hasText: '+1' }).count(), 3);
    // The tally sheet: one stroke per point, the ones won this round marked as new.
    assert.deepEqual(await page.locator('#scores li').evaluateAll((rows) => rows.map((r) => [r.querySelectorAll('.tally path').length, r.querySelectorAll('.tally path.new').length].join('/'))), ['1/1', '1/1', '1/1', '0/0']);
    assert.equal(await page.locator('#scores .tally[aria-hidden="true"]').count(), 4);
    assert.deepEqual((await readStore(page, SLUG)).scores, FOUR.map((n) => (n === impostor ? 0 : 1)));
    assert.equal((await readStore(page, SLUG)).rounds, 1);
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '10-result-civilians', { fullPage: true, settle: 2400 });
    assert.equal(await page.locator('canvas.fx-confetti').count(), 0, 'the celebration cleans up after itself');

    // Round two: a new word, the group accuses an innocent player, the impostor takes 2 points.
    await page.click('#next-round');
    assert.ok((await page.locator('#puzzle-label').innerText()).includes('סיבוב 2'));
    const second = await deal(page, FOUR);
    assert.notEqual(second.word, first.word, 'a new word every round');
    assertNoLeak(second.hidden, baseline, second.word);
    const impostor2 = second.impostors[0];
    const scapegoat = FOUR.find((n) => n !== impostor2);
    await vote(page, [scapegoat]);
    await page.click('#vote-confirm');
    assert.equal(await page.locator('#reveal-names').innerText(), impostor2);
    assert.ok((await page.locator('#verdict').innerText()).includes(scapegoat));
    assert.equal(await page.locator('#reveal-stamp .fx-stamp').innerText(), 'חמק');
    assert.equal(await page.locator('#reveal-stamp .fx-stamp').getAttribute('data-tone'), 'close');
    assert.equal(await page.locator('#guess').isHidden(), true, 'no guess for an impostor who got away');
    assert.equal(await page.locator('#secret-word').innerText(), second.word);
    assert.equal(await page.locator('#winner').innerText(), 'המתחזה ניצח!');
    const expected = Object.fromEntries(FOUR.map((n) => [n, (n === impostor ? 0 : 1) + (n === impostor2 ? 2 : 0)]));
    for (const name of FOUR) assert.equal(await scoreOf(page, '#scores', name), expected[name], `score of ${name} after two rounds`);
    const order = (await page.locator('#scores .pts').allInnerTexts()).map(Number);
    assert.deepEqual(order, [...order].sort((a, b) => b - a), 'the table is sorted, best first');
    assert.deepEqual(await page.locator('#scores li').evaluateAll((rows) => rows.map((r) => r.querySelectorAll('.tally path').length)), order, 'as many strokes as points');
    assert.equal(await page.locator('#scores .tally path.new').count(), 2);
    await shot(page, '11-result-impostor', { settle: 5400, fullPage: true });

    // Back to setup: the table is there, and survives a reload together with names and the played words.
    await page.click('#to-setup');
    assert.equal(await visibleScreen(page), 'setup');
    assert.equal(await page.locator('#setup-board').isVisible(), true);
    await page.reload();
    for (const name of FOUR) assert.equal(await scoreOf(page, '#setup-scores', name), expected[name]);
    assert.deepEqual((await readStore(page, SLUG)).recent, [first.word, second.word]);
    await shot(page, '12-setup-with-scores', { fullPage: true });

    // Reset needs a second tap.
    await page.locator('#setup-board .reset-scores').click();
    assert.equal(await page.locator('#setup-board').isVisible(), true);
    await page.locator('#setup-board .reset-scores').click();
    assert.equal(await page.locator('#setup-board').isHidden(), true);
    assert.deepEqual((await readStore(page, SLUG)).scores, [0, 0, 0, 0]);
    assert.equal((await readStore(page, SLUG)).rounds, 0);
    await context.close();
  });

  await step('caught, but the impostor names the word and wins a point', async () => {
    const { context, page } = await open();
    await page.click('#help-close');
    await setNames(page, ['רון', 'גל', 'טל']);
    await page.click('#start-btn');
    const names = ['רון', 'גל', 'טל'];
    const { impostors } = await deal(page, names);
    await vote(page, impostors);
    await page.click('#vote-confirm');
    await page.click('#show-word');
    await page.click('#guess-right');
    assert.equal(await page.locator('#winner').innerText(), 'המתחזה ניצח!');
    assert.ok((await page.locator('#winner-sub').innerText()).includes('ניחש'));
    for (const name of names) assert.equal(await scoreOf(page, '#scores', name), name === impostors[0] ? 1 : 0);
    await context.close();
  });

  await step('two impostors with the category hint; both must be named', async () => {
    const five = [...FOUR, 'נועה'];
    const { context, page } = await open();
    await page.click('#help-close');
    await setNames(page, five);
    assert.equal(await page.locator('#impostor-count [data-value="2"]').isDisabled(), false);
    assert.equal(await page.locator('#impostor-count [data-value="3"]').isDisabled(), true);
    await page.click('#impostor-count [data-value="2"]');
    await page.locator('.switch').click();
    assert.equal(await page.locator('#hint-toggle').isChecked(), true);
    // Only the animals pack, so the hint and the word are predictable.
    await page.locator('#packs .tile:not([data-pack="animals"])').evaluateAll((tiles) => tiles.forEach((t) => t.click()));
    assert.deepEqual(await page.locator('#packs .tile[aria-pressed="true"]').allInnerTexts(), ['בעלי חיים']);
    await page.locator('#packs [data-pack="animals"]').click(); // the last pack cannot be switched off
    assert.equal(await page.locator('#packs .tile[aria-pressed="true"]').count(), 1);
    assert.ok((await page.locator('#toast').innerText()).includes('חבילה אחת'));
    const baseline = await pageHtml(page);

    await page.click('#start-btn');
    const round = await deal(page, five);
    assert.equal(round.impostors.length, 2);
    assert.deepEqual(round.hints, ['החבילה: בעלי חיים', 'החבילה: בעלי חיים']);
    assert.ok(G.PACKS.find((p) => p.id === 'animals').words.includes(round.word));
    assertNoLeak(round.hidden, baseline, round.word);

    // Naming one of the two is not enough; a third pick is refused.
    const innocents = five.filter((n) => !round.impostors.includes(n));
    await page.click('#to-vote');
    assert.equal(await page.locator('#vote-title').innerText(), 'מי המתחזים?');
    await page.locator('#vote-list .tile', { hasText: new RegExp(`^${round.impostors[0]}$`) }).click();
    assert.equal(await page.locator('#vote-confirm').isDisabled(), true);
    await page.locator('#vote-list .tile', { hasText: new RegExp(`^${innocents[0]}$`) }).click();
    await page.locator('#vote-list .tile', { hasText: new RegExp(`^${innocents[1]}$`) }).click();
    assert.equal(await page.locator('#vote-list .tile[aria-pressed="true"]').count(), 2);
    await shot(page, '13-vote-two');
    await page.click('#vote-confirm');
    assert.deepEqual(await page.locator('#reveal-names span').allInnerTexts(), round.impostors);
    assert.equal(await page.locator('#winner').innerText(), 'המתחזים ניצחו!');
    for (const name of five) assert.equal(await scoreOf(page, '#scores', name), round.impostors.includes(name) ? 2 : 0);
    assert.equal(await page.locator('#reveal-stamp .fx-stamp').innerText(), 'חמקו');
    await shot(page, '14-result-two', { settle: 5400, fullPage: true });

    // Next round: this time both are named and fail the guess.
    await page.click('#next-round');
    const next = await deal(page, five);
    assert.notEqual(next.word, round.word);
    await vote(page, next.impostors);
    await page.click('#vote-confirm');
    assert.equal(await page.locator('#verdict').textContent(), 'תפסתם!');
    await page.click('#show-word');
    await page.click('#guess-wrong');
    assert.equal(await page.locator('#winner').innerText(), 'הקבוצה ניצחה!');
    for (const name of five) {
      assert.equal(await scoreOf(page, '#scores', name), (round.impostors.includes(name) ? 2 : 0) + (next.impostors.includes(name) ? 0 : 1));
    }
    await context.close();
  });

  await step('settings and names survive a reload; a round in progress does not', async () => {
    const six = ['סבתא רחל', 'עומר', 'שירה', 'איתי', 'מאיה', 'דוד'];
    const { context, page } = await open();
    await page.click('#help-close');
    await setNames(page, six);
    await page.click('#impostor-count [data-value="2"]');
    await page.click('#timer [data-value="5"]');
    await page.locator('.switch').click();
    await page.click('#packs [data-pack="army"]');
    await page.click('#packs [data-pack="tech"]');
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), false);
    assert.deepEqual(await page.locator('.name-input').evaluateAll((inputs) => inputs.map((i) => i.value)), six);
    assert.equal(await page.locator('#impostor-count [aria-pressed="true"]').getAttribute('data-value'), '2');
    assert.equal(await page.locator('#timer [aria-pressed="true"]').getAttribute('data-value'), '5');
    assert.equal(await page.locator('#hint-toggle').isChecked(), true);
    assert.equal(await page.locator('#packs .tile[aria-pressed="true"]').count(), G.PACKS.length - 2);
    assert.equal(await page.locator('#packs [data-pack="army"]').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#player-count').innerText(), '6 שחקנים');

    // Removing players pulls the impostor count back into range.
    await page.locator('.remove-player').last().click();
    await page.locator('.remove-player').last().click();
    assert.equal(await page.locator('#impostor-count [aria-pressed="true"]').getAttribute('data-value'), '1');
    await page.locator('.remove-player').last().click();
    assert.equal(await page.locator('.name-input').count(), 3);
    assert.equal(await page.locator('.remove-player').first().isDisabled(), true, 'never fewer than three');

    // Two players with one name cannot start: nobody could tell them apart in the vote.
    await page.locator('.name-input').nth(1).fill('סבתא רחל');
    await page.click('#start-btn');
    assert.equal(await visibleScreen(page), 'setup');
    assert.ok((await page.locator('#toast').innerText()).includes('סבתא רחל'));
    await page.locator('.name-input').nth(1).fill('');
    await page.click('#start-btn');
    assert.equal(await page.locator('#deal-name').innerText(), 'סבתא רחל');
    await page.click('#card');
    const shown = await page.locator('#card-word').innerText();
    await page.click('#card');
    await page.click('#deal-next');
    assert.equal(await page.locator('#deal-name').innerText(), 'שחקן 2', 'an empty name falls back to a number');

    // A reload mid-round goes back to setup; nothing about the round is stored except the played word.
    await page.reload();
    assert.equal(await visibleScreen(page), 'setup');
    const stored = await readStore(page, SLUG);
    assert.deepEqual(Object.keys(stored).sort(), ['recent', 'rounds', 'scores', 'seenHelp', 'settings']);
    assert.equal(stored.recent.length, 1);
    if (shown !== 'אתם המתחזים!') assert.equal(await occurrences(page, shown), 0, 'the abandoned word is not in the page');

    // Twelve is the limit.
    while (!(await page.locator('#add-player').isDisabled())) await page.click('#add-player');
    assert.equal(await page.locator('.name-input').count(), G.MAX_PLAYERS);
    assert.equal(await page.locator('#impostor-count [data-value="3"]').isDisabled(), false);
    assert.equal(await horizontalOverflow(page), 0);
    await context.close();
  });

  await step('timer runs on the wall clock and ends the discussion', async () => {
    const start = new Date('2026-11-20T18:00:00Z');
    const { context, page } = await open({ fixedTime: start });
    await page.click('#help-close');
    await setNames(page, FOUR);
    await page.click('#timer [data-value="2"]');
    await page.click('#start-btn');
    await deal(page, FOUR);
    assert.equal(await page.locator('#clock').innerText(), '2:00');
    assert.equal(await page.locator('#dial').evaluate((d) => d.style.getPropertyValue('--left')), '1.0000', 'the ring starts full');
    await shot(page, '15-talk-timer');
    await page.clock.setFixedTime(new Date(start.getTime() + 61_000));
    await page.waitForFunction(() => document.getElementById('clock').textContent === '0:59');
    assert.equal(await page.locator('#dial').evaluate((d) => d.style.getPropertyValue('--left')), (59 / 120).toFixed(4));
    assert.equal(await page.locator('#clock-wrap').evaluate((n) => n.className), 'clock-wrap');
    await page.clock.setFixedTime(new Date(start.getTime() + 95_000));
    await page.waitForFunction(() => document.getElementById('clock-wrap').classList.contains('low'));
    assert.equal(await page.locator('#clock').innerText(), '0:25');
    await page.clock.setFixedTime(new Date(start.getTime() + 121_000));
    await page.waitForFunction(() => document.getElementById('clock-wrap').classList.contains('over'));
    assert.equal(await page.locator('#clock').innerText(), '0:00');
    assert.equal(await page.locator('#dial').evaluate((d) => d.style.getPropertyValue('--left')), '0.0000', 'and is wound back to nothing');
    assert.ok((await page.locator('#clock-note').innerText()).includes('הזמן נגמר'));
    assert.ok((await page.locator('#toast').innerText()).includes('הזמן נגמר'));
    await shot(page, '16-talk-time-up');
    await page.click('#to-vote');
    assert.equal(await visibleScreen(page), 'vote');

    // Cancelling the round returns to setup without touching the scores.
    await page.locator('#vote .quit').click();
    assert.equal(await visibleScreen(page), 'setup');
    assert.equal((await readStore(page, SLUG)).rounds, 0);
    await context.close();
  });

  await step('the card hides itself when the page is hidden, and works from the keyboard', async () => {
    const { context, page } = await open();
    await page.click('#help-close');
    await page.click('#start-btn');
    await page.locator('#card').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#card-word').count(), 1);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    assert.equal(await page.locator('#card-word').count(), 0, 'leaving the page turns the card down');
    assert.equal(await page.locator('#card').getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#card-word').count(), 1);
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#deal-next').isVisible(), true);
    await context.close();
  });

  await step('reduced motion: the card and the reveal are complete without any animation', async () => {
    const { context, page } = await open({ reducedMotion: 'reduce' });
    await page.click('#help-close');
    await setNames(page, ['רון', 'גל', 'טל']);
    await page.click('#start-btn');
    await page.click('#card');
    // No transition: the card is face up at once, and face down at once.
    assert.equal(await page.locator('#card .fx-flip-inner').evaluate((n) => new DOMMatrix(getComputedStyle(n).transform).m11), -1);
    await page.click('#card');
    assert.equal(await page.locator('#card .fx-flip-inner').evaluate((n) => getComputedStyle(n).transform), 'none');
    const { impostors } = await deal(page, ['רון', 'גל', 'טל'], { peeked: true });
    await vote(page, impostors);
    await page.click('#vote-confirm');
    assert.equal(await page.locator('#unmask .unmask-inner').evaluate((n) => getComputedStyle(n).transform), 'none', 'the name side is up');
    assert.equal(await page.locator('#reveal-names').innerText(), impostors[0]);
    assert.equal(await page.locator('#reveal-stamp .fx-stamp').evaluate((n) => getComputedStyle(n).opacity), '1');
    await page.click('#show-word');
    await page.click('#guess-wrong');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('canvas.fx-confetti').count(), 0);
    await shot(page, '27-reduced-motion-result', { fullPage: true });
    await context.close();
  });

  await step('invite share: the game link, no result', async () => {
    const { context, page } = await open();
    await page.click('#help-close');
    const text = await shareToClipboard(page);
    assert.equal(text, G.inviteText(session.url));
    assert.ok(text.endsWith(session.url));
    assert.ok((await page.locator('#toast').innerText()).includes('הועתקה'));
    assert.equal(await page.locator('#whatsapp-btn').getAttribute('href'), 'https://wa.me/?text=' + encodeURIComponent(text));
    await context.close();
  });

  await step('dark mode and a 360px phone: every screen fits', async () => {
    const names = ['אלכסנדרה-מרים', 'יהונתן', 'בן', 'שחר', 'ליאור'];
    const { context, page } = await open({ colorScheme: 'dark', viewport: { width: 360, height: 640 } });
    await page.click('#help-close');
    await setNames(page, names);
    await page.click('#impostor-count [data-value="2"]');
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '20-dark-setup', { fullPage: true });
    await page.click('#start-btn');
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '21-dark-deal-hidden');
    await page.click('#card');
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '22-dark-deal-shown', { settle: 900 });
    await page.click('#card');
    const { impostors } = await deal(page, names, { peeked: true });
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '23-dark-talk', { fullPage: true });
    await vote(page, impostors);
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '24-dark-vote', { fullPage: true });
    await page.click('#vote-confirm');
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '25-dark-reveal', { settle: 3200 });
    await page.click('#show-word');
    await page.click('#guess-right');
    assert.equal(await horizontalOverflow(page), 0);
    await shot(page, '26-dark-result', { fullPage: true, settle: 2400 });
    // Tap targets: nothing a thumb must hit is smaller than 44px.
    const small = await page.evaluate(() => [...document.querySelectorAll('button, a.btn, input.field')]
      .filter((n) => n.offsetParent && !n.closest('.foot') && n.getBoundingClientRect().height < 44)
      .map((n) => n.id || n.className));
    assert.deepEqual(small, ['link reset-scores'], 'only the deliberately small reset link is under 44px');
    await context.close();
  });

  await step('corrupted storage: the game starts fresh and still works', async () => {
    const { context, page } = await open();
    await page.evaluate(() => localStorage.setItem('hd:mitchaze', '{not json'));
    await page.reload();
    assert.equal(await isDialogOpen(page, '#help-dialog'), true);
    await page.click('#help-close');
    await page.evaluate(() => localStorage.setItem('hd:mitchaze', JSON.stringify({
      seenHelp: true, settings: { names: 'x', impostors: 9, packs: ['nope'], timer: 'soon' }, scores: { a: 1 }, rounds: -2, recent: 7,
    })));
    await page.reload();
    assert.equal(await page.locator('.name-input').count(), G.DEFAULT_PLAYERS);
    assert.equal(await page.locator('#packs .tile[aria-pressed="true"]').count(), G.PACKS.length);
    assert.equal(await page.locator('#impostor-count [aria-pressed="true"]').getAttribute('data-value'), '1');
    await page.click('#start-btn');
    const round = await deal(page, G.resolveNames(['', '', '', '']));
    assert.equal(round.impostors.length, 1);
    await context.close();
  });
});

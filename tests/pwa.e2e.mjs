// Installable app: the site caches itself, then every page works with the network off;
// the hub's install card behaves on Android-style browsers, on iPhone, and once installed.
import assert from 'node:assert/strict';
import { createSession, isDialogOpen } from './helpers.mjs';
import { GAMES } from '../shared/registry.js';

const { root, open, step, shot, run } = await createSession({ slug: 'pwa', port: 4189, path: '' });
const withSW = { serviceWorkers: 'allow' };

async function waitForOfflineReady(page) {
  // Controlled by the worker and its install (caching every file) finished.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    if (!keys.length) return false;
    const cache = await caches.open(keys[0]);
    return (await cache.keys()).length > 50;
  }, null, { timeout: 15000 });
}

await run(async () => {
  await step('the site caches itself, then the hub and every game open and play with no network', async () => {
    const { context, page } = await open(withSW);
    await waitForOfflineReady(page);
    await context.setOffline(true);

    await page.reload();
    assert.ok(await page.locator('#games li').count() >= 7, 'hub map pins render offline');
    const fontOk = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Secular One"', 'חמש'); });
    assert.ok(fontOk, 'display font loads from the cache');
    await shot(page, '01-hub-offline');

    for (const game of GAMES) {
      await page.goto(`${root}games/${game.slug}/`);
      await page.waitForSelector('.top .back', { timeout: 10000 });
      assert.equal(await page.title() !== '', true, `${game.slug} has a title offline`);
    }

    // Query strings (archive days, the "next" deck) are the same cached page.
    await page.goto(`${root}?next=1`);
    await page.waitForFunction(() => document.getElementById('deck').open, null, { timeout: 10000 });
    await page.goto(`${root}games/arba/?day=1`);
    await page.waitForSelector('.top .back');

    // An address the site doesn't have falls back to the hub instead of the browser's offline page.
    await page.goto(`${root}games/nowhere/`);
    await page.waitForSelector('#games li', { state: 'attached' });
    await context.close();
  });

  await step('offline, moving from a game back to the hub works from a fresh visit too', async () => {
    const { context, page } = await open(withSW);
    await waitForOfflineReady(page);
    await context.setOffline(true);
    await page.goto(`${root}games/mitchaze/`);
    await page.waitForSelector('.top .back');
    await page.goto(root);
    await page.waitForSelector('#games li', { state: 'attached' });
    assert.ok(await page.locator('#games li').count() >= 7);
    await context.close();
  });

  await step('Android/desktop Chrome: the install card appears when the browser offers install, and the button opens it', async () => {
    const { context, page } = await open();
    assert.equal(await page.locator('#install').isHidden(), true, 'hidden until the browser offers install');
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      event.prompt = () => { window.__prompted = true; };
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });
    await page.locator('#install').waitFor({ state: 'visible' });
    await page.locator('#install').scrollIntoViewIfNeeded();
    await shot(page, '02-install-card');
    await page.click('#install-btn');
    assert.equal(await page.evaluate(() => window.__prompted), true, 'the browser install dialog was requested');
    await page.waitForFunction(() => document.getElementById('install').hidden);
    await context.close();
  });

  await step('iPhone: the card explains Share → Add to Home Screen in a sheet that closes', async () => {
    const { context, page } = await open({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    await page.locator('#install').waitFor({ state: 'visible' });
    await page.click('#install-btn');
    assert.equal(await isDialogOpen(page, '#ios-sheet'), true);
    assert.ok((await page.locator('#ios-sheet').innerText()).includes('הוספה למסך הבית'));
    await shot(page, '03-ios-sheet');
    await page.click('#ios-sheet button');
    assert.equal(await isDialogOpen(page, '#ios-sheet'), false);
    await context.close();
  });

  await step('already running as an installed app: no install card', async () => {
    const { context, page } = await open({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    await page.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true }); });
    await page.reload();
    await page.waitForSelector('#games li', { state: 'attached' });
    assert.equal(await page.locator('#install').isHidden(), true);
    await context.close();
  });

  await step('dark mode: install card and iPhone sheet stay readable', async () => {
    const { context, page } = await open({
      colorScheme: 'dark',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    await page.locator('#install').waitFor({ state: 'visible' });
    await page.locator('#install').scrollIntoViewIfNeeded();
    await shot(page, '04-install-dark');
    await page.click('#install-btn');
    await shot(page, '05-ios-sheet-dark');
    await context.close();
  });
});

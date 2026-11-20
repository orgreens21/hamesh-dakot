// Shared plumbing for the browser tests (tests/<slug>.e2e.mjs). See games/README.md for how to use it.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from '../scripts/serve.mjs';

/**
 * Starts the static server and Chrome for one test file.
 *   slug  names the screenshots folder and, by default, the page under test (games/<slug>/)
 *   port  the game's own port from the registry table, so test files can run side by side
 *   path  the page to open, relative to the site root (the hub passes '')
 */
export async function createSession({ slug, port, path = `games/${slug}/` }) {
  const server = await startServer(port);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
  const root = `http://localhost:${port}/`;
  const url = root + path;
  const shots = fileURLToPath(new URL(`./screenshots/${slug}/`, import.meta.url));
  await mkdir(shots, { recursive: true });
  const errors = [];
  let passed = 0;

  /**
   * A fresh browser profile (empty storage) at phone size, Hebrew locale, clipboard allowed.
   * options: any Playwright context option (colorScheme: 'dark', viewport, isMobile…) plus
   *   fixedTime  a Date the page's clock is frozen at; change it later with page.clock.setFixedTime()
   * subPath is appended to the session url: open({}, '?day=3')
   */
  async function open({ fixedTime, ...options } = {}, subPath = '') {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'he-IL',
      // Service workers are off by default so every test sees the files on disk and its own
      // network stubs; tests/pwa.e2e.mjs turns them on to test offline play.
      permissions: ['clipboard-read', 'clipboard-write'], serviceWorkers: 'block', ...options,
    });
    const page = await context.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.text()} (${page.url()})`); });
    page.on('pageerror', (e) => errors.push(String(e)));
    if (fixedTime) await page.clock.setFixedTime(fixedTime);
    await page.goto(url + subPath);
    return { context, page };
  }

  async function step(name, fn) {
    try { await fn(); passed++; console.log('✔', name); }
    catch (err) { console.log('✖', name); throw err; }
  }

  /** Saves tests/screenshots/<slug>/<name>.png. Waits a moment first so entry animations have settled. */
  async function shot(page, name, { fullPage = false, settle = 450 } = {}) {
    if (settle) await page.waitForTimeout(settle);
    await page.screenshot({ path: `${shots}${name}.png`, fullPage });
  }

  /**
   * Runs the test body, then checks that no page logged an error, prints a summary and shuts everything down.
   * A failure prints the error and exits non-zero, which is what tests/run-e2e.mjs looks at.
   */
  async function run(body) {
    try {
      await body();
      assert.deepEqual(errors, [], 'no console errors');
      console.log(`\n${slug}: ${passed} end-to-end scenarios passed, no console errors.`);
    } catch (err) {
      console.error(err);
      process.exitCode = 1;
    } finally {
      await browser.close();
      server.close();
    }
  }

  return { root, url, shots, errors, open, step, shot, run };
}

/** Pixels of sideways scroll; must be 0 on a phone. */
export function horizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * Clicks the share button and returns what landed on the clipboard.
 * The native share sheet is switched off first: headless Chrome has nothing to share to.
 */
export async function shareToClipboard(page, selector = '#share-btn') {
  await page.evaluate(() => { navigator.share = undefined; });
  await page.click(selector);
  return page.evaluate(() => navigator.clipboard.readText());
}

export function isDialogOpen(page, selector) {
  return page.locator(selector).evaluate((d) => d.open);
}

export function readStore(page, slug) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), 'hd:' + slug);
}

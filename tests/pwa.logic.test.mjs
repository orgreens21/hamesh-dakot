// The installable-app plumbing: sw.js in step with the site, local fonts everywhere, a valid manifest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildServiceWorker, siteFiles } from '../scripts/build-sw.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => readFile(ROOT + f, 'utf8');
const exists = (f) => access(ROOT + f).then(() => true, () => false);

test('sw.js is up to date with the site files (run: node scripts/build-sw.mjs)', async () => {
  assert.equal(await read('sw.js'), await buildServiceWorker());
});

test('the offline cache holds every page, script and asset, and nothing players never load', async () => {
  const files = await siteFiles();
  for (const f of ['index.html', 'manifest.webmanifest', 'shared/pwa.js', 'shared/fonts.css', 'shared/hub.js', 'games/nekuda/data.js', 'assets/icon-192.png']) {
    assert.ok(files.includes(f), `${f} is cached`);
  }
  for (const f of files) {
    assert.ok(!/_template\/|README\.md$|build-data\.mjs$|candidates\.mjs$/.test(f), `${f} should not be cached`);
  }
  const sw = await read('sw.js');
  for (const slug of ['nekuda', 'beerech', 'miani', 'tzir', 'herkev', 'yoter', 'blimilim']) {
    assert.ok(sw.includes(`"games/${slug}/"`), `the ${slug} page address is cached`);
  }
});

test('every page uses the bundled fonts, registers offline support and links the manifest', async () => {
  const pages = (await siteFiles()).filter((f) => f.endsWith('index.html')).concat('brand/index.html');
  for (const page of pages) {
    const html = await read(page);
    const up = '../'.repeat(page.split('/').length - 1);
    assert.ok(!html.includes('fonts.googleapis') && !html.includes('fonts.gstatic'), `${page} must not load Google Fonts`);
    assert.ok(html.includes(`href="${up}shared/fonts.css"`), `${page} links the local fonts`);
    assert.ok(html.includes(`src="${up}shared/pwa.js"`), `${page} loads shared/pwa.js`);
    assert.ok(html.includes(`href="${up}manifest.webmanifest"`), `${page} links the manifest`);
  }
});

test('every font file named in fonts.css exists', async () => {
  const css = await read('shared/fonts.css');
  const urls = [...css.matchAll(/url\(\.\.\/([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 6);
  for (const u of urls) assert.ok(await exists(u), u);
});

test('the manifest is installable: name, start URL, standalone, 192 and 512 icons, a maskable icon, real shortcut targets', async () => {
  const m = JSON.parse(await read('manifest.webmanifest'));
  assert.ok(m.name && m.short_name && m.start_url && m.display === 'standalone');
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const icon of m.icons) assert.ok(await exists(icon.src), icon.src);
  for (const s of m.shortcuts) {
    const target = s.url.split('?')[0].replace(/^\.\//, '');
    assert.ok(await exists((target || '') + 'index.html'), `shortcut ${s.name} → ${s.url}`);
  }
});

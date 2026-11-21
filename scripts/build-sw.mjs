// Writes sw.js: the service worker that makes the site work offline.
// It lists every file the site needs and is stamped with a hash of their contents,
// so any change to the site produces a new sw.js and installed copies update themselves.
// Run after changing any site file: node scripts/build-sw.mjs (npm test fails if you forget).
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const INCLUDE = ['index.html', 'manifest.webmanifest', 'robots.txt', 'assets', 'shared', 'games', 'groups'];
// Build scripts, docs and the developer template are never loaded by players.
const SKIP = /(^|\/)(_template\/|README\.md$|build-data\.mjs$|candidates\.mjs$)/;

async function walk(rel) {
  const entries = await readdir(ROOT + rel, { withFileTypes: true }).catch(() => null);
  if (!entries) return [rel];
  const out = [];
  for (const e of entries) out.push(...(await walk(`${rel}/${e.name}`)));
  return out;
}

export async function siteFiles() {
  const files = [];
  for (const item of INCLUDE) files.push(...(await walk(item)));
  return files.filter((f) => !SKIP.test(f)).sort();
}

export async function buildServiceWorker() {
  const files = await siteFiles();
  const template = await readFile(ROOT + 'scripts/sw-template.js', 'utf8');
  // The worker's own code is part of the version too, so a change to it reaches installed copies.
  const hash = createHash('sha256').update(template);
  for (const f of files) hash.update(f).update(await readFile(ROOT + f));
  const version = hash.digest('hex').slice(0, 12);
  // Pages are requested by folder ("games/arba/"), so cache those addresses too.
  const urls = ['./', ...files.filter((f) => f.endsWith('/index.html') && f !== 'index.html').map((f) => f.slice(0, -'index.html'.length)), ...files];
  return template.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(urls, null, 1));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const body = await buildServiceWorker();
  await writeFile(ROOT + 'sw.js', body);
  console.log('sw.js written, version', /VERSION = '(\w+)'/.exec(body)[1]);
}

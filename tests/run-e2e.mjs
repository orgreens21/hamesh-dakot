// Runs the browser tests one file after another.
// Usage: node tests/run-e2e.mjs            every tests/*.e2e.mjs
//        node tests/run-e2e.mjs nekuda hub only the named ones
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const wanted = process.argv.slice(2);
const available = readdirSync(dir).filter((f) => f.endsWith('.e2e.mjs')).sort();
const unknown = wanted.filter((slug) => !available.includes(slug + '.e2e.mjs'));
if (unknown.length) {
  console.error(`No test file for: ${unknown.join(', ')}. Available: ${available.map((f) => f.replace('.e2e.mjs', '')).join(', ')}`);
  process.exit(1);
}
const files = wanted.length ? wanted.map((slug) => slug + '.e2e.mjs') : available;

const failed = [];
for (const file of files) {
  console.log(`\n── ${file} ──`);
  // One at a time: each file starts its own server and Chrome, and a failure should be easy to read.
  const result = spawnSync(process.execPath, [dir + file], { stdio: 'inherit' });
  if (result.status !== 0) failed.push(file);
}

console.log(`\n${files.length - failed.length}/${files.length} end-to-end files passed.`);
if (failed.length) {
  console.error('Failed: ' + failed.join(', '));
  process.exit(1);
}

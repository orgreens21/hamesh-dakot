// Builds games/tzir/data.js from candidates.mjs, taking every year from Wikidata.
// Usage: node games/tzir/build-data.mjs            (prints what was dropped and why)
//
// A candidate names a Wikipedia article, a Hebrew phrase and the year the curator expects. The
// script resolves the article to its Wikidata item and keeps the event only if one dated statement
// on that item (inception, publication, launch, opening…) gives exactly that year and nothing else.
// So every shipped year is confirmed twice: once by the curator, once by Wikidata. Anything that
// disagrees, has two different years, or is dated less precisely than a year is left out.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ISRAEL, WORLD } from './candidates.mjs';

const UA = 'daily-games-data-builder/1.0 (static puzzle site; build script)';
const OUT = fileURLToPath(new URL('./data.js', import.meta.url));

// Dated statements that can stand for "the year this happened", in order of preference for the record.
const DATE_PROPS = {
  P571: 'inception', P577: 'publication date', P585: 'point in time', P1619: 'date of official opening',
  P619: 'launch date', P575: 'time of discovery or invention', P1191: 'date of first performance',
  P580: 'start time', P606: 'first flight', P729: 'service entry',
};
const NOBELS = new Set(['Q7191', 'Q44585', 'Q38104', 'Q80061', 'Q47170', 'Q35637']);
const TOPICS = new Set(['place', 'inst', 'biz', 'media', 'tv', 'film', 'music', 'book', 'sport', 'space', 'tech', 'build', 'play', 'art']);
const MIN_YEAR = 1600;

function parse(block, il) {
  return block.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [title, year, text, topic, prop] = line.split(' | ').map((s) => s.trim());
    if (!title || !/^\d{4}$/.test(year) || !text || !TOPICS.has(topic)) throw new Error('Bad candidate line: ' + line);
    const he = title.startsWith('he:');
    return { wiki: he ? 'he' : 'en', title: he ? title.slice(3) : title, year: Number(year), text, topic, prop: prop || null, il };
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Optional response cache (--cache <file>), so a rebuild after editing phrases does not hit the APIs again.
const cachePath = process.argv.includes('--cache') ? process.argv[process.argv.indexOf('--cache') + 1] : null;
let cache = {};
if (cachePath) { try { cache = JSON.parse(await readFile(cachePath, 'utf8')); } catch { /* first run */ } }

async function getJson(url) {
  if (cache[url]) return cache[url];
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.ok) {
      const json = await res.json();
      if (cachePath) { cache[url] = json; await writeFile(cachePath, JSON.stringify(cache)); }
      await sleep(1000); // one request a second keeps us well inside the public API's limits
      return json;
    }
    if (attempt >= 8) throw new Error(`${res.status} for ${url}`);
    await sleep(Math.max(Number(res.headers.get('retry-after')) || 0, 5 * attempt) * 1000);
  }
}
const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

/** Article title -> Wikidata id, following normalisation and redirects. */
async function resolveTitles(wiki, titles) {
  const out = new Map();
  for (const batch of chunks([...new Set(titles)], 50)) {
    const url = `https://${wiki}.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageprops&ppprop=wikibase_item&titles=${encodeURIComponent(batch.join('|'))}`;
    const { query } = await getJson(url);
    const hop = new Map();
    for (const n of query.normalized || []) hop.set(n.from, n.to);
    for (const r of query.redirects || []) hop.set(r.from, r.to);
    const qidOf = new Map(Object.values(query.pages || {}).map((p) => [p.title, p.pageprops?.wikibase_item]));
    for (const title of batch) {
      let t = title;
      for (let i = 0; i < 4 && hop.has(t); i++) t = hop.get(t);
      if (qidOf.get(t)) out.set(title, qidOf.get(t));
    }
  }
  return out;
}

async function fetchEntities(qids) {
  const out = new Map();
  for (const batch of chunks([...new Set(qids)], 50)) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels&languages=he|en&ids=${batch.join('|')}`;
    const { entities } = await getJson(url);
    for (const [id, e] of Object.entries(entities || {})) out.set(id, e);
  }
  return out;
}

/** Year of a Wikidata time value, or null when it is vaguer than a year. */
function yearOf(snak) {
  const v = snak?.datavalue?.value;
  if (!v || typeof v.time !== 'string' || v.precision < 9) return null;
  const m = /^([+-])(\d+)-/.exec(v.time);
  return m ? (m[1] === '-' ? -1 : 1) * Number(m[2]) : null;
}

/** Best-rank statements only: preferred ones if there are any, otherwise the normal ones. */
function best(statements = []) {
  const live = statements.filter((s) => s.rank !== 'deprecated');
  const preferred = live.filter((s) => s.rank === 'preferred');
  return preferred.length ? preferred : live;
}

/** { P571: [1909], P577: [1993, 1994], … } for the props that carry a usable date. */
function datedYears(entity) {
  const found = {};
  for (const prop of Object.keys(DATE_PROPS)) {
    const years = [...new Set(best(entity.claims?.[prop]).map((s) => yearOf(s.mainsnak)).filter((y) => y != null))];
    if (years.length) found[prop] = years;
  }
  const nobel = best(entity.claims?.P166)
    .filter((s) => NOBELS.has(s.mainsnak?.datavalue?.value?.id))
    .flatMap((s) => (s.qualifiers?.P585 || []).map(yearOf)).filter((y) => y != null);
  if (nobel.length) found.NOBEL = [...new Set(nobel)];
  return found;
}

function judge(candidate, entity) {
  const found = datedYears(entity);
  const show = Object.entries(found).map(([p, ys]) => `${p}=${ys.join('/')}`).join(' ') || 'no dates';
  const props = candidate.prop ? [candidate.prop] : Object.keys(DATE_PROPS).filter((p) => found[p]);
  const hit = props.find((p) => found[p]?.length === 1 && found[p][0] === candidate.year);
  if (!hit) return { ok: false, why: `expected ${candidate.year}, Wikidata has ${show}` };
  // Without an explicit property, every dated statement must tell the same story.
  if (!candidate.prop && props.some((p) => found[p].some((y) => y !== candidate.year))) {
    return { ok: false, why: `ambiguous: ${show}` };
  }
  return { ok: true, prop: hit };
}

const candidates = [...parse(ISRAEL, 1), ...parse(WORLD, 0)];
const qids = new Map();
for (const wiki of ['en', 'he']) {
  const resolved = await resolveTitles(wiki, candidates.filter((c) => c.wiki === wiki).map((c) => c.title));
  for (const [title, qid] of resolved) qids.set(wiki + ':' + title, qid);
}
const entities = await fetchEntities([...qids.values()]);

const kept = [];
const dropped = [];
const seen = new Set();
for (const c of candidates) {
  const qid = qids.get(c.wiki + ':' + c.title);
  const entity = qid && entities.get(qid);
  if (!entity) { dropped.push([c, 'article or item not found']); continue; }
  if (seen.has(qid)) { dropped.push([c, 'same item as an earlier line']); continue; }
  if (c.year < MIN_YEAR) { dropped.push([c, 'too early']); continue; }
  const verdict = judge(c, entity);
  if (!verdict.ok) { dropped.push([c, verdict.why]); continue; }
  seen.add(qid);
  kept.push({ ...c, qid, prop: verdict.prop, label: entity.labels?.he?.value || entity.labels?.en?.value || '' });
}

const today = new Date().toISOString().slice(0, 10);
const rows = kept.map((e) => `  [${[e.qid, e.year, e.text, e.topic, e.il, e.prop].map((v) => JSON.stringify(v)).join(', ')}],`).join('\n');
const file = `// Generated by games/tzir/build-data.mjs. Do not edit by hand: change candidates.mjs and rebuild.
// Every year below is the year Wikidata gives for the item, in the statement named in the last column
// (${Object.entries(DATE_PROPS).map(([p, n]) => `${p} ${n}`).join(', ')};
// NOBEL = the "point in time" of the item's Nobel Prize statement). The Hebrew wording is ours.

export const SOURCE = {
  name: 'ויקינתונים (Wikidata)',
  url: 'https://www.wikidata.org/',
  license: 'CC0',
  retrieved: '${today}',
};

// [Wikidata item, year, Hebrew phrase, topic, 1 = Israeli / 0 = world, Wikidata property the year came from]
const ROWS = [
${rows}
];

export const EVENTS = ROWS.map(([id, year, text, topic, il, prop]) => ({ id, year, text, topic, il: il === 1, prop }));
`;
await writeFile(OUT, file);

for (const [c, why] of dropped) console.log(`DROP  ${c.title} | ${c.text} | ${why}`);
if (process.argv.includes('--labels')) for (const e of kept) console.log(`KEEP  ${e.year} ${e.prop} | ${e.text} | ${e.label}`);
console.log(`\n${kept.length} events kept (${kept.filter((e) => e.il).length} Israeli, ${kept.filter((e) => !e.il).length} world), ${dropped.length} dropped. Wrote ${OUT}`);

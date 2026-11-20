// Builds games/yoter/data.js: the item lists behind every theme of יותר או פחות.
// Usage: node games/yoter/build-data.mjs
//
// Everything comes from Wikidata (CC0). Population is taken from the locality list the site already
// built for נקודת ציון (games/nekuda/data.js, itself generated from Wikidata), read here at build
// time and copied into our own file so the two games do not depend on each other at run time.
//
// The filters below are deliberately strict: an item whose statements disagree with each other is
// dropped rather than guessed at, because a wrong "fact" is worse than a shorter list.
import { writeFile } from 'node:fs/promises';
import { LOCALITIES } from '../nekuda/data.js';

const LABEL = '?item rdfs:label ?he. FILTER(lang(?he)="he")';

const QUERIES = {
  founded: `SELECT ?item ?he ?v ?links WHERE { ?item wdt:P3466 ?code; wdt:P571 ?d; wikibase:sitelinks ?links. BIND(YEAR(?d) AS ?v) ${LABEL} FILTER(?links >= 12) }`,
  peaks: `SELECT ?item ?he ?v ?links WHERE { ?item wdt:P17 wd:Q801; wdt:P31/wdt:P279* wd:Q8502; p:P2044/psv:P2044 [wikibase:quantityAmount ?v; wikibase:quantityUnit wd:Q11573]; wikibase:sitelinks ?links. ${LABEL} FILTER(?links >= 4) }`,
  films: `SELECT ?item ?he ?v ?links WHERE { ?item wdt:P495 wd:Q801; wdt:P31 wd:Q11424; wdt:P364 wd:Q9288; wdt:P577 ?d; wikibase:sitelinks ?links. BIND(YEAR(?d) AS ?v) ${LABEL} FILTER(?links >= 5) }`,
  tv: `SELECT ?item ?he ?v ?links WHERE { ?item wdt:P495 wd:Q801; wdt:P31/wdt:P279* wd:Q5398426; wdt:P580 ?d; wikibase:sitelinks ?links. BIND(YEAR(?d) AS ?v) ${LABEL} FILTER(?links >= 3) }`,
  // Singers and actors born in Israel; anyone who also went into politics is left out.
  born: `SELECT DISTINCT ?item ?he ?v ?links WHERE { VALUES ?o { wd:Q177220 wd:Q488205 wd:Q33999 wd:Q10800557 wd:Q2405480 } ?item wdt:P27 wd:Q801; wdt:P106 ?o; wdt:P569 ?d; wdt:P19 ?place; wikibase:sitelinks ?links. ?place wdt:P17 wd:Q801. FILTER NOT EXISTS { ?item wdt:P106 wd:Q82955 } BIND(YEAR(?d) AS ?v) ${LABEL} FILTER(?links >= 14) }`,
};

async function sparql(query) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(query), {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'daily-game-data-fetch/1.0' },
    });
    if (res.ok) return (await res.json()).results.bindings;
    if (attempt === 4) throw new Error('Wikidata returned ' + res.status);
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
}

// Disambiguation in brackets goes too: "(סרט, 2014)" would give the answer away.
const cleanName = (s) => s.replace(/\s*\(.*?\)\s*/g, ' ').replace(/[֑-ׇ]/g, (c) => (c === '־' ? '-' : '')).replace(/\s+/g, ' ').trim();

/**
 * One row per Wikidata item. `spread` is how far apart an item's own statements may be before we
 * stop trusting it; when they agree closely enough the smallest is used (the first release, the
 * founding rather than a later change of status).
 */
function collapse(rows, { spread, relative = false }) {
  const byItem = new Map();
  for (const r of rows) {
    const id = r.item.value;
    const e = byItem.get(id) || { name: cleanName(r.he.value), values: [], links: +r.links.value };
    e.values.push(+r.v.value);
    byItem.set(id, e);
  }
  const out = [];
  for (const e of byItem.values()) {
    const lo = Math.min(...e.values);
    const hi = Math.max(...e.values);
    const gap = relative ? (hi - lo) / Math.max(Math.abs(hi), Math.abs(lo), 1) : hi - lo;
    if (gap > spread) continue;
    out.push({ name: e.name, value: lo, links: e.links });
  }
  return out;
}

/** Keeps the better-known item when two share a name, then sorts so the file diffs cleanly. */
function finish(items, { drop = [], round = (v) => v } = {}) {
  const byName = new Map();
  for (const it of items) {
    if (!/[א-ת]/.test(it.name) || /[A-Za-z]/.test(it.name)) continue;
    if (drop.some((d) => (d instanceof RegExp ? d.test(it.name) : d === it.name))) continue;
    const prev = byName.get(it.name);
    if (!prev || prev.links < it.links) byName.set(it.name, it);
  }
  return [...byName.values()].map((it) => [it.name, round(it.value)]).sort((a, b) => a[0].localeCompare(b[0], 'he'));
}

// Places whose very existence is argued over are left out: the game is about numbers, not borders.
const DISPUTED_PLACES = ['אריאל', 'מעלה אדומים', 'מודיעין עילית', 'ביתר עילית', 'קריית ארבע', 'חברון', 'גבעת זאב', 'אפרת', 'קצרין', 'עמנואל', 'אלפי מנשה', 'קרני שומרון', 'אורנית', 'אלקנה', 'בית אל', 'עפרה', 'קדומים', 'אורנים'];

// Merged councils and renamed towns that appear twice in the locality list under both names.
const DUPLICATE_PLACES = ['יהוד', "באקה-ג'ת"];

const localityPop = new Map(LOCALITIES.map((l) => [l[0], l[3]]));
const byHebrew = (a, b) => a[0].localeCompare(b[0], 'he');
const data = {};

// ---- population: towns of 20,000 people and more
data.population = LOCALITIES
  .filter((l) => l[3] >= 20000 && !DISPUTED_PLACES.includes(l[0]) && !DUPLICATE_PLACES.includes(l[0]))
  .map((l) => [l[0], l[3]])
  .sort(byHebrew);

// ---- how far north a town lies: kilometres north of Eilat, measured along the meridian from the
// latitude Wikidata gives for each place (one degree of latitude is 111.19 km).
const eilat = LOCALITIES.find((l) => l[0] === 'אילת');
data.north = LOCALITIES
  .filter((l) => l[3] >= 15000 && l[0] !== 'אילת' && !DISPUTED_PLACES.includes(l[0]) && !DUPLICATE_PLACES.includes(l[0]))
  .map((l) => [l[0], Math.round((l[1] - eilat[1]) * 111.19)])
  .sort(byHebrew);

// ---- founding year: modern localities only. Ancient towns carry several contradictory "inception"
// dates, and a year like 1500 BCE is no fun to compare anyway.
data.founded = finish(
  collapse(await sparql(QUERIES.founded), { spread: 0 }).filter((it) => it.value >= 1870 && it.value <= 2000 && localityPop.has(it.name)),
  {
    drop: [
      ...DISPUTED_PLACES, ...DUPLICATE_PLACES,
      // Over the Green Line or on the Golan: left out for the same reason as above.
      'איתמר', 'בת עין', 'טלמון', 'חשמונאים', 'כרמי צור', 'עלי', 'פדואל', 'דולב', 'הר ברכה', 'יצהר', 'נווה דניאל', 'נוקדים', 'בית אריה-עופרים', 'מעלה עמוס', 'ענב', 'פסגות', 'בית הערבה', 'גבעון החדשה', 'ורד יריחו', 'שילה', 'כפר תפוח', 'אלמוג', 'בית חורון', 'מגדל עוז', 'נווה צוף', 'אלעזר', 'הר גילה', 'נווה אטי״ב', 'מצפה שלם', 'אלון שבות', 'מבוא חורון', 'ראש צורים', 'עין זיוון', 'קלי"ה', 'בוקעאתא',
      // Old villages and merged councils, where the year is the date of a merger or a new status.
      'פקיעין', 'בועיינה-נוג\'ידאת', 'ג\'דיידה-מכר', 'מודיעין-מכבים-רעות', 'יהוד-מונוסון', 'ג׳סר א-זרקא', 'בסמת טבעון', 'ריחאניה',
    ],
  },
);

// ---- height of mountains above sea level, metres
data.peaks = finish(
  collapse(await sparql(QUERIES.peaks), { spread: 0.03, relative: true })
    .filter((it) => it.value > -450 && it.value < 2300 && /^(הר |קרני |גבעת המורה)/.test(it.name)),
  // Holy sites and cemeteries are not what a "how high is this hill" round should be about.
  { drop: ['הר הבית', 'הר המנוחות', 'הר הרצל', 'הר הזיתים', 'הר חוצבים'], round: Math.round },
);

// ---- Israeli films in Hebrew, year of first release. Festival and cinema dates may differ by a year.
data.films = finish(
  collapse(await sparql(QUERIES.films), { spread: 1 }).filter((it) => it.value >= 1950 && it.value <= 2024),
  // War films and conflict documentaries are skipped: the theme should stay light.
  { drop: ['לבנון', 'בופור', 'מבצע יונתן', 'שומרי הסף', 'כיפור', 'התנתקות', "הדרך לג'נין", 'הילדים של ארנה', 'ילדי היטלר', 'לאה צמל, עורכת דין', 'זעקות ואז שתיקה', 'החייל הנעלם', 'גבעה 24 אינה עונה', 'מצור', 'בית לחם', 'קירות', 'מיראל', 'הזמן שנותר: כרוניקה של נוכח נפקד', 'הספציאליסט', 'ילדי סטלין', 'אוריינטד', 'קרקס פלשתינה', 'בקבוק בים של עזה', "מסעות ג'יימס בארץ הקודש"] },
);

// ---- Israeli television series, year of first broadcast
data.tv = finish(
  collapse(await sparql(QUERIES.tv), { spread: 0 }).filter((it) => it.value >= 1968 && it.value <= 2024),
  { drop: ['שעת נעילה', 'הנערים', 'עמוד האש', 'המטרה: אמיא', 'שחר אדום', 'ערכים מוויקיפדיה מומחזים על ידי גרביים', 'מנאייכ', 'רוחות ביירות', 'חטופים', 'בני ערובה', 'אורי גלר מחפש את היורש'] },
);

// ---- year of birth of Israeli singers and actors
data.born = finish(
  collapse(await sparql(QUERIES.born), { spread: 0 }).filter((it) => it.value >= 1900),
  { drop: ["ג'וליאנו מר", 'אייל גולן', 'אורי גלר', 'אתגר קרת', 'לוסי אהריש'] },
);

const today = new Date().toISOString().slice(0, 10);
const body =
  '// Generated by games/yoter/build-data.mjs. Do not edit by hand; change the script and run it again.\n' +
  '// Source: Wikidata (https://www.wikidata.org), CC0. Population comes from the same source by way of\n' +
  '// games/nekuda/data.js. Each row is [Hebrew name, value]; units are described in game.js.\n' +
  `export const SOURCE = ${JSON.stringify({ name: 'ויקינתונים', english: 'Wikidata', url: 'https://www.wikidata.org', license: 'CC0', retrieved: today })};\n\n` +
  'export const DATA = {\n' +
  Object.entries(data).map(([id, rows]) => `  ${id}: [\n${rows.map((r) => '    ' + JSON.stringify(r)).join(',\n')},\n  ],`).join('\n') +
  '\n};\n';
await writeFile(new URL('./data.js', import.meta.url), body);
for (const [id, rows] of Object.entries(data)) console.log(id.padEnd(12), rows.length);

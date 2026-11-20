// Builds the answer lists (data/<topic>.js) and the daily grids (grids.js) for צומת.
//
//   node games/herkev/build-data.mjs                          fetch every topic from Wikidata, write everything
//   node games/herkev/build-data.mjs --cache <dir>            keep the raw query results in <dir> and reuse them next time
//   node games/herkev/build-data.mjs --only countries,music   rebuild only these topics' lists (the grids are always rebuilt)
//   node games/herkev/build-data.mjs --grids-only             regenerate grids.js from the data files already on disk
//
// Source: Wikidata (query.wikidata.org), CC0. Every criterion is decided by a Wikidata statement (or
// a value computed from one), never by hand, so an answer is accepted exactly when Wikidata says so.
// Wikidata is incomplete, and the page says so. Regenerating grids.js changes every future day's
// puzzle; do not do it casually once the site is live.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mulberry32 } from '../../shared/core.js';
import { SIZE, CELLS, validItems, assignDistinct, sharedCriteria, cellPairs, itemsFromRows } from './rules.js';

const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const cacheDir = option('--cache');
const only = option('--only')?.split(',');
const gridsOnly = args.includes('--grids-only');

// ---------- Wikidata ----------

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'daily-games-data-builder/1.0'; // generic on purpose: no personal details leave the machine

async function sparql(query) {
  const file = cacheDir && `${cacheDir}/${createHash('sha1').update(query).digest('hex')}.json`;
  if (file && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'query=' + encodeURIComponent(query),
      });
      if (response.ok) {
        const bindings = (await response.json()).results.bindings;
        if (file) { mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, JSON.stringify(bindings)); }
        return bindings;
      }
      if (attempt === 6) throw new Error(`Wikidata answered ${response.status}`);
    } catch (error) {
      if (attempt === 6) throw error;
    }
    await new Promise((done) => setTimeout(done, 10000 * attempt));
  }
}

const qid = (binding) => binding?.value.split('/').pop();
const values = (name, ids) => `VALUES ?${name} { ${ids.map((id) => 'wd:' + id).join(' ')} }`;
const yearOf = (binding) => (binding ? Number(binding.value.slice(0, binding.value.indexOf('-', 1))) : 0);

/** Runs a query over a long list of items in batches (one big query times out). */
async function batched(ids, size, makeQuery) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(...await sparql(makeQuery(values('x', ids.slice(i, i + size)))));
    process.stdout.write('.');
  }
  return out;
}

/** Hebrew labels, other Hebrew names and sitelink counts for a list of items. */
async function labels(ids) {
  const out = new Map();
  const rows = await batched(ids, 300, (v) => `SELECT ?x ?he ?links (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) WHERE { ${v}
    ?x rdfs:label ?he FILTER(LANG(?he)="he") ?x wikibase:sitelinks ?links
    OPTIONAL { ?x skos:altLabel ?alt FILTER(LANG(?alt)="he") } } GROUP BY ?x ?he ?links`);
  for (const b of rows) out.set(qid(b.x), { he: b.he.value, links: Number(b.links.value), alts: b.alts?.value ? b.alts.value.split('|') : [] });
  return out;
}

/** "?x wdt:P ?v" for a list of items, as a map item -> Set of values (ids for items, strings otherwise). */
async function property(ids, prop, size = 400) {
  const out = new Map(ids.map((id) => [id, new Set()]));
  const rows = await batched(ids, size, (v) => `SELECT ?x ?v WHERE { ${v} ?x wdt:${prop} ?v }`);
  for (const b of rows) out.get(qid(b.x))?.add(b.v.type === 'uri' ? qid(b.v) : b.v.value);
  return out;
}

/** Like property(), but only statements that have not ended (no "end time" qualifier): memberships, currencies. */
async function currentProperty(ids, prop, size = 400) {
  const out = new Map(ids.map((id) => [id, new Set()]));
  const rows = await batched(ids, size, (v) => `SELECT ?x ?v WHERE { ${v} ?x p:${prop} ?s . ?s ps:${prop} ?v .
    FILTER NOT EXISTS { ?s pq:P582 [] } FILTER NOT EXISTS { ?s wikibase:rank wikibase:DeprecatedRank } }`);
  for (const b of rows) out.get(qid(b.x))?.add(b.v.type === 'uri' ? qid(b.v) : b.v.value);
  return out;
}

// ---------- names ----------

/** Hebrew labels carry disambiguators such as "(זמרת)" or "(שחקן)"; they go. */
const cleanName = (label) => label.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
const isHebrew = (text) => /[א-ת]/.test(text) && !/[a-zA-Z]/.test(text);

/** Other Hebrew names an item goes by (for the search), without the main name and without long descriptions. */
function aliasesOf(alts, name, limit = 4) {
  const out = [];
  // Shortest first: abbreviations and nicknames are what people type.
  for (const alt of alts.map(cleanName).sort((a, b) => a.length - b.length)) {
    if (!isHebrew(alt) || alt === name || alt.length > 28 || out.includes(alt)) continue;
    out.push(alt);
    if (out.length === limit) break;
  }
  return out;
}

// ---------- topics ----------
// Every topic returns { items: [{ id, name, links, crits: Set, aliases, hint }], criteria: [definition] }.
// A criterion definition: { id, name, detail, icon | colors, group }. `group` names criteria of one
// kind (continents, decades…): a grid holds at most two from a group, so it never feels one-note.

const decadeCriteria = (prefix, from, to) => {
  const out = [];
  for (let d = from; d <= to; d += 10) {
    out.push({ id: `${prefix}:b${d}`, name: `ילידי שנות ה־${String(d).slice(2)}`, detail: `נולדו בין ${d} ל־${d + 9}`, icon: 'calendar', group: 'born', decade: d });
  }
  return out;
};

const topics = {};

// ===== countries =====

const COUNTRY_RENAME = { Q148: 'סין', Q756617: 'דנמרק', Q29999: 'הולנד', Q219060: 'פלסטין' };
// Wikidata's "sovereign state" items for these two are the kingdoms, which include overseas parts on
// other continents; the European country is the item players mean.
const COUNTRY_SWAP = { Q756617: 'Q35', Q29999: 'Q55' };
const CONTINENTS = [
  { id: 'w:af', q: ['Q15'], name: 'אפריקה' },
  { id: 'w:eu', q: ['Q46'], name: 'אירופה' },
  { id: 'w:as', q: ['Q48'], name: 'אסיה' },
  { id: 'w:na', q: ['Q49'], name: 'צפון אמריקה', detail: 'כולל מרכז אמריקה והאיים הקריביים' },
  { id: 'w:sa', q: ['Q18'], name: 'דרום אמריקה' },
  { id: 'w:oc', q: ['Q55643', 'Q538'], name: 'אוקיאניה', detail: 'אוסטרליה והאיים שבאוקיינוס השקט' },
];
const LANGUAGES = [
  { id: 'w:l-en', q: 'Q1860', name: 'אנגלית' }, { id: 'w:l-fr', q: 'Q150', name: 'צרפתית' }, { id: 'w:l-es', q: 'Q1321', name: 'ספרדית' },
  { id: 'w:l-ar', q: 'Q13955', name: 'ערבית' }, { id: 'w:l-pt', q: 'Q5146', name: 'פורטוגזית' },
];
// Flag colours as Wikidata names them on each flag item (P462); shades a player would call by the
// same name are counted with it (sky blue is blue, gold is yellow). Maroon and dark red are not red.
const FLAG_COLOURS = [
  // red, vermilion, crimson, carmine, "Old Glory Red"
  { id: 'w:f-red', name: 'אדום', chip: '#d22b2b', q: ['Q3142', 'Q737438', 'Q303826', 'Q10296772', 'Q140370933'] },
  // blue, sky blue, light blue, cobalt, royal, dark, navy, ultramarine, cerulean, "Israel blue", "Old Glory Blue"
  { id: 'w:f-blue', name: 'כחול', chip: '#1f4fb4', q: ['Q1088', 'Q373160', 'Q1602687', 'Q425278', 'Q953243', 'Q3641131', 'Q5975887', 'Q219660', 'Q313120', 'Q61927422', 'Q140370922'] },
  // green, light green, "Saudi green"
  { id: 'w:f-green', name: 'ירוק', chip: '#14883e', q: ['Q3133', 'Q4405716', 'Q131392587'] },
  // yellow, gold
  { id: 'w:f-yellow', name: 'צהוב', chip: '#f5c400', q: ['Q943', 'Q208045'] },
  { id: 'w:f-black', name: 'שחור', chip: '#151515', q: ['Q23445'] },
];
const MEMBERSHIPS = [
  { id: 'w:eu-member', q: 'Q458', name: 'האיחוד האירופי', detail: 'חברה באיחוד האירופי', icon: 'stars' },
  { id: 'w:nato', q: 'Q7184', name: 'נאט״ו', detail: 'חברה בברית נאט״ו', icon: 'shield' },
  { id: 'w:commonwealth', q: 'Q7785', name: 'חבר העמים הבריטי', detail: 'חברה בחבר העמים', icon: 'crown' },
  { id: 'w:arab-league', q: 'Q7172', name: 'הליגה הערבית', detail: 'חברה בליגה הערבית', icon: 'stars' },
];
const BORDERS = [
  { id: 'w:b-china', q: 'Q148', name: 'גובלת בסין' }, { id: 'w:b-russia', q: 'Q159', name: 'גובלת ברוסיה' },
  { id: 'w:b-brazil', q: 'Q155', name: 'גובלת בברזיל' }, { id: 'w:b-germany', q: 'Q183', name: 'גובלת בגרמניה' },
];
// The Mediterranean and its named arms: Adriatic, Aegean, Tyrrhenian, Ionian, Ligurian, Levantine,
// Alboran, Balearic, Sardinian and Cretan seas.
const MEDITERRANEAN = ['Q4918', 'Q13924', 'Q34575', 'Q38882', 'Q37495', 'Q42820', 'Q748696', 'Q199408', 'Q200712', 'Q645271', 'Q193149'];
// "Landlocked country" on Wikidata (P31 Q123480) misses a few; these are the ones the English
// Wikipedia list of landlocked countries adds (checked 2026-11-15). The Caspian Sea counts as a lake there.
const LANDLOCKED_EXTRA = ['Q733', 'Q1037', 'Q399', 'Q265', 'Q347', 'Q228', 'Q227'];
// constitutional, absolute and parliamentary monarchy, Commonwealth realm
const MONARCHY_TYPES = ['Q41614', 'Q184558', 'Q3330103', 'Q202686'];

topics.countries = async () => {
  const base = `?x wdt:P31 wd:Q3624078 . FILTER NOT EXISTS { ?x wdt:P576 [] }`;
  const states = (await sparql(`SELECT ?x WHERE { ${base} }`)).map((b) => qid(b.x));
  // Both the kingdom and the country item are read for the swapped ones; see `from` below.
  const ids = [...new Set([...states, ...Object.values(COUNTRY_SWAP)])];
  const names = await labels(ids);
  const [currency, cont, lang, member, inst, gov, drive, pop, area, borders, water, flagColours, heads, olympics, worldCups] = [
    await currentProperty(ids, 'P38'), await property(ids, 'P30'), await property(ids, 'P37'), await currentProperty(ids, 'P463'), await property(ids, 'P31'),
    await property(ids, 'P122'), await property(ids, 'P1622'), await property(ids, 'P1082'), await property(ids, 'P2046'),
    await property(ids, 'P47'), await property(ids, 'P206'),
    await sparql(`SELECT ?x ?v WHERE { ${values('x', ids)} ?x wdt:P163 ?flag . ?flag wdt:P462 ?v }`),
    await sparql(`SELECT ?x WHERE { ${values('x', ids)} ?x wdt:P1906 ?office . ?office wdt:P279* wd:Q116 }`),
    await sparql(`SELECT ?x ?d WHERE { VALUES ?kind { wd:Q159821 wd:Q82414 } ?g wdt:P3450 ?kind ; wdt:P17 ?x ; wdt:P580|wdt:P585 ?d }`),
    await sparql(`SELECT ?x ?d WHERE { ?g wdt:P3450 wd:Q19317 ; wdt:P17 ?x ; wdt:P580|wdt:P585 ?d }`),
  ];
  const flags = new Map(ids.map((id) => [id, new Set()]));
  for (const b of flagColours) flags.get(qid(b.x))?.add(qid(b.v));
  const monarchHead = new Set(heads.map((b) => qid(b.x)));
  // Only games that have already taken place.
  const thisYear = new Date().getUTCFullYear();
  const hosted = (rows) => new Set(rows.filter((b) => yearOf(b.d) <= thisYear).map((b) => qid(b.x)));
  const olympicHosts = hosted(olympics);
  const worldCupHosts = hosted(worldCups);
  const maxNumber = (set) => Math.max(0, ...[...set].map(Number));

  const criteria = [
    ...CONTINENTS.map((c) => ({ id: c.id, name: c.name, detail: c.detail || `מדינה ב${c.name}`, icon: 'globe', group: 'continent' })),
    ...LANGUAGES.map((l) => ({ id: l.id, name: `${l.name} רשמית`, detail: `${l.name} היא שפה רשמית בה`, icon: 'speech', group: 'language' })),
    ...FLAG_COLOURS.map((f) => ({ id: f.id, name: `${f.name} בדגל`, detail: `יש ${f.name} בדגל, גם בסמל שעליו`, colors: [f.chip, f.chip], group: 'flag' })),
    ...MEMBERSHIPS.map((m) => ({ id: m.id, name: m.name, detail: m.detail, icon: m.icon, group: 'member' })),
    ...BORDERS.map((b) => ({ id: b.id, name: b.name, detail: 'יש לה גבול יבשתי משותף איתה', icon: 'border', group: 'border' })),
    { id: 'w:landlocked', name: 'בלי מוצא לים', detail: 'אין לה חוף על ים או אוקיינוס', icon: 'mountain', group: 'sea' },
    { id: 'w:island', name: 'מדינת איים', detail: 'מדינה שכולה על אי או איים', icon: 'island', group: 'sea' },
    { id: 'w:med', name: 'חוף על הים התיכון', detail: 'כולל הים האדריאטי והים האגאי', icon: 'waves', group: 'sea' },
    { id: 'w:monarchy', name: 'מונרכיה', detail: 'בראשה עומד מלך, מלכה או אמיר', icon: 'crown', group: 'gov' },
    { id: 'w:left', name: 'נוסעים בצד שמאל', detail: 'התנועה בכבישים בצד שמאל', icon: 'car', group: 'misc' },
    { id: 'w:euro', name: 'המטבע: אירו', detail: 'מדינה באירופה שמשלמים בה באירו', icon: 'coin', group: 'misc' },
    { id: 'w:olympics', name: 'אירחה אולימפיאדה', detail: 'אירחה משחקים אולימפיים, קיץ או חורף', icon: 'torch', group: 'sport' },
    { id: 'w:worldcup', name: 'אירחה מונדיאל', detail: 'אירחה את גביע העולם בכדורגל', icon: 'ball', group: 'sport' },
    { id: 'w:pop-big', name: 'מעל 50 מיליון תושבים', detail: 'לפי נתון האוכלוסייה בוויקינתונים', icon: 'people', group: 'size' },
    { id: 'w:pop-small', name: 'פחות ממיליון תושבים', detail: 'לפי נתון האוכלוסייה בוויקינתונים', icon: 'people', group: 'size' },
    { id: 'w:area-big', name: 'שטח מעל מיליון קמ״ר', detail: 'לפי נתון השטח בוויקינתונים', icon: 'ruler', group: 'size' },
  ];

  const items = [];
  for (const state of states) {
    const id = COUNTRY_SWAP[state] || state;
    const label = names.get(id);
    if (!label) continue;
    const crits = new Set();
    // Where, how big and next to what: the European country. Everything else (language, flag,
    // memberships, government) is also read from the kingdom, which is where Wikidata often keeps it.
    for (const c of CONTINENTS) if (c.q.some((q) => cont.get(id).has(q))) crits.add(c.id);
    const from = (map) => new Set([...map.get(id), ...map.get(state)]);
    [lang, member, inst, gov, drive, currency].forEach((map) => map.set(id, from(map)));
    flags.set(id, from(flags));
    for (const l of LANGUAGES) if (lang.get(id).has(l.q)) crits.add(l.id);
    for (const f of FLAG_COLOURS) if (f.q.some((q) => flags.get(id).has(q))) crits.add(f.id);
    for (const m of MEMBERSHIPS) if (member.get(id).has(m.q)) crits.add(m.id);
    for (const b of BORDERS) if (borders.get(id).has(b.q) || borders.get(id).has(COUNTRY_SWAP[b.q])) crits.add(b.id);
    if (inst.get(id).has('Q123480') || LANDLOCKED_EXTRA.includes(id)) crits.add('w:landlocked');
    if (inst.get(id).has('Q112099')) crits.add('w:island');
    if (MEDITERRANEAN.some((q) => water.get(id).has(q))) crits.add('w:med');
    if (monarchHead.has(id) || MONARCHY_TYPES.some((q) => inst.get(id).has(q) || gov.get(id).has(q))) crits.add('w:monarchy');
    if (drive.get(id).has('Q11920728')) crits.add('w:left');
    if (currency.get(id).has('Q4916') && crits.has('w:eu')) crits.add('w:euro');
    if (olympicHosts.has(id)) crits.add('w:olympics');
    if (worldCupHosts.has(id)) crits.add('w:worldcup');
    const people = maxNumber(pop.get(id));
    if (people > 50e6) crits.add('w:pop-big');
    if (people > 0 && people < 1e6) crits.add('w:pop-small');
    if (maxNumber(area.get(id)) > 1e6) crits.add('w:area-big');
    const name = COUNTRY_RENAME[id] || cleanName(label.he);
    const aliases = aliasesOf([...(COUNTRY_RENAME[id] ? [cleanName(label.he)] : []), ...label.alts], name);
    items.push({ id: Number(id.slice(1)), name, links: label.links, crits, aliases, hint: '' });
  }
  return { items, criteria, exclusive: ['continent', 'size'] };
};

// ===== Israeli music =====

const ISRAEL = 'Q801';
const FEMALE = ['Q6581072', 'Q1052281']; // female, trans woman
const MUSIC_JOBS = ['Q177220', 'Q488205', 'Q2252262']; // singer, singer-songwriter, rapper
const ACTOR_JOBS = ['Q33999', 'Q10800557', 'Q10798782', 'Q2259451', 'Q2405480']; // actor; film, TV, stage, voice actor
const isEurovision = (v) => `{ ${v} wdt:P3450 wd:Q276 } UNION { ${v} wdt:P179 wd:Q276 } UNION { ${v} wdt:P361 wd:Q276 }`;

/** Birth year (0 when Wikidata has none or disagrees with itself), gender, jobs, birthplace country. */
async function personFacts(ids) {
  const born = await property(ids, 'P569');
  const gender = await property(ids, 'P21');
  const jobs = await property(ids, 'P106');
  const placeCountry = new Map(ids.map((id) => [id, new Set()]));
  for (const b of await batched(ids, 400, (v) => `SELECT ?x ?c WHERE { ${v} ?x wdt:P19 ?place . ?place wdt:P17 ?c }`)) placeCountry.get(qid(b.x)).add(qid(b.c));
  const year = (id) => {
    const years = new Set([...born.get(id)].map((d) => Number(d.slice(0, 4))));
    return years.size === 1 ? [...years][0] : 0;
  };
  return { year, female: (id) => FEMALE.some((g) => gender.get(id).has(g)), jobs, placeCountry };
}

topics.music = async () => {
  const found = await sparql(`SELECT DISTINCT ?x WHERE { ${values('job', MUSIC_JOBS)} ?x wdt:P27 wd:${ISRAEL} ; wdt:P106 ?job ; wdt:P31 wd:Q5 . }`);
  const ids = found.map((b) => qid(b.x));
  const names = await labels(ids);
  let pool = ids.filter((id) => names.get(id) && names.get(id).links >= MUSIC_MIN_LINKS);
  // Stars of Russian-language pop who also hold Israeli citizenship are not "Israeli music": anyone
  // born abroad with a Russian, Ukrainian or Belarusian citizenship and no Hebrew among their languages is left out.
  const citizen = await property(pool, 'P27');
  const languages = await property(pool, 'P1412');
  let facts = await personFacts(pool);
  pool = pool.filter((id) => {
    const born = facts.placeCountry.get(id);
    const abroad = born.size && !born.has(ISRAEL);
    return !(abroad && ['Q159', 'Q212', 'Q184'].some((c) => citizen.get(id).has(c)) && !languages.get(id).has('Q9288'));
  });
  facts = await personFacts(pool);
  const [genre, instrument, awards, birthplace, memberOf] = [
    await property(pool, 'P136'), await property(pool, 'P1303'), await property(pool, 'P166'), await property(pool, 'P19'), await property(pool, 'P463'),
  ];
  const israelPrize = new Set((await batched(pool, 400, (v) => `SELECT ?x WHERE { ${v} ?x wdt:P166 ?a . ?a wdt:P279* wd:Q616568 }`)).map((b) => qid(b.x)));
  const eurovision = new Set([
    ...(await batched(pool, 400, (v) => `SELECT ?x WHERE { ${v} ?x wdt:P1344 ?e . ${isEurovision('?e')} }`)),
    // Performers of a song that took part in a Eurovision contest.
    ...(await batched(pool, 400, (v) => `SELECT ?x WHERE { ${v} ?song wdt:P175 ?x ; wdt:P1344 ?e . ${isEurovision('?e')} }`)),
  ].map((b) => qid(b.x)));
  const bands = new Set((await batched(pool, 400, (v) => `SELECT ?x WHERE { ${v} ?x wdt:P463 ?g . ?g wdt:P31/wdt:P279* wd:Q215380 }`)).map((b) => qid(b.x)));
  const army = new Set((await batched(pool, 400, (v) => `SELECT ?x WHERE { ${v} ?x wdt:P463 ?g . ?g wdt:P31 wd:Q25488614 }`)).map((b) => qid(b.x)));

  const criteria = [
    ...decadeCriteria('m', 1940, 2000),
    { id: 'm:eurovision', name: 'אירוויזיון', detail: 'השתתפו בתחרות האירוויזיון', icon: 'mic', group: 'stage' },
    { id: 'm:army', name: 'להקה צבאית', detail: 'היו חברים בלהקה צבאית', icon: 'star', group: 'stage' },
    { id: 'm:band', name: 'חברי להקה', detail: 'היו חברים בלהקה או בהרכב מוזיקלי', icon: 'people', group: 'stage' },
    { id: 'm:actor', name: 'גם משחק', detail: 'רשומים גם כשחקן או כשחקנית', icon: 'mask', group: 'job' },
    { id: 'm:writer', name: 'כותבים ומלחינים', detail: 'רשומים גם כמלחין, כפזמונאי או כתמלילן', icon: 'pen', group: 'job' },
    { id: 'm:host', name: 'הגשה בטלוויזיה', detail: 'רשומים גם כמנחה טלוויזיה', icon: 'tv', group: 'job' },
    { id: 'm:israel-prize', name: 'פרס ישראל', detail: 'זכו בפרס ישראל', icon: 'medal', group: 'prize' },
    { id: 'm:acum', name: 'פרס אקו״ם', detail: 'זכו בפרס של אקו״ם', icon: 'medal', group: 'prize' },
    { id: 'm:pop', name: 'פופ', detail: 'הסוגה בוויקינתונים: פופ', icon: 'note', group: 'genre' },
    { id: 'm:rock', name: 'רוק', detail: 'הסוגה בוויקינתונים: רוק', icon: 'note', group: 'genre' },
    { id: 'm:mizrahi', name: 'מוזיקה מזרחית', detail: 'הסוגה בוויקינתונים: מוזיקה מזרחית', icon: 'note', group: 'genre' },
    { id: 'm:hiphop', name: 'היפ הופ', detail: 'הסוגה בוויקינתונים: היפ הופ או ראפ', icon: 'note', group: 'genre' },
    { id: 'm:piano', name: 'פסנתר', detail: 'מנגנים בפסנתר', icon: 'keys', group: 'instrument' },
    { id: 'm:guitar', name: 'גיטרה', detail: 'מנגנים בגיטרה', icon: 'guitar', group: 'instrument' },
    { id: 'm:tlv', name: 'נולדו בתל אביב', detail: 'מקום הלידה: תל אביב-יפו', icon: 'pin', group: 'place' },
    { id: 'm:jlm', name: 'נולדו בירושלים', detail: 'מקום הלידה: ירושלים', icon: 'pin', group: 'place' },
    { id: 'm:haifa', name: 'נולדו בחיפה', detail: 'מקום הלידה: חיפה', icon: 'pin', group: 'place' },
    { id: 'm:abroad', name: 'נולדו בחו״ל', detail: 'נולדו מחוץ לישראל ולארץ ישראל המנדטורית', icon: 'plane', group: 'place' },
    { id: 'm:native', name: 'נולדו בארץ', detail: 'נולדו בישראל או בארץ ישראל המנדטורית', icon: 'map', group: 'place' },
  ];
  const ROCK = ['Q11399', 'Q11366', 'Q484641', 'Q1641839', 'Q217467', 'Q236913']; // rock and its usual Hebrew-wiki subgenres
  const items = [];
  for (const id of pool) {
    const crits = new Set();
    const year = facts.year(id);
    for (const c of criteria) if (c.decade && year >= c.decade && year <= c.decade + 9) crits.add(c.id);
    if (eurovision.has(id)) crits.add('m:eurovision');
    if (army.has(id)) crits.add('m:army');
    if (bands.has(id)) crits.add('m:band');
    const jobs = facts.jobs.get(id);
    if (ACTOR_JOBS.some((j) => jobs.has(j))) crits.add('m:actor');
    if (['Q36834', 'Q753110', 'Q822146'].some((j) => jobs.has(j))) crits.add('m:writer');
    if (jobs.has('Q947873')) crits.add('m:host');
    if (israelPrize.has(id)) crits.add('m:israel-prize');
    if (awards.get(id).has('Q12410731')) crits.add('m:acum');
    const g = genre.get(id);
    if (g.has('Q37073')) crits.add('m:pop');
    if (ROCK.some((q) => g.has(q))) crits.add('m:rock');
    if (g.has('Q2738544')) crits.add('m:mizrahi');
    if (g.has('Q11401') || g.has('Q6010')) crits.add('m:hiphop');
    if (instrument.get(id).has('Q5994')) crits.add('m:piano');
    if (['Q6607', 'Q31561', 'Q78987', 'Q46185'].some((q) => instrument.get(id).has(q))) crits.add('m:guitar');
    const place = birthplace.get(id);
    if (place.has('Q33935')) crits.add('m:tlv');
    if (place.has('Q1218')) crits.add('m:jlm');
    if (place.has('Q41621')) crits.add('m:haifa');
    const countries = facts.placeCountry.get(id);
    const home = [ISRAEL, 'Q193714', 'Q12560', 'Q23792'];
    if (countries.size && !home.some((c) => countries.has(c))) crits.add('m:abroad');
    if (countries.has(ISRAEL) || countries.has('Q193714')) crits.add('m:native');
    const label = names.get(id);
    const name = cleanName(label.he);
    items.push({ id: Number(id.slice(1)), name, links: label.links, crits, aliases: aliasesOf(label.alts, name, 2), year, female: facts.female(id) });
  }
  return { items, criteria, exclusive: ['place'] };
};
const MUSIC_MIN_LINKS = 3;

// ===== film and television =====

// Film series: every film in the series (or in a sub-series of it) counts. TV series: the cast of
// the series item and of its episodes and seasons. Cast lists are "cast member" (P161) statements.
const SCREEN_WORKS = [
  { id: 's:mcu', q: 'Q642878', name: 'היקום של מארוול', detail: 'שיחקו בסרט של היקום הקולנועי של מארוול', icon: 'film' },
  { id: 's:hp', q: 'Q216930', name: 'הארי פוטר', detail: 'שיחקו בסרט מסדרת סרטי הארי פוטר', icon: 'film' },
  { id: 's:sw', q: 'Q22092344', name: 'מלחמת הכוכבים', detail: 'שיחקו בסרט מסדרת מלחמת הכוכבים', icon: 'film' },
  { id: 's:bond', q: 'Q2484680', name: 'ג׳יימס בונד', detail: 'שיחקו בסרט ג׳יימס בונד', icon: 'film' },
  { id: 's:dc', q: 'Q18281265', name: 'סרטי DC', detail: 'שיחקו בסרט של היקום המורחב של DC', icon: 'film' },
  { id: 's:xmen', q: 'Q2006869', name: 'אקס-מן', detail: 'שיחקו בסרט מסדרת אקס-מן', icon: 'film' },
  { id: 's:pirates', q: 'Q194318', name: 'שודדי הקאריביים', detail: 'שיחקו בסרט מסדרת שודדי הקאריביים', icon: 'film' },
  { id: 's:lotr', q: 'Q190214', name: 'שר הטבעות', detail: 'שיחקו בסרט מסדרת שר הטבעות', icon: 'film' },
  { id: 's:twilight', q: 'Q652599', name: 'דמדומים', detail: 'שיחקו בסרט מסדרת דמדומים', icon: 'film' },
  { id: 's:hunger', q: 'Q11885031', name: 'משחקי הרעב', detail: 'שיחקו בסרט מסדרת משחקי הרעב', icon: 'film' },
  { id: 's:ff', q: 'Q1576873', name: 'מהיר ועצבני', detail: 'שיחקו בסרט מסדרת מהיר ועצבני', icon: 'film' },
  { id: 's:mi', q: 'Q1356213', name: 'משימה בלתי אפשרית', detail: 'שיחקו בסרט מסדרת משימה בלתי אפשרית', icon: 'film' },
  { id: 's:spiderman', q: 'Q2307877', name: 'ספיידרמן', detail: 'שיחקו בסרט ספיידרמן', icon: 'film' },
  { id: 's:friends', q: 'Q79784', name: 'חברים', detail: 'הופיעו בסדרה חברים', icon: 'tv' },
  { id: 's:got', q: 'Q23572', name: 'משחקי הכס', detail: 'הופיעו בסדרה משחקי הכס', icon: 'tv' },
  { id: 's:greys', q: 'Q438406', name: 'האנטומיה של גריי', detail: 'הופיעו בסדרה האנטומיה של גריי', icon: 'tv' },
  { id: 's:himym', q: 'Q147235', name: 'איך פגשתי את אמא', detail: 'הופיעו בסדרה איך פגשתי את אמא', icon: 'tv' },
  { id: 's:dh', q: 'Q131758', name: 'עקרות בית נואשות', detail: 'הופיעו בסדרה עקרות בית נואשות', icon: 'tv' },
  { id: 's:bbt', q: 'Q8539', name: 'המפץ הגדול', detail: 'הופיעו בסדרה המפץ הגדול', icon: 'tv' },
  { id: 's:satc', q: 'Q35791', name: 'סקס והעיר הגדולה', detail: 'הופיעו בסדרה סקס והעיר הגדולה', icon: 'tv' },
  { id: 's:lost', q: 'Q23567', name: 'אבודים', detail: 'הופיעו בסדרה אבודים', icon: 'tv' },
  { id: 's:modern', q: 'Q16756', name: 'משפחה מודרנית', detail: 'הופיעו בסדרה משפחה מודרנית', icon: 'tv' },
  { id: 's:seinfeld', q: 'Q23733', name: 'סיינפלד', detail: 'הופיעו בסדרה סיינפלד', icon: 'tv' },
  { id: 's:crown', q: 'Q20707362', name: 'הכתר', detail: 'הופיעו בסדרה הכתר', icon: 'tv' },
  { id: 's:stranger', q: 'Q19798734', name: 'דברים מוזרים', detail: 'הופיעו בסדרה דברים מוזרים', icon: 'tv' },
  { id: 's:bb', q: 'Q1079', name: 'שובר שורות', detail: 'הופיעו בסדרה שובר שורות', icon: 'tv' },
  { id: 's:sherlock', q: 'Q192837', name: 'שרלוק', detail: 'הופיעו בסדרה שרלוק', icon: 'tv' },
  { id: 's:downton', q: 'Q83071', name: 'אחוזת דאונטון', detail: 'הופיעו בסדרה אחוזת דאונטון', icon: 'tv' },
  { id: 's:house', q: 'Q23558', name: 'האוס', detail: 'הופיעו בסדרה האוס', icon: 'tv' },
  { id: 's:doctorwho', q: 'Q34316', name: 'דוקטור הו', detail: 'הופיעו בסדרה דוקטור הו', icon: 'tv' },
  { id: 's:blackmirror', q: 'Q558112', name: 'מראה שחורה', detail: 'הופיעו בסדרה מראה שחורה', icon: 'tv' },
  { id: 's:fauda', q: 'Q19319517', name: 'פאודה', detail: 'הופיעו בסדרה פאודה', icon: 'tv' },
  { id: 's:shtisel', q: 'Q6878481', name: 'שטיסל', detail: 'הופיעו בסדרה שטיסל', icon: 'tv' },
];
const OSCAR_ACTING = ['Q103916', 'Q103618', 'Q106291', 'Q106301'];
const NATIONALITIES = [
  { id: 's:us', q: 'Q30', name: 'מארצות הברית' }, { id: 's:uk', q: 'Q145', name: 'מבריטניה' }, { id: 's:ca', q: 'Q16', name: 'מקנדה' },
  { id: 's:au', q: 'Q408', name: 'מאוסטרליה' }, { id: 's:ie', q: 'Q27', name: 'מאירלנד' }, { id: 's:il', q: 'Q801', name: 'מישראל' },
];
// Well-known enough to be guessed: this many Wikipedia editions, or fewer for Israelis (Hebrew Wikipedia covers them well).
const SCREEN_MIN_LINKS = 40;
const SCREEN_MIN_LINKS_ISRAELI = 3;

topics.screen = async () => {
  const members = new Map(); // criterion id -> Set of person ids
  for (const work of SCREEN_WORKS) {
    const rows = await sparql(`SELECT DISTINCT ?x WHERE { { wd:${work.q} wdt:P161 ?x } UNION { ?w (wdt:P179|wdt:P361)+ wd:${work.q} . ?w wdt:P161 ?x } ?x wdt:P31 wd:Q5 }`);
    members.set(work.id, new Set(rows.map((b) => qid(b.x))));
    process.stdout.write('.');
  }
  const winners = await sparql(`SELECT DISTINCT ?x WHERE { ${values('award', OSCAR_ACTING)} ?x wdt:P166 ?award }`);
  const emmy = await sparql(`SELECT DISTINCT ?x WHERE { ?x wdt:P106 ?job ; wdt:P166 ?award . ?award wdt:P31*/wdt:P279* wd:Q1044427 . ${values('job', ACTOR_JOBS)} }`);
  members.set('s:oscar', new Set(winners.map((b) => qid(b.x))));
  members.set('s:emmy', new Set(emmy.map((b) => qid(b.x))));

  const all = [...new Set([...members.values()].flatMap((set) => [...set]))];
  const names = await labels(all);
  const named = all.filter((id) => names.get(id));
  const citizens = await property(named, 'P27');
  const occupations = await property(named, 'P106');
  // Actors and actresses only: cast lists also hold people who appear as themselves (a cameo, archive footage).
  const pool = named.filter((id) => ACTOR_JOBS.some((j) => occupations.get(id).has(j))
    && names.get(id).links >= (citizens.get(id).has(ISRAEL) ? SCREEN_MIN_LINKS_ISRAELI : SCREEN_MIN_LINKS));
  const facts = await personFacts(pool);

  const criteria = [
    ...SCREEN_WORKS.map((w) => ({ id: w.id, name: w.name, detail: w.detail, icon: w.icon, group: w.icon, anchor: true })),
    { id: 's:oscar', name: 'זכו באוסקר', detail: 'זכו בפרס אוסקר על משחק', icon: 'trophy', group: 'award', anchor: true },
    { id: 's:emmy', name: 'פרס אמי', detail: 'זכו בפרס אמי בפריים טיים', icon: 'trophy', group: 'award', anchor: true },
    ...decadeCriteria('s', 1930, 1990),
    ...NATIONALITIES.map((n) => ({ id: n.id, name: n.name, detail: `בעלי אזרחות של ${n.name.slice(1)}`, icon: 'flag', group: 'nation' })),
    { id: 's:singer', name: 'גם בשירה', detail: 'רשומים גם כזמר או כזמרת', icon: 'mic', group: 'job' },
    { id: 's:director', name: 'גם בבימוי', detail: 'רשומים גם כבמאי או כבמאית', icon: 'clapper', group: 'job' },
  ];
  const items = [];
  for (const id of pool) {
    const crits = new Set();
    for (const [criterion, set] of members) if (set.has(id)) crits.add(criterion);
    const year = facts.year(id);
    for (const c of criteria) if (c.decade && year >= c.decade && year <= c.decade + 9) crits.add(c.id);
    for (const n of NATIONALITIES) if (citizens.get(id).has(n.q)) crits.add(n.id);
    const jobs = facts.jobs.get(id);
    if (MUSIC_JOBS.some((j) => jobs.has(j))) crits.add('s:singer');
    if (['Q2526255', 'Q3455803', 'Q2059704'].some((j) => jobs.has(j))) crits.add('s:director');
    const label = names.get(id);
    const name = cleanName(label.he);
    items.push({ id: Number(id.slice(1)), name, links: label.links, crits, aliases: aliasesOf(label.alts, name, 2), year, female: facts.female(id) });
  }
  return { items, criteria, exclusive: ['nation'] };
};

// ===== Israeli football =====

// The clubs used as criteria: every club that has played in the Israeli top division and has at
// least 70 Hebrew-named players on Wikidata. `merge` lists other Wikidata items that are the same
// club (the multi-sport parent, a duplicate item) and are folded into it.
// Colours are the club's home-kit colours as given in the infobox of its English Wikipedia article
// (checked 2026-11-13), used only to draw a two-colour chip; no crest or logo is reproduced.
const CLUBS = [
  { id: 'mta', q: 'Q223728', name: 'מכבי תל אביב', colors: ['#ffdf00', '#1f3f9e'], merge: ['Q1389899'] },
  { id: 'mha', q: 'Q2129100', name: 'מכבי חיפה', colors: ['#0a7a2a', '#ffffff'], merge: ['Q206766'] },
  { id: 'hta', q: 'Q206585', name: 'הפועל תל אביב', colors: ['#d81e1e', '#ffffff'] },
  { id: 'bei', q: 'Q223727', name: 'בית״ר ירושלים', colors: ['#ffe100', '#151515'] },
  { id: 'mne', q: 'Q426513', name: 'מכבי נתניה', colors: ['#151515', '#ffe100'] },
  { id: 'hbs', q: 'Q986529', name: 'הפועל באר שבע', colors: ['#d81e1e', '#ffffff'] },
  { id: 'hha', q: 'Q455991', name: 'הפועל חיפה', colors: ['#d81e1e', '#151515'] },
  { id: 'hpt', q: 'Q1130537', name: 'הפועל פתח תקווה', colors: ['#1c4fc4', '#ffffff'] },
  { id: 'mpt', q: 'Q49711', name: 'מכבי פתח תקווה', colors: ['#ffffff', '#1c4fc4'] },
  { id: 'byt', q: 'Q737714', name: 'בני יהודה', colors: ['#ff6c00', '#151515'] },
  { id: 'hks', q: 'Q761583', name: 'הפועל כפר סבא', colors: ['#0b8a2e', '#ffffff'] },
  { id: 'asd', q: 'Q1138191', name: 'מ.ס. אשדוד', colors: ['#d81e1e', '#ffd400'] },
  { id: 'kss', q: 'Q907321', name: 'עירוני קריית שמונה', colors: ['#ffffff', '#1c4fc4'] },
  { id: 'sak', q: 'Q1130570', name: 'בני סכנין', colors: ['#cc0000', '#ffffff'] },
  { id: 'hrg', q: 'Q1344306', name: 'הפועל רמת גן', colors: ['#d81e1e', '#151515'] },
  { id: 'mhe', q: 'Q1632362', name: 'מכבי הרצליה', colors: ['#fde200', '#1f3f9e'] },
  { id: 'hac', q: 'Q1513003', name: 'הפועל עכו', colors: ['#12127a', '#ffffff'] },
  { id: 'hrl', q: 'Q1584246', name: 'הפועל ראשון לציון', colors: ['#f1771d', '#ffffff'] },
  { id: 'has', q: 'Q263126', name: 'הפועל אשקלון', colors: ['#1c4fc4', '#ffffff'] },
  { id: 'rhs', q: 'Q1118683', name: 'הפועל רמת השרון', colors: ['#343c8c', '#ffffff'] },
  { id: 'hak', q: 'Q388401', name: 'הכח רמת גן', colors: ['#54008b', '#ffffff'] },
  { id: 'hra', q: 'Q2347701', name: 'הפועל רעננה', colors: ['#d81e1e', '#151515'] },
  { id: 'man', q: 'Q1580781', name: 'מכבי אחי נצרת', colors: ['#32ab66', '#ffffff'] },
  { id: 'mja', q: 'Q773362', name: 'מכבי יפו', colors: ['#ffffff', '#1c4fc4'] },
  { id: 'nof', q: 'Q605383', name: 'הפועל נוף הגליל', colors: ['#0a0a55', '#ffffff'] },
  // Hapoel Katamon (Q1577020) is deliberately not merged: it was a separate, fan-owned club until 2020.
  { id: 'hje', q: 'Q2259417', name: 'הפועל ירושלים', colors: ['#dd000b', '#151515'], merge: ['Q1134595'] },
];
const FOOTBALLER = 'Q937857';
const FOOTBALL_CLUB = 'Q476028';
const NATIONAL_TEAM_CLASS = 'Q6979593';
// Only the senior side counts as "the national team"; under-21, under-19 and the other age groups do not.
const ISRAEL_SENIOR_TEAM = 'Q191406';

topics.football = async () => {
  const found = await sparql(`SELECT DISTINCT ?p WHERE { ?club wdt:P31/wdt:P279* wd:${FOOTBALL_CLUB} ; wdt:P17 wd:${ISRAEL} . ?p wdt:P54 ?club ; wdt:P106 wd:${FOOTBALLER} . }`);
  const ids = found.map((b) => qid(b.p));
  const names = await labels(ids);
  const born = await property(ids, 'P569');
  const nats = await property(ids, 'P27');
  // p:/ps: rather than wdt: so that a preferred-rank statement does not hide a player's other clubs.
  const memberships = new Map(ids.map((id) => [id, new Set()]));
  for (const b of await batched(ids, 400, (v) => `SELECT DISTINCT ?x ?t WHERE { ${v} ?x p:P54 ?s . ?s ps:P54 ?t . FILTER NOT EXISTS { ?s wikibase:rank wikibase:DeprecatedRank } }`)) memberships.get(qid(b.x)).add(qid(b.t));
  const teamIds = [...new Set([...memberships.values()].flatMap((set) => [...set]))];
  const teams = new Map();
  for (const b of await batched(teamIds, 300, (v) => `SELECT ?x ?he ?en ?country ?national WHERE { ${v} OPTIONAL { ?x rdfs:label ?he FILTER(LANG(?he)="he") } OPTIONAL { ?x rdfs:label ?en FILTER(LANG(?en)="en") } OPTIONAL { ?x wdt:P17 ?country } BIND(EXISTS { ?x wdt:P31/wdt:P279* wd:${NATIONAL_TEAM_CLASS} } AS ?national) }`)) {
    const team = teams.get(qid(b.x)) || { countries: new Set(), label: '' };
    if (b.country) team.countries.add(qid(b.country));
    team.label = `${b.he?.value || ''} ${b.en?.value || ''}`;
    // Some age-group and Olympic sides are not typed as national teams on Wikidata; the name gives them away.
    team.national = b.national.value === 'true' || /נבחרת|national|olympic/i.test(team.label);
    teams.set(qid(b.x), team);
  }
  const clubOf = new Map();
  for (const club of CLUBS) for (const q of [club.q, ...(club.merge || [])]) clubOf.set(q, club.id);

  const criteria = [
    ...CLUBS.map((c) => ({ id: 'f:' + c.id, name: c.name, detail: `שיחק ב${c.name}`, colors: c.colors, group: 'club', anchor: true })),
    { id: 'f:natl', name: 'נבחרת ישראל', detail: 'שיחק בנבחרת הבוגרת של ישראל', icon: 'flag', group: 'natl' },
    { id: 'f:foreign', name: 'שחקן זר', detail: 'שחקן בלי אזרחות ישראלית', icon: 'globe', group: 'abroad' },
    { id: 'f:abroad', name: 'שיחק בחו״ל', detail: 'שיחק גם במועדון מחוץ לישראל', icon: 'plane', group: 'abroad' },
    ...decadeCriteria('f', 1960, 1990).map((c) => ({ ...c, name: `יליד שנות ה־${String(c.decade).slice(2)}`, detail: `נולד בין ${c.decade} ל־${c.decade + 9}` })),
  ];
  const items = [];
  for (const id of ids) {
    const label = names.get(id);
    if (!label) continue;
    const name = cleanName(label.he);
    if (!isHebrew(name)) continue;
    const clubs = [...new Set([...memberships.get(id)].map((t) => clubOf.get(t)).filter(Boolean))];
    if (!clubs.length) continue;
    const crits = new Set(clubs.map((c) => 'f:' + c));
    if (memberships.get(id).has(ISRAEL_SENIOR_TEAM)) crits.add('f:natl');
    if (nats.get(id).size > 0 && !nats.get(id).has(ISRAEL)) crits.add('f:foreign');
    const abroad = [...memberships.get(id)].some((t) => {
      const team = teams.get(t);
      return team && !team.national && team.countries.size > 0 && !team.countries.has(ISRAEL);
    });
    if (abroad) crits.add('f:abroad');
    const years = new Set([...born.get(id)].map((d) => Number(d.slice(0, 4))));
    const year = years.size === 1 ? [...years][0] : 0;
    for (const c of criteria) if (c.decade && year >= c.decade && year <= c.decade + 9) crits.add(c.id);
    items.push({ id: Number(id.slice(1)), name, links: label.links, crits, aliases: [], year, female: false });
  }
  return { items, criteria };
};

// ===== localities in Israel =====

// Districts and sub-districts (Wikidata's "located in the administrative territorial entity", P131,
// followed upwards). Judea and Samaria is not used as a criterion.
const REGIONS = [
  { id: 'p:north', q: 'Q189942', name: 'מחוז הצפון' }, { id: 'p:haifa', q: 'Q185845', name: 'מחוז חיפה' },
  { id: 'p:center', q: 'Q188785', name: 'מחוז המרכז' }, { id: 'p:tlv', q: 'Q192811', name: 'מחוז תל אביב' },
  { id: 'p:jlm', q: 'Q192232', name: 'מחוז ירושלים' }, { id: 'p:south', q: 'Q188781', name: 'מחוז הדרום' },
  { id: 'p:golan', q: 'Q5423040', name: 'רמת הגולן', sub: true }, { id: 'p:kinneret', q: 'Q65073769', name: 'נפת כנרת', sub: true },
  { id: 'p:jezreel', q: 'Q128843', name: 'נפת יזרעאל', sub: true }, { id: 'p:acre', q: 'Q5423103', name: 'נפת עכו', sub: true },
  { id: 'p:safed', q: 'Q5423089', name: 'נפת צפת', sub: true }, { id: 'p:hadera', q: 'Q5423414', name: 'נפת חדרה', sub: true },
  { id: 'p:beersheva', q: 'Q5423629', name: 'נפת באר שבע', sub: true }, { id: 'p:ashkelon', q: 'Q5423623', name: 'נפת אשקלון', sub: true },
];
const PLACE_TYPES = [
  { id: 'p:kibbutz', q: ['Q161387'], name: 'קיבוץ' },
  { id: 'p:moshav', q: ['Q917146', 'Q7886462'], name: 'מושב', detail: 'מושב עובדים או מושב שיתופי' },
  { id: 'p:city', q: ['Q515', 'Q1549591', 'Q3505887', 'Q15284'], name: 'עיר', detail: 'עיר או עירייה' },
  { id: 'p:council', q: ['Q1288520'], name: 'מועצה מקומית', detail: 'יישוב שהוא מועצה מקומית' },
  { id: 'p:community', q: ['Q1501046'], name: 'יישוב קהילתי' },
];
// Localities whose names (or types) show they are not places people live in; the same rule as נקודת ציון.
const NOT_A_PLACE_NAME = /אזור ה?תעשייה|ארכיון|מכללה|מחנה |בסיס |מועצה אזורית|בית ה?ספר|בית חולים|המרכז |מרכז רפואי|נמל התעופה|ישיבת |כפר הנוער/;
const NOT_A_PLACE_TYPE = ['Q1022469', 'Q2907285', 'Q695850', 'Q163740', 'Q329683', 'Q269770', 'Q2385804', 'Q123705', 'Q22674925', 'Q12232785'];

topics.places = async () => {
  const found = await sparql(`SELECT DISTINCT ?x WHERE { ?x wdt:P3466 [] ; wdt:P625 [] . FILTER NOT EXISTS { ?x wdt:P576 [] } }`);
  const ids = found.map((b) => qid(b.x));
  const names = await labels(ids);
  const [types, founded, pop, namedAfter] = [await property(ids, 'P31'), await property(ids, 'P571'), await property(ids, 'P1082'), await property(ids, 'P138')];
  const regions = new Map(ids.map((id) => [id, new Set()]));
  for (const b of await batched(ids, 300, (v) => `SELECT ?x ?r WHERE { ${v} ?x wdt:P131+ ?r . ${values('r', REGIONS.map((r) => r.q))} }`)) regions.get(qid(b.x)).add(qid(b.r));
  const people = new Set((await batched([...new Set([...namedAfter.values()].flatMap((set) => [...set]))], 400, (v) => `SELECT ?x WHERE { ${v} ?x wdt:P31 wd:Q5 }`)).map((b) => qid(b.x)));
    // Stations that have opened (an opening date in the past) and have not closed.
  const stations = new Set((await sparql(`SELECT DISTINCT ?x WHERE { ?st wdt:P31/wdt:P279* wd:Q55488 ; wdt:P17 wd:${ISRAEL} ; wdt:P131 ?x ; wdt:P1619 ?open .
    ?x wdt:P3466 [] . FILTER(?open < NOW()) FILTER NOT EXISTS { ?st wdt:P576 [] } FILTER NOT EXISTS { ?st wdt:P3999 [] } }`)).map((b) => qid(b.x)));

  const criteria = [
    ...REGIONS.map((r) => ({ id: r.id, name: r.name, detail: r.sub ? `יישוב ב${r.name.startsWith('נפת') ? r.name : 'נפת ' + r.name}` : `יישוב ב${r.name}`, icon: 'map', group: 'region' })),
    ...PLACE_TYPES.map((t) => ({ id: t.id, name: t.name, detail: t.detail || `היישוב הוא ${t.name}`, icon: 'house', group: 'type' })),
    { id: 'p:old', name: 'נוסד לפני 1948', detail: 'שנת הייסוד בוויקינתונים לפני קום המדינה', icon: 'calendar', group: 'founded' },
    { id: 'p:1950s', name: 'נוסד בשנות ה־50', detail: 'שנת הייסוד בין 1948 ל־1959', icon: 'calendar', group: 'founded' },
    { id: 'p:new', name: 'נוסד אחרי 1967', detail: 'שנת הייסוד בוויקינתונים 1968 ואילך', icon: 'calendar', group: 'founded' },
    { id: 'p:big', name: 'מעל 50 אלף תושבים', detail: 'לפי נתון האוכלוסייה בוויקינתונים', icon: 'people', group: 'size' },
    { id: 'p:small', name: 'פחות מ־500 תושבים', detail: 'לפי נתון האוכלוסייה בוויקינתונים', icon: 'people', group: 'size' },
    { id: 'p:named', name: 'נקרא על שם אדם', detail: 'השם הוא על שם אדם, לפי ויקינתונים', icon: 'person', group: 'misc' },
    { id: 'p:train', name: 'יש תחנת רכבת', detail: 'יש בו תחנת רכבת, לפי ויקינתונים', icon: 'train', group: 'misc' },
  ];
  const items = [];
  const seen = new Map();
  for (const id of ids) {
    const label = names.get(id);
    if (!label) continue;
    const name = cleanName(label.he);
    if (!isHebrew(name) || NOT_A_PLACE_NAME.test(name) || NOT_A_PLACE_TYPE.some((t) => types.get(id).has(t))) continue;
    const crits = new Set();
    for (const r of REGIONS) if (regions.get(id).has(r.q)) crits.add(r.id);
    for (const t of PLACE_TYPES) if (t.q.some((q) => types.get(id).has(q))) crits.add(t.id);
    const years = new Set([...founded.get(id)].map((d) => Number(d.slice(0, d.indexOf('-', 1)))));
    const year = years.size === 1 ? [...years][0] : 0;
    if (year && year < 1948) crits.add('p:old');
    if (year >= 1948 && year <= 1959) crits.add('p:1950s');
    if (year >= 1968) crits.add('p:new');
    const residents = Math.max(0, ...[...pop.get(id)].map(Number));
    if (residents > 50000) crits.add('p:big');
    if (residents > 0 && residents < 500) crits.add('p:small');
    if ([...namedAfter.get(id)].some((q) => people.has(q))) crits.add('p:named');
    if (stations.has(id)) crits.add('p:train');
    // Two localities with one name: keep the bigger (as נקודת ציון does).
    const item = { id: Number(id.slice(1)), name, links: label.links + residents / 1e6, crits, aliases: aliasesOf(label.alts, name), residents };
    const twin = seen.get(name);
    if (twin && twin.residents >= residents) continue;
    if (twin) items.splice(items.indexOf(twin), 1);
    seen.set(name, item);
    items.push(item);
  }
  return { items, criteria, exclusive: ['region', 'type', 'founded', 'size'], groupCap: 3 };
};

export { topics };

// ---------- data files ----------

const TOPIC_IDS = ['countries', 'screen', 'music', 'places', 'football'];
const SOURCE_NOTE = {
  countries: 'Sovereign states (P31 Q3624078) and their statements: continent, official language, flag colours, memberships, borders, coast, government, driving side, currency, hosted Olympic Games and World Cups, population, area.',
  screen: 'Cast members (P161) of the listed film series and TV series, acting Academy Awards (won P166 / nominated P1411), Primetime Emmy Awards, birth date, citizenship, occupation.',
  music: 'Israeli citizens whose occupation is singer, singer-songwriter or rapper; birth date and place, occupation, genre, instrument, awards, Eurovision participation, band membership.',
  places: 'Localities with an Israeli CBS code (P3466): district, type, inception, population, named after, railway stations.',
  football: 'Footballers with a "member of sports team" (P54) statement for an Israeli club; clubs, Israel senior team, citizenship, clubs abroad, birth date.',
};

/** Namesakes are told apart by birth year in the search list; where that is impossible, all of them go. */
function settleNamesakes(items) {
  const byName = new Map();
  for (const item of items) byName.set(item.name, [...(byName.get(item.name) || []), item]);
  const out = [];
  let dropped = 0;
  for (const group of byName.values()) {
    if (group.length === 1) { out.push({ ...group[0], hint: '' }); continue; }
    const years = group.map((i) => i.year || 0);
    if (years.includes(0) || new Set(years).size !== years.length) { dropped += group.length; continue; }
    out.push(...group.map((i) => ({ ...i, hint: String(i.year) })));
  }
  return { items: out, dropped };
}

function writeData(topic, { items, criteria, exclusive = [], groupCap, womenShare }, retrieved) {
  const index = new Map(criteria.map((c, i) => [c.id, i]));
  const rows = items.map((item) => {
    const row = [item.id, item.name, [...item.crits].map((c) => index.get(c)).sort((a, b) => a - b)];
    if (item.aliases.length || item.hint) row.push(item.aliases);
    if (item.hint) row.push(item.hint);
    return JSON.stringify(row);
  });
  const defs = criteria.map(({ id, name, detail, icon, colors, group, anchor }) => JSON.stringify({ id, name, detail, ...(colors ? { colors } : { icon }), group, ...(anchor ? { anchor } : {}) }));
  writeFileSync(here(`data/${topic}.js`), `// Generated by build-data.mjs. Do not edit by hand.
// Source: Wikidata (https://www.wikidata.org), CC0, retrieved ${retrieved} through query.wikidata.org.
// ${SOURCE_NOTE[topic]}
// An item fits a criterion here only if Wikidata says so; Wikidata is incomplete.

export const META = ${JSON.stringify({ topic, source: 'Wikidata', sourceUrl: 'https://www.wikidata.org', licence: 'CC0', retrieved, exclusive, ...(groupCap ? { groupCap } : {}), ...(womenShare ? { womenShare } : {}) })};

// The criteria of this topic; an item's third field lists indexes into CRITERIA.
export const CRITERIA = ${JSON.stringify(criteria.map((c) => c.id))};

export const DEFINITIONS = [
${defs.join(',\n')}
];

// [Wikidata id without the Q, Hebrew name, criteria, other names (optional), birth year shown to tell namesakes apart (optional)], best-known first
export const ITEMS = [
${rows.join(',\n')}
];
`);
}

async function readData(topic) {
  const data = await import(pathToFileURL(here(`data/${topic}.js`)).href + `?t=${Date.now()}`);
  return { items: itemsFromRows(data.CRITERIA, data.ITEMS), criteria: data.DEFINITIONS, exclusive: data.META.exclusive, groupCap: data.META.groupCap, retrieved: data.META.retrieved };
}

/**
 * People topics must be for everyone: a criterion whose answers are less than a quarter women (by
 * Wikidata's "sex or gender") is dropped. The share of every criterion kept is written to the data
 * file, and the tests check it again.
 */
const WOMEN_MIN = 0.25;
function balanceGenders(topic, { items, criteria }) {
  const womenShare = {};
  const kept = [];
  for (const c of criteria) {
    const members = items.filter((i) => i.crits.has(c.id));
    const share = members.length ? members.filter((i) => i.female).length / members.length : 0;
    if (share < WOMEN_MIN) { console.log(`  ${topic}: ${c.id} dropped, ${Math.round(100 * share)}% women of ${members.length}`); continue; }
    womenShare[c.id] = Math.round(share * 100) / 100;
    kept.push(c);
  }
  const ids = new Set(kept.map((c) => c.id));
  for (const item of items) item.crits = new Set([...item.crits].filter((c) => ids.has(c)));
  return { items: items.filter((i) => i.crits.size), criteria: kept, womenShare };
}

// ---------- grids ----------

/** Day 1 (14 November 2026) is a Saturday; the week repeats. Football is one day in seven. */
export const ROTATION = ['football', 'countries', 'screen', 'music', 'countries', 'places', 'screen'];
export const GRID_DAYS = 26 * ROTATION.length;
/** A cell is only used if at least this many items in the data fit it. The tests hold every grid to it. */
export const MIN_ANSWERS = 10;
const SEED = 20261114;
/** How many earlier grids of the same topic the "do not repeat" rules look at (about three weeks). */
const NEIGHBOURHOOD = 3;
/** At most this many criteria of one group in a grid (anchors are exempt; a topic may allow more). */
const GROUP_CAP = 2;

function generateTopicGrids(topic, { items, criteria, exclusive = [], groupCap = GROUP_CAP }, count, random) {
  const ids = criteria.map((c) => c.id);
  const def = new Map(criteria.map((c) => [c.id, c]));
  const exclusiveGroups = new Set(['born', ...exclusive]);
  const anchored = criteria.some((c) => c.anchor);
  const size = new Map(ids.map((id) => [id, items.filter((i) => i.crits.has(id)).length]));
  const usage = new Map(ids.map((id) => [id, 0]));
  const counts = new Map();
  const count2 = (a, b) => {
    const key = a < b ? a + '|' + b : b + '|' + a;
    if (!counts.has(key)) counts.set(key, items.filter((i) => i.crits.has(a) && i.crits.has(b)).length);
    return counts.get(key);
  };
  const usable = ids.filter((id) => size.get(id) >= MIN_ANSWERS);
  const anchors = usable.filter((id) => def.get(id).anchor);
  const others = usable.filter((id) => !def.get(id).anchor);

  const draw = (pool, taken) => {
    const open = pool.filter((id) => !taken.includes(id));
    if (!open.length) return null;
    const weights = open.map((id) => Math.sqrt(size.get(id)) / (1 + usage.get(id)));
    let roll = random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < open.length; i++) { roll -= weights[i]; if (roll <= 0) return open[i]; }
    return open[open.length - 1];
  };

  const crosses = (a, b) => !(def.get(a).group === def.get(b).group && exclusiveGroups.has(def.get(a).group)) && count2(a, b) >= MIN_ANSWERS;

  // One side is drawn first; the other side is then drawn only from criteria that meet all three of
  // it with enough answers. Where a topic has anchors (clubs, film series, shows, awards), the other
  // criteria (birth decade, nationality…) sit on the second side only, so every cell asks about an anchor.
  // Built crosswise: one criterion of the first side, then the whole second side from criteria that
  // meet it with enough answers, then the rest of the first side from criteria that meet all of the
  // second. Where a topic has anchors (clubs, film series, shows, awards), the other criteria (birth
  // decade, nationality…) sit on the second side only, so every cell asks about an anchor.
  const candidate = () => {
    const firstPool = anchored ? anchors : usable;
    const first = [draw(firstPool, [])];
    const meetsAll = (side) => (id) => side.every((f) => f !== id && crosses(f, id));
    const open = usable.filter(meetsAll(first));
    const second = [];
    const roll = random();
    const attributeCount = !anchored ? 0 : roll < 0.15 ? 0 : roll < 0.5 ? 1 : roll < 0.8 ? 2 : 3;
    const openOthers = open.filter((id) => !def.get(id).anchor);
    const openRest = anchored ? open.filter((id) => def.get(id).anchor) : open;
    while (second.length < attributeCount) { const next = draw(openOthers, second); if (!next) return null; second.push(next); }
    while (second.length < SIZE) { const next = draw(openRest, second); if (!next) return null; second.push(next); }
    const rest = firstPool.filter((id) => !second.includes(id) && meetsAll(second)(id));
    while (first.length < SIZE) { const next = draw(rest, first); if (!next) return null; first.push(next); }
    second.sort(() => random() - 0.5);
    first.sort(() => random() - 0.5);
    return random() < 0.5 ? { topic, rows: first, cols: second } : { topic, rows: second, cols: first };
  };

  const grids = [];
  const fits = (grid, n) => {
    const all = [...grid.rows, ...grid.cols];
    if (new Set(all).size !== 6) return false;
    const key = cellPairs(grid).sort().join();
    if (grids.some((other) => cellPairs(other).sort().join() === key)) return false;
    const groups = new Map();
    for (const id of all) {
      const c = def.get(id);
      if (c.anchor) continue;
      groups.set(c.group, (groups.get(c.group) || 0) + 1);
    }
    if ([...groups.values()].some((k) => k > groupCap)) return false;
    for (const row of grid.rows) for (const col of grid.cols) {
      const [a, b] = [def.get(row), def.get(col)];
      if (a.group === b.group && exclusiveGroups.has(a.group)) return false;
      if (count2(row, col) < MIN_ANSWERS) return false;
    }
    const pairs = new Set(cellPairs(grid));
    // The list wraps after the last grid, so the final grids are also checked against the first ones.
    for (let distance = 1; distance <= NEIGHBOURHOOD; distance++) {
      for (const other of [grids[n - distance], n + distance >= count ? grids[(n + distance) % count] : null]) {
        if (!other) continue;
        if (sharedCriteria(grid, other) > (distance === 1 ? 1 : 2)) return false;
        if (cellPairs(other).some((pair) => pairs.has(pair))) return false;
      }
    }
    return assignDistinct(Array.from({ length: CELLS }, (_, cell) => validItems(items, grid, cell))) !== null;
  };

  // The last grids must also differ from the first ones (the list wraps); when that corner cannot be
  // turned, the topic starts over with the random stream where it is.
  attempts: for (let attempt = 1; ; attempt++) {
  grids.length = 0;
  for (const id of ids) usage.set(id, 0);
  for (let n = 0; n < count; n++) {
    let best = null;
    for (let tries = 0; tries < 30000 && (!best || tries < 600); tries++) {
      const grid = candidate();
      if (!grid || !fits(grid, n)) continue;
      let thinnest = Infinity;
      for (const row of grid.rows) for (const col of grid.cols) thinnest = Math.min(thinnest, count2(row, col));
      const groups = new Set([...grid.rows, ...grid.cols].map((id) => def.get(id).group)).size;
      // Prefer roomy cells (a true answer is less likely to be missing from Wikidata) and varied criteria.
      const score = Math.min(thinnest, 25) + 1.5 * groups + 4 * random();
      if (!best || score > best.score) best = { grid, score };
    }
    if (!best) {
      if (attempt === 100) throw new Error(`${topic}: no fair grid found for grid ${n + 1}`);
      console.log(`  ${topic}: stuck at grid ${n + 1}, starting over`);
      continue attempts;
    }
    grids.push(best.grid);
    for (const id of [...best.grid.rows, ...best.grid.cols]) usage.set(id, usage.get(id) + 1);
  }
  break;
  }
  const cellCounts = grids.flatMap((g) => g.rows.flatMap((row) => g.cols.map((col) => count2(row, col)))).sort((a, b) => a - b);
  console.log(`${topic}: ${grids.length} grids from ${items.length} items. Answers per cell: min ${cellCounts[0]}, median ${cellCounts[cellCounts.length >> 1]}. Criteria used: ${[...usage].filter(([, n]) => n).length} of ${ids.length}.`);
  console.log('  never used:', [...usage].filter(([, n]) => !n).map(([id]) => id).join(' ') || '-');
  return grids;
}

function writeGrids(grids, topicsData, retrieved) {
  const used = new Set(grids.flatMap((g) => [...g.rows, ...g.cols]));
  const defs = [];
  for (const topic of TOPIC_IDS) {
    for (const c of topicsData[topic].criteria) if (used.has(c.id)) defs.push(`  ${JSON.stringify(c.id)}: ${JSON.stringify([c.name, c.detail, c.colors || c.icon])},`);
  }
  const rows = grids.map((g) => `  ${JSON.stringify([g.topic, g.rows, g.cols])},`);
  writeFileSync(here('grids.js'), `// Generated by build-data.mjs from data/*.js (Wikidata, retrieved ${retrieved}). Do not edit by hand.
// One grid per day, in order: [topic, rows, columns]. Day 1 is the first line; after the last line the list starts over.
// The topics follow a weekly rotation (${ROTATION.join(', ')}), starting on day 1, a Saturday.
// Guarantees, checked again by tests/herkev.logic.test.mjs: every cell has at least ${MIN_ANSWERS} valid answers in the
// topic's data file, nine different answers can fill the grid, no criterion appears twice in a grid, and within a topic
// consecutive grids share at most one criterion and no row×column pair comes back within ${NEIGHBOURHOOD} grids.

export const MIN_ANSWERS = ${MIN_ANSWERS};
export const RETRIEVED = '${retrieved}';

// Criterion id: [name, detail, icon name or two chip colours]
export const CRITERIA = {
${defs.join('\n')}
};

export const GRIDS = [
${rows.join('\n')}
];
`);
}

// ---------- run ----------

async function main() {
  mkdirSync(here('data'), { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const topicsData = {};
  for (const topic of TOPIC_IDS) {
    if (!gridsOnly && (!only || only.includes(topic))) {
      console.log(`${topic}: fetching`);
      const built = await topics[topic]();
      if (topic === 'screen' || topic === 'music') Object.assign(built, balanceGenders(topic, built));
      // Something that fits no criterion can never be an answer.
      // Names must be Hebrew (a few labels are only the Latin name).
      const settled = settleNamesakes(built.items.filter((i) => i.crits.size > 0 && isHebrew(i.name)));
      settled.items.sort((a, b) => b.links - a.links || a.id - b.id);
      writeData(topic, { ...built, items: settled.items }, today);
      console.log(`\n${topic}: ${settled.items.length} items, ${settled.dropped} namesakes dropped.`);
    }
    topicsData[topic] = await readData(topic);
  }
  const random = mulberry32(SEED);
  const perTopic = {};
  for (const topic of TOPIC_IDS) {
    const days = Array.from({ length: GRID_DAYS }, (_, i) => i).filter((i) => ROTATION[i % ROTATION.length] === topic);
    perTopic[topic] = generateTopicGrids(topic, topicsData[topic], days.length, random);
  }
  const taken = Object.fromEntries(TOPIC_IDS.map((t) => [t, 0]));
  const grids = Array.from({ length: GRID_DAYS }, (_, i) => { const t = ROTATION[i % ROTATION.length]; return perTopic[t][taken[t]++]; });
  const retrieved = TOPIC_IDS.map((t) => topicsData[t].retrieved).sort().at(-1);
  writeGrids(grids, topicsData, retrieved);
  console.log(`grids.js: ${grids.length} days.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();

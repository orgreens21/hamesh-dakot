import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games/yoter/game.js';
import { DATA, SOURCE } from '../games/yoter/data.js';
import { mulberry32 } from '../shared/core.js';

const YEAR = Array.from({ length: 365 }, (_, i) => i + 1);
// Days before the epoch are zero or negative and must work too.
const DAYS = [-40, -7, -1, 0, ...YEAR];

// What a sane value looks like per theme: catches a unit mix-up or a stray outlier in a rebuild.
const RANGE = {
  population: [20000, 1200000],
  founded: [1870, 2000],
  north: [100, 420],
  films: [1950, 2024],
  tv: [1968, 2024],
  peaks: [-450, 2300],
  born: [1900, 2010],
};

/** The step between two values, as each theme measures it: years apart, or share of the larger one. */
const gapOf = (theme, a, b) => (theme.kind === 'year' ? Math.abs(a - b) : Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)));

test('data: source, at least six themes of sixty complete, unique, plausible items', () => {
  assert.equal(SOURCE.english, 'Wikidata');
  assert.match(SOURCE.url, /^https:\/\/www\.wikidata\.org/);
  assert.match(SOURCE.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(SOURCE.name && SOURCE.license);

  assert.ok(G.THEMES.length >= 6);
  assert.deepEqual(G.THEMES.map((t) => t.id).sort(), Object.keys(DATA).sort(), 'every data list has a theme and the other way round');
  assert.deepEqual(Object.keys(RANGE).sort(), Object.keys(DATA).sort());

  for (const theme of G.THEMES) {
    assert.ok(theme.items.length >= 60, `${theme.id} has ${theme.items.length} items`);
    assert.equal(new Set(theme.items.map((it) => it.name)).size, theme.items.length, `${theme.id}: duplicate names`);
    const [lo, hi] = RANGE[theme.id];
    for (const { name, value } of theme.items) {
      assert.ok(typeof name === 'string' && /[א-ת]/.test(name) && name === name.trim(), `${theme.id}: bad name "${name}"`);
      assert.ok(!/[()]/.test(name) && !/\d{4}/.test(name), `${theme.id}: "${name}" carries a bracket or a year`);
      assert.ok(Number.isInteger(value) && value >= lo && value <= hi, `${theme.id}: ${name} = ${value}`);
    }
    for (const key of ['title', 'short', 'more', 'less']) assert.ok(theme[key], `${theme.id}.${key}`);
    assert.ok(theme.prefix || theme.suffix, `${theme.id} has no unit`);
    assert.ok(theme.kind === 'year' ? theme.gap >= 3 : theme.gap >= 0.03, `${theme.id}: gap too small`);
    // Enough spread that a chain can always find something close and something far.
    assert.ok(new Set(theme.items.map((it) => it.value)).size >= 30, `${theme.id}: too few distinct values`);
  }
});

test('the theme of the day rotates: every theme once per round, never two days running', () => {
  const n = G.THEMES.length;
  for (let start = -27; start <= 365; start += n) {
    const round = Array.from({ length: n }, (_, i) => G.themeForDay(start + i).id);
    assert.equal(new Set(round).size, n, `days ${start}… repeat a theme: ${round}`);
  }
  for (let day = -40; day <= 365; day++) assert.notEqual(G.themeForDay(day).id, G.themeForDay(day + 1).id, `days ${day} and ${day + 1}`);
  // Not a fixed weekday: the same theme must not always fall on the same position of the round.
  const positions = new Set(YEAR.filter((d) => G.themeForDay(d).id === 'population').map((d) => (d - 1) % n));
  assert.ok(positions.size >= 4);
});

test('daily chains over a year: ten fair rounds, no repeats, a mix of easy and tight', () => {
  const openers = new Set();
  for (const day of DAYS) {
    const { theme, items, levels } = G.chainForDay(day);
    assert.equal(theme, G.themeForDay(day));
    assert.equal(items.length, G.ROUNDS + 1, `day ${day}`);
    assert.equal(new Set(items.map((it) => it.name)).size, items.length, `day ${day} repeats an item`);
    assert.deepEqual(G.chainForDay(day), { theme, items, levels }, 'same chain for everyone');
    for (const it of items) assert.ok(theme.items.includes(it));

    const gaps = [];
    let more = 0;
    for (let i = 0; i < G.ROUNDS; i++) {
      const a = items[i].value;
      const b = items[i + 1].value;
      assert.notEqual(a, b, `day ${day} round ${i + 1}: equal values`);
      assert.ok(G.farEnough(theme, a, b), `day ${day} round ${i + 1}: ${a} vs ${b}`);
      // The house rule, checked without the game's own helper: never within 3%, and years never within 3.
      if (theme.kind === 'year') assert.ok(Math.abs(a - b) >= 3, `day ${day}: years ${a} and ${b}`);
      else assert.ok(Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) > 0.03, `day ${day}: ${a} vs ${b} within 3%`);
      gaps.push(gapOf(theme, a, b));
      if (b > a) more++;
    }
    assert.ok(Math.max(...gaps) >= 2 * Math.min(...gaps), `day ${day}: every gap is alike (${gaps})`);
    assert.ok(more >= 1 && more <= G.ROUNDS - 1, `day ${day}: the answer is always the same`);
    assert.equal(levels[0], 'easy', 'the first round is a gentle one');
    assert.deepEqual([...levels].sort(), ['easy', 'easy', 'easy', 'easy', 'mid', 'mid', 'mid', 'tight', 'tight', 'tight']);
    if (day >= 1) openers.add(theme.id + items[0].name);
  }
  assert.ok(openers.size >= 200, 'chains do not keep opening with the same item');

  // Tight rounds really are tighter than easy ones, on average, in every theme.
  for (const theme of G.THEMES) {
    const byLevel = { easy: [], tight: [] };
    for (const day of YEAR) {
      const chain = G.chainForDay(day);
      if (chain.theme !== theme) continue;
      chain.levels.forEach((level, i) => byLevel[level]?.push(gapOf(theme, chain.items[i].value, chain.items[i + 1].value)));
    }
    const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
    assert.ok(byLevel.tight.length >= 100 && mean(byLevel.easy) > 2 * mean(byLevel.tight), theme.id);
  }
});

test('pairing rule: equal and near-equal values never meet', () => {
  const amount = G.themeById('peaks');
  assert.equal(G.farEnough(amount, 1000, 1000), false);
  assert.equal(G.farEnough(amount, 1000, 1030), false);
  assert.equal(G.farEnough(amount, 1000, 1040), true);
  assert.equal(G.farEnough(amount, -190, -60), true);
  assert.equal(G.farEnough(amount, 5, -5), true);
  const year = G.themeById('films');
  assert.equal(G.farEnough(year, 1990, 1992), false);
  assert.equal(G.farEnough(year, 1990, 1993), true);
  // Population figures come from different years, so that theme asks for a wider margin.
  const population = G.themeById('population');
  assert.equal(G.farEnough(population, 100000, 109000), false);
  assert.equal(G.farEnough(population, 100000, 115000), true);
  assert.equal(G.themeById('nope'), null);
});

test('sudden death run: grows on demand, fair pairs, no repeats until the theme runs dry', () => {
  for (const theme of G.THEMES) {
    const run = G.createRun(theme, mulberry32(7));
    assert.equal(run.items.length, 2);
    for (let i = 0; i < 300; i++) run.extend();
    assert.equal(run.items.length, 302, 'a long run never dead-ends');
    for (let i = 0; i + 1 < run.items.length; i++) {
      assert.ok(G.farEnough(theme, run.items[i].value, run.items[i + 1].value), `${theme.id} step ${i}`);
    }
    const opening = run.items.slice(0, 25).map((it) => it.name);
    assert.equal(new Set(opening).size, opening.length, `${theme.id}: early repeat`);
  }
  const a = G.createRun(G.THEMES[0], mulberry32(1)).items.map((it) => it.name);
  const b = G.createRun(G.THEMES[0], mulberry32(2)).items.map((it) => it.name);
  assert.notDeepEqual(a, b, 'runs differ from one another');
});

test('answers, score and the end of the day', () => {
  const items = [10, 20, 15, 30, 5, 6, 7, 3, 9, 1, 2].map((value, i) => ({ name: 'פריט ' + i, value }));
  const perfect = ['more', 'less', 'more', 'less', 'more', 'more', 'less', 'more', 'less', 'more'];
  assert.equal(G.isRight(items[0], items[1], 'more'), true);
  assert.equal(G.isRight(items[0], items[1], 'less'), false);
  assert.equal(G.isRight(items[1], items[2], 'less'), true);
  assert.equal(G.score(items, perfect), 10);
  assert.deepEqual(G.results(items, ['less', 'less']), [false, true]);
  assert.equal(G.isOver(perfect.slice(0, 9)), false);
  assert.equal(G.isOver(perfect), true);

  const seven = perfect.map((a, i) => (i < 3 ? (a === 'more' ? 'less' : 'more') : a));
  const six = perfect.map((a, i) => (i < 4 ? (a === 'more' ? 'less' : 'more') : a));
  assert.equal(G.score(items, seven), 7);
  assert.equal(G.isWon(items, seven), true, 'seven right keeps the streak');
  assert.equal(G.isWon(items, six), false);
  assert.equal(G.isWon(items, perfect.slice(0, 8)), false, 'not won before the last round');
  assert.equal(G.summary(items, six), '6/10');
  assert.equal(G.BUCKETS, 11);

  assert.deepEqual(G.cleanAnswers(['more', 'up', 'less', null, 3]), ['more', 'less']);
  assert.deepEqual(G.cleanAnswers('more'), []);
  assert.equal(G.cleanAnswers(Array(40).fill('more')).length, 10);

  assert.deepEqual([10, 9, 8, 7, 6, 4, 3, 0].map(G.endTitle), ['עשר מעשר!', 'כמעט מושלם', 'כמעט מושלם', 'יפה מאוד', 'לא רע בכלל', 'לא רע בכלל', 'מחר יום חדש', 'מחר יום חדש']);
});

test('numbers are written the Hebrew way, with their unit', () => {
  assert.equal(G.formatValue(G.themeById('population'), 1050151), '1,050,151 תושבים');
  assert.equal(G.formatValue(G.themeById('peaks'), 1208), '1,208 מ׳ מעל פני הים');
  assert.equal(G.formatValue(G.themeById('peaks'), -190), '-190 מ׳ מעל פני הים');
  assert.equal(G.formatValue(G.themeById('founded'), 1909), 'שנת הקמה 1909');
  assert.equal(G.formatValue(G.themeById('films'), 1964), 'יצא בשנת 1964');
  assert.equal(G.formatValue(G.themeById('north'), 281), '281 ק״מ צפונה מאילת');
  assert.deepEqual(G.valueParts(G.themeById('born'), 1985), { prefix: 'שנת לידה', number: '1985', suffix: '' });
});

test('share text has the name, day, score, ten squares and link, and no spoilers', () => {
  const { items } = G.chainForDay(12);
  const right = items.slice(1).map((it, i) => (it.value > items[i].value ? 'more' : 'less'));
  const answers = right.map((a, i) => (i === 2 || i === 6 ? (a === 'more' ? 'less' : 'more') : a));
  const text = G.shareText({ day: 12, items, answers, url: 'https://example.test/games/yoter/' });
  assert.equal(text, 'יותר או פחות #12 8/10\n🟩🟩🟥🟩🟩🟩🟥🟩🟩🟩\nhttps://example.test/games/yoter/');
  for (const it of items) assert.ok(!text.includes(it.name), 'no item names in the share text');
  assert.ok(!/[⬆⬇]/u.test(text), 'squares only: which way each answer went stays secret');
  assert.ok(G.shareText({ day: 0, items, answers: right.map((a) => (a === 'more' ? 'less' : 'more')), url: 'u' }).startsWith('יותר או פחות #0 0/10\n🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥\n'));
});

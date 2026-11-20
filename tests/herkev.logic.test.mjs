import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games/herkev/game.js';
import { GRIDS, CRITERIA } from '../games/herkev/grids.js';

const grids = GRIDS.map(([topic, rows, cols]) => ({ topic, rows, cols }));
const criteriaOf = (grid) => [...grid.rows, ...grid.cols];
const data = {};
for (const topic of G.TOPIC_IDS) data[topic] = await import(`../games/herkev/data/${topic}.js`);
for (const topic of G.TOPIC_IDS) await G.loadTopic(topic);
const definition = (topic, id) => data[topic].DEFINITIONS.find((d) => d.id === id);
const wrongFor = (grid, cell, skip = []) => {
  const valid = new Set(G.answersFor(grid, cell).map((p) => p.id));
  return G.itemsOf(grid.topic).find((p) => !valid.has(p.id) && !skip.includes(p.id));
};
const byTopic = (topic) => grids.map((g, i) => ({ g, day: i + 1 })).filter(({ g }) => g.topic === topic);

// ---------- data ----------

test('every topic has its words, an answer list that names its source, and criteria that are its own', () => {
  assert.deepEqual(G.TOPIC_IDS.sort(), ['countries', 'football', 'music', 'places', 'screen']);
  const seen = new Set();
  for (const topic of G.TOPIC_IDS) {
    const t = G.TOPICS[topic];
    for (const key of ['label', 'noun', 'placeholder', 'none', 'example', 'icon']) assert.ok(t[key] && /[א-ת]|^[a-z]+$/.test(t[key]), `${topic}.${key}`);
    const meta = G.metaOf(topic);
    assert.equal(meta.source, 'Wikidata');
    assert.equal(meta.topic, topic);
    assert.match(meta.retrieved, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(data[topic].CRITERIA.length, data[topic].DEFINITIONS.length);
    for (const id of data[topic].CRITERIA) {
      assert.ok(!seen.has(id), `criterion ${id} belongs to one topic only`);
      seen.add(id);
    }
  }
  assert.match(G.RETRIEVED, /^\d{4}-\d{2}-\d{2}$/);
});

test('answer lists: Hebrew names, unique ids, and nothing two answers could be mistaken for', () => {
  const minimum = { countries: 190, screen: 1000, music: 400, places: 1000, football: 1000 };
  for (const topic of G.TOPIC_IDS) {
    const items = G.itemsOf(topic);
    assert.ok(items.length >= minimum[topic], `${topic}: ${items.length} items`);
    assert.equal(new Set(items.map((p) => p.id)).size, items.length, `${topic}: unique Wikidata ids`);
    const labels = new Set();
    for (const p of items) {
      assert.ok(Number.isInteger(p.id) && p.id > 0);
      assert.match(p.name, /[א-ת]/, p.name);
      assert.ok(!/[()a-zA-Z]/.test(p.name) && p.name === p.name.trim(), `clean name: ${p.name}`);
      assert.ok(p.crits.size >= 1 && [...p.crits].every((c) => c && data[topic].CRITERIA.includes(c)), `${topic}: ${p.name}`);
      assert.ok(Array.isArray(p.aliases) && p.aliases.every((a) => /[א-ת]/.test(a)));
      const label = `${p.name}|${p.hint}`;
      assert.ok(!labels.has(label), `${topic}: two answers look the same in the search list: ${label}`);
      labels.add(label);
    }
    // Namesakes must be told apart by their hint.
    const byName = Map.groupBy(items, (p) => p.name);
    for (const [name, group] of byName) if (group.length > 1) assert.ok(group.every((p) => /^\d{4}$/.test(p.hint)), name);
  }
});

test('people topics are not built for one gender: women are at least a quarter of the answers to every criterion used', () => {
  for (const topic of ['screen', 'music']) {
    assert.match(G.TOPICS[topic].noun, / או /, `${topic}: the noun names both forms`);
    assert.match(G.TOPICS[topic].placeholder, / או /);
    const share = G.metaOf(topic).womenShare;
    assert.ok(share, `${topic}: the builder records the share of women per criterion`);
    const used = new Set(byTopic(topic).flatMap(({ g }) => criteriaOf(g)));
    for (const id of used) assert.ok(share[id] >= 0.25, `${topic}: ${id} is ${Math.round(100 * share[id])}% women`);
  }
});

// ---------- grids ----------

test('half a year of grids, each well formed, on the day\'s topic', () => {
  assert.ok(grids.length >= 180);
  assert.equal(G.GRID_DAYS, grids.length);
  for (const [i, grid] of grids.entries()) {
    assert.ok(G.TOPICS[grid.topic], `day ${i + 1}: topic ${grid.topic}`);
    assert.equal(grid.rows.length, 3);
    assert.equal(grid.cols.length, 3);
    const all = criteriaOf(grid);
    assert.equal(new Set(all).size, 6, `day ${i + 1}: a criterion repeats`);
    for (const id of all) {
      assert.ok(G.criterion(id), `day ${i + 1}: unknown criterion ${id}`);
      assert.ok(data[grid.topic].CRITERIA.includes(id), `day ${i + 1}: ${id} is not a ${grid.topic} criterion`);
    }
    // Where a topic has anchors (clubs, film series, shows, awards), the other criteria sit on one side only.
    if (data[grid.topic].DEFINITIONS.some((d) => d.anchor)) {
      const loose = [grid.rows, grid.cols].filter((side) => side.some((id) => !definition(grid.topic, id).anchor));
      assert.ok(loose.length <= 1, `day ${i + 1}: non-anchor criteria on both sides`);
    }
  }
});

test('topics rotate: a different topic every day, football at most one day in six, every topic every week', () => {
  const n = grids.length;
  for (let i = 0; i < n; i++) assert.notEqual(grids[i].topic, grids[(i + 1) % n].topic, `days ${i + 1} and ${i + 2} share a topic`);
  for (let start = 0; start < n; start++) {
    const week = Array.from({ length: 7 }, (_, d) => grids[(start + d) % n].topic);
    for (const topic of G.TOPIC_IDS) assert.ok(week.includes(topic), `${topic} is missing from the week from day ${start + 1}`);
    const six = Array.from({ length: 6 }, (_, d) => grids[(start + d) % n].topic);
    assert.ok(six.filter((t) => t === 'football').length <= 1, `two football days within six days from day ${start + 1}`);
  }
  assert.ok(grids.filter((g) => g.topic === 'football').length <= n / 6);
});

test('every cell of every day has enough valid answers, and nine different answers fill the grid', () => {
  assert.ok(G.MIN_ANSWERS >= 10);
  for (const [i, grid] of grids.entries()) {
    for (let cell = 0; cell < G.CELLS; cell++) {
      const valid = G.answersFor(grid, cell);
      const [row, col] = G.cellCriteria(grid, cell);
      assert.ok(valid.length >= G.MIN_ANSWERS, `day ${i + 1} cell ${cell} has only ${valid.length} answers`);
      assert.ok(valid.every((p) => G.matches(p, row) && G.matches(p, col)));
    }
    const solution = G.solve(grid);
    assert.ok(solution, `day ${i + 1} has no solution`);
    assert.equal(new Set(solution.map((p) => p.id)).size, 9, `day ${i + 1}: answers repeat`);
    assert.equal(G.replay(grid, solution.map((p, cell) => [cell, p.id])).solved, 9);
  }
});

test('within a topic, neighbouring grids differ: at most one shared criterion, and no cell comes back within three', () => {
  for (const topic of G.TOPIC_IDS) {
    const list = byTopic(topic);
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const mine = new Set(G.cellPairs(list[i].g));
      assert.ok(G.sharedCriteria(list[i].g, list[(i + 1) % n].g) <= 1, `${topic}: days ${list[i].day} and ${list[(i + 1) % n].day}`);
      for (let d = 1; d <= 3; d++) {
        const other = list[(i + d) % n];
        assert.ok(G.sharedCriteria(list[i].g, other.g) <= 2, `${topic}: days ${list[i].day} and ${other.day}`);
        assert.ok(!G.cellPairs(other.g).some((pair) => mine.has(pair)), `${topic}: a cell of day ${list[i].day} repeats on day ${other.day}`);
      }
    }
  }
  assert.equal(new Set(grids.map((g) => JSON.stringify(g))).size, grids.length, 'no grid appears twice');
});

test('the daily grid is deterministic and exists for any day number', () => {
  assert.deepEqual(G.gridForDay(1), grids[0]);
  assert.deepEqual(G.gridForDay(2), grids[1]);
  assert.deepEqual(G.gridForDay(grids.length + 1), grids[0]);
  assert.deepEqual(G.gridForDay(0), grids.at(-1));
  assert.deepEqual(G.gridForDay(-3), grids.at(-4));
  assert.equal(G.topicOf(G.gridForDay(1)), G.TOPICS.football, 'day 1, a Saturday, is football');
});

test('criteria: what the page draws', () => {
  for (const [id, [name, detail, look]] of Object.entries(CRITERIA)) {
    const c = G.criterion(id);
    assert.equal(c.name, name);
    assert.ok(/[א-ת]/.test(name) && /[א-ת]/.test(detail), id);
    if (Array.isArray(look)) assert.ok(c.colors.length === 2 && c.colors.every((x) => /^#[0-9a-f]{6}$/.test(x)), id);
    else assert.match(c.icon, /^[a-z]+$/, id);
  }
  assert.equal(G.criterion('nonsense'), null);
  const club = G.criterion('f:mta');
  assert.ok(club.colors && club.name === 'מכבי תל אביב');
});

// ---------- rules, on one grid of each topic ----------

for (const topic of ['countries', 'screen', 'music', 'places', 'football']) {
  test(`${topic}: right and wrong both use a guess, refusals do not; a perfect game`, () => {
    const { g: grid } = byTopic(topic)[0];
    const solution = G.solve(grid);
    const miss = wrongFor(grid, 1, solution.map((p) => p.id));
    const guesses = [];
    assert.equal(G.judge(grid, guesses, 0, solution[0].id), 'right');
    guesses.push([0, solution[0].id]);
    assert.equal(G.judge(grid, guesses, 0, solution[1].id), 'filled');
    assert.equal(G.judge(grid, guesses, 1, solution[0].id), 'placed', 'an answer sits in one cell only');
    assert.equal(G.judge(grid, guesses, 1, miss.id), 'wrong');
    guesses.push([1, miss.id]);
    assert.equal(G.judge(grid, guesses, 1, miss.id), 'repeat');
    assert.equal(G.judge(grid, guesses, 1, 999999999), 'unknown');
    assert.equal(G.judge(grid, guesses, 12, miss.id), 'unknown');
    const position = G.replay(grid, guesses);
    assert.deepEqual([position.solved, position.left], [1, 7]);
    assert.equal(G.isOver(grid, guesses, true), true, 'giving up ends the game');

    const perfect = solution.map((p, cell) => [cell, p.id]);
    assert.equal(G.isOver(grid, perfect.slice(0, 8)), false);
    assert.equal(G.isOver(grid, perfect), true);
    assert.equal(G.summary(grid, perfect), '9/9');
    assert.equal(G.isWon(grid, perfect.slice(0, 5)), true);
    assert.equal(G.isWon(grid, perfect.slice(0, 4)), false);
  });
}

test('nine misses end the game; a tenth guess is ignored', () => {
  const grid = grids[3];
  const solution = G.solve(grid);
  const used = solution.map((p) => p.id);
  const wrong = [];
  while (wrong.length < 9) {
    const p = wrongFor(grid, 8, used);
    used.push(p.id);
    wrong.push([8, p.id]);
  }
  assert.equal(G.isOver(grid, wrong), true);
  assert.equal(G.judge(grid, wrong, 0, solution[0].id), 'over');
  assert.equal(G.summary(grid, wrong), '0/9');
  assert.equal(G.replay(grid, [...wrong, [0, solution[0].id]]).solved, 0);
});

test('stored progress may be junk, or belong to a grid of another topic', () => {
  const grid = byTopic('countries')[0].g;
  const solution = G.solve(grid);
  for (const junk of [null, undefined, 'x', 7, {}, [null, 'a', [1], [99, 1], [0, 'x'], [0.5, solution[0].id]]]) {
    assert.deepEqual(G.replay(grid, junk).guesses, []);
  }
  const doubled = [[0, solution[0].id], [0, solution[0].id], [1, solution[0].id]];
  assert.deepEqual(G.replay(grid, doubled).guesses, [[0, solution[0].id]]);
  // Guesses saved for a football grid (the game's first version) mean nothing on a countries day.
  const football = byTopic('football')[0].g;
  const old = G.solve(football).map((p, cell) => [cell, p.id]);
  assert.deepEqual(G.replay(grid, old).guesses, []);
});

test('share text: name, day, score, topic, squares and link, and nothing that spoils', () => {
  for (const topic of G.TOPIC_IDS) {
    const { g: grid } = byTopic(topic)[0];
    const solution = G.solve(grid);
    const miss = wrongFor(grid, 4, solution.map((p) => p.id));
    const guesses = [[0, solution[0].id], [4, miss.id], [5, solution[5].id], [8, solution[8].id]];
    const text = G.shareText({ day: 12, grid, guesses, url: 'https://example.test/games/herkev/' });
    assert.equal(text, `צומת #12 3/9 · ${G.TOPICS[topic].label}\n🟩⬜⬜\n⬜⬜🟩\n⬜⬜🟩\nhttps://example.test/games/herkev/`);
    for (const p of [...solution, miss]) assert.ok(!text.includes(p.name), p.name);
    for (const id of criteriaOf(grid)) assert.ok(!text.includes(G.criterion(id).name), G.criterion(id).name);
  }
});

test('end titles cover every score and are not about football', () => {
  for (let solved = 0; solved <= 9; solved++) {
    assert.ok(G.endTitle(solved).length > 3);
    assert.ok(!/מגרש|הרכב|שחקן/.test(G.endTitle(solved)));
  }
  assert.equal(G.endTitle(9), 'רשת מושלמת!');
});

test('search is forgiving: partial names, word order, niqqud, final letters, loose spelling, other names', () => {
  for (const topic of G.TOPIC_IDS) {
    const items = G.itemsOf(topic);
    const index = G.buildSearchIndex(items);
    const top = items.find((p) => p.name.includes(' ')) || items[0];
    const words = top.name.split(' ');
    const ids = (q) => G.searchItems(index, q, 8).map((p) => p.id);
    assert.ok(ids(top.name).includes(top.id), `${topic}: ${top.name}`);
    if (words.length > 1) assert.ok(ids([...words.slice(1), words[0]].join(' ')).includes(top.id), `${topic}: any word order`);
    assert.ok(ids(top.name.slice(0, 3)).length > 0);
    assert.deepEqual(ids(''), []);
    assert.deepEqual(ids('qqqqzz'), []);
  }
  const small = G.buildSearchIndex([
    { id: 1, name: 'רוברטו קולאוטי' }, { id: 2, name: 'טוטו תמוז' },
    { id: 3, name: 'טל בן־חיים' }, { id: 4, name: 'טל בן חיים' },
    { id: 5, name: 'ארצות הברית', aliases: ['ארה״ב', 'אמריקה'] },
  ]);
  const ids = (q) => G.searchItems(small, q).map((p) => p.id);
  assert.deepEqual(ids('קולוטי'), [1], 'a missing vowel letter');
  assert.deepEqual(ids('תותו'), [2], 'ת for ט');
  assert.deepEqual(ids('בן חיים'), [3, 4], 'hyphen or space');
  assert.deepEqual(ids('תָּמוּז'), [2], 'niqqud is ignored');
  assert.deepEqual(ids('תמוז טוטו'), [2]);
  assert.deepEqual(ids('ארהב'), [5], 'another name, punctuation ignored');
  assert.deepEqual(ids('אמריק'), [5]);
  // Real other names from Wikidata are searchable.
  const countries = G.buildSearchIndex(G.itemsOf('countries'));
  assert.ok(G.searchItems(countries, 'ארה"ב').some((p) => p.id === 30), 'ארה"ב finds the United States');
  assert.ok(G.searchItems(countries, 'סין').some((p) => p.id === 148));
});

test('archive: earlier days only, never before puzzle 1, at most thirty', () => {
  assert.deepEqual(G.archiveDays(1), []);
  assert.deepEqual(G.archiveDays(0), []);
  assert.deepEqual(G.archiveDays(4), [3, 2, 1]);
  assert.equal(G.archiveDays(100).length, G.ARCHIVE_DAYS);
  assert.equal(G.archiveDayFromQuery('?day=3', 4), 3);
  assert.equal(G.archiveDayFromQuery('?day=4', 4), null, 'today is not an archive day');
  assert.equal(G.archiveDayFromQuery('?day=5', 4), null);
  assert.equal(G.archiveDayFromQuery('?day=0', 4), null);
  assert.equal(G.archiveDayFromQuery('?day=abc', 4), null);
  assert.equal(G.archiveDayFromQuery('', 4), null);
});

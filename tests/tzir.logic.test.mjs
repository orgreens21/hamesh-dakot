import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games/tzir/game.js';
import { EVENTS, SOURCE } from '../games/tzir/data.js';

const events = (puzzle) => [puzzle.anchor, ...puzzle.queue];
const TOPICS = ['place', 'inst', 'biz', 'media', 'tv', 'film', 'music', 'book', 'sport', 'space', 'tech', 'build', 'play', 'art'];
const PROPS = ['P571', 'P577', 'P585', 'P1619', 'P619', 'P575', 'P1191', 'P580', 'P606', 'P729', 'NOBEL'];

// ---------- data ----------

test('the data names its source and when it was retrieved', () => {
  assert.ok(SOURCE.name.includes('Wikidata'));
  assert.match(SOURCE.url, /^https:\/\/www\.wikidata\.org\//);
  assert.match(SOURCE.retrieved, /^\d{4}-\d{2}-\d{2}$/);
});

test('there are at least 350 events, each complete and traceable to a Wikidata statement', () => {
  assert.ok(EVENTS.length >= 350, `only ${EVENTS.length} events`);
  for (const e of EVENTS) {
    assert.match(e.id, /^Q\d+$/, e.text);
    assert.ok(Number.isInteger(e.year) && e.year >= 1600 && e.year <= 2026, `${e.text}: ${e.year}`);
    assert.ok(PROPS.includes(e.prop), `${e.text}: ${e.prop}`);
    assert.ok(TOPICS.includes(e.topic), `${e.text}: ${e.topic}`);
    assert.equal(typeof e.il, 'boolean');
    assert.ok(e.text.length >= 8 && e.text.length <= 60, `length of: ${e.text}`);
    assert.ok(/[א-ת]/.test(e.text), `not Hebrew: ${e.text}`);
    assert.equal(e.text, e.text.trim());
  }
  assert.ok(EVENTS.filter((e) => e.il).length >= 150, 'a real share of Israeli events');
  assert.ok(EVENTS.filter((e) => !e.il).length >= 150, 'a real share of world events');
});

test('no event appears twice, by item or by wording', () => {
  assert.equal(new Set(EVENTS.map((e) => e.id)).size, EVENTS.length);
  assert.equal(new Set(EVENTS.map((e) => e.text)).size, EVENTS.length);
});

test('no phrase gives its year away', () => {
  for (const e of EVENTS) {
    const numbers = e.text.match(/\d+/g) || [];
    assert.ok(!/\d{4}/.test(e.text) || e.text.includes('90210'), `a four-digit number in: ${e.text}`);
    assert.ok(!numbers.includes(String(e.year)), `the year itself in: ${e.text}`);
    assert.ok(!numbers.includes(String(e.year % 100).padStart(2, '0')), `the short year in: ${e.text}`);
    assert.ok(!/שנות ה|המאה ה|מילניום|עשור/.test(e.text), `an era word in: ${e.text}`);
  }
});

test('the list stays light: no wars, attacks or party politics', () => {
  const heavy = /מלחמ|פיגוע|טבח|נרצח|רצח|הרוגים|שואה|אסון|בחירות|ממשלת|מפלג|פצצ/;
  for (const e of EVENTS) {
    // "מלחמת הכוכבים" is a film title, the only allowed hit.
    assert.ok(!heavy.test(e.text.replace('מלחמת הכוכבים', '')), e.text);
  }
});

test('the years are spread widely enough to build varied sets', () => {
  const years = EVENTS.map((e) => e.year);
  assert.ok(Math.min(...years) < 1800 && Math.max(...years) >= 2020);
  assert.ok(EVENTS.filter((e) => e.year < 1950).length >= 100);
});

// ---------- daily sets ----------

test('every daily set for the first year (and before the epoch) obeys the rules', () => {
  for (let day = -30; day <= 365; day++) {
    const set = events(G.puzzleForDay(day));
    assert.deepEqual(G.setProblems(set), [], `day ${day}`);
    const years = set.map((e) => e.year);
    assert.equal(new Set(years).size, G.SET_SIZE, `day ${day}: two events share a year`);
    assert.ok(Math.max(...years) - Math.min(...years) >= G.MIN_SPAN, `day ${day}: narrow range`);
    assert.ok(G.closePairs(set) >= 2, `day ${day}: fewer than two close pairs`);
    assert.equal(G.puzzleForDay(day).queue.length, G.ROUNDS);
  }
});

test('the daily set is deterministic and differs from day to day', () => {
  const ids = (day) => events(G.puzzleForDay(day)).map((e) => e.id).join();
  assert.equal(ids(5), ids(5));
  assert.equal(new Set(Array.from({ length: 365 }, (_, i) => ids(i + 1))).size, 365);
});

test('no event repeats inside a cycle, and the next cycle is dealt differently', () => {
  assert.ok(G.CYCLE >= 60, 'at least two months without a repeat');
  for (const first of [1, G.CYCLE + 1, 1 - G.CYCLE]) {
    const used = [];
    for (let day = first; day < first + G.CYCLE; day++) used.push(...events(G.puzzleForDay(day)).map((e) => e.id));
    assert.equal(new Set(used).size, G.CYCLE * G.SET_SIZE, `cycle starting on day ${first}`);
  }
  assert.notDeepEqual(events(G.puzzleForDay(1)).map((e) => e.id).sort(), events(G.puzzleForDay(G.CYCLE + 1)).map((e) => e.id).sort());
});

test('setProblems catches each kind of bad set', () => {
  const e = (id, year, il = true, topic = 'a' + id) => ({ id: 'Q' + id, year, il, topic });
  const good = [e(1, 1900), e(2, 1903), e(3, 1950, false), e(4, 1952, false), e(5, 1980), e(6, 2000), e(7, 2010)];
  assert.deepEqual(G.setProblems(good), []);
  assert.ok(G.setProblems(good.slice(1)).includes('size'));
  assert.ok(G.setProblems([...good.slice(0, 6), e(7, 2000)]).includes('two events in the same year'));
  assert.ok(G.setProblems([e(1, 1960), e(2, 1963), e(3, 1970, false), e(4, 1972, false), e(5, 1980), e(6, 2000), e(7, 2010)]).includes('span too narrow'));
  assert.ok(G.setProblems([e(1, 1900), e(2, 1910), e(3, 1950, false), e(4, 1952, false), e(5, 1980), e(6, 2000), e(7, 2010)]).includes('too few close pairs'));
  assert.ok(G.setProblems(good.map((x) => ({ ...x, il: true }))).includes('region balance'));
  assert.ok(G.setProblems(good.map((x) => ({ ...x, topic: 'film' }))).includes('one topic dominates'));
  assert.equal(G.closePairs(good), 2);
});

test('practice puzzles obey the same rules', () => {
  for (let i = 0; i < 50; i++) assert.deepEqual(G.setProblems(events(G.randomPuzzle())), []);
});

// ---------- rules ----------

const puzzle = {
  anchor: { id: 'Q1', year: 1950, text: 'א' },
  queue: [1900, 1975, 1960, 2000, 1800, 1955].map((year, i) => ({ id: 'Q' + (i + 2), year, text: 'ב' + i })),
};
/** Plays the queue: true = the right gap, false = a wrong one. */
function play(marks) {
  let results = [];
  for (const ok of marks) {
    const rows = G.timeline(puzzle, results);
    const right = G.correctGap(rows, G.currentEvent(puzzle, results));
    results = G.place(puzzle, results, ok ? right : (right + 1) % (rows.length + 1)).results;
  }
  return results;
}

test('placing: the right gap is the only correct one, and a wrong placement still lands in order', () => {
  const first = G.place(puzzle, [], 0); // 1900 goes before 1950
  assert.deepEqual([first.correct, first.gap, first.results], [true, 0, [true]]);
  assert.equal(G.place(puzzle, [], 1).correct, false);

  const second = G.place(puzzle, [true], 1); // 1975 dropped between 1900 and 1950: wrong, belongs last
  assert.deepEqual([second.correct, second.gap], [false, 2]);
  const rows = G.timeline(puzzle, second.results);
  assert.deepEqual(rows.map((r) => r.event.year), [1900, 1950, 1975]);
  assert.deepEqual(rows.map((r) => r.status), ['right', 'anchor', 'wrong']);
  assert.equal(G.currentEvent(puzzle, second.results).year, 1960);
});

test('a perfect game, a win with mistakes, and a loss on lives', () => {
  const perfect = play([true, true, true, true, true, true]);
  assert.deepEqual([G.isOver(perfect), G.isWon(perfect), G.isPerfect(perfect), G.score(perfect), G.livesLeft(perfect)], [true, true, true, 6, 3]);
  assert.equal(G.summary(perfect), '6/6');
  assert.deepEqual(G.timeline(puzzle, perfect).map((r) => r.event.year), [1800, 1900, 1950, 1955, 1960, 1975, 2000]);

  const scraped = play([false, true, false, true, true, true]);
  assert.deepEqual([G.isWon(scraped), G.isPerfect(scraped), G.score(scraped), G.mistakes(scraped), G.livesLeft(scraped)], [true, false, 4, 2, 1]);

  const lost = play([false, true, false, false]);
  assert.deepEqual([G.isOver(lost), G.isWon(lost), G.score(lost), G.livesLeft(lost)], [true, false, 1, 0]);
  assert.equal(G.currentEvent(puzzle, lost), null);
  assert.equal(G.place(puzzle, lost, 0).results, lost, 'no move after the game is over');
  const full = G.fullTimeline(puzzle, lost);
  assert.equal(full.length, 7);
  assert.equal(full.filter((r) => r.status === 'missed').length, 2);
  assert.deepEqual(full.map((r) => r.event.year), [1800, 1900, 1950, 1955, 1960, 1975, 2000]);

  const lastLife = play([true, true, true, false, false, false]);
  assert.deepEqual([G.isOver(lastLife), G.isWon(lastLife)], [true, false], 'the third mistake loses even on the last event');
});

test('saved results are cleaned before use', () => {
  assert.deepEqual(G.cleanResults(null), []);
  assert.deepEqual(G.cleanResults('junk'), []);
  assert.deepEqual(G.cleanResults([true, 'x', false]), [true]);
  assert.deepEqual(G.cleanResults([false, false, false, true, true]), [false, false, false]);
  assert.deepEqual(G.cleanResults([true, true, true, true, true, true, true]), [true, true, true, true, true, true]);
});

test('share text has the name, day, score, one square per event and the link, and nothing else', () => {
  const text = G.shareText({ day: 7, results: [true, false, true, true, true, true], url: 'https://example.test/games/tzir/' });
  assert.equal(text, 'על הציר #7 5/6\n🟩🟥🟩🟩🟩🟩\nhttps://example.test/games/tzir/');
  assert.equal(G.shareText({ day: 0, results: [false, true, false, false], url: 'u' }), 'על הציר #0 1/6\n🟥🟩🟥🟥⬜⬜\nu');
  assert.ok(!/\d{4}/.test(text.split('\n').slice(0, 2).join('')), 'no years');
});

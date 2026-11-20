import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games/mitchaze/game.js';
import { mulberry32, normalizeHebrew } from '../shared/core.js';

const ALL = G.PACKS.map((p) => p.id);

test('word packs: at least 10 packs of 50+, no duplicates anywhere, clean entries', () => {
  assert.deepEqual(G.validatePacks(), []);
  assert.ok(G.PACKS.length >= 10, `${G.PACKS.length} packs`);
  for (const pack of G.PACKS) {
    assert.ok(pack.words.length >= 50, `${pack.id} has ${pack.words.length} words`);
    assert.match(pack.name, /^[א-ת ]+$/, 'pack names are plain Hebrew');
    for (const word of pack.words) assert.match(word, /[א-ת]|^[A-Za-z0-9 ]+$/, word);
  }
  const all = G.PACKS.flatMap((p) => p.words.map(normalizeHebrew));
  assert.equal(new Set(all).size, all.length, 'every word is unique across the whole game');
  assert.equal(new Set(ALL).size, ALL.length);
  // A default player name must never be a possible secret word.
  for (let i = 0; i < G.MAX_PLAYERS; i++) assert.ok(!all.includes(normalizeHebrew(G.defaultName(i))));
});

test('validatePacks reports short packs, duplicates and malformed words', () => {
  const words = Array.from({ length: 50 }, (_, i) => `מילה ${i}`);
  assert.deepEqual(G.validatePacks([{ id: 'a', name: 'א', words }]), []);
  assert.equal(G.validatePacks([{ id: 'a', name: 'א', words: words.slice(0, 49) }]).length, 1);
  assert.equal(G.validatePacks([{ id: 'a', name: 'א', words: [...words, 'מילה  0'] }]).length, 1, 'double space is malformed');
  // Niqqud, final letters and punctuation do not make a word new.
  const twice = G.validatePacks([{ id: 'a', name: 'א', words: [...words, 'שלום'] }, { id: 'b', name: 'ב', words: [...words.map((w) => w + 'ב'), 'שלו"מ'] }]);
  assert.equal(twice.length, 1);
  assert.match(twice[0], /appears in a and b/);
  assert.ok(G.validatePacks([{ id: 'a', name: 'א', words }, { id: 'a', name: 'ב', words: words.map((w) => w + 'ב') }]).some((p) => p.includes('duplicate pack id')));
});

test('impostor limits: always a clear minority', () => {
  assert.deepEqual([3, 4, 5, 6, 7, 8, 12].map(G.maxImpostors), [1, 1, 2, 2, 3, 3, 3]);
  assert.equal(G.clampImpostors(3, 4), 1);
  assert.equal(G.clampImpostors(3, 6), 2);
  assert.equal(G.clampImpostors(2, 9), 2);
  assert.equal(G.clampImpostors(0, 9), 1);
  assert.equal(G.clampImpostors('x', 9), 1);
  for (let players = G.MIN_PLAYERS; players <= G.MAX_PLAYERS; players++) assert.ok(G.maxImpostors(players) * 2 < players);
});

test('dealing is deterministic for a seed and valid for every table size', () => {
  const deal = (seed, options = {}) => G.dealRound({ players: 6, impostors: 2, packIds: ALL, rng: mulberry32(seed), ...options });
  assert.deepEqual(deal(7), deal(7));
  assert.notDeepEqual(new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(deal(s)))).size, 1, 'different seeds give different deals');

  for (let players = G.MIN_PLAYERS; players <= G.MAX_PLAYERS; players++) {
    for (let impostors = 1; impostors <= 3; impostors++) {
      const round = G.dealRound({ players, impostors, packIds: ['food'], rng: mulberry32(players * 10 + impostors) });
      assert.equal(round.impostors.length, G.clampImpostors(impostors, players));
      assert.equal(new Set(round.impostors).size, round.impostors.length, 'impostors are distinct players');
      assert.ok(round.impostors.every((p) => Number.isInteger(p) && p >= 0 && p < players));
      assert.deepEqual(round.impostors, [...round.impostors].sort((a, b) => a - b));
      assert.ok(round.starter >= 0 && round.starter < players);
      assert.ok(G.PACKS.find((p) => p.id === 'food').words.includes(round.word));
      assert.equal(round.packId, 'food');
      assert.equal(round.packName, 'אוכל');
      assert.equal(G.isImpostor(round, round.impostors[0]), true);
      assert.equal(round.impostors.filter((p) => G.isImpostor(round, p)).length, round.impostors.length);
    }
  }
  assert.throws(() => G.dealRound({ players: 2, packIds: ALL }));
  assert.throws(() => G.dealRound({ players: 13, packIds: ALL }));
  assert.throws(() => G.dealRound({ players: 4, packIds: [] }));
});

test('dealing is fair: every seat is the impostor and the starter about equally often', () => {
  const rng = mulberry32(2026);
  const players = 5;
  const impostor = Array(players).fill(0);
  const starter = Array(players).fill(0);
  const rounds = 20000;
  for (let i = 0; i < rounds; i++) {
    const round = G.dealRound({ players, impostors: 1, packIds: ['animals'], rng });
    impostor[round.impostors[0]]++;
    starter[round.starter]++;
  }
  for (const count of [...impostor, ...starter]) assert.ok(Math.abs(count / rounds - 1 / players) < 0.015, `${count} of ${rounds}`);
});

test('the default generator is cryptographic and stays in range', () => {
  const original = globalThis.crypto.getRandomValues;
  let calls = 0;
  globalThis.crypto.getRandomValues = function (buffer) { calls++; return original.call(globalThis.crypto, buffer); };
  try {
    for (let i = 0; i < 200; i++) {
      const x = G.cryptoRandom();
      assert.ok(x >= 0 && x < 1);
    }
    G.dealRound({ players: 4, packIds: ALL });
  } finally {
    globalThis.crypto.getRandomValues = original;
  }
  assert.ok(calls > 200, 'dealRound draws from crypto.getRandomValues when no rng is injected');
  assert.equal(G.randomInt(5, () => 0.999999), 4);
  assert.equal(G.randomInt(5, () => 1), 4, 'a broken rng cannot index out of range');
  const input = [1, 2, 3, 4, 5];
  assert.deepEqual(G.shuffle(input, mulberry32(1)).sort(), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5], 'shuffle leaves its input alone');
});

test('words do not repeat within a session until the chosen packs run out', () => {
  const rng = mulberry32(5);
  const size = G.PACKS.find((p) => p.id === 'sports').words.length;
  const used = [];
  for (let i = 0; i < size; i++) {
    const picked = G.pickWord({ packIds: ['sports'], used, rng });
    assert.equal(picked.exhausted, false);
    assert.ok(!used.includes(picked.word), `${picked.word} repeated`);
    used.push(picked.word);
  }
  assert.equal(new Set(used).size, size);
  const again = G.pickWord({ packIds: ['sports'], used, rng });
  assert.equal(again.exhausted, true, 'the cycle restarts once everything was played');
  assert.notEqual(again.word, used[used.length - 1], 'and does not open with the word just played');
});

test('recently played words are avoided across visits, and never block the game', () => {
  const food = G.PACKS.find((p) => p.id === 'food').words;
  const recent = food.slice(0, food.length - 3);
  const rng = mulberry32(11);
  for (let i = 0; i < 50; i++) assert.ok(food.slice(-3).includes(G.pickWord({ packIds: ['food'], recent, rng }).word));

  // Everything was played lately: the game goes on with the words played longest ago.
  const oldest = new Set(food.slice(0, Math.ceil(food.length / 3)));
  for (let i = 0; i < 50; i++) {
    const picked = G.pickWord({ packIds: ['food'], recent: food, rng });
    assert.equal(picked.exhausted, false);
    assert.ok(oldest.has(picked.word));
  }
  // A word of this session is never chosen even when it is the only one not in `recent`.
  const picked = G.pickWord({ packIds: ['food'], used: [food[food.length - 1]], recent: food.slice(0, -1), rng });
  assert.notEqual(picked.word, food[food.length - 1]);

  assert.deepEqual(G.rememberWord(['א', 'ב'], 'ג'), ['א', 'ב', 'ג']);
  assert.deepEqual(G.rememberWord(['א', 'ב'], 'א'), ['ב', 'א'], 'a replayed word moves to the end');
  assert.deepEqual(G.rememberWord(['א', 'ב', 'ג'], 'ד', 3), ['ב', 'ג', 'ד']);
  assert.ok(G.RECENT_LIMIT < G.PACKS.reduce((n, p) => n + p.words.length, 0) / 2, 'memory never covers most of the list');
  assert.deepEqual(G.sanitizeRecent('junk'), []);
  assert.deepEqual(G.sanitizeRecent(['א', 5, '', null, 'ב']), ['א', 'ב']);
});

test('judging and scoring', () => {
  // One impostor (seat 2) among four.
  assert.deepEqual(G.judge({ players: 4, impostors: [2], accused: [2], guessedWord: false }),
    { caught: true, winner: 'civilians', reason: 'caught', points: [1, 1, 0, 1] });
  assert.deepEqual(G.judge({ players: 4, impostors: [2], accused: [2], guessedWord: true }),
    { caught: true, winner: 'impostors', reason: 'guessed', points: [0, 0, 1, 0] });
  assert.deepEqual(G.judge({ players: 4, impostors: [2], accused: [0], guessedWord: false }),
    { caught: false, winner: 'impostors', reason: 'escaped', points: [0, 0, 2, 0] });
  // A guess only counts after being caught.
  assert.equal(G.judge({ players: 4, impostors: [2], accused: [0], guessedWord: true }).reason, 'escaped');

  // Two impostors: both must be named.
  assert.equal(G.isCaught([1, 4], [4, 1]), true);
  assert.equal(G.isCaught([1, 4], [1, 2]), false);
  assert.equal(G.isCaught([1, 4], [1]), false);
  assert.deepEqual(G.judge({ players: 5, impostors: [1, 4], accused: [1, 2] }).points, [0, 2, 0, 0, 2]);
  assert.deepEqual(G.judge({ players: 5, impostors: [1, 4], accused: [4, 1] }).points, [1, 0, 1, 1, 0]);

  assert.deepEqual(G.addScores([3, 0, 1, 0], [1, 1, 0, 1]), [4, 1, 1, 1]);
  assert.deepEqual(G.addScores([], [0, 2, 0]), [0, 2, 0]);
  assert.deepEqual(G.ranking(['א', 'ב', 'ג'], [1, 3, 1]).map((r) => r.name), ['ב', 'א', 'ג']);
  assert.deepEqual(G.sanitizeScores([2, -1, 'x', 4.5, 7], 4), [2, 0, 0, 0]);
  assert.deepEqual(G.sanitizeScores(null, 3), [0, 0, 0]);
});

test('settings survive junk from storage', () => {
  const base = G.defaultSettings();
  assert.equal(base.names.length, G.DEFAULT_PLAYERS);
  assert.deepEqual(base.packs, ALL);
  assert.deepEqual(G.sanitizeSettings(null), base);
  assert.deepEqual(G.sanitizeSettings('x'), base);
  const s = G.sanitizeSettings({ names: ['  דנה  ', 'יוסי'], impostors: 3, packs: ['food', 'nope', 'food'], hint: 'yes', timer: 4 });
  assert.deepEqual(s.names, ['דנה', 'יוסי', ''], 'padded to the minimum table');
  assert.equal(s.impostors, 1, 'clamped to what three players allow');
  assert.deepEqual(s.packs, ['food']);
  assert.equal(s.hint, false);
  assert.equal(s.timer, base.timer);
  assert.equal(G.sanitizeSettings({ names: Array(20).fill('א') }).names.length, G.MAX_PLAYERS);
  assert.deepEqual(G.sanitizeSettings({ packs: [] }).packs, ALL, 'never an empty pack list');
  assert.deepEqual(G.sanitizeSettings({ names: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז'], impostors: 3, hint: true, timer: 0 }), {
    names: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז'], impostors: 3, packs: ALL, hint: true, timer: 0,
  });
});

test('names and small text helpers', () => {
  assert.deepEqual(G.resolveNames(['דנה', '', '  ']), ['דנה', 'שחקן 2', 'שחקן 3']);
  assert.equal(G.cleanName('  אבא   של   יוסי המלך הגדול '), 'אבא של יוסי המ');
  assert.equal(G.duplicateName(['דנה', 'יוסי', 'דנה ']), 'דנה');
  assert.equal(G.duplicateName(['', 'שחקן 1', 'x']), 'שחקן 1', 'a typed name can collide with a default one');
  assert.equal(G.duplicateName(['דנה', 'יוסי', '']), null);
  assert.equal(G.joinNames(['דנה']), 'דנה');
  assert.equal(G.joinNames(['דנה', 'יוסי']), 'דנה ויוסי');
  assert.equal(G.joinNames(['דנה', 'יוסי', 'מיכל']), 'דנה, יוסי ומיכל');
  assert.equal(G.formatClock(180), '3:00');
  assert.equal(G.formatClock(59.2), '1:00');
  assert.equal(G.formatClock(9), '0:09');
  assert.equal(G.formatClock(-4), '0:00');
  assert.equal(G.inviteText('https://example.org/games/mitchaze/'),
    'בואו לשחק המתחזה! טלפון אחד עובר בין כולם, כל אחד מקבל מילה סודית, ורק המתחזה לא יודע מה היא.\nhttps://example.org/games/mitchaze/');
});

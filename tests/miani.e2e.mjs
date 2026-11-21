// End-to-end test for מי אני?. The scenarios are shared with בלי מילים (tests/reveal-shared.mjs).
// Usage: node tests/miani.e2e.mjs   (or: npm run test:e2e -- miani)
import assert from 'node:assert/strict';
import * as G from '../games/miani/game.js';
import { revealScenarios } from './reveal-shared.mjs';

await revealScenarios({
  slug: 'miani',
  port: 4182,
  G,
  stage: {
    /** The first `opened` clues are written in; the rest are blank lines. */
    async checkOpened(page, puzzle, opened) {
      assert.equal(await page.locator('#stage .clue').count(), 5);
      const open = await page.locator('#stage .clue:not(.locked) .clue-text').allInnerTexts();
      assert.deepEqual(open, puzzle.clues.slice(0, opened));
      const html = await page.locator('#stage').innerHTML();
      for (const clue of puzzle.clues.slice(opened)) assert.ok(!html.includes(clue), 'a locked clue is not in the page');
    },
  },
});

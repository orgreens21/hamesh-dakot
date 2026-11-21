// End-to-end test for בלי מילים. The scenarios are shared with מי אני? (tests/reveal-shared.mjs).
// Usage: node tests/blimilim.e2e.mjs   (or: npm run test:e2e -- blimilim)
import assert from 'node:assert/strict';
import * as G from '../games/blimilim/game.js';
const { emojiOpen, hintOpen } = G;
import { revealScenarios } from './reveal-shared.mjs';

await revealScenarios({
  slug: 'blimilim',
  port: 4183,
  G,
  stage: {
    /** Three emoji on the first stage, one more per stage, and the hint on the last. */
    async checkOpened(page, puzzle, opened) {
      assert.equal(await page.locator('#stage .emo').count(), 6);
      const shown = emojiOpen(opened);
      assert.deepEqual(await page.locator('#stage .emo:not(.shut)').allInnerTexts(), puzzle.emoji.slice(0, shown));
      const text = await page.locator('#stage').innerText();
      for (const e of puzzle.emoji.slice(shown)) if (!puzzle.emoji.slice(0, shown).includes(e)) assert.ok(!text.includes(e), 'a hidden emoji is not in the page');
      assert.equal(text.includes(puzzle.hint), hintOpen(opened));
    },
  },
});

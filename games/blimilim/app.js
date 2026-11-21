// Interface for בלי מילים. Everything but the emoji strip is shared with מי אני? (shared/reveal-ui.js).
import G, { kicker, emojiOpen, hintOpen, FIRST } from './game.js';
import { html } from '../../shared/ui.js';
import { mountRevealGame } from '../../shared/reveal-ui.js';

/** Six tiles in a row, face down until their stage, and the written hint under them. */
function drawStage(container, puzzle, opened) {
  const shown = emojiOpen(opened);
  const row = html('ul', 'emoji-row');
  row.setAttribute('aria-label', `${shown} סמלים מתוך 6`);
  puzzle.emoji.forEach((symbol, i) => {
    const open = i < shown;
    const tile = html('li', open ? 'emo' : 'emo shut', open ? symbol : '?');
    // The first three open together on stage one; each one after that is its own stage.
    tile.dataset.stage = Math.max(0, i - FIRST + 1);
    if (!open) tile.setAttribute('aria-hidden', 'true');
    row.append(tile);
  });
  const hint = html('p', hintOpen(opened) ? 'hint' : 'hint shut');
  hint.dataset.stage = G.STEPS - 1;
  if (hintOpen(opened)) hint.append(html('span', 'hint-label', 'רמז'), puzzle.hint);
  else hint.textContent = 'בשלב האחרון יופיע כאן רמז במילים';
  container.replaceChildren(row, hint);
}

mountRevealGame({
  slug: 'blimilim',
  G,
  drawStage,
  kicker,
  answerNote: (puzzle) => puzzle.hint,
  words: {
    none: 'אין כזה ברשימה. נסו לכתוב אחרת',
    pick: 'בחרו שם מהרשימה',
    skip: 'עוד סמל',
    giveUp: 'גלו לי את התשובה',
  },
});

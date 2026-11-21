// Interface for מי אני?. Everything but the clue list is shared with בלי מילים (shared/reveal-ui.js).
import G, { kicker } from './game.js';
import { html } from '../../shared/ui.js';
import { mountRevealGame } from '../../shared/reveal-ui.js';

/** One numbered line per open clue; the rest stay as blank lines still to come. */
function drawStage(container, puzzle, opened) {
  container.replaceChildren();
  puzzle.clues.forEach((clue, i) => {
    const open = i < opened;
    const li = html('li', open ? 'clue' : 'clue locked');
    li.dataset.stage = i;
    li.append(html('span', 'clue-n', String(i + 1)));
    li.append(html('span', 'clue-text', open ? clue : ''));
    // A locked line is only a blank to be filled, so screen readers skip it.
    if (!open) li.setAttribute('aria-hidden', 'true');
    container.append(li);
  });
}

mountRevealGame({
  slug: 'miani',
  G,
  drawStage,
  kicker,
  words: {
    none: 'אין כזה ברשימה. נסו לכתוב אחרת',
    pick: 'בחרו תשובה מהרשימה',
    skip: 'רמז נוסף',
    giveUp: 'גלו לי את התשובה',
  },
});

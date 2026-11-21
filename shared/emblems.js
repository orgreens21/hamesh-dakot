// The seven game emblems: small layered drawings that hint at each game's mechanic.
// Every emblem is three SVG layers on a 96×96 grid, stacked at different depths, so a tilted
// emblem shows real parallax (styles: .emblem in shared/base.css). Colours come from the
// game's accent through the .em-* classes, so an emblem needs data-game on itself or above it.
//
//   import { emblem } from '../../shared/emblems.js';
//   node.append(emblem('nekuda'));            // 64px; set --emblem-size on it or a parent to resize
//
// The drawing data is pure strings, so Node can import this file; emblem() itself needs a DOM.

const TAG = 'M38 30h38a7 7 0 0 1 7 7v26a7 7 0 0 1-7 7H38L17 50Z';
const TURN = 'rotate(-14 48 50)';
const UP = 'M66 9 87 34H75.5v25h-19V34H45Z';
const DOWN = 'M30 87 9 62h11.5V37h19v25H51Z';
const PIN = 'M48 71C41 57 28 49 28 34a20 20 0 0 1 40 0c0 15-13 23-20 37Z';


export const EMBLEMS = {
  // A map pin standing in the middle of distance rings.
  nekuda: [
    `<ellipse class="em-la" cx="48" cy="71" rx="41" ry="15" stroke-dasharray=".1 6.5" stroke-width="2.6"/><ellipse class="em-la" cx="48" cy="71" rx="28" ry="10.5" opacity=".6"/><ellipse class="em-sh" cx="55" cy="73" rx="13" ry="4.5"/>`,
    `<ellipse class="em-la" cx="48" cy="71" rx="14" ry="5.2" stroke-width="2.6"/>`,
    `<path class="em-d" d="${PIN}" transform="translate(2.5 1)"/><path class="em-a" d="${PIN}"/><circle class="em-s" cx="48" cy="34" r="8"/><path class="em-ls" d="M35 28a14 14 0 0 1 8-8" opacity=".55" stroke-width="2.6"/>`,
  ],
  // A price tag on a string, marked "roughly".
  beerech: [
    `<path class="em-l" d="M31 54C24 47 17 35 13 17" stroke-width="1.8"/><g transform="${TURN}"><path class="em-sh" d="${TAG}" transform="translate(5 7)"/></g>`,
    `<g transform="${TURN}"><path class="em-d" d="${TAG}" transform="translate(0 3)"/><path class="em-a" d="${TAG}"/><path class="em-ls" d="M41 35.5h34.5a2 2 0 0 1 2 2v25a2 2 0 0 1-2 2H41L26 50Z" stroke-width="1.3" stroke-dasharray="3 3.5" opacity=".55"/><circle class="em-s" cx="31" cy="50" r="4.2"/></g>`,
    `<g transform="${TURN}"><path class="em-ls" stroke-width="5" d="M46.5 45c4-4.5 8-4.5 12 0s8 4.5 12 0M46.5 56.5c4-4.5 8-4.5 12 0s8 4.5 12 0"/></g>`,
  ],
  // An index card of clue lines, and the question it asks.
  miani: [
    `<rect class="em-sh" x="20" y="22" width="52" height="64" rx="5" transform="rotate(-9 46 54)"/><rect class="em-s em-o" x="16" y="16" width="52" height="64" rx="5" transform="rotate(-9 42 48)"/>`,
    `<rect class="em-d" x="26" y="19" width="52" height="64" rx="5"/><rect class="em-a" x="26" y="16" width="52" height="64" rx="5"/><path class="em-ls" d="M34 30h36M34 40h28M34 50h32M34 60h18" stroke-width="3"/>`,
    `<circle class="em-sh" cx="71" cy="72" r="15"/><circle class="em-s em-o" cx="68" cy="67" r="15"/><path class="em-la" d="M63 63a5 5 0 1 1 7 4.6c-1.4.7-2 1.6-2 3" stroke-width="3"/><circle class="em-a" cx="68" cy="75.5" r="2.1"/>`,
  ],
  // Events on a time axis; the middle one is being put in its place.
  tzir: [
    `<path class="em-l" d="M7 68h83M13 62l-6 6 6 6M22 64v8M48 64v8M74 64v8" stroke-width="2.4"/>`,
    `<path class="em-l" d="M22 56v8M74 56v8" stroke-width="1.6"/><rect class="em-s em-o" x="10" y="33" width="24" height="24" rx="3.5"/><rect class="em-s em-o" x="62" y="33" width="24" height="24" rx="3.5"/><path class="em-la" d="M15 41h14M15 48h8M67 41h14M67 48h8" stroke-width="2.2"/>`,
    `<path class="em-la" d="M48 46v14" stroke-width="2" stroke-dasharray="2 3.5"/><rect class="em-d" x="35" y="15" width="26" height="30" rx="4"/><rect class="em-a" x="35" y="12" width="26" height="30" rx="4"/><path class="em-ls" d="M40.5 20.5h15M40.5 27h15M40.5 33.5h8" stroke-width="2.3"/><circle class="em-a" cx="48" cy="68" r="5.5" stroke="var(--sheet)" stroke-width="2"/>`,
  ],
  // A board of roads, three across and three down; a sticker has just landed on one junction.
  herkev: [
    `<rect class="em-sh" x="15" y="20" width="72" height="68" rx="6"/><rect class="em-d" x="12" y="15" width="72" height="68" rx="6"/><rect class="em-a" x="12" y="12" width="72" height="68" rx="6"/><g class="em-ls" stroke-width="1.7" opacity=".75"><path d="M12 28h72M12 46h72M12 64h72M28 12v68M48 12v68M68 12v68"/></g>`,
    `<circle class="em-s em-o" cx="28" cy="28" r="6"/><circle class="em-s em-o" cx="68" cy="46" r="6"/><circle class="em-s em-o" cx="28" cy="64" r="6"/>`,
    `<rect class="em-sh" x="40" y="58" width="22" height="22" rx="3" transform="rotate(-8 51 69)"/><rect class="em-s em-o" x="37" y="53" width="22" height="22" rx="3" transform="rotate(-8 48 64)"/><path class="em-la" d="m42 64 4.5 4.5 8-9" stroke-width="2.8" transform="rotate(-8 48 64)"/>`,
  ],
  // Higher or lower: one arrow up, one arrow down.
  yoter: [
    `<path class="em-sh" d="${UP}" transform="translate(5 8)"/><path class="em-sh" d="${DOWN}" transform="translate(4 5)"/>`,
    `<path class="em-i" d="${DOWN}" transform="translate(0 3)" opacity=".55"/><path class="em-s em-o" d="${DOWN}" stroke-linejoin="round"/>`,
    `<path class="em-d" d="${UP}" transform="translate(0 3.5)"/><path class="em-a" d="${UP}"/>`,
  ],
  // Picture tiles: one face down, one smiling up at you.
  blimilim: [
    `<rect class="em-sh" x="13" y="42" width="30" height="30" rx="6"/><rect class="em-s em-o" x="8" y="33" width="30" height="30" rx="6" transform="rotate(-10 23 48)"/><path class="em-l" d="M17 52c3 2.5 7 2.5 10 0M18 44h.1M27 44h.1" stroke-width="3" transform="rotate(-10 23 48)"/>`,
    `<rect class="em-d" x="58" y="34" width="30" height="30" rx="6" transform="rotate(9 73 49)"/><rect class="em-a" x="58" y="30" width="30" height="30" rx="6" transform="rotate(9 73 45)"/><path class="em-ls" d="M69 41a4 4 0 1 1 5.5 3.7c-1 .5-1.5 1.2-1.5 2.3M73 52.5h.1" stroke-width="2.8" transform="rotate(9 73 45)"/>`,
    `<rect class="em-sh" x="34" y="40" width="34" height="34" rx="7"/><rect class="em-d" x="31" y="35" width="34" height="34" rx="7"/><rect class="em-s em-o" x="31" y="31" width="34" height="34" rx="7"/><circle class="em-a" cx="42" cy="44" r="3"/><circle class="em-a" cx="54" cy="44" r="3"/><path class="em-la" d="M40 53c4.5 4.5 11.5 4.5 16 0" stroke-width="3"/>`,
  ],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The emblem for a game as an element: <span class="emblem" data-emblem data-game>. Decorative (aria-hidden). */
export function emblem(slug) {
  const root = document.createElement('span');
  root.className = 'emblem';
  root.dataset.emblem = slug;
  root.dataset.game = slug;
  root.setAttribute('aria-hidden', 'true');
  const stage = document.createElement('span');
  stage.className = 'emblem-stage';
  (EMBLEMS[slug] || []).forEach((drawing, depth) => {
    const layer = document.createElementNS(SVG_NS, 'svg');
    layer.setAttribute('viewBox', '0 0 96 96');
    layer.setAttribute('class', `emblem-layer l${depth}`);
    layer.style.setProperty('--z', depth);
    layer.innerHTML = drawing;
    stage.append(layer);
  });
  root.append(stage);
  return root;
}

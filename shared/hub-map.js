// The hub's illustrated map: a friendly outline of the country, drawn once into an <svg>.
// Geography follows games/nekuda/mapshapes.js (the coast, lakes and river are the same traced
// points, thinned a little) and covers the same extent as the nekuda map. One outline, no inner lines.

// Equirectangular, squeezed east-west for Israel's latitude, like the nekuda map.
const VIEW = { north: 33.5, south: 29.36, west: 33.95, east: 36.05, squeeze: 0.8535, scale: 100 };
export const MAP_W = (VIEW.east - VIEW.west) * VIEW.scale * VIEW.squeeze;
export const MAP_H = (VIEW.north - VIEW.south) * VIEW.scale;

/** [lat, lon] to map units. */
export const project = ([lat, lon]) => [(lon - VIEW.west) * VIEW.scale * VIEW.squeeze, (VIEW.north - lat) * VIEW.scale];
/** [lat, lon] to percentages of the map box, for placing HTML over it. */
export const toPercent = (p) => { const [x, y] = project(p); return [(x / MAP_W) * 100, (y / MAP_H) * 100]; };

// Clockwise from Rosh HaNikra: east along the north, down the Jordan valley and the Arava, round the
// head of the gulf, up to the coast at Rafah, then north along the Mediterranean.
const LAND = [
  [33.093, 35.105], [33.08, 35.22], [33.06, 35.33], [33.1, 35.45], [33.13, 35.53], [33.27, 35.57], [33.29, 35.63],
  [33.27, 35.68], [33.33, 35.79], [33.25, 35.84], [33.1, 35.86], [32.93, 35.87], [32.79, 35.83], [32.7, 35.75],
  [32.68, 35.64], [32.55, 35.585], [32.3, 35.58], [32.05, 35.56], [31.85, 35.57], [31.72, 35.59], [31.55, 35.6],
  [31.38, 35.56], [31.2, 35.48], [31.0, 35.46], [30.8, 35.34], [30.5, 35.18], [30.15, 35.15], [29.85, 35.07],
  [29.6, 35.0], [29.548, 34.982], [29.556, 34.955], [29.51, 34.915], [29.49, 34.895], [29.75, 34.8],
  [30.05, 34.71], [30.35, 34.59], [30.65, 34.49], [30.88, 34.42], [31.1, 34.32], [31.25, 34.265], [31.31, 34.22],
  // Mediterranean coast, south to north (games/nekuda/mapshapes.js MED_COAST, reversed)
  [31.32, 34.23], [31.53, 34.43], [31.68, 34.545], [31.82, 34.63], [31.93, 34.69], [32.05, 34.745],
  [32.17, 34.795], [32.33, 34.845], [32.5, 34.885], [32.7, 34.93], [32.8, 34.953], [32.824, 34.97],
  [32.826, 35.025], [32.85, 35.065], [32.88, 35.075], [32.93, 35.06], [33.01, 35.075],
];

const KINNERET = [[32.905, 35.6], [32.88, 35.63], [32.83, 35.64], [32.78, 35.63], [32.73, 35.61], [32.705, 35.585], [32.73, 35.565], [32.78, 35.545], [32.83, 35.52], [32.87, 35.535], [32.895, 35.57]];
const DEAD_SEA = [[31.76, 35.51], [31.7, 35.46], [31.6, 35.42], [31.5, 35.405], [31.4, 35.395], [31.3, 35.4], [31.22, 35.39], [31.1, 35.39], [31.04, 35.415], [31.06, 35.455], [31.24, 35.445], [31.33, 35.5], [31.45, 35.55], [31.6, 35.565], [31.74, 35.555]];
const JORDAN = [[32.705, 35.585], [32.6, 35.57], [32.4, 35.565], [32.2, 35.552], [32.0, 35.535], [31.85, 35.545], [31.76, 35.53]];

const f = (n) => n.toFixed(1);

/** A smooth curve through the points (Catmull-Rom as cubic Béziers). */
function smooth(points, closed) {
  const p = points.map(project);
  const n = p.length;
  const at = (i) => (closed ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}

const at = (p) => project(p).map(f).join(' ');

// Small illustrated things on the map. Each is a template placed at a [lat, lon].
const wave = (p) => `<path class="m-wave" transform="translate(${at(p)})" d="M-5 0q2.5-2.4 5 0t5 0"/>`;
const tree = (p, r = 2.6) => `<circle class="m-tree" transform="translate(${at(p)})" r="${r}"/>`;
const hill = (p, s = 1) => `<path class="m-hill" transform="translate(${at(p)}) scale(${s})" d="M-7 0q3.5-7.5 7-1.5q3-5 7 1.5"/>`;
const palm = (p) => `<g class="m-palm" transform="translate(${at(p)})"><path class="m-trunk" d="M0 0q.6-4 -.4-8"/><path class="m-leaf" d="M-.4-8q-3.4-1.6-5.4 1M-.4-8q3.4-1.6 5.4 1M-.4-8q-1.6-2.8-4.4-2.6M-.4-8q1.8-2.8 4.6-2.2"/></g>`;
const dune = (p) => `<path class="m-dune" transform="translate(${at(p)})" d="M-6 0q3-3 6 0t6 0"/>`;

const BOAT = (p) => `<g class="m-boat" transform="translate(${at(p)})"><path class="m-sail" d="M0-1V-12L6.5-2.4Z"/><path class="m-sail2" d="M-1-2.4V-9L-5-2.4Z"/><path class="m-hull" d="M-7-1H8.5L6 2.6H-4.6Z"/></g>`;
const COMPASS = (p) => `<g class="m-compass" transform="translate(${at(p)})"><circle r="7.5"/><path d="M0-5.5 2.4 1.6 0 .4-2.4 1.6Z"/><text y="-9.5" text-anchor="middle">צ</text></g>`;
const SUN = (p) => `<g class="m-sun" transform="translate(${at(p)})"><circle r="6"/><path d="M0-9.5v-3M0 9.5v3M-9.5 0h-3M9.5 0h3M-6.7-6.7l-2.1-2.1M6.7 6.7l2.1 2.1M-6.7 6.7l-2.1 2.1M6.7-6.7l2.1-2.1"/></g>`;
const MOON = (p) => `<g class="m-moon" transform="translate(${at(p)})"><path d="M2.5-7.2a7.6 7.6 0 1 0 4.9 11.4A6.2 6.2 0 0 1 2.5-7.2Z"/><circle class="m-star" cx="-12" cy="-4" r=".9"/><circle class="m-star" cx="9" cy="-10" r=".7"/><circle class="m-star" cx="-6" cy="11" r=".7"/></g>`;
// Makhtesh Ramon: an erosion crater, drawn as a long oval rim.
const CRATER = (p) => `<g class="m-crater" transform="translate(${at(p)}) rotate(-38)"><ellipse rx="15" ry="4.6"/><ellipse class="m-crater-floor" rx="11" ry="2.5"/></g>`;

const DECOR = [
  // the Mediterranean
  wave([33.2, 34.62]), wave([32.95, 34.3]), wave([32.62, 34.56]), wave([32.3, 34.2]), wave([31.95, 34.42]),
  wave([31.7, 34.06]), wave([31.45, 34.16]), BOAT([32.42, 34.42]), COMPASS([33.33, 34.26]),
  // the Red Sea, below Eilat
  wave([29.43, 34.93]),
  // the north: woods and hills
  tree([33.02, 35.3]), tree([32.98, 35.4], 2.2), tree([33.04, 35.47], 1.8), tree([32.72, 35.04], 2.2), tree([32.67, 35.08], 1.7),
  tree([33.08, 35.72], 2), hill([32.93, 35.22], 0.9), hill([32.62, 35.35], 0.8),
  // the middle
  hill([31.66, 35.05], 1), hill([31.55, 35.14], 0.8), tree([32.25, 35.2], 1.8), palm([31.47, 35.36]),
  // the Negev
  dune([31.02, 34.48]), dune([30.94, 34.6]), CRATER([30.6, 34.85]), hill([30.25, 34.97], 0.9),
  palm([30.08, 35.09]), palm([29.72, 35.03]), dune([29.95, 34.86]),
];

/**
 * Draws the map into the svg and returns nothing. The trail is drawn separately (drawTrail), because
 * it depends on today's stops.
 */
export function drawMap(svgEl) {
  svgEl.setAttribute('viewBox', `0 0 ${f(MAP_W)} ${f(MAP_H)}`);
  const land = smooth(LAND, true);
  svgEl.innerHTML =
    SUN([33.38, 34.62]) + MOON([33.38, 34.62]) +
    `<path class="m-land-shadow" d="${land}" transform="translate(1.3 2)"/>` +
    `<path class="m-land" d="${land}"/>` +
    `<path class="m-river" d="${smooth(JORDAN, false)}"/>` +
    `<path class="m-lake" d="${smooth(KINNERET, true)}"/><path class="m-lake" d="${smooth(DEAD_SEA, true)}"/>` +
    `<path class="m-lake-wave" d="M${at([32.82, 35.565]).replace(' ', ',')}q1.4-1.3 2.8 0t2.8 0"/>` +
    `<path class="m-lake-wave" d="M${at([31.5, 35.455]).replace(' ', ',')}q1.2-1.2 2.4 0t2.4 0"/>` +
    DECOR.join('') +
    '<g class="m-trail-layer"></g>';
}

/**
 * The dotted trail through today's stops, in order, and a fainter dashed leg to the party stop.
 * Each path is revealed by a mask so the dots appear to be drawn in.
 */
export function drawTrail(svgEl, stops, partyStop) {
  const layer = svgEl.querySelector('.m-trail-layer');
  const trail = smoothOpen(stops);
  const leg = partyStop ? smoothOpen([stops.at(-1), partyStop]) : '';
  layer.innerHTML =
    `<mask id="trail-mask" maskUnits="userSpaceOnUse"><path class="m-trail-reveal" d="${trail}" pathLength="1"/></mask>` +
    `<path class="m-trail-under" d="${trail}"/>` +
    `<path class="m-trail" d="${trail}" mask="url(#trail-mask)"/>` +
    (leg ? `<path class="m-leg" d="${leg}"/>` : '');
}

// A trail between stops: a gentle S-bend between each pair, so it wanders like a path, not a ruler line.
function smoothOpen(stops) {
  const pts = stops.map(project);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const bend = (i % 2 ? 1 : -1) * Math.min(14, Math.abs(y1 - y0) * 0.35);
    d += `C${f(x0 + bend)},${f(y0 + (y1 - y0) * 0.4)} ${f(x1 - bend)},${f(y1 - (y1 - y0) * 0.4)} ${f(x1)},${f(y1)}`;
  }
  return d;
}

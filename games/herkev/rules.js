// What a criterion means and when a grid is fair. No data and no DOM in here: the page (game.js)
// and the data builder (build-data.mjs) both import it, so they can never disagree about an answer.

export const SIZE = 3;
export const CELLS = SIZE * SIZE;

/** Does the item satisfy one criterion? Items are { id, name, crits: Set of criterion ids, … }. */
export const matches = (item, criterionId) => item.crits.has(criterionId);

/** A grid is { topic, rows: [3 ids], cols: [3 ids] }; cell n sits in row floor(n / 3), column n % 3. */
export const cellCriteria = (grid, cell) => [grid.rows[Math.floor(cell / SIZE)], grid.cols[cell % SIZE]];

/** Every item that fits a cell, in the order of the list given (the data files are sorted best-known first). */
export function validItems(items, grid, cell) {
  const [row, col] = cellCriteria(grid, cell);
  return items.filter((item) => item.crits.has(row) && item.crits.has(col));
}

/**
 * One item per cell, all different, or null when that cannot be done.
 * `candidates` is one array of items per cell. Plain augmenting-path matching: nine cells is tiny.
 */
export function assignDistinct(candidates) {
  const owner = new Map(); // item id -> cell
  const chosen = Array(candidates.length).fill(null);
  const place = (cell, seen) => {
    for (const item of candidates[cell]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const holder = owner.get(item.id);
      if (holder === undefined || place(holder, seen)) {
        owner.set(item.id, cell);
        chosen[cell] = item;
        return true;
      }
    }
    return false;
  };
  for (let cell = 0; cell < candidates.length; cell++) {
    if (!place(cell, new Set())) return null;
  }
  return chosen;
}

/** How many criteria two grids have in common, wherever they sit. */
export function sharedCriteria(a, b) {
  const mine = new Set([...a.rows, ...a.cols]);
  return [...b.rows, ...b.cols].filter((id) => mine.has(id)).length;
}

/** The nine row×column pairs of a grid as order-independent keys, to spot a cell that comes back. */
export function cellPairs(grid) {
  const pairs = [];
  for (const row of grid.rows) for (const col of grid.cols) pairs.push([row, col].sort().join('|'));
  return pairs;
}

/** Turns a data file's rows ([id, name, criterion indexes, aliases?, hint?]) into items. */
export function itemsFromRows(criteria, rows) {
  return rows.map(([id, name, crits, aliases = [], hint = '']) => ({
    id, name, crits: new Set(crits.map((i) => criteria[i])), aliases, hint,
  }));
}

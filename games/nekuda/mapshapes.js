// Simplified water outlines for the game map, as [lat, lon] points (north to south for the coast).
// Hand-traced at roughly 1 km precision; tests check that no locality falls in the water.

export const MED_COAST = [
  [33.4, 35.25], [33.27, 35.19], [33.09, 35.1], [33.01, 35.075], [32.93, 35.06], [32.88, 35.075], [32.85, 35.065],
  [32.826, 35.025], [32.824, 34.97], [32.8, 34.953], [32.7, 34.93], [32.5, 34.885], [32.33, 34.845], [32.17, 34.795],
  [32.08, 34.755], [32.05, 34.745], [31.93, 34.69], [31.82, 34.63], [31.68, 34.545], [31.53, 34.43], [31.32, 34.23], [31.29, 34.2],
];

export const LAKES = [
  // Sea of Galilee
  [[32.905, 35.6], [32.88, 35.63], [32.83, 35.64], [32.78, 35.63], [32.73, 35.61], [32.705, 35.585], [32.73, 35.565],
    [32.78, 35.545], [32.83, 35.52], [32.87, 35.535], [32.895, 35.57]],
  // Dead Sea, northern basin
  [[31.76, 35.51], [31.7, 35.46], [31.6, 35.42], [31.5, 35.405], [31.4, 35.395], [31.3, 35.4], [31.27, 35.43],
    [31.33, 35.5], [31.45, 35.55], [31.6, 35.565], [31.74, 35.555]],
  // Dead Sea, southern basin
  [[31.22, 35.385], [31.22, 35.44], [31.05, 35.455], [31.03, 35.41], [31.1, 35.385]],
  // Gulf of Eilat
  [[29.54, 34.965], [29.535, 34.995], [29.4, 34.975], [29.4, 34.85], [29.48, 34.905]],
];

export const JORDAN_RIVER = [[32.705, 35.585], [32.6, 35.57], [32.4, 35.565], [32.2, 35.555], [32.0, 35.535], [31.85, 35.545], [31.76, 35.53]];

/** Longitude of the Mediterranean coast at a latitude, or null outside the traced range. */
export function coastLonAt(lat) {
  for (let i = 0; i < MED_COAST.length - 1; i++) {
    const [la1, lo1] = MED_COAST[i];
    const [la2, lo2] = MED_COAST[i + 1];
    if (lat <= la1 && lat >= la2) return lo1 + ((la1 - lat) / (la1 - la2)) * (lo2 - lo1);
  }
  return null;
}

export function pointInPolygon(lat, lon, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

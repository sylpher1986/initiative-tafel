// Inn the Grid (G4, WP56): rasterwiskunde, puur (geen DOM, Node-testbaar). Kaarteenheid: 1 cel = 1 eenheid (vierkant:
// zijde), oorsprong linksboven van cel (0,0), x naar rechts, y naar beneden (docs/g4-inn-the-grid.md §2.3).
// WP56 alleen vierkant; hex volgt in WP57 met dezelfde functienamen.

/** Grenzen van een kaart (D10 voorstel; bijstellen na WP66) */
export const LIMITS = { minCells: 1, maxCells: 100 };

/** Nieuw vierkant raster. cols/rows worden gehele getallen binnen LIMITS. */
export function squareGrid(cols = 20, rows = 15) {
  const n = (v, d) => Math.min(LIMITS.maxCells, Math.max(LIMITS.minCells, Math.round(Number.isFinite(+v) ? +v : d)));
  return { type: "square", cols: n(cols, 20), rows: n(rows, 15) };
}

/** Cel onder een kaartpunt: { c, r } (ook buiten de kaart, ook negatief). Een punt op een lijn hoort bij de cel
 *  rechts/onder ervan (halfopen [c, c+1)). */
export const cellAt = (grid, x, y) => ({ c: Math.floor(x), r: Math.floor(y) });

/** Rechthoek van een cel in kaarteenheden */
export const cellRect = (grid, c, r) => ({ x: c, y: r, w: 1, h: 1 });

/** Ligt cel (c, r) op de kaart? */
export const inside = (grid, c, r) => Number.isInteger(c) && Number.isInteger(r) && c >= 0 && r >= 0 && c < grid.cols && r < grid.rows;

/** Hele kaart in kaarteenheden */
export const bounds = (grid) => ({ x: 0, y: 0, w: grid.cols, h: grid.rows });

/** Culling: welke rasterlijnen vallen in een kaartrechthoek (de zichtbare viewport)? Begrensd tot de kaart; leeg
 *  (c0 > c1 of r0 > r1) als de kaart helemaal buiten beeld is. Lijnen, niet cellen: lijn i ligt op x = i (0…cols). */
export function visibleLines(grid, rect) {
  const lo = (v, max) => Math.max(0, Math.min(max, Math.ceil(v)));
  const hi = (v, max) => Math.max(0, Math.min(max, Math.floor(v)));
  const c0 = lo(rect.x, grid.cols), c1 = hi(rect.x + rect.w, grid.cols);
  const r0 = lo(rect.y, grid.rows), r1 = hi(rect.y + rect.h, grid.rows);
  const out = rect.x > grid.cols || rect.y > grid.rows || rect.x + rect.w < 0 || rect.y + rect.h < 0;
  return out ? { c0: 1, c1: 0, r0: 1, r1: 0 } : { c0, c1, r0, r1 };
}

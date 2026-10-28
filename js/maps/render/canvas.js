// Inn the Grid (G4, WP56): tekenen op één canvas ter grootte van het scherm. Render past nooit data aan; hij krijgt de
// kaart en de view en tekent. Lijnen in apparaatpixels (setTransform 1:1, crisp) zodat ze scherp blijven op DPR 1/2/3.
// Culling: alleen rasterlijnen/cellen in beeld (visibleLines, visibleCells). Kleuren uit de tokens van css/app.css (licht
// en donker); de rasterkleur is een id uit een vaste set (WP57): "auto" = lijnkleur van het thema, de rest vast (merkpalet),
// want het raster ligt later ook over een achtergrondafbeelding en moet daar per kaart passen, niet per thema.
import { bounds, visibleLines, visibleCells, cellCenter, cellPoly, HEX_R } from "../model/grid.js";
import { CELL, toScreen, visibleRect, crisp } from "../model/view.js";

/** Kleuren uit de CSS-tokens (opnieuw lezen bij een themawissel) */
export function readColors(el = document.documentElement) {
  const cs = getComputedStyle(el), v = (k, d) => cs.getPropertyValue(k).trim() || d;
  return { page: v("--sunk", "#f2ebdc"), map: v("--card", "#fffbf3"), line: v("--line-strong", "#8c7d6b"), edge: v("--fg", "#241811") };
}

/** Vaste rasterkleuren (merkpalet: Walnut, Warm Ivory, Lantern); "auto" komt uit readColors */
const FIXED = { dark: "#241811", light: "#faf6ec", gold: "#e3a83b" };
export const gridColor = (id, col) => FIXED[id] || col.line;

/** Canvas op de juiste apparaatgrootte zetten: { w, h } in CSS-px, dpr; geeft true als er iets veranderde */
export function fitCanvas(cv, w, h, dpr) {
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
  if (cv.width === W && cv.height === H) return false;
  cv.width = W; cv.height = H;
  return true;
}

/** Kaart tekenen. map = { grid }, v = view, w/h = CSS-grootte, dpr, col = readColors() */
export function draw(cv, map, v, w, h, dpr, col) {
  const g = cv.getContext("2d"), grid = map.grid, b = bounds(grid);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = col.page;
  g.fillRect(0, 0, cv.width, cv.height);
  const p0 = toScreen(v, b.x, b.y), p1 = toScreen(v, b.x + b.w, b.y + b.h);
  const X0 = Math.round(p0.x * dpr), Y0 = Math.round(p0.y * dpr), X1 = Math.round(p1.x * dpr), Y1 = Math.round(p1.y * dpr);
  g.fillStyle = col.map;
  g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  if (grid.show) {
    g.beginPath();
    if (grid.type === "hex") hexPath(g, grid, v, w, h, dpr);
    else squarePath(g, grid, v, w, h, dpr, { top: Math.max(Y0, 0), bot: Math.min(Y1, cv.height), left: Math.max(X0, 0), right: Math.min(X1, cv.width) });
    g.globalAlpha = grid.alpha / 100;
    g.lineWidth = 1;
    g.strokeStyle = gridColor(grid.color, col);
    g.stroke();
    g.globalAlpha = 1;
  }
  // kaartrand: 2 apparaatpixels binnen de kaart (hele pixels, dus scherp)
  const e = Math.max(2, Math.round(dpr * 1.5));
  g.strokeStyle = col.edge;
  g.lineWidth = e;
  g.strokeRect(X0 + e / 2, Y0 + e / 2, X1 - X0 - e, Y1 - Y0 - e);
}

// Vierkant: binnenlijnen van de kaart, alleen het zichtbare deel (de rand tekent de kaartrand)
function squarePath(g, grid, v, w, h, dpr, { top, bot, left, right }) {
  const L = visibleLines(grid, visibleRect(v, w, h));
  for (let c = Math.max(L.c0, 1); c <= Math.min(L.c1, grid.cols - 1); c++) {
    const x = crisp(toScreen(v, c, 0).x, dpr);
    g.moveTo(x, top); g.lineTo(x, bot);
  }
  for (let r = Math.max(L.r0, 1); r <= Math.min(L.r1, grid.rows - 1); r++) {
    const y = crisp(toScreen(v, 0, r).y, dpr);
    g.moveTo(left, y); g.lineTo(right, y);
  }
}

// Hex: elke zichtbare cel als gesloten zeshoek in één pad (één stroke: gedeelde randen worden niet dubbel donker).
// Hoekpunten één keer als verschuiving t.o.v. het middelpunt; middelpunten per cel alleen optellen (geen objecten per cel,
// ook niet bij 100×100 tijdens het pannen). Middelpunt: pointy (c + ½ + ½·oneven rij, R + 1,5R·r), flat (R + 1,5R·c, ½ + r + ½·oneven kolom).
function hexPath(g, grid, v, w, h, dpr) {
  const C = visibleCells(grid, visibleRect(v, w, h));
  if (C.c0 > C.c1) return;
  const s = CELL * v.z * dpr, m0 = cellCenter(grid, 0, 0), py = grid.orient !== "flat";
  const off = cellPoly(grid, 0, 0).map((p) => [(p.x - m0.x) * s, (p.y - m0.y) * s]);
  const ox = v.x * dpr + m0.x * s, oy = v.y * dpr + m0.y * s; // scherm (apparaat-px) van middelpunt cel (0,0)
  const dc = py ? s : 1.5 * HEX_R * s, dr = py ? 1.5 * HEX_R * s : s, half = s / 2;
  for (let r = C.r0; r <= C.r1; r++) for (let c = C.c0; c <= C.c1; c++) {
    const X = ox + c * dc + (py && (r & 1) ? half : 0), Y = oy + r * dr + (!py && (c & 1) ? half : 0);
    g.moveTo(X + off[0][0], Y + off[0][1]);
    for (let i = 1; i < 6; i++) g.lineTo(X + off[i][0], Y + off[i][1]);
    g.closePath();
  }
}

// Inn the Grid (G4, WP56): tekenen op één canvas ter grootte van het scherm. Render past nooit data aan; hij krijgt de
// kaart en de view en tekent. Lijnen in apparaatpixels (setTransform 1:1, crisp) zodat ze scherp blijven op DPR 1/2/3.
// Culling: alleen rasterlijnen in beeld (visibleLines). Kleuren uit de tokens van css/app.css (licht en donker).
import { bounds, visibleLines } from "../model/grid.js";
import { toScreen, visibleRect, crisp } from "../model/view.js";

/** Kleuren uit de CSS-tokens (opnieuw lezen bij een themawissel) */
export function readColors(el = document.documentElement) {
  const cs = getComputedStyle(el), v = (k, d) => cs.getPropertyValue(k).trim() || d;
  return { page: v("--sunk", "#f2ebdc"), map: v("--card", "#fffbf3"), line: v("--line-strong", "#8c7d6b"), edge: v("--fg", "#241811") };
}

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
  // rasterlijnen (binnen de kaart, alleen zichtbaar deel)
  const L = visibleLines(grid, visibleRect(v, w, h));
  const top = Math.max(Y0, 0), bot = Math.min(Y1, cv.height), left = Math.max(X0, 0), right = Math.min(X1, cv.width);
  g.beginPath();
  for (let c = Math.max(L.c0, 1); c <= Math.min(L.c1, grid.cols - 1); c++) {
    const x = crisp(toScreen(v, c, 0).x, dpr);
    g.moveTo(x, top); g.lineTo(x, bot);
  }
  for (let r = Math.max(L.r0, 1); r <= Math.min(L.r1, grid.rows - 1); r++) {
    const y = crisp(toScreen(v, 0, r).y, dpr);
    g.moveTo(left, y); g.lineTo(right, y);
  }
  g.globalAlpha = 0.55;
  g.lineWidth = 1;
  g.strokeStyle = col.line;
  g.stroke();
  g.globalAlpha = 1;
  // kaartrand: 2 apparaatpixels binnen de kaart (hele pixels, dus scherp)
  const e = Math.max(2, Math.round(dpr * 1.5));
  g.strokeStyle = col.edge;
  g.lineWidth = e;
  g.strokeRect(X0 + e / 2, Y0 + e / 2, X1 - X0 - e, Y1 - Y0 - e);
}

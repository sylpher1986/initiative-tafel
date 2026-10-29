// Inn the Grid (G4, WP56–WP57): rasterwiskunde, puur (geen DOM, Node-testbaar). Kaarteenheid: 1 cel = 1 eenheid
// (vierkant: zijde; hex: afstand tussen de middelpunten van buurcellen), oorsprong linksboven, x naar rechts, y naar
// beneden (docs/g4-inn-the-grid.md §2.3).
// Hex (WP57): intern axiale coördinaten (q, r), naar buiten offset-kolom/rij (c, r): pointy = "odd-r" (oneven rijen een
// halve cel naar rechts), flat = "odd-q" (oneven kolommen een halve cel omlaag). Cel (0,0) raakt de linker- en bovenrand.

/** Grenzen (D10: kaart max 100×100; WP66: alle grenzen centraal in limits.js) */
import { LIMITS } from "./limits.js";
export { LIMITS };
/** Rastertypes en hex-oriëntaties (id's in opslag) */
export const TYPES = ["square", "hex"];
export const ORIENTS = ["pointy", "flat"];
/** Rasterkleuren: vaste set (id's; "auto" = lijnkleur van het thema). De render zet een id om in een kleur. */
export const COLORS = ["auto", "dark", "light", "gold"];
/** Dekking van de rasterlijnen in procent: vaste stappen (seg in het paneel), standaard 50 */
export const ALPHAS = [25, 50, 75, 100];
const ALPHA_DEF = 50;

const S3 = Math.sqrt(3);
/** Straal (middelpunt → hoekpunt) van een hexcel: buurafstand 1 = S3 × straal */
export const HEX_R = 1 / S3;

/** Kolommen/rijen uit invoer: geheel getal binnen LIMITS, anders null (de UI toont een foutregel) */
export function parseCells(v) {
  const s = String(v ?? "").trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = +s;
  return n >= LIMITS.minCells && n <= LIMITS.maxCells ? n : null;
}

/** Raster opschonen: alle velden getypeerd en begrensd, onbekend → standaard. Basis voor nieuw, wijzigen en (later)
 *  import. Standaard: vierkant 20×15, raster zichtbaar, kleur auto, 50 %. orient blijft bewaard bij vierkant, zodat
 *  terugwisselen naar hex de laatste oriëntatie houdt. */
export function cleanGrid(g = {}) {
  // alleen echte getallen of numerieke tekst (geen true, [5], ""): basis voor import in WP58
  const num = (v) => (typeof v === "number" ? v : typeof v === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? +v : NaN);
  const n = (v, d) => { const x = num(v); return Math.min(LIMITS.maxCells, Math.max(LIMITS.minCells, Math.round(Number.isFinite(x) ? x : d))); };
  const a = Number.isFinite(num(g.alpha)) ? num(g.alpha) : ALPHA_DEF;
  return {
    type: TYPES.includes(g.type) ? g.type : "square",
    orient: ORIENTS.includes(g.orient) ? g.orient : "pointy",
    cols: n(g.cols, 20),
    rows: n(g.rows, 15),
    show: !(g.show === false || g.show === "false"),
    color: COLORS.includes(g.color) ? g.color : "auto",
    alpha: ALPHAS.reduce((b, x) => (Math.abs(x - a) < Math.abs(b - a) ? x : b)), // dichtstbijzijnde stap
  };
}

/** Nieuw vierkant raster (WP56-aanroep); cols/rows gehele getallen binnen LIMITS */
export const squareGrid = (cols = 20, rows = 15) => cleanGrid({ cols, rows });

const isHex = (g) => g.type === "hex";
const pointy = (g) => g.orient !== "flat";

// ---- hex: offset ↔ axiaal ----
/** Offset (c, r) → axiaal { q, r } */
export function toAxial(grid, c, r) {
  return pointy(grid) ? { q: c - (r - (r & 1)) / 2, r } : { q: c, r: r - (c - (c & 1)) / 2 };
}
/** Axiaal (q, r) → offset { c, r } */
export function fromAxial(grid, q, ar) {
  return pointy(grid) ? { c: q + (ar - (ar & 1)) / 2, r: ar } : { c: q, r: ar + (q - (q & 1)) / 2 };
}

/** Middelpunt van een cel in kaarteenheden */
export function cellCenter(grid, c, r) {
  if (!isHex(grid)) return { x: c + 0.5, y: r + 0.5 };
  const R = HEX_R;
  return pointy(grid) ? { x: c + 0.5 + (r & 1) * 0.5, y: R + r * 1.5 * R } : { x: R + c * 1.5 * R, y: 0.5 + r + (c & 1) * 0.5 };
}

/** Hoekpunten van een cel (kaarteenheden), met de klok mee: pointy vanaf boven, flat vanaf rechts, vierkant vanaf linksboven */
export function cellPoly(grid, c, r) {
  if (!isHex(grid)) return [{ x: c, y: r }, { x: c + 1, y: r }, { x: c + 1, y: r + 1 }, { x: c, y: r + 1 }];
  const m = cellCenter(grid, c, r), R = HEX_R, a0 = pointy(grid) ? -90 : 0, out = [];
  for (let i = 0; i < 6; i++) {
    const a = ((a0 + 60 * i) * Math.PI) / 180;
    out.push({ x: m.x + R * Math.cos(a), y: m.y + R * Math.sin(a) });
  }
  return out;
}

/** Omsluitende rechthoek van een cel in kaarteenheden */
export function cellRect(grid, c, r) {
  if (!isHex(grid)) return { x: c, y: r, w: 1, h: 1 };
  const m = cellCenter(grid, c, r), R = HEX_R;
  return pointy(grid) ? { x: m.x - 0.5, y: m.y - R, w: 1, h: 2 * R } : { x: m.x - R, y: m.y - 0.5, w: 2 * R, h: 1 };
}

/** Cel onder een kaartpunt: { c, r } (ook buiten de kaart, ook negatief). Vierkant: halfopen [c, c+1) (een punt op een
 *  lijn hoort bij de cel rechts/onder). Hex: de cel waarvan het middelpunt het dichtst bij ligt (= de zeshoek die het
 *  punt bevat), via kubus-afronding. */
export function cellAt(grid, x, y) {
  if (!isHex(grid)) return { c: Math.floor(x), r: Math.floor(y) };
  const R = HEX_R;
  let fq, fr;
  if (pointy(grid)) { const px = x - 0.5, py = y - R; fq = (px * S3 / 3 - py / 3) / R; fr = (py * 2 / 3) / R; }
  else { const px = x - R, py = y - 0.5; fq = (px * 2 / 3) / R; fr = (-px / 3 + py * S3 / 3) / R; }
  const fs = -fq - fr;
  let q = Math.round(fq), r = Math.round(fr);
  const s = Math.round(fs), dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return fromAxial(grid, q + 0, r + 0); // + 0: geen -0
}

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
/** Buurcellen (offset), ook buiten de kaart: vierkant 4 (orthogonaal), hex 6 */
export function neighbors(grid, c, r) {
  if (!isHex(grid)) return [{ c: c + 1, r }, { c, r: r - 1 }, { c: c - 1, r }, { c, r: r + 1 }];
  const a = toAxial(grid, c, r);
  return DIRS.map(([dq, dr]) => fromAxial(grid, a.q + dq, a.r + dr));
}

/** Ligt cel (c, r) op de kaart? */
export const inside = (grid, c, r) => Number.isInteger(c) && Number.isInteger(r) && c >= 0 && r >= 0 && c < grid.cols && r < grid.rows;

/** Hele kaart in kaarteenheden: de omsluitende rechthoek van alle cellen */
export function bounds(grid) {
  if (!isHex(grid)) return { x: 0, y: 0, w: grid.cols, h: grid.rows };
  const R = HEX_R;
  return pointy(grid)
    ? { x: 0, y: 0, w: grid.cols + (grid.rows > 1 ? 0.5 : 0), h: 2 * R + (grid.rows - 1) * 1.5 * R }
    : { x: 0, y: 0, w: 2 * R + (grid.cols - 1) * 1.5 * R, h: grid.rows + (grid.cols > 1 ? 0.5 : 0) };
}

/** Culling vierkant: welke rasterlijnen vallen in een kaartrechthoek (de zichtbare viewport)? Begrensd tot de kaart; leeg
 *  (c0 > c1 of r0 > r1) als de kaart helemaal buiten beeld is. Lijnen, niet cellen: lijn i ligt op x = i (0…cols). */
export function visibleLines(grid, rect) {
  const lo = (v, max) => Math.max(0, Math.min(max, Math.ceil(v)));
  const hi = (v, max) => Math.max(0, Math.min(max, Math.floor(v)));
  const c0 = lo(rect.x, grid.cols), c1 = hi(rect.x + rect.w, grid.cols);
  const r0 = lo(rect.y, grid.rows), r1 = hi(rect.y + rect.h, grid.rows);
  const out = rect.x > grid.cols || rect.y > grid.rows || rect.x + rect.w < 0 || rect.y + rect.h < 0;
  return out ? { c0: 1, c1: 0, r0: 1, r1: 0 } : { c0, c1, r0, r1 };
}

/** Culling per cel (elk type): bereik { c0, c1, r0, r1 } (inclusief) van kaartcellen waarvan de omsluitende rechthoek
 *  de kaartrechthoek kan raken (hooguit één cel te veel), leeg (c0 > c1) als niets in beeld is. */
export function visibleCells(grid, rect) {
  let cw = 1, rh = 1, ox = 0, oy = 0;
  if (isHex(grid)) {
    if (pointy(grid)) { rh = 1.5 * HEX_R; ox = 0.5; oy = 2 * HEX_R; } else { cw = 1.5 * HEX_R; ox = 2 * HEX_R; oy = 0.5; }
  }
  const c0 = Math.max(0, Math.floor((rect.x - ox) / cw)), c1 = Math.min(grid.cols - 1, Math.floor((rect.x + rect.w) / cw));
  const r0 = Math.max(0, Math.floor((rect.y - oy) / rh)), r1 = Math.min(grid.rows - 1, Math.floor((rect.y + rect.h) / rh));
  return c0 > c1 || r0 > r1 ? { c0: 1, c1: 0, r0: 1, r1: 0 } : { c0, c1, r0, r1 };
}

// ---- WP66: hex-rasterlijnen zonder dubbele randen ----
// Rand k van een cel loopt van hoekpunt k naar k + 1 (cellPoly). Een rand tussen twee kaartcellen tekent maar één van
// beide: elke cel tekent altijd zijn randen naar boven en links (pointy: 4 links, 5 linksboven, 0 rechtsboven; flat:
// 3 linksboven, 4 boven, 5 rechtsboven) en de andere drie alleen als daar geen kaartcel ligt (de rand van de kaart).
// Buur over rand k als offset (dc, dr), per pariteit (even/oneven rij bij pointy, kolom bij flat).
const EDGE_NB = {
  pointy: [[[0, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1]], [[1, -1], [1, 0], [1, 1], [0, 1], [-1, 0], [0, -1]]],
  flat: [[[1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], [[1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]]],
};
/** Eerste eigen rand (de render tekent vanaf hier rondom, zodat de eigen randen één aaneengesloten lijn zijn) */
export const EDGE_START = { pointy: 4, flat: 3 };
const OWN_EDGES = { pointy: 0b110001, flat: 0b111000 }; // bit k = rand k is altijd van deze cel
/** Welke randen tekent cel (c, r)? Bitmasker (bit k = rand k). Samen tekenen alle kaartcellen elke rand precies één keer. */
export function hexEdgeMask(grid, c, r) {
  const o = pointy(grid) ? "pointy" : "flat", nb = EDGE_NB[o][(o === "pointy" ? r : c) & 1];
  let m = OWN_EDGES[o];
  if (c > 0 && r > 0 && c < grid.cols - 1 && r < grid.rows - 1) return m; // binnencel: alle buren liggen op de kaart
  for (let k = 0; k < 6; k++) if (!(m & (1 << k)) && !inside(grid, c + nb[k][0], r + nb[k][1])) m |= 1 << k;
  return m;
}

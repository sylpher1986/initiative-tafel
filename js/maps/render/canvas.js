// Inn Sight (G4, WP56): tekenen op één canvas ter grootte van het scherm. Render past nooit data aan; hij krijgt de
// kaart en de view en tekent. Lijnen in apparaatpixels (setTransform 1:1, crisp) zodat ze scherp blijven op DPR 1/2/3.
// Culling: alleen rasterlijnen/cellen in beeld (visibleLines, visibleCells). Kleuren uit de tokens van css/app.css (licht
// en donker); de rasterkleur is een id uit een vaste set (WP57): "auto" = lijnkleur van het thema, de rest vast (merkpalet),
// want het raster ligt later ook over een achtergrondafbeelding en moet daar per kaart passen, niet per thema.
import { bounds, visibleLines, visibleCells, cellCenter, cellPoly, hexEdgeMask, EDGE_START, HEX_R } from "../model/grid.js";
import { CELL, toScreen, visibleRect, crisp } from "../model/view.js";
import { bgRect } from "../model/bg.js";
import { drawOrder } from "../model/objects.js";
import { corners, handles } from "../model/hit.js";
import { cellsOf, known, TERR } from "../model/terrain.js";

/** Terreinkleuren (WP63): kaartinhoud, dus vast en niet per thema (zoals de vaste rasterkleuren); vormgeving in WP68.
 *  Ook de kleurvlakken in het paneel (main.js). Onbekend terrein (nieuwere versie) = plaatshouder in de lijnkleur. */
export const TERR_COLORS = { stone: "#8d877c", wood: "#9c6b3c", grass: "#6c9a48", dirt: "#7f6045", water: "#4a82b4", sand: "#d8c08a", lava: "#cf512a", void: "#17110c" };

/** Kleuren uit de CSS-tokens (opnieuw lezen bij een themawissel) */
export function readColors(el = document.documentElement) {
  const cs = getComputedStyle(el), v = (k, d) => cs.getPropertyValue(k).trim() || d;
  return { page: v("--sunk", "#f2ebdc"), map: v("--card", "#fffbf3"), line: v("--line-strong", "#8c7d6b"), edge: v("--fg", "#241811"), sel: v("--sel", "#7a5512") };
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

/** Kaart tekenen. map = { grid, bg?, objs? }, v = view, w/h = CSS-grootte, dpr, col = readColors(); img = tekenbare
 *  achtergrond (of null: geen, laadt nog of ontbreekt), align = uitlijnmodus (WP59: afbeelding helemaal zichtbaar).
 *  WP61: objecten (art = createArt(), ghost = object dat op de plek van de muis half doorzichtig getekend wordt).
 *  Volgorde: achtergrond → laag floor → raster → laag object → kaartrand (het raster ligt over vloeren, onder meubels). */
// WP62: sel = geselecteerd object (gedraaid kader in --sel met een lichte rand eromheen, draaigreep met steel en
// schaalgreep; boven alles, ook boven de kaartrand), cursor = hoekpunten (kaarteenheden) van de toetsenbordcel (gestippeld).
// WP63: terrein (map.terr) boven de achtergrond en onder de laag floor; brush = hoekpunten van de cellen die een klik
// zou verven (omlijning onder de muis, desktop).
// WP66: in twee delen. drawBase = de kaart zelf (alles tot en met de kaartrand), met de transformatie die de aanroeper
// zet en W × H apparaatpixels (een strook van de buffer in createLayer); drawOver = wat over de kaart ligt (spookbeeld,
// verfomlijning, cursor, selectie) en elk frame opnieuw komt. draw = beide, zonder buffer (tests, diagnose).
export function draw(cv, map, v, w, h, dpr, col, opts = {}) {
  const g = cv.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  drawBase(g, map, v, w, h, dpr, col, cv.width, cv.height, opts);
  drawOver(g, map, v, w, h, dpr, col, opts);
}

/** De kaart zelf op g (transformatie van de aanroeper, apparaatpixels W × H vanaf de oorsprong) */
export function drawBase(g, map, v, w, h, dpr, col, W, H, { img = null, align = false, art = null } = {}) {
  const grid = map.grid, b = bounds(grid);
  g.fillStyle = col.page;
  g.fillRect(0, 0, W, H);
  const p0 = toScreen(v, b.x, b.y), p1 = toScreen(v, b.x + b.w, b.y + b.h);
  const X0 = Math.round(p0.x * dpr), Y0 = Math.round(p0.y * dpr), X1 = Math.round(p1.x * dpr), Y1 = Math.round(p1.y * dpr);
  g.fillStyle = col.map;
  g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  if (img && map.bg) { // WP59: achtergrond onder het raster; buiten de kaart gedimd, in de uitlijnmodus volledig
    const r = bgRect(map.bg), q0 = toScreen(v, r.x, r.y), q1 = toScreen(v, r.x + r.w, r.y + r.h);
    const bx = q0.x * dpr, by = q0.y * dpr, bw = (q1.x - q0.x) * dpr, bh = (q1.y - q0.y) * dpr;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    if (align) g.drawImage(img, bx, by, bw, bh);
    else { // WP66: binnen de kaart één keer volledig, alleen het deel erbuiten op 35 % (was: alles op 35 % en dan nog eens)
      g.save(); g.beginPath(); g.rect(0, 0, W, H); g.rect(X0, Y0, X1 - X0, Y1 - Y0); g.clip("evenodd");
      g.globalAlpha = 0.35; g.drawImage(img, bx, by, bw, bh); g.restore();
      g.save(); g.beginPath(); g.rect(X0, Y0, X1 - X0, Y1 - Y0); g.clip(); g.drawImage(img, bx, by, bw, bh); g.restore();
    }
  }
  if (map.terr && !align) drawTerr(g, map.terr, grid, v, w, h, dpr, col); // WP63: boven de achtergrond, onder vloeren en raster
  const { list: objs, nf } = map.objs && map.objs.length ? drawOrder(map.objs) : { list: [], nf: 0 };
  const things = (from, to) => { for (let i = from; i < to; i++) drawObj(g, objs[i], v, w, h, dpr, col, art); };
  if (!align) things(0, nf);
  if (grid.show) {
    g.beginPath();
    if (grid.type === "hex") hexPath(g, grid, v, w, h, dpr);
    else squarePath(g, grid, v, w, h, dpr, { top: Math.max(Y0, 0), bot: Math.min(Y1, H), left: Math.max(X0, 0), right: Math.min(X1, W) });
    g.globalAlpha = grid.alpha / 100;
    g.lineWidth = 1;
    g.strokeStyle = gridColor(grid.color, col);
    g.stroke();
    g.globalAlpha = 1;
  }
  if (!align) things(nf, objs.length);
  // kaartrand: 2 apparaatpixels binnen de kaart (hele pixels, dus scherp)
  const e = Math.max(2, Math.round(dpr * 1.5));
  g.strokeStyle = col.edge;
  g.lineWidth = e;
  g.strokeRect(X0 + e / 2, Y0 + e / 2, X1 - X0 - e, Y1 - Y0 - e);
}

/** Wat over de kaart ligt (elk frame opnieuw, nooit in de buffer) */
export function drawOver(g, map, v, w, h, dpr, col, { align = false, art = null, ghost = null, sel = null, cursor = null, brush = null } = {}) {
  if (align) return;
  if (ghost) { g.globalAlpha = 0.5; drawObj(g, ghost, v, w, h, dpr, col, art); g.globalAlpha = 1; }
  if (brush) for (const pts of brush) drawCursor(g, pts, v, dpr, col);
  if (cursor) drawCursor(g, cursor, v, dpr, col);
  if (sel) drawSel(g, sel, v, dpr, col);
}

/**
 * WP66: buffer voor de kaart zelf (drawBase), zo groot als het canvas. Zolang kaart, thema, zoom en grootte gelijk
 * blijven, tekent een frame alleen de buffer (één drawImage) en wat erover ligt. Pannen schuift de buffer op hele
 * apparaatpixels in zichzelf en tekent alleen de vrijgekomen stroken (geknipt, met dezelfde coördinaten: geen naden).
 * Doorlopend zoomen (knijpen, wiel: nog een zoomstap binnen ZOOM_GAP ms) tekent de buffer geschaald als voorbeeld en
 * vraagt via settle om een scherpe tekening zodra het zoomen stopt; binnen ZOOM_PREVIEW blijft de rand die vrijkomt
 * klein, daarbuiten (en bij één losse stap) meteen scherp. key = alles behalve de view waar de kaart van afhangt.
 */
export const ZOOM_GAP = 150, ZOOM_PREVIEW = [0.8, 2];
export function createLayer(make = () => document.createElement("canvas"), now = () => performance.now()) {
  let buf = null, bg = null, key = null, vb = null, lastZoom = -1e9;
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
  const full = (map, v, w, h, dpr, col, opts) => {
    bg.setTransform(1, 0, 0, 1, 0, 0);
    drawBase(bg, map, v, w, h, dpr, col, buf.width, buf.height, opts);
    vb = { ...v };
  };
  // strook (apparaatpixels in de buffer) opnieuw tekenen met de view van de buffer
  const strip = (map, dpr, col, opts, sx, sy, sw, sh) => {
    if (sw <= 0 || sh <= 0) return;
    bg.save();
    bg.setTransform(1, 0, 0, 1, sx, sy);
    bg.beginPath(); bg.rect(0, 0, sw, sh); bg.clip();
    drawBase(bg, map, { x: vb.x - sx / dpr, y: vb.y - sy / dpr, z: vb.z }, sw / dpr, sh / dpr, dpr, col, sw, sh, opts);
    bg.restore();
  };
  return {
    /** Tekent de kaart op cv. extra = waarden waar de kaart verder van afhangt (zoals de versie van de tekeningen).
     *  Geeft { mode: "full" | "pan" | "zoom" | "same", settle } (settle = ms waarna opnieuw tekenen nodig is, of 0). */
    paint(cv, map, v, w, h, dpr, col, opts = {}, extra = []) {
      const W = cv.width, H = cv.height;
      if (!buf || buf.width !== W || buf.height !== H) { buf = buf || make(); buf.width = W; buf.height = H; bg = buf.getContext("2d"); key = null; }
      const k = [map.grid, map.bg || null, map.terr || null, map.objs || null, opts.img || null, !!opts.align, col, dpr, W, H, ...extra];
      let mode = "same", settle = 0;
      const t = now();
      if (!same(k, key)) { key = k; full(map, v, w, h, dpr, col, opts); mode = "full"; }
      else if (v.z !== vb.z) {
        const r = v.z / vb.z, going = t - lastZoom < ZOOM_GAP;
        lastZoom = t;
        if (going && r >= ZOOM_PREVIEW[0] && r <= ZOOM_PREVIEW[1]) { mode = "zoom"; settle = ZOOM_GAP; }
        else { full(map, v, w, h, dpr, col, opts); mode = "full"; }
      } else {
        const dx = Math.round((v.x - vb.x) * dpr), dy = Math.round((v.y - vb.y) * dpr);
        if (Math.abs(dx) >= W || Math.abs(dy) >= H) { full(map, v, w, h, dpr, col, opts); mode = "full"; }
        else if (dx || dy) {
          bg.save();
          bg.setTransform(1, 0, 0, 1, 0, 0);
          bg.globalCompositeOperation = "copy"; // de buffer in zichzelf verschuiven; wat vrijkomt wordt hieronder getekend
          bg.drawImage(buf, dx, dy);
          bg.restore();
          vb = { x: vb.x + dx / dpr, y: vb.y + dy / dpr, z: vb.z };
          const sx = dx > 0 ? 0 : W + dx, sw = Math.abs(dx); // vrijgekomen kolom (volle hoogte) en rij (zonder die kolom)
          strip(map, dpr, col, opts, sx, 0, sw, H);
          strip(map, dpr, col, opts, dx > 0 ? dx : 0, dy > 0 ? 0 : H + dy, W - sw, Math.abs(dy));
          mode = "pan";
        }
      }
      const g = cv.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (mode === "zoom") { // voorbeeld: de buffer geschaald op de nieuwe view (zie toScreen), de rest paginakleur
        const r = v.z / vb.z;
        g.fillStyle = col.page; g.fillRect(0, 0, W, H);
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "low";
        g.drawImage(buf, (v.x - vb.x * r) * dpr, (v.y - vb.y * r) * dpr, W * r, H * r);
      } else g.drawImage(buf, 0, 0); // de rest (< ½ apparaatpixel) valt weg: zo blijft alles scherp
      // wat erover ligt met de view van wat er nu staat (bij pannen de buffer, dus precies op de getekende kaart)
      drawOver(g, map, mode === "zoom" ? v : { ...v, x: vb.x, y: vb.y }, w, h, dpr, col, opts);
      return { mode, settle };
    },
    /** Buffer weg (lijst open, geheugen); de volgende paint tekent volledig */
    clear() { if (buf) { buf.width = buf.height = 0; } buf = null; bg = null; key = null; },
    /** View waarop de buffer nu getekend is (diagnose: browsercheck vergelijkt met een volledige tekening) */
    view: () => vb && { ...vb },
    /** Geheugen van de buffer in bytes (meetstand) */
    bytes() { return buf ? buf.width * buf.height * 4 : 0; },
  };
}

// Pad door schermpunten (CSS-px) in apparaatpixels
const poly = (g, pts, dpr) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x * dpr, p.y * dpr) : g.moveTo(p.x * dpr, p.y * dpr))); g.closePath(); };

// Toetsenbordcel: gestippelde omtrek
function drawCursor(g, pts, v, dpr, col) {
  poly(g, pts.map((p) => toScreen(v, p.x, p.y)), dpr);
  g.setLineDash([5 * dpr, 4 * dpr]);
  g.lineWidth = 2 * dpr;
  g.strokeStyle = col.sel;
  g.stroke();
  g.setLineDash([]);
}

// Selectie: kader (eerst breed in de kaartkleur, dan smal in --sel: zichtbaar op licht en donker), steel naar de draaigreep,
// grepen als rondje (draaien) en vierkantje (schalen); getekend formaat kleiner dan het tikdoel (HANDLE)
function drawSel(g, o, v, dpr, col) {
  const c = corners(o).map((p) => toScreen(v, p.x, p.y)), hd = handles(o, v), top = { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 };
  const line = (wd, color) => { g.lineWidth = wd * dpr; g.strokeStyle = color; g.stroke(); };
  g.save(); // lineJoin en kleuren blijven niet op de context staan
  g.lineJoin = "round";
  poly(g, c, dpr); line(5, col.map); line(2, col.sel);
  g.beginPath(); g.moveTo(top.x * dpr, top.y * dpr); g.lineTo(hd.rot.x * dpr, hd.rot.y * dpr); line(4, col.map); line(2, col.sel);
  const r = 10 * dpr;
  g.beginPath(); g.arc(hd.rot.x * dpr, hd.rot.y * dpr, r, 0, Math.PI * 2);
  g.fillStyle = col.map; g.fill(); line(2.5, col.sel);
  g.beginPath(); g.rect(hd.size.x * dpr - r, hd.size.y * dpr - r, 2 * r, 2 * r);
  g.fill(); line(2.5, col.sel);
  g.restore();
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

// Hex: alle zichtbare randen in één pad (één stroke). WP66: elke rand één keer (hexEdgeMask: een cel tekent zijn randen
// naar boven en links, de rest alleen aan de kaartrand), als één lijn per cel vanaf EDGE_START rondom; was elke cel een
// gesloten zeshoek (elke binnenrand twee keer). Hoekpunten één keer als verschuiving t.o.v. het middelpunt; middelpunten
// per cel alleen optellen (geen objecten per cel, ook niet bij 100×100 tijdens het pannen). Middelpunt: pointy (c + ½ +
// ½·oneven rij, R + 1,5R·r), flat (R + 1,5R·c, ½ + r + ½·oneven kolom).
function hexPath(g, grid, v, w, h, dpr) {
  const C = visibleCells(grid, visibleRect(v, w, h));
  if (C.c0 > C.c1) return;
  const s = CELL * v.z * dpr, m0 = cellCenter(grid, 0, 0), py = grid.orient !== "flat";
  const off = cellPoly(grid, 0, 0).map((p) => [(p.x - m0.x) * s, (p.y - m0.y) * s]);
  const ox = v.x * dpr + m0.x * s, oy = v.y * dpr + m0.y * s; // scherm (apparaat-px) van middelpunt cel (0,0)
  const dc = py ? s : 1.5 * HEX_R * s, dr = py ? 1.5 * HEX_R * s : s, half = s / 2, k0 = EDGE_START[py ? "pointy" : "flat"];
  for (let r = C.r0; r <= C.r1; r++) for (let c = C.c0; c <= C.c1; c++) {
    const X = ox + c * dc + (py && (r & 1) ? half : 0), Y = oy + r * dr + (!py && (c & 1) ? half : 0), m = hexEdgeMask(grid, c, r);
    let pen = -1; // hoekpunt waar de pen nu staat (-1 = opgetild)
    for (let j = 0; j < 6; j++) {
      const k = (k0 + j) % 6;
      if (!(m & (1 << k))) { pen = -1; continue; }
      if (pen !== k) g.moveTo(X + off[k][0], Y + off[k][1]);
      const q = (k + 1) % 6;
      g.lineTo(X + off[q][0], Y + off[q][1]);
      pen = q;
    }
  }
}

// Eén object: bitmap van het onderdeel (art) op zijn middelpunt, geschaald naar w × h cellen en gedraaid; buiten beeld
// overgeslagen (culling op de omsluitende cirkel). Onbekend, nog niet geladen of mislukt: plaatshouder (gestippelde rechthoek).
function drawObj(g, o, v, w, h, dpr, col, art) {
  const s = CELL * v.z, p = toScreen(v, o.x, o.y), rad = (Math.hypot(o.w, o.h) / 2) * s;
  if (p.x + rad < 0 || p.y + rad < 0 || p.x - rad > w || p.y - rad > h) return;
  const ow = o.w * s * dpr, oh = o.h * s * dpr, bmp = art ? art.get(o.asset, s * dpr) : null;
  g.save();
  g.translate(p.x * dpr, p.y * dpr);
  if (o.rot) g.rotate((o.rot * Math.PI) / 180);
  if (bmp) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(bmp, -ow / 2, -oh / 2, ow, oh); }
  else {
    const inset = Math.min(ow, oh) * 0.08;
    g.setLineDash([4 * dpr, 3 * dpr]);
    g.lineWidth = Math.max(1, dpr);
    g.strokeStyle = col.line;
    g.strokeRect(-ow / 2 + inset, -oh / 2 + inset, ow - 2 * inset, oh - 2 * inset);
  }
  g.restore();
}

// Terrein: per terreintype één pad en één fill (geen naden tussen cellen van hetzelfde type, ± 9 fills per frame).
// Vierkant: aaneengesloten cellen in een rij als één rechthoek op hele apparaatpixels; hex: zeshoeken zoals hexPath.
// Alleen de zichtbare cellen binnen de kaart (culling); cellen buiten de kaart (raster verkleind) blijven onzichtbaar.
// WP66: geen eigen buffer per zoomniveau; de hele kaart staat in de buffer van createLayer.
function drawTerr(g, terr, grid, v, w, h, dpr, col) {
  const C = visibleCells(grid, visibleRect(v, w, h));
  if (C.c0 > C.c1) return;
  const a = cellsOf(terr), n = terr.ids.length, W = TERR.w;
  const paths = Array.from({ length: n + 1 }, () => null), path = (k) => paths[k] || (paths[k] = new Path2D());
  if (grid.type !== "hex") {
    const X = (c) => Math.round(toScreen(v, c, 0).x * dpr), Y = (r) => Math.round(toScreen(v, 0, r).y * dpr);
    for (let r = C.r0; r <= C.r1; r++) {
      const y0 = Y(r), y1 = Y(r + 1);
      for (let c = C.c0; c <= C.c1;) {
        const k = a[r * W + c];
        let e = c + 1;
        while (e <= C.c1 && a[r * W + e] === k) e++;
        if (k) { const x0 = X(c); path(k).rect(x0, y0, X(e) - x0, y1 - y0); }
        c = e;
      }
    }
  } else {
    const s = CELL * v.z * dpr, m0 = cellCenter(grid, 0, 0), py = grid.orient !== "flat";
    const off = cellPoly(grid, 0, 0).map((p) => [(p.x - m0.x) * s, (p.y - m0.y) * s]);
    const ox = v.x * dpr + m0.x * s, oy = v.y * dpr + m0.y * s, dc = py ? s : 1.5 * HEX_R * s, dr = py ? 1.5 * HEX_R * s : s, half = s / 2;
    // aaneengesloten cellen van één soort als één veelhoek: pointy per rij (buren links/rechts delen een zijde), flat per
    // kolom (boven/onder); hoekpunten off[0…5] met de klok mee (pointy: boven, rechtsboven, rechtsonder, onder,
    // linksonder, linksboven; flat: rechts, rechtsonder, linksonder, links, linksboven, rechtsboven)
    const at = (c, r) => [ox + c * dc + (py && (r & 1) ? half : 0), oy + r * dr + (!py && (c & 1) ? half : 0)];
    const pt = (P, m, i, first) => (first ? P.moveTo(m[0] + off[i][0], m[1] + off[i][1]) : P.lineTo(m[0] + off[i][0], m[1] + off[i][1]));
    const [o0, o1] = py ? [C.r0, C.r1] : [C.c0, C.c1], [i0, i1] = py ? [C.c0, C.c1] : [C.r0, C.r1];
    for (let o = o0; o <= o1; o++) for (let i = i0; i <= i1;) {
      const k = py ? a[o * W + i] : a[i * W + o];
      let e = i + 1;
      while (e <= i1 && (py ? a[o * W + e] : a[e * W + o]) === k) e++;
      if (k) {
        const P = path(k), cell = (j) => (py ? at(j, o) : at(o, j));
        if (py) { // linksboven, dan per cel boven + rechtsboven, rechtsonder van de laatste, terug per cel onder + linksonder
          pt(P, cell(i), 5, true);
          for (let j = i; j < e; j++) { const m = cell(j); pt(P, m, 0); pt(P, m, 1); }
          pt(P, cell(e - 1), 2);
          for (let j = e - 1; j >= i; j--) { const m = cell(j); pt(P, m, 3); pt(P, m, 4); }
        } else { // linksboven van de eerste, rechtsboven, dan per cel rechts + rechtsonder, terug per cel links + linksboven
          pt(P, cell(i), 4, true); pt(P, cell(i), 5);
          for (let j = i; j < e; j++) { const m = cell(j); pt(P, m, 0); pt(P, m, 1); }
          pt(P, cell(e - 1), 2);
          for (let j = e - 1; j >= i; j--) { const m = cell(j); pt(P, m, 3); if (j > i) pt(P, m, 4); }
        }
        P.closePath();
      }
      i = e;
    }
  }
  for (let k = 1; k <= n; k++) {
    if (!paths[k]) continue;
    const id = terr.ids[k - 1];
    g.fillStyle = known(id) ? TERR_COLORS[id] : col.line;
    if (!known(id)) g.globalAlpha = 0.5;
    g.fill(paths[k]);
    g.globalAlpha = 1;
  }
}

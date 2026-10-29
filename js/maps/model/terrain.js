// Inn the Grid (G4, WP63): terrein per cel, puur (geen DOM, Node-testbaar). Opgeslagen (kaartdocument, projectbestand)
// als { w, h, ids, cells }: een vast celraster van w × h (= LIMITS.maxCells, los van kolommen/rijen van de kaart, zodat
// kleiner en weer groter maken niets weggooit, net als objecten buiten de kaart), cells = tekst van w·h tekens rij voor
// rij (index r·w + c), elk teken = positie in ALPH: "0" = leeg, k = ids[k − 1]. ids = palet van de terrein-id's die
// echt voorkomen (opgeschoond, onbekende id's van een nieuwere versie blijven bewaard en worden een plaatshouder).
// Waarom geen schaarse kaart { "c,r": id } (plan §2.3): een kopie van 10 000 sleutels kost ± 9 ms per veegbeweging;
// deze vorm ± 0,2 ms en blijft klein in de export (10 KB). Waarden worden nooit ter plekke gewijzigd: elke verfstap
// geeft een nieuw object (of hetzelfde als er niets verandert), zodat undo verwijzingen kan vasthouden.
import { LIMITS, neighbors, inside, cellAt } from "./grid.js";

/** Terreintypen (id's in opslag en export, catalogussleutel maps.terr.<id>). Bevroren: alleen achteraan toevoegen. */
export const TERRAINS = ["stone", "wood", "grass", "dirt", "water", "sand", "lava", "void"];
/** Gereedschappen in de UI: penseel (1 cel), breed (cel + buren), vullen (aaneengesloten gebied) */
export const TOOLS = ["brush", "wide", "fill"];
/** Vast celraster en het grootste palet (één teken per cel) */
export const TERR = { w: LIMITS.maxCells, h: LIMITS.maxCells, maxIds: LIMITS.terrIds };

const ALPH = "0123456789abcdefghijklmnopqrstuvwxyz";
const CODE = [...ALPH].map((ch) => ch.charCodeAt(0));
const DEC = new Int8Array(128).fill(-1);
CODE.forEach((c, i) => { DEC[c] = i; });
const ID_RE = /^[a-z0-9]{1,16}$/;
const N = TERR.w * TERR.h;

/** Is id een (mogelijk toekomstige) terrein-id? */
export const terrId = (v) => typeof v === "string" && ID_RE.test(v);
/** Kent deze versie het terrein? (anders plaatshouder) */
export const known = (id) => TERRAINS.includes(id);

// Gedecodeerde cellen per terreinobject (alleen lezen!): tekenen, vullen en verven decoderen dezelfde tekst niet steeds opnieuw
const cache = new WeakMap();
/** Cellen als Uint8Array (index r·w + c, 0 = leeg, k = ids[k − 1]); niet wijzigen */
export function cellsOf(terr) {
  let a = cache.get(terr);
  if (!a) {
    a = new Uint8Array(N);
    const s = terr.cells;
    for (let i = 0; i < N; i++) a[i] = DEC[s.charCodeAt(i)];
    cache.set(terr, a);
  }
  return a;
}

function encode(a) {
  const o = new Array(N);
  for (let i = 0; i < N; i++) o[i] = CODE[a[i]];
  let s = "";
  for (let i = 0; i < N; i += 4096) s += String.fromCharCode.apply(null, o.slice(i, i + 4096));
  return s;
}

/** Nieuw terreinobject uit cellen + palet: ongebruikte id's weg (en hernummerd), leeg = null */
function build(a, ids) {
  const used = new Uint8Array(ids.length + 1);
  for (let i = 0; i < N; i++) used[a[i]] = 1;
  const map = new Uint8Array(ids.length + 1), out = [];
  for (let k = 1; k <= ids.length; k++) if (used[k]) { out.push(ids[k - 1]); map[k] = out.length; }
  if (!out.length) return null;
  const same = out.length === ids.length;
  const b = same ? a : a.map((v) => map[v]);
  const t = { w: TERR.w, h: TERR.h, ids: out, cells: encode(b) };
  cache.set(t, b);
  return t;
}

/** Terrein opschonen (opslag, bestand): null = geen of onbruikbaar. Een ander (kleiner) raster wordt overgezet op het
 *  vaste raster; een onbekend teken of een teken buiten het palet = lege cel; dubbele id's samengevoegd. */
export function cleanTerr(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const w = raw.w, h = raw.h, s = raw.cells;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 1000 || h > 1000) return null;
  if (typeof s !== "string" || s.length !== w * h || !Array.isArray(raw.ids) || raw.ids.length > TERR.maxIds) return null;
  const ids = [], remap = new Uint8Array(raw.ids.length + 1);
  raw.ids.forEach((id, i) => {
    if (!terrId(id)) return;
    let k = ids.indexOf(id);
    if (k < 0) { ids.push(id); k = ids.length - 1; }
    remap[i + 1] = k + 1;
  });
  const a = new Uint8Array(N);
  for (let r = 0; r < Math.min(h, TERR.h); r++) for (let c = 0; c < Math.min(w, TERR.w); c++) {
    const v = DEC[s.charCodeAt(r * w + c)];
    if (v > 0 && v <= raw.ids.length) a[r * TERR.w + c] = remap[v];
  }
  return build(a, ids);
}

/** Terrein-id van cel (c, r) of null (leeg, buiten het raster, geen terrein) */
export function terrAt(terr, c, r) {
  if (!terr || !Number.isInteger(c) || !Number.isInteger(r) || c < 0 || r < 0 || c >= TERR.w || r >= TERR.h) return null;
  const v = cellsOf(terr)[r * TERR.w + c];
  return v ? terr.ids[v - 1] : null;
}

/** Cellen verven met id (null = wissen). Geeft het nieuwe terrein, hetzelfde object als er niets verandert, of null als
 *  er daarna geen terrein meer is. Cellen buiten het vaste raster worden overgeslagen. Vol palet = ongewijzigd. */
export function paintCells(terr, cells, id) {
  if (id !== null && !terrId(id)) return terr;
  const src = terr ? cellsOf(terr) : null, ids = terr ? terr.ids.slice() : [];
  let v = 0;
  if (id !== null) {
    v = ids.indexOf(id) + 1;
    if (!v) { if (ids.length >= TERR.maxIds) return terr; ids.push(id); v = ids.length; }
  }
  let a = null;
  for (const { c, r } of cells) {
    if (!Number.isInteger(c) || !Number.isInteger(r) || c < 0 || r < 0 || c >= TERR.w || r >= TERR.h) continue;
    const i = r * TERR.w + c;
    if ((a || src)?.[i] === v || (!src && !a && v === 0)) continue;
    if (!a) a = src ? src.slice() : new Uint8Array(N);
    a[i] = v;
  }
  return a ? build(a, ids) : terr;
}

/** Penseelvoetafdruk rond cel (c, r) binnen de kaart: brush = de cel, wide = de cel en zijn buren (vierkant 3 × 3, hex 7) */
export function brushCells(grid, c, r, tool) {
  if (!inside(grid, c, r)) return [];
  if (tool !== "wide") return [{ c, r }];
  const out = [{ c, r }];
  const near = grid.type === "hex" ? neighbors(grid, c, r)
    : [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([dc, dr]) => ({ c: c + dc, r: r + dr }));
  for (const n of near) if (inside(grid, n.c, n.r)) out.push(n);
  return out;
}

/** Cellen onder een lijnstuk (kaarteenheden) van (x0, y0) naar (x1, y1), binnen de kaart, in volgorde, zonder dubbele:
 *  een snelle veeg slaat zo geen cel over (bemonsterd per kwart cel). */
export function strokeCells(grid, x0, y0, x1, y1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.25)), out = [], seen = new Set();
  for (let i = 0; i <= n; i++) {
    const p = cellAt(grid, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n), k = p.r * 1000 + p.c;
    if (!seen.has(k) && inside(grid, p.c, p.r)) { seen.add(k); out.push(p); }
  }
  return out;
}

/** Voetafdrukken langs een lijst cellen samenvoegen (zonder dubbele) */
export function footprint(grid, cells, tool) {
  if (tool !== "wide") return cells;
  const out = [], seen = new Set();
  for (const p of cells) for (const q of brushCells(grid, p.c, p.r, tool)) { const k = q.r * 1000 + q.c; if (!seen.has(k)) { seen.add(k); out.push(q); } }
  return out;
}

/** Vlakvulling: alle cellen binnen de kaart die via buren (vierkant 4, hex 6) aan (c, r) vastzitten en hetzelfde terrein
 *  hebben (ook "leeg"). Stopt bij een ander terrein en de kaartrand. Buiten de kaart = []. */
export function fillCells(grid, terr, c, r) {
  if (!inside(grid, c, r)) return [];
  const a = terr ? cellsOf(terr) : null, val = (x, y) => (a ? a[y * TERR.w + x] : 0), want = val(c, r);
  const seen = new Uint8Array(N), out = [], stack = [{ c, r }];
  seen[r * TERR.w + c] = 1;
  while (stack.length) {
    const p = stack.pop();
    out.push(p);
    for (const q of neighbors(grid, p.c, p.r)) {
      if (!inside(grid, q.c, q.r)) continue;
      const i = q.r * TERR.w + q.c;
      if (seen[i] || val(q.c, q.r) !== want) continue;
      seen[i] = 1;
      stack.push(q);
    }
  }
  return out;
}

/** Aantal geverfde cellen binnen de kaart (tests, diagnose) */
export function countTerr(grid, terr) {
  if (!terr) return 0;
  const a = cellsOf(terr);
  let n = 0;
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) if (a[r * TERR.w + c]) n++;
  return n;
}

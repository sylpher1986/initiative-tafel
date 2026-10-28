// Inn the Grid (G4, WP61): objecten op de kaart, puur (geen DOM, Node-testbaar). Een object = { id, asset, x, y, w, h,
// rot, layer }: x/y = MIDDELPUNT in kaarteenheden (1 cel = 1; draaien in WP62 gebeurt om dat punt), w/h = grootte in
// cellen, rot = graden (0…359; WP61 plaatst altijd 0), layer = "floor" | "object". Volgorde: de lijst is de tekenvolgorde
// binnen een laag (later = erboven); een apart z-veld is niet nodig (naar voren/achteren in WP62 = herordenen).
// Objecten blijven staan als het raster kleiner wordt (niets stil weggooien); ze mogen dus buiten de kaart liggen.
import { builtin, cleanAssetRef } from "./assets.js";
import { bounds, cellAt, cellCenter } from "./grid.js";

/** Grenzen (D10: objecten 2000 als advies, bijstellen na WP66; grootte en positie ruim, maar eindig) */
export const OBJ = { max: 2000, minSize: 0.25, maxSize: 20, maxPos: 1000 };
export const LAYERS = ["floor", "object"];
const ID_RE = /^[a-z0-9]{1,16}$/;

/** Nieuwe object-id (base36, uniek binnen de kaart: used = Set van bestaande id's) */
export function objId(used, rnd = Math.random) {
  for (;;) { const id = Math.floor(rnd() * 36 ** 8).toString(36).padStart(8, "0"); if (!used.has(id)) return id; }
}

const fin = (v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0; // + 0: geen -0

/** Eén object opschonen (zonder id-controle); null = onbruikbaar (geen geldige asset of positie) */
export function cleanObj(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const asset = cleanAssetRef(raw.asset), x = fin(raw.x), y = fin(raw.y);
  if (!asset || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const def = builtin(asset) || { w: 1, h: 1, layer: "object" };
  const size = (v, d) => { const n = fin(v); return r4(Number.isFinite(n) ? Math.min(OBJ.maxSize, Math.max(OBJ.minSize, n)) : d); };
  const pos = (v) => r4(Math.max(-OBJ.maxPos, Math.min(OBJ.maxPos, v)));
  const rot = fin(raw.rot);
  return { id: typeof raw.id === "string" ? raw.id : "", asset, x: pos(x), y: pos(y), w: size(raw.w, def.w), h: size(raw.h, def.h),
    rot: Number.isFinite(rot) ? r4(((rot % 360) + 360) % 360) % 360 : 0, layer: LAYERS.includes(raw.layer) ? raw.layer : def.layer };
}

/** Lijst opschonen: onbruikbare weg, ongeldige of dubbele id → nieuwe id, max OBJ.max (de rest valt weg: alleen bij
 *  een gemaakt of kapot bestand; de editor laat niet meer plaatsen). Geen lijst = []. */
export function cleanObjs(raw, rnd = Math.random) {
  if (!Array.isArray(raw)) return [];
  const out = [], used = new Set();
  for (const r of raw) {
    if (out.length >= OBJ.max) break;
    const o = cleanObj(r);
    if (!o) continue;
    if (!ID_RE.test(o.id) || used.has(o.id)) o.id = objId(used, rnd);
    used.add(o.id);
    out.push(o);
  }
  return out;
}

const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));

/**
 * Waar komt een nieuw object bij een tik op kaartpunt (px, py)? null = buiten de kaart (niets plaatsen).
 * snap aan: vierkant = de footprint (w × h cellen) valt op de cellen (oneven breedte: middelpunt op een celmidden, even:
 * op een lijn) en blijft binnen de kaart als hij past; hex = middelpunt op het celmidden van de getikte cel.
 * snap uit: middelpunt op het getikte punt, alleen binnen de kaart gehouden. Afgerond op 4 decimalen.
 */
export function placeAt(grid, px, py, w, h, snap) {
  const b = bounds(grid);
  if (!(px >= b.x && py >= b.y && px <= b.x + b.w && py <= b.y + b.h)) return null;
  let x = px, y = py;
  if (snap && grid.type === "hex") {
    const c = cellAt(grid, px, py), m = cellCenter(grid, Math.min(grid.cols - 1, Math.max(0, c.c)), Math.min(grid.rows - 1, Math.max(0, c.r)));
    return { x: r4(m.x), y: r4(m.y) };
  }
  if (snap) {
    const ax = (p, n) => (Math.round(n) % 2 ? Math.floor(p) + 0.5 : Math.round(p));
    x = ax(px, w); y = ax(py, h);
  }
  return { x: r4(clamp(x, b.x + w / 2, b.x + b.w - w / 2)), y: r4(clamp(y, b.y + h / 2, b.y + b.h - h / 2)) };
}

/** Nieuw object van een ingebouwd onderdeel op een plek (placeAt), id uniek binnen objs; null = onbekend onderdeel */
export function newObj(asset, at, objs, rnd = Math.random) {
  const d = builtin(asset);
  if (!d || !at) return null;
  return { id: objId(new Set(objs.map((o) => o.id)), rnd), asset, x: at.x, y: at.y, w: d.w, h: d.h, rot: 0, layer: d.layer };
}

/** Tekenvolgorde: eerst laag floor, dan object, binnen een laag de lijstvolgorde. Geeft { list, nf } (nf = aantal in
 *  laag floor). Lijsten worden nooit ter plekke gewijzigd, dus per lijst één keer berekend (geen nieuwe arrays per frame). */
const orders = new WeakMap();
export function drawOrder(objs) {
  let o = orders.get(objs);
  if (!o) { const f = objs.filter((x) => x.layer === "floor"); o = { list: [...f, ...objs.filter((x) => x.layer !== "floor")], nf: f.length }; orders.set(objs, o); }
  return o;
}

// ---- WP62: bewerken (selecteren, verplaatsen, draaien, schalen, laag, volgorde, dupliceren, verwijderen) ----
// Elke bewerking geeft een NIEUWE lijst met een nieuw object (history vergelijkt objs op identiteit) en laat de
// oorspronkelijke ongemoeid; een onbekende id = dezelfde lijst (niets veranderd).

const norm = (a) => r4(((a % 360) + 360) % 360) % 360; // eerst afronden, dan pas modulo: nooit 360
/** Draaiing een veelvoud van 90°? Dan valt de footprint op het raster (90/270: breedte en hoogte wisselen) */
export const square90 = (o) => o.rot % 90 === 0;
/** Footprint in cellen (as-evenwijdig) bij een rechte draaiing, anders null */
export const footprint = (o) => (!square90(o) ? null : o.rot % 180 ? { w: o.h, h: o.w } : { w: o.w, h: o.h });

/**
 * Middelpunt voor o bij kaartpunt (px, py) (slepen, toetsen, na draaien/schalen). Het punt wordt eerst binnen de kaart
 * gehouden (een object raakt nooit kwijt naast de kaart). snap aan: vierkant + rechte draaiing = de footprint op de
 * cellen (oneven: celmidden, even: lijn; bij precies het midden ertussen naar links/boven, zodat twee keer 90° draaien
 * het object terugzet waar het stond) en binnen de kaart als hij past; vierkant + scheve draaiing = celmidden; hex =
 * celmidden. snap uit: het punt.
 */
export function posAt(grid, o, px, py, snap) {
  const b = bounds(grid), cx = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  let x = cx(px, b.x, b.x + b.w), y = cx(py, b.y, b.y + b.h);
  if (snap && grid.type === "hex") {
    const c = cellAt(grid, x, y), m = cellCenter(grid, cx(c.c, 0, grid.cols - 1), cx(c.r, 0, grid.rows - 1));
    return { x: r4(m.x), y: r4(m.y) };
  }
  if (!snap) return { x: r4(x), y: r4(y) };
  const f = footprint(o);
  if (!f) return { x: r4(Math.min(grid.cols - 0.5, Math.floor(x) + 0.5)), y: r4(Math.min(grid.rows - 0.5, Math.floor(y) + 0.5)) };
  const ax = (p, n) => (Math.round(n) % 2 ? Math.floor(p) + 0.5 : Math.ceil(p - 0.5));
  x = ax(x, f.w); y = ax(y, f.h);
  return { x: r4(clamp(x, b.x + f.w / 2, b.x + b.w - f.w / 2)), y: r4(clamp(y, b.y + f.h / 2, b.y + b.h - f.h / 2)) };
}

/** Lijst met object id vervangen door fn(object) (fn geeft een nieuw object); onbekende id = dezelfde lijst */
export function mapObj(objs, id, fn) {
  const i = objs.findIndex((o) => o.id === id);
  if (i < 0) return objs;
  const out = objs.slice();
  out[i] = fn(objs[i]);
  return out;
}

/** Verplaatsen naar middelpunt (x, y), via posAt */
export const moveObj = (grid, o, x, y, snap) => ({ ...o, ...posAt(grid, o, x, y, snap) });

/** Draaien naar rot graden; bij snap opnieuw op het raster (de footprint kan gewisseld zijn) */
export function rotateObj(grid, o, rot, snap) {
  const n = { ...o, rot: norm(rot) };
  return snap ? { ...n, ...posAt(grid, n, n.x, n.y, true) } : n;
}

/** Eén kwartslag (dir +1 = met de klok mee, -1 = tegen de klok in) naar het volgende veelvoud van 90° */
export function turn90(grid, o, dir, snap) {
  const k = dir > 0 ? Math.floor(o.rot / 90 + 1e-9) + 1 : Math.ceil(o.rot / 90 - 1e-9) - 1;
  return rotateObj(grid, o, k * 90, snap);
}

/** Grootte in cellen (begrensd, 4 decimalen); bij snap opnieuw op het raster */
export function sizeObj(grid, o, w, h, snap) {
  const s = (v, d) => r4(Number.isFinite(v) ? Math.min(OBJ.maxSize, Math.max(OBJ.minSize, v)) : d);
  const n = { ...o, w: s(w, o.w), h: s(h, o.h) };
  return snap ? { ...n, ...posAt(grid, n, n.x, n.y, true) } : n;
}

/** Schalen vanaf een vaste hoek (schaalgreep): de linkerbovenhoek (eigen assen) van o blijft staan, nieuwe grootte
 *  nw × nh (begrensd); het middelpunt blijft binnen de kaart (zoals posAt) en ligt bij hex met snap op een celmidden. */
export function resizeFrom(grid, o, nw, nh, snap) {
  const n = sizeObj(grid, o, nw, nh, false), a = ((o.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const dx = (n.w - o.w) / 2, dy = (n.h - o.h) / 2; // het middelpunt schuift een halve groei op, in eigen assen
  const x = o.x + dx * c - dy * s, y = o.y + dx * s + dy * c, b = bounds(grid);
  if (snap && grid.type === "hex") return { ...n, ...posAt(grid, n, x, y, true) };
  return { ...n, x: r4(Math.min(b.x + b.w, Math.max(b.x, x))), y: r4(Math.min(b.y + b.h, Math.max(b.y, y))) };
}

/** Laag wisselen (floor | object); de lijstvolgorde blijft, de tekenvolgorde volgt uit de laag */
export const layerObj = (o, layer) => (LAYERS.includes(layer) ? { ...o, layer } : o);

/** Naar voren (dir "front": bovenaan binnen zijn laag = achteraan in de lijst) of naar achteren ("back"). Geeft dezelfde
 *  lijst als het al vooraan/achteraan ligt binnen zijn laag. */
export function reorder(objs, id, dir) {
  const i = objs.findIndex((o) => o.id === id);
  if (i < 0) return objs;
  const o = objs[i], same = objs.filter((x) => x.layer === o.layer);
  if ((dir === "front" ? same[same.length - 1] : same[0]) === o) return objs;
  const rest = objs.filter((x) => x !== o);
  return dir === "front" ? [...rest, o] : [o, ...rest];
}

/** Ligt o binnen zijn laag vooraan ("front") of achteraan ("back")? (knop uitzetten) */
export function atEdge(objs, id, dir) {
  const o = objs.find((x) => x.id === id);
  return !o || reorder(objs, id, dir) === objs;
}

/** Kopie van object id, één cel rechtsonder (past dat niet, linksboven), via posAt; bovenaan zijn laag. Geeft
 *  { objs, id } of null (onbekend of maximum bereikt). */
export function dupObj(grid, objs, id, snap, rnd = Math.random) {
  const o = objs.find((x) => x.id === id);
  if (!o || objs.length >= OBJ.max) return null;
  const nid = objId(new Set(objs.map((x) => x.id)), rnd);
  let p = posAt(grid, o, o.x + 1, o.y + 1, snap);
  if (p.x === o.x && p.y === o.y) p = posAt(grid, o, o.x - 1, o.y - 1, snap);
  return { objs: [...objs, { ...o, id: nid, ...p }], id: nid };
}

/** Lijst zonder object id */
export const removeObj = (objs, id) => (objs.some((o) => o.id === id) ? objs.filter((o) => o.id !== id) : objs);

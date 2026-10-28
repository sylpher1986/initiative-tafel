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

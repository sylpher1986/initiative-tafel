// Inn Sight (G4, WP73): handmatige fog of war per cel, puur (geen DOM, Node-testbaar). De fog hoort bij de kaart (besluit
// Michiel): bewerkt in Inn Sight én in de kaartviewer van Initiative, bewaard in het kaartdocument, dus ook in de export.
// Vorm { at, on, rev }: on = fog actief; rev = welke cellen onthuld zijn, als tekst van FOG.w·FOG.h / 4 hextekens (4 cellen
// per teken, bit k = cel 4·i + k, index r·w + c), net als terrein een vast raster los van kolommen/rijen. at = tijd van de
// laatste fogwijziging: twee schrijvers (een Inn Sight-tabblad en Initiative) bewaren de fog zo op "laatste wijziging wint"
// (mergeFog), zonder dat de ene de andere ongemerkt terugzet. Uit = { at, on: false } (zonder cellen): aanzetten begint
// altijd met alles verborgen (Michiel). Waarden worden nooit ter plekke gewijzigd: elke stap geeft een nieuw object.
import { LIMITS, inside, cellAt, cellCenter } from "./grid.js";
import { strokeCells, footprint } from "./terrain.js";

export const FOG = { w: LIMITS.maxCells, h: LIMITS.maxCells };
const N = FOG.w * FOG.h, LEN = N / 4;
const HEX = "0123456789abcdef";
const REV_RE = new RegExp(`^[0-9a-f]{${LEN}}$`);
const DARK = "0".repeat(LEN), ALL = "f".repeat(LEN);
// tijd in de toekomst (klok van een ander apparaat, gemaakt bestand) begrensd op nu: anders wint zo'n fog altijd (mergeFog)
const time = (v) => (Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), Date.now()) : 0);

/** Fog opschonen: null (geen fog-veld), { at, on: false } of { at, on: true, rev }. Kapotte cellen = alles verborgen
 *  (veilig: nooit per ongeluk iets onthullen). */
export function cleanFog(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const at = time(raw.at);
  if (raw.on !== true) return { at, on: false };
  return { at, on: true, rev: typeof raw.rev === "string" && REV_RE.test(raw.rev) ? raw.rev : DARK };
}

/** Zelfde fog met een nieuwe tijd (Inn Sight: elke wijziging, ook Ongedaan, is de nieuwste); de gedecodeerde cellen gaan
 *  mee, dus geen nieuwe decodering per beweging. */
export function stampFog(fog, at) {
  const out = fog.on ? { at, on: true, rev: fog.rev } : { at, on: false };
  const a = cache.get(fog);
  if (a) cache.set(out, a);
  return out;
}

/** Staat er fog op deze kaart? */
export const fogOn = (fog) => !!(fog && fog.on);

// Gedecodeerde cellen per fogobject (alleen lezen): 1 = onthuld
const cache = new WeakMap();
export function revOf(fog) {
  let a = cache.get(fog);
  if (!a) {
    a = new Uint8Array(N);
    const s = fog.rev || DARK;
    for (let i = 0; i < LEN; i++) { const d = HEX.indexOf(s[i]); for (let k = 0; k < 4; k++) a[i * 4 + k] = (d >> k) & 1; }
    cache.set(fog, a);
  }
  return a;
}
function encode(a) {
  let s = "";
  for (let i = 0; i < LEN; i++) s += HEX[a[i * 4] | (a[i * 4 + 1] << 1) | (a[i * 4 + 2] << 2) | (a[i * 4 + 3] << 3)];
  return s;
}

/** Is cel (c, r) verborgen? (geen fog = nee) */
export const hidden = (fog, c, r) => fogOn(fog) && !revOf(fog)[r * FOG.w + c];

/** Fog aan (alles verborgen) of uit */
export const setFogOn = (on, now = Date.now()) => (on ? { at: now, on: true, rev: DARK } : { at: now, on: false });

/** Cellen onthullen (reveal) of verbergen. Alleen cellen op de kaart; niets veranderd = hetzelfde object terug. */
export function revealCells(fog, grid, cells, reveal, now = Date.now()) {
  if (!fogOn(fog)) return fog;
  const a = revOf(fog), v = reveal ? 1 : 0;
  let b = null;
  for (const { c, r } of cells) {
    if (!inside(grid, c, r)) continue;
    const i = r * FOG.w + c;
    if (a[i] === v) continue;
    b ||= a.slice();
    b[i] = v;
  }
  if (!b) return fog;
  const out = { at: now, on: true, rev: encode(b) };
  cache.set(out, b);
  return out;
}

/** Hele kaart onthullen of verbergen (ook cellen buiten het huidige raster: een groter raster begint dan gelijk) */
export function revealAll(fog, reveal, now = Date.now()) {
  if (!fogOn(fog)) return fog;
  const rev = reveal ? ALL : DARK;
  return fog.rev === rev ? fog : { at: now, on: true, rev };
}

/** Gereedschap (Inn Sight en de kaartviewer van Initiative, UX WP73): Penseel, Breed, Rechthoek. Geen Vullen: op een
 *  kaart met alleen een achtergrond onthult dat in één tik alles. Gekozen gereedschap per apparaat (FOG_TOOL_KEY). */
export const FOG_TOOLS = ["brush", "wide", "rect"];
export const FOG_TOOL_KEY = "fog-tool";

/** Cellen waarvan het middelpunt in de rechthoek tussen twee kaartpunten ligt (vierkant en hex). Een rechthoek zonder
 *  celmidden (een tik) = de cel onder het eerste punt. Alleen cellen op de kaart. */
export function rectCells(grid, a, b) {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y), out = [];
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    const m = cellCenter(grid, c, r);
    if (m.x >= x0 && m.x <= x1 && m.y >= y0 && m.y <= y1) out.push({ c, r });
  }
  if (!out.length) { const p = cellAt(grid, a.x, a.y); if (inside(grid, p.c, p.r)) out.push(p); }
  return out;
}

/**
 * Eén veeg met het foggereedschap (puur; de UI zet scherm- om in kaartcoördinaten). get() = huidige fog, set(fog) =
 * tekenen (nog niet als stap vastleggen). Penseel/Breed werken meteen bij elke beweging; Rechthoek pas bij loslaten (tot
 * dan alleen het kader: frame()). Geeft { move(p), end() → true als de fog veranderde, cancel() (fog terug zoals vóór de
 * veeg), frame() → hoekpunten van de rechthoek (kaarteenheden) of null }.
 */
export function fogStroke({ grid, get, set, tool, reveal, at, now = () => Date.now() }) {
  const before = get();
  let last = at, live = true;
  const apply = (cells) => { const f = get(), n = revealCells(f, grid, cells, reveal, now()); if (n !== f) set(n); };
  if (tool !== "rect") apply(footprint(grid, strokeCells(grid, at.x, at.y, at.x, at.y), tool));
  return {
    move(p) {
      if (!live) return;
      if (tool !== "rect") apply(footprint(grid, strokeCells(grid, last.x, last.y, p.x, p.y), tool));
      last = p;
    },
    end() {
      if (!live) return false;
      live = false;
      if (tool === "rect") apply(rectCells(grid, at, last));
      return get() !== before;
    },
    cancel() { if (!live) return; live = false; if (get() !== before) set(before); },
    frame: () => (live && tool === "rect" ? [{ x: at.x, y: at.y }, { x: last.x, y: at.y }, { x: last.x, y: last.y }, { x: at.x, y: last.y }] : null),
  };
}

/** Aantal onthulde cellen op de kaart en het totaal (tests, diagnose) */
export function countFog(grid, fog) {
  const n = grid.cols * grid.rows;
  if (!fogOn(fog)) return { rev: n, n };
  const a = revOf(fog);
  let rev = 0;
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) rev += a[r * FOG.w + c];
  return { rev, n };
}

/** Welke fog bewaren als twee schrijvers botsen: de laatst gewijzigde (at); gelijk of onbekend = mine */
export const mergeFog = (stored, mine) => ((stored && stored.at || 0) > (mine && mine.at || 0) ? stored : mine);

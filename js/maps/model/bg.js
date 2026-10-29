// Inn Sight (G4, WP59): achtergrondafbeelding van een kaart, puur (geen DOM, Node-testbaar). Het raster ligt vast
// vanaf de oorsprong; de afbeelding schuift en schaalt eronder (docs/g4-inn-the-grid.md §2.3).
// bg = { asset, w, h, ppc, x, y }:
//   asset = sha256 (hex) van de opgeslagen bytes = sleutel in de IndexedDB-store "assets";
//   w, h  = afmetingen van het originele bestand in pixels (vóór verkleinen), zodat "pixels per cel" het getal is dat de
//           maker van de battle map noemt ("70 px grid"), ook als de opgeslagen versie kleiner is;
//   ppc   = pixels (van het origineel) per cel; "cellen in de breedte" = w / ppc is hetzelfde getal anders gezegd;
//   x, y  = linkerbovenhoek van de afbeelding in kaarteenheden (cellen).
import { LIMITS, HEX_R } from "./grid.js";
import { cleanSha, IMG } from "./image.js";

/** Grenzen: pixels per cel en verschuiving (cellen) */
export const BG = { minPpc: 4, maxPpc: IMG.maxInSide, maxOff: 1000 };
/** Gangbare celgroottes van battle maps (px per vak), in volgorde van voorkeur voor de startschatting */
export const COMMON_PPC = [70, 100, 140, 50, 200, 128, 64, 72, 150, 256, 300, 96, 120, 60, 40];

const fin = (v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const r4 = (v) => Math.round(v * 1e4) / 1e4; // 4 decimalen: genoeg voor subpixel, geen ruis van zwevende komma in de opslag

/** Achtergrond opschonen; null = geen (bruikbare) achtergrond */
export function cleanBg(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const asset = cleanSha(raw.asset);
  const w = fin(raw.w), h = fin(raw.h);
  if (!asset || !Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > IMG.maxInSide || h > IMG.maxInSide) return null;
  const p = fin(raw.ppc), x = fin(raw.x), y = fin(raw.y);
  const off = (v) => (Number.isFinite(v) ? r4(Math.max(-BG.maxOff, Math.min(BG.maxOff, v))) : 0);
  return { asset, w, h, ppc: r4(Number.isFinite(p) ? Math.max(BG.minPpc, Math.min(BG.maxPpc, p)) : Math.max(BG.minPpc, w / 20)), x: off(x), y: off(y) };
}

/** Rechthoek van de afbeelding in kaarteenheden */
export const bgRect = (bg) => ({ x: bg.x, y: bg.y, w: bg.w / bg.ppc, h: bg.h / bg.ppc });

/** Cellen in de breedte (afgerond op 2 decimalen voor weergave) */
export const across = (bg) => Math.round((bg.w / bg.ppc) * 100) / 100;

/**
 * Startschatting voor een nieuwe achtergrond: de eerste gangbare celgrootte die beide afmetingen precies deelt en een
 * raster binnen LIMITS geeft; anders de huidige kaartbreedte vullen (cols cellen in de breedte).
 */
export function guessPpc(w, h, cols) {
  for (const p of COMMON_PPC) {
    if (w % p || h % p) continue;
    const c = w / p, r = h / p;
    if (c >= 2 && r >= 2 && c <= LIMITS.maxCells && r <= LIMITS.maxCells) return p;
  }
  return Math.max(BG.minPpc, Math.min(BG.maxPpc, w / Math.max(1, cols)));
}

const clampCells = (n) => Math.max(LIMITS.minCells, Math.min(LIMITS.maxCells, n));

/**
 * Rasterafmetingen die de afbeelding bedekken (vanaf de oorsprong tot de rechter-/onderrand van de afbeelding), per
 * rastertype: { cols, rows } binnen LIMITS. Vierkant: afgerond op hele cellen (een afbeelding van 30,02 cellen = 30).
 * Afronding (UX-besluit WP59): tot 0,1 van een heel getal = dat getal, anders naar beneden (geen halve cel buiten de
 * afbeelding). Hex: het omgekeerde van bounds() in grid.js; "pixels per cel" is daar de afstand tussen twee celmiddens.
 */
export function gridFor(bg, grid) {
  const r = bgRect(bg), W = Math.max(0, r.x + r.w), H = Math.max(0, r.y + r.h);
  const round = (v) => (Math.abs(v - Math.round(v)) <= 0.1 + 1e-9 ? Math.round(v) : Math.floor(v));
  if (grid.type !== "hex") return { cols: clampCells(round(W)), rows: clampCells(round(H)) };
  if (grid.orient !== "flat") return { cols: clampCells(round(W - 0.5)), rows: clampCells(round((H - 2 * HEX_R) / (1.5 * HEX_R)) + 1) };
  return { cols: clampCells(round((W - 2 * HEX_R) / (1.5 * HEX_R)) + 1), rows: clampCells(round(H - 0.5)) };
}

/**
 * Invoer "pixels per cel" (komma of punt als decimaalteken): getal binnen BG.minPpc…min(BG.maxPpc, langste zijde), anders
 * null (de UI toont een foutregel).
 */
export function parsePpc(v, bg) {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!/^\d{1,5}(\.\d{1,3})?$/.test(s)) return null;
  const n = +s;
  return n >= BG.minPpc && n <= Math.min(BG.maxPpc, Math.max(bg.w, bg.h)) ? n : null;
}

/** Invoer "cellen in de breedte" → ppc, of null: 1…LIMITS.maxCells, decimalen toegestaan */
export function parseAcross(v, bg) {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const n = +s;
  if (!(n >= 1 && n <= LIMITS.maxCells)) return null;
  const p = bg.w / n;
  return p >= BG.minPpc ? p : null;
}

/** Nieuwe ppc toepassen; het kaartpunt (ax, ay) onder de afbeelding blijft op zijn plek (standaard de linkerbovenhoek) */
export function scaleBg(bg, ppc, ax = bg.x, ay = bg.y) {
  const k = bg.ppc / ppc;
  return cleanBg({ ...bg, ppc, x: ax + (bg.x - ax) * k, y: ay + (bg.y - ay) * k });
}

/** Verschuiven met (dx, dy) kaarteenheden */
export const moveBg = (bg, dx, dy) => cleanBg({ ...bg, x: bg.x + dx, y: bg.y + dy });

/** Stapgrootte van de pijlknoppen (UX-besluit WP59): 2 schermpixels bij zoom z, afgerond op hele pixels van het
 *  origineel (minstens 1), in kaarteenheden. Fijner = inzoomen. cell = CSS-px per cel bij 100 % (CELL in view.js). */
export const stepFor = (bg, z, cell) => Math.max(1, Math.round((2 / (cell * z)) * bg.ppc)) / bg.ppc;

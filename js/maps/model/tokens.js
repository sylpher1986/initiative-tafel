// Inn Sight (G4, WP74): vrije tokens, puur (geen DOM, Node-testbaar). Een token = gekleurde schijf met een kort label
// (besluiten Michiel): { id, x, y, s, c, l, hide? }. x/y = middelpunt in kaarteenheden, s = D&D-grootte in cellen (Tiny ½,
// Small/Medium 1, Large 2, Huge 3, Gargantuan 4; geen vrij schalen of draaien), c = kleur-id uit TOK_COLORS, l = label
// (0–3 tekens, gebruikersinhoud: nooit vertaald), hide = verborgen voor spelers. Tokens horen bij de kaart, net als fog
// (WP73): bewerkt in Inn Sight én verschoven in de kaartviewer van Initiative. Daarom een eigen veld met een tijd:
// toks = { at, list }, "laatste tokenwijziging wint" (mergeToks, zoals mergeFog), zodat een Inn Sight-tabblad een
// verschuiving uit Initiative nooit ongemerkt terugzet. Ook "geen tokens meer" wordt met een tijd bewaard ({ at, list: [] }).
// Lijsten en tokens worden nooit ter plekke gewijzigd: elke bewerking geeft een nieuwe lijst met een nieuw token.
import { LIMITS } from "./limits.js";
import { posAt } from "./objects.js";
import { bounds } from "./grid.js";

/** Grenzen: aantal per kaart, labellengte (codepunten), positie zoals objecten */
export const TOK = { max: LIMITS.toks, label: LIMITS.tokLabel, labelCp: LIMITS.tokLabelCp, maxPos: LIMITS.objMaxPos };
/** D&D-grootte in cellen; de id is de Engelse grootte (label via maps.tok.size.<id>) */
export const TOK_SIZES = [0.5, 1, 2, 3, 4];
export const SIZE_ID = { 0.5: "tiny", 1: "medium", 2: "large", 3: "huge", 4: "gargantuan" };
const WALNUT = "#241811", IVORY = "#faf6ec";
/** Kleuren (kaartinhoud: vast, niet per thema; leesbaar op een tv). ink = labelkleur met genoeg contrast op de schijf. */
export const TOK_COLORS = { // UX WP74: vaste hexwaarden (DM- en spelersbeeld gelijk); geen Lantern-goud (= selectie/primair)
  red: { fill: "#c0392b", ink: IVORY },
  orange: { fill: "#d9731a", ink: IVORY },
  yellow: { fill: "#e8c547", ink: WALNUT },
  green: { fill: "#2e8b57", ink: IVORY },
  blue: { fill: "#2f6fbf", ink: IVORY },
  purple: { fill: "#7b4bb3", ink: IVORY },
  white: { fill: "#f4efe4", ink: WALNUT },
  black: { fill: "#1e1e1e", ink: IVORY },
};
export const TOK_COLOR_IDS = Object.keys(TOK_COLORS);
/** Onbekende kleur-id (nieuwere versie): bewaren, grijs tekenen */
export const tokColor = (id) => TOK_COLORS[id] || { fill: "#8c7d6b", ink: IVORY };
/** Rand om elke schijf (UX: 2 px Walnut, 1 px Ivory erbuiten: zichtbaar op elke vloer en op een tv) */
export const TOK_EDGE = { inner: WALNUT, outer: IVORY };

const ID_RE = /^[a-z0-9]{1,16}$/, COLOR_RE = /^[a-z]{1,16}$/;
const fin = (v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
// tijd in de toekomst begrensd op nu (zoals cleanFog): anders wint zo'n veld altijd
const time = (v) => (Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), Date.now()) : 0);

// Tekens tellen als grafemen (UX: "★" of een emoji = één teken); zonder Intl.Segmenter (Safari < 14.1) per codepunt
let seg = null;
try { seg = new Intl.Segmenter(undefined, { granularity: "grapheme" }); } catch { seg = null; }
/** Label in tekens (grafemen) */
export const chars = (s) => (seg ? [...seg.segment(s)].map((x) => x.segment) : [...s]);
/** Label opschonen: tekst, stuurtekens en witruimte weg, max TOK.label tekens (geen half emoji) en TOK.labelCp codepunten;
 *  anders "". Bekend: zonder Intl.Segmenter (Safari < 14.1) telt een emoji met huidskleur als twee tekens. */
export function cleanLabel(v) {
  if (typeof v !== "string") return "";
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, "").replace(/\s+/g, " ").trim();
  let out = chars(s).slice(0, TOK.label).join("").trim();
  if ([...out].length > TOK.labelCp) out = [...out].slice(0, TOK.labelCp).join(""); // drie grafemen met eindeloos veel combinerende tekens
  return out;
}

/** Dichtstbijzijnde toegestane grootte (onbekend = Medium) */
export const cleanSize = (v) => (TOK_SIZES.includes(v) ? v : 1);

/** Eén token opschonen (zonder id-controle); null = onbruikbaar (geen positie) */
export function cleanTok(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const x = fin(raw.x), y = fin(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const pos = (v) => r4(Math.max(-TOK.maxPos, Math.min(TOK.maxPos, v)));
  const t = { id: typeof raw.id === "string" ? raw.id : "", x: pos(x), y: pos(y), s: cleanSize(raw.s),
    c: typeof raw.c === "string" && COLOR_RE.test(raw.c) ? raw.c : TOK_COLOR_IDS[0], l: cleanLabel(raw.l) };
  if (raw.hide === true) t.hide = true;
  return t;
}

/** Nieuwe token-id (base36, uniek binnen de lijst) */
export function tokId(used, rnd = Math.random) {
  for (;;) { const id = "t" + Math.floor(rnd() * 36 ** 7).toString(36).padStart(7, "0"); if (!used.has(id)) return id; }
}

/** Tokenveld opschonen: null (geen veld) of { at, list } met hooguit TOK.max geldige tokens, unieke id's */
export function cleanToks(raw, rnd = Math.random) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const list = [], used = new Set();
  if (Array.isArray(raw.list)) for (const r of raw.list) {
    if (list.length >= TOK.max) break;
    const t = cleanTok(r);
    if (!t) continue;
    if (!ID_RE.test(t.id) || used.has(t.id)) t.id = tokId(used, rnd);
    used.add(t.id);
    list.push(t);
  }
  return { at: time(raw.at), list };
}

/** Lijst van een (mogelijk ontbrekend) tokenveld */
export const tokList = (toks) => (toks && toks.list) || [];
/** Staan er tokens op de kaart? (schema 7) */
export const hasToks = (toks) => tokList(toks).length > 0;
/** Tokens die spelers zien (niet verborgen); fog ligt er in het spelersbeeld nog overheen */
export const playerToks = (toks) => tokList(toks).filter((t) => !t.hide);

/** Zelfde tokens met een nieuwe tijd (Inn Sight: elke wijziging, ook Ongedaan, is de nieuwste) */
export const stampToks = (toks, at) => ({ at, list: tokList(toks) });

/** Welke tokens bewaren als twee schrijvers botsen: de laatst gewijzigde (at); gelijk of onbekend = mine */
export const mergeToks = (stored, mine) => ((stored && stored.at || 0) > (mine && mine.at || 0) ? stored : mine);

/** Middelpunt voor een token van grootte s bij kaartpunt (px, py): als een recht object van s × s cellen (posAt) */
export const tokAt = (grid, s, px, py, snap) => posAt(grid, { w: s, h: s, rot: 0 }, px, py, snap);

/** Label na plaatsen of dupliceren (UX): eindigt het op een getal, dan één hoger (G1 → G2, 9 → 10); zonder getal, of
 *  als het volgende getal niet in TOK.label tekens past, hetzelfde label */
export function bumpLabel(l) {
  const m = /^(.*?)(\d+)$/.exec(l || "");
  if (!m) return l || "";
  const n = m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0");
  return chars(n).length <= TOK.label ? n : l;
}

/** Nieuw token op kaartpunt (px, py); null = buiten de kaart of maximum bereikt. def = { s, c, l, hide? } */
export function newTok(grid, list, px, py, def, snap, rnd = Math.random) {
  if (list.length >= TOK.max) return null;
  const b = bounds(grid); // naast de kaart: niets plaatsen (niet stil naar de rand klemmen, zoals placeAt)
  if (!(px >= b.x && py >= b.y && px <= b.x + b.w && py <= b.y + b.h)) return null;
  const s = cleanSize(def.s), p = tokAt(grid, s, px, py, snap);
  return cleanTok({ id: tokId(new Set(list.map((t) => t.id)), rnd), ...p, s, c: def.c, l: def.l, hide: !!def.hide });
}

/** Lijst met token id vervangen door fn(token) (nieuw token); onbekende id = dezelfde lijst */
export function mapTok(list, id, fn) {
  const i = list.findIndex((t) => t.id === id);
  if (i < 0) return list;
  const out = list.slice();
  out[i] = cleanTok({ ...fn(list[i]), id });
  return out;
}

/** Verplaatsen naar kaartpunt (x, y) (binnen de kaart, snap zoals objecten) */
export const moveTok = (grid, t, x, y, snap) => ({ ...t, ...tokAt(grid, t.s, x, y, snap) });
/** Grootte wisselen; bij snap opnieuw op het raster (even ↔ oneven verschuift het middelpunt een halve cel) */
export const sizeTok = (grid, t, s, snap) => { const n = { ...t, s: cleanSize(s) }; return snap ? { ...n, ...tokAt(grid, n.s, n.x, n.y, true) } : n; };

/** Bovenste token onder kaartpunt (px, py) (later in de lijst = erboven); pad = extra marge (tikdoel). Een exacte treffer
 *  wint van een treffer binnen de marge. */
export function hitTok(list, px, py, pad = 0) {
  const on = (t, m) => Math.hypot(px - t.x, py - t.y) <= t.s / 2 + m;
  for (let i = list.length - 1; i >= 0; i--) if (on(list[i], 0)) return list[i];
  if (pad > 0) for (let i = list.length - 1; i >= 0; i--) if (on(list[i], pad)) return list[i];
  return null;
}

/** Kaartviewer (UX WP74): token onder een vinger = het middelpunt dat het dichtst bij ligt, binnen zijn straal of
 *  minstens min kaarteenheden (tikdoel 44 px op het scherm); null = geen */
export function nearTok(list, px, py, min = 0) {
  let best = null, bd = Infinity;
  for (const t of list) { const d = Math.hypot(px - t.x, py - t.y); if (d <= Math.max(t.s / 2, min) && d < bd) { best = t; bd = d; } }
  return best;
}

/** Kopie van token id, één cel rechtsonder (past dat niet, linksboven), bovenaan; volgend label als het origineel een
 *  getal eindigde (bumpLabel, het eerste dat nog niet bestaat). → { list, id } of null (onbekend of maximum). */
export function dupTok(grid, list, id, snap, rnd = Math.random) {
  const t = list.find((x) => x.id === id);
  if (!t || list.length >= TOK.max) return null;
  const nid = tokId(new Set(list.map((x) => x.id)), rnd);
  let p = tokAt(grid, t.s, t.x + Math.max(1, t.s), t.y + Math.max(1, t.s), snap);
  if (p.x === t.x && p.y === t.y) p = tokAt(grid, t.s, t.x - Math.max(1, t.s), t.y - Math.max(1, t.s), snap);
  const used = new Set(list.map((x) => x.l));
  let l = bumpLabel(t.l);
  for (let i = 0; used.has(l) && i < TOK.max; i++) { const n = bumpLabel(l); if (n === l) break; l = n; } // eerste vrije: G1 → G3 als G2 al bestaat
  return { list: [...list, { ...t, id: nid, ...p, l }], id: nid };
}

/** Lijst zonder token id */
export const removeTok = (list, id) => (list.some((t) => t.id === id) ? list.filter((t) => t.id !== id) : list);
/** Naar voren (bovenaan = achteraan in de lijst): een geselecteerd of net versleept token ligt boven de rest */
export function tokFront(list, id) {
  const i = list.findIndex((t) => t.id === id);
  return i < 0 || i === list.length - 1 ? list : [...list.slice(0, i), ...list.slice(i + 1), list[i]];
}

// Inn the Grid (G4, WP58): kaartdocument, schema v1, puur (geen DOM, Node-testbaar). Eén kaart = één record in de
// IndexedDB-store "maps" (js/maps/store.js). v1 bevat alleen naam en raster; achtergrond, terrein en objecten komen in
// latere pakketten als optionele velden (docs/g4-inn-the-grid.md §2.3). Alles wat uit de opslag (of later een bestand)
// komt is onbetrouwbaar: altijd via cleanMap.
import { cleanGrid } from "./grid.js";

/** Schemaversie van het kaartdocument. Hoger dan bekend = niet aanraken (gemaakt door een nieuwere versie). */
export const SCHEMA = 1;
/** Langste kaartnaam (tekens) */
export const NAME_MAX = 60;

const ID_RE = /^[a-z0-9]{6,32}$/;

/** Nieuwe, unieke id (tijd + toeval, base36). now/rnd in te spuiten voor tests. */
export const mapId = (now = Date.now(), rnd = Math.random) => now.toString(36) + Math.floor(rnd() * 36 ** 6).toString(36).padStart(6, "0");

/** Kaartnaam opschonen: tekst, stuurtekens weg, witruimte samengevoegd, max NAME_MAX tekens; leeg → "" */
export function cleanName(v) {
  if (typeof v !== "string") return "";
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, " ").replace(/\s+/g, " ").trim();
  return [...s].slice(0, NAME_MAX).join("").trim(); // per codepunt: geen half emoji
}

/** Nieuwe kaart (schema v1). name moet al gekozen zijn (newName); grid optioneel. */
export function newMap({ id = mapId(), name = "", grid, now = Date.now() } = {}) {
  return { id, schema: SCHEMA, name: cleanName(name), createdAt: now, updatedAt: now, grid: cleanGrid(grid) };
}

/** Kaartdocument opschonen: bekende velden getypeerd en begrensd, onbekende weg. null = onbruikbaar (geen geldige id,
 *  geen object) of van een nieuwer schema (dan niet aanraken en niet tonen). */
export function cleanMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.id !== "string" || !ID_RE.test(raw.id)) return null;
  const schema = Number.isInteger(raw.schema) ? raw.schema : 1;
  if (schema > SCHEMA || schema < 1) return null;
  const time = (v) => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
  const updatedAt = time(raw.updatedAt), createdAt = time(raw.createdAt) || updatedAt;
  const grid = raw.grid && typeof raw.grid === "object" && !Array.isArray(raw.grid) ? raw.grid : {};
  return { id: raw.id, schema: SCHEMA, name: cleanName(raw.name), createdAt, updatedAt, grid: cleanGrid(grid) };
}

const key = (s) => s.toLocaleLowerCase();

/** Standaardnaam voor een nieuwe kaart: "<base> N" met de kleinste N ≥ 1 die nog niet bestaat (hoofdletterongevoelig) */
export function newName(base, names) {
  const used = new Set(names.map(key));
  for (let n = 1; ; n++) { const s = cleanName(`${base} ${n}`); if (!used.has(key(s))) return s; }
}

/** Naam uniek maken: bestaat hij al, dan "<naam> 2", "<naam> 3", … (voor dupliceren) */
export function uniqueName(name, names) {
  const used = new Set(names.map(key)), s = cleanName(name);
  if (!used.has(key(s))) return s;
  for (let n = 2; ; n++) {
    const tail = ` ${n}`, c = [...s].slice(0, NAME_MAX - tail.length).join("").trim() + tail;
    if (!used.has(key(c))) return c;
  }
}

/** Kopie van een kaart met nieuwe id, naam en tijden (dupliceren) */
export function copyMap(m, { id = mapId(), name, now = Date.now() } = {}) {
  const c = cleanMap(m);
  return c && { ...c, id, name: cleanName(name ?? c.name), createdAt: now, updatedAt: now };
}

/** Lijstvolgorde: laatst gewijzigd bovenaan, daarna naam, daarna id (stabiel) */
export const sortMaps = (list) => [...list].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** Welke kaart opent bij het laden: de laatst geopende als die nog bestaat, anders de laatst gewijzigde, anders null */
export function pickStart(list, lastId) {
  if (lastId && list.some((m) => m.id === lastId)) return lastId;
  return list.length ? sortMaps(list)[0].id : null;
}

/** Hoe lang geleden (voor de lijst): { k: "now" | "min" | "hour" | "day", n } tot 7 dagen, daarna (of bij een tijd in de
 *  toekomst of 0) null = toon de datum. De UI maakt er tekst van via de catalogus. */
export function ago(ts, now = Date.now()) {
  const s = (now - ts) / 1000;
  if (!(ts > 0) || s < -60) return null;
  if (s < 60) return { k: "now", n: 0 };
  if (s < 3600) return { k: "min", n: Math.floor(s / 60) };
  if (s < 86400) return { k: "hour", n: Math.floor(s / 3600) };
  if (s < 7 * 86400) return { k: "day", n: Math.floor(s / 86400) };
  return null;
}

// Inn the Grid (G4, WP58): opslag in een eigen IndexedDB "kevs-inn-maps", los van Initiative ("initiative-tafel").
// Stores: "maps" (kaartdocument, sleutel = id) en "assets" (afbeeldingen, sleutel = sha256; leeg tot WP59). Geen
// localStorage-terugval: een kaart hoort niet in 5 MB tekst; zonder IndexedDB (privémodus) werkt de editor in het
// geheugen en zegt de status "wordt niet bewaard" (js/maps/main.js). Laatst geopende kaart in localStorage (LAST_KEY).
// Alles wat gelezen wordt gaat door cleanMap (js/maps/model/map.js); records van een nieuwer schema blijven onaangeroerd.
import { cleanMap, sortMaps } from "./model/map.js";

export const DB = "kevs-inn-maps", DB_VERSION = 1, LAST_KEY = "maps-last";
let dbp = null, dbo = null; // dbo = open database: transacties dan synchroon starten (pagehide, zie tx)

/** Database openen (één keer). Faalt als IndexedDB ontbreekt of geblokkeerd is (privémodus, instelling). */
export function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis) || !globalThis.indexedDB) return reject(new Error("IndexedDB unavailable"));
    let req;
    try { req = indexedDB.open(DB, DB_VERSION); } catch (e) { return reject(e); }
    req.onupgradeneeded = (e) => { // versie-upgrade per stap; elke nieuwe versie voegt alleen toe
      const db = req.result;
      if (e.oldVersion < 1) { db.createObjectStore("maps", { keyPath: "id" }); db.createObjectStore("assets"); }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbp = null; dbo = null; }; // een nieuwere versie in een ander tabblad wil upgraden
      dbo = db;
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}

/* Transactie. Is de database al open, dan start hij synchroon in dezelfde taak: zo staat een schrijfactie uit pagehide
   (herladen of tabblad sluiten direct na een wijziging) al vast vóór de pagina weggaat; commit() waar dat bestaat. */
function tx(store, mode, fn) {
  const go = (db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("aborted"));
    if (mode === "readwrite" && t.commit) t.commit();
  });
  if (dbo) { try { return go(dbo); } catch (e) { return Promise.reject(e); } }
  return openDb().then(go);
}

/* Schrijven alleen zolang dit tabblad de eigenaar is (js/maps/tablock.js, D11). Een gestopt tabblad schrijft niets meer;
   dat telt als gelukt (geen rode status in een tabblad dat toch al stopt). */
let mayWrite = () => true;
export const setWriteGuard = (fn) => { mayWrite = fn; };

/** Werkt opslag hier? (privémodus/geen IndexedDB: false) */
export const available = () => openDb().then(() => true, () => false);

/** Alle bruikbare kaarten, opgeschoond en gesorteerd (laatst gewijzigd eerst); null als lezen niet lukt */
export async function listMaps() {
  try { return sortMaps(((await tx("maps", "readonly", (s) => s.getAll())) || []).map(cleanMap).filter(Boolean)); } catch { return null; }
}

/** Eén kaart (opgeschoond) of null */
export async function getMap(id) {
  try { return cleanMap(await tx("maps", "readonly", (s) => s.get(id))); } catch { return null; }
}

/** Kaart opslaan (vervangt het record met dezelfde id). false als het niet lukte. */
export async function putMap(doc) {
  if (!mayWrite()) return true;
  const c = cleanMap(doc);
  if (!c) return false;
  try { await tx("maps", "readwrite", (s) => s.put(c)); return true; } catch { return false; }
}

/** Kaart verwijderen. false als het niet lukte. */
export async function deleteMap(id) {
  if (!mayWrite()) return true;
  try { await tx("maps", "readwrite", (s) => s.delete(id)); return true; } catch { return false; }
}

/** Laatst geopende kaart (id of null) */
export function lastId() { try { return localStorage.getItem(LAST_KEY); } catch { return null; } }
export function setLastId(id) {
  if (!mayWrite()) return;
  try { id ? localStorage.setItem(LAST_KEY, id) : localStorage.removeItem(LAST_KEY); } catch { /* geen localStorage */ }
}

/** Vraagt de browser de opslag niet op te ruimen (Safari wist anders na 7 dagen zonder bezoek) */
export async function persistStorage() {
  try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch { return false; }
}

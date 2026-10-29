// Inn the Grid (G4, WP58): opslag in een eigen IndexedDB "kevs-inn-maps", los van Initiative ("initiative-tafel").
// Stores: "maps" (kaartdocument, sleutel = id) en "assets" (afbeeldingen, WP59: sleutel = sha256 van de opgeslagen bytes,
// record { data: ArrayBuffer, mime, w, h, ow, oh, src }; index "src" = sha256 van het originele bestand, zodat dezelfde
// upload twee keer één asset blijft zonder opnieuw te decoderen; versie 2) en "mine" (WP64, versie 3: Mijn assets,
// sleutel = sha, js/maps/model/mine.js). Versie 3 houdt ook een oudere Maps-versie (oude cache, ander tabblad) buiten:
// die opent de database niet meer (VersionError = alleen in het geheugen) en kan zo nooit bij het opstarten de eigen assets
// opruimen die hij niet kent. Geen
// localStorage-terugval: een kaart hoort niet in 5 MB tekst; zonder IndexedDB (privémodus) werkt de editor in het
// geheugen en zegt de status "wordt niet bewaard" (js/maps/main.js). Laatst geopende kaart in localStorage (LAST_KEY).
// Alles wat gelezen wordt gaat door cleanMap (js/maps/model/map.js); records van een nieuwer schema blijven onaangeroerd.
import { cleanMap, sortMaps } from "./model/map.js";
import { cleanItem, cleanItems, isCustom } from "./model/mine.js";

export const DB = "kevs-inn-maps", DB_VERSION = 3, LAST_KEY = "maps-last";
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
      if (e.oldVersion < 2) req.transaction.objectStore("assets").createIndex("src", "src", { unique: false }); // WP59
      if (e.oldVersion < 3) db.createObjectStore("mine", { keyPath: "sha" }); // WP64
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

// ---- WP59: afbeeldingen ----
const SHA = /^[0-9a-f]{64}$/;
const cleanAsset = (r) => (r && typeof r === "object" && r.data instanceof ArrayBuffer && typeof r.mime === "string" && r.w > 0 && r.h > 0 ? r : null);

/** Asset bewaren onder zijn sha256. false als het niet lukte (opslag vol, geblokkeerd, gestopt tabblad telt als gelukt). */
export async function putAsset(sha, rec) {
  if (!mayWrite()) return true;
  if (!SHA.test(sha) || !cleanAsset(rec)) return false;
  try { await tx("assets", "readwrite", (s) => s.put(rec, sha)); return true; } catch { return false; }
}

/** Asset (record) of null. Ook bij een (tijdelijke) leesfout null: de editor toont de achtergrond dan als ontbrekend tot
 *  de kaart opnieuw geopend wordt; dat is bewust (geen herhaalpogingen in een lus). */
export async function getAsset(sha) {
  if (!SHA.test(String(sha))) return null;
  try { return cleanAsset(await tx("assets", "readonly", (s) => s.get(sha))); } catch { return null; }
}

/** Bestaande asset bij hetzelfde originele bestand: { sha, rec } of null */
export async function findAsset(src) {
  if (!SHA.test(String(src))) return null;
  try {
    const key = await tx("assets", "readonly", (s) => s.index("src").getKey(src));
    if (typeof key !== "string") return null;
    const rec = await getAsset(key);
    return rec ? { sha: key, rec } : null;
  } catch { return null; }
}

/**
 * Opruimen bij het opstarten: assets waar geen enkele kaart meer naar verwijst. Alleen bij de start, zodat Ongedaan na
 * vervangen, verwijderen of kaart verwijderen de afbeelding in deze sessie nog terug kan zetten. Leest de ruwe records
 * (ook van een nieuwer schema): elke tekst in bg.asset, elke sha op een object (WP64) en elk item in Mijn assets telt als
 * verwijzing. Geeft het aantal verwijderde assets, of -1.
 */
export async function gcAssets() {
  if (!mayWrite()) return 0;
  try {
    // één readwrite-transactie over beide stores: een putAsset/putMap die intussen start, wacht tot het opruimen klaar is
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const t = db.transaction(["maps", "assets", "mine"], "readwrite");
      let n = 0;
      const keep = new Set();
      const gm = t.objectStore("maps").getAll();
      gm.onsuccess = () => {
        for (const m of gm.result || []) {
          if (!m || typeof m !== "object") continue;
          if (m.bg && typeof m.bg.asset === "string") keep.add(m.bg.asset);
          if (Array.isArray(m.objs)) for (const o of m.objs) if (o && isCustom(o.asset)) keep.add(o.asset);
        }
        const gi = t.objectStore("mine").getAllKeys();
        gi.onsuccess = () => {
          for (const k of gi.result || []) keep.add(k);
          const as = t.objectStore("assets"), gk = as.getAllKeys();
          gk.onsuccess = () => { for (const k of gk.result || []) if (!keep.has(k)) { as.delete(k); n++; } };
        };
      };
      t.oncomplete = () => resolve(n);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error("aborted"));
    });
  } catch { return -1; }
}

// ---- WP64: Mijn assets ----
/** Alle items, opgeschoond, nieuwste eerst; null als lezen niet lukt */
export async function listMine() {
  try { return cleanItems((await tx("mine", "readonly", (s) => s.getAll())) || []); } catch { return null; }
}

/** Item bewaren (vervangt het item met dezelfde sha). false als het niet lukte. */
export async function putMine(item) {
  if (!mayWrite()) return true;
  const c = cleanItem(item);
  if (!c) return false;
  try { await tx("mine", "readwrite", (s) => s.put(c)); return true; } catch { return false; }
}

/** Nieuwe afbeelding + item in één transactie (nooit een asset zonder item of omgekeerd). rec = null: de asset staat er
 *  al (zelfde bytes). Geeft true, "quota" (opslag vol) of false. */
export async function addMine(item, sha, rec) {
  if (!mayWrite()) return true;
  const c = cleanItem(item);
  if (!c || c.sha !== sha || (rec && !cleanAsset(rec))) return false;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const t = db.transaction(["assets", "mine"], "readwrite");
      let err = null;
      if (rec) { // alleen als hij ontbreekt: dezelfde bytes als een achtergrond houden diens record (en src)
        const as = t.objectStore("assets"), k = as.getKey(sha);
        k.onsuccess = () => { if (k.result === undefined) { try { as.put(rec, sha); } catch (e) { err = e; t.abort(); } } };
      }
      t.objectStore("mine").put(c);
      t.oncomplete = resolve;
      t.onerror = () => reject(err || t.error);
      t.onabort = () => reject(err || t.error || new Error("aborted"));
    });
    return true;
  } catch (e) { return e && e.name === "QuotaExceededError" ? "quota" : false; }
}

/** Item uit Mijn assets halen (de afbeelding blijft voor kaarten die hem gebruiken). false als het niet lukte. */
export async function deleteMine(sha) {
  if (!mayWrite()) return true;
  try { await tx("mine", "readwrite", (s) => s.delete(sha)); return true; } catch { return false; }
}

/** Opslaggebruik { usage, quota } of null (geen estimate) */
export async function estimate() {
  try { return navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch { return null; }
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

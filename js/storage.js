// Opslag in IndexedDB (ruimer en robuuster dan localStorage), met localStorage als terugval.
const DB = "initiative-tafel", STORE = "kv";
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const lsKey = (k) => `it-${k}`;

/* DA3: schrijven alleen zolang dit tabblad de eigenaar is (js/tablock.js). Een gestopt tabblad schrijft niets meer,
   ook geen opslag die nog onderweg was; dat telt als gelukt (geen waarschuwing "opslaan lukt niet"). */
let mayWrite = () => true;
export const setWriteGuard = (fn) => { mayWrite = fn; };
/** Is dit tabblad (nog) de eigenaar? Ook voor wat niet via deze module gaat (exportherinnering, kamer) */
export const canWrite = () => mayWrite();

export async function get(key, fallback) {
  try {
    const v = await tx("readonly", (s) => s.get(key));
    return v === undefined ? fallback : v;
  } catch {
    try { const v = localStorage.getItem(lsKey(key)); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
}

/** Slaat een waarde op; geeft false terug als opslaan nergens lukt */
export async function set(key, value) {
  if (!mayWrite()) return true;
  try { await tx("readwrite", (s) => s.put(value, key)); return true; }
  catch {
    try { localStorage.setItem(lsKey(key), JSON.stringify(value)); return true; } catch { return false; }
  }
}

/**
 * Meerdere wijzigingen in één transactie (alles of niets), alleen IndexedDB: geen localStorage-terugval,
 * want daar past de undo-geschiedenis niet in. ops: ["put", key, value] | ["del", key] | ["delRange", lo, hi].
 * Geeft false terug als het niet lukte.
 */
export async function batch(ops) {
  if (!mayWrite()) return true;
  try {
    await tx("readwrite", (s) => {
      for (const [op, a, b] of ops) {
        if (op === "put") s.put(b, a);
        else if (op === "del") s.delete(a);
        else s.delete(IDBKeyRange.bound(a, b));
      }
    });
    return true;
  } catch { return false; }
}

/** Alle waarden met een sleutel van lo t/m hi, op volgorde van sleutel; [] als het niet lukt */
export async function range(lo, hi) {
  try { return (await tx("readonly", (s) => s.getAll(IDBKeyRange.bound(lo, hi)))) || []; } catch { return []; }
}

/** Vraagt de browser om de opslag niet op te ruimen (Safari/Chrome kunnen dat anders doen) */
export async function persistStorage() {
  try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch { return false; }
}

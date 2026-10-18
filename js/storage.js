// Opslag in IndexedDB (ruimer en robuuster dan localStorage), met localStorage als terugval.
const DB = "initiative-tafel", STORE = "kv";
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) return reject(new Error("geen IndexedDB"));
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
  try { await tx("readwrite", (s) => s.put(value, key)); return true; }
  catch {
    try { localStorage.setItem(lsKey(key), JSON.stringify(value)); return true; } catch { return false; }
  }
}

/** Vraagt de browser om de opslag niet op te ruimen (Safari/Chrome kunnen dat anders doen) */
export async function persistStorage() {
  try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch { return false; }
}

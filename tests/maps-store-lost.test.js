// WP67: verloren IndexedDB-verbinding (WebKit op oudere iPads) herstelt bij de volgende transactie (js/maps/store.js, tx).
// Nagebootste IndexedDB: de eerste open database gooit InvalidStateError bij db.transaction, de tweede werkt.
import { test } from "node:test";
import assert from "node:assert/strict";

function fakeIdb() {
  const data = new Map();
  let opens = 0;
  const mkDb = (broken) => ({
    close() {},
    transaction() {
      if (broken.v) { const e = new Error("Connection to Indexed Database server lost"); e.name = "InvalidStateError"; throw e; }
      const t = { commit() { queueMicrotask(() => t.oncomplete && t.oncomplete()); } };
      t.objectStore = () => ({
        put(v) { data.set(v.id, v); return { result: v.id }; },
        get(k) { return { result: data.get(k) }; },
        getKey(k) { return { result: data.has(k) ? k : undefined }; },
        getAll() { return { result: [...data.values()] }; },
      });
      queueMicrotask(() => t.oncomplete && t.oncomplete());
      return t;
    },
  });
  return {
    get opens() { return opens; },
    broken: { v: false },
    open() {
      opens++;
      const req = {}, db = mkDb(opens === 1 ? this.broken : { v: false });
      req.result = db;
      queueMicrotask(() => req.onsuccess && req.onsuccess());
      return req;
    },
  };
}

test("WP67: na InvalidStateError opent tx de database opnieuw en slaagt de schrijfactie", async () => {
  const idb = fakeIdb();
  globalThis.indexedDB = idb;
  const store = await import("../js/maps/store.js?lost");
  assert.equal(await store.available(), true);
  assert.equal(idb.opens, 1);
  idb.broken.v = true; // verbinding weg
  const { newMap } = await import("../js/maps/model/map.js");
  const doc = newMap("Kaart 1"), id = doc.id;
  assert.equal(await store.putMap(doc), true, "schrijven lukt na opnieuw openen");
  assert.equal(idb.opens, 2);
  assert.ok(await store.getMap(id), "en is daarna leesbaar");
  assert.equal(idb.opens, 2, "geen nieuwe open zolang de verbinding werkt");
  delete globalThis.indexedDB;
});

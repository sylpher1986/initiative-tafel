// Inn Sight (G4, WP58): kaartdocument v1 (cleanMap, namen, volgorde, start), autosave (status, debounce, fouten) en
// tabblad-bewaking met eigen sleutel. Pure delen; de echte IndexedDB-rondreis staat in de browsercheck (wp58).
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEMA, NAME_MAX, mapId, cleanName, newMap, cleanMap, newName, uniqueName, copyMap, sortMaps, pickStart, ago } from "../js/maps/model/map.js";
import { createSaver, DELAY } from "../js/maps/save.js";
import { claimTab, stillMine, TAB_KEY } from "../js/maps/tablock.js";
import { TAB_KEY as INIT_TAB_KEY } from "../js/tablock.js";

test("mapId: uniek genoeg en geldig voor cleanMap", () => {
  const ids = new Set(Array.from({ length: 200 }, () => mapId()));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, /^[a-z0-9]{6,32}$/);
  assert.equal(mapId(0, () => 0), "0000000");
});

test("cleanName: stuurtekens, witruimte, lengte per codepunt, geen tekst → leeg", () => {
  assert.equal(cleanName("  Grot \n van\tDoom  "), "Grot van Doom");
  assert.equal(cleanName("a" + String.fromCharCode(0x202e) + "b" + String.fromCharCode(0xfeff)), "a b");
  assert.equal(cleanName(42), "");
  assert.equal(cleanName(null), "");
  assert.equal(cleanName("x".repeat(80)).length, NAME_MAX);
  const emo = cleanName("🐉".repeat(70));
  assert.equal([...emo].length, NAME_MAX, "geen half emoji");
  assert.equal(cleanName("<b>Kaart</b>"), "<b>Kaart</b>", "HTML blijft tekst (escapen gebeurt bij tonen)");
});

test("newMap en cleanMap: schema v1, raster opgeschoond, onbekende velden weg", () => {
  const m = newMap({ id: "abcdef1", name: " Kaart 1 ", now: 1000, grid: { cols: 500, type: "hex" } });
  assert.deepEqual({ ...m, grid: undefined }, { id: "abcdef1", schema: 1, name: "Kaart 1", createdAt: 1000, updatedAt: 1000, grid: undefined });
  assert.equal(m.grid.cols, 100);
  assert.equal(m.grid.type, "hex");
  const c = cleanMap({ ...m, evil: "<img onerror>", __proto__: { x: 1 }, grid: { ...m.grid, junk: 1 } });
  assert.deepEqual(Object.keys(c).sort(), ["createdAt", "grid", "id", "name", "schema", "updatedAt"]);
  assert.equal("junk" in c.grid, false);
  assert.deepEqual(cleanMap(c), c, "idempotent");
});

test("cleanMap: onbruikbaar = null, nieuwer schema niet aanraken, rare velden → standaard", () => {
  for (const bad of [null, 5, "x", [], {}, { id: "AB" }, { id: "ab" }, { id: "a b c d e" }, { id: "abcdef1", schema: SCHEMA + 1 }, { id: "abcdef1", schema: 0 }]) assert.equal(cleanMap(bad), null, JSON.stringify(bad));
  const c = cleanMap({ id: "abcdef1", name: ["x"], updatedAt: "gisteren", createdAt: -5, grid: [1, 2] });
  assert.equal(c.name, "");
  assert.equal(c.updatedAt, 0);
  assert.equal(c.createdAt, 0);
  assert.deepEqual([c.grid.type, c.grid.cols, c.grid.rows], ["square", 20, 15]);
  assert.equal(cleanMap({ id: "abcdef1", updatedAt: 5000 }).createdAt, 5000, "ontbrekend createdAt = updatedAt");
});

test("newName: kleinste vrije nummer, hoofdletterongevoelig", () => {
  assert.equal(newName("Map", []), "Map 1");
  assert.equal(newName("Map", ["Map 1", "map 2", "Map 4"]), "Map 3");
  assert.equal(newName("Kaart", ["Kaart 1 (kopie)"]), "Kaart 1");
});

test("uniqueName en copyMap: kopie krijgt nieuwe id, naam, tijden; raster gelijk", () => {
  assert.equal(uniqueName("Grot (copy)", []), "Grot (copy)");
  assert.equal(uniqueName("Grot (copy)", ["grot (copy)", "Grot (copy) 2"]), "Grot (copy) 3");
  assert.equal([...uniqueName("x".repeat(60), ["x".repeat(60)])].length, NAME_MAX, "blijft binnen NAME_MAX");
  const m = newMap({ id: "abcdef1", name: "Grot", now: 1, grid: { type: "hex", orient: "flat", cols: 7 } });
  const c = copyMap(m, { id: "zzzzzz9", name: "Grot (copy)", now: 99 });
  assert.deepEqual([c.id, c.name, c.createdAt, c.updatedAt], ["zzzzzz9", "Grot (copy)", 99, 99]);
  assert.deepEqual(c.grid, m.grid);
  assert.notEqual(c.grid, m.grid, "geen gedeeld rasterobject");
  assert.equal(copyMap({ id: "x" }), null);
});

test("sortMaps en pickStart: laatst gewijzigd eerst; laatst geopende wint als die bestaat", () => {
  const a = { id: "aaaaaa1", name: "B", updatedAt: 5 }, b = { id: "bbbbbb1", name: "A", updatedAt: 9 }, c = { id: "cccccc1", name: "A", updatedAt: 5 };
  assert.deepEqual(sortMaps([a, b, c]).map((m) => m.id), ["bbbbbb1", "cccccc1", "aaaaaa1"]);
  assert.equal(pickStart([a, b, c], "aaaaaa1"), "aaaaaa1");
  assert.equal(pickStart([a, b, c], "weg1234"), "bbbbbb1");
  assert.equal(pickStart([a, b, c], null), "bbbbbb1");
  assert.equal(pickStart([], "aaaaaa1"), null);
});

test("ago: zojuist, minuten, uren, dagen tot 7; daarna, 0 of toekomst = datum (null)", () => {
  const now = 10 * 86400e3;
  assert.deepEqual(ago(now - 20e3, now), { k: "now", n: 0 });
  assert.deepEqual(ago(now - 5 * 60e3, now), { k: "min", n: 5 });
  assert.deepEqual(ago(now - 3 * 3600e3, now), { k: "hour", n: 3 });
  assert.deepEqual(ago(now - 6 * 86400e3, now), { k: "day", n: 6 });
  assert.equal(ago(now - 8 * 86400e3, now), null);
  assert.equal(ago(0, now), null);
  assert.equal(ago(now + 3600e3, now), null);
  assert.deepEqual(ago(now + 30e3, now), { k: "now", n: 0 }, "klokverschil van seconden telt als zojuist");
});

// ---- autosave ----
function clock() {
  let now = 0, id = 0;
  const q = new Map();
  return {
    set: (fn, ms) => { q.set(++id, { fn, at: now + ms }); return id; },
    clear: (i) => q.delete(i),
    async tick(ms) {
      now += ms;
      for (const [i, j] of [...q]) if (j.at <= now) { q.delete(i); j.fn(); }
      for (let k = 0; k < 5; k++) await Promise.resolve(); // beloftes laten afwikkelen
      await new Promise((r) => setImmediate(r));
    },
    pending: () => q.size,
  };
}

test("autosave: wacht DELAY ms stilte, schrijft één keer, status pending → saving → saved", async () => {
  const c = clock(), seen = [];
  let writes = 0;
  const s = createSaver({ write: async () => { writes++; return true; }, onStatus: (x) => seen.push(x), set: c.set, clear: c.clear });
  assert.equal(s.status, "saved");
  s.touch(); await c.tick(200); s.touch(); await c.tick(200); s.touch();
  assert.equal(writes, 0);
  await c.tick(DELAY - 1);
  assert.equal(writes, 0, "nog niet stil genoeg");
  await c.tick(1);
  assert.equal(writes, 1);
  assert.deepEqual(seen, ["pending", "saving", "saved"]);
  assert.ok(DELAY <= 600, "acceptatie: binnen 1 s Opgeslagen");
});

test("autosave: flush schrijft meteen (pagehide); niets vuil = geen schrijfactie", async () => {
  const c = clock();
  let writes = 0;
  const s = createSaver({ write: async () => { writes++; return true; }, set: c.set, clear: c.clear });
  assert.equal(await s.flush(), true);
  assert.equal(writes, 0);
  s.touch();
  assert.equal(await s.flush(), true);
  assert.equal(writes, 1);
  assert.equal(c.pending(), 0, "timer opgeruimd");
});

test("autosave: fout blijft rood staan, ook bij nieuwe wijzigingen, tot een schrijfpoging lukt", async () => {
  const c = clock(), seen = [];
  let fail = true, writes = 0;
  const s = createSaver({ write: async () => { writes++; if (fail) throw new Error("QuotaExceeded"); return true; }, onStatus: (x) => seen.push(x), set: c.set, clear: c.clear });
  s.touch(); await c.tick(DELAY);
  assert.equal(s.status, "error");
  s.touch();
  assert.equal(s.status, "error", "geen wegflitsen naar Opslaan…");
  await c.tick(DELAY);
  assert.equal(s.status, "error");
  assert.equal(writes, 2, "elke wijziging probeert opnieuw");
  assert.equal(await s.flush(), false);
  fail = false;
  assert.equal(await s.flush(), true, "Opnieuw: de vuile wijziging wordt alsnog bewaard");
  assert.equal(s.status, "saved");
  assert.equal(seen.filter((x) => x === "pending" || x === "saving").length, 2, "alleen de eerste poging toonde Opslaan…");
  // write() die false teruggeeft telt ook als fout
  const s2 = createSaver({ write: async () => false, set: c.set, clear: c.clear });
  s2.touch(); await s2.flush();
  assert.equal(s2.status, "error");
});

test("autosave: wijziging tijdens het schrijven wordt daarna nog bewaard (niets verloren)", async () => {
  const c = clock();
  let release, writes = 0;
  const s = createSaver({ write: () => { writes++; return writes === 1 ? new Promise((r) => { release = () => r(true); }) : Promise.resolve(true); }, set: c.set, clear: c.clear });
  s.touch();
  const p = s.flush();
  s.touch(); // terwijl de eerste schrijfactie loopt
  const p2 = s.flush();
  await Promise.resolve(); await Promise.resolve(); // write() start in een microtask
  release();
  await p; await p2;
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((r) => setImmediate(r));
  assert.equal(writes, 2);
  assert.equal(s.status, "saved");
  assert.equal(s.dirty, false);
});

test("autosave: off (privémodus) = vaste status, touch doet niets; reset = schone lei", async () => {
  const c = clock();
  let writes = 0;
  const s = createSaver({ write: async () => { writes++; return true; }, set: c.set, clear: c.clear });
  s.touch(); s.reset();
  assert.equal(s.status, "saved");
  await c.tick(DELAY);
  assert.equal(writes, 0, "reset gooit een wachtende schrijfactie weg (kaart gewisseld na flush)");
  s.off();
  s.touch(); await c.tick(DELAY);
  assert.equal(s.status, "off");
  assert.equal(await s.flush(), false);
  s.reset();
  assert.equal(s.status, "off");
  assert.equal(writes, 0);
});

// ---- tabblad-bewaking (D11) ----
function browser() {
  const m = new Map();
  return {
    ls: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) },
    tab: () => { const win = new EventTarget(), doc = new EventTarget(); doc.visibilityState = "visible"; return { win, doc }; },
  };
}
const storageEv = (key) => Object.assign(new Event("storage"), { key });

test("tablock: eigen sleutel, los van Initiative; nieuwste wint", () => {
  assert.equal(TAB_KEY, "maps-tab");
  assert.notEqual(TAB_KEY, INIT_TAB_KEY);
  const b = browser(), A = b.tab(), B = b.tab();
  let lostA = 0, lostB = 0;
  const okA = claimTab(() => lostA++, { ls: b.ls, ...A, now: 1 });
  const okB = claimTab(() => lostB++, { ls: b.ls, ...B, now: 2 });
  A.win.dispatchEvent(storageEv(INIT_TAB_KEY)); // Initiative opent in een ander tabblad: Grid blijft
  assert.equal(lostA, 0);
  A.win.dispatchEvent(storageEv(TAB_KEY));
  A.win.dispatchEvent(storageEv(TAB_KEY));
  assert.equal(lostA, 1, "één keer");
  assert.equal(okA(), false);
  assert.equal(okB(), true);
  assert.equal(lostB, 0);
  assert.equal(stillMine(null, "x"), true);
});

test("tablock: geen localStorage (privémodus) = geen bewaking", () => {
  const ok = claimTab(() => { throw new Error("mag niet"); }, { ls: { setItem: () => { throw new Error("denied"); } }, win: new EventTarget(), doc: new EventTarget() });
  assert.equal(ok(), true);
});

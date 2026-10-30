// Inn Sight (G4, WP73): handmatige fog of war. Opslagvorm (cleanFog), onthullen/verbergen per cel en voor de hele kaart,
// rechthoek op celmiddens (vierkant en hex), één veeg (fogStroke: penseel, breed, rechthoek, terugzetten), schema 6,
// rondreis via het projectbestand, "laatste wijziging wint" in de opslag (putMap/putFog met een nagebootste IndexedDB),
// en dat de fog alleen ingebakken naar spelers gaat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { stampFog, FOG, FOG_TOOLS, FOG_TOOL_KEY, cleanFog, fogOn, setFogOn, revealCells, revealAll, hidden, rectCells, fogStroke, countFog, mergeFog, revOf } from "../js/maps/model/fog.js";
import { cleanGrid, cellCenter } from "../js/maps/model/grid.js";
import { cleanMap, newMap, copyMap, importedDoc, SCHEMA } from "../js/maps/model/map.js";
import { buildParts, readFile } from "../js/maps/model/file.js";

const ROOT = new URL("../", import.meta.url).pathname;
const hash = async (b) => createHash("sha256").update(b).digest("hex");
const SQ = cleanGrid({ cols: 10, rows: 8 });
const HP = cleanGrid({ type: "hex", orient: "pointy", cols: 9, rows: 7 });
const HF = cleanGrid({ type: "hex", orient: "flat", cols: 9, rows: 7 });
const keys = (cells) => cells.map((p) => `${p.c},${p.r}`).sort();

test("cleanFog: geen object = null, uit = { at, on: false }, kapotte cellen = alles verborgen (nooit per ongeluk onthullen)", () => {
  for (const bad of [null, undefined, 5, "x", []]) assert.equal(cleanFog(bad), null);
  assert.deepEqual(cleanFog({ at: 5, on: false, rev: "f".repeat(2500) }), { at: 5, on: false });
  assert.deepEqual(cleanFog({ on: "yes" }), { at: 0, on: false });
  const dark = cleanFog({ at: 7, on: true, rev: "zz" });
  assert.equal(dark.rev, "0".repeat(FOG.w * FOG.h / 4));
  assert.equal(countFog(SQ, dark).rev, 0);
  const f = cleanFog({ at: 9.4, on: true, rev: "f".repeat(2500), evil: 1 });
  assert.deepEqual(Object.keys(f).sort(), ["at", "on", "rev"]);
  assert.equal(f.at, 9);
  assert.deepEqual(cleanFog(f), f, "idempotent");
});

test("aanzetten = alles verborgen; onthullen en verbergen per cel, alleen op de kaart, zelfde object als er niets verandert", () => {
  const f0 = setFogOn(true, 100);
  assert.equal(fogOn(f0), true);
  assert.deepEqual(countFog(SQ, f0), { rev: 0, n: 80 });
  assert.equal(hidden(f0, 3, 2), true);
  const f1 = revealCells(f0, SQ, [{ c: 3, r: 2 }, { c: 4, r: 2 }, { c: 50, r: 50 }, { c: -1, r: 0 }], true, 200);
  assert.notEqual(f1, f0);
  assert.equal(f1.at, 200);
  assert.equal(hidden(f1, 3, 2), false);
  assert.equal(hidden(f1, 5, 2), true);
  assert.equal(countFog(SQ, f1).rev, 2, "cellen buiten de kaart tellen niet mee");
  assert.equal(revealCells(f1, SQ, [{ c: 3, r: 2 }], true, 300), f1, "al onthuld: geen nieuwe stap");
  const f2 = revealCells(f1, SQ, [{ c: 3, r: 2 }], false, 300);
  assert.equal(hidden(f2, 3, 2), true);
  assert.equal(revOf(f1)[2 * FOG.w + 3], 1, "f1 is niet ter plekke gewijzigd");
  // rondreis door de tekstvorm
  const back = cleanFog(JSON.parse(JSON.stringify(f1)));
  assert.equal(hidden(back, 4, 2), false);
  assert.equal(hidden(back, 4, 3), true);
  // uit: niets te onthullen, geen cellen bewaard
  const off = setFogOn(false, 400);
  assert.deepEqual(off, { at: 400, on: false });
  assert.equal(revealCells(off, SQ, [{ c: 1, r: 1 }], true), off);
  assert.equal(hidden(off, 1, 1), false);
  assert.equal(hidden(null, 1, 1), false);
});

test("alles onthullen en verbergen (ook buiten het huidige raster: een groter raster begint gelijk)", () => {
  const f = revealAll(setFogOn(true, 1), true, 2);
  assert.deepEqual(countFog(SQ, f), { rev: 80, n: 80 });
  assert.equal(hidden(f, 99, 99), false);
  assert.equal(revealAll(f, true, 3), f);
  const g = revealAll(f, false, 4);
  assert.equal(countFog(SQ, g).rev, 0);
});

test("rechthoek: cellen met hun middelpunt erin (vierkant, pointy en flat hex); een tik = de cel eronder", () => {
  assert.deepEqual(keys(rectCells(SQ, { x: 1.2, y: 1.2 }, { x: 3.8, y: 2.6 })), keys([{ c: 1, r: 1 }, { c: 2, r: 1 }, { c: 3, r: 1 }, { c: 1, r: 2 }, { c: 2, r: 2 }, { c: 3, r: 2 }]));
  assert.deepEqual(rectCells(SQ, { x: 3.8, y: 2.6 }, { x: 1.2, y: 1.2 }).length, 6, "richting maakt niet uit");
  assert.deepEqual(rectCells(SQ, { x: 2.1, y: 2.1 }, { x: 2.2, y: 2.2 }), [{ c: 2, r: 2 }]);
  assert.deepEqual(rectCells(SQ, { x: -5, y: -5 }, { x: -4, y: -4 }), [], "naast de kaart: niets");
  assert.equal(rectCells(SQ, { x: -50, y: -50 }, { x: 50, y: 50 }).length, 80);
  for (const g of [HP, HF]) {
    const a = cellCenter(g, 2, 2), b = cellCenter(g, 4, 3);
    const got = rectCells(g, { x: a.x - 0.01, y: a.y - 0.01 }, { x: b.x + 0.01, y: b.y + 0.01 });
    for (const p of got) { const m = cellCenter(g, p.c, p.r); assert.ok(m.x >= a.x - 0.01 && m.x <= b.x + 0.01 && m.y >= a.y - 0.01 && m.y <= b.y + 0.01); }
    assert.ok(got.some((p) => p.c === 2 && p.r === 2) && got.some((p) => p.c === 4 && p.r === 3), g.orient);
  }
});

test("fogStroke: penseel werkt meteen en volgt de veeg, breed neemt buren mee, rechthoek pas bij loslaten, cancel zet terug", () => {
  let fog = setFogOn(true, 1);
  const io = { grid: SQ, get: () => fog, set: (f) => { fog = f; } };
  let st = fogStroke({ ...io, tool: "brush", reveal: true, at: { x: 0.5, y: 0.5 }, now: () => 10 });
  assert.equal(hidden(fog, 0, 0), false, "eerste cel bij het neerzetten");
  st.move({ x: 4.5, y: 0.5 });
  assert.equal(countFog(SQ, fog).rev, 5, "geen gaten in een snelle veeg");
  assert.equal(st.frame(), null);
  assert.equal(st.end(), true);
  assert.equal(st.end(), false, "twee keer loslaten telt één keer");
  const before = fog;
  st = fogStroke({ ...io, tool: "wide", reveal: true, at: { x: 5.5, y: 5.5 } });
  assert.ok(countFog(SQ, fog).rev > 6, "breed = cel + buren");
  st.cancel();
  assert.equal(fog, before, "tweede vinger: terug zoals vóór de veeg");
  st = fogStroke({ ...io, tool: "rect", reveal: true, at: { x: 6.2, y: 4.2 } });
  st.move({ x: 8.8, y: 6.8 });
  assert.equal(fog, before, "rechthoek: tijdens slepen alleen het kader");
  assert.equal(st.frame().length, 4);
  assert.equal(st.end(), true);
  assert.equal(countFog(SQ, fog).rev, 5 + 9);
  st = fogStroke({ ...io, tool: "rect", reveal: false, at: { x: 0.5, y: 0.5 } });
  assert.equal(st.end(), true, "tik met rechthoek verbergt de cel eronder");
  assert.equal(hidden(fog, 0, 0), true);
  st = fogStroke({ ...io, tool: "brush", reveal: false, at: { x: 0.5, y: 0.5 } });
  assert.equal(st.end(), false, "niets veranderd = geen stap");
  assert.deepEqual(FOG_TOOLS, ["brush", "wide", "rect"]);
});

test("mergeFog: de laatst gewijzigde fog wint, ook uitzetten; geen fog-veld verliest van een bewaarde fog", () => {
  const a = setFogOn(true, 100), b = setFogOn(false, 200);
  assert.equal(mergeFog(a, b), b);
  assert.equal(mergeFog(b, a), b);
  assert.equal(mergeFog(a, null), a, "een tabblad dat de fog nog niet kende, gooit hem niet weg");
  assert.equal(mergeFog(null, a), a);
  assert.equal(mergeFog(a, { ...a }).on, true);
});

test("kaartdocument: fog aan = schema 6 (Maps 1.4.x laat de kaart met rust), uit blijft bewaard zonder schemasprong", () => {
  assert.equal(SCHEMA, 7); // WP74: 7 = tokens
  const m = newMap({ id: "abcdef1", name: "Grot", now: 1 });
  assert.equal(cleanMap({ ...m, fog: setFogOn(true, 5) }).schema, 6);
  const off = cleanMap({ ...m, fog: setFogOn(false, 5) });
  assert.equal(off.schema, 1);
  assert.deepEqual(off.fog, { at: 5, on: false });
  assert.equal("fog" in cleanMap({ ...m, fog: "x" }), false);
});

test("projectbestand: fog gaat mee en komt terug; een fog-veld dat geen fog is = badmap", async () => {
  const m = { ...newMap({ id: "abcdef1", name: "Grot", grid: SQ, now: 1 }), fog: revealCells(setFogOn(true, 5), SQ, [{ c: 2, r: 3 }], true, 6) };
  const r = buildParts(m, new Map(), { app: "Inn Sight test", now: new Date(0) });
  const text = r.parts.join("");
  const back = await readFile(text.length, text, { hash });
  assert.equal(back.ok, true);
  assert.equal(back.map.schema, 6);
  assert.equal(hidden(back.map.fog, 2, 3), false);
  assert.equal(hidden(back.map.fog, 3, 3), true);
  const bad = JSON.parse(text); bad.map.fog = "open";
  const t2 = JSON.stringify(bad);
  assert.deepEqual(await readFile(t2.length, t2, { hash }), { ok: false, code: "badmap" });
});

// Nagebootste IndexedDB met lezen-dan-schrijven in één transactie (oncomplete na de verzoeken)
function fakeIdb() {
  const data = new Map();
  const db = {
    close() {},
    transaction() {
      const t = { commit() {} };
      t.objectStore = () => ({
        put(v) { data.set(v.id, structuredClone(v)); return { result: v.id }; },
        get(k) { const r = { result: data.has(k) ? structuredClone(data.get(k)) : undefined }; queueMicrotask(() => r.onsuccess && r.onsuccess()); return r; },
        getAll() { return { result: [...data.values()] }; },
      });
      setTimeout(() => t.oncomplete && t.oncomplete(), 0);
      return t;
    },
  };
  return { data, open() { const req = { result: db }; queueMicrotask(() => req.onsuccess && req.onsuccess()); return req; } };
}

test("opslag: Initiative schrijft alleen de fog (putFog), een Inn Sight-tabblad met een oudere fog zet hem niet terug (putMap)", async () => {
  const idb = fakeIdb();
  globalThis.indexedDB = idb;
  try {
    const store = await import("../js/maps/store.js?fog");
    const doc = { ...newMap({ id: "abcdef1", name: "Grot", grid: SQ, now: 1000 }), fog: setFogOn(true, 1000) };
    assert.equal(await store.putMap(doc), true);
    // Initiative onthult een cel; de rest van de kaart (naam uit Inn Sight) blijft zoals in de opslag
    idb.data.get("abcdef1").name = "Grot (hernoemd)";
    const rev = revealCells(doc.fog, SQ, [{ c: 1, r: 1 }], true, 2000);
    const saved = await store.putFog("abcdef1", rev);
    assert.equal(saved.name, "Grot (hernoemd)");
    assert.equal(hidden(saved.fog, 1, 1), false);
    assert.ok(saved.updatedAt > 1000, "updatedAt omhoog: het spelersbeeld wordt opnieuw gemaakt");
    // Inn Sight-tabblad met de oude fog bewaart een andere wijziging: de nieuwere fog blijft
    assert.equal(await store.putMap({ ...doc, name: "Grot 2" }), true);
    const now = await store.getMap("abcdef1");
    assert.equal(now.name, "Grot 2");
    assert.equal(hidden(now.fog, 1, 1), false, "fog van Initiative niet teruggezet");
    // Inn Sight zet daarna de fog uit (nieuwer): dat wint
    assert.equal(await store.putMap({ ...doc, fog: setFogOn(false, 3000) }), true);
    assert.equal(fogOn((await store.getMap("abcdef1")).fog), false);
    // een oudere fog uit Initiative (botsing) wint niet; putFog geeft de bewaarde kaart terug
    const late = await store.putFog("abcdef1", rev);
    assert.equal(fogOn(late.fog), false);
    assert.equal(await store.putFog("zzzzzz9", rev), null, "kaart weg");
    idb.data.set("newer01", { id: "newer01", schema: SCHEMA + 1, name: "Toekomst", grid: {} });
    assert.equal(await store.putFog("newer01", rev), null, "nieuwer schema: niet aanraken");
    assert.equal(idb.data.get("newer01").fog, undefined);
  } finally { delete globalThis.indexedDB; }
});

test("spelers krijgen de fog alleen ingebakken; viewer en Inn Sight delen gereedschap en sleutel", () => {
  const br = readFileSync(ROOT + "js/ui/encmap.js", "utf8");
  assert.match(br, /drawBase\([^)]*fog: "player"/, "flatMap tekent de fog ondoorzichtig in het spelersbeeld");
  const pv = readFileSync(ROOT + "js/playerview.js", "utf8");
  assert.doesNotMatch(pv, /fog/i, "geen fog-veld in de snapshot");
  const mv = readFileSync(ROOT + "js/ui/mapview.js", "utf8");
  assert.match(mv, new RegExp(`FOG_KEY = "${FOG_TOOL_KEY}"`));
  assert.match(mv, new RegExp(`TOOLS = ${JSON.stringify(FOG_TOOLS).replace(/[[\]]/g, "\\$&").replace(/,/g, ", ")}`));
});

test("tijd: een fog uit de toekomst wint niet altijd (begrensd op nu); stampFog houdt de cellen", () => {
  const f = cleanFog({ at: Date.now() + 1e9, on: true, rev: "f".repeat(2500) });
  assert.ok(f.at <= Date.now());
  const g = revealCells(setFogOn(true, 1), SQ, [{ c: 1, r: 1 }], true, 2);
  const h = stampFog(g, 99);
  assert.equal(h.at, 99);
  assert.equal(h.rev, g.rev);
  assert.equal(revOf(h), revOf(g), "gedecodeerde cellen meegenomen (geen nieuwe decodering per beweging)");
  assert.deepEqual(stampFog(setFogOn(false, 1), 5), { at: 5, on: false });
  const m = cleanMap({ ...newMap({ id: "abcdef1", name: "Grot", now: 1 }), fog: setFogOn(true, 1) });
  assert.ok(importedDoc(m, [], "Kaart", { id: "abcdef2", now: 777 }).fog.at === 777, "import: fog van nu");
  assert.ok(copyMap(m, { id: "abcdef3", now: 888 }).fog.at === 888, "kopie: fog van nu");
});

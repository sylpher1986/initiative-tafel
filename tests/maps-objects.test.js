// Inn the Grid (G4, WP61): ingebouwde catalogus, objecten, plaatsen (vierkant en hex), undo/redo en de rondreis via
// opslag (cleanMap) en projectbestand (buildParts/readFile).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { BUILTIN, BUILTIN_IDS, CATS, builtin, inCat, assetUrl, cleanAssetRef } from "../js/maps/model/assets.js";
import { OBJ, cleanObj, cleanObjs, placeAt, newObj, drawOrder } from "../js/maps/model/objects.js";
import { createHistory, apply, HIST_MAX } from "../js/maps/model/history.js";
import { cleanMap, newMap, copyMap, SCHEMA } from "../js/maps/model/map.js";
import { buildParts, readFile } from "../js/maps/model/file.js";
import { cleanGrid, bounds, cellAt, cellCenter } from "../js/maps/model/grid.js";

const ROOT = new URL("../", import.meta.url).pathname;
const hash = async (b) => createHash("sha256").update(b).digest("hex");

// Bevroren: deze id's staan in opslag en exports. Een hernoemd, verwijderd of hergebruikt onderdeel breekt bestaande
// kaarten; alleen achteraan toevoegen mag (dan deze lijst aanvullen).
const FROZEN = ["flagstone", "planks", "dirt", "rug", "wall", "door", "stairs", "pillar", "trapdoor", "table", "chair", "bed", "shelf",
  "chest", "barrel", "crate", "altar", "tree", "bush", "rock", "pond", "log", "campfire", "tent"];

test("catalogus: id's bevroren, elk bestand bestaat met die naam, geen losse bestanden", () => {
  assert.deepEqual(BUILTIN_IDS, FROZEN);
  const files = readdirSync(ROOT + "data/maps-assets").sort();
  assert.deepEqual(files, [...FROZEN].map((id) => id + ".svg").sort(), "data/maps-assets/ = precies de catalogus");
  for (const id of FROZEN) assert.equal(assetUrl(id), `/data/maps-assets/${id}.svg`);
});

test("catalogus: velden geldig, elke categorie gevuld (max 8 per paneel), id als geldige verwijzing", () => {
  for (const [id, d] of Object.entries(BUILTIN)) {
    assert.ok(CATS.includes(d.cat), id);
    assert.ok(["floor", "object"].includes(d.layer), id);
    assert.ok(Number.isInteger(d.w) && Number.isInteger(d.h) && d.w >= 1 && d.h >= 1 && d.w <= 3 && d.h <= 3, id);
    assert.equal(cleanAssetRef(id), id);
    assert.match(id, /^[a-z0-9]+$/, id + ": catalogussleutel maps.asset.<id> kent geen streepje");
  }
  for (const c of CATS) { const n = inCat(c).length; assert.ok(n >= 1 && n <= 8, c + ": " + n); }
  assert.equal(builtin("constructor"), null);
  assert.equal(builtin("__proto__"), null);
});

test("SVG's: eigen tekening, veilig (geen script, geen externe verwijzing), viewBox = 100 per cel", () => {
  for (const [id, d] of Object.entries(BUILTIN)) {
    const s = readFileSync(ROOT + `data/maps-assets/${id}.svg`, "utf8");
    assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /, id);
    assert.doesNotMatch(s, /<script|\bon[a-z]+=|href=|<image|<foreignObject|url\(/i, id + ": niets uitvoerbaars of van buiten");
    assert.match(s, new RegExp(`viewBox="0 0 ${d.w * 100} ${d.h * 100}"`), id);
  }
});

test("cleanObj/cleanObjs: begrensd, onbekende velden weg, dubbele/ongeldige id nieuw, onbekend onderdeel blijft bewaard", () => {
  const o = cleanObj({ id: "a1", asset: "table", x: 3.123456, y: -2, w: 99, h: "2", rot: -90, layer: "x", evil: "<script>" });
  assert.deepEqual(o, { id: "a1", asset: "table", x: 3.1235, y: -2, w: OBJ.maxSize, h: 1, rot: 270, layer: "object" });
  assert.equal(cleanObj({ asset: "../x", x: 1, y: 1 }), null);
  assert.equal(cleanObj({ asset: "table", x: NaN, y: 1 }), null);
  assert.equal(cleanObj({ asset: "table", x: "1", y: 1 }), null);
  assert.equal(cleanObj(null), null);
  assert.equal(cleanObj({ asset: "table", x: 5000, y: 0 }).x, OBJ.maxPos);
  assert.equal(cleanObj({ asset: "table", x: 1, y: 1, rot: 359.99999 }).rot, 0);
  // een onderdeel uit een nieuwere versie of pakket: bewaard (plaatshouder), standaardmaat 1×1
  assert.deepEqual(cleanObj({ id: "z", asset: "lava-pool", x: 1, y: 1 }), { id: "z", asset: "lava-pool", x: 1, y: 1, w: 1, h: 1, rot: 0, layer: "object" });
  assert.equal(cleanObj({ asset: "pack/thing", x: 1, y: 1 }).asset, "pack/thing");
  let n = 0; const rnd = () => (++n * 0.137) % 1;
  const list = cleanObjs([{ id: "a", asset: "chair", x: 1, y: 1 }, { id: "a", asset: "chair", x: 2, y: 2 }, { id: "BAD!", asset: "rock", x: 0, y: 0 }, "x", { asset: "nope/../" }], rnd);
  assert.equal(list.length, 3);
  assert.equal(new Set(list.map((x) => x.id)).size, 3);
  assert.equal(list[0].id, "a");
  assert.deepEqual(cleanObjs("x"), []);
  assert.equal(cleanObjs(Array.from({ length: OBJ.max + 5 }, (_, i) => ({ id: "o" + i, asset: "rock", x: 0, y: 0 }))).length, OBJ.max);
});

test("placeAt vierkant: footprint op de cellen (oneven = celmidden, even = lijn), binnen de kaart; naast de kaart null", () => {
  const g = cleanGrid({ cols: 10, rows: 8 });
  assert.deepEqual(placeAt(g, 3.7, 2.2, 1, 1, true), { x: 3.5, y: 2.5 });
  assert.deepEqual(placeAt(g, 3.7, 2.2, 2, 1, true), { x: 4, y: 2.5 });
  assert.deepEqual(placeAt(g, 3.2, 2.2, 2, 3, true), { x: 3, y: 2.5 });
  assert.deepEqual(placeAt(g, 9.9, 7.9, 2, 2, true), { x: 9, y: 7 }, "aan de rand: footprint blijft binnen de kaart");
  assert.deepEqual(placeAt(g, 0.1, 0.1, 2, 3, true), { x: 1, y: 1.5 });
  assert.deepEqual(placeAt(g, 3.7, 2.2, 1, 1, false), { x: 3.7, y: 2.2 }, "zonder snap: het tikpunt");
  assert.deepEqual(placeAt(g, 0.1, 0.1, 2, 2, false), { x: 1, y: 1 }, "zonder snap: binnen de kaart gehouden");
  assert.equal(placeAt(g, -0.1, 2, 1, 1, true), null);
  assert.equal(placeAt(g, 3, 8.01, 1, 1, false), null);
  // groter dan de kaart: gecentreerd
  assert.deepEqual(placeAt(cleanGrid({ cols: 1, rows: 1 }), 0.5, 0.5, 2, 2, true), { x: 0.5, y: 0.5 });
});

test("placeAt hex (punt en plat): middelpunt op het celmidden van de getikte cel; naast de kaart null", () => {
  for (const orient of ["pointy", "flat"]) {
    const g = cleanGrid({ type: "hex", orient, cols: 9, rows: 7 }), b = bounds(g);
    for (let c = 0; c < g.cols; c++) for (let r = 0; r < g.rows; r++) {
      const m = cellCenter(g, c, r), at = placeAt(g, m.x + 0.1, m.y - 0.1, 2, 2, true);
      assert.deepEqual(cellAt(g, at.x, at.y), { c, r }, `${orient} ${c},${r}`);
      assert.ok(Math.abs(at.x - m.x) < 1e-3 && Math.abs(at.y - m.y) < 1e-3);
    }
    assert.equal(placeAt(g, b.w + 0.01, 1, 1, 1, true), null);
    // bewust: op hex wordt niet binnen de kaart geklemd; een 2×2-onderdeel in een hoekcel steekt over de rand
    assert.deepEqual(placeAt(g, cellCenter(g, 0, 0).x, cellCenter(g, 0, 0).y, 2, 2, true), { x: +cellCenter(g, 0, 0).x.toFixed(4), y: +cellCenter(g, 0, 0).y.toFixed(4) });
    // hoek van de omsluitende rechthoek buiten elke zeshoek: naar de dichtstbijzijnde kaartcel
    const at = placeAt(g, 0.001, 0.001, 1, 1, true), cell = cellAt(g, at.x, at.y);
    assert.ok(cell.c >= 0 && cell.r >= 0 && cell.c < g.cols && cell.r < g.rows);
  }
});

test("newObj: standaardmaat en laag uit de catalogus, unieke id, rot 0; drawOrder: vloer eerst", () => {
  const objs = [];
  for (const id of BUILTIN_IDS) objs.push(newObj(id, { x: 1, y: 1 }, objs));
  assert.equal(new Set(objs.map((o) => o.id)).size, BUILTIN_IDS.length);
  for (const o of objs) { const d = builtin(o.asset); assert.deepEqual([o.w, o.h, o.layer, o.rot], [d.w, d.h, d.layer, 0]); assert.deepEqual(cleanObj(o), o); }
  assert.equal(newObj("nope", { x: 1, y: 1 }, []), null);
  assert.equal(newObj("table", null, []), null);
  const { list: ord, nf } = drawOrder(objs);
  assert.equal(drawOrder(objs).list, ord, "per lijst één keer berekend");
  assert.equal(nf, objs.filter((o) => o.layer === "floor").length);
  const firstObj = ord.findIndex((o) => o.layer === "object");
  assert.ok(ord.slice(firstObj).every((o) => o.layer === "object"));
  assert.deepEqual(ord.filter((o) => o.layer === "floor").map((o) => o.id), objs.filter((o) => o.layer === "floor").map((o) => o.id), "binnen een laag de lijstvolgorde");
});

test("history: undo/redo over raster, achtergrond en objecten; nieuwe stap wist redo; max 100", () => {
  const h = createHistory();
  let doc = { grid: cleanGrid(), name: "x" };
  const step = (after, meta, group) => { const before = {}; for (const k of Object.keys(after)) before[k] = doc[k]; doc = apply(doc, after); return h.record(before, after, group, meta); };
  const g1 = doc.grid;
  step({ grid: cleanGrid({ cols: 30 }) }, { k: "grid" });
  step({ objs: [{ id: "a", asset: "chair", x: 1, y: 1 }] }, { k: "place", id: "chair" });
  step({ bg: { asset: "f".repeat(64), w: 10, h: 10, ppc: 5, x: 0, y: 0 } }, { k: "bg" });
  assert.equal(h.size, 3);
  assert.deepEqual(h.peek(), { undo: { k: "bg" }, redo: null });
  doc = apply(doc, h.undo());
  assert.equal("bg" in doc, false, "undefined = veld weg");
  doc = apply(doc, h.undo());
  assert.equal("objs" in doc, false);
  assert.deepEqual(h.peek(), { undo: { k: "grid" }, redo: { k: "place", id: "chair" } });
  doc = apply(doc, h.redo());
  assert.equal(doc.objs.length, 1);
  doc = apply(doc, h.undo()); doc = apply(doc, h.undo());
  assert.equal(doc.grid, g1);
  assert.equal(h.undo(), null);
  doc = apply(doc, h.redo());
  assert.ok(h.canRedo);
  step({ grid: cleanGrid({ cols: 5 }) }, { k: "grid" });
  assert.equal(h.canRedo, false, "nieuwe stap wist de redo-stapel");
  assert.equal(step({ grid: doc.grid }, { k: "grid" }), null, "niets veranderd = geen stap");
  for (let i = 0; i < HIST_MAX + 20; i++) step({ grid: cleanGrid({ cols: 1 + (i % 50) }) }, { k: "grid" });
  assert.equal(h.size, HIST_MAX);
  h.clear();
  assert.equal(h.canUndo || h.canRedo, false);
});

test("history: een groep (uitlijnsessie) is één stap; seal sluit; per saldo niets = geen stap; isTop", () => {
  const h = createHistory();
  let doc = { bg: { x: 0 } };
  const step = (after, group) => { const before = {}; for (const k of Object.keys(after)) before[k] = doc[k]; doc = apply(doc, after); return h.record(before, after, group, { k: "align" }); };
  const s1 = step({ bg: { x: 1 } }, "g1");
  step({ bg: { x: 2 } }, "g1");
  const s3 = step({ bg: { x: 3 } }, "g1");
  assert.equal(h.size, 1);
  assert.equal(s1, s3);
  assert.ok(h.isTop(s3));
  h.seal();
  step({ bg: { x: 4 } }, "g1");
  assert.equal(h.size, 2, "na seal een nieuwe stap, ook met dezelfde naam");
  assert.ok(!h.isTop(s3));
  assert.deepEqual(h.undo(), { bg: { x: 3 } });
  assert.deepEqual(h.undo(), { bg: { x: 0 } });
  doc = { bg: { x: 0 } };
  step({ bg: { x: 5 } }, "g2");
  step({ bg: { x: 0 } }, "g2");
  assert.equal(h.size, 0, "terug op het begin: de groep verdwijnt");
});

test("kaartdocument: objecten → schema 3 (Maps 0.5.0 laat zo'n kaart met rust), zonder objecten v1/v2; kopie houdt ze", () => {
  assert.equal(SCHEMA, 5); // WP63: 4 = terrein, WP64: 5 = eigen assets
  const m = newMap({ id: "abc123", name: "Crypte" });
  assert.equal(cleanMap(m).schema, 1);
  assert.equal("objs" in cleanMap({ ...m, objs: [] }), false);
  const objs = [{ id: "o1", asset: "table", x: 2, y: 1.5, w: 2, h: 1, rot: 0, layer: "object" }];
  const c = cleanMap({ ...m, objs });
  assert.equal(c.schema, 3);
  assert.deepEqual(c.objs, objs);
  assert.equal(cleanMap({ ...m, schema: 6 }), null); // WP63: 4 = terrein, WP64: 5 = eigen assets, 6 = nieuwer
  const k = copyMap(c, { id: "def456", name: "Kopie" });
  assert.deepEqual(k.objs, objs);
});

test("rondreis: elk ingebouwd onderdeel op vierkant en hex → opslag (cleanMap) en export/import → zelfde plek", async () => {
  for (const grid of [{ cols: 12, rows: 10 }, { type: "hex", orient: "pointy", cols: 12, rows: 10 }, { type: "hex", orient: "flat", cols: 12, rows: 10 }]) {
    const g = cleanGrid(grid), objs = [];
    BUILTIN_IDS.forEach((id, i) => { const d = builtin(id), m = cellCenter(g, i % 12, Math.floor(i / 12) * 3 + 1); objs.push(newObj(id, placeAt(g, m.x, m.y, d.w, d.h, true), objs)); });
    const doc = cleanMap({ ...newMap({ id: "rt0001", name: "Rondreis", grid: g }), objs });
    assert.equal(doc.objs.length, BUILTIN_IDS.length);
    assert.deepEqual(cleanMap(JSON.parse(JSON.stringify(doc))), doc, "opslag (structured clone ≈ JSON)");
    const { parts } = buildParts(doc, new Map(), { app: "Inn the Grid test", now: new Date(0) });
    const text = parts.join("");
    assert.ok(!JSON.parse(text).assets || !Object.keys(JSON.parse(text).assets).length, "ingebouwde onderdelen niet als afbeelding in het bestand");
    const r = await readFile(text.length, text, { hash });
    assert.equal(r.ok, true);
    assert.deepEqual(r.map.objs, doc.objs);
    assert.equal(r.map.schema, 3);
  }
});

test("import: kwaadaardige objecten worden opgeschoond of geweigerd, een bestand van een nieuwer schema = newer", async () => {
  const head = { format: "kevs-inn-maps", version: 1, exported: "x", app: "x" };
  const file = (map) => JSON.stringify({ ...head, map, assets: {} });
  const base = { schema: 3, name: "x", grid: { cols: 5, rows: 5 } };
  let t = file({ ...base, objs: [{ id: "<img>", asset: "chair", x: 1, y: 1, onload: "x" }, { asset: "javascript:alert(1)", x: 1, y: 1 }, { asset: "rock", x: 1e9, y: -1e9, w: -5 }] });
  let r = await readFile(t.length, t, { hash });
  assert.equal(r.ok, true);
  assert.equal(r.map.objs.length, 2);
  assert.match(r.map.objs[0].id, /^[a-z0-9]{1,16}$/);
  assert.equal(r.map.objs[0].onload, undefined);
  assert.deepEqual([r.map.objs[1].x, r.map.objs[1].y, r.map.objs[1].w], [OBJ.maxPos, -OBJ.maxPos, OBJ.minSize]);
  t = file({ ...base, schema: 6 }); // WP63: 4 = terrein, WP64: 5 = eigen assets
  r = await readFile(t.length, t, { hash });
  assert.deepEqual(r, { ok: false, code: "newer" });
});

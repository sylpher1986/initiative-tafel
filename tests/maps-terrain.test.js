// Inn Sight (G4, WP63): terrein per cel. Opslagvorm (cleanTerr), verven en wissen, penseel/breed, veeg zonder gaten,
// vlakvulling (stopt bij ander terrein en de kaartrand, vierkant en beide hex-oriëntaties), schema 4, rondreis via opslag
// en projectbestand, één veeg = één undo-stap, en het budget voor 100×100 volverven.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { TERRAINS, TOOLS, TERR, cleanTerr, cellsOf, terrAt, paintCells, brushCells, strokeCells, footprint, fillCells, countTerr } from "../js/maps/model/terrain.js";
import { cleanGrid, inside, cellCenter, neighbors } from "../js/maps/model/grid.js";
import { cleanMap, newMap, copyMap } from "../js/maps/model/map.js";
import { buildParts, readFile } from "../js/maps/model/file.js";
import { createHistory, apply } from "../js/maps/model/history.js";

const hash = async (b) => createHash("sha256").update(b).digest("hex");
const SQ = cleanGrid({ cols: 10, rows: 8 });
const HP = cleanGrid({ type: "hex", orient: "pointy", cols: 9, rows: 7 });
const HF = cleanGrid({ type: "hex", orient: "flat", cols: 9, rows: 7 });
const rect = (c0, r0, c1, r1) => { const o = []; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) o.push({ c, r }); return o; };
const keys = (cells) => cells.map((p) => `${p.c},${p.r}`).sort();

test("terreintypen en gereedschappen bevroren (id's in opslag en export; alleen achteraan toevoegen)", () => {
  assert.deepEqual(TERRAINS, ["stone", "wood", "grass", "dirt", "water", "sand", "lava", "void"]);
  assert.deepEqual(TOOLS, ["brush", "wide", "fill"]);
  for (const id of TERRAINS) assert.match(id, /^[a-z0-9]+$/, "catalogussleutel maps.terr.<id>");
  assert.equal(TERR.w, 100); assert.equal(TERR.h, 100);
});

test("verven en wissen: nieuw object, zelfde object als er niets verandert, null als alles weg is", () => {
  const a = paintCells(null, [{ c: 1, r: 2 }, { c: 2, r: 2 }], "grass");
  assert.deepEqual(a.ids, ["grass"]);
  assert.equal(a.cells.length, TERR.w * TERR.h);
  assert.equal(terrAt(a, 1, 2), "grass"); assert.equal(terrAt(a, 0, 0), null);
  assert.equal(paintCells(a, [{ c: 1, r: 2 }], "grass"), a, "zelfde terrein: zelfde object (geen undo-stap)");
  assert.equal(paintCells(null, [{ c: 0, r: 0 }], null), null, "wissen op leeg");
  const b = paintCells(a, [{ c: 1, r: 2 }], "water");
  assert.notEqual(b, a);
  assert.equal(terrAt(a, 1, 2), "grass", "het oude object blijft ongewijzigd (undo houdt verwijzingen vast)");
  assert.deepEqual(b.ids, ["grass", "water"]);
  const c = paintCells(b, [{ c: 2, r: 2 }], null);
  assert.deepEqual(c.ids, ["water"], "ongebruikte id uit het palet");
  assert.equal(terrAt(c, 1, 2), "water");
  assert.equal(paintCells(c, [{ c: 1, r: 2 }], null), null, "alles gewist = geen terrein");
  assert.equal(paintCells(a, [{ c: -1, r: 0 }, { c: 100, r: 0 }, { c: 0.5, r: 0 }], "sand"), a, "buiten het vaste raster: niets");
  assert.equal(paintCells(a, [{ c: 0, r: 0 }], "Bad-Id"), a, "ongeldige id: niets");
});

test("cleanTerr: rondreis, opschonen, ander raster, kwaadaardige invoer", () => {
  const a = paintCells(paintCells(null, rect(0, 0, 3, 3), "stone"), rect(5, 5, 6, 6), "lava");
  assert.deepEqual(cleanTerr(JSON.parse(JSON.stringify(a))), { w: 100, h: 100, ids: a.ids, cells: a.cells });
  for (const bad of [null, 5, "x", [], {}, { w: 100, h: 100, ids: ["grass"], cells: "1" }, { w: 0, h: 1, ids: [], cells: "" },
    { w: 2, h: 1, ids: "grass", cells: "11" }, { w: 1.5, h: 1, ids: [], cells: "1" }, { w: 100, h: 100, ids: Array(36).fill("a"), cells: "0".repeat(10000) }])
    assert.equal(cleanTerr(bad), null, JSON.stringify(bad)?.slice(0, 60));
  // klein raster van een (gemaakt) bestand → vast raster; teken buiten palet of alfabet = leeg; dubbele id samengevoegd
  const t = cleanTerr({ w: 3, h: 2, ids: ["grass", "grass", "BAD", "future9"], cells: "12z" + "34é" });
  assert.equal(terrAt(t, 0, 0), "grass"); assert.equal(terrAt(t, 1, 0), "grass"); assert.equal(terrAt(t, 2, 0), null);
  assert.equal(terrAt(t, 0, 1), null, "ongeldige id = leeg"); assert.equal(terrAt(t, 1, 1), "future9", "onbekende (toekomstige) id blijft");
  assert.equal(terrAt(t, 2, 1), null);
  assert.deepEqual(t.ids, ["grass", "future9"]);
  assert.equal(cleanTerr({ w: 1, h: 1, ids: ["grass"], cells: "0" }), null, "niets geverfd = geen terrein");
  const big = cleanTerr({ w: 120, h: 1, ids: ["sand"], cells: "1".repeat(120) });
  assert.equal(countTerr(cleanGrid({ cols: 100, rows: 1 }), big), 100, "groter raster wordt bijgesneden");
  assert.equal(cleanTerr({ w: 1, h: 1, ids: ["__proto__"], cells: "1" }), null);
});

test("penseel en breed: vierkant 1 / 3×3, hex 1 / 7, altijd binnen de kaart", () => {
  assert.deepEqual(brushCells(SQ, 3, 3, "brush"), [{ c: 3, r: 3 }]);
  assert.deepEqual(keys(brushCells(SQ, 3, 3, "wide")), keys(rect(2, 2, 4, 4)));
  assert.deepEqual(keys(brushCells(SQ, 0, 0, "wide")), keys(rect(0, 0, 1, 1)), "hoek: alleen binnen de kaart");
  assert.deepEqual(brushCells(SQ, 10, 0, "brush"), [], "buiten de kaart");
  for (const g of [HP, HF]) {
    assert.equal(brushCells(g, 4, 3, "wide").length, 7);
    assert.deepEqual(keys(brushCells(g, 4, 3, "wide").slice(1)), keys(neighbors(g, 4, 3)));
    assert.ok(brushCells(g, 0, 0, "wide").every((p) => inside(g, p.c, p.r)));
  }
  assert.deepEqual(footprint(SQ, [{ c: 1, r: 1 }, { c: 2, r: 1 }], "brush"), [{ c: 1, r: 1 }, { c: 2, r: 1 }]);
  assert.equal(footprint(SQ, [{ c: 3, r: 3 }, { c: 4, r: 3 }], "wide").length, 12, "zonder dubbele");
});

test("veeg: elke cel onder een snel lijnstuk, zonder gaten, zonder dubbele, binnen de kaart", () => {
  const s = strokeCells(SQ, 0.5, 0.5, 9.5, 7.5);
  for (let i = 1; i < s.length; i++) assert.ok(Math.abs(s[i].c - s[i - 1].c) <= 1 && Math.abs(s[i].r - s[i - 1].r) <= 1, "aaneengesloten");
  assert.deepEqual(s[0], { c: 0, r: 0 }); assert.deepEqual(s[s.length - 1], { c: 9, r: 7 });
  assert.equal(new Set(keys(s)).size, s.length);
  assert.deepEqual(strokeCells(SQ, -3, 0.5, 2.5, 0.5).map((p) => p.c), [0, 1, 2], "naast de kaart begonnen: alleen het deel erop");
  assert.deepEqual(strokeCells(SQ, 2.2, 2.2, 2.2, 2.2), [{ c: 2, r: 2 }], "tik = één cel");
  for (const g of [HP, HF]) {
    const a = cellCenter(g, 0, 0), b = cellCenter(g, 8, 6), h = strokeCells(g, a.x, a.y, b.x, b.y);
    for (let i = 1; i < h.length; i++) assert.ok(keys(neighbors(g, h[i - 1].c, h[i - 1].r)).includes(`${h[i].c},${h[i].r}`), "hex: steeds een buurcel");
  }
});

test("vlakvulling stopt bij een ander terrein en bij de kaartrand (vierkant, hex punt, hex plat)", () => {
  for (const g of [SQ, HP, HF]) {
    // muur van steen op kolom 4: links vullen raakt alleen kolommen 0–3
    const wall = paintCells(null, rect(4, 0, 4, g.rows - 1), "stone");
    const left = fillCells(g, wall, 1, 1);
    assert.equal(left.length, 4 * g.rows, g.type + g.orient);
    assert.ok(left.every((p) => p.c < 4 && inside(g, p.c, p.r)));
    const filled = paintCells(wall, left, "water");
    assert.equal(terrAt(filled, 5, 1), null, "rechts van de muur onaangeroerd");
    assert.equal(terrAt(filled, 4, 1), "stone");
    // hele lege kaart: precies de cellen binnen de kaart (stopt bij de rand, ook al is het vaste raster 100×100)
    assert.equal(fillCells(g, null, 0, 0).length, g.cols * g.rows);
    assert.deepEqual(fillCells(g, null, g.cols, 0), [], "buiten de kaart: niets");
    // vullen van de muur zelf = alleen de muur; vullen met hetzelfde terrein verandert niets
    assert.equal(fillCells(g, wall, 4, 2).length, g.rows);
    assert.equal(paintCells(wall, fillCells(g, wall, 4, 2), "stone"), wall);
    // gebied wissen
    assert.equal(paintCells(filled, fillCells(g, filled, 0, 0), null).ids.join(), "stone");
  }
  // vierkant: diagonaal is geen buur (een schuine muur houdt water tegen)
  const diag = paintCells(null, [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ c: i, r: i })), "stone");
  const below = fillCells(SQ, diag, 0, 7);
  assert.ok(below.every((p) => p.r > p.c));
});

test("cellen buiten de kaart blijven bewaard (raster kleiner en weer groter), maar tellen en tekenen niet", () => {
  const t = paintCells(null, rect(0, 0, 9, 7), "grass");
  const small = cleanGrid({ cols: 4, rows: 4 });
  assert.equal(countTerr(small, t), 16);
  assert.equal(countTerr(SQ, t), 80);
  assert.equal(fillCells(small, t, 0, 0).length, 16);
});

test("kaartdocument: terrein → schema 4, zonder terrein lager; kopie en opslag houden het", () => {
  const m = newMap({ id: "terr01", name: "Moeras" });
  assert.equal(cleanMap({ ...m, terr: null }).schema, 1);
  assert.equal("terr" in cleanMap({ ...m, terr: { w: 1, h: 1, ids: [], cells: "0" } }), false);
  const terr = paintCells(null, rect(0, 0, 2, 2), "water");
  const c = cleanMap({ ...m, terr, objs: [{ id: "o1", asset: "table", x: 2, y: 1.5, w: 2, h: 1, rot: 0, layer: "object" }] });
  assert.equal(c.schema, 4);
  assert.deepEqual(c.terr, { w: 100, h: 100, ids: ["water"], cells: terr.cells });
  assert.deepEqual(cleanMap(JSON.parse(JSON.stringify(c))), c, "opslag (structured clone ≈ JSON)");
  assert.deepEqual(copyMap(c, { id: "terr02", now: 1 }).terr, c.terr);
});

test("projectbestand: terrein reist mee (vierkant en hex), geen afbeeldingen nodig, bestandsversie blijft 1", async () => {
  for (const g of [SQ, HP, HF]) {
    const terr = paintCells(paintCells(null, fillCells(g, null, 0, 0), "grass"), brushCells(g, 3, 3, "wide"), "lava");
    const doc = cleanMap({ ...newMap({ id: "terr03", name: "Vulkaan", grid: g }), terr });
    const { parts } = buildParts(doc, new Map(), { app: "Inn the Grid test", now: new Date(0) });
    const text = parts.join(""), j = JSON.parse(text);
    assert.equal(j.version, 1);
    const r = await readFile(text.length, text, { hash });
    assert.equal(r.ok, true);
    assert.equal(r.map.schema, 4);
    assert.deepEqual(r.map.terr, doc.terr);
    assert.equal(countTerr(g, r.map.terr), g.cols * g.rows);
    assert.equal(terrAt(r.map.terr, 3, 3), "lava");
  }
});

test("import: kapot terrein wordt geweigerd (badmap), niet stil weggelaten; een leeg terrein mag", async () => {
  const doc = cleanMap({ ...newMap({ id: "terr04", name: "Kapot" }), terr: paintCells(null, [{ c: 0, r: 0 }], "sand") });
  const text = (terr) => { const { parts } = buildParts(doc, new Map(), { now: new Date(0) }); const j = JSON.parse(parts.join("")); j.map.terr = terr; return JSON.stringify(j); };
  for (const bad of [{ ...doc.terr, ids: Array(36).fill("sand") }, { ...doc.terr, cells: "1" }, { ...doc.terr, w: 1001 }, "zand"]) {
    const t = text(bad), r = await readFile(t.length, t, { hash });
    assert.equal(r.code, "badmap", JSON.stringify(bad).slice(0, 50));
  }
  const empty = text({ w: 2, h: 1, ids: ["sand"], cells: "00" }), r = await readFile(empty.length, empty, { hash });
  assert.equal(r.ok, true);
  assert.equal("terr" in r.map, false);
});

test("één veeg = één undo-stap (tussenstanden alleen getekend), Ongedaan en Opnieuw", () => {
  // zoals paintGrab in js/maps/main.js: tijdens de veeg alleen de stand bijwerken, bij loslaten één record
  const h = createHistory();
  let doc = { grid: SQ };
  const before = doc.terr;
  for (const [x0, y0, x1, y1] of [[0.5, 0.5, 3.5, 0.5], [3.5, 0.5, 3.5, 4.5], [3.5, 4.5, 8.5, 4.5]])
    doc = apply(doc, { terr: paintCells(doc.terr || null, strokeCells(SQ, x0, y0, x1, y1), "dirt") || undefined });
  h.record({ terr: before }, { terr: doc.terr }, null, { k: "paint", t: "dirt" });
  assert.equal(h.size, 1);
  assert.equal(countTerr(SQ, doc.terr), 4 + 4 + 5);
  doc = apply(doc, h.undo());
  assert.equal("terr" in doc, false);
  doc = apply(doc, h.redo());
  assert.equal(countTerr(SQ, doc.terr), 13);
  assert.deepEqual(h.peek().undo, { k: "paint", t: "dirt" });
});

test("budget: 100×100 volverven en vullen blijft licht (per veegbeweging ruim onder een frame)", () => {
  const g = cleanGrid({ cols: 100, rows: 100 });
  let t = null, t0 = performance.now();
  for (let r = 0; r < 100; r++) t = paintCells(t, strokeCells(g, 0.5, r + 0.5, 99.5, r + 0.5), TERRAINS[r % 8]); // 100 vegen over de hele breedte
  const per = (performance.now() - t0) / 100;
  assert.equal(countTerr(g, t), 10000);
  assert.ok(per < 20, `veeg ${per.toFixed(2)} ms`);
  t0 = performance.now();
  const all = paintCells(t, fillCells(g, null, 0, 0), "grass");
  assert.ok(performance.now() - t0 < 200, "vullen van de hele kaart");
  assert.equal(countTerr(g, all), 10000);
  assert.equal(cellsOf(all).length, 10000);
});

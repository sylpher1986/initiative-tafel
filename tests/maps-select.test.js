// Inn the Grid (G4, WP62): hit-test (bovenste object, ook gedraaid), handgrepen, en de pure bewerkingen: verplaatsen met
// snap (vierkant en hex), draaien (90° heen en terug op dezelfde plek), schalen, laag, volgorde, dupliceren, verwijderen;
// één sleep = één undo-stap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hitObj, hitAll, onObj, corners, objBox, angleTo, toLocal, toWorld, handles, handleAt, HANDLE } from "../js/maps/model/hit.js";
import { OBJ, posAt, footprint, mapObj, moveObj, rotateObj, turn90, sizeObj, resizeFrom, layerObj, reorder, atEdge, dupObj, removeObj, drawOrder } from "../js/maps/model/objects.js";
import { createHistory } from "../js/maps/model/history.js";
import { cleanGrid, cellAt, cellCenter, bounds } from "../js/maps/model/grid.js";

const ob = (id, x, y, w = 1, h = 1, rot = 0, layer = "object", asset = "chair") => ({ id, asset, x, y, w, h, rot, layer });
const SQ = cleanGrid({ cols: 10, rows: 8 }), HEX = cleanGrid({ type: "hex", orient: "pointy", cols: 10, rows: 8 });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test("hit-test: bovenste object (laag object boven floor, binnen een laag later = erboven), leeg = null", () => {
  const rug = ob("r", 3, 3, 4, 4, 0, "floor", "rug"), table = ob("t", 3, 3, 2, 1, 0, "object", "table"), chair = ob("c", 3, 3);
  const objs = [table, rug, chair]; // floor staat in de lijst ná het object, maar wordt eronder getekend
  assert.equal(hitObj(objs, 3, 3), chair, "chair: zelfde laag als table, later in de lijst");
  assert.equal(hitObj(objs, 3.8, 3), table);
  assert.equal(hitObj(objs, 4.5, 4.5), rug);
  assert.equal(hitObj(objs, 9, 9), null);
  assert.equal(hitObj([], 1, 1), null);
  assert.deepEqual(hitAll(objs, 3, 3).map((o) => o.id), ["c", "t", "r"], "bovenste eerst");
  assert.equal(drawOrder(objs).nf, 1);
});

test("hit-test: gedraaide objecten (90° en 45°), marge alleen als er geen exacte treffer is", () => {
  const t = ob("t", 5, 5, 4, 1, 90);
  assert.ok(onObj(t, 5, 6.9) && !onObj(t, 6.9, 5), "90°: lang in de hoogte");
  const d = ob("d", 5, 5, 4, 1, 45);
  assert.ok(onObj(d, 5 + 1.3, 5 + 1.3), "op de diagonaal (met de klok mee: rechtsonder)");
  assert.ok(!onObj(d, 5 + 1.3, 5 - 1.3), "niet op de andere diagonaal");
  assert.ok(!onObj(d, 6.5, 5), "in de as-evenwijdige rechthoek, maar niet in de gedraaide");
  // bovenste bij overlap met een gedraaid object erboven
  const under = ob("u", 6.5, 5, 1, 1);
  assert.equal(hitObj([d, under], 6.5, 5), under);
  assert.equal(hitObj([under, d], 5.9, 5.9), d);
  // marge: een exacte treffer wint
  const a = ob("a", 1.5, 1.5), b = ob("b", 2.5, 1.5);
  assert.equal(hitObj([b, a], 2.05, 1.5, 0.5), b, "exact op b, ook al ligt a erboven met marge");
  assert.equal(hitObj([a], 2.3, 1.5, 0.5), a, "naast a, binnen de marge");
  assert.equal(hitObj([a], 2.3, 1.5), null);
});

test("geometrie: toLocal/toWorld omkeerbaar, hoekpunten, omsluitende rechthoek, hoek naar de greep", () => {
  const o = ob("o", 2, 3, 2, 1, 30);
  for (const [x, y] of [[0, 0], [1, 2], [-3, 0.5]]) { const w = toWorld(o, x, y), l = toLocal(o, w.x, w.y); assert.ok(near(l.x, x) && near(l.y, y)); }
  const c = corners(ob("q", 2, 2, 2, 1, 90));
  assert.ok(near(c[0].x, 2.5) && near(c[0].y, 1) && near(c[2].x, 1.5) && near(c[2].y, 3));
  const b = objBox(ob("q", 2, 2, 2, 1, 90));
  assert.ok(near(b.w, 1) && near(b.h, 2));
  assert.ok(near(angleTo(o, 2, 0), 0) && near(angleTo(o, 5, 3), 90) && near(angleTo(o, 2, 6), 180) && near(angleTo(o, 0, 3), 270));
});

test("handgrepen: vaste schermmaat, buiten het object, ver genoeg uit elkaar (≥ 44 px) ook bij het kleinste object", () => {
  assert.equal(HANDLE, 44);
  for (const z of [0.25, 1, 4]) for (const rot of [0, 37, 90]) {
    const v = { x: 10, y: 20, z }, o = ob("o", 3, 3, OBJ.minSize, OBJ.minSize, rot), h = handles(o, v);
    assert.ok(Math.hypot(h.rot.x - h.size.x, h.rot.y - h.size.y) >= HANDLE, `z ${z} rot ${rot}`);
    assert.equal(handleAt(o, v, h.rot.x + 10, h.rot.y), "rot");
    assert.equal(handleAt(o, v, h.size.x, h.size.y - 10), "size");
    const c = { x: 3 * 48 * z + 10, y: 3 * 48 * z + 20 };
    assert.equal(handleAt(o, v, c.x, c.y), null, "het midden van het object is geen greep");
  }
  // draaigreep boven het object, gaat mee met de draaiing
  const v = { x: 0, y: 0, z: 1 }, h0 = handles(ob("o", 2, 2, 2, 1, 0), v), h90 = handles(ob("o", 2, 2, 2, 1, 90), v);
  assert.ok(near(h0.rot.x, 96) && h0.rot.y < 96 - 24, "boven");
  assert.ok(h90.rot.x > 96 + 24 && near(h90.rot.y, 96), "90°: rechts");
});

test("posAt: vierkant met snap = footprint op de cellen binnen de kaart; scheef = celmidden; hex = celmidden; zonder snap het punt", () => {
  const t = ob("t", 0, 0, 2, 1);
  assert.deepEqual(posAt(SQ, t, 3.3, 2.4, true), { x: 3, y: 2.5 });
  assert.deepEqual(posAt(SQ, { ...t, rot: 90 }, 3.3, 2.4, true), { x: 3.5, y: 2 }, "90°: footprint 1×2");
  assert.deepEqual(posAt(SQ, t, 0.1, 0.1, true), { x: 1, y: 0.5 }, "binnen de kaart");
  assert.deepEqual(posAt(SQ, t, -50, 99, true), { x: 1, y: 7.5 }, "punt eerst binnen de kaart");
  assert.deepEqual(posAt(SQ, { ...t, rot: 45 }, 3.3, 2.4, true), { x: 3.5, y: 2.5 });
  assert.deepEqual(posAt(SQ, t, 3.3, 2.4, false), { x: 3.3, y: 2.4 });
  assert.deepEqual(posAt(SQ, t, 30, -2, false), { x: 10, y: 0 });
  const c = cellAt(HEX, 4.2, 3.1), m = cellCenter(HEX, c.c, c.r), p = posAt(HEX, t, 4.2, 3.1, true);
  assert.ok(near(p.x, m.x, 1e-4) && near(p.y, m.y, 1e-4));
  const b = bounds(HEX), q = posAt(HEX, t, b.w + 5, b.h + 5, true), last = cellCenter(HEX, 9, 7);
  assert.ok(near(q.x, last.x, 1e-4) && near(q.y, last.y, 1e-4), "hex: buiten de kaart → de dichtstbijzijnde cel erin");
  assert.deepEqual(footprint({ w: 2, h: 1, rot: 270 }), { w: 1, h: 2 });
  assert.equal(footprint({ w: 2, h: 1, rot: 10 }), null);
});

test("verplaatsen en draaien: nieuw object (origineel onaangeroerd), 90° heen en terug op dezelfde plek, vier kwartslagen rond", () => {
  const t = ob("t", 3, 2.5, 2, 1, 0, "object", "table");
  const m = moveObj(SQ, t, 5.2, 4.9, true);
  assert.deepEqual([m.x, m.y, t.x], [5, 4.5, 3]);
  let r = turn90(SQ, t, 1, true);
  assert.deepEqual([r.rot, r.x, r.y], [90, 3.5, 2]);
  assert.deepEqual([turn90(SQ, r, -1, true).x, turn90(SQ, r, -1, true).y], [3, 2.5], "terug = zelfde plek");
  r = t;
  for (let i = 0; i < 4; i++) r = turn90(SQ, r, 1, true);
  assert.deepEqual([r.rot, r.x, r.y], [0, 3, 2.5]);
  assert.equal(turn90(SQ, { ...t, rot: 30 }, 1, true).rot, 90, "scheef: naar het volgende veelvoud");
  assert.equal(turn90(SQ, { ...t, rot: 30 }, -1, true).rot, 0);
  assert.equal(turn90(SQ, t, -1, false).rot, 270);
  assert.equal(rotateObj(SQ, t, -45, false).rot, 315);
  assert.equal(rotateObj(SQ, t, 720.5, false).rot, 0.5);
  assert.deepEqual([rotateObj(SQ, t, 15, false).x, rotateObj(SQ, t, 15, false).y], [3, 2.5], "vrij draaien verschuift niets");
});

test("schalen: begrensd, 4 decimalen, snap zet het object weer op de cellen", () => {
  const c = ob("c", 2.5, 2.5);
  assert.deepEqual([sizeObj(SQ, c, 99, 0, false).w, sizeObj(SQ, c, 99, 0, false).h], [OBJ.maxSize, OBJ.minSize]);
  assert.equal(sizeObj(SQ, c, 1 / 3, 1, false).w, 0.3333);
  const s = sizeObj(SQ, c, 2, 1, true);
  assert.deepEqual([s.w, s.x, s.y], [2, 2, 2.5], "even breedte: op een lijn (precies ertussen: naar links)");
  assert.deepEqual([sizeObj(SQ, c, NaN, 2, false).w], [1], "ongeldig = oude waarde");
});

test("resizeFrom (schaalgreep): linkerbovenhoek blijft, ook gedraaid; middelpunt binnen de kaart; hex met snap = celmidden", () => {
  const c = ob("c", 2.5, 2.5), r = resizeFrom(SQ, c, 2, 3, true);
  assert.deepEqual([r.w, r.h, r.x, r.y], [2, 3, 3, 3.5]);
  const t = ob("t", 5, 5, 2, 1, 90), q = resizeFrom(SQ, t, 4, 1, false), k0 = corners(t)[0], k1 = corners(q)[0];
  assert.ok(near(k0.x, k1.x) && near(k0.y, k1.y), "90°: dezelfde hoek blijft staan");
  const e = resizeFrom(SQ, ob("e", 9.5, 7.5), 20, 20, false);
  assert.ok(e.x <= 10 && e.y <= 8 && e.w === 20, "middelpunt binnen de kaart");
  const h = resizeFrom(HEX, ob("h", 2.5, 2), 2, 2, true), hc = cellAt(HEX, h.x, h.y), hm = cellCenter(HEX, hc.c, hc.r);
  assert.ok(near(h.x, hm.x, 1e-4) && near(h.y, hm.y, 1e-4));
  assert.equal(rotateObj(SQ, c, 359.99999, false).rot, 0, "nooit 360");
});

test("laag, volgorde, dupliceren, verwijderen: nieuwe lijsten, binnen de laag, grenzen", () => {
  const f1 = ob("f1", 1, 1, 1, 1, 0, "floor"), a = ob("a", 2, 2), f2 = ob("f2", 3, 3, 1, 1, 0, "floor"), b = ob("b", 4, 4);
  const objs = [f1, a, f2, b];
  assert.deepEqual(reorder(objs, "a", "front").map((o) => o.id), ["f1", "f2", "b", "a"]);
  assert.deepEqual(reorder(objs, "b", "back").map((o) => o.id), ["b", "f1", "a", "f2"]);
  assert.equal(reorder(objs, "b", "front"), objs, "al vooraan in zijn laag: zelfde lijst");
  assert.equal(reorder(objs, "f1", "back"), objs);
  assert.equal(reorder(objs, "zz", "front"), objs);
  assert.ok(atEdge(objs, "f2", "front") && !atEdge(objs, "f2", "back") && atEdge(objs, "a", "back") && !atEdge(objs, "a", "front"));
  assert.equal(layerObj(a, "floor").layer, "floor");
  assert.equal(layerObj(a, "lava"), a);
  const m = mapObj(objs, "a", (o) => ({ ...o, x: 9 }));
  assert.ok(m !== objs && m[1].x === 9 && objs[1].x === 2 && m[0] === f1);
  assert.equal(mapObj(objs, "zz", (o) => o), objs);
  const d = dupObj(SQ, objs, "a", true, () => 0.5);
  assert.equal(d.objs.length, 5);
  const c = d.objs[4];
  assert.ok(c.id === d.id && c.id !== "a" && c.asset === a.asset && c.x === 3.5 && c.y === 3.5 && c.layer === "object");
  const corner = ob("k", 9.5, 7.5), dd = dupObj(SQ, [corner], "k", true);
  assert.deepEqual([dd.objs[1].x, dd.objs[1].y], [8.5, 6.5], "in de hoek: linksboven");
  assert.equal(dupObj(SQ, objs, "zz", true), null);
  assert.equal(dupObj(SQ, Array.from({ length: OBJ.max }, (_, i) => ob("o" + i, 1, 1)), "o1", true), null, "maximum");
  assert.deepEqual(removeObj(objs, "a").map((o) => o.id), ["f1", "f2", "b"]);
  assert.equal(removeObj(objs, "zz"), objs);
});

test("één sleepbeweging = één undo-stap (group + seal); terug = de plek van voor het slepen", () => {
  const h = createHistory();
  let objs = [ob("t", 3, 2.5, 2, 1, 0, "object", "table")];
  const start = objs[0];
  for (const [x, y] of [[3.4, 2.5], [4.2, 3.1], [5.9, 4.4], [6.1, 4.6]]) {
    const n = mapObj(objs, "t", () => moveObj(SQ, start, x, y, true));
    h.record({ objs }, { objs: n }, "drag1", { k: "move", id: "table" });
    objs = n;
  }
  h.seal();
  assert.equal(h.size, 1);
  assert.deepEqual(h.peek().undo, { k: "move", id: "table" });
  const back = h.undo().objs;
  assert.deepEqual([back[0].x, back[0].y], [3, 2.5]);
  // een sleep die per saldo niets verplaatst, laat geen stap achter
  const h2 = createHistory(), a = [start], b = mapObj(a, "t", () => moveObj(SQ, start, 4, 2.5, true));
  h2.record({ objs: a }, { objs: b }, "drag2"); h2.record({ objs: b }, { objs: a }, "drag2");
  assert.equal(h2.size, 0);
});

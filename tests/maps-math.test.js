// Inn Sight (G4, WP56): rasterwiskunde en viewport (pannen, zoomen, knijpen, passend maken), puur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { squareGrid, cellAt, cellRect, inside, bounds, visibleLines, LIMITS, cleanGrid, parseCells, cellPoly, cellCenter, neighbors, toAxial, fromAxial, visibleCells, HEX_R } from "../js/maps/model/grid.js";
import { CELL, ZMIN, ZMAX, KEEP, toScreen, toMap, zoomAt, panBy, pinch, fitView, clampPan, clampZoom, visibleRect, wheelFactor, crisp, zoomPct } from "../js/maps/model/view.js";

const near = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} ≠ ${b}`);

test("squareGrid: standaard 20×15, gehele getallen binnen de grenzen, onzin → standaard", () => {
  const sz = (g) => ({ type: g.type, cols: g.cols, rows: g.rows });
  assert.deepEqual(sz(squareGrid()), { type: "square", cols: 20, rows: 15 });
  assert.deepEqual(sz(squareGrid(0, 500)), { type: "square", cols: LIMITS.minCells, rows: LIMITS.maxCells });
  assert.deepEqual(sz(squareGrid(3.6, "x")), { type: "square", cols: 4, rows: 15 });
  assert.deepEqual(sz(squareGrid(NaN, -2)), { type: "square", cols: 20, rows: 1 });
});

test("cellAt: halfopen cellen, randen, negatieve en buiten-de-kaart-coördinaten", () => {
  const g = squareGrid(20, 15);
  assert.deepEqual(cellAt(g, 0, 0), { c: 0, r: 0 });
  assert.deepEqual(cellAt(g, 0.999, 0.5), { c: 0, r: 0 });
  assert.deepEqual(cellAt(g, 1, 1), { c: 1, r: 1 }, "op een lijn = cel rechts/onder");
  assert.deepEqual(cellAt(g, 19.5, 14.99), { c: 19, r: 14 });
  assert.deepEqual(cellAt(g, 20, 15), { c: 20, r: 15 }, "rand rechtsonder valt buiten de kaart");
  assert.deepEqual(cellAt(g, -0.01, -1), { c: -1, r: -1 });
  assert.deepEqual(cellAt(g, -1, -1.5), { c: -1, r: -2 });
  assert.ok(inside(g, 0, 0) && inside(g, 19, 14));
  for (const [c, r] of [[-1, 0], [0, -1], [20, 0], [0, 15], [1.5, 1]]) assert.ok(!inside(g, c, r), `${c},${r}`);
});

test("cellRect en cellAt kloppen samen: elk punt valt in de rechthoek van zijn cel (ook negatief)", () => {
  const g = squareGrid(20, 15);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1000; i++) {
    const x = rnd() * 30 - 5, y = rnd() * 25 - 5, { c, r } = cellAt(g, x, y), R = cellRect(g, c, r);
    assert.ok(x >= R.x && x < R.x + R.w && y >= R.y && y < R.y + R.h, `${x},${y} → ${c},${r}`);
  }
  assert.deepEqual(cellRect(g, -2, 3), { x: -2, y: 3, w: 1, h: 1 });
  assert.deepEqual(bounds(g), { x: 0, y: 0, w: 20, h: 15 });
});

test("visibleLines: alleen lijnen in beeld, begrensd tot de kaart, leeg als de kaart buiten beeld is", () => {
  const g = squareGrid(20, 15);
  assert.deepEqual(visibleLines(g, { x: -5, y: -5, w: 100, h: 100 }), { c0: 0, c1: 20, r0: 0, r1: 15 });
  assert.deepEqual(visibleLines(g, { x: 2.5, y: 3, w: 4, h: 2.2 }), { c0: 3, c1: 6, r0: 3, r1: 5 });
  for (const rect of [{ x: 21, y: 0, w: 5, h: 5 }, { x: -9, y: 0, w: 5, h: 5 }, { x: 0, y: 16, w: 5, h: 5 }, { x: 0, y: -9, w: 5, h: 5 }]) {
    const L = visibleLines(g, rect);
    assert.ok(L.c0 > L.c1 && L.r0 > L.r1, JSON.stringify(rect));
  }
  assert.deepEqual(visibleLines(g, { x: 20, y: 15, w: 3, h: 3 }), { c0: 20, c1: 20, r0: 15, r1: 15 }, "precies op de rand: de randlijn");
});

test("toScreen/toMap zijn elkaars omgekeerde; CELL px per cel bij 100 %", () => {
  const v = { x: 13, y: -7, z: 1.7 };
  const p = toScreen(v, 3.25, 9.5), m = toMap(v, p.x, p.y);
  near(m.x, 3.25, "x"); near(m.y, 9.5, "y");
  assert.deepEqual(toScreen({ x: 0, y: 0, z: 1 }, 1, 1), { x: CELL, y: CELL });
});

test("zoomAt: kaartpunt onder de cursor blijft staan, grenzen 25 %–400 %, buiten de grens verandert niets", () => {
  let v = { x: 40, y: 30, z: 1 };
  const before = toMap(v, 150, 90);
  v = zoomAt(v, 1.7, 150, 90);
  const after = toMap(v, 150, 90);
  near(after.x, before.x, "x"); near(after.y, before.y, "y");
  let w = { x: 0, y: 0, z: 1 };
  for (let i = 0; i < 50; i++) w = zoomAt(w, 1.25, 10, 10);
  assert.equal(w.z, ZMAX);
  assert.equal(zoomAt(w, 2, 5, 5), w, "op het maximum: zelfde view");
  for (let i = 0; i < 50; i++) w = zoomAt(w, 0.8, 10, 10);
  assert.equal(w.z, ZMIN);
  assert.equal(ZMIN, 0.25); assert.equal(ZMAX, 4);
  assert.equal(clampZoom(NaN), 1);
  // op de grens: het punt onder de cursor blijft ook staan als de factor wordt afgekapt
  const c = { x: 5, y: 5, z: 3.5 }, m0 = toMap(c, 77, 33), m1 = toMap(zoomAt(c, 3, 77, 33), 77, 33);
  near(m1.x, m0.x, "afgekapt x"); near(m1.y, m0.y, "afgekapt y");
});

test("pinch: zoomt met de afstandsverhouding rond het midden en verschuift mee; kaartpunt onder de vingers blijft", () => {
  const v = { x: 10, y: 20, z: 1 };
  const a0 = { x: 100, y: 100 }, b0 = { x: 200, y: 100 }, a1 = { x: 80, y: 120 }, b1 = { x: 280, y: 120 };
  const r = pinch(v, a0, b0, a1, b1);
  near(r.z, 2, "zoom ×2");
  const m0 = toMap(v, 150, 100), m1 = toMap(r, 180, 120);
  near(m1.x, m0.x, "midden x"); near(m1.y, m0.y, "midden y");
  // alleen verschuiven (zelfde afstand)
  const p = pinch(v, a0, b0, { x: 110, y: 90 }, { x: 210, y: 90 });
  assert.deepEqual(p, { x: 20, y: 10, z: 1 });
  // samenvallende vingers: geen deling door nul
  const s = pinch(v, a0, a0, a1, a1);
  assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z));
});

test("panBy en clampPan: kaart raakt nooit uit beeld (minstens KEEP px), binnen de grenzen geen verandering", () => {
  const b = { x: 0, y: 0, w: 20, h: 15 }, W = 360, H = 600;
  assert.deepEqual(panBy({ x: 1, y: 2, z: 1 }, 3, -4), { x: 4, y: -2, z: 1 });
  const ok = { x: 10, y: 10, z: 1 };
  assert.deepEqual(clampPan(ok, b, W, H), ok);
  const far = clampPan({ x: 5000, y: -5000, z: 1 }, b, W, H);
  assert.equal(far.x, W - KEEP, "linkerrand hooguit KEEP px voor de rechterkant");
  assert.equal(far.y, KEEP - 15 * CELL, "onderrand minstens KEEP px in beeld");
  const tiny = clampPan({ x: -999, y: -999, z: 0.25 }, { x: 0, y: 0, w: 1, h: 1 }, W, H);
  assert.deepEqual([tiny.x, tiny.y], [0, 0], "kaart kleiner dan KEEP: helemaal in beeld");
});

test("fitView: kaart gecentreerd en passend met marge; grote kaart begrensd op 25 %", () => {
  const b = { x: 0, y: 0, w: 20, h: 15 };
  for (const [W, H] of [[320, 600], [390, 700], [1280, 800]]) {
    const v = fitView(b, W, H, 16), a = toScreen(v, 0, 0), z = toScreen(v, 20, 15);
    assert.ok(a.x >= 16 - 1e-9 && a.y >= 16 - 1e-9 && z.x <= W - 16 + 1e-9 && z.y <= H - 16 + 1e-9, `${W}×${H}`);
    near((a.x + z.x) / 2, W / 2, "midden x"); near((a.y + z.y) / 2, H / 2, "midden y");
    assert.ok(Math.abs(a.x - 16) < 1e-9 || Math.abs(a.y - 16) < 1e-9, "één as raakt de marge");
  }
  assert.equal(fitView({ x: 0, y: 0, w: 100, h: 100 }, 320, 400).z, ZMIN);
  const r = visibleRect(fitView(b, 320, 600), 320, 600);
  assert.ok(r.x < 0 && r.x + r.w > 20, "hele kaart zichtbaar");
});

test("wheelFactor: omhoog = inzoomen, symmetrisch, regel/pagina-modus, begrensd", () => {
  assert.ok(wheelFactor(-100) > 1 && wheelFactor(100) < 1);
  near(wheelFactor(100) * wheelFactor(-100), 1, "symmetrisch");
  near(wheelFactor(3, 1), wheelFactor(48), "regels ≈ 16 px");
  assert.ok(wheelFactor(1e9) > 0 && Number.isFinite(wheelFactor(-1e9)));
});

test("crisp: lijn op het midden van een apparaatpixel bij DPR 1, 2 en 3", () => {
  for (const dpr of [1, 2, 3]) for (const x of [0, 10.2, 47.5, 123.49]) {
    const X = crisp(x, dpr);
    assert.equal(X - Math.floor(X), 0.5, `${x}@${dpr}`);
    assert.ok(Math.abs(X - 0.5 - x * dpr) <= 0.5, "hooguit een halve apparaatpixel verschoven");
  }
  assert.equal(zoomPct({ z: 0.255 }), 26);
});

// ---- WP57: hex, rasterinstellingen ----
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// punt in convexe veelhoek (met de klok mee in schermcoördinaten, y omlaag): elk kruisproduct ≥ -eps
const inPoly = (poly, x, y, eps = 1e-9) => poly.every((a, i) => { const b = poly[(i + 1) % poly.length]; return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= -eps; });

test("WP57 parseCells: alleen hele getallen 1–100; 0, 101, leeg, tekst, komma en min geweigerd", () => {
  for (const [v, n] of [["1", 1], ["100", 100], [" 15 ", 15], ["015", 15], [42, 42]]) assert.equal(parseCells(v), n, String(v));
  for (const v of ["0", "101", "", "  ", "abc", "1.5", "1,5", "-3", "1e2", "12a", null, undefined, "1000"]) assert.equal(parseCells(v), null, String(v));
});

test("WP57 cleanGrid: standaard, begrensd, onbekende waarden → standaard, dekking op de vaste stappen", () => {
  assert.deepEqual(cleanGrid(), { type: "square", orient: "pointy", cols: 20, rows: 15, show: true, color: "auto", alpha: 50 });
  assert.deepEqual(cleanGrid({ type: "hex", orient: "flat", cols: 7, rows: 9, show: false, color: "gold", alpha: 75 }),
    { type: "hex", orient: "flat", cols: 7, rows: 9, show: false, color: "gold", alpha: 75 });
  const g = cleanGrid({ type: "tri", orient: "x", cols: 0, rows: 999, color: "pink", alpha: 3, show: "ja", extra: 1 });
  assert.deepEqual(g, { type: "square", orient: "pointy", cols: 1, rows: 100, show: true, color: "auto", alpha: 25 });
  const z = cleanGrid({ show: "false", cols: [5], rows: true, alpha: true }); assert.deepEqual([z.show, z.cols, z.rows, z.alpha], [false, 20, 15, 50]);
  assert.deepEqual([cleanGrid({ cols: "12" }).cols, cleanGrid({ cols: "" }).cols], [12, 20]);
  assert.equal(cleanGrid({ alpha: 64 }).alpha, 75); assert.equal(cleanGrid({ alpha: "x" }).alpha, 50); assert.equal(cleanGrid({ alpha: 400 }).alpha, 100);
});

test("WP57 acceptatie 2: wisselen van type behoudt kolommen/rijen (en de hex-oriëntatie)", () => {
  let g = cleanGrid({ cols: 33, rows: 12 });
  g = cleanGrid({ ...g, type: "hex", orient: "flat" }); assert.deepEqual([g.cols, g.rows, g.orient], [33, 12, "flat"]);
  g = cleanGrid({ ...g, type: "square" }); assert.deepEqual([g.type, g.cols, g.rows], ["square", 33, 12]);
  g = cleanGrid({ ...g, type: "hex" }); assert.equal(g.orient, "flat", "terug naar hex: laatste oriëntatie");
});

for (const orient of ["pointy", "flat"]) {
  const g = cleanGrid({ type: "hex", orient, cols: 20, rows: 15 });

  test(`WP57 acceptatie 1 (${orient}): cellAt geeft voor 1000 willekeurige punten de cel waarvan de zeshoek het punt bevat`, () => {
    const rnd = rng(orient === "pointy" ? 11 : 23), b = bounds(g);
    for (let i = 0; i < 1000; i++) {
      const x = rnd() * (b.w + 6) - 3, y = rnd() * (b.h + 6) - 3, { c, r } = cellAt(g, x, y);
      assert.ok(Number.isInteger(c) && Number.isInteger(r), `${x},${y}`);
      assert.ok(inPoly(cellPoly(g, c, r), x, y), `${orient} ${x},${y} → ${c},${r}`);
    }
  });

  test(`WP57 hex (${orient}): middelpunt en hoekpunten (net binnen) vallen in hun eigen cel, ook negatief en rechtsonder`, () => {
    for (const [c, r] of [[0, 0], [1, 0], [0, 1], [1, 1], [19, 14], [-1, -1], [-2, 3], [5, -4], [20, 15]]) {
      const m = cellCenter(g, c, r);
      assert.deepEqual(cellAt(g, m.x, m.y), { c, r }, `middelpunt ${c},${r}`);
      for (const p of cellPoly(g, c, r)) {
        const q = { x: m.x + (p.x - m.x) * 0.999, y: m.y + (p.y - m.y) * 0.999 };
        assert.deepEqual(cellAt(g, q.x, q.y), { c, r }, `hoek ${c},${r}`);
      }
    }
    assert.ok(!Object.is(cellAt(g, 0.01, 0.3).c, -0), "geen -0");
  });

  test(`WP57 hex (${orient}): zeshoek met buurafstand 1, cel (0,0) raakt links en boven, bounds omsluit alle cellen precies`, () => {
    const poly = cellPoly(g, 4, 5);
    assert.equal(poly.length, 6);
    for (const p of poly) near(Math.hypot(p.x - cellCenter(g, 4, 5).x, p.y - cellCenter(g, 4, 5).y), HEX_R, "straal");
    for (const n of neighbors(g, 4, 5)) { const a = cellCenter(g, 4, 5), m = cellCenter(g, n.c, n.r); near(Math.hypot(m.x - a.x, m.y - a.y), 1, `buur ${n.c},${n.r}`, 1e-9); }
    const b = bounds(g); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) for (const p of cellPoly(g, c, r)) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    near(x0, 0, "links", 1e-9); near(y0, 0, "boven", 1e-9); near(x1, b.w, "rechts", 1e-9); near(y1, b.h, "onder", 1e-9);
    for (const [c, r] of [[0, 0], [7, 3], [3, 7]]) { const R = cellRect(g, c, r); for (const p of cellPoly(g, c, r)) assert.ok(p.x >= R.x - 1e-9 && p.x <= R.x + R.w + 1e-9 && p.y >= R.y - 1e-9 && p.y <= R.y + R.h + 1e-9); }
  });

  test(`WP57 hex (${orient}): offset ↔ axiaal heen en terug; 6 verschillende buren, elk wederzijds`, () => {
    for (const [c, r] of [[0, 0], [3, 4], [4, 3], [-3, -5], [99, 99]]) {
      const a = toAxial(g, c, r); assert.deepEqual(fromAxial(g, a.q, a.r), { c, r });
      const ns = neighbors(g, c, r);
      assert.equal(new Set(ns.map((n) => n.c + "," + n.r)).size, 6);
      for (const n of ns) assert.ok(neighbors(g, n.c, n.r).some((m) => m.c === c && m.r === r), `${c},${r} ↔ ${n.c},${n.r}`);
    }
  });

  test(`WP57 hex (${orient}): visibleCells dekt elke cel die de viewport raakt, leeg buiten de kaart`, () => {
    const rnd = rng(5);
    for (let k = 0; k < 40; k++) {
      const rect = { x: rnd() * 24 - 2, y: rnd() * 18 - 2, w: rnd() * 8 + 0.1, h: rnd() * 6 + 0.1 }, C = visibleCells(g, rect);
      for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
        const R = cellRect(g, c, r), hit = R.x < rect.x + rect.w && R.x + R.w > rect.x && R.y < rect.y + rect.h && R.y + R.h > rect.y;
        if (hit) assert.ok(c >= C.c0 && c <= C.c1 && r >= C.r0 && r <= C.r1, `${JSON.stringify(rect)} mist ${c},${r}`);
      }
    }
    const b = bounds(g);
    for (const rect of [{ x: b.w + 1, y: 0, w: 3, h: 3 }, { x: -9, y: 0, w: 3, h: 3 }, { x: 0, y: b.h + 1, w: 3, h: 3 }, { x: 0, y: -9, w: 3, h: 3 }]) {
      const C = visibleCells(g, rect); assert.ok(C.c0 > C.c1 || C.r0 > C.r1, JSON.stringify(rect));
    }
  });
}

test("WP57 hex: één rij/kolom heeft geen halve-cel-uitsprong; vierkant: neighbors en cellPoly", () => {
  near(bounds(cleanGrid({ type: "hex", orient: "pointy", cols: 5, rows: 1 })).w, 5, "pointy 1 rij");
  near(bounds(cleanGrid({ type: "hex", orient: "flat", cols: 1, rows: 5 })).h, 5, "flat 1 kolom");
  const s = squareGrid(4, 4);
  assert.deepEqual(neighbors(s, 1, 1).map((n) => [n.c, n.r]).sort(), [[0, 1], [1, 0], [1, 2], [2, 1]]);
  assert.deepEqual(cellPoly(s, 2, 3), [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 2, y: 4 }]);
  const C = visibleCells(s, { x: 2.5, y: 3, w: 4, h: 2.2 }); assert.deepEqual(C, { c0: 2, c1: 3, r0: 3, r1: 3 });
});

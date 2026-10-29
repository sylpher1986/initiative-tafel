// WP66: grenzen centraal (js/maps/model/limits.js), meetkaart en meetscript (model/bench.js), hex-randen één keer
// (hexEdgeMask in model/grid.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITS } from "../js/maps/model/limits.js";
import { LIMITS as GL, cleanGrid, cellPoly, hexEdgeMask, parseCells } from "../js/maps/model/grid.js";
import { OBJ, cleanObjs } from "../js/maps/model/objects.js";
import { IMG } from "../js/maps/model/image.js";
import { MINE } from "../js/maps/model/mine.js";
import { FILE_MAX } from "../js/maps/model/file.js";
import { HIST_MAX } from "../js/maps/model/history.js";
import { NAME_MAX, cleanMap } from "../js/maps/model/map.js";
import { TERR, countTerr, TERRAINS } from "../js/maps/model/terrain.js";
import { benchMap, benchView, frameStats, fpsTarget, rng, PHASES, BENCH, BENCH_SHA } from "../js/maps/model/bench.js";
import { bounds } from "../js/maps/model/grid.js";
import { ZMIN, ZMAX, CELL } from "../js/maps/model/view.js";

test("elke module leest zijn grens uit limits.js", () => {
  assert.ok(Object.isFrozen(LIMITS));
  assert.equal(GL, LIMITS);
  assert.deepEqual([OBJ.max, OBJ.minSize, OBJ.maxSize, OBJ.maxPos], [LIMITS.objs, LIMITS.objMinSize, LIMITS.objMaxSize, LIMITS.objMaxPos]);
  assert.deepEqual([IMG.maxBytes, IMG.maxSide, IMG.maxInSide, IMG.maxInPixels], [LIMITS.inBytes, LIMITS.bgSide, LIMITS.inSide, LIMITS.inPixels]);
  assert.deepEqual([MINE.max, MINE.maxSide, MINE.nameMax, MINE.thumb, MINE.thumbBytes], [LIMITS.mine, LIMITS.mineSide, LIMITS.itemName, LIMITS.thumb, LIMITS.thumbBytes]);
  assert.deepEqual([FILE_MAX, HIST_MAX, NAME_MAX, TERR.maxIds, TERR.w, TERR.h], [LIMITS.fileBytes, LIMITS.hist, LIMITS.mapName, LIMITS.terrIds, LIMITS.maxCells, LIMITS.maxCells]);
  // de besluiten (D10, D12) zoals gemeten in WP66
  assert.deepEqual([LIMITS.maxCells, LIMITS.objs, LIMITS.bgSide], [100, 2000, 4096]);
  assert.equal(parseCells(String(LIMITS.maxCells)), LIMITS.maxCells);
  assert.equal(parseCells(String(LIMITS.maxCells + 1)), null);
  assert.equal(cleanObjs(Array.from({ length: LIMITS.objs + 5 }, (_, i) => ({ asset: "chair", x: i % 50, y: 1 }))).length, LIMITS.objs);
});

test("meetkaart zit precies op de grenzen en is een geldige kaart", () => {
  const m = benchMap("hex");
  assert.deepEqual([m.grid.type, m.grid.cols, m.grid.rows], ["hex", LIMITS.maxCells, LIMITS.maxCells]);
  assert.equal(m.objs.length, LIMITS.objs);
  assert.deepEqual([m.bg.asset, m.bg.w, m.bg.h], [BENCH_SHA, LIMITS.bgSide, LIMITS.bgSide]);
  assert.ok(Math.abs((m.bg.w / m.bg.ppc) - bounds(m.grid).w) < 0.01, "achtergrond over de hele kaartbreedte");
  assert.deepEqual([...m.terr.ids].sort(), [...TERRAINS].sort());
  const n = countTerr(m.grid, m.terr);
  assert.ok(n > 3000 && n < 10000, "terrein over een groot deel: " + n);
  const doc = cleanMap({ id: "bench0", name: "x", ...m });
  assert.equal(doc.objs.length, LIMITS.objs, "cleanMap houdt alle objecten");
  assert.ok(doc.bg && doc.terr && doc.schema === 4);
  // vast: elke meting dezelfde kaart; vierkant kan ook
  assert.deepEqual(benchMap("hex").objs.slice(0, 5), m.objs.slice(0, 5));
  assert.equal(benchMap("square").grid.type, "square");
  const r = rng(1), a = Array.from({ length: 1000 }, r);
  assert.ok(a.every((x) => x >= 0 && x < 1));
});

test("meetscript: zoom binnen 25–400 %, pannen houdt de kaart in beeld", () => {
  const b = bounds(cleanGrid({ type: "hex", cols: 100, rows: 100 })), w = 390, h = 730;
  assert.deepEqual(PHASES, ["pan", "far", "zoom"]);
  for (const ph of PHASES) for (let i = 0; i < 100; i++) {
    const v = benchView(ph, i / 100, b, w, h);
    assert.ok(v.z >= ZMIN - 1e-9 && v.z <= ZMAX + 1e-9, ph);
    const cx = (w / 2 - v.x) / (CELL * v.z), cy = (h / 2 - v.y) / (CELL * v.z); // kaartpunt in het midden van het scherm
    assert.ok(cx > 0 && cx < b.w && cy > 0 && cy < b.h, `${ph} ${i}: midden ${cx},${cy}`);
  }
  assert.equal(benchView("pan", 0.3, b, w, h).z, 1);
  assert.equal(benchView("far", 0.3, b, w, h).z, ZMIN);
  assert.ok(Math.abs(benchView("zoom", 0.5, b, w, h).z - ZMAX) < 1e-9);
  assert.ok(Math.abs(benchView("zoom", 0, b, w, h).z - ZMIN) < 1e-9);
});

test("frameStats en doelen", () => {
  assert.deepEqual(frameStats([]), { fps: 0, p95: 0, worst: 0, draw: 0 });
  const st = Array.from({ length: 61 }, (_, i) => i * (1000 / 60));
  assert.deepEqual(frameStats(st, [2, 4]), { fps: 60, p95: 16.7, worst: 16.7, draw: 3 });
  const slow = [0, 16, 32, 132, 148]; // één frame van 100 ms
  const s = frameStats(slow);
  assert.equal(s.worst, 100);
  assert.equal(s.fps, 27);
  assert.equal(fpsTarget(true), 30);
  assert.equal(fpsTarget(false), 50);
  assert.equal(BENCH.target.openMs, 2000);
});

test("hex-randen: samen tekenen alle cellen elke rand precies één keer", () => {
  const key = (a, b) => [a, b].map((p) => `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)}`).sort().join("|");
  for (const orient of ["pointy", "flat"]) for (const [cols, rows] of [[1, 1], [1, 5], [5, 1], [2, 3], [7, 6], [10, 10]]) {
    const g = cleanGrid({ type: "hex", orient, cols, rows }), seen = new Map(), all = new Set();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const P = cellPoly(g, c, r), m = hexEdgeMask(g, c, r);
      assert.ok(m > 0 && m < 64);
      for (let k = 0; k < 6; k++) { const K = key(P[k], P[(k + 1) % 6]); all.add(K); if (m & (1 << k)) seen.set(K, (seen.get(K) || 0) + 1); }
    }
    for (const K of all) assert.equal(seen.get(K), 1, `${orient} ${cols}×${rows}: ${K}`);
    if (cols > 2 && rows > 2) assert.equal(hexEdgeMask(g, 1, 1).toString(2).replace(/0/g, "").length, 3, "binnencel: 3 randen");
  }
});

test("bitmap per onderdeel: kleine onderdelen tot 512 px per cel, grote tot 256", async () => {
  const { bucket } = await import("../js/maps/render/art.js");
  assert.equal(bucket(576, 1), 512); // dpr 3, 400 %
  assert.equal(bucket(576, 2), 512);
  assert.equal(bucket(576, 4), 256);
  assert.equal(bucket(100, 1), 128);
  assert.equal(bucket(3, 6), 32);
});

// Inn the Grid (G4, WP59): achtergrondafbeelding. Pure delen: bestandscontrole op de bytes (soort, afmetingen, grenzen,
// D12), sha256-hex, het achtergrondmodel (opschonen, startschatting, raster passend, schaal, stap) en schema v2 van het
// kaartdocument. Decoderen, verkleinen en de IndexedDB-rondreis staan in de browsercheck (wp59).
import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { IMG, sniff, dims, checkImage, fitSize, cleanSha, toHex } from "../js/maps/model/image.js";
import { BG, cleanBg, bgRect, across, guessPpc, gridFor, parsePpc, parseAcross, scaleBg, moveBg, stepFor } from "../js/maps/model/bg.js";
import { cleanMap, newMap, copyMap, SCHEMA } from "../js/maps/model/map.js";
import { cleanGrid, bounds } from "../js/maps/model/grid.js";
import { CELL } from "../js/maps/model/view.js";

const bytes = (...parts) => Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = (n) => [n & 255, (n >>> 8) & 255];
const le24 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];
const png = (w, h) => bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a], be32(13), "IHDR", be32(w), be32(h), [8, 6, 0, 0, 0], [0, 0, 0, 0]);
// JPEG: SOI, APP1 (EXIF-blok van 300 bytes), DQT, SOF0 met h/w
const jpeg = (w, h, sof = 0xc0) => bytes([0xff, 0xd8], [0xff, 0xe1, 0x01, 0x2e], "Exif\0\0", new Array(294).fill(0), [0xff, 0xdb, 0x00, 0x04, 0, 0], [0xff, sof, 0x00, 0x11, 8, h >> 8, h & 255, w >> 8, w & 255, 3], new Array(9).fill(0), [0xff, 0xda, 0, 2]);
const riff = (kind, payload) => bytes("RIFF", be32(0).reverse(), "WEBP", kind, be32(payload.length).reverse(), payload);
const webpX = (w, h) => riff("VP8X", [0, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)]);
const webpL = (w, h) => { const v = (w - 1) | ((h - 1) << 14); return riff("VP8L", [0x2f, v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]); };
const webpLossy = (w, h) => riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(w), ...le16(h)]);

test("sniff: toegestane soorten aan de bytes, bekende andere soorten met eigen code", () => {
  assert.equal(sniff(png(10, 10)), "image/png");
  assert.equal(sniff(jpeg(10, 10)), "image/jpeg");
  assert.equal(sniff(webpX(10, 10)), "image/webp");
  assert.equal(sniff(bytes("GIF89a", [1, 0, 1, 0])), "gif");
  assert.equal(sniff(bytes('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')), "svg");
  assert.equal(sniff(bytes([0xef, 0xbb, 0xbf], "  \n<svg width='1'/>")), "svg");
  assert.equal(sniff(bytes([0, 0, 0, 24], "ftypheic", [0, 0, 0, 0])), "heic");
  assert.equal(sniff(bytes([0, 0, 0, 24], "ftypmif1", [0, 0, 0, 0])), "heic");
  assert.equal(sniff(bytes([0, 0, 0, 24], "ftypavif", [0, 0, 0, 0])), "avif");
  assert.equal(sniff(bytes("BM", [0, 0, 0, 0])), "bmp");
  assert.equal(sniff(bytes("Hallo, dit is tekst.")), "unknown");
  assert.equal(sniff(bytes("<html><body>x</body></html>")), "unknown");
  assert.equal(sniff(new Uint8Array(0)), "unknown");
});

test("dims: PNG, JPEG (SOF na EXIF, ook progressief), WebP VP8X/VP8L/VP8; kapot = null", () => {
  assert.deepEqual(dims(png(2100, 1400), "image/png"), { w: 2100, h: 1400 });
  assert.deepEqual(dims(jpeg(3000, 2000), "image/jpeg"), { w: 3000, h: 2000 });
  assert.deepEqual(dims(jpeg(640, 480, 0xc2), "image/jpeg"), { w: 640, h: 480 });
  assert.equal(dims(jpeg(640, 480, 0xc4).slice(0, 330), "image/jpeg"), null, "DHT is geen SOF; afgekapt = null");
  assert.deepEqual(dims(webpX(5000, 4000), "image/webp"), { w: 5000, h: 4000 });
  assert.deepEqual(dims(webpL(1234, 567), "image/webp"), { w: 1234, h: 567 });
  assert.deepEqual(dims(webpLossy(800, 600), "image/webp"), { w: 800, h: 600 });
  assert.equal(dims(png(0, 10), "image/png"), null);
  assert.equal(dims(png(10, 10).slice(0, 20), "image/png"), null);
  assert.equal(dims(bytes([0xff, 0xd8, 0xff, 0xd9]), "image/jpeg"), null);
});

test("checkImage: acceptatie (1) — PNG/JPEG/WebP tot de grens; GIF, SVG, HEIC, hernoemd tekstbestand, te groot, kapot, te veel pixels", () => {
  assert.deepEqual(checkImage(1000, png(2100, 1400)), { ok: true, mime: "image/png", w: 2100, h: 1400 });
  assert.equal(checkImage(IMG.maxBytes, jpeg(4000, 3000)).ok, true, "precies 25 MB mag");
  assert.equal(checkImage(5000, webpX(16384, 2000)).ok, true);
  const code = (size, b) => checkImage(size, b).code;
  assert.equal(code(IMG.maxBytes + 1, png(10, 10)), "big");
  assert.equal(code(100, bytes("GIF89a", [1, 0, 1, 0])), "gif");
  assert.equal(code(100, bytes("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")), "svg");
  assert.equal(code(100, bytes([0, 0, 0, 24], "ftypheic", [0, 0, 0, 0])), "heic");
  assert.equal(code(100, bytes("Dit is eigenlijk een tekstbestand met .png erachter")), "notimage");
  assert.equal(code(100, bytes("BM", new Array(20).fill(0))), "other");
  assert.equal(code(100, bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a], "kapot")), "broken");
  assert.equal(code(100, png(20000, 100)), "huge", "zijde > 16384");
  assert.equal(code(100, png(8000, 5000)), "huge", "40 MP > 36 MP: decompressiebom");
  assert.equal(checkImage(100, png(6000, 6000)).ok, true, "36 MP mag");
  assert.equal(code(0, new Uint8Array(0)), "empty");
  // elke code heeft een tekst in beide catalogi (maps.bg.err.<code>)
});

test("fitSize: acceptatie (2) — langste zijde ≤ 4096, verhouding behouden, kleiner blijft gelijk", () => {
  assert.deepEqual(fitSize(8192, 4096), { w: 4096, h: 2048 });
  assert.deepEqual(fitSize(3000, 12000), { w: 1024, h: 4096 });
  assert.deepEqual(fitSize(2100, 1400), { w: 2100, h: 1400 });
  assert.deepEqual(fitSize(16384, 1), { w: 4096, h: 1 });
});

test("sha256: hex van 64 tekens, cleanSha weigert al het andere", async () => {
  const hex = toHex(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode("abc")));
  assert.equal(hex, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(cleanSha(hex), hex);
  for (const bad of [hex.toUpperCase(), hex.slice(1), 5, null, "../x"]) assert.equal(cleanSha(bad), null);
});

const SHA = "a".repeat(64);
test("cleanBg: geldig, begrensd, onbekende velden weg; onbruikbaar = null", () => {
  assert.deepEqual(cleanBg({ asset: SHA, w: 2100, h: 1400, ppc: 70, x: 0.5, y: -1, evil: "<script>" }), { asset: SHA, w: 2100, h: 1400, ppc: 70, x: 0.5, y: -1 });
  for (const bad of [null, [], {}, { asset: "x", w: 10, h: 10 }, { asset: SHA, w: 0, h: 10 }, { asset: SHA, w: 1.5, h: 10 }, { asset: SHA, w: "10", h: 10 }, { asset: SHA, w: 20000, h: 10 }]) assert.equal(cleanBg(bad), null, JSON.stringify(bad));
  const c = cleanBg({ asset: SHA, w: 1000, h: 500, ppc: 1e9, x: 1e9, y: NaN });
  assert.equal(c.ppc, BG.maxPpc);
  assert.equal(c.x, BG.maxOff);
  assert.equal(c.y, 0);
  assert.equal(cleanBg({ asset: SHA, w: 1000, h: 500, ppc: "70" }).ppc, 50, "geen getal = w/20");
  assert.equal(cleanBg({ asset: SHA, w: 100, h: 100, ppc: 1 }).ppc, BG.minPpc);
  assert.equal(cleanBg({ asset: SHA, w: 100, h: 100, ppc: 70.123456789 }).ppc, 70.1235, "4 decimalen");
});

test("guessPpc en gridFor: testkaart 30×20 met 70 px per vak klopt zonder iets in te vullen (acceptatie 3)", () => {
  const ppc = guessPpc(2100, 1400, 20);
  assert.equal(ppc, 70);
  const bg = cleanBg({ asset: SHA, w: 2100, h: 1400, ppc, x: 0, y: 0 });
  assert.deepEqual(gridFor(bg, cleanGrid()), { cols: 30, rows: 20 });
  assert.equal(across(bg), 30);
  assert.deepEqual(bgRect(bg), { x: 0, y: 0, w: 30, h: 20 });
  assert.equal(guessPpc(3000, 2000, 20), 100, "70 deelt niet, 100 wel");
  assert.equal(guessPpc(1000, 777, 25), 40, "geen gangbare deler: kaartbreedte vullen");
  assert.equal(guessPpc(14000, 7000, 20), 140, "70 geeft 200 kolommen (> 100): volgende kandidaat");
});

test("gridFor: afronden tot 0,1 van een heel getal, anders naar beneden; hex omgekeerd van bounds", () => {
  const sq = cleanGrid();
  assert.deepEqual(gridFor({ ...cleanBg({ asset: SHA, w: 3005, h: 2000, ppc: 100 }) }, sq), { cols: 30, rows: 20 }, "30,05 → 30");
  assert.deepEqual(gridFor(cleanBg({ asset: SHA, w: 3050, h: 2095, ppc: 100 }), sq), { cols: 30, rows: 21 }, "30,5 → 30, 20,95 → 21");
  assert.deepEqual(gridFor(cleanBg({ asset: SHA, w: 16384, h: 100, ppc: 10 }), sq).cols, 100, "begrensd op 100");
  for (const orient of ["pointy", "flat"]) {
    const g = cleanGrid({ type: "hex", orient, cols: 12, rows: 9 }), b = bounds(g);
    const bg = cleanBg({ asset: SHA, w: Math.round(b.w * 100), h: Math.round(b.h * 100), ppc: 100 });
    assert.deepEqual(gridFor(bg, g), { cols: 12, rows: 9 }, orient);
  }
  const shifted = cleanBg({ asset: SHA, w: 2000, h: 1000, ppc: 100, x: 2, y: 1 });
  assert.deepEqual(gridFor(shifted, sq), { cols: 22, rows: 11 }, "verschoven: tot de rechteronderhoek van de afbeelding");
});

test("parsePpc en parseAcross: komma of punt, grenzen; across → ppc", () => {
  const bg = cleanBg({ asset: SHA, w: 2100, h: 1400, ppc: 70 });
  assert.equal(parsePpc("70", bg), 70);
  assert.equal(parsePpc(" 70,5 ", bg), 70.5);
  assert.equal(parsePpc("70.25", bg), 70.25);
  for (const bad of ["", "0", "3", "abc", "-70", "1e3", "2101", "70,1234"]) assert.equal(parsePpc(bad, bg), null, bad);
  assert.equal(parseAcross("30", bg), 70);
  assert.equal(parseAcross("29,5", bg), 2100 / 29.5);
  for (const bad of ["0", "101", "x", "30,123"]) assert.equal(parseAcross(bad, bg), null, bad);
  assert.equal(parseAcross("100", cleanBg({ asset: SHA, w: 200, h: 200, ppc: 20 })), null, "2 px per cel < minimum");
});

test("scaleBg, moveBg en stepFor", () => {
  const bg = cleanBg({ asset: SHA, w: 2100, h: 1400, ppc: 70, x: 1, y: 2 });
  assert.deepEqual(scaleBg(bg, 140), { ...bg, ppc: 140 }, "linkerbovenhoek blijft staan");
  const c = scaleBg(bg, 35, 0, 0);
  assert.equal(c.x, 2); assert.equal(c.y, 4);
  assert.deepEqual(moveBg(bg, 0.5, -0.25), { ...bg, x: 1.5, y: 1.75 });
  // 2 schermpixels, afgerond op hele bronpixels (minstens 1)
  assert.equal(stepFor(bg, 1, CELL), 3 / 70, "70 px/cel op 48 px: 2,9 → 3 bronpixels");
  assert.equal(stepFor(bg, 4, CELL), 1 / 70, "ver ingezoomd: minstens 1 bronpixel");
  assert.equal(stepFor(cleanBg({ asset: SHA, w: 2100, h: 1400, ppc: 10 }), 4, CELL), 1 / 10);
});

test("kaartdocument: schema 2 alleen mét achtergrond; kapotte achtergrond weg; nieuwer schema niet aanraken", () => {
  assert.equal(SCHEMA, 4); // WP61: 3 = met objecten, WP63: 4 = met terrein (tests/maps-terrain.test.js)
  const m = newMap({ id: "abcdef1", name: "Grot", now: 5 });
  assert.equal(m.schema, 1);
  const withBg = cleanMap({ ...m, bg: { asset: SHA, w: 2100, h: 1400, ppc: 70, x: 0, y: 0 } });
  assert.equal(withBg.schema, 2);
  assert.deepEqual(withBg.bg, { asset: SHA, w: 2100, h: 1400, ppc: 70, x: 0, y: 0 });
  const broken = cleanMap({ ...m, schema: 2, bg: { asset: "nope" } });
  assert.equal(broken.schema, 1);
  assert.equal("bg" in broken, false);
  assert.equal(cleanMap({ ...m, schema: 5 }), null); // 3 = objecten, 4 = terrein, 5 = nieuwer
  assert.deepEqual(copyMap(withBg, { id: "zzzzzz9", now: 9 }).bg, withBg.bg, "dupliceren deelt de asset");
  assert.deepEqual(cleanMap(JSON.parse(JSON.stringify(withBg))), withBg, "acceptatie (4): rondreis precies gelijk");
});

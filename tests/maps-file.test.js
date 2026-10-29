// Inn Sight (G4, WP60): projectbestand v1 (js/maps/model/file.js). Rondreis (exporteren → lezen geeft dezelfde
// modeldata en dezelfde bytes), geen verwijzingen naar browseropslag of URL's, elk fouttype een eigen code (bestanden in
// tests/fixtures/maps/, gemaakt met tools/maps-fixtures.mjs), opschonen van kwaadaardige velden, migratiekader.
// Decoderen en de IndexedDB-rondreis staan in de browsercheck (wp60).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FORMAT, FILE_VERSION, FILE_MAX, buildParts, readFile, fileName, fromB64, b64Chunks, upgrade } from "../js/maps/model/file.js";
import { cleanMap, newMap, SCHEMA } from "../js/maps/model/map.js";

const DIR = join(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "fixtures/maps");
const hash = async (b) => createHash("sha256").update(b).digest("hex");
const fx = (n) => { const p = join(DIR, n); return { size: statSync(p).size, text: readFileSync(p, "utf8") }; };
const read = (n, o = {}) => { const f = fx(n); return readFile(f.size, f.text, { hash, ...o }); };
const shaOf = (u8) => createHash("sha256").update(u8).digest("hex");

/** Kaart met achtergrond plus asset uit valid.json (echte PNG) */
async function sample() {
  const r = await read("valid.json");
  assert.equal(r.ok, true);
  const map = { ...r.map, id: "abcdef123456" };
  return { map, assets: r.assets };
}
const join2 = (parts) => parts.join("");

test("rondreis: exporteren en weer lezen geeft dezelfde kaart en dezelfde bytes", async () => {
  const { map, assets } = await sample();
  const out = buildParts(map, assets, { app: "Inn the Grid 0.5.0", now: new Date(Date.UTC(2026, 9, 28, 12)) });
  assert.ok(out.parts);
  const text = join2(out.parts);
  const doc = JSON.parse(text);
  assert.equal(doc.format, FORMAT);
  assert.equal(doc.version, FILE_VERSION);
  assert.equal(doc.app, "Inn the Grid 0.5.0");
  assert.equal(doc.exported, "2026-10-28T12:00:00.000Z");
  const back = await readFile(text.length, text, { hash });
  assert.equal(back.ok, true);
  const { id, ...want } = cleanMap(map);
  assert.deepEqual(back.map, want);
  const a = assets.get(map.bg.asset), b = back.assets.get(map.bg.asset);
  assert.deepEqual(new Uint8Array(b.data), new Uint8Array(a.data));
  assert.equal(b.mime, "image/png");
  assert.equal(b.w, 140); assert.equal(b.h, 70); assert.equal(b.ow, map.bg.w); assert.equal(b.oh, map.bg.h);
  assert.ok(b.data instanceof ArrayBuffer);
});

test("rondreis zonder achtergrond: lege assets, schema 1", async () => {
  const m = newMap({ id: "abcdef123456", name: "Kaart 1", now: 5 });
  const text = join2(buildParts(m, new Map()).parts);
  assert.deepEqual(JSON.parse(text).assets, {});
  const r = await readFile(text.length, text, { hash });
  assert.equal(r.ok, true);
  const { id, ...want } = m;
  assert.deepEqual(r.map, want);
  assert.equal(r.assets.size, 0);
  assert.equal((await read("valid-plain.json")).map.grid.type, "hex");
});

test("bestand bevat geen URL's, id of verwijzingen naar browseropslag", async () => {
  const { map, assets } = await sample();
  const text = join2(buildParts(map, assets).parts);
  const doc = JSON.parse(text);
  assert.equal("id" in doc.map, false);
  assert.doesNotMatch(text, /https?:|blob:|data:|indexeddb|localstorage|kevs-inn-maps-|maps-last|abcdef123456/i);
  assert.deepEqual(Object.keys(doc.assets), [map.bg.asset]); // alleen wat de kaart gebruikt
  assert.deepEqual(Object.keys(doc.assets[map.bg.asset]).sort(), ["data", "h", "mime", "w"]);
});

test("src (sha van het origineel, sleutel van de store-index) gaat niet mee en wordt bij import genegeerd", async () => {
  const { map, assets } = await sample();
  const rec = { ...assets.get(map.bg.asset), src: "b".repeat(64) };
  const text = join2(buildParts(map, new Map([[map.bg.asset, rec]])).parts);
  assert.doesNotMatch(text, /"src"|b{64}/);
  const doc = JSON.parse(text);
  doc.assets[map.bg.asset].src = "c".repeat(64); // gemaakt bestand dat zich als een origineel voordoet
  const t2 = JSON.stringify(doc), r = await readFile(t2.length, t2, { hash });
  assert.equal(r.ok, true);
  assert.equal("src" in r.assets.get(map.bg.asset), false);
});

test("export weigert als de afbeelding ontbreekt (een bestand zonder afbeelding is niet zelfstandig)", async () => {
  const { map } = await sample();
  assert.deepEqual(buildParts(map, new Map()), { missing: [map.bg.asset] });
  assert.deepEqual(buildParts(map, new Map([[map.bg.asset, { data: null, mime: "image/png", w: 1, h: 1 }]])), { missing: [map.bg.asset] });
  assert.deepEqual(buildParts({ nonsense: 1 }, new Map()), { missing: [] });
});

test("grote afbeelding: base64 in stukken, samen gelijk aan Buffer.toString('base64')", () => {
  const u = new Uint8Array(300001).map((_, i) => (i * 7919) & 255);
  const parts = [...b64Chunks(u)];
  assert.ok(parts.length > 1);
  assert.equal(parts.join(""), Buffer.from(u).toString("base64"));
  assert.deepEqual(fromB64(parts.join("")), u);
  assert.equal(fromB64("abc"), null); // lengte geen veelvoud van 4
  assert.equal(fromB64("ab!d"), null);
  assert.equal(fromB64("a=bc"), null);
  assert.equal(fromB64(12), null);
  assert.deepEqual(fromB64(""), new Uint8Array(0));
});

test("elk fouttype een eigen code", async () => {
  const cases = {
    "err-empty.json": "empty", "err-notjson.json": "notjson", "err-format.json": "format", "err-newer.json": "newer",
    "err-newer-schema.json": "newer", "err-b64.json": "b64", "err-sha.json": "sha", "err-missing.json": "missing",
    "err-image-svg.json": "image", "err-image-dims.json": "image", "err-image-mime.json": "image", "err-badmap.json": "badmap",
    "err-badmap-bg.json": "badmap",
  };
  const files = readdirSync(DIR).filter((f) => f.startsWith("err-"));
  assert.deepEqual(files.sort(), Object.keys(cases).sort(), "elk foutbestand heeft een verwachting");
  for (const [f, code] of Object.entries(cases)) assert.deepEqual(await read(f), { ok: false, code }, f);
  // te groot: gemeten aan de bestandsgrootte, vóór het lezen van de inhoud
  assert.deepEqual(await readFile(FILE_MAX + 1, "{}", { hash }), { ok: false, code: "big" });
  assert.deepEqual(await readFile(0, "", { hash }), { ok: false, code: "empty" });
  // nog meer vormen die geen projectbestand zijn
  for (const t of ["[]", "null", "42", '"x"', '{"format":"kevs-inn-maps"}', '{"format":"kevs-inn-maps","version":"1"}', '{"format":"kevs-inn-maps","version":0}', '{"format":"kevs-inn-maps","version":1.5}'])
    assert.equal((await readFile(t.length, t, { hash })).code, "format", t);
  assert.equal((await readFile(30, '{"format":"kevs-inn-maps","version":1}', { hash })).code, "badmap");
  const pr = '{"__proto__":{"format":"kevs-inn-maps","version":1},"map":{"name":"x","grid":{}}}'; // format alleen via het prototype
  assert.equal((await readFile(pr.length, pr, { hash })).code, "format");
  // zonder hashfunctie nooit "goed"
  assert.equal((await read("valid.json", { hash: null })).code, "sha");
});

test("kwaadaardige velden worden opgeschoond: HTML in de naam, enorme arrays, __proto__", async () => {
  const r = await read("evil.json");
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.map).sort(), ["createdAt", "grid", "name", "schema", "updatedAt"]);
  assert.equal([...r.map.name].length, 60);
  assert.doesNotMatch(r.map.name, /‮/);
  assert.equal(r.map.grid.cols, 100); // begrensd (LIMITS)
  assert.equal("extra" in r.map.grid, false);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(Object.getPrototypeOf(r.map), Object.prototype);
  assert.equal(r.assets.size, 0);
  // een asset-sleutel "__proto__" is nooit een gevonden afbeelding
  const t = JSON.stringify({ format: FORMAT, version: 1, map: { schema: 2, name: "x", grid: {}, bg: { asset: "a".repeat(64), w: 10, h: 10, ppc: 5, x: 0, y: 0 } }, assets: {} }).replace('"assets":{}', '"assets":{"__proto__":{"mime":"image/png"}}');
  assert.equal((await readFile(t.length, t, { hash })).code, "missing");
});

test("migratiekader: elke stap tot FILE_VERSION, ontbrekende stap = weigeren", () => {
  assert.deepEqual(upgrade({ version: FILE_VERSION, a: 1 }), { version: FILE_VERSION, a: 1 });
  // nagebootst: als FILE_VERSION 1 is, verandert een v1-bestand niet; de lus zelf testen met een lager startpunt
  const doc = { version: FILE_VERSION - 1, n: 0 };
  const out = upgrade(doc, { [FILE_VERSION - 1]: (d) => ({ ...d, n: d.n + 1 }) });
  assert.deepEqual(out, { version: FILE_VERSION, n: 1 });
  assert.equal(upgrade({ version: FILE_VERSION - 1 }, {}), null);
  assert.equal(upgrade({ version: FILE_VERSION - 1 }, { [FILE_VERSION - 1]: () => [] }), null);
});

test("kaart van een nieuwer schema of zonder bruikbare achtergrond wordt niet half ingelezen", async () => {
  const { map, assets } = await sample();
  const doc = JSON.parse(join2(buildParts(map, assets).parts));
  doc.map.schema = SCHEMA + 1;
  let t = JSON.stringify(doc);
  assert.equal((await readFile(t.length, t, { hash })).code, "newer");
  doc.map.schema = 2; doc.map.bg.w = -5;
  t = JSON.stringify(doc);
  assert.equal((await readFile(t.length, t, { hash })).code, "badmap");
});

test("bestandsnaam: lokale tijd, kaartnaam als veilige slug", () => {
  const d = new Date(2026, 9, 28, 9, 5);
  assert.equal(fileName("Kaart 1", d), "inn-sight-kaart-1-2026-10-28-09-05.json");
  assert.equal(fileName("Crypte: Ëlvenpoort / niveau 2!", d), "inn-sight-crypte-elvenpoort-niveau-2-2026-10-28-09-05.json");
  assert.equal(fileName("../../etc/passwd", d), "inn-sight-etc-passwd-2026-10-28-09-05.json");
  assert.equal(fileName("", d), "inn-sight-map-2026-10-28-09-05.json");
  assert.equal(fileName("🐉🐉", d), "inn-sight-map-2026-10-28-09-05.json");
  assert.match(fileName("x".repeat(100), d), /^inn-sight-x{40}-2026/);
});

test("sha in de fixture klopt met de bytes (sanity van de fixtures)", async () => {
  const doc = JSON.parse(fx("valid.json").text);
  const [sha] = Object.keys(doc.assets);
  assert.equal(shaOf(Buffer.from(doc.assets[sha].data, "base64")), sha);
  assert.equal(doc.map.bg.asset, sha);
});

// WP65 (D13): de tool heet Inn Sight. Geen oude naam meer in de catalogi of op de pagina; een bestand van vóór de
// hernoeming (app "Inn the Grid 0.x") importeert nog, want readFile kijkt naar format, niet naar app.
test("hernoeming Inn Sight: catalogi en pagina's zonder oude naam, oud bestand importeert", async () => {
  const ROOT = join(DIR, "../../..");
  for (const f of ["locales/src/en/maps.js", "locales/src/nl/maps.js", "locales/maps/en.js", "locales/maps/nl.js", "pages/maps.html", "maps/index.html", "nl/maps/index.html"]) {
    const s = readFileSync(join(ROOT, f), "utf8");
    assert.ok(!/Inn the Grid/i.test(s), f + ": oude naam");
  }
  assert.ok(readFileSync(join(ROOT, "maps/index.html"), "utf8").includes("<title>Inn Sight · Kev’s Inn</title>"));
  const old = JSON.parse(fx("valid.json").text);
  assert.match(old.app, /^Inn the Grid 0\./);
  const r = await read("valid.json");
  assert.equal(r.ok, true);
  assert.equal(r.map.name, "Test fixture");
  const { parts } = buildParts({ ...r.map, id: "abcdef123456" }, r.assets, { app: "Inn Sight 0.10.0", now: new Date(0) });
  assert.equal(JSON.parse(parts.join("")).format, "kevs-inn-maps"); // formaat bewust niet hernoemd
});

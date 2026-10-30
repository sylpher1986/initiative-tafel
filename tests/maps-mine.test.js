// Inn Sight (G4, WP64): eigen assets (js/maps/model/mine.js) en wat ze raken: objecten (newObj), kaartschema 5,
// projectbestand (alleen gebruikte afbeeldingen mee, naam uit Mijn assets, alle controles ook voor eigen assets).
// Uploaden, miniatuur, opslag en het paneel staan in de browsercheck (wp64).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { MINE, isCustom, cleanItemName, nameFromFile, defaultCells, cleanItem, cleanItems, usedAssets, usedOn, quotaLevel } from "../js/maps/model/mine.js";
import { newObj, cleanObjs, OBJ } from "../js/maps/model/objects.js";
import { cleanMap, newMap, SCHEMA } from "../js/maps/model/map.js";
import { buildParts, readFile, FILE_MAX } from "../js/maps/model/file.js";

const hash = async (b) => createHash("sha256").update(b).digest("hex");
const sha = (b) => createHash("sha256").update(b).digest("hex");

/** Echte (kleine) PNG van w × h, transparant: dims() leest de kop, sniff() de handtekening */
function png(w, h, seed = 0) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const t = Buffer.from(type, "ascii"), len = Buffer.alloc(4), c = Buffer.alloc(4);
    len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h, seed);
  for (let y = 0; y < h; y++) raw[y * (w * 4 + 1)] = 0;
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
const rec = (bytes, w, h) => ({ data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), mime: "image/png", w, h, ow: w, oh: h, src: "f".repeat(64) });

test("isCustom, namen en standaardgrootte", () => {
  assert.equal(isCustom("a".repeat(64)), true);
  for (const v of ["table", "A".repeat(64), "a".repeat(63), null, 5, "pack/table"]) assert.equal(isCustom(v), false, String(v));
  assert.equal(nameFromFile("C:\\maps\\goblin_token-red.PNG"), "goblin token red");
  assert.equal(nameFromFile("/x/.png"), "");
  assert.equal(nameFromFile("IMG_4032.jpeg"), "IMG 4032");
  assert.equal(cleanItemName("  a\u0000b\u202e  c  "), "a b c");
  assert.equal([...cleanItemName("🐉".repeat(50))].length, MINE.nameMax); // per codepunt, geen half emoji
  assert.deepEqual(defaultCells(256, 256), { w: 1, h: 1 });
  assert.deepEqual(defaultCells(300, 100), { w: 3, h: 1 });
  assert.deepEqual(defaultCells(100, 250), { w: 1, h: 2.5 });
  assert.deepEqual(defaultCells(1000, 13), { w: OBJ.maxSize, h: 1 }); // langste zijde begrensd
  assert.deepEqual(defaultCells(0, 10), { w: 1, h: 1 });
});

test("items opschonen: kwaadaardige of kapotte records, dubbele sha, volgorde, miniatuur", () => {
  const A = "a".repeat(64), B = "b".repeat(64);
  assert.equal(cleanItem({ sha: "nope", name: "x" }), null);
  assert.equal(cleanItem([]), null);
  const it = cleanItem({ sha: A, name: 7, w: -3, h: "2", addedAt: -1, extra: "<script>" });
  assert.deepEqual(it, { sha: A, name: "", w: OBJ.minSize, h: 1, addedAt: 0 });
  assert.equal(cleanItem({ sha: A, w: 1.13, h: 99 }).w, 1.25);
  assert.equal(cleanItem({ sha: A, w: 1.13, h: 99 }).h, OBJ.maxSize);
  const tb = new ArrayBuffer(10);
  assert.equal(cleanItem({ sha: A, thumb: tb, tmime: "image/webp" }).thumb, tb);
  assert.equal("thumb" in cleanItem({ sha: A, thumb: tb, tmime: "image/svg+xml" }), false);
  assert.equal("thumb" in cleanItem({ sha: A, thumb: new ArrayBuffer(MINE.thumbBytes + 1), tmime: "image/webp" }), false);
  assert.equal("thumb" in cleanItem({ sha: A, thumb: "data:...", tmime: "image/webp" }), false);
  const l = cleanItems([{ sha: A, addedAt: 1 }, { sha: B, addedAt: 5 }, { sha: A, addedAt: 9 }, null, { sha: "x" }]);
  assert.deepEqual(l.map((i) => i.sha), [B, A]); // dubbel weg (eerste wint), nieuwste eerst
  assert.equal(cleanItems(Array.from({ length: MINE.max + 5 }, (_, i) => ({ sha: i.toString(16).padStart(64, "0"), addedAt: i }))).length, MINE.max);
  assert.deepEqual(cleanItems("nee"), []);
});

test("gebruik: achtergrond + eigen assets op objecten, per kaart geteld", () => {
  const A = "a".repeat(64), B = "b".repeat(64), C = "c".repeat(64);
  const m = { bg: { asset: C }, objs: [{ asset: A }, { asset: "table" }, { asset: A }, { asset: B }] };
  assert.deepEqual(usedAssets(m), [C, A, B]);
  assert.deepEqual(usedAssets({}), []);
  assert.deepEqual(usedAssets(null), []);
  assert.equal(usedOn(A, [m, { objs: [{ asset: A }] }, { objs: [] }, { bg: { asset: A } }]), 2); // alleen als object
  assert.equal(quotaLevel({ usage: 79, quota: 100 }), null);
  assert.equal(quotaLevel({ usage: 80, quota: 100 }), "high");
  assert.equal(quotaLevel({ usage: 96, quota: 100 }), "high");
  for (const e of [null, {}, { usage: 5, quota: 0 }, { usage: NaN, quota: 9 }]) assert.equal(quotaLevel(e), null);
});

test("plaatsen: eigen asset met de grootte uit Mijn assets; zonder def of onbekend niet", () => {
  const A = "a".repeat(64);
  const o = newObj(A, { x: 2, y: 1.5 }, [], () => 0.5, { w: 2, h: 1.5, layer: "nope" });
  assert.deepEqual({ ...o, id: "" }, { id: "", asset: A, x: 2, y: 1.5, w: 2, h: 1.5, rot: 0, layer: "object" });
  assert.equal(newObj(A, { x: 1, y: 1 }, []), null);
  assert.equal(newObj("<x>", { x: 1, y: 1 }, [], Math.random, { w: 1, h: 1 }), null);
  assert.equal(newObj("pack/x", { x: 1, y: 1 }, [], Math.random, { w: 1, h: 1 }), null); // alleen een eigen asset (sha) met def
  assert.equal(newObj("table", { x: 1, y: 1 }, [], Math.random, { w: 9, h: 9 }).w, 2); // ingebouwd: catalogus wint
  assert.deepEqual(cleanObjs([{ id: "a1", asset: A, x: 1, y: 1, w: 3, h: 2 }]).map((x) => [x.w, x.h, x.layer]), [[3, 2, "object"]]);
});

test("kaartschema 5 alleen met een eigen asset op een object; nieuwer = niet aanraken", () => {
  assert.equal(SCHEMA, 6); // WP73: 6 = fog aan
  const m = newMap({ id: "abcdef1", name: "Grot" });
  const A = "a".repeat(64);
  assert.equal(cleanMap({ ...m, objs: [{ id: "o1", asset: "table", x: 1, y: 1 }] }).schema, 3);
  assert.equal(cleanMap({ ...m, objs: [{ id: "o1", asset: A, x: 1, y: 1 }] }).schema, 5);
  assert.equal(cleanMap({ ...m, bg: { asset: A, w: 10, h: 10, ppc: 5, x: 0, y: 0 } }).schema, 2); // dezelfde sha als achtergrond telt niet
  assert.equal(cleanMap({ ...m, schema: SCHEMA + 1 }), null);
});

async function custom() {
  const tok = png(64, 32, 1), big = png(20, 20, 2), unused = png(8, 8, 3);
  const T = sha(tok), G = sha(big), U = sha(unused);
  const map = { ...newMap({ id: "abcdef123456", name: "Kroeg" }),
    bg: { asset: G, w: 20, h: 20, ppc: 10, x: 0, y: 0 },
    objs: [{ id: "o1", asset: T, x: 2, y: 1, w: 2, h: 1, rot: 90, layer: "object" }, { id: "o2", asset: T, x: 4, y: 1, w: 2, h: 1, rot: 0, layer: "floor" }, { id: "o3", asset: "table", x: 1, y: 1 }] };
  const assets = new Map([[T, rec(tok, 64, 32)], [G, rec(big, 20, 20)], [U, rec(unused, 8, 8)]]);
  return { map, assets, T, G, U };
}

test("export → import: eigen assets compleet, ongebruikte niet mee, naam uit Mijn assets", async () => {
  const { map, assets, T, G, U } = await custom();
  const names = new Map([[T, "Goblin\u0000 token"], [U, "Ongebruikt"], [G, "Achtergrond"]]);
  const out = buildParts(map, assets, { app: "Inn the Grid 0.9.0", names });
  assert.ok(out.parts);
  const text = out.parts.join(""), doc = JSON.parse(text);
  assert.deepEqual(Object.keys(doc.assets).sort(), [G, T].sort()); // U staat niet op de kaart
  assert.equal(doc.assets[T].name, "Goblin token"); // opgeschoond
  assert.equal("name" in doc.assets[G], false); // achtergrond: geen itemnaam
  assert.equal(doc.map.schema, 5);
  assert.equal("src" in doc.assets[T], false);
  const back = await readFile(text.length, text, { hash });
  assert.equal(back.ok, true);
  assert.deepEqual(back.map.objs, cleanMap(map).objs);
  assert.deepEqual([...back.assets.keys()].sort(), [G, T].sort());
  assert.equal(back.assets.get(T).w, 64);
  assert.equal(back.assets.get(T).ow, 64);
  assert.deepEqual(new Uint8Array(back.assets.get(T).data), new Uint8Array(assets.get(T).data));
  assert.deepEqual([...back.names], [[T, "Goblin token"]]);
});

test("export weigert zonder de afbeelding van een eigen asset; import van een kapotte eigen asset = eigen code", async () => {
  const { map, assets, T } = await custom();
  const less = new Map(assets); less.delete(T);
  assert.deepEqual(buildParts(map, less, {}), { missing: [T] });
  const doc = JSON.parse(buildParts(map, assets, {}).parts.join(""));
  const go = (d) => { const s = JSON.stringify(d); return readFile(s.length, s, { hash }); };
  const without = structuredClone(doc); delete without.assets[T];
  assert.deepEqual(await go(without), { ok: false, code: "missing" });
  const svg = structuredClone(doc); svg.assets[T].mime = "image/svg+xml";
  assert.deepEqual(await go(svg), { ok: false, code: "image" });
  const b64 = structuredClone(doc); b64.assets[T].data = "@@@@";
  assert.deepEqual(await go(b64), { ok: false, code: "b64" });
  const dim = structuredClone(doc); dim.assets[T].w = 65;
  assert.deepEqual(await go(dim), { ok: false, code: "image" });
  const other = structuredClone(doc); other.assets[T].data = doc.assets[Object.keys(doc.assets).find((k) => k !== T)].data; other.assets[T].w = 20; other.assets[T].h = 20;
  assert.deepEqual(await go(other), { ok: false, code: "sha" });
  const evil = structuredClone(doc); evil.assets[T].name = "<img src=x onerror=alert(1)>".repeat(5);
  const r = await go(evil);
  assert.equal(r.ok, true);
  assert.equal([...r.names.get(T)].length, MINE.nameMax); // tekst, begrensd; escapen doet de UI
});

test("dezelfde afbeelding als achtergrond én als object: één asset, origineel van de achtergrond", async () => {
  const { map, assets, G } = await custom();
  const m2 = { ...map, objs: [...map.objs, { id: "o9", asset: G, x: 3, y: 3, w: 1, h: 1 }] };
  const text = buildParts(m2, assets, {}).parts.join("");
  const back = await readFile(text.length, text, { hash });
  assert.equal(back.ok, true);
  assert.equal(Object.keys(JSON.parse(text).assets).length, 2);
  assert.equal(back.assets.get(G).ow, 20);
});

test("review: export nooit groter dan de importgrens; eigen asset (alleen object) boven 1024 px geweigerd bij import", async () => {
  const { map, assets, T, G } = await custom();
  const huge = new Map(assets);
  huge.set(T, { ...assets.get(T), data: new ArrayBuffer(Math.ceil((FILE_MAX * 3) / 4) + 10) }); // alleen de lengte telt hier
  assert.deepEqual(buildParts(map, huge, {}), { big: true });
  const wide = png(MINE.maxSide + 1, 4), W = sha(wide);
  const m2 = { ...map, objs: [{ id: "w1", asset: W, x: 1, y: 1, w: 2, h: 1 }] };
  const a2 = new Map(assets); a2.set(W, rec(wide, MINE.maxSide + 1, 4));
  const text = buildParts(m2, a2, {}).parts.join("");
  assert.deepEqual(await readFile(text.length, text, { hash }), { ok: false, code: "image" });
  // als achtergrond mag dezelfde maat wel (≤ 4096)
  const m3 = { ...map, bg: { asset: W, w: MINE.maxSide + 1, h: 4, ppc: 4, x: 0, y: 0 }, objs: [] };
  const t3 = buildParts(m3, a2, {}).parts.join("");
  assert.equal((await readFile(t3.length, t3, { hash })).ok, true);
  assert.ok(G);
});

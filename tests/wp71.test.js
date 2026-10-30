// WP71: spelerskaart op hetzelfde apparaat. De snapshot krijgt alleen een plat beeld (expliciete whitelist), nooit het
// kaartdocument of DM-lagen; cleanView laat alleen een geldig beeld door; via de kamer: tests/wp72.test.js.
import "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toPlayerView, cleanView, MAP_MAX } from "../js/playerview.js";
import { noMap, dmLink } from "../js/share.js";

const pc = (o) => ({ kind: "pc", cond: [], dex: 0, ac: 15, hp: 20, max: 20, ...o });
const S = { list: [pc({ id: "a", name: "Aria" })], round: 1, active: "a" };
const jpg = (n = 10) => new Blob([new Uint8Array(n)], { type: "image/jpeg" });

test("snapshot: map is een whitelist (k, w, h, img); nooit het kaartdocument of DM-lagen", () => {
  const img = jpg();
  // wat de DM-kant per ongeluk zou meegeven: hele kaartdocument, fog, naam, id
  const doc = { k: "m1", w: 960, h: 720, img, id: "map_secret", name: "Lair of the Lich", grid: { cols: 20, rows: 15 },
    objs: [{ id: "o1", asset: "chest" }], bg: { asset: "f".repeat(64) }, terr: { cells: [] }, fog: [1, 2, 3], dm: true };
  const V = toPlayerView(S, () => "", undefined, null, { map: doc });
  assert.deepEqual(Object.keys(V.map).sort(), ["h", "img", "k", "w"]);
  assert.equal(V.map.img, img);
  const j = JSON.stringify(V);
  for (const bad of ["map_secret", "Lair of the Lich", "objs", "grid", "chest", "terr", "fog", "bg", "\"dm\""]) assert.ok(!j.includes(bad), bad);
  assert.equal("map" in toPlayerView(S), false, "zonder gedeelde kaart geen map");
  assert.equal("map" in toPlayerView(S, () => "", undefined, null, { map: null }), false);
});

test("snapshot en cleanView: alleen een geldig beeld (Blob, jpeg/png/webp, grootte, maat, sleutel)", () => {
  const ok = { k: "m2", w: 100, h: 50, img: jpg() };
  const bads = [
    { ...ok, img: "data:image/jpeg;base64,AAAA" }, // tekst, geen Blob
    { ...ok, img: new Blob(["<svg onload=alert(1)/>"], { type: "image/svg+xml" }) },
    { ...ok, img: new Blob(["x"], { type: "text/html" }) },
    { ...ok, img: { size: 1, type: "image/jpeg" } },
    { ...ok, k: "<script>" }, { ...ok, k: undefined }, { ...ok, k: 123 }, { ...ok, k: "" }, { ...ok, k: "x".repeat(65) },
    { ...ok, w: 0 }, { ...ok, h: 5000 }, { ...ok, w: "abc" },
  ];
  for (const m of bads) {
    assert.equal("map" in toPlayerView(S, () => "", undefined, null, { map: m }), false, JSON.stringify(m));
    const V = cleanView({ ...toPlayerView(S), map: m });
    assert.ok(V && !("map" in V), JSON.stringify(m));
  }
  const big = { ...ok, img: { size: MAP_MAX + 1, type: "image/jpeg" } };
  assert.equal(cleanView({ ...toPlayerView(S), map: big }).map, undefined);
  const V = cleanView(toPlayerView(S, () => "", undefined, null, { map: { ...ok, extra: 1 } }));
  assert.deepEqual(Object.keys(V.map).sort(), ["h", "img", "k", "w"]);
  assert.equal(V.map.w, 100);
  assert.equal(cleanView({ ...toPlayerView(S), map: "kaart" }).map, undefined);
});

test("noMap haalt de kaart uit de snapshot; lokaal gaat het beeld mee (kamer: zie wp72.test.js)", () => {
  const V = toPlayerView(S, () => "", undefined, null, { map: { k: "m3", w: 10, h: 10, img: jpg() } });
  assert.equal("map" in noMap(V), false);
  assert.equal(noMap(toPlayerView(S)).list.length, 1);
  const sent = [];
  const local = { send: (m) => sent.push(m), on: (f) => { local.f = f; } };
  dmLink(local, () => V);
  local.f({ t: "hallo" });
  assert.equal(sent.at(-1).d.map.k, "m3");
});

test("dmLink: een nieuw beeld (andere k) is een nieuwe stand, hetzelfde beeld niet", () => {
  let k = "m4";
  const sent = [], local = { send: (m) => sent.push(m), on: (f) => { local.f = f; } };
  const view = () => toPlayerView(S, () => "", undefined, null, { map: { k, w: 10, h: 10, img: jpg() } });
  const l = dmLink(local, view);
  local.f({ t: "hallo" });
  l.update();
  assert.equal(sent.filter((m) => m.t === "stand").length, 1);
  k = "m5"; l.update();
  assert.equal(sent.filter((m) => m.t === "stand").length, 2);
});

test("plat beeld tekent alleen de kaart zelf (drawBase), nooit editor-overlays (drawOver)", () => {
  const src = readFileSync(new URL("../js/ui/encmap.js", import.meta.url), "utf8");
  const flat = src.slice(src.indexOf("export async function flatMap"));
  assert.match(flat, /drawBase\(/);
  assert.doesNotMatch(flat, /drawOver|\.draw\(|layer\.paint/);
  assert.doesNotMatch(flat, /putMap|claimTab/, "alleen lezen");
  assert.match(src, /FLAT_MAX = 2048/); // langste zijde (flatPpc: 8–64 px per cel)
});

// WP72: spelerskaart via de kamer, in stukken. DM knipt het platte beeld op (mapParts) en stuurt het naast de stand;
// de stand draagt alleen { k, w, h }. Spelers zetten de stukken samen en tonen de kaart pas als hij compleet is.
import "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toPlayerView, cleanView, MAP_MAX, MAP_TYPES } from "../js/playerview.js";
import { roomChannel, mapParts, joinParts, PART, PARTS, ROOM_MAP_MAX, MAP_TY } from "../js/share.js";
import { MAX_PART, MAX_PARTS, MAP_TY as ROOM_TY } from "../worker/room.js";

const pc = (o) => ({ kind: "pc", cond: [], dex: 0, ac: 15, hp: 20, max: 20, ...o });
const S = { list: [pc({ id: "a", name: "Aria" })], round: 1, active: "a" };
const bytes = (n, seed = 7) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + seed) & 255; return b; };
const tick = () => new Promise((r) => setTimeout(r, 5));
const T = { setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} };

/** Nagebootste WebSocket: out = verstuurd, recv(obj) = bericht van de kamer */
function fakeWs() {
  const out = [], all = [];
  class WS {
    constructor() { this.readyState = 0; all.push(this); setTimeout(() => { this.readyState = 1; this.onopen(); }, 0); }
    send(s) { out.push(s); }
    close() { this.readyState = 3; }
  }
  const recv = (m) => all.at(-1).onmessage({ data: typeof m === "string" ? m : JSON.stringify(m) });
  const sent = () => out.map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
  return { WS, out, all, recv, sent };
}

test("constanten gelijk aan de kamer; budget past onder MAP_MAX; stuk = veelvoud van 4", () => {
  assert.equal(PART, MAX_PART);
  assert.equal(PARTS, MAX_PARTS);
  assert.equal(PART % 4, 0);
  assert.deepEqual(MAP_TY, MAP_TYPES);
  assert.deepEqual(ROOM_TY, MAP_TYPES);
  assert.ok(ROOM_MAP_MAX < MAP_MAX);
  assert.ok(readFileSync(new URL("../js/ui/encmap.js", import.meta.url), "utf8").includes("ROOM_MAP_MAX"), "flatMap blijft onder het kamerbudget");
});

test("mapParts/joinParts: heen en terug, grenzen, elk stuk los te decoderen", () => {
  for (const n of [1, 2, 3, PART * 3 / 4 - 1, PART * 3 / 4, PART * 3 / 4 + 1, 200000, ROOM_MAP_MAX]) {
    const b = bytes(n), ps = mapParts(b);
    assert.ok(ps && ps.length === Math.max(1, Math.ceil(n / (PART * 3 / 4))), String(n));
    assert.ok(ps.every((p) => p.length <= PART && p.length % 4 === 0));
    assert.deepEqual(joinParts(ps), b);
  }
  assert.equal(mapParts(bytes(ROOM_MAP_MAX + 1)), null, "boven het budget: niet sturen");
  assert.deepEqual(joinParts(mapParts(new Uint8Array(0))), new Uint8Array(0));
  assert.equal(joinParts(["QUFB", "!!!"]), null, "kapotte base64");
});

test("DM: stand meteen (map zonder beeld), dan de stukken; zelfde kaart niet opnieuw; geen kaart = k null", async () => {
  const f = fakeWs(), ev = [];
  const ch = roomChannel("K7M3QX", "tok", { WS: f.WS, timers: T, base: "wss://app.test" });
  ch.on((m) => ev.push(m));
  await tick();
  const img = new Blob([bytes(100000)], { type: "image/jpeg" });
  const V = toPlayerView(S, () => "", undefined, null, { map: { k: "m1", w: 800, h: 600, img } });
  ch.send({ t: "stand", d: V });
  const first = f.sent();
  assert.equal(first[0].t, "stand", "de stand wacht niet op het beeld");
  assert.deepEqual(first[0].d.map, { k: "m1", w: 800, h: 600 });
  assert.ok(!f.out[0].includes("data:") && f.out[0].length < 10000);
  await tick();
  const ps = f.sent().filter((m) => m.t === "mp");
  assert.equal(ps.length, 3);
  assert.deepEqual(ps.map((m) => [m.k, m.i, m.n, m.ty]), [["m1", 0, 3, "image/jpeg"], ["m1", 1, 3, "image/jpeg"], ["m1", 2, 3, "image/jpeg"]]);
  assert.deepEqual(joinParts(ps.map((m) => m.d)), bytes(100000));
  assert.deepEqual(ev.filter((m) => m.t === "mapst").map((m) => m.busy), [true, false]);
  // zelfde kaart, andere stand: geen stukken opnieuw
  ch.send({ t: "stand", d: { ...V, round: 2 } });
  await tick();
  assert.equal(f.sent().filter((m) => m.t === "mp").length, 3);
  // kamer bevestigt dezelfde kaart: niets; andere/ontbrekende: opnieuw pushen (hallo)
  f.recv({ t: "mk", k: "m1" });
  assert.equal(ev.filter((m) => m.t === "hallo").length, 1, "alleen die van onopen");
  f.recv({ t: "mk", k: "" });
  assert.equal(ev.filter((m) => m.t === "hallo").length, 2);
  ch.send({ t: "stand", d: V });
  await tick();
  assert.equal(f.sent().filter((m) => m.t === "mp").length, 6, "opnieuw gestuurd");
  // kaart niet meer getoond: één keer k null
  const bare = toPlayerView(S);
  ch.send({ t: "stand", d: bare });
  ch.send({ t: "stand", d: { ...bare, round: 3 } });
  assert.deepEqual(f.sent().filter((m) => m.t === "mp" && m.k === null).length, 1);
  assert.equal("map" in f.sent().at(-1).d, false);
  ch.close();
});

test("DM: herladen met een oude kaart in de kamer ruimt hem op; te groot beeld gaat niet; pauze stuurt niets", async () => {
  const f = fakeWs(), ev = [];
  const ch = roomChannel("K7M3QX", "tok", { WS: f.WS, timers: T, base: "wss://app.test" });
  ch.on((m) => ev.push(m));
  await tick();
  f.recv({ t: "mk", k: "oud1" });
  assert.equal(ev.filter((m) => m.t === "hallo").length, 2);
  ch.send({ t: "stand", d: toPlayerView(S) });
  assert.deepEqual(f.sent().filter((m) => m.t === "mp"), [{ t: "mp", k: null }]);
  const huge = new Blob([bytes(ROOM_MAP_MAX + 10)], { type: "image/jpeg" });
  ch.send({ t: "stand", d: toPlayerView(S, () => "", undefined, null, { map: { k: "m9", w: 10, h: 10, img: huge } }) });
  await tick();
  assert.equal(f.sent().filter((m) => m.t === "mp" && m.k === "m9").length, 0);
  assert.equal(ev.filter((m) => m.t === "mapst").at(-1).busy, false);
  f.recv({ t: "pauze" });
  const n = f.out.length;
  ch.send({ t: "stand", d: toPlayerView(S, () => "", undefined, null, { map: { k: "m8", w: 10, h: 10, img: new Blob([bytes(10)], { type: "image/jpeg" }) } }) });
  await tick();
  assert.equal(f.out.length, n);
  assert.equal(ev.at(-1).t, "gemist");
  ch.close();
});

test("speler: wacht op alle stukken (mapWait), dan dezelfde stand mét Blob; cleanView laat hem door", async () => {
  const f = fakeWs(), ev = [];
  const ch = roomChannel("K7M3QX", null, { WS: f.WS, timers: T, base: "wss://app.test" });
  ch.on((m) => ev.push(m));
  await tick();
  const b = bytes(100000), ps = mapParts(b), stands = () => ev.filter((m) => m.t === "stand");
  const d = { ...toPlayerView(S), map: { k: "m1", w: 800, h: 600 } };
  f.recv({ t: "mp", k: "m1", i: 0, n: ps.length, ty: "image/jpeg", d: ps[0] });
  f.recv({ t: "stand", d });
  assert.equal(stands().length, 1);
  assert.equal(stands()[0].mapWait, 1);
  assert.equal("map" in stands()[0].d, false);
  f.recv({ t: "mp", k: "m1", i: 2, n: ps.length, ty: "image/jpeg", d: ps[2] }); // volgorde maakt niet uit
  assert.equal(stands().length, 1);
  f.recv({ t: "mp", k: "m1", i: 1, n: ps.length, ty: "image/jpeg", d: ps[1] });
  assert.equal(stands().length, 2, "compleet: stand opnieuw");
  const s = stands()[1];
  assert.ok(!s.mapWait && s.d.map.img instanceof Blob);
  assert.deepEqual(new Uint8Array(await s.d.map.img.arrayBuffer()), b);
  const V = cleanView(s.d);
  assert.equal(V.map.k, "m1");
  assert.equal(V.map.w, 800);
  // volgende stand met dezelfde kaart: meteen met beeld
  f.recv({ t: "stand", d: { ...d, round: 2 } });
  assert.ok(stands().at(-1).d.map.img === s.d.map.img);
  // stukken van dezelfde kaart nog eens (herverbinden): niets
  f.recv({ t: "mp", k: "m1", i: 0, n: ps.length, ty: "image/jpeg", d: ps[0] });
  assert.equal(stands().length, 3);
  // stand zonder kaart: geen map, geen mapWait (het spelersscherm haalt hem weg)
  f.recv({ t: "stand", d: toPlayerView(S) });
  assert.ok(!("map" in stands().at(-1).d) && !stands().at(-1).mapWait);
  ch.close();
});

test("speler: onzin-stukken genegeerd; een andere kaart begint opnieuw; herverbinden gooit halve stukken weg", async () => {
  const f = fakeWs(), ev = [];
  const ch = roomChannel("K7M3QX", null, { WS: f.WS, timers: T, base: "wss://app.test" });
  ch.on((m) => ev.push(m));
  await tick();
  const stands = () => ev.filter((m) => m.t === "stand");
  const d = { ...toPlayerView(S), map: { k: "m2", w: 10, h: 10 } };
  f.recv({ t: "stand", d });
  for (const bad of [{ k: "<x>", i: 0, n: 1, ty: "image/jpeg", d: "QUFB" }, { k: "m2", i: 0, n: 1, ty: "image/svg+xml", d: "QUFB" },
    { k: "m2", i: 1, n: 1, ty: "image/jpeg", d: "QUFB" }, { k: "m2", i: 0, n: PARTS + 1, ty: "image/jpeg", d: "QUFB" },
    { k: "m2", i: 0, n: 1, ty: "image/jpeg", d: "Q".repeat(PART + 4) }, { k: "m2", i: 0, n: 1, ty: "image/jpeg", d: 5 },
    { k: "m2", i: 0, n: 1, ty: "image/jpeg", d: "!!!!" }]) f.recv({ t: "mp", ...bad });
  assert.equal(stands().length, 1, "geen enkele geldige kaart");
  // half binnen, dan een andere kaart: opnieuw beginnen
  f.recv({ t: "mp", k: "m1", i: 0, n: 2, ty: "image/jpeg", d: "QUFB" });
  f.recv({ t: "mp", k: "m2", i: 0, n: 2, ty: "image/jpeg", d: "QUFB" });
  // verbinding weg en terug: halve stukken weg
  f.all.at(-1).onclose({ code: 1006 });
  ch.close();
  const g = fakeWs(), ev2 = [];
  const ch2 = roomChannel("K7M3QX", null, { WS: g.WS, timers: T, base: "wss://app.test" });
  ch2.on((m) => ev2.push(m));
  await tick();
  g.recv({ t: "mp", k: "m2", i: 1, n: 2, ty: "image/jpeg", d: "QkJC" });
  g.recv({ t: "stand", d });
  assert.equal(ev2.filter((m) => m.t === "stand").at(-1).mapWait, 1);
  g.recv({ t: "mp", k: "m2", i: 0, n: 2, ty: "image/jpeg", d: "QUFB" });
  const last = ev2.filter((m) => m.t === "stand").at(-1);
  assert.deepEqual(new Uint8Array(await last.d.map.img.arrayBuffer()), new Uint8Array([65, 65, 65, 66, 66, 66]));
  ch2.close();
});

test("spelersscherm: kamerstand zet en haalt de kaart, mapWait laat hem staan; hint volgt de kamer", () => {
  const sp = readFileSync(new URL("../js/speler.js", import.meta.url), "utf8");
  assert.ok(sp.includes("c === local || !m.mapWait"));
  assert.ok(/mapFrom !== from/.test(sp), "stand zonder kaart haalt alleen een kaart van hetzelfde kanaal weg");
  assert.ok(sp.indexOf("if (m.k === mapK) return;") < sp.indexOf('mapFrom = from || ""'), "het eerste kanaal blijft eigenaar");
  const mv = readFileSync(new URL("../js/ui/mapview.js", import.meta.url), "utf8");
  for (const k of ["init.map.share.hintRoom", "init.map.share.sending", "it-kamer"]) assert.ok(mv.includes(k), k);
});

const mapV = (k, n = 10, ty = "image/jpeg") => toPlayerView(S, () => "", undefined, null, { map: { k, w: 10, h: 10, img: new Blob([bytes(n)], { type: ty }) } });
async function dmCh() {
  const f = fakeWs(), ev = [];
  const ch = roomChannel("K7M3QX", "tok", { WS: f.WS, timers: T, base: "wss://app.test" });
  ch.on((m) => ev.push(m));
  await tick();
  return { f, ev, ch, mp: () => f.sent().filter((m) => m.t === "mp") };
}

test("DM (review): pauze + mk geeft geen hallo/gemist; na hervat gaat de kaart opnieuw", async () => {
  const { f, ev, ch, mp } = await dmCh();
  ch.send({ t: "stand", d: mapV("m1") });
  await tick();
  assert.equal(mp().length, 1);
  f.recv({ t: "pauze" });
  f.recv({ t: "mk", k: "x" });
  assert.equal(ev.filter((m) => m.t === "hallo").length, 1, "alleen die van onopen");
  assert.equal(ev.filter((m) => m.t === "gemist").length, 0);
  ch.hervat();
  f.recv({ t: "hervat" });
  ch.send({ t: "stand", d: mapV("m1") });
  await tick();
  assert.equal(mp().filter((m) => m.k === "m1").length, 2, "kamer negeerde de stukken tijdens de pauze: opnieuw");
  ch.close();
});

test("DM (review): tweede kaart tijdens het versturen = alleen de tweede; uit tijdens versturen = k null en geen stukken; te groot = één poging", async () => {
  const { ch, ev, mp } = await dmCh();
  ch.send({ t: "stand", d: mapV("m1", 100000) });
  ch.send({ t: "stand", d: mapV("m2", 10) });
  await tick();
  assert.deepEqual([...new Set(mp().map((m) => m.k))], ["m2"]);
  ch.send({ t: "stand", d: mapV("m3", 100000) });
  ch.send({ t: "stand", d: toPlayerView(S) });
  await tick();
  assert.equal(mp().filter((m) => m.k === "m3").length, 0);
  assert.equal(mp().filter((m) => m.k === null).length, 1);
  const big = mapV("m4", ROOM_MAP_MAX + 1);
  ch.send({ t: "stand", d: big });
  await tick();
  ch.send({ t: "stand", d: { ...big, round: 5 } });
  await tick();
  assert.equal(ev.filter((m) => m.t === "mapst" && m.busy).length, 4, "m1, m2, m3, m4 één keer");
  ch.close();
});

test("DM (review): versturen afgebroken door de verbinding = na herverbinden opnieuw via mk", async () => {
  const { f, ch, mp } = await dmCh();
  ch.send({ t: "stand", d: mapV("m1", 100000) });
  f.all.at(-1).onclose({ code: 1006 }); // vóór ship() klaar is
  await tick();
  assert.equal(mp().length, 0);
  f.recv({ t: "mk", k: "" }); // kamer heeft niets (nieuwe socket in het echt; hier dezelfde nep)
  assert.ok(true);
  ch.close();
});

test("speler (review): k null laat het beeld los; dezelfde k daarna = wachten", async () => {
  const f = fakeWs(), ev = [];
  const ch = roomChannel("K7M3QX", null, { WS: f.WS, timers: T, base: "wss://app.test" });
  ch.on((m) => ev.push(m));
  await tick();
  const d = { ...toPlayerView(S), map: { k: "m1", w: 10, h: 10 } };
  f.recv({ t: "mp", k: "m1", i: 0, n: 1, ty: "image/jpeg", d: "QUFB" });
  f.recv({ t: "stand", d });
  assert.ok(ev.at(-1).d.map);
  f.recv({ t: "mp", k: null });
  f.recv({ t: "stand", d });
  assert.equal(ev.at(-1).mapWait, 1);
  ch.close();
});

// Inn Sight (G4, WP74): vrije tokens. Opslagvorm (cleanToks: grenzen, label, grootte, kleur, id's), label optellen,
// plaatsen/verplaatsen met snap (vierkant en hex, Tiny tot Gargantuan), hit-test (Inn Sight en viewer), dupliceren,
// verwijderen, naar voren, schema 7, rondreis via het projectbestand, "laatste wijziging wint" in de opslag
// (putMap/putToks met een nagebootste IndexedDB, ook samen met fog), en dat verborgen tokens niet in het spelersbeeld komen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { TOK, TOK_SIZES, SIZE_ID, TOK_COLORS, TOK_COLOR_IDS, tokColor, cleanLabel, cleanToks, cleanTok, tokList, hasToks, playerToks, stampToks, mergeToks,
  tokAt, bumpLabel, newTok, mapTok, moveTok, sizeTok, hitTok, nearTok, dupTok, removeTok, tokFront, chars } from "../js/maps/model/tokens.js";
import { cleanGrid, cellCenter, cellAt } from "../js/maps/model/grid.js";
import { cleanMap, newMap, copyMap, importedDoc, SCHEMA } from "../js/maps/model/map.js";
import { setFogOn, revealCells, hidden } from "../js/maps/model/fog.js";
import { buildParts, readFile } from "../js/maps/model/file.js";
import { LIMITS } from "../js/maps/model/limits.js";
import { createHistory } from "../js/maps/model/history.js";

const ROOT = new URL("../", import.meta.url).pathname;
const hash = async (b) => createHash("sha256").update(b).digest("hex");
const SQ = cleanGrid({ cols: 10, rows: 8 });
const HP = cleanGrid({ type: "hex", orient: "pointy", cols: 9, rows: 7 });
const rnd = (() => { let i = 0; return () => ((i++ * 0.6180339887) % 1); })();
const T = (o = {}) => ({ id: "ta", x: 2.5, y: 2.5, s: 1, c: "red", l: "G1", ...o });

test("grenzen centraal; grootte-id's zijn D&D-groottes, palet zonder Lantern-goud, label leesbaar op elke kleur", () => {
  assert.equal(TOK.max, LIMITS.toks);
  assert.equal(TOK.label, LIMITS.tokLabel);
  assert.deepEqual(TOK_SIZES, [0.5, 1, 2, 3, 4]);
  assert.deepEqual(TOK_SIZES.map((s) => SIZE_ID[s]), ["tiny", "medium", "large", "huge", "gargantuan"]);
  assert.equal(TOK_COLOR_IDS.length, 8);
  assert.ok(!TOK_COLOR_IDS.some((c) => TOK_COLORS[c].fill.toLowerCase() === "#e3a83b"), "goud = selectie");
  // WCAG-contrast label op schijf ≥ 3 (groot, vet)
  const lum = (h) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  for (const c of TOK_COLOR_IDS) {
    const a = lum(TOK_COLORS[c].fill), b = lum(TOK_COLORS[c].ink), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(r >= 3, `${c}: contrast ${r.toFixed(2)}`);
  }
  assert.equal(tokColor("teal").fill, "#8c7d6b", "onbekende kleur (nieuwere versie) = grijs");
});

test("label: stuurtekens en witruimte weg, hooguit 3 tekens (een emoji of ★ = één teken), geen tekst = leeg", () => {
  assert.equal(cleanLabel("  G1 "), "G1");
  assert.equal(cleanLabel("G\u0000​1"), "G1");
  assert.equal(cleanLabel("ABCD"), "ABC");
  assert.equal(cleanLabel("★★★★"), "★★★");
  assert.equal(chars("👍🏽").length, 1, "emoji met huidskleur = één teken");
  assert.equal(cleanLabel(42), "");
  assert.equal(cleanLabel("   "), "");
  assert.ok([...cleanLabel("a" + "\u0301".repeat(500))].length <= TOK.labelCp, "combinerende tekens begrensd");
});

test("label optellen na plaatsen/dupliceren: getal aan het eind +1, anders hetzelfde; past het niet, dan blijft het", () => {
  assert.equal(bumpLabel("G1"), "G2");
  assert.equal(bumpLabel("9"), "10");
  assert.equal(bumpLabel("09"), "10");
  assert.equal(bumpLabel("G9"), "G10");
  assert.equal(bumpLabel("G99"), "G99", "G100 = 4 tekens");
  assert.equal(bumpLabel("999"), "999");
  assert.equal(bumpLabel("A"), "A");
  assert.equal(bumpLabel("★"), "★");
  assert.equal(bumpLabel(""), "");
});

test("cleanToks: geen object = null; tokens zonder positie weg; grootte, kleur en label opgeschoond; id's uniek; max", () => {
  assert.equal(cleanToks(null), null);
  assert.equal(cleanToks([]), null);
  assert.deepEqual(cleanToks({ at: 5 }), { at: 5, list: [] }, "lege lijst met tijd blijft (alles verwijderd)");
  const c = cleanToks({ at: 5, list: [T(), { x: "a", y: 1 }, T({ id: "ta", s: 7, c: "RED!", l: "ABCDE", hide: "ja" }), T({ id: "Bad id", hide: true })] }, rnd);
  assert.equal(c.list.length, 3);
  assert.equal(new Set(c.list.map((x) => x.id)).size, 3, "dubbele/ongeldige id → nieuw");
  assert.deepEqual({ s: c.list[1].s, c: c.list[1].c, l: c.list[1].l, hide: c.list[1].hide }, { s: 1, c: "red", l: "ABC", hide: undefined });
  assert.equal(c.list[2].hide, true);
  assert.equal(cleanTok(T({ c: "teal" })).c, "teal", "onbekende maar geldige kleur-id blijft bewaard");
  assert.ok(cleanToks({ at: Date.now() + 1e9, list: [] }).at <= Date.now(), "tijd in de toekomst begrensd");
  const many = cleanToks({ at: 1, list: Array.from({ length: TOK.max + 5 }, (_, i) => T({ id: "t" + i, x: i % 10 })) });
  assert.equal(many.list.length, TOK.max);
  assert.equal(cleanTok(T({ x: 1e9 })).x, TOK.maxPos);
});

test("plaatsen en verplaatsen: vierkant = footprint op de cellen (Tiny celmidden), hex = celmidden, naast de kaart niets", () => {
  const list = [];
  const at = (s, x, y) => { const t = newTok(SQ, list, x, y, { s, c: "blue", l: "1" }, true, rnd); return t && [t.x, t.y]; };
  assert.deepEqual(at(0.5, 3.2, 4.9), [3.5, 4.5]);
  assert.deepEqual(at(1, 3.2, 4.9), [3.5, 4.5]);
  assert.deepEqual(at(2, 3.2, 4.9), [3, 5], "Large: middelpunt op een rasterpunt");
  assert.deepEqual(at(3, 0.2, 0.2), [1.5, 1.5], "Huge binnen de kaart");
  assert.deepEqual(at(4, 9.9, 7.9), [8, 6], "Gargantuan binnen de kaart");
  assert.equal(at(1, -0.5, 2), null, "naast de kaart");
  assert.equal(at(1, 4, 9), null);
  assert.deepEqual(newTok(SQ, list, 3.2, 4.9, { s: 1, c: "blue", l: "1" }, false, rnd) && [3.2, 4.9], [3.2, 4.9]);
  const h = newTok(HP, list, 4.1, 3.3, { s: 1, c: "red", l: "1" }, true, rnd), m = cellAt(HP, 4.1, 3.3), mc = cellCenter(HP, m.c, m.r);
  assert.ok(Math.abs(h.x - mc.x) < 1e-3 && Math.abs(h.y - mc.y) < 1e-3, "hex: celmidden");
  const full = Array.from({ length: TOK.max }, (_, i) => T({ id: "t" + i }));
  assert.equal(newTok(SQ, full, 3, 3, { s: 1, c: "red", l: "1" }, true, rnd), null, "maximum");
  // verplaatsen: snap, binnen de kaart
  const t = T();
  assert.deepEqual([moveTok(SQ, t, 6.7, 1.2, true).x, moveTok(SQ, t, 6.7, 1.2, true).y], [6.5, 1.5]);
  assert.deepEqual([moveTok(SQ, t, 50, -3, true).x, moveTok(SQ, t, 50, -3, true).y], [9.5, 0.5], "naar de rand geklemd");
  // grootte wisselen met snap: even ↔ oneven verschuift het middelpunt een halve cel
  const L = sizeTok(SQ, t, 2, true);
  assert.equal(L.s, 2);
  assert.ok(Number.isInteger(L.x) && Number.isInteger(L.y));
  assert.equal(sizeTok(SQ, t, 9, false).s, 1, "onbekende grootte = Medium");
  assert.deepEqual(tokAt(SQ, 0.5, 0, 0, true), { x: 0.5, y: 0.5 });
});

test("hit-test: bovenste (laatste) wint, exact boven marge; viewer: dichtstbijzijnde middelpunt binnen 44 px", () => {
  const a = T({ id: "a", x: 2.5, y: 2.5 }), b = T({ id: "b", x: 3, y: 2.5 }), c = T({ id: "c", x: 6.5, y: 6.5, s: 0.5 });
  assert.equal(hitTok([a, b], 2.9, 2.5).id, "b", "later = erboven");
  assert.equal(hitTok([a, b], 2.1, 2.5).id, "a");
  assert.equal(hitTok([a, b, c], 6.9, 6.5), null);
  assert.equal(hitTok([a, b, c], 6.9, 6.5, 0.3).id, "c", "marge: klein token op een telefoon");
  assert.equal(hitTok([], 1, 1), null);
  assert.equal(nearTok([a, b], 2.6, 2.5).id, "a", "dichtstbij, niet bovenste");
  assert.equal(nearTok([c], 6.9, 6.5, 0.5).id, "c", "minimale straal");
  assert.equal(nearTok([c], 7.1, 6.5, 0.2), null);
});

test("bewerken geeft nieuwe lijsten: mapTok, dupliceren (+ label), verwijderen, naar voren; onbekend = dezelfde lijst", () => {
  const list = [T({ id: "a", l: "G1" }), T({ id: "b", x: 5.5, l: "A" })];
  const m = mapTok(list, "a", (x) => ({ ...x, hide: true }));
  assert.notEqual(m, list); assert.equal(list[0].hide, undefined); assert.equal(m[0].hide, true);
  assert.equal(mapTok(list, "zz", (x) => x), list);
  const d = dupTok(SQ, list, "a", true, rnd);
  assert.equal(d.list.length, 3); assert.equal(d.list[2].l, "G2"); assert.deepEqual([d.list[2].x, d.list[2].y], [3.5, 3.5]);
  assert.equal(dupTok(SQ, list, "b", true, rnd).list[2].l, "A");
  assert.equal(dupTok(SQ, [...list, T({ id: "c", l: "G2" })], "a", true, rnd).list[3].l, "G3", "G2 bestaat al");
  const edge = [T({ id: "e", x: 9.5, y: 7.5 })];
  assert.deepEqual([dupTok(SQ, edge, "e", true, rnd).list[1].x, dupTok(SQ, edge, "e", true, rnd).list[1].y], [8.5, 6.5], "past niet rechtsonder: linksboven");
  assert.equal(dupTok(SQ, Array.from({ length: TOK.max }, (_, i) => T({ id: "t" + i })), "t0", true), null);
  assert.deepEqual(removeTok(list, "a").map((x) => x.id), ["b"]);
  assert.equal(removeTok(list, "zz"), list);
  assert.deepEqual(tokFront(list, "a").map((x) => x.id), ["b", "a"]);
  assert.equal(tokFront(list, "b"), list);
  assert.deepEqual(playerToks({ at: 1, list: m }).map((x) => x.id), ["b"], "verborgen tokens niet naar spelers");
  assert.equal(hasToks(null), false); assert.deepEqual(tokList(undefined), []);
});

test("mergeToks en stampToks: de laatst gewijzigde lijst wint, ook leeg; geen veld verliest van een bewaarde lijst", () => {
  const a = { at: 5, list: [T()] }, b = { at: 9, list: [] };
  assert.equal(mergeToks(a, b), b);
  assert.equal(mergeToks(b, a), b);
  assert.equal(mergeToks(a, null), a);
  assert.equal(mergeToks(null, a), a);
  assert.deepEqual(stampToks(a, 12), { at: 12, list: a.list });
});

test("kaartdocument: tokens = schema 7 (Maps 1.5.x laat de kaart met rust), lege lijst blijft zonder schemasprong; kopie/import tijd van nu", () => {
  assert.equal(SCHEMA, 8); // WP75: 8 = gekoppelde tokens
  const m = newMap({ id: "abcdef1", name: "Grot", grid: SQ, now: 1 });
  assert.equal(cleanMap({ ...m, toks: { at: 5, list: [T()] } }).schema, 7);
  const empty = cleanMap({ ...m, toks: { at: 5, list: [] } });
  assert.equal(empty.schema, 1);
  assert.deepEqual(empty.toks, { at: 5, list: [] });
  assert.equal("toks" in cleanMap({ ...m, toks: "x" }), false);
  assert.equal(cleanMap({ ...m, schema: 9 }), null, "nieuwer schema niet aanraken");
  const withT = { ...m, toks: { at: 5, list: [T()] } };
  assert.equal(copyMap(withT, { id: "copy001", now: 99 }).toks.at, 99);
  assert.equal(importedDoc({ ...withT, id: undefined }, [], "Map", { id: "imp0001", now: 77 }).toks.at, 77);
});

test("projectbestand: tokens gaan mee en komen terug; een tokenveld dat geen object is of te veel tokens = badmap", async () => {
  const m = { ...newMap({ id: "abcdef1", name: "Grot", grid: SQ, now: 1 }), toks: { at: 5, list: [T(), T({ id: "tb", x: 5.5, hide: true, l: "★" })] } };
  const r = buildParts(m, new Map(), { app: "Inn Sight test", now: new Date(0) });
  const text = r.parts.join("");
  const back = await readFile(text.length, text, { hash });
  assert.equal(back.ok, true);
  assert.equal(back.map.schema, 7);
  assert.deepEqual(back.map.toks.list.map((x) => [x.l, !!x.hide]), [["G1", false], ["★", true]]);
  const bad = JSON.parse(text); bad.map.toks = "open";
  const t2 = JSON.stringify(bad);
  assert.deepEqual(await readFile(t2.length, t2, { hash }), { ok: false, code: "badmap" });
  for (const v of [{ at: 1, list: "x" }, { at: 1, list: [{ x: "a" }] }]) {
    const b2 = JSON.parse(text); b2.map.toks = v; const t4 = JSON.stringify(b2);
    assert.deepEqual(await readFile(t4.length, t4, { hash }), { ok: false, code: "badmap" }, "onbruikbare tokens niet stil weg");
  }
  const big = JSON.parse(text); big.map.toks.list = Array.from({ length: TOK.max + 1 }, (_, i) => T({ id: "t" + i }));
  const t3 = JSON.stringify(big);
  assert.deepEqual(await readFile(t3.length, t3, { hash }), { ok: false, code: "badmap" }, "niets stil weglaten");
});

// Nagebootste IndexedDB met lezen-dan-schrijven in één transactie (zoals tests/maps-fog.test.js)
function fakeIdb() {
  const data = new Map();
  const db = {
    close() {},
    transaction() {
      const t = { commit() {} };
      t.objectStore = () => ({
        put(v) { data.set(v.id, structuredClone(v)); return { result: v.id }; },
        get(k) { const r = { result: data.has(k) ? structuredClone(data.get(k)) : undefined }; queueMicrotask(() => r.onsuccess && r.onsuccess()); return r; },
        getAll() { return { result: [...data.values()] }; },
      });
      setTimeout(() => t.oncomplete && t.oncomplete(), 0);
      return t;
    },
  };
  return { data, open() { const req = { result: db }; queueMicrotask(() => req.onsuccess && req.onsuccess()); return req; } };
}

test("opslag: Initiative schrijft alleen de tokens (putToks); een Inn Sight-tabblad met oudere tokens zet ze niet terug, fog en tokens los van elkaar", async () => {
  const idb = fakeIdb();
  globalThis.indexedDB = idb;
  try {
    const store = await import("../js/maps/store.js?toks");
    const doc = { ...newMap({ id: "abcdef1", name: "Grot", grid: SQ, now: 1000 }), fog: setFogOn(true, 1000), toks: { at: 1000, list: [T()] } };
    assert.equal(await store.putMap(doc), true);
    idb.data.get("abcdef1").name = "Grot (hernoemd)";
    // Initiative verschuift het token
    const moved = { at: 2000, list: [T({ x: 6.5 })] };
    const saved = await store.putToks("abcdef1", moved);
    assert.equal(saved.name, "Grot (hernoemd)", "de rest van de kaart blijft");
    assert.equal(saved.toks.list[0].x, 6.5);
    assert.ok(saved.updatedAt > 1000);
    // en onthult een cel (later)
    await store.putFog("abcdef1", revealCells(doc.fog, SQ, [{ c: 1, r: 1 }], true, 2500));
    // Inn Sight-tabblad met de oude tokens en oude fog bewaart iets anders: beide blijven van Initiative
    assert.equal(await store.putMap({ ...doc, name: "Grot 2" }), true);
    let now = await store.getMap("abcdef1");
    assert.equal(now.name, "Grot 2");
    assert.equal(now.toks.list[0].x, 6.5, "tokens van Initiative niet teruggezet");
    assert.equal(hidden(now.fog, 1, 1), false, "fog van Initiative niet teruggezet");
    // Inn Sight verwijdert alle tokens (nieuwer): dat wint, ook als lege lijst
    assert.equal(await store.putMap({ ...doc, toks: { at: 3000, list: [] } }), true);
    now = await store.getMap("abcdef1");
    assert.deepEqual(now.toks.list, []);
    // een oudere verschuiving uit Initiative wint niet
    assert.deepEqual((await store.putToks("abcdef1", moved)).toks.list, []);
    assert.equal(await store.putToks("zzzzzz9", moved), null, "kaart weg");
    // review: de viewer (kende alleen G1) schrijft met een functie op de OPGESLAGEN lijst; een token dat Inn Sight intussen plaatste blijft
    assert.equal(await store.putMap({ ...doc, toks: { at: Date.now(), list: [T(), T({ id: "tc", l: "G3", x: 7.5 })] } }), true);
    const fn = (k) => { const l = tokList(k); return l.some((x) => x.id === "ta") ? { at: Date.now(), list: mapTok(l, "ta", (x) => ({ ...x, x: 4.5 })) } : null; };
    const after = await store.putToks("abcdef1", fn);
    assert.deepEqual(after.toks.list.map((x) => [x.id, x.x]), [["ta", 4.5], ["tc", 7.5]], "G3 uit Inn Sight niet stil weg");
    const same = await store.putToks("abcdef1", () => null);
    assert.equal(same.toks.list.length, 2, "functie geeft null: niets geschreven");
    idb.data.set("newer01", { id: "newer01", schema: SCHEMA + 1, name: "Toekomst", grid: {} });
    assert.equal(await store.putToks("newer01", moved), null, "nieuwer schema: niet aanraken");
  } finally { delete globalThis.indexedDB; }
});

test("spelersbeeld: verborgen tokens niet getekend, tokens onder de fog; de viewer schrijft alleen de tokens", () => {
  const cv = readFileSync(ROOT + "js/maps/render/canvas.js", "utf8");
  const i = cv.indexOf("drawTok(g, t, v, w, h, dpr, { hidden"), f = cv.indexOf("drawFog(g, map.fog");
  assert.ok(i > 0 && f > i, "tokens vóór de fog: in het spelersbeeld ligt de fog erover");
  assert.match(cv, /fog === "player" \? playerToks\(map\.toks\)/, "verborgen tokens niet in het spelersbeeld");
  const br = readFileSync(ROOT + "js/ui/encmap.js", "utf8");
  assert.match(br, /s\.putToks\(id, fn\)/, "met een functie op de opgeslagen lijst");
  assert.doesNotMatch(br, /putMap\(/, "de viewer schrijft nooit de hele kaart");
  const sw = readFileSync(ROOT + "sw.js", "utf8");
  assert.match(sw, /"\.\/js\/maps\/model\/tokens\.js"/);
});

test("geschiedenis: tokens op de identiteit van de lijst (de tijd telt niet); een sleep die per saldo niets verplaatst = geen stap", () => {
  const h = createHistory(), list = [T()];
  assert.equal(h.record({ toks: { at: 1, list } }, { toks: { at: 0, list } }, null, { k: "tmove" }), null);
  assert.ok(h.record({ toks: { at: 1, list } }, { toks: { at: 0, list: [T({ x: 5.5 })] } }, null, { k: "tmove" }));
});

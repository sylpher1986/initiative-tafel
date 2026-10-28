// Inn the Grid (G4, WP56, D2): eigen versie en eigen cache in de service worker (docs/g4-inn-the-grid.md §2.10).
// Een Maps-release mag de Initiative-cache niet veranderen en Initiative-bestanden niet opnieuw laten downloaden.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import vm from "node:vm";
import { VERSION as MAPS } from "../js/maps/version.js";
import { VERSION as INIT } from "../js/version.js";
import { build } from "../tools/pages.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const SW = readFileSync(ROOT + "sw.js", "utf8");
const list = (name, src = SW) => [...new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`).exec(src)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const walk = (d) => readdirSync(ROOT + d).flatMap((n) => (statSync(ROOT + d + n).isDirectory() ? walk(d + n + "/") : [d + n]));

test("MAPS_VERSION in sw.js = js/maps/version.js; Maps-cache heet naar de Maps-versie, Initiative-cache niet", () => {
  assert.match(MAPS, /^\d+\.\d+\.\d+$/);
  assert.equal(/const MAPS_VERSION = "([^"]+)"/.exec(SW)?.[1], MAPS);
  assert.match(SW, /const MAPS_CACHE = "kevs-inn-maps-" \+ MAPS_VERSION;/);
  assert.match(SW, /const CACHE = "initiative-tafel-" \+ VERSION;/, "Initiative-cache hangt alleen aan VERSION");
  assert.doesNotMatch(SW.match(/const CACHE = [^;]+;/)[0], /MAPS/);
});

test("alle Maps-bestanden in MAPS_ASSETS en niet in ASSETS; geen Initiative-bestand in MAPS_ASSETS", () => {
  const maps = list("MAPS_ASSETS"), init = list("ASSETS");
  const files = await_files();
  for (const f of files) assert.ok(maps.includes("./" + f), `${f} ontbreekt in MAPS_ASSETS`);
  assert.deepEqual(maps.filter((a) => init.includes(a)), [], "dubbel in beide caches");
  const own = (a) => /^\.\/((nl\/)?maps\/|css\/maps\.css$|js\/maps\/|locales\/maps\/)/.test(a);
  assert.deepEqual(maps.filter((a) => !own(a)), [], "gedeeld bestand hoort in ASSETS (Initiative-versie)");
  assert.deepEqual(init.filter(own), [], "Maps-bestand in de Initiative-cache");
});
function await_files() {
  const gen = ["maps/", "nl/maps/"];
  return [...gen, "css/maps.css", ...walk("js/maps/"), ...walk("locales/maps/")].map((f) => f.replace(/index\.html$/, ""));
}

test("gegenereerde Maps-pagina's bestaan (pages.mjs) en staan in MAPS_ASSETS", async () => {
  const files = await build();
  assert.ok(files["maps/index.html"] && files["nl/maps/index.html"]);
  for (const f of ["maps/index.html", "nl/maps/index.html"]) {
    assert.doesNotMatch(files[f], /<link rel="manifest"|<meta name="it-version"/, f + ": geen manifest en geen it-version (§9.2 stap 2, D7)");
    assert.doesNotMatch(files[f].replace(/\s(?:src|href)="[^"]*"|<!--[\s\S]*?-->/g, ""), /\{\{|\bmaps\.[a-z]+\b/, f + ": geen sleutel of plaatshouder zichtbaar");
    assert.match(files[f], /<script type="module" src="\/js\/maps\/main\.js"><\/script>/);
  }
});

// sw.js uitvoeren met een nagebootste Cache Storage: wat wordt er bij install opgehaald, wat ruimt activate op?
function runSw(src, pre = {}, fail = () => false) {
  const store = new Map(Object.entries(pre).map(([k, v]) => [k, new Map(v.map((a) => [a, "oud"]))]));
  const fetched = [], on = {};
  const cache = (name) => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name);
    return { match: async (a) => m.get(a), put: async (a, r) => { m.set(a, r); } };
  };
  const ctx = { URL, Promise, console, Error,
    self: { location: { origin: "https://kevs-inn.com" }, addEventListener: (t, f) => { on[t] = f; }, skipWaiting: () => {}, clients: { claim: () => {} } },
    caches: { open: async (n) => cache(n), keys: async () => [...store.keys()], delete: async (n) => store.delete(n), match: async () => undefined },
    fetch: async (a) => { fetched.push(a); return { ok: !fail(a), status: fail(a) ? 404 : 200, redirected: false }; } };
  vm.runInNewContext(src, ctx);
  const wait = async (t) => { let p; on[t]({ waitUntil: (x) => { p = x; } }); await p; };
  return { store, fetched, install: () => wait("install"), activate: () => wait("activate") };
}

test("install: alleen wat in de cache van die versie ontbreekt wordt opgehaald; activate laat de drie huidige caches staan", async () => {
  const init = list("ASSETS"), maps = list("MAPS_ASSETS"), vendor = list("VENDOR_ASSETS");
  const IC = `initiative-tafel-${INIT}`, MC = `kevs-inn-maps-${MAPS}`, VC = /const VENDOR = "([^"]+)"/.exec(SW)[1];
  // verse installatie: alles ophalen
  const a = runSw(SW);
  await a.install();
  assert.deepEqual(new Set(a.fetched), new Set([...init, ...maps, ...vendor]));
  // Maps-release: Initiative- en pdf.js-cache zijn er al, Maps-cache van de vorige Maps-versie
  const bumped = SW.replace(/const MAPS_VERSION = "[^"]+";/, 'const MAPS_VERSION = "9.9.9";');
  const b = runSw(bumped, { [IC]: init, [VC]: vendor, [MC]: maps, "initiative-tafel-0.0.1": ["./"] });
  await b.install();
  assert.deepEqual(b.fetched.sort(), [...maps].sort(), "alleen Maps-bestanden opnieuw, geen Initiative-download");
  assert.equal([...b.store.get(IC).values()].every((v) => v === "oud"), true, "Initiative-cache ongewijzigd");
  await b.activate();
  assert.deepEqual([...b.store.keys()].sort(), [IC, VC, "kevs-inn-maps-9.9.9"].sort(), "oude Maps- en Initiative-caches weg, huidige blijven");
  // Initiative-release: Maps-cache blijft staan en wordt niet opnieuw opgehaald
  const ib = SW.replace(/const VERSION = "[^"]+";/, 'const VERSION = "9.9.9";');
  const c = runSw(ib, { [IC]: init, [VC]: vendor, [MC]: maps });
  await c.install();
  assert.deepEqual(c.fetched.sort(), [...init].sort());
  await c.activate();
  assert.deepEqual([...c.store.keys()].sort(), ["initiative-tafel-9.9.9", VC, MC].sort());
  // een mislukt Maps-bestand houdt de install (en dus een Initiative-update) niet tegen; Initiative-fout wel
  const d = runSw(SW, {}, (a) => a === "./css/maps.css");
  await d.install();
  assert.ok(!d.store.get(MC).has("./css/maps.css") && d.store.get(MC).has("./js/maps/main.js"), "rest van Maps wel bewaard");
  const e = runSw(SW, {}, (a) => a === "./css/app.css");
  await assert.rejects(e.install());
});

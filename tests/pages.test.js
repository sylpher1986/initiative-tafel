// WP21 (TA5): pagina's per taal, doorverwijzers, manifest en service worker. Zie docs/i18n.md §2 en tools/pages.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { build, urlOf, APP_PAGES, REDIRECTS } from "../tools/pages.mjs";
import { target } from "../js/i18n/redirect.js";
import { SUPPORTED } from "../js/i18n/lang.js";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p, "utf8");
const files = await build();
const sw = read("sw.js");
const assets = new Set([...sw.matchAll(/^\s*"\.(\/[^"]*)",?$/gm)].map((m) => m[1]));

test("gegenereerde pagina's en manifests zijn actueel (anders: node tools/pages.mjs)", () => {
  for (const [p, s] of Object.entries(files)) {
    assert.ok(existsSync(ROOT + p), `${p} ontbreekt`);
    assert.equal(read(p), s, `${p} is verouderd`);
  }
});

test("elke pagina per taal: juiste lang, noindex, manifest van die taal, geen relatieve paden", () => {
  for (const lang of SUPPORTED) {
    for (const rest of Object.keys(APP_PAGES)) {
      const p = `${lang}/${rest}index.html`, h = files[p];
      assert.match(h, new RegExp(`<html lang="${lang}">`), p);
      assert.match(h, /<meta name="robots" content="noindex">/, p);
      assert.doesNotMatch(h, /\{\{/, p + ": placeholder niet ingevuld");
      const rel = [...h.matchAll(/\s(?:src|href)="([^"]*)"/g)].map((m) => m[1]).filter((u) => !/^(\/|https?:|#|data:|mailto:)/.test(u));
      assert.deepEqual(rel, [], p + ": relatief pad werkt niet onder /" + lang + "/" + rest);
    }
    assert.match(files[`${lang}/initiative/index.html`], new RegExp(`<link rel="manifest" href="/${lang}/manifest.webmanifest">`));
  }
});

test("manifest: zelfde identiteit als oude installaties, start via de doorverwijzer, absolute iconen", () => {
  for (const p of ["manifest.webmanifest", ...SUPPORTED.map((l) => `${l}/manifest.webmanifest`)]) {
    const m = JSON.parse(files[p]);
    assert.equal(m.id, "/", p);
    assert.equal(m.scope, "/", p);
    assert.equal(m.start_url, "/initiative/", p);
    assert.ok(SUPPORTED.includes(m.lang), p);
    assert.ok(m.description && !m.description.includes("page."), p + ": beschrijving uit de catalogus");
    for (const i of m.icons) { assert.match(i.src, /^\//, p); assert.ok(existsSync(ROOT + i.src.slice(1)), i.src); }
  }
  assert.equal(JSON.parse(files["en/manifest.webmanifest"]).lang, "en");
  assert.equal(JSON.parse(files["manifest.webmanifest"]).lang, "nl", "oud manifestadres = terugvaltaal zolang Engels niet live is");
});

test("doorverwijzers: laden redirect.js, en zonder modules of JavaScript naar de terugvaltaal", () => {
  const want = { "index.html": "/nl/initiative/", "speler.html": "/nl/initiative/player/", "player.html": "/nl/initiative/player/",
    "initiative/index.html": "/nl/initiative/", "initiative/player/index.html": "/nl/initiative/player/" };
  assert.deepEqual(Object.keys(want).sort(), Object.keys(REDIRECTS).sort());
  for (const [f, to] of Object.entries(want)) {
    const h = files[f];
    const back = `location.replace('${to}' + location.search + location.hash)`;
    assert.ok(h.includes(`<script type="module" onerror="${back}">import { go } from "/js/i18n/redirect.js"; go();</script>`), f + ": module met terugval");
    assert.ok(h.includes(`<script nomodule>${back}</script>`), f + ": nomodule");
    assert.match(h, /<html lang="nl">/, f);
    assert.ok(h.includes(`url=${to}"`) && h.includes(`<a href="${to}">`), f + ": noscript en link");
    assert.match(h, /<meta name="robots" content="noindex">/, f);
  }
});

const store = (lang) => ({ get: () => lang });
const loc = (href) => { const u = new URL(href, "https://kevs-inn.com"); return { pathname: u.pathname, search: u.search, hash: u.hash }; };
test("redirect.js: oude adressen naar /nl/… met query; voorkeur en browsertaal tellen alleen uit LIVE", () => {
  const go = (href, nav = { languages: ["nl-NL"] }, s = store(null)) => target(loc(href), nav, s);
  assert.equal(go("/"), "/nl/initiative/");
  assert.equal(go("/speler?k=ABC234"), "/nl/initiative/player/?k=ABC234");
  assert.equal(go("/speler.html?k=ABC234#x"), "/nl/initiative/player/?k=ABC234#x");
  assert.equal(go("/player?k=ABC234"), "/nl/initiative/player/?k=ABC234");
  assert.equal(go("/initiative/"), "/nl/initiative/");
  assert.equal(go("/initiative/player/?k=K7M3QX"), "/nl/initiative/player/?k=K7M3QX");
  assert.equal(go("/index.html"), "/nl/initiative/");
  // Engels nog niet live: Engelse browser en Engelse voorkeur gaan ook naar nl (WP33 zet en in LIVE)
  assert.equal(go("/", { languages: ["en-GB"] }), "/nl/initiative/");
  assert.equal(go("/", { languages: [] }, store("en")), "/nl/initiative/");
  // oude browser: alleen navigator.language, of niets
  assert.equal(go("/speler?k=A", { language: "nl-BE" }), "/nl/initiative/player/?k=A");
  assert.equal(go("/", {}), "/nl/initiative/");
  // een pagina met een goed prefix verwijst niet door (geen lus)
  assert.equal(go("/nl/initiative/player/?k=A"), null);
  assert.equal(go("/en/initiative/"), null);
  // WP22: in de i18n-debugstand telt een Engelse voorkeur (taalkiezer) wel, ook voor de spelerslink
  const dbg = (href, s, nav = { languages: ["nl-NL"] }) => target(loc(href), nav, s, ["en", "nl"]);
  assert.equal(dbg("/speler?k=ABC234", store("en")), "/en/initiative/player/?k=ABC234");
  assert.equal(dbg("/", store("nl"), { languages: ["en-GB"] }), "/nl/initiative/");
  assert.equal(dbg("/nl/initiative/", store("en")), null, "een /nl/-link blijft Nederlands");
});

test("service worker: elke gegenereerde pagina en redirect.js in de offline-cache, registratie op /", () => {
  const missing = Object.keys(files).map(urlOf).filter((u) => !assets.has(u));
  assert.deepEqual(missing, [], "ontbreekt in ASSETS van sw.js");
  assert.ok(assets.has("/js/i18n/redirect.js") && assets.has("/js/i18n/lang.js"));
  assert.match(read("js/main.js"), /navigator\.serviceWorker\.register\("\/sw\.js", \{ scope: "\/" \}\)/);
  assert.ok(read(".assetsignore").split("\n").includes("/pages"), "sjablonen niet publiceren");
});

test("spelerslink blijft taalloos en kort (QR, tv's): /speler?k=", () => {
  assert.match(read("js/ui/kamer.js"), /`\$\{location\.origin\}\/speler\?k=\$\{room\.code\}`/);
  assert.match(read("js/speler.js"), /`\$\{location\.origin\}\/speler\?k=\$\{code\}`/);
});

test("geen relatieve paden naar eigen bestanden in js/ (fetch, sprites): de pagina staat niet meer in de root", () => {
  const walk = (d) => readdirSync(ROOT + d).flatMap((n) => (statSync(ROOT + d + n).isDirectory() ? walk(d + n + "/") : [d + n]));
  const bad = [];
  for (const f of walk("js/").filter((p) => p.endsWith(".js"))) {
    // "data/x.json" is relatief aan de pagina (fout); "./data/x.js" in een import is relatief aan de module (goed)
    for (const m of read(f).matchAll(/["'`](icons|data|api|fonts|css|locales)\/[\w.-]+/g)) bad.push(`${f}: ${m[0]}`);
    // venster of navigatie naar een eigen pagina: relatief mag alleen binnen de taalmap (player/), nooit een oud adres
    for (const m of read(f).matchAll(/(?:window\.open|location\.(?:assign|replace))\(\s*["'`]([^"'`]*)/g)) if (!/^(\/|https?:|player\/$)/.test(m[1])) bad.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(bad, []);
});

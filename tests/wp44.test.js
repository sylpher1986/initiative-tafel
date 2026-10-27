// WP44 (WB1, WB2; 2.3.0): Engels zonder taalcode ("/", "/initiative/"), andere talen met voorvoegsel ("/nl/…"),
// "/en/…" → 301 (Worker en service worker); beginscherm-app opent in de taal van voorkeur of browser; homepage-thema
// volgt de keuze uit de app (it-theme), anders het systeem. Zie js/i18n/lang.js, worker/index.js, sw.js, pages/home.html.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import vm from "node:vm";
import { langFromPath, pathFor, joinUrl, launchRedirect, SUPPORTED, LIVE } from "../js/i18n/lang.js";
import { enRedirect } from "../worker/index.js";
import { build } from "../tools/pages.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p, "utf8");
const files = await build();

test("langFromPath: geen voorvoegsel = Engels, /nl/ = Nederlands", () => {
  assert.equal(langFromPath("/"), "en");
  assert.equal(langFromPath("/initiative/"), "en");
  assert.equal(langFromPath("/initiative/player/"), "en");
  assert.equal(langFromPath("/nl/"), "nl");
  assert.equal(langFromPath("/nl/initiative/"), "nl");
});

test("pathFor geeft nooit /en/, voor geen enkele pagina", () => {
  for (const page of ["/", "/initiative/", "/initiative/player/", "/speler", "/player", "/index.html", "/404.html", "/manifest.webmanifest"]) {
    assert.doesNotMatch(pathFor("en", page), /^\/en(\/|$)/, page);
    for (const l of SUPPORTED.filter((x) => x !== "en")) assert.ok(pathFor(l, page).startsWith(`/${l}/`), `${l} ${page}`);
  }
});

test("geen /en/ meer in js/, pages/, sw.js en de manifesten (behalve de WP44-doorverwijsregel)", () => {
  const walk = (d) => readdirSync(ROOT + d).flatMap((n) => (statSync(ROOT + d + n).isDirectory() ? walk(d + n + "/") : [d + n]));
  const list = [...walk("js/"), ...walk("pages/"), "sw.js", ...Object.keys(files).filter((f) => f.endsWith(".webmanifest"))];
  const bad = [];
  for (const f of list) read(f).split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\/?\*)/.test(line)) return; // commentaar mag het oude adres noemen
    if (/["'`(]\/en\/|["'`]\/en["'`]|\/en\/initiative/.test(line) && !/WP44/.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
  });
  assert.deepEqual(bad, []);
  assert.ok(!Object.keys(files).some((f) => f.startsWith("en/")), "geen gegenereerde bestanden onder en/");
});

test("spelerslink: rechtstreeks naar het spelersscherm in de taal van de pagina, met ?k=", () => {
  assert.equal(joinUrl("https://kevs-inn.com", "en", "K7M3QX"), "https://kevs-inn.com/initiative/player/?k=K7M3QX");
  assert.equal(joinUrl("https://kevs-inn.com", "nl", "K7M3QX"), "https://kevs-inn.com/nl/initiative/player/?k=K7M3QX");
  assert.equal(joinUrl("https://x.dev", "en-GB", "A"), "https://x.dev/initiative/player/?k=A");
  assert.equal(joinUrl("https://x.dev", "xx", "A"), "https://x.dev/initiative/player/?k=A", "onbekende taal: Engels");
});

test("beginscherm-app: alleen standalone en zonder voorvoegsel kiest de app voorkeur → browser → Engels", () => {
  const go = (o) => launchRedirect({ path: "/initiative/", standalone: true, ...o });
  assert.equal(go({ pref: "nl" }), "/nl/initiative/", "installatie van vóór 2.3.0 met Nederlandse voorkeur");
  assert.equal(go({ languages: ["nl-NL"] }), "/nl/initiative/", "geen voorkeur: browsertaal, zoals de oude doorverwijzer");
  assert.equal(go({ pref: "en", languages: ["nl-NL"] }), null, "Engels gekozen: blijft");
  assert.equal(go({ languages: ["de"] }), null, "onbekend: Engels");
  assert.equal(go({ pref: "nl", search: "?x=1", hash: "#h" }), "/nl/initiative/?x=1#h");
  assert.equal(launchRedirect({ path: "/initiative/", standalone: false, pref: "nl", languages: ["nl"] }), null, "website: nooit automatisch");
  assert.equal(launchRedirect({ path: "/nl/initiative/", standalone: true, pref: "en" }), null, "voorvoegsel wint altijd");
  assert.equal(launchRedirect({ path: "/nl/initiative/", standalone: true, pref: "nl" }), null, "geen lus");
  assert.equal(launchRedirect(), null);
  assert.match(read("js/main.js"), /if \(launchGo\(\)\) return;/, "main.js roept het aan vóór het laden");
  for (const f of ["manifest.webmanifest", "nl/manifest.webmanifest"]) {
    const m = JSON.parse(files[f]);
    assert.deepEqual([m.id, m.start_url, m.scope], ["/", "/initiative/", "/"], f + ": identiteit van bestaande installaties ongewijzigd");
  }
});

test("Worker: /en en /en/… → 301 naar hetzelfde pad zonder /en, query blijft, geen lus, geen andere host", async () => {
  const u = (p) => enRedirect(new URL("https://kevs-inn.com" + p));
  assert.equal(u("/en"), "https://kevs-inn.com/");
  assert.equal(u("/en/"), "https://kevs-inn.com/");
  assert.equal(u("/en/initiative/"), "https://kevs-inn.com/initiative/");
  assert.equal(u("/en/initiative/player/?k=K7M3QX"), "https://kevs-inn.com/initiative/player/?k=K7M3QX");
  assert.equal(u("/en/manifest.webmanifest"), "https://kevs-inn.com/manifest.webmanifest");
  assert.equal(u("/en//evil.com/x"), "https://kevs-inn.com/evil.com/x", "geen //evil.com");
  for (const p of ["/", "/initiative/", "/nl/", "/enx", "/nl/en/", "/api/room"]) assert.equal(u(p), null, p);
  for (const p of ["/en", "/en/initiative/player/?k=A", "/en///x"]) {
    const to = new URL(u(p));
    assert.equal(to.host, "kevs-inn.com", p);
    assert.equal(enRedirect(to), null, p + ": één stap");
  }
  const { handle } = await import("../worker/index.js");
  const res = await handle(new Request("https://kevs-inn.com/en/initiative/?k=AB"), { ASSETS: { fetch: () => new Response("asset") } });
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), "https://kevs-inn.com/initiative/?k=AB");
  assert.equal(await (await handle(new Request("https://kevs-inn.com/initiative/"), { ASSETS: { fetch: () => new Response("asset") } })).text(), "asset");
  const wr = read("wrangler.jsonc");
  assert.match(wr, /"run_worker_first": \["\/api\/\*", "\/en", "\/en\/\*"\]/, "anders komt /en niet bij de Worker");
});

test("service worker: /en/… offline naar hetzelfde pad zonder /en (gelijk aan de Worker), andere adressen niet", () => {
  const on = {};
  const ctx = { URL, Promise, console, self: { location: { origin: "https://kevs-inn.com" }, addEventListener: (t, f) => { on[t] = f; } },
    caches: { match: () => Promise.resolve(undefined), open: () => Promise.resolve({ put() {} }) }, fetch: () => Promise.resolve(new Response("net")),
    Response: { redirect: (url, status) => ({ redirect: url, status }) } };
  vm.runInNewContext(read("sw.js"), ctx);
  const ask = (path) => { let r = null; on.fetch({ request: { method: "GET", url: "https://kevs-inn.com" + path }, respondWith: (x) => { r = x; } }); return r; };
  for (const p of ["/en", "/en/", "/en/initiative/player/?k=AB", "/en//evil.com"]) {
    const want = { redirect: enRedirect(new URL("https://kevs-inn.com" + p)), status: 301 };
    assert.deepEqual({ ...ask(p) }, want, p);
  }
  const other = ask("/initiative/");
  assert.ok(other && typeof other.then === "function", "gewone pagina: uit de cache");
});

// WB2: homepage-thema. Het inline script uit de gegenereerde homepage uitvoeren met een nep-document.
const homes = SUPPORTED.map((l) => [l, files[`${pathFor(l, "/").slice(1)}index.html`]]);
const inline = (h) => /<script>(\(function\(\)\{var d=document\.documentElement,K="it-theme"[\s\S]*?)<\/script>/.exec(h)?.[1];
function runTheme(stored, { throws = false, dark = false } = {}) {
  const attrs = {}, metas = [{ media: "(prefers-color-scheme: light)", content: "#241811" }, { media: "(prefers-color-scheme: dark)", content: "#1d130d" }];
  const listeners = {}, ls = { v: stored, getItem(k) { if (throws) throw new Error("SecurityError"); return k === "it-theme" ? this.v : null; } };
  const meta = (m) => ({ getAttribute: (a) => (a === "media" ? m.media : m.content), setAttribute: (a, v) => { m[a] = v; } });
  const ctx = { localStorage: ls, addEventListener: (t, f) => { listeners[t] = f; },
    document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; } },
      querySelectorAll: () => metas.map(meta) } };
  vm.runInNewContext(inline(homes[0][1]), ctx);
  return { theme: attrs["data-theme"], bars: metas.map((m) => m.content), ls, fire: (key) => listeners.storage?.({ key }), attrs, metas, dark };
}

test("homepage-thema: bewuste keuze Licht/Donker uit de app geldt, anders niets (systeem); kapotte opslag gooit niet", () => {
  assert.ok(inline(homes[0][1]), "inline themascript aanwezig");
  let r = runTheme("dark");
  assert.equal(r.theme, "dark");
  assert.deepEqual(r.bars, ["#1d130d", "#1d130d"], "browserbalk volgt de keuze");
  r = runTheme("light");
  assert.equal(r.theme, "light");
  assert.deepEqual(r.bars, ["#241811", "#241811"]);
  for (const v of [null, "system", "auto", "", "DARK"]) {
    r = runTheme(v);
    assert.equal(r.theme, undefined, String(v) + ": volgt het systeem");
    assert.deepEqual(r.bars, ["#241811", "#1d130d"], String(v) + ": theme-color per media blijft");
  }
  assert.doesNotThrow(() => { r = runTheme("dark", { throws: true }); });
  assert.equal(r.theme, undefined, "geen opslag: systeem");
});

test("homepage-thema: keuze in de app in een ander tabblad schakelt mee (storage-event), terug naar Systeem ook", () => {
  const r = runTheme("dark");
  r.ls.v = "light"; r.fire("it-theme");
  assert.equal(r.attrs["data-theme"], "light");
  r.ls.v = null; r.fire("it-theme");
  assert.equal(r.attrs["data-theme"], undefined, "Systeem: sleutel weg → volgt weer het systeem");
  assert.deepEqual(r.metas.map((m) => m.content), ["#241811", "#1d130d"]);
  r.ls.v = "dark"; r.fire("andere-sleutel");
  assert.equal(r.attrs["data-theme"], undefined, "andere sleutels doen niets");
});

test("homepage-thema: zelfde sleutel en kleuren als js/theme.js; script in <head> vóór de CSS; color-scheme en twee theme-color", () => {
  const theme = read("js/theme.js");
  assert.match(theme, /const KEY = "it-theme";/);
  assert.match(theme, /const BAR = \{ light: "#241811", dark: "#1d130d" \}/);
  for (const [l, h] of homes) {
    const headEnd = h.indexOf("</head>"), s = h.indexOf('<script>(function(){var d=document.documentElement,K="it-theme"'), css = h.indexOf("<style>");
    assert.ok(s > 0 && s < css && css < headEnd, l + ": inline script in <head>, vóór de stylesheet");
    assert.ok(h.indexOf('<meta name="theme-color"') < s, l + ": na de theme-color-tags (die het script bijwerkt)");
    assert.match(h, /<meta name="color-scheme" content="light dark">/, l);
    assert.equal((h.slice(0, headEnd).match(/<meta name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: (light|dark)\)">/g) || []).length, 2, l);
    assert.doesNotMatch(h, /<script src="\/js\/theme\.js">/, l + ": geen extra request");
    assert.match(h, /@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)\{/, l + ": zonder JS volgt de CSS het systeem");
    assert.match(h, /:root\[data-theme="dark"\]\{/, l);
  }
  assert.ok(LIVE.every((l) => homes.some(([x]) => x === l)));
});

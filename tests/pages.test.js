// WP21 (TA5): pagina's per taal, doorverwijzers, manifest en service worker. Zie docs/i18n.md §2 en tools/pages.mjs.
// Sinds WP44 (2.3.0): Engels zonder taalcode in de root, andere talen onder /{taal}/ (dirOf/pathFor).
import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { build, urlOf, dirOf, APP_PAGES, REDIRECTS, fillText, HOME_PAGE, SITE, OG_IMAGE, NOT_CACHED, HIDDEN, seoHead, langNav, sitemap, robots } from "../tools/pages.mjs";
import { htmlStrings, isDutch } from "../tools/i18n-audit.mjs";
import { target } from "../js/i18n/redirect.js";
import { SUPPORTED, LIVE, pathFor, langBase } from "../js/i18n/lang.js";

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
      const p = `${dirOf(lang, rest)}index.html`, h = files[p];
      assert.match(h, new RegExp(`<html lang="${lang}">`), p);
      assert.match(h, /<meta name="robots" content="noindex">/, p);
      assert.doesNotMatch(h, /\{\{/, p + ": placeholder niet ingevuld");
      const rel = [...h.matchAll(/\s(?:src|href)="([^"]*)"/g)].map((m) => m[1]).filter((u) => !/^(\/|https?:|#|data:|mailto:)/.test(u));
      assert.deepEqual(rel, [], p + ": relatief pad werkt niet onder " + pathFor(lang, "/" + rest));
    }
    assert.match(files[`${dirOf(lang, "initiative/")}index.html`], new RegExp(`<link rel="manifest" href="${langBase(lang)}/manifest.webmanifest">`));
  }
});

test("manifest: één app per taal, id/scope/start_url = de eigen app-pagina (K10), absolute iconen", () => {
  for (const lang of SUPPORTED) {
    const p = `${dirOf(lang)}manifest.webmanifest`, home = "/" + dirOf(lang, "initiative/");
    const m = JSON.parse(files[p]);
    assert.deepEqual([m.id, m.scope, m.start_url], [home, home, home], p);
    assert.ok(files[`${dirOf(lang, "initiative/player/")}index.html`] && ("/" + dirOf(lang, "initiative/player/")).startsWith(m.scope), p + ": spelersscherm binnen de scope");
    assert.ok(!("/" + dirOf(lang, "maps/")).startsWith(m.scope) && !"/".startsWith(m.scope), p + ": Inn Sight en homepage erbuiten");
    assert.ok(SUPPORTED.includes(m.lang), p);
    assert.ok(m.description && !m.description.includes("page."), p + ": beschrijving uit de catalogus");
    for (const i of m.icons) { assert.match(i.src, /^\//, p); assert.ok(existsSync(ROOT + i.src.slice(1)), i.src); }
  }
  assert.equal(JSON.parse(files["manifest.webmanifest"]).lang, "en", "Engels manifest = ook het oude adres");
  assert.equal(JSON.parse(files["nl/manifest.webmanifest"]).lang, "nl");
  assert.ok(!files["en/manifest.webmanifest"], "geen /en/ meer");
});

test("oude spelersadressen: naar het Engelse spelersscherm, query en hash blijven, ook zonder JavaScript (WP44)", () => {
  assert.deepEqual(REDIRECTS, { "speler.html": "/speler", "player.html": "/player" });
  for (const f of Object.keys(REDIRECTS)) {
    const h = files[f], to = "/initiative/player/";
    assert.ok(h.includes(`<script>location.replace('${to}' + location.search + location.hash)</script>`), f);
    assert.doesNotMatch(h, /redirect\.js|kevs-lang|navigator\.language/, f + ": geen taalkeuze op voorkeur of browser");
    assert.match(h, /<html lang="en">/, f);
    assert.ok(h.includes(`url=${to}"`) && h.includes(`<a href="${to}">`), f + ": noscript en link");
    assert.match(h, /<meta name="robots" content="noindex">/, f);
  }
});

const loc = (href) => { const u = new URL(href, "https://kevs-inn.com"); return { pathname: u.pathname, search: u.search, hash: u.hash }; };
test("redirect.js (404-pagina's): alleen het pad telt; /en/ en ongeldig voorvoegsel naar het pad zonder voorvoegsel", () => {
  const go = (href) => target(loc(href));
  assert.equal(go("/en/initiative/?k=ABC234#x"), "/initiative/?k=ABC234#x");
  assert.equal(go("/en/"), "/");
  assert.equal(go("/NL/initiative/player/?k=A"), "/nl/initiative/player/?k=A");
  assert.equal(go("/xx/initiative/"), "/initiative/", "ongeldig voorvoegsel → Engels");
  assert.equal(go("/de/"), "/");
  assert.equal(go("/foo/bar"), null, "zonder voorvoegsel: Engels, blijft op de 404");
  assert.equal(go("/nl/bestaat-niet"), null, "geldig voorvoegsel: blijft op de 404");
  assert.equal(go("/"), null);
});

test("service worker: elke gegenereerde pagina en redirect.js in de offline-cache, registratie op /", () => {
  const missing = Object.keys(files).filter((f) => !NOT_CACHED.includes(f)).map(urlOf).filter((u) => !assets.has(u));
  assert.deepEqual(missing, [], "ontbreekt in ASSETS van sw.js");
  assert.ok(assets.has("/js/i18n/redirect.js") && assets.has("/js/i18n/lang.js"));
  assert.match(read("js/main.js"), /navigator\.serviceWorker\.register\("\/sw\.js", \{ scope: "\/" \}\)/);
  assert.ok(read(".assetsignore").split("\n").includes("/pages"), "sjablonen niet publiceren");
});

test("spelerslink (QR, tv's): rechtstreeks naar het spelersscherm in de taal van de pagina via joinUrl (WP44)", () => {
  assert.match(read("js/ui/kamer.js"), /joinUrl\(location\.origin, document\.documentElement\.lang, room\.code\)/);
  assert.match(read("js/speler.js"), /joinUrl\(location\.origin, document\.documentElement\.lang, code\)/);
  assert.doesNotMatch(read("js/ui/kamer.js") + read("js/speler.js"), /\/speler\?k=/);
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

// WP23 (TA7): teksten in de sjablonen komen uit de catalogus ({{t:…}} / {{tjs:…}}), ingevuld door tools/pages.mjs.
test("fillText: HTML-escape voor tekst en attributen, JS-escape binnen een string, onbekende sleutel = fout", () => {
  const cat = { "a.b": `Tom & "Jerry" <x>`, "a.js": `it's "ok"\n</script>` };
  assert.equal(fillText(`<p title="{{t:a.b}}">{{t:a.b}}</p>`, cat), `<p title="Tom &amp; &quot;Jerry&quot; &lt;x&gt;">Tom &amp; &quot;Jerry&quot; &lt;x&gt;</p>`);
  const js = fillText(`<b onerror="f('{{tjs:a.js}}')">`, cat);
  assert.equal(js, `<b onerror="f('it\\u0027s \\u0022ok\\u0022\\u000a\\u003c/script\\u003e')">`);
  assert.equal(new Function(`return '${/f\('(.*)'\)/.exec(js)[1]}'`)(), cat["a.js"], "JS leest de tekst ongewijzigd terug");
  assert.throws(() => fillText("{{t:a.nope}}", cat, "x.html"), /a\.nope/);
  assert.throws(() => fillText("{{t:a.p}}", { "a.p": "Hi {name}" }), /placeholder/, "{name} zou letterlijk op de pagina staan");
  assert.equal(fillText("'{{tjs:a.q}}'", { "a.q": "a`b" }), "'a\\u0060b'");
});

// Skelet van een pagina zonder tekst: tags met attributen, behalve vertaalbare attributen en lang. Zo blijven id's,
// formulieren en hidden gelijk in elke taal (listeners en statische formulieren in de Voorbereiden-indeling).
const skeleton = (h) => [...h.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "<script/>").replace(/<!--[\s\S]*?-->/g, "").matchAll(/<[^>]+>/g)]
  .map((m) => m[0].replace(/\s(aria-label|placeholder|title|alt|content|data-label|on[a-z]+|lang)="[^"]*"/g, " $1"));
test("elke taal heeft hetzelfde skelet als het sjabloon (alleen tekst verschilt)", () => {
  for (const [rest, src] of Object.entries(APP_PAGES)) {
    for (const lang of SUPPORTED) assert.deepEqual(skeleton(files[`${dirOf(lang, rest)}index.html`]), skeleton(read(src).replaceAll("{{lang}}", lang).replaceAll("{{base}}", langBase(lang))), `${lang}/${rest}`);
  }
});

test("Engelse pagina's zonder Nederlandse tekst (paden als src/2014/en tellen niet)", () => {
  for (const rest of [...Object.keys(APP_PAGES), "", "404"]) { // WP30: ook homepage en 404
    const p = rest === "404" ? "404.html" : `${rest}index.html`; // WP44: Engels in de root
    const nl = htmlStrings(files[p]).map((x) => x.text.replace(/\S*\/\S*|\b[a-z]{2}_[A-Z]{2}\b/g, " ")).filter(isDutch); // og:locale en_US
    assert.deepEqual(nl, [], p);
  }
});

test("pagina's: geen sleutel of plaatshouder zichtbaar, vet deel van een zin per taal", () => {
  for (const rest of Object.keys(APP_PAGES)) {
    const h = files[`nl/${rest}index.html`];
    assert.doesNotMatch(h, /\{\{|\b(init|player|page|common|maps)\.[a-z]+\.[A-Za-z0-9.]+/, rest);
  }
  assert.match(files["nl/initiative/index.html"], /<b>Geldt alleen voor spells:<\/b> de rest volgt regels 2014/);
  assert.match(files["initiative/index.html"], /<b>Applies to spells only:<\/b>/);
});

test("plaatshouders op de juiste plek: {{tjs:}} alleen in script of on…=\"…\", {{t:}} nooit daar of in een attribuut met ' of zonder aanhalingstekens", () => {
  for (const src of Object.values(APP_PAGES)) {
    const h = read(src), js = [];
    for (const m of h.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>|\son[a-z]+="[^"]*"/g)) js.push([m.index, m.index + m[0].length]);
    const inJs = (i) => js.some(([a, b]) => i >= a && i < b);
    for (const m of h.matchAll(/\{\{(t|tjs):/g)) assert.equal(inJs(m.index), m[1] === "tjs", `${src}: ${h.slice(m.index, m.index + 40)}`);
    assert.doesNotMatch(h, /=\s*'[^']*\{\{t:|=\s*\{\{t:/, src + ": {{t:}} escapet geen enkele aanhalingstekens");
  }
});

// WP30 (TA14): publieke homepage, metadata en SEO. docs/i18n.md §2.1 en WP30; besluiten V1 (domein), V4 (x-default).
const head = (h) => h.slice(0, h.indexOf("</head>"));
const links = (h, re) => [...head(h).matchAll(re)].map((m) => m[1] + (m[2] ? " " + m[2] : ""));
test("homepage per taal: lang, eigen title en description, canonical naar zichzelf op het domein, Open Graph", () => {
  const titles = new Set(), descs = new Set();
  for (const lang of SUPPORTED) {
    const h = files[`${dirOf(lang)}index.html`], url = SITE + pathFor(lang, "/");
    assert.match(h, new RegExp(`<html lang="${lang}">`));
    const title = /<title>([^<]+)<\/title>/.exec(h)[1], desc = /<meta name="description" content="([^"]+)">/.exec(h)[1];
    titles.add(title); descs.add(desc);
    assert.deepEqual(links(h, /<link rel="canonical" href="([^"]+)">/g), LIVE.includes(lang) ? [url] : [], lang + ": live = één canonical naar zichzelf; niet live = alleen noindex");
    assert.ok(h.includes(`<meta property="og:url" content="${url}">`), lang);
    assert.ok(h.includes(`<meta property="og:title" content="${title}">`) && h.includes(`<meta property="og:description" content="${desc}">`), lang + ": og = title/description");
    assert.ok(h.includes(`<meta property="og:locale" content="${lang === "en" ? "en_US" : "nl_NL"}">`), lang);
    assert.ok(h.includes(`<meta property="og:image" content="${SITE}${OG_IMAGE.src}">`), lang);
    assert.ok(h.includes(`<a class="cta" href="${pathFor(lang, "/initiative/")}">`), lang + ": knop naar de app in dezelfde taal");
    assert.doesNotMatch(h, /\{\{|\bpage\.[a-z]+\.[A-Za-z]+/, lang + ": geen plaatshouder of sleutel");
    const rel = [...h.matchAll(/\s(?:src|href)="([^"]*)"/g)].map((m) => m[1]).filter((u) => !/^(\/|https?:|#)/.test(u));
    assert.deepEqual(rel, [], lang + ": geen relatieve paden");
  }
  assert.equal(titles.size, SUPPORTED.length, "elke taal een eigen title");
  assert.equal(descs.size, SUPPORTED.length, "elke taal een eigen description");
  // og.png bestaat en is 1200×630 (PNG: breedte/hoogte op byte 16–23)
  const png = readFileSync(ROOT + OG_IMAGE.src.slice(1));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [OG_IMAGE.width, OG_IMAGE.height]);
});

test("hreflang: live homepages wijzen wederzijds naar elkaar plus x-default (terugval binnen LIVE); niet live = noindex zonder hreflang", () => {
  const alts = (h) => links(h, /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g).sort();
  for (const lang of SUPPORTED) {
    const h = files[`${dirOf(lang)}index.html`];
    if (LIVE.includes(lang)) {
      assert.doesNotMatch(h, /name="robots"/, lang + ": indexeerbaar");
      assert.deepEqual(alts(h), [...LIVE.map((l) => `${l} ${SITE}${pathFor(l, "/")}`), `x-default ${SITE}/`].sort(), lang);
    } else {
      assert.match(h, /<meta name="robots" content="noindex">/, lang + ": nog niet live (WP33)");
      assert.deepEqual(alts(h), [], lang);
    }
  }
  // na WP33 (beide live): wederzijds, x-default → Engels; sinds WP44 zonder /en/, og:locale:alternate naar de andere taal
  const both = { "page.home.title": "T", "page.home.desc": "D", "page.home.ogAlt": "A" };
  for (const lang of ["en", "nl"]) {
    const h = seoHead(lang, both, ["en", "nl"]);
    assert.deepEqual(alts(h + "</head>"), [`en ${SITE}/`, `nl ${SITE}/nl/`, `x-default ${SITE}/`]);
    assert.doesNotMatch(h, /noindex/);
    assert.ok(h.includes(`<meta property="og:locale:alternate" content="${lang === "en" ? "nl_NL" : "en_US"}">`), lang);
  }
  assert.throws(() => seoHead("nl", {}), /page\.home\.ogAlt|page\.home\.title/, "ontbrekende tekst = fout");
});

test("app, spelersscherm, doorverwijzers en 404: noindex en geen hreflang of canonical", () => {
  for (const [f, h] of Object.entries(files)) {
    if (!f.endsWith(".html") || /^(nl\/)?index\.html$/.test(f)) continue; // homepages (WP44: Engels = /index.html)
    assert.match(h, /<meta name="robots" content="noindex">/, f);
    assert.doesNotMatch(h, /hreflang=|rel="canonical"/, f);
  }
});

test("robots.txt: verborgen = Disallow alles; open = crawlen mag (noindex moet leesbaar zijn); sitemap = alleen live homepages", () => {
  assert.equal(HIDDEN, true, "besluit 26-10: hele site verborgen voor zoekmachines");
  assert.equal(files["robots.txt"], "User-agent: *\nDisallow: /\n");
  const r = robots(false);
  assert.doesNotMatch(r, /Disallow/, "open: geen Disallow, anders leest Google de noindex van de app niet");
  assert.ok(r.includes(`Sitemap: ${SITE}/sitemap.xml`));
  const sm = files["sitemap.xml"];
  assert.deepEqual([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]), LIVE.map((l) => SITE + pathFor(l, "/")));
  assert.doesNotMatch(sm, /\/en\//, "WP44: geen /en/ in de sitemap");
  assert.match(sm, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  const two = sitemap(["en", "nl"]);
  assert.equal((two.match(/<url>/g) || []).length, 2);
  assert.equal((two.match(/hreflang="x-default" href="https:\/\/kevs-inn\.com\/"/g) || []).length, 2, "elke url met alle alternates");
  assert.equal(SITE, "https://kevs-inn.com", "V1: canonieke host");
});

test("404-pagina's: zetten een ongeldig prefix recht via redirect.js, linken naar homepage en app in hun taal", () => {
  for (const [f, lang] of SUPPORTED.map((l) => [`${dirOf(l)}404.html`, l])) {
    const h = files[f];
    assert.match(h, new RegExp(`<html lang="${lang}">`), f);
    assert.ok(h.includes(`import { go } from "/js/i18n/redirect.js"; go();`), f);
    assert.ok(h.includes(`<a href="${pathFor(lang, "/")}">`) && h.includes(`<a href="${pathFor(lang, "/initiative/")}">`), f);
  }
  assert.ok(files["404.html"] && !files["en/404.html"], "Engelse 404 in de root (WP44)");
  assert.match(read("wrangler.jsonc"), /"not_found_handling": "404-page"/, "Cloudflare serveert de dichtstbijzijnde 404.html");
});

test("app linkt in Hulp naar de homepage in de eigen taal, in hetzelfde tabblad", () => {
  for (const lang of SUPPORTED) {
    const m = /<a class="homelink" href="([^"]+)"([^>]*)>/.exec(files[`${dirOf(lang, "initiative/")}index.html`]);
    assert.ok(m, lang);
    assert.equal(m[1], pathFor(lang, "/"));
    assert.doesNotMatch(m[2], /target=/, "beginscherm-app: geen losse browser");
  }
});

test("homepage: kleurtokens gelijk aan css/app.css (licht en donker), og:locale voor elke taal", () => {
  const norm = (v) => v.trim().toLowerCase().replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, "#$1$1$2$2$3$3");
  const vars = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]+)/g)].map((m) => [m[1], norm(m[2])])); // alleen kleuren
  const css = read("css/app.css"), home = read(HOME_PAGE);
  const appLight = vars(/:root\{([^}]*)\}/.exec(css)[1]), appDark = vars(/:root\[data-theme="dark"\]\{([^}]*)\}/.exec(css)[1]);
  const homeLight = vars(/:root\{([^}]*)\}/.exec(home)[1]), homeDark = vars(/:root\[data-theme="dark"\]\{([^}]*)\}/.exec(home)[1]);
  for (const [k, v] of Object.entries(homeLight)) if (k in appLight) assert.equal(v, appLight[k], "licht " + k);
  for (const [k, v] of Object.entries(homeDark)) assert.equal(v, appDark[k], "donker " + k);
  // donker via systeem gelijk aan donker via data-theme
  assert.deepEqual(vars(/:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/.exec(home)[1]), homeDark);
  for (const lang of SUPPORTED) assert.doesNotThrow(() => seoHead(lang, { "page.home.title": "T", "page.home.desc": "D", "page.home.ogAlt": "A" }), lang);
  assert.throws(() => seoHead("de", { "page.home.title": "T", "page.home.desc": "D", "page.home.ogAlt": "A" }, ["de"]), /og:locale/);
});

// WP37 (HS14): homepage huisstijl 2.0. Alleen bestaande tools, taalkiezer zonder JavaScript, hero-illustratie licht en boven de vouw.
test("homepage: taalkiezer per live taal met eigen taalnaam en aria-current, geen links naar niet-bestaande pagina's", () => {
  const cat = { "common.lang.en": "English", "common.lang.nl": "Nederlands" };
  assert.equal(langNav("nl", cat, ["en", "nl"]),
    '<a href="/" hreflang="en" lang="en" aria-label="English (EN)">en</a><a href="/nl/" hreflang="nl" lang="nl" aria-label="Nederlands (NL)" aria-current="page">nl</a>');
  assert.match(langNav("de", { ...cat, "common.lang.de": "Deutsch" }, ["en", "nl"]), /<a href="\/de\/"[^>]* aria-current="page">de<\/a>$/, "niet-live taal staat er zelf in");
  assert.throws(() => langNav("en", cat, ["en", "de"]), /common\.lang\.de/);
  assert.ok(!isDutch("EN") && !isDutch("NL") && !isDutch("English (EN)"), "taalcode in hoofdletters is geen Nederlandse tekst");
  assert.ok(isDutch("EN dan nog"), "alleen een losse code telt niet");
  for (const lang of SUPPORTED) {
    const h = files[`${dirOf(lang)}index.html`];
    assert.equal((h.match(/aria-current="page"/g) || []).length, 1, lang);
    assert.match(h, new RegExp(`<a href="${pathFor(lang, "/")}" hreflang="${lang}" lang="${lang}" aria-label="[^"]+" aria-current="page">`), lang);
    for (const [, href] of h.matchAll(/<a [^>]*href="(\/[^"]*)"/g)) {
      const f = href.endsWith("/") ? href + "index.html" : href;
      assert.ok(files[f.slice(1)] || existsSync(ROOT + f.slice(1)), `${lang}: link ${href} bestaat niet`);
    }
  }
});

test("homepage: hero-illustratie bestaat in AVIF en WebP, vaste maat, niet lazy, sfeerbeeld (alt leeg), elk bestand ≤ 150 kB (telefoon met DPR 3 kiest al 1347 px)", () => {
  const h = read(HOME_PAGE);
  const refs = [...new Set([...h.matchAll(/\/img\/(hero-tavern-\d+\.(?:avif|webp))/g)].map((m) => m[1]))].sort();
  assert.deepEqual(refs, ["hero-tavern-1347.avif", "hero-tavern-1347.webp", "hero-tavern-800.avif", "hero-tavern-800.webp"]);
  for (const f of refs) assert.ok(existsSync(ROOT + "img/" + f), f);
  for (const f of refs) assert.ok(statSync(ROOT + "img/" + f).size <= 150 * 1024, f + " te groot");
  const img = /<img [^>]*>/.exec(h.slice(h.indexOf('class="hero-img"')))[0];
  assert.match(img, /width="1347" height="1168"/);
  assert.match(img, /alt=""/);
  assert.doesNotMatch(img, /loading=/);
  assert.match(h, /<p class="kicker" lang="en">\{\{t:page\.home\.tagline\}\}<\/p>/, "merkregel blijft Engels, ook op /nl/");
});

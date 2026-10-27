// Pagina's per taal maken (meertaligheid, WP21/TA5; docs/i18n.md §2.1). Geen build-stap bij publiceren: de uitvoer
// wordt gecommit, net als tools/icons.mjs, en tests/pages.test.js bewaakt dat hij actueel is.
//   node tools/pages.mjs      na elke wijziging in pages/*.html, in deze tool of in de catalogi (page.*)
//
// Adressen (WP44, 2.3.0): Engels zonder taalcode in de root, elke andere taal onder /{taal}/ (pathFor in js/i18n/lang.js).
// Hieronder staat {base} voor "" (Engels) of "/{taal}" (bijv. "/nl").
// Uitvoer:
//   {base}/initiative/index.html, {base}/initiative/player/index.html   app-pagina's uit pages/*.html, per taal in
//                                                  SUPPORTED ({{lang}} en {{base}} ingevuld); en en nl live sinds WP33 (1.53.0)
// Tekst in de sjablonen (WP23): {{t:sleutel}} = catalogustekst, geëscaped voor HTML (tekst en attributen);
// {{tjs:sleutel}} = binnen een JS-string in een inline script of on…-attribuut (alles wat de string of het attribuut
// kan breken als \uXXXX). Een onbekende sleutel is een fout: dan wordt er niets geschreven.
//   {base}/manifest.webmanifest                    manifest per taal (Engels = /manifest.webmanifest, ook voor oude
//                                                  installaties); id "/" en start_url "/initiative/" houden alle
//                                                  installaties één app (js/main.js kiest bij het openen de taal)
//   /speler.html, /player.html                     oude spelersadressen → /initiative/player/ (Engels, query blijft), ook offline
//   {base}/index.html                              publieke homepage uit pages/home.html (WP30); {{seo}} = canonical,
//                                                  hreflang en Open Graph op SITE; alleen talen in LIVE indexeerbaar;
//                                                  {{langnav}} = taalkiezer (WP37); thema volgt de app-keuze (WP44)
//   {base}/404.html                                niet-gevonden-pagina (Cloudflare not_found_handling: dichtstbijzijnde
//                                                  404.html); zet een ongeldig prefix (/xx/…) via redirect.js recht
// /en/… bestaat niet meer: 301 in worker/index.js (enRedirect) en sw.js.
//   /robots.txt, /sitemap.xml                      sitemap = alleen de indexeerbare homepages met hun alternates
// Cloudflare serveert /nl/initiative/ uit nl/initiative/index.html en /speler uit speler.html (html_handling).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SUPPORTED, LIVE, DEFAULT, fallbackIn, pathFor, langBase } from "../js/i18n/lang.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** App-pagina's: pad na het taalprefix → sjabloon */
export const APP_PAGES = { "initiative/": "pages/initiative.html", "initiative/player/": "pages/player.html" };
/** Bestand voor een adres in een taal: dir("en", "initiative/") → "initiative/", dir("nl", "") → "nl/" (WP44) */
export const dirOf = (lang, rest = "") => pathFor(lang, "/" + rest).slice(1);
/** Publieke homepage per taal (WP30): "/" (Engels) en "/{taal}/" */
export const HOME_PAGE = "pages/home.html";
/** Canonieke host (V1): canonical, hreflang, sitemap en Open Graph wijzen hierheen, ook vanaf *.workers.dev */
export const SITE = "https://kevs-inn.com";
/** Hele site verborgen voor zoekmachines (besluit Michiel 26-10): robots.txt = Disallow: /. Op false zetten om te
 *  laten indexeren (dan gelden canonical, hreflang, noindex van de app en de sitemap, die al klaarstaan). */
export const HIDDEN = true;
/** Deelafbeelding (1200×630) voor Open Graph */
export const OG_IMAGE = { src: "/icons/og.png", width: 1200, height: 630 };
const OG_LOCALE = { en: "en_US", nl: "nl_NL" }; // en_US: Amerikaanse spelling zoals de PHB
/** Niet in de offline-cache van sw.js: Cloudflare-bestanden die nooit als navigatie geopend worden */
export const NOT_CACHED = ["robots.txt", "sitemap.xml", ...SUPPORTED.map((l) => `${dirOf(l)}404.html`)];
/** Oude spelersadressen (bestand → adres dat Cloudflare ervoor serveert); doel = pageFor in lang.js, in het Engels (WP44) */
export const REDIRECTS = { "speler.html": "/speler", "player.html": "/player" };

const ICONS = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/** Manifest voor één taal. id en start_url gelijk in elke taal en ongewijzigd sinds WP21, zodat elke installatie (ook van
 *  vóór 2.3.0) één app blijft; "/initiative/" is sinds WP44 de Engelse app, die in een geïnstalleerde app de taal van
 *  voorkeur of browser opent (launchRedirect in js/i18n/lang.js, aangeroepen in js/main.js). */
export function manifest(lang, cat) {
  return JSON.stringify({
    id: "/",
    name: "Kev’s Inn itiative",
    short_name: "Inn itiative",
    description: cat["page.manifest.desc"],
    lang,
    start_url: "/initiative/",
    scope: "/",
    display: "standalone",
    background_color: "#1d130d",
    theme_color: "#241811",
    icons: ICONS,
  }, null, 2) + "\n";
}

const banner = (src) => `<!-- Gegenereerd door tools/pages.mjs uit ${src}: wijzig het sjabloon en draai node tools/pages.mjs -->\n`;

const escHtml = (v) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escJs = (v) => v.replace(/[\\"'`<>&\n\r\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
/** Plaatshouders {{t:…}} en {{tjs:…}} invullen uit een catalogus (sleutel → tekst) */
export function fillText(tpl, cat, src = "") {
  return tpl.replace(/\{\{(t|tjs):([A-Za-z0-9.]+)\}\}/g, (m, kind, key) => {
    const v = cat[key];
    if (typeof v !== "string") throw new Error(`${src}: geen tekst voor ${key}`);
    if (/\{[A-Za-z]/.test(v)) throw new Error(`${src}: ${key} heeft een placeholder; sjablonen vullen geen waarden in`);
    return kind === "t" ? escHtml(v) : escJs(v);
  });
}

/** App-pagina in een taal: banner na de doctype, {{lang}} (taalcode), {{base}} (voorvoegsel: "" of "/nl", WP44) en de teksten ingevuld */
export function appPage(tpl, src, lang, cat = {}) {
  const out = fillText(tpl.replaceAll("{{lang}}", lang).replaceAll("{{base}}", langBase(lang)), cat, src);
  if (out.includes("{{")) throw new Error(`${src}: onbekende plaatshouder ${out.slice(out.indexOf("{{"), out.indexOf("{{") + 30)}`);
  return out.replace(/^(<!doctype html>\n)/i, `$1${banner(src)}`);
}

/** Doorverwijzer van een oud adres naar de Engelse pagina (WP44: geen taalkeuze op voorkeur of browser), query en hash
 *  blijven (?k= van een spelerslink). Zonder JavaScript: meta refresh zonder query. */
export function redirectPage(addr, lang = DEFAULT) {
  const to = pathFor(lang, addr);
  const back = `location.replace('${to}' + location.search + location.hash)`;
  return `<!doctype html>
<!-- Gegenereerd door tools/pages.mjs: doorverwijzer ${addr} → ${to} -->
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Kev’s Inn itiative</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#241811" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1d130d" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<style>html{background:#faf6ec;color:#241811;font:16px/1.4 system-ui,sans-serif}@media (prefers-color-scheme:dark){html{background:#1d130d;color:#f3ead8}}body{margin:0;padding:16px}a{color:inherit;opacity:0;animation:show 0s 2s forwards}@keyframes show{to{opacity:1}}</style>
<script>${back}</script>
<noscript><meta http-equiv="refresh" content="0; url=${to}"></noscript>
</head>
<body><a href="${to}">Kev’s Inn itiative</a></body>
</html>
`;
}

const homeUrl = (lang) => SITE + pathFor(lang, "/"); // WP44: "https://kevs-inn.com/" en "https://kevs-inn.com/nl/"

/** Taalkiezer van de homepage (WP37): een link per live taal naar haar homepage, label = eigen taalnaam (common.lang.*),
 *  de huidige taal met aria-current. Zichtbaar de code in kleine letters (CSS maakt hoofdletters: "EN" is voor de
 *  Nederlands-heuristiek het woord "en"); de naam "English (EN)" bevat de zichtbare code (WCAG 2.5.3 label-in-name). Zonder JavaScript: het voorvoegsel in de URL bepaalt de taal. */
export function langNav(lang, cat, live = LIVE) {
  const name = (l) => { const v = cat[`common.lang.${l}`]; if (typeof v !== "string") throw new Error(`${HOME_PAGE}: geen tekst voor common.lang.${l}`); return escHtml(v); };
  const langs = live.includes(lang) ? live : [...live, lang]; // een niet-live taal (vóór haar livegang) staat er zelf ook in
  return langs.map((l) => `<a href="${pathFor(l, "/")}" hreflang="${l}" lang="${l}" aria-label="${name(l)} (${l.toUpperCase()})"${l === lang ? ' aria-current="page"' : ""}>${l}</a>`).join("");
}

/** Kopregels voor SEO van een homepage. Indexeerbaar = taal in live: canonical naar zichzelf, hreflang voor elke live
 *  taal plus x-default (de terugvaltaal binnen live: en sinds WP33, V4). Niet live (een nieuwe taal vóór haar livegang): noindex, geen
 *  hreflang, zodat zoekmachines nog geen half vrijgegeven taal tonen. */
export function seoHead(lang, cat, live = LIVE) {
  const attr = (k) => { const v = cat[k]; if (typeof v !== "string") throw new Error(`${HOME_PAGE}: geen tekst voor ${k}`); return escHtml(v); };
  if (!OG_LOCALE[lang]) throw new Error(`${HOME_PAGE}: geen og:locale voor ${lang} (OG_LOCALE)`);
  const others = live.filter((l) => l !== lang);
  const lines = live.includes(lang)
    ? [`<link rel="canonical" href="${homeUrl(lang)}">`, ...live.map((l) => `<link rel="alternate" hreflang="${l}" href="${homeUrl(l)}">`), `<link rel="alternate" hreflang="x-default" href="${homeUrl(fallbackIn(live))}">`]
    : [`<meta name="robots" content="noindex">`]; // geen canonical naast noindex (tegenstrijdig signaal)
  return [
    ...lines,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Kev’s Inn">`,
    `<meta property="og:url" content="${homeUrl(lang)}">`,
    `<meta property="og:title" content="${attr("page.home.title")}">`,
    `<meta property="og:description" content="${attr("page.home.desc")}">`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}">`,
    ...(live.includes(lang) ? others : []).map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`),
    `<meta property="og:image" content="${SITE}${OG_IMAGE.src}">`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}">`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}">`,
    `<meta property="og:image:alt" content="${attr("page.home.ogAlt")}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join("\n");
}

/** robots.txt. Verborgen (HIDDEN): niets crawlen. Anders: alles mag gecrawld worden; de app-pagina's houden zichzelf
 *  buiten de index met noindex, dat moet de crawler kunnen lezen (dus geen Disallow op /{taal}/initiative/) */
export const robots = (hidden = HIDDEN) => (hidden ? "User-agent: *\nDisallow: /\n" : `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

/** sitemap.xml: alleen indexeerbare homepages, elk met alle live alternates en x-default. Geen lastmod (geen ruis per build). */
export function sitemap(live = LIVE) {
  const alt = [...live.map((l) => [l, homeUrl(l)]), ["x-default", homeUrl(fallbackIn(live))]]
    .map(([h, u]) => `    <xhtml:link rel="alternate" hreflang="${h}" href="${u}"/>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${live.map((l) => `  <url>\n    <loc>${homeUrl(l)}</loc>\n${alt}\n  </url>`).join("\n")}
</urlset>
`;
}

/** Niet-gevonden-pagina. Draait eerst redirect.js (ongeldig of verkeerd geschreven prefix → juiste taal), toont anders
 *  een korte melding met links naar homepage en app. Altijd noindex. */
export function notFoundPage(lang, cat) {
  return appPage(`<!doctype html>
<html lang="{{lang}}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{{t:page.nf.title}} · Kev’s Inn</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#241811" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1d130d" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<style>html{background:#faf6ec;color:#241811;font:16px/1.5 system-ui,sans-serif}@media (prefers-color-scheme:dark){html{background:#1d130d;color:#f3ead8}a{color:#e3a83b}}body{margin:0 auto;max-width:36rem;padding:24px 16px}a{color:#7a5512;display:inline-block;padding:10px 0;margin-right:16px}h1{font:600 1.5rem/1.25 Georgia,serif;margin:0 0 8px}</style>
<script type="module">import { go } from "/js/i18n/redirect.js"; go();</script>
</head>
<body>
<h1>{{t:page.nf.title}}</h1>
<p>{{t:page.nf.text}}</p>
<p><a href="{{base}}/">{{t:page.nf.home}}</a><a href="{{base}}/initiative/">{{t:page.home.open}}</a></p>
</body>
</html>
`, `${dirOf(lang)}404.html`, lang, cat);
}

/** Alle bestanden: { relatief pad: inhoud } */
export async function build(root = ROOT) {
  const out = {};
  for (const lang of SUPPORTED) {
    const cat = (await import(pathToFileURL(`${root}locales/${lang}.js`).href)).default;
    for (const [rest, src] of Object.entries(APP_PAGES)) out[`${dirOf(lang, rest)}index.html`] = appPage(readFileSync(root + src, "utf8"), src, lang, cat);
    out[`${dirOf(lang)}index.html`] = appPage(readFileSync(root + HOME_PAGE, "utf8").replace("{{seo}}", () => seoHead(lang, cat)).replace("{{langnav}}", () => langNav(lang, cat)), HOME_PAGE, lang, cat);
    out[`${dirOf(lang)}404.html`] = notFoundPage(lang, cat); // Engels = de taalloze /404.html, ook voor een ongeldig prefix
    out[`${dirOf(lang)}manifest.webmanifest`] = manifest(lang, cat);
  }
  for (const [file, addr] of Object.entries(REDIRECTS)) out[file] = redirectPage(addr);
  out["robots.txt"] = robots();
  out["sitemap.xml"] = sitemap();
  return out;
}

/** Adres waaronder een gegenereerd bestand bereikbaar is ("nl/initiative/index.html" → "/nl/initiative/", "index.html" → "/") */
export const urlOf = (file) => REDIRECTS[file] || "/" + file.replace(/index\.html$/, "");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await build();
  for (const [p, s] of Object.entries(files)) { mkdirSync(dirname(ROOT + p), { recursive: true }); writeFileSync(ROOT + p, s); }
  console.log(Object.keys(files).join("\n"));
}

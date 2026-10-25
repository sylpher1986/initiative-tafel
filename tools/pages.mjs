// Pagina's per taal maken (meertaligheid, WP21/TA5; docs/i18n.md §2.1). Geen build-stap bij publiceren: de uitvoer
// wordt gecommit, net als tools/icons.mjs, en tests/pages.test.js bewaakt dat hij actueel is.
//   node tools/pages.mjs      na elke wijziging in pages/*.html, in deze tool of in de catalogi (page.*)
//
// Uitvoer:
//   /{taal}/initiative/index.html, /{taal}/initiative/player/index.html   app-pagina's uit pages/*.html, per taal in
//                                                  SUPPORTED ({{lang}} ingevuld); /en/ bestaat al maar is pas live in WP33
//   /{taal}/manifest.webmanifest                   manifest per taal; id "/" houdt bestaande installaties één app
//   /manifest.webmanifest                          zelfde als de terugvaltaal: oude installaties vragen dit adres op
//   /index.html, /speler.html, /player.html, /initiative/index.html, /initiative/player/index.html
//                                                  doorverwijzers (js/i18n/redirect.js), ook offline
// Cloudflare serveert /nl/initiative/ uit nl/initiative/index.html en /speler uit speler.html (html_handling).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SUPPORTED, LIVE, fallbackIn, pathFor } from "../js/i18n/lang.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** App-pagina's: pad na het taalprefix → sjabloon */
export const APP_PAGES = { "initiative/": "pages/initiative.html", "initiative/player/": "pages/player.html" };
/** Taalloze adressen (bestand → adres dat Cloudflare ervoor serveert); doel volgt uit pageFor in lang.js */
export const REDIRECTS = { "index.html": "/", "speler.html": "/speler", "player.html": "/player", "initiative/index.html": "/initiative/", "initiative/player/index.html": "/initiative/player/" };

const ICONS = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/** Manifest voor één taal. start_url is de doorverwijzer, zodat de beginscherm-app de taalvoorkeur volgt (§2.2). */
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
    background_color: "#151413",
    theme_color: "#3b2f26",
    icons: ICONS,
  }, null, 2) + "\n";
}

const banner = (src) => `<!-- Gegenereerd door tools/pages.mjs uit ${src}: wijzig het sjabloon en draai node tools/pages.mjs -->\n`;

/** App-pagina in een taal: banner na de doctype, {{lang}} ingevuld */
export function appPage(tpl, src, lang) {
  const out = tpl.replaceAll("{{lang}}", lang);
  return out.replace(/^(<!doctype html>\n)/i, `$1${banner(src)}`);
}

/** Doorverwijzer naar de pagina in de juiste taal. Zonder modules of JavaScript: naar de terugvaltaal. */
export function redirectPage(addr, fb) {
  const to = pathFor(fb, addr);
  // terugval zonder modules, of als redirect.js niet laadt (netwerk, oude cache): terugvaltaal, query en hash blijven
  const back = `location.replace('${to}' + location.search + location.hash)`;
  return `<!doctype html>
<!-- Gegenereerd door tools/pages.mjs: doorverwijzer ${addr} → /{taal}${to.slice(fb.length + 1)} (js/i18n/redirect.js) -->
<html lang="${fb}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Kev’s Inn itiative</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#3b2f26" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#151413" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<style>html{background:#f7f6f2;color:#1f1f1f;font:16px/1.4 system-ui,sans-serif}@media (prefers-color-scheme:dark){html{background:#151413;color:#ececec}}body{margin:0;padding:16px}a{color:inherit;opacity:0;animation:show 0s 2s forwards}@keyframes show{to{opacity:1}}</style>
<script type="module" onerror="${back}">import { go } from "/js/i18n/redirect.js"; go();</script>
<script nomodule>${back}</script>
<noscript><meta http-equiv="refresh" content="0; url=${to}"></noscript>
</head>
<body><a href="${to}">Kev’s Inn itiative</a></body>
</html>
`;
}

/** Alle bestanden: { relatief pad: inhoud } */
export async function build(root = ROOT) {
  const out = {};
  const fb = fallbackIn(LIVE);
  for (const lang of SUPPORTED) {
    const cat = (await import(pathToFileURL(`${root}locales/${lang}.js`).href)).default;
    for (const [rest, src] of Object.entries(APP_PAGES)) out[`${lang}/${rest}index.html`] = appPage(readFileSync(root + src, "utf8"), src, lang);
    out[`${lang}/manifest.webmanifest`] = manifest(lang, cat);
    if (lang === fb) out["manifest.webmanifest"] = manifest(lang, cat);
  }
  for (const [file, addr] of Object.entries(REDIRECTS)) out[file] = redirectPage(addr, fb);
  return out;
}

/** Adres waaronder een gegenereerd bestand bereikbaar is ("nl/initiative/index.html" → "/nl/initiative/") */
export const urlOf = (file) => REDIRECTS[file] || "/" + file.replace(/index\.html$/, "");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await build();
  for (const [p, s] of Object.entries(files)) { mkdirSync(dirname(ROOT + p), { recursive: true }); writeFileSync(ROOT + p, s); }
  console.log(Object.keys(files).join("\n"));
}

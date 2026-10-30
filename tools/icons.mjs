// WP16 (HS5): app-iconen uit het vereenvoudigde embleem (zeshoek + lantaarn, zonder d20; bron brand/kevs-inn-emblem.svg).
// Lantern #e3a83b op Walnut #241811 (WP34, huisstijl 2.0), vierkant zonder eigen afronding (iOS/launchers ronden zelf af).
// "any"/apple-touch: embleem 62 % van de hoogte; maskable: 56 %, zodat de zeshoek binnen de veilige cirkel (80 %) valt.
// Favicon (icons/icon.svg) is een eigen, gevulde variant (leesbaar op 16 px) en wordt niet door dit script gemaakt.
//
//   node tools/icons.mjs        schrijft icons/icon-180.png, -192, -512, -maskable-512.png, og.png en de Inn Sight-iconen
//   node tools/icons.mjs og     alleen og.png (zo ook: maps om alleen de Inn Sight-iconen te maken)
// Inn Sight (WP68d): eigen app-icoon = het silhouet van brand/tool-icons/maps.svg (gevouwen kaart), gevuld in Lantern op
// Walnut, zelfde familie als Initiative maar een ander silhouet; embleem onaangetast. Staat in maps/icons/ (Maps-cache,
// geen gedeeld bestand): icon-180/-192/-512 ("any", kaart 60 % van de breedte, oogt even groot als het embleem van Initiative) en -maskable-512 (50 %: alle hoeken met rand binnen
// de veilige cirkel van 80 %). Favicon maps/icons/icon.svg is met de hand gemaakt (zelfde tekening op 64 px).
// og.png (WP30): deelafbeelding 1200×630 voor Open Graph (homepage, tools/pages.mjs OG_IMAGE). Walnoot, embleem links,
// rechts "Kev’s Inn" (Newsreader) en een taalneutrale regel; alles binnen 60 px marge en midden-vierkant (WhatsApp knipt).
//
// Playwright zoals in tools/browsercheck.mjs (PW_MODULE of /opt/npm-tools).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Zelfde tekening als het embleem in de h1 van index.html en speler.html (viewBox 20 2 176 196) */
export const EMBLEM = `<path d="M108 16 181 58v84l-73 42-73-42V58Z" stroke-width="11"/><g transform="translate(0 13)" stroke-width="10"><path d="M100 47v-8q8-10 16 0v8"/><path d="M88 55h40l-8 11H96Z"/><path d="M96 70h24l8 10v42H88V80Z"/><path d="M84 130h48"/></g><path d="M108 102c-9 10-9 19 0 26 9-7 9-16 0-26Z" fill="currentColor" stroke="none"/>`;
const VB = { x: 20, y: 2, w: 176, h: 196 }; // tekening loopt van y ±10 tot ±190: midden 100

export function iconSvg(share) {
  const s = (512 * share) / VB.h, cx = VB.x + VB.w / 2, cy = VB.y + VB.h / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#241811"/>` +
    `<g color="#e3a83b" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(256 256) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})">${EMBLEM}</g></svg>`;
}

/** Inn Sight: de gevouwen kaart uit brand/tool-icons/maps.svg (viewBox 64; kaart loopt van x 8–56, y 10–54) */
export const MAPS_SHAPE = { outline: "m8 16 16-6 16 6 16-6v38l-16 6-16-6-16 6z", folds: "M24 10v38M40 16v38", ridge: "m13 31 6-5 6 4 7-7 5 4 6-2 6 5" };
export function mapsIconSvg(share) {
  const s = (512 * share) / 48, m = MAPS_SHAPE; // breedte van de kaart (48 eenheden) = share van het icoon
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#241811"/>` +
    `<g transform="translate(256 256) scale(${s.toFixed(4)}) translate(-32 -32)" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${m.outline}" fill="#e3a83b" stroke="#e3a83b" stroke-width="3"/><path d="${m.folds}" fill="none" stroke="#241811" stroke-width="2.6"/>` +
    `<path d="${m.ridge}" fill="none" stroke="#241811" stroke-width="3"/></g></svg>`;
}
export const MAPS_ICONS = [["icon-180", 180, 0.6], ["icon-192", 192, 0.6], ["icon-512", 512, 0.6], ["icon-maskable-512", 512, 0.5]];

async function loadPw() {
  for (const p of [process.env.PW_MODULE, "playwright", "/opt/npm-tools/node_modules/playwright", "/opt/node-tools/node_modules/playwright"].filter(Boolean)) {
    try { return p.startsWith("/") ? createRequire(import.meta.url)(p) : await import(p); } catch { /* volgende */ }
  }
  throw new Error("Playwright niet gevonden. Zet PW_MODULE op het pad van de playwright-module.");
}

/** Deelafbeelding voor Open Graph: één voor alle talen, dus alleen merk, "Initiative tracker · D&D 5e" en het domein */
export function ogHtml(root = ROOT) {
  // als data-URL: een pagina uit setContent (about:blank) mag geen file://-fonts laden
  const font = (fam, file, w) => `@font-face{font-family:"${fam}";font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(root + "fonts/" + file).toString("base64")}) format("woff2")}`;
  return `<style>${font("Newsreader", "newsreader-latin-wght.woff2", "200 800")}${font("DM Sans", "dm-sans-latin-wght.woff2", "100 1000")}
html,body{margin:0}body{width:1200px;height:630px;background:#241811;display:flex;align-items:center;justify-content:center;gap:64px;font-family:"DM Sans",sans-serif}
svg{width:280px;height:312px;flex:none;color:#e3a83b}h1{margin:0;font:600 108px/1.05 Newsreader,Georgia,serif;color:#faf6ec}
p{margin:18px 0 0;font-weight:700;font-size:46px;color:#e3a83b}small{display:block;margin-top:22px;font-size:34px;color:#e9ddc4}</style>
<svg viewBox="20 2 176 196" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${EMBLEM}</svg>
<div><h1>Kev’s Inn</h1><p>Initiative tracker · D&amp;D 5e</p><small>kevs-inn.com</small></div>`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/opt/pw-browsers";
  const pw = await loadPw(), b = await pw.chromium.launch();
  const only = process.argv.slice(2); // bijv. "og": alleen dat bestand (pixels van de andere iconen verschillen per Chromium-versie)
  for (const [name, px, share] of [["icon-180", 180, 0.62], ["icon-192", 192, 0.62], ["icon-512", 512, 0.62], ["icon-maskable-512", 512, 0.56]].filter(([n]) => !only.length || only.includes(n))) {
    const p = await b.newPage({ viewport: { width: px, height: px } });
    await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${px}px;height:${px}px}</style>${iconSvg(share)}`);
    await p.screenshot({ path: ROOT + `icons/${name}.png` });
    await p.close();
  }
  if (!only.length || only.includes("maps")) {
    for (const [name, px, share] of MAPS_ICONS) {
      const p = await b.newPage({ viewport: { width: px, height: px } });
      await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${px}px;height:${px}px}</style>${mapsIconSvg(share)}`);
      await p.screenshot({ path: ROOT + `maps/icons/${name}.png` });
      await p.close();
    }
  }
  if (!only.length || only.includes("og")) {
    const og = await b.newPage({ viewport: { width: 1200, height: 630 } });
    await og.setContent(ogHtml());
    await og.evaluate(() => document.fonts.ready);
    await og.screenshot({ path: ROOT + "icons/og.png" });
  }
  await b.close();
  console.log("icons/*.png geschreven");
}

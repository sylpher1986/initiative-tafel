// WP16 (HS5): app-iconen uit het vereenvoudigde embleem (zeshoek + lantaarn, zonder d20; bron brand/kevs-inn-emblem.svg).
// Goud #d4a44b op walnoot #3b2f26, vierkant zonder eigen afronding (iOS/launchers ronden zelf af).
// "any"/apple-touch: embleem 62 % van de hoogte; maskable: 56 %, zodat de zeshoek binnen de veilige cirkel (80 %) valt.
// Favicon (icons/icon.svg) is een eigen, gevulde variant (leesbaar op 16 px) en wordt niet door dit script gemaakt.
//
//   node tools/icons.mjs        schrijft icons/icon-180.png, -192, -512 en -maskable-512.png
//
// Playwright zoals in tools/browsercheck.mjs (PW_MODULE of /opt/npm-tools).
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Zelfde tekening als het embleem in de h1 van index.html en speler.html (viewBox 20 2 176 196) */
export const EMBLEM = `<path d="M108 16 181 58v84l-73 42-73-42V58Z" stroke-width="11"/><g transform="translate(0 13)" stroke-width="10"><path d="M100 47v-8q8-10 16 0v8"/><path d="M88 55h40l-8 11H96Z"/><path d="M96 70h24l8 10v42H88V80Z"/><path d="M84 130h48"/></g><path d="M108 102c-9 10-9 19 0 26 9-7 9-16 0-26Z" fill="currentColor" stroke="none"/>`;
const VB = { x: 20, y: 2, w: 176, h: 196 }; // tekening loopt van y ±10 tot ±190: midden 100

export function iconSvg(share) {
  const s = (512 * share) / VB.h, cx = VB.x + VB.w / 2, cy = VB.y + VB.h / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#3b2f26"/>` +
    `<g color="#d4a44b" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(256 256) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})">${EMBLEM}</g></svg>`;
}

async function loadPw() {
  for (const p of [process.env.PW_MODULE, "playwright", "/opt/npm-tools/node_modules/playwright", "/opt/node-tools/node_modules/playwright"].filter(Boolean)) {
    try { return p.startsWith("/") ? createRequire(import.meta.url)(p) : await import(p); } catch { /* volgende */ }
  }
  throw new Error("Playwright niet gevonden. Zet PW_MODULE op het pad van de playwright-module.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/opt/pw-browsers";
  const pw = await loadPw(), b = await pw.chromium.launch();
  for (const [name, px, share] of [["icon-180", 180, 0.62], ["icon-192", 192, 0.62], ["icon-512", 512, 0.62], ["icon-maskable-512", 512, 0.56]]) {
    const p = await b.newPage({ viewport: { width: px, height: px } });
    await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${px}px;height:${px}px}</style>${iconSvg(share)}`);
    await p.screenshot({ path: ROOT + `icons/${name}.png` });
    await p.close();
  }
  await b.close();
  console.log("icons/*.png geschreven");
}

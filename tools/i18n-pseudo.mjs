// Testtaal "xx" (meertaligheid, WP20/TA4): de Engelse catalogus met accenten, tussen [ ] en ± 35 % langer.
// Zo valt op wat niet uit de catalogus komt (blijft gewoon Nederlands of Engels) en welke tekst op 320 px te lang
// wordt. Geen echte taal: niet in SUPPORTED, alleen via ?i18n=xx (js/i18n/boot.js). Placeholders {naam} blijven heel.
// Opnieuw maken na elke wijziging in locales/en/: node tools/i18n-pseudo.mjs (tests/i18n.test.js bewaakt het).
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const MAP = { a: "á", e: "é", i: "í", o: "ö", u: "ü", y: "ý", c: "ç", n: "ñ", A: "Å", E: "É", I: "Í", O: "Ö", U: "Ü", C: "Ç", N: "Ñ" };
const GROW = 0.35;

/** Eén tekst: letters met accent, placeholders ongemoeid, opvulling tot ± 35 % langer, tussen [ ] */
export function pseudoText(s) {
  const parts = String(s).split(/(\{[A-Za-z_][\w.]*\})/);
  const out = parts.map((p, i) => (i % 2 ? p : p.replace(/[A-Za-z]/g, (ch) => MAP[ch] || ch))).join("");
  const pad = Math.ceil(String(s).replace(/\{[A-Za-z_][\w.]*\}/g, "").length * GROW);
  return `[${out}${pad ? " " + "·".repeat(pad) : ""}]`;
}

/** Hele catalogus: teksten en meervoudsobjecten { one, other } */
export function pseudo(cat) {
  const out = {};
  for (const [k, v] of Object.entries(cat)) {
    out[k] = v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([f, s]) => [f, pseudoText(s)])) : pseudoText(v);
  }
  return out;
}

/** Bestandsinhoud van locales/xx/index.js */
export function pseudoFile(cat) {
  return `// Gegenereerd door tools/i18n-pseudo.mjs uit locales/en: niet met de hand aanpassen.
// Testtaal: alleen via ?i18n=xx (js/i18n/boot.js). Ontbreekt een sleutel hier, dan geldt de Engelse terugval.
export default ${JSON.stringify(pseudo(cat), null, 2)};
`;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const { default: en } = await import("../locales/en/index.js");
  writeFileSync(fileURLToPath(new URL("../locales/xx/index.js", import.meta.url)), pseudoFile(en));
  console.log(Object.keys(en).length, "sleutels → locales/xx/index.js");
}

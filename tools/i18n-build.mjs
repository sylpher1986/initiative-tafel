// Catalogi bouwen (meertaligheid, WP20/TA4). Bron: locales/src/<taal>/<namespace>.js (met de hand, per tool/laag).
// Uitvoer: één plat bestand per taal, locales/<taal>.js, dat js/i18n/boot.js laadt. Eén bestand per taal omdat losse
// modules op een trage verbinding een rondgang per bestand kosten (dev-review WP20: +0,5 s op 3G bij 8 bestanden).
// Daarnaast de testtaal locales/xx.js: Engels met accenten, tussen [ ] en ± 35 % langer (alleen via ?i18n=xx).
// Opnieuw maken na elke wijziging in locales/src/: node tools/i18n-build.mjs (tests/i18n.test.js bewaakt het).
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SRC_LANGS = ["en", "nl"];
// namespace-bestand → sleutelvoorvoegsel (docs/i18n.md §3.2); volgorde = volgorde in de uitvoer
export const NS = { common: "common.", initiative: "init.", rules: "rules.", log: "log.", player: "player.", dnd: "dnd.", pages: "page." };
const ROOT = fileURLToPath(new URL("../", import.meta.url));

const MAP = { a: "á", e: "é", i: "í", o: "ö", u: "ü", y: "ý", c: "ç", n: "ñ", A: "Å", E: "É", I: "Í", O: "Ö", U: "Ü", C: "Ç", N: "Ñ" };
const GROW = 0.35;
const HOLE = /(\{[A-Za-z_][\w.]*\})/;

/** Eén tekst: letters met accent, placeholders ongemoeid, opvulling tot ± 35 % langer, tussen [ ] */
export function pseudoText(s) {
  const parts = String(s).split(HOLE);
  const out = parts.map((p, i) => (i % 2 ? p : p.replace(/[A-Za-z]/g, (ch) => MAP[ch] || ch))).join("");
  const pad = Math.ceil(parts.filter((p, i) => !(i % 2)).join("").length * GROW);
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

/** Bronbestanden van een taal inlezen: { ns: catalogus } */
export async function loadSrc(lang, root = ROOT) {
  const out = {};
  for (const ns of Object.keys(NS)) out[ns] = (await import(pathToFileURL(`${root}locales/src/${lang}/${ns}.js`).href)).default;
  return out;
}

/** Namespaces samenvoegen tot één platte catalogus (volgorde van NS) */
export const merge = (src) => Object.assign({}, ...Object.keys(NS).map((ns) => src[ns] || {}));

/** Bestandsinhoud van locales/<taal>.js */
export function catFile(lang, cat, note = "") {
  return `// Gegenereerd door tools/i18n-build.mjs uit ${note || `locales/src/${lang}/`}: niet met de hand aanpassen.
// Taal ${lang}; geladen door js/i18n/boot.js. Sleutels en teksten: zie de bronbestanden.
export default ${JSON.stringify(cat, null, 2)};
`;
}

/** Alle uitvoer: { "locales/en.js": inhoud, … } */
export async function build(root = ROOT) {
  const files = {};
  let en = null;
  for (const l of SRC_LANGS) {
    const cat = merge(await loadSrc(l, root));
    if (l === "en") en = cat;
    files[`locales/${l}.js`] = catFile(l, cat);
  }
  files["locales/xx.js"] = catFile("xx", pseudo(en), "locales/src/en/ (testtaal, alleen via ?i18n=xx)");
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const extra = readdirSync(`${ROOT}locales/src`).filter((l) => !SRC_LANGS.includes(l));
  if (extra.length) console.warn("Let op: niet in SRC_LANGS:", extra.join(", "));
  const files = await build();
  for (const [p, s] of Object.entries(files)) writeFileSync(ROOT + p, s);
  console.log(Object.keys(files).join(", "));
}

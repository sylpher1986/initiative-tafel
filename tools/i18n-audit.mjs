// Meertaligheid (WP18, TA2): telt per bestand de Nederlandse tekst die nog niet uit een vertaalcatalogus komt.
// Het nulpunt staat in tests/i18n-baseline.json; tests/i18n-ratchet.test.js bewaakt dat een getal alleen omlaag gaat.
// Conventies: docs/i18n.md §9.
//
// Gebruik (in de repo):
//   node tools/i18n-audit.mjs            overzicht per bestand en per werkpakket
//   node tools/i18n-audit.mjs --list F   alle gevonden teksten in bestand F (met regelnummer)
//   node tools/i18n-audit.mjs --write    nulpunt opnieuw vastleggen (alleen bewust: na migratie of na nieuwe tekst)
//
// Heuristiek, geen parser: JS-strings en template-literals buiten commentaar, en in HTML tekstknopen plus
// aria-label/placeholder/title/alt/content. Een tekst telt als Nederlands als er een Nederlands woord uit NL_WORDS
// in staat. D&D-termen en code-achtige strings (selectors, sleutels) bevatten die woorden niet en tellen dus niet.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const BASELINE = "tests/i18n-baseline.json";

// Woorden die in het Engels (bijna) niet voorkomen. Bewust zonder "in", "is", "of", "door", "die", "a", "and":
// die zijn ook Engels of komen in D&D-tekst voor. Uitbreiden mag; het nulpunt dan opnieuw vastleggen.
export const NL_WORDS = new Set(`de het een van niet geen wordt worden naar voor met bij nog ook alleen als deze dit
zijn wat wie je jij jouw uit aan op tot na er maar kan kun mag moet zonder eerst daarna opnieuw weg gelukt mislukt
beurt beurten ronde rondes speler spelers gevecht voorbereiden voorbereiding toevoegen toegevoegd verwijder verwijderen
verwijderd sluit annuleer ongedaan opslaan opgeslagen kopieer kopiëren bewerken inladen delen gedeeld instellingen
verborgen onbekend wezen dood neer bewusteloos stabiel gewond schade rol rollen worp doel doelen keuze melding kies kiezen
tik tikken verbinding kamer volgende vorige gebruikt terug klaar starten gestart begint loopt gestopt zelf
eigen lijst paneel kaart zoeken gevonden fout lukt lukte niets iets alles allemaal hier daar wel meer minder
nieuwe nieuw oude oud lege leeg welke waar wanneer omdat zodat dan dat hem hun zij wij jullie mijn ons onze
geslaagd gefaald vervalt vervallen herhaal herhaalsave beschikbaar levend levende gewist wissen vaste vast
afronden toch houden gerold ingevuld invullen aantal uur dagen geleden tabblad scherm schermen
geluid trillen aan uitleg tekst regel regels spelersscherm logboek reden oorzaak bijwerken ververst bron
conditie condities huidige dag zie andere ander herstelt gebruiken gebruik toepassen niemand raken raak klaarzetten
geven twee drie vier staat staan heeft hebben ziet zien krijgt krijgen blijft blijven gaat gaan komt komen maak maken
geef dicht snel groot klein ingeklapt tonen toon verbergen naam namen getal veld knop knoppen spel
en hoort erbij derde gestorven kritiek voorbij bijgewerkt geladen ophalen vul hersteld gemaakt gekopieerd
`.split(/\s+/).filter(Boolean));

/** Stukken tekst uit JS-code: strings en template-literals (de ${…}-delen als "{}"), commentaar overgeslagen.
 *  Regex-literals worden herkend aan het teken ervoor (zoals in de meeste lexers). Geeft [{ text, line }]. */
export function jsStrings(src) {
  const out = [];
  let i = 0, line = 1, prev = "", gap = false;
  const n = src.length;
  const isRegexStart = () => /^$|[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /\b(return|typeof|case|of|in|else|void|yield|await)$/.test(prev);
  // code tot de bijpassende } (voor ${…} in een template); geeft de positie na de }
  const code = (stopAtBrace) => {
    let depth = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === "\n") { line++; i++; gap = true; continue; }
      if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
      if (c === "/" && d === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; } i += 2; continue; }
      if (c === '"' || c === "'") { str(c); prev = "x"; continue; }
      if (c === "`") { tpl(); prev = "x"; continue; }
      if (c === "/" && isRegexStart()) { regex(); prev = "x"; continue; }
      if (c === "{") depth++;
      if (c === "}") { if (stopAtBrace && depth === 0) { i++; return; } depth--; }
      if (/\s/.test(c)) gap = true;
      else { prev = /[\w$]/.test(c) ? ((gap ? "" : prev.match(/[\w$]*$/)[0]) + c).slice(-8) : c; gap = false; }
      i++;
    }
  };
  // escape vanaf src[i] (de backslash): \n \t \r = spatie, \uXXXX, \u{…} en \xXX gedecodeerd, verder het teken zelf
  const esc = () => {
    const c = src[i + 1], m = /^u\{([0-9a-fA-F]+)\}|^u([0-9a-fA-F]{4})|^x([0-9a-fA-F]{2})/.exec(src.slice(i + 1, i + 12));
    if (m) { i += 1 + m[0].length; return String.fromCodePoint(parseInt(m[1] || m[2] || m[3], 16)); }
    i += 2;
    return /[ntr\n]/.test(c) ? " " : c;
  };
  const str = (q) => {
    const start = line; let s = ""; i++;
    while (i < n && src[i] !== q) {
      if (src[i] === "\\") { if (src[i + 1] === "\n") line++; s += esc(); continue; }
      if (src[i] === "\n") break; // onaf: stoppen
      s += src[i++];
    }
    i++;
    out.push({ text: s, line: start });
  };
  const tpl = () => {
    const start = line; let s = ""; i++;
    while (i < n && src[i] !== "`") {
      if (src[i] === "\\") { if (src[i + 1] === "\n") line++; s += esc(); continue; }
      if (src[i] === "$" && src[i + 1] === "{") { i += 2; s += "{}"; code(true); continue; }
      if (src[i] === "\n") line++;
      s += src[i++];
    }
    i++;
    out.push({ text: s, line: start });
  };
  const regex = () => {
    i++;
    let cls = false;
    while (i < n && src[i] !== "\n") {
      const c = src[i];
      if (c === "\\") { i += 2; continue; }
      if (c === "[") cls = true; else if (c === "]") cls = false; else if (c === "/" && !cls) { i++; break; }
      i++;
    }
    while (i < n && /[a-z]/.test(src[i])) i++;
  };
  code(false);
  return out;
}

const ATTRS = /\s(aria-label|placeholder|title|alt|content|data-label|on[a-z]+)\s*=\s*(["'])(.*?)\2/g;
const ent = (s) => s.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ");

/** Tekst uit HTML: tekstknopen en zichtbare attributen; <script> gaat door jsStrings, <style> en commentaar niet. */
export function htmlStrings(src) {
  const out = [];
  const lineAt = (pos) => src.slice(0, pos).split("\n").length;
  const scripts = [];
  const body = src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/<style[\s\S]*?<\/style>/gi, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, js, b, pos) => {
      const base = lineAt(pos + a.length) - 1;
      jsStrings(js).forEach((x) => scripts.push({ text: x.text, line: x.line + base }));
      return a + js.replace(/[^\n]/g, " ") + b;
    });
  for (const m of body.matchAll(/<[^>]+>/g)) for (const a of m[0].matchAll(ATTRS)) {
    const v = ent(a[3]), ln = lineAt(m.index);
    if (a[1].startsWith("on")) jsStrings(v).forEach((x) => out.push({ text: x.text, line: ln })); // onerror="…('tekst')"
    else out.push({ text: v, line: ln });
  }
  for (const m of body.matchAll(/>([^<]+)</g)) {
    const t = ent(m[1]).replace(/\s+/g, " ").trim();
    if (t) out.push({ text: t, line: lineAt(m.index) });
  }
  return [...out, ...scripts].sort((a, b) => a.line - b.line);
}

/** Bevat de tekst een Nederlands woord? (alleen letters, kleine letters, ook met ë/é). Een string die alleen een
 *  taalcode is ("en", "de", "nl-BE", ook "EN" en "(EN)" zoals de taalkiezer van de homepage hem toont, WP37) telt niet: die zijn er straks volop in js/i18n/, en een losse meervoudsuitgang
 *  ("scherm" + "en") verdwijnt bij de migratie toch ({ one, other }). Een pad ("/speler.html") is geen tekst. */
export const isDutch = (s) => !/^\s*([a-z]{2}|[A-Z]{2})(-[A-Z]{2})?\s*$/.test(s) && !/^\/[\w./-]*$/.test(s) && (s.replace(/\([A-Z]{2}\)/g, " ").toLowerCase().match(/[a-zà-ÿ]+/g) || []).some((w) => NL_WORDS.has(w));

/** Code, geen tekst (WP26): import-pad, selector, attribuut of kebab-case zonder spaties ("./kamer.js", "#kamer-box", "kamer-lost", "[data-qr=sluit]") */
export const isCode = (s) => /^\.\.?\/[\w./-]*$/.test(s) || (/^(?:[#.][\w-]|\[[\w-]+[=\]])/.test(s) && /^[\w\-#.[\]="' :>()*,]*$/.test(s) && !/[A-Za-z]{2,} +[A-Za-z]{2,}/.test(s.replace(/\[[^\]]*\]/g, ""))) || (!/\s/.test(s) && (s.includes("=") || /^[a-z0-9]+(-[a-z0-9]+)+$/.test(s)));
/** JS-string met HTML erin (WP26): alleen tekstknopen en zichtbare attributen tellen, zoals in een HTML-bestand;
 *  een klasse of data-attribuut ("data-kamer", class="en") is geen tekst. Tekst vóór de eerste en na de laatste tag telt mee. */
const pieces = (x) => {
  if (!/<[a-z][^>]*>/i.test(x.text)) return [x];
  const nl = htmlStrings(`>${x.text}<`).map((p) => p.text).filter((t) => !isCode(t) && isDutch(t));
  return nl.length ? [{ text: nl.join(" | "), line: x.line }] : []; // één string = één telling, zoals voorheen
};

/** Nederlandse teksten in één bestand: [{ text, line }] */
export function dutchIn(path, src) {
  const all = /\.html?$/.test(path) ? htmlStrings(src) : jsStrings(src).flatMap(pieces);
  return all.filter((x) => !isCode(x.text) && isDutch(x.text));
}

// Welk werkpakket haalt de tekst uit welk bestand (docs/i18n.md §9). Elk bestand met Nederlandse tekst moet hier
// staan (test). render.js en actions.js zijn te groot voor één pakket: verdeeld over WP24–WP26 per scherm.
export const PLAN = {
  "pages/initiative.html": "WP23", "pages/player.html": "WP23", "pages/home.html": "WP30",
  "js/ui/render.js": "WP24–WP26", "js/ui/actions.js": "WP24–WP26", "js/ddb.js": "WP24", "js/exportnudge.js": "WP24",
  "js/ui/statblock.js": "WP25", "js/ui/initroll.js": "WP25", "js/ui/keys.js": "WP25", "js/ui/pcreact.js": "WP25",
  "js/ui/spellinfo.js": "WP25", "js/ui/condinfo.js": "WP25", "js/ui/spellrules.js": "WP25", "js/ui/avatar.js": "WP25",
  "js/ui/icons.js": "WP25",
  "js/ui/encounters.js": "WP26", "js/ui/einde.js": "WP26", "js/ui/kamer.js": "WP26", "js/ui/tour.js": "WP26",
  "js/tour.js": "WP26", "js/ui/settings.js": "WP26", "js/backup.js": "WP26", "js/tablock.js": "WP26",
  "js/ui/util.js": "WP26", "js/ui/playervis.js": "WP26", "js/main.js": "WP26", "js/storage.js": "WP26",
  "js/share.js": "WP26", "js/state.js": "WP27", "js/log.js": "WP27", "js/ddbjson.js": "WP27", "js/histpack.js": "WP27",
  "js/version.js": "WP26",
  "js/playerview.js": "WP28", "js/speler.js": "WP28", "js/tvfit.js": "WP28", "js/qr.js": "WP28",
  "js/data/monsters.js": "WP29", "js/data/spells.js": "WP29", "js/data/statparse.js": "WP29",
  "js/rules/conditions.js": "WP29",
};
/** Pakket voor een bestand: vaste lijst, anders alle regels in js/rules/ naar WP27 */
export const planFor = (f) => PLAN[f] || (/^js\/rules\//.test(f) ? "WP27" : /^js\/i18n\//.test(f) ? "WP19" : null);

/** Bestanden die meetellen: alle JS onder js/ en de sjablonen van de pagina's (pages/). Niet: data, tests, tools, worker
 *  (de Worker geeft alleen codes terug), sw.js (geen tekst voor de gebruiker), en wat tools/pages.mjs maakt
 *  (/{taal}/…, doorverwijzers, manifests: kopie van een sjabloon of tekst uit de catalogus, WP21). */
export function auditFiles(root = ROOT) {
  const walk = (dir) => readdirSync(root + dir).flatMap((nm) => {
    const p = dir + nm;
    return statSync(root + p).isDirectory() ? walk(p + "/") : [p];
  });
  return [...walk("js/").filter((p) => p.endsWith(".js")), "pages/initiative.html", "pages/player.html", "pages/home.html", "pages/maps.html"].sort();
}

/** { bestand: aantal } voor alle bestanden met minstens één Nederlandse tekst */
export function audit(root = ROOT) {
  const res = {};
  for (const f of auditFiles(root)) {
    const src = readFileSync(root + f, "utf8");
    const hits = f.endsWith(".webmanifest")
      ? Object.values(JSON.parse(src)).filter((v) => typeof v === "string" && isDutch(v)).map((text) => ({ text, line: 0 }))
      : dutchIn(f, src);
    if (hits.length) res[f] = hits.length;
  }
  return res;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const args = process.argv.slice(2);
  if (args[0] === "--list") {
    const f = args[1];
    if (!f) { console.error("Gebruik: node tools/i18n-audit.mjs --list <bestand>"); process.exit(1); }
    for (const x of dutchIn(f, readFileSync(ROOT + f, "utf8"))) console.log(String(x.line).padStart(5), x.text.slice(0, 110));
  } else {
    const res = audit();
    if (args[0] === "--write") {
      writeFileSync(ROOT + BASELINE, JSON.stringify(res, null, 2) + "\n");
      console.log("Nulpunt geschreven:", BASELINE);
    }
    const byWp = {};
    for (const [f, n] of Object.entries(res)) { const w = planFor(f) || "GEEN PAKKET"; byWp[w] = (byWp[w] || 0) + n; }
    for (const [f, n] of Object.entries(res)) console.log(String(n).padStart(5), f.padEnd(28), planFor(f) || "GEEN PAKKET");
    console.log("\nPer pakket:");
    for (const [w, n] of Object.entries(byWp).sort()) console.log(String(n).padStart(5), w);
    console.log(String(Object.values(res).reduce((a, b) => a + b, 0)).padStart(5), "totaal");
  }
}

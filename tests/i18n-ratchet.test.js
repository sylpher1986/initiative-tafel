// Meertaligheid (WP18, TA2): ratel op Nederlandse tekst die nog niet uit een vertaalcatalogus komt.
// Het nulpunt staat in tests/i18n-baseline.json (node tools/i18n-audit.mjs --write). Per bestand mag het aantal alleen
// gelijk blijven of dalen; een daling moet worden vastgelegd, zodat de winst niet terugsluipt. Plan: docs/i18n.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { audit, planFor, jsStrings, htmlStrings, isDutch, BASELINE } from "../tools/i18n-audit.mjs";

const base = JSON.parse(readFileSync(new URL("../" + BASELINE, import.meta.url), "utf8"));
const now = audit();
const HOW = "Bewust? Leg vast met: node tools/i18n-audit.mjs --write (let op: een zin in twee stukken of met <b> erin telt dubbel)";

test("geen bestand krijgt meer Nederlandse tekst dan in het nulpunt", () => {
  const more = Object.entries(now).filter(([f, n]) => n > (base[f] || 0)).map(([f, n]) => `${f}: ${base[f] || 0} → ${n}`);
  assert.deepEqual(more, [], `Nieuwe Nederlandse tekst buiten de catalogus (node tools/i18n-audit.mjs --list <bestand>). ${HOW}`);
});

test("minder tekst is vastgelegd in het nulpunt (winst sluipt niet terug)", () => {
  const less = Object.entries(base).filter(([f, n]) => (now[f] || 0) < n).map(([f, n]) => `${f}: ${n} → ${now[f] || 0}`);
  assert.deepEqual(less, [], HOW);
});

test("elk bestand met Nederlandse tekst hoort bij een werkpakket (PLAN in tools/i18n-audit.mjs)", () => {
  assert.deepEqual(Object.keys(now).filter((f) => !planFor(f)), [], "Zet het bestand in PLAN in tools/i18n-audit.mjs (docs/i18n.md §7).");
});

test("scanner: commentaar telt niet, strings en templates wel, regex-literals breken niets", () => {
  const src = [
    "// geen tekst van de app hier",
    "/* ook niet in een blok */",
    "const re = /\"[^']*\"/g, x = a / 2;",
    "toast(`Ronde ${n} begint`);",
    "const s = 'Sluit' + \"Volgende\";",
    "const t = `Beurt van ${f(`x`)} · nog niet geweest`;",
    "if (a) b(); else return /\"/.test(s) ? 'Opslaan lukt niet' : `kopi\\u00ebren\\nmislukt`;",
  ].join("\n");
  const got = jsStrings(src).map((x) => [x.line, x.text]);
  assert.deepEqual(got, [[4, "Ronde {} begint"], [5, "Sluit"], [5, "Volgende"], [6, "x"], [6, "Beurt van {} · nog niet geweest"], [7, "Opslaan lukt niet"], [7, "kopiëren mislukt"]]);
});

test("scanner: HTML-tekst, zichtbare attributen en inline script; geen commentaar of style", () => {
  const src = `<!-- uit de lijst -->
<style>.a::after{content:"niet"}</style>
<button aria-label="Sluit het paneel">×</button>
<p>Wacht op de DM</p>
<script>show("Fout (tik om te sluiten)")</script>
<script src="a.js" onerror="__itErr('js/main.js kon niet laden')"></script>`;
  const got = htmlStrings(src).filter((x) => isDutch(x.text)).map((x) => [x.line, x.text]);
  assert.deepEqual(got, [[3, "Sluit het paneel"], [4, "Wacht op de DM"], [5, "Fout (tik om te sluiten)"], [6, "js/main.js kon niet laden"]]);
});

test("herkenning: Nederlandse zin wel, D&D-termen en Engels niet", () => {
  assert.ok(isDutch("Save vervallen zonder uitslag"));
  assert.ok(isDutch("Hoort erbij"));
  for (const s of ["en", "de", "nl", "nl-BE"]) assert.ok(!isDutch(s), `taalcode ${s}`);
  for (const s of ["/speler", "/speler.html", "/nl/initiative/player/"]) assert.ok(!isDutch(s), `pad ${s}`);
  assert.ok(isDutch("/speler opent het spelersscherm"), "zin die met een pad begint telt wel");
  for (const s of ["Legendary actions", "Death saves", "WIS DC 13", "Short Rest", "Damage Resistances", "Concentrating", "Bear Totem"])
    assert.ok(!isDutch(s), s);
});

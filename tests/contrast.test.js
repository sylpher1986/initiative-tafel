// WP14: kleurtokens en contrast (WCAG 2.2 AA). Leest de tokenblokken bovenaan css/app.css en toetst elk thema apart:
// tekst 4,5:1, componentranden, focus, selectie en betekenisvolle grafiek (HP-balk, zijstreep) 3:1.
// Uitgeschakelde knoppen (opacity) vallen buiten WCAG 1.4.3. Componenten gebruiken geen hex buiten de tokens (QR: altijd zwart op wit).
import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");

function block(re) {
  const m = css.match(re);
  assert.ok(m, `tokenblok niet gevonden: ${re}`);
  const out = {};
  for (const [, k, v] of m[1].matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})\b/gi)) out[k] = v.toLowerCase();
  return out;
}
const light = block(/\/\* Kleurtokens[\s\S]*?\*\/\s*:root\{([\s\S]*?)\n\}/);
const darkSys = block(/@media \(prefers-color-scheme: dark\)\{:root:not\(\[data-theme="light"\]\)\{([\s\S]*?)\}\}/);
const darkFix = block(/:root\[data-theme="dark"\]\{([\s\S]*?)\}/);

const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// [voorgrond, achtergrond, minimum, waar]
const TEXT = 4.5, UI = 3;
const PAIRS = [
  ["fg", "bg", TEXT, "tekst"], ["fg", "surface", TEXT, "tekst op kaart"], ["fg", "sunk", TEXT, "tekst op verzonken vlak"],
  ["muted", "bg", TEXT, "secundaire tekst"], ["muted", "surface", TEXT, "secundaire tekst op kaart"], ["muted", "sunk", TEXT, "secundaire tekst verzonken"],
  ["act-fg", "act", TEXT, "tekst op gouden knop / beurtvlak"], ["act-ink", "bg", TEXT, "goud als tekst/link"], ["act-ink", "surface", TEXT, "goud als tekst op kaart"],
  ["act-ink", "act-soft", TEXT, "goud op geselecteerd vlak"], ["fg", "act-soft", TEXT, "tekst op geselecteerd vlak"], ["muted", "act-soft", TEXT, "label in beurtvlak"],
  ["good", "surface", TEXT, "gelukt"], ["good", "bg", TEXT, "gelukt op pagina"], ["good-fg", "good", TEXT, "tekst op Heal-knop"], ["good", "sunk", TEXT, "gelukt op verzonken vlak"],
  ["warn", "surface", TEXT, "waarschuwing"], ["warn", "bg", TEXT, "waarschuwing op pagina"], ["warn", "warn-soft", TEXT, "waarschuwing op zacht vlak"], ["fg", "warn-soft", TEXT, "tekst op amber vlak"], ["warn", "sunk", TEXT, "waarschuwing op verzonken vlak"], ["bg", "warn", TEXT, "conditieknop hover"],
  ["bad", "surface", TEXT, "fout/destructief"], ["bad", "bg", TEXT, "fout op pagina"], ["bad", "bad-soft", TEXT, "Deadly-chip"], ["bad", "sunk", TEXT, "fout op verzonken vlak (lair)"],
  ["info", "surface", TEXT, "info/delen"], ["info", "bg", TEXT, "info op pagina"], ["bg", "info", TEXT, "temp HP-knop"],
  ["fg", "mon-soft", TEXT, "monster-avatar/tag"], ["fg", "pc-soft", TEXT, "speler-avatar"],
  // WP39: "− Schade" en melding met eigen tokens (in donker geen ivoren vlak meer)
  ["dmg-fg", "dmg", TEXT, "Schade-knop"], ["dmg-line", "card", UI, "rand Schade-knop op kaart"],
  ["toast-fg", "toast-bg", TEXT, "melding"], ["t-link", "toast-bg", TEXT, "knop op melding"], ["t-good", "toast-bg", TEXT, "crit op melding"], ["t-bad", "toast-bg", TEXT, "fumble/fout-icoon op melding"],
  ["toast-line", "bg", UI, "melding op pagina"],
  ["sb-ink", "surface", TEXT, "statblock"],
  // WP17: statblock op perkament (--sb-bg), deelnemerskaart --card, walnoot-kop spelersscherm
  ["sb-ink", "sb-bg", TEXT, "statblock-inkt op perkament"], ["sb-ink", "sunk", TEXT, "statblock-inkt op hover (ability)"], ["fg", "sb-bg", TEXT, "statblock-tekst"],
  ["muted", "sb-bg", TEXT, "statblock-meta"], ["act-ink", "sb-bg", TEXT, "worp in het statblock"], ["info", "sb-bg", TEXT, "Voorbeeld/Daarna in de zijkolom"],
  ["fg", "card", TEXT, "tekst op kaart"], ["muted", "card", TEXT, "secundair op kaart"], ["act-ink", "card", TEXT, "goud op kaart"],
  ["good", "card", TEXT, "gelukt op kaart"], ["warn", "card", TEXT, "aandacht op kaart"], ["bad", "card", TEXT, "fout op kaart"], ["info", "card", TEXT, "info op kaart"],
  ["now-ink", "fight-bg", TEXT, "aan de beurt op walnoot-kop (spelersscherm)"], ["muted", "sunk", TEXT, "kop spelersscherm bij verbinding kwijt"],
  ["line-strong", "card", UI, "componentrand op kaart"], ["sel", "card", UI, "ring op kaart"], ["mon", "card", UI, "zijstreep op kaart"], ["focus", "card", UI, "focusring op kaart"], ["line-strong", "sb-bg", UI, "rand in het statblock"],
  ["fight-fg", "fight-bg", TEXT, "Gevecht-kop"], ["fight-muted", "fight-bg", TEXT, "Gevecht-kop secundair"], ["fight-fg", "fight-btn", TEXT, "knop in Gevecht-kop"],
  ["sel", "surface", UI, "ring geopend/geselecteerd"], ["sel", "act-soft", UI, "selectierand op zacht vlak"],
  ["focus", "bg", UI, "focusring"], ["focus", "surface", UI, "focusring op kaart"], ["focus", "act-soft", UI, "focusring op geselecteerd"],
  ["mon", "surface", UI, "zijstreep monster"], ["line-strong", "surface", UI, "componentrand"], ["line-strong", "bg", UI, "componentrand op pagina"],
  ["fight-btn-line", "fight-bg", UI, "knoprand in Gevecht-kop"],
  // WP35: secundaire knop (--btn) en invoervelden (vlak --card, rand --line-strong)
  ["fg", "btn", TEXT, "tekst op secundaire knop"], ["muted", "btn", TEXT, "bijschrift op knop (Vorige, cijferpad)"], ["good", "btn", TEXT, "Heal-knop"],
  ["warn", "btn", TEXT, "save-knop, LA-chip"], ["bad", "btn", TEXT, "destructieve knop"], ["focus", "btn", UI, "focusring op knop"],
  ["focus", "sunk", UI, "focusring in verzonken paneeltje"], ["line-strong", "sunk", UI, "rand invoerveld op verzonken paneeltje"],
];
// WP39: alleen in donker afgedwongen. In licht is de knoprand bewust decoratief (= --line, WP17: geen drukke lijst; het label draagt de knop),
// en de melding ligt als walnoot-vlak al los van een licht paneel.
const DARK_ONLY = [
  ["btn-line", "card", UI, "knoprand op kaart"], ["btn-line", "surface", UI, "knoprand op paneel/dock"], ["btn-line", "sunk", UI, "knoprand in paneeltje (conditieraster)"],
  ["toast-line", "surface", UI, "melding boven een open paneel"],
];

for (const [name, T] of [["licht", light], ["donker", darkSys]]) {
  test(`contrast ${name}`, () => {
    const bad = [];
    for (const [f, b, min, what] of name === "donker" ? [...PAIRS, ...DARK_ONLY] : PAIRS) {
      assert.ok(T[f] && T[b], `${name}: token --${f} of --${b} ontbreekt`);
      const r = ratio(T[f], T[b]);
      if (r < min) bad.push(`${what}: --${f} op --${b} = ${r.toFixed(2)} < ${min}`);
    }
    assert.deepEqual(bad, []);
  });
}

test("HP-balk en statuskleuren als grafiek ≥ 3:1 tegen de kaart", () => {
  for (const T of [light, darkSys]) for (const k of ["good", "warn", "bad", "act-ink"]) for (const bg of ["surface", "card"]) assert.ok(ratio(T[k], T[bg]) >= UI, k + " op " + bg);
});

test("WP39: in donker is geen knop- of meldingsvlak lichter dan Lantern (schemerige kamer)", () => {
  for (const k of ["dmg", "toast-bg", "btn"]) assert.ok(lum(darkSys[k]) < lum(darkSys.act), `--${k} lichter dan --act`);
  assert.equal(light.dmg, light.fg, "licht: Schade blijft het donkere vlak (WP14 C)");
  assert.equal(light["btn-line"], light.line, "licht: knoprand blijft --line (WP17)");
});

test("donker thema staat twee keer gelijk (systeem en vaste keuze)", () => {
  assert.deepEqual(darkFix, darkSys);
  assert.deepEqual(Object.keys(darkSys).sort(), Object.keys(light).sort());
});

test("op goud alleen --act-fg als voorgrond (nooit wit)", () => {
  for (const T of [light, darkSys]) assert.notEqual(T["act-fg"], "#ffffff");
  // elke regel met een gouden vlak zet zelf --act-fg, of erft hem via een regel die dat doet (.pvnow.me)
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*background:var\(--act\)[^{}]*)\}/g)];
  assert.ok(rules.length >= 5);
  for (const [, sel, body] of rules) {
    const own = /(^|;)color:var\(--act-fg\)/.test(body);
    const kids = sel.trim().split(",").every((x) => new RegExp(x.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " [^{]*\\{[^}]*color:var\\(--act-fg\\)").test(css));
    assert.ok(own || kids, `gouden vlak zonder --act-fg: ${sel.trim()}`);
  }
  assert.doesNotMatch(css, /\.pvnow\.me[^{]*\{[^}]*color:var\(--(surface|bg)\)/);
});

test("geen oude accenttokens en geen hex in componenten", () => {
  assert.doesNotMatch(css, /var\(--(accent|active|pc)(?![a-z-])/);
  const tokenEnd = css.indexOf(':root[data-theme="dark"]{');
  const rest = css.slice(css.indexOf("}", tokenEnd) + 1);
  const hits = [];
  for (const rule of rest.split("}")) {
    if (!/#[0-9a-f]{3,8}\b/i.test(rule)) continue;
    const sel = rule.split("{")[0];
    if (/qr/.test(sel)) continue; // QR: zwart op wit in beide thema's (scanners)
    hits.push(sel.trim().slice(-60));
  }
  assert.deepEqual(hits, []);
});

test("elke gebruikte var is ergens gedeclareerd", () => {
  const decl = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
  const runtime = new Set(["stick", "rows", "tvfs", "dock-h"]); // via JS gezet (style.setProperty)
  const miss = [...new Set([...css.matchAll(/var\(--([a-z0-9-]+)/gi)].map((m) => m[1]))].filter((k) => !decl.has(k) && !runtime.has(k));
  assert.deepEqual(miss, []);
});

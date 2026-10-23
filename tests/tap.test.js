// AF6 (1.35.1): tikdoelen ≥ 44 px. Statische controle op css/app.css (node --test heeft geen browser): geen regel voor een
// knop, link, invoerveld, pip of conditie-toggle met een gedeclareerde (min-)hoogte in px onder 44. Hoogte die alleen uit
// padding komt, ziet deze test niet. Uitzonderingen staan hieronder met reden.
// De echte meting in de browser (Playwright, 320–390 px) hoort bij de browsercheck van elke release.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const render = readFileSync(new URL("../js/ui/render.js", import.meta.url), "utf8");

/** Binnenste regels (ook binnen @media): [selector, declaraties] */
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
const px = (decl, prop) => { const m = decl.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([\\d.]+)px`)); return m ? +m[1] : null; };

// Tikbaar: knoppen, links, invoervelden, pips, death saves, recharge-chips, conditie-toggles, seg-knoppen, summary
const TAP = /(^|[\s>,+~])(button|input|select|summary)\b|\.(btn|link|pip|dsp|rc|seg2?|condgrid|chk)\b/;
// Geen tikvlak: het vakje van een checkbox (het label is het tikvlak), het zichtbare bolletje, avatars/iconen in een knop
const EXEMPT = /(\.chk|\.atop|\.schk) input|::before|::after|\.vh\b/;

test("AF6: geen tikdoel onder 44 px hoog in app.css", () => {
  const bad = [];
  for (const [sel, decl] of rules) {
    for (const part of sel.split(",").map((x) => x.trim())) {
      if (!TAP.test(part) || EXEMPT.test(part)) continue;
      for (const prop of ["min-height", "height"]) {
        const v = px(decl, prop);
        if (v !== null && v < 44) bad.push(`${part} { ${prop}: ${v}px }`);
      }
    }
  }
  assert.deepEqual(bad, [], `Tikdoel onder 44 px:\n${bad.join("\n")}`);
});

test("AF6: pip en death save zijn zelf 44×44 (het bolletje is ::before)", () => {
  for (const s of [".pip", ".dsp"]) {
    const r = rules.find(([sel]) => sel === s);
    assert.ok(r, `regel ${s} ontbreekt`);
    assert.ok(px(r[1], "width") >= 44 && px(r[1], "height") >= 44, `${s} moet 44×44 zijn`);
  }
});

test("AF14: worpen in de statblocktekst blijven inline (uitzondering), met ruimte eromheen", () => {
  // Bewuste uitzondering op 44 px: targets in een zin (WCAG 2.5.8); aanvallen hebben op de kaart eigen knoppen van 44 px.
  const d = rules.find(([sel]) => sel === ".dice");
  assert.ok(d && /padding:\s*4px/.test(d[1]), ".dice heeft verticale padding");
  const p = rules.find(([sel]) => sel === ".sb p,.sbx p");
  assert.ok(p && /line-height:\s*1\.9/.test(p[1]), "ruimere regel in het statblock (padding overlapt de regel erboven niet)");
});

test("AF6: knoppen en invoervelden hebben minstens 44 px", () => {
  for (const s of [".btn", ".btn.small"]) assert.ok(px(rules.find(([sel]) => sel === s)[1], "min-height") >= 44, s);
  assert.ok(rules.some(([sel, d]) => sel.startsWith("label input") && px(d, "min-height") >= 44), "label input");
});

test("AF15: negatieve getallen zonder lettertoetsenbord en zonder contact-autofill", () => {
  // init-bonus is een stepper (geen invoerveld), Dex-mod bestaat niet meer apart
  assert.ok(!/id="pc-dex"/.test(html), "pc-dex is weg (init-bonus vervangt hem)");
  assert.match(html, /class="stepper"[^>]*id="pc-bon"/, "init-bonus als stepper");
  // effectwaarde: teken in de keuze, het veld zelf alleen cijfers (iOS-cijferpad)
  const ef = render.match(/<input data-f="ef-v"[^>]*>/);
  assert.ok(ef && /inputmode="numeric"/.test(ef[0]) && /min="0"/.test(ef[0]), "ef-v met cijferpad en min 0");
  assert.match(render, /\["ac-", "AC −"\]/); assert.match(render, /\["max-", "Max HP −"\]/);
  // + Speler: nergens contact-autofill (iOS biedt die aan op naamvelden)
  const form = html.slice(html.indexOf('<form class="form" id="f-pc"'), html.indexOf("</form>", html.indexOf('id="f-pc"')));
  assert.match(form, /<form[^>]*novalidate[^>]*autocomplete="off"/);
  for (const t of form.match(/<input [^>]*>/g)) if (!/type="(file|checkbox)"/.test(t)) assert.match(t, /autocomplete="off"/, t);
});

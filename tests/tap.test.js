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

test("AF6: knoppen en invoervelden hebben minstens 44 px", () => {
  for (const s of [".btn", ".btn.small"]) assert.ok(px(rules.find(([sel]) => sel === s)[1], "min-height") >= 44, s);
  assert.ok(rules.some(([sel, d]) => sel.startsWith("label input") && px(d, "min-height") >= 44), "label input");
});

test("AF7: velden die negatief mogen zijn hebben geen numeriek toetsenbord (iOS heeft daar geen minteken)", () => {
  for (const id of ["pc-dex", "pc-init"]) {
    const tag = html.match(new RegExp(`<input id="${id}"[^>]*>`));
    assert.ok(tag, id);
    assert.ok(!/inputmode=/.test(tag[0]), `${id} zonder inputmode`);
  }
  const ef = render.match(/<input data-f="ef-v"[^>]*>/);
  assert.ok(ef && !/inputmode=/.test(ef[0]), "ef-v zonder inputmode");
});

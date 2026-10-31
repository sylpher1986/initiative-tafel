// G7 (WP80): gedeelde worpweergave (js/dice/view.js): escapen, advantage/disadvantage, crit-dice, nat 20/nat 1, onbekende velden.
import "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diceHtml, diceText } from "../js/dice/view.js";
import { fromAtk, fromDmg } from "../js/ui/rolls.js";
import { withAdv } from "../js/rules/attacks.js";

const root = new URL("..", import.meta.url);
const strip = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const count = (h, re) => (h.match(re) || []).length;

test("WP80 diceHtml: label en modifiernamen ge-escaped, ook in aria-label en sub", () => {
  const r = { label: '<img src=x onerror="a">', g: [{ c: 1, die: 20, vals: [12], keep: "all" }], m: [{ n: "<b>Bless</b>", die: 4, v: 3 }, { n: "Ex & \"2\"", b: -2 }], tot: 13 };
  const h = diceHtml(r, { head: { txt: "<i>Raak</i>", cls: "x\" onclick" }, sub: "<s>fire</s>" });
  assert.ok(!/<img|<b>Bless|<i>Raak|<s>fire|onclick/.test(h), h);
  assert.ok(h.includes("&lt;img src=x onerror=&quot;a&quot;&gt;"));
  assert.ok(h.includes("Ex &amp; &quot;2&quot;"));
  assert.ok(/class="drh"/.test(h), "onbekende head-klasse genegeerd");
  assert.equal(count(h, /role="img"/g), 1, "één aria-label voor de hele worp");
});

test("WP80 advantage en disadvantage: beide d20's, de niet-tellende doorgestreept (niet alleen kleur)", () => {
  const a = fromAtk(withAdv({ dd: [6, 14], bo: 5 }, 1, []), 16);
  const h = diceHtml(a);
  assert.equal(count(h, /<s class="drd no">6<\/s>/g), 1);
  assert.equal(count(h, /<span class="drd">14<\/span>/g), 1);
  assert.match(diceText(a), /^d20 6 telt niet, 14; \+5; totaal 19 tegen AC 16$/);
  const d = fromAtk(withAdv({ dd: [6, 14], bo: 5 }, -1, []), 16);
  assert.match(diceText(d), /^d20 6, 14 telt niet; \+5; totaal 11 tegen AC 16$/);
  assert.equal(count(diceHtml(d), /<s class="drd no">14<\/s>/g), 1);
  const n = fromAtk(withAdv({ dd: [9, 3], bo: 2 }, 0, []), 12);
  assert.equal(count(diceHtml(n), /class="drd no"/g), 0, "normaal: alleen de eerste d20, niets doorgestreept");
});

test("WP80 nat 20 en nat 1 met woord, crit-dice los zichtbaar", () => {
  const r = fromAtk(withAdv({ dd: [20, 6], bo: 11 }, 1, [{ n: "Exhaustion 1", b: -2 }]), 16);
  const h = diceHtml(r, { head: { txt: "Kritiek!", cls: "bad" } });
  assert.ok(h.includes('<span class="drd n20">20</span><span class="drn">nat 20</span>'), h);
  assert.ok(h.includes("Exhaustion 1 <b>−2</b>"));
  assert.match(diceText(r, { head: { txt: "Kritiek!" } }), /^Kritiek!: d20 20 nat 20, 6 telt niet; \+11; Exhaustion 1 −2; totaal \d+ tegen AC 16$/);
  const one = diceHtml(fromAtk(withAdv({ dd: [1, 15], bo: 5 }, -1, []), 14));
  assert.ok(one.includes('<span class="drd n1">1</span><span class="drn bad">nat 1</span>'));
  const dm = fromDmg([{ e: "2d10+6", type: "slashing", rolls: [7, 3], mod: 6, total: 16, xr: [9, 2] }], true);
  const dh = diceHtml(dm, { sub: "slashing", sm: true });
  assert.ok(/<span class="drc"><span class="drcw">kritiek<\/span><span class="drd">9<\/span><span class="drd">2<\/span><\/span>/.test(dh), dh);
  assert.equal(strip(dh).endsWith("27 slashing"), true);
  assert.equal(diceText(dm, { sub: "slashing" }), "2d10 7, 3, kritiek 9, 2; +6; totaal 27 slashing");
  assert.ok(!diceHtml(fromDmg([{ e: "2d10+6", type: "slashing", rolls: [7, 3], mod: 6, total: 16, xr: [9, 2] }], false)).includes("drc"), "geen crit: geen crit-dice");
});

test("WP80 onbekende velden en rommel genegeerd, nooit een uitzondering", () => {
  const r = { g: [{ c: 1, die: 20, vals: [8], keep: "all", zz: 1 }], m: [{ n: "", b: 0 }, { foo: 1 }], tot: 8, nieuw: { x: 1 } };
  assert.ok(diceHtml(r).includes('<span class="drd">8</span>'));
  assert.equal(diceText(r), "d20 8; +0; totaal 8");
  for (const bad of [null, undefined, {}, { g: "x", m: 5 }, { g: [{ die: 6, vals: ["a", 3] }], tot: NaN }]) {
    assert.doesNotThrow(() => diceHtml(bad)); assert.doesNotThrow(() => diceText(bad));
  }
  assert.ok(diceText({}).endsWith("totaal ?"));
  const evil = diceHtml({ g: [{ c: '<img onerror="x">', die: '<img onerror="x">', vals: [3] }, { c: 1, die: 6, vals: [4] }], m: [{ n: "Bless", die: "<b>", v: 2 }], tot: 4 });
  assert.ok(!/<img|<b>/.test(evil) && evil.includes('<span class="drd">4</span>') && !evil.includes("Bless"), "groep/steen zonder geldige die overgeslagen");
  assert.ok(diceHtml({ g: [], m: [{ n: "Bane", die: -4, v: 2 }], tot: -2 }).includes("Bane −<span class=\"drl\">d4</span>"));
});

test("WP80 aanvalspaneel gebruikt de gedeelde weergave; css/dice.css geladen en gecachet; geen hex in dice.css", () => {
  const render = readFileSync(new URL("js/ui/render.js", root), "utf8");
  assert.ok(/diceHtml\(fromAtk\(/.test(render) && /diceHtml\(fromDmg\(\[p\]/.test(render));
  assert.ok(!/partText\(/.test(render), "tekst voor log en toast blijft in js/rules, niet in het paneel");
  assert.ok(readFileSync(new URL("pages/initiative.html", root), "utf8").includes('href="/css/dice.css"'));
  assert.ok(readFileSync(new URL("sw.js", root), "utf8").includes('"./css/dice.css"'));
  const css = readFileSync(new URL("css/dice.css", root), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(css), "alleen tokens");
  assert.ok(!/--act\b|--act-|color-mix|backdrop-filter/.test(css), "geen goud, geen color-mix/backdrop-filter");
  // eigen voorvoegsel "dr": .dice bestaat al (statblock-worpen) en zou de worp goud en onderstreept maken
  const own = new Set([...css.matchAll(/\.(dr[a-z0-9]*)/g)].map((m) => m[1]));
  const app = readFileSync(new URL("css/app.css", root), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const c of own) assert.ok(!new RegExp(`\\.${c}(?![\\w-])`).test(app), `.${c} bestaat al in css/app.css`);
  const markup = readFileSync(new URL("js/ui/render.js", root), "utf8");
  for (const c of own) assert.ok(!new RegExp(`class="[^"$]*\\b${c}\\b`).test(markup) || c === "drsum", `.${c} buiten de worpweergave in render.js`);
  assert.ok([...css.matchAll(/(^|[},])\s*\.([a-z][\w-]*)/g)].every((m) => m[2].startsWith("dr")), "elke regel begint met een eigen dr-klasse");
});

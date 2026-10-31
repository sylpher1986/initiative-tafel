// G7 (WP81): compacte worpweergave en adapters voor saves/AoE, initiative, death save, HP en statblock-worpen.
import "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diceHtml, diceText } from "../js/dice/view.js";
import { rollExpr } from "../js/rules/dice.js";
import { rollSave, rollText, DTYPES } from "../js/rules/aoe.js";
import { initThrow } from "../js/rules/turns.js";
import { monsterActions, actionAoe, parseAction } from "../js/rules/attacks.js";
import { rollDice } from "../js/rules/dmgspells.js";
import { fromSave, fromSaveAs, fromExpr, fromInit, fromDs, initDice, oneD20, aoeAct } from "../js/ui/rolls.js";

const root = new URL("..", import.meta.url);
const vals = (n, ...v) => { let i = 0; return () => (v[i++ % v.length] - 1) / n + 0.0001; };
const seq = (...v) => vals(20, ...v);
const strip = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const count = (h, re) => (h.match(re) || []).length;
const cp = (r, o) => diceHtml(r, { compact: true, ...o });
const SRD = JSON.parse(readFileSync(new URL("data/monsters.json", root)));

test("WP81 compact: één d20 zonder groepslabel, totaal inline, ✓/✗ als tekst, voluit in het aria-label", () => {
  const h = cp(fromDs(14));
  assert.ok(!/class="drl"/.test(h), "geen groepslabel bij alleen een d20");
  assert.match(h, /class="droll cp"/);
  assert.match(strip(h), /^14 ✓$/, "één steen zonder modifiers: geen herhaald totaal");
  assert.match(strip(cp(fromInit([14], 2))), /^14 \+2 = 16$/);
  assert.match(h, /aria-label="d20 14; totaal 14 tegen DC 10, geslaagd"/);
  assert.match(cp(fromDs(7)), /<span class="drk bad">✗<\/span>/);
  assert.match(cp(fromDs(7)), /, gefaald"/);
  assert.equal(count(h, /role="img"/g), 1);
});

test("WP81 compact: modifiers opgeteld met namen erachter, Bless/Bane-d4 en cover; disadvantage doorgestreept", () => {
  const x = rollSave(3, -1, seq(15, 4, 3), [{ n: "Bless", d: 4 }, { n: "Half cover", b: 2 }], "Exhaustion 3");
  const r = fromSaveAs(x, "DEX", 12);
  assert.equal(r.label, "DEX-save · dis (Exhaustion 3)");
  assert.equal(r.tot, x.tot);
  const h = cp(r);
  assert.match(h, /<s class="drd no">15<\/s>/);
  assert.match(h, /<b>\+6<\/b><span class="drmn">Bless, Half cover<\/span>/, h); // 3 + d4 (1) + 2
  assert.equal(r.ok, x.tot >= 12);
  assert.match(diceText(r, { compact: true }), /Bless d4 1; Half cover \+2; totaal/, "volledig in het aria-label");
  assert.ok(rollText(x, 12).includes(`= ${x.tot}`), "logtekst blijft rollText");
});

test("WP81 fromSaveAs: advantage met en zonder reden; zonder tweede d20 geen notitie", () => {
  const mr = rollSave(5, 1, seq(3, 18));
  assert.equal(fromSaveAs(mr, "WIS", 15).label, "WIS-save · adv (Magic Resistance)");
  assert.equal(fromSaveAs(mr, "WIS", 15, "").label, "WIS-save · adv");
  const one = rollSave(5, 0, seq(11));
  assert.equal(fromSaveAs(one, "CON", 13).label, "CON-save");
  assert.deepEqual({ ...fromSaveAs(one, "CON", 13), label: undefined }, { ...fromSave(one, 13), label: undefined });
});

test("WP81 compact: escapen van label en modifiernamen; toastvariant krijgt eigen klasse", () => {
  const r = { label: "<img src=x>", g: [{ c: 1, die: 20, vals: [9], keep: "all" }], m: [{ n: "<b>x</b>", b: 1 }], tot: 10 };
  const h = cp(r, { toast: true });
  assert.ok(!/<img|<b>x/.test(h), h);
  assert.match(h, /class="droll cp drts"/);
  assert.equal(cp(null), cp({}), "rommel geeft geen uitzondering");
});

test("WP81 initiative: initDice via de gedeelde module (2024-disadvantage = twee d20's), fromInit = initThrow", () => {
  assert.deepEqual(initDice(true, seq(14, 6)), [14, 6]);
  assert.deepEqual(initDice(false, seq(9)), [9]);
  assert.equal(oneD20(seq(17)), 17);
  const em = { n: "Exhaustion 2", b: -4 };
  const r = fromInit([14, 6], 2, em);
  assert.equal(r.tot, initThrow([14, 6], 2, em).v);
  const h = cp(r);
  assert.match(h, /<span class="drd">6<\/span>/);
  assert.match(h, /<s class="drd no">14<\/s>/);
  assert.match(h, /<b>−2<\/b><span class="drmn">Exhaustion 2<\/span>/);
});

test("WP81 fromExpr: HP-worp met de uitkomst van de tool (minstens 1), statblock-worp, vaste waarde, ongeldig = null", () => {
  const x = rollExpr("2d6 - 5", vals(6, 1, 1));
  const hp = fromExpr("2d6 - 5", x.rolls, Math.max(1, x.total), "HP");
  assert.equal(hp.tot, 1, "tool wint: HP minstens 1");
  assert.equal(hp.label, "HP");
  assert.match(strip(cp(hp)), /^HP 2d6 1 1 −5 = 1$/);
  const hit = rollExpr("1d20+5", seq(20));
  assert.match(cp(fromExpr("1d20+5", hit.rolls, hit.total)), /class="drd n20"/);
  const d = rollDice("28");
  assert.equal(fromExpr(d.e, d.rolls, d.tot).tot, 28);
  assert.match(strip(cp(fromExpr(d.e, d.rolls, d.tot, "Fireball"))), /^Fireball 28$/, "vaste schade: alleen het getal");
  assert.equal(fromExpr("2d6", [3], 3), null);
});

test("WP81 aoeAct: zelfde worp in tekst (log) en weergave; alleen het eerste damage type in dr", () => {
  const a = monsterActions(SRD.find((m) => m.n === "Adult Black Dragon")).main.find((x) => x.n === "Acid Breath");
  const max = (e) => rollExpr(e, () => 0.999999);
  const x = aoeAct(a, max, DTYPES);
  assert.deepEqual({ ...x, dr: undefined }, { ...actionAoe(a, max, DTYPES), dr: undefined });
  assert.equal(x.dr.tot, 96);
  assert.equal(x.dr.g[0].vals.length, 12);
  const b = parseAction("Breath", "DC 15 Constitution saving throw, taking 10 (3d6) poison damage plus 3 (1d6) fire damage on a failed save, or half as much damage on a successful one.");
  let i = 0; const v = [1, 2, 3, 6];
  const y = aoeAct(b, (e) => rollExpr(e, () => (v[i++] - 1) / 6 + 0.0001), DTYPES);
  assert.equal(y.dmg, 6);
  assert.match(y.roll, /^3d6 \[1, 2, 3\] = 6$/);
  assert.deepEqual(y.dr.g.map((g) => g.vals), [[1, 2, 3]], "fire-deel (6) niet in dr");
  assert.equal(aoeAct({ dmg: [] }, max, DTYPES), null);
  // vast deel vóór en tussen de gerolde delen: dezelfde stenen terug, in dezelfde volgorde
  const mix = { ...b, dmg: [{ flat: "4", type: "poison" }, { e: "2d6", type: "poison" }, { flat: "1", type: "poison" }, { e: "1d6", type: "fire" }] };
  const rng = () => { const q = [2, 5, 6]; let k = 0; return (e) => rollExpr(e, () => (q[k++] - 1) / 6 + 0.0001); };
  const m1 = aoeAct(mix, rng(), DTYPES), m0 = actionAoe(mix, rng(), DTYPES);
  assert.equal(m1.roll, m0.roll); assert.equal(m1.dmg, m0.dmg); assert.equal(m1.dmg, 12);
  assert.deepEqual(m1.dr.g.map((g) => g.vals), [[2, 5]]);
  assert.deepEqual(m1.dr.m.map((x) => x.b), [4, 1]);
});

test("WP81: actions.js rolt d20's alleen via de gedeelde module; toast-tokens in dice.css", () => {
  const src = readFileSync(new URL("js/ui/actions.js", root), "utf8");
  assert.ok(!/\bd\(20\)/.test(src), "geen directe d(20) meer");
  const css = readFileSync(new URL("css/dice.css", root), "utf8");
  assert.match(css, /\.drts \.drd\{[^}]*var\(--toast-fg\)/);
});

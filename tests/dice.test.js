// G7 (WP79): gedeelde dobbelsteenmodule (js/dice/roll.js), importgrens en Initiative-adapters (js/ui/rolls.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { d, rollExpr, avgExpr, HD_RE, parseExpr, dice, d20, toRoll, natFlags, kept, total } from "../js/dice/roll.js";
import * as rulesDice from "../js/rules/dice.js";
import { rollAttack, withAdv, rollDmgCrit, atkText, atkResult } from "../js/rules/attacks.js";
import { rollSave, rollText } from "../js/rules/aoe.js";
import { initThrow } from "../js/rules/turns.js";
import { fromAtk, fromDmg, fromSave, fromInit, fromDs } from "../js/ui/rolls.js";

const root = fileURLToPath(new URL("..", import.meta.url));
/** rng die vaste waarden geeft voor een steen met n zijden */
const vals = (n, ...v) => { let i = 0; return () => (v[i++ % v.length] - 1) / n + 0.0001; };
const seq = (...v) => vals(20, ...v);
/** roll met vaste dobbelstenen per worp (zoals tests/hit.test.js) */
const fixed = (...v) => { let i = 0; return (e) => rollExpr(e, () => { const n = +String(e).match(/d(\d+)/)[1]; return (v[i++ % v.length] - 1) / n + 0.0001; }); };

test("WP79: js/rules/dice.js geeft dezelfde functies door (één plek voor de rolcode)", () => {
  assert.equal(rulesDice.d, d);
  assert.equal(rulesDice.rollExpr, rollExpr);
  assert.equal(rulesDice.HD_RE, HD_RE);
  assert.equal(rulesDice.avgExpr, avgExpr);
  assert.deepEqual(rollExpr("2d6 − 1", vals(6, 4, 5)), { rolls: [4, 5], mod: -1, total: 8 });
  assert.equal(rollExpr("4d6kh3"), null, "rollExpr blijft alleen NdM±K");
  assert.equal(avgExpr("5d8"), 22);
  assert.equal(rulesDice.sgn(3), "+3");
  assert.equal(rulesDice.mod(15), 2);
  const src = readFileSync(root + "js/rules/dice.js", "utf8");
  assert.ok(!/Math\.random\(\)\s*\*/.test(src), "geen tweede rolfunctie in js/rules/dice.js");
});

test("WP79 parseExpr: termen, kh/kl, mintekens en grenzen; rommel → null zonder uitzondering", () => {
  assert.deepEqual(parseExpr("2d6 + 1d4 + 3"), [{ s: 1, c: 2, die: 6, keep: "all", kn: 2 }, { s: 1, c: 1, die: 4, keep: "all", kn: 1 }, { s: 1, b: 3 }]);
  assert.deepEqual(parseExpr("4d6kh3"), [{ s: 1, c: 4, die: 6, keep: "high", kn: 3 }]);
  assert.deepEqual(parseExpr("2D20KL1+3"), [{ s: 1, c: 2, die: 20, keep: "low", kn: 1 }, { s: 1, b: 3 }]);
  assert.deepEqual(parseExpr("2d20kh"), [{ s: 1, c: 2, die: 20, keep: "high", kn: 1 }], "kh zonder getal = 1");
  assert.deepEqual(parseExpr("d20 − 2"), [{ s: 1, c: 1, die: 20, keep: "all", kn: 1 }, { s: -1, b: 2 }]);
  assert.deepEqual(parseExpr("8d6-1d4"), [{ s: 1, c: 8, die: 6, keep: "all", kn: 8 }, { s: -1, c: 1, die: 4, keep: "all", kn: 1 }]);
  assert.deepEqual(parseExpr("1d100"), [{ s: 1, c: 1, die: 100, keep: "all", kn: 1 }]);
  assert.deepEqual(parseExpr("5"), [{ s: 1, b: 5 }]);
  assert.ok(parseExpr("100d1000"), "grens zelf mag");
  assert.ok(parseExpr(Array(10).fill("1d6").join("+")), "10 termen mag");
  for (const bad of ["", "   ", "abc", "2d", "d", "0d6", "101d6", "1d1", "1d1001", "1d10000", "4d6kh5", "4d6kh0", "2d6 3", "2d6++3", "2d6+", "+",
    "1000d6", "1d6*2", "1d6/2", "(1d6)", "1d6+1234567", Array(11).fill("1d6").join("+"), "1".repeat(201), "2d6kh1kh1", "--1d6", "1d6 + x"]) {
    assert.equal(parseExpr(bad), null, JSON.stringify(bad));
  }
  for (const bad of [null, undefined, {}, [], 12.5, NaN, true]) assert.doesNotThrow(() => parseExpr(bad));
  const t0 = Date.now();
  assert.equal(parseExpr("a" + " ".repeat(1e6)), null);
  assert.equal(parseExpr("1d6" + "+".repeat(1e5)), null);
  assert.ok(Date.now() - t0 < 1000, "lange invoer blijft snel");
  assert.equal(parseExpr(null), null);
  assert.equal(parseExpr({ toString: () => "1d6" }), null, "alleen tekst of getal");
});

test("WP79 dice: worpformaat met rng-injectie, kh/kl en vrije worpen", () => {
  assert.deepEqual(dice("4d6kh3", {}, vals(6, 2, 5, 1, 6)), { g: [{ c: 4, die: 6, vals: [2, 5, 1, 6], keep: "high", kn: 3 }], m: [], tot: 13 });
  const kl = dice("2d20kl1+3", { label: "Stealth" }, seq(14, 6));
  assert.deepEqual(kl, { label: "Stealth", g: [{ c: 2, die: 20, vals: [14, 6], keep: "low", kn: 1 }], m: [{ n: "", b: 3 }], tot: 9, nat: 6 });
  assert.equal(dice("8d6", {}, vals(6, 3)).tot, 24);
  assert.equal(dice("1d100", {}, vals(100, 100)).tot, 100);
  const sub = dice("2d6 - 1d4 + 1", {}, vals(6, 4));
  assert.deepEqual(sub.g[1], { c: 1, die: 4, vals: [3], keep: "all", s: -1 }, "afgetrokken groep");
  assert.equal(sub.tot, 4 + 4 - 3 + 1);
  assert.equal(dice("nonsense"), null);
  for (let i = 0; i < 200; i++) { const r = dice("3d8"); assert.ok(r.vals === undefined && r.g[0].vals.every((v) => v >= 1 && v <= 8)); }
  assert.deepEqual(dice("3d6+2", {}, vals(6, 2, 6, 3, 5)).g[0].vals, rollExpr("3d6+2", vals(6, 2, 6, 3, 5)).rolls, "zelfde rng-volgorde als rollExpr");
  assert.equal(dice("3d6+2", null, vals(6, 1)).tot, 5, "opts null mag");
  assert.equal(dice("1d6-0", {}, vals(6, 4)).m[0].b, 0);
  assert.ok(!Object.is(dice("1d6-0", {}, vals(6, 4)).m[0].b, -0), "geen −0");
});

test("WP79 d20: advantage, disadvantage en modifiers met naam (vast en als steen)", () => {
  assert.deepEqual(d20({}, seq(12)), { g: [{ c: 1, die: 20, vals: [12], keep: "all" }], m: [], adv: 0, tot: 12, nat: 12 });
  const a = d20({ adv: 1, label: "Dex save", mods: [{ n: "Dexterity", b: 3 }, { n: "Bless", die: 4 }, { n: "Bane", die: -4 }] }, (() => {
    const v = [4 / 20, 15 / 20, 2 / 4, 0]; let i = 0; return () => v[i++] + 0.0001; })());
  assert.deepEqual(a.g, [{ c: 2, die: 20, vals: [5, 16], keep: "high" }]);
  assert.deepEqual(a.m, [{ n: "Dexterity", b: 3 }, { n: "Bless", die: 4, v: 3 }, { n: "Bane", die: -4, v: 1 }]);
  assert.equal(a.tot, 16 + 3 + 3 - 1);
  assert.equal(a.nat, 16);
  assert.equal(a.adv, 1);
  assert.equal(a.label, "Dex save");
  const dis = d20({ adv: -1 }, seq(4, 15));
  assert.equal(dis.nat, 4);
  assert.equal(dis.adv, -1);
  assert.equal(d20(undefined, seq(9)).tot, 9);
  assert.equal(d20(null, seq(9)).tot, 9, "opts null mag");
});

test("WP79 natFlags: alleen bij precies één tellende d20", () => {
  assert.deepEqual(natFlags(d20({}, seq(20))), { nat20: true, nat1: false });
  assert.deepEqual(natFlags(d20({ adv: 1 }, seq(1, 20))), { nat20: true, nat1: false });
  assert.deepEqual(natFlags(d20({ adv: -1 }, seq(1, 20))), { nat20: false, nat1: true });
  assert.deepEqual(natFlags(dice("2d20", {}, seq(20, 20))), { nat20: false, nat1: false }, "twee tellende d20's");
  assert.deepEqual(natFlags(dice("1d20+1d20", {}, seq(20, 1))), { nat20: false, nat1: false }, "twee d20-groepen");
  assert.deepEqual(natFlags(dice("10-1d20", {}, seq(1))), { nat20: false, nat1: false }, "afgetrokken d20");
  assert.deepEqual(natFlags(dice("1d20-1d20", {}, seq(20, 5))), { nat20: true, nat1: false }, "alleen de opgetelde d20 telt");
  assert.deepEqual(natFlags(dice("1d12", {}, vals(12, 1))), { nat20: false, nat1: false });
  assert.deepEqual(natFlags({ g: [{ c: 1, die: 20, vals: [1], keep: "all" }], m: [], tot: 1, nat: 20 }), { nat20: false, nat1: true }, "stenen winnen van nat");
  assert.deepEqual(natFlags(null), { nat20: false, nat1: false });
  assert.equal(dice("2d20", {}, seq(20, 20)).nat, undefined, "nat alleen bij één tellende d20");
});

test("WP79 toRoll/kept/total: gerolde waarden omzetten zonder opnieuw te rollen", () => {
  assert.deepEqual(toRoll("2d10+6", [7, 3], { t: "piercing", x: [4, 9] }), { g: [{ c: 2, die: 10, vals: [7, 3], keep: "all", t: "piercing", x: [4, 9] }], m: [{ n: "", b: 6, t: "piercing" }], tot: 29 });
  assert.equal(toRoll("2d10", [7]), null, "te weinig waarden");
  assert.equal(toRoll("2d10", [7, 3, 1]), null, "te veel waarden");
  assert.equal(toRoll("2d10", [7, "3"]), null);
  assert.equal(toRoll("x", [1]), null);
  assert.equal(toRoll("1d6", [4], { tot: 99 }).tot, 99, "tool-uitkomst wint");
  assert.deepEqual(kept({ vals: [5, 5, 2], keep: "high", kn: 1 }), [0], "bij gelijk de eerste");
  assert.deepEqual(kept({ vals: [6, 1, 4, 3], keep: "low", kn: 2 }), [1, 3]);
  assert.deepEqual(kept({ vals: [6, 1], keep: "all" }), [0, 1]);
  assert.equal(total({ g: [{ c: 1, die: 6, vals: [4], keep: "all", x: [2] }], m: [{ n: "Bane", die: -4, v: 3 }, { n: "?", foo: 1 }], onbekend: true }), 3, "onbekende velden genegeerd");
});

test("WP79 importgrens: js/dice/* importeert alleen ../i18n/* en ./*; roll.js laadt los in Node", () => {
  const dir = root + "js/dice/";
  const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
  assert.ok(files.includes("roll.js"));
  for (const f of files) {
    const src = readFileSync(dir + f, "utf8");
    const specs = [...src.matchAll(/(?:^|[\s;])(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|(?:^|[\s;(])import\s*\(?\s*["']([^"']+)["']/gm)].map((m) => m[1] || m[2]);
    for (const s of specs) assert.match(s, /^(\.\.\/i18n\/[\w.-]+\.js|\.\/[\w.-]+\.js)$/, `${f}: import ${s}`);
    if (f === "roll.js") assert.ok(!/\b(document|window|localStorage)\b/.test(src.replace(/\/\/.*$/gm, "")), "roll.js zonder DOM");
  }
  const out = execFileSync(process.execPath, ["--input-type=module", "-e",
    `const r = await import(${JSON.stringify(new URL("../js/dice/roll.js", import.meta.url).href)}); console.log(JSON.stringify(r.dice("2d6+1", {}, () => 0.5)));`], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(out), { g: [{ c: 2, die: 6, vals: [4, 4], keep: "all" }], m: [{ n: "", b: 1 }], tot: 9 });
});

test("WP79 fromAtk: to-hit met adv, modifiers en raak volgens de regels", () => {
  const r = rollAttack(-1, 1, seq(4, 15));
  assert.equal(atkText(r, 16), "d20 [4, 15] adv −1 = 14 vs AC 16", "logtekst ongewijzigd");
  assert.deepEqual(fromAtk(r, 16), { g: [{ c: 2, die: 20, vals: [4, 15], keep: "high" }], m: [{ n: "", b: -1 }], tot: 14, nat: 15, adv: 1, vs: { k: "AC", n: 16 }, ok: false });
  assert.deepEqual(fromAtk(rollAttack(5, 0, seq(12, 3))).g, [{ c: 1, die: 20, vals: [12], keep: "all" }]);
  assert.equal(fromAtk(rollAttack(5, 0, seq(12, 3))).ok, undefined, "zonder AC onbekend");
  assert.equal(fromAtk(rollAttack(0, 0, seq(20)), 30).ok, true, "nat 20 raakt altijd");
  assert.equal(fromAtk(rollAttack(30, 0, seq(1)), 5).ok, false, "nat 1 mist altijd");
  const ex = withAdv(rollAttack(4, 0, seq(15, 3)), -1, [{ n: "Exhaustion 2", b: -4 }]);
  const f = fromAtk(ex, 10);
  assert.deepEqual(f.m, [{ n: "", b: 4 }, { n: "Exhaustion 2", b: -4 }]);
  assert.equal(f.tot, ex.tot);
  assert.equal(f.ok, atkResult(ex, 10, []).hit);
  assert.equal(total(f), f.tot, "formaat telt op tot de regeluitkomst");
});

test("WP79 fromDmg: delen, vaste schade en crit-dice apart in x", () => {
  const parts = rollDmgCrit("2d10+6:piercing|1d8:acid", fixed(7, 3, 5, 4, 9, 2));
  const plain = fromDmg(parts, false);
  assert.deepEqual(plain.g, [{ c: 2, die: 10, vals: [7, 3], keep: "all", t: "piercing" }, { c: 1, die: 8, vals: [5], keep: "all", t: "acid" }]);
  assert.deepEqual(plain.m, [{ n: "", b: 6, t: "piercing" }]);
  assert.equal(plain.tot, 21);
  const crit = fromDmg(parts, true);
  assert.deepEqual(crit.g[0].x, [4, 9]);
  assert.deepEqual(crit.g[1].x, [2]);
  assert.equal(crit.tot, atkResult({ nat: 20, tot: 0 }, 0, parts, {}, { crit: true }).raw);
  assert.equal(crit.tot, 36);
  assert.equal(total(crit), crit.tot);
  const flat = fromDmg(rollDmgCrit("1:piercing|3d4:poison", fixed(2)), true);
  assert.deepEqual(flat.m, [{ n: "", b: 1, t: "piercing" }], "vaste schade niet verdubbeld");
  assert.equal(flat.tot, 1 + 6 + 6);
  assert.deepEqual(fromDmg([], false), { g: [], m: [], tot: 0 });
  const odd = rollDmgCrit("1d1:fire|150d6-2:cold", fixed(1, 3));
  const fo = fromDmg(odd, true);
  assert.deepEqual(fo.g.map((g) => [g.die, g.c, g.x.length]), [[1, 1, 1], [6, 150, 150]], "ook buiten de grenzen van parseExpr: stenen en crit-dice blijven");
  assert.equal(fo.tot, atkResult({ nat: 20, tot: 0 }, 0, odd, {}, { crit: true }).raw);
  assert.equal(total(fo), fo.tot);
  const neg = rollDmgCrit("1d4-3:slashing", fixed(1));
  assert.equal(fromDmg(neg).tot, 0, "deel nooit onder 0");
  assert.equal(fromDmg(neg).tot, atkResult({ nat: 20, tot: 0 }, 0, neg, {}, { crit: false }).raw);
});

test("WP79 fromSave: d20 met Bless/Bane, cover en ✓ tegen de DC", () => {
  const sq = [0.5, 0.5, 0.0]; let i = 0;
  const x = rollSave(3, false, () => sq[i++], [{ n: "Half cover", b: 2 }, { n: "Bless", d: 4 }, { n: "Bane", d: -4 }]);
  assert.equal(rollText(x, 15), "d20 [11] +3 + 2 Half cover + 1d4 [3] Bless − 1d4 [1] Bane = 18 ✓", "logtekst ongewijzigd");
  const f = fromSave(x, 15);
  assert.deepEqual(f, { g: [{ c: 1, die: 20, vals: [11], keep: "all" }], m: [{ n: "", b: 3 }, { n: "Half cover", b: 2 }, { n: "Bless", die: 4, v: 3 }, { n: "Bane", die: -4, v: 1 }], tot: 18, nat: 11, adv: 0, vs: { k: "DC", n: 15 }, ok: true });
  assert.equal(total(f), f.tot);
  const sq2 = (...v) => { let j = 0; return () => (v[j++] - 0.5) / 20; };
  const a = fromSave(rollSave(2, true, sq2(4, 15)), 18);
  assert.deepEqual(a.g, [{ c: 2, die: 20, vals: [4, 15], keep: "high" }]);
  assert.equal(a.nat, 15); assert.equal(a.ok, false);
  const dis = fromSave(rollSave(2, -1, sq2(4, 15)), 0);
  assert.equal(dis.nat, 4); assert.equal(dis.adv, -1);
  assert.equal(dis.ok, undefined, "zonder DC onbekend"); assert.equal(dis.vs, undefined);
});

test("WP79 fromInit: één d20 of disadvantage (surprise 2024) met Exhaustion", () => {
  assert.deepEqual(initThrow([14, 6], 2), { r: 6, v: 8, txt: "d20 [14, 6] dis +2" }, "worptekst ongewijzigd");
  assert.deepEqual(fromInit([14, 6], 2), { g: [{ c: 2, die: 20, vals: [14, 6], keep: "low" }], m: [{ n: "", b: 2 }], tot: 8, nat: 6, adv: -1 });
  const em = { n: "Exhaustion 2", b: -4 };
  const f = fromInit([17], 3, em);
  assert.deepEqual(f.m, [{ n: "", b: 3 }, { n: "Exhaustion 2", b: -4 }]);
  assert.equal(f.tot, initThrow([17], 3, em).v);
  assert.equal(f.adv, 0);
});

test("WP79 fromDs: death save tegen 10, nat 20 en nat 1 gemarkeerd", () => {
  assert.deepEqual(fromDs(12), { g: [{ c: 1, die: 20, vals: [12], keep: "all" }], m: [], tot: 12, nat: 12, adv: 0, vs: { k: "DC", n: 10 }, ok: true });
  assert.equal(fromDs(9).ok, false);
  assert.deepEqual(natFlags(fromDs(20)), { nat20: true, nat1: false });
  assert.deepEqual(natFlags(fromDs(1)), { nat20: false, nat1: true });
});

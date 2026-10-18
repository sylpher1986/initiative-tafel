import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, effAc, effText, acBreakdown, addEffect, removeEffect, endConcEffects, endFightEffects, baseMax, saveMods, modsText, endOtherCasts } from "../js/rules/effects.js";
import { diffLog } from "../js/log.js";
import { cleanCombatant } from "../js/backup.js";
import { mergeSheet } from "../js/ddbjson.js";
import { step, startCombat, makeDur, durLabel } from "../js/rules/turns.js";
import { setMax, restMember, dropConc, startConc, applyDamage } from "../js/rules/combat.js";

const P = (n) => PRESETS.find((p) => p.n === n);
const pc = (o = {}) => ({ id: "p", name: "Fighter", kind: "pc", init: 15, dex: 2, ac: 16, hp: 30, max: 30, cond: [], ...o });
const cleric = (o = {}) => ({ id: "c", name: "Cleric", kind: "pc", init: 12, dex: 0, ac: 18, hp: 25, max: 25, cond: [], ...o });
const gob = (o = {}) => ({ id: "g", name: "Goblin", kind: "monster", init: 18, dex: 2, ac: 15, hp: 7, max: 7, cond: [], ...o });

test("effectieve AC: +, = (Mage Armor 13 + Dex), minimaal (Barkskin), basis blijft", () => {
  const c = pc({ ac: 12 });
  addEffect(c, P("Mage Armor"), null, { lr: true });
  assert.equal(effAc(c), 15); assert.equal(c.ac, 12, "basis-AC onaangetast");
  addEffect(c, P("Shield"), makeDur(c, { dur: "tstart" }, "g"));
  assert.equal(effAc(c), 20);
  const b = pc({ ac: 11 }); addEffect(b, P("Barkskin"), null);
  assert.equal(effAc(b), 16);
  addEffect(b, P("Half cover"), null);
  assert.equal(effAc(b), 16, "11 + 2 = 13, minimaal 16");
  assert.equal(effAc(pc({ ac: 0 })), 0);
  const n = pc({ ac: 0 }); addEffect(n, P("Shield"), null);
  assert.equal(effAc(n), 0, "onbekende AC + 5 blijft onbekend");
  assert.equal(effText(c.eff[0]), "AC 15"); assert.equal(effText(c.eff[1]), "+5 AC"); assert.equal(effText(b.eff[0]), "AC min. 16");
});

test("zelfde effect stapelt niet: vervangen", () => {
  const c = pc();
  addEffect(c, P("Aid"), null, { lr: true });
  addEffect(c, P("Aid"), null, { lr: true });
  assert.equal(c.eff.length, 1); assert.equal(c.max, 35); assert.equal(c.hp, 35);
});

test("Shield: tot begin volgende beurt van het doelwit, ook als het in andermans beurt komt", () => {
  const S = { list: [gob(), pc(), cleric()], round: 0, active: null };
  startCombat(S); // goblin (18) aan de beurt
  const f = S.list[1];
  addEffect(f, P("Shield"), makeDur(f, { dur: "tstart" }, S.active));
  assert.equal(durLabel(f.eff[0].d, S.list), "t/m begin volgende beurt");
  assert.equal(effAc(f), 21);
  const r = step(S, 1); // beurt fighter begint → Shield voorbij
  assert.equal(S.active, "p"); assert.equal(f.eff.length, 0); assert.equal(effAc(f), 16);
  assert.ok(r.msgs.some((m) => /Shield is voorbij/.test(m)));
  assert.ok(r.why.some((w) => w.t === "duur verlopen" && w.id === "p"));
});

test("rondes tellen af bij het begin van de beurt van wie het gaf", () => {
  const S = { list: [gob(), pc(), cleric()], round: 0, active: null };
  startCombat(S);
  addEffect(S.list[1], { n: "Eigen", st: "ac", op: "+", v: 1 }, makeDur(S.list[1], { dur: "r2" }, "g"));
  step(S, 1); step(S, 1); step(S, 1); // terug bij goblin: 1 over
  assert.equal(S.list[1].eff.length, 1);
  step(S, 1); step(S, 1); step(S, 1);
  assert.equal(S.list[1].eff.length, 0);
});

test("concentratie: effect verdwijnt bij 0 HP, nieuwe spell of handmatig stoppen van de caster", () => {
  const mk = () => { const f = pc(), c = cleric(); startConc(c, "Shield of Faith"); addEffect(f, P("Shield of Faith"), null, { by: c.id, spell: "Shield of Faith" }); return [f, c]; };
  let [f, c] = mk();
  assert.equal(effAc(f), 18);
  assert.equal(endConcEffects([f, c]).msgs.length, 0, "zolang de cleric concentreert blijft het");
  applyDamage(c, 40); // 0 HP → concentratie weg
  const r = endConcEffects([f, c]);
  assert.equal(f.eff.length, 0); assert.match(r.why[0].t, /concentratie van Cleric voorbij/);
  [f, c] = mk(); startConc(c, "Bless"); endConcEffects([f, c]); assert.equal(f.eff.length, 0, "andere spell");
  [f, c] = mk(); dropConc(c); endConcEffects([f, c]); assert.equal(f.eff.length, 0, "handmatig");
  [f, c] = mk(); endConcEffects([f]); assert.equal(f.eff.length, 0, "caster niet meer in het gevecht");
  // concentreert zonder bekende spell (handmatig Concentrating aangezet): effect blijft
  [f, c] = mk(); c.concSpell = null; endConcEffects([f, c]); assert.equal(f.eff.length, 1);
});

test("max HP: Aid verhoogt max en huidige HP (ook vanaf 0), terug bij einde; Life Drain verlaagt", () => {
  const f = pc({ hp: 0, ds: { s: 1, f: 1, stable: false, dead: false }, cond: ["Unconscious"] });
  addEffect(f, P("Aid"), null, { lr: true });
  assert.deepEqual([f.max, f.hp, f.cond], [35, 5, []], "komt bij");
  f.hp = 33; removeEffect(f, f.eff[0].id);
  assert.deepEqual([f.max, f.hp], [30, 30]);
  const f2 = pc({ hp: 20 }); addEffect(f2, P("Aid"), null); removeEffect(f2, f2.eff[0].id);
  assert.equal(f2.hp, 25, "20 + 5 = 25; onder het nieuwe max blijft HP staan");
  const g = gob({ hp: 7, max: 7 });
  addEffect(g, { n: "Life Drain", st: "max", v: -3 }, null);
  assert.deepEqual([g.max, g.hp, g.eff[0].hpd], [4, 4, -3]);
  removeEffect(g, g.eff[0].id); assert.deepEqual([g.max, g.hp], [7, 4]);
});

test("max HP tot 0 (Life Drain) = dood; speler als 3 failures, concentratie weg, terugdraaien wekt niet op", () => {
  const g = gob({ hp: 7, max: 7, cond: ["Concentrating"], concSpell: "Hold Person" });
  const r = addEffect(g, { n: "Life Drain", st: "max", v: -10 }, null);
  assert.deepEqual([g.max, g.hp, g.cond], [1, 0, []], "max blijft ≥ 1 (0 = onbekend), hp 0");
  assert.match(r.msgs[0], /Goblin sterft: max HP 0 \(Life Drain\)/);
  assert.ok(r.why.some((w) => /max HP tot 0/.test(w.t)));
  const f = pc({ hp: 12, temp: 5 });
  addEffect(f, { n: "Life Drain", st: "max", v: -30 }, null);
  assert.deepEqual([f.hp, f.temp, f.ds.dead, f.ds.f, f.cond.includes("Unconscious")], [0, 0, true, 3, true]);
  removeEffect(f, f.eff[0].id);
  assert.deepEqual([f.max, f.hp, f.ds.dead], [30, 0, true], "long rest/weghalen herstelt max, niet het leven");
  const dead = pc({ hp: 0, ds: { s: 0, f: 3, stable: false, dead: true } });
  const r2 = addEffect(dead, { n: "Life Drain", st: "max", v: -40 }, null);
  assert.ok(!r2.msgs.some((m) => /sterft/.test(m)), "al dood: geen tweede sterfmelding");
  const down = gob({ hp: 0 });
  const r3 = addEffect(down, { n: "Life Drain", st: "max", v: -10 }, null);
  assert.ok(!r3.msgs.some((m) => /sterft/.test(m)) && down.hp === 0, "monster al neer: geen sterfmelding");
});

test("herinnering zonder getal; geen effect op AC of HP", () => {
  const f = pc();
  const r = addEffect(f, P("Bless"), makeDur(f, { dur: "r10" }, "c"), { by: "c" });
  assert.equal(effAc(f), 16); assert.equal(f.max, 30);
  assert.match(r.msgs[0], /Bless \(\+1d4/);
});

test("gevecht stoppen en long rest", () => {
  const f = pc();
  addEffect(f, P("Shield"), makeDur(f, { dur: "tstart" }, "g"));
  addEffect(f, P("Half cover"), null);
  addEffect(f, P("Aid"), null, { lr: true });
  endFightEffects([f]);
  assert.deepEqual(f.eff.map((e) => e.n), ["Half cover", "Aid"]);
  f.hp = 10; restMember(f, true);
  assert.deepEqual([f.eff, f.max, f.hp], [[], 30, 30]);
});

test("max HP bewerken houdt schade aan", () => {
  const g = gob({ hp: 74, max: 84 }); setMax(g, 120); assert.deepEqual([g.max, g.hp], [120, 110]);
  const h = gob({ hp: 5, max: 84 }); setMax(h, 40); assert.equal(h.hp, 1, "levend blijft minstens 1");
  const d = gob({ hp: 0, max: 84 }); setMax(d, 90); assert.equal(d.hp, 0);
  const n = { name: "x", hp: 0, max: 0 }; setMax(n, 12); assert.deepEqual([n.max, n.hp], [12, 12]);
  setMax(n, -5); assert.equal(n.max, 1);
});

test("rare invoer: geen NaN, grenzen", () => {
  const f = pc();
  addEffect(f, { n: "", st: "ac", op: "x", v: "abc" }, null);
  addEffect(f, { n: "<b>", st: "hp?", v: 5 }, null);
  assert.deepEqual(f.eff.map((e) => [e.n, e.st, e.op, e.v]), [["Effect", "ac", "+", 0], ["<b>", "", "+", 0]]);
  addEffect(f, { n: "Groot", st: "ac", op: "=", v: 999 }, null);
  assert.equal(effAc(f), 40);
  removeEffect(f, "bestaat-niet");
});

test("AC-opbouw als tekst en lethargy bij einde Haste", () => {
  const c = pc({ ac: 12 });
  assert.equal(acBreakdown(c), "");
  addEffect(c, P("Mage Armor"), null); addEffect(c, P("Shield"), null); addEffect(c, P("Barkskin"), null);
  assert.equal(acBreakdown(c), "15 (Mage Armor) + Shield 5, minimaal 16 (Barkskin)");
  const h = pc(); addEffect(h, P("Haste"), null, { by: "c" });
  assert.match(removeEffect(h, h.eff[0].id).msgs[0], /lethargy/);
});

test("zonder bekende HP: max HP-effect is alleen een herinnering", () => {
  const c = pc({ hp: 0, max: 0 });
  addEffect(c, P("Aid"), null, { lr: true });
  addEffect(c, { n: "Life Drain", st: "max", v: -10 }, null);
  assert.deepEqual([c.max, c.hp, c.eff.map((e) => e.hpd)], [0, 0, [0, 0]]);
  assert.equal(baseMax(c), 0);
});

test("Aid vanaf 0 HP meldt dat de speler bijkomt; baseMax telt effecten niet mee", () => {
  const f = pc({ hp: 0, cond: ["Unconscious"] });
  const r = addEffect(f, P("Aid"), null, { lr: true });
  assert.ok(r.msgs.some((m) => /komt weer bij met 5 HP/.test(m)));
  assert.equal(baseMax(f), 30);
});

test("durLabel kort en lang; makeDur tstart ook in eigen beurt", () => {
  const f = pc();
  const d = makeDur(f, { dur: "tstart" }, "p");
  assert.deepEqual(d, { kind: "tstart", who: "p", at: "start", count: 1 });
  assert.equal(durLabel(d, [f], true), "begin beurt");
  assert.equal(durLabel(makeDur(f, { dur: "tend" }, "g"), [f], true), "einde beurt");
  assert.equal(durLabel(makeDur(f, { dur: "sstart" }, "p"), [f], true), "beurt Fighter");
  assert.equal(durLabel(makeDur(f, { dur: "r10" }, "p"), [f], true), "10r");
  assert.equal(durLabel(null, [f]), "");
});

test("logboek: effect erbij, vernieuwd en voorbij", () => {
  const base = { round: 1, active: "p", list: [pc()] };
  const a = structuredClone(base); addEffect(a.list[0], P("Shield of Faith"), null);
  assert.ok(diffLog(base, a).some((e) => /krijgt Shield of Faith \(\+2 AC\)/.test(e.msg)));
  const b = structuredClone(a); addEffect(b.list[0], P("Shield of Faith"), null);
  const rb = diffLog(a, b).map((e) => e.msg).join(" | ");
  assert.match(rb, /Shield of Faith vernieuwd/); assert.doesNotMatch(rb, /voorbij/);
  const c = structuredClone(b); removeEffect(c.list[0], c.list[0].eff[0].id);
  assert.match(diffLog(b, c).map((e) => e.msg).join(), /Shield of Faith voorbij/);
});

test("import: oude data zonder eff, rare effecten worden opgeschoond", () => {
  const old = cleanCombatant({ id: "x", name: "Oud", kind: "pc", hp: 5, max: 10, cond: [] });
  assert.equal(old.eff, undefined);
  assert.deepEqual(effAc({ ...old, ac: 12 }), 12);
  const c = cleanCombatant({ id: "x", name: "Raar", kind: "pc", hp: 5, max: 10, cond: [], eff: [
    { n: "<img src=x onerror=alert(1)>".repeat(5), st: "ac", op: "x", v: 999, hpd: 50, d: { kind: "rounds", who: "p", count: "3", at: "x" } },
    null, "tekst", { st: "max", v: "abc", hpd: 7, by: 12 },
  ] });
  assert.equal(c.eff.length, 2);
  const [a, b] = c.eff;
  assert.equal(a.n.length, 60); assert.deepEqual([a.op, a.v, a.hpd], ["+", 40, 0], "AC-grens en geen hpd buiten max HP");
  assert.deepEqual(a.d, { kind: "rounds", who: "p", at: "start", count: 3 });
  assert.deepEqual([b.n, b.v, b.hpd, b.by, typeof b.id], ["Effect", 0, 7, "12", "string"]);
});

test("sheet bijwerken (D&D Beyond) houdt Aid bovenop de nieuwe max", () => {
  const f = pc({ hp: 20 });
  addEffect(f, P("Aid"), null, { lr: true }); // 35 max, 25 HP
  const ch = mergeSheet(f, { max: 40 });
  assert.deepEqual([f.max, f.hp, baseMax(f)], [45, 35, 40]);
  assert.ok(ch.some((t) => t === "max HP 30 → 40"));
  removeEffect(f, f.eff[0].id); assert.equal(f.max, 40);
});

test("save-bonussen: cover alleen op DEX (hoogste telt), Bless/Bane op elke save", () => {
  const f = pc();
  addEffect(f, P("Half cover"), null); addEffect(f, P("Bless"), null);
  assert.deepEqual(saveMods(f, "DEX"), [{ n: "Half cover", b: 2 }, { n: "Bless", d: 4 }]);
  assert.deepEqual(saveMods(f, "WIS"), [{ n: "Bless", d: 4 }]);
  addEffect(f, P("Three-quarters cover"), null);
  assert.deepEqual(f.eff.map((e) => e.n), ["Bless", "Three-quarters cover"], "cover vervangt cover");
  assert.equal(effAc(f), 21);
  assert.equal(modsText(saveMods(f, "DEX")), "+5 Three-quarters cover, +1d4 Bless");
  const b = gob(); addEffect(b, P("Bane"), null);
  assert.equal(modsText(saveMods(b, "CON")), "−1d4 Bane");
  assert.deepEqual(saveMods(gob(), "DEX"), []);
  const own = pc(); addEffect(own, { n: "bless", st: "", txt: "eigen" }, null);
  assert.deepEqual(saveMods(own, "STR"), [{ n: "Bless", d: 4 }], "naam telt, hoofdletters maken niet uit");
});

test("Bless opnieuw casten: doelen uit dezelfde beurt blijven, een latere cast haalt de oude doelen weg", () => {
  const cl = cleric({ cond: ["Concentrating"], concSpell: "Bless" }), a = pc({ id: "a", name: "A" }), b = pc({ id: "b", name: "B" }), g = gob();
  const L = [cl, a, b, g];
  addEffect(a, P("Bless"), null, { by: "c", spell: "Bless", cast: "1:c" });
  assert.equal(endOtherCasts(L, "c", "Bless", "1:c").msgs.length, 0, "zelfde beurt: zelfde cast");
  addEffect(b, P("Bless"), null, { by: "c", spell: "Bless", cast: "1:c" });
  addEffect(g, P("Bane"), null, { by: "c", spell: "Bane", cast: "1:c" });
  const r = endOtherCasts(L, "c", "Bless", "2:c");
  assert.deepEqual([a.eff, b.eff].map((e) => e.length), [0, 0]);
  assert.equal(g.eff.length, 1, "andere spell blijft");
  assert.match(r.msgs[0], /A: Bless is voorbij \(Bless opnieuw gecast\)/);
  assert.equal(cleanCombatant({ kind: "pc", name: "X", eff: [{ n: "Bless", by: "c", cast: "1:c" }, { n: "Shield", cast: "1:c" }] }).eff.map((e) => e.cast).join(","), "1:c,");
});

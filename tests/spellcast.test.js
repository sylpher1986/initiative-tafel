import { test } from "node:test";
import assert from "node:assert/strict";
import { SPELLS, customSpell, castSpell, endConcConds, spellDefault, condImmune, casterDC, spellTargets, isHumanoid } from "../js/rules/spellcast.js";
import { step, startCombat, clearMonsters } from "../js/rules/turns.js";
import { turnSaves, resolveSave } from "../js/rules/saves.js";
import { dropConc, applyDamage } from "../js/rules/combat.js";
import { cleanCombatant } from "../js/backup.js";
import { saveMods } from "../js/rules/effects.js";

const SP = (n) => SPELLS.find((s) => s.n === n);
const pc = (id, o = {}) => ({ id, name: id, kind: "pc", init: 15, dex: 0, ac: 15, hp: 20, max: 20, cond: [], ...o });
const mon = (id, o = {}) => ({ id, name: id, kind: "monster", init: 10, dex: 0, ac: 13, hp: 27, max: 27, cond: [], ...o });
const pick = (c, o = {}) => ({ c, ok: false, lr: false, note: "", ...o });
const lich = { n: "Lich", meta: "Medium undead, any evil alignment", x: [["Condition Immunities", "charmed, exhaustion, frightened, paralyzed, poisoned"]], t: [["Spellcasting", "(spell save DC 20, +12 to hit)"]] };
const bugbear = { n: "Bugbear", meta: "Medium humanoid (goblinoid), chaotic evil", x: [] };

test("Bless op 3 spelers: effect met concentratie, één cast", () => {
  const cl = pc("Cleric"), a = pc("Ayla"), b = pc("Brann"), list = [cl, a, b, pc("Elara")];
  const r = castSpell(list, SP("Bless"), cl, [pick(a), pick(b), pick(cl)], { round: 1, active: "Cleric" });
  assert.deepEqual(r.hit, ["Ayla", "Brann", "Cleric"]);
  assert.ok(cl.cond.includes("Concentrating")); assert.equal(cl.concSpell, "Bless");
  for (const c of [a, b, cl]) { assert.equal(c.eff.length, 1); assert.equal(c.eff[0].by, "Cleric"); assert.equal(c.eff[0].cast, "1:Cleric"); }
  assert.equal(saveMods(a, "WIS")[0].d, 4, "Bless telt mee bij saves");
  assert.equal(list[3].eff, undefined);
});

test("Hold Person: gefaald = Paralyzed met herhaalsave en koppeling; geslaagd en legendary resistance = niets", () => {
  const wiz = pc("Elara"), b1 = mon("B1"), b2 = mon("B2"), dr = mon("Dragon", { lr: { max: 3, left: 3 } }), list = [wiz, b1, b2, dr];
  const r = castSpell(list, SP("Hold Person"), wiz, [pick(b1, { note: "WIS save d20 [6]" }), pick(b2, { ok: true }), pick(dr, { lr: true })], { round: 2, active: "Elara", dc: "15" });
  assert.deepEqual(r.hit, ["B1"]); assert.deepEqual(r.ok, ["B2", "Dragon"]);
  assert.deepEqual(b1.cond, ["Paralyzed"]);
  assert.deepEqual(b1.cd.Paralyzed, { kind: "rounds", who: "Elara", at: "start", count: 10, save: { ab: "WIS", dc: 15 }, by: "Elara", spell: "Hold Person", cast: "2:Elara" });
  assert.deepEqual(b2.cond, []); assert.deepEqual(dr.cond, []); assert.equal(dr.lr.left, 2);
  assert.ok(r.why.some((w) => w.id === "B1" && /save gefaald/.test(w.t) && /d20 \[6\]/.test(w.t)));
  assert.ok(r.why.some((w) => w.id === "Elara" && /B2 save geslaagd/.test(w.t)), "geslaagd: in het logboek bij de caster");
  // herhaalsave opent bij het begin van de beurt van het doelwit; geslaagd = Paralyzed weg
  const S = { list, saves: [] };
  turnSaves(S, "B1");
  assert.equal(S.saves.length, 1); assert.equal(S.saves[0].n, "Paralyzed"); assert.equal(S.saves[0].dc, 15);
  resolveSave(S, S.saves[0].sid, true);
  assert.deepEqual(b1.cond, []); assert.equal(b1.cd.Paralyzed, undefined);
});

test("Hypnotic Pattern: twee condities, beide weg als de concentratie breekt", () => {
  const bard = pc("Bard"), g = mon("G"), list = [bard, g];
  castSpell(list, SP("Hypnotic Pattern"), bard, [pick(g)], { round: 1, active: "Bard", dc: 14 });
  assert.deepEqual(g.cond, ["Charmed", "Incapacitated"]);
  assert.equal(g.cd.Charmed.save, undefined, "geen herhaalsave");
  assert.equal(endConcConds(list).why.length, 0, "concentratie loopt nog");
  applyDamage(bard, 99); // 0 HP: concentratie weg
  const r = endConcConds(list);
  assert.deepEqual(g.cond, []); assert.equal(r.why.length, 2);
  assert.match(r.why[0].t, /concentratie van Bard op Hypnotic Pattern voorbij/);
});

test("concentratie op iets anders of caster weg: condities vervallen; andere condities blijven", () => {
  const wiz = pc("W"), g = mon("G", { cond: ["Prone"] }), list = [wiz, g];
  castSpell(list, SP("Web"), wiz, [pick(g)], { round: 1, active: "W", dc: 13 });
  assert.deepEqual(g.cond, ["Prone", "Restrained"]);
  wiz.concSpell = "Fly"; // andere spell
  endConcConds(list);
  assert.deepEqual(g.cond, ["Prone"]);
  castSpell(list, SP("Web"), wiz, [pick(g)], { round: 1, active: "W", dc: 13 });
  endConcConds([g]); // caster niet meer in de lijst
  assert.deepEqual(g.cond, ["Prone"]);
  const h = mon("H", { cond: ["Restrained"] }); // handmatige conditie zonder caster
  dropConc(wiz); endConcConds([wiz, h]);
  assert.deepEqual(h.cond, ["Restrained"]);
});

test("opnieuw casten: zelfde beurt sluit aan, latere beurt = nieuwe cast en de oude doelen vervallen", () => {
  const wiz = pc("W"), a = mon("A"), b = mon("B"), list = [wiz, a, b];
  castSpell(list, SP("Hold Person"), wiz, [pick(a)], { round: 1, active: "W", dc: 15 });
  castSpell(list, SP("Hold Person"), wiz, [pick(b)], { round: 1, active: "W", dc: 15 });
  assert.ok(a.cond.includes("Paralyzed") && b.cond.includes("Paralyzed"), "zelfde beurt: beide");
  const r = castSpell(list, SP("Hold Person"), wiz, [pick(b)], { round: 2, active: "W", dc: 15 });
  assert.deepEqual(a.cond, []); assert.ok(b.cond.includes("Paralyzed"));
  assert.ok(r.why.some((w) => w.id === "W" && w.t === "Hold Person opnieuw gecast"));
  // Bless/Bane: effecten volgen dezelfde regel
  const cl = pc("C"), p1 = pc("P1"), p2 = pc("P2"), L2 = [cl, p1, p2];
  castSpell(L2, SP("Bless"), cl, [pick(p1)], { round: 1, active: "C" });
  castSpell(L2, SP("Bless"), cl, [pick(p2)], { round: 2, active: "C" });
  assert.equal((p1.eff || []).length, 0); assert.equal(p2.eff.length, 1);
});

test("andere concentratie van de caster: startConc wisselt, oude spell-condities vervallen in endConcConds", () => {
  const wiz = pc("W"), a = mon("A"), b = mon("B"), list = [wiz, a, b];
  castSpell(list, SP("Hold Person"), wiz, [pick(a)], { round: 1, active: "W", dc: 15 });
  const r = castSpell(list, SP("Web"), wiz, [pick(b)], { round: 2, active: "W", dc: 15 });
  assert.match(r.msgs[0], /concentratie op Hold Person verbroken, nu op Web/);
  endConcConds(list);
  assert.deepEqual(a.cond, []); assert.deepEqual(b.cond, ["Restrained"]);
});

test("niemand gefaald: concentratie start wel, doelen krijgen niets", () => {
  const wiz = pc("W"), a = mon("A"), list = [wiz, a];
  const r = castSpell(list, SP("Hold Person"), wiz, [pick(a, { ok: true })], { round: 1, active: "W", dc: 15 });
  assert.deepEqual(r.hit, []); assert.deepEqual(a.cond, []); assert.equal(wiz.concSpell, "Hold Person");
});

test("immuun: geen conditie, ook als de DM het doel aanvinkt", () => {
  const wiz = pc("W"), l = mon("L"), list = [wiz, l];
  assert.deepEqual(condImmune(lich), ["Charmed", "Frightened", "Paralyzed", "Poisoned"]);
  const r = castSpell(list, SP("Hold Person"), wiz, [{ ...pick(l), m: lich }], { round: 1, active: "W", dc: 15 });
  assert.deepEqual(r.immune, ["L"]); assert.deepEqual(l.cond, []);
});

test("standaardkeuze: kant van de caster, caster zelf uit, 0 HP uit, immuun/geen humanoid uit met tag", () => {
  const cl = pc("C"), a = pc("A"), down = pc("D", { hp: 0, cond: ["Unconscious"] }), g = mon("G"), l = mon("L", { hidden: true });
  assert.equal(spellDefault(SP("Bless"), cl, a, null).sel, true);
  assert.equal(spellDefault(SP("Bless"), cl, g, null).sel, false);
  const self = spellDefault(SP("Bless"), cl, cl, null);
  assert.equal(self.sel, false); assert.deepEqual(self.tags, ["caster"]);
  assert.equal(spellDefault(SP("Bless"), cl, down, null).sel, false);
  assert.equal(spellDefault(SP("Bane"), cl, g, bugbear).sel, true);
  assert.equal(spellDefault(SP("Hold Person"), cl, g, bugbear).sel, true);
  const lx = spellDefault(SP("Hold Person"), cl, l, lich);
  assert.equal(lx.sel, false); assert.equal(lx.immune, true); assert.deepEqual(lx.tags, ["immuun Paralyzed", "geen humanoid", "verborgen"]);
  // monster als caster: spelers zijn de tegenpartij
  assert.equal(spellDefault(SP("Hold Person"), g, a, bugbear).sel, true);
  assert.equal(spellDefault(SP("Hold Person"), g, mon("G2"), bugbear).sel, false);
  assert.equal(spellDefault(SP("Bless"), null, a, null).sel, false, "zonder caster niets aan");
  assert.equal(isHumanoid(a, null), true);
});

test("doelen: geen lair, geen doden of monsters op 0 HP; spelers op 0 HP wel", () => {
  const L = [pc("A"), pc("D", { hp: 0, ds: { s: 0, f: 3, dead: true } }), pc("Z", { hp: 0 }), mon("M", { hp: 0 }), mon("X", { hp: 0, max: 0 }), { id: "lair", kind: "lair", name: "Lair", cond: [] }];
  assert.deepEqual(spellTargets(L).map((c) => c.id), ["A", "Z"]);
});

test("spell save DC: sheet van de speler, statblock van het monster", () => {
  assert.equal(casterDC(pc("A", { sheet: { spellDC: "15" } }), null), "15");
  assert.equal(casterDC(pc("A"), null), "");
  assert.equal(casterDC(mon("L"), lich), "20");
  assert.equal(casterDC(mon("G"), bugbear), "");
});

test("eigen spell: conditie, save en herhaalsave alleen met save", () => {
  assert.deepEqual(customSpell({ n: " Fear ", cond: "Frightened", ab: "WIS", dur: "r10", rep: true }),
    { n: "Fear", ab: "WIS", conds: ["Frightened"], rep: true, dur: "r10", conc: true, side: "other", custom: true });
  const x = customSpell({ cond: "Hack", ab: "", rep: true, conc: false });
  assert.equal(x.conds[0], "Frightened"); assert.equal(x.rep, false); assert.equal(x.conc, false); assert.equal(x.n, "Frightened");
  const g = mon("G"), w = pc("W");
  castSpell([w, g], customSpell({ cond: "Blinded", dur: "inf", conc: false }), w, [pick(g)], { round: 1, active: "W" });
  assert.deepEqual(g.cond, ["Blinded"]); assert.deepEqual(g.cd.Blinded, { kind: "inf" }); assert.equal(w.cond.includes("Concentrating"), false);
});

test("duur loopt af in de beurt van de caster; encounter wissen houdt de koppeling", () => {
  const w = pc("W", { init: 20 }), g = mon("G"), S = { list: [w, g], round: 0, active: null };
  startCombat(S); // W aan de beurt
  castSpell(S.list, SP("Hypnotic Pattern"), w, [pick(g)], { round: S.round, active: S.active, dc: 14 });
  for (let i = 0; i < 19; i++) step(S, 1);
  assert.ok(g.cond.includes("Charmed"), "nog 1 ronde");
  step(S, 1); step(S, 1); // begin beurt W in ronde 11
  assert.deepEqual(g.cond, []);
  // speler als doelwit van een monster: monsters wissen houdt de conditie, koppeling blijft (caster weg → endConcConds ruimt op)
  const m = mon("M", { init: 20 }), p = pc("P"), S2 = { list: [m, p], round: 0, active: null };
  startCombat(S2);
  castSpell(S2.list, SP("Hold Person"), m, [pick(p)], { round: 1, active: "M", dc: 13 });
  clearMonsters(S2);
  assert.deepEqual(p.cd.Paralyzed, { kind: "inf", save: { ab: "WIS", dc: 13 }, by: "M", spell: "Hold Person", cast: "1:M" });
  endConcConds(S2.list);
  assert.deepEqual(p.cond, []);
});

test("import: koppeling in cd blijft bewaard en wordt opgeschoond", () => {
  const c = cleanCombatant(mon("G", { cond: ["Paralyzed"], cd: { Paralyzed: { kind: "rounds", who: "W", at: "start", count: 3, save: { ab: "WIS", dc: 15 }, by: "W", spell: "Hold Person".repeat(20), cast: "1:W" } } }));
  assert.equal(c.cd.Paralyzed.by, "W"); assert.equal(c.cd.Paralyzed.spell.length, 120); assert.equal(c.cd.Paralyzed.cast, "1:W");
  const d = cleanCombatant(mon("G", { cond: ["Prone"], cd: { Prone: { kind: "inf", at: "start" } } }));
  assert.equal(d.cd.Prone.by, undefined);
});

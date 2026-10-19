// Spellregels 2014 | 2024 (instelling): concentratie per editie, presets met afwijkingen, Sleep 2024, vervallen bij schade.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONC } from "../js/rules/conclist.js";
import { isConc, spellsAtLevel, pickList, sheetEd, edFor } from "../js/rules/spells.js";
import { spellEd } from "../js/ddbjson.js";
import { PRESETS, presetsFor, addEffect, removeEffect } from "../js/rules/effects.js";
import { SPELLS, castSpell, spellDefault, spellFor, rulesDiffer } from "../js/rules/spellcast.js";
import { turnSaves, resolveSave } from "../js/rules/saves.js";
import { applyDamage, startConc } from "../js/rules/combat.js";
import { cleanCombatant } from "../js/backup.js";
import { step, startCombat } from "../js/rules/turns.js";

const data = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8")).spells;
const SP = (n) => SPELLS.find((s) => s.n === n);
const pc = (id, o = {}) => ({ id, name: id, kind: "pc", init: 15, dex: 2, ac: 15, hp: 20, max: 20, cond: [], ...o });
const mon = (id, o = {}) => ({ id, name: id, kind: "monster", init: 10, dex: 0, ac: 13, hp: 27, max: 27, cond: [], ...o });
const pick = (c, o = {}) => ({ c, ok: false, lr: false, note: "", ...o });

test("concentratielijst is gelijk aan de spelldata (tools/conc_lists.py opnieuw draaien na een data-update)", () => {
  for (const [ed, f] of [["2014", "spells.json"], ["2024", "spells-2024.json"]]) {
    assert.deepEqual(CONC[ed], data(f).filter((s) => s.conc).map((s) => s.n.toLowerCase()).sort(), ed);
  }
});

test("concentratie per editie", () => {
  // 2014: de oude handlijst had Enthrall/Forcecage onterecht en miste o.a. Hideous Laughter, Spike Growth, Vampiric Touch
  for (const n of ["enthrall", "forcecage", "sleep", "spiritual weapon", "fireball", "Toll the Dead"]) assert.equal(isConc(n, "2014"), false, n);
  for (const n of ["hideous laughter", "Tasha's Hideous Laughter", "spike growth", "vampiric touch", "barkskin", "web", "Bigby's Hand", "Evard's Black Tentacles", "hex", "witch bolt"]) assert.equal(isConc(n, "2014"), true, n);
  for (const n of ["barkskin", "divine favor", "magic weapon", "true strike", "animal shapes"]) assert.equal(isConc(n, "2024"), false, n);
  for (const n of ["sleep", "spiritual weapon", "enthrall", "forcecage", "hex", "hold person"]) assert.equal(isConc(n, "2024"), true, n);
  assert.equal(isConc("barkskin"), true, "standaard 2014");
  // slot-menu volgt de spellregels
  const c = mon("Druid", { casting: { slots: [{ lvl: 1, max: 4, left: 4, spells: "sleep, entangle" }, { lvl: 2, max: 3, left: 3, spells: "barkskin*, spiritual weapon" }], daily: [] } });
  assert.deepEqual(spellsAtLevel(c, 2, "2014").map((x) => x.conc), [true, false]);
  assert.deepEqual(spellsAtLevel(c, 2, "2024").map((x) => x.conc), [false, true]);
  assert.deepEqual(pickList(c, 2, "2024").map((x) => x.n), ["barkskin", "spiritual weapon", "sleep", "entangle"]);
  assert.deepEqual(pickList(c, 2, "2014").map((x) => x.n), ["barkskin", "spiritual weapon", "entangle"]);
});

test("presets volgens de spellregels: zelfde index, Barkskin 17 zonder concentratie", () => {
  assert.equal(presetsFor("2014"), PRESETS);
  const P24 = presetsFor("2024");
  assert.deepEqual(P24.map((p) => p.n), PRESETS.map((p) => p.n));
  const bk = P24.find((p) => p.n === "Barkskin");
  assert.equal(bk.v, 17); assert.equal(bk.conc, false); assert.equal(bk.ed, "2024");
  assert.equal(PRESETS.find((p) => p.n === "Barkskin").v, 16, "2014 blijft");
  assert.equal(P24.find((p) => p.n === "Bless").ed, undefined, "ongewijzigd = geen 2024-tag");
});

test("Haste voorbij: 2014 = Lethargy-effect; 2024 = Incapacitated + Lethargy, concentratie weg; lopend effect houdt zijn regels", () => {
  const H14 = PRESETS.find((p) => p.n === "Haste"), H24 = presetsFor("2024").find((p) => p.n === "Haste");
  const a = pc("Ayla"); startConc(a, "Bless");
  addEffect(a, H14, null);
  removeEffect(a, a.eff[0].id, "concentratie voorbij", { active: "X" });
  assert.deepEqual(a.eff.map((e) => e.n), ["Lethargy"]); assert.ok(!a.cond.includes("Incapacitated")); assert.ok(a.cond.includes("Concentrating"));

  const b = pc("Brann"); startConc(b, "Bless");
  addEffect(b, H24, null);
  assert.deepEqual(b.eff[0].af, { n: "Lethargy", txt: "speed 0", cond: "Incapacitated" });
  const r = removeEffect(b, b.eff[0].id, "concentratie voorbij", { active: "X" });
  assert.deepEqual(b.eff.map((e) => e.n), ["Lethargy"]);
  assert.ok(b.cond.includes("Incapacitated")); assert.ok(!b.cond.includes("Concentrating"), "Incapacitated breekt concentratie");
  assert.deepEqual(b.cd.Incapacitated, { kind: "tend", who: "Brann", at: "end", count: 1 });
  assert.match(r.msgs.join(" "), /Incapacitated \+ speed 0 tot einde volgende beurt/);
  assert.match(r.msgs.join(" "), /concentratie op Bless verbroken/);
  // midden in de eigen beurt: t/m einde van de volgende
  const c = pc("Cora"); addEffect(c, H24, null); removeEffect(c, c.eff[0].id, "x", { active: "Cora" });
  assert.equal(c.cd.Incapacitated.count, 2);
  // al Incapacitated (bv. door Sleep): duur niet overschrijven
  const d = pc("Dax", { cond: ["Incapacitated"], cd: { Incapacitated: { kind: "inf", who: "Dax", at: "start", count: 0 } } });
  addEffect(d, H24, null); removeEffect(d, d.eff[0].id, "x");
  assert.equal(d.cd.Incapacitated.kind, "inf");
  // Incapacitated en Lethargy verlopen samen aan het einde van de volgende beurt
  const S = { list: [b, mon("Goblin", { init: 5 })], round: 1, active: "Goblin", log: [] };
  step(S, 1); assert.equal(S.active, "Brann"); assert.ok(b.cond.includes("Incapacitated"));
  step(S, 1); assert.ok(!b.cond.includes("Incapacitated")); assert.equal(b.eff.length, 0);
  // oude opslag zonder `af` (vóór 1.21.0): 2014-gedrag
  const e = pc("Eli", { eff: [{ id: "h", n: "Haste", st: "ac", op: "+", v: 2, txt: "", d: null, lr: false, by: null, spell: null, hpd: 0 }] });
  removeEffect(e, "h", "x"); assert.deepEqual(e.eff.map((x) => x.n), ["Lethargy"]); assert.ok(!e.cond.includes("Incapacitated"));
});

test("Sleep (2024): alleen bij 2024; gefaald = Incapacitated met herhaalsave, 2e keer Unconscious; schade maakt wakker", () => {
  const sl = SP("Sleep");
  assert.equal(spellFor(sl, "2014"), false); assert.equal(spellFor(sl, "2024"), true); assert.equal(spellFor(SP("Bless"), "2014"), true);
  const wiz = pc("Elara"), g1 = mon("G1"), g2 = mon("G2"), g3 = mon("G3"), list = [wiz, g1, g2, g3];
  startConc(g2, "Hex"); // monster dat zelf concentreert: Incapacitated breekt dat
  const r = castSpell(list, sl, wiz, [pick(g1), pick(g2), pick(g3, { ok: true })], { round: 1, active: "Elara", dc: "14", ed: "2024" });
  assert.deepEqual(r.hit, ["G1", "G2"]); assert.equal(wiz.concSpell, "Sleep");
  assert.deepEqual(g1.cond, ["Incapacitated"]);
  assert.deepEqual(g1.cd.Incapacitated, { kind: "inf", save: { ab: "WIS", dc: 14 }, brk: 1, then: "Unconscious", by: "Elara", spell: "Sleep", cast: "1:Elara" });
  assert.ok(!g2.cond.includes("Concentrating"));
  const S = { list, saves: [] };
  // G1 faalt de tweede save → Unconscious, zonder herhaalsave, gekoppeld aan de caster, vervalt bij schade
  turnSaves(S, "G1"); resolveSave(S, S.saves[0].sid, false);
  assert.deepEqual(g1.cond, ["Unconscious"]);
  assert.deepEqual(g1.cd.Unconscious, { kind: "inf", who: "G1", at: "start", count: 0, brk: 1, by: "Elara", spell: "Sleep", cast: "1:Elara" });
  // G2 slaagt → alles weg
  turnSaves(S, "G2"); resolveSave(S, S.saves.find((s) => s.id === "G2").sid, true);
  assert.deepEqual(g2.cond, []);
  // schade maakt wakker; daarna gewoon schade
  const d = applyDamage(g1, 5);
  assert.deepEqual(g1.cond, []); assert.equal(g1.cd.Unconscious, undefined); assert.equal(g1.hp, 22);
  assert.match(d.msgs.join(" "), /G1: Unconscious weg door schade \(Sleep\)/);
  // geen schade (immuun, ×0) = blijft slapen
  const g4 = mon("G4", { cond: ["Unconscious"], cd: { Unconscious: { kind: "inf", who: "G4", at: "start", count: 0, brk: 1 } } });
  applyDamage(g4, 8, 0); assert.deepEqual(g4.cond, ["Unconscious"]);
  // wie immuun is voor exhaustion slaagt vanzelf (Lich); speler op 0 HP wordt na wakker worden toch bewusteloos door de 0 HP
  const lich = { n: "Lich", x: [["Condition Immunities", "charmed, exhaustion, frightened, paralyzed, poisoned"]] };
  const L = mon("Lich");
  assert.equal(spellDefault(sl, wiz, L, lich).immune, true);
  assert.deepEqual(spellDefault(sl, wiz, L, lich).tags, ["immuun exhaustion"]);
  const r2 = castSpell([wiz, L], sl, wiz, [{ ...pick(L), m: lich }], { round: 2, active: "Elara", dc: "14", ed: "2024" });
  assert.deepEqual(r2.immune, ["Lich"]); assert.deepEqual(L.cond, []);
  const p0 = pc("Pim", { hp: 3, cond: ["Unconscious"], cd: { Unconscious: { kind: "inf", who: "Pim", at: "start", count: 0, brk: 1, spell: "Sleep" } } });
  applyDamage(p0, 10); assert.ok(p0.cond.includes("Unconscious")); assert.equal(p0.hp, 0); assert.equal(p0.cd.Unconscious, undefined);
});

test("Hypnotic Pattern vervalt bij schade (beide edities); Web duurt zolang de concentratie", () => {
  const bard = pc("Bard"), o = mon("Orc"), list = [bard, o];
  castSpell(list, SP("Hypnotic Pattern"), bard, [pick(o)], { round: 1, active: "Bard", dc: "15" });
  assert.deepEqual(o.cond, ["Charmed", "Incapacitated"]);
  const d = applyDamage(o, 4, 1);
  assert.deepEqual(o.cond, []);
  assert.match(d.msgs.join(" "), /Charmed \+ Incapacitated weg door schade \(Hypnotic Pattern\)/);
  const w = mon("W"); castSpell([bard, w], SP("Web"), bard, [pick(w)], { round: 3, active: "Bard", dc: "15" });
  assert.equal(w.cd.Restrained.kind, "inf"); assert.equal(w.cd.Restrained.spell, "Web");
  // starten en een ronde verder: blijft (2014 SRD: concentratie tot 1 uur, niet 1 minuut)
  const S = { list: [bard, w], log: [] }; startCombat(S);
  for (let i = 0; i < 30; i++) step(S, 1);
  assert.ok(w.cond.includes("Restrained"));
});

test("import houdt vervolg en 'vervalt bij schade' vast en schoont ze op", () => {
  const c = cleanCombatant({ id: "a", name: "A", kind: "monster", cond: ["Incapacitated"], hp: 5, max: 5,
    cd: { Incapacitated: { kind: "tend", who: "a", at: "end", count: 1, save: { ab: "WIS", dc: 14 }, brk: 1, then: "Unconscious", by: "w", spell: "Sleep", cast: "1:w" } },
    eff: [{ id: "h", n: "Haste", st: "ac", op: "+", v: 2, af: { n: "Lethargy", txt: "speed 0", cond: "Incapacitated" } }, { id: "x", n: "Haste", af: { n: "L", cond: "<b>" } }] });
  assert.equal(c.cd.Incapacitated.brk, 1); assert.equal(c.cd.Incapacitated.then, "Unconscious");
  assert.deepEqual(c.eff[0].af, { n: "Lethargy", txt: "speed 0", cond: "Incapacitated" });
  assert.deepEqual(c.eff[1].af, { n: "L", txt: "" }, "onbekende conditie valt weg");
  const cc = cleanCombatant({ id: "c", name: "C", kind: "monster", cond: ["Charmed"], hp: 1, max: 1, cd: { Charmed: { kind: "inf", then: "Concentrating" } }, eff: [{ id: "y", n: "H", af: { n: "L", cond: "Concentrating" } }] });
  assert.equal(cc.cd.Charmed.then, undefined); assert.deepEqual(cc.eff[0].af, { n: "L", txt: "" }, "Concentrating is geen vervolg");
  const bad = cleanCombatant({ id: "b", name: "B", kind: "monster", cond: [], cd: {}, hp: 1, max: 1 });
  assert.deepEqual(bad.cd, {});
});

test("review 1.21.0: speler op 0 HP blijft Unconscious; crit op 0 HP maakt ook wakker; Haste 2024-vervolg breekt ook de effecten van het doelwit", async () => {
  const { endConcConds } = await import("../js/rules/spellcast.js");
  const { atkDamage } = await import("../js/rules/attacks.js");
  const { endConcEffects } = await import("../js/rules/effects.js");
  const sleepCd = (id) => ({ kind: "inf", who: id, at: "start", count: 0, brk: 1, by: "E", spell: "Sleep", cast: "1:E" });
  // speler slaapt (Sleep 2024 fase 2) en ligt op 0 HP: schade haalt de koppeling weg, Unconscious blijft
  const p = pc("P", { hp: 0, ds: { s: 0, f: 0, stable: false, dead: false }, cond: ["Unconscious"], cd: { Unconscious: sleepCd("P") } });
  applyDamage(p, 3);
  assert.deepEqual(p.cond, ["Unconscious"]); assert.equal(p.cd.Unconscious, undefined); assert.equal(p.ds.f, 1);
  // concentratie van de caster voorbij: speler op 0 HP blijft bewusteloos
  const q = pc("Q", { hp: 0, ds: { s: 0, f: 0, stable: false, dead: false }, cond: ["Unconscious"], cd: { Unconscious: sleepCd("Q") } });
  endConcConds([q, pc("E")]);
  assert.deepEqual(q.cond, ["Unconscious"]); assert.equal(q.cd.Unconscious, undefined);
  // crit op een speler op 0 HP (eigen pad in atkDamage): Hypnotic Pattern vervalt ook, twee failures
  const r = pc("R", { hp: 0, ds: { s: 0, f: 0, stable: false, dead: false }, cond: ["Unconscious", "Charmed"], cd: { Charmed: { kind: "rounds", who: "E", at: "start", count: 9, brk: 1, spell: "Hypnotic Pattern" } } });
  atkDamage(r, { dealt: 4, crit: true });
  assert.deepEqual(r.cond, ["Unconscious"]); assert.equal(r.ds.f, 2);
  // keten: A concentreert op Haste (op B, 2024); B concentreert op Bless (op C). A verliest concentratie →
  // B Incapacitated → B's concentratie weg → Bless op C weg, in dezelfde stap
  const A = pc("A"), B = pc("B"), C = pc("C");
  startConc(A, "Haste"); startConc(B, "Bless");
  addEffect(C, PRESETS.find((x) => x.n === "Bless"), null, { by: "B", spell: "Bless" });
  addEffect(B, presetsFor("2024").find((x) => x.n === "Haste"), null, { by: "A", spell: "Haste" });
  A.cond = []; A.concSpell = null;
  endConcEffects([A, B, C]);
  assert.ok(B.cond.includes("Incapacitated")); assert.deepEqual(C.eff, []);
});

test("Sleep 2024: tweede save vergeten = Incapacitated blijft en de save komt de volgende beurt terug", () => {
  const wiz = pc("Elara", { init: 20 }), g = mon("G", { init: 5 }), S = { list: [wiz, g], log: [], saves: [] };
  startCombat(S);
  castSpell(S.list, SP("Sleep"), wiz, [pick(g)], { round: 1, active: "Elara", dc: "14", ed: "2024" });
  for (let i = 0; i < 4; i++) step(S, 1); // twee volle rondes zonder de save te rollen
  assert.ok(g.cond.includes("Incapacitated"));
  turnSaves(S, "G");
  assert.ok(S.saves.some((s) => s.id === "G" && s.n === "Incapacitated"));
});

test("rekent de app anders per editie? Alleen dan de regel 'Ter vergelijking' in het spell-paneel", () => {
  for (const n of ["Barkskin", "Haste", "Sleep", "Spiritual Weapon", "magic weapon", "True Strike", "Enthrall"]) assert.equal(rulesDiffer(n), true, n);
  for (const n of ["Fireball", "Bless", "Hold Person", "Hex", "Shield", "Feeblemind", "Befuddlement", "Toll the Dead", ""]) assert.equal(rulesDiffer(n), false, n);
});

test("D&D Beyond: editie per spell uit de bronnen (zelfde regel als ddb-importer)", () => {
  assert.equal(spellEd({ sources: [{ sourceId: 1 }] }), "2014"); // PHB 2014
  assert.equal(spellEd({ sources: [{ sourceId: 2 }, { sourceId: 27 }] }), "2014");
  assert.equal(spellEd({ sources: [{ sourceId: 145 }] }), "2024"); // PHB 2024
  assert.equal(spellEd({ sources: [{ sourceId: 1 }, { sourceId: 145 }] }), "2024", "een 2024-bron = 2024");
  assert.equal(spellEd({ sources: [{ sourceId: 150 }] }), "2014", "later 2014-boek");
  assert.equal(spellEd({ sources: [{ sourceId: 200 }] }), "2024");
  assert.equal(spellEd({ sources: [], isLegacy: true }), "2014");
  assert.equal(spellEd({ sources: [] }), "");
  assert.equal(spellEd({ sources: [{ sourceId: "x" }, null] }), "");
  assert.equal(spellEd(null), "");
});

test("editie per caster: sheet van de speler, anders de instelling", () => {
  const druid = pc("Druid", { sheet: { levels: [{ lvl: 2, spells: [{ n: "Barkskin", ed: "2024" }, { n: "Tasha's Hideous Laughter", ed: "2014" }, { n: "Moonbeam" }] }] } });
  assert.equal(sheetEd(druid, "barkskin"), "2024");
  assert.equal(sheetEd(druid, "Hideous Laughter"), "2014", "alias / bezitsvorm");
  assert.equal(sheetEd(druid, "Moonbeam"), "", "zonder editie op de sheet");
  assert.equal(sheetEd(druid, "Haste"), "", "niet op de sheet");
  assert.equal(edFor(druid, "Barkskin", "2014"), "2024");
  assert.equal(edFor(druid, "Haste", "2014"), "2014");
  assert.equal(edFor(druid, "Moonbeam", "2024"), "2024");
  assert.equal(edFor(mon("Mage", { sheet: druid.sheet }), "Barkskin", "2014"), "2014", "monsters volgen de instelling");
  assert.equal(edFor(null, "Barkskin", "2024"), "2024");
  assert.equal(edFor(pc("X", { sheet: { levels: "kapot" } }), "Barkskin", "2014"), "2014");
  // Barkskin via de sheet-editie: 2024 = AC 17 zonder concentratie
  const p = presetsFor(edFor(druid, "Barkskin", "2014")).find((x) => x.n === "Barkskin");
  assert.equal(p.v, 17); assert.equal(p.conc, false);
  // import houdt de editie per sheet-spell, rare waarden vallen weg
  const c = cleanCombatant({ id: "d", name: "D", kind: "pc", cond: [], hp: 5, max: 5, sheet: { levels: [{ lvl: 2, max: 3, spells: [{ n: "Barkskin", ed: "2024" }, { n: "Web", ed: "<b>" }] }] } });
  assert.equal(c.sheet.levels[0].spells[0].ed, "2024"); assert.equal(c.sheet.levels[0].spells[1].ed, undefined);
});

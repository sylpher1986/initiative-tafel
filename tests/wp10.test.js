// WP10: monsterregels (RE13) en de multiattack-volgorde (GV11)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasUF, ufDc, ufNeed, ufApply, ufInfo, monSave, parseRider, riderWhat, riderImmune, riderFor, riderOutcome, applyRider, parryOf, canParry, useParry } from "../js/rules/monrules.js";
import { addSave, openSaves, resolveSave, tickSaves, label } from "../js/rules/saves.js";
import { monsterActions, multiSeq, seqAfter } from "../js/rules/attacks.js";
import { applyDamage, startConc } from "../js/rules/combat.js";

const SRD = JSON.parse(readFileSync(new URL("../data/monsters.json", import.meta.url)));
const M = (n) => SRD.find((m) => m.n === n);
const act = (n, a) => M(n).a.find(([k]) => k === a)[1];
const mon = (o = {}) => ({ id: "m", name: "Zombie", kind: "monster", init: 10, hp: 22, max: 22, cond: [], ...o });
const pc = (o = {}) => ({ id: "p", name: "Ayla", kind: "pc", init: 15, hp: 30, max: 30, cond: [], ...o });

test("RE13: Undead Fortitude alleen bij de trait, bij 0 HP door schade, niet bij radiant of crit", () => {
  const z = M("Zombie");
  assert.ok(hasUF(z) && hasUF(M("Ogre Zombie")) && !hasUF(M("Goblin")));
  const c = mon(); applyDamage(c, 25, 1, true);
  assert.equal(c.hp, 0);
  assert.deepEqual(ufNeed(c, z, 22, 25), { dc: 30 });
  assert.equal(ufDc(14), 19);
  assert.deepEqual(ufNeed(c, z, 22, 25, { radiant: true }), { skip: "radiant" });
  assert.deepEqual(ufNeed(c, z, 22, 25, { crit: true }), { skip: "kritiek" });
  assert.deepEqual(ufNeed(c, z, 22, 25, { radiant: true, why: "radiant of kritiek" }), { skip: "radiant of kritiek" });
  assert.equal(ufNeed(c, z, 0, 5), null, "stond al op 0");
  assert.equal(ufNeed(mon({ hp: 3 }), z, 10, 7), null, "niet op 0");
  assert.equal(ufNeed(c, M("Goblin"), 22, 25), null);
  assert.equal(ufNeed(pc({ hp: 0 }), z, 5, 5), null, "alleen monsters");
});

test("RE13: Undead Fortitude geslaagd = 1 HP, gefaald = neer; logoorzaak", () => {
  const c = mon({ hp: 0 });
  let r = ufApply(c, { dc: 12 }, { tot: 14 }, "d20 [11] +3 = 14");
  assert.equal(c.hp, 1); assert.equal(r.ok, true);
  assert.equal(r.txt, "Undead Fortitude CON 12: d20 [11] +3 = 14, blijft op 1 HP");
  assert.equal(r.why[0].id, "m");
  const d = mon({ hp: 0 });
  r = ufApply(d, { dc: 19 }, { tot: 8 }, "d20 [5] +3 = 8");
  assert.equal(d.hp, 0); assert.match(r.txt, /, neer$/);
  r = ufApply(d, { skip: "radiant" });
  assert.equal(r.txt, "geen Undead Fortitude (radiant)");
});

test("RE13: save-riders uit SRD-aanvallen", () => {
  const w = parseRider(act("Wolf", "Bite"));
  assert.deepEqual({ ab: w.ab, dc: w.dc, conds: w.conds, dmg: w.dmg, rep: w.rep }, { ab: "STR", dc: 11, conds: ["Prone"], dmg: null, rep: false });
  assert.equal(riderWhat(w), "of Prone");
  const g = parseRider(act("Ghoul", "Claws"));
  assert.deepEqual([g.ab, g.dc, g.conds, g.dur, g.rep], ["CON", 10, ["Paralyzed"], "r10", true]);
  assert.match(g.only, /other than an elf or undead/);
  const s = parseRider(act("Giant Spider", "Bite"));
  assert.deepEqual(s.dmg, { e: "2d8", type: "poison", half: true });
  assert.deepEqual(s.conds, []);
  assert.deepEqual(parseRider(act("Spider", "Bite")).dmg, { e: "1d4", type: "poison", half: false });
  const q = parseRider(act("Quasit", "Claw (Bite in Beast Form)"));
  assert.deepEqual([q.dmg.e, q.conds], ["2d4", ["Poisoned"]]);
  const wi = parseRider(act("Wight", "Life Drain"));
  assert.deepEqual([wi.conds, wi.dmg], [[], null]);
  assert.match(wi.note, /max HP daalt/);
  assert.match(parseRider(act("Werewolf", "Bite (Wolf or Hybrid Form Only)")).note, /ziekte of vloek/);
  assert.equal(parseRider(act("Goblin", "Scimitar")), null, "geen DC");
  assert.equal(parseRider("Each creature in a 15-foot cone must make a DC 13 Dexterity saving throw"), null, "geen Hit: geen rider");
  let n = 0; for (const m of SRD) for (const [, v] of m.a) if (parseRider(v)) n++;
  assert.ok(n >= 60, `riders in de SRD: ${n}`);
});

test("RE13: rider toepassen: Prone, Paralyzed met duur en herhaalsave, schade (half, resist)", () => {
  const p = pc({ cond: ["Concentrating"], concSpell: "Bless" });
  let f = applyRider(p, { ...parseRider(act("Wolf", "Bite")), n: "Bite" }, false, "w");
  assert.deepEqual(p.cond, ["Concentrating", "Prone"]);
  assert.ok(!p.cd || !p.cd.Prone, "Prone zonder duur");
  assert.match(f.why[0].t, /Bite STR 11: save gefaald/);
  const g = pc({ cond: ["Concentrating"], concSpell: "Bless" });
  f = applyRider(g, { ...parseRider(act("Ghoul", "Claws")), n: "Claws" }, false, "gh");
  assert.ok(g.cond.includes("Paralyzed") && !g.cond.includes("Concentrating"), "Paralyzed breekt concentratie");
  assert.deepEqual(g.cd.Paralyzed, { kind: "rounds", who: "gh", at: "start", count: 10, save: { ab: "CON", dc: 10 } });
  const ok = pc();
  applyRider(ok, { ...parseRider(act("Ghoul", "Claws")), n: "Claws" }, true, "gh");
  assert.deepEqual(ok.cond, []);
  const sp = pc(), rd = { ...parseRider(act("Giant Spider", "Bite")), n: "Bite", roll: { total: 9, txt: "2d8 [4, 5] = 9 poison" }, mode: 1 };
  applyRider(sp, rd, true, "s"); assert.equal(sp.hp, 26, "half naar beneden");
  applyRider(sp, rd, false, "s"); assert.equal(sp.hp, 17);
  const res = pc(); applyRider(res, { ...rd, mode: 0.5 }, false, "s"); assert.equal(res.hp, 26, "resistance tegen poison");
  const con = pc({ cond: ["Concentrating"], concSpell: "Bless" });
  f = applyRider(con, rd, false, "s");
  assert.deepEqual(f.saves.map((s) => s.dc), [10], "rider-schade = concentration save");
});

test("RE13: rider immuun via Condition Immunities", () => {
  const w = parseRider(act("Wolf", "Bite"));
  assert.equal(riderImmune(w, { x: [["Condition Immunities", "exhaustion, prone"]] }), true);
  assert.equal(riderImmune(w, M("Goblin")), false);
  assert.equal(riderImmune(parseRider(act("Giant Spider", "Bite")), { x: [["Condition Immunities", "poisoned"]] }), false, "schade blijft");
});

test("RE13: rider als open save in de beurtbalk", () => {
  const S = { list: [pc(), mon({ id: "w", name: "Wolf" })], round: 1, active: "w" };
  const rd = { ...parseRider(act("Ghoul", "Claws")), by: "w" };
  addSave(S, { id: "p", kind: "rider", n: "Claws", ab: "CON", dc: 10, rd });
  const s = openSaves(S)[0];
  assert.equal(label(s), "CON-save DC 10 (Claws)");
  resolveSave(S, s.sid, false);
  assert.ok(S.list[0].cond.includes("Paralyzed"));
  assert.equal(S.list[0].cd.Paralyzed.save.dc, 10);
  addSave(S, { id: "p", kind: "rider", n: "Bite", ab: "STR", dc: 11, rd: { ...parseRider(act("Wolf", "Bite")) } });
  tickSaves(S); const r = tickSaves(S);
  assert.ok(r.msgs.includes("Save vervallen zonder uitslag: Ayla STR 11 · Bite: geen gevolg"));
  assert.ok(!S.list[0].cond.includes("Prone"));
});

test("RE13: Parry uit de reactions; niet met gebruikte reaction, verrast of incapacitated", () => {
  assert.equal(parryOf(M("Knight")), 2);
  assert.equal(parryOf(M("Gladiator")), 3);
  assert.equal(parryOf(M("Marilith")), 5);
  assert.equal(parryOf(M("Goblin")), 0);
  const k = mon({ name: "Knight", hp: 52, max: 52 });
  assert.ok(canParry(k, 2));
  assert.ok(!canParry({ ...k, reaction: true }, 2));
  assert.ok(!canParry({ ...k, sur: true }, 1) && canParry({ ...k, sur: true }, 2));
  assert.ok(canParry({ ...k, sur: 2 }, 1), "verrast-beurt al voorbij (sur = 2): mag weer reageren");
  assert.ok(!canParry({ ...k, cond: ["Stunned"] }, 2));
  assert.ok(!canParry({ ...k, hp: 0 }, 2));
  const f = useParry(k, 2);
  assert.equal(k.reaction, true);
  assert.match(f.why[0].t, /Parry \(\+2 AC\)/);
});

test("GV11: volgorde uit de Multiattack", () => {
  const seq = (n) => multiSeq(monsterActions(M(n)));
  assert.deepEqual(seq("Adult Red Dragon"), ["Bite", "Claw", "Claw"]);
  assert.deepEqual(seq("Bandit Captain"), ["Scimitar", "Scimitar", "Dagger"]);
  assert.deepEqual(seq("Centaur"), ["Pike", "Hooves"], "alleen het eerste alternatief");
  assert.deepEqual(seq("Aboleth"), ["Tentacle", "Tentacle", "Tentacle"]);
  assert.deepEqual(seq("Knight"), ["Greatsword", "Greatsword"], "melee = de enige melee-aanval");
  assert.equal(seq("Goblin"), null, "geen multiattack");
  assert.equal(seq("Hydra"), null, "onleesbaar");
  assert.deepEqual(seqAfter(["Bite", "Claw", "Claw"], "Claw"), ["Bite", "Claw"], "beginnen bij Claw");
  assert.deepEqual(seqAfter(["Bite", "Claw", "Claw"], "Bite"), ["Claw", "Claw"]);
  assert.equal(seqAfter(["Bite", "Claw"], "Tail"), null);
  assert.equal(seqAfter(null, "Bite"), null);
});

test("RE13: riderFor: neer, dood, automatisch falen, immuun, n.v.t.", () => {
  const w = parseRider(act("Wolf", "Bite")), g = parseRider(act("Ghoul", "Claws")), sp = parseRider(act("Giant Spider", "Bite"));
  const p = pc();
  assert.deepEqual(riderFor(w, p, null, pc({ hp: 20 })), { rd: w, act: true, immune: false, auto: null, choice: null });
  assert.equal(riderFor(w, p, null, pc({ hp: 20 }), "na").choice, "na");
  assert.equal(riderFor(w, p, null, pc({ hp: 0 })), null, "bewusteloos = al prone");
  assert.equal(riderFor(sp, p, null, pc({ hp: 0, ds: { dead: true } })), null, "gestorven");
  assert.equal(riderFor(g, p, null, pc({ hp: 0 })).choice, null, "CON faalt niet vanzelf");
  const pr = parseRider(act("Purple Worm", "Bite")); // DEX, alleen herinnering
  assert.equal(riderFor(pr, p, null, pc({ hp: 0 })).auto, null, "geen act: niets automatisch");
  const bash = { ...w, conds: ["Prone"] };
  const par = pc({ cond: ["Paralyzed"] });
  assert.equal(riderFor(bash, par, null, par).auto, "fail", "Paralyzed faalt STR vanzelf");
  const m = mon(); assert.equal(riderFor(w, m, null, mon({ hp: 0 })), null, "monster neer");
  assert.equal(riderFor(w, m, { x: [["Condition Immunities", "prone"]] }, m).immune, true);
});

test("RE13: riderOutcome, ufInfo, monSave", () => {
  const sp = parseRider(act("Giant Spider", "Bite")), w = parseRider(act("Wolf", "Bite"));
  assert.equal(riderOutcome(w, false, 0), "Prone");
  assert.equal(riderOutcome(w, true, 0), "geen gevolg");
  assert.equal(riderOutcome(sp, true, 4), "half: −4 poison");
  assert.equal(riderOutcome(sp, false, 9), "−9 poison");
  assert.deepEqual(ufInfo({ crit: false, types: [{ type: "radiant", dealt: 5 }] }), { crit: false, radiant: true });
  assert.deepEqual(ufInfo({ crit: true, types: [{ type: "radiant", dealt: 0 }] }), { crit: true, radiant: false });
  const x = monSave(mon(), M("Zombie"), "CON", false, () => 0.5);
  assert.equal(x.bo, 3); assert.equal(x.tot, 14);
});

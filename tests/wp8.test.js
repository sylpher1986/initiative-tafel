import { test } from "node:test";
import assert from "node:assert/strict";
import { condInfo, CINFO, exhLevel, exhRows, exhSummary } from "../js/rules/conditions.js";
import { setExh, startRage, endRage, rageOf, barbLevel, rageDmg, rageRes, effName, removeEffect, endFightEffects, baseMax } from "../js/rules/effects.js";
import { restMember, applyDamage, startConc, setMax } from "../js/rules/combat.js";
import { addEffect, PRESETS } from "../js/rules/effects.js";
import { step, startCombat } from "../js/rules/turns.js";
import { targetMode, rollSave, rollText, saveAdv } from "../js/rules/aoe.js";
import { atkAdv } from "../js/rules/attacks.js";
import { CONDS, makeDur } from "../js/rules/turns.js";
import { cleanCombatant } from "../js/backup.js";

const pc = (o = {}) => ({ id: "b", name: "Brom", kind: "pc", init: 15, dex: 2, ac: 14, hp: 40, max: 40, cond: [], ...o });
const gob = (o = {}) => ({ id: "g", name: "Goblin", kind: "monster", init: 12, dex: 2, ac: 15, hp: 7, max: 7, cond: [], ...o });
const seq = (...a) => () => (a.shift() - 1) / 20; // d20-worpen

test("RE10: elke conditie uit het raster heeft uitleg, Exhaustion met de niveaus", () => {
  for (const k of CONDS) assert.ok(CINFO[k] && CINFO[k].length >= 1 && CINFO[k].length <= 3, k);
  assert.ok(condInfo("Verrast"));
  assert.equal(condInfo("Onbekend"), null);
  const e = condInfo("Exhaustion", 3);
  assert.equal(e.name, "Exhaustion 3");
  assert.deepEqual(e.lines.slice(0, 3), ["1 Disadvantage op ability checks", "2 Speed gehalveerd", "3 Disadvantage op aanvallen en saves"]);
  assert.equal(exhRows(0).length, 0); assert.equal(exhRows(9).length, 6);
});

test("RE11: niveau zetten, max HP ½ vanaf 4 en terug, chipnaam", () => {
  const c = pc();
  setExh(c, 2);
  assert.equal(exhLevel(c), 2); assert.equal(c.max, 40); assert.equal(effName(c.eff[0]), "Exhaustion 2");
  setExh(c, 4);
  assert.equal(exhLevel(c), 4); assert.equal(c.max, 20); assert.equal(c.hp, 20); assert.equal(baseMax(c), 40);
  assert.equal(c.eff.length, 1, "één effect, niet gestapeld");
  setExh(c, 3);
  assert.equal(c.max, 40); assert.equal(c.hp, 20, "HP komt niet vanzelf terug");
  const r = setExh(c, 0);
  assert.equal(exhLevel(c), 0); assert.equal(c.eff.length, 0); assert.match(r.msgs[0], /Exhaustion voorbij/);
  assert.equal(setExh(c, 0).why.length, 0, "zelfde niveau: niets");
  const odd = pc({ hp: 31, max: 31 }); setExh(odd, 4);
  assert.equal(odd.max, 15, "PHB: gehalveerd, naar beneden afgerond");
});

test("RE11: niveau 6 = dood (speler 3 failures, monster neer), concentratie weg", () => {
  const c = pc({ cond: ["Concentrating"], concSpell: "Bless" });
  const r = setExh(c, 6);
  assert.equal(c.hp, 0); assert.ok(c.ds.dead); assert.ok(c.cond.includes("Unconscious")); assert.ok(!c.cond.includes("Concentrating"));
  assert.match(r.msgs.join(" "), /sterft: Exhaustion 6/);
  const g = gob(); setExh(g, 6);
  assert.equal(g.hp, 0);
  assert.equal(setExh(gob({ hp: 0 }), 6).msgs.some((m) => /sterft/.test(m)), false, "al neer: geen tweede sterfmelding");
});

test("RE11: long rest = één niveau minder, ook de max HP volgt; andere effecten weg", () => {
  const c = pc();
  setExh(c, 4);
  c.eff.push({ id: "x", n: "Bless", st: "", v: 0 });
  restMember(c, true);
  assert.equal(exhLevel(c), 3); assert.equal(c.max, 40); assert.equal(c.hp, 40); assert.equal(c.eff.length, 1);
  setExh(c, 5); restMember(c, true);
  assert.equal(exhLevel(c), 4); assert.equal(c.max, 20); assert.equal(c.hp, 20);
  setExh(c, 1); restMember(c, true);
  assert.equal(exhLevel(c), 0); assert.equal(c.max, 40);
  restMember(c, false);
  assert.equal(exhLevel(c), 0, "short rest verandert niets");
});

test("RE11: aanvallen met disadvantage vanaf 3, saves van een monster ook", () => {
  const c = pc(), g = gob();
  setExh(c, 2);
  assert.equal(atkAdv(c, g).v, 0);
  setExh(c, 3);
  const a = atkAdv(c, g);
  assert.equal(a.v, -1); assert.deepEqual(a.dis, ["Brom Exhaustion 3"]);
  setExh(g, 3);
  assert.deepEqual(saveAdv(g, "DEX"), { v: -1, why: "Exhaustion 3" });
  assert.deepEqual(saveAdv(g, "DEX", true), { v: 0, why: "" }, "Magic Resistance heft op");
  const x = rollSave(2, -1, seq(15, 4), [], "Exhaustion 3");
  assert.equal(x.tot, 6); assert.match(rollText(x, 10), /\[15, 4\] \+2 = 6 ✗ \(disadvantage: Exhaustion 3\)/);
  const y = rollSave(2, true, seq(4, 15));
  assert.equal(y.tot, 17); assert.match(rollText(y, 10), /\(advantage: Magic Resistance\)/);
});

test("RE11: import houdt niveau (1–6) en halvering", () => {
  const c = pc(); setExh(c, 4);
  const back = cleanCombatant(JSON.parse(JSON.stringify(c)));
  assert.equal(exhLevel(back), 4); assert.equal(back.eff[0].hpd, -20);
  assert.equal(cleanCombatant({ ...pc(), eff: [{ n: "Exhaustion", x: 99 }] }).eff[0].x, 6);
});

test("RE16: rage geeft resistance B/P/S in AoE en aanvalspaneel, kwetsbaar + rage = normaal", () => {
  const c = pc({ res: [{ n: "Rage", left: 3, max: 3, rest: "Long Rest" }], cond: ["Concentrating"], concSpell: "x" });
  const r = startRage(c, makeDur(c, { dur: "r10" }, c.id));
  assert.ok(rageOf(c)); assert.equal(c.res[0].left, 2); assert.ok(!c.cond.includes("Concentrating"));
  assert.match(r.msgs.join(" "), /nog 2 van 3/);
  assert.equal(targetMode(c, null, "slashing").mode, 0.5);
  assert.equal(targetMode(c, null, "slashing").eff, 1);
  assert.equal(targetMode(c, null, "fire").mode, 1);
  c.dr = { v: ["piercing"], i: ["bludgeoning"] };
  assert.equal(targetMode(c, null, "piercing").mode, 1, "kwetsbaar + resistant = normaal");
  assert.equal(targetMode(c, null, "bludgeoning").mode, 0, "immuun blijft");
  assert.deepEqual(saveAdv(c, "STR"), { v: 1, why: "Rage" });
  assert.equal(saveAdv(c, "DEX").v, 0);
});

test("RE16: Bear Totem alles behalve psychic, geen resource = melding, 0 HP = kan niet", () => {
  const c = pc({ res: [{ n: "Rage", left: 0, max: 2 }] });
  const r = startRage(c, null, { bear: true });
  assert.equal(targetMode(c, null, "fire").mode, 0.5); assert.equal(targetMode(c, null, "psychic").mode, 1);
  assert.match(r.msgs.join(" "), /niets meer over/);
  const z = pc({ hp: 0 }); startRage(z, null);
  assert.equal(rageOf(z), null);
  const n = pc(); startRage(n, null);
  assert.equal(rageRes(n), null); assert.ok(rageOf(n), "zonder sheet-resource: gewoon starten");
});

test("RE16: rage voorbij bij bewusteloos; Frenzy geeft exhaustion, ook bij gevecht afronden", () => {
  const c = pc();
  startRage(c, makeDur(c, { dur: "r10" }, c.id), { frz: true });
  applyDamage(c, 100);
  const r = endRage([c]);
  assert.equal(rageOf(c), null); assert.equal(exhLevel(c), 1);
  assert.ok(r.why.some((w) => /bewusteloos/.test(w.t)));
  const f = pc();
  startRage(f, makeDur(f, { dur: "r10" }, f.id), { frz: true });
  endFightEffects([f]);
  assert.equal(exhLevel(f), 1, "Frenzy ook na afronden");
  const g = pc();
  startRage(g, makeDur(g, { dur: "r10" }, g.id));
  removeEffect(g, rageOf(g).id);
  assert.equal(exhLevel(g), 0, "zonder Frenzy geen exhaustion");
});

test("RE16: schade zet de markering voor 'rage loopt door'", () => {
  const c = pc();
  startRage(c, null);
  assert.ok(!rageOf(c).hit);
  applyDamage(c, 6);
  assert.equal(rageOf(c).hit, 1);
  const back = cleanCombatant(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(back.eff[0].rs, ["bludgeoning", "piercing", "slashing"]); assert.equal(back.eff[0].rg, 1); assert.equal(back.eff[0].hit, 1);
});

test("RE16: barbarian-level en rage damage", () => {
  assert.equal(barbLevel("Barbarian 5 / Fighter 2"), 5);
  assert.equal(barbLevel("Fighter 2 / Barbarian 11"), 11);
  assert.equal(barbLevel("Fighter 7"), null);
  assert.deepEqual([1, 8, 9, 15, 16, 20, null].map(rageDmg), [2, 2, 3, 3, 4, 4, null]);
});

import { deadlyTip } from "../js/rules/encounters.js";
import { toPlayerView, cleanView } from "../js/playerview.js";

test("AF8: advies bij Deadly", () => {
  const who = [3, 3, 3, 3].map((lvl, i) => ({ name: "P" + i, lvl }));
  const ogre = (n) => ({ name: "Ogre", n, cr: "2" }), gob = (n) => ({ name: "Goblin", n, cr: "1/4" });
  assert.equal(deadlyTip([ogre(2)], who), null, "Hard: geen advies");
  assert.deepEqual(deadlyTip([ogre(3)], who), { name: "Ogre", rating: 2 });
  assert.deepEqual(deadlyTip([ogre(2), gob(2)], who), { name: "Ogre", rating: 2 }, "goblin weg blijft Deadly, ogre weg = Hard");
  assert.deepEqual(deadlyTip([{ name: "Troll", n: 1, cr: "5" }], who), { one: true });
  assert.deepEqual(deadlyTip([ogre(12)], who), { stays: true });
  const list = [ogre(1), ogre(1), ogre(1)]; // listMons: één regel per monster
  assert.deepEqual(deadlyTip(list, who), { name: "Ogre", rating: 2 });
  assert.equal(list[0].n, 1, "invoer onaangeroerd");
});

test("RE10: snapshot geeft duur en herhaalsave per tag, zonder verborgen namen; cleanView houdt het parallel", () => {
  const hid = { id: "h", name: "Shadow Mage", kind: "monster", init: 20, dex: 0, hp: 10, max: 10, cond: [], hidden: true };
  const ana = { id: "a", name: "Bugbear", kind: "monster", init: 18, dex: 0, hp: 10, max: 10, cond: [], anon: 1 };
  const p = { id: "p", name: "Lotte", kind: "pc", init: 15, dex: 0, hp: 20, max: 20, cond: ["Restrained", "Prone", "Charmed"],
    cd: { Restrained: { kind: "rounds", who: "h", at: "start", count: 3, save: { ab: "STR", dc: 13 } }, Prone: { kind: "sstart", who: "h", at: "start", count: 1 }, Charmed: { kind: "sstart", who: "a", at: "start", count: 1 } }, eff: [] };
  const g = { id: "g", name: "Goblin", kind: "monster", init: 12, dex: 0, hp: 7, max: 7, cond: ["Poisoned"], cd: { Poisoned: { kind: "sstart", who: "p", at: "start", count: 1 } } };
  setExh(p, 2);
  const S = { list: [hid, ana, p, g], round: 1, active: "p" };
  const V = toPlayerView(S);
  const L = V.list.find((x) => x.id === "p");
  assert.deepEqual(L.tags, ["Restrained", "Prone", "Charmed", "Exhaustion 2"]);
  assert.deepEqual(L.td, [{ d: "nog 3 rondes", s: "STR DC 13 aan het einde van zijn beurt" }, { d: "t/m begin van een andere beurt" }, { d: "t/m begin van een andere beurt" }, null]);
  assert.deepEqual(V.list.find((x) => x.id === "g").td, [{ d: "t/m begin van de beurt van Lotte" }]);
  assert.ok(!JSON.stringify(V).includes("Shadow Mage") && !JSON.stringify(V).includes("Bugbear"), "geen verborgen/anonieme naam");
  const C = cleanView(JSON.parse(JSON.stringify(V)));
  assert.deepEqual(C.list.find((x) => x.id === "p").td, L.td);
  const bad = cleanView({ v: 1, list: [{ id: "x", kind: "pc", name: "X", tags: ["Prone"], td: [{ d: "a" }, { d: "b" }] }] });
  assert.equal(bad.list[0].td, undefined, "niet parallel: weg");
  const none = toPlayerView(S, () => "", { monHp: "status", init: false, tags: "none" });
  assert.equal(none.list.find((x) => x.id === "p").td, undefined, "Verbergen: niets mee");
});

test("RE11 (review): halvering loopt mee met Aid, bewerken en onbekende max HP", () => {
  const aid = PRESETS.find((p) => p.n === "Aid");
  const a = pc(); addEffect(a, aid, null); setExh(a, 4);
  assert.equal(a.max, 22, "(40 + 5) / 2");
  removeEffect(a, a.eff.find((e) => e.n === "Aid").id);
  assert.equal(a.max, 20, "Aid weg: 40 / 2");
  const b = pc(); setExh(b, 4); addEffect(b, aid, null);
  assert.equal(b.max, 22, "zelfde in de andere volgorde");
  const c = pc(); setExh(c, 4);
  setMax(c, 60 + (c.max - baseMax(c)));
  assert.equal(c.max, 30, "basis 40 → 60 bij Exhaustion 4");
  assert.equal(baseMax(c), 60);
  const m = gob({ hp: 0, max: 0 }); setExh(m, 4);
  assert.equal(m.max, 0);
  setMax(m, 40);
  assert.equal(m.max, 20, "max HP ingevuld: nu gehalveerd");
  assert.equal(exhSummary(5), "Niveau 5: disadvantage op checks · disadvantage op attacks en saves · max HP ½ · speed 0");
  assert.equal(exhSummary(0), "Niveau 0: geen exhaustion");
});

test("RE16 (review): geen rage als hij Unconscious of Incapacitated is", () => {
  const c = pc({ hp: 20, cond: ["Unconscious"], res: [{ n: "Rage", left: 2, max: 2 }] });
  const r = startRage(c, null, { frz: true });
  assert.equal(rageOf(c), null); assert.equal(c.res[0].left, 2); assert.match(r.msgs[0], /Unconscious/);
});

test("RE16 (review): einde beurt meldt 'loopt door', ‹ Vorige zet de schade-markering terug", () => {
  const b = pc({ init: 20 }), g = gob({ init: 10 });
  const S = { list: [b, g], round: 0, active: null };
  startCombat(S);
  assert.equal(S.active, "b");
  startRage(b, makeDur(b, { dur: "r10" }, "b"));
  applyDamage(b, 3);
  let o = step(S, 1);
  assert.ok(!o.msgs.some((m) => /loopt door/.test(m)), "geraakt: geen melding");
  assert.ok(!rageOf(b).hit, "markering gewist voor de volgende ronde");
  step(S, -1);
  assert.equal(rageOf(b).hit, 1, "terug in zijn beurt: markering terug");
  o = step(S, 1); o = step(S, 1);
  assert.equal(S.active, "b");
  o = step(S, 1);
  assert.ok(o.msgs.some((m) => /Rage Brom loopt door/.test(m)), "niet geraakt: melding");
});

// WP50 (G1): Exhaustion en Rage volgens de 2024-regels (SRD 5.2.1); 2014 onveranderd.
import { nl, nlw } from "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { exhLevel, exhEd, exhMod, exhSummary, exhRows } from "../js/rules/conditions.js";
import { setExh, startRage, rageOf, removeEffect, saveMods, addEffect } from "../js/rules/effects.js";
import { reExh, reExhAll, restMember, applyDamage, setMax } from "../js/rules/combat.js";
import { saveAdv, rollSave, rollText } from "../js/rules/aoe.js";
import { atkAdv, rollAttack, withAdv, atkMods, atkText, atkResult } from "../js/rules/attacks.js";
import { step, startCombat, makeDur, rerollMonsters } from "../js/rules/turns.js";
import { cleanCombatant, has2024 } from "../js/backup.js";

const pc = (o = {}) => ({ id: "b", name: "Brom", kind: "pc", init: 15, dex: 2, ac: 14, hp: 40, max: 40, cond: [], ...o });
const gob = (o = {}) => ({ id: "g", name: "Goblin", kind: "monster", init: 12, dex: 2, ac: 15, hp: 7, max: 7, cond: [], ...o });
const seq = (...a) => () => (a.shift() - 1) / 20; // d20-worpen

test("WP50: Exhaustion 4 halveert max HP onder 2014, niet onder 2024", () => {
  const a = pc(); setExh(a, 4);
  assert.equal(a.max, 20); assert.equal(exhEd(a), "2014");
  const b = pc(); setExh(b, 4, undefined, "2024");
  assert.equal(b.max, 40); assert.equal(b.hp, 40); assert.equal(exhEd(b), "2024");
  setMax(b, 50); assert.equal(b.max, 50, "nieuwe max: geen halvering, regels blijven op het effect");
  addEffect(b, { n: "Aid", st: "max", v: 5 }); assert.equal(b.max, 55);
});

test("WP50: reExh is idempotent en wisselt in beide richtingen", () => {
  const c = pc(); setExh(c, 4);
  reExh(c); reExh(c); assert.equal(c.max, 20);
  reExh(c, "2024"); assert.equal(c.max, 40, "2014 → 2024 herstelt de halvering");
  reExh(c, "2024"); assert.equal(c.max, 40);
  reExh(c, "2014"); assert.equal(c.max, 20, "2024 → 2014 halveert weer");
  reExh(c, "2014"); assert.equal(c.max, 20);
  assert.equal(c.eff[0].ed, undefined, "2014 schrijft geen ed");
  const z = pc(); reExh(z, "2024"); assert.equal(z.eff, undefined, "zonder exhaustion: niets");
});

test("WP50: reExhAll rekent de tafel om met een logregel per veranderde max HP", () => {
  const a = pc(), b = pc({ id: "c", name: "Ayla" }), g = gob();
  setExh(a, 4); setExh(b, 2);
  const r = reExhAll([a, b, g], "2024");
  assert.equal(a.max, 40); assert.equal(exhEd(b), "2024");
  assert.deepEqual(nlw(r.why), [{ t: "Exhaustion 4 onder de regels van 2024: max HP 20 → 40", id: "b" }]);
  const back = reExhAll([a, b, g], "2014");
  assert.equal(a.max, 20); assert.equal(back.why.length, 1);
});

test("WP50: d20-straf op saves als vaste modifier, geen disadvantage", () => {
  const c = gob(); setExh(c, 2, undefined, "2024");
  assert.deepEqual(exhMod(c), { n: "Exhaustion 2", b: -4 });
  assert.deepEqual(saveMods(c, "DEX"), [{ n: "Exhaustion 2", b: -4 }]);
  setExh(c, 3);
  assert.equal(exhEd(c), "2024", "zonder ed houdt setExh de regels van het effect");
  assert.deepEqual(saveAdv(c, "DEX"), { v: 0, why: "" });
  const x = rollSave(3, 0, seq(12), saveMods(c, "DEX"));
  assert.equal(x.tot, 12 + 3 - 6);
  assert.equal(rollText(x, 10), "d20 [12] +3 − 6 Exhaustion 3 = 9 ✗");
  // 2014 ongewijzigd: geen modifier, disadvantage vanaf 3
  const o = gob(); setExh(o, 3);
  assert.deepEqual(saveMods(o, "DEX"), []);
  assert.deepEqual(saveAdv(o, "DEX"), { v: -1, why: "Exhaustion 3" });
  assert.equal(exhMod(o), null);
});

test("WP50: aanval met Exhaustion 3 (2024) krijgt −6 en géén disadvantage", () => {
  const by = gob(), tgt = pc(); setExh(by, 3, undefined, "2024");
  const au = atkAdv(by, tgt, "melee");
  assert.equal(au.v, 0); assert.deepEqual(au.dis, []);
  const r = withAdv(rollAttack(4, 0, seq(15, 3)), au.v, atkMods(by));
  assert.equal(r.tot, 15 + 4 - 6);
  assert.equal(atkText(r, 14), "d20 [15] +4 − 6 Exhaustion 3 = 13 vs AC 14");
  assert.equal(atkResult(r, 14, [], {}, {}).hit, false, "de straf telt mee voor raak");
  // 2014: disadvantage, geen modifier
  const o = gob(); setExh(o, 3);
  assert.equal(atkAdv(o, tgt, "melee").v, -1); assert.deepEqual(atkMods(o), []);
  assert.equal(withAdv(rollAttack(4, 0, seq(15, 3)), 0).tot, 19);
});

test("WP50: initiative (opnieuw rollen) krijgt de straf, 2014 niet", () => {
  const a = gob({ id: "a", roll: 10, init: 12 }), b = gob({ id: "b", roll: 10, init: 12 });
  setExh(a, 1, undefined, "2024"); setExh(b, 1);
  const r = rerollMonsters([a, b], seq(10, 10));
  assert.equal(a.init, 10 + 2 - 2); assert.equal(b.init, 12);
  assert.match(nl(r.why[0].t), /^d20 \[10\] \+2 − 2 Exhaustion 1, /);
});

test("WP50: tekst per editie (samenvatting, regels, melding)", () => {
  assert.equal(nl(exhSummary(2, "2024")), "Niveau 2: −4 op d20-tests · speed −10 ft");
  assert.equal(nl(exhSummary(6, "2024")), "Niveau 6: dood");
  assert.equal(nl(exhSummary(0, "2024")), nl(exhSummary(0)));
  assert.equal(nl(exhSummary(2)), "Niveau 2: disadvantage op checks · speed ½");
  assert.deepEqual(nl(exhRows(3, "2024")), ["3 −6 op d20-tests, speed −15 ft"]);
  assert.equal(exhRows(3).length, 3);
  const c = pc(), r = setExh(c, 2, undefined, "2024");
  assert.match(nl(r.msgs[0]), /Exhaustion 2 \(−4 op d20-tests, speed −10 ft\)/);
});

test("WP50: long rest −1 in beide regels, behoudt (of zet) de regels", () => {
  const a = pc(); setExh(a, 4); restMember(a, true);
  assert.equal(exhLevel(a), 3); assert.equal(a.max, 40); assert.equal(exhEd(a), "2014");
  const b = pc(); setExh(b, 5, undefined, "2024"); restMember(b, true);
  assert.equal(exhLevel(b), 4); assert.equal(b.max, 40, "2024: ook op 4 geen halvering"); assert.equal(exhEd(b), "2024");
  const c = pc(); setExh(c, 5); restMember(c, true, "2024");
  assert.equal(exhEd(c), "2024"); assert.equal(c.max, 40);
});

test("WP50: niveau 6 is in 2024 ook de dood", () => {
  const c = pc(); setExh(c, 6, undefined, "2024");
  assert.equal(c.ds.dead, true); assert.equal(exhMod(c), null);
});

test("WP50: Rage 2024 — schade houdt hem niet gaande; 2014 wel", () => {
  for (const [ed, hit] of [["2014", 1], ["2024", undefined]]) {
    const b = pc({ init: 20 }), g = gob({ init: 10 });
    const S = { list: [b, g], round: 0, active: null };
    startCombat(S);
    startRage(b, makeDur(b, { dur: ed === "2024" ? "r100" : "r10" }, "b"), { ed });
    applyDamage(b, 3);
    assert.equal(rageOf(b).hit, hit, ed);
    const o = step(S, 1);
    assert.equal(o.msgs.some((m) => /loopt door/.test(nl(m))), ed === "2024", `${ed}: melding bij einde beurt`);
  }
});

test("WP50: Frenzy-rage 2024 afgelopen → geen Exhaustion (2014: +1); regels blijven bij de rage", () => {
  const a = pc(); startRage(a, null, { frz: true, ed: "2024" });
  assert.equal(rageOf(a).ed, "2024");
  removeEffect(a, rageOf(a).id);
  assert.equal(exhLevel(a), 0);
  const b = pc(); startRage(b, null, { frz: true });
  assert.equal(rageOf(b).ed, undefined);
  removeEffect(b, rageOf(b).id);
  assert.equal(exhLevel(b), 1);
});

test("WP50: rage-duur 2024 = 10 minuten (100 rondes)", () => {
  const b = pc();
  assert.equal(makeDur(b, { dur: "r100" }, "b").count, 100);
});

test("WP50: opslag houdt de regels van Exhaustion en Rage; export ≥ v4 met 2024-effect", () => {
  const c = pc(); setExh(c, 4, undefined, "2024"); startRage(c, null, { ed: "2024" });
  const back = cleanCombatant(JSON.parse(JSON.stringify(c)));
  const ex = back.eff.find((e) => e.n === "Exhaustion"), rg = back.eff.find((e) => e.rg);
  assert.equal(ex.ed, "2024"); assert.equal(ex.hpd, 0); assert.equal(rg.ed, "2024");
  // vervalst bestand: 2024 met hpd wordt geen halvering
  const bad = cleanCombatant({ ...pc(), eff: [{ n: "Exhaustion", x: 4, ed: "2024", st: "max", v: -20, hpd: -20 }] });
  assert.equal(bad.eff[0].hpd, 0);
  const o = pc(); setExh(o, 4);
  assert.equal(cleanCombatant(JSON.parse(JSON.stringify(o))).eff[0].ed, undefined);
  assert.equal(has2024({ S: { list: [o] }, party: [] }), false);
  assert.equal(has2024({ S: { list: [] }, party: [c] }), true, "partylid met 2024-exhaustion");
  assert.equal(has2024({ S: { list: [c] }, party: [] }), true);
});

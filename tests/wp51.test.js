import { nlw } from "./_nl.js"; // Nederlandse catalogus; nlw = oorzaken als tekst
import { test } from "node:test";
import assert from "node:assert/strict";
import { concDc, applyDamage } from "../js/rules/combat.js";
import { startCombat, setSurprise, toggleSurprise, canToggleSurprise, isSurprised, reactUsed, rerollMonsters, initThrow, surWho } from "../js/rules/turns.js";
import { laStatus } from "../js/rules/legendary.js";
import { canParry } from "../js/rules/monrules.js";
import { atkAdv, atkDamage } from "../js/rules/attacks.js";
import { applyAoe } from "../js/rules/aoe.js";

const pc = (id, init, o = {}) => ({ id, name: id, kind: "pc", init, dex: 1, ac: 15, hp: 20, max: 30, cond: [], ...o });
const mon = (id, init, o = {}) => ({ id, name: id, kind: "monster", ref: "Goblin", init, dex: 2, ac: 15, hp: 7, max: 7, cond: [], ...o });
/** rng die achtereenvolgens deze d20-uitkomsten geeft */
const seq = (...dd) => { let i = 0; return () => (dd[i++ % dd.length] - 1) / 20 + 0.001; };

test("WP51 concDc: max(10, ½), 2024 maximaal 30", () => {
  assert.equal(concDc(70), 35); assert.equal(concDc(70, "2024"), 30);
  assert.equal(concDc(7), 10); assert.equal(concDc(7, "2024"), 10);
  assert.equal(concDc(61, "2024"), 30); assert.equal(concDc(59, "2024"), 29);
});

test("WP51 applyDamage: 70 schade op een concentrerende caster → DC 35 (2014) en 30 (2024)", () => {
  const caster = () => pc("w", 10, { hp: 200, max: 200, cond: ["Concentrating"] });
  assert.equal(applyDamage(caster(), 70).saves[0].dc, 35);
  assert.equal(applyDamage(caster(), 70, 1, false, "2024").saves[0].dc, 30);
  // ed loopt door via aanval en AoE
  assert.equal(atkDamage(caster(), { dealt: 70, crit: false }, "2024").saves[0].dc, 30);
  const c = caster();
  const r = applyAoe([{ c, save: "fail", mode: 1, note: "" }], 70, "70 fire", "2024");
  assert.equal(r.saves[0].dc, 30);
});

test("WP51 surprise 2024: geen sur, beurt in ronde 1, reaction/LA/Parry beschikbaar", () => {
  const S = { round: 0, active: null, saves: [], list: [mon("g1", 18, { la: { max: 3, left: 0 } }), pc("a", 15), mon("g2", 12)] };
  setSurprise(S.list, "mon", "2024");
  assert.ok(S.list.every((c) => !("sur" in c)), "2024 zet geen sur");
  startCombat(S, () => 0.5, "2024");
  assert.equal(S.round, 1); assert.equal(S.active, "g1", "verrast monster krijgt zijn beurt in ronde 1");
  const g2 = S.list[2];
  assert.equal(isSurprised(g2, S), false);
  assert.equal(reactUsed(g2, S), false, "reaction beschikbaar");
  assert.equal(canParry(g2, S.round), true, "Parry beschikbaar");
  S.active = "a";
  assert.equal(laStatus(S.list[0], S), "ok", "legendary actions beschikbaar");
});

test("WP51 surprise 2024: vangnet tegen oude sur-data, ⋯-toggle bestaat niet", () => {
  const S = { round: 0, active: null, saves: [], list: [pc("a", 20), mon("g1", 15, { sur: true })] };
  startCombat(S, () => 0.5, "2024");
  assert.ok(!("sur" in S.list[1]));
  assert.equal(canToggleSurprise(S.list[1], S, "2024"), false);
  assert.equal(toggleSurprise(S.list[1], S, "2024"), null);
  assert.equal(canToggleSurprise(S.list[1], S), true, "2014: wel");
});

test("WP51 surprise 2014 ongewijzigd: setSurprise zet sur zoals voorheen", () => {
  const L = [mon("g1", 18), pc("a", 15), { id: "l", name: "Lair", kind: "lair", init: 20, cond: [] }, mon("d", 5, { hp: 0 })];
  setSurprise(L, "mon");
  assert.deepEqual(L.map((c) => !!c.sur), [true, false, false, false]);
  assert.deepEqual(L.map((c) => surWho(c, "mon")), [true, false, false, false]);
});

test("WP51 initThrow: twee d20's, laagste telt, zichtbaar in de worptekst", () => {
  assert.deepEqual(initThrow([14, 6], 2), { r: 6, v: 8, txt: "d20 [14, 6] dis +2" });
  assert.deepEqual(initThrow([14], 2), { r: 14, v: 16, txt: "d20 [14] +2" });
  const t = initThrow([9, 17], 1, { b: -4, n: "Exhaustion 2" });
  assert.equal(t.v, 6); assert.equal(t.txt, "d20 [9, 17] dis +1 − 4 Exhaustion 2");
});

test("WP51 rerollMonsters met disadvantage: verraste monsters rollen 2 d20's", () => {
  const L = [mon("g1", 12, { roll: 10 }), mon("g2", 12, { roll: 10 }), pc("a", 15)];
  const r = rerollMonsters(L, seq(15, 4, 11), { dis: (c) => c.id === "g1" });
  assert.equal(L[0].roll, 4); assert.equal(L[0].init, 6, "laagste van 15 en 4, +2");
  assert.equal(L[1].roll, 11); assert.equal(L[1].init, 13);
  const w = nlw(r.why).find((x) => x.id === "g1").t;
  assert.match(w, /d20 \[15, 4\] dis \+2/); assert.match(w, /verrast: disadvantage/);
});

test("WP51 rerollMonsters keep (Houden): alleen verrasten krijgen een tweede d20 naast hun worp", () => {
  const L = [mon("g1", 12, { roll: 10 }), mon("g2", 12, { roll: 10 }), mon("h", 7)];
  const r = rerollMonsters(L, seq(3), { dis: (c) => c.id !== "g2", keep: true });
  assert.equal(L[0].roll, 3); assert.equal(L[0].init, 5, "min(10, 3) + 2");
  assert.equal(L[1].roll, 10); assert.equal(L[1].init, 12, "niet verrast: onaangeroerd");
  assert.equal(L[2].init, 7, "ingevuld (geen roll): onaangeroerd");
  assert.equal(r.n, 1); assert.match(r.msgs.join(" "), /disadvantage/);
  assert.ok(!/opnieuw bij Start/.test(nlw(r.why)[0].t));
  // de tweede d20 kan ook hoger zijn: dan blijft de oude worp
  const M2 = [mon("g", 12, { roll: 10 })];
  rerollMonsters(M2, seq(18), { dis: () => true, keep: true });
  assert.equal(M2[0].roll, 10); assert.equal(M2[0].init, 12);
});

test("WP51 rerollMonsters: groep krijgt één (dubbele) worp", () => {
  const L = [mon("g1", 12, { roll: 10, grp: "x" }), mon("g2", 12, { roll: 10, grp: "x" })];
  rerollMonsters(L, seq(16, 5), { dis: () => true });
  assert.deepEqual(L.map((c) => c.init), [7, 7]);
});

test("WP51 Grappled-aanvaller: hint alleen bij 2024, geen disadvantage", () => {
  const by = mon("g", 10, { cond: ["Grappled"] }), tgt = pc("a", 10);
  const a14 = atkAdv(by, tgt, "melee"), a24 = atkAdv(by, tgt, "melee", "2024");
  assert.equal(a14.hint.length, 0);
  assert.equal(a24.v, 0, "geen automatische disadvantage (grappler onbekend)");
  assert.equal(a24.hint.length, 1); assert.match(a24.hint[0], /Grappled/);
});

test("WP51 rerollMonsters keep: groep deelt de tweede d20; zonder dis doet keep niets", () => {
  const L = [mon("g1", 12, { roll: 10, grp: "x" }), mon("g2", 12, { roll: 10, grp: "x" })];
  rerollMonsters(L, seq(4), { dis: () => true, keep: true });
  assert.deepEqual(L.map((c) => c.init), [6, 6]);
  const K = [mon("g", 12, { roll: 10 })];
  assert.equal(rerollMonsters(K, seq(1), { keep: true }).n, 0);
  assert.equal(K[0].init, 12);
});

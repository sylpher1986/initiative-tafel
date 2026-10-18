import { test } from "node:test";
import assert from "node:assert/strict";
import { clearMonsters, stopCombat } from "../js/rules/turns.js";
import { addEffect, endConcEffects, PRESETS } from "../js/rules/effects.js";

const pc = (id, o = {}) => ({ id, name: id, kind: "pc", init: 12, dex: 1, ac: 15, hp: 20, max: 30, cond: [], ...o });
const mon = (id, o = {}) => ({ id, name: id, kind: "monster", ref: "Goblin", init: 14, dex: 2, ac: 15, hp: 7, max: 7, cond: [], ...o });

test("volgende encounter: monsters, verborgen monsters en lair weg; spelers houden HP, condities en death saves", () => {
  const ds = { s: 1, f: 2, stable: false, dead: false };
  const S = { round: 3, active: "g1", saves: [{ sid: "x" }], log: [{ msg: "oud" }], sample: false, list: [
    pc("thalia", { hp: 0, cond: ["Unconscious"], ds }), pc("brom", { temp: 5, cond: ["Poisoned"] }),
    mon("g1"), mon("g2", { hidden: true }), { id: "lair", name: "Lair", kind: "lair", init: 20, cond: [] },
  ] };
  const r = clearMonsters(S);
  assert.deepEqual(S.list.map((c) => c.id), ["thalia", "brom"]);
  assert.equal(r.n, 2);
  assert.equal(S.round, 0); assert.equal(S.active, null); assert.deepEqual(S.saves, []);
  assert.deepEqual(S.log, [{ msg: "oud" }], "logboek blijft");
  assert.equal(S.list[0].hp, 0); assert.deepEqual(S.list[0].cond, ["Unconscious"]); assert.equal(S.list[0].ds, ds);
  assert.equal(S.list[1].temp, 5); assert.deepEqual(S.list[1].cond, ["Poisoned"]);
  assert.ok(r.why.some((w) => /volgende encounter/.test(w.t)));
});

test("volgende encounter: ronde-effecten weg, effect tot long rest blijft; Bless van een weggehaald monster vervalt", () => {
  const p = pc("thalia"), g = mon("g1", { cond: ["Concentrating"], concSpell: "Bless" });
  const S = { round: 2, active: "g1", saves: [], list: [p, g] };
  addEffect(p, PRESETS.find((x) => x.n === "Bless"), { kind: "rounds", who: "g1", at: "start", count: 10 }, { by: "g1", spell: "Bless", cast: "2:g1" });
  addEffect(p, { n: "Mage Armor", st: "ac", op: "=", v: 13 }, null, { lr: true });
  clearMonsters(S);
  assert.deepEqual((p.eff || []).map((e) => e.n), ["Mage Armor"]);
  endConcEffects(S.list, S.active); // zoals commit() doet: concentratie van een weggehaalde caster
  assert.deepEqual(p.eff.map((e) => e.n), ["Mage Armor"]);
});

test("gevecht stoppen: geen ronde, beurt of open saves; deelnemers blijven", () => {
  const S = { round: 4, active: "a", saves: [{ sid: "1" }], list: [pc("a"), mon("b")] };
  stopCombat(S);
  assert.equal(S.round, 0); assert.equal(S.active, null); assert.deepEqual(S.saves, []);
  assert.equal(S.list.length, 2);
});

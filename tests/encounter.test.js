import { test } from "node:test";
import assert from "node:assert/strict";
import { clearMonsters, stopCombat, setInits, initPcs } from "../js/rules/turns.js";
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

test("initiative spelers bij start: geldige waarden gezet, ongeldig/leeg = ontbreekt, dode speler telt niet", () => {
  const L = [pc("a", { init: 12 }), pc("b", { init: 8 }), pc("c", { init: 5, ds: { s: 0, f: 3, stable: false, dead: true } }), pc("d", { init: 3, hidden: true }), mon("m", { init: 14 })];
  assert.deepEqual(initPcs(L).map((c) => c.id), ["a", "b", "d"]);
  const r = setInits(L, { a: "17", b: "8", d: "abc", m: "1" });
  assert.deepEqual(r.missing, ["d"]);
  assert.equal(L[0].init, 12, "ontbrekende waarde: alles of niets, ook geldige niet gezet");
  assert.equal(L[3].init, 3);
  const r2 = setInits(L, { a: "99", b: "-3", d: "4", m: "1" });
  assert.deepEqual(r2.missing, []);
  assert.equal(L[0].init, 40); assert.equal(L[1].init, -3); assert.equal(L[3].init, 4);
  assert.equal(L[4].init, 14, "monsters niet");
  assert.equal(L[2].init, 5, "dode speler niet");
  const N = [pc("x", { init: null })];
  assert.deepEqual(setInits(N, {}).missing, ["x"], "speler zonder init (oude data) moet ingevuld worden");
});

test("volgende encounter: conditieduur die aan een gewist monster hing vervalt, de conditie blijft (save ook)", () => {
  const p = pc("a", { cond: ["Frightened", "Poisoned", "Prone"], cd: {
    Frightened: { kind: "tend", who: "g1", at: "end", count: 1 },
    Poisoned: { kind: "tend", who: "g1", at: "end", count: 1, save: { ab: "CON", dc: 12 } },
    Prone: { kind: "tend", who: "a", at: "end", count: 1 } } });
  const S = { round: 1, active: "a", saves: [], list: [p, mon("g1")] };
  const r = clearMonsters(S);
  assert.deepEqual(p.cond, ["Frightened", "Poisoned", "Prone"]);
  assert.equal(p.cd.Frightened, undefined);
  assert.deepEqual(p.cd.Poisoned, { kind: "inf", save: { ab: "CON", dc: 12 } });
  assert.equal(p.cd.Prone.who, "a");
  assert.equal(r.n, 1); assert.equal(r.lairs, 0);
});

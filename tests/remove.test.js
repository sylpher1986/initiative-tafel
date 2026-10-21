import { test } from "node:test";
import assert from "node:assert/strict";
import { startCombat, step, removeCombatant } from "../js/rules/turns.js";

const pc = (id, init, o = {}) => ({ id, name: id, kind: "pc", init, dex: 1, ac: 15, hp: 20, max: 30, cond: [], ...o });
const mon = (id, init, o = {}) => ({ id, name: id, kind: "monster", ref: "Goblin", init, dex: 2, ac: 15, hp: 7, max: 7, cond: [], ...o });
const rng = () => 0.5;
const fight = (list) => { const S = { round: 0, active: null, saves: [], list }; startCombat(S, rng); return S; };

test("GV6: laatste in de volgorde aan de beurt en weg → nieuwe ronde, eerste aan de beurt", () => {
  const S = fight([pc("a", 20), pc("b", 15), mon("g", 5)]);
  step(S, 1, rng); step(S, 1, rng);
  assert.equal(S.active, "g"); assert.equal(S.round, 1);
  removeCombatant(S, "g", rng);
  assert.equal(S.round, 2, "ronde telt door"); assert.equal(S.active, "a");
  assert.ok(!S.list.some((c) => c.id === "g"));
});

test("GV6: actieve in het midden weg → volgende in de volgorde, niemand speelt dubbel", () => {
  const S = fight([pc("a", 20), mon("g", 15), pc("b", 10)]);
  step(S, 1, rng);
  assert.equal(S.active, "g");
  removeCombatant(S, "g", rng);
  assert.equal(S.active, "b"); assert.equal(S.round, 1);
  step(S, 1, rng);
  assert.equal(S.active, "a"); assert.equal(S.round, 2);
});

test("GV6: beurtgrenzen lopen: conditie t/m einde beurt van de vluchter vervalt, volgende krijgt zijn reaction", () => {
  const S = fight([pc("a", 20), mon("g", 15), pc("b", 10)]);
  step(S, 1, rng);
  const a = S.list[0];
  a.cond = ["Frightened"]; a.cd = { Frightened: { kind: "r", who: "g", at: "end", count: 1 } };
  S.list[2].reaction = true;
  const r = removeCombatant(S, "g", rng);
  assert.deepEqual(a.cond, [], "einde beurt g telde af");
  assert.equal(S.list.find((c) => c.id === "b").reaction, false, "begin beurt b");
  assert.ok(r.why.length > 0);
});

test("GV6: niet aan de beurt, buiten een gevecht of laatste levende → alleen weg", () => {
  const S = fight([pc("a", 20), mon("g", 15)]);
  removeCombatant(S, "g", rng);
  assert.equal(S.active, "a"); assert.equal(S.round, 1);
  const P = { round: 0, active: null, saves: [], list: [pc("a", 20), mon("g", 15)] };
  removeCombatant(P, "a", rng);
  assert.equal(P.round, 0); assert.equal(P.active, null); assert.equal(P.list.length, 1);
  const L = fight([pc("a", 20), mon("g", 15, { hp: 0 })]);
  removeCombatant(L, "a", rng);
  assert.equal(L.active, null, "niemand meer die aan de beurt kan"); assert.equal(L.list.length, 1);
});

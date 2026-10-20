import { test } from "node:test";
import assert from "node:assert/strict";
import { addSave, turnSaves, tickSaves, openSaves, resolveSave, TTL } from "../js/rules/saves.js";
import { step, startCombat } from "../js/rules/turns.js";
import { applyDamage, startConc } from "../js/rules/combat.js";
import { diffLog } from "../js/log.js";

const mon = (o = {}) => ({ id: "m", name: "Bugbear", kind: "monster", init: 10, dex: 2, hp: 27, max: 27, cond: [], ...o });
const pc = (o = {}) => ({ id: "p", name: "Wolfim", kind: "pc", init: 15, dex: 3, hp: 30, max: 30, cond: [], ...o });
const held = () => mon({ cond: ["Paralyzed"], cd: { Paralyzed: { kind: "inf", save: { ab: "WIS", dc: 13 } } } });

test("herhaal-save staat open vanaf het begin van de beurt van het doelwit", () => {
  const S = { list: [pc(), held()], round: 1, active: "p" };
  step(S, 1);
  assert.equal(S.active, "m");
  assert.deepEqual(openSaves(S).map((s) => [s.id, s.kind, s.n, s.ab, s.dc]), [["m", "cond", "Paralyzed", "WIS", 13]]);
  turnSaves(S, "m"); // dezelfde conditie opnieuw: vervangt, geen dubbele vraag
  assert.equal(openSaves(S).length, 1);
});

test("niet afgehandeld: blijft één beurtwissel staan, vervalt daarna zonder gevolg", () => {
  const S = { list: [pc(), held(), mon({ id: "x", name: "Goblin", init: 5 })], round: 1, active: "p" };
  step(S, 1); // m aan de beurt: vraag open
  let r = step(S, 1); // Goblin: vraag staat er nog
  assert.equal(openSaves(S).length, 1);
  r = step(S, 1); // Wolfim: verlopen
  assert.equal(openSaves(S).length, 0);
  assert.ok(r.why.some((w) => w.id === "m" && /niet afgehandeld/.test(w.t)));
  assert.ok(S.list[1].cond.includes("Paralyzed"));
  assert.equal(TTL, 2);
});

test("geslaagde condition save haalt de conditie weg; gefaald laat hem staan", () => {
  const S = { list: [held()], round: 1, active: "m" };
  turnSaves(S, "m");
  let s = openSaves(S)[0];
  let r = resolveSave(S, s.sid, false, "d20 [3] +0 = 3 ✗");
  assert.ok(S.list[0].cond.includes("Paralyzed")); assert.match(r.why[0].t, /gefaald/);
  turnSaves(S, "m"); s = openSaves(S)[0];
  r = resolveSave(S, s.sid, true);
  assert.ok(!S.list[0].cond.includes("Paralyzed")); assert.equal(S.list[0].cd.Paralyzed, undefined);
  assert.equal(openSaves(S).length, 0);
  assert.equal(resolveSave(S, s.sid, true).why.length, 0, "twee keer afhandelen doet niets");
});

test("concentration save: gefaald = concentratie weg, geslaagd = blijft; elke schade een eigen vraag", () => {
  const c = pc(); startConc(c, "Bless");
  const S = { list: [c], round: 1, active: "p" };
  for (const n of [8, 30 - 8 - 1]) applyDamage(c, n).saves.forEach((x) => addSave(S, x));
  const [a, b] = openSaves(S);
  assert.deepEqual([a.dc, b.dc], [10, 10]);
  resolveSave(S, a.sid, true);
  assert.ok(c.cond.includes("Concentrating"));
  resolveSave(S, b.sid, false);
  assert.ok(!c.cond.includes("Concentrating")); assert.equal(c.concSpell, null);
  // open save hoort bij die spell: na een nieuwe spell vervalt hij
  c.hp = 30; startConc(c, "Fly"); applyDamage(c, 4).saves.forEach((x) => addSave(S, x));
  assert.equal(openSaves(S).length, 1);
  startConc(c, "Haste");
  assert.equal(openSaves(S).length, 0);
});

test("vraag vervalt als de conditie al weg is, het doel neer is of verwijderd", () => {
  const S = { list: [held()], round: 1, active: "m" };
  turnSaves(S, "m");
  S.list[0].cond = [];
  assert.equal(openSaves(S).length, 0);
  S.list[0].cond = ["Paralyzed"]; S.list[0].hp = 0;
  assert.equal(openSaves(S).length, 0);
  S.list = [];
  assert.equal(openSaves(S).length, 0);
  assert.deepEqual(openSaves({ list: [] }), [], "oude toestand zonder saves");
});

test("logboek: afgehandelde save met oorzaak", () => {
  const S = { list: [held()], round: 1, active: "m" };
  turnSaves(S, "m");
  const prev = structuredClone(S);
  resolveSave(S, openSaves(S)[0].sid, true);
  assert.match(diffLog(prev, S)[0].msg, /Paralyzed voorbij/);
});

test("start gevecht: open saves van eerder blijven bruikbaar", () => {
  const S = { list: [held({ init: 20 })], round: 0, active: null };
  startCombat(S);
  assert.equal(openSaves(S).length, 1);
});

test("RE7: ‹ Vorige draait de veroudering terug; daarna weer Volgende vervalt de save niet te vroeg", () => {
  const S = { list: [pc(), held(), mon({ id: "x", name: "Goblin", init: 5 })], round: 1, active: "p" };
  step(S, 1); // m: vraag open (ttl 2)
  step(S, 1); // Goblin: ttl 1
  step(S, -1); // terug naar m: ttl weer 2
  assert.equal(S.saves[0].ttl, TTL);
  step(S, 1); // Goblin opnieuw: staat er nog
  assert.equal(openSaves(S).length, 1);
  step(S, -1); step(S, -1); // nooit boven TTL
  assert.equal(S.saves[0].ttl, TTL);
});

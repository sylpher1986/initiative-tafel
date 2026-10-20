import { test } from "node:test";
import assert from "node:assert/strict";
import { rerollMonsters, freshRoll, groupOf, startCombat } from "../js/rules/turns.js";

const mon = (id, roll, dex, o = {}) => ({ id, name: id, kind: "monster", ref: "Goblin", roll, dex, init: roll === undefined ? 10 : roll + dex, ac: 15, hp: 7, max: 7, cond: [], ...o });
const pc = (id, init) => ({ id, name: id, kind: "pc", init, dex: 1, ac: 15, hp: 20, max: 20, cond: [] });
const seq = (...v) => { let i = 0; return () => (v[i++ % v.length] - 1) / 20; }; // d20 geeft precies deze waarden

test("freshRoll: alleen onaangeroerde monsterworpen", () => {
  assert.equal(freshRoll(mon("a", 5, 2)), true);
  assert.equal(freshRoll(mon("b", 5, 2, { init: 14 })), false, "via ⋯ of de kaart aangepast");
  assert.equal(freshRoll(mon("c", undefined, 2)), false, "ingevuld");
  assert.equal(freshRoll(pc("p", 12)), false);
  assert.equal(freshRoll(mon("d", 5, 2, { hp: 0 })), false, "dood monster: geen loze worp of logregel");
  assert.equal(freshRoll({ id: "l", kind: "lair", init: 20, dex: -99 }), false);
});

test("rerollMonsters: nieuwe worp + Dex, aangepast en ingevuld blijven, spelers en lair niet", () => {
  const L = [mon("a", 3, 2), mon("b", 5, -1, { init: 18 }), mon("c", undefined, 1, { init: 7 }), mon("h", 4, 0, { hidden: true }), pc("p", 12), { id: "l", name: "Lair", kind: "lair", init: 20, dex: -99, cond: [] }];
  const r = rerollMonsters(L, seq(17, 9));
  assert.equal(r.n, 2);
  assert.deepEqual([L[0].roll, L[0].init], [17, 19]);
  assert.deepEqual([L[3].roll, L[3].init], [9, 9], "verborgen monster doet mee");
  assert.equal(L[1].init, 18); assert.equal(L[2].init, 7); assert.equal(L[4].init, 12); assert.equal(L[5].init, 20);
  assert.match(r.msgs[0], /opnieuw gerold \(2\)/);
  assert.deepEqual(r.why.map((w) => w.id), ["a", "h"]);
  assert.match(r.why[0].t, /d20 \[17\] \+2, opnieuw bij Start/);
  assert.ok(freshRoll(L[0]), "na de worp weer onaangeroerd (volgende Start kan opnieuw)");
});

test("rerollMonsters: groep krijgt één worp en blijft een groep; los aangepast lid blijft staan", () => {
  const L = [mon("g1", 6, 1, { grp: "x" }), mon("g2", 6, 1, { grp: "x" }), mon("g3", 6, 1, { grp: "x", init: 15 }), mon("s", 6, 1)];
  rerollMonsters(L, seq(12, 4));
  assert.equal(L[0].init, 13); assert.equal(L[1].init, 13, "zelfde groepsworp");
  assert.equal(L[2].init, 15, "aangepast lid: niet gerold");
  assert.equal(L[3].init, 5, "los monster eigen worp");
  assert.equal(groupOf(L, "g1").live.length, 2, "g1 + g2 samen in de groep");
});

test("rerollMonsters: niets te rollen = geen melding", () => {
  const r = rerollMonsters([mon("c", undefined, 1), pc("p", 3)], seq(5));
  assert.equal(r.n, 0); assert.equal(r.msgs.length, 0); assert.equal(r.why.length, 0);
});

test("rerollMonsters vóór startCombat: volgorde volgt de nieuwe worpen", () => {
  const S = { round: 0, active: null, saves: [], list: [mon("a", 20, 0), mon("b", 1, 0), pc("p", 10)] };
  rerollMonsters(S.list, seq(2, 19));
  startCombat(S, () => 0.5);
  assert.equal(S.active, "b");
});

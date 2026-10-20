import { test } from "node:test";
import assert from "node:assert/strict";
import { readAhead, sortOrder } from "../js/rules/turns.js";

const mon = (o) => ({ kind: "monster", cond: [], dex: 0, ac: 13, hp: 10, max: 10, ref: "Goblin", ...o });
const pc = (o) => ({ kind: "pc", cond: [], dex: 2, ac: 15, hp: 20, max: 20, ...o });
const ok = (c) => c.kind === "monster" && !!c.ref;
const ids = (r) => r && [r.c.id, r.now, r.n];

// Ayla 18 · Goblin 15 · Bram 12 · Hobgoblin 8 · Lair 20 (geen statblock)
const list = () => sortOrder([
  pc({ id: "a", name: "Ayla", init: 18 }), mon({ id: "g", name: "Goblin", init: 15 }),
  pc({ id: "b", name: "Bram", init: 12 }), mon({ id: "h", name: "Hobgoblin", ref: "Hobgoblin", init: 8 }),
  { id: "l", kind: "lair", name: "Lair", init: 20, cond: [] },
]);

test("readAhead: buiten een gevecht niets", () => {
  assert.equal(readAhead({ round: 0, active: null }, list(), ok), null);
});

test("readAhead: spelersbeurt → volgende monster, lair overgeslagen", () => {
  const L = list();
  assert.deepEqual(ids(readAhead({ round: 1, active: "a" }, L, ok)), ["g", false, 1]);
  assert.deepEqual(ids(readAhead({ round: 1, active: "b" }, L, ok)), ["h", false, 1]);
  assert.deepEqual(ids(readAhead({ round: 1, active: "l" }, L, ok)), ["g", false, 1]); // lair aan de beurt: niet "Nu"
});

test("readAhead: monster aan de beurt → dat monster (Nu)", () => {
  assert.deepEqual(ids(readAhead({ round: 2, active: "h" }, list(), ok)), ["h", true, 1]);
});

test("readAhead: over de ronde heen, neer en verrast in ronde 1 overgeslagen", () => {
  const L = list();
  L.find((c) => c.id === "h").hp = 0;
  assert.deepEqual(ids(readAhead({ round: 2, active: "b" }, L, ok)), ["g", false, 1]); // na Bram: Hobgoblin neer, terug naar Goblin
  L.find((c) => c.id === "h").hp = 10;
  L.find((c) => c.id === "h").sur = true;
  assert.deepEqual(ids(readAhead({ round: 1, active: "b" }, L, ok)), ["g", false, 1]);
  assert.deepEqual(ids(readAhead({ round: 2, active: "b" }, L, ok)), ["h", false, 1]);
});

test("readAhead: monster zonder statblock telt niet; geen monster meer = null", () => {
  const L = list();
  L.find((c) => c.id === "h").ref = null;
  assert.deepEqual(ids(readAhead({ round: 1, active: "b" }, L, ok)), ["g", false, 1]);
  L.find((c) => c.id === "g").hp = 0;
  assert.equal(readAhead({ round: 1, active: "b" }, L, ok), null);
});

test("readAhead: groep geeft het aantal levende leden", () => {
  const L = sortOrder([pc({ id: "a", name: "Ayla", init: 18 }),
    ...[1, 2, 3].map((i) => mon({ id: `g${i}`, name: `Goblin ${i}`, init: 15, grp: "x" }))]);
  assert.deepEqual(ids(readAhead({ round: 1, active: "a" }, L, ok)), ["g1", false, 3]);
  L[1].hp = 0;
  assert.deepEqual(ids(readAhead({ round: 1, active: "a" }, L, ok)), ["g2", false, 2]);
});

test("readAhead: verraste groep na de rondegrens telt volledig (ronde 2)", () => {
  const L = sortOrder([pc({ id: "a", name: "Ayla", init: 5 }),
    ...[1, 2, 3].map((i) => mon({ id: `g${i}`, name: `Goblin ${i}`, init: 15, grp: "x", sur: true }))]);
  assert.deepEqual(ids(readAhead({ round: 1, active: "a" }, L, ok)), ["g1", false, 3]);
});

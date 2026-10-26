import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupOf, sortOrder, step, startCombat } from "../js/rules/turns.js";
import { toPlayerView, cleanView, groupName, headHtml } from "../js/playerview.js";
import { cleanCombatant } from "../js/backup.js";

const mon = (o) => ({ kind: "monster", cond: [], dex: 0, ac: 13, hp: 10, max: 10, ref: "Bugbear", init: 12, ...o });
const pc = (o) => ({ kind: "pc", cond: [], dex: 2, ac: 15, hp: 20, max: 20, ...o });
const bugs = (n, o = {}) => Array.from({ length: n }, (_, i) => mon({ id: `b${i + 1}`, name: `Bugbear ${i + 1}`, grp: "g1", ...o }));

test("sortOrder: nummers numeriek (Bugbear 2 vóór Bugbear 10)", () => {
  const L = sortOrder([mon({ id: "x", name: "Bugbear 10" }), mon({ id: "y", name: "Bugbear 2" }), mon({ id: "z", name: "Bugbear 9" })]);
  assert.deepEqual(L.map((c) => c.name), ["Bugbear 2", "Bugbear 9", "Bugbear 10"]);
});

test("groupOf: positie en aantal levende leden", () => {
  const L = sortOrder([pc({ id: "p", name: "Ayla", init: 15 }), ...bugs(3)]);
  const g = groupOf(L, "b2");
  assert.deepEqual(g.live.map((c) => c.id), ["b1", "b2", "b3"]);
  assert.equal(g.k, 2);
  assert.equal(groupOf(L, "p"), null);
});

test("groupOf: dood lid telt niet mee; één levend lid = geen groep", () => {
  const B = bugs(3); B[0].hp = 0;
  let g = groupOf(sortOrder(B), "b3");
  assert.deepEqual([g.k, g.live.length], [2, 2]);
  B[1].hp = 0;
  assert.equal(groupOf(sortOrder(B), "b3"), null);
});

test("groupOf: ander initiative valt uit de groep; oude data zonder grp is geen groep", () => {
  const B = bugs(3); B[2].init = 8;
  const L = sortOrder(B);
  assert.equal(groupOf(L, "b2").live.length, 2);
  assert.equal(groupOf(L, "b3"), null);
  assert.equal(groupOf(sortOrder(bugs(3, { grp: undefined })), "b1"), null);
});

test("groupOf: twee groepen met dezelfde initiative blijven apart", () => {
  const L = sortOrder([...bugs(2), mon({ id: "c1", name: "Bugbear 3", grp: "g2" }), mon({ id: "c2", name: "Bugbear 4", grp: "g2" })]);
  assert.deepEqual(groupOf(L, "b1").live.map((c) => c.id), ["b1", "b2"]);
  assert.deepEqual(groupOf(L, "c2").live.map((c) => c.id), ["c1", "c2"]);
});

test("beurten blijven per lid: Volgende gaat door de groep met recharge per lid", () => {
  const B = bugs(2); B.forEach((c) => (c.rc = [{ n: "Breath", min: 5, ready: false }]));
  const S = { list: [pc({ id: "p", name: "Ayla", init: 15 }), ...B], round: 0, active: null };
  startCombat(S, () => 0.99);
  assert.equal(S.active, "p");
  step(S, 1, () => 0.99); assert.equal(S.active, "b1"); assert.equal(B[0].rc[0].ready, true); assert.equal(B[1].rc[0].ready, false);
  step(S, 1, () => 0.99); assert.equal(S.active, "b2"); assert.equal(B[1].rc[0].ready, true);
});

test("spelersscherm: hele groep aan de beurt, volgende voorbij de groep, verborgen lid telt niet", () => {
  const B = bugs(3); B[2].hidden = true;
  const S = { list: [pc({ id: "p", name: "Ayla", init: 5 }), ...B], round: 1, active: "b1" };
  const V = toPlayerView(S);
  assert.deepEqual(V.group, ["b1", "b2"]);
  assert.equal(V.gname, undefined, "WP32: groepsnaam maakt het spelersscherm zelf");
  assert.match(headHtml(cleanView(V)), /<b>Bugbear ×2<\/b>/);
  assert.equal(V.next, "p");
  assert.deepEqual(cleanView(V).group, ["b1", "b2"]);
  // geen groep: geen velden
  const V2 = toPlayerView({ ...S, active: "p" });
  assert.equal(V2.group, undefined);
  assert.equal(V2.next, "b1");
});

test("cleanView: groep alleen met bekende id's en inclusief wie aan de beurt is", () => {
  const V = toPlayerView({ list: bugs(2), round: 1, active: "b1" });
  assert.equal(cleanView({ ...V, group: ["b1", "zz"] }).group, undefined);
  assert.equal(cleanView({ ...V, group: "b1" }).group, undefined);
  assert.deepEqual(cleanView({ ...V, active: "b2", group: ["b1", "b2"] }).group, ["b1", "b2"]);
});

test("groupName: verschillende namen achter elkaar", () => {
  assert.equal(groupName([{ name: "Goblin 1" }, { name: "Hobgoblin 2" }]), "Goblin 1, Hobgoblin 2");
});

test("import: grp alleen bij monsters en als nette korte tekst", () => {
  assert.equal(cleanCombatant(mon({ id: "a", name: "A", grp: "ab12x" })).grp, "ab12x");
  assert.equal(cleanCombatant(mon({ id: "a", name: "A", grp: "<script>" })).grp, undefined);
  assert.equal(cleanCombatant(pc({ id: "a", name: "A", grp: "ab12x" })).grp, undefined);
});

test("groupOf: wie aan de beurt is maar zelf neer is, toont geen groep (dock en spelersscherm)", () => {
  const B = bugs(3); B[0].hp = 0;
  assert.equal(groupOf(sortOrder(B), "b1"), null);
  const V = toPlayerView({ list: B, round: 1, active: "b1" });
  assert.equal(V.group, undefined);
  assert.equal(V.next, "b2");
});

test("groupOf: speler met gelijke initiative splitst de groep niet (spelers vóór monsters)", () => {
  const L = sortOrder([...bugs(2), pc({ id: "p", name: "Ayla", init: 12, dex: 0 })]);
  assert.equal(L[0].id, "p");
  assert.equal(groupOf(L, "b2").live.length, 2);
});

import { nlw } from "./_nl.js"; // WP27: Nederlandse catalogus; nlw = oorzaken als tekst
import { test } from "node:test";
import assert from "node:assert/strict";
import { startCombat, step, stopCombat, nextUp, sortOrder, isSurprised, setSurprise, toggleSurprise } from "../js/rules/turns.js";
import { laStatus } from "../js/rules/legendary.js";

const pc = (id, init, o = {}) => ({ id, name: id, kind: "pc", init, dex: 1, ac: 15, hp: 20, max: 30, cond: [], ...o });
const mon = (id, init, o = {}) => ({ id, name: id, kind: "monster", ref: "Goblin", init, dex: 2, ac: 15, hp: 7, max: 7, cond: [], ...o });
const rng = () => 0.5;

test("surprise: verraste monsters slaan hun beurt in ronde 1 over, ronde 2 doen ze mee", () => {
  const S = { round: 0, active: null, saves: [], list: [mon("g1", 18, { sur: true }), pc("a", 15), mon("g2", 12, { sur: true }), pc("b", 10)] };
  const r0 = startCombat(S, rng);
  assert.equal(S.active, "a", "g1 verrast: a begint");
  assert.equal(S.list[0].sur, 2); assert.equal(S.list[0].reaction, false, "na de overgeslagen beurt reaction weer beschikbaar");
  assert.equal(S.list[2].reaction, true, "g2 nog verrast: geen reaction");
  assert.match(r0.msgs.join(" "), /Verrast, beurt overgeslagen: g1/);
  assert.ok(nlw(r0.why).some((w) => w.id === "g1" && /verrast/.test(w.t)));
  step(S, 1, rng);
  assert.equal(S.active, "b", "g2 overgeslagen");
  assert.equal(S.list[2].reaction, false);
  step(S, 1, rng);
  assert.equal(S.round, 2); assert.equal(S.active, "g1", "ronde 2: verrassing voorbij");
  assert.ok(S.list.every((c) => !("sur" in c)), "sur weg vanaf ronde 2");
});

test("surprise: ‹ Vorige in ronde 1 slaat overgeslagen verraste beurten ook over", () => {
  const S = { round: 0, active: null, saves: [], list: [pc("a", 20), mon("g1", 15, { sur: true }), pc("b", 10)] };
  startCombat(S, rng);
  step(S, 1, rng);
  assert.equal(S.active, "b");
  step(S, -1, rng);
  assert.equal(S.active, "a");
});

test("surprise: iedereen verrast → ronde 1 helemaal overgeslagen, ronde 2 begint bovenaan", () => {
  const S = { round: 0, active: null, saves: [], list: [pc("a", 20, { sur: true }), mon("g1", 15, { sur: true })] };
  startCombat(S, rng);
  assert.equal(S.round, 2); assert.equal(S.active, "a");
  assert.ok(S.list.every((c) => !("sur" in c) && c.reaction === false));
});

test("surprise: beurtgrenzen van een overgeslagen beurt tellen af (conditie t/m einde beurt)", () => {
  const g = mon("g1", 15, { sur: true, cond: ["Prone"], cd: { Prone: { kind: "tend", who: "g1", at: "end", count: 1 } } });
  const S = { round: 0, active: null, saves: [], list: [pc("a", 20), g, pc("b", 10)] };
  startCombat(S, rng);
  step(S, 1, rng);
  assert.deepEqual(g.cond, [], "Prone verliep aan het einde van de overgeslagen beurt");
});

test("surprise: legendary actions uit zolang verrast; dood verrast monster zonder sur", () => {
  const d = mon("dragon", 10, { sur: true, la: { max: 3, left: 3 }, hp: 100, max: 100 });
  const S = { round: 0, active: null, saves: [], list: [pc("a", 20), d, mon("dead", 5, { sur: true, hp: 0 })] };
  startCombat(S, rng);
  assert.equal(isSurprised(d, S), true);
  assert.equal(laStatus(d, S), "sur");
  assert.ok(!("sur" in S.list[2]), "wie al neer is bij de start is niet verrast");
  step(S, 1, rng); // dragon overgeslagen → ronde 2, a
  assert.equal(laStatus(d, S), "ok");
});

test("surprise: nextUp slaat verraste deelnemers in ronde 1 over, niet meer na de wissel naar ronde 2", () => {
  const S = { round: 1, active: "a", list: [pc("a", 20), mon("g1", 15, { sur: true }), pc("b", 10)] };
  const L = sortOrder(S.list);
  assert.equal(nextUp(S, L, "a").id, "b");
  assert.equal(nextUp(S, L, "b").id, "a");
  S.active = "b"; L[0].sur = true; // a verrast en b aan de beurt: na de wissel is a in ronde 2 weer aan de beurt
  assert.equal(nextUp(S, L, "b").id, "a");
});

test("surprise: gevecht stoppen wist sur", () => {
  const S = { round: 1, active: "a", saves: [], list: [pc("a", 20), mon("g1", 15, { sur: true })] };
  stopCombat(S);
  assert.ok(!("sur" in S.list[1]));
});

test("surprise: setSurprise zet monsters of spelers (niet wie neer is), toggleSurprise alleen voor wie nog moet", () => {
  const L = [pc("a", 20, { sur: true }), mon("g1", 15), mon("g2", 12, { hp: 0 }), { id: "l", name: "Lair", kind: "lair", init: 20, cond: [] }];
  setSurprise(L, "mon");
  assert.deepEqual(L.map((c) => !!c.sur), [false, true, false, false]);
  setSurprise(L, "none");
  assert.ok(L.every((c) => !c.sur));
  const S = { round: 1, active: "a", saves: [], list: [pc("a", 20), mon("g1", 15), pc("b", 10)] };
  assert.equal(toggleSurprise(S.list[0], S), null, "wie aan de beurt is niet");
  toggleSurprise(S.list[1], S);
  assert.equal(S.list[1].sur, true); assert.equal(S.list[1].reaction, true);
  step(S, 1, rng);
  assert.equal(S.active, "b");
  assert.equal(toggleSurprise(S.list[1], S), null, "beurt al overgeslagen");
  S.round = 2;
  assert.equal(toggleSurprise(S.list[0], S), null, "ronde 2 niet");
});

test("surprise: een verrast monster dat neergaat is niet meer 'verrast' (geen badge)", () => {
  const S = { round: 0, active: null, saves: [], list: [pc("a", 20), mon("g1", 15, { sur: true })] };
  startCombat(S, rng);
  assert.equal(isSurprised(S.list[1], S), true);
  S.list[1].hp = 0;
  assert.equal(isSurprised(S.list[1], S), false);
});

test("surprise: spelersscherm toont 'Verrast' en 'volgende' slaat verraste deelnemers over", async () => {
  const { toPlayerView } = await import("../js/playerview.js");
  const S = { round: 1, active: "a", list: [pc("a", 20), mon("g1", 15, { sur: true }), pc("b", 10)] };
  const V = toPlayerView(S);
  assert.equal(V.next, "b");
  assert.deepEqual(V.list.find((c) => c.id === "g1").tags, ["Verrast"]);
});

test("surprise: verrast monster dat vóór zijn beurt neergaat en daarna geheald wordt, blijft overgeslagen (sur = 2)", () => {
  const g = mon("g1", 15, { sur: true });
  const S = { round: 0, active: null, saves: [], list: [pc("a", 20), g, pc("b", 10)] };
  startCombat(S, rng);
  g.hp = 0;
  step(S, 1, rng);
  assert.equal(S.active, "b"); assert.equal(g.sur, 2);
  g.hp = 5;
  assert.equal(isSurprised(g, S), false, "beurt is voorbij: niet meer verrast, reaction vrij");
});

test("surprise: groepsbeurt telt verraste leden in ronde 1 niet mee", async () => {
  const { groupOf } = await import("../js/rules/turns.js");
  const L = [mon("b1", 12, { grp: "x" }), mon("b2", 12, { grp: "x", sur: true }), mon("b3", 12, { grp: "x" })];
  assert.deepEqual(groupOf(L, "b1", 1).live.map((c) => c.id), ["b1", "b3"]);
  assert.equal(groupOf(L, "b1", 2).live.length, 3);
});

test("surprise: export/import houdt sur vast (gevecht in ronde 1)", async () => {
  const { cleanCombatant } = await import("../js/backup.js");
  assert.equal(cleanCombatant(mon("g", 10, { sur: true })).sur, true);
  assert.equal(cleanCombatant(mon("g", 10, { sur: 2 })).sur, 2);
  assert.equal(cleanCombatant(mon("g", 10, { sur: "x" })).sur, undefined);
});

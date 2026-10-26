import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { app, commit, logAs, because, resetBaseline, undo } from "../js/state.js";

const mon = (id) => ({ id, name: id, kind: "monster", ref: "Goblin", init: 10, dex: 0, ac: 15, hp: 7, max: 7, cond: [] });

test("logAs: inladen (erbij en weg) wordt één logregel, met alleen de oorzaken voor de hele stap; lekt niet door", () => {
  app.S = { list: [{ id: "p", name: "Ayla", kind: "pc", init: 12, cond: [], hp: 10, max: 10 }, mon("oud")], round: 0, active: null, log: [] };
  resetBaseline();
  app.S.list = app.S.list.filter((c) => c.id !== "oud");
  app.S.list.push(mon("g1"), mon("g2"));
  app.S.list[0].hp = 9; // een gewone wijziging in dezelfde stap houdt zijn eigen regel
  because("d20 [12] +0", "g1"); because('encounter "Grot"');
  logAs('Encounter "Grot" ingeladen: 2 monsters');
  assert.equal(commit(), true);
  const L = app.S.log.map((e) => [e.msg, e.why]);
  assert.equal(L.length, 2);
  assert.match(L[0][0], /^Ayla: 10 → 9 HP/);
  assert.deepEqual(L[1], ['Encounter "Grot" ingeladen: 2 monsters', 'encounter "Grot"']);
  // volgende stap: weer gewone regels
  app.S.list.push(mon("g3"));
  commit();
  assert.match(app.S.log.at(-1).msg, /^g3 doet mee/);
  // undo wist een klaargezette samenvatting
  logAs("x"); undo(); app.S.list.push(mon("g4")); commit();
  assert.match(app.S.log.at(-1).msg, /^g4 doet mee/);
});

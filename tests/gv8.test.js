import { test } from "node:test";
import assert from "node:assert/strict";
import { app, commit, undo, redo, canUndo, canRedo, clearRedo, resetBaseline, historySize } from "../js/state.js";
import { stepEntries, stepText } from "../js/log.js";

const mon = (id, hp = 7) => ({ id, name: id, kind: "monster", ref: "Goblin", init: 10, dex: 0, ac: 15, hp, max: 7, cond: [] });
const pc = (id) => ({ id, name: id, kind: "pc", init: 12, cond: [], hp: 10, max: 10 });
const S0 = () => ({ list: [pc("Aram"), mon("Goblin 1"), mon("Goblin 2")], round: 0, active: null, log: [] });

test("GV8: Ongedaan dan Opnieuw zet dezelfde stand en logregels terug, zonder dubbele regels", () => {
  app.S = S0(); resetBaseline();
  app.S.list[1].hp = 2; commit();
  const after = JSON.stringify(app.S);
  const logN = app.S.log.length;
  assert.equal(canRedo(), false);
  assert.equal(undo(), true);
  assert.equal(app.S.list[1].hp, 7);
  assert.equal(canRedo(), true);
  assert.equal(redo(), true);
  assert.equal(JSON.stringify(app.S), after);
  assert.equal(app.S.log.length, logN);
  assert.equal(canRedo(), false);
  assert.equal(canUndo(), true);
  // en weer terug: Opnieuw is een gewone stap
  assert.equal(undo(), true);
  assert.equal(app.S.list[1].hp, 7);
  assert.equal(commit(), false); // render na undo: geen nieuwe stap, Opnieuw blijft
  assert.equal(canRedo(), true);
});

test("GV8: een nieuwe wijziging na Ongedaan leegt Opnieuw; meerdere stappen in volgorde terug", () => {
  app.S = S0(); resetBaseline();
  app.S.list[1].hp = 5; commit();
  app.S.list[1].hp = 3; commit();
  app.S.list[1].hp = 1; commit();
  undo(); undo();
  assert.equal(app.S.list[1].hp, 5);
  redo(); assert.equal(app.S.list[1].hp, 3);
  redo(); assert.equal(app.S.list[1].hp, 1);
  assert.equal(redo(), false);
  undo();
  app.S.list[2].hp = 4; commit();
  assert.equal(canRedo(), false);
  assert.equal(app.S.list[1].hp, 3);
  undo(); clearRedo(); assert.equal(canRedo(), false);
  resetBaseline(); assert.equal(historySize(), 0); assert.equal(canRedo(), false);
});

test("GV8: Opnieuw met sheets (TS2) houdt sheet en geschiedenis intact", () => {
  const sheet = (n) => ({ cls: "Wizard " + n, spells: [{ name: "x".repeat(300) }] });
  app.S = { list: [{ ...pc("Ayla"), sheet: sheet(1) }], round: 0, active: null, log: [] }; resetBaseline();
  app.S.list[0].sheet = sheet(2); commit();
  app.S.list[0].hp = 4; commit();
  undo(); undo();
  assert.equal(app.S.list[0].sheet.cls, "Wizard 1");
  redo(); redo();
  assert.equal(app.S.list[0].sheet.cls, "Wizard 2");
  assert.equal(app.S.list[0].hp, 4);
  undo(); undo();
  assert.equal(app.S.list[0].sheet.cls, "Wizard 1");
});

test("stepEntries: regels die in de nieuwere log staan en niet in de oudere", () => {
  const a = [{ id: "1", msg: "a" }, { id: "2", msg: "b" }];
  assert.deepEqual(stepEntries([...a, { id: "3", msg: "c" }], a).map((e) => e.id), ["3"]);
  assert.deepEqual(stepEntries(a, a), []);
  assert.deepEqual(stepEntries(undefined, a), []);
  assert.deepEqual(stepEntries([{ id: "2", msg: "b" }, { id: "3", msg: "c" }], a).map((e) => e.id), ["3"]); // ingekort
});

test("stepText: eerste regel + aantal, beurtwissel = waar je nu staat, geen regels = algemeen", () => {
  const S = { round: 2, active: "a", list: [{ id: "a", name: "Aram" }] };
  assert.deepEqual(stepText([{ msg: "Goblin 2: 30 → 0 HP (−30)" }], S, "Ongedaan"), { text: "Ongedaan: Goblin 2: 30 → 0 HP (−30)", more: 0 });
  assert.deepEqual(stepText([{ msg: "Goblin 1: −13" }, { msg: "Goblin 2: −13" }, { msg: "Aram: −6" }], S, "Opnieuw"), { text: "Opnieuw: Goblin 1: −13", more: 2 });
  const turn = [{ type: "turn", msg: "Beurt van Noor" }, { msg: "Lotte: Prone voorbij" }];
  assert.equal(stepText(turn, S, "Ongedaan").text, "Terug naar beurt van Aram (ronde 2)");
  assert.equal(stepText(turn, S, "Opnieuw").text, "Opnieuw: beurt van Aram (ronde 2)");
  assert.equal(stepText([], S, "Ongedaan").text, "Ongedaan gemaakt.");
  assert.equal(stepText(undefined, S, "Opnieuw").text, "Opnieuw gedaan.");
  const start = [{ type: "round", msg: "Ronde 1 begint" }, { type: "turn", msg: "Beurt van Aram" }];
  assert.equal(stepText(start, { round: 0, active: null, list: [] }, "Ongedaan").text, "Ongedaan: Start gevecht");
  const end = [{ msg: "Gevecht afgerond: 450 XP" }, { type: "round", msg: "Gevecht gestopt" }];
  assert.equal(stepText(end, S, "Ongedaan").text, "Gevecht loopt weer · beurt van Aram (ronde 2)");
  assert.equal(stepText(end, { round: 0, list: [] }, "Opnieuw").text, "Opnieuw: Gevecht gestopt");
  const long = stepText([{ msg: "x".repeat(200) }], S, "Ongedaan").text;
  assert.ok(long.length <= 80 && long.endsWith("…"));
});

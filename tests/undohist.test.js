import { test } from "node:test";
import assert from "node:assert/strict";
import { restoreHist, HIST_MAX, HIST_AGE, app, commit, undo, resetBaseline, historySize } from "../js/state.js";

const NOW = 1_800_000_000_000;
const row = (n, s, o = {}) => ({ k: "h:" + String(n).padStart(9, "0"), v: "1.0", t: NOW - 60e3, s, b: [], ...o });
const opt = (cur = "nu") => ({ version: "1.0", now: NOW, cur });

test("restoreHist: geldige stappen komen terug, op volgorde", () => {
  const r = restoreHist([row(1, "a"), row(2, "b")], opt());
  assert.deepEqual(r.keep.map((x) => x.s), ["a", "b"]);
  assert.deepEqual(r.drop, []);
});

test("restoreHist: laatste stap ouder dan 6 uur = schone lei; precies 6 uur telt nog", () => {
  const oud = restoreHist([row(1, "a", { t: NOW - HIST_AGE - 1 })], opt());
  assert.deepEqual(oud.keep, []);
  assert.deepEqual(oud.drop, [row(1).k]);
  // de tijd telt vanaf de laatste stap: een oude eerste stap mag mee
  const r = restoreHist([row(1, "a", { t: NOW - 3 * HIST_AGE }), row(2, "b", { t: NOW - HIST_AGE })], opt());
  assert.equal(r.keep.length, 2);
});

test("restoreHist: andere versie, kapotte rijen en klok in de toekomst", () => {
  const r = restoreHist([row(1, "a", { v: "0.9" }), row(2, "b"), null, row(4, "c"), row(5, "d")], opt());
  assert.deepEqual(r.keep.map((x) => x.s), ["c", "d"]); // alleen de laatste aaneengesloten reeks van deze versie
  assert.deepEqual(r.drop, [row(1).k, row(2).k]);
  assert.deepEqual(restoreHist([row(1, "a", { t: NOW + 3600e3 })], opt()).keep, []);
  assert.deepEqual(restoreHist([row(1, "a", { t: "x" })], opt()).keep, []);
  assert.deepEqual(restoreHist(undefined, opt()), { keep: [], drop: [] });
  assert.deepEqual(restoreHist([{ k: 5, s: "x" }], opt()), { keep: [], drop: [] });
});

test("restoreHist: half geschreven stap gelijk aan de huidige stand valt weg; max HIST_MAX", () => {
  const r = restoreHist([row(1, "a"), row(2, "nu")], opt("nu"));
  assert.deepEqual(r.keep.map((x) => x.s), ["a"]);
  assert.deepEqual(r.drop, [row(2).k]);
  const veel = Array.from({ length: HIST_MAX + 5 }, (_, i) => row(i + 1, "s" + i));
  const v = restoreHist(veel, opt());
  assert.equal(v.keep.length, HIST_MAX);
  assert.equal(v.keep[0].s, "s5");
  assert.equal(v.drop.length, 5);
});

test("undo-geschiedenis: commit en undo houden stappen en sleutels gelijk; import (geen boot) wist", () => {
  const pc = { id: "p", name: "Ayla", kind: "pc", init: 12, cond: [], hp: 10, max: 10 };
  app.S = { list: [pc], round: 0, active: null, log: [] };
  resetBaseline();
  for (let hp = 9; hp > 5; hp--) { app.S.list[0].hp = hp; commit(); }
  assert.equal(historySize(), 4);
  undo(); undo();
  assert.equal(app.S.list[0].hp, 8);
  assert.equal(historySize(), 2);
  app.S.list[0].hp = 3; commit();
  assert.equal(historySize(), 3);
  resetBaseline(true); // boot zonder bewaarde geschiedenis (geen IndexedDB in node): leeg
  assert.equal(historySize(), 0);
});

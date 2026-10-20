import { test } from "node:test";
import assert from "node:assert/strict";
import { pack, unpack, keyFor } from "../js/histpack.js";
import { restoreHist, app, commit, undo, resetBaseline, historySize, histBlobs, HIST_MAX } from "../js/state.js";

const none = () => undefined;
const sheet = (n = 1) => ({ cls: "Wizard " + n, spells: Array.from({ length: 30 }, (_, i) => ({ name: "Spell " + i, notes: "x".repeat(200) })) });

test("pack/unpack: sheet en portret apart, terug identiek; zonder sheet ongewijzigd", () => {
  const S = { round: 1, list: [{ id: "p", name: "Ayla", sheet: sheet(), img: "data:image/jpeg;base64,AAAA" }, { id: "m", name: "Goblin", sheet: null }], log: [] };
  const p = pack(S, none);
  assert.equal(p.refs.size, 2);
  assert.ok(!p.j.includes("Spell 3"));
  assert.deepEqual(unpack(p.j, (k) => p.refs.get(k)), S);
  assert.equal(pack({ list: [{ id: "x" }] }, none).j, JSON.stringify({ list: [{ id: "x" }] }));
  assert.equal(S.list[0].sheet.cls, "Wizard 1"); // origineel niet aangepast
});

test("pack: zelfde sheet bij twee spelers = één sleutel; ontbrekende verwijzing = null", () => {
  const S = { list: [{ id: "a", sheet: sheet() }, { id: "b", sheet: sheet() }] };
  const p = pack(S, none);
  assert.equal(p.refs.size, 1);
  assert.equal(unpack(p.j, () => undefined), null);
});

test("keyFor: botsing (zelfde sleutel, andere inhoud) krijgt een eigen sleutel", () => {
  const k = keyFor("abc", none);
  assert.equal(keyFor("abc", (x) => (x === k ? "abc" : undefined)), k);
  const k2 = keyFor("abc", (x) => (x === k ? "iets anders" : undefined));
  assert.notEqual(k2, k);
});

test("restoreHist: stap met ontbrekende sheet: alleen wat erna komt", () => {
  const NOW = 1_800_000_000_000;
  const row = (n, b) => ({ k: "h:" + String(n).padStart(9, "0"), v: "1.0", t: NOW - 60e3, s: "s" + n, b });
  const r = restoreHist([row(1, ["a"]), row(2, ["weg"]), row(3, ["a"])], { version: "1.0", now: NOW, cur: "nu", has: (k) => k === "a" });
  assert.deepEqual(r.keep.map((x) => x.s), ["s3"]);
  assert.equal(r.drop.length, 2);
  // rij zonder b (oud formaat) telt niet
  assert.deepEqual(restoreHist([{ ...row(1, []), b: undefined }], { version: "1.0", now: NOW, cur: "nu" }).keep, []);
});

test("undo-geschiedenis: sheet één keer bewaard, undo zet hem terug, opruimen bij inkorten en undo", () => {
  const pc = { id: "p", name: "Ayla", kind: "pc", init: 12, cond: [], hp: 30, max: 30, sheet: sheet(1) };
  app.S = { list: [pc], round: 0, active: null, log: [] };
  resetBaseline();
  for (let hp = 29; hp > 24; hp--) { app.S.list[0].hp = hp; commit(); }
  assert.equal(historySize(), 5);
  assert.equal(histBlobs(), 1); // vijf stappen, één sheet
  app.S.list[0].sheet = sheet(2); commit(); // level-up: nieuwe sheet
  app.S.list[0].hp = 20; commit();
  assert.equal(histBlobs(), 2);
  undo(); undo();
  assert.equal(app.S.list[0].sheet.cls, "Wizard 1");
  assert.equal(app.S.list[0].hp, 25);
  assert.equal(histBlobs(), 1); // sheet 2 zit in geen stap meer
  app.S.list[0].sheet.cls = "Wizard 9"; commit(); // in-place wijziging telt ook
  undo();
  assert.equal(app.S.list[0].sheet.cls, "Wizard 1");
  // inkorten tot HIST_MAX: oude sheet verdwijnt als geen stap er nog naar verwijst
  app.S.list[0].sheet = sheet(3); commit();
  for (let i = 0; i < HIST_MAX + 2; i++) { app.S.list[0].hp = i % 2 ? 10 : 11; commit(); }
  assert.equal(historySize(), HIST_MAX);
  assert.equal(histBlobs(), 1);
  undo();
  assert.equal(app.S.list[0].sheet.cls, "Wizard 3");
  resetBaseline();
  assert.equal(histBlobs(), 0);
});

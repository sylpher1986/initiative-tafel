import { test } from "node:test";
import assert from "node:assert/strict";
import { addEnc, encName, cleanEnc, tidy, startFight, endSummary, endCalc, endText, toggleFlip } from "../js/rules/fight.js";
import { clearMonsters } from "../js/rules/turns.js";
import { app, commit, logAs, relog, resetBaseline, undo } from "../js/state.js";
import { parseImport } from "../js/backup.js";

const LIB = { Goblin: { cr: "1/4" }, Hobgoblin: { cr: "1/2" }, Thing: { cr: "" }, Ogre: { cr: "2" } };
const find = (r) => LIB[r];
const mon = (id, ref, hp = 7, x = {}) => ({ id, name: id, kind: "monster", ref, init: 10, dex: 0, ac: 15, hp, max: 7, cond: [], ...x });
const pc = (id, hp = 10, x = {}) => ({ id, name: id, kind: "pc", init: 12, cond: [], hp, max: 10, ...x });

test("addEnc: Vervangen = alleen de nieuwe, Toevoegen = erbij (zelfde naam niet dubbel), max 5", () => {
  const S = { list: [] };
  addEnc(S, { name: "Brug", notes: "vluchten" }, false);
  addEnc(S, { name: "Versterking", notes: "" }, false);
  assert.equal(encName(S), "Brug + Versterking");
  addEnc(S, { name: "Brug", notes: "nieuw" }, false);
  assert.equal(encName(S), "Versterking + Brug");
  assert.equal(S.enc[1].notes, "nieuw");
  addEnc(S, { name: "Grot", notes: "" }, true);
  assert.deepEqual(S.enc, [{ name: "Grot", notes: "" }]);
  for (let i = 0; i < 8; i++) addEnc(S, { name: "E" + i, notes: "" }, false);
  assert.equal(S.enc.length, 5);
});

test("cleanEnc: alleen naam en notitie, rommel eruit", () => {
  assert.deepEqual(cleanEnc([{ name: " A ", notes: 5, x: 1 }, null, { name: "" }, "x"]), [{ name: "A", notes: "5" }]);
  assert.deepEqual(cleanEnc("nee"), []);
});

test("tidy: spelers op 0 HP tijdens het gevecht onthouden (één keer); encounter vergeten zonder monsters of lair", () => {
  const S = { list: [pc("Ayla"), mon("g1", "Goblin")], round: 1, enc: [{ name: "Brug", notes: "" }] };
  startFight(S, 1000);
  tidy(S); assert.deepEqual(S.fight.down, []);
  S.list[0].hp = 0; tidy(S); tidy(S);
  assert.deepEqual(S.fight.down, [{ id: "Ayla", name: "Ayla" }]);
  S.round = 0; S.list.push(pc("Brom", 0)); tidy(S); // buiten een gevecht telt niets
  assert.equal(S.fight.down.length, 1);
  S.list = S.list.filter((c) => c.kind === "pc"); tidy(S);
  assert.equal(S.enc, undefined);
  // gevecht van vóór 1.31.0: fight ontbreekt, wordt aangemaakt zonder duur
  const T = { list: [pc("X", 0)], round: 2 }; tidy(T);
  assert.deepEqual(T.fight, { t0: 0, down: [{ id: "X", name: "X" }] });
  // lair alleen houdt de encounter
  const U = { list: [{ id: "l", kind: "lair", name: "Lair" }], enc: [{ name: "Lair", notes: "" }] }; tidy(U);
  assert.equal(U.enc.length, 1);
});

test("clearMonsters wist samenvatting en ingeladen encounter", () => {
  const S = { list: [pc("A"), mon("g1", "Goblin")], round: 0, active: null, enc: [{ name: "x", notes: "" }], endSum: { r: 1 } };
  clearMonsters(S);
  assert.equal(S.enc, undefined); assert.equal(S.endSum, undefined);
});

test("endSummary/endCalc: verslagen = 0 HP, gevlucht meetellen, delen zonder doden, XP per speler naar beneden", () => {
  const S = { round: 4, list: [
    pc("Ayla"), pc("Brom", 0, { ds: { s: 0, f: 3, dead: true } }), pc("Cas", 4),
    mon("Goblin 1", "Goblin", 0), mon("Goblin 2", "Goblin", 0), mon("Hob", "Hobgoblin", 0),
    mon("Goblin 3", "Goblin", 5), mon("Spion", "Goblin", 7, { hidden: true }), mon("Ding", "Thing", 0),
  ], enc: [{ name: "Brug", notes: "" }] };
  startFight(S, 1000);
  S.fight.down.push({ id: "Cas", name: "Cas" }, { id: "Brom", name: "Brom" });
  const es = endSummary(S, find, 1000 + 23 * 60000 + 20000);
  assert.equal(es.min, 23); assert.equal(es.r, 4); assert.equal(es.enc, "Brug");
  assert.ok(!es.mons.some((m) => m.id === "Spion"), "levend verborgen monster telt niet");
  let k = endCalc(es);
  assert.equal(k.xp, 50 + 50 + 100);
  assert.deepEqual(k.by, [["Goblin", 2], ["Hobgoblin", 1], ["Thing", 1]]);
  assert.deepEqual(k.noXp, ["Thing"]);
  assert.deepEqual(k.share.map((p) => p.id), ["Ayla", "Cas"]);
  assert.equal(k.per, 100);
  assert.deepEqual(k.down, [{ name: "Cas", up: true }]); // Brom is dood: staat onder Gestorven
  assert.deepEqual(k.dead, ["Brom"]);
  toggleFlip(es, "Goblin 3"); toggleFlip(es, "Brom"); toggleFlip(es, "Hob");
  k = endCalc(es);
  assert.equal(k.xp, 150); assert.equal(k.per, 50);
  toggleFlip(es, "Goblin 3"); assert.equal(endCalc(es).xp, 100);
  const t = endText(es);
  assert.match(t, /^Brug: 4 rondes \(± 23 min\)\. Verslagen: 2× Goblin, Thing\. 100 XP, 33 per speler \(Ayla, Brom, Cas\)\. Zonder CR niet geteld: Thing\. Neer geweest: Cas \(stond weer op\)\. Gestorven: Brom\.$/);
});

test("endText: niets verslagen, niemand deelt, geen duur", () => {
  const S = { round: 1, list: [mon("o", "Ogre", 7)] };
  const es = endSummary(S, find, 5);
  assert.equal(es.min, 0);
  assert.equal(endText(es), "Gevecht afgerond: 1 ronde. Niets verslagen. 0 XP, niemand deelt.");
});

test("logAs met key + relog: samenvatting in het logboek, bij te werken; undo van het afronden haalt hem weg", () => {
  app.S = { list: [pc("A")], round: 2, active: null, log: [] };
  resetBaseline();
  app.S.round = 0; logAs("Gevecht afgerond: 2 rondes.", "end");
  commit();
  assert.deepEqual(app.S.log.map((e) => [e.msg, e.key]), [["Gevecht gestopt", undefined], ["Gevecht afgerond: 2 rondes.", "end"]]);
  relog("end", "nieuw"); app.S.endSum = { flip: ["x"] }; commit();
  assert.equal(app.S.log.at(-1).msg, "nieuw");
  assert.equal(app.S.log.length, 2);
  undo(); undo();
  assert.equal(app.S.round, 2); assert.equal(app.S.log.length, 0);
});

test("backup-import houdt de ingeladen encounter (opgeschoond), niet de samenvatting", () => {
  const r = parseImport(({ format: "initiative-tafel", version: 2, state: { list: [], round: 0, enc: [{ name: "Brug", notes: "x", evil: 1 }], endSum: { r: 1 }, fight: {} } }));
  assert.deepEqual(r.S.enc, [{ name: "Brug", notes: "x" }]);
  assert.equal(r.S.endSum, undefined); assert.equal(r.S.fight, undefined);
});

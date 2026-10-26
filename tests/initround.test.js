import { nl } from "./_nl.js"; // WP27: Nederlandse catalogus; nl = descriptor als tekst
import { test } from "node:test";
import assert from "node:assert/strict";
import { startCombat, step, stopCombat, nextUp, sortOrder, setInit, initPlan, initText, turnOrder, removeCombatant } from "../js/rules/turns.js";

const pc = (id, init, o = {}) => ({ id, name: id, kind: "pc", init, dex: 1, ac: 15, hp: 20, max: 30, cond: [], ...o });
const mon = (id, init, o = {}) => ({ id, name: id, kind: "monster", ref: "Goblin", init, dex: 2, ac: 15, hp: 7, max: 7, cond: [], ...o });
const rng = () => 0.5;
const by = (S, id) => S.list.find((c) => c.id === id);
/** Beurten tot en met ronde r (ids) vanaf de huidige beurt */
const turns = (S, n) => { const t = []; for (let k = 0; k < n; k++) { step(S, 1, rng); t.push(`${S.round}:${S.active}`); } return t; };

const party = () => ({ round: 0, active: null, saves: [], list: [pc("bram", 12), mon("gob", 8), pc("noor", 5), mon("orc", 2)] });

test("RE9: verlagen na de eigen beurt → deze ronde niet nog eens, volgende ronde op de nieuwe plek", () => {
  const S = party();
  startCombat(S, rng); step(S, 1, rng); step(S, 1, rng);
  assert.equal(S.active, "noor");
  const r = setInit(S, by(S, "bram"), 4);
  assert.equal(r.plan.skip, true);
  assert.match(r.msgs[0], /bram: al geweest deze ronde: speelt pas volgende ronde op 4/);
  assert.equal(by(S, "bram").skipR, 1);
  assert.equal(nextUp(S, sortOrder(S.list), S.active).id, "orc", "volgende in de beurtbalk is orc, niet bram");
  assert.deepEqual(turns(S, 5), ["1:orc", "2:gob", "2:noor", "2:bram", "2:orc"]);
  assert.equal(by(S, "bram").skipR, undefined, "weg na de rondegrens");
});

test("RE9: overgeslagen plek telt geen beurtgrenzen (condities lopen niet twee keer af)", () => {
  const S = party();
  startCombat(S, rng); // bram aan de beurt
  const b = by(S, "bram"); b.cond = ["Frightened"]; b.cd = { Frightened: { kind: "rounds", who: "bram", at: "start", count: 2 } };
  step(S, 1, rng); step(S, 1, rng); // noor
  setInit(S, b, 4);
  step(S, 1, rng); // bram overgeslagen → orc
  assert.equal(S.active, "orc");
  assert.equal(b.cd.Frightened.count, 2, "geen extra start-van-beurt");
});

test("RE9: wie aan de beurt is verlaagt zijn eigen init → niemand overgeslagen, beurt komt niet terug", () => {
  const S = party();
  startCombat(S, rng); // bram 12
  const r = setInit(S, by(S, "bram"), 4);
  assert.equal(r.plan.own, true); assert.equal(by(S, "bram").atR.r, 1, "houdt deze ronde zijn plek");
  assert.match(nl(initText(r.plan, 4)), /beurt loopt door, volgende ronde op 4/);
  assert.equal(nextUp(S, sortOrder(S.list), S.active).id, "gob");
  assert.deepEqual(turns(S, 6), ["1:gob", "1:noor", "1:orc", "2:gob", "2:noor", "2:bram"]);
});

test("RE9: wie aan de beurt is verhoogt → beurt loopt door vanaf de oude plek", () => {
  const S = party();
  startCombat(S, rng); step(S, 1, rng); step(S, 1, rng); // noor 5
  const r = setInit(S, by(S, "noor"), 15);
  assert.equal(r.plan.own, true); assert.equal(r.plan.skip, false);
  assert.deepEqual(turns(S, 4), ["1:orc", "2:noor", "2:bram", "2:gob"]);
});

test("RE9: nog niet geweest en vóór de beurt gezet → direct na de huidige beurt, daarna op de nieuwe plek", () => {
  const S = party();
  startCombat(S, rng); step(S, 1, rng); // gob 8
  const r = setInit(S, by(S, "orc"), 15);
  assert.equal(r.plan.next, true);
  assert.match(r.msgs[0], /orc: nog niet geweest: komt direct na gob, daarna op 15/);
  assert.equal(nextUp(S, sortOrder(S.list), S.active).id, "orc");
  assert.deepEqual(turns(S, 5), ["1:orc", "1:noor", "2:orc", "2:bram", "2:gob"]);
  assert.equal(by(S, "orc").nextR, undefined, "weg na de rondegrens");
});

test("RE9: ingeschoven beurt en ‹ Vorige gaan heen en terug", () => {
  const S = party();
  startCombat(S, rng); step(S, 1, rng); // gob
  setInit(S, by(S, "orc"), 15);
  step(S, 1, rng); assert.equal(S.active, "orc");
  step(S, -1, rng); assert.equal(S.active, "gob");
  step(S, 1, rng); assert.equal(S.active, "orc");
  step(S, 1, rng); assert.equal(S.active, "noor");
  // na de ingeschoven beurt: orc is geweest; nog eens verlagen = deze ronde overgeslagen
  const p = initPlan(S, by(S, "orc"), 1);
  assert.equal(p.skip, true); assert.equal(p.next, false);
});

test("RE9: ingeschoven deelnemer weer terugzetten → geen inschuiven meer", () => {
  const S = party();
  startCombat(S, rng); step(S, 1, rng); // gob
  setInit(S, by(S, "orc"), 15);
  const r = setInit(S, by(S, "orc"), 3);
  assert.equal(r.plan.back, true);
  assert.equal(by(S, "orc").nextR, undefined);
  assert.deepEqual(turns(S, 2), ["1:noor", "1:orc"]);
});

test("RE9: verlaagd en weer terug vóór de beurt → skipR weg", () => {
  const S = party();
  startCombat(S, rng); step(S, 1, rng); step(S, 1, rng); // noor
  setInit(S, by(S, "bram"), 4);
  const r = setInit(S, by(S, "bram"), 12);
  assert.equal(r.plan.back, true);
  assert.equal(by(S, "bram").skipR, undefined);
  assert.deepEqual(turns(S, 2), ["1:orc", "2:bram"]);
});

test("RE9: wijziging die niets aan de ronde verandert → geen melding, geen vlag", () => {
  const S = party();
  startCombat(S, rng); step(S, 1, rng); // gob
  const r = setInit(S, by(S, "noor"), 3); // nog niet geweest, blijft na gob
  assert.deepEqual(r.msgs, []);
  assert.deepEqual(initPlan({ round: 0, list: S.list }, by(S, "noor"), 20), { own: false, skip: false, next: false, back: false });
  assert.equal(by(S, "noor").skipR, undefined); assert.equal(by(S, "noor").nextR, undefined);
});

test("RE9: twee keer inschuiven na dezelfde beurt en een ketting", () => {
  const S = { round: 0, active: null, saves: [], list: [pc("a", 20), pc("b", 15), mon("x", 5), mon("y", 3)] };
  startCombat(S, rng); step(S, 1, rng); // b
  setInit(S, by(S, "y"), 18);
  setInit(S, by(S, "x"), 19);
  assert.deepEqual(turnOrder(S, sortOrder(S.list)).map((c) => c.id), ["a", "b", "x", "y"]);
  assert.deepEqual(turns(S, 4), ["1:x", "1:y", "2:a", "2:x"]);
});

test("RE9: anker verwijderd → ingeschoven beurt komt na de voorganger", () => {
  const S = party();
  startCombat(S, rng); step(S, 1, rng); // gob
  setInit(S, by(S, "orc"), 15);
  removeCombatant(S, "gob", rng); // gob was aan de beurt: eerst door (naar orc), dan weg
  assert.equal(S.active, "orc");
  assert.deepEqual(turns(S, 3), ["1:noor", "2:orc", "2:bram"]);
});

test("RE9: stopCombat ruimt beurtplek en vlaggen op", () => {
  const S = party();
  startCombat(S, rng); step(S, 1, rng);
  setInit(S, by(S, "orc"), 15); setInit(S, by(S, "bram"), 1);
  stopCombat(S);
  assert.ok(S.list.every((c) => c.skipR === undefined && c.nextR === undefined));
  assert.equal(S.ai, undefined);
});

test("RE9 (review): anker wijzigt zelf zijn init → ingeschoven beurt blijft op de plek van toen, niemand dubbel of overgeslagen", () => {
  // anker is aan de beurt en verlaagt eigen init vóór de ingeschoven beurt
  let S = party();
  startCombat(S, rng); step(S, 1, rng); // gob
  setInit(S, by(S, "orc"), 15); setInit(S, by(S, "gob"), 1);
  assert.deepEqual(turns(S, 4), ["1:orc", "1:noor", "2:orc", "2:bram"]);
  // ingeschoven beurt is gespeeld, anker (al geweest) verlaagt daarna
  S = party();
  startCombat(S, rng); step(S, 1, rng); setInit(S, by(S, "orc"), 15); step(S, 1, rng); step(S, 1, rng); // noor
  setInit(S, by(S, "gob"), 1);
  assert.deepEqual(turns(S, 4), ["2:orc", "2:bram", "2:noor", "2:gob"]);
  // tijdens de ingeschoven beurt verlaagt het anker
  S = party();
  startCombat(S, rng); step(S, 1, rng); setInit(S, by(S, "orc"), 15); step(S, 1, rng); // orc (ingeschoven)
  setInit(S, by(S, "gob"), 1);
  assert.deepEqual(turns(S, 2), ["1:noor", "2:orc"]);
});

test("RE9 (review): beurtplek S.ai en nextR.ai gaan mee door import", async () => {
  const { parseImport: importData } = await import("../js/backup.js");
  const S = party();
  startCombat(S, rng); step(S, 1, rng); setInit(S, by(S, "orc"), 15); setInit(S, by(S, "gob"), 1);
  const r = importData({ format: "initiative-tafel", version: 2, state: JSON.parse(JSON.stringify(S)) });
  assert.equal(r.S.ai, 8);
  assert.equal(r.S.list.find((c) => c.id === "orc").nextR.ai, 8);
});

test("RE9: eigen init verlaagd, Volgende en ‹ Vorige → terug bij hem (niet overgeslagen)", () => {
  const S = party();
  startCombat(S, rng); step(S, 1, rng); // gob 8
  setInit(S, by(S, "gob"), 1);
  step(S, 1, rng); assert.equal(S.active, "noor");
  step(S, -1, rng); assert.equal(S.active, "gob", "Vorige komt bij gob");
  assert.deepEqual(turns(S, 4), ["1:noor", "1:orc", "2:bram", "2:noor"]);
  assert.deepEqual(turns(S, 2), ["2:orc", "2:gob"], "ronde 2 op 1");
  assert.equal(by(S, "gob").atR, undefined);
});

test("RE9: eigen init gewijzigd, daarna (na de beurt) nog eens verlaagd → gewone regels", () => {
  const S = party();
  startCombat(S, rng); step(S, 1, rng); // gob 8
  setInit(S, by(S, "gob"), 6); // blijft deze ronde op 8
  step(S, 1, rng); // noor
  const r = setInit(S, by(S, "gob"), 1);
  assert.equal(r.plan.skip, true);
  assert.deepEqual(turns(S, 3), ["1:orc", "2:bram", "2:noor"]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { laOptions, laStatus, laList, useLA } from "../js/rules/legendary.js";
import { monsterActions } from "../js/rules/attacks.js";
import { legInfo } from "../js/rules/spells.js";
import { step, startCombat } from "../js/rules/turns.js";
import { cleanCombatant } from "../js/backup.js";

const SRD = JSON.parse(readFileSync(new URL("../data/monsters.json", import.meta.url)));
const mon = (n) => SRD.find((m) => m.n === n);
const dragon = (extra = {}) => ({ id: "d", name: "Draak", kind: "monster", ref: "Adult Black Dragon", init: 10, dex: 2, hp: 195, max: 195, cond: [], ...legInfo(mon("Adult Black Dragon")), ...extra });
const pc = (id, init) => ({ id, name: id, kind: "pc", init, dex: 0, hp: 20, max: 20, cond: [] });
const fight = (list, active, round = 1) => ({ list, active, round });

test("opties: kosten uit de naam, eigen worp en verwijzing naar een aanval", () => {
  const o = laOptions(mon("Adult Black Dragon"));
  assert.deepEqual(o.map((x) => [x.n, x.cost]), [["Detect", 1], ["Tail Attack", 1], ["Wing Attack", 2]]);
  assert.equal(o[0].act, null); assert.deepEqual(o[0].refs, []);
  assert.deepEqual(o[1].refs.map((a) => a.n), ["Tail"]);
  assert.equal(o[1].refs[0].hit, 11);
  assert.deepEqual(o[2].act.dc, { n: 19, ab: "DEX" });
  assert.deepEqual(o[2].act.dmg, [{ e: "2d6+6", type: "bludgeoning" }]);
  assert.equal(laOptions(mon("Adult Black Dragon")), o, "cache per monster-object");
});

test("verwijzingen: 'uses its X', 'one claw attack or tail attack'", () => {
  const lich = laOptions(mon("Lich")).find((x) => /paralyzing/i.test(x.n));
  assert.equal(lich.cost, 2);
  assert.deepEqual(lich.refs.map((a) => a.n), ["Paralyzing Touch"]);
  for (const m of SRD) for (const o of laOptions(m)) {
    assert.ok(o.cost >= 1 && o.cost <= 3, `${m.n}: ${o.n}`);
    assert.ok(!/costs/i.test(o.n), `${m.n}: kosten uit de naam`);
  }
});

test("monsterkaart: kosten als tag, niet in de naam", () => {
  const w = monsterActions(mon("Adult Black Dragon")).other.find((a) => /wing/i.test(a.n));
  assert.equal(w.n, "Wing Attack");
  assert.equal(w.tag, "Legendary · 2 LA");
});

test("rare of lege statblocks geven geen fout", () => {
  assert.deepEqual(laOptions(null), []);
  assert.deepEqual(laOptions({ l: [null, ["X"], ["Y (Costs 9 Actions)", "doet iets"]] }).map((x) => [x.n, x.cost]), [["X", 1], ["Y", 3]]);
});

test("status: alleen in een gevecht, niet zelf aan de beurt, niet op, niet incapacitated, niet neer", () => {
  const c = dragon();
  assert.equal(laStatus(c, fight([c], "p", 0)), null, "geen gevecht");
  assert.equal(laStatus(c, fight([c], "p")), "ok");
  assert.equal(laStatus(c, fight([c], "d")), "own");
  assert.equal(laStatus({ ...c, cond: ["Stunned"] }, fight([c], "p")), "inc");
  assert.equal(laStatus({ ...c, la: { max: 3, left: 0 } }, fight([c], "p")), "empty");
  assert.equal(laStatus({ ...c, hp: 0 }, fight([c], "p")), null, "dood");
  assert.equal(laStatus(pc("p", 15), fight([], "p")), null, "geen LA");
  assert.deepEqual(laList(fight([c], "p"), [pc("p", 15), c]).map((x) => x.id), ["d"]);
});

test("gebruiken: kosten aftrekken, te duur of niet mogelijk = geen wijziging", () => {
  const c = dragon(), S = fight([c, pc("p", 15)], "p");
  const [, tail, wing] = laOptions(mon("Adult Black Dragon"));
  let r = useLA(c, wing, S);
  assert.equal(c.la.left, 1);
  assert.match(r.why[0].t, /Wing Attack \(2 LA\)/);
  r = useLA(c, wing, S);
  assert.equal(c.la.left, 1); assert.equal(r.why.length, 0); assert.match(r.msgs[0], /kost 2 LA/);
  useLA(c, tail, S); assert.equal(c.la.left, 0);
  r = useLA(c, tail, S); assert.equal(c.la.left, 0); assert.equal(r.why.length, 0);
  c.la.left = 3;
  useLA(c, tail, fight(S.list, "d")); assert.equal(c.la.left, 3, "eigen beurt");
});

test("herstel bij de start van de eigen beurt", () => {
  const c = dragon({ init: 10 }), S = fight([pc("p", 15), c], "p");
  c.la.left = 0;
  step(S, 1, () => 0.5);
  assert.equal(S.active, "d");
  assert.equal(c.la.left, 3);
});

test("import: rare LA-waarden worden opgeschoond", () => {
  const la = (v) => cleanCombatant({ kind: "monster", name: "X", hp: 10, max: 10, la: v }).la;
  assert.deepEqual(la({ max: 3, left: 7 }), { max: 3, left: 3 }, "left > max");
  assert.deepEqual(la({ max: 1e9, left: 1e9 }), { max: 20, left: 20 }, "geen enorme lus in render");
  assert.deepEqual(la({ max: -2, left: "x" }), { max: 0, left: 0 });
  assert.deepEqual(la({ max: 2.7, left: 1.5 }), { max: 2, left: 1 });
  assert.equal(la(null), null);
  assert.equal(laStatus({ id: "x", kind: "monster", hp: 10, cond: [], la: la({ max: 0, left: 3 }) }, fight([], "p")), null, "max 0 = geen LA");
});

test("nieuw gevecht: legendary actions vol, ook als het monster niet als eerste gaat", () => {
  const c = dragon({ init: 10 }), S = { list: [pc("p", 15), c], active: null, round: 0 };
  c.la.left = 1;
  startCombat(S, () => 0.5);
  assert.equal(S.active, "p");
  assert.equal(c.la.left, 3);
});

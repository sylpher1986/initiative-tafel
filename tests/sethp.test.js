import { test } from "node:test";
import assert from "node:assert/strict";
import { setHp, startConc } from "../js/rules/combat.js";

const pc = (o = {}) => ({ id: "p", name: "Ayla", kind: "pc", init: 10, hp: 20, max: 24, temp: 0, cond: [], ...o });
const mon = (o = {}) => ({ id: "m", name: "Goblin 1", kind: "monster", init: 12, hp: 7, max: 7, temp: 0, cond: [], ...o });

test("setHp: speler genezen en beschadigen zonder gevolgen, begrensd op 0..max", () => {
  const c = pc({ temp: 5 });
  setHp(c, 22); assert.equal(c.hp, 22); assert.equal(c.temp, 5);
  setHp(c, 40); assert.equal(c.hp, 24);
  setHp(c, 3); assert.equal(c.hp, 3); assert.equal(c.ds, undefined);
  setHp(c, -4); assert.equal(c.hp, 0);
});

test("setHp: speler naar 0 = bewusteloos met death saves, concentratie weg, geen instant death", () => {
  const c = pc({ hp: 5 });
  startConc(c, "Bless");
  const out = setHp(c, 0);
  assert.equal(c.hp, 0);
  assert.deepEqual(c.ds, { s: 0, f: 0, stable: false, dead: false });
  assert.ok(c.cond.includes("Unconscious"));
  assert.ok(!c.cond.includes("Concentrating"));
  assert.ok(out.msgs.length);
});

test("setHp: speler van 0 terug = death saves weg, niet meer bewusteloos; dood blijft dood", () => {
  const c = pc({ hp: 0, ds: { s: 1, f: 2, stable: false, dead: false }, cond: ["Unconscious"] });
  setHp(c, 6);
  assert.equal(c.hp, 6); assert.equal(c.ds, null); assert.ok(!c.cond.includes("Unconscious"));
  const d = pc({ hp: 0, ds: { s: 0, f: 3, stable: false, dead: true } });
  setHp(d, 10);
  assert.equal(d.hp, 0);
});

test("setHp: monster, geen HP bekend en gelijke waarde", () => {
  const m = mon();
  startConc(m, "Hold Person");
  setHp(m, 0); assert.equal(m.hp, 0); assert.ok(!m.cond.includes("Concentrating"));
  setHp(m, 4); assert.equal(m.hp, 4);
  const u = pc({ hp: 0, max: 0 });
  assert.deepEqual(setHp(u, 10), { msgs: [], why: [] }); assert.equal(u.hp, 0);
  const s = pc();
  assert.deepEqual(setHp(s, 20), { msgs: [], why: [] });
});

// WP12: afwerking (AF11, RE15, …)
import { test } from "node:test";
import assert from "node:assert/strict";
import { exportName } from "../js/backup.js";
import { dsResult, rollDs } from "../js/rules/combat.js";
import { spellTargets } from "../js/rules/spellcast.js";

const pc = (o = {}) => ({ id: "p", kind: "pc", name: "Aria", hp: 0, max: 20, cond: ["Unconscious"], ds: { s: 0, f: 0, stable: false, dead: false }, ...o });

test("AF11: exportnaam in lokale tijd", () => {
  const t = new Date(2026, 0, 2, 3, 4); // lokaal 2 jan 03:04
  assert.equal(exportName(t), "initiative-tafel-2026-01-02-03-04.json");
});

test("AF11: dode wezens niet in de casterlijst", () => {
  const L = [{ id: "a", kind: "pc", hp: 5, max: 10 }, { id: "b", kind: "monster", hp: 0, max: 7 }, { id: "c", kind: "lair" },
    { id: "d", kind: "pc", hp: 0, max: 10, ds: { dead: true } }];
  assert.deepEqual(spellTargets(L).map((c) => c.id), ["a"]);
});

test("RE15: getypte worp telt als death save", () => {
  const a = pc(); dsResult(a, 12); assert.equal(a.ds.s, 1);
  const b = pc(); dsResult(b, 9); assert.equal(b.ds.f, 1);
  const c = pc(); dsResult(c, 10); assert.equal(c.ds.s, 1, "10 is een success");
  const d = pc(); dsResult(d, 1); assert.equal(d.ds.f, 2);
  const e = pc(); const fx = dsResult(e, 20); assert.equal(e.hp, 1); assert.equal(e.ds, null); assert.ok(!e.cond.includes("Unconscious"));
  assert.match(fx.why[0].t, /speler rolde \[20\]/);
  const f = pc({ ds: { s: 0, f: 2, stable: false, dead: false } }); dsResult(f, 1); assert.equal(f.ds.f, 3); assert.equal(f.ds.dead, true);
});

test("RE15: ongeldige worp of niet op 0 HP doet niets", () => {
  for (const r of [0, 21, 2.5, NaN, null, "12"]) { const c = pc(); const fx = dsResult(c, r); assert.equal(c.ds.s + c.ds.f, 0); assert.equal(fx.why.length, 0); }
  const up = pc({ hp: 3 }); dsResult(up, 5); assert.equal(up.ds.f, 0);
  const dead = pc({ ds: { s: 0, f: 3, stable: false, dead: true } }); dsResult(dead, 20); assert.equal(dead.hp, 0);
  const st = pc({ ds: { s: 3, f: 0, stable: true, dead: false } }); dsResult(st, 2); assert.equal(st.ds.f, 0);
});

test("RE15: Rol death save gebruikt dezelfde regels", () => {
  const c = pc(); const fx = rollDs(c, () => 0.6); // d20 = 13
  assert.equal(c.ds.s, 1); assert.match(fx.why[0].t, /death save d20 \[13\]/);
});

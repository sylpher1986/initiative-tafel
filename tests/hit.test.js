import { test } from "node:test";
import assert from "node:assert/strict";
import { rollAttack, rollDmgCrit, atkResult, atkText, atkWhy, partText, atkDamage, partsKey, dmgKey } from "../js/rules/attacks.js";
import { rollExpr } from "../js/rules/dice.js";

/** rng die vaste d20-waarden geeft (1..20) */
const seq = (...v) => { let i = 0; return () => (v[i++ % v.length] - 1) / 20 + 0.001; };
/** roll met vaste dobbelstenen per worp: elke dobbelsteen geeft de volgende waarde uit de lijst */
const dice = (...v) => { let i = 0; return (e) => rollExpr(e, () => { const n = +String(e).match(/d(\d+)/)[1]; return (v[i++ % v.length] - 1) / n + 0.0001; }); };

test("to hit: advantage pakt de hoogste, disadvantage de laagste", () => {
  assert.deepEqual(rollAttack(5, 0, seq(12)), { d: [12], adv: 0, nat: 12, bo: 5, tot: 17 });
  assert.equal(rollAttack(5, 1, seq(4, 15)).nat, 15);
  assert.equal(rollAttack(5, -1, seq(4, 15)).nat, 4);
  assert.equal(atkText(rollAttack(-1, 1, seq(4, 15)), 16), "d20 [4, 15] −1 = 14 vs AC 16");
});

test("natuurlijke 20 raakt altijd en is kritiek; natuurlijke 1 mist altijd", () => {
  const parts = rollDmgCrit("1d8+3:piercing", dice(5, 7));
  const hi = atkResult({ d: [20], nat: 20, bo: 0, tot: 20 }, 30, parts);
  assert.equal(hi.hit, true); assert.equal(hi.crit, true);
  const lo = atkResult({ d: [1], nat: 1, bo: 30, tot: 31 }, 10, parts);
  assert.equal(lo.hit, false); assert.equal(lo.dealt, 0);
  const eq = atkResult({ d: [10], nat: 10, bo: 6, tot: 16 }, 16, parts);
  assert.equal(eq.hit, true, "gelijk aan AC raakt"); assert.equal(eq.crit, false);
});

test("crit: alleen de dice dubbel, modifier en vaste schade niet", () => {
  const parts = rollDmgCrit("2d10+6:piercing|1d8:acid", dice(7, 3, 5, 4, 9, 2));
  // normaal: 7+3+6 = 16 piercing, 5 acid; extra crit-dice: 4, 9 en 2
  const n = atkResult({ d: [15], nat: 15, bo: 11, tot: 26 }, 16, parts);
  assert.equal(n.dealt, 21);
  const c = atkResult({ d: [20], nat: 20, bo: 11, tot: 31 }, 16, parts);
  assert.equal(c.dealt, 16 + 13 + 5 + 2);
  assert.equal(partText(parts[0], true), "2d10+6 [7, 3 | 4, 9] = 29 piercing");
  assert.equal(partText(parts[0], false), "2d10+6 [7, 3] = 16 piercing");
  const flat = rollDmgCrit("1:piercing|3d4:poison", dice(2));
  assert.equal(atkResult({ d: [20], nat: 20, bo: 0, tot: 20 }, 10, flat).dealt, 1 + 6 + 6);
  assert.equal(partText(flat[0], true), "1 piercing");
});

test("crit handmatig (paralyzed doel binnen 5 ft) en uit; 'Toch raak' zonder crit", () => {
  const parts = rollDmgCrit("1d6:slashing", dice(4, 6));
  const r = { d: [12], nat: 12, bo: 4, tot: 16 };
  assert.equal(atkResult(r, 14, parts, {}, { crit: true }).dealt, 10);
  assert.equal(atkResult({ d: [20], nat: 20, bo: 4, tot: 24 }, 14, parts, {}, { crit: false }).dealt, 4);
  const f = atkResult({ d: [3], nat: 3, bo: 4, tot: 7 }, 14, parts, {}, { hit: true });
  assert.equal(f.hit, true); assert.equal(f.natHit, false); assert.equal(f.crit, false); assert.equal(f.dealt, 4);
  assert.equal(atkResult({ d: [3], nat: 3, bo: 4, tot: 7 }, 14, parts, {}, { crit: true }).hit, false, "crit zonder raak telt niet");
});

test("resistance per damage type, naar beneden afgerond; immuun op één type", () => {
  const parts = rollDmgCrit("2d10+6:piercing|1d8:acid", dice(7, 4, 5));
  const r = { d: [15], nat: 15, bo: 11, tot: 26 };
  const x = atkResult(r, 16, parts, { piercing: 0.5, acid: 0 });
  assert.equal(x.raw, 17 + 5);
  assert.equal(x.dealt, 8);
  assert.equal(atkResult(r, 16, parts, { acid: 2 }).dealt, 17 + 10);
});

test("Shield: +5 AC maakt van raak een mis", () => {
  const parts = rollDmgCrit("1d8:slashing", dice(5));
  const r = { d: [12], nat: 12, bo: 6, tot: 18 };
  assert.equal(atkResult(r, 16, parts).hit, true);
  assert.equal(atkResult(r, 21, parts).hit, false);
});

test("logboek-oorzaak met crit en resist", () => {
  const parts = rollDmgCrit("1d8+3:slashing", dice(5, 6));
  const r = { d: [20], nat: 20, bo: 5, tot: 25 };
  const res = atkResult(r, 15, parts, { slashing: 0.5 });
  assert.equal(atkWhy("Claw (Owlbear)", r, 15, parts, res), "Claw (Owlbear): d20 [20] +5 = 25 vs AC 15, kritiek; 1d8+3 [5 | 6] = 14 slashing, slashing ×½ = 7 → 7");
});

test("aanval zonder schade-worp: raak/mis zonder schade", () => {
  const x = atkResult({ d: [14], nat: 14, bo: 5, tot: 19 }, 12, []);
  assert.equal(x.hit, true); assert.equal(x.dealt, 0); assert.deepEqual(x.types, []);
});

test("schade toepassen: crit op een speler op 0 HP = twee failures, ≥ max HP = dood; één concentration save", () => {
  const pc = (o) => ({ id: "t", name: "T", kind: "pc", hp: 0, max: 40, cond: ["Unconscious"], ds: { s: 0, f: 0, stable: false, dead: false }, ...o });
  const a = pc(); atkDamage(a, { crit: true, dealt: 20 }); assert.equal(a.ds.f, 2);
  const b = pc(); atkDamage(b, { crit: false, dealt: 20 }); assert.equal(b.ds.f, 1);
  const c = pc(); atkDamage(c, { crit: true, dealt: 40 }); assert.equal(c.ds.dead, true);
  const m = { id: "m", name: "Mage", kind: "monster", hp: 40, max: 40, cond: ["Concentrating"], concSpell: "Fly" };
  const r = atkDamage(m, { crit: false, dealt: 24 });
  assert.equal(m.hp, 16);
  assert.deepEqual(r.saves, [{ id: "m", kind: "conc", n: "Fly", ab: "CON", dc: 12 }]);
});

test("crit op 0 HP: temp HP vangt eerst op; alles opgevangen = geen failures", () => {
  const pc = (o) => ({ id: "t", name: "T", kind: "pc", hp: 0, max: 40, temp: 0, cond: ["Unconscious"], ds: { s: 0, f: 0, stable: false, dead: false }, ...o });
  const a = pc({ temp: 5 }); atkDamage(a, { crit: true, dealt: 4 }); assert.equal(a.temp, 1); assert.equal(a.ds.f, 0);
  const b = pc({ temp: 5 }); atkDamage(b, { crit: true, dealt: 9 }); assert.equal(b.temp, 0); assert.equal(b.ds.f, 2);
  const c = pc({ temp: 5 }); atkDamage(c, { crit: true, dealt: 44 }); assert.equal(c.ds.f, 2); assert.equal(c.ds.dead, false, "44 − 5 temp = 39 < max: niet dood");
});

test("partsKey: ook alleen vaste schade (dmgKey geeft dan geen knop)", () => {
  assert.equal(partsKey([{ flat: 1, type: "piercing" }]), "1:piercing");
  assert.equal(dmgKey([{ flat: 1, type: "piercing" }]), "");
  assert.equal(partsKey([{ flat: 1, type: "piercing" }, { e: "3d4", type: "poison" }]), dmgKey([{ flat: 1, type: "piercing" }, { e: "3d4", type: "poison" }]));
});

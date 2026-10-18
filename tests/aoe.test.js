import { test } from "node:test";
import assert from "node:assert/strict";
import { aoeCalc, defMode, saveBonus, applyAoe } from "../js/rules/aoe.js";
import { applyDamage, startConc } from "../js/rules/combat.js";

const pc = (o = {}) => ({ id: "p", name: "Thalia", kind: "pc", init: 10, dex: 1, hp: 31, max: 38, cond: [], ...o });
const mon = (o = {}) => ({ id: "m", name: "Goblin 1", kind: "monster", init: 12, dex: 2, hp: 7, max: 7, cond: [], ...o });

test("eerst save, dan resistance, elke keer naar beneden afgerond", () => {
  assert.equal(aoeCalc(27, "half", 0.5).dealt, 6); // 27 → 13 → 6
  assert.equal(aoeCalc(28, "half", 0.5).dealt, 7);
  assert.equal(aoeCalc(28, "fail", 0.5).dealt, 14);
  assert.equal(aoeCalc(7, "half", 2).dealt, 6); // 7 → 3 → 6
  assert.equal(aoeCalc(28, "fail", 0).dealt, 0);
  assert.equal(aoeCalc(28, "none", 1).dealt, 0);
  assert.equal(aoeCalc(1, "half", 1).dealt, 0);
  assert.deepEqual(aoeCalc(27, "half", 0.5).steps, ["27", "½ 13", "resist 6"]);
  assert.equal(aoeCalc("abc", "fail", 1).dealt, 0);
  assert.equal(aoeCalc(-5, "fail", 1).dealt, 0);
});

test("immunity/resistance uit het statblock, voorwaardelijke regels niet automatisch", () => {
  const lich = [["Damage Resistances", "cold, lightning, necrotic"], ["Damage Immunities", "poison; bludgeoning, piercing, and slashing from nonmagical attacks"]];
  assert.equal(defMode(lich, "cold").mode, 0.5);
  assert.equal(defMode(lich, "poison").mode, 0);
  assert.equal(defMode(lich, "fire").mode, 1);
  const b = defMode(lich, "bludgeoning");
  assert.equal(b.mode, 1);
  assert.match(b.cond, /nonmagical/);
  assert.equal(defMode([["Damage Vulnerabilities", "fire"]], "Fire").mode, 2);
  assert.equal(defMode([["Damage Resistances", "acid, cold, fire, lightning, thunder"]], "thunder").mode, 0.5);
  assert.equal(defMode(undefined, "fire").mode, 1);
  assert.equal(defMode(lich, "").mode, 1);
});

test("savebonus: proficiency uit Saving Throws, anders ability-mod", () => {
  const dragon = { ab: [27, 10, 25, 16, 13, 21], x: [["Saving Throws", "Dex +6, Con +13, Wis +7, Cha +11"]] };
  assert.equal(saveBonus(dragon, "DEX"), 6);
  assert.equal(saveBonus(dragon, "STR"), 8);
  assert.equal(saveBonus(dragon, "INT"), 3);
  assert.equal(saveBonus({ ab: [8, 14, 10, 10, 8, 8], x: [] }, "WIS"), -1);
  assert.equal(saveBonus({ x: [["Saving Throws", "Str −2"]] }, "STR"), -2);
  assert.equal(saveBonus({ dexScore: 16, text: "" }, "DEX"), 3);
  assert.equal(saveBonus(null, "DEX"), 0);
});

test("AoE op meerdere doelen: per doel eigen save en weerstand", () => {
  const g1 = mon(), g2 = mon({ id: "m2", name: "Goblin 2" }), hh = mon({ id: "h", name: "Hell Hound", hp: 45, max: 45 }), th = pc();
  const r = applyAoe([
    { c: g1, save: "fail", mode: 1 },
    { c: g2, save: "half", mode: 1 },
    { c: hh, save: "fail", mode: 0 },
    { c: th, save: "half", mode: 0.5 },
  ], 28, "28 fire");
  assert.equal(g1.hp, 0); assert.equal(g2.hp, 0); assert.equal(hh.hp, 45); assert.equal(th.hp, 24);
  assert.deepEqual(r.hits.map((h) => h.dealt), [28, 14, 0, 7]);
  assert.ok(r.why.some((w) => w.id === "p" && w.t.includes("½ 14 → resist 7")));
  // geen rekenmeldingen per doel, wel "neer"
  assert.ok(!r.msgs.some((m) => m.includes("×½")));
  assert.equal(r.msgs.filter((m) => m.includes("neer")).length, 2);
});

test("AoE: temp HP, concentration, 0 HP-speler en legendary resistance", () => {
  const c = pc({ temp: 5 });
  startConc(c, "Bless");
  applyAoe([{ c, save: "fail", mode: 1 }], 12, "12 fire");
  assert.equal(c.temp, 0); assert.equal(c.hp, 24);
  // concentration-melding blijft ook bij een AoE
  const c2 = pc({ hp: 30, max: 30 }); startConc(c2, "Fly");
  const r2 = applyAoe([{ c: c2, save: "fail", mode: 1 }], 24, "24 fire");
  assert.ok(r2.msgs.some((m) => m.includes("DC 12")));
  // speler op 0 HP: schade = een death save failure
  const down = pc({ hp: 0, ds: { s: 0, f: 0, stable: true, dead: false }, cond: ["Unconscious"] });
  applyAoe([{ c: down, save: "half", mode: 1 }], 10, "10 fire");
  assert.equal(down.ds.f, 1);
  // legendary resistance: teller omlaag, save geslaagd
  const dr = mon({ id: "d", name: "Dragon", hp: 200, max: 200, lr: { max: 3, left: 3 } });
  applyAoe([{ c: dr, save: "half", mode: 1, lr: true }], 40, "40 cold");
  assert.equal(dr.lr.left, 2); assert.equal(dr.hp, 180);
  // geen LR meer over: niets aftellen
  const dr2 = mon({ id: "e", hp: 50, max: 50, lr: { max: 3, left: 0 } });
  applyAoe([{ c: dr2, save: "half", mode: 1, lr: true }], 10, "10 cold");
  assert.equal(dr2.lr.left, 0);
});

test("enkel schade-paneel: immuun ×0 doet niets", () => {
  const m = mon({ temp: 3 });
  const r = applyDamage(m, 20, 0);
  assert.equal(m.hp, 7); assert.equal(m.temp, 3);
  assert.ok(r.why[0].t.includes("immuun"));
});

test("AoE: instant death en dood op 0 HP, ook in de preview", async () => {
  const { aoeOutcome } = await import("../js/rules/aoe.js");
  // 20 HP, max 20: 40 schade → restschade 20 ≥ max → direct dood
  const a = pc({ hp: 20, max: 20 });
  assert.equal(aoeOutcome(a, { save: "fail", mode: 1 }, 40).res, "sterft");
  assert.equal(a.hp, 20); // preview past niets aan
  applyAoe([{ c: a, save: "fail", mode: 1 }], 40, "40 fire");
  assert.ok(a.ds.dead);
  // op 0 HP en schade ≥ max HP → dood
  const b = pc({ hp: 0, max: 20, ds: { s: 1, f: 0, stable: false, dead: false } });
  applyAoe([{ c: b, save: "fail", mode: 1 }], 20, "20 fire");
  assert.ok(b.ds.dead);
  const c = pc({ hp: 0, max: 20, ds: { s: 0, f: 0, stable: false, dead: false } });
  assert.equal(aoeOutcome(c, { save: "half", mode: 1 }, 10).res, "death save failure");
  assert.equal(aoeOutcome(mon(), { save: "fail", mode: 1 }, 7).res, "neer");
  assert.equal(aoeOutcome(mon(), { save: "fail", mode: 0 }, 70).res, "");
});

test("defMode: nonsilver en eigen monster zonder ab", async () => {
  const { pickFor, newPick, hasMagicRes, rollSave, rollText } = await import("../js/rules/aoe.js");
  assert.equal(defMode([["Damage Resistances", "bludgeoning, piercing, and slashing from nonmagical/nonsilver weapons"]], "slashing").mode, 1);
  assert.equal(saveBonus({ n: "Eigen", x: [["Saving Throws", "Wis +4"]], text: "" }, "WIS"), 4);
  assert.equal(saveBonus({ n: "Eigen", text: "" }, "CON"), 0);
  // DM-keuze wint van het statblock, zonder keuze volgt het statblock
  const x = [["Damage Immunities", "fire"]];
  assert.equal(pickFor(undefined, x, "fire").mode, 0);
  assert.equal(pickFor({ ...newPick(), mode: 1 }, x, "fire").mode, 1);
  assert.ok(hasMagicRes({ t: [["Magic Resistance", "..."]] }));
  assert.ok(!hasMagicRes({ t: [] }));
  // advantage: hoogste van twee
  const seq = (...v) => { let i = 0; return () => (v[i++] - 0.5) / 20; };
  const r = rollSave(2, true, seq(4, 15));
  assert.equal(r.tot, 17);
  assert.match(rollText(r, 15), /\[4, 15\] \+2 = 17 ✓ \(advantage/);
});

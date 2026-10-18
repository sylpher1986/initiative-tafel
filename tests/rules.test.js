import { test } from "node:test";
import assert from "node:assert/strict";
import { rollExpr, avgExpr, mod, sgn } from "../js/rules/dice.js";
import { applyDamage, applyPcHp, rollDs, giveTemp, heal, startConc, restMember, critAtZero } from "../js/rules/combat.js";
import { sortOrder, step, startCombat, makeDur, turnBoundary, parseInit } from "../js/rules/turns.js";
import { castInfo, legInfo, rcInfo, pickList, splitSpells } from "../js/rules/spells.js";

// rng die een vaste reeks d20/d6-uitkomsten oplevert: seq(5) → d6 geeft 5, d20 geeft 5
const seq = (...vals) => { let i = 0; return () => { const v = vals[i++ % vals.length]; return (v - 0.5) / 20; }; };
const seq6 = (...vals) => { let i = 0; return () => { const v = vals[i++ % vals.length]; return (v - 0.5) / 6; }; };

const pc = (o = {}) => ({ id: "p", name: "Wolfim", kind: "pc", init: 10, dex: 1, hp: 20, max: 20, cond: [], ...o });
const mon = (o = {}) => ({ id: "m", name: "Goblin 1", kind: "monster", init: 12, dex: 2, hp: 7, max: 7, cond: [], ...o });

test("dobbelstenen", () => {
  assert.equal(rollExpr("2d6+3", () => 0.999).total, 15);
  assert.equal(rollExpr("1d20 − 1", () => 0).total, 0);
  assert.equal(rollExpr("abc"), null);
  assert.equal(avgExpr("5d8"), 22);
  assert.equal(avgExpr("19d12+133"), 256);
  assert.equal(mod(8), -1); assert.equal(mod(15), 2);
  assert.equal(sgn(0), "+0"); assert.equal(sgn(-2), "-2");
});

test("resistance rondt naar beneden af en temp HP gaat eerst", () => {
  const c = pc({ temp: 5 });
  applyDamage(c, 13, 0.5); // 6 schade, 5 temp → 1 op HP
  assert.equal(c.temp, 0);
  assert.equal(c.hp, 19);
  const m = mon();
  applyDamage(m, 4, 2);
  assert.equal(m.hp, 0);
});

test("concentration-check na schade en verbreken op 0 HP", () => {
  const c = pc({ hp: 30, max: 30 });
  startConc(c, "Fly");
  const r = applyDamage(c, 24);
  assert.equal(r.saves[0].dc, 12);
  assert.equal(applyDamage(c, 3).saves[0].dc, 10, "minimaal DC 10");
  applyDamage(c, 10);
  assert.equal(c.hp, 0);
  assert.ok(!c.cond.includes("Concentrating"));
  assert.equal(c.concSpell, null);
});

test("speler op 0 HP: bewusteloos, death saves, instant death", () => {
  const c = pc();
  applyPcHp(c, -25);
  assert.equal(c.hp, 0);
  assert.ok(c.cond.includes("Unconscious"));
  assert.equal(c.ds.dead, false);
  applyPcHp(c, -3); // schade op 0 HP = 1 failure
  assert.equal(c.ds.f, 1);
  critAtZero(c); // +2 = 3 → dood
  assert.equal(c.ds.dead, true);

  const e = pc();
  applyPcHp(e, -40); // restschade 20 ≥ max 20
  assert.equal(e.ds.dead, true);
});

test("death save: 20 staat op, 1 telt dubbel, drie successen stabiel", () => {
  const c = pc({ hp: 0, ds: { s: 0, f: 0, stable: false, dead: false }, cond: ["Unconscious"] });
  rollDs(c, seq(20));
  assert.equal(c.hp, 1); assert.equal(c.ds, null); assert.ok(!c.cond.includes("Unconscious"));
  const b = pc({ hp: 0, ds: { s: 0, f: 0, stable: false, dead: false } });
  rollDs(b, seq(1)); assert.equal(b.ds.f, 2);
  const s = pc({ hp: 0, ds: { s: 2, f: 0, stable: false, dead: false } });
  rollDs(s, seq(15)); assert.equal(s.ds.stable, true);
});

test("genezen vanaf 0 en temp HP stapelt niet", () => {
  const c = pc({ hp: 0, ds: { s: 1, f: 1, stable: false, dead: false }, cond: ["Unconscious"] });
  heal(c, 5);
  assert.equal(c.hp, 5); assert.equal(c.ds, null);
  giveTemp(c, 8); giveTemp(c, 3);
  assert.equal(c.temp, 8);
});

test("volgorde: init, lair verliest gelijkspel, dex, spelers voor monsters, consistent", () => {
  const list = [mon({ id: "a", init: 20, dex: 2 }), { id: "l", name: "Lair", kind: "lair", init: 20, dex: -99, cond: [] }, pc({ id: "b", init: 15, dex: 1 }), mon({ id: "c", name: "Ogre", init: 15, dex: 1 })];
  assert.deepEqual(sortOrder(list).map((x) => x.id), ["a", "l", "b", "c"]);
  assert.deepEqual(sortOrder([...list].reverse()).map((x) => x.id), ["a", "l", "b", "c"]);
});

test("beurten: overslaan wie neer is, ronde ophogen, reaction en legendary resetten", () => {
  const S = { round: 0, active: null, list: [
    mon({ id: "a", init: 20, reaction: true, la: { max: 3, left: 0 } }),
    mon({ id: "dead", init: 15, hp: 0 }),
    pc({ id: "b", init: 10 }),
  ] };
  startCombat(S);
  assert.equal(S.active, "a"); assert.equal(S.round, 1);
  assert.equal(S.list[0].reaction, false); assert.equal(S.list[0].la.left, 3);
  step(S, 1); assert.equal(S.active, "b");
  step(S, 1); assert.equal(S.active, "a"); assert.equal(S.round, 2);
});

test("recharge rolt aan het begin van de eigen beurt", () => {
  const S = { round: 1, active: "x", list: [mon({ id: "d", init: 20, rc: [{ n: "Fire Breath", min: 5, rest: false, ready: false }] }), pc({ id: "x", init: 5 })] };
  step(S, 1, seq6(5));
  assert.equal(S.list[0].rc[0].ready, true);
  S.list[0].rc[0].ready = false; S.active = "x";
  step(S, 1, seq6(3));
  assert.equal(S.list[0].rc[0].ready, false);
});

test("conditie-duur: 'tot einde volgende beurt' en rondes", () => {
  const S = { round: 1, active: "a", list: [mon({ id: "a", init: 20 }), pc({ id: "b", init: 10 })] };
  const target = S.list[1];
  target.cond.push("Frightened");
  target.cd = { Frightened: makeDur(target, { dur: "tend" }, S.active) };
  step(S, 1); // naar b: begin beurt b
  assert.ok(target.cond.includes("Frightened"));
  step(S, 1); // einde beurt b → voorbij
  assert.ok(!target.cond.includes("Frightened"));

  const m = S.list[0];
  m.cond.push("Prone");
  m.cd = { Prone: makeDur(m, { dur: "r1" }, S.active) }; // a is aan de beurt
  step(S, 1); step(S, 1); // terug bij a: begin beurt a → 1 ronde voorbij
  assert.ok(!m.cond.includes("Prone"));
});

test("spellcasting, legendary en recharge uit een statblock", () => {
  const mage = { t: [["Spellcasting", "* 1st level (4 slots): detect magic, shield\n* 3rd level (3 slots): counterspell, fireball, fly"]] };
  const ci = castInfo(mage);
  assert.deepEqual(ci.slots.map((s) => [s.lvl, s.max]), [[1, 4], [3, 3]]);
  const c = { casting: ci };
  const pick = pickList(c, 3);
  assert.ok(pick.find((p) => p.n === "fly").conc);
  assert.ok(pick.find((p) => p.n === "detect magic" && p.lv === 1)); // upcast concentration
  const djinni = { t: [["Innate Spellcasting", "At will: thunderwave\n3/day each: create food and water (can create wine instead of water), tongues"]] };
  assert.equal(castInfo(djinni).daily[0].items.length, 2);
  assert.deepEqual(splitSpells("a (b, c), d"), ["a (b, c)", "d"]);
  const dragon = { l: [["Detect", ""]], ld: "The dragon can take 3 legendary actions.", t: [["Legendary Resistance (3/Day)", ""]], a: [["Fire Breath (Recharge 5-6)", ""]] };
  assert.deepEqual(legInfo(dragon), { la: { max: 3, left: 3 }, lr: { max: 3, left: 3 } });
  assert.equal(rcInfo(dragon)[0].min, 5);
});

test("rust: long rest herstelt alles, short rest alleen short-rest resources", () => {
  const m = pc({ hp: 3, temp: 4, casting: { slots: [{ lvl: 1, max: 4, left: 0 }], daily: [] }, res: [{ n: "Ki", max: 5, left: 0, rest: "Short Rest" }, { n: "Rage", max: 3, left: 0, rest: "Long Rest" }] });
  restMember(m, false);
  assert.equal(m.res[0].left, 5); assert.equal(m.res[1].left, 0); assert.equal(m.hp, 3);
  restMember(m, true);
  assert.equal(m.hp, 20); assert.equal(m.temp, 0); assert.equal(m.casting.slots[0].left, 4); assert.equal(m.res[1].left, 3);
});

test("toegevoegd tijdens het gevecht: vóór de actieve beurt pas volgende ronde, erna nog deze ronde", () => {
  const S = { list: [pc({ id: "a", init: 20 }), mon({ id: "b", init: 10 })], round: 0, active: null };
  startCombat(S, seq6(1));
  step(S, 1, seq6(1)); // ronde 1, b aan de beurt
  assert.equal(S.active, "b");
  S.list.push(mon({ id: "voor", name: "Goblin 2", init: 15 }), mon({ id: "na", name: "Goblin 3", init: 5 }));
  step(S, 1, seq6(1));
  assert.equal(S.active, "na"); // na b, nog in ronde 1
  assert.equal(S.round, 1);
  step(S, 1, seq6(1));
  assert.deepEqual([S.active, S.round], ["a", 2]); // "voor" is overgeslagen in ronde 1
  step(S, 1, seq6(1));
  assert.equal(S.active, "voor");
});

test("ingevulde initiative wordt opgeschoond", () => {
  assert.equal(parseInit("14"), 14);
  assert.equal(parseInit(" -1 "), -1);
  assert.equal(parseInit("12.6"), 13);
  assert.equal(parseInit("99"), 40);
  assert.equal(parseInit("-50"), -10);
  for (const bad of ["", "  ", "1e5", "abc", null, undefined]) assert.equal(parseInit(bad), null);
});

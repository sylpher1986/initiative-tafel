// WP4 (1.37.0): speler zonder initiative tot Start (SP4), restanten na Gevecht afronden (GV7), effectwaarde met teken (AF15)
import { test } from "node:test";
import assert from "node:assert/strict";
import { sortOrder, startCombat, setInits, initPcs } from "../js/rules/turns.js";
import { cleanCombatant } from "../js/backup.js";
import { diffLog } from "../js/log.js";
import { endSummary, startFight, oldMons, oldText, dropOld, leftConds, wipeConds } from "../js/rules/fight.js";
import { effSpec } from "../js/rules/effects.js";

const pc = (id, init, o = {}) => ({ id, name: id, kind: "pc", init, dex: 1, ac: 15, hp: 20, max: 30, cond: [], ...o });
const mon = (id, init, o = {}) => ({ id, name: id, kind: "monster", ref: "Goblin", init, dex: 2, ac: 15, hp: 7, max: 7, cond: [], ...o });
const find = () => ({ cr: "1/4" });

test("SP4: speler zonder initiative (null) staat onderaan, onderling op naam", () => {
  const L = sortOrder([pc("Zed", null), mon("g", -2), pc("Ann", null), pc("b", 12)]);
  assert.deepEqual(L.map((c) => c.id), ["b", "g", "Ann", "Zed"]);
});

test("SP4: het paneel bij Start vult null in, daarna een gewone volgorde", () => {
  const S = { round: 0, active: null, saves: [], list: [pc("a", null), mon("g", 10)] };
  assert.deepEqual(setInits(S.list, { a: "" }).missing, ["a"], "leeg = nog geen initiative");
  assert.equal(S.list[0].init, null, "alles of niets: niets veranderd");
  setInits(S.list, { a: "15" });
  startCombat(S, () => 0.5);
  assert.equal(S.active, "a");
  assert.equal(initPcs(S.list).length, 1);
});

test("SP4: import houdt null bij spelers; monsters en onzin worden een getal", () => {
  assert.equal(cleanCombatant({ id: "a", name: "A", kind: "pc", init: null }).init, null);
  assert.equal(cleanCombatant({ id: "a", name: "A", kind: "pc" }).init, null, "ontbreekt = nog niet gerold");
  assert.equal(cleanCombatant({ id: "a", name: "A", kind: "pc", init: 14 }).init, 14);
  assert.equal(cleanCombatant({ id: "g", name: "G", kind: "monster", init: null }).init, 0);
  assert.equal(cleanCombatant({ id: "x", name: "X", kind: "raar", init: null }).init, 0, "onbekende soort = monster");
});

test("SP4: logboek zonder 'initiative null'", () => {
  const add = diffLog({ list: [] }, { list: [pc("Sanne", null)] });
  assert.equal(add[0].msg, "Sanne doet mee");
  const ch = diffLog({ list: [pc("Sanne", null)] }, { list: [pc("Sanne", 14)] });
  assert.match(ch[0].msg, /initiative 14/);
  assert.doesNotMatch(ch[0].msg, /→/);
});

test("GV7: oude monsters = die er bij het afronden stonden, ook een levende verborgen", () => {
  const S = { round: 3, active: null, saves: [], list: [pc("a", 10), mon("g1", 8, { hp: 0 }), mon("g2", 8, { hp: 3 }), mon("amb", 5, { hidden: true })] };
  S.endSum = endSummary(S, find, Date.now());
  assert.ok(!S.endSum.mons.some((m) => m.id === "amb"), "samenvatting telt de verborgen niet");
  S.round = 0;
  S.list.push(mon("ogre", 4, { ref: "Ogre", name: "Ogre", hp: 59, max: 59 }));
  assert.deepEqual(oldMons(S).map((c) => c.id), ["g1", "g2", "amb"]);
  assert.equal(oldText(oldMons(S)), "Nog 3 monsters uit het vorige gevecht: g1 0/7 HP, g2 3/7 HP, amb.");
  startFight(S, Date.now());
  assert.deepEqual(oldMons(S), [], "na Start (of Toch starten) geen vraag meer");
});

test("GV7: oldText kapt af na 3 namen; samenvatting van vóór 1.37.0 (zonder all) valt terug op mons", () => {
  const L = ["a", "b", "c", "d", "e"].map((x) => mon(x, 1));
  assert.match(oldText(L), /: a, b, c \+2\.$/);
  assert.equal(oldText([mon("g", 1)]), "Nog 1 monster uit het vorige gevecht: g.");
  const S = { list: [mon("g", 1), mon("h", 1)], endSum: { mons: [{ id: "g" }] } };
  assert.deepEqual(oldMons(S).map((c) => c.id), ["g"]);
});

test("GV7: dropOld haalt alleen de oude weg; conditieduur aan hun beurt wordt zonder duur", () => {
  const p = pc("a", 10, { cond: ["Frightened"], cd: { Frightened: { kind: "tend", who: "g1", at: "end", count: 1, save: { ab: "WIS", dc: 13 } } } });
  const S = { list: [p, mon("g1", 8), mon("new", 6), { id: "L", kind: "lair", name: "Lair", init: 20 }], endSum: { all: ["g1"], mons: [] } };
  assert.equal(dropOld(S), 1);
  assert.deepEqual(S.list.map((c) => c.id), ["a", "new", "L"]);
  assert.deepEqual(p.cd.Frightened, { kind: "inf", save: { ab: "WIS", dc: 13 } });
  assert.equal(dropOld(S), 0);
});

test("GV7: condities van spelers na het gevecht: standaard aan/uit", () => {
  const L = [
    pc("a", 1, { cond: ["Prone", "Concentrating", "Unconscious", "Charmed", "Frightened"], cd: { Frightened: { kind: "rounds", who: "x", count: 2 } } }),
    pc("d", 1, { cond: ["Prone"], ds: { dead: true } }),
    mon("g", 1, { cond: ["Prone"] }),
  ];
  const r = leftConds(L);
  assert.deepEqual(r.map((x) => [x.cond, x.on]), [["Prone", true], ["Concentrating", false], ["Charmed", false], ["Frightened", true]]);
  assert.ok(!r.some((x) => x.id === "d" || x.id === "g"), "geen doden, geen monsters");
});

test("GV7: wipeConds haalt conditie en duur weg; concentratie zonder spell; Unconscious nooit", () => {
  const a = pc("a", 1, { name: "Thalia", cond: ["Prone", "Concentrating", "Unconscious"], cd: { Prone: { kind: "inf" } }, concSpell: "Bless" });
  const done = wipeConds([a], ["a|Prone", "a|Concentrating", "a|Unconscious", "zz|Prone", "a|Blinded"]);
  assert.deepEqual(done, ["Thalia Prone", "Thalia Concentrating"]);
  assert.deepEqual(a.cond, ["Unconscious"]);
  assert.equal(a.cd.Prone, undefined);
  assert.equal(a.concSpell, null);
});

test("AF15: effectwaarde positief ingetikt, teken uit de keuze", () => {
  assert.deepEqual(effSpec("ac+", "2"), { st: "ac", op: "+", v: 2 });
  assert.deepEqual(effSpec("ac-", "2"), { st: "ac", op: "+", v: -2 });
  assert.deepEqual(effSpec("ac-", "-2"), { st: "ac", op: "+", v: -2 }, "minteken toch getypt: geen dubbele min");
  assert.deepEqual(effSpec("ac=", "13"), { st: "ac", op: "=", v: 13 });
  assert.deepEqual(effSpec("acmin", "16"), { st: "ac", op: "min", v: 16 });
  assert.deepEqual(effSpec("max", "10"), { st: "max", op: "+", v: 10 });
  assert.deepEqual(effSpec("max-", "5"), { st: "max", op: "+", v: -5 });
  assert.deepEqual(effSpec("txt", ""), { st: "", op: "+", v: 0 });
});

test("GV7: Prone bij een speler op 0 HP staat uit (hoort bij Unconscious); id met | werkt", () => {
  const r = leftConds([pc("a|b", 1, { hp: 0, cond: ["Unconscious", "Prone"] }), pc("c", 1, { cond: ["Prone"] })]);
  assert.deepEqual(r.map((x) => [x.k, x.on]), [["a|b|Prone", false], ["c|Prone", true]]);
  const L = [pc("a|b", 1, { name: "Ayla", cond: ["Prone"] })];
  assert.deepEqual(wipeConds(L, ["a|b|Prone"]), ["Ayla Prone"]);
  assert.deepEqual(L[0].cond, []);
});

test("SP4: sorteren zonder dex en met null-init crasht niet en blijft stabiel", () => {
  const L = sortOrder([{ id: "x", name: "X", kind: "pc", init: null }, { id: "y", name: "Y", kind: "pc", init: 5 }, { id: "z", name: "Z", kind: "monster", init: 5 }]);
  assert.deepEqual(L.map((c) => c.id), ["y", "z", "x"]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { toPlayerView, cleanView, hpStatus, VIS, cleanVis } from "../js/playerview.js";
import { cleanCombatant } from "../js/backup.js";
import { diffLog } from "../js/log.js";

const pc = (o) => ({ kind: "pc", cond: [], dex: 0, ac: 15, hp: 20, max: 20, ...o });
const mon = (o) => ({ kind: "monster", cond: [], dex: 0, ac: 13, hp: 10, max: 10, ref: "Goblin", ...o });
const S = (list, extra = {}) => ({ list, round: 1, active: list[0]?.id ?? null, ...extra });

test("hpStatus: banden en 0 HP", () => {
  assert.equal(hpStatus(mon({ hp: 10 })), "Ongedeerd");
  assert.equal(hpStatus(mon({ hp: 6 })), "Gewond");
  assert.equal(hpStatus(mon({ hp: 5 })), "Bloodied");
  assert.equal(hpStatus(mon({ hp: 2 })), "Bijna dood");
  assert.equal(hpStatus(mon({ hp: 0 })), "Neer");
  assert.equal(hpStatus(pc({ hp: 0, ds: { s: 1, f: 0 } })), "Bewusteloos");
  assert.equal(hpStatus(pc({ hp: 0, ds: { stable: true } })), "Stabiel");
  assert.equal(hpStatus(pc({ hp: 0, ds: { dead: true } })), "Dood");
  assert.equal(hpStatus(mon({ max: 0 })), "");
});

test("geen DM-info in de snapshot: monster-HP alleen als status, geen AC, statblock of notities", () => {
  const V = toPlayerView(S([
    pc({ id: "a", name: "Thalia", init: 18, hp: 12, temp: 3, casting: { slots: [] }, sheet: { cls: "Wizard" } }),
    mon({ id: "b", name: "Goblin 1", init: 12, hp: 2, eff: [{ id: "e", n: "Shield", st: "ac", op: "+", v: 5, txt: "geheim" }] }),
  ]), () => "Small humanoid (goblinoid), neutral evil");
  const [a, b] = V.list;
  assert.deepEqual(a.hp, { hp: 12, max: 20, temp: 3, st: "Gewond" });
  assert.deepEqual(b.hp, { st: "Bijna dood" });
  assert.equal(b.icon, "m-humanoid");
  assert.deepEqual(b.tags, ["Shield"]);
  const j = JSON.stringify(V);
  for (const k of ['"ac"', '"ref"', '"sheet"', '"casting"', "geheim", '"eff"']) assert.ok(!j.includes(k), `lekt ${k}`);
  assert.equal(a.init, null, "initiativegetallen standaard uit");
});

test("verborgen monster: niet in de lijst, beurt en 'volgende' niet zichtbaar", () => {
  const list = [mon({ id: "h", name: "Lurker", init: 20, hidden: true }), pc({ id: "a", name: "A", init: 15 }), pc({ id: "b", name: "B", init: 10 })];
  let V = toPlayerView(S(list, { active: "h" }));
  assert.deepEqual(V.list.map((c) => c.id), ["a", "b"]);
  assert.equal(V.active, null);
  assert.equal(V.next, "a");
  V = toPlayerView(S(list, { active: "b" })); // na B komt (rondgaand) de verborgen Lurker: die overslaan
  assert.equal(V.next, "a");
});

test("volgende slaat wie neer is over; buiten gevecht geen beurt", () => {
  const list = [pc({ id: "a", name: "A", init: 15 }), mon({ id: "m", name: "M", init: 12, hp: 0 }), pc({ id: "b", name: "B", init: 5 })];
  assert.equal(toPlayerView(S(list, { active: "a" })).next, "b");
  const V = toPlayerView({ list, round: 0, active: null });
  assert.equal(V.active, null); assert.equal(V.next, null); assert.equal(V.round, 0);
  assert.equal(toPlayerView({ list: [], round: 0, active: null }).list.length, 0);
});

test("instellingen: exacte monster-HP, getallen, geen tags; lair alleen weg als verborgen", () => {
  const lair = { id: "l", kind: "lair", name: "Lair: X", key: "x", init: 20, dex: -99, cond: [] };
  const list = [mon({ id: "m", name: "M", init: 12, hp: 2, cond: ["Prone"] }), lair];
  const V = toPlayerView(S(list), () => "", { ...VIS, monHp: "exact", init: true, tags: "none" });
  assert.equal(V.list.length, 2);
  assert.equal(V.list[0].init, 20, "lair (20) eerst");
  assert.deepEqual(V.list[1].hp, { hp: 2, max: 10, temp: 0, st: "Bijna dood" });
  assert.equal(V.list[1].init, 12);
  assert.deepEqual(V.list[1].tags, []);
  const W = toPlayerView(S(list));
  assert.deepEqual(W.list[0], { id: "l", kind: "lair", name: "Lair", init: null }, "lairnaam verraadt de bron niet");
  const H = toPlayerView(S([list[0], { ...lair, hidden: true }], { active: "l" }));
  assert.equal(H.list.length, 1, "verborgen lair bestaat niet voor spelers");
  assert.equal(H.active, null, "ook zijn beurt niet");
  assert.equal(H.next, "m", "volgende = eerstvolgende zichtbare");
});

test("instellingen: monster-HP geen, condities alleen bij spelers; spelers-HP altijd exact", () => {
  const list = [pc({ id: "a", name: "A", init: 15, hp: 5, cond: ["Prone"] }), mon({ id: "m", name: "M", init: 12, hp: 0, cond: ["Prone"] })];
  const V = toPlayerView(S(list), () => "", { ...VIS, monHp: "none", tags: "pc" });
  assert.deepEqual(V.list[0].hp, { hp: 5, max: 20, temp: 0, st: "Bijna dood" });
  assert.deepEqual(V.list[0].tags, ["Prone"]);
  assert.equal(V.list[1].hp, null);
  assert.equal(V.list[1].out, true, "Neer blijft: spelers zagen hem vallen");
  assert.deepEqual(V.list[1].tags, []);
  const D = toPlayerView(S([pc({ id: "a", name: "A", hp: 0, ds: { s: 1, f: 0 } })]), () => "", { ...VIS, tags: "none" });
  assert.deepEqual(D.list[0].ds, { s: 1, f: 0 }, "death saves zijn spelersinfo, los van condities");
});

test("groep met een verborgen lid: alleen zichtbare leden aan de beurt, volgende voorbij de groep", () => {
  const b = (i, o = {}) => mon({ id: `b${i}`, name: `Bugbear ${i}`, init: 12, grp: "g", ...o });
  const L = [b(1), b(2, { hidden: true }), b(3), pc({ id: "p", name: "P", init: 5 })];
  const V = toPlayerView(S(L, { active: "b1" }));
  assert.deepEqual(V.group, ["b1", "b3"]);
  assert.equal(V.gname, "Bugbear ×2");
  assert.equal(V.next, "p");
  assert.ok(!V.list.some((c) => c.id === "b2"));
  const W = toPlayerView(S(L, { active: "b2" }));
  assert.equal(W.active, null, "verborgen lid aan de beurt: spelers zien geen beurt");
  assert.equal(W.group, undefined);
  assert.equal(W.next, "b3");
});

test("tags \"pc\": Verrast alleen bij spelers", () => {
  const L = [pc({ id: "a", name: "A", init: 15, sur: true }), mon({ id: "m", name: "M", init: 12, sur: true }), pc({ id: "z", name: "Z", init: 1 })];
  const V = toPlayerView(S(L, { active: "z" }), () => "", { ...VIS, tags: "pc" });
  assert.deepEqual(V.list.find((c) => c.id === "a").tags, ["Verrast"]);
  assert.deepEqual(V.list.find((c) => c.id === "m").tags, []);
});

test("cleanVis: per sleutel terug naar de standaard, oude sleutels vervallen", () => {
  assert.deepEqual(cleanVis(null), VIS);
  assert.deepEqual(cleanVis("rommel"), VIS);
  assert.deepEqual(cleanVis({ monHp: "exact", init: "ja", tags: true, lair: false, pcHp: "none" }), { ...VIS, monHp: "exact" });
  assert.deepEqual(cleanVis({ init: true, tags: "pc" }), { ...VIS, init: true, tags: "pc" });
});

test("death saves alleen zolang ze lopen; concentratie-spell alleen bij spelers", () => {
  const V = toPlayerView(S([
    pc({ id: "a", name: "A", init: 9, hp: 0, ds: { s: 1, f: 2 }, cond: ["Concentrating"], concSpell: "Bless" }),
    mon({ id: "m", name: "M", init: 8, cond: ["Concentrating"], concSpell: "Hold Person" }),
    pc({ id: "b", name: "B", init: 7, hp: 0, ds: { stable: true } }),
  ]));
  assert.deepEqual(V.list[0].ds, { s: 1, f: 2 });
  assert.deepEqual(V.list[1].tags, ["Concentrating"]);
  assert.equal(V.list[2].ds, undefined);
  assert.deepEqual(toPlayerView(S([pc({ id: "c", name: "C", init: 1, hp: 0 })])).list[0].ds, { s: 0, f: 0 }, "net op 0 HP, nog geen ds-object");
});

test("cleanView: rommel en scripts eruit, onbekende ids weg", () => {
  assert.equal(cleanView(null), null);
  assert.equal(cleanView({ v: 2, list: [] }), null);
  const V = cleanView({
    v: 1, round: "3", active: "x", next: "zz",
    list: [{ id: "x", kind: "pc", name: "<b>A</b>", icon: '"><script>', img: "javascript:alert(1)", hp: { hp: "5", max: 9, temp: null, st: "Gewond" }, tags: ["Prone", 7, null], ds: { s: 9, f: -1 } }, "rommel", { kind: "lair", name: "Lair" }],
  });
  const [a, l] = V.list;
  assert.equal(V.round, 3); assert.equal(V.active, "x"); assert.equal(V.next, null);
  assert.equal(a.icon, "r-pc"); assert.equal(a.img, null);
  assert.deepEqual(a.hp, { hp: 5, max: 9, temp: 0, st: "Gewond" });
  assert.deepEqual(a.tags, ["Prone"]);
  assert.deepEqual(a.ds, { s: 3, f: 0 });
  assert.equal(l.kind, "lair");
  assert.equal(cleanView({ v: 1, list: [{ id: "q", hp: { st: "constructor" } }] }).list[0].hp.st, "", "alleen bekende statussen");
  // een echte snapshot komt er ongeschonden doorheen
  const real = toPlayerView(S([pc({ id: "a", name: "A", init: 5 }), mon({ id: "m", name: "M", init: 3 })]));
  assert.deepEqual(cleanView(JSON.parse(JSON.stringify(real))), real);
});

test("verborgen: blijft bij import (alleen monsters) en komt in het logboek", () => {
  assert.equal(cleanCombatant(mon({ id: "m", name: "M", hidden: true })).hidden, true);
  assert.equal(cleanCombatant(pc({ id: "p", name: "P", hidden: true })).hidden, undefined);
  assert.equal(cleanCombatant({ id: "l", kind: "lair", name: "Lair", hidden: true }).hidden, true, "lair verbergen overleeft export");
  assert.equal("hidden" in cleanCombatant({ id: "l", kind: "lair", name: "Lair" }), false);
  const a = { list: [mon({ id: "m", name: "M", init: 1 })], round: 0 };
  const b = { list: [mon({ id: "m", name: "M", init: 1, hidden: true })], round: 0 };
  assert.match(diffLog(a, b)[0].msg, /verborgen voor spelers/);
  assert.match(diffLog(b, a)[0].msg, /zichtbaar voor spelers/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterMonsters, parseQuery, crNum, metaInfo, queryLabel } from "../js/data/monsters.js";
import { castInfo, legInfo, rcInfo } from "../js/rules/spells.js";
import { rollExpr } from "../js/rules/dice.js";

const srd = JSON.parse(readFileSync(new URL("../data/monsters.json", import.meta.url), "utf8"));
const list = [{ n: "Goblin" }, { n: "Lich" }, { n: "Adult Brass Dragon" }, { n: "Young Brass Dragon" }, { n: "Ape" }, { n: "Giant Ape" }];

test("keuzelijst: selectie is altijd zichtbaar", () => {
  // de oude bug: Goblin stond geselecteerd, zoeken op lich voegde toch een Goblin toe
  assert.equal(filterMonsters(list, "lich", "Goblin").sel, "Lich");
  assert.equal(filterMonsters(list, "  LICH ", "Goblin").sel, "Lich");
  assert.equal(filterMonsters(list, "brass", "Goblin").sel, null);
  assert.equal(filterMonsters(list, "brass", "Young Brass Dragon").sel, "Young Brass Dragon");
  assert.equal(filterMonsters(list, "ape", null).sel, "Ape"); // exacte naam wint van "Giant Ape"
  assert.equal(filterMonsters(list, "xyz", "Goblin").sel, null);
  assert.equal(filterMonsters(list, "", "Goblin").sel, "Goblin");
  assert.equal(filterMonsters(list, "", null).sel, null);
  assert.equal(filterMonsters(list, "brass", null).L.length, 2);
});

test("alle SRD-monsters zijn uniek en toe te voegen", () => {
  assert.equal(srd.length, 322);
  assert.equal(new Set(srd.map((m) => m.n.toLowerCase())).size, srd.length);
  for (const m of srd) {
    assert.ok(m.hp > 0 && parseInt(m.ac) > 0 && m.ab?.length === 6, m.n);
    if (m.hd) assert.ok(rollExpr(m.hd), `${m.n}: hd ${m.hd}`);
    assert.doesNotThrow(() => { castInfo(m); legInfo(m); rcInfo(m); }, m.n);
    assert.equal(filterMonsters(srd, m.n, "Goblin").sel, m.n, `zoeken op ${m.n}`);
  }
});

test("zoektekst: CR en type herkennen", () => {
  const cr = (q) => parseQuery(q).cr;
  assert.deepEqual(cr("cr 5"), { min: 5, max: 5 });
  assert.deepEqual(cr("CR5"), { min: 5, max: 5 });
  assert.deepEqual(cr("cr:1/4"), { min: 0.25, max: 0.25 });
  assert.deepEqual(cr("cr 2-4"), { min: 2, max: 4 });
  assert.deepEqual(cr("cr 2–4"), { min: 2, max: 4 }); // gedachtestreepje
  assert.deepEqual(cr("cr 4-2"), { min: 2, max: 4 });
  assert.deepEqual(cr("cr 1/2-3"), { min: 0.5, max: 3 });
  assert.deepEqual(cr("cr 10+"), { min: 10, max: Infinity });
  // nog niet af: geen filter en geen fout (lijst loopt niet leeg tijdens typen)
  for (const q of ["cr", "cr 2-", "cr 1/", "undead cr"]) { assert.equal(cr(q), null, q); assert.equal(parseQuery(q).bad, false, q); }
  for (const q of ["cr x", "cr 1/3", "cr 2-x"]) assert.equal(parseQuery(q).bad, true, q);
  assert.deepEqual(parseQuery("crab").words, ["crab"]); // geen CR-woord
  assert.deepEqual(parseQuery("cr wolf"), { words: ["wolf"], cr: null, type: "", bad: false }); // naamwoord na een onaf "cr"
  assert.equal(parseQuery("cr undead").type, "undead");
  assert.deepEqual(parseQuery("cr 0").cr, { min: 0, max: 0 });
  assert.equal(parseQuery("Undead cr 2").type, "undead");
  assert.equal(parseQuery("dragons").type, "dragon");
  assert.equal(parseQuery("goblin").type, "");
  assert.equal(queryLabel(parseQuery("undead cr 2-4")), "Undead · CR 2–4");
  assert.equal(queryLabel(parseQuery("cr 1/8")), "CR 1/8");
  assert.equal(queryLabel(parseQuery("cr 10+")), "CR 10+");
  assert.equal(queryLabel(parseQuery("wolf")), "");
  assert.equal(crNum("1/2"), 0.5); assert.ok(Number.isNaN(crNum(""))); assert.ok(Number.isNaN(crNum(undefined)));
  assert.deepEqual(metaInfo("Medium humanoid (goblinoid), neutral evil"), { type: "humanoid", sub: "goblinoid" });
  assert.equal(metaInfo("Medium swarm of Tiny beasts, unaligned").type, "beast");
  assert.equal(metaInfo("").type, "");
});

test("zoeken op type, subtype en CR in de SRD", () => {
  const names = (q) => filterMonsters(srd, q, null).L.map((m) => m.n);
  const und = names("undead");
  assert.equal(und.length, 18);
  assert.ok(und.includes("Zombie") && und.includes("Lich"));
  // type-filter: CR oplopend
  const crs = filterMonsters(srd, "undead", null).L.map((m) => crNum(m.cr));
  assert.deepEqual(crs, [...crs].sort((a, b) => a - b));
  for (const m of filterMonsters(srd, "cr 5", null).L) assert.equal(m.cr, "5");
  assert.equal(names("cr 5").length, 25);
  for (const m of filterMonsters(srd, "undead cr 2-4", null).L) assert.ok(crNum(m.cr) >= 2 && crNum(m.cr) <= 4 && metaInfo(m.meta).type === "undead");
  assert.ok(names("undead cr 2-4").includes("Ghast"));
  assert.ok(names("cr 1/4").includes("Goblin"));
  assert.ok(names("cr 20+").every((n) => crNum(srd.find((m) => m.n === n).cr) >= 20));
  assert.ok(names("demon").includes("Balor")); // subtype
  assert.ok(names("dragons").includes("Adult Red Dragon"));
  assert.deepEqual(names("red dragon"), ["Red Dragon Wyrmling", "Half-Red Dragon Veteran", "Young Red Dragon", "Adult Red Dragon", "Ancient Red Dragon"]); // CR-volgorde
  assert.equal(names("giant spider")[0], "Giant Spider"); // exacte naam boven Giant Wolf Spider (lagere CR)
  assert.equal(filterMonsters(srd, "giant spider", null).label, "");
  assert.equal(names("undead fiend").length, 0);
  // alleen naam: wie ermee begint eerst, subtype-treffers achteraan
  const gob = names("goblin");
  assert.equal(gob[0], "Goblin");
  assert.ok(gob.includes("Bugbear") && gob.indexOf("Bugbear") > gob.indexOf("Hobgoblin"));
  assert.equal(names("ape")[0], "Ape");
  // onaf CR-woord filtert niet
  assert.equal(names("undead cr").length, 18);
  // eigen monster zonder meta of CR: alleen op naam, valt weg bij CR
  const own = [{ n: "Moerasheks", custom: true }, ...srd];
  assert.equal(filterMonsters(own, "moeras", null).sel, "Moerasheks");
  assert.ok(!filterMonsters(own, "cr 0-30", null).L.some((m) => m.n === "Moerasheks"));
  // label en fout
  assert.equal(filterMonsters(srd, "undead cr 2-4", null).label, "Undead · CR 2–4");
  assert.equal(filterMonsters(srd, "cr x", null).bad, true);
  assert.equal(filterMonsters(srd, "cr x", null).L.length, srd.length);
  // selectie blijft zichtbaar: geselecteerd monster valt buiten het filter
  assert.equal(filterMonsters(srd, "undead", "Goblin").sel, null);
  assert.equal(filterMonsters(srd, "cr 1/4", "Goblin").sel, "Goblin");
});

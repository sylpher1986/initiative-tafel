import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterMonsters } from "../js/data/monsters.js";
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

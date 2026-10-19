import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setSpells, findSpell, spellsLoaded, normSpell, keys, spellParts, spellItem } from "../js/data/spells.js";

const doc = JSON.parse(readFileSync(new URL("../data/spells.json", import.meta.url), "utf8"));
const srd = JSON.parse(readFileSync(new URL("../data/monsters.json", import.meta.url), "utf8"));
setSpells(doc);

test("spelldata: SRD 5.1, compleet en uniek", () => {
  assert.equal(doc.ed, "2014");
  assert.match(doc.src, /CC-BY-4\.0/);
  assert.equal(doc.spells.length, 319);
  assert.equal(new Set(doc.spells.map((s) => normSpell(s.n))).size, 319);
  for (const s of doc.spells) {
    assert.ok(s.n && s.sch && s.t && s.r && s.c && s.d && s.x, s.n);
    assert.ok(Number.isInteger(s.lv) && s.lv >= 0 && s.lv <= 9, s.n);
    if (/reaction/.test(s.t)) assert.match(s.t, /which you take/, `${s.n}: trigger`);
  }
  assert.ok(spellsLoaded("2014"));
  assert.equal(spellsLoaded("2024"), false);
});

test("spell opzoeken: hoofdletters, annotaties, aliassen en bezitsvormen", () => {
  assert.equal(findSpell("fireball").n, "Fireball");
  assert.equal(findSpell("  Cure  Wounds* ").n, "Cure Wounds");
  assert.equal(findSpell("fireball (3rd level)").n, "Fireball");
  assert.equal(findSpell("Tasha's Hideous Laughter").n, "Hideous Laughter");
  assert.equal(findSpell("Melf’s Acid Arrow").n, "Acid Arrow");
  assert.equal(findSpell("Bigby's Hand").n, "Arcane Hand");
  assert.equal(findSpell("Otiluke's Resilient Sphere").n, "Resilient Sphere");
  assert.equal(findSpell("Hunter's Mark").n, "Hunter's Mark"); // exact gaat vóór het weghalen van de bezitsvorm
  assert.equal(findSpell("Heroes' Feast").n, "Heroes' Feast");
  assert.equal(findSpell("eye bite").n, "Eyebite");
  assert.equal(findSpell("Hex"), null); // niet in de SRD
  assert.equal(findSpell(""), null);
  assert.equal(findSpell(null), null);
  assert.equal(findSpell("fireball", "2024"), null); // editie niet geladen
  assert.deepEqual(keys("Tasha's Hideous Laughter"), ["tasha's hideous laughter", "hideous laughter"]);
});

test("spell-lijsten in statblocks: regels herkennen en splitsen", () => {
  const p = spellParts("* 1st level (4 slots): detect magic, mage armor, magic missile, shield");
  assert.equal(p[0].t, "* 1st level (4 slots): ");
  assert.deepEqual(p.filter((x) => x.sp).map((x) => x.sp), ["detect magic", "mage armor", "magic missile", "shield"]);
  assert.equal(p.map((x) => x.t).join(""), "* 1st level (4 slots): detect magic, mage armor, magic missile, shield");
  assert.deepEqual(spellParts("3/day each: bless, create food and water (can create wine), cure wounds").filter((x) => x.sp).map((x) => [x.t, x.sp]),
    [["bless", "bless"], ["create food and water", "create food and water"], ["cure wounds", "cure wounds"]]);
  assert.equal(spellParts("3/day each: bless, create food and water (can create wine)").map((x) => x.t).join(""), "3/day each: bless, create food and water (can create wine)");
  assert.deepEqual(spellParts("At will: dancing lights").filter((x) => x.sp).map((x) => x.sp), ["dancing lights"]);
  assert.deepEqual(spellParts("Cantrips (at will): fire bolt, light").filter((x) => x.sp).map((x) => x.sp), ["fire bolt", "light"]);
  assert.deepEqual(spellParts("1/day: plane shift (self only)").filter((x) => x.sp).map((x) => x.sp), ["plane shift"]);
  const st = spellParts("4th level (2 slots): banishment*, polymorph*");
  assert.deepEqual(st.filter((x) => x.sp).map((x) => x.t), ["banishment", "polymorph"]); // sterretje valt buiten de naam
  assert.equal(st.map((x) => x.t).join(""), "4th level (2 slots): banishment*, polymorph*");
  assert.deepEqual(spellItem("polymorph* (self only)"), ["polymorph", "* (self only)"]);
  assert.deepEqual(spellItem("Cure Wounds"), ["Cure Wounds", ""]);
  // gewone tekst blijft één stuk
  assert.deepEqual(spellParts("The mage is a 9th-level spellcaster."), [{ t: "The mage is a 9th-level spellcaster." }]);
  assert.deepEqual(spellParts(""), [{ t: "" }]);
});

test("alle spells in SRD-monsterstatblocks zijn te vinden (behalve bekende niet-SRD)", () => {
  const miss = new Set();
  let n = 0;
  for (const m of srd) for (const [k, v] of [...(m.t || []), ...(m.a || [])]) {
    if (!/spellcasting/i.test(k)) continue;
    for (const line of v.split("\n")) for (const x of spellParts(line)) if (x.sp) { n++; if (!findSpell(x.sp)) miss.add(x.sp); }
  }
  assert.ok(n > 300, `alleen ${n} spells gevonden`);
  assert.deepEqual([...miss], ["ray of sickness"]); // PHB-spell in de hag-coven, staat niet in SRD 5.1
});

test("spelldata: tekstblokken zijn alinea's, vette aanloop of tabellen (geen markdown meer)", () => {
  const ok = (p) => (typeof p === "string" && !/\*|^\|/.test(p)) || (p && typeof p.b === "string" && typeof p.t === "string")
    || (p && Array.isArray(p.tbl) && p.tbl.length > 1 && p.tbl.every((r) => Array.isArray(r) && r.length === p.tbl[0].length));
  for (const s of doc.spells) for (const p of [...s.x, ...(s.h || [])]) assert.ok(ok(p), `${s.n}: ${JSON.stringify(p).slice(0, 80)}`);
  const conf = doc.spells.find((s) => s.n === "Confusion");
  assert.deepEqual(conf.x.find((p) => p.tbl).tbl[0], ["d10", "Behavior"]);
  assert.equal(doc.spells.find((s) => s.n === "Prismatic Spray").x[1].b, "1. Red.");
});

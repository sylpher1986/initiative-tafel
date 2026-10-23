import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { passives, sheetPassives, cleanPas, pasText, percList, pasVal } from "../js/rules/passives.js";
import { filterMonsters, editDist, SYN, crNum } from "../js/data/monsters.js";

const srd = JSON.parse(readFileSync(new URL("../data/monsters.json", import.meta.url)));

/* ---------- SP5 ---------- */
test("SP5: passives afgeleid uit een oude sheet (PDF of link zonder passive-veld)", () => {
  const h = { senses: "darkvision 60 ft., passive Perception 15", skills: [["Insight", "+3"], ["Investigation", "−1"], ["Perception", "+2"]] };
  assert.deepEqual(sheetPassives(h), { per: 15, ins: 13, inv: 9 }); // senses gaat voor 10 + skill (bijv. Observant)
  assert.deepEqual(sheetPassives({ skills: [["Perception", "+4"]] }), { per: 14, ins: null, inv: null });
  assert.deepEqual(sheetPassives(null), { per: null, ins: null, inv: null });
  assert.deepEqual(sheetPassives({ passive: { per: 18, ins: 12, inv: 11 }, senses: "passive Perception 15" }), { per: 18, ins: 12, inv: 11 });
});

test("SP5: eigen waarde gaat voor de sheet, per waarde", () => {
  const c = { kind: "pc", sheet: { passive: { per: 14, ins: 11, inv: 14 } }, pas: { ins: 16 } };
  assert.deepEqual(passives(c), { per: 14, ins: 16, inv: 14 });
  assert.deepEqual(passives({ kind: "pc", pas: { per: 12 } }), { per: 12, ins: null, inv: null });
  assert.deepEqual(passives({ kind: "pc" }), { per: null, ins: null, inv: null });
});

test("SP5: opschonen, tekst en volgorde voor de hinderlaag", () => {
  assert.deepEqual(cleanPas({ per: "13", ins: "", inv: 0, x: 5 }), { per: 13 });
  assert.equal(cleanPas({ per: 41 }), undefined);
  assert.equal(cleanPas(null), undefined);
  assert.equal(pasVal("12.4"), 12);
  assert.equal(pasVal("abc"), null);
  assert.equal(pasText({ per: 14, ins: 12, inv: null }), "Perc 14 · Ins 12 · Inv –");
  assert.equal(pasText({ per: null, ins: null, inv: null }), "");
  const list = [
    { kind: "pc", name: "Bram", pas: { per: 12 } },
    { kind: "monster", name: "Goblin", pas: { per: 30 } },
    { kind: "pc", name: "Kees" },
    { kind: "pc", name: "Thalia", sheet: { senses: "passive Perception 15" } },
  ];
  assert.deepEqual(percList(list).map((x) => [x.name, x.v]), [["Thalia", 15], ["Bram", 12], ["Kees", null]]);
  assert.deepEqual(percList([{ kind: "pc", name: "Kees" }]), []);
});

/* ---------- VB4 ---------- */
const names = (q, sel = null, typed = false) => filterMonsters(srd, q, sel, typed);

test("VB4: NL-woorden vinden het Engelse monster, met uitleg in de kop", () => {
  const f = names("bandiet");
  assert.deepEqual(f.L.map((m) => m.n), ["Bandit", "Bandit Captain"]);
  assert.equal(f.label, '"bandiet" = bandit');
  assert.ok(names("skelet").L.some((m) => m.n === "Skeleton"));
  assert.equal(names("skelet").label, ""); // "skelet" zit al in "Skeleton": geen synoniem nodig
  assert.ok(names("draken").L.length > 40);
  assert.deepEqual(names("geest").L.map((m) => m.n).sort(), ["Ghost", "Specter", "Wraith"]);
  assert.ok(names("spinnen").L.some((m) => m.n === "Giant Spider"));
  assert.equal(names("reuzenspin").L[0].n, "Giant Spider");
  // NL-woord voor een type: gesorteerd op CR zoals "undead"
  const und = names("ondode").L;
  assert.ok(und.length > 10 && und.every((m, i) => i === 0 || crNum(und[i - 1].cr) <= crNum(m.cr)));
  for (const [k, v] of SYN) assert.ok(v.length && k === k.toLowerCase(), k);
});

test("VB4: typfouten als terugval, alleen als er niets gevonden wordt", () => {
  const g = names("gobin");
  assert.equal(g.label, "Bedoelde je: goblin");
  assert.ok(g.L.some((m) => m.n === "Goblin"));
  assert.equal(names("goblni").label, "Bedoelde je: goblin"); // verwisseling
  assert.equal(names("kobolt").sel, "Kobold");
  assert.equal(names("tyranosaurus").L[0].n, "Tyrannosaurus Rex"); // lang woord: afstand 2
  assert.equal(names("giant spidr").label, "Bedoelde je: spider");
  assert.equal(names("rta").L.length, 0); // korter dan 4: geen gok
  assert.equal(names("xyzq").L.length, 0);
  assert.equal(names("wolf").label, ""); // gewone treffer: geen correctie
});

test("VB4: editDist (Damerau-Levenshtein, begrensd)", () => {
  assert.equal(editDist("gobin", "goblin"), 1);
  assert.equal(editDist("goblni", "goblin"), 1);
  assert.equal(editDist("abc", "abc"), 0);
  assert.equal(editDist("abcdefgh", "a"), 3); // max 2 → max + 1
});

/* ---------- VB5 selectie ---------- */
test("VB5: tijdens typen wint één exacte naam van een eerdere keuze; een tik blijft staan", () => {
  assert.equal(names("bandit", "Bandit Captain", true).sel, "Bandit");
  assert.equal(names("bandit", "Bandit Captain", false).sel, "Bandit Captain"); // gekozen in de lijst
  assert.equal(names("bandiet", "Bandit Captain", true).sel, "Bandit"); // NL-woord naar één monster telt als exact
  assert.equal(names("geest", "Ghost", true).sel, "Ghost"); // drie exacte: keuze blijft
  assert.equal(names("brass", "Young Brass Dragon", true).sel, "Young Brass Dragon"); // geen exacte naam
});

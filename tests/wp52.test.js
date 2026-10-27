// WP52 (G1): conditie-uitleg volgens 2024 (CINFO24, catalogus dnd.cond24.*) en ed in de spelerssnapshot.
import { nl } from "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createI18n } from "../js/i18n/core.js";
import { LOCALES } from "../js/i18n/lang.js";
import { CINFO, CINFO24, cinfoKeys, condInfo } from "../js/rules/conditions.js";
import { toPlayerView, cleanView } from "../js/playerview.js";
import en from "../locales/en.js";
import nlCat from "../locales/nl.js";

const E = createI18n({ lang: "en", catalogs: { en }, locale: LOCALES.en });

test("CINFO24 ↔ catalogus: elke 24-regel bestaat in en en nl, geen losse dnd.cond24-sleutels, 14-regels bestaan in 2014", () => {
  const want = new Set();
  for (const [id, v] of Object.entries(CINFO24)) {
    assert.ok(Object.hasOwn(CINFO, id), `${id}: geen 2014-uitleg`);
    assert.ok(Array.isArray(v) && v.length && v.every((e) => e === 14 || e === 24), id);
    assert.ok(v.includes(24), `${id}: zonder eigen 2024-regel hoort hij niet in CINFO24`);
    v.forEach((e, i) => {
      if (e === 24) want.add(`dnd.cond24.${id}.${i + 1}`);
      else assert.ok(i < CINFO[id], `${id}.${i + 1}: deelt een 2014-regel die niet bestaat`);
    });
  }
  for (const cat of [en, nlCat]) {
    const have = Object.keys(cat).filter((k) => k.startsWith("dnd.cond24."));
    assert.deepEqual(have.sort(), [...want].sort());
    for (const k of want) assert.ok(cat[k].length > 10, k);
  }
});

test("condInfo: 2024-tekst alleen bij ed 2024; gelijke condities dezelfde sleutels; onbekend blijft null", () => {
  const g14 = condInfo("Grappled"), g24 = condInfo("Grappled", 0, "2024");
  assert.equal(g14.lines.length, 2);
  assert.equal(g24.lines.length, 3);
  assert.match(E.tr(g24.lines[0]), /Disadvantage on attack rolls against any target other than the grappler/);
  assert.match(E.tr(g14.lines[0]), /^Speed 0; bonuses/);
  assert.match(nl(g24.lines[2]), /^Ontsnappen/);
  // gedeelde regel: Petrified 1 is 2014, regel 2 eigen
  assert.deepEqual(cinfoKeys("Petrified", "2024"), ["dnd.cond.Petrified.1", "dnd.cond24.Petrified.2"]);
  // niet afwijkend: precies de 2014-uitleg
  for (const k of ["Blinded", "Prone", "Paralyzed", "Surprised"]) assert.deepEqual(cinfoKeys(k, "2024"), cinfoKeys(k, "2014"), k);
  assert.match(E.tr(condInfo("Stunned", 0, "2024").lines[0]), /can still move/);
  assert.match(E.tr(condInfo("Concentrating", 0, "2024").lines[0]), /maximum DC 30/);
  assert.doesNotMatch(E.tr(condInfo("Concentrating").lines[0]), /maximum/);
  assert.equal(condInfo("constructor", 0, "2024"), null);
  assert.deepEqual(cinfoKeys("toString", "2024"), []);
  // onzin-editie = 2014
  assert.deepEqual(condInfo("Grappled", 0, "2025"), g14);
});

test("Exhaustion-uitleg per editie", () => {
  const x24 = condInfo("Exhaustion", 2, "2024");
  assert.deepEqual(x24.lines.map(E.tr), ["2 −4 on d20 tests, speed −10 ft", "Up to six levels: per level −2 on d20 tests and speed −5 ft; level 6 is death. A long rest removes one level."]);
  assert.equal(E.tr(x24.name), "Exhaustion 2");
  assert.deepEqual(condInfo("Exhaustion", 0, "2024").lines.map(E.tr), [E.tr(x24.lines[1])]); // zonder niveau alleen de regel
  assert.equal(condInfo("Exhaustion", 6, "2024").lines.length, 2);
  assert.match(E.tr(condInfo("Exhaustion", 6, "2024").lines[0]), /^6 Death$/);
  assert.equal(condInfo("Exhaustion").lines.length, 7); // 2014 ongewijzigd: zes niveaus + regel
});

const pc = (o) => ({ kind: "pc", cond: [], dex: 0, ac: 15, hp: 20, max: 20, ...o });

test("snapshot: ed alleen bij regels 2024; cleanView houdt alleen \"2024\"; zonder ed = 2014", () => {
  const list = [pc({ id: "a", name: "Ari", init: 12, cond: ["Grappled"] })];
  assert.equal(toPlayerView({ list, round: 1, active: "a" }).ed, undefined);
  assert.equal(toPlayerView({ list, round: 1, active: "a", rules: "2014" }).ed, undefined);
  const V = toPlayerView({ list, round: 1, active: "a", rules: "2024" });
  assert.equal(V.ed, "2024");
  assert.equal(cleanView(V).ed, "2024");
  assert.equal(cleanView(JSON.parse(JSON.stringify(V))).ed, "2024");
  for (const bad of ["2014", "2025", 2024, { x: 1 }, null]) assert.equal(cleanView({ ...V, ed: bad }).ed, undefined, String(bad));
  const old = { ...V }; delete old.ed;
  assert.equal(cleanView(old).ed, undefined);
});

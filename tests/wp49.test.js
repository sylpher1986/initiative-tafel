// WP49: monsterkeuze per editie (zoekwoord 2014/2024, sleutel met editie, tag), Initiative uit plaktekst/eigen formaat
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadSrd, setLibrary, setSrd24, findMon, parseQuery, queryLabel, filterMonsters, searchList, monKey, keyRef, findKey,
  monEd, edTagOf, withEdWord, sanitizeOwn, loadSrd24, srd24Status } from "../js/data/monsters.js";
import { parseStatText, withParsed } from "../js/data/statparse.js";
import { monInit } from "../js/rules/turns.js";
import { loadPlan, missNames, fromList } from "../js/rules/encounters.js";

const read = (f) => JSON.parse(readFileSync(new URL("../data/" + f, import.meta.url)));
const srd = read("monsters.json"), srd24 = read("monsters-2024.json");
async function lib() {
  const f0 = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => srd });
  try { await loadSrd(); } finally { globalThis.fetch = f0; }
  setLibrary({ custom: [], imported: [] }); setSrd24(srd24);
}

test("WP49 parseQuery: 2014/2024 als los zoekwoord (laatste wint), niet in de naamwoorden; kop met editie", () => {
  assert.deepEqual(parseQuery("zombie 2024"), { words: ["zombie"], cr: null, type: "", bad: false, ed: "2024" });
  assert.equal(parseQuery("2024 zombie 2014").ed, "2014");
  assert.equal(parseQuery("zombie").ed, undefined);
  assert.equal(parseQuery("zombie2024").ed, undefined); // deel van een woord: geen editie
  assert.equal(queryLabel(parseQuery("undead cr 1 2024")), "2024 · Undead · CR 1");
  assert.equal(withEdWord("zombie", "2024", "2014"), "zombie 2024");
  assert.equal(withEdWord("zombie 2024", "2014", "2014"), "zombie"); // terug naar de tafeleditie: woord eruit
  assert.equal(withEdWord(" ogre 2014  zombie ", "2024", "2014"), "ogre zombie 2024");
});

test("WP49 searchList: 2014-tafel zonder zoekwoord = oude lijst; 2024 alleen SRD 5.2; sleutel en tag per editie", async () => {
  await lib();
  const f = filterMonsters(searchList("2014"), "zombie", null, true);
  assert.ok(f.L.length && f.L.every((m) => monEd(m) === "2014"), "aan een 2014-tafel alleen SRD 5.1");
  assert.equal(f.sel, "Zombie");
  const g = filterMonsters(searchList("2014", "2024"), "zombie 2024", null, true);
  assert.ok(g.L.length && g.L.every((m) => monEd(m) === "2024"));
  assert.equal(g.sel, monKey(findMon("Zombie", "2024")), "exacte naam zonder het editiewoord");
  assert.deepEqual(keyRef(g.sel), { n: "Zombie", ed: "2024" });
  assert.equal(findKey(g.sel).hp, 15); assert.equal(findKey("Zombie").hp, 22);
  assert.equal(edTagOf(findKey(g.sel), "2014"), "2024"); assert.equal(edTagOf(findKey(g.sel), "2024"), "");
  assert.equal(edTagOf(findMon("Zombie"), "2024"), "2014");
  assert.deepEqual(keyRef("Zombie"), { n: "Zombie" });
  // zoekwoord gelijk aan de tafel: alleen die SRD, zonder eigen monsters
  setLibrary({ custom: [{ n: "Zombie Lord", ac: "15", hp: 40 }] });
  assert.ok(filterMonsters(searchList("2014"), "zombie", null).L.some((m) => m.custom));
  assert.ok(!filterMonsters(searchList("2014", "2014"), "zombie 2014", null).L.some((m) => m.custom));
  assert.equal(edTagOf(findMon("Zombie Lord"), "2014"), ""); assert.equal(edTagOf(findMon("Zombie Lord"), "2024"), "");
  // review: een door een eigen monster overschaduwde SRD 5.1-naam staat niet in "2014" (ref zonder ed zou het eigen monster geven)
  setLibrary({ custom: [{ n: "Zombie", ac: "9", hp: 99 }] });
  const s14 = filterMonsters(searchList("2014", "2014"), "zombie 2014", null, true);
  assert.ok(!s14.L.some((m) => m.n === "Zombie")); assert.ok(!s14.sel || !findKey(s14.sel).custom);
  assert.equal(withEdWord("zombie,2024", "2014", "2014"), "zombie");
  assert.equal(filterMonsters(searchList("2014", "2024"), "zombie,2024", null, true).sel, monKey(findMon("Zombie", "2024")));
  // 2024-tafel: SRD 5.2 + eigen, zonder SRD 5.1; eigen "Zombie" en SRD 5.2-Zombie zijn twee keuzes
  setLibrary({ custom: [{ n: "Zombie", ac: "9", hp: 99 }] });
  const h = filterMonsters(searchList("2024"), "zombie", null);
  assert.ok(!h.L.some((m) => monEd(m) === "2014"));
  const z = h.L.filter((m) => m.n === "Zombie");
  assert.equal(z.length, 2); assert.notEqual(monKey(z[0]), monKey(z[1]));
  assert.equal(h.sel, null, "twee keer dezelfde naam: niets automatisch kiezen");
  setLibrary({ custom: [] }); setSrd24([]);
});

test("WP49 Initiative uit een geplakt statblock (eigen regel of 2024-AC-regel) en uit het eigen formaat → initBonus", () => {
  const p = parseStatText("Goblin Boss\nSmall Fey, Neutral\nAC 17 Initiative +2 (12)\nHP 21 (6d6)\nSpeed 30 ft.\nActions\nScimitar. Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage.");
  assert.equal(p.ac, "17"); assert.equal(p.init, 2);
  assert.equal(parseStatText("Ogre\nAC 11\nInitiative -1 (9)\nHP 59\nActions\nClub. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage.").init, -1);
  assert.equal(parseStatText("Ogre\nAC 11 (hide armor)\nHP 59\nActions\nClub. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage.").init, undefined);
  const m = withParsed({ n: "Goblin Boss", ac: "17", hp: 21, text: "AC 17 Initiative +2 (12)\nHP 21\nActions\nScimitar. Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage." });
  assert.equal(m.init, 2);
  assert.equal(monInit(m, 10).initBonus, 2); assert.equal(monInit(m, 10).init, 12);
  assert.equal(sanitizeOwn({ n: "X", init: 3 }).init, 3);
  assert.equal(sanitizeOwn({ n: "X", init: "-1" }).init, -1);
  for (const v of ["abc", 99, 1.5, "", " ", true, null]) assert.equal("init" in sanitizeOwn({ n: "X", init: v }), false, String(v));
});

test("WP49 B4: SRD 5.2 laadt niet → status fail, encounter-regel 2024 ontbreekt (\"Zombie · 2024\"), 2014-regel blijft", async () => {
  await lib(); setSrd24([]);
  const f0 = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try { assert.equal(await loadSrd24(), "fail"); } finally { globalThis.fetch = f0; }
  assert.equal(srd24Status(), "fail");
  const enc = fromList([{ kind: "monster", ref: "Zombie", ed: "2024" }, { kind: "monster", ref: "Goblin" }], { id: "e", name: "Graf", now: 1 });
  const p = loadPlan(enc, (r, ed) => !!findMon(r, ed));
  assert.deepEqual(missNames(p.missing), ["Zombie · 2024"]);
  assert.deepEqual(p.adds.map((a) => [a.ref, a.ed]), [["Goblin", undefined]]);
});

test("WP49 keuzelijsten geven de editie mee: geen findMon(selMon) of findMon(q.sel) meer", () => {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") && files.push(p); } };
  walk(new URL("../js", import.meta.url).pathname);
  assert.deepEqual(files.filter((p) => /findMon\((selMon|q\.sel)\)/.test(readFileSync(p, "utf8"))), []);
});

import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { rulesOf, spellEdOf, cleanEd, edField, rulesField, sameEd, refLabel } from "../js/rules/edition.js";
import { loadSrd, setLibrary, setSrd24, findMon, allMonsters } from "../js/data/monsters.js";
import { fromList, cleanEncounter, loadPlan, missNames, buildEncFile, parseEncFile, encMons, listMons, ENC_VERSION } from "../js/rules/encounters.js";
import { parseImport, buildExport, cleanCombatant, has2024 } from "../js/backup.js";
import { endSummary } from "../js/rules/fight.js";

const NOW = 1_800_000_000_000;
const srd = JSON.parse(readFileSync(new URL("../data/monsters.json", import.meta.url), "utf8"));
const app0 = (S, extra = {}) => ({ S, party: [], lairs: {}, custom: [], imported: [], encounters: [], spellNotes: {}, ...extra });

test("WP46 edition: rulesOf, spellEdOf, cleanEd en velden", () => {
  assert.equal(rulesOf(undefined), "2014"); assert.equal(rulesOf({}), "2014"); assert.equal(rulesOf({ rules: "2025" }), "2014");
  assert.equal(rulesOf({ rules: "2014" }), "2014"); assert.equal(rulesOf({ rules: "2024" }), "2024");
  // B2: regelset 2024 wint; bij 2014 geldt de instelling
  assert.equal(spellEdOf("2014", "2014"), "2014"); assert.equal(spellEdOf("2014", "2024"), "2024");
  assert.equal(spellEdOf("2024", "2014"), "2024"); assert.equal(spellEdOf("2014", "rommel"), "2014");
  assert.equal(cleanEd("2024"), "2024"); assert.equal(cleanEd("2014"), undefined); assert.equal(cleanEd(2024), undefined);
  assert.deepEqual(edField("2024"), { ed: "2024" }); assert.deepEqual(edField("2014"), {});
  assert.deepEqual(rulesField({ rules: "2024" }), { rules: "2024" }); assert.deepEqual(rulesField({ rules: "x" }), {});
  assert.ok(sameEd(undefined, "2014")); assert.ok(!sameEd(undefined, "2024"));
  assert.equal(refLabel({ ref: "Zombie" }), "Zombie"); assert.equal(refLabel({ ref: "Zombie", ed: "2024" }), "Zombie · 2024");
});

test("WP46 findMon: zonder ed exact het oude resultaat; 2024 zonder data geeft niets (geen terugval); eigen schaduwt alleen zonder ed", async () => {
  const f0 = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => srd });
  try { await loadSrd(); } finally { globalThis.fetch = f0; }
  setLibrary({ custom: [], imported: [] }); setSrd24([]);
  const z = findMon("Zombie");
  assert.ok(z && z.cr != null, "SRD 5.1-zombie");
  assert.equal(findMon("Zombie", undefined), z); assert.equal(findMon("Zombie", "2014"), z);
  assert.equal(findMon("Zombie", "2024"), undefined, "B4: geen stille terugval");
  assert.deepEqual(allMonsters("2024"), []);
  setLibrary({ custom: [{ n: "Zombie", ac: "9", hp: 99 }] });
  assert.equal(findMon("Zombie").hp, 99, "eigen monster schaduwt zonder ed");
  setSrd24([{ n: "Zombie", hp: 15, cr: "1/4" }]);
  assert.equal(findMon("Zombie", "2024").hp, 15, "2024: alleen SRD 5.2, geen schaduw");
  assert.equal(findMon("Zombie").hp, 99);
  assert.deepEqual(allMonsters("2024").map((m) => m.n), ["Zombie"]);
  setLibrary({ custom: [] }); setSrd24([]);
  assert.equal(findMon("Zombie"), z);
});

// Bewust editieloos (nog): de keuzelijst-aanroepers findMon(selMon) / findMon(q.sel) in actions.js en render.js; WP49 geeft daar de editie mee.
test("WP46 geen findMon(c.ref) zonder editie meer in js/", () => {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") && files.push(p); } };
  walk(new URL("../js", import.meta.url).pathname);
  const bad = files.filter((p) => /findMon\(\w+\.ref\)|find\(\w+\.ref\)/.test(readFileSync(p, "utf8")));
  assert.deepEqual(bad, []);
});

test("WP46 encounters: fromList splitst op editie, cleanEncounter houdt alleen 2024, loadPlan en missing per editie", () => {
  const list = [{ kind: "monster", ref: "Zombie" }, { kind: "monster", ref: "Zombie", ed: "2024" }, { kind: "monster", ref: "Zombie", ed: "2024" }, { kind: "monster", ref: "Zombie", ed: "2014" }];
  const e = fromList(list, { id: "e1", name: "Graf", now: NOW });
  assert.deepEqual(e.monsters, [{ ref: "Zombie", n: 1 }, { ref: "Zombie", n: 2, ed: "2024" }, { ref: "Zombie", n: 1 }]);
  const c = cleanEncounter({ name: "x", monsters: [{ ref: "A", n: 1, ed: "2024" }, { ref: "B", n: 1, ed: "2014" }, { ref: "C", n: 1, ed: "<b>" }] }, NOW);
  assert.deepEqual(c.monsters, [{ ref: "A", n: 1, ed: "2024" }, { ref: "B", n: 1 }, { ref: "C", n: 1 }]);
  const lib = { Zombie: { cr: "1/4" } };
  const p = loadPlan(e, (r, ed) => !ed && !!lib[r]);
  assert.deepEqual(p.adds.map((a) => [a.ref, a.n, a.ed]), [["Zombie", 1, undefined], ["Zombie", 1, undefined]]);
  assert.deepEqual(p.missing, [{ ref: "Zombie", ed: "2024" }]);
  assert.deepEqual(missNames(p.missing), ["Zombie · 2024"]);
  const p2 = loadPlan(e, () => true);
  assert.equal(p2.adds[1].ed, "2024");
  // moeilijkheid krijgt de editie mee
  const seen = [];
  encMons(e, (r, ed) => { seen.push(ed); return null; });
  listMons(list, (r, ed) => { seen.push(ed); return null; });
  assert.deepEqual(seen, [undefined, "2024", undefined, undefined, "2024", "2024", "2014"]);
});

test("WP46 encounterbestand: 2014 blijft v1, 2024 wordt v2; v2 leesbaar, v3 nieuwer; SRD 5.2 neemt geen eigen statblock mee", () => {
  assert.equal(ENC_VERSION, 2);
  const e14 = cleanEncounter({ id: "a", name: "Oud", updatedAt: NOW, monsters: [{ ref: "Goblin", n: 2 }] }, NOW);
  assert.equal(buildEncFile(e14).version, 1);
  const e24 = cleanEncounter({ id: "b", name: "Nieuw", updatedAt: NOW, monsters: [{ ref: "Zombie", n: 2, ed: "2024" }, { ref: "Gloom", n: 1 }] }, NOW);
  const own = [{ n: "Zombie", ac: "9", hp: 9 }, { n: "Gloom", ac: "12", hp: 20 }];
  const f = buildEncFile(e24, { own });
  assert.equal(f.version, 2);
  assert.deepEqual(f.monsters.map((m) => m.n), ["Gloom"], "eigen Zombie hoort niet bij de 2024-zombie");
  const back = parseEncFile(JSON.parse(JSON.stringify(f)), NOW);
  assert.deepEqual(back.enc, e24);
  assert.deepEqual(back.monsters.map((m) => m.n), ["Gloom"]);
  const smuggle = parseEncFile({ ...JSON.parse(JSON.stringify(f)), monsters: own }, NOW);
  assert.deepEqual(smuggle.monsters.map((m) => m.n), ["Gloom"]);
  assert.throws(() => parseEncFile({ ...f, version: 3 }, NOW), /./);
  assert.equal(parseEncFile({ ...buildEncFile(e14), version: 1 }, NOW).enc.name, "Oud");
});

test("WP46 backup: ed alleen op monsters, S.rules door import, versie 3 zonder en 4 met 2024-inhoud", () => {
  assert.equal(cleanCombatant({ kind: "monster", name: "Z", ref: "Zombie", ed: "2024" }).ed, "2024");
  assert.equal(cleanCombatant({ kind: "monster", name: "Z", ref: "Zombie", ed: "2014" }).ed, undefined);
  assert.equal(cleanCombatant({ kind: "pc", name: "A", ed: "2024" }).ed, undefined);
  assert.equal(cleanCombatant({ kind: "lair", name: "L", ed: "2024" }).ed, undefined);
  const S14 = { list: [{ id: "m", kind: "monster", name: "Zombie", ref: "Zombie", init: 5, hp: 22, max: 22, cond: [] }], round: 0, active: null };
  const x14 = buildExport(app0(S14));
  assert.equal(x14.version, 3);
  assert.ok(!("ed" in JSON.parse(JSON.stringify(x14)).state.list[0]));
  const i14 = parseImport(JSON.parse(JSON.stringify(x14)));
  assert.ok(!("rules" in i14.S)); assert.ok(!("ed" in JSON.parse(JSON.stringify(i14.S.list[0]))));
  // monster met ed 2024
  const S24 = { ...S14, list: [{ ...S14.list[0], ed: "2024" }] };
  const x24 = buildExport(app0(S24));
  assert.equal(x24.version, 4);
  assert.equal(parseImport(JSON.parse(JSON.stringify(x24))).S.list[0].ed, "2024");
  // regelset 2024 en een encounter met 2024 geven ook versie 4
  assert.ok(has2024(app0({ ...S14, rules: "2024" })));
  assert.ok(has2024(app0(S14, { encounters: [{ name: "x", monsters: [{ ref: "Z", n: 1, ed: "2024" }] }] })));
  assert.ok(!has2024(app0({ ...S14, rules: "2025" })));
  const xr = buildExport(app0({ ...S14, rules: "2024" }));
  assert.equal(xr.version, 4);
  assert.equal(parseImport(JSON.parse(JSON.stringify(xr))).S.rules, "2024");
  assert.ok(!("rules" in parseImport({ format: "initiative-tafel", version: 4, state: { list: [], rules: "2025" } }).S), "onzin wordt 2014 (weggelaten)");
  // encounters in de backup houden ed
  const enc = cleanEncounter({ id: "a", name: "Graf", updatedAt: 5, monsters: [{ ref: "Zombie", n: 2, ed: "2024" }] }, NOW);
  const xe = buildExport(app0(S14, { encounters: [enc] }));
  assert.equal(xe.version, 4);
  assert.deepEqual(parseImport(JSON.parse(JSON.stringify(xe))).encounters[0].monsters, [{ ref: "Zombie", n: 2, ed: "2024" }]);
  // v3-bestand van een oudere app leest ongewijzigd
  assert.equal(parseImport({ format: "initiative-tafel", version: 3, state: S14 }).S.list[0].ref, "Zombie");
});

test("WP46 endSummary zoekt het statblock met de editie van de deelnemer", () => {
  const S = { round: 2, list: [{ id: "a", kind: "monster", name: "Zombie", ref: "Zombie", ed: "2024", hp: 0, max: 15, cond: [] }, { id: "b", kind: "monster", name: "Zombie 2", ref: "Zombie", hp: 0, max: 22, cond: [] }] };
  const s = endSummary(S, (r, ed) => (ed === "2024" ? { cr: "1/4" } : { cr: "1/2" }), NOW);
  assert.deepEqual(s.mons.map((m) => m.xp), [50, 100]);
});

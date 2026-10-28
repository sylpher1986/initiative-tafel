// WP55 (G1 afsluiten): end-to-end over de modulegrenzen heen. De losse regels hebben hun eigen tests (edition, wp48–wp54);
// hier gaat het om de keten: bestand → import → tafel → regelwissel → export, encounter delen → inladen, gemengde tafel,
// en de snapshot naar het spelersscherm (de kamer zelf: tests/room.test.js, "G1").
import { nl } from "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadSrd, setLibrary, setSrd24, findMon } from "../js/data/monsters.js";
import { parseImport, buildExport, has2024 } from "../js/backup.js";
import { fromList, buildEncFile, parseEncFile, mergeEnc, loadPlan, missNames, listMons, difficulty } from "../js/rules/encounters.js";
import { rulesOf } from "../js/rules/edition.js";
import { setRules } from "../js/rules/combat.js";
import { setExh } from "../js/rules/effects.js";
import { exhEd, condInfo } from "../js/rules/conditions.js";
import { monInit, initBo } from "../js/rules/turns.js";
import { endSummary } from "../js/rules/fight.js";
import { toPlayerView, cleanView } from "../js/playerview.js";

const NOW = 1_800_000_000_000;
const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const SRD14 = read("data/monsters.json"), SRD24 = read("data/monsters-2024.json");
const json = (x) => JSON.parse(JSON.stringify(x));
const app0 = (S, extra = {}) => ({ S, party: [], lairs: {}, custom: [], imported: [], encounters: [], spellNotes: {}, ...extra });

async function libs({ with24 = true } = {}) {
  const f0 = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => SRD14 });
  try { await loadSrd(); } finally { globalThis.fetch = f0; }
  setLibrary({ custom: [{ n: "Gloom", ac: "12", hp: 20, cr: "1", xp: 200 }], imported: [] });
  setSrd24(with24 ? SRD24 : []);
}

/** Backup zoals een 2.3-app (vóór G1) hem schreef: versie 3, geen rules, geen ed, Exhaustion 4 met 2014-halvering */
function oldBackup() {
  const brom = { id: "b", pid: "p1", name: "Brom", kind: "pc", init: 15, dex: 2, ac: 16, hp: 20, max: 40, cond: [] };
  setExh(brom, 4); // 2014: max HP 40 → 20 (hpd op het effect)
  return json({
    format: "initiative-tafel", version: 3, exported: "2026-10-01T20:00:00.000Z",
    state: { list: [brom, { id: "z", name: "Zombie", ref: "Zombie", kind: "monster", init: 8, roll: 8, dex: -2, ac: 8, hp: 22, max: 22, cond: [] }], round: 0, active: null, log: [] },
    party: [{ pid: "p1", name: "Brom", ac: 16, hp: 40, max: 40, lvl: 3 }], lairs: {}, custom: [], imported: [],
    encounters: [{ id: "e1", name: "Crypte", notes: "", updatedAt: NOW, monsters: [{ ref: "Zombie", n: 3 }] }], spellNotes: { "hex": "eigen" },
  });
}

test("G1 e2e: oude backup v3 → import → export blijft v3 en betekent hetzelfde", async () => {
  await libs();
  const imp = parseImport(oldBackup());
  assert.equal(rulesOf(imp.S), "2014"); assert.ok(!("rules" in imp.S));
  const z = imp.S.list.find((c) => c.kind === "monster");
  assert.equal(findMon(z.ref, z.ed), findMon("Zombie"), "zelfde SRD 5.1-statblock (B3)");
  assert.equal(findMon(z.ref, z.ed).hp, 22);
  const brom = imp.S.list.find((c) => c.kind === "pc");
  assert.equal(brom.max, 20); assert.equal(exhEd(brom), "2014");
  const app = app0(imp.S, { party: imp.party, encounters: imp.encounters, spellNotes: imp.spellNotes });
  assert.equal(has2024(app), false);
  const x = json(buildExport(app));
  assert.equal(x.version, 3, "een oudere app op een tweede apparaat leest dit nog (B5)");
  const again = parseImport(x);
  assert.deepEqual(again.S.list, imp.S.list); assert.deepEqual(again.encounters, imp.encounters); assert.deepEqual(again.party, imp.party);
});

test("G1 e2e: v3 → regels 2024 → v4 → import → terug naar 2014 → weer v3, zonder betekenisverschil", async () => {
  await libs();
  const imp = parseImport(oldBackup());
  const before = json(imp.S.list);
  const r = setRules(imp.S, "2024");
  assert.ok(r); const brom = imp.S.list.find((c) => c.kind === "pc");
  assert.equal(brom.max, 40, "2024: geen halvering"); assert.equal(exhEd(brom), "2024");
  const x4 = json(buildExport(app0(imp.S, { party: imp.party, encounters: imp.encounters })));
  assert.equal(x4.version, 4);
  const imp4 = parseImport(x4);
  assert.equal(imp4.S.rules, "2024"); assert.equal(exhEd(imp4.S.list.find((c) => c.kind === "pc")), "2024");
  assert.ok(setRules(imp4.S, "2014"));
  assert.deepEqual(json(imp4.S.list), before, "terug naar 2014 = exact de oude tafel (reExh idempotent)");
  assert.equal(buildExport(app0(imp4.S, { party: imp4.party, encounters: imp4.encounters })).version, 3);
  // een oudere app (leest t/m 3) weigert de v4; deze app leest v4 maar niet v5
  const newer = (() => { try { parseImport({ format: "initiative-tafel", version: 99 }); } catch (e) { return e.message; } })();
  assert.ok(newer); assert.throws(() => parseImport({ ...x4, version: 5 }), (e) => e.message === newer, "melding: nieuwer bestand");
});

test("G1 e2e: 2024-encounter exporteren → importeren → inladen; zonder SRD 5.2 expliciet ontbrekend", async () => {
  await libs();
  const list = [
    { id: "1", kind: "monster", name: "Zombie 1", ref: "Zombie", ed: "2024", hp: 15, max: 15, cond: [] },
    { id: "2", kind: "monster", name: "Zombie 2", ref: "Zombie", ed: "2024", hp: 15, max: 15, cond: [] },
    { id: "3", kind: "monster", name: "Zombie 3", ref: "Zombie", hp: 22, max: 22, cond: [] },
    { id: "4", kind: "monster", name: "Gloom", ref: "Gloom", hp: 20, max: 20, cond: [], hidden: true },
  ];
  const enc = fromList(list, { id: "e9", name: "Gemengd graf", now: NOW });
  assert.deepEqual(enc.monsters.map((m) => [m.ref, m.n, m.ed ?? "-"]), [["Zombie", 2, "2024"], ["Zombie", 1, "-"], ["Gloom", 1, "-"]]);
  const file = json(buildEncFile(enc, { own: [{ n: "Gloom", ac: "12", hp: 20, cr: "1" }] }));
  assert.equal(file.version, 2);
  assert.deepEqual(file.monsters.map((m) => m.n), ["Gloom"], "eigen statblock mee, SRD niet");
  const got = parseEncFile(file, NOW);
  const lib = mergeEnc([], got.enc, "new", NOW, "kopie");
  assert.deepEqual(lib[0], enc);
  const has = (ref, ed) => !!findMon(ref, ed);
  const plan = loadPlan(lib[0], has);
  assert.deepEqual(plan.missing, []);
  assert.deepEqual(plan.adds.map((a) => [a.ref, a.n, a.ed ?? "-", a.hidden]), [["Zombie", 2, "2024", false], ["Zombie", 1, "-", false], ["Gloom", 1, "-", true]]);
  assert.notEqual(findMon("Zombie", "2024"), findMon("Zombie"), "twee verschillende statblocks onder dezelfde naam");
  // ander apparaat zonder (geladen) SRD 5.2: nooit terugvallen op de 2014-zombie (B4)
  setSrd24([]);
  const p2 = loadPlan(lib[0], has);
  assert.deepEqual(missNames(p2.missing), ["Zombie · 2024"]);
  assert.deepEqual(p2.adds.map((a) => a.ref), ["Zombie", "Gloom"]);
  assert.ok(p2.adds.every((a) => !a.ed));
  setSrd24(SRD24);
});

test("G1 e2e: gemengde tafel 2024 met een 2014-monster", async () => {
  await libs();
  const gw = findMon("Goblin Warrior", "2024"), gob = findMon("Goblin");
  assert.ok(gw && gob && !findMon("Goblin Warrior"), "Goblin Warrior bestaat alleen in SRD 5.2");
  const a = { id: "a", kind: "monster", name: "Goblin Warrior", ref: "Goblin Warrior", ed: "2024", hp: gw.hp, max: gw.hp, cond: [], ...monInit(gw, 10) };
  const b = { id: "b", kind: "monster", name: "Goblin", ref: "Goblin", hp: gob.hp, max: gob.hp, cond: [], ...monInit(gob, 10) };
  assert.equal(a.initBonus, gw.init, "2024-statblock: Initiative uit het statblock"); assert.equal(initBo(a), gw.init);
  assert.ok(!("initBonus" in b), "2014-monster: d20 + Dex zoals altijd"); assert.equal(b.init, 10 + b.dex);
  const pc = { id: "p", kind: "pc", name: "Ayla", init: 12, hp: 30, max: 30, cond: [], lvl: 1 };
  const S = { list: [a, b, pc], round: 0, active: null, rules: "2024" };
  // moeilijkheid volgens de tafel, met de XP van elk statblock in zijn eigen editie
  const mons = listMons(S.list, findMon);
  assert.deepEqual(mons.map((m) => m.cr), [gw.cr, gob.cr]);
  const d24 = difficulty(mons, [{ name: "Ayla", lvl: 1 }], false, rulesOf(S));
  assert.equal(d24.ed, "2024"); assert.equal(d24.xp, 100, "2 × CR 1/4 = 100 XP, geen multiplier");
  assert.equal(d24.rating, 2, "level 1: High-budget 100");
  // export houdt beide edities apart; import geeft dezelfde tafel
  const back = parseImport(json(buildExport(app0(S))));
  assert.equal(back.S.rules, "2024");
  assert.deepEqual(back.S.list.filter((c) => c.kind === "monster").map((c) => [c.ref, c.ed ?? "-"]), [["Goblin Warrior", "2024"], ["Goblin", "-"]]);
  // afronden: XP per deelnemer uit zijn eigen statblock
  const sum = endSummary({ ...S, round: 3, list: S.list.map((c) => (c.kind === "monster" ? { ...c, hp: 0 } : c)) }, findMon, NOW);
  assert.deepEqual(sum.mons.map((m) => m.xp), [50, 50]);
  // spelersscherm: regels van de tafel, geen editie per monster (verraadt niets)
  const V = cleanView(json(toPlayerView({ ...S, round: 1, active: "a" })));
  assert.equal(V.ed, "2024");
  assert.ok(V.list.every((r) => !("ed" in r) && !("ref" in r)));
});

test("G1 e2e: spelersscherm legt condities uit volgens de regels uit de snapshot", () => {
  const pc = { id: "p", kind: "pc", name: "Ayla", init: 12, hp: 30, max: 30, cond: [{ n: "Grappled" }] };
  for (const [rules, ed] of [[undefined, "2014"], ["2024", "2024"]]) {
    const V = cleanView(json(toPlayerView({ list: [pc], round: 1, active: "p", ...(rules ? { rules } : {}) })));
    assert.equal(V.ed ?? "2014", ed);
    const txt = condInfo("Grappled", 0, V.ed).lines.map(nl).join(" ");
    assert.equal(txt, condInfo("Grappled", 0, ed).lines.map(nl).join(" "));
  }
  assert.notDeepEqual(condInfo("Grappled", 0, "2024").lines, condInfo("Grappled", 0, "2014").lines);
  // een oude snapshot (v1, geen ed) blijft 2014
  assert.equal(cleanView({ v: 1, round: 0, list: [] }).ed, undefined);
});

test("G1 (B9): SRD 5.2-data staat in de offline-precache van de service worker", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  for (const f of ["data/monsters.json", "data/monsters-2024.json", "data/spells-2024.json"]) assert.ok(sw.includes(`"./${f}"`), f);
});

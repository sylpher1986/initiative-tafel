// SP2: resistances per speler (opslaan, D&D Beyond, bijwerken, AoE/aanval) en VB3: lage CR telt niet mee voor de multiplier
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDr, drMode, drToggle, drKind, drText, drDiff, targetMode, pickFor, defMode } from "../js/rules/aoe.js";
import { parseDdbJson, mergeSheet, drMerge, partyUpdate } from "../js/ddbjson.js";
import { cleanCombatant, parseImport } from "../js/backup.js";
import { difficulty, fromList, cleanEncounter, WEAK } from "../js/rules/encounters.js";
import { tidy } from "../js/rules/fight.js";

const mod = (type, subType, extra = {}) => ({ type, subType, value: null, statId: null, ...extra });
const ddb = (mods, inventory = []) => ({
  id: 77, name: "Brakka", stats: [10, 12, 14, 10, 10, 10].map((value, i) => ({ id: i + 1, value })), bonusStats: [], overrideStats: [],
  baseHitPoints: 20, race: { fullName: "Tiefling", weightSpeeds: { normal: { walk: 30 } } },
  classes: [{ level: 3, isStartingClass: true, definition: { name: "Fighter", hitDice: 10 }, classFeatures: [] }],
  modifiers: mods, inventory, characterValues: [],
});

test("cleanDr: alleen de 13 types, immuun wint, leeg = undefined, rommel valt weg", () => {
  assert.equal(cleanDr(null), undefined);
  assert.equal(cleanDr({}), undefined);
  assert.equal(cleanDr([]), undefined);
  assert.deepEqual(cleanDr({ r: ["<b>", "Fire"], i: "fire" }), { r: ["fire"] }, "geen array en onbekend type vallen weg");
  assert.deepEqual(cleanDr({ r: ["Fire", "cold", "fire"] }), { r: ["cold", "fire"] });
  assert.deepEqual(cleanDr({ r: ["poison", "fire"], i: ["poison"], v: ["fire", "radiant"] }), { i: ["poison"], r: ["fire"], v: ["radiant"] });
});

test("drMode/targetMode: speler uit zijn resistances, monster uit het statblock", () => {
  const dr = { r: ["fire"], i: ["poison"], v: ["radiant"] };
  assert.equal(drMode(dr, "Fire").mode, 0.5);
  assert.equal(drMode(dr, "poison").mode, 0);
  assert.equal(drMode(dr, "radiant").mode, 2);
  assert.equal(drMode(dr, "cold").mode, 1);
  assert.equal(drMode(undefined, "fire").mode, 1);
  assert.equal(drMode(dr, "").mode, 1);
  const pc = { kind: "pc", dr }, mon = { kind: "monster" }, x = [["Damage Resistances", "fire"]];
  assert.equal(targetMode(pc, { x: [["Damage Immunities", "fire"]] }, "fire").mode, 0.5, "speler: statblock telt niet");
  assert.equal(targetMode(mon, { x }, "fire").mode, 0.5);
  assert.equal(targetMode(mon, null, "fire").mode, 1);
  // pickFor met een kant-en-klare modus en (oud) met een statblock
  const p = pickFor(undefined, drMode(dr, "fire"), "fire");
  assert.equal(p.mode, 0.5); assert.equal(p.auto, true);
  assert.equal(pickFor({ sel: true, save: "fail", mode: 1, roll: null, lr: false }, drMode(dr, "fire"), "fire").mode, 1, "keuze van de DM wint");
  assert.equal(pickFor(undefined, x, "fire").mode, defMode(x, "fire").mode);
});

test("drToggle: tik zet het type in de gekozen soort, verplaatst het, tweede tik zet het uit", () => {
  let dr = drToggle(undefined, "r", "fire");
  assert.deepEqual(dr, { r: ["fire"] });
  dr = drToggle(dr, "i", "fire");
  assert.deepEqual(dr, { i: ["fire"] }, "verplaatst");
  assert.equal(drKind(dr, "fire"), "i"); assert.equal(drKind(dr, "cold"), null);
  dr = drToggle(dr, "r", "cold");
  assert.equal(drText(dr), "Resist cold · Immuun fire");
  assert.deepEqual(drToggle(dr, "i", "fire"), { r: ["cold"] });
  assert.equal(drToggle({ r: ["cold"] }, "r", "cold"), undefined, "laatste weg = geen veld");
  assert.equal(drText(undefined), "");
});

test("drDiff: korte tekst met + en −", () => {
  assert.equal(drDiff({ r: ["cold"] }, { r: ["fire"], i: ["poison"] }), "Resist +fire −cold, Immuun +poison");
  assert.equal(drDiff({ r: ["fire"] }, { r: ["fire"] }), "");
  assert.equal(drDiff(undefined, undefined), "");
});

test("D&D Beyond: resistance/immunity/vulnerability uit de modifiers; voorwaardelijk, condities en losse items tellen niet", () => {
  const got = parseDdbJson(ddb({
    race: [mod("resistance", "fire")],
    class: [mod("immunity", "poison"), mod("immunity", "poisoned"), mod("resistance", "bludgeoning-piercing-and-slashing-from-nonmagical-attacks")],
    item: [mod("resistance", "cold", { componentId: 9 }), mod("resistance", "lightning", { componentId: 8 })],
    feat: [], background: [], condition: [mod("resistance", "acid")],
  }, [{ id: 90, equipped: true, definition: { id: 9, name: "Ring of Cold Resistance", canAttune: true }, isAttuned: true },
    { id: 80, equipped: false, definition: { id: 8, name: "Ring of Lightning Resistance", canAttune: true }, isAttuned: false }]));
  assert.deepEqual(got.sheet.dr, { i: ["poison"], r: ["cold", "fire"] });
  assert.deepEqual(parseDdbJson(ddb({ race: [] })).sheet.dr, {}, "link-sheet zonder resistances: leeg object");
});

test("drMerge: nieuwe sheet volgt, eigen toevoegingen blijven; PDF-sheet (zonder dr) verandert niets", () => {
  const old = { dr: { r: ["fire"] } };
  assert.deepEqual(drMerge({ r: ["fire", "necrotic"] }, old, { dr: { r: ["cold"] } }), { r: ["cold", "necrotic"] }, "fire weg (van de sheet), necrotic eigen");
  assert.deepEqual(drMerge({ r: ["fire"] }, old, { cls: "Fighter 4" }), { r: ["fire"] });
  assert.equal(drMerge({ r: ["fire"] }, old, { dr: {} }), undefined);
  assert.deepEqual(drMerge({ r: ["acid"] }, null, { dr: { i: ["acid"] } }), { i: ["acid"] }, "zonder oude sheet: eigen keuze kan overschreven worden door de sheet");
});

test("mergeSheet en partyUpdate: resistances bijgewerkt met melding", () => {
  const t = { name: "Brakka", ac: 16, max: 20, hp: 12, sheet: { dr: { r: ["fire"] } }, dr: { r: ["fire", "thunder"] } };
  const ch = mergeSheet(t, { name: "Brakka", sheet: { dr: { r: ["fire"], i: ["poison"] } } });
  assert.deepEqual(t.dr, { i: ["poison"], r: ["fire", "thunder"] });
  assert.ok(ch.includes("Immuun +poison"), ch.join());
  const t2 = { name: "X", sheet: { dr: { r: ["fire"] } }, dr: { r: ["fire"] } };
  assert.ok(mergeSheet(t2, { name: "X", sheet: { dr: {} } }).includes("Resist −fire"));
  assert.equal("dr" in t2, false);
  const m = { pid: "p", name: "Brakka", ac: 16, max: 20, sheet: { dr: {} } };
  const got = parseDdbJson(ddb({ race: [mod("resistance", "fire")] }));
  const { f } = partyUpdate(m, got);
  mergeSheet(m, f);
  assert.deepEqual(m.dr, { r: ["fire"] });
});

test("backup: dr alleen bij spelers en opgeschoond; sheet.dr blijft ({} = geen)", () => {
  const pc = cleanCombatant({ id: "a", kind: "pc", name: "A", dr: { r: ["fire", "evil"], v: ["fire"] }, sheet: { name: "A", dr: { i: ["poison", 3] } } });
  assert.deepEqual(pc.dr, { r: ["fire"] });
  assert.deepEqual(pc.sheet.dr, { i: ["poison"] });
  assert.equal(cleanCombatant({ id: "m", kind: "monster", name: "G", dr: { r: ["fire"] } }).dr, undefined);
  assert.deepEqual(cleanCombatant({ id: "b", kind: "pc", name: "B", sheet: { name: "B", dr: {} } }).sheet.dr, {});
  assert.equal("dr" in cleanCombatant({ id: "c", kind: "pc", name: "C", sheet: { name: "C" } }).sheet, false, "PDF-sheet: geen dr");
  const imp = parseImport({ format: "initiative-tafel", version: 2, state: { list: [{ id: "a", kind: "pc", name: "A", dr: { i: ["acid"] } }], allMon: true }, party: [{ pid: "p", name: "A", dr: { r: ["cold"] } }] });
  assert.deepEqual(imp.S.list[0].dr, { i: ["acid"] });
  assert.deepEqual(imp.party[0].dr, { r: ["cold"] });
  assert.equal(imp.S.allMon, true);
  assert.equal(parseImport({ format: "initiative-tafel", version: 2, state: { list: [], allMon: "ja" } }).S.allMon, undefined);
});

/* ---------- VB3: lage CR ---------- */
const four5 = [5, 5, 5, 5].map((lvl, i) => ({ name: "p" + i, lvl }));

test("lage CR: telt niet mee voor de multiplier, XP wel (vergeleken met het sterkste monster)", () => {
  assert.equal(WEAK, 10);
  // Young Green Dragon (CR 8, 3900) + 4 kobolds (CR 1/8, 25): kobolds eruit → ×1
  const r = difficulty([{ name: "Young Green Dragon", cr: "8", n: 1 }, { name: "Kobold", cr: "1/8", n: 4 }], four5);
  assert.equal(r.n, 5); assert.equal(r.nm, 1); assert.deepEqual(r.weak, [{ name: "Kobold", n: 4 }]);
  assert.equal(r.xp, 4000); assert.equal(r.mult, 1); assert.equal(r.adj, 4000); assert.equal(r.all, false);
  // ook 10 kobolds blijven eruit (het gemiddelde zou verwateren)
  assert.equal(difficulty([{ name: "Y", cr: "8", n: 1 }, { name: "Kobold", cr: "1/8", n: 10 }], four5).nm, 1);
  // toch meetellen: 5 monsters → ×2
  const a = difficulty([{ name: "Young Green Dragon", cr: "8", n: 1 }, { name: "Kobold", cr: "1/8", n: 4 }], four5, true);
  assert.equal(a.nm, 5); assert.equal(a.mult, 2); assert.equal(a.adj, 8000); assert.equal(a.all, true);
  // net niet: CR 2 (450) naast CR 8 (3900) telt mee; CR 1/2 (100) niet
  assert.deepEqual(difficulty([{ name: "Y", cr: "8", n: 1 }, { name: "Ogre", cr: "2", n: 2 }, { name: "Orc", cr: "1/2", n: 2 }], four5).weak, [{ name: "Orc", n: 2 }]);
  // zelfde CR of geen XP: niets valt weg; all zonder lage CR = false
  const g = difficulty([{ name: "Goblin", cr: "1/4", n: 6 }, { name: "Raar", cr: "?", n: 1 }], four5, true);
  assert.equal(g.nm, 7); assert.deepEqual(g.weak, []); assert.equal(g.all, false);
  // alleen zwakke monsters bestaan niet: het sterkste telt altijd
  assert.equal(difficulty([{ name: "A", cr: "1/8", n: 3 }], four5).nm, 3);
});

test("lage CR: keuze bewaard in de encounter en weg met de monsters", () => {
  const L = [{ id: "g", kind: "monster", name: "Kobold", ref: "Kobold" }];
  assert.equal(fromList(L, { id: "e1", name: "X", now: 1, all: true }).all, true);
  assert.equal("all" in fromList(L, { id: "e1", name: "X", now: 1 }), false);
  assert.equal(cleanEncounter({ name: "X", monsters: [{ ref: "Kobold", n: 1 }], all: "ja" }).all, undefined);
  const S = { list: [{ id: "p", kind: "pc", name: "P" }], allMon: true };
  tidy(S);
  assert.equal("allMon" in S, false);
  const S2 = { list: L, allMon: true };
  tidy(S2);
  assert.equal(S2.allMon, true);
});

import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { noRatingCode, crXp, multiplier, clsLevel, pcLevel, partyFor, difficulty, ratingName, fromList, cleanEncounter, cleanEncounters, loadPlan,
  buildEncFile, parseEncFile, mergeEnc, duplicate, total, listMons, encMons, ENC_FORMAT, MAX_TOTAL } from "../js/rules/encounters.js";
import { parseImport, VERSION, buildExport } from "../js/backup.js";

const NOW = 1_760_000_000_000;
const mon = (id, ref, o = {}) => ({ id, name: ref, kind: "monster", ref, init: 10, cond: [], ...o });
const LIB = { Goblin: { n: "Goblin", cr: "1/4" }, Bugbear: { n: "Bugbear", cr: "1" }, Ogre: { n: "Ogre", cr: "2" }, Lich: { n: "Lich", cr: "21" }, Weird: { n: "Weird", cr: "", xp: 75 } };
const find = (n) => LIB[n];

test("CR → XP volgens de DMG-tabel", () => {
  assert.equal(crXp("0"), 10); assert.equal(crXp("1/8"), 25); assert.equal(crXp("1/4"), 50); assert.equal(crXp("1/2"), 100);
  assert.equal(crXp("1"), 200); assert.equal(crXp("5"), 1800); assert.equal(crXp(10), 5900); assert.equal(crXp("21"), 33000); assert.equal(crXp("30"), 155000);
  assert.equal(crXp(""), null); assert.equal(crXp("31"), null); assert.equal(crXp("abc"), null); assert.equal(crXp(0.5), 100);
});

test("multiplier: randen 1, 2, 3, 6, 7, 10, 11, 14, 15", () => {
  const m = (n) => multiplier(n, 4);
  assert.deepEqual([1, 2, 3, 6, 7, 10, 11, 14, 15, 40].map(m), [1, 1.5, 2, 2, 2.5, 2.5, 3, 3, 4, 4]);
});

test("multiplier: party < 3 een stap hoger, ≥ 6 een stap lager (tot ×5 en ×0,5)", () => {
  assert.equal(multiplier(1, 2), 1.5); assert.equal(multiplier(15, 1), 5); assert.equal(multiplier(3, 2), 2.5);
  assert.equal(multiplier(1, 6), 0.5); assert.equal(multiplier(2, 7), 1); assert.equal(multiplier(15, 6), 3);
  assert.equal(multiplier(1, 3), 1); assert.equal(multiplier(1, 5), 1);
});

test("level uit de klasse-string, ook multiclass; sheet wint van het eigen veld (level-up via D&D Beyond)", () => {
  assert.equal(clsLevel("Fighter 5 / Wizard 2"), 7);
  assert.equal(clsLevel("Wizard 5 (School of Evocation)"), 5);
  assert.equal(clsLevel("Wizard"), null); assert.equal(clsLevel(""), null); assert.equal(clsLevel(null), null);
  assert.equal(clsLevel("Fighter 15 / Rogue 10"), 20, "max 20");
  assert.equal(pcLevel({ sheet: { cls: "Rogue 3" } }), 3);
  assert.equal(pcLevel({ lvl: 4, sheet: { cls: "Rogue 3" } }), 3);
  assert.equal(pcLevel({ lvl: 4, sheet: { cls: "Rogue" } }), 4, "sheet zonder level: eigen veld");
  assert.equal(pcLevel({ lvl: 0 }), null); assert.equal(pcLevel({ lvl: "21" }), null); assert.equal(pcLevel({}), null);
});

test("party: spelers in de lijst (dood telt niet, level ook uit de party), anders de vaste party", () => {
  const party = [{ pid: "p1", name: "Ayla", lvl: 5 }, { pid: "p2", name: "Brom", sheet: { cls: "Cleric 4" } }];
  const list = [{ id: "a", kind: "pc", name: "Ayla", pid: "p1" }, { id: "x", kind: "pc", name: "X", ds: { dead: true } }, mon("g", "Goblin")];
  assert.deepEqual(partyFor(list, party), { src: "list", who: [{ name: "Ayla", lvl: 5, cid: "a", pid: "p1" }] });
  assert.deepEqual(partyFor([mon("g", "Goblin")], party), { src: "party", who: [{ name: "Ayla", lvl: 5, pid: "p1" }, { name: "Brom", lvl: 4, pid: "p2" }] });
});

test("moeilijkheid: 4 spelers level 5 tegen 5 goblins + bugbear (×2)", () => {
  const who = [5, 5, 5, 5].map((lvl, i) => ({ name: "p" + i, lvl }));
  const r = difficulty([{ name: "Goblin", cr: "1/4", n: 5 }, { name: "Bugbear", cr: "1", n: 1 }], who);
  assert.equal(r.n, 6); assert.equal(r.xp, 450); assert.equal(r.mult, 2); assert.equal(r.adj, 900);
  assert.deepEqual(r.th, [1000, 2000, 3000, 4400]);
  assert.equal(r.rating, -1); assert.equal(ratingName(r.rating), "Trivial");
  const h = difficulty([{ name: "Ogre", cr: "2", n: 3 }], who); // 1350 × 2 = 2700
  assert.equal(h.adj, 2700); assert.equal(ratingName(h.rating), "Medium");
  const d = difficulty([{ name: "Lich", cr: "21", n: 1 }], who);
  assert.equal(ratingName(d.rating), "Deadly");
  assert.equal(ratingName(difficulty([{ name: "Ogre", cr: "2", n: 4 }], who).rating), "Hard"); // 1800 × 2 = 3600
  assert.equal(ratingName(difficulty([{ name: "Ogre", cr: "2", n: 5 }], who).rating), "Deadly"); // 2250 × 2 = 4500
});

test("moeilijkheid: precies op de drempel telt als die drempel", () => {
  const who = [{ name: "a", lvl: 1 }, { name: "b", lvl: 1 }, { name: "c", lvl: 1 }]; // 75/150/225/300
  assert.equal(ratingName(difficulty([{ cr: "1/4", n: 1 }], who).rating), "Trivial"); // 50
  assert.equal(ratingName(difficulty([{ cr: "1/2", n: 1 }], who).rating), "Easy"); // 100
  assert.equal(ratingName(difficulty([{ cr: "1/4", n: 2 }], who).rating), "Medium"); // 100 × 1,5 = 150 = medium-drempel
});

test("moeilijkheid: level onbekend geeft geen oordeel maar wel XP; onbekende CR valt terug op xp of wordt gemeld", () => {
  const r = difficulty([{ name: "Goblin", cr: "1/4", n: 2 }], [{ name: "Thalia", lvl: null }, { name: "Brom", lvl: 3 }]);
  assert.equal(r.rating, null); assert.equal(r.th, null); assert.deepEqual(r.noLvl, ["Thalia"]); assert.equal(r.adj, 200, "2 spelers: ×1,5 wordt ×2");
  const x = difficulty([{ name: "Weird", cr: "", xp: 75, n: 1 }, { name: "Raar", cr: "?", n: 2 }], [{ name: "a", lvl: 3 }]);
  assert.equal(x.xp, 75); assert.deepEqual(x.noXp, ["Raar"]); assert.equal(x.n, 3);
  const none = difficulty([{ cr: "1", n: 1 }], []);
  assert.equal(none.rating, null); assert.equal(none.pcs, 0);
});

test("listMons/encMons: lair telt niet mee, CR uit de bibliotheek", () => {
  const L = [mon("a", "Goblin"), mon("b", "Goblin"), { id: "l", kind: "lair", name: "Lair", key: "Lair" }, { id: "p", kind: "pc", name: "P" }];
  assert.deepEqual(listMons(L, find).map((m) => m.cr), ["1/4", "1/4"]);
  assert.deepEqual(encMons({ monsters: [{ ref: "Ogre", n: 2 }, { ref: "Onbekend", n: 1 }] }, find), [{ name: "Ogre", n: 2, cr: "2", xp: undefined }, { name: "Onbekend", n: 1, cr: null, xp: null }]);
});

test("opslaan uit de lijst: samenvoegen per ref en vlaggen, spelers niet mee, groep alleen bij n > 1, lair met sleutel", () => {
  const L = [{ id: "p", kind: "pc", name: "Ayla" },
    mon("g1", "Goblin", { grp: "x1" }), mon("g2", "Goblin", { grp: "x1" }), mon("g3", "Goblin", { hidden: true }),
    mon("b1", "Bugbear", { anon: 1 }), mon("o1", "Ogre", { grp: "y" }), mon("z", "Raar", { ref: undefined }),
    { id: "l", kind: "lair", name: "Lair: Dragon", key: "Lair: Dragon", hidden: true }];
  const e = fromList(L, { id: "abc", name: "  Hinderlaag ", notes: "noot", now: NOW });
  assert.equal(e.name, "Hinderlaag"); assert.equal(e.updatedAt, NOW); assert.equal(e.id, "abc");
  assert.deepEqual(e.monsters, [{ ref: "Goblin", n: 2, grp: true }, { ref: "Goblin", n: 1, hidden: true }, { ref: "Bugbear", n: 1, anon: true }, { ref: "Ogre", n: 1 }]);
  assert.deepEqual(e.lair, { key: "Lair: Dragon", hidden: true });
  assert.equal(total(e), 5);
});

test("opslaan: lege lijst of alleen spelers = null; alleen een lair mag", () => {
  assert.equal(fromList([], { id: "a", name: "X", now: NOW }), null);
  assert.equal(fromList([{ kind: "pc", name: "P" }], { id: "a", name: "X", now: NOW }), null);
  assert.equal(fromList([mon("g", "Goblin")], { id: "a", name: "  ", now: NOW }), null, "naam verplicht");
  const l = fromList([{ id: "l", kind: "lair", name: "Lair", key: "Lair" }], { id: "a", name: "Alleen lair", now: NOW });
  assert.deepEqual(l.monsters, []); assert.deepEqual(l.lair, { key: "Lair" });
});

test("opschonen: rare waarden, grenzen en dubbele id's", () => {
  assert.equal(cleanEncounter(null), null); assert.equal(cleanEncounter([]), null); assert.equal(cleanEncounter({ name: "x" }), null);
  const e = cleanEncounter({ id: "<script>", name: "<b>X</b>".repeat(30), notes: 5, updatedAt: "nope", monsters: [
    { ref: "Goblin", n: "3", hidden: "ja", grp: true }, { ref: "", n: 2 }, { ref: "Ogre", n: -1 }, { ref: "Bugbear", n: 1, grp: true }, 7, null,
    { ref: { a: 1 }, n: 1 }], lair: { key: 5 } }, NOW);
  assert.match(e.id, /^[A-Za-z0-9_-]+$/); assert.notEqual(e.id, "<script>");
  assert.equal(e.name.length, 80); assert.equal(e.notes, "5"); assert.equal(e.updatedAt, NOW);
  assert.deepEqual(e.monsters, [{ ref: "Goblin", n: 3, grp: true }, { ref: "Bugbear", n: 1 }, { ref: "[object Object]", n: 1 }]);
  assert.deepEqual(e.lair, { key: "5" });
  const big = cleanEncounter({ name: "Leger", monsters: Array.from({ length: 60 }, () => ({ ref: "Goblin", n: 999 })) }, NOW);
  assert.equal(total(big), MAX_TOTAL); assert.deepEqual(big.monsters.map((m) => m.n), [50, 50]);
  assert.equal(cleanEncounter({ name: "Toekomst", updatedAt: NOW * 2, monsters: [{ ref: "G", n: 1 }] }, NOW).updatedAt, NOW);
  const L = cleanEncounters([{ id: "a", name: "Oud", updatedAt: 1, monsters: [{ ref: "G", n: 1 }] }, { id: "a", name: "Nieuw", updatedAt: 2, monsters: [{ ref: "G", n: 1 }] }, "x", { id: "b", name: "" }], NOW);
  assert.deepEqual(L.map((e) => e.name), ["Nieuw"]);
  assert.deepEqual(cleanEncounters("geen lijst"), []);
});

test("inladen: plan met ontbrekende statblocks; groep = groepsworp", () => {
  const e = { monsters: [{ ref: "Goblin", n: 3, grp: true, hidden: true }, { ref: "Shadow Hound", n: 2 }, { ref: "Bugbear", n: 1, anon: true }, { ref: "Shadow Hound", n: 1 }], lair: { key: "L" } };
  const p = loadPlan(e, (r) => !!find(r));
  assert.deepEqual(p.adds, [{ ref: "Goblin", n: 3, hidden: true, anon: false, init: "group" }, { ref: "Bugbear", n: 1, hidden: false, anon: true, init: "each" }]);
  assert.deepEqual(p.missing, ["Shadow Hound"]); assert.deepEqual(p.lair, { key: "L" });
});

test("bestand per encounter: rondreis met eigen statblocks en lair actions; onbetrouwbaar bestand", () => {
  const enc = cleanEncounter({ id: "e1", name: "Grot", updatedAt: NOW, monsters: [{ ref: "Gloomwing", n: 2 }, { ref: "Goblin", n: 1 }], lair: { key: "Lair: Grot" } }, NOW);
  const own = [{ n: "Gloomwing", ac: "14", hp: 30 }, { n: "Anders", ac: "1", hp: 1 }];
  const f = buildEncFile(enc, { own, lairs: { "Lair: Grot": [{ n: "Rots", t: "Valt" }], Anders: [] } });
  assert.equal(f.format, ENC_FORMAT);
  assert.deepEqual(f.monsters.map((m) => m.n), ["Gloomwing"]); assert.deepEqual(Object.keys(f.lairs), ["Lair: Grot"]);
  const back = parseEncFile(JSON.parse(JSON.stringify(f)), NOW);
  assert.deepEqual(back.enc, enc); assert.equal(back.monsters.length, 1); assert.deepEqual(back.lairs["Lair: Grot"], [{ n: "Rots", t: "Valt" }]);
  assert.throws(() => parseEncFile({ format: "initiative-tafel" }), /Geen encounter-bestand/);
  assert.throws(() => parseEncFile(null), /Geen encounter-bestand/);
  assert.throws(() => parseEncFile({ format: ENC_FORMAT, version: 9, encounter: enc }), /nieuwere versie/);
  assert.throws(() => parseEncFile({ format: ENC_FORMAT, version: 1, encounter: { name: "leeg" } }), /leeg of beschadigd/);
  const r = parseEncFile({ format: ENC_FORMAT, version: 1, encounter: enc, monsters: [{ n: "Vreemd" }, "x"], lairs: { "Lair: Grot": "geen lijst" } }, NOW);
  assert.deepEqual(r.monsters, []); assert.deepEqual(r.lairs, {});
});

test("import samenvoegen: nieuw, vervangen, als kopie; dupliceren nummert door", () => {
  const a = cleanEncounter({ id: "a", name: "Grot", updatedAt: 1, monsters: [{ ref: "G", n: 1 }] }, NOW);
  const L = [a];
  assert.equal(mergeEnc(L, { ...a, id: "b" }, "new", NOW).length, 2);
  const rep = mergeEnc(L, { ...a, notes: "nieuw" }, "replace", NOW);
  assert.equal(rep.length, 1); assert.equal(rep[0].notes, "nieuw"); assert.equal(rep[0].updatedAt, NOW); assert.equal(L[0].notes, "", "oude lijst ongewijzigd");
  const cp = mergeEnc(L, a, "copy", NOW);
  assert.equal(cp.length, 2); assert.notEqual(cp[1].id, "a"); assert.equal(cp[1].name, "Grot (kopie)");
  const d1 = duplicate(a, cp, NOW);
  assert.equal(d1.name, "Grot (kopie 2)"); assert.notEqual(d1.id, a.id);
  d1.monsters[0].n = 9; assert.equal(a.monsters[0].n, 1, "diepe kopie");
  assert.equal(duplicate(cp[1], cp, NOW).name, "Grot (kopie 2)", "kopie van een kopie: geen (kopie) (kopie)");
});

test("backup versie 2: encounters erbij; versie 1 migreert naar een lege lijst", () => {
  assert.equal(VERSION, 2);
  const v1 = parseImport({ format: "initiative-tafel", version: 1, state: { list: [] }, party: [] });
  assert.deepEqual(v1.encounters, []);
  const enc = cleanEncounter({ id: "a", name: "Grot", updatedAt: 5, monsters: [{ ref: "Goblin", n: 2 }] }, NOW);
  const exp = buildExport({ S: { list: [], round: 0, active: null }, party: [], lairs: {}, custom: [], imported: [], encounters: [enc] });
  assert.equal(exp.version, 2);
  const v2 = parseImport(JSON.parse(JSON.stringify(exp)));
  assert.deepEqual(v2.encounters, [enc]);
  const rare = parseImport({ format: "initiative-tafel", version: 2, state: {}, encounters: [{ name: "x" }, { id: "<", name: "Ok", monsters: [{ ref: "G", n: 1 }] }, "y"] });
  assert.equal(rare.encounters.length, 1); assert.equal(rare.encounters[0].name, "Ok");
  const noArr = parseImport({ format: "initiative-tafel", version: 2, state: {}, encounters: "kapot" });
  assert.deepEqual(noArr.encounters, []);
});

test("backup: levelveld van partyleden blijft bewaard en wordt begrensd", () => {
  const r = parseImport({ format: "initiative-tafel", version: 2, state: { list: [{ id: "x", kind: "pc", name: "A", lvl: 7, pid: "p" }] }, party: [{ pid: "p", name: "A", lvl: 5 }, { pid: "q", name: "B", lvl: 99 }] });
  assert.equal(r.party[0].lvl, 5); assert.equal(r.party[1].lvl, undefined); assert.equal(r.S.list[0].lvl, 7);
});

test("party aan tafel: level van het partylid is de bron, de speler zelf als terugval", () => {
  const party = [{ pid: "p1", name: "Ayla", lvl: 6 }];
  const r = partyFor([{ kind: "pc", name: "Ayla", pid: "p1", lvl: 2 }, { kind: "pc", name: "Los", lvl: 3 }], party);
  assert.deepEqual(r.who.map((p) => p.lvl), [6, 3]);
});

test("party: verwijzing waar een ontbrekend level heen gaat (VB1)", () => {
  const party = [{ pid: "p1", name: "Ayla" }];
  const r = partyFor([{ id: "c1", kind: "pc", name: "Ayla", pid: "p1" }, { id: "c2", kind: "pc", name: "Los" }, { id: "c3", kind: "pc", name: "Weg", pid: "p9" }], party);
  assert.deepEqual(r.who.map(({ cid, pid }) => ({ cid, pid })), [{ cid: "c1", pid: "p1" }, { cid: "c2", pid: undefined }, { cid: "c3", pid: undefined }], "pid alleen als het partylid bestaat");
});

test("geen oordeel: level buiten 1–20 telt als onbekend (geen crash), alleen monsters zonder CR = CR onbekend", () => {
  const bad = difficulty([{ name: "G", cr: "1", n: 1 }], [{ name: "a", lvl: 25 }, { name: "b", lvl: 0 }]);
  assert.equal(bad.rating, null); assert.deepEqual(bad.noLvl, ["a", "b"]); assert.equal(noRatingCode(bad), "lvl");
  const cr = difficulty([{ name: "Eigen", cr: "", n: 3 }], [{ name: "a", lvl: 3 }]);
  assert.equal(cr.rating, null); assert.equal(noRatingCode(cr), "cr");
  assert.equal(noRatingCode(difficulty([{ cr: "1", n: 1 }], [])), "party");
  assert.equal(noRatingCode(difficulty([{ cr: "1", n: 1 }], [{ name: "a", lvl: 3 }])), null);
  const mix = difficulty([{ name: "Eigen", cr: "", n: 1 }, { name: "G", cr: "1", n: 1 }], [{ name: "a", lvl: 3 }]);
  assert.notEqual(mix.rating, null, "deels bekend: wel een oordeel, met melding");
});

test("opslaan: lange reeks wordt opgesplitst in regels van max 50, totaal max 100", () => {
  const L = Array.from({ length: 120 }, (_, i) => mon("g" + i, "Goblin"));
  const e = fromList(L, { id: "a", name: "Leger", now: NOW });
  assert.deepEqual(e.monsters.map((m) => m.n), [50, 50]);
  assert.equal(total(e), 100);
});

test("encounter-bestand: hetzelfde statblock dubbel = één keer", () => {
  const enc = { id: "e1", name: "Grot", monsters: [{ ref: "Gloomwing", n: 1 }] };
  const r = parseEncFile({ format: ENC_FORMAT, version: 1, encounter: enc, monsters: [{ n: "Gloomwing", hp: 1 }, { n: "Gloomwing", hp: 2 }] }, NOW);
  assert.deepEqual(r.monsters, [{ n: "Gloomwing", hp: 1 }]);
});

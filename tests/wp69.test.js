// WP69: kaart (Inn Sight) kiezen bij een encounter: verwijzing { id, name }, geen kopie; optioneel veld zonder nieuwe versie.
import "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMapRef, cleanEncounter, cleanEncounters, duplicate, buildEncFile, parseEncFile, fromList, MAP_NAME_MAX, ENC_VERSION } from "../js/rules/encounters.js";
import { parseImport, buildExport, VERSION } from "../js/backup.js";
import { mapId, importedDoc, cleanMap, NAME_MAX } from "../js/maps/model/map.js";

const NOW = 1_760_000_000_000;
const ENC = { id: "e1", name: "Grot", monsters: [{ ref: "Goblin", n: 2 }] };

test("cleanMapRef: id zoals Inn Sight hem maakt, naam opgeschoond en begrensd", () => {
  const id = mapId(NOW, () => 0.5);
  assert.deepEqual(cleanMapRef({ id, name: "  Grot\u0000 der\n  goblins " }), { id, name: "Grot der goblins" });
  assert.deepEqual(cleanMapRef({ id }), { id, name: "" });
  assert.equal(cleanMapRef({ id: "ABC123" }), null); // hoofdletters maakt mapId nooit
  assert.equal(cleanMapRef({ id: "a1" }), null);
  assert.equal(cleanMapRef({ id: "<script>" }), null);
  assert.equal(cleanMapRef({ id: 12345678 }), null);
  assert.equal(cleanMapRef("abcdef12"), null);
  assert.equal(cleanMapRef([]), null);
  assert.equal(cleanMapRef(null), null);
  assert.equal([...cleanMapRef({ id, name: "🐉".repeat(100) }).name].length, MAP_NAME_MAX);
  assert.equal(MAP_NAME_MAX, NAME_MAX); // zelfde grens als Inn Sight
  assert.ok(cleanMap({ id, grid: {} }), "dezelfde id is ook voor Inn Sight geldig");
});

test("cleanEncounter houdt map, laat onzin weg; extra velden gaan niet mee", () => {
  const e = cleanEncounter({ ...ENC, map: { id: "abcdef123", name: "Grot", extra: 1 } }, NOW);
  assert.deepEqual(e.map, { id: "abcdef123", name: "Grot" });
  assert.equal("map" in cleanEncounter({ ...ENC, map: { id: "x" } }, NOW), false);
  assert.equal("map" in cleanEncounter(ENC, NOW), false);
  assert.equal(cleanEncounter({ name: "Alleen kaart", monsters: [], map: { id: "abcdef123" } }, NOW), null, "een kaart alleen is geen encounter");
  assert.equal(cleanEncounters([{ ...ENC, map: { id: "abcdef123" } }], NOW)[0].map.id, "abcdef123");
});

test("duplicate en fromList: kopie houdt de verwijzing (geen kopie van de kaart), opslaan uit de lijst heeft geen kaart", () => {
  const e = cleanEncounter({ ...ENC, map: { id: "abcdef123", name: "Grot" } }, NOW);
  const d = duplicate(e, [e], NOW, "kopie");
  assert.deepEqual(d.map, e.map);
  assert.notEqual(d.map, e.map, "eigen object, niet gedeeld");
  const f = fromList([{ id: 1, kind: "monster", ref: "Goblin", name: "Goblin" }], { id: "e2", name: "x", now: NOW });
  assert.equal("map" in f, false);
});

test("backup: map gaat heen en terug zonder nieuwe versie", () => {
  const enc = cleanEncounter({ ...ENC, map: { id: "abcdef123", name: "Grot" } }, NOW);
  const exp = buildExport({ S: { list: [], round: 0, active: null }, party: [], lairs: {}, custom: [], imported: [], encounters: [enc] });
  assert.ok(exp.version <= 4 && VERSION === 4, "geen backup-versie 5");
  const back = parseImport(JSON.parse(JSON.stringify(exp)));
  assert.deepEqual(back.encounters[0].map, { id: "abcdef123", name: "Grot" });
  const rare = parseImport({ ...JSON.parse(JSON.stringify(exp)), encounters: [{ ...enc, map: { id: "../../x", name: "<b>" } }] });
  assert.equal("map" in rare.encounters[0], false);
});

test("encounterbestand: verwijzing mee, versie ongewijzigd (1 zonder 2024-inhoud)", () => {
  const enc = cleanEncounter({ ...ENC, map: { id: "abcdef123", name: "Grot" } }, NOW);
  const f = buildEncFile(enc);
  assert.equal(f.version, 1);
  assert.ok(ENC_VERSION === 2);
  const p = parseEncFile(JSON.parse(JSON.stringify(f)), NOW);
  assert.deepEqual(p.enc.map, { id: "abcdef123", name: "Grot" });
});

test("importedDoc (Inn Sight en Initiative): nieuwe id, unieke naam, tijden nu", () => {
  const m = cleanMap({ id: "import0", name: "Grot", grid: { cols: 10, rows: 8 } }); delete m.id;
  const d = importedDoc(m, ["Grot", "grot (2)"], "Kaart", { id: "abcdef123", now: NOW });
  assert.equal(d.id, "abcdef123");
  assert.notEqual(d.name, "Grot");
  assert.equal(d.createdAt, NOW); assert.equal(d.updatedAt, NOW);
  assert.equal(d.grid.cols, 10);
  const leeg = importedDoc({ ...m, name: "" }, ["Kaart 1"], "Kaart", { now: NOW });
  assert.equal(leeg.name, "Kaart 2");
  assert.ok(cleanMap(leeg), "geldig document");
});

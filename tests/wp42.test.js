// WP42 (RE6b): eigen notitie bij niet-SRD-spells, export versie 3.
import { test } from "node:test";
import assert from "node:assert/strict";
import { noteFor, setNote, cleanSpellNotes, NOTE_MAX, NOTES_MAX } from "../js/data/spellnotes.js";
import { parseImport, buildExport, VERSION, FORMAT } from "../js/backup.js";

test("setNote/noteFor: per genormaliseerde naam, leeg = weg, oude object ongewijzigd", () => {
  const a = setNote({}, "Hex", "  Bonus action · 90 ft  ");
  assert.deepEqual(a, { hex: { n: "Hex", t: "Bonus action · 90 ft" } });
  assert.equal(noteFor(a, "HEX").t, "Bonus action · 90 ft");
  assert.equal(noteFor(a, "hex*").t, "Bonus action · 90 ft", "zelfde normalisatie als de spell-opzoeking");
  assert.equal(noteFor(a, "Ray of Sickness"), null);
  const b = setNote(a, "hex", "nieuw");
  assert.equal(b.hex.t, "nieuw"); assert.equal(a.hex.t, "Bonus action · 90 ft");
  const c = setNote(b, "Hex", "   ");
  assert.deepEqual(c, {}); assert.equal(b.hex.t, "nieuw");
  assert.equal(setNote(c, "Hex", ""), c, "wissen zonder notitie: zelfde object");
  assert.equal(setNote(c, "  ", "x"), c, "lege naam weigert");
  assert.equal(noteFor(null, "Hex"), null);
  assert.equal(noteFor({}, "constructor"), null, "geen prototype-eigenschappen");
});

test("setNote: lengte begrensd, regeleinden genormaliseerd, maximum aantal", () => {
  assert.equal(setNote({}, "Hex", "x".repeat(NOTE_MAX + 50)).hex.t.length, NOTE_MAX);
  assert.equal(setNote({}, "Hex", "a\r\nb\rc").hex.t, "a\nb\nc");
  const full = Object.fromEntries(Array.from({ length: NOTES_MAX }, (_, i) => [`s${i}`, { n: `S${i}`, t: "x" }]));
  assert.equal(setNote(full, "Nieuw", "x"), full, "vol: geen nieuwe");
  assert.equal(setNote(full, "S3", "y").s3.t, "y", "vol: bestaande bijwerken mag");
  assert.equal(Object.keys(setNote(full, "S3", "")).length, NOTES_MAX - 1, "vol: wissen mag");
});

test("cleanSpellNotes: sleutel uit de naam, rare data weg", () => {
  assert.deepEqual(cleanSpellNotes(null), {});
  assert.deepEqual(cleanSpellNotes([{ n: "Hex", t: "x" }]), {});
  const r = cleanSpellNotes({
    fout: { n: "Hex", t: "a" }, dubbel: { n: "HEX", t: "b" }, leeg: { n: "Bane", t: "  " }, geenNaam: { n: "", t: "x" },
    num: { n: 5, t: "x" }, txt: "kapot", lang: { n: "Ray of Sickness", t: "y".repeat(NOTE_MAX + 1) }, __proto__x: { n: "<b>", t: "<script>" },
  });
  assert.deepEqual(Object.keys(r), ["hex", "ray of sickness", "<b>"]);
  assert.equal(r.hex.t, "a", "eerste wint");
  assert.equal(r["ray of sickness"].t.length, NOTE_MAX);
  assert.equal(r["<b>"].t, "<script>", "tekst blijft tekst; escapen gebeurt bij tonen");
  const proto = cleanSpellNotes(JSON.parse('{"a":{"n":"__proto__","t":"x"},"b":{"n":"Bane","t":"y"}}'));
  assert.equal(Object.getPrototypeOf(proto), Object.prototype, "prototype ongewijzigd");
  assert.deepEqual(Object.keys(proto), ["__proto__", "bane"]); assert.equal(noteFor(proto, "__proto__").t, "x");
  const many = Object.fromEntries(Array.from({ length: NOTES_MAX + 5 }, (_, i) => [i, { n: `S${i}`, t: "x" }]));
  assert.equal(Object.keys(cleanSpellNotes(many)).length, NOTES_MAX);
});

test("export versie 3: spellNotes heen en terug; versie 1 en 2 migreren naar leeg", () => {
  assert.equal(VERSION, 4); // leest t/m 4; zonder 2024-inhoud wordt nog 3 geschreven (WP46)
  const spellNotes = setNote({}, "Hex", "Bonus action");
  const exp = buildExport({ S: { list: [], round: 0, active: null }, party: [], lairs: {}, custom: [], imported: [], encounters: [], spellNotes });
  assert.equal(exp.version, 3);
  assert.deepEqual(parseImport(JSON.parse(JSON.stringify(exp))).spellNotes, spellNotes);
  // export van 2.1.x (versie 2) en van 1.48.0 (ook versie 2) en heel oud (versie 1)
  const v2 = parseImport({ format: FORMAT, version: 2, exported: "2026-10-20T10:00:00.000Z", state: { list: [{ id: "a", kind: "pc", name: "Aria", hp: 10, max: 12 }], round: 0, active: null }, party: [], lairs: {}, custom: [], imported: [], encounters: [] });
  assert.deepEqual(v2.spellNotes, {}); assert.equal(v2.S.list[0].name, "Aria");
  assert.deepEqual(parseImport({ format: FORMAT, version: 1, state: { list: [] } }).spellNotes, {});
  assert.deepEqual(parseImport({ format: FORMAT, version: 2, state: {}, spellNotes: { x: { n: "Hex", t: "smokkel" } } }).spellNotes, {}, "versie 2 heeft geen notities");
  assert.deepEqual(parseImport({ format: FORMAT, version: 3, state: {}, spellNotes: "kapot" }).spellNotes, {});
  assert.deepEqual(parseImport({ format: FORMAT, version: 3, state: {} }).spellNotes, {});
});

test("export uit een nieuwere app (versie 5) wordt geweigerd met een melding", () => {
  assert.throws(() => parseImport({ format: FORMAT, version: 5, state: {} }), (e) => e instanceof Error && e.message.length > 0);
});

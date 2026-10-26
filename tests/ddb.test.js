import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDdbFields, ddbMsg } from "../js/ddb.js";
import { initI18n } from "../js/i18n/boot.js";

const lang = (l) => initI18n({ doc: { documentElement: { lang: l } }, search: "", storage: null });
await lang("nl"); // teksten komen uit de catalogus (WP24)

// Verzonnen sheet in het veldformaat van een D&D Beyond PDF-export
const f = (page, fieldName, fieldValue, y = 0, x = 40) => ({ page, fieldName, fieldValue, rect: [x, y, x + 100, y + 10] });
const annots = [
  f(1, "CharacterName", "Testa Vonk"), f(1, "CLASS  LEVEL", "Wizard 5"), f(1, "RACE", "Elf"),
  f(1, "AC", "13"), f(1, "MaxHP", "27"), f(1, "Init", "+3"), f(1, "DEXmod ", "+3"),
  f(1, "DEX", "16"), f(1, "INT", "18"), f(1, "ST Intelligence", "+7"), f(1, "Arcana", "+7"),
  f(1, "Wpn Name", "Dagger"), f(1, "Wpn1 AtkBonus", "+6"), f(1, "Wpn1 Damage", "1d4+3 Piercing"),
  f(1, "Actions1", "=== ACTIONS ===\nArcane Recovery • 1 / Long Rest\n| Portent: 2 / Long Rest"),
  f(5, "spellHeader0", "=== CANTRIPS ===", 630), f(5, "spellName0", "Fire Bolt", 620),
  f(5, "spellHeader1", "=== 1st LEVEL ===", 600), f(5, "spellSlotHeader1", "4 Slots OOOO", 600),
  f(5, "spellName1", "Magic Missile", 590), f(5, "spellName2", "Shield", 580),
  f(5, "spellHeader2", "=== 3rd LEVEL ===", 560), f(5, "spellSlotHeader2", "2 Slots OO", 560),
  f(5, "spellName3", "Fly", 550), f(5, "spellDuration3", "Concentration, up to 10 minutes", 550),
];

test("D&D Beyond-sheet: basis, slots, spells en resources", () => {
  const h = parseDdbFields(annots);
  assert.equal(h.name, "Testa Vonk");
  assert.equal(h.cls, "Wizard 5");
  assert.equal(h.ac, 13); assert.equal(h.max, 27); assert.equal(h.initBonus, 3); assert.equal(h.dex, 3);
  assert.deepEqual(h.casting.slots.map((s) => [s.lvl, s.max]), [[1, 4], [3, 2]]);
  assert.equal(h.levels.find((l) => l.lvl === 3).spells[0].dur, "Concentration, up to 10 minutes");
  assert.deepEqual(h.res.map((r) => [r.n, r.max]), [["Arcane Recovery", 1], ["Portent", 2]]);
  assert.equal(h.attacks[0].dmg, "1d4+3 Piercing");
});

test("geen D&D Beyond-velden → null", () => {
  assert.equal(parseDdbFields([f(1, "Foo", "bar")]), null);
});

test("foutteksten: staart per plek (formulier vs Party), onbekende code = private", () => {
  assert.match(ddbMsg("notfound"), /PDF-upload hieronder\.$/);
  assert.match(ddbMsg("notfound", true), /\+ Speler met de PDF-upload\.$/);
  assert.doesNotMatch(ddbMsg("upstream", true), /hieronder/);
  assert.equal(ddbMsg("offline", true), "Geen internet. Bijwerken werkt alleen online.");
  assert.equal(ddbMsg("offline"), "Geen internet. Ophalen werkt alleen online.");
  assert.equal(ddbMsg("raar", true), ddbMsg("private", true));
  assert.ok(!/PDF/.test(ddbMsg("bad")));
  assert.equal(ddbMsg("toString"), ddbMsg("private"), "geen sleutel uit het prototype");
});

test("foutteksten in het Engels (WP24)", async () => {
  await lang("en");
  try {
    assert.equal(ddbMsg("offline", true), "No internet. Updating only works online.");
    assert.match(ddbMsg("notfound"), /^Not found on D&D Beyond\..* Otherwise, use the PDF upload below\.$/);
  } finally { await lang("nl"); }
});

// Schade-spells met een save uit data/spells.json → js/rules/dmgtable.js (RE18).
// De app heeft de tabel direct nodig (AoE-paneel), terwijl de spelldata pas bij de eerste tik laadt.
// Draai opnieuw na het bijwerken van de spelldata of de parser; tests/dmgspells.test.js bewaakt dat het klopt.
// Gebruik (in de repo): node tools/dmg_spells.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { buildDmgTable } from "../js/rules/dmgspells.js";

const t = buildDmgTable(JSON.parse(readFileSync("data/spells.json", "utf8")).spells);
writeFileSync("js/rules/dmgtable.js", `// Gegenereerd door tools/dmg_spells.mjs uit de SRD 5.1-spelldata (CC-BY-4.0): niet met de hand aanpassen.
// Schade-spells met een save: { n, lv, ab, half, dice, type, up, cant, x, alt?, conc } (zie parseDmgSpell in dmgspells.js).
export const DMG_SPELLS = [
${t.map((s) => "  " + JSON.stringify(s)).join(",\n")},
];
`);
console.log(t.length, "spells");

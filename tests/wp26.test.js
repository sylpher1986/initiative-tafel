// WP26 (1.49.5): overige DM-schermen uit de catalogus; ratel ziet code en HTML-attributen niet meer als tekst
import { test } from "node:test";
import assert from "node:assert/strict";
import { isCode, dutchIn } from "../tools/i18n-audit.mjs";
import { initI18n } from "../js/i18n/boot.js";
import { parseImport } from "../js/backup.js";

test("ratel: selectors, ids, kebab-case en import-paden zijn code", () => {
  for (const s of ["#kamer-box", "kamer-lost", "it-kamer", "[data-qr=sluit]", '#kamer-box [data-kamer="qr"]', "./kamer.js", "../ui/kamer.js"]) assert.ok(isCode(s), s);
  for (const s of ["Kwetsb.", "verbinding kwijt", "Opnieuw delen", "weg", ". Ververs de pagina", ". Let op: ", "# Ronde 2", "[Geen tekst]"]) assert.ok(!isCode(s), s);
});

test("ratel: in een JS-string met HTML telt alleen tekst en zichtbare attributen, één telling per string", () => {
  assert.deepEqual(dutchIn("a.js", 'x = `<button class="en" data-kamer="qr">${t("k")}</button>`;'), []);
  assert.equal(dutchIn("a.js", 'x = `<b>{}</b> blijft staan <i>en</i> weg`;').length, 1);
  assert.equal(dutchIn("a.js", 'x = `<button aria-label="Sluit">x</button>`;').length, 1);
});

test("importfouten in de taal van de app", async () => {
  await initI18n({ doc: { documentElement: { lang: "nl" } }, search: "", storage: null });
  assert.throws(() => parseImport({ format: "iets" }), /Dit is geen export van/);
  assert.throws(() => parseImport({ format: "initiative-tafel", version: 99 }), /nieuwere versie/);
  await initI18n({ doc: { documentElement: { lang: "en" } }, search: "", storage: null });
  assert.throws(() => parseImport({ format: "iets" }), /This isn't a .* export/);
});

import { duplicate } from "../js/rules/encounters.js";
test("dupliceren: woord in de actieve taal, nummert door ook over een oud '(kopie)'", () => {
  const e = { id: "a", name: "Cave (kopie)", notes: "", monsters: [{ ref: "Goblin", n: 1 }], updatedAt: 1 };
  assert.equal(duplicate(e, [e], 2, "copy").name, "Cave (copy)");
  assert.equal(duplicate(e, [e, { ...e, name: "Cave (copy)" }], 2, "copy").name, "Cave (copy 2)");
});

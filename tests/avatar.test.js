import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { monType, raceKey, iconId, cleanImg, avatar, isBlank, RACE_OPTS } from "../js/ui/avatar.js";

test("creature type uit de meta-regel", () => {
  assert.equal(monType("Large aberration, lawful evil"), "aberration");
  assert.equal(monType("Medium humanoid (any race), any alignment"), "humanoid");
  assert.equal(monType("Medium swarm of Tiny beasts, unaligned"), "beast");
  assert.equal(monType("Huge dragon, chaotic evil"), "dragon");
  assert.equal(monType(""), "monstrosity");
  assert.equal(monType(undefined), "monstrosity");
  assert.equal(monType("Medium humanoid (elf), neutral"), "humanoid", "subtype verandert het type niet");
});

test("ras → icoon: subrassen, half-rassen, onbekend", () => {
  assert.equal(raceKey("Hill Dwarf"), "dwarf");
  assert.equal(raceKey("Half-Elf"), "halfelf");
  assert.equal(raceKey("Half Orc"), "halforc");
  assert.equal(raceKey("Wood Elf"), "elf");
  assert.equal(raceKey("Variant Human"), "human");
  assert.equal(raceKey("Lightfoot Halfling"), "halfling");
  assert.equal(raceKey("Aasimar"), "pc");
  assert.equal(raceKey(""), "pc");
  assert.equal(raceKey(null), "pc");
  for (const r of RACE_OPTS) assert.notEqual(raceKey(r), "pc", `${r} heeft een eigen icoon`);
});

test("icoon-id: eigen ras gaat voor ras uit de sheet; elk id bestaat in de sprite", () => {
  assert.equal(iconId({ kind: "pc", race: "Tiefling", sheet: { race: "Elf" } }), "r-tiefling");
  assert.equal(iconId({ kind: "pc", sheet: { race: "Mountain Dwarf" } }), "r-dwarf");
  assert.equal(iconId({ kind: "monster" }, "Tiny beast, unaligned"), "m-beast");
  const sprite = readFileSync(new URL("../icons/creatures.svg", import.meta.url), "utf8");
  const ids = ["r-pc", ...RACE_OPTS.map((r) => "r-" + raceKey(r)),
    ..."aberration beast celestial construct dragon elemental fey fiend giant humanoid monstrosity ooze plant undead".split(" ").map((t) => "m-" + t)];
  for (const id of ids) assert.ok(sprite.includes(`id="${id}"`), `${id} ontbreekt in icons/creatures.svg`);
});

test("portret: alleen kleine base64-afbeeldingen komen erdoor", () => {
  const ok = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
  assert.equal(cleanImg(ok), ok);
  assert.equal(cleanImg("https://example.com/x.png"), null);
  assert.equal(cleanImg("data:image/svg+xml;base64,PHN2Zz4="), null);
  assert.equal(cleanImg('data:image/png;base64,AAAA" onerror="alert(1)'), null);
  assert.equal(cleanImg("data:image/png;base64," + "A".repeat(70000)), null);
  assert.equal(cleanImg(42), null);
  assert.match(avatar({ kind: "pc", img: ok }), /<img src="data:image\/jpeg/);
  assert.match(avatar({ kind: "pc", img: "javascript:x" }), /#r-pc"/, "ongeldig portret valt terug op icoon");
});

test("leeg vak herkennen voor het portret", () => {
  const px = (f) => { const a = new Uint8ClampedArray(64 * 64 * 4); for (let i = 0; i < a.length; i += 4) { const v = f(i / 4); a[i] = a[i + 1] = a[i + 2] = v; a[i + 3] = 255; } return a; };
  assert.equal(isBlank(px(() => 255)), true, "wit");
  assert.equal(isBlank(px((i) => 250 + (i % 3))), true, "wit met ruis");
  assert.equal(isBlank(px((i) => (i % 64 < 32 ? 40 : 220))), false, "afbeelding");
  assert.equal(isBlank(new Uint8ClampedArray(0)), true);
});

test("ras bij toevoegen: formulierkeuze, sheetras en bewust 'Anders'", async () => {
  const { pickRace } = await import("../js/ui/avatar.js");
  assert.equal(pickRace("Dwarf", "Hill Dwarf"), "Hill Dwarf", "zelfde soort: sheettekst houden");
  assert.equal(pickRace("Tiefling", "Hill Dwarf"), "Tiefling", "DM kiest iets anders");
  assert.equal(pickRace("", "Hill Dwarf"), "", "bewust Anders bij herkend ras");
  assert.equal(pickRace("", "Aasimar"), "Aasimar", "onherkend sheetras blijft als tekst");
  assert.equal(pickRace("Elf", ""), "Elf");
  assert.equal(pickRace("", undefined), "");
  assert.equal(iconId({ kind: "pc", race: "", sheet: { race: "Hill Dwarf" } }), "r-pc", "lege race gaat voor sheetras");
});

test("import: ras en portret opgeschoond, portret alleen bij spelers en niet in de sheet", async () => {
  const { cleanCombatant } = await import("../js/backup.js");
  const ok = "data:image/jpeg;base64,/9j/4AAQ";
  const pc = cleanCombatant({ kind: "pc", name: "A", race: "Hill Dwarf", img: ok, sheet: { name: "A", race: "Hill Dwarf", img: ok } });
  assert.equal(pc.race, "Hill Dwarf"); assert.equal(pc.img, ok);
  assert.equal(pc.sheet.img, undefined, "geen tweede kopie in de sheet");
  assert.equal(cleanCombatant({ kind: "pc", name: "B", race: "", img: "https://x/y.png" }).img, undefined);
  assert.equal(cleanCombatant({ kind: "pc", name: "B", race: "" }).race, "", "bewust lege race blijft leeg");
  assert.equal(cleanCombatant({ kind: "pc", name: "C" }).race, undefined, "oude data zonder race");
  assert.equal(cleanCombatant({ kind: "monster", name: "D", img: ok }).img, undefined, "monsters geen portret");
  assert.equal(cleanCombatant({ kind: "pc", name: "E", race: { x: 1 } }).race, undefined);
});

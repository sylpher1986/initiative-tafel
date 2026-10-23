import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDdbJson, parseDdbLink, mergeSheet, findMember, partyUpdate } from "../js/ddbjson.js";
import { cleanCombatant, parseImport } from "../js/backup.js";

// Verzonnen characters in het formaat van character-service v5 (alleen de velden die de parser leest)
const stats = (...v) => v.map((value, i) => ({ id: i + 1, value }));
const nul = () => [1, 2, 3, 4, 5, 6].map((id) => ({ id, value: null }));
const mod = (type, subType, value = null, extra = {}) => ({ type, subType, value, statId: null, ...extra });
const FULL = [[], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1]];
const cls = (name, level, extra = {}) => ({ level, isStartingClass: true, definition: { name, hitDice: 8, ...extra.def }, subclassDefinition: extra.sub || null, classFeatures: extra.features || [] });
const item = (id, def, more = {}) => ({ id: id * 10, equipped: true, isAttuned: false, definition: { id, canAttune: false, ...def }, ...more });

const wizard = {
  id: 36954411, name: "Testa Vonk",
  stats: stats(8, 16, 14, 18, 12, 10), bonusStats: nul(), overrideStats: nul(),
  baseHitPoints: 22, bonusHitPoints: null, overrideHitPoints: null,
  race: { fullName: "High Elf", baseName: "Elf", weightSpeeds: { normal: { walk: 30 } }, racialTraits: [{ definition: { name: "Darkvision" } }] },
  classes: [cls("Wizard", 5, {
    def: { hitDice: 6, canCastSpells: true, spellCastingAbilityId: 4, spellRules: { multiClassSpellSlotDivisor: 1, levelSpellSlots: [[0], [2], [3], [4, 2], [4, 3], [4, 3, 2]] } },
    features: [{ definition: { name: "Arcane Recovery", requiredLevel: 1 } }, { definition: { name: "Spell Mastery", requiredLevel: 18 } }],
  })],
  modifiers: {
    race: [mod("bonus", "dexterity-score", 2), mod("bonus", "intelligence-score", 1), mod("set-base", "darkvision", 60), mod("proficiency", "perception")],
    class: [mod("proficiency", "intelligence-saving-throws"), mod("proficiency", "wisdom-saving-throws"), mod("proficiency", "arcana")],
    item: [mod("bonus", "armor-class", 1, { componentId: 501 }), mod("bonus", "saving-throws", 1, { componentId: 501 }), mod("bonus", "armor-class", 1, { componentId: 502 })],
    feat: [], background: [], condition: [mod("bonus", "armor-class", 5)],
  },
  inventory: [
    item(501, { name: "Ring of Protection", canAttune: true }, { isAttuned: true }),
    item(502, { name: "Cloak of Protection", canAttune: true }, { isAttuned: false }), // niet geattuned → telt niet
    item(503, { name: "Dagger", filterType: "Weapon", attackType: 1, categoryId: 1, type: "Dagger", damage: { diceString: "1d4" }, damageType: "Piercing", properties: [{ name: "Finesse" }, { name: "Thrown" }] }),
    item(504, { name: "Quarterstaff", filterType: "Weapon", attackType: 1, categoryId: 1, type: "Quarterstaff", damage: { diceString: "1d6" }, damageType: "Bludgeoning", properties: [] }, { equipped: false }),
  ],
  characterValues: [],
  decorations: { avatarUrl: "https://www.dndbeyond.com/avatars/1/2/a.jpeg" },
  classSpells: [{ spells: [
    { prepared: true, definition: { name: "Shield", level: 1, activation: { activationType: 4 }, range: { origin: "Self" }, duration: { durationType: "Time", durationInterval: 1, durationUnit: "Round" } } },
    { prepared: false, definition: { name: "Sleep", level: 1 } },
    { prepared: true, definition: { name: "Fly", level: 3, concentration: true, activation: { activationType: 1 }, range: { origin: "Touch" }, duration: { durationType: "Concentration", durationInterval: 10, durationUnit: "Minute" } } },
    { definition: { name: "Fire Bolt", level: 0, activation: { activationType: 1 }, range: { origin: "Ranged", rangeValue: 120 }, duration: { durationType: "Instantaneous" } } },
  ] }],
  spells: { race: [{ definition: { name: "Prestidigitation", level: 0 } }], item: null },
  actions: { class: [{ name: "Arcane Recovery", limitedUse: { maxUses: 1, resetType: 2 } }, { name: "Iets bij dageraad", limitedUse: { maxUses: 1, resetType: 3 } }], race: [], feat: [] },
  feats: [],
};

test("link, korte link of nummer → id; al het andere → null", () => {
  for (const s of ["https://www.dndbeyond.com/characters/36954411", "www.dndbeyond.com/characters/36954411/", "dndbeyond.com/characters/36954411?x=1",
    "https://www.dndbeyond.com/profile/Naam/characters/36954411", "https://ddb.ac/characters/36954411/AbCd", "  36954411 ", "https://www.dndbeyond.com/characters/36954411/builder#x"])
    assert.equal(parseDdbLink(s), "36954411", s);
  for (const s of ["", null, "abc", "0", "https://evil.com/characters/1", "https://www.dndbeyond.com.evil.com/characters/1", "https://www.dndbeyond.com/monsters/1",
    "https://www.dndbeyond.com/characters/12abc", "1234567890123", "javascript:alert(1)"])
    assert.equal(parseDdbLink(s), null, String(s));
});

test("wizard: scores, AC uit items (alleen geattuned), HP, saves, skills, init", () => {
  const r = parseDdbJson({ success: true, data: wizard }), h = r.sheet;
  assert.equal(r.id, "36954411"); assert.equal(r.hasAvatar, true);
  assert.equal(h.name, "Testa Vonk"); assert.equal(h.race, "High Elf"); assert.equal(h.cls, "Wizard 5");
  assert.deepEqual(h.ab, [8, 18, 14, 19, 12, 10]);
  assert.equal(h.ac, 15, "10 + Dex 4 + Ring 1; cloak niet geattuned, condities tellen niet");
  assert.deepEqual(r.check.ac, []);
  assert.equal(h.max, 32, "22 + Con 2 × 5");
  assert.deepEqual(r.check.hp, []);
  assert.equal(h.initBonus, 4); assert.equal(h.dex, 4); assert.equal(h.prof, "+3");
  assert.deepEqual(h.saves.find((s) => s[0] === "Int"), ["Int", "+8"], "4 + 3 + Ring 1");
  assert.deepEqual(h.saves.find((s) => s[0] === "Str"), ["Str", "+0"]);
  assert.deepEqual(h.skills.find((s) => s[0] === "Arcana"), ["Arcana", "+7"]);
  assert.equal(h.skills.length, 18);
  assert.match(h.senses, /darkvision 60 ft\., passive Perception 14/);
  assert.equal(h.speed, "30 ft.");
  assert.equal(h.spellDC, "15"); assert.equal(h.spellAtk, "+7"); assert.equal(h.spellAbility, "INT");
});

test("wizard: slots uit de klassetabel, alleen voorbereide spells, resources (short/long rest)", () => {
  const h = parseDdbJson(wizard).sheet;
  assert.deepEqual(h.casting.slots.map((s) => [s.lvl, s.max, s.left]), [[1, 4, 4], [2, 3, 3], [3, 2, 2]]);
  assert.equal(h.casting.slots[0].spells, "Shield", "Sleep is niet voorbereid");
  const l3 = h.levels.find((l) => l.lvl === 3).spells[0];
  assert.deepEqual([l3.n, l3.time, l3.range, l3.dur], ["Fly", "1A", "Touch", "Concentration, up to 10 minutes"]);
  assert.deepEqual(h.levels.find((l) => l.lvl === 0).spells.map((s) => s.n).sort(), ["Fire Bolt", "Prestidigitation"]);
  assert.equal(h.levels.find((l) => l.lvl === 0).spells.find((s) => s.n === "Fire Bolt").range, "120 ft.");
  assert.deepEqual(h.res, [{ n: "Arcane Recovery", max: 1, left: 1, rest: "Long Rest" }]);
  assert.match(h.features, /Class features: Arcane Recovery/);
  assert.doesNotMatch(h.features, /Spell Mastery/, "feature van een hoger level niet tonen");
  assert.deepEqual(h.attacks.map((a) => [a.n, a.hit, a.dmg]), [["Dagger", "+4", "1d4+4 Piercing"]], "finesse: Dex; geen proficiency in de data; staf niet gedragen");
});

test("barbarian: Unarmored Defense met schild, Hill Dwarf + Tough, Rage", () => {
  const d = {
    name: "Brom", stats: stats(16, 14, 16, 8, 12, 10),
    baseHitPoints: 12 + 4 * 7, race: { fullName: "Hill Dwarf", weightSpeeds: { normal: { walk: 25 } } },
    classes: [cls("Barbarian", 5, { def: { hitDice: 12 } })],
    modifiers: {
      race: [mod("bonus", "constitution-score", 2), mod("bonus", "hit-points-per-level", 1)],
      class: [mod("set", "unarmored-armor-class", null, { statId: 3 }), mod("proficiency", "martial-weapons"), mod("bonus", "unarmored-movement", 10), mod("proficiency", "strength-saving-throws")],
      feat: [mod("bonus", "hit-points-per-level", 2)],
    },
    inventory: [item(1, { name: "Shield", armorTypeId: 4, armorClass: 2 }), item(2, { name: "+1 Battleaxe", filterType: "Weapon", attackType: 1, categoryId: 2, type: "Battleaxe", damage: { diceString: "1d8" }, damageType: "Slashing", properties: [{ name: "Versatile" }], grantedModifiers: [{ type: "bonus", subType: "magic", value: 1 }] })],
    actions: { class: [{ name: "Rage", limitedUse: { maxUses: 3, resetType: 2 } }] },
    feats: [{ definition: { name: "Tough" } }],
  };
  const r = parseDdbJson(d), h = r.sheet;
  assert.equal(h.ac, 10 + 2 + 4 + 2, "10 + Dex + Con 18 + schild");
  assert.equal(h.max, 40 + 4 * 5 + 3 * 5, "basis + Con 4/level + Dwarf 1 + Tough 2 per level");
  assert.equal(h.speed, "25 ft.", "unarmored movement niet met schild");
  assert.deepEqual(h.attacks[0], { n: "+1 Battleaxe", hit: "+7", dmg: "1d8+4 Slashing", notes: "versatile" });
  assert.deepEqual(h.res.map((x) => [x.n, x.max]), [["Rage", 3]]);
  assert.equal(h.casting, null);
  assert.match(h.features, /Feats: Tough/);
});

test("monk met schild: geen Unarmored Defense; Bracers alleen zonder schild", () => {
  const base = { name: "M", stats: stats(10, 16, 10, 10, 16, 10), baseHitPoints: 8, classes: [cls("Monk", 2)],
    modifiers: { class: [mod("set", "unarmored-armor-class", null, { statId: 5 })], item: [mod("bonus", "unarmored-armor-class", 2, { componentId: 9 })] },
    inventory: [item(9, { name: "Bracers of Defense", canAttune: true }, { isAttuned: true })] };
  assert.equal(parseDdbJson(base).sheet.ac, 10 + 3 + 3 + 2);
  const sh = { ...base, inventory: [...base.inventory, item(1, { name: "Shield", armorTypeId: 4, armorClass: 2 })] };
  assert.equal(parseDdbJson(sh).sheet.ac, 10 + 3 + 2);
  assert.deepEqual(parseDdbJson(base).sheet.res.map((x) => [x.n, x.max, x.rest]), [["Ki Points", 2, "Short Rest"]]);
});

test("harnas: light + Dex, medium max +2 (Medium Armor Master +3), heavy vast, Defense", () => {
  const w = (armorTypeId, armorClass, extra = {}) => parseDdbJson({ name: "F", stats: stats(15, 18, 14, 10, 10, 10), baseHitPoints: 10, classes: [cls("Fighter", 1)],
    inventory: [item(1, { name: "Armor", armorTypeId, armorClass })], ...extra }).sheet.ac;
  assert.equal(w(1, 12), 16);
  assert.equal(w(2, 14), 16);
  assert.equal(w(2, 14, { feats: [{ definition: { name: "Medium Armor Master" } }] }), 17);
  assert.equal(w(3, 18), 18);
  assert.equal(w(3, 18, { modifiers: { class: [mod("bonus", "armored-armor-class", 1)] } }), 19, "Fighting Style: Defense");
  const two = parseDdbJson({ name: "F", stats: stats(10, 10, 10, 10, 10, 10), classes: [cls("Fighter", 1)], baseHitPoints: 10, inventory: [item(1, { armorTypeId: 1, armorClass: 11 }), item(2, { armorTypeId: 3, armorClass: 16 })] });
  assert.equal(two.sheet.ac, 16); assert.deepEqual(two.check.ac, ["meerdere harnassen tegelijk gedragen"]);
});

test("onzekere AC/HP krijgen een reden; handmatige AC uit D&D Beyond telt mee", () => {
  const base = { name: "X", stats: stats(10, 14, 12, 10, 10, 10), classes: [cls("Fighter", 3)] };
  const noHp = parseDdbJson(base);
  assert.equal(noHp.sheet.max, 8 + 2 * 5 + 3, "gemiddelde per level als basis ontbreekt");
  assert.equal(noHp.check.hp.length, 1);
  const fixed = parseDdbJson({ ...base, baseHitPoints: 20, characterValues: [{ typeId: 1, value: 17, valueId: null }] });
  assert.equal(fixed.sheet.ac, 17); assert.equal(fixed.check.ac.length, 1);
  const plus = parseDdbJson({ ...base, baseHitPoints: 20, characterValues: [{ typeId: 3, value: 2, valueId: null }] });
  assert.equal(plus.sheet.ac, 14); assert.equal(plus.check.ac.length, 1);
  const nat = parseDdbJson({ ...base, baseHitPoints: 20, modifiers: { race: [mod("set", "armor-class", 13)] } });
  assert.equal(nat.check.ac.length, 1);
  const ov = parseDdbJson({ ...base, baseHitPoints: 20, overrideHitPoints: 99, overrideStats: [{ id: 2, value: 20 }] });
  assert.equal(ov.sheet.max, 99); assert.equal(ov.sheet.dex, 5);
});

test("multiclass: slots via caster level (PHB), pools, warlock pact", () => {
  const ps = { name: "P", stats: stats(14, 10, 14, 10, 10, 16), baseHitPoints: 30,
    classes: [cls("Paladin", 2, { def: { hitDice: 10, canCastSpells: true, spellCastingAbilityId: 6, spellRules: { multiClassSpellSlotDivisor: 2, levelSpellSlots: [] } } }),
      { ...cls("Sorcerer", 3, { def: { hitDice: 6, canCastSpells: true, spellCastingAbilityId: 6, spellRules: { multiClassSpellSlotDivisor: 1, levelSpellSlots: FULL } } }), isStartingClass: false }],
    modifiers: { class: [mod("bonus", "hit-points-per-level", 1)] } };
  const r = parseDdbJson(ps);
  assert.equal(r.sheet.cls, "Paladin 2 / Sorcerer 3");
  assert.deepEqual(r.sheet.casting.slots.map((s) => [s.lvl, s.max]), [[1, 4], [2, 3]], "caster level 1 + 3 = 4");
  assert.deepEqual(r.sheet.res.map((x) => [x.n, x.max]), [["Sorcery Points", 3], ["Lay on Hands", 10]]);
  assert.equal(r.check.hp.length, 1, "HP per level uit een klasse bij multiclass");
  assert.equal(r.sheet.prof, "+3");

  const wl = parseDdbJson({ name: "W", stats: stats(10, 10, 10, 10, 10, 16), baseHitPoints: 20, classes: [cls("Warlock", 5, { def: { canCastSpells: true, spellCastingAbilityId: 6, spellRules: { multiClassSpellSlotDivisor: 1, levelSpellSlots: FULL } } })] });
  assert.deepEqual(wl.sheet.casting.slots, [], "RE3: pact magic niet bij de gewone slots");
  assert.deepEqual([wl.sheet.casting.pact.lvl, wl.sheet.casting.pact.max, wl.sheet.casting.pact.left], [3, 2, 2], "pact magic: 2 slots van 3e level");
  assert.match(wl.sheet.features, /Pact Magic/);

  const ek = parseDdbJson({ name: "E", stats: stats(10, 10, 10, 14, 10, 10), baseHitPoints: 20, classes: [cls("Fighter", 7, { sub: { name: "Eldritch Knight", canCastSpells: true, spellCastingAbilityId: 4, spellRules: { multiClassSpellSlotDivisor: 3, levelSpellSlots: [] } } })] });
  assert.deepEqual(ek.sheet.casting.slots.map((s) => [s.lvl, s.max]), [[1, 4], [2, 2]], "third caster 7 → caster level 3");
  assert.equal(ek.sheet.spellAbility, "INT");
  assert.equal(parseDdbJson({ name: "Pal1", baseHitPoints: 10, classes: [cls("Paladin", 1, { def: { canCastSpells: true, spellRules: { multiClassSpellSlotDivisor: 2 } } })] }).sheet.casting, null);
});

test("rare of lege data: geen crash, null als het geen character is", () => {
  for (const x of [null, undefined, 42, "x", [], {}, { data: null }, { data: { name: "" } }, { success: false }]) assert.equal(parseDdbJson(x), null);
  const junk = { name: "J", stats: "x", classes: [null, 1, { level: "a" }, { level: 2, definition: null }], modifiers: { race: "x", class: [null, 5, { type: 3 }] },
    inventory: [null, { equipped: true, definition: { armorTypeId: "1", armorClass: "x", damage: 4 } }], actions: { class: [{ name: 1, limitedUse: { resetType: 2, maxUses: "a" } }] },
    classSpells: [null, { spells: [null, { definition: { name: "<img src=x>", level: 99 } }] }], race: [], decorations: { avatarUrl: 5 } };
  const r = parseDdbJson(junk);
  assert.equal(r.sheet.name, "J"); assert.equal(r.sheet.cls, ""); assert.equal(r.hasAvatar, false); assert.equal(r.id, null);
  assert.ok(Number.isFinite(r.sheet.ac) && Number.isFinite(r.sheet.max));
  assert.equal(r.sheet.levels.find((l) => l.lvl === 9).spells[0].n, "<img src=x>", "tekst blijft tekst; escapen gebeurt bij de weergave");
  assert.ok(parseDdbJson({ name: "Groot", stats: stats(99, 99, 99, 99, 99, 99), baseHitPoints: 1e9, classes: [cls("Wizard", 99)] }).sheet.max <= 9999);
});

test("bijwerken: verbruik blijft, nieuwe maxima, wijzigingen terug", () => {
  const t = { name: "Testa", ac: 13, max: 27, hp: 20, temp: 3, cond: ["Poisoned"], sheet: { cls: "Wizard 5" },
    casting: { slots: [{ lvl: 1, max: 4, left: 1 }, { lvl: 3, max: 2, left: 2 }], daily: [] }, res: [{ n: "Arcane Recovery", max: 1, left: 0, rest: "Long Rest" }] };
  const f = { name: "Testa Vonk", ac: 14, max: 33, dex: 4, initBonus: 4, ddbId: "5", img: "data:image/jpeg;base64,AA==", sheet: { cls: "Wizard 6" },
    casting: { slots: [{ lvl: 1, max: 4, left: 4 }, { lvl: 2, max: 3, left: 3 }, { lvl: 3, max: 3, left: 3 }], daily: [] }, res: [{ n: "arcane recovery", max: 1, left: 1, rest: "Long Rest" }] };
  const ch = mergeSheet(t, f);
  assert.deepEqual(ch, ["naam Testa → Testa Vonk", "Wizard 5 → Wizard 6", "AC 13 → 14", "max HP 27 → 33", "spell slots"]);
  assert.equal(t.hp, 26, "7 schade blijft"); assert.equal(t.temp, 3); assert.deepEqual(t.cond, ["Poisoned"]);
  assert.deepEqual(t.casting.slots.map((s) => [s.lvl, s.max, s.left]), [[1, 4, 1], [2, 3, 3], [3, 3, 3]]);
  assert.equal(t.res[0].left, 0); assert.equal(t.ddbId, "5"); assert.equal(t.name, "Testa Vonk");
  // lager max: HP zakt mee, levend blijft minstens 1; neergegaan blijft 0
  const low = { max: 30, hp: 5 }; mergeSheet(low, { max: 10 }); assert.equal(low.hp, 1);
  const down = { max: 30, hp: 0 }; mergeSheet(down, { max: 40 }); assert.equal(down.hp, 0);
  const fresh = { name: "N" }; mergeSheet(fresh, { max: 12 }); assert.equal(fresh.hp, 12);
  // niets veranderd → geen wijzigingen
  assert.deepEqual(mergeSheet({ ac: 14, max: 33, hp: 33, sheet: { cls: "Wizard 6" } }, { ac: 14, max: 33, sheet: { cls: "Wizard 6" } }), []);
});

test("party-lid vinden: eerst D&D Beyond-id, dan unieke naam, nooit een ander gekoppeld character", () => {
  const P = [{ pid: "a", name: "Thalia", ddbId: "1" }, { pid: "b", name: "Brom" }, { pid: "c", name: "Mira" }, { pid: "d", name: "mira" }, null];
  assert.equal(findMember(P, "1", "Andere naam").pid, "a", "id gaat voor (naam veranderd in D&D Beyond)");
  assert.equal(findMember(P, "9", "brom ").pid, "b", "naam, hoofdletterongevoelig; krijgt bij bijwerken het id");
  assert.equal(findMember(P, "9", "Thalia"), null, "zelfde naam maar ander D&D Beyond-character");
  assert.equal(findMember(P, "9", "Mira"), null, "naam twee keer: geen gok");
  assert.equal(findMember(P, null, ""), null);
  assert.equal(findMember(null, "1", "x"), null);
});

test("ddbId blijft bewaard bij export/import, rommel valt weg", () => {
  assert.equal(cleanCombatant({ kind: "pc", name: "T", ddbId: "36954411" }).ddbId, "36954411");
  assert.equal(cleanCombatant({ kind: "pc", name: "T", ddbId: 36954411 }).ddbId, "36954411");
  for (const bad of ["../x", "1;drop", "", null, {}, "0"]) assert.equal(cleanCombatant({ kind: "pc", name: "T", ddbId: bad }).ddbId, undefined, String(bad));
  const imp = parseImport({ format: "initiative-tafel", version: 1, party: [{ pid: "p1", name: "T", ddbId: "5" }] });
  assert.equal(imp.party[0].ddbId, "5");
});

test("review: Remarkable Athlete, Tortle zonder Dex, Mage Armor-hint, spell DC-bonus van item", () => {
  const b = { name: "R", stats: stats(10, 14, 10, 10, 10, 16), baseHitPoints: 10, classes: [cls("Fighter", 5)] };
  const ra = parseDdbJson({ ...b, modifiers: { class: [mod("half-proficiency-round-up", "initiative"), mod("half-proficiency-round-up", "strength-ability-checks")] } }).sheet;
  assert.equal(ra.initBonus, 2 + 2, "prof 3 → helft naar boven = 2");
  assert.equal(ra.skills.find((s) => s[0] === "Athletics")[1], "+2");
  assert.equal(ra.skills.find((s) => s[0] === "Arcana")[1], "+0");
  const luck = parseDdbJson({ ...b, modifiers: { item: [mod("bonus", "ability-checks", 1, { componentId: 7 })] }, inventory: [item(7, { name: "Stone", canAttune: true }, { isAttuned: true })] }).sheet;
  assert.equal(luck.initBonus, 3);
  const tortle = parseDdbJson({ ...b, modifiers: { race: [mod("set", "unarmored-armor-class", 17), mod("ignore", "unarmored-dex-ac-bonus")] } });
  assert.equal(tortle.sheet.ac, 17); assert.ok(tortle.check.ac.length >= 1);
  const ma = parseDdbJson({ ...b, classSpells: [{ spells: [{ prepared: true, definition: { name: "Mage Armor", level: 1 } }] }] });
  assert.equal(ma.sheet.ac, 12); assert.ok(ma.check.ac.some((r) => /Mage Armor/.test(r)));
  const wl = parseDdbJson({ ...b, classes: [cls("Warlock", 5, { def: { spellCastingAbilityId: 6 } })], modifiers: { item: [mod("bonus", "spell-save-dc", 1, { componentId: 8 }), mod("bonus", "spell-attacks", 1, { componentId: 8 })] }, inventory: [item(8, { name: "Rod", canAttune: true }, { isAttuned: true })] }).sheet;
  assert.equal(wl.spellDC, String(8 + 3 + 3 + 1)); assert.equal(wl.spellAtk, "+7");
});

test("SP1 bijwerken vanuit de Party: alleen de sheet, onzekere AC/HP niet over een bestaande waarde", () => {
  const sheet = { name: "Ayla", cls: "Cleric 5", ac: 18, max: 40, dex: 1, initBonus: 1, race: "Hill Dwarf", casting: null, res: [] };
  const m = { pid: "p1", name: "Ayla", race: "Dwarf", ac: 16, max: 33, hp: 20, ddbId: "7", sheet: { cls: "Cleric 4" } };
  // zeker: alles over, ras blijft, id blijft
  let r = partyUpdate(m, { sheet, id: "7", img: null, check: { ac: [], hp: [] } });
  assert.deepEqual([r.f.ac, r.f.max, r.f.ddbId, "race" in r.f, r.kept], [18, 40, "7", false, []]);
  assert.deepEqual(mergeSheet(structuredClone(m), r.f), ["Cleric 4 → Cleric 5", "AC 16 → 18", "max HP 33 → 40"]);
  // onzeker: oude waarde blijft, met uitleg
  r = partyUpdate(m, { sheet, id: "7", check: { ac: ["Unarmored Defense"], hp: ["Tough"] } });
  assert.deepEqual([r.f.ac, r.f.max], [0, 0]);
  assert.deepEqual(r.kept, ["AC onzeker (sheet: 18), blijft 16", "max HP onzeker (sheet: 40), blijft 33"]);
  const t = structuredClone(m); assert.deepEqual(mergeSheet(t, r.f), ["Cleric 4 → Cleric 5"]);
  assert.deepEqual([t.ac, t.max, t.hp], [16, 33, 20], "AC, max en schade ongewijzigd");
  // onzeker maar gelijk: geen uitleg; lid zonder waarde: toch overnemen
  assert.deepEqual(partyUpdate({ ...m, ac: 18 }, { sheet, check: { ac: ["x"] } }).kept, []);
  r = partyUpdate({ pid: "p2", name: "Ayla", ddbId: "7" }, { sheet, check: { ac: ["x"], hp: ["y"] } });
  assert.deepEqual([r.f.ac, r.f.max, r.f.ddbId, r.kept], [18, 40, "7", []]);
  // zonder check of met 0 uit de sheet: niets onzeker, 0 wordt niet overgenomen
  assert.deepEqual(partyUpdate(m, { sheet }).kept, []);
  r = partyUpdate(m, { sheet: { ...sheet, ac: 0, max: 0 }, check: { ac: ["x"], hp: ["y"] } });
  assert.deepEqual([r.f.ac, r.f.max, r.kept], [0, 0, []]);
  // max HP met effect (Aid): vergelijking met de basis
  assert.deepEqual(partyUpdate({ ...m, max: 38, eff: [{ id: "e", n: "Aid", hpd: 5 }] }, { sheet: { ...sheet, max: 33 }, check: { hp: ["x"] } }).kept, []);
});

test("bijwerken: naamswijziging staat in de wijzigingen", () => {
  assert.deepEqual(mergeSheet({ name: "Ayla" }, { name: "Ayla Steen" }), ["naam Ayla → Ayla Steen"]);
  assert.deepEqual(mergeSheet({ name: "Ayla" }, { name: "Ayla" }), []);
});

test("SP3: spells van een item alleen als het item gedragen (en geattuned) is; onbekend item wel tonen", () => {
  const d = structuredClone(wizard);
  d.spells.item = [
    { componentId: 501, definition: { name: "Light", level: 0 } }, // Ring of Protection: geattuned
    { componentId: 502, definition: { name: "Message", level: 0 } }, // Cloak: niet geattuned
    { componentId: 5040, definition: { name: "Mending", level: 0 } }, // Quarterstaff (inventory-id): niet gedragen
    { componentId: 999, definition: { name: "Thaumaturgy", level: 0 } }, // item niet te koppelen: tonen
  ];
  const h = parseDdbJson(d).sheet;
  assert.deepEqual(h.levels.find((l) => l.lvl === 0).spells.map((s) => s.n).sort(), ["Fire Bolt", "Light", "Prestidigitation", "Thaumaturgy"]);
});

test("SP3: PDF-bijwerken (geen ddbId) houdt de D&D Beyond-koppeling van het lid", () => {
  const m = { pid: "p1", name: "Ayla", ddbId: "123", ac: 15, max: 30, hp: 20 };
  mergeSheet(m, { name: "Ayla", ac: 16, max: 30, ddbId: undefined });
  assert.equal(m.ddbId, "123");
  assert.equal(m.ac, 16);
});

test("SP3: seatPlan — nooit een tweede deelnemer voor hetzelfde partylid", async () => {
  const { seatPlan } = await import("../js/ddbjson.js");
  assert.equal(seatPlan(false, false, true), "add");
  assert.equal(seatPlan(true, false, false), "seat");
  assert.equal(seatPlan(true, false, true), "updSeat");
  assert.equal(seatPlan(true, true, true), "upd");
  assert.equal(seatPlan(true, true, false), "none");
});

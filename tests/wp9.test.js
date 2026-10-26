// WP9: schade-spells (RE18), slots verbruiken (RE1/RE2), Pact Magic apart (RE3)
import { nlw } from "./_nl.js"; // WP27: Nederlandse catalogus; nlw = oorzaken als tekst
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDmgTable, parseDmgSpell, spellDice, addDice, cantripMul, normDice, rollDice, diceText, findDmgSpells, casterLevel } from "../js/rules/dmgspells.js";
import { DMG_SPELLS } from "../js/rules/dmgtable.js";
import { slotChoices, defaultSlot, slotLevel, spendSlot, autoSpend, pactSlots, pactRest, dailyFor, slotName } from "../js/rules/slots.js";
import { mergeSheet } from "../js/ddbjson.js";
import { parseImport } from "../js/backup.js";
import { restMember } from "../js/rules/combat.js";
import { cleanCombatant } from "../js/backup.js";

const SRD = JSON.parse(readFileSync(new URL("../data/spells.json", import.meta.url))).spells;
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test("RE18: tabel is gelijk aan de parser over de SRD-data (opnieuw maken: node tools/dmg_spells.mjs)", () => {
  assert.deepEqual(DMG_SPELLS, buildDmgTable(SRD));
  assert.ok(DMG_SPELLS.length >= 35, "± 40 schade-spells");
});

test("RE18: Fireball, Flame Strike, Spirit Guardians, cantrips, Disintegrate", () => {
  const f = (n) => DMG_SPELLS.find((s) => s.n === n);
  assert.deepEqual(f("Fireball"), { n: "Fireball", lv: 3, ab: "DEX", half: true, dice: "8d6", type: "fire", up: "1d6", cant: false, x: [], conc: false });
  assert.deepEqual(f("Flame Strike").x, [{ dice: "4d6", type: "radiant" }], "tweede type apart");
  assert.equal(f("Spirit Guardians").alt, "necrotic", "of-type is geen extra deel");
  assert.deepEqual(f("Spirit Guardians").x, []);
  assert.equal(f("Sacred Flame").cant, true);
  assert.equal(f("Sacred Flame").half, false);
  assert.equal(f("Disintegrate").dice, "10d6+40");
  assert.equal(f("Moonbeam").up, "1d10", "'1dl0' in de bron");
  assert.equal(f("Shatter").up, "1d8");
  assert.equal(f("Chain Lightning").up, null, "upcast = extra doelen, geen schade");
  for (const n of ["Web", "Heat Metal", "Geas", "Hold Person", "Fire Bolt", "Magic Missile"]) assert.equal(f(n), undefined, n);
  assert.equal(parseDmgSpell(null), null);
});

test("RE18: dobbelstenen per slot en characterlevel", () => {
  const fb = DMG_SPELLS.find((s) => s.n === "Fireball"), sf = DMG_SPELLS.find((s) => s.n === "Sacred Flame"), di = DMG_SPELLS.find((s) => s.n === "Disintegrate");
  assert.equal(spellDice(fb, 3), "8d6");
  assert.equal(spellDice(fb, 5), "10d6");
  assert.equal(spellDice(fb, 1), "8d6", "lager slot kan niet: basis");
  assert.equal(spellDice(di, 7), "13d6+40");
  assert.equal(spellDice(sf, 0, 4), "1d8");
  assert.equal(spellDice(sf, 0, 5), "2d8");
  assert.equal(spellDice(sf, 0, 17), "4d8");
  assert.equal(spellDice(sf, 0, 0), "1d8", "level onbekend: basis");
  assert.deepEqual([cantripMul(1), cantripMul(10), cantripMul(11), cantripMul(20)], [1, 2, 3, 4]);
  assert.equal(addDice("8d6", "1d8", 2), "8d6+2d8");
});

test("RE18: los dobbelsteenveld XdY+Z", () => {
  assert.equal(normDice("8d6"), "8d6");
  assert.equal(normDice(" 2D6 + 3 "), "2d6+3");
  assert.equal(normDice("3d10−2"), "3d10-2");
  assert.equal(normDice("d8"), "1d8");
  assert.equal(normDice("12"), "12");
  for (const v of ["", "abc", "0d6", "2d1", "100d6", "2d6+"]) assert.equal(normDice(v), null, v);
  const r = rollDice("3d6+2", seq(0, 0.5, 0.99));
  assert.deepEqual([r.rolls, r.tot], [[1, 4, 6], 13]);
  assert.equal(diceText(r), "3d6+2 = 13 (1 4 6 +2)");
  assert.equal(rollDice("1d4-5", seq(0)).tot, 0, "nooit negatief");
  assert.equal(diceText(rollDice("7")), "7");
});

test("RE18: zoeken en casterlevel", () => {
  assert.deepEqual(findDmgSpells(DMG_SPELLS, "fi").map((s) => s.n).slice(0, 3), ["Finger of Death", "Fire Storm", "Fireball"]);
  assert.ok(findDmgSpells(DMG_SPELLS, "storm").some((s) => s.n === "Ice Storm"), "woordbegin");
  assert.ok(findDmgSpells(DMG_SPELLS, "ball").some((s) => s.n === "Fireball"), "deel van de naam");
  assert.deepEqual(findDmgSpells(DMG_SPELLS, ""), []);
  assert.equal(findDmgSpells(DMG_SPELLS, "e", 6).length, 6);
  assert.equal(casterLevel({ kind: "pc", sheet: { cls: "Cleric 3 / Wizard 2" } }), 5);
  assert.equal(casterLevel({ kind: "pc", lvl: 7 }), 7);
  assert.equal(casterLevel({ kind: "monster" }, { t: [["Spellcasting", "The mage is a 9th-level spellcaster."]] }), 9);
  assert.equal(casterLevel({ kind: "monster" }, null), 0);
});

const wiz = () => ({ id: "w", name: "Noor", kind: "pc", casting: { slots: [1, 2, 3, 4, 5].map((l) => ({ lvl: l, max: 2, left: 2, spells: "" })), daily: [] } });

test("RE1/RE2: keuzes en standaardslot", () => {
  const c = wiz();
  assert.deepEqual(slotChoices(c, 3).map((o) => o.k), ["s3", "s4", "s5"]);
  assert.deepEqual(slotChoices(c, 1).map((o) => o.k), ["s1", "s2", "s3", "s4"], "max 4 levels");
  assert.deepEqual(slotChoices(c, 0), [], "cantrip");
  assert.deepEqual(slotChoices({ kind: "pc" }, 3), [], "geen slots");
  assert.equal(defaultSlot(c, 3), "s3");
  c.casting.slots[2].left = 0;
  assert.equal(defaultSlot(c, 3), "s4", "3rd op → 4th");
  assert.equal(defaultSlot(c, 2, "", 4), "s4", "RE8: meer doelen vraagt een hoger slot");
  c.casting.slots.forEach((s) => (s.left = 0));
  assert.equal(defaultSlot(c, 3), "s3", "alles op: laagste passende slot (UI zegt 'geen … meer over'), niet stil Zelf");
  assert.equal(defaultSlot(c, 2, "", 7), "s5", "meer doelen dan het hoogste slot: hoogste");
  c.casting.slots.forEach((s) => (s.left = 2));
  c.slotSelf = true;
  assert.equal(defaultSlot(c, 3), "self", "onthouden: zelf bijhouden");
  assert.equal(slotLevel(c, "s5", 3), 5);
  assert.equal(slotLevel(c, "self", 3), 3);
  assert.equal(defaultSlot({ kind: "pc" }, 3), "");
});

test("RE1: afschrijven, zelf bijhouden onthouden, niets over = niet blokkeren", () => {
  const c = wiz();
  let r = spendSlot(c, "s3", "Fireball", 3);
  assert.equal(c.casting.slots[2].left, 1);
  assert.equal(r.txt, "3rd-level slot (1 over)");
  assert.deepEqual(r.why, [], "afschrijven staat al in het logboek via de toestandsvergelijking");
  spendSlot(c, "s3", "Fireball", 3); r = spendSlot(c, "s3", "Fireball", 3);
  assert.equal(c.casting.slots[2].left, 0);
  assert.equal(r.txt, "geen 3rd-level slot meer over");
  assert.equal(nlw(r.why)[0].id, "w", "niets afgeschreven: oorzaak bij de caster");
  assert.equal(c.slotSelf, undefined, "slot op maakt de caster niet stil 'Zelf' (review)");
  spendSlot(c, "self", "Fireball", 3);
  assert.equal(c.slotSelf, undefined, "standaard Zelf zonder tik: niet onthouden");
  r = spendSlot(c, "self", "Fireball", 3, true);
  assert.equal(c.slotSelf, true);
  assert.equal(r.txt, "");
  spendSlot(c, "run", "Fireball", 3, true);
  assert.equal(c.slotSelf, true, "loopt al: niets veranderd");
  spendSlot(c, "s4", "Fireball", 3, true);
  assert.equal(c.slotSelf, undefined, "level getikt = weer bijhouden");
  const none = { id: "x", kind: "pc" };
  spendSlot(none, "self", "Fireball", 3, true);
  assert.equal(none.slotSelf, undefined, "niets te kiezen: niets onthouden");
  const sh = wiz(); r = autoSpend(sh, "Shield", 1);
  assert.equal(sh.casting.slots[0].left, 1);
  assert.match(r.txt, /1st-level slot \(1 over\)/);
});

test("RE3: Pact Magic per warlock-level, keuze, rust", () => {
  assert.deepEqual(pactSlots(1), { lvl: 1, max: 1 });
  assert.deepEqual(pactSlots(5), { lvl: 3, max: 2 });
  assert.deepEqual(pactSlots(11), { lvl: 5, max: 3 });
  assert.deepEqual(pactSlots(20), { lvl: 5, max: 4 });
  assert.equal(pactSlots(0), null);
  const c = { id: "a", kind: "pc", casting: { slots: [{ lvl: 1, max: 4, left: 4 }, { lvl: 2, max: 3, left: 3 }], daily: [], pact: { lvl: 3, max: 2, left: 2, spells: "Hex" } } };
  assert.deepEqual(slotChoices(c, 1).map((o) => o.k), ["s1", "s2", "p"]);
  assert.equal(defaultSlot(c, 1), "p", "Pact eerst: komt terug na een short rest");
  assert.equal(defaultSlot(c, 4), "", "pact 3rd past niet voor een 4th-level spell");
  assert.equal(slotLevel(c, "p", 1), 3, "pact = altijd zijn eigen level (upcast)");
  assert.equal(slotName(c, "p"), "3rd-level Pact-slot");
  spendSlot(c, "p", "Hex", 1);
  assert.equal(c.casting.pact.left, 1);
  assert.ok(pactRest(c)); assert.equal(c.casting.pact.left, 2);
  assert.equal(pactRest(c), false);
  c.casting.pact.left = 0; c.casting.slots[0].left = 0;
  restMember(c, false);
  assert.equal(c.casting.pact.left, 2, "short rest: pact terug");
  assert.equal(c.casting.slots[0].left, 0, "short rest: gewone slots niet");
  const cl = cleanCombatant({ ...c, casting: { ...c.casting, pact: { lvl: 9, max: 9, left: -3, spells: 4 } }, slotSelf: "ja" });
  assert.deepEqual(cl.casting.pact, { lvl: 5, max: 4, left: 0, spells: "4" });
  assert.equal(cl.slotSelf, undefined);
  assert.equal(cleanCombatant({ ...c, slotSelf: true }).slotSelf, true);
});

test("RE1: x/day van een monster", () => {
  const m = { id: "m", kind: "monster", casting: { slots: [], daily: [{ label: "1/day each", items: [{ n: "cone of cold", max: 1, left: 1 }, { n: "fireball", max: 1, left: 1 }] }] } };
  assert.deepEqual(dailyFor(m, "Fireball").label, "1/day");
  assert.deepEqual(slotChoices(m, 3, "Fireball").map((o) => [o.k, o.l, o.left]), [["d0.1", "1/day", 1]]);
  assert.equal(defaultSlot(m, 3, "Fireball"), "d0.1");
  spendSlot(m, "d0.1", "Fireball", 3);
  assert.equal(m.casting.daily[0].items[1].left, 0);
  assert.equal(defaultSlot(m, 3, "Fireball"), "d0.1", "op: blijft de regel, er wordt niets afgeschreven");
  assert.equal(spendSlot(m, "d0.1", "Fireball", 3).txt, "geen 1/day meer over");
  assert.deepEqual(slotChoices(m, 3, "Lightning Bolt"), [], "niet in de x/day-lijst, geen slots");
});

test("RE3: opnieuw ophalen houdt Pact-verbruik; oude sheet met Pact bij de gewone slots; import zonder pact", () => {
  const t = { id: "a", kind: "pc", name: "W", casting: { slots: [{ lvl: 3, max: 2, left: 0, spells: "" }], daily: [] } }; // oud: pact opgeteld
  const f = { name: "W", sheet: { name: "W" }, casting: { slots: [], daily: [], pact: { lvl: 3, max: 2, left: 2, spells: "Hex" } } };
  mergeSheet(t, f);
  assert.deepEqual(t.casting.slots, []);
  assert.deepEqual([t.casting.pact.max, t.casting.pact.left], [2, 2], "geen oude pact: vol");
  t.casting.pact.left = 1;
  mergeSheet(t, { ...f, casting: { slots: [], daily: [], pact: { lvl: 3, max: 2, left: 2, spells: "Hex" } } });
  assert.equal(t.casting.pact.left, 1, "verbruik blijft");
  mergeSheet(t, { ...f, casting: { slots: [], daily: [], pact: { lvl: 4, max: 3, left: 3, spells: "Hex" } } });
  assert.deepEqual([t.casting.pact.lvl, t.casting.pact.left], [4, 2], "level-up: één verbruikt blijft verbruikt");
  const r = parseImport({ format: "initiative-tafel", version: 2, state: { list: [{ id: "x", kind: "pc", name: "Oud", casting: { slots: [{ lvl: 1, max: 2, left: 1 }], daily: [] } }] } });
  assert.equal(r.S.list[0].casting.pact, undefined);
  assert.equal(r.S.list[0].slotSelf, undefined);
});

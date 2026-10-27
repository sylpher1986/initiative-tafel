// WP41 (RE5, RE6a, TA20): Verrast zonder spelers, spell-uitleg vanuit AoE/Effect, drie teksten uit de WP40-vertaalcheck.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initI18n, t } from "../js/i18n/boot.js";
import { startCombat, setSurprise, initPcs, isSurprised } from "../js/rules/turns.js";
import { PRESETS } from "../js/rules/effects.js";
import { SPELLS } from "../js/rules/spellcast.js";
import { DMG_SPELLS } from "../js/rules/dmgtable.js";
import { setSpells, findSpell } from "../js/data/spells.js";

const lang = (l) => initI18n({ doc: { documentElement: { lang: l } }, search: "", storage: null });
const M = (id, init, o = {}) => ({ id, name: id, kind: "monster", init, dex: 0, ac: 12, hp: 7, max: 7, cond: [], ...o });
const P = (id, init) => ({ id, name: id, kind: "pc", init, dex: 0, ac: 15, hp: 20, max: 20, cond: [] });
const rng = () => 0.5;

test("RE5: Verrast zonder spelers geeft hetzelfde resultaat als met spelers (setSurprise vóór startCombat)", () => {
  const solo = { list: [M("g1", 15), M("g2", 10), M("dead", 8, { hp: 0 })], round: 0, active: null, log: [] };
  assert.equal(initPcs(solo.list).length, 0, "geen spelers: Start opent geen paneel");
  setSurprise(solo.list, "mon"); startCombat(solo, rng);
  const pcs = { list: [P("p", 20), M("g1", 15), M("g2", 10), M("dead", 8, { hp: 0 })], round: 0, active: null, log: [] };
  setSurprise(pcs.list, "mon"); startCombat(pcs, rng);
  assert.equal(pcs.round, 1); assert.equal(pcs.active, "p");
  for (const S of [solo, pcs]) {
    assert.equal(S.list.find((c) => c.id === "dead").sur, undefined, "wie neer is wordt niet verrast");
  }
  for (const id of ["g1", "g2"]) assert.ok(isSurprised(pcs.list.find((c) => c.id === id), pcs));
  // alleen verraste monsters: ronde 1 vervalt helemaal, ronde 2 begint bij de hoogste initiative (zoals met iedereen verrast)
  assert.equal(solo.round, 2); assert.equal(solo.active, "g1");
});

test("RE5: met een lair blijft ronde 1 bestaan, de lair is nooit verrast", () => {
  const S = { list: [M("g1", 15), { id: "l", name: "Lair", kind: "lair", init: 20, cond: [] }], round: 0, active: null, log: [] };
  setSurprise(S.list, "mon"); startCombat(S, rng);
  assert.equal(S.round, 1); assert.equal(S.active, "l");
  assert.equal(S.list.find((c) => c.id === "l").sur, undefined);
  assert.ok(isSurprised(S.list.find((c) => c.id === "g1"), S));
});

test("RE6a: elke spell-preset (Effect, AoE Spell) en elke schade-spell staat in de SRD-data, zodat de link uitleg toont", () => {
  setSpells(JSON.parse(readFileSync(new URL("../data/spells.json", import.meta.url), "utf8")));
  setSpells(JSON.parse(readFileSync(new URL("../data/spells-2024.json", import.meta.url), "utf8")));
  const eff = PRESETS.filter((p) => p.lv).map((p) => p.n);
  assert.ok(eff.includes("Shield") && eff.includes("Bless"), "presets met lv zijn de spells");
  assert.deepEqual(PRESETS.filter((p) => !p.lv).map((p) => p.n).sort(), ["Half cover", "Rage", "Three-quarters cover"], "geen link voor cover en Rage");
  for (const n of [...eff, ...SPELLS.map((s) => s.n), ...DMG_SPELLS.map((s) => s.n)]) assert.ok(findSpell(n, "2014") || findSpell(n, "2024"), `${n} niet in de SRD-data`);
});

test("RE5/RE6a: nieuwe teksten in EN en NL", async () => {
  await lang("en");
  assert.equal(t("init.dock.surMon"), "Monsters surprised");
  assert.equal(t("init.eff.spellInfo"), "Spell info:");
  await lang("nl");
  assert.equal(t("init.dock.surMon"), "Monsters verrast");
  assert.equal(t("init.eff.spellInfo"), "Spell-uitleg:");
});

test("TA20: drie teksten uit de WP40-vertaalcheck", async () => {
  await lang("nl");
  assert.equal(t("player.log.gone", { what: "Prone" }), "Prone voorbij");
  assert.equal(t("player.log.gone", { what: "Prone" }), t("log.ends", { name: "Prone" }), "gelijk aan het logboek");
  assert.equal(t("init.eff.concBy"), "Caster (concentratie)");
  await lang("en");
  assert.equal(t("init.eff.concBy"), "Caster (concentration)");
  assert.match(t("init.set.spellsHint"), /\(Sleep: 2024 version only\)/);
});

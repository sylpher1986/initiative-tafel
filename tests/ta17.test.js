// TA17/TA18 (persona-test EN, WP32): Engelse teksten en weergave
import { nl } from "./_nl.js"; // Nederlandse catalogus
import { test } from "node:test";
import assert from "node:assert/strict";
import { mdLite, esc } from "../js/ui/util.js";
import { diffLog } from "../js/log.js";
import { durLabel } from "../js/rules/turns.js";
import { initI18n, tr } from "../js/i18n/boot.js";
import monsters from "../data/monsters.json" with { type: "json" };

const lang = (l) => initI18n({ doc: { documentElement: { lang: l } }, search: "", storage: null });

test("mdLite: SRD-markdown als opmaak, verder niets", () => {
  assert.equal(mdLite(esc("12 (15 with _mage armor_)")), "12 (15 with <i>mage armor</i>)");
  assert.equal(mdLite(esc("weapons.\n**Fire Breath.** The dragon")), "weapons.\n<b>Fire Breath.</b> The dragon");
  assert.equal(mdLite(esc("snake_case_name en 2 * 3 * 4")), "snake_case_name en 2 * 3 * 4");
  assert.equal(mdLite(esc("**Bite 1d6**")), "<b>Bite 1d6</b>", "dobbelstenen binnen vet blijven tekst voor diceify");
  assert.equal(mdLite(esc("**<img src=x>**")), "<b>&lt;img src=x&gt;</b>", "inhoud blijft ge-escapet: alleen <b>/<i> erbij");
  const s = JSON.stringify(monsters);
  assert.ok(/_mage armor_/.test(s) && /\*\*Fire Breath\.\*\*/.test(s), "de data heeft deze resten echt (anders kan mdLite weg)");
});

test("TA17: ander exhaustion-niveau is geen 'refreshed'; Bless opnieuw wel", async () => {
  await lang("en");
  const c = (eff) => ({ id: "m", name: "Mage", kind: "monster", hp: 10, max: 10, cond: [], eff });
  const L = diffLog({ list: [c([{ id: "a", n: "Exhaustion", x: 2 }])], round: 1 }, { list: [c([{ id: "b", n: "Exhaustion", x: 3 }])], round: 1 });
  assert.match(L.map((e) => e.msg).join(" | "), /Exhaustion 2 → 3/);
  assert.doesNotMatch(L.map((e) => e.msg).join(" | "), /refreshed/);
  const B = diffLog({ list: [c([{ id: "a", n: "Bless" }])], round: 1 }, { list: [c([{ id: "b", n: "Bless" }])], round: 1 });
  assert.match(B.map((e) => e.msg).join(" | "), /Bless refreshed/);
  const add = diffLog({ list: [c([])], round: 1 }, { list: [c([{ id: "a", n: "Exhaustion", x: 1 }])], round: 1 }).map((e) => e.msg).join(" | ");
  const del = diffLog({ list: [c([{ id: "a", n: "Exhaustion", x: 1 }])], round: 1 }, { list: [c([])], round: 1 }).map((e) => e.msg).join(" | ");
  assert.doesNotMatch(add + del, /refreshed|→/, "erbij of weg: gets/ends, geen niveauwissel");
});

test("TA17: rondes op een chip in de taal ('10 rds' / '10r'), teksten", async () => {
  await lang("en");
  assert.equal(durLabel({ kind: "rounds", count: 10 }, []), "10 rds");
  assert.equal(durLabel({ kind: "rounds", count: 1 }, []), "1 rd");
  assert.equal(tr({ k: "rules.drops", p: { name: "Thalia" } }), "Thalia drops to 0 HP and is unconscious. Death saves start on their next turn.");
  await lang("nl");
  assert.equal(durLabel({ kind: "rounds", count: 10 }, []), "10r");
  assert.equal(nl({ k: "init.log.turn", p: { name: "Aram" } }), "beurt van Aram");
});

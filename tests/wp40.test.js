// WP40 (TA19): Engelse tekst P3 uit de EN-persona-test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initI18n, t, tr } from "../js/i18n/boot.js";
import { toPlayerView, cleanView, logLines } from "../js/playerview.js";
import { diffLog } from "../js/log.js";

const lang = (l) => initI18n({ doc: { documentElement: { lang: l } }, search: "", storage: null });
const P = (o) => ({ kind: "pc", cond: [], dex: 0, ac: 15, hp: 20, max: 20, ...o });
const view = (S) => cleanView(JSON.parse(JSON.stringify(toPlayerView(S, () => ""))));

test("spelerslog: meerdere condities weg als opsomming (EN 'and', NL 'en')", async () => {
  const S0 = { list: [P({ id: "p", name: "Aria", cond: ["Poisoned", "Prone"] })], round: 2, active: "p" };
  const S1 = { list: [P({ id: "p", name: "Aria" })], round: 2, active: "p" };
  await lang("en");
  assert.deepEqual(logLines(view(S0), view(S1)), ["Aria: Poisoned and Prone ended"]);
  await lang("nl");
  assert.deepEqual(logLines(view(S0), view(S1)), ["Aria: Poisoned en Prone weg"]);
  const S2 = { ...S1, list: [P({ id: "p", name: "Aria", cond: ["Prone"] })] };
  await lang("en");
  assert.deepEqual(logLines(view(S2), view(S1)), ["Aria: Prone ended"], "één conditie blijft gewoon");
});

test("logboek: Unconscious erbij is 'falls unconscious', andere condities blijven 'gets X'", async () => {
  const a = { list: [P({ id: "p", name: "Aria" })] };
  const b = { list: [P({ id: "p", name: "Aria", cond: ["Unconscious", "Prone"] })] };
  const m = diffLog(a, b).flatMap((e) => (e.m ? [].concat(e.m) : []));
  await lang("en");
  const en = diffLog(a, b).map((e) => (e.m ? tr(e.m) : e.msg)).join(" | ");
  assert.match(en, /falls unconscious/);
  assert.match(en, /gets Prone/);
  assert.doesNotMatch(en, /gets Unconscious/);
  await lang("nl");
  assert.match(diffLog(a, b).map((e) => (e.m ? tr(e.m) : e.msg)).join(" | "), /raakt bewusteloos/);
  assert.ok(m.length, "descriptoren, geen zinnen");
});

test("teksten: Legendary Resistance, Caster (concentration), None in keuzelijsten", async () => {
  await lang("en");
  assert.equal(t("init.card.lrPer"), "Legendary Resistance per day");
  assert.equal(t("init.aoe.lrOk"), "Legendary Resistance: save succeeded");
  assert.equal(t("init.eff.concBy"), "Caster (concentration)");
  assert.equal(t("init.card.noneOpt"), "None");
  assert.equal(t("init.card.none"), "none", "midden in een regel blijft klein");
  const render = readFileSync(new URL("../js/ui/render.js", import.meta.url), "utf8");
  assert.ok(!render.includes('<option value="">${esc(t("init.card.none"))}'), "keuzelijsten gebruiken noneOpt");
  assert.equal((render.match(/<option value="">\$\{esc\(t\("init\.card\.noneOpt"\)\)\}/g) || []).length, 3);
});

test("Spells-hint: twee zinnen zichtbaar, de rest achter 'More'", async () => {
  await lang("en");
  assert.equal(t("init.set.spellsRest"), "the rest of the app (conditions, crits, concentration DC) stays 2014.");
  assert.match(t("init.set.spellsMore"), /^Players with a D&D Beyond sheet/);
  for (const l of ["en", "nl"]) {
    const html = readFileSync(new URL(`../${l}/initiative/index.html`, import.meta.url), "utf8");
    assert.match(html, /<details class="hmore"><summary class="link">[^<]+<\/summary><p class="hint">[^<]+<\/p><\/details>/, l);
  }
});

test("2014-spelldata: ability-namen met hoofdletter (SRD-stijl)", () => {
  const raw = readFileSync(new URL("../data/spells.json", import.meta.url), "utf8");
  assert.doesNotMatch(raw, /\b(strength|dexterity|constitution|intelligence|wisdom|charisma) (saving throw|check|score|modifier)/);
  assert.match(raw, /Dexterity saving throw/);
});

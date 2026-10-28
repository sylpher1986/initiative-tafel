// WP54 (G1): regelkeuze zichtbaar. Pure wissel (setRules), sectie Regels in Instellingen, voorbeeld bij 2024, teksten.
import { nl, nlw } from "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setRules } from "../js/rules/combat.js";
import { setExh } from "../js/rules/effects.js";
import { exhEd } from "../js/rules/conditions.js";
import { rulesOf } from "../js/rules/edition.js";

const pc = (o = {}) => ({ id: "b", name: "Brom", kind: "pc", init: 15, dex: 2, ac: 14, hp: 40, max: 40, cond: [], ...o });
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("WP54: setRules wisselt de tafel en rekent Exhaustion om in dezelfde stap", () => {
  const a = pc(); setExh(a, 4);
  const S = { list: [a, pc({ id: "c", name: "Ayla" })], round: 0, active: null };
  const r = setRules(S, "2024");
  assert.equal(S.rules, "2024"); assert.equal(r.from, "2014"); assert.equal(r.to, "2024");
  assert.equal(a.max, 40); assert.equal(exhEd(a), "2024");
  assert.deepEqual(nlw(r.why), [{ t: "Exhaustion 4 onder de regels van 2024: max HP 20 → 40", id: "b" }]);
  const back = setRules(S, "2014");
  assert.equal("rules" in S, false, "2014 = veld weg (stand van een 2014-gebruiker blijft gelijk)");
  assert.equal(rulesOf(S), "2014"); assert.equal(a.max, 20); assert.equal(back.why.length, 1);
});

test("WP54: geen wissel tijdens een gevecht of naar dezelfde regels", () => {
  const S = { list: [], round: 2, active: null };
  assert.equal(setRules(S, "2024"), null); assert.equal(S.rules, undefined);
  S.round = 0;
  assert.equal(setRules(S, "2014"), null, "al 2014");
  assert.equal(setRules(S, "onzin"), null, "onzin = 2014");
  assert.ok(setRules(S, "2024")); assert.equal(setRules(S, "2024"), null);
});

test("WP54: logregel en melding in beide talen", async () => {
  const { M } = await import("../js/i18n/msg.js");
  assert.equal(nl(M("log.rules", { from: "2014", to: "2024" })), "Regels 2014 → 2024");
});

test("WP54: Instellingen heeft sectie Regels met Spells als subinstelling; geen sectie Spells meer", () => {
  const tpl = read("pages/initiative.html");
  assert.match(tpl, /data-sec="rules"[\s\S]*id="ruleset-seg"[\s\S]*data-ruleset="2014"[\s\S]*data-ruleset="2024"/);
  assert.match(tpl, /id="spells-sub"[\s\S]*id="rules-seg"[\s\S]*<\/div>\s*<p class="hint" id="spells-24" hidden>/);
  assert.doesNotMatch(tpl, /data-sec="spells"/);
  const st = read("js/ui/settings.js");
  assert.match(st, /b\.disabled = lock/, "tijdens een gevecht uitgeschakeld (B1)");
  assert.match(st, /`2014 · \$\{t\("init\.set\.spells"\)\} 2024`/);
});

test("WP54: voorbeeld bij 2024 gebruikt SRD 5.2-monsters die bestaan", () => {
  const names = new Set(JSON.parse(read("data/monsters-2024.json")).monsters.map((m) => m.n));
  for (const n of ["Goblin Warrior", "Hobgoblin Warrior"]) assert.ok(names.has(n), n);
  const act = read("js/ui/actions.js");
  assert.match(act, /ed \? "Goblin Warrior" : "Goblin"/);
  assert.match(act, /ed \? "Hobgoblin Warrior" : "Hobgoblin"/);
});

test("WP54: welkomstkaart en pagina-omschrijvingen editie-neutraal", async () => {
  for (const l of ["en", "nl"]) {
    const src = read(`locales/src/${l}/initiative.js`) + read(`locales/src/${l}/pages.js`);
    for (const k of ["init.welcome.text", "page.app.desc", "page.home.desc", "page.manifest.desc"]) {
      const line = src.split("\n").find((x) => x.includes(`"${k}"`));
      assert.match(line, /2014[^"]*2024/, `${l} ${k}`);
    }
  }
});

// WP29 (TA13): D&D-termen, conditie-uitleg per taal, zoekwoorden als parameter, formattering via i18n.
import { nl } from "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createI18n } from "../js/i18n/core.js";
import { LOCALES } from "../js/i18n/lang.js";
import { term } from "../js/i18n/term.js";
import { CINFO, condInfo, condName, exhSummary, exhRows, hasCondInfo, SUR } from "../js/rules/conditions.js";
import { CONDS } from "../js/rules/turns.js";
import { setExh } from "../js/rules/effects.js";
import { filterMonsters, synMap } from "../js/data/monsters.js";
import { SYN } from "../js/data/syn.js";
import en from "../locales/en.js";
import nlCat from "../locales/nl.js";
import nlSyn from "../locales/nl/search.js";

const E = createI18n({ lang: "en", catalogs: { en }, locale: LOCALES.en });
const srd = JSON.parse(readFileSync(new URL("../data/monsters.json", import.meta.url)));

const files = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : p.endsWith(".js") ? [p] : []; });

test("geen vaste nl-NL of toLocale…() in js/: getallen en datums via i18n (num/date/time)", () => {
  const bad = [];
  for (const f of files("js")) {
    const s = readFileSync(f, "utf8");
    if (f !== join("js", "i18n", "lang.js") && s.includes('"nl-NL"')) bad.push(`${f}: "nl-NL"`);
    if (/\.toLocale(String|DateString|TimeString)\(/.test(s)) bad.push(`${f}: toLocale…()`);
  }
  assert.deepEqual(bad, []);
});

test("formattering: EN 1,950 XP en 12 Oct (en-GB, vertaalagent WP20), NL ongewijzigd 1.950", () => {
  const N = createI18n({ lang: "nl", catalogs: { nl: nlCat }, locale: LOCALES.nl });
  assert.equal(E.num(1950), "1,950");
  assert.equal(N.num(1950), "1.950");
  const d = new Date(2026, 9, 12, 14, 5);
  assert.equal(E.date(d, { day: "numeric", month: "short" }), "12 Oct");
  assert.equal(E.time(d), "14:05");
});

test("conditie-uitleg: elke id heeft precies zijn regels in en en nl; 14 condities + Exhaustion in EN", () => {
  assert.equal(CONDS.filter((k) => k !== "Concentrating").length, 14);
  for (const cat of [en, nlCat]) {
    for (const [k, n] of Object.entries(CINFO)) {
      for (let i = 1; i <= n; i++) assert.ok(typeof cat[`dnd.cond.${k}.${i}`] === "string" && cat[`dnd.cond.${k}.${i}`].length > 10, `${k}.${i}`);
      assert.equal(cat[`dnd.cond.${k}.${n + 1}`], undefined, `${k}: meer regels dan CINFO`);
    }
    for (let i = 1; i <= 6; i++) assert.ok(cat[`dnd.exh.${i}`] && cat[`dnd.exh.s${i}`], `exh ${i}`);
  }
  for (const k of [...CONDS, "Exhaustion"]) assert.ok(hasCondInfo(k), k);
  assert.equal(hasCondInfo("toString"), false);
  // Engels in de Engelse UI, Nederlands in de Nederlandse
  const p = condInfo("Prone");
  assert.equal(E.tr(p.name), "Prone");
  assert.match(E.tr(p.lines[0]), /^Can only crawl/);
  assert.match(nl(p.lines[0]), /^Kan alleen kruipen/);
  assert.equal(E.tr(condInfo(SUR).name), "Surprised");
  assert.equal(nl(condName(SUR)), "Verrast");
  const x = condInfo("Exhaustion", 2);
  assert.deepEqual(x.lines.map(E.tr), ["1 Disadvantage on ability checks", "2 Speed halved", "Six levels, which are cumulative. A long rest (with food and drink) removes one level."]);
  assert.equal(E.tr(exhSummary(6)), "Level 6: disadvantage on checks · disadvantage on attacks and saves · max HP ½ · speed 0 · death");
  assert.equal(exhRows(-1).length, 0);
});

test("Exhaustion: melding in de taal, opgeslagen effect zonder tekst in een taal", () => {
  const c = { id: "b", name: "Brom", kind: "pc", hp: 40, max: 40, cond: [] };
  const out = setExh(c, 2);
  assert.equal(nl(out.msgs.at(-1)), "Brom: Exhaustion 2 (speed ½).");
  assert.equal(c.eff[0].txt, "");
  assert.equal(nl(setExh(c, 1).msgs.at(-1)), "Brom: Exhaustion 1.");
});

test("term(): voor en/nl de Engelse id zelf", () => {
  assert.equal(term("cond", "Prone"), "Prone");
  assert.equal(term("dmg", "fire"), "fire");
  assert.equal(term("cond", null), "");
});

test("zoeken: synoniemen als parameter (puur); 'draak' werkt in beide talen, correctie in de taal", () => {
  assert.ok(filterMonsters(srd, "draak", null, false, SYN).L.some((m) => m.n === "Red Dragon Wyrmling"));
  assert.equal(filterMonsters(srd, "draak", null).L.some((m) => /dragon/i.test(m.n) && !/draak/i.test(m.n)), false, "zonder synoniemen geen NL-woorden");
  const f = filterMonsters(srd, "draak", null, false, SYN);
  assert.equal(E.tr(f.label), nl(f.label)); // '"draak" = dragon' is taalneutraal
  const g = filterMonsters(srd, "gobin", null, false, SYN);
  assert.equal(E.tr(g.label), "Did you mean: goblin");
  assert.equal(nl(g.label), "Bedoelde je: goblin");
  assert.equal(filterMonsters(srd, "wolf", null, false, SYN).label, "");
  // meerdere bronnen samen; dezelfde lijst met andere synoniemen geeft een eigen woordenschat (cache per Map)
  const S2 = synMap(nlSyn, { "loup": "wolf" });
  assert.ok(filterMonsters(srd, "loup", null, false, S2).L.some((m) => m.n === "Wolf"));
  assert.equal(filterMonsters(srd, "loup", null, false, SYN).L.some((m) => m.n === "Wolf"), false);
});

test("effect-presets: uitleg als sleutel (tk), tekst in de taal; import laat alleen bekende sleutels door", async () => {
  const { PRESETS, addEffect, effNote, cleanTk } = await import("../js/rules/effects.js");
  const { cleanCombatant } = await import("../js/backup.js");
  const c = { id: "a", name: "Ayla", kind: "pc", hp: 20, max: 20, ac: 12, cond: [] };
  addEffect(c, PRESETS.find((p) => p.n === "Bless"), null);
  const e = c.eff[0];
  assert.equal(e.tk, "dnd.pre.bless");
  assert.equal(e.txt, "");
  assert.equal(nl(effNote(e)), "+1d4 op attack rolls en saves");
  assert.equal(E.t(e.tk), "+1d4 on attack rolls and saves");
  for (const p of PRESETS) for (const k of [p.tk, p.after?.tk, p.r24?.tk, p.r24?.after?.tk].filter(Boolean)) assert.ok(en[k] && nlCat[k], k);
  assert.equal(cleanTk("dnd.pre.nope"), undefined);
  const back = cleanCombatant({ ...c, eff: [{ ...e, tk: "init.boot.page" }, { ...e, id: "y", n: "Mijn effect", tk: undefined, txt: "eigen" }] });
  assert.equal(back.eff[0].tk, undefined);
  assert.equal(effNote(back.eff[1]), "eigen"); // tekst van de DM blijft inhoud
  assert.equal(effNote(cleanCombatant(c).eff[0]), nl(effNote(e)));
});

test("exhSummary buiten 0–6 (review): begrensd", () => {
  assert.equal(nl(exhSummary(-1)), "Niveau 0: geen exhaustion");
  assert.equal(nl(exhSummary(9)), nl(exhSummary(6)));
});

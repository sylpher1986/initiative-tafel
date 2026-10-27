// WP12: afwerking (AF11, RE15, …)
import { nlw } from "./_nl.js"; // WP27: Nederlandse catalogus; nlw = oorzaken als tekst
import { test } from "node:test";
import assert from "node:assert/strict";
import { exportName } from "../js/backup.js";
import { dsResult, rollDs } from "../js/rules/combat.js";
import { spellTargets } from "../js/rules/spellcast.js";

const pc = (o = {}) => ({ id: "p", kind: "pc", name: "Aria", hp: 0, max: 20, cond: ["Unconscious"], ds: { s: 0, f: 0, stable: false, dead: false }, ...o });

test("AF11: exportnaam in lokale tijd", () => {
  const t = new Date(2026, 0, 2, 3, 4); // lokaal 2 jan 03:04
  assert.equal(exportName(t), "kevs-inn-itiative-2026-01-02-03-04.json");
});

test("AF11: dode wezens niet in de casterlijst", () => {
  const L = [{ id: "a", kind: "pc", hp: 5, max: 10 }, { id: "b", kind: "monster", hp: 0, max: 7 }, { id: "c", kind: "lair" },
    { id: "d", kind: "pc", hp: 0, max: 10, ds: { dead: true } }];
  assert.deepEqual(spellTargets(L).map((c) => c.id), ["a"]);
});

test("RE15: getypte worp telt als death save", () => {
  const a = pc(); dsResult(a, 12); assert.equal(a.ds.s, 1);
  const b = pc(); dsResult(b, 9); assert.equal(b.ds.f, 1);
  const c = pc(); dsResult(c, 10); assert.equal(c.ds.s, 1, "10 is een success");
  const d = pc(); dsResult(d, 1); assert.equal(d.ds.f, 2);
  const e = pc(); const fx = dsResult(e, 20); assert.equal(e.hp, 1); assert.equal(e.ds, null); assert.ok(!e.cond.includes("Unconscious"));
  assert.match(nlw(fx.why)[0].t, /death save \[20\], door speler gerold/);
  const f = pc({ ds: { s: 0, f: 2, stable: false, dead: false } }); dsResult(f, 1); assert.equal(f.ds.f, 3); assert.equal(f.ds.dead, true);
});

test("RE15: ongeldige worp of niet op 0 HP doet niets", () => {
  for (const r of [0, 21, 2.5, NaN, null, "12"]) { const c = pc(); const fx = dsResult(c, r); assert.equal(c.ds.s + c.ds.f, 0); assert.equal(fx.why.length, 0); }
  const up = pc({ hp: 3 }); dsResult(up, 5); assert.equal(up.ds.f, 0);
  const dead = pc({ ds: { s: 0, f: 3, stable: false, dead: true } }); dsResult(dead, 20); assert.equal(dead.hp, 0);
  const st = pc({ ds: { s: 3, f: 0, stable: true, dead: false } }); dsResult(st, 2); assert.equal(st.ds.f, 0);
});

test("RE15: Rol death save gebruikt dezelfde regels", () => {
  const c = pc(); const fx = rollDs(c, () => 0.6); // d20 = 13
  assert.equal(c.ds.s, 1); assert.match(nlw(fx.why)[0].t, /death save d20 \[13\]/);
});

/* ---------- SC9: mini-log uit de snapshots ---------- */
import { toPlayerView, cleanView, logLines, pushLog, VIS } from "../js/playerview.js";
const P = (o) => ({ kind: "pc", cond: [], dex: 0, ac: 15, hp: 20, max: 20, ...o });
const M = (o) => ({ kind: "monster", cond: [], dex: 0, ac: 13, hp: 10, max: 10, ref: "Goblin", ...o });
const view = (list, vis = VIS, extra = {}) => cleanView(JSON.parse(JSON.stringify(toPlayerView({ list, round: 2, active: list[0].id, ...extra }, () => "", vis))));

test("SC9: HP-verandering, status en condities als regels", () => {
  const a = view([P({ id: "p", name: "Aria" }), M({ id: "g", name: "Goblin 1" })]);
  const b = view([P({ id: "p", name: "Aria", hp: 13, cond: ["Prone"] }), M({ id: "g", name: "Goblin 1", hp: 5 })]);
  assert.deepEqual(logLines(a, b), ["Aria −7 HP · Prone", "Goblin 1: Ongedeerd → Bloodied"]);
  const c = view([P({ id: "p", name: "Aria", hp: 13 }), M({ id: "g", name: "Goblin 1", hp: 0 })]);
  assert.deepEqual(logLines(b, c), ["Aria: Prone weg", "Goblin 1 neer"]);
  // WP39: met exacte monster-HP staat "neer" vóór het getal (afkapping op 320 px raakt het getal)
  const ex = { ...VIS, monHp: "exact" };
  assert.deepEqual(logLines(view([M({ id: "g", name: "Goblin 1", hp: 5 })], ex), view([M({ id: "g", name: "Goblin 1", hp: 0 })], ex)), ["Goblin 1 neer · −5 HP"]);
});

test("SC9: speler neer en dood", () => {
  const a = view([P({ id: "p", name: "Aria", hp: 4 })]);
  const b = view([P({ id: "p", name: "Aria", hp: 0, cond: ["Unconscious"], ds: { s: 0, f: 0 } })]);
  assert.deepEqual(logLines(a, b), ["Aria bewusteloos · −4 HP"]);
  const c = view([P({ id: "p", name: "Aria", hp: 0, cond: ["Unconscious"], ds: { s: 0, f: 3, dead: true } })]);
  assert.deepEqual(logLines(b, c), ["Aria: dood"]);
});

test("SC9: lekt niets: verborgen monster, onthulde naam, monster-HP verborgen", () => {
  const a = view([P({ id: "p", name: "Aria" }), M({ id: "h", name: "Lurker", hidden: true }), M({ id: "x", name: "Ogre", anon: 1 })]);
  const b = view([P({ id: "p", name: "Aria" }), M({ id: "h", name: "Lurker", hidden: true, hp: 1 }), M({ id: "x", name: "Ogre", anon: 1, hp: 4 })]);
  const L = logLines(a, b);
  assert.ok(!L.join().includes("Lurker") && !L.join().includes("Ogre"), L.join());
  assert.deepEqual(L, ["Onbekend wezen: Ongedeerd → Bloodied"]);
  const nohp = { ...VIS, monHp: "none" };
  assert.deepEqual(logLines(view([M({ id: "g", name: "G" })], nohp), view([M({ id: "g", name: "G", hp: 3 })], nohp)), []);
  // hidden monster komt tevoorschijn: geen regel; naam onthuld: geen regel
  const r = view([P({ id: "p", name: "Aria" }), M({ id: "h", name: "Lurker" }), M({ id: "x", name: "Ogre", hp: 4 })]);
  assert.deepEqual(logLines(b, r), []);
});

test("SC9: uit in de instellingen, buiten een gevecht, reaction/verrast tellen niet", () => {
  const off = { ...VIS, log: false };
  const a = view([P({ id: "p", name: "Aria" })], off), b = view([P({ id: "p", name: "Aria", hp: 3 })], off);
  assert.equal(b.nolog, 1); assert.deepEqual(logLines(a, b), []);
  const c = view([P({ id: "p", name: "Aria" })], VIS, { round: 0 }), d = view([P({ id: "p", name: "Aria", hp: 3 })], VIS, { round: 0 });
  assert.deepEqual(logLines(c, d), []);
  assert.deepEqual(logLines(null, d), []);
});

test("SC9: pushLog houdt de huidige en vorige ronde, max 8", () => {
  let L = pushLog([], ["a"], 1); L = pushLog(L, ["b"], 2); L = pushLog(L, ["c"], 3);
  assert.deepEqual(L.map((e) => e.t), ["b", "c"]);
  assert.deepEqual(pushLog(L, ["d"], 0), []);
  assert.equal(pushLog([], Array.from({ length: 12 }, (_, i) => String(i)), 1).length, 8);
});

/* ---------- AF12 ---------- */
import { readFileSync } from "node:fs";
test("AF12: slots en death saves zonder aria-pressed, toestand in het label; aria-current op wie aan de beurt is", () => {
  const r = readFileSync(new URL("../js/ui/render.js", import.meta.url), "utf8");
  assert.ok(!/class="pip[^`]*aria-pressed/.test(r) && !/class="dsp[^`]*aria-pressed/.test(r));
  assert.match(r, /t\(i >= o\.left \? "init\.card\.pipUsed" : "init\.card\.pipFree"/); // WP25: tekst uit de catalogus
  assert.match(r, /aria-current="true"/);
  const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
  assert.match(css, /\.pip\[data-used="true"\]::before/); assert.match(css, /\.av-mon,\.av-mon \.avi\{border-radius:0;clip-path:polygon\(/); // WP36: monster achthoek, speler rond
});

/* ---------- review WP12 ---------- */
import { applyPcHp, critAtZero } from "../js/rules/combat.js";
test("stabiel en toch schade: weer death saves, tellers vanaf nul (PHB 2014)", () => {
  const a = pc({ ds: { s: 3, f: 1, stable: true, dead: false } }); applyPcHp(a, -3);
  assert.deepEqual([a.ds.stable, a.ds.s, a.ds.f], [false, 0, 1]);
  const b = pc({ ds: { s: 3, f: 0, stable: true, dead: false } }); critAtZero(b);
  assert.deepEqual([b.ds.stable, b.ds.s, b.ds.f], [false, 0, 2]);
  dsResult(b, 12); assert.equal(b.ds.s, 1, "de knoppen werken weer");
});

test("dsResult maakt geen ds-object bij een speler met HP", () => {
  const c = pc({ hp: 5, ds: null }); dsResult(c, 12); assert.equal(c.ds, null);
});

test("SC9: wisselen van 'Condities en effecten' geeft geen regelstorm", () => {
  const none = { ...VIS, tags: "none" };
  const a = view([P({ id: "p", name: "Aria", cond: ["Prone"] }), M({ id: "g", name: "G", cond: ["Poisoned"] })], none);
  const b = view([P({ id: "p", name: "Aria", cond: ["Prone"] }), M({ id: "g", name: "G", cond: ["Poisoned"] })]);
  assert.deepEqual(logLines(a, b), []); assert.deepEqual(logLines(b, a), []);
  assert.equal(cleanView({ v: 1, list: [], tg: "<x>" }).tg, undefined);
});

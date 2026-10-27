import "./_nl.js"; // WP27: Nederlandse catalogus; aan het eind van dit bestand wisselt de taal naar Engels
import { test } from "node:test";
import assert from "node:assert/strict";
import { app, commit, because, logAs, resetBaseline } from "../js/state.js";
import { logMsg, logWhy, logText, stepText } from "../js/log.js";
import { cleanDesc, parseImport, FORMAT } from "../js/backup.js";
import { M, J, isJoin } from "../js/i18n/msg.js";
import { initI18n, tr } from "../js/i18n/boot.js";
import { applyDamage } from "../js/rules/combat.js";
import { endText } from "../js/rules/fight.js";
import { atkWhy } from "../js/rules/attacks.js";

const pc = (o = {}) => ({ id: "p", name: "Ayla", kind: "pc", init: 12, cond: [], hp: 20, max: 20, ...o });
const mon = (o = {}) => ({ id: "g", name: "Goblin 1", kind: "monster", ref: "Goblin", init: 10, dex: 0, ac: 15, hp: 7, max: 7, cond: [], ...o });

test("J: delen vertaald en samengevoegd, lege delen weg", () => {
  const j = J(["−7 HP", null, "", M("rules.manual")]);
  assert.ok(isJoin(j));
  assert.equal(tr(j), "−7 HP, handmatig");
  assert.equal(tr(J(["a", "b"], ". ")), "a. b");
});

test("logboek: m en w als descriptor; msg en why pas in de export (TS3)", () => {
  app.S = { list: [pc(), mon()], round: 1, active: "p", log: [] };
  resetBaseline();
  const f = applyDamage(app.S.list[1], 9, 1, true);
  f.why.forEach((w) => because(w.t, w.id));
  because(M("log.w.edited"), "g");
  commit();
  const e = app.S.log.at(-1);
  assert.ok(e.m && /^log\./.test(e.m.k), "regel heeft een descriptor");
  assert.equal(e.msg, undefined, "geen tekst naast de descriptor (TS3)");
  assert.match(logMsg(e), /Goblin/);
  assert.ok(Array.isArray(e.w) && e.w.some((x) => x && x.k === "log.w.edited"));
  assert.equal(e.why, undefined);
  assert.match(logWhy(e), /bewerkt/);
  // samenvatting via logAs met een descriptor
  app.S.list.push(mon({ id: "g2", name: "Goblin 2" }));
  logAs(M("log.encLoaded", { name: "Grot", n: 1, lair: "" }));
  commit();
  assert.equal(logMsg(app.S.log.at(-1)), 'Encounter "Grot" ingeladen: 1 monster');
});

test("cleanDesc: alleen bekende voorvoegsels, begrensde diepte en lengte", () => {
  assert.deepEqual(cleanDesc(M("rules.over", { name: "A", what: "B" })), { k: "rules.over", p: { name: "A", what: "B" } });
  assert.equal(cleanDesc({ k: "evil.key" }), null);
  assert.equal(cleanDesc({ k: "rules.x", p: { "a b": 1 } }), null);
  assert.equal(cleanDesc({ k: "rules.x", p: "x" }), null);
  assert.equal(cleanDesc({ k: "rules.x", p: { n: Infinity } }), null);
  assert.equal(cleanDesc({ k: "rules.x", p: { s: "x".repeat(1500) } }).p.s.length, 1000);
  let deep = "x"; for (let i = 0; i < 10; i++) deep = M("rules.x", { a: deep });
  assert.equal(cleanDesc(deep), null);
  assert.deepEqual(cleanDesc(J(["a", M("rules.manual")], "; ")), { j: ["a", { k: "rules.manual" }], s: "; " });
});

test("cleanDesc: diepste logregels overleven de import (afronden met opgestaan, aanval met immuun type)", () => {
  const es = { r: 3, min: 12, enc: "Brug", mons: [], all: [], flip: [], pcs: [{ id: "a", name: "Aria" }, { id: "b", name: "Brom", dead: true }], down: [{ id: "a", name: "Aria" }, { id: "c", name: "Cas" }] };
  const now = { ...es, pcs: [{ id: "a", name: "Aria", up: true }, { id: "b", name: "Brom", dead: true }, { id: "c", name: "Cas" }] };
  const d = endText(now);
  assert.match(tr(d), /Aria \(stond weer op\)/);
  assert.deepEqual(cleanDesc(d), d);
  const atk = { d: [15, 3], adv: 0, bo: 4, tot: 19, nat: 15 };
  const w = atkWhy("Bite (Wolf)", atk, 13, [{ e: "2d4+2", rolls: [3, 4], total: 9, type: "piercing", xr: [] }], { crit: false, natHit: true, dealt: 0, types: [{ type: "piercing", mode: 0, dealt: 0 }] });
  assert.deepEqual(cleanDesc([w]), [w]);
  assert.match(tr(w), /piercing immuun = 0/);
});

test("import: oude regels (zonder m) blijven, rare m valt weg maar msg blijft", () => {
  const log = [
    { id: "1", r: 1, msg: "Goblin 1: 7 → 0 HP", why: "AoE" },
    { id: "2", r: 1, msg: "Tekst", why: "", m: { k: "x.y" }, w: [{ k: "<script>" }] },
    { id: "3", r: 1, msg: "Ayla: Prone is voorbij.", why: "", m: M("rules.over", { name: "Ayla", what: "Prone" }) },
  ];
  const { S } = parseImport({ format: FORMAT, version: 2, state: { list: [], round: 0, log } });
  assert.deepEqual(S.log.map(logMsg), log.map((e) => e.msg));
  assert.equal(S.log[0].m, undefined);
  assert.equal(S.log[2].msg, undefined, "geldige m: geen tekst ernaast in de stand (TS3)");
  assert.equal(S.log[1].m, undefined); assert.equal(S.log[1].w, undefined);
  assert.equal(logMsg(S.log[1]), "Tekst");
  assert.deepEqual(S.log[2].m, log[2].m);
});

test("stepText: code undo/redo", () => {
  const E = [{ msg: "Ayla: 20 → 13 HP" }];
  assert.equal(stepText(E, null, "undo").text, "Ongedaan: Ayla: 20 → 13 HP");
  assert.match(stepText(E, null, "redo").text, /^Opnieuw: Ayla/);
});

test("taalwissel: regels met m in de nieuwe taal, regels zonder m ongewijzigd", async () => {
  const L = [
    { id: "a", r: 2, msg: "Ayla: Prone is voorbij.", m: M("rules.over", { name: "Ayla", what: "Prone" }), why: "handmatig", w: [M("rules.manual")] },
    { id: "b", r: 2, msg: "Brom: oude regel", why: "oud" },
  ];
  await initI18n({ doc: { documentElement: { lang: "en" } }, search: "", storage: null });
  assert.equal(logMsg(L[0]), "Ayla: Prone has ended.");
  assert.equal(logWhy(L[0]), "manual");
  assert.equal(logMsg(L[1]), "Brom: oude regel");
  assert.equal(logWhy(L[1]), "oud");
  assert.match(logText(L), /R2/);
  assert.match(logText(L), /Prone has ended/);
});

// WP43 (TS3): logboek zonder dubbele tekst in de stand; de export vult msg/why aan zoals vóór 2.2.1.
import "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { app, commit, because, relog, logAs, resetBaseline } from "../js/state.js";
import { applyDamage } from "../js/rules/combat.js";
import { M } from "../js/i18n/msg.js";
import { logMsg, logWhy, slimLog, exportLog, stepEntries } from "../js/log.js";
import { buildExport, parseImport, FORMAT } from "../js/backup.js";

const pc = () => ({ id: "p", name: "Ayla", kind: "pc", init: 12, cond: [], hp: 20, max: 20 });
const mon = () => ({ id: "g", name: "Goblin", kind: "monster", ref: "Goblin", init: 10, dex: 2, ac: 15, hp: 7, max: 7, cond: [] });

function fight() {
  app.S = { list: [pc(), mon()], round: 1, active: "p", log: [] };
  resetBaseline();
  const f = applyDamage(app.S.list[1], 3, 1, true);
  f.why.forEach((w) => because(w.t, w.id));
  because(M("log.w.edited"), "g");
  commit();
  app.S.list[0].hp = 15; because("eigen notitie", "p"); commit(); // oorzaak als tekst: why blijft tekst
}

test("stand: m óf msg en w óf why, nooit beide", () => {
  fight();
  for (const e of app.S.log) {
    assert.ok(!(e.m && "msg" in e), `regel ${e.id} heeft m én msg`);
    assert.ok(!(Array.isArray(e.w) && "why" in e), `regel ${e.id} heeft w én why`);
  }
  const last = app.S.log.at(-1);
  assert.equal(last.why, "eigen notitie");
  assert.match(logMsg(last), /Ayla: 20 → 15 HP/);
});

test("export: msg en why als tekst, zelfde sleutelvolgorde als vóór 2.2.1, stand onaangetast", () => {
  fight();
  const before = JSON.stringify(app.S);
  const x = buildExport(app);
  assert.equal(JSON.stringify(app.S), before, "buildExport muteert de stand niet");
  for (const e of x.state.log) {
    assert.equal(typeof e.msg, "string"); assert.ok(e.msg.length > 0);
    assert.equal(typeof e.why, "string");
    const keys = Object.keys(e);
    assert.deepEqual(keys.slice(0, 7), ["id", "r", "turn", "type", "msg", "why", "note"]);
  }
  const dmg = x.state.log.find((e) => /Goblin: 7 → 4 HP/.test(e.msg));
  assert.ok(dmg && dmg.m && Array.isArray(dmg.w) && dmg.why.length, "descriptor blijft naast de tekst in de export");
  // rondreis: import geeft dezelfde weergave terug
  const { S } = parseImport(JSON.parse(JSON.stringify(x)));
  assert.deepEqual(S.log.map(logMsg), x.state.log.map((e) => e.msg));
  assert.deepEqual(S.log.map(logWhy), x.state.log.map((e) => e.why));
  assert.ok(S.log.every((e) => !(e.m && "msg" in e)));
});

test("export zonder log of zonder state werkt", () => {
  app.S = { list: [], round: 0, active: null };
  assert.equal(buildExport(app).state.log, undefined);
  assert.deepEqual(exportLog(undefined), []);
});

test("slimLog: oude regels (msg naast m) worden kleiner, regels zonder m houden hun tekst", () => {
  const L = [
    { id: "1", msg: "Goblin: 7 → 4 HP", why: "3 schade", m: M("log.removed", { name: "x" }), w: [M("log.w.edited")] },
    { id: "2", msg: "oude regel", why: "AoE" },
    { id: "3", msg: "x", why: "oude oorzaak", w: [] },
    null,
  ];
  slimLog(L);
  assert.equal(L[2].why, "oude oorzaak", "lege w wist why niet");
  const imp = parseImport({ format: FORMAT, version: 2, state: { list: [], round: 0, log: [{ id: "4", msg: "y", why: "AoE oud", w: [] }] } }).S.log[0];
  assert.equal(logWhy(imp), "AoE oud");
  assert.equal(L[0].msg, undefined); assert.equal(L[0].why, undefined);
  assert.equal(L[1].msg, "oude regel"); assert.equal(L[1].why, "AoE");
  slimLog(undefined); slimLog({});
});

test("stepEntries: relog op een descriptor-regel telt als wijziging; ongewijzigd niet", () => {
  app.S = { list: [pc()], round: 1, active: "p", log: [] };
  resetBaseline();
  app.S.round = 2; logAs(M("log.encLoaded", { name: "Grot", n: 1, lair: "" }), "end"); app.S.list[0].hp = 19; commit();
  const a = structuredClone(app.S.log);
  relog("end", M("log.encLoaded", { name: "Grot", n: 2, lair: "" }));
  const b = app.S.log;
  assert.equal(stepEntries(b, a).length, 1);
  assert.equal(stepEntries(a, a).length, 0);
  relog("end", "tekst"); // descriptor → tekst
  assert.equal(app.S.log.find((e) => e.key === "end").m, undefined);
  assert.equal(stepEntries(app.S.log, a).length, 1);
});

test("kleiner per regel dan met dubbele tekst", () => {
  fight();
  const now = JSON.stringify(app.S.log).length;
  const old = JSON.stringify(exportLog(app.S.log)).length;
  assert.ok(now < old * 0.85, `${now} vs ${old}`);
});

// TS1: pdf.js zelf gehost, geen CDN meer
const root = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, root));
test("TS1: pdf.js uit vendor/pdfjs, ongewijzigd (hash uit de README), geen CDN in de code", async () => {
  const { createHash } = await import("node:crypto");
  const readme = read("vendor/pdfjs/README.md").toString();
  for (const f of ["pdf.js", "pdf.worker.js", "LICENSE"]) {
    const h = createHash("sha256").update(read("vendor/pdfjs/" + f)).digest("hex");
    assert.ok(readme.includes("`" + h + "`"), `${f}: hash ${h} staat niet in vendor/pdfjs/README.md`);
  }
  const ddb = read("js/ddb.js").toString();
  assert.match(ddb, /const PDFJS = "\/vendor\/pdfjs\/";/);
  for (const f of ["js/ddb.js", "sw.js", "pages/initiative.html", "pages/player.html", "pages/home.html"]) {
    assert.doesNotMatch(read(f).toString(), /cdnjs|jsdelivr|unpkg|pdf\.min\.js/, f);
  }
  const sw = read("sw.js").toString();
  for (const f of ["pdf.js", "pdf.worker.js"]) assert.ok(sw.includes(`"./vendor/pdfjs/${f}"`), `${f} niet in VENDOR_ASSETS`);
  assert.match(sw, /k !== CACHE && k !== VENDOR/, "activate laat de pdf.js-cache staan");
  assert.match(sw, /hit \|\| put\(c, a\)\)\.catch\(/, "pdf.js bij install best effort");
  const ign = read(".assetsignore").toString().split("\n").map((l) => l.trim());
  assert.ok(!ign.some((l) => /^\/?vendor/.test(l)), "vendor/ wordt gepubliceerd");
});

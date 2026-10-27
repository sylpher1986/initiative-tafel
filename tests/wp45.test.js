// WP45 (TS5): export en logboek zonder geladen catalogus of met sleutels uit een nieuwere app: nooit de kale sleutel
// als tekst als er een bewaarde tekst is. Eigen bestand (eigen proces): de vertaler wordt hier bewust leeg gestart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { initI18n, known } from "../js/i18n/boot.js";
import { M, J, descKnown } from "../js/i18n/msg.js";
import { logMsg, logWhy, slimLog, exportLog, logText } from "../js/log.js";
import { buildExport, parseImport, FORMAT } from "../js/backup.js";

const doc = (lang) => ({ documentElement: { lang } });
const noCat = () => initI18n({ doc: doc("nl"), search: "", storage: null, load: () => Promise.reject(new Error("offline")), wait: 10 });
const nlCat = () => initI18n({ doc: doc("nl"), search: "", storage: null });

test("descKnown: alle sleutels, ook genest, in J en in lijsten", () => {
  const has = (k) => k === "log.changes" || k === "log.ends";
  assert.equal(descKnown(M("log.changes", { name: "A", what: J([M("log.ends", { name: "B" }), "−3 HP"]) }), has), true);
  assert.equal(descKnown(M("log.changes", { name: "A", what: J([M("log.nieuw"), "x"]) }), has), false);
  assert.equal(descKnown([M("log.ends"), "tekst", 3], has), true);
  assert.equal(descKnown([M("log.ends"), M("log.x")], has), false);
  assert.equal(descKnown("tekst", has), true);
  let d = M("log.ends"); for (let i = 0; i < 12; i++) d = M("log.ends", { x: d });
  assert.equal(descKnown(d, has), false, "te diep = onbekend");
});

test("zonder catalogus: logMsg/logWhy/logText vallen op de bewaarde tekst terug", async () => {
  await noCat();
  assert.equal(known(M("log.removed", { name: "x" })), false);
  const e = { id: "1", r: 1, m: M("log.removed", { name: "Goblin" }), msg: "Goblin verwijderd", w: [M("log.w.edited")], why: "bewerkt" };
  assert.equal(logMsg(e), "Goblin verwijderd");
  assert.equal(logWhy(e), "bewerkt");
  assert.match(logText([e]), /Goblin verwijderd \(bewerkt\)/);
  // zonder bewaarde tekst blijft alleen de sleutel over (niets beters beschikbaar)
  assert.equal(logMsg({ m: M("log.removed", { name: "x" }) }), "log.removed");
});

test("zonder catalogus: export bevat geen kale sleutel als msg of why", async () => {
  await noCat();
  const S = { list: [], round: 1, active: null, log: [
    { id: "1", r: 1, turn: "", type: "", note: "", m: M("log.removed", { name: "Goblin" }) }, // stand na TS3: alleen m
    { id: "2", r: 1, turn: "", type: "", note: "", m: M("log.removed", { name: "Orc" }), msg: "Orc verwijderd", w: [M("log.w.edited")], why: "bewerkt" },
    { id: "3", r: 1, turn: "", type: "", note: "", msg: "oude regel" },
  ] };
  const x = buildExport({ S, party: [], lairs: {}, custom: [], imported: [], encounters: [], spellNotes: {} });
  const L = JSON.parse(JSON.stringify(x)).state.log;
  for (const e of L) {
    assert.ok(!/^(log|rules|init|dnd)\.[\w.]+$/.test(e.msg || ""), `kale sleutel in msg: ${e.msg}`);
    assert.ok(!/^(log|rules|init|dnd)\.[\w.]+$/.test(e.why || ""), `kale sleutel in why: ${e.why}`);
  }
  assert.equal(L[0].msg, undefined, "geen tekst beschikbaar: geen msg");
  assert.deepEqual(L[0].m, M("log.removed", { name: "Goblin" }), "descriptor blijft: een volgende export is weer goed");
  assert.equal(L[1].msg, "Orc verwijderd"); assert.equal(L[1].why, "bewerkt");
  assert.equal(L[2].msg, "oude regel");
  assert.deepEqual(Object.keys(L[1]).slice(0, 7), ["id", "r", "turn", "type", "msg", "why", "note"]);
});

test("zonder catalogus: slimLog gooit de tekst niet weg", async () => {
  await noCat();
  const L = [{ id: "1", m: M("log.removed", { name: "x" }), msg: "x verwijderd", w: [M("log.w.edited")], why: "bewerkt" }];
  slimLog(L);
  assert.equal(L[0].msg, "x verwijderd"); assert.equal(L[0].why, "bewerkt");
});

test("met catalogus: import met een onbekende log-sleutel (nieuwere app) toont de meegeleverde tekst", async () => {
  await nlCat();
  const log = [
    { id: "1", r: 2, turn: "Ayla", type: "", msg: "Ayla: iets nieuws", why: "nieuwe oorzaak", note: "", m: M("log.uitDeToekomst", { name: "Ayla" }), w: [M("log.w.nieuw")] },
    { id: "2", r: 2, turn: "Ayla", type: "", msg: "Goblin verwijderd", why: "", note: "", m: M("log.removed", { name: "Goblin" }) },
    { id: "3", r: 2, turn: "Ayla", type: "", msg: "Ayla: …", why: "", note: "", m: M("log.changes", { name: "Ayla", what: J([M("log.nieuwGenest"), "−3 HP"]) }) },
  ];
  const S = parseImport({ format: FORMAT, version: 3, state: { list: [], round: 2, log } }).S;
  const [a, b, c] = S.log;
  assert.equal(a.msg, "Ayla: iets nieuws", "onbekende sleutel: tekst blijft bewaard");
  assert.equal(logMsg(a), "Ayla: iets nieuws");
  assert.equal(logWhy(a), "nieuwe oorzaak");
  assert.equal(b.msg, undefined, "bekende sleutel: tekst weg zoals in TS3");
  assert.equal(logMsg(b), "Goblin verwijderd");
  assert.equal(logMsg(c), "Ayla: …", "geneste onbekende sleutel telt ook");
  slimLog(S.log);
  assert.equal(a.msg, "Ayla: iets nieuws", "slimLog laat de terugvaltekst staan");
  const ex = exportLog(S.log);
  assert.equal(ex[0].msg, "Ayla: iets nieuws"); assert.equal(ex[0].why, "nieuwe oorzaak");
  assert.equal(ex[1].msg, "Goblin verwijderd");
});

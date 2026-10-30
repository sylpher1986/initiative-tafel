// WP70: kaart bekijken in Initiative (DM, alleen kijken). De ingeladen encounter (S.enc) neemt de kaartverwijzing mee;
// nooit de kaart zelf, nooit naar spelers; backup blijft v4.
import "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { addEnc, cleanEnc, encMaps, tidy } from "../js/rules/fight.js";
import { parseImport, buildExport, VERSION } from "../js/backup.js";
import { toPlayerView } from "../js/playerview.js";

const MAP = { id: "abcdef123", name: "Grot" };

test("addEnc neemt de kaartverwijzing mee (opgeschoond), zonder kaart geen veld", () => {
  const S = { list: [] };
  addEnc(S, { name: "Grot", notes: "", map: { ...MAP, extra: 1 } }, true);
  assert.deepEqual(S.enc[0], { name: "Grot", notes: "", map: MAP });
  addEnc(S, { name: "Brug", notes: "x" }, false);
  assert.equal("map" in S.enc[1], false);
  addEnc(S, { name: "Rare", notes: "", map: { id: "../x", name: "<b>" } }, false);
  assert.equal("map" in S.enc[2], false);
});

test("encMaps: volgorde van inladen, dezelfde kaart één keer, alleen met kaart", () => {
  const S = { enc: [{ name: "A", notes: "", map: MAP }, { name: "B", notes: "" }, { name: "C", notes: "", map: { id: "zzzzzz999", name: "Brug" } }, { name: "D", notes: "", map: MAP }] };
  assert.deepEqual(encMaps(S), [{ name: "A", map: MAP }, { name: "C", map: { id: "zzzzzz999", name: "Brug" } }]);
  assert.deepEqual(encMaps({}), []);
});

test("cleanEnc houdt een geldige verwijzing, laat rare weg", () => {
  assert.deepEqual(cleanEnc([{ name: "A", notes: "", map: MAP }, { name: "B", map: { id: 5 } }]), [{ name: "A", notes: "", map: MAP }, { name: "B", notes: "" }]);
});

test("backup: kaart bij de ingeladen encounter heen en terug, geen nieuwe versie", () => {
  const S = { list: [{ id: "m1", name: "Goblin", kind: "monster", ref: "Goblin", init: 10, cond: [] }], round: 0, active: null };
  addEnc(S, { name: "Grot", notes: "", map: MAP }, true);
  const exp = buildExport({ S, party: [], lairs: {}, custom: [], imported: [], encounters: [] });
  assert.equal(VERSION, 4);
  const back = parseImport(JSON.parse(JSON.stringify(exp)));
  assert.deepEqual(back.S.enc, [{ name: "Grot", notes: "", map: MAP }]);
});

test("spelersscherm: geen kaartverwijzing of encounter in het beeld", () => {
  const S = { list: [{ id: "m1", name: "Goblin", kind: "monster", ref: "Goblin", init: 10, cond: [], hp: 7, max: 7 }], round: 1, active: "m1" };
  addEnc(S, { name: "Grot", notes: "geheim", map: MAP }, true);
  const v = JSON.stringify(toPlayerView(S));
  assert.doesNotMatch(v, /abcdef123|Grot|geheim/);
});

test("tidy: zonder monsters verdwijnt de ingeladen encounter, en daarmee de kaart", () => {
  const S = { list: [], enc: [{ name: "Grot", notes: "", map: MAP }] };
  tidy(S);
  assert.equal(S.enc, undefined);
});

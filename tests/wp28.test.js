// WP28 (TA12): spelersscherm in de eigen taal. De snapshot bevat codes (hs, anon, tk, tdx) naast de oude Nederlandse
// velden; het spelersscherm vertaalt zelf. Scenario: DM op Nederlands maakt de snapshot, speler op Engels toont hem.
import { test } from "node:test";
import assert from "node:assert/strict";
import { initI18n } from "../js/i18n/boot.js";
import { toPlayerView, cleanView, headHtml, logLines, dsText, pvName, hsText, tagText, anonName, HS, STATUS } from "../js/playerview.js";

const lang = (l) => initI18n({ doc: { documentElement: { lang: l } }, search: "", storage: null });
const P = (o) => ({ kind: "pc", cond: [], dex: 0, ac: 15, hp: 20, max: 20, ...o });
const Mo = (o) => ({ kind: "monster", cond: [], dex: 0, ac: 13, hp: 10, max: 10, ref: "Goblin", ...o });
const wire = (V) => JSON.parse(JSON.stringify(V)); // zoals over de kamer
/** Snapshot maken met de DM op `dm`, daarna het spelersscherm op `pl` (cleanView + weergave) */
async function across(S, dm = "nl", pl = "en", vis) {
  await lang(dm);
  const raw = wire(toPlayerView(S, () => "", vis));
  await lang(pl);
  return { raw, V: cleanView(raw) };
}

const fight = () => {
  const L = [
    P({ id: "p", name: "Lotte", init: 18, hp: 4, cond: ["Restrained"], cd: { Restrained: { kind: "rounds", who: "p", at: "start", count: 3, save: { ab: "STR", dc: 13 } } } }),
    Mo({ id: "g1", name: "Goblin 1", init: 15, anon: 1, sur: true, hp: 4 }),
    Mo({ id: "g2", name: "Goblin 2", init: 12, anon: 2, reaction: true }),
    Mo({ id: "h", name: "Shadow Mage", init: 20, hidden: true, anon: 3 }),
  ];
  return { list: L, round: 1, active: "g1" };
};

test("snapshot: codes naast de oude Nederlandse velden, ook als de DM Engels heeft; v blijft 1 (oude lezers)", async () => {
  await lang("en");
  const V = wire(toPlayerView(fight()));
  assert.equal(V.v, 1, "een speler.js van vóór 1.51.0 weigert alles behalve v 1");
  const [p, g1, g2] = V.list;
  assert.deepEqual(p.hp, { hp: 4, max: 20, temp: 0, st: "Bijna dood", hs: "near" });
  assert.equal(g1.name, "Onbekend wezen 1", "oud veld blijft Nederlands (v1-lezers zijn Nederlandstalig)");
  assert.equal(g1.anon, 1);
  assert.deepEqual(g1.tags, ["Verrast"]); assert.deepEqual(g1.tk, ["sur"]);
  assert.deepEqual(g2.tags, ["Reaction op"]); assert.deepEqual(g2.tk, ["react"]);
  assert.deepEqual(p.tdx, [{ d: { k: "rules.dw.rounds", p: { n: 3 } }, s: { k: "rules.saveWords", p: { ab: "STR", dc: "13" } } }]);
  assert.equal(p.tk, undefined, "geen codes = geen veld");
  assert.equal(V.list.length, 3, "verborgen monster bestaat niet voor spelers");
});

test("DM Nederlands, speler Engels: kop, namen, status, tags, duur en death saves in het Engels", async () => {
  const { V } = await across(fight());
  assert.match(headHtml(V), /Round 1 · up now<\/span><b>Unknown creature 1<\/b>.*Up next<\/span>Unknown creature 2/);
  const [p, g1, g2] = V.list;
  assert.equal(hsText(p.hp.hs), "Near death");
  assert.equal(tagText(g1, 0), "Surprised");
  assert.equal(tagText(g2, 0), "Reaction used");
  assert.equal(tagText(p, 0), "Restrained", "D&D-term blijft");
  assert.match(headHtml({ ...V, round: 0, active: null, next: null }), /No combat yet<\/span><b>Waiting for the DM/);
  assert.match(headHtml({ ...V, round: 0, end: 3 }), /Combat over<\/span><b>After 3 rounds/);
  assert.equal(dsText({ s: 1, f: 2 }), "Death saves: 1 succeeded · 2 failed");
  const { tr } = await import("../js/i18n/boot.js");
  assert.equal(tr(p.tdx[0].d), "3 rounds left");
  assert.equal(tr(p.tdx[0].s), "STR DC 13 at the end of each of its turns");
  assert.equal(p.td[0].d, "nog 3 rondes", "oud veld: taal van de DM");
});

test("zelfde snapshot, speler Nederlands: alles zoals vóór WP28", async () => {
  const { V } = await across(fight(), "en", "nl");
  assert.match(headHtml(V), /Ronde 1 · aan de beurt<\/span><b>Onbekend wezen 1<\/b>.*Daarna<\/span>Onbekend wezen 2/);
  assert.equal(hsText(V.list[0].hp.hs), "Bijna dood");
  assert.equal(tagText(V.list[1], 0), "Verrast");
});

test("anon: zelfde nummering als het oude naamveld; één zichtbaar = zonder nummer; verborgen telt niet mee", async () => {
  const S = fight();
  await lang("nl");
  const V = toPlayerView(S);
  for (const r of V.list.filter((c) => c.anon != null)) assert.equal(r.name, r.anon ? `Onbekend wezen ${r.anon}` : "Onbekend wezen");
  S.list[1].anon = 0; // g1 onthuld: één onbekende over (de verborgen telt niet)
  delete S.list[1].anon;
  const W = toPlayerView(S);
  assert.equal(W.list.find((c) => c.id === "g2").anon, 0, "niet 2: dat verraadt een tweede (verborgen) onbekende");
  assert.ok(!JSON.stringify(W).includes("Shadow Mage") && !JSON.stringify(W).includes("Goblin 2"));
  await lang("en");
  assert.equal(pvName(cleanView(wire(W)).list.find((c) => c.id === "g2")), "Unknown creature");
  assert.equal(anonName(S.list[2], S.list), "Unknown creature", "DM-app: zelfde naam als de spelers zien");
});

test("tdx: naam van een verborgen of anonieme bron wordt 'een andere beurt'", async () => {
  const L = fight().list;
  L[0].cond.push("Frightened");
  L[0].cd.Frightened = { kind: "sstart", who: "h", at: "start", count: 1 };
  L[0].cond.push("Charmed");
  L[0].cd.Charmed = { kind: "sstart", who: "g2", at: "start", count: 1 };
  await lang("nl");
  const V = wire(toPlayerView({ list: L, round: 1, active: "p" }));
  assert.deepEqual(V.list[0].tdx.slice(1), [{ d: { k: "rules.dw.sstartX" } }, { d: { k: "rules.dw.sstartX" } }]);
  assert.ok(!JSON.stringify(V).includes("Shadow Mage"));
});

test("groep van onbekende wezens: groepsnaam in de taal van de speler", async () => {
  const L = [1, 2, 3].map((n) => Mo({ id: `g${n}`, name: `Goblin ${n}`, init: 12, anon: n, grp: "x" }));
  const { raw, V } = await across({ list: L, round: 1, active: "g1" });
  assert.equal(raw.gname, "Onbekend wezen ×3", "oud veld");
  assert.match(headHtml(V), /<b>Unknown creature ×3<\/b>/);
});

test("v1 van een oudere DM-app (zonder codes): woorden → codes via de vaste tabel", async () => {
  await lang("en");
  const V = cleanView({
    v: 1, round: 2, active: "a", next: "b",
    list: [
      { id: "a", kind: "monster", name: "Onbekend wezen 2", icon: "m-unknown", hp: { st: "Gewond" }, tags: ["Verrast", "Prone"], td: [null, { d: "nog 1 ronde" }] },
      { id: "b", kind: "pc", name: "Aria", icon: "r-pc", hp: { hp: 0, max: 20, temp: 0, st: "Stabiel" }, tags: ["Reaction op"] },
      { id: "c", kind: "monster", name: "Onbekend wezen", icon: "m-unknown", hp: { st: "Neer" }, out: true, tags: [] },
    ],
  });
  const [a, b, c] = V.list;
  assert.equal(a.anon, 2); assert.equal(c.anon, 0); assert.equal(b.anon, undefined);
  assert.deepEqual([a.hp.hs, b.hp.hs, c.hp.hs], ["hurt", "stable", "down"]);
  assert.deepEqual(a.tk, ["sur", null]); assert.deepEqual(b.tk, ["react"]);
  assert.match(headHtml(V), /Unknown creature 2<\/b>.*Up next<\/span>Aria/);
  assert.equal(a.td[1].d, "nog 1 ronde", "oude duurtekst blijft (geen tdx)");
  assert.deepEqual(HS.map((h, i) => [h, STATUS[i]]).length, 8);
});

test("cleanView: tdx alleen bekende sleutels met de verwachte waarden; tk alleen bekende codes", async () => {
  const row = (o) => cleanView({ v: 1, list: [{ id: "x", kind: "pc", name: "X", tags: ["Prone", "Bless"], ...o }] }).list[0];
  const r = row({
    tdx: [{ d: { k: "init.prep.title" }, s: { k: "rules.saveWords", p: { ab: "<b>", dc: 14, x: "weg" } } }, { d: { k: "rules.dw.rounds", p: { n: "veel" } } }],
    tk: ["constructor", "react"],
  });
  assert.deepEqual(r.tdx, [{ s: { k: "rules.saveWords", p: { ab: "<b>", dc: "14" } } }, null], "onbekende sleutel en rare n weg; extra waarde weg");
  assert.deepEqual(r.tk, [null, "react"]);
  assert.equal(row({ tdx: [{ d: { k: "rules.dw.tend" } }] }).tdx, undefined, "niet parallel: weg");
  assert.equal(row({ tk: ["sur"] }).tk, undefined, "niet parallel en ook niet af te leiden");
  assert.deepEqual(cleanView({ v: 2, list: [{ id: "m", kind: "monster", name: "", anon: 3 }] }).list[0].name, "", "v2 (WP32): naam leeg bij anon");
  assert.equal(cleanView({ v: 1, list: [{ id: "m", kind: "pc", name: "P", anon: 3 }] }).list[0].anon, undefined, "anon alleen bij monsters");
});

test("logLines op codes: speler Engels, DM Nederlands", async () => {
  const S0 = { list: [P({ id: "p", name: "Aria" }), Mo({ id: "g", name: "Goblin 1", anon: 1 }), Mo({ id: "o", name: "Ogre" })], round: 2, active: "p" };
  const S1 = { list: [P({ id: "p", name: "Aria", hp: 0, ds: { s: 0, f: 0 }, cond: ["Prone"] }), Mo({ id: "g", name: "Goblin 1", anon: 1, hp: 4 }), Mo({ id: "o", name: "Ogre", hp: 0 })], round: 2, active: "p" };
  const a = (await across(S0)).V, b = (await across(S1)).V;
  assert.deepEqual(logLines(a, b), ["Aria −20 HP · unconscious · Prone", "Unknown creature: Unhurt → Bloodied", "Ogre down"]);
  const S2 = { ...S1, list: [P({ id: "p", name: "Aria", hp: 0, ds: { s: 0, f: 0 } }), ...S1.list.slice(1)] };
  assert.deepEqual(logLines(b, (await across(S2)).V), ["Aria: Prone ended"]);
});

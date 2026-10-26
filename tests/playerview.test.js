import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { toPlayerView, cleanView, hpStatus, VIS, cleanVis, nextAnon, anonName, groupName, dedupeAnon, headHtml } from "../js/playerview.js";
import { cleanCombatant, parseImport } from "../js/backup.js";
import { diffLog } from "../js/log.js";

const pc = (o) => ({ kind: "pc", cond: [], dex: 0, ac: 15, hp: 20, max: 20, ...o });
const mon = (o) => ({ kind: "monster", cond: [], dex: 0, ac: 13, hp: 10, max: 10, ref: "Goblin", ...o });
const S = (list, extra = {}) => ({ list, round: 1, active: list[0]?.id ?? null, ...extra });

test("hpStatus: banden en 0 HP", () => {
  assert.equal(hpStatus(mon({ hp: 10 })), "Ongedeerd");
  assert.equal(hpStatus(mon({ hp: 6 })), "Gewond");
  assert.equal(hpStatus(mon({ hp: 5 })), "Bloodied");
  assert.equal(hpStatus(mon({ hp: 2 })), "Bijna dood");
  assert.equal(hpStatus(mon({ hp: 0 })), "Neer");
  assert.equal(hpStatus(pc({ hp: 0, ds: { s: 1, f: 0 } })), "Bewusteloos");
  assert.equal(hpStatus(pc({ hp: 0, ds: { stable: true } })), "Stabiel");
  assert.equal(hpStatus(pc({ hp: 0, ds: { dead: true } })), "Dood");
  assert.equal(hpStatus(mon({ max: 0 })), "");
});

test("geen DM-info in de snapshot: monster-HP alleen als status, geen AC, statblock of notities", () => {
  const V = toPlayerView(S([
    pc({ id: "a", name: "Thalia", init: 18, hp: 12, temp: 3, casting: { slots: [] }, sheet: { cls: "Wizard" } }),
    mon({ id: "b", name: "Goblin 1", init: 12, hp: 2, eff: [{ id: "e", n: "Shield", st: "ac", op: "+", v: 5, txt: "geheim" }] }),
  ]), () => "Small humanoid (goblinoid), neutral evil");
  const [a, b] = V.list;
  assert.deepEqual(a.hp, { hp: 12, max: 20, temp: 3, st: "Gewond", hs: "hurt" });
  assert.deepEqual(b.hp, { st: "Bijna dood", hs: "near" });
  assert.equal(b.icon, "m-humanoid");
  assert.deepEqual(b.tags, ["Shield"]);
  const j = JSON.stringify(V);
  for (const k of ['"ac"', '"ref"', '"sheet"', '"casting"', "geheim", '"eff"']) assert.ok(!j.includes(k), `lekt ${k}`);
  assert.equal(a.init, null, "initiativegetallen standaard uit");
});

test("verborgen monster: niet in de lijst, beurt en 'volgende' niet zichtbaar", () => {
  const list = [mon({ id: "h", name: "Lurker", init: 20, hidden: true }), pc({ id: "a", name: "A", init: 15 }), pc({ id: "b", name: "B", init: 10 })];
  let V = toPlayerView(S(list, { active: "h" }));
  assert.deepEqual(V.list.map((c) => c.id), ["a", "b"]);
  assert.equal(V.active, null);
  assert.equal(V.next, "a");
  V = toPlayerView(S(list, { active: "b" })); // na B komt (rondgaand) de verborgen Lurker: die overslaan
  assert.equal(V.next, "a");
});

test("volgende slaat wie neer is over; buiten gevecht geen beurt", () => {
  const list = [pc({ id: "a", name: "A", init: 15 }), mon({ id: "m", name: "M", init: 12, hp: 0 }), pc({ id: "b", name: "B", init: 5 })];
  assert.equal(toPlayerView(S(list, { active: "a" })).next, "b");
  const V = toPlayerView({ list, round: 0, active: null });
  assert.equal(V.active, null); assert.equal(V.next, null); assert.equal(V.round, 0);
  assert.equal(toPlayerView({ list: [], round: 0, active: null }).list.length, 0);
});

test("instellingen: exacte monster-HP, getallen, geen tags; lair alleen weg als verborgen", () => {
  const lair = { id: "l", kind: "lair", name: "Lair: X", key: "x", init: 20, dex: -99, cond: [] };
  const list = [mon({ id: "m", name: "M", init: 12, hp: 2, cond: ["Prone"] }), lair];
  const V = toPlayerView(S(list), () => "", { ...VIS, monHp: "exact", init: true, tags: "none" });
  assert.equal(V.list.length, 2);
  assert.equal(V.list[0].init, 20, "lair (20) eerst");
  assert.deepEqual(V.list[1].hp, { hp: 2, max: 10, temp: 0, st: "Bijna dood", hs: "near" });
  assert.equal(V.list[1].init, 12);
  assert.deepEqual(V.list[1].tags, []);
  const W = toPlayerView(S(list));
  assert.deepEqual(W.list[0], { id: "l", kind: "lair", name: "Lair", init: null }, "lairnaam verraadt de bron niet");
  const H = toPlayerView(S([list[0], { ...lair, hidden: true }], { active: "l" }));
  assert.equal(H.list.length, 1, "verborgen lair bestaat niet voor spelers");
  assert.equal(H.active, null, "ook zijn beurt niet");
  assert.equal(H.next, "m", "volgende = eerstvolgende zichtbare");
});

test("instellingen: monster-HP geen, condities alleen bij spelers; spelers-HP altijd exact", () => {
  const list = [pc({ id: "a", name: "A", init: 15, hp: 5, cond: ["Prone"] }), mon({ id: "m", name: "M", init: 12, hp: 0, cond: ["Prone"] })];
  const V = toPlayerView(S(list), () => "", { ...VIS, monHp: "none", tags: "pc" });
  assert.deepEqual(V.list[0].hp, { hp: 5, max: 20, temp: 0, st: "Bijna dood", hs: "near" });
  assert.deepEqual(V.list[0].tags, ["Prone"]);
  assert.equal(V.list[1].hp, null);
  assert.equal(V.list[1].out, true, "Neer blijft: spelers zagen hem vallen");
  assert.deepEqual(V.list[1].tags, []);
  const D = toPlayerView(S([pc({ id: "a", name: "A", hp: 0, ds: { s: 1, f: 0 } })]), () => "", { ...VIS, tags: "none" });
  assert.deepEqual(D.list[0].ds, { s: 1, f: 0 }, "death saves zijn spelersinfo, los van condities");
});

test("groep met een verborgen lid: alleen zichtbare leden aan de beurt, volgende voorbij de groep", () => {
  const b = (i, o = {}) => mon({ id: `b${i}`, name: `Bugbear ${i}`, init: 12, grp: "g", ...o });
  const L = [b(1), b(2, { hidden: true }), b(3), pc({ id: "p", name: "P", init: 5 })];
  const V = toPlayerView(S(L, { active: "b1" }));
  assert.deepEqual(V.group, ["b1", "b3"]);
  assert.equal(V.gname, "Bugbear ×2");
  assert.equal(V.next, "p");
  assert.ok(!V.list.some((c) => c.id === "b2"));
  const W = toPlayerView(S(L, { active: "b2" }));
  assert.equal(W.active, "b1", "verborgen lid aan de beurt: de groepsbeurt blijft staan (SC2b)");
  assert.deepEqual(W.group, ["b1", "b3"]);
  assert.equal(W.next, "p");
});

test("tags \"pc\": Verrast alleen bij spelers", () => {
  const L = [pc({ id: "a", name: "A", init: 15, sur: true }), mon({ id: "m", name: "M", init: 12, sur: true }), pc({ id: "z", name: "Z", init: 1 })];
  const V = toPlayerView(S(L, { active: "z" }), () => "", { ...VIS, tags: "pc" });
  assert.deepEqual(V.list.find((c) => c.id === "a").tags, ["Verrast"]);
  assert.deepEqual(V.list.find((c) => c.id === "m").tags, []);
});

test("cleanVis: per sleutel terug naar de standaard, oude sleutels vervallen", () => {
  assert.deepEqual(cleanVis(null), VIS);
  assert.deepEqual(cleanVis("rommel"), VIS);
  assert.deepEqual(cleanVis({ monHp: "exact", init: "ja", tags: true, lair: false, pcHp: "none" }), { ...VIS, monHp: "exact" });
  assert.deepEqual(cleanVis({ init: true, tags: "pc" }), { ...VIS, init: true, tags: "pc" });
});

test("death saves alleen zolang ze lopen; concentratie-spell alleen bij spelers", () => {
  const V = toPlayerView(S([
    pc({ id: "a", name: "A", init: 9, hp: 0, ds: { s: 1, f: 2 }, cond: ["Concentrating"], concSpell: "Bless" }),
    mon({ id: "m", name: "M", init: 8, cond: ["Concentrating"], concSpell: "Hold Person" }),
    pc({ id: "b", name: "B", init: 7, hp: 0, ds: { stable: true } }),
  ]));
  assert.deepEqual(V.list[0].ds, { s: 1, f: 2 });
  assert.deepEqual(V.list[1].tags, ["Concentrating"]);
  assert.equal(V.list[2].ds, undefined);
  assert.deepEqual(toPlayerView(S([pc({ id: "c", name: "C", init: 1, hp: 0 })])).list[0].ds, { s: 0, f: 0 }, "net op 0 HP, nog geen ds-object");
});

test("cleanView: rommel en scripts eruit, onbekende ids weg", () => {
  assert.equal(cleanView(null), null);
  assert.equal(cleanView({ v: 3, list: [] }), null); // v 2 = zonder oude velden (WP28/WP32)
  const V = cleanView({
    v: 1, round: "3", active: "x", next: "zz",
    list: [{ id: "x", kind: "pc", name: "<b>A</b>", icon: '"><script>', img: "javascript:alert(1)", hp: { hp: "5", max: 9, temp: null, st: "Gewond" }, tags: ["Prone", 7, null], ds: { s: 9, f: -1 } }, "rommel", { kind: "lair", name: "Lair" }],
  });
  const [a, l] = V.list;
  assert.equal(V.round, 3); assert.equal(V.active, "x"); assert.equal(V.next, null);
  assert.equal(a.icon, "r-pc"); assert.equal(a.img, null);
  assert.deepEqual(a.hp, { hp: 5, max: 9, temp: 0, st: "Gewond", hs: "hurt" }, "v1: woord → code");
  assert.deepEqual(a.tags, ["Prone"]);
  assert.deepEqual(a.ds, { s: 3, f: 0 });
  assert.equal(l.kind, "lair");
  assert.deepEqual(cleanView({ v: 1, list: [{ id: "q", hp: { st: "constructor", hs: "constructor" } }] }).list[0].hp, { st: "", hs: "" }, "alleen bekende statussen");
  // een echte snapshot komt er ongeschonden doorheen
  const real = toPlayerView(S([pc({ id: "a", name: "A", init: 5 }), mon({ id: "m", name: "M", init: 3 })]));
  assert.deepEqual(cleanView(JSON.parse(JSON.stringify(real))), real);
});

test("verborgen: blijft bij import (alleen monsters) en komt in het logboek", () => {
  assert.equal(cleanCombatant(mon({ id: "m", name: "M", hidden: true })).hidden, true);
  assert.equal(cleanCombatant(pc({ id: "p", name: "P", hidden: true })).hidden, undefined);
  assert.equal(cleanCombatant({ id: "l", kind: "lair", name: "Lair", hidden: true }).hidden, true, "lair verbergen overleeft export");
  assert.equal("hidden" in cleanCombatant({ id: "l", kind: "lair", name: "Lair" }), false);
  const a = { list: [mon({ id: "m", name: "M", init: 1 })], round: 0 };
  const b = { list: [mon({ id: "m", name: "M", init: 1, hidden: true })], round: 0 };
  assert.match(diffLog(a, b)[0].msg, /verborgen voor spelers/);
  assert.match(diffLog(b, a)[0].msg, /zichtbaar voor spelers/);
});

test("naam onbekend: geen echte naam of type-icoon in de snapshot, vast nummer", () => {
  const b = mon({ id: "b", name: "Beholder", init: 15, anon: 1 });
  const V = toPlayerView(S([b, pc({ id: "a", name: "A", init: 10 })]), () => "Large aberration, lawful evil");
  assert.equal(V.list[0].name, "Onbekend wezen");
  assert.equal(V.list[0].icon, "m-unknown");
  assert.ok(!JSON.stringify(V).includes("Beholder") && !JSON.stringify(V).includes("aberration"));
  assert.equal(cleanView(V).list[0].icon, "m-unknown", "icoon komt door cleanView");
  // meerdere: genummerd, ook als groep; onthullen laat de andere nummers staan
  const L = [mon({ id: "g1", name: "Goblin 1", init: 12, anon: 1, grp: "x" }), mon({ id: "g2", name: "Goblin 2", init: 12, anon: 2, grp: "x" }), mon({ id: "g3", name: "Goblin 3", init: 12, anon: 3, grp: "x" })];
  const W = toPlayerView(S(L));
  assert.deepEqual(W.list.map((c) => c.name), ["Onbekend wezen 1", "Onbekend wezen 2", "Onbekend wezen 3"]);
  assert.equal(W.gname, "Onbekend wezen ×3");
  assert.equal(groupName(W.list), "Onbekend wezen ×3");
  delete L[0].anon;
  assert.deepEqual(toPlayerView(S(L)).list.map((c) => c.name), ["Goblin 1", "Onbekend wezen 2", "Onbekend wezen 3"]);
  assert.equal(nextAnon(L), 1, "laagste vrije nummer");
  assert.equal(nextAnon([]), 1);
  assert.equal(anonName({ anon: 2 }, [{ kind: "monster", anon: 2 }]), "Onbekend wezen", "één over: zonder nummer");
  L[0].anon = 1; L[2].hidden = true; delete L[1].anon;
  assert.equal(toPlayerView(S(L)).list[0].name, "Onbekend wezen", "verborgen onbekende telt niet mee (verraadt niets)");
});

test("naam onbekend: alleen monsters, export houdt een geldig nummer", () => {
  assert.equal(toPlayerView(S([pc({ id: "a", name: "A", anon: 1 })])).list[0].name, "A");
  assert.equal(cleanCombatant(mon({ id: "m", name: "M", anon: 3 })).anon, 3);
  assert.equal(cleanCombatant(mon({ id: "m", name: "M", anon: "x" })).anon, undefined);
  assert.equal(cleanCombatant(mon({ id: "m", name: "M", anon: -1 })).anon, undefined);
  assert.equal(cleanCombatant(pc({ id: "p", name: "P", anon: 1 })).anon, undefined);
});

test("naam onbekend: dubbele nummers na import worden hernummerd, wisselen komt in het logboek", () => {
  assert.deepEqual(dedupeAnon([{ anon: 2 }, { anon: 2 }, { anon: 1 }, {}]).map((c) => c.anon), [2, 3, 1, undefined]);
  const I = parseImport({ format: "initiative-tafel", version: 1, state: { list: [mon({ id: "x", name: "X", anon: 1 }), mon({ id: "y", name: "Y", anon: 1 })] } });
  assert.deepEqual(I.S.list.map((c) => c.anon), [1, 2]);
  const a = { list: [mon({ id: "m", name: "M" })] }, b = { list: [mon({ id: "m", name: "M", anon: 1 })] };
  assert.match(diffLog(a, b)[0].msg, /naam onbekend voor spelers/);
  assert.match(diffLog(b, a)[0].msg, /naam bekend voor spelers/);
});

/* ---------- WP1: SC2 spelersscherm verraadt niets ---------- */
test("SC2a: zonder gevecht alleen spelers (ook geen lair); vanaf Start alles volgens VIS", () => {
  const L = [mon({ id: "m", name: "Bandit", init: 15 }), pc({ id: "a", name: "A", init: 12 }), { id: "l", kind: "lair", name: "Lair", init: 20, cond: [] }];
  const V = toPlayerView(S(L, { round: 0, active: null }));
  assert.deepEqual(V.list.map((c) => c.id), ["a"]);
  assert.equal(V.active, null); assert.equal(V.next, null); assert.equal(V.end, undefined);
  assert.doesNotMatch(JSON.stringify(V), /Bandit/, "naam komt nergens in de snapshot");
  const F = toPlayerView(S(L, { active: "l" }));
  assert.deepEqual(F.list.map((c) => c.id).sort(), ["a", "l", "m"]);
});

test("SC2a: na Gevecht afronden end = rondes, alleen spelers; cleanView laat end alleen zonder ronde door", () => {
  const L = [mon({ id: "m", name: "Draak", init: 15, hp: 0 }), pc({ id: "a", name: "A", init: 12 })];
  const V = toPlayerView(S(L, { round: 0, active: null, endSum: { r: 4 } }));
  assert.equal(V.end, 4); assert.deepEqual(V.list.map((c) => c.id), ["a"]);
  assert.equal(cleanView(V).end, 4);
  assert.equal(cleanView({ ...V, end: "x" }).end, 0);
  assert.equal(cleanView({ ...V, round: 2, end: 4 }).end, undefined);
  assert.equal(toPlayerView(S(L, { endSum: { r: 4 } })).end, undefined, "tijdens een gevecht geen end");
});

test("SC2b: verborgen monster aan de beurt → vorige zichtbare beurt blijft staan, Daarna klopt", () => {
  const L = [pc({ id: "a", name: "A", init: 20 }), mon({ id: "h", name: "Assassin", init: 15, hidden: true }), pc({ id: "b", name: "B", init: 10 })];
  const V = toPlayerView(S(L, { round: 2, active: "h" }));
  assert.equal(V.active, "a"); assert.equal(V.round, 2); assert.equal(V.next, "b");
  const plain = toPlayerView(S(L, { round: 2, active: "a" }));
  assert.deepEqual({ ...V }, { ...plain }, "niet te onderscheiden van een gewone beurt van A");
});

test("SC2b: verborgen monster opent de ronde → laatste zichtbare van de vorige ronde, met die ronde", () => {
  const L = [mon({ id: "h", name: "X", init: 20, hidden: true }), pc({ id: "a", name: "A", init: 15 }), mon({ id: "g", name: "G", init: 10, hp: 0 }), pc({ id: "b", name: "B", init: 5 })];
  const V = toPlayerView(S(L, { round: 3, active: "h" }));
  assert.equal(V.active, "b", "g is neer: had geen beurt"); assert.equal(V.round, 2); assert.equal(V.next, "a");
});

test("SC2b: verborgen monster begint ronde 1 → geen beurt, kop Gevecht begint; verrast in ronde 1 telt niet", () => {
  const L = [mon({ id: "h", name: "X", init: 20, hidden: true }), pc({ id: "a", name: "A", init: 15 })];
  const V = toPlayerView(S(L, { round: 1, active: "h" }));
  assert.equal(V.active, null); assert.equal(V.round, 1); assert.equal(V.next, "a");
  assert.match(headHtml(V), /Ronde 1<\/span><b>Gevecht begint/);
  assert.match(headHtml(V), /Daarna<\/span>A/);
  const L2 = [pc({ id: "s", name: "S", init: 25, sur: 2 }), mon({ id: "h", name: "X", init: 20, hidden: true }), pc({ id: "a", name: "A", init: 15 })];
  assert.equal(toPlayerView(S(L2, { round: 1, active: "h" })).active, null, "verraste speler had in ronde 1 geen beurt");
});

test("headHtml: aan de beurt, groep, geen gevecht, gevecht voorbij; namen geëscaped", () => {
  const V = (o) => ({ round: 0, active: null, next: null, list: [{ id: "a", name: "<A>" }, { id: "b", name: "B" }], ...o });
  assert.match(headHtml(V({ round: 2, active: "a", next: "b" })), /Ronde 2 · aan de beurt<\/span><b>&lt;A&gt;<\/b>.*Daarna<\/span>B/);
  assert.match(headHtml(V({ round: 2, active: "a", gname: "Bugbear ×2" })), /<b>Bugbear ×2<\/b>/);
  assert.match(headHtml(V()), /Nog geen gevecht<\/span><b>Wacht op de DM/);
  assert.match(headHtml(V({ end: 4 })), /Gevecht voorbij<\/span><b>Na 4 rondes/);
  assert.match(headHtml(V({ end: 1 })), /Na 1 ronde</);
  assert.doesNotMatch(headHtml(V()), /Rol initiative/);
});

/* review WP1: de hint (vorige zichtbare beurt) zoals main.js hem bijhoudt */
import { startCombat, step } from "../js/rules/turns.js";
const live = (S) => { let prev = null; return () => { if (!S.round) prev = null; const V = toPlayerView(S, () => "", VIS, prev); if (V.active && V.active === S.active) prev = { id: V.active, round: V.round }; return V; }; };
const rng0 = () => 0.5;

test("review: verraste speler in ronde 1 + verborgen monster opent ronde 2 → niet de verraste als aan de beurt", () => {
  const L = [mon({ id: "H", name: "H", init: 20, hidden: true }), mon({ id: "M", name: "M", init: 15 }), pc({ id: "A", name: "A", init: 5, sur: true })];
  const S = { list: L, round: 0, active: null, saves: [] }, view = live(S);
  startCombat(S, rng0); let V = view();
  assert.equal(V.active, null); assert.equal(V.round, 1);
  step(S, 1, rng0); V = view(); assert.equal(V.active, "M");
  step(S, 1, rng0); V = view();
  assert.equal(S.active, "H"); assert.equal(S.round, 2);
  assert.equal(V.active, "M", "A was verrast en had geen beurt"); assert.equal(V.round, 1);
  assert.equal(V.next, "M");
});

test("review: zichtbaar monster sterft in zijn eigen beurt → die beurt blijft staan, niet terug naar de speler", () => {
  const L = [pc({ id: "P", name: "P", init: 20 }), mon({ id: "M", name: "M", init: 15 }), mon({ id: "H", name: "H", init: 10, hidden: true })];
  const S = { list: L, round: 0, active: null, saves: [] }, view = live(S);
  startCombat(S, rng0); view();
  step(S, 1, rng0); assert.equal(view().active, "M");
  L[1].hp = 0; view(); // opportunity attack
  step(S, 1, rng0); const V = view();
  assert.equal(S.active, "H");
  assert.equal(V.active, "M"); assert.equal(V.next, "P");
  assert.notEqual(V.active, V.next);
});

test("review: hint die niet meer klopt (na ‹ Vorige, verwijderd, verborgen) valt terug op terugrekenen; nooit active = next", () => {
  const L = [pc({ id: "A", name: "A", init: 20 }), mon({ id: "H", name: "H", init: 15, hidden: true }), pc({ id: "B", name: "B", init: 10 })];
  const V = toPlayerView(S(L, { round: 2, active: "H" }), () => "", VIS, { id: "B", round: 2 }); // B ligt ná H: ‹ Vorige
  assert.equal(V.active, "A");
  assert.equal(toPlayerView(S(L, { round: 2, active: "H" }), () => "", VIS, { id: "weg", round: 2 }).active, "A");
  assert.equal(toPlayerView(S(L, { round: 3, active: "H" }), () => "", VIS, { id: "A", round: 1 }).active, "A", "oude hint: terugrekenen");
  // alleen verborgen + één speler die neer is en niet meer aan de beurt komt: terugrekenen zou de volgende geven
  const L2 = [pc({ id: "A", name: "A", init: 20, ds: { dead: true }, hp: 0 }), mon({ id: "H", name: "H", init: 15, hidden: true }), pc({ id: "B", name: "B", init: 10 })];
  const W = toPlayerView(S(L2, { round: 2, active: "H" }));
  assert.ok(!W.active || W.active !== W.next);
});

test("headHtml: geen zichtbare beurt na ronde 1 → 'Ronde N', niet 'Gevecht begint'", () => {
  const h = headHtml({ round: 3, active: null, next: "b", list: [{ id: "b", name: "B" }] });
  assert.match(h, /<b>Ronde 3<\/b>/); assert.doesNotMatch(h, /Gevecht begint/); assert.match(h, /Daarna/);
});

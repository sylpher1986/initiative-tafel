// WP75: tokens gekoppeld aan deelnemers. De kaart bewaart alleen de koppeling (p, Inn Sight-schema 8); beurt, neer/dood,
// verborgen en "naam onbekend" komen uit Initiative en worden alleen bij het tekenen over het token gelegd. Het
// spelersbeeld volgt de snapshot van het spelersscherm (zelfde regels).
import "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linkOf, keysOf, keysById, whoOf, sizeOf, tokLabels, toPlace, missingCount, orphan, downOf, turnIds, decoDm, decoPv, decoSig, SIDE_COLOR } from "../js/rules/maptoks.js";
import { toPlayerView } from "../js/playerview.js";
import { sortOrder } from "../js/rules/turns.js";
import { LINK_RE, cleanTok, cleanToks, dupTok, hasLinks, linked, TOK_COLOR_IDS } from "../js/maps/model/tokens.js";
import { cleanMap, newMap, SCHEMA } from "../js/maps/model/map.js";

const pc = (o) => ({ kind: "pc", cond: [], dex: 0, ac: 15, hp: 20, max: 20, ...o });
const mon = (o) => ({ kind: "monster", cond: [], dex: 0, ac: 12, hp: 7, max: 7, ...o });
const tok = (o) => ({ id: "t" + Math.random().toString(36).slice(2, 9), x: 0.5, y: 0.5, s: 1, c: "red", l: "X", ...o });
const SQ = { type: "square", cols: 10, rows: 8 };

test("koppelsleutel: speler met party-id = p:, anders c:; lair en rare id's krijgen geen token; zelfde patroon als Inn Sight", () => {
  assert.equal(linkOf(pc({ id: "a1", pid: "pq7" })), "p:pq7");
  assert.equal(linkOf(pc({ id: "a1" })), "c:a1");
  assert.equal(linkOf(mon({ id: "m1", pid: "zz" })), "c:m1", "monsters nooit via party-id");
  assert.equal(linkOf({ id: "l", kind: "lair" }), null);
  assert.equal(linkOf(mon({ id: "a b" })), null);
  const src = readFileSync(new URL("../js/rules/maptoks.js", import.meta.url), "utf8");
  assert.ok(src.includes(`const LINK_RE = ${LINK_RE.toString()};`), "LINK_RE gelijk aan js/maps/model/tokens.js");
  const S = { list: [pc({ id: "a1", pid: "pq7", name: "A" })] };
  assert.equal(whoOf(S, "p:pq7").id, "a1");
  assert.equal(whoOf(S, "c:a1").id, "a1", "review: token van vóór Naar party (c:<id>) blijft gekoppeld");
  assert.deepEqual(keysOf(pc({ id: "a1", pid: "pq7" })), ["p:pq7", "c:a1"]);
  assert.deepEqual(keysOf(mon({ id: "m1" })), ["c:m1"]);
  for (const k of Object.values(SIDE_COLOR)) assert.ok(TOK_COLOR_IDS.includes(k), k);
});

test("grootte uit het statblock; onbekend = Medium", () => {
  assert.equal(sizeOf("Large giant, chaotic evil"), 2);
  assert.equal(sizeOf("Tiny beast"), 0.5);
  assert.equal(sizeOf("Gargantuan dragon"), 4);
  assert.equal(sizeOf("Huge"), 3);
  assert.equal(sizeOf("Small humanoid"), 1);
  assert.equal(sizeOf(""), 1);
  assert.equal(sizeOf(undefined), 1);
});

test("labels (UX): speler 2 letters → 3 → letter+cijfer; monster letter+nummer, gedeelde beginletter 2 letters+nummer; nooit dubbel, max 3", () => {
  const L = tokLabels([pc({ name: "Thorin" }), pc({ name: "Thalia" }), pc({ name: "Thal" }), mon({ name: "Goblin 1", ref: "Goblin" }), mon({ name: "Goblin 2", ref: "Goblin" }),
    mon({ name: "Ghoul", ref: "Ghoul" }), mon({ name: "Ogre", ref: "Ogre" }), mon({ name: "Ogre", ref: "Ogre" }), mon({ name: "Wolf 12", ref: "Wolf" }), mon({ name: "!!" })]);
  assert.deepEqual(L, ["Th", "Tha", "T1", "Go1", "Go2", "Gh1", "O1", "O2", "W12", "?1"]);
  for (const l of L) assert.ok([...l].length <= 3, l);
  assert.equal(new Set(L).size, L.length);
  assert.deepEqual(tokLabels([mon({ name: "Goblin 1", ref: "Goblin" })], new Set(["G1"])), ["Go1"], "al op de kaart = volgende vorm");
  assert.deepEqual(tokLabels([pc({ name: "Ærwyn" })]), ["Ær"]);
});

test("plaatsen: wie nog geen token heeft, spelers eerst (initiative-volgorde), kleur per kant, grootte uit het statblock; lair nooit", () => {
  const S = { list: [mon({ id: "m1", name: "Ogre", ref: "Ogre", init: 20 }), pc({ id: "a1", pid: "p1", name: "Aria", init: 5 }), pc({ id: "b1", name: "Bo", init: 15 }), { id: "l", kind: "lair", name: "Lair", init: 20 }] };
  const meta = (c) => (c.ref === "Ogre" ? "Large giant" : "");
  const E = toPlace(sortOrder(S.list), [], meta);
  assert.deepEqual(E.map((e) => [e.p, e.l, e.c, e.s, e.pc]), [["c:b1", "Bo", "blue", 1, true], ["p:p1", "Ar", "blue", 1, true], ["c:m1", "O1", "red", 2, false]]);
  const have = [tok({ p: "p:p1", l: "Ar" }), tok({ l: "Bo" })];
  const E2 = toPlace(sortOrder(S.list), have, meta);
  assert.deepEqual(E2.map((e) => e.p), ["c:b1", "c:m1"], "al gekoppeld = overslaan");
  assert.notEqual(E2[0].l, "Bo");
  assert.deepEqual(toPlace([], []), []);
  assert.equal(missingCount(sortOrder(S.list), have), 2);
  assert.equal(missingCount(sortOrder(S.list), [tok({ p: "c:a1" })]), 2, "speler via c:<id> telt als geplaatst");
});

test("wees-token en neer: koppeling zonder deelnemer; monster 0 HP, speler dood of op 0 HP = kruis", () => {
  const S = { list: [pc({ id: "a1", pid: "p1", name: "A" })] };
  assert.equal(orphan(S, tok({ p: "c:m9" })), true);
  assert.equal(orphan(S, tok({ p: "p:p1" })), false);
  assert.equal(orphan(S, tok({})), false, "vrij token is nooit wees");
  assert.equal(downOf(mon({ hp: 0 })), true);
  assert.equal(downOf(pc({ hp: 0 })), true);
  assert.equal(downOf(pc({ hp: 0, max: 0 })), false, "HP onbekend");
  assert.equal(downOf(pc({ hp: 5, ds: { dead: true } })), true);
  assert.equal(downOf(mon({ hp: 3 })), false);
});

test("DM-beeld: beurt-ring (ook groepsbeurt), kruis, verborgen deelnemer en wees-token = verborgen voor spelers; vrij token ongewijzigd", () => {
  const S = { round: 2, active: "g1", list: [
    mon({ id: "g1", name: "Goblin 1", grp: "x", init: 12 }), mon({ id: "g2", name: "Goblin 2", grp: "x", init: 12 }),
    mon({ id: "h", name: "Hidden", hidden: true, init: 3 }), pc({ id: "a", pid: "p1", name: "A", hp: 0, init: 8 })] };
  const free = tok({ l: "F" });
  const L = [free, tok({ p: "c:g1" }), tok({ p: "c:g2" }), tok({ p: "c:h" }), tok({ p: "p:p1" }), tok({ p: "c:gone" })];
  assert.deepEqual([...turnIds(S)].sort(), ["g1", "g2"]);
  const D = decoDm(S, L, turnIds(S));
  assert.equal(D[0], free);
  assert.equal(D[1].tn, 1); assert.equal(D[2].tn, 1);
  assert.equal(D[3].hide, true);
  assert.equal(D[4].dn, 1); assert.equal(D[4].tn, undefined);
  assert.equal(D[5].hide, true, "deelnemer weg = spelers zien hem niet");
  assert.equal(L[1].tn, undefined, "nooit de tokens van de kaart zelf aanpassen");
  assert.equal(decoDm(S, [free]).length, 1);
  assert.equal(turnIds({ round: 0, active: "g1", list: S.list }).size, 0, "buiten het gevecht geen ring");
  const P0 = decoDm({ ...S, round: 0 }, L, new Set());
  assert.equal(P0[1].hide, true, "review: vóór Start zien spelers geen monsters, dus de DM ziet ze als verborgen");
  assert.equal(P0[4].hide, undefined, "spelers wel");
});

test("spelersbeeld volgt de snapshot: verborgen bestaat niet, monsters pas na Start, naam onbekend = ?, beurt = laatste zichtbare", () => {
  const S = { round: 1, active: "a", list: [
    pc({ id: "a", pid: "p1", name: "Aria", init: 20 }), mon({ id: "g1", name: "Goblin 1", init: 15, anon: 1 }), mon({ id: "g2", name: "Goblin 2", init: 14, anon: 2 }),
    mon({ id: "h", name: "Assassin", hidden: true, init: 10 }), mon({ id: "d", name: "Rat", hp: 0, init: 5 })] };
  const link = keysById(S.list);
  const L = [tok({ p: "p:p1", l: "Ar" }), tok({ p: "c:g1", l: "Go1" }), tok({ p: "c:g2", l: "Go2" }), tok({ p: "c:h", l: "As1" }), tok({ p: "c:d", l: "R1" }), tok({ l: "F" }), tok({ p: "c:x", l: "Z1" }), tok({ p: "c:g1", l: "Go1", hide: true })];
  const V = toPlayerView(S);
  const P = decoPv(V, L, link);
  const by = (l) => P.find((t) => t.p && L.find((x) => x.id === t.id).l === l);
  assert.equal(by("Ar").tn, 1, "beurt");
  assert.equal(by("Go1").l, "?1", "naam onbekend: nooit de echte afkorting");
  assert.equal(by("Go2").l, "?2");
  assert.equal(by("As1"), undefined, "verborgen deelnemer bestaat niet");
  assert.equal(by("Z1"), undefined, "wees-token niet bij spelers");
  assert.equal(by("R1").dn, 1);
  assert.ok(P.some((t) => t.l === "F" && !t.p), "vrij token blijft (drawBase filtert hide en fog)");
  assert.equal(P.filter((t) => t.p === "c:g1").length, 1, "door de DM verborgen gekoppeld token: weg");
  assert.ok(!JSON.stringify(P).includes("Go1"));
  // verborgen beurt: de laatste zichtbare beurt houdt de ring (zoals het spelersscherm)
  const S2 = { ...S, active: "h" };
  const V2 = toPlayerView(S2, () => "", undefined, { id: "g2", round: 1 });
  const P2 = decoPv(V2, L, link);
  assert.equal(P2.find((t) => t.p === "c:g2").tn, 1);
  assert.ok(!P2.some((t) => t.p === "c:h"));
  // vóór Start: alleen spelers
  const P0 = decoPv(toPlayerView({ ...S, round: 0, active: null }), L, link);
  assert.deepEqual(P0.filter((t) => t.p).map((t) => t.p), ["p:p1"]);
  assert.equal(P0[0].tn, undefined);
  // vingerafdruk verandert met de beurt, niet zonder
  assert.notEqual(decoSig(P), decoSig(P2));
  assert.equal(decoSig(decoPv(toPlayerView(S), L, link)), decoSig(P));
  assert.equal(decoPv(V, [tok({ l: "F" })], link).length, 1);
  assert.equal(decoPv(null, [tok({ p: "p:p1" })], link).length, 0, "geen snapshot = niets gekoppelds tonen");
  assert.equal(decoPv(V, [tok({ p: "c:a", l: "Ar" })], link).length, 1, "speler via c:<id> ook bij spelers");
});

test("Inn Sight: koppeling bewaard (schema 8), onzin weg, kopie is vrij; Inn Sight 1.6 laat zo'n kaart met rust", () => {
  assert.equal(SCHEMA, 8);
  assert.equal(cleanTok(tok({ p: "p:pq7" })).p, "p:pq7");
  for (const bad of ["x:1", "p:", "p:a b", 5, "c:" + "a".repeat(41)]) assert.equal("p" in cleanTok(tok({ p: bad })), false, String(bad));
  assert.equal(linked(cleanTok(tok({ p: "c:m1" }))), true);
  const T = cleanToks({ at: 5, list: [tok({ id: "t1", p: "c:m1", l: "G1" }), tok({ id: "t2" })] });
  assert.equal(hasLinks(T), true);
  const m = newMap({ id: "abcdef1", name: "Grot", grid: SQ, now: 1 });
  assert.equal(cleanMap({ ...m, toks: T }).schema, 8);
  assert.equal(cleanMap({ ...m, toks: cleanToks({ at: 5, list: [tok({ id: "t2" })] }) }).schema, 7);
  assert.equal(cleanMap({ ...m, toks: T }).toks.list[0].p, "c:m1");
  const d = dupTok(SQ, T.list, "t1", true);
  assert.equal("p" in d.list.at(-1), false, "kopie = vrij token (één token per deelnemer)");
});

test("grens: maptoks importeert niets uit js/maps; viewer/brug gebruiken het alleen via encmap en mapview", () => {
  const src = readFileSync(new URL("../js/rules/maptoks.js", import.meta.url), "utf8");
  assert.ok(!/from\s+["'][^"']*maps\//.test(src));
  assert.ok(!/document|window/.test(src.replace(/\/\/.*$/gm, "")), "puur");
});

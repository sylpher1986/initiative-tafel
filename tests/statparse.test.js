import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseStatText, withParsed, foundText, classic } from "../js/data/statparse.js";
import { monsterActions } from "../js/rules/attacks.js";

const SRD = JSON.parse(readFileSync(new URL("../data/monsters.json", import.meta.url)));
const mod = (v) => { const m = Math.floor((v - 10) / 2); return `(${m >= 0 ? "+" : "−"}${Math.abs(m)})`; };

/** SRD-monster als plaktekst in het klassieke formaat (zoals een statblock op een website) */
function asText(m) {
  const L = [m.n, m.meta, `Armor Class ${m.ac}`, `Hit Points ${m.hp}${m.hd ? ` (${m.hd})` : ""}`, `Speed ${m.spd}`,
    "STR DEX CON INT WIS CHA", m.ab.map((v) => `${v} ${mod(v)}`).join(" "),
    ...m.x.map(([k, v]) => `${k} ${v}`), `Challenge ${m.cr}`];
  const ent = (a) => a.map(([k, v]) => `${k.replace(/\.$/, "")}. ${v}`);
  L.push(...ent(m.t));
  if (m.a.length) L.push("Actions", ...ent(m.a));
  if (m.ba.length) L.push("Bonus Actions", ...ent(m.ba));
  if (m.re.length) L.push("Reactions", ...ent(m.re));
  if (m.l.length) L.push("Legendary Actions", ...(m.ld ? [m.ld] : []), ...ent(m.l));
  return L.join("\n");
}

test("RE14: alle SRD-monsters als plaktekst komen terug met dezelfde structuur", () => {
  const bad = [];
  const NESTED = ["Vampire", "Vampire Spawn"]; // "Vampire Weaknesses" met sub-entries: worden losse traits (prima)
  for (const m of SRD) {
    const p = parseStatText(asText(m));
    const ws = (v) => JSON.stringify(v).replace(/(?:\\n|\s)+/g, " "); // regelafbrekingen in de SRD-tekst tellen niet
    const same = (a, b) => ws(a) === ws(b);
    const nd = (a) => a.map(([k, v]) => [k.replace(/\.$/, ""), v]); // "Bite (Rat or Hybrid Form Only)." in de data
    const want = { a: nd(m.a), ba: nd(m.ba), re: nd(m.re), l: nd(m.l), t: nd(m.t), ab: m.ab, ld: m.ld || "" };
    if (NESTED.includes(m.n)) delete want.t;
    for (const k of Object.keys(want)) if (!same(p[k], want[k])) { bad.push(`${m.n}: ${k}`); break; }
    if (p.n !== m.n || p.cr !== m.cr || String(p.hp) !== String(m.hp)) bad.push(`${m.n}: kop`);
  }
  assert.deepEqual(bad, []);
});

test("RE14: geplakt zonder koppen (placeholder): Multiattack en aanvallen worden acties", () => {
  const p = parseStatText("Pack Tactics. The wolf has advantage on an attack roll against a creature if an ally is within 5 ft.\nMultiattack. The thing makes two bite attacks.\nBite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing damage.");
  assert.deepEqual(p.t.map((e) => e[0]), ["Pack Tactics"]);
  assert.deepEqual(p.a.map((e) => e[0]), ["Multiattack", "Bite"]);
  const A = monsterActions({ a: p.a });
  assert.equal(A.main[0].hit, 4);
  assert.equal(A.main[0].dmg[0].e, "2d4+2");
});

test("RE14: D&D Beyond-kopie (scores per regel, pdf-afbreking, onbekende sectie)", () => {
  const p = parseStatText(`Orc War Chief
Medium humanoid (orc), chaotic evil
Armor Class 16 (chain mail)
Hit Points 93 (11d8 + 44)
STR
18 (+4)
DEX
12 (+1)
CON
18 (+4)
INT
11 (+0)
WIS
11 (+0)
CHA
16 (+3)
Damage Resistances bludgeoning, piercing, and slashing from nonmagical attacks
Condition Immunities frightened
Challenge 4 (1,100 XP)
ACTIONS
Greataxe. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 15
(1d12 + 4 + 1d8) slashing damage.
REACTIONS
Parry. The chief adds 2 to its AC against one melee attack that would hit it.
Lair Actions
On initiative count 20, the floor shakes.`);
  assert.deepEqual(p.ab, [18, 12, 18, 11, 11, 16]);
  assert.equal(p.hd, "11d8+44");
  assert.equal(p.cr, "4");
  assert.deepEqual(p.x.map((e) => e[0]), ["Damage Resistances", "Condition Immunities"]);
  assert.match(p.a[0][1], /Hit: 15 \(1d12/);
  assert.equal(p.re[0][0], "Parry");
  assert.match(p.rest, /floor shakes/);
  assert.equal(foundText(p), "AC 16 · 93 HP (11d8+44) · CR 4 · Dex 12 · 1 actie · 1 reaction · resist bludgeoning, piercing, and slashing fro…");
});

test("RE14: 2024-schrijfwijze wordt klassiek", () => {
  assert.equal(classic("Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Slashing damage."), "Melee Attack: +5 to hit, reach 5 ft. Hit: 6 (1d6 + 3) Slashing damage.");
  assert.equal(classic("Dexterity Saving Throw: DC 13, each creature in a 15-foot cone."), "DC 13 Dexterity saving throw, each creature in a 15-foot cone.");
  const A = monsterActions({ a: parseStatText("Actions\nRend. Melee Attack Roll: +7, reach 5 ft. Hit: 9 (1d10 + 4) Slashing damage.").a });
  assert.equal(A.main[0].hit, 7);
  assert.equal(A.main[0].dmg[0].type, "slashing");
});

test("RE14: withParsed laat formulier-velden en bestaande structuur staan, tekst = rest", () => {
  const m = { n: "Mijn Ork", ac: "15", hp: 20, dexScore: 12, custom: true, text: "Mijn Ork\nVrije notitie zonder punt\nBite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage." };
  const r = withParsed(m);
  assert.equal(r.ac, "15");
  assert.equal(r.a.length, 1);
  assert.deepEqual(r.t, [["Overig", "Vrije notitie zonder punt"]]);
  assert.equal(r.text, "");
  assert.equal(withParsed(m), r, "cache per object");
  const plain = { n: "X", text: "alleen wat losse woorden" };
  assert.equal(withParsed(plain), plain);
  const imp = { n: "Y", a: [["Bite", "x"]], text: "Claw. Melee Weapon Attack: +1 to hit" };
  assert.equal(withParsed(imp), imp);
});

test("RE14: een gewone zin is geen entry", () => {
  const p = parseStatText("Goblin\nThe goblin makes two attacks. It hides afterwards.\nNimble Escape. The goblin can take the Disengage action.");
  assert.deepEqual(p.t.map((e) => e[0]), ["Nimble Escape"]);
  assert.match(p.rest, /makes two attacks/);
});

test("RE14: spellcasting na plakken: castInfo gelijk aan het SRD-origineel (spell-lijsten blijven eigen regels)", async () => {
  const { castInfo } = await import("../js/rules/spells.js");
  const bad = [];
  for (const m of SRD) {
    const orig = castInfo(m);
    if (!orig) continue;
    const p = withParsed({ n: m.n, ac: m.ac, hp: m.hp, custom: true, text: asText(m) });
    if (JSON.stringify(castInfo(p)) !== JSON.stringify(orig)) bad.push(m.n);
  }
  assert.deepEqual(bad, []);
});

test("RE14: kopregel-achtige traits, 2024-scores en Immunities met puntkomma", () => {
  const p = parseStatText(`Thing
Armor Class 12 (natural armor)
Speed 30 ft.
Str 13 +1 +1 Dex 6 -2 -2 Con 16 +3 +3
Int 3 -4 -4 Wis 6 -2 -2 Cha 5 -3 -3
Immunities Poison; Exhaustion, Poisoned
Speed Burst. The thing doubles its speed.
Actions
Slam. Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Bludgeoning damage.
Skills Mastery. Een trait na een actie.`);
  assert.equal(p.spd, "30 ft.");
  assert.deepEqual(p.ab, [13, 6, 16, 3, 6, 5]);
  assert.deepEqual(p.x, [["Damage Immunities", "poison"], ["Condition Immunities", "exhaustion, poisoned"]]);
  assert.deepEqual(p.t.map((e) => e[0]), ["Speed Burst"]);
  assert.deepEqual(p.a.map((e) => e[0]), ["Slam", "Skills Mastery"]);
});

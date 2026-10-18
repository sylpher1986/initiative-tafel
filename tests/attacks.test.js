import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAction, monsterActions, dmgKey, rollDmg, useful } from "../js/rules/attacks.js";
import { rollExpr } from "../js/rules/dice.js";

const SRD = JSON.parse(readFileSync(new URL("../data/monsters.json", import.meta.url)));
const mon = (n) => SRD.find((m) => m.n === n);

test("aanval: to hit, reach en damage met 'plus'", () => {
  const a = parseAction("Bite", "Melee Weapon Attack: +11 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage plus 4 (1d8) acid damage.");
  assert.equal(a.hit, 11);
  assert.equal(a.reach, "reach 10 ft.");
  assert.deepEqual(a.dmg, [{ e: "2d10+6", type: "piercing" }, { e: "1d8", type: "acid" }]);
  assert.equal(a.dc, null);
});

test("versatile/op afstand: alleen de eerste worp", () => {
  const a = parseAction("Javelin", "Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 9 (2d6 + 2) piercing damage in melee or 5 (1d6 + 2) piercing damage at range.");
  assert.deepEqual(a.dmg, [{ e: "2d6+2", type: "piercing" }]);
  assert.equal(a.reach, "reach 5 ft.");
});

test("save-actie: DC en damage zonder to hit; recharge uit de naam", () => {
  const a = parseAction("Acid Breath (Recharge 5–6)", "The dragon exhales acid in a 60-foot line that is 5 feet wide. Each creature in that line must make a DC 18 Dexterity saving throw, taking 54 (12d8) acid damage on a failed save, or half as much damage on a successful one.");
  assert.equal(a.n, "Acid Breath");
  assert.equal(a.hit, null);
  assert.deepEqual(a.dc, { n: 18, ab: "DEX" });
  assert.deepEqual(a.dmg, [{ e: "12d8", type: "acid" }]);
});

test("aanval met save erbij, vaste schade, negatieve modifier en minteken", () => {
  assert.deepEqual(parseAction("Paralyzing Touch", "Melee Spell Attack: +12 to hit, reach 5 ft. Hit: 10 (3d6) cold damage. The target must succeed on a DC 18 Constitution saving throw or be paralyzed.").dc, { n: 18, ab: "CON" });
  const bat = parseAction("Bite", "Melee Weapon Attack: +0 to hit, reach 5 ft., one creature. Hit: 1 piercing damage.");
  assert.equal(bat.hit, 0);
  assert.deepEqual(bat.dmg, [{ flat: 1, type: "piercing" }]);
  assert.deepEqual(parseAction("Club", "Melee Weapon Attack: -1 to hit, reach 5 ft. Hit: 1 (1d4 − 1) bludgeoning damage.").dmg, [{ e: "1d4-1", type: "bludgeoning" }]);
});

test("rare of lege invoer geeft geen fout", () => {
  for (const [n, t] of [[undefined, undefined], ["", ""], ["X", "<b>+4 to hit</b> (2d6) fire damage"], [5, {}]]) {
    const a = parseAction(n, t);
    assert.equal(typeof a.n, "string");
    assert.ok(Array.isArray(a.dmg));
  }
  assert.equal(useful(parseAction("Detect", "The dragon makes a Wisdom (Perception) check.")), false);
});

test("monsterActions: Multiattack apart, acties met worp in main, reactions/legendary in other", () => {
  const r = monsterActions(mon("Adult Black Dragon"));
  assert.match(r.multi.text, /three attacks/);
  assert.deepEqual(r.main.map((a) => a.n), ["Bite", "Claw", "Tail", "Frightful Presence", "Acid Breath"]);
  assert.deepEqual(r.other.map((a) => a.tag), ["Legendary", "Legendary", "Legendary · 2 LA"]);
  assert.equal(monsterActions(mon("Adult Black Dragon")), r, "per monster onthouden");
  assert.equal(monsterActions(null), null);
  assert.equal(monsterActions({ n: "Eigen", text: "vrije tekst" }), null);
  assert.equal(monsterActions({ n: "Kapot", a: [null, "x", ["Bite"]] }), null);
});

test("alle SRD-monsters: elke aanval met to hit heeft damage (op de bekende uitzonderingen na)", () => {
  const miss = [];
  for (const m of SRD) {
    const r = monsterActions(m);
    for (const a of r ? r.main : []) if (a.hit !== null && !a.dmg.length) miss.push(`${m.n}: ${a.n}`);
  }
  // Web (geen schade), Intoxicating Touch (curse), Tendril (grapple): klopt met het statblock
  assert.deepEqual(miss.sort(), ["Ettercap: Web", "Giant Spider: Web", "Lamia: Intoxicating Touch", "Roper: Tendril"]);
});

test("dmgKey en rollDmg tellen de delen op", () => {
  const key = dmgKey([{ e: "2d10+6", type: "piercing" }, { e: "1d8", type: "acid" }]);
  assert.equal(key, "2d10+6:piercing|1d8:acid");
  const r = rollDmg(key, (e) => rollExpr(e, () => 0)); // elke dobbelsteen 1
  assert.deepEqual(r.parts.map((p) => [p.type, p.total]), [["piercing", 8], ["acid", 1]]);
  assert.equal(r.total, 9);
  assert.equal(rollDmg("kapot", (e) => rollExpr(e)), null);
  assert.equal(rollDmg("", (e) => rollExpr(e)), null);
});

test("SRD-randgevallen: versatile met 'plus', vaste schade plus worp, 'X or Y' type en save", () => {
  const act = (m, n) => { const [k, v] = mon(m).a.find(([k]) => k === n); return parseAction(k, v); };
  assert.deepEqual(act("Azer", "Warhammer").dmg, [{ e: "1d8+3", type: "bludgeoning" }, { e: "1d6", type: "fire" }]);
  assert.deepEqual(act("Erinyes", "Longsword").dmg, [{ e: "1d8+4", type: "slashing" }, { e: "3d8", type: "poison" }]);
  assert.deepEqual(act("Djinni", "Scimitar").dmg[1], { e: "1d6", type: "lightning or thunder" });
  const snake = act("Flying Snake", "Bite");
  assert.deepEqual(snake.dmg, [{ flat: 1, type: "piercing" }, { e: "3d4", type: "poison" }]);
  assert.equal(dmgKey(snake.dmg), "1:piercing|3d4:poison");
  assert.equal(rollDmg(dmgKey(snake.dmg), (e) => rollExpr(e, () => 0)).total, 4);
  assert.equal(dmgKey([{ flat: 1, type: "piercing" }]), "", "alleen vaste schade: geen knop");
  const leap = act("Bulette", "Deadly Leap");
  assert.deepEqual(leap.dc, { n: 16, ab: "STR/DEX" });
  assert.equal(leap.dmg.length, 2);
});

test("alle SRD-monsters: elke damage-sleutel is rolbaar", () => {
  for (const m of SRD) {
    const r = monsterActions(m);
    for (const a of r ? [...r.main, ...r.other] : []) {
      const k = dmgKey(a.dmg);
      if (k) assert.ok(rollDmg(k, (e) => rollExpr(e)), `${m.n}: ${a.n} (${k})`);
    }
  }
});

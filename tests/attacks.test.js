import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAction, monsterActions, dmgKey, rollDmg, useful, isSaveAoe, rcIndex, actionAoe } from "../js/rules/attacks.js";
import { rcInfo } from "../js/rules/spells.js";
import { DTYPES } from "../js/rules/aoe.js";
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

/* ---------- save-actie → AoE-paneel (recharge) ---------- */
const max = (e) => rollExpr(e, () => 0.999999); // elke dobbelsteen op het maximum

test("AoE uit een save-actie: schade, type, ability, DC en halve schade", () => {
  const m = mon("Adult Black Dragon");
  const a = monsterActions(m).main.find((x) => x.n === "Acid Breath");
  assert.ok(isSaveAoe(a));
  const x = actionAoe(a, max, DTYPES);
  assert.equal(x.dmg, 96);
  assert.equal(x.type, "acid");
  assert.equal(x.ab, "DEX");
  assert.equal(x.dc, 18);
  assert.equal(x.half, true);
  assert.match(x.roll, /^12d8 \[8, 8, .*\] = 96$/);
  assert.equal(x.extra, "");
});

test("AoE uit een save-actie: geen halve schade (Wing Attack), 'half the bludgeoning damage' wel", () => {
  const wing = monsterActions(mon("Adult Black Dragon")).other.find((x) => /Wing Attack/.test(x.n));
  assert.equal(actionAoe(wing, max, DTYPES).half, false);
  const ww = parseAction("Whirlwind (Recharge 4–6)", "Each creature in the elemental's space must make a DC 13 Strength saving throw. On a failure, a target takes 15 (3d8 + 2) bludgeoning damage and is flung up 20 feet. If the saving throw is successful, the target takes half the bludgeoning damage and isn't flung away.");
  assert.equal(actionAoe(ww, max, DTYPES).half, true);
  const hd = parseAction("Burst", "Each creature must make a DC 12 Dexterity saving throw, taking 7 (2d6) fire damage on a failed save, or half damage on a successful one.");
  assert.equal(actionAoe(hd, max, DTYPES).half, true);
});

test("AoE uit een save-actie: zelfde type telt op, ander type als hint; onbekend type leeg", () => {
  const a = parseAction("Breath", "DC 15 Constitution saving throw, taking 10 (3d6) poison damage plus 7 (2d6) poison damage plus 3 (1d6) fire damage on a failed save, or half as much damage on a successful one.");
  const x = actionAoe(a, max, DTYPES);
  assert.equal(x.dmg, 30);
  assert.equal(x.roll, "3d6 [6, 6, 6] = 18 + 2d6 [6, 6] = 12 = 30");
  assert.equal(x.extra, "plus 1d6 fire");
  const b = parseAction("Storm", "DC 17 Dexterity saving throw, taking 22 (4d10) lightning or thunder damage (djinni's choice) on a failed save.");
  assert.equal(actionAoe(b, max, DTYPES).type, "");
  assert.equal(actionAoe(b, max, DTYPES).half, false);
});

test("AoE uit een save-actie: twee abilities → de eerste; aanval met to hit of zonder schade → null", () => {
  const a = parseAction("Gaze", "DC 14 Strength or Dexterity saving throw, taking 9 (2d8) force damage.");
  assert.equal(actionAoe(a, max, DTYPES).ab, "STR");
  assert.equal(actionAoe(parseAction("Bite", "Melee Weapon Attack: +5 to hit. Hit: 7 (1d8 + 3) piercing damage."), max, DTYPES), null);
  assert.equal(actionAoe(parseAction("Frightful Presence", "DC 16 Wisdom saving throw or become frightened."), max, DTYPES), null);
});

test("recharge-chip bij een actie op naam (hoofdletterongevoelig), -1 zonder chip", () => {
  const m = mon("Adult Black Dragon");
  const rc = rcInfo(m);
  assert.equal(rcIndex(rc, "Acid Breath"), 0);
  assert.equal(rcIndex(rc, "acid breath"), 0);
  assert.equal(rcIndex(rc, "Bite"), -1);
  assert.equal(rcIndex(undefined, "Acid Breath"), -1);
  // alle SRD-recharge-acties met DC en schade vinden hun chip
  let n = 0;
  for (const mm of SRD) {
    const A = monsterActions(mm); if (!A) continue;
    for (const x of [...A.main, ...A.other]) if (isSaveAoe(x) && /recharge/i.test(JSON.stringify([...(mm.a || []), ...(mm.l || [])].find((r) => r[0].startsWith(x.n)) || ""))) { n++; assert.ok(rcIndex(rcInfo(mm), x.n) >= 0, mm.n + ": " + x.n); }
  }
  assert.ok(n > 40);
});

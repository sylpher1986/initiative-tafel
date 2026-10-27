// WP48: statblock-parsers en monster-initiative editiebestendig (SRD 5.1 én SRD 5.2)
import { nlw } from "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { snap2014 } from "./_snap2014.js";
import { parseAction, monsterActions } from "../js/rules/attacks.js";
import { legInfo, rcInfo, castInfo } from "../js/rules/spells.js";
import { laOptions } from "../js/rules/legendary.js";
import { parseRider, riderFor, riderImmune } from "../js/rules/monrules.js";
import { defMode } from "../js/rules/aoe.js";
import { condImmune } from "../js/rules/spellcast.js";
import { classic, defRows } from "../js/rules/statform.js";
import { classic as classicSp } from "../js/data/statparse.js";
import { monInit, initBo, freshRoll, rerollMonsters, statInit } from "../js/rules/turns.js";
import { loadSrd24, srd24Status, findMon, setSrd24 } from "../js/data/monsters.js";

const DOC24 = JSON.parse(readFileSync(new URL("../data/monsters-2024.json", import.meta.url)));
const L24 = DOC24.monsters;
const SRD14 = JSON.parse(readFileSync(new URL("../data/monsters.json", import.meta.url)));
const m24 = (n) => L24.find((m) => m.n === n);
const seq = (...v) => { let i = 0; return () => (v[i++ % v.length] - 1) / 20; };
const actions = (m) => ["a", "ba", "re", "l"].flatMap((s) => (m[s] || []).map(([k, v]) => [k, v]));

test("WP48: SRD 5.1 (322 monsters) geeft exact de oude parseruitkomsten", () => {
  // Vingerafdruk van monsterActions, legInfo, rcInfo, castInfo, laOptions, parseRider, parryOf, defMode en condImmune
  // over alle 2014-monsters, vastgelegd vóór WP48. Verandert hij, dan is 2014-gedrag gewijzigd: alleen bewust bijwerken.
  assert.equal(SRD14.length, 322);
  assert.equal(snap2014(), "608bda8605795340553f10ea4675143c1771e631b155154e6a157e647e5ddae7");
});

test("WP48: aantallen geparste acties per editie (snapshot)", () => {
  const count = (L) => {
    const n = { hit: 0, dc: 0, dmg: 0, other: 0 };
    for (const m of L) {
      const A = monsterActions(structuredClone(m));
      if (!A) continue;
      for (const a of [...A.main, ...A.other]) { if (a.hit !== null) n.hit++; if (a.dc) n.dc++; if (a.dmg.length) n.dmg++; }
      n.other += A.other.length;
    }
    return n;
  };
  assert.deepEqual(count(SRD14), { hit: 520, dc: 207, dmg: 609, other: 104 });
  assert.deepEqual(count(L24), { hit: 423, dc: 186, dmg: 549, other: 106 });
});

test("WP48: elke 2024-aanval geeft to-hit en schade of een rider-hint; elke save geeft DC + ability", () => {
  assert.equal(L24.length, 331);
  let atk = 0, saves = 0;
  for (const m of L24) for (const [k, v] of actions(m)) {
    const a = parseAction(k, v);
    if (/Attack Roll:/.test(v)) {
      atk++;
      const want = +v.match(/Attack Roll:\s*([+-]\d+)/)[1];
      assert.equal(a.hit, want, `${m.n} · ${k}: to hit`);
      const r = parseRider(v);
      assert.ok(a.dmg.length || (r && ((r.fix && r.fix.length) || r.conds.length)), `${m.n} · ${k}: schade of rider-hint`);
    }
    // één DC per actie (het model): de eerste save telt (Sphinx of Valor "Roar" heeft er drie, per brul één)
    for (const z of [v.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw: DC (\d+)/)].filter(Boolean)) {
      saves++;
      const ab = z[1].slice(0, 3).toUpperCase(), dc = +z[2], r = parseRider(v);
      assert.ok((a.dc && a.dc.n === dc && a.dc.ab === ab) || (r && r.dc === dc && r.ab === ab), `${m.n} · ${k}: ${ab} DC ${dc}`);
    }
  }
  assert.equal(atk, 423); assert.equal(saves, 186);
});

test("WP48: Spellcasting als 2024-actie is geen aanval (geen to-hit uit 'to hit with spell attacks')", () => {
  const rd = m24("Adult Red Dragon");
  const sc = parseAction("Spellcasting", rd.a.find(([k]) => k === "Spellcasting")[1]);
  assert.equal(sc.hit, null); assert.equal(sc.dc, null);
  assert.deepEqual(monsterActions(rd).main.map((a) => a.n), ["Rend", "Fire Breath"]);
});

test("WP48: 2024-aanval en save-actie gelezen als klassiek; text blijft de echte tekst", () => {
  const rd = m24("Adult Red Dragon"), A = monsterActions(rd);
  const rend = A.main[0];
  assert.deepEqual([rend.hit, rend.reach, rend.kind], [14, "reach 10 ft.", "melee"]);
  assert.deepEqual(rend.dmg, [{ e: "1d10+8", type: "slashing" }, { e: "2d4", type: "fire" }]);
  assert.match(rend.text, /^Melee Attack Roll: \+14/);
  const br = A.main[1];
  assert.deepEqual([br.n, br.hit, br.dc, br.dmg], ["Fire Breath", null, { n: 21, ab: "DEX" }, [{ e: "17d6", type: "fire" }]]);
  assert.match(A.multi.text, /three Rend attacks/);
  // ", plus 2 (1d4) … if the attack roll had Advantage" is een voorwaarde, geen vaste extra schade
  const gb = parseAction("Scimitar", m24("Goblin Boss").a.find(([k]) => k === "Scimitar")[1]);
  assert.deepEqual(gb.dmg, [{ e: "1d6+2", type: "slashing" }]);
  // classic() woont nu in js/rules/statform.js; statparse geeft dezelfde functie door
  assert.equal(classicSp, classic);
});

test("WP48: legendary 2024 — aantal uit 'Legendary Action Uses', LR basiswaarde zonder lair; refs naar aanvallen", () => {
  for (const m of L24) {
    if ((m.l || []).length) assert.equal(legInfo(m).la.max, +m.ld.match(/Legendary Action Uses: (\d+)/)[1], m.n);
    if ((m.t || []).some(([k]) => /^Legendary Resistance/.test(k))) assert.ok(legInfo(m).lr, `${m.n}: LR`);
  }
  const rd = m24("Adult Red Dragon");
  assert.deepEqual(legInfo(rd), { la: { max: 3, left: 3 }, lr: { max: 3, left: 3 } });
  assert.deepEqual(laOptions(rd).map((o) => [o.n, o.cost, o.refs.map((r) => r.n)]), [["Commanding Presence", 1, []], ["Fiery Rays", 1, []], ["Pounce", 1, ["Rend"]]]);
});

test("WP48: recharge en spellcasting 2024", () => {
  const rd = m24("Adult Red Dragon");
  assert.deepEqual(rcInfo(rd), [{ n: "Fire Breath", min: 5, rest: false, ready: true }]);
  assert.deepEqual(castInfo(rd), { slots: [], daily: [{ label: "1/day", items: [{ n: "Fireball", max: 1, left: 1 }] }] });
  const lich = castInfo(m24("Lich"));
  assert.ok(lich && lich.daily.some((d) => d.label === "2/day each"), "• 2/Day Each: …");
  const short = L24.flatMap((m) => ["t", "a", "ba", "re", "l"].flatMap((s) => (m[s] || []).map(([k]) => k))).filter((k) => /Recharge after a Short or Long Rest/.test(k));
  assert.ok(short.length > 0);
});

test("WP48: riders 2024 — save met Failure-zin, vaste conditie als hint (niet automatisch)", () => {
  const txt = (n, k) => m24(n).a.find(([x]) => x === k)[1];
  const ghoul = parseRider(txt("Ghoul", "Claw"));
  assert.deepEqual([ghoul.ab, ghoul.dc, ghoul.conds, ghoul.dur, ghoul.only], ["CON", 10, ["Paralyzed"], "", "creature that isn't an Undead or elf"]);
  assert.equal(ghoul.fix, undefined);
  const ab = parseRider(txt("Aboleth", "Tentacle"));
  assert.deepEqual([ab.ab, ab.dc, ab.conds, ab.fix, ab.only], ["", 0, [], [{ k: "Grappled", esc: 14 }], "Large or smaller creature"]);
  const roper = parseRider(txt("Roper", "Tentacle"));
  assert.deepEqual(roper.fix, [{ k: "Grappled", esc: 14 }, { k: "Poisoned" }]);
  assert.equal(parseAction("Tentacle", txt("Roper", "Tentacle")).dmg.length, 0, "Hit: The target has the Grappled condition");
  const homu = parseRider(txt("Homunculus", "Bite"));
  assert.deepEqual(homu.conds, ["Poisoned"]);
  assert.match(homu.note, /bewusteloos/, "Failure by 5 or More → herinnering");
  const were = parseRider(txt("Werewolf", "Bite (Wolf or Hybrid Form Only)"));
  assert.deepEqual([were.conds, were.dmg, were.only], [[], null, "Humanoid"]);
  assert.ok(were.note, "vloek: alleen herinnering");
  // voorwaarde die de app niet kent: geen vaste hint (Phase Spider: alleen als de schade het doel naar 0 HP brengt)
  assert.equal(parseRider(m24("Phase Spider").a.find(([x]) => x === "Bite")[1]), null);
  const dm = parseRider(txt("Darkmantle", "Crush"));
  assert.ok(!dm || !(dm.fix || []).some((f) => f.k === "Blinded"), "Blinded alleen met Advantage");
  // doel immuun voor de conditie: geen hint
  assert.equal(riderFor(ab, { id: "m", kind: "monster", name: "M", hp: 10, max: 10, cond: [] }, { x: [["Immunities", "Poison; Grappled"]] }, { hp: 5 }), null);
  // hint zonder save: riderFor past niets toe (act false), ook niet bij een doel op 0 HP
  const c = { id: "p", kind: "pc", name: "P", hp: 10, max: 10, cond: [] };
  const ri = riderFor(ab, c, null, { ...c, hp: 4 });
  assert.deepEqual([ri.act, ri.auto, ri.immune], [false, null, false]);
});

test("WP48: verdediging 2024 — 'Immunities: schade; condities', resistances, conditie-immuniteit voor riders en spells", () => {
  const x = [["Immunities", "Fire, Poison; Charmed, Poisoned"], ["Resistances", "Cold, Lightning"]];
  assert.deepEqual(defRows(x), { vuln: "", res: "Cold, Lightning", imm: "Fire, Poison", cimm: "Charmed, Poisoned" });
  assert.deepEqual(defRows([["Immunities", "Charmed, Frightened"]]), { vuln: "", res: "", imm: "", cimm: "Charmed, Frightened" });
  assert.deepEqual(defRows([["Immunities", "Psychic, Radiant"]]).imm, "Psychic, Radiant");
  assert.deepEqual(defMode(x, "fire"), { mode: 0, cond: "" });
  assert.deepEqual(defMode(x, "cold"), { mode: 0.5, cond: "" });
  assert.deepEqual(defMode(x, "acid"), { mode: 1, cond: "" });
  assert.ok(condImmune({ x }).includes("Charmed"));
  assert.ok(!condImmune({ x: [["Immunities", "Fire"]] }).length);
  assert.equal(riderImmune({ conds: ["Poisoned"], dmg: null }, { x }), true);
  assert.equal(riderImmune({ conds: ["Prone"], dmg: null }, { x }), false);
  const rd = m24("Adult Red Dragon");
  assert.equal(defMode(rd.x, "fire").mode, 0);
});

test("WP48: initiative uit het statblock — Adult Red Dragon d20 + 12, onaangeroerd, Opnieuw rollen weer d20 + 12", () => {
  const rd = m24("Adult Red Dragon");
  assert.equal(statInit(rd), 12);
  const f = monInit(rd, 7);
  assert.deepEqual(f, { init: 19, roll: 7, dex: 0, initBonus: 12 });
  const c = { id: "d", name: "Adult Red Dragon", kind: "monster", ref: rd.n, ed: "2024", ...f, ac: 19, hp: 256, max: 256, cond: [] };
  assert.equal(initBo(c), 12);
  assert.equal(freshRoll(c), true, "telt als onaangeroerd");
  const r = rerollMonsters([c], seq(3));
  assert.deepEqual([r.n, c.roll, c.init], [1, 3, 15]);
  assert.match(nlw(r.why)[0].t, /d20 \[3\] \+12/);
  assert.equal(freshRoll({ ...c, init: 20 }), false, "aangepast: blijft staan");
  // 2014: geen initBonus-veld, d20 + Dex zoals voorheen; vaste waarde blijft vast
  const gob = SRD14.find((m) => m.n === "Goblin");
  assert.deepEqual(monInit(gob, 10), { init: 12, roll: 10, dex: 2 });
  assert.deepEqual(monInit(rd, undefined, 17), { init: 17, roll: undefined, dex: 0, initBonus: 12 });
  // eigen monster zonder ability scores: dexScore
  assert.deepEqual(monInit({ n: "X", dexScore: 14 }, 5), { init: 7, roll: 5, dex: 2 });
});

test("WP48: loadSrd24 laadt één keer, controleert het omhulsel en geeft een expliciete stand", async () => {
  const f0 = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return { ok: false, status: 404 }; };
    assert.equal(await loadSrd24(), "fail");
    assert.equal(srd24Status(), "fail");
    globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ ed: "2014", monsters: [] }) }; };
    assert.equal(await loadSrd24(), "fail", "geen 2024-omhulsel");
    globalThis.fetch = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return { ok: true, json: async () => DOC24 }; };
    const [a, b] = await Promise.all([loadSrd24(), loadSrd24()]);
    assert.deepEqual([a, b, srd24Status()], ["ok", "ok", "ok"]);
    assert.equal(calls, 3, "gelijktijdige aanroepen delen één ophaal");
    assert.equal(await loadSrd24(), "ok"); assert.equal(calls, 3, "daarna niet opnieuw");
    assert.equal(findMon("Adult Red Dragon", "2024").init, 12);
  } finally { globalThis.fetch = f0; setSrd24([]); }
});

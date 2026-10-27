// WP47: SRD 5.2-monsterdata (data/monsters-2024.json, gemaakt door tools/monsters_srd2024.py uit Open5e en
// gecontroleerd tegen de officiële SRD 5.2.1-pdf). Steekproefwaarden hieronder komen uit die pdf.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HD_RE } from "../js/rules/dice.js";
import { srdList, setSrd24, findMon, allMonsters } from "../js/data/monsters.js";

const doc = JSON.parse(readFileSync(new URL("../data/monsters-2024.json", import.meta.url), "utf8"));
const L = doc.monsters;
const by = new Map(L.map((m) => [m.n, m]));
const KINDS = ["t", "a", "ba", "re", "l"];
const entries = (m) => KINDS.flatMap((k) => m[k]);
const XP = { "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900,
  9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000,
  20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000 };

test("monsters 2024: omhulsel met editie en bronvermelding, 331 monsters met unieke namen, gesorteerd", () => {
  assert.equal(doc.ed, "2024");
  assert.match(doc.src, /System Reference Document 5\.2\.1.*CC-BY-4\.0.*Open5e/);
  assert.equal(L.length, 331);
  assert.equal(by.size, 331);
  assert.deepEqual(L.map((m) => m.n), [...L.map((m) => m.n)].sort());
});

test("monsters 2024: zelfde velden als data/monsters.json, plus init en pb", () => {
  const old = JSON.parse(readFileSync(new URL("../data/monsters.json", import.meta.url), "utf8"))[0];
  for (const m of L) {
    assert.deepEqual(Object.keys(m).sort(), [...Object.keys(old), "init", "pb"].sort(), m.n);
    assert.ok(m.n && typeof m.meta === "string" && /^(Tiny|Small|Medium|Large|Huge|Gargantuan) \w/.test(m.meta), m.n);
    assert.match(m.ac, /^\d+$/, m.n);
    assert.ok(Number.isInteger(m.hp) && m.hp > 0, m.n);
    assert.match(m.hd, HD_RE, m.n);
    assert.ok(m.ab.length === 6 && m.ab.every((s) => Number.isInteger(s) && s >= 1 && s <= 30), m.n);
    assert.ok(m.cr in XP, `${m.n}: cr ${m.cr}`);
    assert.equal(m.xp, ["Seahorse", "Shrieker Fungus"].includes(m.n) ? 0 : XP[m.cr], m.n);
    assert.ok(Number.isInteger(m.init), m.n);
    const c = Number.isInteger(+m.cr) ? +m.cr : 0; // 1/8, 1/4, 1/2 → 0
    assert.equal(m.pb, 2 + Math.floor(Math.max(0, c - 1) / 4), m.n);
    assert.match(m.spd, /^\d+ ft\./, m.n);
    for (const [k, v] of m.x) assert.ok(typeof k === "string" && typeof v === "string" && v, `${m.n}: ${k}`);
    assert.ok(m.x.some(([k]) => k === "Senses") && m.x.some(([k]) => k === "Languages"), m.n);
    for (const e of entries(m)) assert.ok(e.length === 2 && e[0] && e[1] && typeof e[1] === "string", `${m.n}: ${e[0]}`);
  }
});

test("monsters 2024: aanvallen hebben Hit:, geen Open5e-rommel of opmaak in de tekst", () => {
  for (const m of L) for (const [n, t] of entries(m)) {
    if (/^(Melee|Ranged|Melee or Ranged) Attack Roll:/.test(t)) assert.match(t, /^(Melee|Ranged|Melee or Ranged) Attack Roll: [+-]\d+.*? (ft|feet)\.? Hit: (?!or )/, `${m.n}: ${n}`);
    assert.doesNotMatch(n + t, /\*|\||\b_|_\b|#|\bDM\b|Hitom|Hitazard|Short Short|XPHB|to hit,/, `${m.n}: ${n}`);
    assert.doesNotMatch(n, /\) \(/, `${m.n}: ${n}: één haakje voor gebruik en vorm`);
  }
  // losse spell-acties hebben geen aangeplakte lijst, lijsten zijn nooit leeg
  for (const m of L) for (const [n, t] of entries(m)) {
    if (!/Spellcasting/.test(n)) assert.doesNotMatch(t, /^• (At Will|\d+\/Day)/m, `${m.n}: ${n}`);
    assert.doesNotMatch(t, /^• [^:]+:\s*$/m, `${m.n}: ${n}`);
  }
});

test("monsters 2024: legendary actions met aantal (3, of 3 (4 in Lair) bij een lair)", () => {
  const leg = L.filter((m) => m.l.length);
  assert.equal(leg.length, 30);
  for (const m of L) {
    if (!m.l.length) { assert.equal(m.ld, "", m.n); continue; }
    const lair = m.t.some(([n]) => /in Lair/.test(n));
    assert.match(m.ld, lair ? /^Legendary Action Uses: 3 \(4 in Lair\)\. / : /^Legendary Action Uses: 3\. /, m.n);
  }
  assert.equal(leg.filter((m) => /in Lair/.test(m.ld)).length, 27);
  assert.deepEqual(leg.filter((m) => !/in Lair/.test(m.ld)).map((m) => m.n), ["Solar", "Tarrasque", "Unicorn"]);
  assert.match(by.get("Mummy Lord").ld, /the mummy can expend a use/);
});

test("monsters 2024: steekproef gelijk aan SRD 5.2.1 (AC, HP, hit dice, CR, Initiative, saves, entries per soort)", () => {
  const S = [
    ["Aboleth", "17", 150, "20d10+40", "10", 7, "Dex +3, Con +6, Int +8, Wis +6", "Amphibious,Eldritch Restoration,Legendary Resistance (3/Day, or 4/Day in Lair),Mucus Cloud,Probing Telepathy | Multiattack,Tentacle,Consume Memories,Dominate Mind (2/Day) |  |  | Lash,Psychic Drain"],
    ["Adult Red Dragon", "19", 256, "19d12+133", "17", 12, "Dex +6, Wis +7", "Legendary Resistance (3/Day, or 4/Day in Lair) | Multiattack,Rend,Fire Breath (Recharge 5–6),Spellcasting |  |  | Commanding Presence,Fiery Rays,Pounce"],
    ["Goblin Warrior", "15", 10, "3d6", "1/4", 2, null, " | Scimitar,Shortbow | Nimble Escape |  | "],
    ["Zombie", "8", 15, "2d8+6", "1/4", -2, "Wis +0", "Undead Fortitude | Slam |  |  | "],
    ["Lich", "20", 315, "42d8+126", "21", 17, "Dex +10, Con +10, Int +12, Wis +9", "Legendary Resistance (4/Day, or 5/Day in Lair),Spirit Jar | Multiattack,Eldritch Burst,Paralyzing Touch,Spellcasting |  | Protective Magic | Deathly Teleport,Disrupt Life,Frightening Gaze"],
    ["Mage", "15", 81, "18d8", "6", 2, "Int +6, Wis +4", " | Multiattack,Arcane Burst,Spellcasting | Misty Step (3/Day) | Protective Magic (3/Day) | "],
    ["Vampire", "16", 195, "23d8+92", "13", 14, "Dex +9, Con +9, Wis +7, Cha +9", "Legendary Resistance (3/Day, or 4/Day in Lair),Misty Escape,Spider Climb,Vampire Weakness | Multiattack (Vampire Form Only),Grave Strike (Vampire Form Only),Bite (Bat or Vampire Form Only) | Shape-Shift,Charm (Recharge 5–6) |  | Deathless Strike,Beguile"],
    ["Bandit Captain", "15", 52, "8d8+16", "2", 3, "Str +4, Dex +5, Wis +2", " | Multiattack,Scimitar,Pistol |  | Parry | "],
    ["Owlbear", "13", 59, "7d10+21", "3", 1, null, " | Multiattack,Rend |  |  | "],
    ["Hill Giant", "13", 105, "10d12+40", "5", 2, null, " | Multiattack,Tree Club,Trash Lob |  |  | "],
    ["Werewolf", "15", 71, "11d8+22", "3", 4, null, "Pack Tactics | Multiattack,Bite (Wolf or Hybrid Form Only),Scratch,Longbow (Humanoid or Hybrid Form Only) | Shape-Shift |  | "],
    ["Black Pudding", "7", 68, "8d10+24", "4", -3, null, "Amorphous,Corrosive Form,Spider Climb | Dissolving Pseudopod |  | Split | "],
    ["Kraken", "18", 481, "26d20+208", "23", 14, "Str +17, Dex +7, Con +15, Wis +11", "Amphibious,Legendary Resistance (4/Day, or 5/Day in Lair),Siege Monster | Multiattack,Tentacle,Fling,Lightning Strike,Swallow |  |  | Storm Bolt,Toxic Ink"],
    ["Swarm of Rats", "10", 14, "4d8-4", "1/4", 0, null, "Swarm | Bites |  |  | "],
    ["Priest", "13", 38, "7d8+7", "2", 0, null, " | Multiattack,Mace,Radiant Flame,Spellcasting | Divine Aid (3/Day) |  | "],
  ];
  for (const [n, ac, hp, hd, cr, init, saves, names] of S) {
    const m = by.get(n);
    assert.ok(m, n);
    assert.deepEqual([m.ac, m.hp, m.hd, m.cr, m.init], [ac, hp, hd, cr, init], n);
    assert.equal(new Map(m.x).get("Saving Throws") ?? null, saves, n);
    assert.equal(KINDS.map((k) => m[k].map((e) => e[0]).join(",")).join(" | "), names, n);
  }
  // tekst als in de SRD, ook waar Open5e afweek
  const txt = (n, e) => new Map(entries(by.get(n))).get(e);
  assert.match(txt("Aboleth", "Tentacle"), /^Melee Attack Roll: \+9, reach 15 ft\. Hit: 12 \(2d6 \+ 5\) Bludgeoning damage\./);
  assert.equal(txt("Bandit Captain", "Parry"), "Trigger: The bandit is hit by a melee attack roll while holding a weapon. Response: The bandit adds 2 to its AC against that attack, possibly causing it to miss.");
  assert.match(txt("Awakened Tree", "Slam"), /Hit: 14 \(3d6 \+ 4\) Bludgeoning/);
  assert.match(txt("Lich", "Spellcasting"), /\n• At Will: [^\n]*Fireball \(level 5 version\)/);
  assert.match(txt("Night Hag", "Nightmare Haunting (1/Day; Requires Soul Bag)"), /soul is released\.$/);
  assert.match(txt("Vampire", "Vampire Weakness"), /\nForbiddance\. The vampire/);
  assert.match(txt("Commoner", "Training"), /the GM's choice/);
});

test("monsters 2024: statregels die Open5e mist (B/P/S, vulnerabilities, Gear, notities, Octopus)", () => {
  const x = (n, k) => new Map(by.get(n).x).get(k);
  for (const s of ["Bats", "Crawling Claws", "Insects", "Piranhas", "Rats", "Ravens", "Venomous Snakes"]) assert.equal(x("Swarm of " + s, "Resistances"), "Bludgeoning, Piercing, Slashing");
  assert.match(x("Black Pudding", "Immunities"), /^Acid, Cold, Lightning, Slashing; /);
  assert.equal(x("Skeleton", "Vulnerabilities"), "Bludgeoning");
  assert.equal(L.filter((m) => x(m.n, "Vulnerabilities")).length, 15);
  assert.equal(x("Goblin Warrior", "Gear"), "Leather Armor, Scimitar, Shield, Shortbow");
  assert.match(x("Bone Devil", "Senses"), /Darkvision 120 ft\. \(unimpeded by magical Darkness\)/);
  assert.equal(by.get("Werewolf").spd, "30 ft., 40 ft. (wolf form only)");
  assert.deepEqual(by.get("Octopus").ab, [4, 15, 11, 3, 10, 4]);
  assert.equal(x("Octopus", "Saving Throws"), undefined);
});

test("monsters 2024: laden als omhulsel (srdList, setSrd24), oude array blijft werken; ed 2024 zoekt alleen hierin", () => {
  assert.equal(srdList(doc), L);
  const arr = [{ n: "X" }];
  assert.equal(srdList(arr), arr);
  assert.deepEqual(srdList(null), []);
  assert.deepEqual(srdList({ monsters: "nee" }), []);
  setSrd24(doc);
  assert.equal(allMonsters("2024").length, 331);
  assert.equal(findMon("Zombie", "2024").hp, 15);
  assert.equal(findMon("Goblin", "2024"), undefined); // 2014-naam; 2024 heet hij Goblin Warrior
  setSrd24([]);
});

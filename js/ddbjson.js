// D&D Beyond character-JSON (interne endpoint character-service v5, via onze Worker) → ons sheet-formaat
// (hetzelfde als parseDdbFields in ddb.js). Puur en zonder DOM, dus testbaar in Node.
// Het formaat is onofficieel en kan veranderen: alles defensief lezen. AC en HP staan niet kant-en-klaar in de
// data en worden berekend; waar dat niet zeker is, komt een reden in check.ac / check.hp zodat de DM controleert.

import { setMax } from "./rules/combat.js";
import { baseMax } from "./rules/effects.js";
import { cleanDr, drDiff, DTYPES } from "./rules/aoe.js";
import { pactSlots } from "./rules/slots.js";
import { t as tt } from "./i18n/boot.js"; // tt: mergeSheet heeft een parameter t (tekst in de taal van het moment van ophalen)

const AB = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const SHORT = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const SKILLS = [["Acrobatics", 1], ["Animal Handling", 4], ["Arcana", 3], ["Athletics", 0], ["Deception", 5], ["History", 3], ["Insight", 4], ["Intimidation", 5], ["Investigation", 3], ["Medicine", 4], ["Nature", 3], ["Perception", 4], ["Performance", 5], ["Persuasion", 5], ["Religion", 3], ["Sleight of Hand", 1], ["Stealth", 1], ["Survival", 4]];
// PHB 2014, multiclass-spellcaster (index = caster level)
const MULTI = [[], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
const RESET = { 1: "Short Rest", 2: "Long Rest" };
const ACT = { 1: "1A", 3: "1BA", 4: "1R", 6: "1m", 7: "1h" };

const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const int = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : typeof v === "string" && /^-?\d+$/.test(v.trim()) ? +v : null);
const str = (v, n = 120) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const mod = (s) => Math.floor((s - 10) / 2);
const sg = (n) => (n >= 0 ? "+" : "") + n;
const slug = (s) => String(s || "").toLowerCase().trim().replace(/\s+/g, "-");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Character-id uit een link, korte link of los nummer; anders null. */
export const DDB_ID_RE = /^[1-9]\d{0,11}$/;
export function parseDdbLink(input) {
  const s = String(input || "").trim();
  if (DDB_ID_RE.test(s)) return s;
  const m = s.match(/^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:dndbeyond\.com|ddb\.ac)\/(?:[^?#\s]*\/)?characters\/([1-9]\d{0,11})(?:[/?#]|$)/i);
  return m ? m[1] : null;
}

/** Alle modifiers die meetellen. Items alleen als ze gedragen worden (en geattuned als dat moet). */
function collectMods(d) {
  const M = obj(d.modifiers) ? d.modifiers : {};
  const live = new Set(), known = new Set();
  for (const it of arr(d.inventory)) {
    const df = obj(it) && obj(it.definition) ? it.definition : null;
    if (!df) continue;
    for (const k of [it.id, df.id]) if (k != null) { known.add(k); if (it.equipped && (!df.canAttune || it.isAttuned)) live.add(k); }
  }
  const out = [], orphans = [];
  for (const [cat, list] of Object.entries(M)) {
    if (cat === "condition") continue;
    for (const m of arr(list)) {
      if (!obj(m) || typeof m.type !== "string") continue;
      const x = { type: m.type, sub: String(m.subType || ""), value: int(m.value), statId: int(m.statId), cat, name: str(m.friendlySubtypeName) };
      if (cat === "item") { if (live.has(m.componentId)) out.push(x); else if (!known.has(m.componentId)) orphans.push(x); }
      else out.push(x);
    }
  }
  return { mods: out, orphans, live, known };
}

/** Spell-lijsten (klasse, ras, feat, item, …). Item-spells alleen als het item gedragen wordt (en geattuned als dat moet); onbekend item: tonen */
function spellLists(d, live, known) {
  const sp = obj(d.spells) ? d.spells : {};
  const ok = (k) => (x) => k !== "item" || !obj(x) || x.componentId == null || live.has(x.componentId) || !known.has(x.componentId);
  return [...arr(d.classSpells).map((cs) => arr(obj(cs) ? cs.spells : null)), ...Object.entries(sp).map(([k, l]) => arr(l).filter(ok(k)))];
}

function computeUses(lu, M, prof) {
  let n = int(lu.maxUses) || 0;
  const st = int(lu.statModifierUsesId);
  if (st >= 1 && st <= 6) n += Math.max(1, M[st - 1]);
  if (lu.useProficiencyBonus) n = n ? (int(lu.proficiencyBonusOperator) === 1 ? n + prof : n * prof) : prof;
  return n;
}

/**
 * Editie van een spell uit de bronnen van D&D Beyond (zelfde regel als ddb-importer): 2014 als álle bronnen 2014 zijn
 * (bron-id < 145, plus een paar latere 2014-boeken), anders 2024. Zonder bronnen: isLegacy, anders onbekend ("").
 */
const ED24 = new Set([145, 146, 147, 148, 149, 153, 157, 163, 196]), ED14 = new Set([150, 151, 152, 154, 155, 156, 158, 159, 162]);
export function spellEd(df) {
  const ids = arr(df && df.sources).map((x) => (obj(x) ? int(x.sourceId) : null)).filter((x) => x != null);
  if (!ids.length) return df && df.isLegacy === true ? "2014" : df && df.isLegacy === false ? "2024" : "";
  return ids.every((id) => ED14.has(id) || (!ED24.has(id) && id < 145)) ? "2014" : "2024";
}

function spellRow(s) {
  const df = obj(s) && obj(s.definition) ? s.definition : null;
  if (!df || !str(df.name)) return null;
  const du = obj(df.duration) ? df.duration : {}, rg = obj(df.range) ? df.range : {}, ac = obj(df.activation) ? df.activation : {};
  const span = int(du.durationInterval) ? `${int(du.durationInterval)} ${str(du.durationUnit, 20).toLowerCase()}${int(du.durationInterval) > 1 ? "s" : ""}` : "";
  const dur = df.concentration ? `Concentration${span ? ", up to " + span : ""}` : str(du.durationType, 30) === "Time" ? span : str(du.durationType, 30);
  const range = int(rg.rangeValue) ? `${int(rg.rangeValue)} ft.` : str(rg.origin, 30);
  return { lvl: clamp(int(df.level) || 0, 0, 9), use: !!(s.prepared || s.alwaysPrepared || s.countsAsKnownSpell || !int(df.level)),
    sp: { n: str(df.name), src: "", hit: "", time: ACT[int(ac.activationType)] || "", range, dur, notes: "", ...(spellEd(df) ? { ed: spellEd(df) } : {}) } };
}

/**
 * SP2: weerstanden uit de modifiers (ras, klasse, feats, gedragen items): type resistance/immunity/vulnerability met
 * een damage type als subType. Voorwaardelijke ("…-from-nonmagical-attacks") en conditie-immuniteiten tellen niet.
 * Handmatige "Defenses" op de sheet (customDefenseAdjustments) leest de app niet: die vult de DM zelf aan.
 */
function drOf(mods) {
  const o = { r: [], i: [], v: [] };
  for (const m of mods) {
    const k = { resistance: "r", immunity: "i", vulnerability: "v" }[m.type], t = m.sub.toLowerCase();
    if (k && DTYPES.includes(t)) o[k].push(t);
  }
  return cleanDr(o) || {};
}

/**
 * Weerstanden na het bijwerken van de sheet: wat de DM zelf toevoegde (staat bij de speler, niet op de oude sheet)
 * blijft; de rest volgt de nieuwe sheet. Zonder weerstanden op de nieuwe sheet (PDF): niets veranderen.
 */
export function drMerge(cur, oldSh, newSh) {
  if (!newSh || !newSh.dr) return cleanDr(cur);
  const was = (oldSh && oldSh.dr) || {}, out = { r: [], i: [], v: [] };
  for (const k of ["r", "i", "v"]) out[k] = [...(newSh.dr[k] || []), ...((cur && cur[k]) || []).filter((t) => !(was[k] || []).includes(t))];
  return cleanDr(out);
}

/**
 * Character-JSON → { sheet, id, hasAvatar, check: { ac: [redenen], hp: [redenen] } }, of null als het geen character is.
 * Accepteert zowel het volledige antwoord ({ success, data }) als alleen data.
 */
export function parseDdbJson(json) {
  const d = obj(json) && obj(json.data) ? json.data : json;
  if (!obj(d) || !str(d.name)) return null;
  const check = { ac: [], hp: [] };
  const { mods, orphans, live, known: kn } = collectMods(d);
  const lists = spellLists(d, live, kn);
  const of = (t, s) => mods.filter((m) => m.type === t && m.sub === s);
  const has = (t, s) => of(t, s).length > 0;

  // ability scores: override > basis + bonus + modifiers; "set" (bijv. Belt of Giant Strength) als minimum
  const pick = (a, id) => { const x = arr(a).find((s) => obj(s) && s.id === id); return x ? int(x.value) : null; };
  const ab = AB.map((n, i) => {
    const ov = pick(d.overrideStats, i + 1);
    if (ov != null) return ov;
    let v = (pick(d.stats, i + 1) ?? 10) + (pick(d.bonusStats, i + 1) ?? 0) + of("bonus", n + "-score").reduce((a, m) => a + (m.value || 0), 0);
    for (const m of of("set", n + "-score")) if (m.value != null) v = Math.max(v, m.value);
    return clamp(v, 1, 30);
  });
  const M = ab.map(mod);
  const val = (m) => (m.value != null ? m.value : m.statId >= 1 && m.statId <= 6 ? M[m.statId - 1] : 0);
  const sum = (t, s) => of(t, s).reduce((a, m) => a + val(m), 0);

  const classes = arr(d.classes).filter((c) => obj(c) && obj(c.definition) && int(c.level) > 0)
    .sort((a, b) => (b.isStartingClass ? 1 : 0) - (a.isStartingClass ? 1 : 0));
  const L = clamp(classes.reduce((a, c) => a + int(c.level), 0), 0, 20);
  const prof = 2 + Math.floor((Math.max(1, L) - 1) / 4);
  const cname = (c) => str(c.definition.name, 40);

  // saves en skills (alle zes / alle 18, zoals de PDF-export)
  // Jack of All Trades (half-proficiency, afgerond omlaag); Remarkable Athlete (half-proficiency-round-up, Str/Dex/Con)
  const half = (s, ai) => Math.max(
    has("half-proficiency", s) || has("half-proficiency", "ability-checks") ? Math.floor(prof / 2) : 0,
    has("half-proficiency-round-up", s) || has("half-proficiency-round-up", "ability-checks") || (ai != null && has("half-proficiency-round-up", AB[ai] + "-ability-checks")) ? Math.ceil(prof / 2) : 0);
  const saves = AB.map((n, i) => [SHORT[i][0] + SHORT[i].slice(1).toLowerCase(), sg(M[i] + (has("proficiency", n + "-saving-throws") ? prof : 0) + sum("bonus", n + "-saving-throws") + sum("bonus", "saving-throws"))]);
  const skillVal = {};
  const skills = SKILLS.map(([n, ai]) => {
    const s = slug(n);
    const p = has("expertise", s) ? 2 * prof : has("proficiency", s) ? prof : half(s, ai);
    const v = M[ai] + p + sum("bonus", s) + sum("bonus", "ability-checks");
    skillVal[n] = v;
    return [n, sg(v)];
  });
  const initBonus = M[1] + (has("proficiency", "initiative") ? prof : half("initiative", 1)) + sum("bonus", "initiative") + sum("bonus", "ability-checks"); // initiative is een Dex-check

  // ---------- AC ----------
  const eq = arr(d.inventory).filter((it) => obj(it) && it.equipped && obj(it.definition));
  const body = eq.filter((it) => [1, 2, 3].includes(int(it.definition.armorTypeId)) && int(it.definition.armorClass) != null);
  const shield = eq.find((it) => int(it.definition.armorTypeId) === 4);
  if (body.length > 1) check.ac.push("meerdere harnassen tegelijk gedragen");
  let base;
  if (body.length) {
    const a = body.reduce((x, y) => (int(y.definition.armorClass) > int(x.definition.armorClass) ? y : x)).definition;
    const t = int(a.armorTypeId), v = int(a.armorClass);
    const mam = arr(d.feats).some((f) => obj(f) && obj(f.definition) && /medium armor master/i.test(str(f.definition.name)));
    base = t === 1 ? v + M[1] : t === 2 ? v + Math.min(M[1], mam ? 3 : 2) : v;
  } else {
    base = 10 + M[1];
    const noDex = mods.some((m) => m.type === "ignore" && m.sub === "unarmored-dex-ac-bonus"); // bv. Tortle: vaste 17
    let natural = false;
    for (const m of of("set", "unarmored-armor-class")) {
      if (shield && m.statId === 5) continue; // Monk: Unarmored Defense niet met schild
      const start = m.value >= 10 ? m.value : 10 + (m.value || 0);
      const v = start + (noDex ? 0 : M[1]) + (m.statId >= 1 && m.statId <= 6 ? M[m.statId - 1] : 0);
      if (v > base) { base = v; natural = m.value >= 10; }
    }
    if (natural) check.ac.push(tt("rules.ddb.natural"));
    // Mage Armor is een spell, geen modifier: als de character het kent en geen harnas draagt, even nagaan
    const spellNames = lists.flat().map((x) => (obj(x) && obj(x.definition) ? str(x.definition.name) : ""));
    if (spellNames.some((n) => /^mage armor$/i.test(n))) check.ac.push(tt("rules.ddb.mageArmor"));
  }
  let ac = base + (shield ? int(shield.definition.armorClass) ?? 2 : 0) + sum("bonus", "armor-class") + (body.length ? sum("bonus", "armored-armor-class") : shield ? 0 : sum("bonus", "unarmored-armor-class")); // bv. Bracers of Defense: geen harnas én geen schild
  if (mods.some((m) => /armor-class|natural-armor/.test(m.sub) && !["bonus", "set"].includes(m.type)) || mods.some((m) => m.type === "set" && m.sub === "armor-class"))
    check.ac.push(tt("rules.ddb.feature"));
  if (orphans.some((m) => /armor-class/.test(m.sub))) check.ac.push(tt("rules.ddb.orphan"));
  // handmatige AC in D&D Beyond (characterValues, niet aan een item gekoppeld): 1 = vaste AC, 2/3 = magische/overige bonus
  const cv = (t) => arr(d.characterValues).filter((v) => obj(v) && int(v.typeId) === t && int(v.value) != null && v.valueId == null).map((v) => int(v.value));
  const acSet = cv(1), acPlus = [...cv(2), ...cv(3)];
  if (acSet.length) { ac = acSet[acSet.length - 1]; check.ac.push(tt("rules.ddb.acSet")); }
  else if (acPlus.length) { ac += acPlus.reduce((a, b) => a + b, 0); check.ac.push(tt("rules.ddb.acPlus")); }
  if (cv(4).length || arr(d.characterValues).some((v) => obj(v) && [1, 2, 3, 4].includes(int(v.typeId)) && v.valueId != null))
    check.ac.push(tt("rules.ddb.acItem"));

  // ---------- HP ----------
  const hpPer = of("bonus", "hit-points-per-level");
  let max;
  const ov = int(d.overrideHitPoints);
  if (ov != null && ov > 0) max = ov;
  else {
    let b = int(d.baseHitPoints);
    if (b == null) {
      const hd = (c) => int(c.definition.hitDice) || 8;
      b = classes.reduce((a, c, i) => a + (i === 0 ? hd(c) + (int(c.level) - 1) * (hd(c) / 2 + 1) : int(c.level) * (hd(c) / 2 + 1)), 0);
      check.hp.push(tt("rules.ddb.noBase"));
    }
    max = b + (int(d.bonusHitPoints) || 0) + M[2] * L + hpPer.reduce((a, m) => a + val(m), 0) * L + sum("bonus", "hit-points");
    if (classes.length > 1 && hpPer.some((m) => m.cat === "class")) check.hp.push(tt("rules.ddb.hpMulti"));
  }
  if (!(max > 0)) { check.hp.push(tt("rules.ddb.hpNone")); max = 0; }

  // ---------- spell slots ----------
  const casters = [];
  let pact = 0;
  for (const c of classes) {
    const lv = int(c.level), nm = cname(c);
    if (/warlock/i.test(nm)) { pact = lv; continue; }
    const sc = obj(c.subclassDefinition) ? c.subclassDefinition : null;
    const rules = c.definition.canCastSpells && obj(c.definition.spellRules) ? c.definition.spellRules : sc && sc.canCastSpells && obj(sc.spellRules) ? sc.spellRules : null;
    const div = rules ? int(rules.multiClassSpellSlotDivisor) : null;
    if (rules && div > 0) casters.push({ lv, div, up: /artificer/i.test(nm), table: arr(rules.levelSpellSlots) });
  }
  let slotRow = [];
  if (casters.length === 1) {
    const c = casters[0], row = c.table[c.lv];
    if (Array.isArray(row) && row.length) slotRow = row.map((x) => int(x) || 0);
    else { const cl = c.div === 1 ? c.lv : c.up || c.lv >= c.div ? Math.ceil(c.lv / c.div) : 0; slotRow = MULTI[clamp(cl, 0, 20)]; }
  } else if (casters.length > 1) {
    const cl = casters.reduce((a, c) => a + (c.up ? Math.ceil(c.lv / c.div) : Math.floor(c.lv / c.div)), 0);
    slotRow = MULTI[clamp(cl, 0, 20)];
  }
  const slotMax = Array(10).fill(0);
  slotRow.slice(0, 9).forEach((n, i) => (slotMax[i + 1] = clamp(n, 0, 9)));
  const pk = pactSlots(pact); // RE3: Pact Magic apart (komt terug na een short rest), niet bij de gewone slots

  // spells per level
  const rows = [];
  for (const list of lists) {
    const r = list.map(spellRow).filter(Boolean);
    const used = r.filter((x) => x.use);
    rows.push(...(used.length ? used : r)); // geen "prepared"-vlag gevonden → alles tonen
  }
  const levels = [];
  for (let l = 0; l <= 9; l++) {
    const sp = rows.filter((x) => x.lvl === l).map((x) => x.sp).filter((s, i, a) => a.findIndex((y) => y.n === s.n) === i);
    if (sp.length || (l && slotMax[l])) levels.push({ lvl: l, max: l ? slotMax[l] : 0, spells: sp });
  }
  const slots = levels.filter((l) => l.lvl && l.max).map((l) => ({ lvl: l.lvl, max: l.max, left: l.max, spells: l.spells.map((s) => s.n).join(", ") }));
  // Pact-regel: spells van de levels t/m het pact-level zonder eigen slotregel (pure warlock: Hex, Misty Step, …)
  const pactSp = pk ? levels.filter((l) => l.lvl && l.lvl <= pk.lvl && !l.max).flatMap((l) => l.spells.map((x) => x.n)).filter((v, i, a) => a.indexOf(v) === i).join(", ") : "";
  const pactObj = pk ? { lvl: pk.lvl, max: pk.max, left: pk.max, spells: pactSp } : null;
  const caster = classes.find((c) => int(c.definition.spellCastingAbilityId) >= 1) ||
    classes.find((c) => obj(c.subclassDefinition) && int(c.subclassDefinition.spellCastingAbilityId) >= 1);
  const castAb = caster ? int(caster.definition.spellCastingAbilityId) || int(caster.subclassDefinition.spellCastingAbilityId) : 0;
  const spellMod = castAb >= 1 && castAb <= 6 ? M[castAb - 1] : null;
  const dcPlus = sum("bonus", "spell-save-dc"), atkPlus = sum("bonus", "spell-attacks"); // bv. Rod of the Pact Keeper

  // ---------- resources (beperkt gebruik met short/long rest) ----------
  const res = [], seen = new Set();
  const addRes = (n, max, rest) => { const k = n.toLowerCase(); if (!n || !(max > 0) || seen.has(k)) return; seen.add(k); res.push({ n, max: Math.min(max, 999), left: Math.min(max, 999), rest }); };
  for (const list of Object.values(obj(d.actions) ? d.actions : {})) for (const a of arr(list)) {
    const lu = obj(a) && obj(a.limitedUse) ? a.limitedUse : null, rest = lu && RESET[int(lu.resetType)];
    if (rest) addRes(str(a.name, 80), computeUses(lu, M, prof), rest);
  }
  // klasse-pools die niet als action in de data staan
  const lvOf = (re) => classes.filter((c) => re.test(cname(c))).reduce((a, c) => a + int(c.level), 0);
  const sorc = lvOf(/sorcerer/i), monk = lvOf(/monk/i), pal = lvOf(/paladin/i);
  const known = (re) => res.some((r) => re.test(r.n));
  if (sorc >= 2 && !known(/sorcery/i)) addRes("Sorcery Points", sorc, "Long Rest");
  if (monk >= 2 && !known(/\bki\b/i)) addRes("Ki Points", monk, "Short Rest");
  if (pal >= 1 && !known(/lay on hands/i)) addRes("Lay on Hands", 5 * pal, "Long Rest");

  // ---------- aanvallen (gedragen wapens) ----------
  const attacks = [];
  for (const it of eq) {
    const df = it.definition;
    if (!(str(df.filterType) === "Weapon" || int(df.attackType)) || !obj(df.damage)) continue;
    const props = arr(df.properties).map((p) => (obj(p) ? str(p.name, 30).toLowerCase() : ""));
    const am = int(df.attackType) === 2 ? M[1] : props.includes("finesse") ? Math.max(M[0], M[1]) : M[0];
    const pr = has("proficiency", int(df.categoryId) === 2 ? "martial-weapons" : "simple-weapons") || has("proficiency", slug(df.type)) || has("proficiency", slug(df.name));
    const magic = arr(df.grantedModifiers).filter((m) => obj(m) && m.type === "bonus" && m.subType === "magic").reduce((a, m) => a + (int(m.value) || 0), 0);
    const dm = am + magic;
    attacks.push({ n: str(df.name), hit: sg(am + (pr ? prof : 0) + magic), dmg: `${str(df.damage.diceString, 20)}${dm ? sg(dm) : ""} ${str(df.damageType, 20)}`.trim(), notes: props.filter(Boolean).join(", ") });
  }

  // ---------- tekst ----------
  const race = obj(d.race) ? d.race : {};
  const names = (xs) => xs.map((x) => (obj(x) && obj(x.definition) ? str(x.definition.name, 80) : "")).filter((v, i, a) => v && a.indexOf(v) === i);
  const feats = [
    ["Class features", names(classes.flatMap((c) => arr(c.classFeatures).filter((f) => obj(f) && obj(f.definition) && (int(f.definition.requiredLevel) || 0) <= int(c.level))))],
    ["Racial traits", names(arr(race.racialTraits).filter((t) => !(obj(t) && obj(t.definition) && t.definition.hideInSheet)))],
    ["Feats", names(arr(d.feats))],
  ].filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join(", ")}`).join("\n");
  const sub = classes.map((c) => (obj(c.subclassDefinition) ? str(c.subclassDefinition.name, 60) : "")).filter(Boolean);
  const sense = ["darkvision", "blindsight", "tremorsense", "truesight"].map((s) => [s, Math.max(0, ...mods.filter((m) => m.sub === s && /^set/.test(m.type)).map((m) => m.value || 0))]).filter(([, v]) => v > 0);
  const walk = int(obj(race.weightSpeeds) && obj(race.weightSpeeds.normal) ? race.weightSpeeds.normal.walk : null) ?? 30;
  const speed = walk + sum("bonus", "speed") + sum("bonus", "speed-walking") + (!body.length && !shield ? sum("bonus", "unarmored-movement") : 0);
  // de Worker geeft alleen hasAvatar door (de url zelf blijft op de server)
  const hasAvatar = d.hasAvatar === true || (obj(d.decorations) && typeof d.decorations.avatarUrl === "string" && !!d.decorations.avatarUrl);

  const sheet = {
    name: str(d.name), cls: classes.map((c) => `${cname(c)} ${int(c.level)}`).join(" / "), race: str(race.fullName) || str(race.baseName) || str(race.baseRaceName),
    ac: clamp(ac, 0, 40), max: clamp(max, 0, 9999), initBonus, dex: M[1], speed: `${speed} ft.`, prof: sg(prof),
    ab, saves, saveNotes: "", skills,
    passive: { per: 10 + skillVal.Perception + sum("bonus", "passive-perception"), ins: 10 + skillVal.Insight + sum("bonus", "passive-insight"), inv: 10 + skillVal.Investigation + sum("bonus", "passive-investigation") }, // SP5 (Observant e.d.)
    senses: [...sense.map(([s, v]) => `${s} ${v} ft.`), `passive Perception ${10 + skillVal.Perception + sum("bonus", "passive-perception")}`].join(", "),
    attacks, levels, spellDC: spellMod == null ? "" : String(8 + prof + spellMod + dcPlus), spellAtk: spellMod == null ? "" : sg(prof + spellMod + atkPlus), spellAbility: castAb ? SHORT[castAb - 1] : "",
    features: [sub.length ? `Subclass: ${sub.join(", ")}` : "", feats, pact ? tt("rules.ddb.pact") : ""].filter(Boolean).join("\n"),
    casting: slots.length || pactObj ? { slots, daily: [], ...(pactObj ? { pact: pactObj } : {}) } : null, res,
    dr: drOf(mods), // SP2: altijd aanwezig bij een link-sheet ({} = geen), een PDF-sheet heeft het niet
  };
  const id = int(d.id);
  return { sheet, id: id > 0 ? String(id) : null, hasAvatar, check };
}

/**
 * Bestaande speler bijwerken met een nieuwe sheet. Overschrijft naam, ras, portret, AC, max HP, Dex, initBonus,
 * sheet en ddbId; houdt verbruik aan (schade, verbruikte slots/resources), temp HP, death saves en condities.
 * Geeft de wijzigingen als korte tekst terug (voor de melding).
 */
export function mergeSheet(t, f) {
  const ch = [];
  const keep = (oMax, oLeft, nMax) => clamp(nMax - Math.max(0, (oMax || 0) - (oLeft ?? oMax ?? 0)), 0, nMax);
  if (f.name && t.name && f.name !== t.name) ch.push(tt("rules.ddb.name", { from: t.name, to: f.name })); // anders stil hernoemd (SP1)
  const oc = t.sheet && t.sheet.cls, nc = f.sheet && f.sheet.cls;
  if (oc && nc && oc !== nc) ch.push(`${oc} → ${nc}`);
  if (f.ac && t.ac !== f.ac) ch.push(`AC ${t.ac || "?"} → ${f.ac}`);
  // max HP van de sheet is zonder tijdelijke effecten (Aid): die blijven er bovenop
  const oMax = baseMax(t), extra = (t.max || 0) - oMax;
  if (f.max && oMax !== f.max) ch.push(`max HP ${oMax || "?"} → ${f.max}`);
  if (f.max) { if (t.hp == null) t.hp = t.max; setMax(t, f.max + extra); }
  if (f.ac) t.ac = f.ac;
  // PDF-sheet (geen dr) na een link-sheet: de laatst bekende resistances van de link blijven de basis, anders tellen ze
  // bij een latere link-update als eigen toevoeging
  if (f.sheet && !f.sheet.dr && t.sheet && t.sheet.dr) f.sheet = { ...f.sheet, dr: t.sheet.dr };
  const dr = drMerge(t.dr, t.sheet, f.sheet); // vóór de sheet wisselt (eigen toevoegingen blijven)
  const dd = drDiff(t.dr, dr);
  if (dd) { ch.push(dd); if (dr) t.dr = dr; else delete t.dr; }
  for (const k of ["name", "race", "dex", "initBonus", "sheet", "ddbId"]) if (f[k] !== undefined) t[k] = f[k];
  if (f.img) t.img = f.img;
  if (f.casting) {
    const old = t.casting && Array.isArray(t.casting.slots) ? t.casting : null;
    const sig = (c) => (c ? c.slots.map((s) => s.lvl + ":" + s.max).join() + (c.pact ? `|p${c.pact.lvl}:${c.pact.max}` : "") : "");
    if (sig(old) !== sig(f.casting)) ch.push("spell slots");
    const fp = f.casting.pact, op = old && old.pact;
    t.casting = {
      slots: f.casting.slots.map((s) => { const o = old && old.slots.find((x) => x.lvl === s.lvl); return { ...s, left: o ? keep(o.max, o.left, s.max) : s.max }; }),
      daily: f.casting.daily && f.casting.daily.length ? f.casting.daily : old ? old.daily || [] : [],
      ...(fp ? { pact: { ...fp, left: op ? keep(op.max, op.left, fp.max) : fp.max } } : {}),
    };
  }
  if (Array.isArray(f.res)) {
    const old = Array.isArray(t.res) ? t.res : [];
    t.res = f.res.map((r) => { const o = old.find((x) => x.n.toLowerCase() === r.n.toLowerCase()); return { ...r, left: o ? keep(o.max, o.left, r.max) : r.max }; });
  }
  return ch;
}

/**
 * SP1: Bijwerken vanuit de Party (zonder formulier om te corrigeren). Neemt alleen de sheet over; ras blijft (de DM kan
 * het zelf gekozen hebben). Onzekere AC/max HP (`check`) gaan niet over een bestaande waarde heen: die is eerder al
 * gecontroleerd. Geeft `{ f, kept }`: `f` voor mergeSheet, `kept` korte teksten voor het bevestigvak.
 */
export function partyUpdate(m, got) {
  const sh = got.sheet, ck = got.check || {}, kept = [];
  const f = { name: sh.name, ac: int(sh.ac) || 0, max: int(sh.max) || 0, dex: sh.dex, initBonus: sh.initBonus, sheet: sh,
    ddbId: got.id || m.ddbId, img: got.img || null, casting: sh.casting || null, res: sh.res || [] };
  const old = { ac: int(m.ac) || 0, max: baseMax(m) || 0 };
  for (const [k, ckk, lbl] of [["ac", "ac", "AC"], ["max", "hp", "max HP"]]) {
    if (!f[k] || !arr(ck[ckk]).length || !old[k]) continue; // zeker, of nog geen waarde: gewoon overnemen
    if (f[k] !== old[k]) kept.push(tt("rules.ddb.kept", { what: lbl, sheet: String(f[k]), old: String(old[k]) }));
    f[k] = 0; // mergeSheet slaat 0 over
  }
  return { f, kept };
}

/**
 * Partylid bij een opgehaalde sheet: eerst op D&D Beyond-id; anders op naam, maar alleen als die naam precies één keer
 * voorkomt en dat lid niet al aan een ánder D&D Beyond-character gekoppeld is.
 */
/**
 * SP3: wat "+ Speler" doet als de naam of sheet bij een partylid hoort. add = nieuw lid/losse speler,
 * seat = aan tafel met de bewaarde stand, updSeat = sheet bijwerken en aan tafel, upd = alleen bijwerken (zit al aan tafel),
 * none = niets (zit al aan tafel, geen sheet). Nooit een tweede deelnemer voor hetzelfde lid.
 */
export const seatPlan = (match, here, sheet) => !match ? "add" : here ? (sheet ? "upd" : "none") : sheet ? "updSeat" : "seat";

export function findMember(party, id, name) {
  const P = arr(party).filter(obj);
  if (id) { const m = P.find((x) => x.ddbId === id); if (m) return m; }
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  const same = P.filter((x) => String(x.name || "").trim().toLowerCase() === n);
  return same.length === 1 && !(id && same[0].ddbId && same[0].ddbId !== id) ? same[0] : null;
}

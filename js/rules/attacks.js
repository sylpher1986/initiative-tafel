// Acties uit een statblock compact maken voor de monsterkaart: to hit, damage (met type) en save-DC.
// Puur: geen DOM. Statblocktekst kan uit een import komen; de UI escapet alles wat hieruit komt.
import { d } from "./dice.js";
import { applyDamage, critAtZero, merge } from "./combat.js";

const ABIL = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };
const DICE = String.raw`(\d+d\d+(?:\s*[+−-]\s*\d+)?)`;
const TYPE = String.raw`([a-z]+(?: or [a-z]+)?)`; // "lightning or thunder" (Djinni)
const DMG_RE = new RegExp(String.raw`(?:\d+\s*)?\(` + DICE + String.raw`\)\s*` + TYPE + String.raw`\s+damage`, "gi");
const FLAT_RE = new RegExp(String.raw`^Hit:\s*(\d+)\s+` + TYPE + String.raw`\s+damage`, "i");
const SAVE = "(strength|dexterity|constitution|intelligence|wisdom|charisma)";
const DC_RE = new RegExp(String.raw`DC\s*(\d+)\s+` + SAVE + String.raw`(?:\s+or\s+` + SAVE + String.raw`)?\s+saving throw`, "i");

/** "2d10 + 6" → "2d10+6" (ook met het echte minteken) */
export const cleanExpr = (e) => String(e).replace(/−/g, "-").replace(/\s/g, "");

/** Naam zonder "(Recharge 5–6)" of "(1/Day)": dat staat al op de recharge-chip */
const shortName = (n) => String(n).replace(/\s*\((?:recharge[^)]*|\d+\/day[^)]*|costs? \d+ actions?)\)/gi, "").trim() || String(n);

/**
 * Damage-delen: bij een aanval alleen de eerste worp na "Hit:" plus wat er met "plus" aan vastzit
 * ("17 (2d10 + 6) piercing damage plus 4 (1d8) acid damage"); "or …" (versatile, op afstand) blijft in het statblock.
 * Zonder "Hit:" (breath weapon, save-actie): de eerste worp in de tekst.
 */
function damage(t, isAtk) {
  const i = isAtk ? t.search(/Hit:/i) : 0;
  if (i < 0) return [];
  const part = t.slice(i);
  const out = [];
  let end = -1, alt = false;
  // vaste schade vooraan ("Hit: 1 piercing damage plus 7 (3d4) poison damage")
  const f = isAtk && part.match(FLAT_RE);
  if (f) { out.push({ flat: +f[1], type: f[2].toLowerCase() }); end = f[0].length; }
  for (const m of part.matchAll(DMG_RE)) {
    const gap = out.length ? part.slice(end, m.index) : "";
    end = m.index + m[0].length;
    if (!out.length || /^[\s,]*plus\s*$/i.test(gap) || (alt && /^[^.]*,\s*plus\s*$/i.test(gap))) {
      out.push({ e: cleanExpr(m[1]), type: m[2].toLowerCase() }); alt = false;
    } else if (/^[\s,]*or\s*$/i.test(gap)) alt = true; // "…, or 8 (1d10 + 3) … if used with two hands, plus 3 (1d6) fire": alternatief overslaan
    else break;
  }
  return out;
}

/** Eén actie → { n, hit, reach, dmg: [{e, type} | {flat, type}], dc: {n, ab} | null, multi, kind (melee/ranged/both), text } */
export function parseAction(name, text) {
  const t = String(text || "");
  const n = String(name || "");
  const hm = t.match(/([+-]\d+)\s+to hit/i);
  const hit = hm ? +hm[1] : null;
  const rm = t.match(/\b(reach \d+ ft\.|range \d+(?:\/\d+)? ft\.)/i);
  const dm = t.match(DC_RE);
  return {
    n: shortName(n), hit,
    reach: rm ? rm[1] : "",
    dmg: damage(t, hit !== null),
    dc: dm ? { n: +dm[1], ab: [dm[2], dm[3]].filter(Boolean).map((x) => ABIL[x.toLowerCase()]).join("/") } : null,
    multi: /^multiattack/i.test(n),
    kind: hit !== null ? atkKind(t) : "",
    text: t,
  };
}

/** Heeft iets om te rollen of een DC; anders hoort de actie alleen in het statblock */
export const useful = (a) => a.hit !== null || a.dc !== null || a.dmg.length > 0;

const cache = new WeakMap();

/**
 * Compacte acties van een monster (uit findMon):
 * main = Multiattack + acties en bonus actions met een worp of DC; other = alle reactions en legendary actions
 * (ook zonder worp: "Detect", "Parry" wil je wel zien). Per monster-object onthouden.
 */
export function monsterActions(m) {
  if (!m) return null;
  if (cache.has(m)) return cache.get(m);
  const list = (arr, tag) => (Array.isArray(arr) ? arr : []).filter(Array.isArray).map(([k, v]) => {
    const c = tag === "Legendary" && String(k).match(/\(costs? (\d+) actions?\)/i);
    return { ...parseAction(k, v), tag: c ? `${tag} · ${c[1]} LA` : tag };
  });
  const acts = [...list(m.a, ""), ...list(m.ba, "Bonus")];
  const res = {
    multi: acts.find((a) => a.multi) || null,
    main: acts.filter((a) => !a.multi && useful(a)),
    other: [...list(m.re, "Reaction"), ...list(m.l, "Legendary")],
  };
  if (!res.multi && !res.main.length && !res.other.length) return cache.set(m, null), null;
  cache.set(m, res);
  return res;
}

/** Damage-knop: "2d10+6:piercing|1d8:acid"; vaste delen tellen mee ("1:piercing|3d4:poison"). Alleen vaste schade: geen knop. */
export const dmgKey = (dmg) => (dmg.some((x) => x.e) ? partsKey(dmg) : "");
/** Alle delen als sleutel, ook alleen vaste schade ("1:piercing"): voor de aanval op een doel en save-acties */
export const partsKey = (dmg) => dmg.map((x) => `${x.e || x.flat}:${x.type}`).join("|");

/** Rolt een dmgKey: { parts: [{e, type, rolls, mod, total}], total } of null bij een onleesbare sleutel */
export function rollDmg(key, roll) {
  const parts = [];
  for (const p of String(key).split("|")) {
    const [e, type = ""] = p.split(":");
    const r = /^\d+$/.test(e) ? { rolls: [], mod: +e, total: +e } : roll(e);
    if (!r) return null;
    parts.push({ e, type, rolls: r.rolls, mod: r.mod, total: r.total });
  }
  return parts.length ? { parts, total: parts.reduce((a, b) => a + b.total, 0) } : null;
}

/** Save-actie met schade (breath weapon, Fire Ray): kan via het AoE-paneel op meerdere doelen */
export const isSaveAoe = (a) => !!a && a.hit === null && !!a.dc && a.dmg.length > 0;

/** Recharge-chip die bij een actie hoort (op naam, zonder "(Recharge 5–6)"); -1 als er geen is */
export const rcIndex = (rc, n) => (Array.isArray(rc) ? rc.findIndex((r) => r && String(r.n).toLowerCase() === String(n).toLowerCase()) : -1);

/**
 * Een save-actie klaarmaken voor het AoE-paneel: schade gerold, type, save-ability en DC uit de actie.
 * Delen met hetzelfde type als het eerste tellen samen; een ander type ("plus 2d6 fire") komt als hint (apart toepassen).
 * half = de tekst noemt halve schade bij een geslaagde save; anders is geslaagd = geen schade.
 * types = bekende damage types (anders type leeg, bijv. "lightning or thunder"). roll = rollExpr.
 */
export function actionAoe(a, roll, types = []) {
  if (!isSaveAoe(a)) return null;
  const r = rollDmg(partsKey(a.dmg), roll);
  if (!r) return null;
  const t0 = r.parts[0].type;
  const same = r.parts.filter((p) => p.type === t0), other = r.parts.filter((p) => p.type !== t0);
  const txt = (p) => (p.rolls.length ? `${p.e} [${p.rolls.join(", ")}] = ${p.total}` : String(p.total));
  return {
    dmg: Math.min(999, same.reduce((s, p) => s + p.total, 0)),
    type: types.includes(t0) ? t0 : "",
    ab: a.dc.ab.split("/")[0],
    dc: a.dc.n,
    half: /\bhalf (?:as much |(?:the|that)(?: [a-z]+)? )?damage/i.test(a.text),
    roll: same.map(txt).join(" + ") + (same.length > 1 ? ` = ${same.reduce((s, p) => s + p.total, 0)}` : ""),
    extra: other.map((p) => `plus ${p.e} ${p.type}`).join(", "),
  };
}

/* ---------- aanval op één doel: to hit tegen AC, damage met crit (5e 2014) ---------- */

/**
 * d20 + bonus; adv 1 = advantage (hoogste), -1 = disadvantage (laagste), 0 = normaal. nat = de d20 die telt.
 * Er worden altijd twee d20's gerold (dd), zodat wisselen van modus of doel dezelfde dobbelstenen houdt (withAdv).
 */
export function rollAttack(bonus, adv = 0, rng = Math.random) {
  return withAdv({ dd: [d(20, rng), d(20, rng)], bo: bonus }, adv);
}

/** Dezelfde worp met een andere modus: d = de getoonde dobbelstenen (één bij normaal) */
export function withAdv(r, adv) {
  const [a, b] = r.dd, v = adv > 0 ? 1 : adv < 0 ? -1 : 0;
  const nat = !v ? a : v > 0 ? Math.max(a, b) : Math.min(a, b);
  return { dd: r.dd, d: v ? [a, b] : [a], adv: v, nat, bo: r.bo, tot: nat + r.bo };
}

/** Melee of ranged uit de aanvalstekst; "Melee or Ranged …" = beide */
export const atkKind = (t) => {
  const m = /\bmelee\b/i.test(t), r = /\branged\b/i.test(t);
  return m && r ? "both" : m ? "melee" : r ? "ranged" : "";
};

// PHB 2014, appendix A en hoofdstuk 9
const DIS_BY = ["Blinded", "Poisoned", "Prone", "Restrained"]; // aanvaller → disadvantage
const ADV_TGT = ["Blinded", "Paralyzed", "Petrified", "Restrained", "Stunned", "Unconscious"]; // doel → advantage

/**
 * Advantage/disadvantage van een aanval uit de condities van aanvaller en doel.
 * kind = atkKind van de aanval (Prone-doel: advantage binnen 5 ft, disadvantage op afstand).
 * Advantage en disadvantage samen heffen elkaar op (v = 0), ongeacht het aantal bronnen.
 * Geeft { v: 1|0|-1, adv: [reden], dis: [reden], hint: [reden] }; hint = hangt af van wat de app niet weet.
 */
export function atkAdv(by, tgt, kind = "") {
  const adv = [], dis = [], hint = [];
  const bc = (by && by.cond) || [], tc = (tgt && tgt.cond) || [];
  for (const k of DIS_BY) if (bc.includes(k)) dis.push(`${by.name} ${k}`);
  if (bc.includes("Invisible")) adv.push(`${by.name} Invisible`);
  if (bc.includes("Frightened")) hint.push(`${by.name} Frightened: disadvantage als de bron in zicht is`);
  for (const k of ADV_TGT) if (tc.includes(k)) adv.push(`${tgt.name} ${k}`);
  if (tc.includes("Invisible")) dis.push(`${tgt.name} Invisible`);
  if (tc.includes("Prone")) {
    if (kind === "ranged") dis.push(`${tgt.name} Prone (op afstand)`);
    else {
      adv.push(`${tgt.name} Prone`);
      hint.push(`${tgt.name} Prone: advantage binnen 5 ft, disadvantage van verder weg`);
    }
  }
  return { v: adv.length && !dis.length ? 1 : dis.length && !adv.length ? -1 : 0, adv, dis, hint };
}

/**
 * Damage van een dmgKey rollen, met de extra dice voor een crit alvast erbij (xr), zodat "Kritiek" aan/uit
 * geen nieuwe worp nodig heeft. Vaste delen ("1:piercing") hebben geen dice en worden bij een crit niet verdubbeld.
 */
export function rollDmgCrit(key, roll) {
  const r = rollDmg(key, roll);
  if (!r) return null;
  return r.parts.map((p) => ({ ...p, xr: p.rolls.length ? (roll(p.e) || { rolls: [] }).rolls : [] }));
}

const sum = (a) => a.reduce((s, x) => s + x, 0);

/** Eén damage-deel als tekst: "2d10+6 [7, 3 | 4, 9] +6 = 29 piercing" (| = extra crit-dice) */
export function partText(p, crit) {
  if (!p.rolls.length) return `${p.total} ${p.type}`;
  const dice = `[${p.rolls.join(", ")}${crit && p.xr.length ? ` | ${p.xr.join(", ")}` : ""}]`;
  return `${p.e} ${dice} = ${partRaw(p, crit)} ${p.type}`;
}
function partRaw(p, crit) { return Math.max(0, p.total + (crit ? sum(p.xr) : 0)); }

/**
 * Uitslag van een aanval op een doel.
 * atk = rollAttack-resultaat, ac = effectieve AC van het doel, parts = rollDmgCrit, modes = { type: 1|0.5|2|0 }.
 * force: { hit: true } = "Toch raak" (DM beslist), { crit: true|false } = crit aan/uit (bijv. paralyzed doel binnen 5 ft).
 * Natuurlijke 20 raakt altijd en is een crit; natuurlijke 1 mist altijd.
 * Resistance/vulnerability per type na het optellen van dat type (PHB: per damage type), naar beneden afgerond.
 */
export function atkResult(atk, ac, parts, modes = {}, force = {}) {
  const natHit = atk.nat === 20 || (atk.nat !== 1 && atk.tot >= ac);
  const hit = natHit || !!force.hit;
  const crit = hit && (force.crit !== undefined ? !!force.crit : atk.nat === 20);
  const types = [];
  for (const p of parts || []) {
    let t = types.find((x) => x.type === p.type);
    if (!t) types.push((t = { type: p.type, raw: 0, mode: modes[p.type] ?? 1 }));
    t.raw += partRaw(p, crit);
  }
  types.forEach((t) => (t.dealt = Math.floor(t.raw * t.mode)));
  return { hit, natHit, crit, types, raw: sum(types.map((t) => t.raw)), dealt: hit ? sum(types.map((t) => t.dealt)) : 0 };
}

/** Tekst van de to-hit-worp: "d20 [14, 7] adv +11 = 25 vs AC 16" */
export const atkText = (atk, ac) => `d20 [${atk.d.join(", ")}]${atk.adv ? (atk.adv > 0 ? " adv" : " dis") : ""} ${atk.bo >= 0 ? "+" : "−"}${Math.abs(atk.bo)} = ${atk.tot}${ac != null ? ` vs AC ${ac}` : ""}`;

const MODE_STEP = { 0.5: "×½", 2: "×2", 0: "immuun" };
/** Logboek-oorzaak: "Bite (Dragon): d20 [14] +11 = 25 vs AC 16, raak; 2d10+6 [7, 3] +6 = 16 piercing + … → 21" */
export function atkWhy(label, atk, ac, parts, res) {
  const head = `${label}: ${atkText(atk, ac)}, ${res.crit ? "kritiek" : res.natHit ? "raak" : "toch raak"}`;
  const dm = parts.map((p) => partText(p, res.crit)).join(" + ");
  const md = res.types.filter((t) => t.mode !== 1).map((t) => `${t.type} ${MODE_STEP[t.mode]} = ${t.dealt}`).join(", ");
  return `${head}; ${dm}${md ? `, ${md}` : ""} → ${res.dealt}`;
}

/**
 * Schade van een aanval toepassen (ook op een kopie voor de preview). Eén aanval = één bron, dus één
 * concentration save op het totaal. Crit op een speler op 0 HP = twee death save failures (tenzij de schade
 * ≥ max HP is: dan dood via applyDamage).
 */
export function atkDamage(c, res) {
  if (!(c.kind === "pc" && c.hp <= 0 && res.crit && !(c.ds && c.ds.dead))) return applyDamage(c, res.dealt, 1, true);
  const temp = Math.min(c.temp || 0, res.dealt), rest = res.dealt - temp; // temp HP vangt eerst op, ook op 0 HP
  if (rest <= 0 || rest >= c.max) return applyDamage(c, res.dealt, 1, true);
  return merge(temp ? applyDamage(c, temp, 1, true) : { msgs: [], why: [] }, critAtZero(c));
}

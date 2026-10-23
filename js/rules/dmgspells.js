// Schade-spells met een save (RE18, 5e 2014): parser over de SRD-spelltekst, dobbelstenen per slot of characterlevel.
// De tabel zelf staat vooraf gegenereerd in js/rules/dmgtable.js (tools/dmg_spells.mjs); tests bewaken dat hij klopt.
// Puur: geen DOM.
import { DTYPES } from "./aoe.js";
import { rollExpr, HD_RE } from "./dice.js";
import { pcLevel } from "./encounters.js";
import { keys, splitSpells } from "./spells.js";

const AB = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };

/**
 * Spells met "saving throw" en schadedobbelstenen in de tekst die geen schade-spell voor dit paneel zijn:
 * de save gaat over iets anders (Web: losbranden, Heat Metal: laten vallen) of schade is een bijzaak of straf (Geas, Dream).
 */
export const SKIP = ["Bestow Curse", "Contact Other Plane", "Control Water", "Dream", "Earthquake", "Feeblemind", "Geas", "Heat Metal", "Storm of Vengeance", "Web", "Weird"];
// Earthquake: de schade komt van instortende gebouwen (DEX), de CON-save in de tekst is voor concentratie.
// Niet herkend en bewust niet met de hand toegevoegd: Delayed Blast Fireball ("base damage is 12d6", groeit per ronde).

const dice = (s) => String(s).replace(/l0\b/g, "10").replace(/\s+/g, "");

/**
 * Eén SRD-spell ({ n, lv, x, h, conc }) → schade-spell of null.
 * { n, lv, ab, half, dice, type, up, cant, x: [{ dice, type }], conc }
 * up = extra dobbelstenen per slot boven lv (op het eerste deel), cant = cantrip die schaalt op 5/11/17,
 * x = extra delen met een ander type (Flame Strike radiant, Ice Storm cold): die past de DM apart toe;
 * alt = ander type naar keuze van de caster (Spirit Guardians necrotic als hij evil is).
 */
export function parseDmgSpell(s) {
  if (!s || SKIP.includes(s.n)) return null;
  const txt = (s.x || []).join(" "), hi = (s.h || []).join(" ");
  const sv = txt.match(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/i);
  if (!sv) return null;
  const re = /(\d+d(?:\d+|l0)(?:\s*\+\s*\d+)?) (\w+) damage/gi;
  const parts = [];
  // eerste zin met schade: daarin alle delen ("4d6 fire damage and 4d6 radiant damage")
  const first = txt.split(/(?<=\.)\s+/).find((z) => re.test(z) && !(re.lastIndex = 0));
  if (!first) return null;
  let alt = null, end = 0;
  for (const m of first.matchAll(re)) {
    const type = m[2].toLowerCase(), between = first.slice(end, m.index);
    end = m.index + m[0].length;
    if (!DTYPES.includes(type) || parts.some((p) => p.type === type)) continue;
    // "3d8 radiant damage (if you are good …) or 3d8 necrotic damage (if you are evil)": ander type, geen extra deel
    if (parts.length && /\bor\b/.test(between) && !/\band\b/.test(between)) { alt = alt || type; continue; }
    parts.push({ dice: dice(m[1]), type });
  }
  if (!parts.length) return null;
  const up = s.lv > 0 ? hi.match(/damage[^.]*?increases? by (\d+d(?:\d+|l0))\b/i) : null;
  const cant = s.lv === 0 && /damage increases by \d+d/i.test(txt);
  return {
    n: s.n, lv: s.lv | 0, ab: AB[sv[1].toLowerCase()], half: /half as much damage/i.test(txt),
    dice: parts[0].dice, type: parts[0].type, up: up ? dice(up[1]) : null, cant, x: parts.slice(1), ...(alt ? { alt } : {}), conc: !!s.conc,
  };
}

/** Alle schade-spells uit de spelldata, op naam gesorteerd (bron voor dmgtable.js) */
export const buildDmgTable = (spells) => spells.map(parseDmgSpell).filter(Boolean).sort((a, b) => a.n.localeCompare(b.n));

/** "8d6" + n keer "1d6" → "9d6"; "10d6+40" + "3d6" → "13d6+40". Ander dobbelsteentype: "8d6+1d8" (komt in de SRD niet voor) */
export function addDice(base, extra, n) {
  if (!extra || !(n > 0)) return base;
  const a = String(base).match(HD_RE), b = String(extra).match(HD_RE);
  if (a && b && a[2] === b[2]) return `${+a[1] + n * +b[1]}d${a[2]}${a[3] || ""}`;
  return `${base}+${n * +b[1]}d${b[2]}`;
}

/** Cantrip-schaling (PHB 2014): ×2 op characterlevel 5, ×3 op 11, ×4 op 17 */
export const cantripMul = (lvl) => (lvl >= 17 ? 4 : lvl >= 11 ? 3 : lvl >= 5 ? 2 : 1);

/**
 * Dobbelstenen voor deze cast. slot = gebruikt slot-level (upcast), lvl = characterlevel (cantrips; onbekend = basis).
 * → "9d6"; extra delen blijven op hun basis (upcast hoort bij het eerste deel, Flame Strike: "naar keuze").
 */
export function spellDice(sp, slot, lvl) {
  if (!sp) return "";
  if (sp.lv === 0) { const m = String(sp.dice).match(HD_RE), k = sp.cant ? cantripMul(lvl | 0) : 1; return m ? `${+m[1] * k}d${m[2]}${m[3] || ""}` : sp.dice; }
  return addDice(sp.dice, sp.up, Math.max(0, (slot | 0) - sp.lv));
}

/** Dobbelsteenveld "XdY+Z" (ook "2d6 + 3", "−", of alleen een getal) → rollExpr-vorm, of null bij onzin */
export function normDice(v) {
  const s = String(v || "").toLowerCase().replace(/−/g, "-").replace(/\s+/g, "").replace(/^d/, "1d");
  if (/^\d{1,3}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})d(\d{1,3})([+-]\d{1,3})?$/);
  return m && +m[1] >= 1 && +m[2] >= 2 ? `${+m[1]}d${+m[2]}${m[3] || ""}` : null;
}

/** Rol "8d6" of "3d10+4" (of een vast getal) → { e, rolls, tot } of null; tot geklemd op 0..999 */
export function rollDice(v, rng = Math.random) {
  const e = normDice(v);
  if (!e) return null;
  if (/^\d+$/.test(e)) return { e, rolls: [], mod: +e, tot: Math.min(999, +e) };
  const r = rollExpr(e, rng);
  return { e, rolls: r.rolls, mod: r.mod, tot: Math.max(0, Math.min(999, r.total)) };
}
/** "8d6 = 29 (6 5 1 4 3 2 6 2)", met "+4" erachter bij een vaste bonus */
export const diceText = (r) => (!r ? "" : !r.rolls.length ? String(r.tot) : `${r.e} = ${r.tot} (${r.rolls.join(" ")}${r.mod ? ` ${r.mod > 0 ? "+" : "−"}${Math.abs(r.mod)}` : ""})`);

/** Zoeken: beginletters eerst, dan deel van de naam; kleine letters, zonder bezitsvorm-apostrof */
export function findDmgSpells(table, q, max = 6) {
  const k = String(q || "").toLowerCase().replace(/[’']/g, "").trim();
  if (!k) return [];
  const nm = (s) => s.n.toLowerCase().replace(/[’']/g, "");
  const a = table.filter((s) => nm(s).startsWith(k) || nm(s).split(" ").some((w) => w.startsWith(k)));
  const b = table.filter((s) => !a.includes(s) && nm(s).includes(k));
  return [...a, ...b].slice(0, max);
}

/** Characterlevel van een speler (sheet "Fighter 5 / Wizard 2" of eigen veld), of van een monster ("9th-level spellcaster") */
export function casterLevel(c, m) {
  if (!c) return 0;
  if (c.kind === "pc") return pcLevel(c) || 0;
  const txt = m ? [...(m.t || []), ...(m.a || [])].map((r) => r[1]).join("\n") : "";
  const hit = txt.match(/(\d+)(?:st|nd|rd|th)-level spellcaster/i);
  return hit ? Math.min(20, +hit[1]) : 0;
}

/**
 * Schade-spells die deze caster kent: speler uit de sheet-levels, iedereen uit slots/Pact/x/day (monster-statblock).
 * Op level gesorteerd, max `max`. table = DMG_SPELLS.
 */
export function ownDmgSpells(c, table, max = 6) {
  if (!c) return [];
  const k = c.casting || {}, names = [
    ...((c.sheet && c.sheet.levels) || []).flatMap((l) => (l.spells || []).map((x) => x.n)),
    ...(k.slots || []).flatMap((x) => splitSpells(x.spells || "")), ...(k.pact ? splitSpells(k.pact.spells || "") : []),
    ...(k.daily || []).flatMap((g) => g.items.flatMap((x) => splitSpells(x.n || ""))),
  ];
  const K = new Set(names.flatMap((n) => keys(n)));
  return table.filter((s) => keys(s.n).some((x) => K.has(x))).sort((a, b) => a.lv - b.lv || a.n.localeCompare(b.n)).slice(0, max);
}

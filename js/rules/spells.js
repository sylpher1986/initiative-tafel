// Afgeleide info uit statblocks: spellcasting, legendary, recharge; spellnamen en concentratie. Puur: alleen data erin, data eruit.
import { CONC } from "./conclist.js";

export const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

/** Niet-SRD-namen (PHB, D&D Beyond) → SRD-naam. Bezitsvormen ("Tasha's Hideous Laughter") gaan generiek, zie `keys`. */
const ALIAS = {
  "bigby's hand": "arcane hand",
  "mordenkainen's sword": "arcane sword",
  "nystul's magic aura": "arcanist's magic aura",
  "melf's acid arrow": "acid arrow",
  "eye bite": "eyebite", // tikfout in de SRD-hags (coven)
  "feeblemind": "befuddlement", // 2024 hernoemd; beide kanten op, zodat de andere editie ook gevonden wordt
  "befuddlement": "feeblemind",
};

/** "Cure Wounds*", "fireball (3rd level)", "Shield ’" → "cure wounds" / "fireball" / "shield" */
export const normSpell = (n) => String(n || "").replace(/[‘’`]/g, "'").replace(/\*|\(.*?\)|\[.*?\]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Opzoeksleutels in volgorde: exact, alias, zonder bezitsvorm vooraan ("tasha's hideous laughter" → "hideous laughter") */
export function keys(n) {
  const k = normSpell(n), out = [k];
  if (ALIAS[k]) out.push(ALIAS[k]);
  const x = k.match(/^[a-z]+'s (.+)$/);
  if (x) out.push(x[1]);
  return out;
}

/** Concentratie per editie: SRD uit de spelldata (conclist.js, gegenereerd) plus PHB-spells die niet in de SRD staan */
const CONC_SET = { 2014: new Set(CONC[2014]), 2024: new Set(CONC[2024]) };
const CONC_EXTRA = new Set(["aura of life", "aura of purity", "aura of vitality", "crown of madness", "grasping vine", "hex", "phantasmal force", "witch bolt"]);
/** Editie van deze spell op de D&D Beyond-sheet van een speler ("2014", "2024"), of "" (geen sheet, niet erop, onbekend) */
export function sheetEd(c, n) {
  if (!c || c.kind !== "pc" || !c.sheet || !Array.isArray(c.sheet.levels)) return "";
  const K = keys(n);
  for (const l of c.sheet.levels) for (const sp of (l && Array.isArray(l.spells) ? l.spells : [])) {
    if (sp && (sp.ed === "2014" || sp.ed === "2024") && keys(sp.n).some((k) => K.includes(k))) return sp.ed; // ook "Tasha's …" ↔ SRD-naam
  }
  return "";
}
/** Met welke editie rekent de app voor deze spell van deze caster: die van zijn sheet, anders de instelling */
export const edFor = (c, n, setting = "2014") => sheetEd(c, n) || setting;

/** Is dit een concentratie-spell volgens deze spellregels? Onbekende spells: nee. */
export const isConc = (n, ed = "2014") => keys(n).some((k) => (CONC_SET[ed] || CONC_SET[2014]).has(k)) || CONC_EXTRA.has(normSpell(n));


/** Splitst op komma's, maar niet binnen haakjes: "create food and water (can create wine), tongues" */
export function splitSpells(t) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of t) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && !depth) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Spellcasting uit een statblock.
 * casting = { slots:[{lvl,max,left,spells}], daily:[{label,items:[{n,max,left}]}] }
 */
export function castInfo(m) {
  if (!m) return null;
  const txt = [...(m.t || []), ...(m.a || [])].filter(([n]) => /spellcasting/i.test(n)).map(([, t]) => t).join("\n")
    + (m.text ? "\n" + m.text : "");
  if (!txt.trim()) return null;
  const slots = [...txt.matchAll(/(\d)(?:st|nd|rd|th)[- ]level \((\d+) slots?\)\s*:\s*([^\n]*)/gi)]
    .map((x) => ({ lvl: +x[1], max: +x[2], left: +x[2], spells: x[3].trim() }));
  const daily = [...txt.matchAll(/^[\s*•-]*(\d+)\/day( each)?\s*:\s*([^\n]+)/gim)].map((x) => {
    const n = +x[1], label = `${n}/day${x[2] ? " each" : ""}`;
    return { label, items: x[2] ? splitSpells(x[3]).map((sp) => ({ n: sp, max: n, left: n })) : [{ n: x[3].trim(), max: n, left: n }] };
  });
  return slots.length || daily.length ? { slots, daily } : null;
}

/** Legendary actions per ronde en legendary resistance per dag */
export function legInfo(m) {
  const out = { la: null, lr: null };
  if (!m) return out;
  if (m.l && m.l.length) {
    const x = (m.ld || "").match(/take (\d+|one|two|three|four|five) legendary/i);
    const w = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    const n = x ? (w[x[1].toLowerCase()] || +x[1]) : 3;
    out.la = { max: n, left: n };
  }
  const lr = (m.t || []).map((t) => t[0].match(/Legendary Resistance \((\d+)\/Day\)/i)).find(Boolean);
  if (lr) out.lr = { max: +lr[1], left: +lr[1] };
  return out;
}

/** Recharge-abilities: "(Recharge 5-6)", "(Recharge 6)", "(Recharges after a Short or Long Rest)" */
export function rcInfo(m) {
  if (!m) return [];
  const out = [], seen = new Set();
  const add = (n, min, rest) => { const k = n.trim(); if (!seen.has(k)) { seen.add(k); out.push({ n: k, min, rest: !!rest, ready: true }); } };
  for (const sec of ["t", "a", "ba", "re", "l"]) for (const [n] of (m[sec] || [])) {
    let x = n.match(/^(.*?)\s*\(Recharge (\d)(?:\s*[-–]\s*6)?\)/i);
    if (x) { add(x[1], +x[2]); continue; }
    x = n.match(/^(.*?)\s*\(Recharges? after a Short or Long Rest\)/i);
    if (x) add(x[1], null, true);
  }
  if (m.text) for (const x of m.text.matchAll(/^\s*([^.\n(]+?)\s*\(Recharge (\d)(?:\s*[-–]\s*6)?\)/gim)) add(x[1], +x[2]);
  return out;
}

/** Spells op een slot-level, met concentration-markering (ed = spellregels; D&D Beyond-sheets geven het zelf aan) */
export function spellsAtLevel(c, lvl, ed = "2014") {
  const sh = c.sheet && c.sheet.levels && c.sheet.levels.find((l) => l.lvl === lvl);
  if (sh) return sh.spells.map((sp) => ({ n: sp.n, conc: /concentration/i.test(sp.dur || "") }))
    .filter((v, i, a) => a.findIndex((x) => x.n === v.n) === i);
  const P = c.casting && c.casting.pact, sl = c.casting && (c.casting.slots.find((x) => x.lvl === lvl) || (P && P.lvl === lvl ? P : null)); // RE3: pure warlock
  return sl && sl.spells ? splitSpells(sl.spells).map((n) => ({ n: n.replace(/\*/g, "").trim(), conc: isConc(n, ed) })) : [];
}

/** Keuzelijst bij een slot: alle spells van dit level + concentration-spells van lagere levels (upcasting) */
export function pickList(c, lvl, ed = "2014") {
  const out = spellsAtLevel(c, lvl, ed).map((sp) => ({ ...sp, lv: lvl }));
  for (let l = lvl - 1; l >= 1; l--) {
    spellsAtLevel(c, l, ed).filter((sp) => sp.conc && !out.some((o) => o.n === sp.n)).forEach((sp) => out.push({ ...sp, lv: l }));
  }
  return out;
}

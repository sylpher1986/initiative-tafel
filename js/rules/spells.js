// Afgeleide info uit statblocks: spellcasting, legendary, recharge. Puur: alleen data erin, data eruit.

export const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

/** Concentration-spells (5e 2014) voor monsterstatblocks; D&D Beyond-sheets geven het zelf aan. */
export const CONC_SPELLS = new Set(["alter self", "animate objects", "antilife shell", "antimagic field", "arcane eye", "arcane hand", "aura of life", "aura of purity", "aura of vitality", "bane", "banishment", "barkskin", "beacon of hope", "bestow curse", "bigby's hand", "black tentacles", "blade barrier", "bless", "blur", "call lightning", "calm emotions", "clairvoyance", "cloudkill", "compulsion", "confusion", "conjure animals", "conjure celestial", "conjure elemental", "conjure fey", "conjure minor elementals", "conjure woodland beings", "control water", "control weather", "crown of madness", "dancing lights", "darkness", "detect evil and good", "detect magic", "detect poison and disease", "detect thoughts", "dispel evil and good", "divine favor", "dominate beast", "dominate monster", "dominate person", "enhance ability", "enlarge/reduce", "entangle", "enthrall", "evard's black tentacles", "eyebite", "faerie fire", "fear", "flame blade", "flaming sphere", "flesh to stone", "fly", "fog cloud", "forcecage", "gaseous form", "giant insect", "globe of invulnerability", "grasping vine", "greater invisibility", "guidance", "gust of wind", "haste", "heat metal", "heroism", "hex", "hold monster", "hold person", "holy aura", "hunter's mark", "hypnotic pattern", "incendiary cloud", "insect plague", "invisibility", "irresistible dance", "levitate", "locate creature", "locate object", "magic weapon", "major image", "maze", "moonbeam", "otiluke's resilient sphere", "otto's irresistible dance", "phantasmal force", "phantasmal killer", "polymorph", "protection from energy", "protection from evil and good", "ray of enfeeblement", "resilient sphere", "resistance", "reverse gravity", "scrying", "shield of faith", "silence", "silent image", "sleet storm", "slow", "spider climb", "spirit guardians", "stinking cloud", "stoneskin", "storm of vengeance", "suggestion", "sunbeam", "telekinesis", "true polymorph", "wall of fire", "wall of force", "wall of ice", "wall of stone", "wall of thorns", "web", "wind wall", "witch bolt"]);

export const cleanSpell = (n) => n.replace(/\*|\(.*?\)/g, "").trim().toLowerCase();

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

/** Spells op een slot-level, met concentration-markering */
export function spellsAtLevel(c, lvl) {
  const sh = c.sheet && c.sheet.levels && c.sheet.levels.find((l) => l.lvl === lvl);
  if (sh) return sh.spells.map((sp) => ({ n: sp.n, conc: /concentration/i.test(sp.dur || "") }))
    .filter((v, i, a) => a.findIndex((x) => x.n === v.n) === i);
  const sl = c.casting && c.casting.slots.find((x) => x.lvl === lvl);
  return sl && sl.spells ? splitSpells(sl.spells).map((n) => ({ n: n.replace(/\*/g, "").trim(), conc: CONC_SPELLS.has(cleanSpell(n)) })) : [];
}

/** Keuzelijst bij een slot: alle spells van dit level + concentration-spells van lagere levels (upcasting) */
export function pickList(c, lvl) {
  const out = spellsAtLevel(c, lvl).map((sp) => ({ ...sp, lv: lvl }));
  for (let l = lvl - 1; l >= 1; l--) {
    spellsAtLevel(c, l).filter((sp) => sp.conc && !out.some((o) => o.n === sp.n)).forEach((sp) => out.push({ ...sp, lv: l }));
  }
  return out;
}

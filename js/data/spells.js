// Spellbibliotheek voor de spell-uitleg: SRD 5.1 (2014) uit data/spells.json, pas geladen bij de eerste tik.
// Opzet voor later: één bestand per editie ({ ed, src, spells }); `findSpell` zoekt per editie.
// Naam-normalisatie en het splitsen van spell-lijsten zijn puur (testbaar zonder DOM).
import { splitSpells } from "../rules/spells.js";

/** Niet-SRD-namen (PHB, D&D Beyond) → SRD-naam. Bezitsvormen ("Tasha's Hideous Laughter") gaan generiek, zie `keys`. */
const ALIAS = {
  "bigby's hand": "arcane hand",
  "mordenkainen's sword": "arcane sword",
  "nystul's magic aura": "arcanist's magic aura",
  "melf's acid arrow": "acid arrow",
  "eye bite": "eyebite", // tikfout in de SRD-hags (coven)
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

/* ---------- bibliotheek (per editie) ---------- */
const lib = new Map();   // ed → { src, idx: Map(sleutel → spell) }
const busy = new Map();  // ed → lopende fetch

export function setSpells(doc) {
  if (!doc || !Array.isArray(doc.spells)) return;
  const ed = String(doc.ed || "2014");
  lib.set(ed, { src: String(doc.src || ""), idx: new Map(doc.spells.map((s) => [normSpell(s.n), s])) });
}
export const spellsLoaded = (ed = "2014") => lib.has(ed);
export const spellSrc = (ed = "2014") => lib.get(ed)?.src || "";

/** Laadt de spells van een editie één keer (ook bij gelijktijdige aanroepen); bij een fout volgende keer opnieuw */
export function loadSpells(ed = "2014", url = "data/spells.json") {
  if (lib.has(ed)) return Promise.resolve();
  if (!busy.has(ed)) {
    busy.set(ed, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Spells niet geladen (${r.status})`);
      return r.json();
    }).then((doc) => {
      setSpells(doc);
      if (!lib.has(ed)) throw new Error("ongeldige spelldata"); // anders blijft het paneel op "Laden…" staan
    }).finally(() => busy.delete(ed)));
  }
  return busy.get(ed);
}

/** Spell op naam (met aliassen), of null */
export function findSpell(n, ed = "2014") {
  const L = lib.get(ed);
  if (!L) return null;
  for (const k of keys(n)) { const s = L.idx.get(k); if (s) return s; }
  return null;
}

/* ---------- spell-lijsten in statblocks ---------- */
/** Regel met een spell-lijst in een Spellcasting-trait: "* 1st level (4 slots): ...", "At will: ...", "3/day each: ...", "Cantrips (at will): ..." */
const LIST_RE = /^(\s*(?:[*•-]\s*)?(?:cantrips?(?: \(at will\))?|\d(?:st|nd|rd|th)[- ]level(?: \([^)]*\))?|at will|\d+\/day(?: each)?)\s*:\s*)(.+)$/i;

/** Eén item uit een spell-lijst → naam (zonder sterretje en annotatie) + de rest: "polymorph* (self)" → ["polymorph", "* (self)"] */
export function spellItem(item) {
  const name = item.replace(/\s*\(.*\)\s*$/, "").replace(/\*+$/, "").trim();
  return [name, item.slice(name.length)];
}

/**
 * Splitst één tekstregel in stukken: [{ t: "tekst" }] of, bij een spell-lijst, prefix + per spell
 * { t: "detect magic", sp: "detect magic" }; komma's en annotaties ("*", " (self only)") zijn losse tekst.
 * Alle `t` achter elkaar = de regel (komma's genormaliseerd naar ", ").
 */
export function spellParts(line) {
  const m = String(line).match(LIST_RE);
  if (!m) return [{ t: line }];
  const out = [{ t: m[1] }];
  splitSpells(m[2]).forEach((item, i) => {
    if (i) out.push({ t: ", " });
    const [name, rest] = spellItem(item);
    if (normSpell(name)) out.push({ t: name, sp: normSpell(name) }); else out.push({ t: name });
    if (rest) out.push({ t: rest });
  });
  return out;
}

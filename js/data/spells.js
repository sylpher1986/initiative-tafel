// Spellbibliotheek voor de spell-uitleg, per editie één bestand ({ ed, src, spells }), pas geladen bij de eerste tik:
// SRD 5.1 (2014) in data/spells.json, SRD 5.2 (2024) in data/spells-2024.json. `findSpell` zoekt per editie.
// Naam-normalisatie en het splitsen van spell-lijsten zijn puur (testbaar zonder DOM).
import { splitSpells, normSpell, keys } from "../rules/spells.js";

export { normSpell, keys }; // naamlogica staat in rules/spells.js (ook nodig voor concentratie zonder geladen data)

/* ---------- bibliotheek (per editie) ---------- */
export const EDS = ["2014", "2024"];
const FILES = { 2014: "/data/spells.json", 2024: "/data/spells-2024.json" }; // absoluut: pagina onder /{taal}/initiative/
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
export function loadSpells(ed = "2014", url = FILES[ed]) {
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

/**
 * Welke editie tonen: de voorkeur als de spell daarin bestaat, anders de editie waarin hij wel staat.
 * eds = edities waarin de spell staat (voor de schakelaar 2014 | 2024; die verschijnt pas bij twee).
 */
export function pickEd(n, pref = "2014") {
  const eds = EDS.filter((e) => findSpell(n, e));
  return { ed: eds.includes(pref) ? pref : eds[0] || pref, eds };
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

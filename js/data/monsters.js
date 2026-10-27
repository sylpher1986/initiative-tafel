// Monsterbibliotheek: SRD (data/monsters.json) + geïmporteerde + eigen monsters, met één index.
import { HD_RE } from "../rules/dice.js";
import { withParsed } from "./statparse.js";
import { M, J } from "../i18n/msg.js";
import { cleanEd } from "../rules/edition.js";

let srd = [], custom = [], imported = [], srd24 = [];
let list = null, index = null, list24 = null, index24 = null;

export async function loadSrd(url = "/data/monsters.json") {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`); // taalneutraal: de UI zet er init.boot.srdFail omheen
  srd = srdList(await res.json());
  invalidate();
}
export function setLibrary({ custom: c, imported: i }) {
  if (c) custom = c;
  if (i) imported = i;
  invalidate();
}
/** SRD-bestand: kale array (data/monsters.json) of omhulsel { ed, src, monsters } (data/monsters-2024.json, WP47) */
export const srdList = (j) => (Array.isArray(j) ? j : Array.isArray(j?.monsters) ? j.monsters : []);
/** G1: SRD 5.2-bibliotheek (data/monsters-2024.json); los van eigen/geïmporteerd, geen ontdubbeling */
export function setSrd24(l) { srd24 = srdList(l); list24 = index24 = null; }

let st24 = "none", p24 = null;
/** Stand van de SRD 5.2-data: "none" (niet gevraagd), "loading", "ok", "fail" (B4/B9: ontbrekend is expliciet, nooit stil leeg) */
export const srd24Status = () => st24;
/**
 * WP48: SRD 5.2 laden, één keer (gelijktijdige aanroepen delen de belofte). Het omhulsel moet ed "2024" hebben, anders is
 * het geen 2024-bestand. Gooit nooit: geeft de stand terug; na "fail" mag een volgende aanroep het opnieuw proberen.
 */
export function loadSrd24(url = "/data/monsters-2024.json") {
  if (st24 === "ok") return Promise.resolve(st24);
  if (p24) return p24;
  st24 = "loading";
  p24 = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      if (!j || j.ed !== "2024" || !Array.isArray(j.monsters)) throw new Error("not 2024");
      setSrd24(j);
      st24 = "ok";
    } catch { st24 = "fail"; }
    p24 = null;
    return st24;
  })();
  return p24;
}
export const getCustom = () => custom;
export const getImported = () => imported;

function invalidate() { list = null; index = null; }
function build() {
  const seen = new Map();
  // RE14: eigen (en geïmporteerde eigen-formaat) monsters met plaktekst krijgen dezelfde structuur als SRD
  for (const m of [...custom.map((c) => ({ ...withParsed(c), custom: true })), ...imported.map(withParsed), ...srd]) {
    const k = m.n.toLowerCase();
    if (!seen.has(k)) seen.set(k, m);
  }
  list = [...seen.values()].sort((a, b) => a.n.localeCompare(b.n));
  index = new Map(list.map((m) => [m.n, m]));
}
function build24() { list24 = [...srd24].sort((a, b) => a.n.localeCompare(b.n)); index24 = new Map(list24.map((m) => [m.n, m])); }
/** Zonder editie: eigen > geïmporteerd > SRD 5.1 (ongewijzigd); ed "2024": alleen SRD 5.2 */
export const allMonsters = (ed) => { if (cleanEd(ed)) { if (!list24) build24(); return list24; } if (!list) build(); return list; };
/** B3/B4: ed "2024" zoekt alleen in SRD 5.2, zonder terugval op 2014 en zonder schaduw door eigen monsters */
export const findMon = (n, ed) => { if (cleanEd(ed)) { if (!index24) build24(); return index24.get(n); } if (!index) build(); return index.get(n); };

/* ---------- zoeken op naam, type en CR ---------- */
export const TYPES = ["aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead"];
const TYPE_RE = new RegExp(`\\b(${TYPES.join("|")})s?\\b`);
const metaCache = new Map();
/** "Medium humanoid (goblinoid), neutral evil" → { type: "humanoid", sub: "goblinoid" }; "Medium swarm of Tiny beasts" → beast */
export function metaInfo(meta) {
  const s = String(meta || "");
  let r = metaCache.get(s);
  if (!r) {
    const t = s.split(",")[0].toLowerCase().match(TYPE_RE), sub = s.match(/\(([^)]*)\)/);
    r = { type: t ? t[1] : "", sub: sub ? sub[1].toLowerCase() : "" };
    metaCache.set(s, r);
  }
  return r;
}
/** Type als zoekwoord: "undead", "dragons" → type; anders "" */
const typeWord = (w) => (TYPES.includes(w) ? w : w.length > 3 && w.endsWith("s") && TYPES.includes(w.slice(0, -1)) ? w.slice(0, -1) : "");

const CRV = { "1/8": 0.125, "1/4": 0.25, "1/2": 0.5 };
/** CR-tekst → getal: "1/4" → 0.25, "5" → 5; onbekend → NaN */
export const crNum = (cr) => { const s = String(cr ?? "").trim(); return s in CRV ? CRV[s] : /^\d+$/.test(s) ? +s : NaN; };
const crLbl = (v) => (v === 0.125 ? "1/8" : v === 0.25 ? "1/4" : v === 0.5 ? "1/2" : String(v));
/** "5" | "1/2-3" | "2–4" | "10+" → { min, max } (max Infinity bij "+"); undefined = nog niet af ("2-", "1/"); null = onleesbaar */
function crRange(v) {
  const s = v.replace(/[–—]/g, "-");
  if (!s || /[-/]$/.test(s)) return undefined;
  const m = s.match(/^([\d/]+)(?:-([\d/]+)|(\+))?$/);
  if (!m) return null;
  const a = crNum(m[1]), b = m[2] ? crNum(m[2]) : m[3] ? Infinity : a;
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/**
 * Zoektekst → { words, cr, type, bad }. "cr 5", "cr5", "cr 1/4", "cr 2-4", "cr 10+" (ook "cr:5") worden een CR-filter;
 * een onaf CR-woord ("cr", "cr 2-") telt nog niet mee, een onleesbaar ("cr x") geeft bad. Overige woorden: naam/type/subtype.
 */
export function parseQuery(q) {
  const T = String(q || "").toLowerCase().replace(/[–—]/g, "-").split(/[\s,]+/).filter(Boolean);
  const out = { words: [], cr: null, type: "", bad: false };
  for (let i = 0; i < T.length; i++) {
    const m = T[i].match(/^cr:?(?=$|\d)(.*)$/); // "cr", "cr5", "cr:1/2"; niet "crab"
    if (!m) { out.words.push(T[i]); out.type ||= typeWord(T[i]); continue; }
    let v = m[1];
    if (!v && i + 1 < T.length && !/^[a-z]{3,}$/.test(T[i + 1])) v = T[++i]; // "cr 5", "cr x" (fout); "cr wolf" = onaf CR + naamwoord
    const r = crRange(v);
    if (r) out.cr = r; else if (r === null) out.bad = true;
  }
  return out;
}
/** Kop boven de lijst bij een filter: "Undead · CR 2–4"; zonder filter "" */
export function queryLabel(p) {
  const cr = p.cr && (p.cr.max === Infinity ? `CR ${crLbl(p.cr.min)}+` : p.cr.min === p.cr.max ? `CR ${crLbl(p.cr.min)}` : `CR ${crLbl(p.cr.min)}–${crLbl(p.cr.max)}`);
  const type = p.words.length === 1 && p.type; // "giant spider" is een naam, geen filter
  return [type && type[0].toUpperCase() + type.slice(1), cr].filter(Boolean).join(" · ");
}

/* ---------- VB4: woorden in andere talen en typfouten ---------- */
/** Synoniemen { "woord|meervoud": "doel|doel" } (locales/<taal>/search.js) → Map woord → [doelen]; meerdere bronnen samen */
export const synMap = (...srcs) => new Map(srcs.flatMap((src) => Object.entries(src || {}).flatMap(([k, v]) => k.split("|").map((w) => [w, String(v).split("|")]))));
const NO_SYN = new Map();
const synKeysCache = new WeakMap();
const synKeys = (syn) => { let k = synKeysCache.get(syn); if (!k) { k = [...syn.keys()]; synKeysCache.set(syn, k); } return k; };

/** Past één zoekwoord bij een monster: 2 = naam begint ermee, 1 = naam bevat het, 0 = type/subtype, -1 = niet */
function wordScore(m, w) {
  const n = m.n.toLowerCase();
  if (n.startsWith(w)) return 2;
  if (n.includes(w)) return 1;
  const x = metaInfo(m.meta);
  return (x.type && x.type === typeWord(w)) || (x.sub && x.sub.includes(w)) ? 0 : -1;
}
/** Synoniem voor een zoekwoord: hele woord, anders (vanaf 4 letters) het eerste woord dat ermee begint ("draa" → draak) */
function synFor(SY, w) {
  if (SY.has(w)) return w;
  return w.length >= 4 ? synKeys(SY).find((k) => k.startsWith(w)) || null : null;
}

/** Damerau-Levenshtein (beperkt): afstand tussen a en b, of max + 1 zodra die zeker groter is */
export function editDist(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let pp = null, p = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const c = [i];
    let lo = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + cost);
      if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pp[j - 2] + 1);
      c[j] = v; if (v < lo) lo = v;
    }
    if (lo > max) return max + 1;
    pp = p; p = c;
  }
  return p[b.length];
}
/** Typfout: dichtstbijzijnde woord uit namen, types en synoniemen. 4–6 letters: afstand 1, vanaf 7: 2. Ook tegen het begin
 *  van een langer woord (nog aan het typen). Korter dan 4: geen gok. */
function fuzzyWord(w, vocab) {
  if (w.length < 4) return null;
  const max = w.length >= 7 ? 2 : 1;
  let best = null, bd = max + 1;
  for (const v of vocab) {
    if (v === w || v.length < 3) continue;
    let d = editDist(w, v, max);
    if (d > max && v.length > w.length) d = Math.min(editDist(w, v.slice(0, w.length), max), editDist(w, v.slice(0, w.length + 1), max)) + 0.5; // begin van een woord: iets minder goed
    if (d < bd || (d === bd && best && v.length < best.length)) { best = v; bd = d; }
  }
  return bd <= max + 0.5 ? best : null; // hele woord ≤ max, of begin van een woord ≤ max (+0,5)
}
const vocabCache = new WeakMap(); // list → Map(synoniemen → woorden)
function vocabOf(list, SY) {
  let byS = vocabCache.get(list);
  if (!byS) { byS = new WeakMap(); vocabCache.set(list, byS); }
  let v = byS.get(SY);
  if (!v) {
    const s = new Set([...TYPES, ...synKeys(SY)]);
    for (const m of list) for (const t of m.n.toLowerCase().split(/[^a-z]+/)) if (t.length >= 3) s.add(t);
    v = [...s]; byS.set(SY, v);
  }
  return v;
}

/** Synoniem-doel: alleen het begin van een naamwoord of het type (niet midden in een naam of via subtype: "ice" ≠ Cockatrice) */
function synScore(m, t) {
  const n = m.n.toLowerCase();
  if (n.startsWith(t)) return 2;
  if (n.includes(" " + t) || n.includes("(" + t)) return 1;
  return metaInfo(m.meta).type === t ? 0 : -1;
}
/** Score van alle woorden; synoniem telt als het woord zelf niet past. ks: synoniem per woord (één keer per zoektocht
 *  bepaald), syn: gebruikte synoniemen (voor de kop) */
function scoreAll(SY, m, words, ks, syn) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    let s = wordScore(m, words[i]);
    if (s < 0 && ks[i]) {
      for (const t of SY.get(ks[i])) { const x = synScore(m, t); if (x > s) s = x; }
      if (s >= 0) syn.add(ks[i]);
    }
    if (s < 0) return null;
    out.push(s);
  }
  return out;
}

/** Keuzelijst: monsters die bij de zoektekst passen en de geldige selectie daarin.
 *  De selectie moet zichtbaar zijn; anders zou "Toevoegen" iets onzichtbaars toevoegen.
 *  Eén treffer of een exacte naam wordt automatisch gekozen, anders blijft er niets geselecteerd.
 *  typed (VB5): de zoektekst is net veranderd; dan wint één exacte naam (of het enige monster van een NL-woord: "bandiet"
 *  → Bandit) van een eerdere keuze. Een tik in de lijst blijft staan zolang de zoektekst gelijk blijft.
 *  Met een type- of CR-filter: CR oplopend, dan naam. Alleen naam: wie met het eerste woord begint eerst, dan wie het
 *  in de naam heeft, dan treffers op type/subtype (Bugbear bij "goblin"). Een exacte naam staat altijd bovenaan.
 *  VB4: synoniemen SY (synMap van locales/<taal>/search.js, via js/data/syn.js; WP29) doen altijd mee: NL-woorden (bandiet,
 *  skelet); vindt de zoektocht niets, dan een typfout-correctie ("gobin" → goblin). Zonder SY alleen Engelse namen. */
export function filterMonsters(list, q, sel, typed = false, SY = NO_SYN) {
  const t = String(q || "").trim().toLowerCase();
  let p = parseQuery(t), fix = null, viaType = false;
  const run = (words) => {
    const sc = new Map(), syn = new Set(), ks = words.map((w) => synFor(SY, w));
    const L0 = list.filter((m) => {
      if (p.cr) { const v = crNum(m.cr); if (!(v >= p.cr.min && v <= p.cr.max)) return false; }
      const s = scoreAll(SY, m, words, ks, syn);
      if (!s) return false;
      sc.set(m, s.length ? s[0] : 0); // rangorde op het eerste woord
      return true;
    });
    return { L0, sc, syn };
  };
  let L = list, syn = new Set();
  if (p.words.length || p.cr) {
    let r = run(p.words);
    if (!r.L0.length && p.words.length) { // VB4: niets gevonden → typfouten verbeteren en opnieuw
      const voc = vocabOf(list, SY);
      const w2 = p.words.map((w) => (scoreAnyFits(list, w, SY) ? w : fuzzyWord(w, voc) || w));
      if (w2.some((w, i) => w !== p.words[i])) {
        const r2 = run(w2);
        if (r2.L0.length) { r = r2; fix = w2.filter((w, i) => w !== p.words[i]); p = { ...p, words: w2, type: p.type || w2.map(typeWord).find(Boolean) || "" }; }
      }
    }
    const { L0, sc } = r; syn = r.syn;
    if (!p.type && p.words.length === 1 && syn.size) { const ty = SY.get([...syn][0]).map(typeWord).find(Boolean); if (ty) { p = { ...p, type: ty }; viaType = true; } } // "ondode" = undead
    if (fix && p.words.length === 1 && typeWord(p.words[0])) viaType = true; // "drakon" → dragon
    if (p.cr || p.type) L = L0.slice().sort((a, b) => (crNum(a.cr) || 0) - (crNum(b.cr) || 0) || a.n.localeCompare(b.n));
    else L = L0.slice().sort((a, b) => sc.get(b) - sc.get(a)); // stabiel: verder de bestaande (alfabetische) volgorde
  }
  const tgt = SY.get(t), ex = L.filter((m) => { const n = m.n.toLowerCase(); return n === t || (tgt && tgt.includes(n)); });
  const exact = ex.length === 1 ? ex[0] : L.find((m) => m.n.toLowerCase() === t) || null;
  if (exact && L[0] !== exact) L = [exact, ...L.filter((m) => m !== exact)]; // exacte naam bovenaan ("giant spider")
  const vis = L.some((m) => m.n === sel);
  const pick = typed && ex.length === 1 ? ex[0].n : vis ? sel : exact ? exact.n : L.length === 1 ? L[0].n : null;
  const head = queryLabel(viaType ? { ...p, type: "" } : p), extra = fix ? M("dnd.search.fix", { words: fix.join(" ") }) : syn.size ? [...syn].map((k) => `"${k}" = ${SY.get(k).join(", ")}`).join(" · ") : "";
  return { L, sel: pick, label: head || extra ? J([head, extra], " · ") : "", bad: p.bad }; // label: tekst of descriptor ("" = geen kop); tonen met t/tr
}
/** Past dit woord (zelf of als NL-woord) bij minstens één monster? Dan is het geen typfout maar een te strenge combinatie. */
function scoreAnyFits(list, w, SY) {
  const syn = new Set(), ks = [synFor(SY, w)];
  return list.some((m) => scoreAll(SY, m, [w], ks, syn));
}

/* ---------- import: Open5e, 5e-bits (dnd5eapi) en het eigen formaat ---------- */
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const ft = (v) => (typeof v === "number" ? v + " ft." : v);
const named = (a) => (a || []).filter((i) => i && i.name).map((i) => [String(i.name), String(i.desc || "")]);
const crStr = (v) => (typeof v === "string" ? v : v === 0.125 ? "1/8" : v === 0.25 ? "1/4" : v === 0.5 ? "1/2" : String(v ?? ""));
const sgn = (n) => (n >= 0 ? "+" : "") + n;

/** Eigen formaat komt uit een bestand: terugbrengen naar strings en getallen (geen HTML of objecten erdoor) */
export function sanitizeOwn(o) {
  const str = (v) => (v == null ? "" : String(v));
  const pairs = (a) => (Array.isArray(a) ? a.filter(Array.isArray).map(([k, v]) => [str(k), str(v)]) : []);
  const hd = str(o.hd).replace(/\s/g, "");
  return {
    n: str(o.n), meta: str(o.meta), ac: str(o.ac), hp: Math.max(1, +o.hp || 1), hd: HD_RE.test(hd) ? hd : null, spd: str(o.spd),
    ...(Array.isArray(o.ab) && o.ab.length === 6 ? { ab: o.ab.map((x) => +x || 10) } : {}),
    x: pairs(o.x), cr: str(o.cr), xp: +o.xp || null,
    t: pairs(o.t), a: pairs(o.a), ba: pairs(o.ba), re: pairs(o.re), l: pairs(o.l), ld: str(o.ld),
    ...(o.text != null ? { text: str(o.text) } : {}), ...(o.dexScore != null ? { dexScore: +o.dexScore || 10 } : {}),
  };
}

export function convMonster(o) {
  if (!o || typeof o !== "object") return null;
  if (o.n && (o.ab || o.text != null)) return sanitizeOwn(o);
  if (!o.name) return null;
  const ab = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map((k) => +o[k] || 10);
  let ac;
  if (Array.isArray(o.armor_class)) {
    const a = o.armor_class[0] || {};
    const desc = a.armor ? a.armor.map((x) => x.name).join(", ") : a.type === "natural" ? "natural armor" : a.desc || "";
    ac = `${a.value}${desc ? ` (${desc.toLowerCase()})` : ""}`;
  } else ac = `${o.armor_class}${o.armor_desc ? ` (${o.armor_desc})` : ""}`;
  let spd = o.speed || "";
  if (typeof spd === "object") spd = Object.entries(spd).filter(([k, v]) => v && k !== "hover" && k !== "notes")
    .map(([k, v]) => (k === "walk" ? ft(v) : `${k} ${ft(v)}${k === "fly" && o.speed.hover ? " (hover)" : ""}`)).join(", ");
  const x = [];
  if (Array.isArray(o.proficiencies)) {
    const sv = [], sk = [];
    o.proficiencies.forEach((p) => {
      const n = p.proficiency?.name || "";
      if (n.startsWith("Saving Throw: ")) sv.push(`${cap(n.slice(14).toLowerCase())} ${sgn(p.value)}`);
      else if (n.startsWith("Skill: ")) sk.push(`${n.slice(7)} ${sgn(p.value)}`);
    });
    if (sv.length) x.push(["Saving Throws", sv.join(", ")]);
    if (sk.length) x.push(["Skills", sk.join(", ")]);
  } else {
    const sv = [["Str", "strength_save"], ["Dex", "dexterity_save"], ["Con", "constitution_save"], ["Int", "intelligence_save"], ["Wis", "wisdom_save"], ["Cha", "charisma_save"]]
      .filter(([, k]) => o[k] != null).map(([n, k]) => `${n} ${sgn(o[k])}`);
    if (sv.length) x.push(["Saving Throws", sv.join(", ")]);
    if (o.skills && typeof o.skills === "object" && Object.keys(o.skills).length)
      x.push(["Skills", Object.entries(o.skills).map(([k, v]) => `${cap(k)} ${sgn(v)}`).join(", ")]);
  }
  const lst = (v) => (Array.isArray(v) ? v.map((i) => (typeof i === "string" ? i : i.name)).join(", ").toLowerCase() : v || "");
  [["Damage Vulnerabilities", "damage_vulnerabilities"], ["Damage Resistances", "damage_resistances"], ["Damage Immunities", "damage_immunities"], ["Condition Immunities", "condition_immunities"]]
    .forEach(([l, k]) => { const v = lst(o[k]); if (v) x.push([l, String(v)]); });
  let sen = o.senses || "";
  if (typeof sen === "object") {
    const pp = sen.passive_perception;
    sen = [...Object.entries(sen).filter(([k]) => k !== "passive_perception").map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`), pp != null ? `passive Perception ${pp}` : ""].filter(Boolean).join(", ");
  }
  if (sen) x.push(["Senses", String(sen)]);
  x.push(["Languages", String(o.languages || "—")]);
  const hdRaw = String(o.hit_points_roll || o.hit_dice || "").replace(/\s/g, "");
  return {
    n: String(o.name), meta: `${cap(o.size || "")} ${(o.type || "").toLowerCase()}${o.subtype ? ` (${o.subtype})` : ""}, ${o.alignment || ""}`.trim(),
    ac: String(ac), hp: Math.max(1, +o.hit_points || 1), hd: HD_RE.test(hdRaw) ? hdRaw : null, spd: String(spd), ab, x,
    cr: crStr(o.challenge_rating), xp: +o.xp || null,
    t: named(o.special_abilities), a: named(o.actions), ba: named(o.bonus_actions), re: named(o.reactions), l: named(o.legendary_actions), ld: String(o.legendary_desc || ""),
  };
}

/** Bestand → lijst monsters (array, {results:[…]} of {monsters:[…]}) */
export function parseMonsterFile(json) {
  const arr = Array.isArray(json) ? json : json.results || json.monsters || [];
  return arr.map((o) => { try { return convMonster(o); } catch { return null; } }).filter(Boolean);
}

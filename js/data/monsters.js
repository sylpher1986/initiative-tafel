// Monsterbibliotheek: SRD (data/monsters.json) + geïmporteerde + eigen monsters, met één index.
import { HD_RE } from "../rules/dice.js";

let srd = [], custom = [], imported = [];
let list = null, index = null;

export async function loadSrd(url = "data/monsters.json") {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Monsterdata niet geladen (${res.status})`);
  srd = await res.json();
  invalidate();
}
export function setLibrary({ custom: c, imported: i }) {
  if (c) custom = c;
  if (i) imported = i;
  invalidate();
}
export const getCustom = () => custom;
export const getImported = () => imported;

function invalidate() { list = null; index = null; }
function build() {
  const seen = new Map();
  for (const m of [...custom.map((c) => ({ ...c, custom: true })), ...imported, ...srd]) {
    const k = m.n.toLowerCase();
    if (!seen.has(k)) seen.set(k, m);
  }
  list = [...seen.values()].sort((a, b) => a.n.localeCompare(b.n));
  index = new Map(list.map((m) => [m.n, m]));
}
export const allMonsters = () => { if (!list) build(); return list; };
export const findMon = (n) => { if (!index) build(); return index.get(n); };

/** Keuzelijst: monsters die de zoekterm bevatten en de geldige selectie daarin.
 *  De selectie moet zichtbaar zijn; anders zou "Toevoegen" iets onzichtbaars toevoegen.
 *  Eén treffer wordt automatisch gekozen, anders blijft er niets geselecteerd. */
export function filterMonsters(list, q, sel) {
  const t = q.trim().toLowerCase();
  const L = t ? list.filter((m) => m.n.toLowerCase().includes(t)) : list;
  const exact = t && L.find((m) => m.n.toLowerCase() === t);
  const pick = L.some((m) => m.n === sel) ? sel : exact ? exact.n : L.length === 1 ? L[0].n : null;
  return { L, sel: pick };
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

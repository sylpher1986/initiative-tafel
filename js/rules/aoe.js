// Area of effect (5e 2014): één schadeworp, per doelwit een save en resistance/vulnerability/immunity.
// Volgorde (PHB): eerst de save (½ of 0, naar beneden afgerond), daarna resistance/vulnerability.
// Voorbeeld: 27 fire, save geslaagd en resistant → 13 → 6.
import { fx, merge, applyDamage } from "./combat.js";
import { mod, d } from "./dice.js";

export const DTYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
export const ABS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

export const MODE_LBL = { 0.5: "resistant", 2: "kwetsbaar", 0: "immuun" };
/** Schade-invoer → heel getal 0..999 */
export const clampDmg = (v) => Math.max(0, Math.min(999, parseInt(v, 10) || 0));
/** Keuze per doelwit; mode null = volg het statblock. roll = { r, r2, bo, tot } of null */
export const newPick = () => ({ sel: false, save: "fail", mode: null, roll: null, lr: false });

/** Effectieve keuze: mode uit het statblock tenzij de DM zelf koos */
export function pickFor(t, x, type) {
  const def = defMode(x, type);
  return { ...(t || newPick()), auto: !t || t.mode === null, mode: t && t.mode !== null ? t.mode : def.mode, def };
}

/** Magic Resistance (advantage op saves tegen spells) staat bij de traits */
export const hasMagicRes = (m) => !!(m && (m.t || []).some((r) => /^magic resistance/i.test(r[0])));

/** Save rollen; adv = 2d20, de hoogste telt. mods uit saveMods (effects.js): cover vast, Bless/Bane een d4 erbij */
export function rollSave(bo, adv, rng = Math.random, mods = []) {
  const r = d(20, rng), r2 = adv ? d(20, rng) : null;
  const x = mods.map((m) => (m.d ? { n: m.n, d: m.d, r: d(Math.abs(m.d), rng) } : { n: m.n, b: m.b }));
  const extra = x.reduce((s, m) => s + (m.d ? Math.sign(m.d) * m.r : m.b), 0);
  return { r, r2, bo, x, tot: Math.max(r, r2 ?? r) + bo + extra };
}
const sg = (v) => (v >= 0 ? "+" : "−");
export const rollText = (x, dc) => `d20 [${x.r}${x.r2 != null ? `, ${x.r2}` : ""}] ${x.bo >= 0 ? "+" : ""}${x.bo}${(x.x || []).map((m) => (m.d ? ` ${sg(m.d)} 1d${Math.abs(m.d)} [${m.r}] ${m.n}` : ` ${sg(m.b)} ${Math.abs(m.b)} ${m.n}`)).join("")} = ${x.tot}${dc > 0 ? (x.tot >= dc ? " ✓" : " ✗") : ""}${x.r2 != null ? " (advantage: Magic Resistance)" : ""}`;

/** Wat er met één doel gebeurt, op een kopie (voor de preview): dealt en een korte uitkomst */
export function aoeOutcome(c, pick, raw) {
  const sim = structuredClone(c);
  const r = applyAoe([{ c: sim, save: pick.save, mode: pick.mode }], raw, "");
  const dealt = r.hits[0].dealt;
  const res = sim.ds && sim.ds.dead && !(c.ds && c.ds.dead) ? "sterft"
    : c.hp > 0 && sim.hp <= 0 ? (c.kind === "pc" ? "bewusteloos" : "neer")
    : c.kind === "pc" && c.hp <= 0 && dealt ? "death save failure" : "";
  return { dealt, res, hp: sim.hp, steps: aoeCalc(raw, pick.save, pick.mode).steps, down: !!res && res !== "death save failure" };
}

/** save: "fail" (volle schade), "half" (geslaagd, ½) of "none" (geen schade, bijv. Evasion). mode: 1, 0.5, 2 of 0 */
export function aoeCalc(raw, save, mode) {
  const n = Math.max(0, Math.floor(+raw || 0));
  const base = save === "half" ? Math.floor(n / 2) : save === "none" ? 0 : n;
  const dealt = Math.floor(base * mode);
  const steps = [String(n)];
  if (save === "half") steps.push(`½ ${base}`);
  if (save === "none") steps.push("save 0");
  if (base && mode === 0.5) steps.push(`resist ${dealt}`);
  if (base && mode === 2) steps.push(`×2 ${dealt}`);
  if (base && mode === 0) steps.push("immuun 0");
  return { base, dealt, steps };
}

/**
 * Standaard-modus voor een damage type uit de statblock-regels (m.x).
 * Alleen onvoorwaardelijke regels tellen ("fire", niet "... from nonmagical attacks"):
 * een voorwaardelijke regel geeft cond = de tekst, zodat de DM zelf kiest.
 */
export function defMode(x, type) {
  const out = { mode: 1, cond: "" };
  if (!type || !Array.isArray(x)) return out;
  const t = type.toLowerCase();
  const rows = [["Damage Immunities", 0], ["Damage Resistances", 0.5], ["Damage Vulnerabilities", 2]];
  for (const [label, m] of rows) {
    const v = (x.find((r) => r[0] === label) || [])[1];
    if (!v) continue;
    for (const seg of String(v).toLowerCase().split(";")) {
      if (!new RegExp(`\\b${t}\\b`).test(seg)) continue;
      if (/from|magic|silver|adamantine|\(|except|while/.test(seg)) { if (!out.cond) out.cond = seg.trim(); continue; }
      return { mode: m, cond: "" };
    }
  }
  return out;
}

/** Is de savebonus bekend? Zonder statblock of ability score (eigen monster: alleen Dex) zou saveBonus +0 gokken */
export function saveKnown(m, ab) {
  if (!m) return false;
  const sv = ((m.x || []).find((r) => r[0] === "Saving Throws") || [])[1] || "";
  return new RegExp(`\\b${ab}\\w*\\s*[+−-]\\s*\\d`, "i").test(String(sv)) || (Array.isArray(m.ab) && ABS.includes(ab)) || (ab === "DEX" && !!m.dexScore);
}

/** Savebonus van een monster: uit "Saving Throws" (Dex +6), anders de ability-modifier */
export function saveBonus(m, ab) {
  if (!m) return 0;
  const i = ABS.indexOf(ab);
  const sv = ((m.x || []).find((r) => r[0] === "Saving Throws") || [])[1] || "";
  const hit = String(sv).match(new RegExp(`\\b${ab}\\w*\\s*([+−-])\\s*(\\d+)`, "i"));
  if (hit) return (hit[1] === "+" ? 1 : -1) * +hit[2];
  if (Array.isArray(m.ab) && i >= 0) return mod(m.ab[i]);
  if (ab === "DEX" && m.dexScore) return mod(m.dexScore);
  return 0;
}

/**
 * Past een AoE toe. picks: [{ c, save, mode, lr, note }]; lr = legendary resistance gebruikt (save telt als geslaagd),
 * note = bijv. de gerolde save voor het logboek.
 * label: bijv. "28 fire (DEX DC 15)". Geeft Fx plus hits [{ id, dealt }] terug.
 */
export function applyAoe(picks, raw, label) {
  const out = Object.assign(fx(), { hits: [] });
  for (const p of picks) {
    const c = p.c;
    if (p.lr && c.lr && c.lr.left > 0) { c.lr.left--; out.why.push({ t: "legendary resistance gebruikt", id: c.id }); }
    const r = aoeCalc(raw, p.save, p.mode);
    const sv = p.save === "half" ? "save geslaagd" : p.save === "none" ? "geen schade door save" : "save gefaald";
    out.why.push({ t: `AoE ${label}: ${p.note ? p.note + ", " : ""}${sv}${p.mode === 0 ? ", immuun" : ""} → ${r.steps.join(" → ")}`, id: c.id });
    if (r.base > 0 && p.mode !== 0) merge(out, applyDamage(c, r.base, p.mode, true));
    out.hits.push({ id: c.id, dealt: r.dealt });
  }
  return out;
}

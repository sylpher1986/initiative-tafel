// Area of effect (5e 2014): één schadeworp, per doelwit een save en resistance/vulnerability/immunity.
// Volgorde (PHB): eerst de save (½ of 0, naar beneden afgerond), daarna resistance/vulnerability.
// Voorbeeld: 27 fire, save geslaagd en resistant → 13 → 6.
import { defRows } from "./statform.js";
import { fx, merge, applyDamage } from "./combat.js";
import { M, J } from "../i18n/msg.js";
import { t } from "../i18n/boot.js";
import { mod, d } from "./dice.js";

export const DTYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
export const ABS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

/** Weerstand per schadefactor → catalogussleutel (t(MODE_LBL[m])) */
export const MODE_LBL = { 0.5: "rules.mode.r", 2: "rules.mode.v", 0: "rules.mode.i" };
/** Schade-invoer → heel getal 0..999 */
export const clampDmg = (v) => Math.max(0, Math.min(999, parseInt(v, 10) || 0));
/** Keuze per doelwit; mode null = volg het statblock. roll = { r, r2, bo, tot } of null */
export const newPick = () => ({ sel: false, save: "fail", mode: null, roll: null, lr: false });

/**
 * Weerstanden van een speler (SP2): { r: [types], i: [types], v: [types] } (resist, immuun, kwetsbaar), alleen de
 * 13 SRD damage types. Leeg = undefined, zodat oude data en spelers zonder weerstand gelijk blijven.
 */
export const DR = [["r", 0.5], ["i", 0], ["v", 2]];
export function cleanDr(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return undefined;
  const out = {}, seen = new Set();
  for (const k of ["i", "r", "v"]) { // immuun wint van resist, resist van kwetsbaar (een type staat maar één keer)
    const a = (Array.isArray(o[k]) ? o[k] : []).map((t) => String(t).toLowerCase()).filter((t) => DTYPES.includes(t) && !seen.has(t));
    a.forEach((t) => seen.add(t));
    if (a.length) out[k] = [...new Set(a)].sort();
  }
  return Object.keys(out).length ? out : undefined;
}
/** Standaard-modus voor een damage type uit de weerstanden van een speler (zelfde vorm als defMode) */
export function drMode(dr, type) {
  const t = String(type || "").toLowerCase();
  if (t && dr) for (const [k, m] of DR) if ((dr[k] || []).includes(t)) return { mode: m, cond: "" };
  return { mode: 1, cond: "" };
}
/** Tik op een type in soort k: staat het daar al → uit; anders daarheen (weg uit de andere soorten). → nieuwe dr of undefined */
export function drToggle(dr, k, t) {
  const o = { r: [...((dr && dr.r) || [])], i: [...((dr && dr.i) || [])], v: [...((dr && dr.v) || [])] };
  const on = o[k] && o[k].includes(t);
  for (const x of ["r", "i", "v"]) o[x] = o[x].filter((y) => y !== t);
  if (!on && o[k]) o[k].push(t);
  return cleanDr(o);
}
/** Wat er veranderde: "Resist +fire −cold, Immuun +poison"; leeg als gelijk */
export function drDiff(a, b) {
  const out = [];
  for (const [k, l] of Object.entries(DR_LBL)) {
    const x = (a && a[k]) || [], y = (b && b[k]) || [];
    const d = [...y.filter((t) => !x.includes(t)).map((t) => "+" + t), ...x.filter((t) => !y.includes(t)).map((t) => "−" + t)];
    if (d.length) out.push(`${t(l)} ${d.join(" ")}`);
  }
  return out.join(", ");
}
/** In welke soort een type staat ("r" | "i" | "v" | null) */
export const drKind = (dr, t) => (dr ? ["r", "i", "v"].find((k) => (dr[k] || []).includes(t)) || null : null);
/** Soorten weerstand → catalogussleutel van het korte label (t(DR_LBL[k])) */
export const DR_LBL = { r: "rules.dr.r", i: "rules.dr.i", v: "rules.dr.v" };
/** Korte tekst: "Resist fire, cold · Immuun poison"; leeg zonder weerstanden */
export const drText = (dr) => (!dr ? "" : ["r", "i", "v"].filter((k) => (dr[k] || []).length).map((k) => `${t(DR_LBL[k])} ${dr[k].join(", ")}`).join(" · "));
/** Modus voor een doelwit: monster uit het statblock (m.x), speler uit zijn weerstanden */
export const targetMode = (c, m, type) => withEff(c, c && c.kind === "pc" ? drMode(c.dr, type) : defMode(m && m.x, type), type);
/**
 * Tijdelijke resistance uit effecten (Rage, RE16: `e.rs`) erbovenop: normaal → ½, kwetsbaar + resistant → normaal (PHB),
 * resist/immuun blijven. eff: 1 = komt (mede) door een effect, voor de uitleg.
 */
function withEff(c, base, type) {
  const t = String(type || "").toLowerCase();
  if (!t || !(c && c.eff || []).some((e) => Array.isArray(e.rs) && e.rs.includes(t))) return base;
  return base.mode === 1 ? { mode: 0.5, cond: "", eff: 1 } : base.mode === 2 ? { mode: 1, cond: "", eff: 1 } : base;
}

/** Effectieve keuze: standaard-modus (targetMode: statblock of opgeslagen resistances) tenzij de DM zelf koos */
export function pickFor(t, def) {
  return { ...(t || newPick()), auto: !t || t.mode === null, mode: t && t.mode !== null ? t.mode : def.mode, def };
}

/** Magic Resistance (advantage op saves tegen spells) staat bij de traits */
export const hasMagicRes = (m) => !!(m && (m.t || []).some((r) => /^magic resistance/i.test(r[0])));

/**
 * Save rollen. adv: true of > 0 = advantage (2d20, hoogste), < 0 = disadvantage (laagste), anders één d20.
 * why = bron voor de tekst (standaard bij advantage "Magic Resistance"). mods uit saveMods (effects.js): cover vast, Bless/Bane een d4 erbij.
 */
export function rollSave(bo, adv, rng = Math.random, mods = [], why = "") {
  const v = adv === true ? 1 : Math.sign(+adv || 0);
  const r = d(20, rng), r2 = v ? d(20, rng) : null;
  const x = mods.map((m) => (m.d ? { n: m.n, d: m.d, r: d(Math.abs(m.d), rng) } : { n: m.n, b: m.b }));
  const extra = x.reduce((s, m) => s + (m.d ? Math.sign(m.d) * m.r : m.b), 0);
  return { r, r2, bo, x, av: v, aw: why || (v > 0 ? "Magic Resistance" : ""), tot: (v < 0 ? Math.min(r, r2) : Math.max(r, r2 ?? r)) + bo + extra };
}
const sg = (v) => (v >= 0 ? "+" : "−");
export const rollText = (x, dc) => `d20 [${x.r}${x.r2 != null ? `, ${x.r2}` : ""}] ${x.bo >= 0 ? "+" : ""}${x.bo}${(x.x || []).map((m) => (m.d ? ` ${sg(m.d)} 1d${Math.abs(m.d)} [${m.r}] ${m.n}` : ` ${sg(m.b)} ${Math.abs(m.b)} ${m.n}`)).join("")} = ${x.tot}${dc > 0 ? (x.tot >= dc ? " ✓" : " ✗") : ""}${x.r2 != null ? ` (${x.av < 0 ? "disadvantage" : "advantage"}${x.aw || x.av > 0 ? `: ${x.aw || "Magic Resistance"}` : ""})` : ""}`;

/**
 * Advantage/disadvantage op een save uit condities en effecten (RE11/RE16), plus Magic Resistance van de aanroeper.
 * Exhaustion 3+ disadvantage; Rage advantage op STR. Samen heffen ze elkaar op. → { v: 1|0|-1, why }
 */
export function saveAdv(c, ab, magic = false) {
  const adv = [], dis = [];
  if (magic) adv.push("Magic Resistance");
  if (ab === "STR" && (c && c.eff || []).some((e) => e.rg)) adv.push("Rage");
  const ex = (c && c.eff || []).find((e) => e.n === "Exhaustion");
  if (ex && (ex.x | 0) >= 3) dis.push(`Exhaustion ${ex.x | 0}`);
  const v = adv.length && !dis.length ? 1 : dis.length && !adv.length ? -1 : 0;
  return { v, why: v > 0 ? adv.join(", ") : v < 0 ? dis.join(", ") : "" };
}

/** Wat er met één doel gebeurt, op een kopie (voor de preview): dealt en een korte uitkomst */
export function aoeOutcome(c, pick, raw) {
  const sim = structuredClone(c);
  const r = applyAoe([{ c: sim, save: pick.save, mode: pick.mode }], raw, "");
  const dealt = r.hits[0].dealt;
  const code = sim.ds && sim.ds.dead && !(c.ds && c.ds.dead) ? "dies"
    : c.hp > 0 && sim.hp <= 0 ? (c.kind === "pc" ? "uncon" : "down")
    : c.kind === "pc" && c.hp <= 0 && dealt ? "dsf" : "";
  return { dealt, res: code ? t(`rules.aoeRes.${code}`) : "", hp: sim.hp, steps: aoeCalc(raw, pick.save, pick.mode).steps, down: !!code && code !== "dsf" };
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
  if (base && mode === 0) steps.push(`${t("rules.aoe.immune")} 0`);
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
  const D = defRows(x); // 2014 "Damage …" en 2024 "Immunities/Resistances/Vulnerabilities" (WP48)
  const rows = [[D.imm, 0], [D.res, 0.5], [D.vuln, 2]];
  for (const [v, m] of rows) {
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
  return !!m && (!!svHit(m, ab) || (Array.isArray(m.ab) && ABS.includes(ab)) || (ab === "DEX" && !!m.dexScore));
}

/** "Saving Throws" uit het statblock: treffer voor deze ability (teken, getal) of null */
function svHit(m, ab) {
  const sv = ((m.x || []).find((r) => r[0] === "Saving Throws") || [])[1] || "";
  return String(sv).match(new RegExp(`\\b${ab}\\w*\\s*([+−-])\\s*(\\d+)`, "i"));
}

/** Savebonus van een monster: uit "Saving Throws" (Dex +6), anders de ability-modifier */
export function saveBonus(m, ab) {
  if (!m) return 0;
  const i = ABS.indexOf(ab);
  const hit = svHit(m, ab);
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
    if (p.lr && c.lr && c.lr.left > 0) { c.lr.left--; out.why.push({ t: M("rules.lrUsed"), id: c.id }); }
    const r = aoeCalc(raw, p.save, p.mode);
    const sv = M(p.save === "half" ? "rules.aoe.half" : p.save === "none" ? "rules.aoe.none" : "rules.aoe.fail");
    out.why.push({ t: M("rules.aoe.why", { label, what: J([p.note, sv, p.mode === 0 ? M("rules.aoe.immune") : null]), steps: r.steps.join(" → ") }), id: c.id });
    if (r.base > 0 && p.mode !== 0) merge(out, applyDamage(c, r.base, p.mode, true));
    out.hits.push({ id: c.id, dealt: r.dealt });
  }
  return out;
}

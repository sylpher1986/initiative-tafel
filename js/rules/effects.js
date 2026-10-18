// Tijdelijke effecten op een deelnemer (5e 2014): op AC (+N, =N, minimaal N), op max HP (±N) of alleen een herinnering.
// Duur zoals bij condities (zie makeDur in turns.js), "tot long rest", en optioneel gekoppeld aan de concentratie van een caster.
// De basis-AC blijft in c.ac; de kaart toont effAc(c). Max HP-effecten passen c.max echt aan en onthouden hun verschil (hpd).
import { fx, applyPcHp, revertMax, newDs, setUncon, dropConc, merge } from "./combat.js";

/**
 * Presets. dur: sleutel uit DURS (turns.js) of "lr" (tot long rest). dex: 13 + Dex-mod (Mage Armor).
 * after: effect dat volgt als dit effect afloopt (Haste → Lethargy, tot na de volgende beurt van het doelwit).
 * sv: invloed op saves ({ ab, b } vaste bonus, alleen op die ability; { d } = ±1dN op elke save). grp: sluiten elkaar uit (cover).
 */
export const PRESETS = [
  { n: "Shield", st: "ac", op: "+", v: 5, dur: "tstart", react: true, txt: "reaction; ook geen schade van Magic Missile" },
  { n: "Shield of Faith", st: "ac", op: "+", v: 2, dur: "r100", conc: true },
  { n: "Haste", st: "ac", op: "+", v: 2, dur: "r10", conc: true, txt: "speed ×2, advantage op Dex saves, extra action", after: { n: "Lethargy", txt: "geen beweging of acties" } },
  { n: "Mage Armor", st: "ac", op: "=", v: 13, dex: true, dur: "lr", txt: "alleen zonder armor" },
  { n: "Barkskin", st: "ac", op: "min", v: 16, dur: "inf", conc: true },
  { n: "Half cover", st: "ac", op: "+", v: 2, dur: "inf", txt: "ook +2 op Dex saves", sv: { ab: "DEX", b: 2 }, grp: "cover" },
  { n: "Three-quarters cover", st: "ac", op: "+", v: 5, dur: "inf", txt: "ook +5 op Dex saves", sv: { ab: "DEX", b: 5 }, grp: "cover" },
  { n: "Aid", st: "max", op: "+", v: 5, dur: "lr", txt: "+5 per slot-level boven de 2e" },
  { n: "Bless", st: "", v: 0, dur: "r10", conc: true, txt: "+1d4 op attack rolls en saves", sv: { d: 4 } },
  { n: "Bane", st: "", v: 0, dur: "r10", conc: true, txt: "−1d4 op attack rolls en saves", sv: { d: -4 } },
];

const OPS = ["+", "=", "min"];
/** Vervolgeffecten die de DM moet zien (Lethargy): waarschuwingskleur en vooraan */
const WARN = new Set(PRESETS.filter((p) => p.after).map((p) => p.after.n.toLowerCase()));
export const isWarn = (e) => WARN.has(String(e.n).toLowerCase());
const preset = (n) => PRESETS.find((p) => p.n.toLowerCase() === String(n).toLowerCase());
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v) || 0));

/** Max HP zonder tijdelijke effecten (Aid e.d.): wat je bewerkt en wat een sheet geeft */
export const baseMax = (c) => (c.max || 0) - (c.eff || []).reduce((a, e) => a + (e.hpd || 0), 0);

/** Korte omschrijving van wat het effect doet */
export function effText(e) {
  const v = e.v;
  if (e.st === "ac") return e.op === "=" ? `AC ${v}` : e.op === "min" ? `AC min. ${v}` : `${v >= 0 ? "+" : "−"}${Math.abs(v)} AC`;
  if (e.st === "max") return `${v >= 0 ? "+" : "−"}${Math.abs(v)} max HP`;
  return e.txt || "";
}

/** Effectieve AC: "=" vervangt de basis (hoogste telt), dan alle "+", dan "minimaal". Zonder bekende AC blijft het 0. */
export function effAc(c) {
  const E = (c.eff || []).filter((e) => e.st === "ac");
  const sets = E.filter((e) => e.op === "=").map((e) => e.v);
  if (!c.ac && !sets.length) return c.ac || 0;
  let ac = sets.length ? Math.max(...sets) : c.ac;
  for (const e of E) if (e.op === "+") ac += e.v;
  for (const e of E) if (e.op === "min") ac = Math.max(ac, e.v);
  return Math.max(0, ac);
}

/** Opbouw van de effectieve AC als tekst, bv. "16 + Shield 5 + Shield of Faith 2"; leeg zonder AC-effecten */
export function acBreakdown(c) {
  const E = (c.eff || []).filter((e) => e.st === "ac");
  if (!E.length) return "";
  const sets = E.filter((e) => e.op === "=");
  const top = sets.length ? sets.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const parts = [top ? `${top.v} (${top.n})` : String(c.ac || 0)];
  for (const e of E) if (e.op === "+") parts.push(`${e.v >= 0 ? "+" : "−"} ${e.n} ${Math.abs(e.v)}`);
  let t = parts.join(" ");
  for (const e of E) if (e.op === "min") t += `, minimaal ${e.v} (${e.n})`;
  return t;
}

/**
 * Effect toevoegen. spec: { n, st, op, v, txt, dex }, d: duur uit makeDur (of null), opt: { lr, by, spell, id }.
 * Hetzelfde effect (zelfde naam) stapelt niet (PHB p. 205): het oude wordt vervangen.
 */
export function addEffect(c, spec, d, opt = {}) {
  const out = fx();
  const n = String(spec.n || "").trim().slice(0, 60) || "Effect";
  const g = (preset(n) || {}).grp; // Half cover → Three-quarters cover: de oude vervalt
  for (const old of [...(c.eff || [])]) if (old.n.toLowerCase() === n.toLowerCase() || (g && (preset(old.n) || {}).grp === g)) removeEffect(c, old.id, null);
  const st = ["ac", "max"].includes(spec.st) ? spec.st : "";
  const op = st === "ac" && OPS.includes(spec.op) ? spec.op : "+";
  let v = st === "max" ? clampInt(spec.v, -999, 999) : st === "ac" ? clampInt(spec.v, op === "+" ? -20 : 0, 40) : 0;
  if (st === "ac" && spec.dex) v += c.dex || 0;
  const e = { id: opt.id || Math.random().toString(36).slice(2, 9), n, st, op, v, txt: String(spec.txt || "").slice(0, 120),
    end: String(spec.end || "").slice(0, 120), d: d || null, lr: !!opt.lr, by: opt.by || null, spell: opt.by ? String(opt.spell || n).slice(0, 120) : null, hpd: 0 };
  if (opt.by && opt.cast) e.cast = String(opt.cast).slice(0, 60);
  c.eff = [...(c.eff || []), e];
  if (st === "max" && v && c.max > 0) { // zonder bekende HP alleen een herinnering
    if (v > 0) {
      c.max += v;
      if (c.kind === "pc") out.msgs.push(...applyPcHp(c, v).msgs); // Aid: ook huidige HP omhoog, en wie op 0 lag komt bij
      else if (c.hp > 0) c.hp = Math.min(c.max, c.hp + v);
      e.hpd = v;
    } else {
      // max blijft ≥ 1 (0 betekent in de app "HP onbekend"); de dood zelf staat in hp/ds
      const zero = c.max + v <= 0, nm = Math.max(1, c.max + v);
      const was = c.kind === "pc" ? !!(c.ds && c.ds.dead) : c.hp <= 0; // al dood of neer: geen tweede sterfmelding
      e.hpd = nm - c.max;
      c.max = nm; c.hp = zero ? 0 : Math.min(c.hp, c.max);
      if (zero && !was) return merge(out, dieByMax(c, n));
    }
  }
  out.msgs.push(`${c.name}: ${n}${st ? ` (${effText(e)})` : e.txt ? ` (${e.txt})` : ""}.`);
  return out;
}

/** Max HP tot 0 (Life Drain e.d., MM): het doelwit sterft. Speler: dood zoals bij 3 failures; monster: neer. */
function dieByMax(c, n) {
  const out = fx();
  c.temp = 0;
  if (c.kind === "pc") { c.ds = { ...newDs(), f: 3, dead: true }; setUncon(c, true); }
  merge(out, dropConc(c, "max HP 0"));
  out.why.push({ t: `max HP tot 0 door ${n}`, id: c.id }); out.msgs.unshift(`${c.name} sterft: max HP 0 (${n}).`);
  return out;
}

/** Save-bonussen uit effecten (PHB: cover op Dex saves, hoogste telt; Bless/Bane ±1d4). → [{ n, b } of { n, d }] */
export function saveMods(c, ab) {
  let cover = null;
  const out = [];
  for (const e of c.eff || []) {
    const p = preset(e.n);
    if (!p || !p.sv || (p.sv.ab && p.sv.ab !== ab)) continue;
    if (p.grp === "cover") { if (!cover || p.sv.b > cover.b) cover = { n: p.n, b: p.sv.b }; }
    else out.push(p.sv.d ? { n: p.n, d: p.sv.d } : { n: p.n, b: p.sv.b });
  }
  return cover ? [cover, ...out] : out;
}

/** "+2 Half cover, +1d4 Bless" */
export const modsText = (M) => M.map((m) => (m.d ? `${m.d > 0 ? "+" : "−"}1d${Math.abs(m.d)} ${m.n}` : `${m.b >= 0 ? "+" : "−"}${Math.abs(m.b)} ${m.n}`)).join(", ");

/**
 * Nieuwe cast van een concentratie-spell door dezelfde caster (Bless op nieuwe doelen): effecten uit een eerdere cast vervallen.
 * cast = sleutel van deze cast (ronde + beurt); doelen die in dezelfde beurt worden aangetikt horen bij dezelfde cast.
 */
export function endOtherCasts(list, by, spell, cast, active = null) {
  const out = fx();
  for (const c of list) for (const e of [...(c.eff || [])]) {
    if (e.by !== by || e.spell !== spell || e.cast === cast) continue;
    const r = removeEffect(c, e.id, `${spell} opnieuw gecast`, { active }); out.msgs.push(...r.msgs); out.why.push(...r.why);
  }
  return out;
}

/**
 * Effect weghalen; max HP-verschil terugdraaien. why = reden voor het logboek (null = stil, bv. bij vervangen).
 * opt.active = wie aan de beurt is (Lethargy midden in de eigen beurt duurt t/m het einde van de volgende);
 * opt.after = false: geen vervolgeffect (gevecht voorbij).
 */
export function removeEffect(c, id, why = "handmatig", opt = {}) {
  const out = fx();
  const e = (c.eff || []).find((x) => x.id === id);
  if (!e) return out;
  c.eff = c.eff.filter((x) => x !== e);
  if (e.hpd) revertMax(c, e.hpd);
  if (why === null) return out;
  const nx = opt.after !== false && (preset(e.n) || {}).after;
  const alive = !(c.kind === "monster" && c.hp <= 0) && !(c.ds && c.ds.dead);
  out.why.push({ t: why, id: c.id });
  out.msgs.push(`${c.name}: ${e.n} is voorbij${why && why !== "handmatig" ? ` (${why})` : ""}.${nx ? (alive ? ` ${nx.n} tot na de volgende beurt.` : "") : e.end ? ` ${e.end}.` : ""}`);
  if (nx && alive) {
    // PHB: "can't move or take actions until after its next turn"; midden in de eigen beurt telt die beurt niet
    addEffect(c, nx, { kind: "tend", who: c.id, at: "end", count: opt.active === c.id ? 2 : 1 });
    out.why.push({ t: `${nx.n} na ${e.n}`, id: c.id });
  }
  return out;
}

/** Beurtgrens: effecten met een duur aftellen (zelfde regels als condities) */
export function tickEffects(list, at, id) {
  const out = fx();
  for (const c of list) for (const e of [...(c.eff || [])]) {
    const d = e.d;
    if (!d || d.who !== id || d.at !== at || !d.count) continue;
    d.count--;
    if (d.count <= 0) { const r = removeEffect(c, e.id, "duur verlopen"); out.msgs.push(...r.msgs); out.why.push(...r.why); }
  }
  return out;
}

/** Concentratie-effecten opruimen als de caster weg is, niet meer concentreert of op iets anders concentreert */
export function endConcEffects(list, active = null) {
  const out = fx();
  for (const c of list) for (const e of [...(c.eff || [])]) {
    if (!e.by) continue;
    const by = list.find((x) => x.id === e.by);
    const ok = by && by.cond.includes("Concentrating") && !(by.concSpell && e.spell && by.concSpell !== e.spell);
    if (!ok) { const r = removeEffect(c, e.id, `concentratie${by ? ` van ${by.name}` : ""} voorbij`, { active }); out.msgs.push(...r.msgs); out.why.push(...r.why); }
  }
  return out;
}

/** Gevecht gestopt: effecten met een duur in rondes/beurten vervallen; "onbeperkt" en "tot long rest" blijven */
export function endFightEffects(list) {
  const out = fx();
  for (const c of list) for (const e of [...(c.eff || [])]) {
    if (!e.d || e.d.kind === "inf") continue;
    const r = removeEffect(c, e.id, "gevecht voorbij", { after: false }); out.msgs.push(...r.msgs); out.why.push(...r.why);
  }
  return out;
}

// Tijdelijke effecten op een deelnemer (5e 2014): op AC (+N, =N, minimaal N), op max HP (±N) of alleen een herinnering.
// Duur zoals bij condities (zie makeDur in turns.js), "tot long rest", en optioneel gekoppeld aan de concentratie van een caster.
// De basis-AC blijft in c.ac; de kaart toont effAc(c). Max HP-effecten passen c.max echt aan en onthouden hun verschil (hpd).
import { fx, applyPcHp, revertMax } from "./combat.js";

/** Presets. dur: sleutel uit DURS (turns.js) of "lr" (tot long rest). dex: 13 + Dex-mod (Mage Armor). */
export const PRESETS = [
  { n: "Shield", st: "ac", op: "+", v: 5, dur: "tstart", react: true, txt: "reaction; ook geen schade van Magic Missile" },
  { n: "Shield of Faith", st: "ac", op: "+", v: 2, dur: "r100", conc: true },
  { n: "Haste", st: "ac", op: "+", v: 2, dur: "r10", conc: true, txt: "speed ×2, advantage op Dex saves, extra action", end: "1 beurt geen beweging of acties (lethargy)" },
  { n: "Mage Armor", st: "ac", op: "=", v: 13, dex: true, dur: "lr", txt: "alleen zonder armor" },
  { n: "Barkskin", st: "ac", op: "min", v: 16, dur: "inf", conc: true },
  { n: "Half cover", st: "ac", op: "+", v: 2, dur: "inf", txt: "ook +2 op Dex saves" },
  { n: "Three-quarters cover", st: "ac", op: "+", v: 5, dur: "inf", txt: "ook +5 op Dex saves" },
  { n: "Aid", st: "max", op: "+", v: 5, dur: "lr", txt: "+5 per slot-level boven de 2e" },
  { n: "Bless", st: "", v: 0, dur: "r10", conc: true, txt: "+1d4 op attack rolls en saves" },
  { n: "Bane", st: "", v: 0, dur: "r10", conc: true, txt: "−1d4 op attack rolls en saves" },
];

const OPS = ["+", "=", "min"];
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
  const old = (c.eff || []).find((e) => e.n.toLowerCase() === n.toLowerCase());
  if (old) removeEffect(c, old.id, null);
  const st = ["ac", "max"].includes(spec.st) ? spec.st : "";
  const op = st === "ac" && OPS.includes(spec.op) ? spec.op : "+";
  let v = st === "max" ? clampInt(spec.v, -999, 999) : st === "ac" ? clampInt(spec.v, op === "+" ? -20 : 0, 40) : 0;
  if (st === "ac" && spec.dex) v += c.dex || 0;
  const e = { id: opt.id || Math.random().toString(36).slice(2, 9), n, st, op, v, txt: String(spec.txt || "").slice(0, 120),
    end: String(spec.end || "").slice(0, 120), d: d || null, lr: !!opt.lr, by: opt.by || null, spell: opt.by ? String(opt.spell || n).slice(0, 120) : null, hpd: 0 };
  c.eff = [...(c.eff || []), e];
  if (st === "max" && v && c.max > 0) { // zonder bekende HP alleen een herinnering
    if (v > 0) {
      c.max += v;
      if (c.kind === "pc") out.msgs.push(...applyPcHp(c, v).msgs); // Aid: ook huidige HP omhoog, en wie op 0 lag komt bij
      else if (c.hp > 0) c.hp = Math.min(c.max, c.hp + v);
      e.hpd = v;
    } else {
      const nm = Math.max(1, c.max + v);
      e.hpd = nm - c.max;
      c.max = nm; c.hp = Math.min(c.hp, c.max);
    }
  }
  out.msgs.push(`${c.name}: ${n}${st ? ` (${effText(e)})` : e.txt ? ` (${e.txt})` : ""}.`);
  return out;
}

/** Effect weghalen; max HP-verschil terugdraaien. why = reden voor het logboek (null = stil, bv. bij vervangen). */
export function removeEffect(c, id, why = "handmatig") {
  const out = fx();
  const e = (c.eff || []).find((x) => x.id === id);
  if (!e) return out;
  c.eff = c.eff.filter((x) => x !== e);
  if (e.hpd) revertMax(c, e.hpd);
  if (why !== null) { out.why.push({ t: why, id: c.id }); out.msgs.push(`${c.name}: ${e.n} is voorbij${why && why !== "handmatig" ? ` (${why})` : ""}.${e.end ? ` ${e.end}.` : ""}`); }
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
export function endConcEffects(list) {
  const out = fx();
  for (const c of list) for (const e of [...(c.eff || [])]) {
    if (!e.by) continue;
    const by = list.find((x) => x.id === e.by);
    const ok = by && by.cond.includes("Concentrating") && !(by.concSpell && e.spell && by.concSpell !== e.spell);
    if (!ok) { const r = removeEffect(c, e.id, `concentratie${by ? ` van ${by.name}` : ""} voorbij`); out.msgs.push(...r.msgs); out.why.push(...r.why); }
  }
  return out;
}

/** Gevecht gestopt: effecten met een duur in rondes/beurten vervallen; "onbeperkt" en "tot long rest" blijven */
export function endFightEffects(list) {
  const out = fx();
  for (const c of list) for (const e of [...(c.eff || [])]) {
    if (!e.d || e.d.kind === "inf") continue;
    const r = removeEffect(c, e.id, "gevecht voorbij"); out.msgs.push(...r.msgs); out.why.push(...r.why);
  }
  return out;
}

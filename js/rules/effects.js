// Tijdelijke effecten op een deelnemer (5e 2014): op AC (+N, =N, minimaal N), op max HP (±N) of alleen een herinnering.
// Duur zoals bij condities (zie makeDur in turns.js), "tot long rest", en optioneel gekoppeld aan de concentratie van een caster.
// De basis-AC blijft in c.ac; de kaart toont effAc(c). Max HP-effecten passen c.max echt aan en onthouden hun verschil (hpd).
import { fx, say, applyPcHp, revertMax, newDs, setUncon, dropConc, merge, exhEffect, reExh } from "./combat.js";
import { M, J } from "../i18n/msg.js";
import { tr } from "../i18n/boot.js";
/** Reden "handmatig" (descriptor, of de oude tekst): dan geen "(reden)" in de melding */
import { DTYPES } from "./aoe.js";
import { isExh, exhLevel, exhMod, exhEd, exh24 } from "./conditions.js";
const manual = (w) => w === "handmatig" || (!!w && w.k === "rules.manual");

/**
 * Presets. dur: sleutel uit DURS (turns.js) of "lr" (tot long rest). dex: 13 + Dex-mod (Mage Armor).
 * after: effect dat volgt als dit effect afloopt (Haste → Lethargy, tot na de volgende beurt van het doelwit); after.cond = ook die conditie.
 * r24: afwijkingen volgens de spellregels van 2024 (instelling "Spells"), zie presetsFor.
 * lv: spell-level (WP9: slot afschrijven bij Shield en bij een nieuwe cast van de caster).
 * tk: uitleg als catalogussleutel (dnd.pre.*, WP29): het effect bewaart de sleutel, niet de tekst, zodat die in de taal
 *   van de app verschijnt; eigen effecten hebben txt (tekst van de DM, inhoud). sh: korte, taalneutrale tekst in het Effect-paneel.
 * sv: invloed op saves ({ ab, b } vaste bonus, alleen op die ability; { d } = ±1dN op elke save). grp: sluiten elkaar uit (cover).
 */
export const PRESETS = [
  { n: "Shield", lv: 1, st: "ac", op: "+", v: 5, dur: "tstart", react: true, tk: "dnd.pre.shield" },
  { n: "Shield of Faith", lv: 1, st: "ac", op: "+", v: 2, dur: "r100", conc: true },
  { n: "Haste", lv: 3, st: "ac", op: "+", v: 2, dur: "r10", conc: true, tk: "dnd.pre.haste", after: { n: "Lethargy", tk: "dnd.pre.lethargy" },
    r24: { after: { n: "Lethargy", tk: "dnd.pre.lethargy24", cond: "Incapacitated" } } },
  { n: "Mage Armor", lv: 1, st: "ac", op: "=", v: 13, dex: true, dur: "lr", tk: "dnd.pre.mageArmor" },
  { n: "Barkskin", lv: 2, st: "ac", op: "min", v: 16, dur: "inf", conc: true, r24: { v: 17, conc: false, tk: "dnd.pre.barkskin24" } },
  { n: "Half cover", st: "ac", op: "+", v: 2, dur: "inf", tk: "dnd.pre.halfCover", sv: { ab: "DEX", b: 2 }, grp: "cover" },
  { n: "Three-quarters cover", st: "ac", op: "+", v: 5, dur: "inf", tk: "dnd.pre.tqCover", sv: { ab: "DEX", b: 5 }, grp: "cover" },
  { n: "Aid", lv: 2, st: "max", op: "+", v: 5, dur: "lr", tk: "dnd.pre.aid" },
  { n: "Bless", lv: 1, st: "", v: 0, dur: "r10", conc: true, tk: "dnd.pre.bless", sh: "+1d4", sv: { d: 4 } },
  { n: "Bane", lv: 1, st: "", v: 0, dur: "r10", conc: true, tk: "dnd.pre.bane", sh: "−1d4", sv: { d: -4 } },
  // RE16: barbarian (2014). Geen spell: geen caster-koppeling en geen 2024-variant. rs = tijdelijke resistance.
  { n: "Rage", st: "", v: 0, dur: "r10", rage: true, pc: true, rs: ["bludgeoning", "piercing", "slashing"], tk: "dnd.pre.rage" },
];

const OPS = ["+", "=", "min"];
/** Vervolgeffecten die de DM moet zien (Lethargy): waarschuwingskleur en vooraan */
const WARN = new Set(PRESETS.filter((p) => p.after).map((p) => p.after.n.toLowerCase()));
export const isWarn = (e) => WARN.has(String(e.n).toLowerCase());
const preset = (n) => PRESETS.find((p) => p.n.toLowerCase() === String(n).toLowerCase());
/** Presets volgens de spellregels (zelfde volgorde en index als PRESETS); bij 2024 met de afwijkingen erin en `ed: "2024"` */
const P24 = PRESETS.map((p) => (p.r24 ? { ...p, ...p.r24, ed: "2024" } : p)); // één keer, niet per render
export const presetsFor = (ed = "2014") => (ed === "2024" ? P24 : PRESETS);
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v) || 0));

/** Max HP zonder tijdelijke effecten (Aid e.d.): wat je bewerkt en wat een sheet geeft */
export const baseMax = (c) => (c.max || 0) - (c.eff || []).reduce((a, e) => a + (e.hpd || 0), 0);

/** Korte omschrijving van wat het effect doet */
export function effText(e) {
  const v = e.v;
  if (e.st === "ac") return e.op === "=" ? `AC ${v}` : e.op === "min" ? `AC min. ${v}` : `${v >= 0 ? "+" : "−"}${Math.abs(v)} AC`;
  if (e.st === "max") return `${v >= 0 ? "+" : "−"}${Math.abs(v)} max HP`;
  return effNote(e);
}
/** Uitlegsleutels van de presets (en hun vervolg): alleen deze mogen uit een import komen (cleanTk) */
const TKS = new Set([...PRESETS.flatMap((p) => [p.tk, p.after && p.after.tk, p.r24 && p.r24.tk, p.r24 && p.r24.after && p.r24.after.tk]), "dnd.pre.rageBear"].filter(Boolean));
/** Uitlegsleutel uit opgeslagen/geïmporteerde data: alleen een bekende, anders weg (dan telt txt) */
export const cleanTk = (k) => (typeof k === "string" && TKS.has(k) ? k : undefined);
/** Notitie bij een effect als tekst in de taal: presetuitleg (tk), anders de tekst van de DM */
export const effNote = (e) => (e && e.tk && TKS.has(e.tk) ? tr(M(e.tk)) : (e && e.txt) || "");

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
  const e = { id: opt.id || Math.random().toString(36).slice(2, 9), n, st, op, v, txt: String(spec.txt || "").slice(0, 120), ...(cleanTk(spec.tk) ? { tk: spec.tk } : {}),
    end: String(spec.end || "").slice(0, 120), d: d || null, lr: !!opt.lr, by: opt.by || null, spell: opt.by ? String(opt.spell || n).slice(0, 120) : null, hpd: 0 };
  if (opt.by && opt.cast) e.cast = String(opt.cast).slice(0, 60);
  const rs = cleanRs(spec.rs);
  if (rs) e.rs = rs; // tijdelijke resistance (Rage)
  if (spec.rage) { e.rg = 1; if (spec.frz) e.frz = 1; if (spec.bear) e.bear = 1; if (spec.ed === "2024") e.ed = "2024"; } // WP50: regels vast bij de rage
  // vervolg (Lethargy) vastleggen bij het effect: een latere wissel van de spellregels verandert een lopende spell niet
  if (spec.after && spec.after.n) e.af = { n: String(spec.after.n).slice(0, 60), txt: String(spec.after.txt || "").slice(0, 120), ...(cleanTk(spec.after.tk) ? { tk: spec.after.tk } : {}), ...(spec.after.cond ? { cond: String(spec.after.cond).slice(0, 20) } : {}) };
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
  if (st === "max") reExh(c); // Aid bij Exhaustion 4+: de halvering op de nieuwe max
  out.msgs.push(say("rules.eff", { name: c.name, what: st ? `${n} (${effText(e)})` : effNote(e) ? `${n} (${effNote(e)})` : n }));
  return out;
}

/** Max HP tot 0 (Life Drain e.d., MM): het doelwit sterft. Speler: dood zoals bij 3 failures; monster: neer. */
function dieByMax(c, n) {
  const out = fx();
  c.temp = 0;
  if (c.kind === "pc") { c.ds = { ...newDs(), f: 3, dead: true }; setUncon(c, true); }
  merge(out, dropConc(c, "max HP 0"));
  out.why.push({ t: M("rules.max0Why", { what: n }), id: c.id }); out.msgs.unshift(say("rules.max0", { name: c.name, what: n }));
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
  const ex = exhMod(c); // WP50: Exhaustion 2024 = −2 × niveau op elke save
  if (ex) out.push(ex);
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
    const r = removeEffect(c, e.id, M("rules.recast", { spell }), { active }); out.msgs.push(...r.msgs); out.why.push(...r.why);
  }
  return out;
}

/**
 * Effect weghalen; max HP-verschil terugdraaien. why = reden voor het logboek (null = stil, bv. bij vervangen).
 * opt.active = wie aan de beurt is (Lethargy midden in de eigen beurt duurt t/m het einde van de volgende);
 * opt.after = false: geen vervolgeffect (gevecht voorbij).
 */
export function removeEffect(c, id, why = M("rules.manual"), opt = {}) {
  const out = fx();
  const e = (c.eff || []).find((x) => x.id === id);
  if (!e) return out;
  c.eff = c.eff.filter((x) => x !== e);
  if (e.hpd) { revertMax(c, e.hpd); if (!isExh(e)) reExh(c); }
  if (why === null) return out;
  if (e.frz && e.ed !== "2024") { // Frenzy (Path of the Berserker 2014): na afloop één niveau exhaustion, ook als het gevecht stopt; 2024 niet (WP50)
    const r = setExh(c, exhLevel(c) + 1, M("rules.frenzyEnd"));
    out.why.push(...r.why); out.msgs.push(...r.msgs);
  }
  const nx = opt.after !== false && (e.af || (preset(e.n) || {}).after); // oude opslag zonder af: de 2014-preset
  const alive = !(c.kind === "monster" && c.hp <= 0) && !(c.ds && c.ds.dead);
  out.why.push({ t: why, id: c.id });
  const what = nx && (nx.cond ? say("rules.afterCond", { cond: nx.cond, what: effNote(nx) || nx.n }) : say("rules.after", { name: nx.n }));
  const end = say(why && !manual(why) ? "rules.overWhy" : "rules.over", { name: c.name, what: e.n, why: why || "" });
  out.msgs.push(`${end}${nx ? (alive ? ` ${what}` : "") : e.end ? ` ${e.end}.` : ""}`);
  if (nx && alive) {
    // PHB 2014: "can't move or take actions until after its next turn"; 2024: Incapacitated en speed 0 tot einde volgende beurt.
    // Midden in de eigen beurt telt die beurt niet.
    const dur = () => ({ kind: "tend", who: c.id, at: "end", count: opt.active === c.id ? 2 : 1 });
    addEffect(c, { n: nx.n, txt: nx.txt, tk: nx.tk }, dur());
    out.why.push({ t: M("rules.afterWhy", { name: nx.n, of: e.n }), id: c.id });
    if (nx.cond && !c.cond.includes(nx.cond)) { // al Incapacitated (met eigen duur): niet overschrijven
      c.cond = [...c.cond, nx.cond];
      c.cd = { ...(c.cd || {}), [nx.cond]: dur() };
      merge(out, dropConc(c, M("rules.condBy", { cond: nx.cond, name: nx.n }))); // Incapacitated beëindigt concentratie
    }
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
    if (d.count <= 0) { const r = removeEffect(c, e.id, M("rules.durEnd")); out.msgs.push(...r.msgs); out.why.push(...r.why); }
  }
  return out;
}

/** Concentratie-effecten opruimen als de caster weg is, niet meer concentreert of op iets anders concentreert */
export function endConcEffects(list, active = null) {
  const out = fx();
  // herhalen: een vervolg (Haste 2024 → Incapacitated) kan de concentratie van het doelwit breken, en daarmee diens effecten
  for (let more = true, n = 0; more && n < 10; n++) {
    more = false;
    for (const c of list) for (const e of [...(c.eff || [])]) {
      if (!e.by) continue;
      const by = list.find((x) => x.id === e.by);
      const ok = by && by.cond.includes("Concentrating") && !(by.concSpell && e.spell && by.concSpell !== e.spell);
      if (!ok) { const r = removeEffect(c, e.id, by ? M("rules.concOfEnd", { name: by.name }) : M("rules.concEnd"), { active }); out.msgs.push(...r.msgs); out.why.push(...r.why); more = true; }
    }
  }
  return out;
}

/** Gevecht gestopt: effecten met een duur in rondes/beurten vervallen; "onbeperkt" en "tot long rest" blijven */
export function endFightEffects(list) {
  const out = fx();
  for (const c of list) for (const e of [...(c.eff || [])]) {
    if (!e.d || e.d.kind === "inf") continue;
    const r = removeEffect(c, e.id, M("rules.fightEnd"), { after: false }); out.msgs.push(...r.msgs); out.why.push(...r.why);
  }
  return out;
}

/**
 * Eigen effect uit het formulier (AF15): keuze k = ac+ | ac- | ac= | acmin | max | max- | txt, waarde altijd positief ingetikt.
 * Geeft { st, op, v }; AC − en Max HP − slaan een negatieve v op, zoals voorheen ("AC +/−" met −2).
 */
export function effSpec(k, v) {
  const n = Math.abs(parseInt(v) || 0), neg = k === "ac-" || k === "max-";
  const st = /^ac/.test(k) ? "ac" : /^max/.test(k) ? "max" : "";
  return { st, op: k === "ac=" ? "=" : k === "acmin" ? "min" : "+", v: neg ? -n : n };
}

/* ---------- Exhaustion (RE11, PHB 2014) ---------- */

/**
 * Exhaustion op niveau x zetten (0 = weg). Eén effect "Exhaustion" met niveau `x`; niveau 4+ halveert max HP (hpd,
 * draait terug bij een lager niveau), niveau 6 is de dood. why = reden voor het logboek.
 * ed = regels (WP50; 2024: geen halvering, −2 × niveau op d20-tests); zonder ed de regels van het huidige effect.
 */
export function setExh(c, x, why = M("rules.manual"), ed) {
  const out = fx();
  x = Math.max(0, Math.min(6, Math.round(+x) || 0));
  const old = (c.eff || []).find(isExh), was = exhLevel(c);
  if (ed === undefined) ed = exhEd(c);
  if (x === was) return out;
  if (old) removeEffect(c, old.id, null);
  out.why.push({ t: why && !manual(why) ? J([`Exhaustion ${was} → ${x} (`, why, ")"], "") : `Exhaustion ${was} → ${x}`, id: c.id });
  if (!x) { out.msgs.push(say("rules.exhEnd", { name: c.name })); return out; }
  exhEffect(c, x, ed);
  const dead = c.kind === "pc" ? !!(c.ds && c.ds.dead) : c.max > 0 && c.hp <= 0;
  if (x === 6 && !dead) {
    if (c.kind === "pc") { c.ds = { ...newDs(), f: 3, dead: true }; c.hp = 0; c.temp = 0; setUncon(c, true); }
    else { c.hp = 0; c.temp = 0; }
    merge(out, dropConc(c, "Exhaustion 6"));
    out.msgs.push(say("rules.exh6", { name: c.name }));
    return out;
  }
  out.msgs.push(x > was ? say("rules.exhUp", { name: c.name, n: x, what: ed === "2024" ? exh24(x, ", ") : M(`dnd.exh.s${x}`) }) : say("rules.exhLvl", { name: c.name, n: x }));
  return out;
}

/** Effectnaam zoals de chip hem toont: "Exhaustion 2", anders de naam */
export const effName = (e) => (isExh(e) ? `Exhaustion ${Math.max(1, e.x | 0)}` : e.n);

/* ---------- Rage (RE16, barbarian 2014) ---------- */

const NO_RAGE = ["Incapacitated", "Paralyzed", "Petrified", "Stunned", "Unconscious"];
const RS_ALL = DTYPES.filter((t) => t !== "psychic"); // Bear Totem: alles behalve psychic
/** Geldige damage types of undefined */
export function cleanRs(a) {
  const r = Array.isArray(a) ? [...new Set(a.map((t) => String(t).toLowerCase()).filter((t) => DTYPES.includes(t)))].sort() : [];
  return r.length ? r : undefined;
}
export const isRage = (e) => !!(e && e.rg);
export const rageOf = (c) => (c && c.eff || []).find(isRage) || null;
/** Barbarian-level uit de klasse ("Barbarian 5 / Fighter 2" → 5), anders null */
export const barbLevel = (cls) => { const m = String(cls || "").match(/barbarian\D{0,20}?(\d{1,2})/i); return m ? Math.min(20, +m[1]) || null : null; };
/** Rage damage (PHB): +2 t/m level 8, +3 t/m 15, +4 vanaf 16; zonder level null */
export const rageDmg = (lvl) => (!lvl ? null : lvl >= 16 ? 4 : lvl >= 9 ? 3 : 2);
/** De sheet-resource "Rage" (D&D Beyond), of null */
export const rageRes = (c) => (c && c.res || []).find((r) => /^rage\b/i.test(String(r.n || ""))) || null;

/**
 * Rage starten. opt: { bear, frz }. d = duur (makeDur, 10 rondes). Lopende concentratie stopt (PHB: geen
 * concentratie tijdens rage); de sheet-resource telt af als hij er is. Op 0 HP kan het niet.
 */
export function startRage(c, d, opt = {}) { // opt.ed "2024" (WP50): schade houdt hem niet gaande, Frenzy zonder Exhaustion; d dan 10 minuten
  const out = fx();
  if (c.max && c.hp <= 0) { out.msgs.push(say("rules.rage0", { name: c.name })); return out; }
  const inc = c.cond.find((k) => NO_RAGE.includes(k)); // Rage is een bonus action
  if (inc) { out.msgs.push(say("rules.rageInc", { name: c.name, cond: inc })); return out; }
  const p = preset("Rage");
  merge(out, addEffect(c, { ...p, rs: opt.bear ? RS_ALL : p.rs, tk: opt.bear ? "dnd.pre.rageBear" : p.tk, bear: !!opt.bear, frz: !!opt.frz, ed: opt.ed }, d));
  const r = rageRes(c);
  if (r) {
    if (r.left > 0) { r.left--; out.msgs.push(say("rules.resLeft", { name: r.n, n: String(r.left), max: String(r.max) })); }
    else out.msgs.push(say("rules.resNone", { name: r.n }));
  }
  merge(out, dropConc(c, "Rage"));
  return out;
}

/** Rage voorbij als de barbarian bewusteloos is (0 HP of Unconscious); in commit(), zoals endConcEffects */
export function endRage(list) {
  const out = fx();
  for (const c of list) {
    const e = rageOf(c);
    if (!e) continue;
    if ((c.max && c.hp <= 0) || c.cond.includes("Unconscious")) {
      const r = removeEffect(c, e.id, M("rules.unc")); out.msgs.push(...r.msgs); out.why.push(...r.why);
    }
  }
  return out;
}

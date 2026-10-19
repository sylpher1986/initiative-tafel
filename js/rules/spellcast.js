// Spell op meerdere doelen (5e 2014): Bless, Bane, Hold Person, Hypnotic Pattern, Web of een eigen conditie.
// Eén caster, per doel een save (gefaald = effect/conditie, geslaagd = niets), alles in één stap.
// Condities van een concentratie-spell hangen aan de caster (cd[k].by/spell/cast), net als effecten:
// endConcConds haalt ze weg zodra die concentratie voorbij is (aangeroepen in commit()). Puur: geen DOM.
import { fx, merge, startConc } from "./combat.js";
import { PRESETS, addEffect, endOtherCasts } from "./effects.js";
import { makeDur, isOut } from "./turns.js";

/**
 * Presets. eff = effect-preset (effects.js), conds = condities bij een gefaalde save (de eerste bepaalt immuniteit),
 * rep = herhaalsave aan het einde van de beurt (open save, saves.js), side = wie standaard aan staat ("own" = kant van de caster).
 */
export const SPELLS = [
  { n: "Bless", eff: "Bless", conc: true, side: "own", sub: "+1d4 · conc" },
  { n: "Bane", eff: "Bane", ab: "CHA", conc: true, side: "other", sub: "CHA · −1d4" },
  { n: "Hold Person", ab: "WIS", conds: ["Paralyzed"], rep: true, dur: "r10", conc: true, side: "other", humanoid: true, sub: "WIS · Paralyzed" },
  { n: "Hypnotic Pattern", ab: "WIS", conds: ["Charmed", "Incapacitated"], dur: "r10", conc: true, side: "other", sub: "WIS · Charmed",
    note: "eindigt bij schade, of als iemand een actie gebruikt om het doel wakker te schudden" },
  { n: "Web", ab: "DEX", conds: ["Restrained"], dur: "r10", conc: true, side: "other", sub: "DEX · Restrained",
    note: "losbreken: actie, STR-check tegen de DC" },
];

/** Condities die een eigen spell kan geven (geen Concentrating of Unconscious: die volgen uit andere regels) */
export const SPELL_CONDS = ["Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned"];

/** Eigen spell uit het formulier: { n, cond, ab, dur, rep, conc } → spell-spec (zelfde vorm als SPELLS) */
export function customSpell(f) {
  const cond = SPELL_CONDS.includes(f.cond) ? f.cond : "Frightened";
  const ab = ["STR", "DEX", "CON", "INT", "WIS", "CHA"].includes(f.ab) ? f.ab : "";
  return { n: String(f.n || "").trim().slice(0, 60) || cond, ab, conds: [cond], rep: !!(ab && f.rep), dur: String(f.dur || "r10"), conc: f.conc !== false, side: "other", custom: true };
}

/** Wie een spell kan krijgen: iedereen die meedoet (geen lair, geen doden of monsters op 0 HP); HP hoeft niet bekend te zijn */
export const spellTargets = (list) => list.filter((c) => c.kind !== "lair" && !isOut(c));

/** Conditie-immuniteiten uit het statblock ("charmed, exhaustion, frightened") → ["Charmed", …] */
export function condImmune(m) {
  const v = ((m && Array.isArray(m.x) ? m.x : []).find((r) => r[0] === "Condition Immunities") || [])[1] || "";
  return SPELL_CONDS.filter((k) => new RegExp(`\\b${k}\\b`, "i").test(v));
}

/** Humanoid volgens het statblock; spelers tellen als humanoid, onbekend ook (de DM beslist) */
export const isHumanoid = (c, m) => c.kind === "pc" || !m || !m.meta || /\bhumanoid\b/i.test(String(m.meta).split(",")[0]);

/** Spell save DC van de caster: speler uit de sheet, monster uit "spell save DC 14" in het statblock; anders "" */
export function casterDC(c, m) {
  if (!c) return "";
  if (c.kind === "pc") { const n = parseInt(c.sheet && c.sheet.spellDC); return n > 0 ? String(n) : ""; }
  const txt = m ? [...(m.t || []), ...(m.a || [])].map((r) => r[1]).join("\n") : "";
  const hit = txt.match(/spell save DC (\d+)/i);
  return hit ? hit[1] : "";
}

/**
 * Standaardkeuze voor één doel: aan bij de goede kant, uit voor de caster, spelers op 0 HP, immuun of (Hold Person) geen humanoid.
 * → { sel, tags: [tekst], immune } (immune = immuun voor de hoofdconditie: krijgt niets, ook als de DM hem aanvinkt)
 */
export function spellDefault(sp, caster, c, m) {
  const tags = [];
  const im = sp.conds ? condImmune(m).filter((k) => sp.conds.includes(k)) : [];
  const immune = !!sp.conds && im.includes(sp.conds[0]);
  const human = !sp.humanoid || isHumanoid(c, m);
  if (caster && c.id === caster.id) tags.push("caster");
  if (immune) tags.push(`immuun ${im.join(", ")}`);
  if (!human) tags.push("geen humanoid");
  if (c.hidden) tags.push("verborgen");
  const own = caster ? (caster.kind === "pc") === (c.kind === "pc") : false;
  const side = sp.side === "own" ? own : !own;
  const sel = !!caster && side && c.id !== caster.id && !immune && human && !(c.kind === "pc" && c.max && c.hp <= 0);
  return { sel, tags, immune };
}

/** Cast-sleutel: doelen in dezelfde beurt horen bij dezelfde cast (zelfde schema als effecten) */
export const castKey = (round, active) => `${round || 0}:${active || ""}`;

/** Condities van een eerdere cast van dezelfde spell door dezelfde caster vervallen (opnieuw gecast op nieuwe doelen) */
export function endOtherCondCasts(list, by, spell, cast) {
  const out = fx();
  for (const c of list) for (const [k, e] of Object.entries(c.cd || {})) {
    if (!e || e.by !== by || e.spell !== spell || e.cast === cast) continue;
    merge(out, dropCond(c, k, `${spell} opnieuw gecast`));
  }
  return out;
}

function dropCond(c, k, why) {
  const out = fx();
  c.cond = c.cond.filter((x) => x !== k);
  if (c.cd) delete c.cd[k];
  out.why.push({ t: why, id: c.id });
  out.msgs.push(`${c.name}: ${k} is voorbij (${why}).`);
  return out;
}

/** Condities opruimen waarvan de caster weg is, niet meer concentreert of op een andere spell concentreert */
export function endConcConds(list) {
  const out = fx();
  for (const c of list) for (const [k, e] of Object.entries(c.cd || {})) {
    if (!e || !e.by || !c.cond.includes(k)) continue;
    const by = list.find((x) => x.id === e.by);
    const ok = by && by.cond.includes("Concentrating") && !(by.concSpell && e.spell && by.concSpell !== e.spell);
    if (!ok) merge(out, dropCond(c, k, `concentratie${by ? ` van ${by.name}` : ""} op ${e.spell || "spell"} voorbij`));
  }
  return out;
}

/**
 * Spell toepassen. picks: [{ c, ok, lr, note }] (alleen aangevinkte doelen; ok = save geslaagd, lr = legendary resistance gebruikt).
 * ctx: { round, active, dc }. Concentratie: start bij de caster, of dezelfde spell opnieuw in een latere beurt = nieuwe cast
 * (oude doelen vervallen). Geeft Fx plus { hit: [namen], ok: [namen], immune: [namen] } terug.
 */
export function castSpell(list, sp, caster, picks, ctx = {}) {
  const out = Object.assign(fx(), { hit: [], ok: [], immune: [] });
  const by = sp.conc && caster ? caster.id : null, cast = castKey(ctx.round, ctx.active), dc = parseInt(ctx.dc) || 0;
  const label = `${sp.n}${caster ? ` (${caster.name}${sp.ab ? `, ${sp.ab} ${dc || "?"}` : ""})` : ""}`;
  if (by) {
    if (caster.cond.includes("Concentrating") && caster.concSpell === sp.n) {
      const a = endOtherCasts(list, by, sp.n, cast, ctx.active), b = endOtherCondCasts(list, by, sp.n, cast);
      if (a.why.length || b.why.length) { out.why.push(...a.why, ...b.why, { t: `${sp.n} opnieuw gecast`, id: by }); out.msgs.push(...a.msgs, ...b.msgs); }
    } else merge(out, startConc(caster, sp.n));
  }
  const pre = sp.eff ? PRESETS.find((p) => p.n === sp.eff) : null;
  for (const p of picks) {
    const c = p.c, note = p.note ? `${p.note}, ` : "";
    if (p.lr && c.lr && c.lr.left > 0) { c.lr.left--; out.why.push({ t: "legendary resistance gebruikt", id: c.id }); }
    // wie niets krijgt verandert niet en heeft dus geen eigen logregel: de oorzaak hangt aan de caster
    const own = caster ? caster.id : c.id;
    if (p.ok || p.lr) { out.ok.push(c.name); out.why.push({ t: `${label}: ${c.name} ${note}save geslaagd, geen effect`, id: own }); continue; }
    if (sp.conds && condImmune(p.m).includes(sp.conds[0])) { out.immune.push(c.name); out.why.push({ t: `${label}: ${c.name} immuun voor ${sp.conds[0]}`, id: own }); continue; }
    out.hit.push(c.name);
    out.why.push({ t: `${label}${sp.ab ? `: ${note}save gefaald` : ""}`, id: c.id });
    if (pre) {
      merge(out, addEffect(c, pre, makeDur(c, { dur: pre.dur }, ctx.active), { by, spell: sp.n, cast }));
      continue;
    }
    c.cd = c.cd || {};
    sp.conds.forEach((k, i) => {
      if (!c.cond.includes(k)) c.cond = [...c.cond, k];
      const save = sp.rep && i === 0 && sp.ab && dc > 0 ? { ab: sp.ab, dc } : {};
      const d = makeDur(c, { dur: sp.dur, ...save }, ctx.active) || { kind: "inf" };
      c.cd[k] = by ? { ...d, by, spell: sp.n, cast } : d;
    });
  }
  return out;
}

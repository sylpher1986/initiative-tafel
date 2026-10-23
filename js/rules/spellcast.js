// Spell op meerdere doelen (5e 2014): Bless, Bane, Hold Person, Hypnotic Pattern, Web of een eigen conditie.
// Eén caster, per doel een save (gefaald = effect/conditie, geslaagd = niets), alles in één stap.
// Condities van een concentratie-spell hangen aan de caster (cd[k].by/spell/cast), net als effecten:
// endConcConds haalt ze weg zodra die concentratie voorbij is (aangeroepen in commit()). Puur: geen DOM.
import { fx, merge, startConc, dropConc, downPc } from "./combat.js";
import { PRESETS, presetsFor, addEffect, endOtherCasts } from "./effects.js";
import { isConc, keys } from "./spells.js";
import { makeDur, isOut } from "./turns.js";
import { NO_ACT } from "./legendary.js";

/**
 * Presets. eff = effect-preset (effects.js), conds = condities bij een gefaalde save (de eerste bepaalt immuniteit),
 * rep = herhaalsave aan het einde van de beurt (open save, saves.js), side = wie standaard aan staat ("own" = kant van de caster).
 * lvl = spell-level (slot afschrijven, WP9); max = aantal doelen op slot lvl (+1 doel per hoger slot; 2014 en 2024 gelijk); max 1 = geen voorselectie (RE8).
 * brk = condities vervallen per doel bij schade (combat.js applyDamage); then = gefaalde herhaalsave → deze conditie i.p.v. de eerste
 * (Sleep 2024: Incapacitated → Unconscious); auto = conditie-immuniteit waardoor de save vanzelf slaagt; ed = alleen bij die spellregels.
 * Index in deze lijst is stabiel (de UI bewaart hem): nieuwe presets achteraan, verbergen gaat via `ed`.
 */
export const SPELLS = [
  { n: "Bless", eff: "Bless", conc: true, side: "own", max: 3, lvl: 1, sub: "+1d4 · conc" },
  { n: "Bane", eff: "Bane", ab: "CHA", conc: true, side: "other", max: 3, lvl: 1, sub: "CHA · −1d4" },
  { n: "Hold Person", ab: "WIS", conds: ["Paralyzed"], rep: true, dur: "r10", conc: true, side: "other", humanoid: true, max: 1, lvl: 2, sub: "WIS · Paralyzed" },
  { n: "Hypnotic Pattern", lvl: 3, ab: "WIS", conds: ["Charmed", "Incapacitated"], dur: "r10", conc: true, side: "other", sub: "WIS · Charmed", brk: true,
    note: "vervalt vanzelf bij schade; ook als iemand een actie gebruikt om het doel wakker te schudden (conditie uitzetten)" },
  // Web duurt (concentratie) tot 1 uur: geen rondeteller, de concentratie van de caster beëindigt het
  { n: "Web", lvl: 2, ab: "DEX", conds: ["Restrained"], dur: "inf", conc: true, side: "other", sub: "DEX · Restrained",
    note: "losbreken: actie, STR-check tegen de DC" },
  // Sleep: Incapacitated blijft staan tot de tweede save is afgehandeld (geen eigen duur), zodat een vergeten save
  // de DM niet een gratis wakker doelwit kost; de save komt elke beurt terug tot hij is gerold
  { n: "Sleep", lvl: 1, ed: "2024", ab: "WIS", conds: ["Incapacitated"], dur: "inf", rep: true, then: "Unconscious", conc: true, side: "other", brk: true, auto: "exhaustion",
    sub: "WIS · 2e keer Unconscious",
    note: "einde volgende beurt opnieuw WIS-save, gefaald = Unconscious zolang de concentratie duurt. Vervalt bij schade of als iemand binnen 5 ft hem wakker maakt (conditie uitzetten). Wie niet slaapt (elfs, immuun voor exhaustion) slaagt vanzelf" },
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
  const v = immText(m);
  return SPELL_CONDS.filter((k) => new RegExp(`\\b${k}\\b`, "i").test(v));
}
const immText = (m) => ((m && Array.isArray(m.x) ? m.x : []).find((r) => r[0] === "Condition Immunities") || [])[1] || "";
/** Immuun voor deze spell: voor de hoofdconditie, of (Sleep) voor `auto` (exhaustion) → slaagt vanzelf */
export const spellImmune = (sp, m) => !!sp.conds && (condImmune(m).includes(sp.conds[0]) || (!!sp.auto && new RegExp(`\\b${sp.auto}\\b`, "i").test(immText(m))));
/**
 * Rekent de app voor deze spell anders bij 2014 en 2024? Concentratie verschilt, een effect-preset heeft 2024-afwijkingen
 * (Barkskin, Haste) of er is een preset voor maar één editie (Sleep). Zo niet, dan is de andere editie alleen leesstof.
 */
export function rulesDiffer(n) {
  const K = keys(n), has = (x) => K.includes(x.n.toLowerCase());
  return isConc(n, "2014") !== isConc(n, "2024") || PRESETS.some((p) => p.r24 && has(p)) || SPELLS.some((s) => s.ed && has(s));
}

/** Preset hoort bij deze spellregels (Sleep alleen bij 2024) */
export const spellFor = (sp, ed = "2014") => !sp.ed || sp.ed === ed;

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
 * → { sel, tags: [tekst], immune, fit } (immune = immuun voor de hoofdconditie: krijgt niets, ook als de DM hem aanvinkt;
 *   fit = komt in aanmerking: niet immuun, humanoid waar nodig; voor "Monsters"/"Spelers" aanvinken)
 */
export function spellDefault(sp, caster, c, m) {
  const tags = [];
  const im = sp.conds ? condImmune(m).filter((k) => sp.conds.includes(k)) : [];
  const immune = spellImmune(sp, m);
  if (immune && !im.length && sp.auto) im.push(sp.auto);
  const human = !sp.humanoid || isHumanoid(c, m);
  if (caster && c.id === caster.id) tags.push("caster");
  if (immune) tags.push(`immuun ${im.join(", ")}`);
  if (!human) tags.push("geen humanoid");
  if (c.hidden) tags.push("verborgen");
  const own = caster ? (caster.kind === "pc") === (c.kind === "pc") : false;
  const side = sp.side === "own" ? own : !own;
  const sel = !!caster && sp.max !== 1 && side && c.id !== caster.id && !immune && human && !(c.kind === "pc" && c.max && c.hp <= 0); // één doel: de DM kiest (RE8)
  return { sel, tags, immune, fit: !immune && human };
}

/** RE8: slot dat n doelen vraagt (max doelen op slot lvl, +1 per hoger slot); null zonder maximum of binnen het maximum */
export const slotFor = (sp, n) => (sp && sp.max && n > sp.max ? sp.lvl + n - sp.max : null);

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
  if (!(k === "Unconscious" && downPc(c))) c.cond = c.cond.filter((x) => x !== k); // speler op 0 HP blijft bewusteloos
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
 * ctx: { round, active, dc, ed } (ed = spellregels voor effect-presets). Concentratie: start bij de caster, of dezelfde spell opnieuw in een latere beurt = nieuwe cast
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
  const pre = sp.eff ? presetsFor(ctx.ed).find((p) => p.n === sp.eff) : null;
  for (const p of picks) {
    const c = p.c, note = p.note ? `${p.note}, ` : "";
    const lr = !p.ok && p.lr && c.lr && c.lr.left > 0; // zonder resistance over telt de save gewoon als gefaald
    if (lr) { c.lr.left--; out.why.push({ t: "legendary resistance gebruikt", id: c.id }); }
    // wie niets krijgt verandert niet en heeft dus geen eigen logregel: de oorzaak hangt aan de caster
    const own = caster ? caster.id : c.id;
    if (p.ok || lr) { out.ok.push(c.name); out.why.push({ t: `${label}: ${c.name} ${note}save geslaagd, geen effect`, id: own }); continue; }
    if (spellImmune(sp, p.m)) { out.immune.push(c.name); out.why.push({ t: `${label}: ${c.name} immuun voor ${condImmune(p.m).includes(sp.conds[0]) ? sp.conds[0] : sp.auto}`, id: own }); continue; }
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
      if (sp.brk) d.brk = 1; // vervalt bij schade
      if (sp.then && i === 0 && d.save) d.then = sp.then; // gefaalde herhaalsave → volgende fase (saves.js)
      c.cd[k] = by ? { ...d, by, spell: sp.n, cast } : d;
    });
    // PHB p. 203: incapacitated (ook Paralyzed/Stunned/Petrified) beëindigt de eigen concentratie; effecten volgen in commit()
    if (sp.conds.some((k) => NO_ACT.includes(k))) merge(out, dropConc(c, `${sp.conds.find((k) => NO_ACT.includes(k))} door ${sp.n}`));
  }
  return out;
}

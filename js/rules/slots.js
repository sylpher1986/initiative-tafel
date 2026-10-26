// Spell slots verbruiken (RE1/RE2, WP9) en Pact Magic apart (RE3), 5e 2014. Puur: geen DOM.
// casting = { slots: [{ lvl, max, left, spells }], daily: [{ label, items: [{ n, max, left }] }], pact?: { lvl, max, left } }
// Keuze-sleutels: "s3" = 3rd-level slot, "p" = Pact Magic-slot, "d1.0" = x/day-regel (groep 1, item 0), "self" = zelf bijhouden.
import { ORD, keys, splitSpells } from "./spells.js";
import { say } from "./combat.js";
import { M } from "../i18n/msg.js";

/** Pact Magic (PHB 2014): slot-level en aantal per warlock-level → { lvl, max } of null */
export function pactSlots(lv) {
  lv = lv | 0;
  if (lv < 1) return null;
  return { lvl: Math.min(5, Math.ceil(lv / 2)), max: lv >= 17 ? 4 : lv >= 11 ? 3 : lv >= 2 ? 2 : 1 };
}

/** x/day-regel met deze spell ("3/day each: fireball", "1/day: cone of cold") → { g, i, o, label } of null */
export function dailyFor(c, n) {
  const K = keys(n), D = (c && c.casting && c.casting.daily) || [];
  for (let g = 0; g < D.length; g++) for (let i = 0; i < D[g].items.length; i++) {
    const o = D[g].items[i];
    if (splitSpells(o.n).some((x) => keys(x).some((k) => K.includes(k)))) return { g, i, o, label: D[g].label.replace(/ each$/, "") };
  }
  return null;
}

/**
 * Keuzes voor een spell van level lv (0 = cantrip: geen). n = spellnaam (voor x/day).
 * x/day-regel bij deze spell → alleen die regel. Anders: gewone slots vanaf lv (max 4 levels, 3 met Pact) en Pact als die hoog genoeg is.
 * → [{ k, lvl, l, left, max }] (zonder "self": dat voegt de UI toe zodra er iets te kiezen is)
 */
export function slotChoices(c, lv, n = "") {
  lv = lv | 0;
  if (!lv || !c || !c.casting) return [];
  const d = n ? dailyFor(c, n) : null;
  if (d) return [{ k: `d${d.g}.${d.i}`, lvl: lv, l: d.label, left: d.o.left | 0, max: d.o.max | 0 }];
  const p = c.casting.pact, pk = p && p.max > 0 && p.lvl >= lv;
  // samen met "Zelf" max 5 knoppen: past op 320 px
  const out = (c.casting.slots || []).filter((s) => s.lvl >= lv && s.max > 0).sort((a, b) => a.lvl - b.lvl).slice(0, pk ? 3 : 4)
    .map((s) => ({ k: `s${s.lvl}`, lvl: s.lvl, l: ORD[s.lvl], left: s.left | 0, max: s.max | 0 }));
  if (pk) out.push({ k: "p", lvl: p.lvl, l: "Pact", left: p.left | 0, max: p.max | 0 });
  return out;
}

/**
 * Standaardkeuze: "self" als de caster zijn slots zelf bijhoudt (c.slotSelf, alleen door een tik van de DM); anders Pact als
 * die past en vrij is (komt terug na een short rest), dan het laagste vrije slot vanaf need (RE8: meer doelen = hoger slot).
 * Niets vrij: het laagste passende slot toch (de UI zegt "geen … meer over", er wordt niets afgeschreven; review: niet stil "Zelf").
 * Geen keuzes (cantrip, caster zonder slots) → "".
 */
export function defaultSlot(c, lv, n = "", need = lv) {
  const opts = slotChoices(c, lv, n);
  if (!opts.length) return "";
  if (c.slotSelf) return "self";
  const fit = opts.filter((o) => o.lvl >= need), free = fit.filter((o) => o.left > 0);
  return (free.find((o) => o.k === "p") || free[0] || fit[0] || opts[opts.length - 1]).k;
}

/** Slot-level van een keuze (voor upcast en het aantal doelen); "self"/""/x/day = het spell-level */
export function slotLevel(c, k, lv) {
  if (k && k[0] === "s") return +k.slice(1) || lv;
  if (k === "p" && c && c.casting && c.casting.pact) return c.casting.pact.lvl;
  return lv;
}

/** "3rd-level slot", "3rd-level Pact-slot", "1/day" */
export function slotName(c, k) {
  if (!k || !/^(s\d|p$|d\d)/.test(k)) return ""; // "self", "run" (concentratie loopt al)
  if (k === "p") return `${ORD[c.casting.pact.lvl]}-level Pact-slot`;
  if (k[0] === "d") { const [g] = k.slice(1).split(".").map(Number); return ((c.casting.daily[g] || {}).label || "x/day").replace(/ each$/, ""); }
  return `${ORD[+k.slice(1)]}-level slot`;
}

/** Het object achter een sleutel (met left/max), of null */
function slotObj(c, k) {
  const C = c && c.casting;
  if (!C || !k) return null;
  if (k === "p") return C.pact || null;
  if (k[0] === "d") { const [g, i] = k.slice(1).split(".").map(Number); return (C.daily[g] && C.daily[g].items[i]) || null; }
  if (k[0] === "s") return (C.slots || []).find((s) => s.lvl === +k.slice(1)) || null;
  return null;
}

/**
 * Slot afschrijven bij een cast (in dezelfde stap als de spell). k = keuze; "self", "run" of "" = niets afschrijven.
 * explicit = de DM tikte deze keuze: alleen dan wordt "Zelf" per caster onthouden (of weer vergeten bij een level).
 * Niets meer over: niet blokkeren, wel zeggen. Het afschrijven zelf komt in het logboek via de toestandsvergelijking (log.js);
 * hier alleen een oorzaak als er niets afgeschreven kon worden.
 * → { why: [{ t, id }], txt } (txt voor de melding: "3rd-level slot (1 over)" / "geen 3rd-level slot meer over" / "")
 */
export function spendSlot(c, k, spell, lv, explicit = false) {
  const out = { why: [], txt: "" };
  if (!c) return out;
  if (explicit && k && slotChoices(c, lv, spell).length) { if (k === "self") c.slotSelf = true; else if (k !== "run") delete c.slotSelf; }
  const o = slotName(c, k) ? slotObj(c, k) : null;
  if (!o) return out;
  const nm = slotName(c, k);
  if (!(o.left > 0)) {
    out.txt = say("rules.slot.none", { slot: nm });
    out.why.push({ t: M("rules.slot.noneWhy", { spell, slot: nm }), id: c.id });
    return out;
  }
  o.left--;
  out.txt = say("rules.slot.left", { slot: nm, n: String(o.left) });
  return out;
}

/** Shield, Bless e.d. vanuit het aanvals- of Effect-paneel: automatisch het laagste vrije slot (of zelf bijhouden) */
export const autoSpend = (c, spell, lv) => spendSlot(c, defaultSlot(c, lv, spell), spell, lv);

/** Short rest: Pact Magic-slots terug. → true als er iets terugkwam */
export function pactRest(c) {
  const p = c && c.casting && c.casting.pact;
  if (!p || p.left >= p.max) return false;
  p.left = p.max;
  return true;
}

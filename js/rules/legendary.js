// Legendary actions (5e 2014): opties uit het statblock en het gebruik ervan. Puur: geen DOM.
// Regels: alleen aan het einde van de beurt van een ander wezen, één optie tegelijk, kosten 1–3,
// herstel bij de start van de eigen beurt (turns.js), niet als incapacitated. Wanneer precies bepaalt de DM.
import { fx } from "./combat.js";
import { parseAction, useful } from "./attacks.js";
import { isOut } from "./turns.js";

/** Condities waarbij een wezen geen acties (dus ook geen legendary actions) kan nemen */
export const NO_ACT = ["Incapacitated", "Paralyzed", "Petrified", "Stunned", "Unconscious"];

const COST_RE = /\s*\(costs? (\d+) actions?\)/i;
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cache = new WeakMap();

/**
 * Legendary-opties van een monster (uit findMon): [{ n, cost, text, act, refs }].
 * act = de optie zelf als die iets te rollen heeft; refs = aanvallen waar de tekst naar verwijst
 * ("makes a tail attack", "uses its Paralyzing Touch", "one claw attack or tail attack"). Per monster-object onthouden.
 */
export function laOptions(m) {
  if (!m) return [];
  if (cache.has(m)) return cache.get(m);
  const acts = (Array.isArray(m.a) ? m.a : []).filter(Array.isArray).map(([k, v]) => parseAction(k, v)).filter((a) => !a.multi && useful(a));
  const out = (Array.isArray(m.l) ? m.l : []).filter(Array.isArray).map(([k, v]) => {
    const raw = String(k || ""), text = String(v || "");
    const c = raw.match(COST_RE);
    const cost = c ? Math.max(1, Math.min(3, +c[1])) : 1;
    const own = parseAction(raw.replace(COST_RE, ""), text);
    const t = text.toLowerCase();
    const refs = useful(own) ? [] : acts.filter((a) => {
      const n = reEsc(a.n.toLowerCase());
      return n && new RegExp(String.raw`\b(?:its|a|one) ${n}\b|\b${n} attack\b`).test(t);
    }).slice(0, 3);
    return { n: own.n, cost, text, act: useful(own) ? own : null, refs };
  });
  cache.set(m, out);
  return out;
}

/**
 * Kan dit monster nu een legendary action nemen? (alleen bij een lopend gevecht)
 * "ok" | "own" (zelf aan de beurt) | "empty" (0 over) | "inc" (incapacitated); null = hoort niet in de lijst (geen LA, neer, geen gevecht).
 */
export function laStatus(c, S) {
  if (!c || !c.la || !(c.la.max > 0) || !S.round || !S.active || isOut(c)) return null;
  if ((c.cond || []).some((x) => NO_ACT.includes(x))) return "inc";
  if (c.id === S.active) return "own";
  if (!(c.la.left > 0)) return "empty";
  return "ok";
}

/** Monsters die in de beurtbalk horen (in beurtvolgorde) */
export const laList = (S, sorted) => sorted.filter((c) => laStatus(c, S) !== null);

/** Een optie gebruiken: kosten aftrekken. Te duur of niet mogelijk → geen wijziging, met reden in msgs. */
export function useLA(c, opt, S) {
  const out = fx();
  const st = laStatus(c, S);
  const cost = Math.max(1, +opt.cost || 1);
  if (st !== "ok") { out.msgs.push(`${c.name} kan nu geen legendary action nemen.`); return out; }
  if (cost > c.la.left) { out.msgs.push(`${opt.n} kost ${cost} LA, ${c.name} heeft er nog ${c.la.left}.`); return out; }
  c.la.left -= cost;
  out.why.push({ t: `legendary action: ${opt.n}${cost > 1 ? ` (${cost} LA)` : ""}`, id: c.id });
  return out;
}

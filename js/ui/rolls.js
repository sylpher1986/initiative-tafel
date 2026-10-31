// G7 (WP79): adapters van Initiative-worpen naar het gedeelde worpformaat (js/dice/roll.js). Puur, geen DOM.
// js/rules/ blijft ongewijzigd: de regels leveren tot en ok, de adapters zetten alleen om. Niet opslaan of exporteren.
import { HD_RE } from "../dice/roll.js";
import { atkResult } from "../rules/attacks.js";
import { initThrow } from "../rules/turns.js";

const keepOf = (adv) => (adv > 0 ? "high" : adv < 0 ? "low" : "all");
const d20g = (vals, adv) => ({ c: vals.length, die: 20, vals: vals.slice(), keep: keepOf(adv) });
const vsOf = (k, n) => (Number.isFinite(n) && n > 0 ? { vs: { k, n } } : {});
/** Bonus zonder naam; 0 laten we weg (verandert het totaal niet) */
const bon = (b) => (b ? [{ n: "", b }] : []);
const sum = (a) => a.reduce((s, v) => s + v, 0);

/** To-hit (rollAttack/withAdv: { d, adv, nat, bo, m?, tot }) tegen AC ac; ok = raak volgens atkResult (nat 20/nat 1) */
export function fromAtk(r, ac) {
  return {
    g: [d20g(r.d, r.adv)],
    m: [...bon(r.bo), ...(r.m || []).map((x) => ({ n: x.n, b: x.b }))],
    tot: r.tot, nat: r.nat, adv: r.adv || 0,
    ...(Number.isFinite(ac) ? { vs: { k: "AC", n: ac }, ok: atkResult(r, ac, []).hit } : {}),
  };
}

/**
 * Schade (rollDmgCrit: [{ e, type, rolls, mod, total, xr }]) als één worp; crit = de extra dice (xr) tellen mee en
 * staan los in x. e komt uit rollExpr (HD_RE: één steengroep + vaste modifier). tot per deel nooit onder 0, zoals
 * partRaw in js/rules/attacks.js (daar niet geëxporteerd; tests/dice.test.js vergelijkt met atkResult().raw).
 */
export function fromDmg(parts, crit = false) {
  const g = [], m = [];
  let tot = 0;
  for (const p of parts || []) {
    const t = p.type ? { t: p.type } : {}, xr = crit ? p.xr || [] : [];
    const h = p.rolls.length ? String(p.e).replace(/−/g, "-").replace(/\s/g, "").match(HD_RE) : null;
    if (h) {
      g.push({ c: p.rolls.length, die: +h[2], vals: p.rolls.slice(), keep: "all", ...t, ...(xr.length ? { x: xr.slice() } : {}) });
      if (p.mod) m.push({ n: "", b: p.mod, ...t });
    } else if (p.total) m.push({ n: "", b: p.total, ...t });
    tot += Math.max(0, p.total + sum(xr));
  }
  return { g, m, tot };
}

/** Save (rollSave: { r, r2, bo, x, av, tot }) tegen DC dc: ✓ bij tot ≥ dc (zoals rollText) */
export function fromSave(x, dc) {
  const vals = x.r2 != null ? [x.r, x.r2] : [x.r];
  const adv = x.r2 != null ? (x.av < 0 ? -1 : 1) : 0;
  return {
    g: [d20g(vals, adv)],
    m: [...bon(x.bo), ...(x.x || []).map((y) => (y.d ? { n: y.n, die: y.d, v: y.r } : { n: y.n, b: y.b }))],
    tot: x.tot, nat: adv > 0 ? Math.max(...vals) : Math.min(...vals), adv,
    ...vsOf("DC", dc),
    ...(dc > 0 ? { ok: x.tot >= dc } : {}),
  };
}

/** Initiative (initThrow: één d20, of twee = disadvantage met de laagste) met bonus bo en Exhaustion em */
export function fromInit(dd, bo, em = null) {
  const it = initThrow(dd, bo, em), adv = dd.length > 1 ? -1 : 0;
  return { g: [d20g(dd, adv)], m: [...bon(bo), ...(em ? [{ n: em.n, b: em.b }] : [])], tot: it.v, nat: it.r, adv };
}

/** Death save: één d20, 10+ geslaagd (nat 20 en nat 1 markeert de weergave; de gevolgen staan in dsResult) */
export function fromDs(r) {
  return { g: [d20g([r], 0)], m: [], tot: r, nat: r, adv: 0, vs: { k: "DC", n: 10 }, ok: r >= 10 };
}

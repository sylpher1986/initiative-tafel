// Gedeelde dobbelsteenmodule (G7, WP79): worpformaat, rollen en vrije invoer. Puur, geen DOM, rng injecteerbaar.
// Importeert alleen ../i18n/* en ./* (tests/dice.test.js): nooit js/rules, js/ui, js/state.js of een tool.
// Worpformaat (alleen in het geheugen, nooit opgeslagen): docs/work-packages/g7-dobbelstenen.md → "Worpformaat".
//   { label?, g: [{ c, die, vals, keep, kn?, s?, x?, t? }], m: [{ n, b, t? } | { n, die, v }], tot, nat?, adv?, vs?, ok? }
//   kn = aantal dat telt bij keep "high"/"low" (standaard 1); s = -1 voor een afgetrokken groep; t = damage type (Engelse id).

export const d = (sides, rng = Math.random) => 1 + Math.floor(rng() * sides);

export const HD_RE = /^(\d+)d(\d+)([+-]\d+)?$/i;

/** "2d6+3", "2d6 - 1", "1d20+4" → { rolls, mod, total } of null */
export function rollExpr(expr, rng = Math.random) {
  const clean = String(expr).replace(/−/g, "-").replace(/\s/g, "");
  const m = clean.match(HD_RE);
  if (!m) return null;
  const rolls = [];
  for (let i = 0; i < +m[1]; i++) rolls.push(d(+m[2], rng));
  const bonus = m[3] ? +m[3] : 0;
  return { rolls, mod: bonus, total: rolls.reduce((a, b) => a + b, 0) + bonus };
}

/** Gemiddelde van een dobbelsteenformule, zoals statblocks het noteren ("5d8" → 22) */
export function avgExpr(expr) {
  const m = String(expr).replace(/\s/g, "").match(HD_RE);
  if (!m) return null;
  return Math.floor((+m[1] * (+m[2] + 1)) / 2) + (m[3] ? +m[3] : 0);
}

/* ---------- vrije invoer ---------- */

export const MAX_DICE = 100, MIN_DIE = 2, MAX_DIE = 1000, MAX_TERMS = 10;
const MAX_FLAT = 100000, MAX_LEN = 200;
const TERM_RE = /^([+-]?)(?:(\d{0,3})d(\d{1,4})(?:k([hl])(\d{0,3}))?|(\d{1,6}))/;

/**
 * Vrije invoer → termen, of null bij ongeldige invoer (nooit een uitzondering).
 * "2d6 + 1d4 + 3", "4d6kh3", "2d20kl1+3", "d20", "1d100 − 2". Grenzen: ≤ 100 stenen per term, d2–d1000, ≤ 10 termen.
 * → [{ s: 1|-1, c, die, keep: "all"|"high"|"low", kn } | { s, b }]
 */
export function parseExpr(s) {
  if (typeof s !== "string" && typeof s !== "number") return null;
  const raw = String(s);
  if (/[0-9a-z%]\s+[0-9a-z%]/i.test(raw)) return null; // "2d6 3" is geen 2d63
  let rest = raw.replace(/[−–]/g, "-").replace(/\s+/g, "").toLowerCase();
  if (!rest || rest.length > MAX_LEN) return null;
  const terms = [];
  while (rest) {
    const m = rest.match(TERM_RE);
    if (!m || !m[0] || (terms.length && !m[1])) return null; // na de eerste term moet er een + of − staan
    rest = rest.slice(m[0].length);
    const sign = m[1] === "-" ? -1 : 1;
    if (m[6] !== undefined) {
      const b = +m[6];
      if (b > MAX_FLAT) return null;
      terms.push({ s: sign, b });
    } else {
      const c = m[2] === "" ? 1 : +m[2], die = +m[3];
      if (c < 1 || c > MAX_DICE || die < MIN_DIE || die > MAX_DIE) return null;
      const keep = m[4] === "h" ? "high" : m[4] === "l" ? "low" : "all";
      const kn = keep === "all" ? c : m[5] === "" ? 1 : +m[5];
      if (kn < 1 || kn > c) return null;
      terms.push({ s: sign, c, die, keep, kn });
    }
    if (terms.length > MAX_TERMS) return null;
  }
  return terms.length ? terms : null;
}

/* ---------- worpformaat ---------- */

/** Indexen van de waarden die tellen (bij gelijke waarden de eerste): "all" alles, "high"/"low" de kn hoogste/laagste */
export function kept(g) {
  const vals = g.vals || [];
  if (g.keep !== "high" && g.keep !== "low") return vals.map((_, i) => i);
  const n = Math.max(1, Math.min(vals.length, g.kn || 1)), dir = g.keep === "high" ? -1 : 1;
  return vals.map((v, i) => i).sort((a, b) => dir * (vals[a] - vals[b]) || a - b).slice(0, n).sort((a, b) => a - b);
}

const gSum = (g) => (g.s === -1 ? -1 : 1) * (kept(g).reduce((s, i) => s + g.vals[i], 0) + (g.x || []).reduce((s, v) => s + v, 0));
const mSum = (x) => (Number.isFinite(x.b) ? x.b : x.die ? Math.sign(x.die) * (x.v || 0) : 0);

/** Totaal uit de stenen en modifiers. Een tool met regels geeft tot zelf mee; dan rekent niemand opnieuw. */
export const total = (r) => (r.g || []).reduce((s, g) => s + gSum(g), 0) + (r.m || []).reduce((s, x) => s + mSum(x), 0);

/** De d20 die telt, of null: alleen bij precies één tellende d20 (afgetrokken groepen tellen niet als d20-worp) */
function natOf(r) {
  const g20 = (r.g || []).filter((g) => g.die === 20 && g.s !== -1);
  if (g20.length !== 1) return null;
  const k = kept(g20[0]);
  return k.length === 1 ? g20[0].vals[k[0]] : null;
}
/** Nat 20/nat 1 als markering, alleen bij precies één tellende d20. De module beslist verder geen spelregels. */
export function natFlags(r) {
  const n = r ? natOf(r) : null;
  return { nat20: n === 20, nat1: n === 1 };
}

/**
 * Worpformaat uit een uitdrukking en al gerolde waarden (op volgorde per steen), zonder opnieuw te rollen.
 * opts: { label, x (extra waarden van de enige groep, bijv. crit-dice), t (damage type), tot }. null als het niet klopt.
 */
export function toRoll(expr, vals, opts) {
  opts = opts || {};
  const terms = Array.isArray(expr) ? expr : parseExpr(expr);
  if (!terms || !Array.isArray(vals)) return null;
  const g = [], m = [];
  let i = 0;
  for (const tm of terms) {
    if (tm.b !== undefined) { m.push({ n: "", b: (tm.s * tm.b) || 0, ...(opts.t ? { t: opts.t } : {}) }); continue; }
    const v = vals.slice(i, i + tm.c);
    if (v.length !== tm.c || v.some((x) => !Number.isInteger(x))) return null;
    i += tm.c;
    g.push({ c: tm.c, die: tm.die, vals: v, keep: tm.keep, ...(tm.keep !== "all" ? { kn: tm.kn } : {}), ...(tm.s < 0 ? { s: -1 } : {}), ...(opts.t ? { t: opts.t } : {}) });
  }
  if (i !== vals.length) return null;
  if (opts.x && opts.x.length && g.length === 1) g[0].x = opts.x.slice();
  return finish({ ...(opts.label ? { label: String(opts.label) } : {}), g, m }, opts.tot);
}

function finish(r, tot) {
  r.tot = Number.isFinite(tot) ? tot : total(r);
  const n = natOf(r);
  if (n !== null) r.nat = n;
  return r;
}

/** Vrije worp: "4d6kh3", "2d20kl1+3", "8d6", "1d100" → worpformaat, of null bij ongeldige invoer */
export function dice(expr, opts, rng = Math.random) {
  const terms = parseExpr(expr);
  if (!terms) return null;
  const vals = [];
  for (const tm of terms) for (let i = 0; i < (tm.c || 0); i++) vals.push(d(tm.die, rng));
  return toRoll(terms, vals, { label: opts && opts.label });
}

/**
 * d20-worp met advantage (1: hoogste van twee), disadvantage (-1: laagste) of normaal (0), plus modifiers met naam:
 * vast { n, b } (+5 Strength) of een steen { n, die } (Bless 4 → 1d4 erbij, Bane -4 → 1d4 eraf). Volgorde van de rng:
 * eerst de d20('s), dan de modifier-stenen.
 */
export function d20(opts, rng = Math.random) {
  const { adv = 0, mods = [], label } = opts || {};
  const v = adv > 0 ? 1 : adv < 0 ? -1 : 0;
  const vals = v ? [d(20, rng), d(20, rng)] : [d(20, rng)];
  const m = (mods || []).map((x) => (x.die ? { n: String(x.n || ""), die: x.die, v: d(Math.abs(x.die), rng) } : { n: String(x.n || ""), b: +x.b || 0 }));
  return finish({ ...(label ? { label: String(label) } : {}), g: [{ c: vals.length, die: 20, vals, keep: v > 0 ? "high" : v < 0 ? "low" : "all" }], m, adv: v });
}

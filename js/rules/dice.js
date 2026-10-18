// Dobbelstenen en kleine rekenhulpjes. rng is injecteerbaar zodat tests voorspelbaar zijn.

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

export const mod = (score) => Math.floor((score - 10) / 2);
export const sgn = (n) => (n >= 0 ? "+" : "") + n;
export const uid = () => Math.random().toString(36).slice(2, 9);

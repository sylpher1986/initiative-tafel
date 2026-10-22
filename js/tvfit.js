// SC6: tv-weergave van het spelersscherm passend maken. Puur: meten doet de aanroeper (fits), zodat dit testbaar is.
// Eén brede regel per deelnemer; de letter is zo groot als de hoogte toelaat. Twee kolommen alleen als één kolom
// onder TV_MIN1 zou uitkomen (op 3 m niet meer leesbaar); past zelfs TV_LO niet, dan scrollt het (twee kolommen).
export const TV_LO = 18, TV_HI = 56, TV_MIN1 = 24;

/** Grootste gehele f in [lo, hi] met fits(f), binair (fits stijgt niet met f); null als zelfs lo niet past */
export function fitFont(lo, hi, fits) {
  if (hi < lo || !fits(lo)) return null;
  let a = lo, b = hi;
  while (a < b) { const m = Math.ceil((a + b) / 2); if (fits(m)) a = m; else b = m - 1; }
  return a;
}

/** Bovengrens voor de letter: 5,5 % van de schermhoogte, max TV_HI, nooit onder TV_LO */
export const tvMax = (h) => Math.max(TV_LO, Math.min(TV_HI, Math.floor(h * 0.055)));

/**
 * → { f, cols }. fits(f, cols): past de pagina met letter f (en twee kolommen als cols) zonder te scrollen?
 * Twee kolommen alleen als één kolom niet op TV_MIN1 past én twee kolommen groter uitvallen.
 */
export function tvPlan(h, fits) {
  const hi = tvMax(h);
  const one = fitFont(TV_LO, hi, (f) => fits(f, false));
  if (one != null && one >= TV_MIN1) return { f: one, cols: false };
  const two = fitFont(TV_LO, hi, (f) => fits(f, true));
  if (two != null && (one == null || two > one)) return { f: two, cols: true };
  if (one != null) return { f: one, cols: false };
  return { f: TV_LO, cols: true };
}

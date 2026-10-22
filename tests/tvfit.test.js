import { test } from "node:test";
import assert from "node:assert/strict";
import { fitFont, tvPlan, tvMax, TV_LO } from "../js/tvfit.js";

// nagebootste pagina: hoogte = vast + regels × letter × factor (twee kolommen: helft van de regels, naar boven)
const page = (n, fixed = 100, k = 2) => (f, cols) => fixed + Math.ceil(cols ? n / 2 : n) * f * k;

test("fitFont: grootste passende waarde, null als niets past", () => {
  assert.equal(fitFont(18, 56, (f) => f <= 31), 31);
  assert.equal(fitFont(18, 56, () => true), 56);
  assert.equal(fitFont(18, 56, () => false), null);
  assert.equal(fitFont(18, 17, () => true), null);
});

test("tvMax: 5,5 % van de hoogte, begrensd 18–56", () => {
  assert.equal(tvMax(1080), 56);
  assert.equal(tvMax(720), 39);
  assert.equal(tvMax(200), TV_LO);
});

test("tvPlan: 6 regels op 1080 = één kolom groot; 12 regels nog één kolom; veel regels twee kolommen; te veel scrollt", () => {
  const H = 1080, fit = (n) => (f, cols) => page(n)(f, cols) <= H;
  assert.deepEqual(tvPlan(H, fit(6)), { f: 56, cols: false });
  const p12 = tvPlan(H, fit(12));
  assert.equal(p12.cols, false); assert.ok(p12.f >= 24 && p12.f <= 41);
  const p30 = tvPlan(H, fit(30));
  assert.equal(p30.cols, true); assert.ok(p30.f >= TV_LO);
  assert.deepEqual(tvPlan(H, fit(200)), { f: TV_LO, cols: true });
});

test("tvPlan: twee kolommen alleen als dat groter uitvalt", () => {
  // twee kolommen helpen niet (bijv. vaste kop neemt alles): één kolom op de kleine maat
  assert.deepEqual(tvPlan(1080, (f) => f <= 20), { f: 20, cols: false });
});

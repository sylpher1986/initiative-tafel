// Inn Sight (G4, WP56): viewport (pannen en zoomen), puur. Eén canvas ter grootte van het scherm met een
// transformatie, nooit een canvas ter grootte van de kaart (docs/g4-inn-the-grid.md §2.7).
// View = { x, y, z }: scherm (CSS-px) = kaart × CELL × z + (x, y). z = 1 is 100 %.

/** CSS-pixels per cel bij 100 % */
export const CELL = 48;
/** Zoomgrenzen (acceptatie WP56: 25 %–400 %) */
export const ZMIN = 0.25, ZMAX = 4;
/** Minimaal zichtbaar deel van de kaart bij pannen (CSS-px), zodat de kaart nooit kwijtraakt */
export const KEEP = 48;

export const clampZoom = (z) => Math.min(ZMAX, Math.max(ZMIN, Number.isFinite(z) ? z : 1));
const scale = (v) => CELL * v.z;

/** Kaartpunt → schermpunt */
export const toScreen = (v, mx, my) => ({ x: mx * scale(v) + v.x, y: my * scale(v) + v.y });
/** Schermpunt → kaartpunt */
export const toMap = (v, sx, sy) => ({ x: (sx - v.x) / scale(v), y: (sy - v.y) / scale(v) });

/** Zichtbaar deel van de kaartruimte voor een scherm van w × h CSS-px */
export function visibleRect(v, w, h) {
  const a = toMap(v, 0, 0), s = scale(v);
  return { x: a.x, y: a.y, w: w / s, h: h / s };
}

/** Pan begrenzen: van kaart b (kaarteenheden) blijft minstens KEEP px (of de hele kaart, als die kleiner is) in beeld */
export function clampPan(v, b, w, h) {
  const s = scale(v), mw = b.w * s, mh = b.h * s;
  const kx = Math.min(KEEP, mw, w), ky = Math.min(KEEP, mh, h);
  const x = Math.min(w - kx - b.x * s, Math.max(kx - mw - b.x * s, v.x));
  const y = Math.min(h - ky - b.y * s, Math.max(ky - mh - b.y * s, v.y));
  return { x, y, z: v.z };
}

/** Verschuiven met (dx, dy) CSS-px */
export const panBy = (v, dx, dy) => ({ x: v.x + dx, y: v.y + dy, z: v.z });

/** Zoomen met factor f rond schermpunt (sx, sy): het kaartpunt onder dat punt blijft staan */
export function zoomAt(v, f, sx, sy) {
  const z = clampZoom(v.z * f);
  if (z === v.z) return v;
  const k = z / v.z;
  return { x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k, z };
}

/** Knijpen (twee vingers): van paar a0/b0 naar a1/b1 (schermpunten). Zoomt met de verhouding van de afstanden rond
 *  het oude midden en verschuift met de beweging van het midden; zo blijft het kaartpunt onder de vingers staan. */
export function pinch(v, a0, b0, a1, b1) {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y), d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }, m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  const z = d0 > 0 && d1 > 0 ? zoomAt(v, d1 / d0, m0.x, m0.y) : v;
  return panBy(z, m1.x - m0.x, m1.y - m0.y);
}

/** Wielstap → zoomfactor (deltaY in px; regel ±100 px per klik, trackpad-knijpen kleine stappen) */
export const wheelFactor = (dy, mode = 0) => Math.exp(-Math.max(-50, Math.min(50, dy * (mode === 1 ? 16 : mode === 2 ? 400 : 1) * 0.0025)));

/** Passend maken: kaart b gecentreerd in w × h met pad px marge, zoom binnen de grenzen */
export function fitView(b, w, h, pad = 16) {
  const z = clampZoom(Math.min((w - 2 * pad) / (b.w * CELL), (h - 2 * pad) / (b.h * CELL)));
  const s = CELL * z;
  return { x: (w - b.w * s) / 2 - b.x * s, y: (h - b.h * s) / 2 - b.y * s, z };
}

/** Lijn scherp op het apparaatraster: CSS-coördinaat → midden van een apparaatpixel (1 px brede lijn, elke DPR) */
export const crisp = (css, dpr) => Math.round(css * dpr) + 0.5;

/** Zoom als heel percentage (weergave) */
export const zoomPct = (v) => Math.round(v.z * 100);

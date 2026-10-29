// Inn Sight (G4, WP66): meetkaart en meetscript, puur (geen DOM, Node-testbaar). De meetstand (/maps/?bench) bouwt het
// zwaarste geval dat de grenzen toelaten: hex 100 × 100, terrein over een groot deel, LIMITS.objs objecten en een
// achtergrond van LIMITS.bgSide px, alleen in het geheugen. Daarna draait een vast script (fasen hieronder) dat de view per
// frame zet; ui/bench.js meet de tijd tussen de frames (requestAnimationFrame) en de tekentijd.
import { LIMITS } from "./limits.js";
import { cleanGrid, bounds, cellCenter } from "./grid.js";
import { BUILTIN_IDS, builtin } from "./assets.js";
import { paintCells, TERRAINS } from "./terrain.js";
import { CELL, ZMIN, ZMAX } from "./view.js";

/** Duur per fase (ms) en de doelen uit de acceptatie van WP66 */
export const BENCH = { phase: 4000, warm: 400, target: { tablet: 30, desktop: 50, openMs: 2000 } };
/** Sha van de gemaakte achtergrond (alleen in het geheugen; nooit in de opslag) */
export const BENCH_SHA = "b".repeat(64);

/** Vaste toevalsreeks (mulberry32): elke meting tekent dezelfde kaart */
export function rng(seed = 66) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Meetkaart (zonder id en naam): { grid, terr, objs, bg }. type = "hex" (zwaarst) of "square". Terrein in blokken van
 *  wisselende grootte (± 60 % van de cellen, alle acht soorten), objecten verspreid over de kaart (alle ingebouwde
 *  onderdelen, een deel gedraaid), achtergrond over de hele kaartbreedte. */
export function benchMap(type = "hex", rnd = rng()) {
  const grid = cleanGrid({ type, orient: "pointy", cols: LIMITS.maxCells, rows: LIMITS.maxCells });
  let terr = null;
  for (let i = 0; i < 140; i++) {
    const w = 3 + Math.floor(rnd() * 12), h = 3 + Math.floor(rnd() * 12), c0 = Math.floor(rnd() * (grid.cols - w)), r0 = Math.floor(rnd() * (grid.rows - h));
    const cells = [];
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) cells.push({ c, r });
    terr = paintCells(terr, cells, TERRAINS[i % TERRAINS.length]);
  }
  const objs = [];
  for (let i = 0; i < LIMITS.objs; i++) {
    const asset = BUILTIN_IDS[i % BUILTIN_IDS.length], d = builtin(asset), m = cellCenter(grid, Math.floor(rnd() * grid.cols), Math.floor(rnd() * grid.rows));
    objs.push({ id: "b" + i.toString(36), asset, x: m.x, y: m.y, w: d.w, h: d.h, rot: i % 5 ? 0 : (i * 37) % 360, layer: d.layer });
  }
  const b = bounds(grid), side = LIMITS.bgSide;
  return { grid, terr, objs, bg: { asset: BENCH_SHA, w: side, h: side, ppc: Math.round((side / b.w) * 1e4) / 1e4, x: 0, y: 0 } };
}

/** Fasen van het script: id (catalogus maps.bench.ph.<id>) en de view op tijd t ∈ [0, 1) voor een kaart b (kaarteenheden)
 *  op een scherm w × h (CSS-px). pan = pannen op 100 %, far = pannen op 25 % (de meeste cellen in beeld: zwaarst),
 *  zoom = heen en weer tussen 25 % en 400 % rond het midden van het scherm. */
export const PHASES = ["pan", "far", "zoom"];
export function benchView(phase, t, b, w, h) {
  const a = t * Math.PI * 2;
  const at = (z, fx, fy) => { const s = CELL * z; return { x: w / 2 - (b.x + b.w * fx) * s, y: h / 2 - (b.y + b.h * fy) * s, z }; };
  if (phase === "pan") return at(1, 0.5 + 0.35 * Math.sin(a), 0.5 + 0.35 * Math.sin(2 * a));
  if (phase === "far") return at(ZMIN, 0.5 + 0.3 * Math.sin(a), 0.5 + 0.3 * Math.cos(a));
  const z = ZMIN * (ZMAX / ZMIN) ** ((1 - Math.cos(a)) / 2); // 25 % → 400 % → 25 %, exponentieel (gelijkmatig voor het oog)
  return at(z, 0.5, 0.5);
}

/** Uitslag van één fase uit de tijdstempels van opeenvolgende frames (ms, oplopend) en de tekentijden (ms):
 *  { fps, p95, worst, draw } (frames per seconde, 95e percentiel en langste frame in ms, gemiddelde tekentijd). */
export function frameStats(stamps, draws = []) {
  const n = stamps.length;
  if (n < 2) return { fps: 0, p95: 0, worst: 0, draw: 0 };
  const d = [];
  for (let i = 1; i < n; i++) d.push(stamps[i] - stamps[i - 1]);
  const s = [...d].sort((x, y) => x - y), span = stamps[n - 1] - stamps[0];
  const r1 = (v) => Math.round(v * 10) / 10;
  return { fps: span > 0 ? r1(((n - 1) * 1000) / span) : 0, p95: r1(s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]), worst: r1(s[s.length - 1]),
    draw: draws.length ? r1(draws.reduce((x, y) => x + y, 0) / draws.length) : 0 };
}

/** Doel voor dit apparaat: tablet/telefoon (aanraken) 30 fps, desktop 50 fps (acceptatie WP66) */
export const fpsTarget = (touch) => (touch ? BENCH.target.tablet : BENCH.target.desktop);

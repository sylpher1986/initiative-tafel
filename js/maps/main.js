// Inn the Grid (G4, WP56): opstarten van de kaartenmaker op /maps/ en /{taal}/maps/. Staat helemaal los van Initiative:
// alleen gedeelde infrastructuur (js/i18n/*, js/theme.js, tokens en letters uit css/app.css), nooit iets uit js/rules/,
// js/ui/, state.js, storage.js of tablock.js (tests/maps-boundary.test.js). WP56: vaste kaart 20×15 in het geheugen,
// pannen en zoomen; opslag volgt in WP58 (docs/g4-inn-the-grid.md).
import { initI18n, t } from "../i18n/boot.js";
import { VERSION } from "./version.js";
import { squareGrid, bounds } from "./model/grid.js";
import { clampPan, fitView, zoomAt, zoomPct, ZMIN, ZMAX } from "./model/view.js";
import { readColors, fitCanvas, draw } from "./render/canvas.js";
import { attachInput } from "./ui/input.js";

const ZOOM_STEP = 1.25;
const $ = (id) => document.getElementById(id);
// Eigen catalogus per taal (locales/maps/<taal>.js, OWN in tools/i18n-build.mjs): absoluut pad, eigen cache
const loadCat = (l) => import(`/locales/maps/${l}.js`).then((m) => m.default || {});

async function boot() {
  await initI18n({ load: loadCat });
  const cv = $("m-canvas"), wrap = $("m-stage");
  const map = { grid: squareGrid(20, 15) };
  let view = { x: 0, y: 0, z: 1 }, w = 0, h = 0, dpr = 1, col = readColors(), fitted = false, queued = false;

  const paint = () => {
    queued = false;
    fitCanvas(cv, w, h, dpr);
    draw(cv, map, view, w, h, dpr, col);
    const n = zoomPct(view), z = $("m-zoom");
    if (z.dataset.n !== String(n)) { z.dataset.n = n; z.textContent = t("maps.zoom.pct", { n }); } // aria-live: alleen bij een ander percentage
    $("m-out").disabled = view.z <= ZMIN;
    $("m-in").disabled = view.z >= ZMAX;
  };
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
  const set = (v) => { view = clampPan(v, bounds(map.grid), w, h); later(); };
  const fit = () => set(fitView(bounds(map.grid), w, h));
  const measure = () => {
    const r = wrap.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height); dpr = window.devicePixelRatio || 1;
    if (!fitted && w > 50 && h > 50) { fitted = true; fit(); } else set(view); // 0×0 (tabblad op de achtergrond): later passend maken
  };

  cv.setAttribute("aria-label", t("maps.canvas", { cols: map.grid.cols, rows: map.grid.rows }));
  $("m-ver").textContent = VERSION;
  attachInput(cv, { get: () => view, set });
  $("m-in").addEventListener("click", () => set(zoomAt(view, ZOOM_STEP, w / 2, h / 2)));
  $("m-out").addEventListener("click", () => set(zoomAt(view, 1 / ZOOM_STEP, w / 2, h / 2)));
  $("m-fit").addEventListener("click", fit);
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "+" || e.key === "=") set(zoomAt(view, ZOOM_STEP, w / 2, h / 2));
    else if (e.key === "-" || e.key === "_") set(zoomAt(view, 1 / ZOOM_STEP, w / 2, h / 2));
    else if (e.key === "0") fit();
    else return;
    e.preventDefault();
  });

  if (window.ResizeObserver) new ResizeObserver(measure).observe(wrap);
  window.addEventListener("resize", measure);
  // themawissel (systeem): kleuren opnieuw lezen; een vaste keuze zet js/theme.js al vóór de eerste paint
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { col = readColors(); later(); }); } catch { /* Safari < 14: geen live wissel */ }
  measure();
  window.__maps = { view: () => ({ ...view }), size: () => ({ w, h, dpr }) }; // diagnose (browsercheck), alleen lezen

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }
}

boot().catch((e) => { console.error("Inn the Grid: boot failed", e); });

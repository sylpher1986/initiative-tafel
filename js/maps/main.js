// Inn the Grid (G4, WP56): opstarten van de kaartenmaker op /maps/ en /{taal}/maps/. Staat helemaal los van Initiative:
// alleen gedeelde infrastructuur (js/i18n/*, js/theme.js, tokens en letters uit css/app.css), nooit iets uit js/rules/,
// js/ui/, state.js, storage.js of tablock.js (tests/maps-boundary.test.js). WP56: kaart in het geheugen, pannen en zoomen;
// WP57: paneel Kaart (rastertype, kolommen/rijen, lijnen, kleur, dekking), werkt direct; opslag volgt in WP58
// (docs/g4-inn-the-grid.md).
import { initI18n, t } from "../i18n/boot.js";
import { VERSION } from "./version.js";
import { cleanGrid, parseCells, bounds, LIMITS } from "./model/grid.js";
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
  const map = { grid: cleanGrid() };
  let view = { x: 0, y: 0, z: 1 }, w = 0, h = 0, dpr = 1, col = readColors(), fitted = false, auto = false, queued = false;

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
  // Passend maken in het deel dat niet onder het paneel Kaart ligt (WP57). auto = de view is nog "passend": dan blijft hij
  // passend bij een ander raster, schermformaat of paneel; elke eigen pan/zoom zet auto uit.
  const sheetEl = $("m-sheet");
  const freeH = () => sheetEl.hidden ? h : Math.max(48, Math.min(h, sheetEl.getBoundingClientRect().top - wrap.getBoundingClientRect().top));
  const fit = () => { auto = true; set(fitView(bounds(map.grid), w, freeH())); };
  const user = (v) => { auto = false; set(v); };
  const measure = () => {
    const r = wrap.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height); dpr = window.devicePixelRatio || 1;
    if ((!fitted || auto) && w > 50 && h > 50) { fitted = true; fit(); } else set(view); // 0×0 (tabblad op de achtergrond): later passend maken
  };

  const label = () => cv.setAttribute("aria-label", t(map.grid.type === "hex" ? "maps.canvasHex" : "maps.canvas", { cols: map.grid.cols, rows: map.grid.rows }));
  label();
  $("m-ver").textContent = VERSION;
  attachInput(cv, { get: () => view, set: user });
  $("m-in").addEventListener("click", () => user(zoomAt(view, ZOOM_STEP, w / 2, h / 2)));
  $("m-out").addEventListener("click", () => user(zoomAt(view, 1 / ZOOM_STEP, w / 2, h / 2)));
  $("m-fit").addEventListener("click", fit);
  // ---- WP57: paneel Kaart ----
  const sheet = $("m-sheet"), btnSet = $("m-set");
  const press = (id, v) => { for (const b of $(id).querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.v === v)); };
  const syncPanel = () => {
    const g = map.grid;
    press("m-type", g.type === "hex" ? g.orient : "square");
    press("m-show", g.show ? "on" : "off");
    press("m-color", g.color);
    press("m-alpha", String(g.alpha));
    for (const id of ["m-color", "m-alpha"]) for (const b of $(id).querySelectorAll("button")) b.disabled = !g.show;
  };
  const update = (patch) => { // nieuwe rasterwaarden toepassen: opschonen, begrenzen, tekenen
    map.grid = cleanGrid({ ...map.grid, ...patch });
    label(); syncPanel();
    if (auto) fit(); else set(view);
  };
  const fields = { "m-cols": "cols", "m-rows": "rows" };
  const fieldErr = (inp, bad) => {
    const e = $(inp.id + "-e");
    inp.setAttribute("aria-invalid", String(bad));
    e.hidden = !bad;
    e.textContent = bad ? t("maps.grid.bad", { min: LIMITS.minCells, max: LIMITS.maxCells }) : "";
  };
  const commit = (inp) => { const n = parseCells(inp.value); fieldErr(inp, n === null); if (n !== null && n !== map.grid[fields[inp.id]]) update({ [fields[inp.id]]: n }); };
  for (const id of Object.keys(fields)) {
    const inp = $(id);
    inp.addEventListener("input", () => fieldErr(inp, inp.value.trim() !== "" && parseCells(inp.value) === null)); // foutregel tijdens het typen (leeg pas bij blur/Enter: wissen om te vervangen flitst niet)
    inp.addEventListener("change", () => commit(inp)); // toepassen bij blur/Enter: "15" tekent niet eerst een kaart van 1
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commit(inp); } });
  }
  for (const b of $("m-alpha").querySelectorAll("button")) b.textContent = t("maps.alpha.pct", { n: b.dataset.v });
  $("m-type").addEventListener("click", (e) => { const v = e.target.closest("button")?.dataset.v; if (v) update(v === "square" ? { type: "square" } : { type: "hex", orient: v }); });
  $("m-show").addEventListener("click", (e) => { const v = e.target.closest("button")?.dataset.v; if (v) update({ show: v === "on" }); });
  $("m-color").addEventListener("click", (e) => { const v = e.target.closest("button")?.dataset.v; if (v) update({ color: v }); });
  $("m-alpha").addEventListener("click", (e) => { const v = e.target.closest("button")?.dataset.v; if (v) update({ alpha: +v }); });
  // het paneel ligt over de dock: zolang het open is, zijn de dockknoppen niet met Tab bereikbaar (geen focus op iets onzichtbaars)
  const dockFocus = (on) => { for (const b of document.querySelectorAll(".mdock button")) on ? b.removeAttribute("tabindex") : b.setAttribute("tabindex", "-1"); };
  // groeit of krimpt het paneel (foutregel, toetsenbord), dan blijft een passende kaart passend boven het paneel
  if (window.ResizeObserver) new ResizeObserver(() => { if (auto && !sheet.hidden) fit(); }).observe(sheet);
  const openPanel = () => {
    for (const [id, k] of Object.entries(fields)) { $(id).value = String(map.grid[k]); fieldErr($(id), false); }
    syncPanel();
    sheet.hidden = false; btnSet.setAttribute("aria-expanded", "true");
    dockFocus(false);
    sheet.focus(); // in de tik (iOS)
    if (auto) fit();
  };
  const closePanel = () => {
    if (sheet.hidden) return;
    sheet.hidden = true; btnSet.setAttribute("aria-expanded", "false");
    dockFocus(true);
    btnSet.focus();
    if (auto) fit();
  };
  btnSet.addEventListener("click", () => (sheet.hidden ? openPanel() : closePanel()));
  $("m-close").addEventListener("click", closePanel);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !sheet.hidden) { e.preventDefault(); closePanel(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "+" || e.key === "=") user(zoomAt(view, ZOOM_STEP, w / 2, h / 2));
    else if (e.key === "-" || e.key === "_") user(zoomAt(view, 1 / ZOOM_STEP, w / 2, h / 2));
    else if (e.key === "0") fit();
    else return;
    e.preventDefault();
  });

  if (window.ResizeObserver) new ResizeObserver(measure).observe(wrap);
  window.addEventListener("resize", measure);
  // themawissel (systeem): kleuren opnieuw lezen; een vaste keuze zet js/theme.js al vóór de eerste paint
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { col = readColors(); later(); }); } catch { /* Safari < 14: geen live wissel */ }
  measure();
  window.__maps = { view: () => ({ ...view }), size: () => ({ w, h, dpr }), grid: () => ({ ...map.grid }) }; // diagnose (browsercheck), alleen lezen

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }
}

boot().catch((e) => { console.error("Inn the Grid: boot failed", e); });

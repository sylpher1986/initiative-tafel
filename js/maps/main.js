// Inn the Grid (G4, WP56): opstarten van de kaartenmaker op /maps/ en /{taal}/maps/. Staat helemaal los van Initiative:
// alleen gedeelde infrastructuur (js/i18n/*, js/theme.js, tokens en letters uit css/app.css), nooit iets uit js/rules/,
// js/ui/, state.js, storage.js of tablock.js (tests/maps-boundary.test.js). WP56: pannen en zoomen; WP57: paneel Kaart
// (rastertype, kolommen/rijen, lijnen, kleur, dekking), werkt direct; WP58: kaarten bewaren (IndexedDB "kevs-inn-maps",
// js/maps/store.js), autosave met status in de kop, Mijn kaarten (nieuw, openen, hernoemen, dupliceren, verwijderen met
// Ongedaan), laatste kaart heropenen, één tabblad tegelijk; WP59: achtergrondafbeelding kiezen (controle, verkleinen,
// assetstore), schaal, raster passend, uitlijnmodus, vervangen/verwijderen met Ongedaan; WP60: projectbestand v1
// (exporteren in het menu per kaart, importeren onder de lijst als nieuwe kaart); WP61: undo/redo (kop) over plaatsen,
// raster en achtergrond, paneel Bibliotheek met ingebouwde onderdelen en Plaatsen; WP62: objecten selecteren (tik),
// slepen, draaien en schalen met handgrepen, eigen dock en paneel Object, toetsenbord met cursorcel; WP63: terrein per cel
// verven (tab Terrein in paneel Bibliotheek: penseel, breed, vullen, wissen); WP64: eigen assets (tab Eigen: Mijn assets,
// toevoegen, plaatsen, hernoemen, verwijderen, mee in export en import); WP65: zijpaneel vanaf 768 px, sneltoetsenoverzicht
// (?), uitleg in een lege kaart, verven met het toetsenbord, naam Inn Sight (docs/g4-inn-the-grid.md).
import { initI18n, t, i18n } from "../i18n/boot.js";
import { APP, VERSION } from "./version.js";
import { cleanGrid, parseCells, bounds, LIMITS, cellAt, cellCenter, cellPoly, inside } from "./model/grid.js";
import { clampPan, fitView, zoomAt, zoomPct, toMap, toScreen, ZMIN, ZMAX, CELL } from "./model/view.js";
import { cleanBg, guessPpc, gridFor, parsePpc, parseAcross, scaleBg, moveBg, across, stepFor, BG } from "./model/bg.js";
import { IMG } from "./model/image.js";
import { prepareImage, assetImage, makeThumb } from "./ui/upload.js";
import { MINE, isCustom, cleanItem, cleanItemName, nameFromFile, defaultCells, usedAssets, usedOn, quotaLevel } from "./model/mine.js";
import { newMap, mapId, cleanName, newName, uniqueName, copyMap, sortMaps, pickStart, ago } from "./model/map.js";
import { FILE_MAX } from "./model/file.js";
import { exportMap, importFile } from "./ui/export.js";
import { readColors, fitCanvas, draw, TERR_COLORS } from "./render/canvas.js";
import { TERRAINS, TOOLS, paintCells, brushCells, strokeCells, footprint, fillCells, countTerr } from "./model/terrain.js";
import { createArt } from "./render/art.js";
import { createHistory } from "./model/history.js";
import { CATS, BUILTIN_IDS, builtin, inCat, assetUrl } from "./model/assets.js";
import { OBJ, placeAt, newObj, drawOrder, mapObj, moveObj, rotateObj, turn90, sizeObj, resizeFrom, layerObj, reorder, atEdge, dupObj, removeObj } from "./model/objects.js";
import { hitAll, hitObj, onObj, handleAt, angleTo, toLocal, HANDLE, HANDLE_OFF } from "./model/hit.js";
import { attachInput } from "./ui/input.js";
import { esc, toast } from "./ui/dom.js";
import * as store from "./store.js";
import { createSaver } from "./save.js";
import { claimTab } from "./tablock.js";

const ZOOM_STEP = 1.25;
const $ = (id) => document.getElementById(id);
// Eigen catalogus per taal (locales/maps/<taal>.js, OWN in tools/i18n-build.mjs): absoluut pad, eigen cache
const loadCat = (l) => import(`/locales/maps/${l}.js`).then((m) => m.default || {});

async function boot() {
  await initI18n({ load: loadCat });
  const cv = $("m-canvas"), wrap = $("m-stage");
  // cur = de geopende kaart (document zoals in de opslag) of null (verwijderd, lijst open); map = wat de render tekent
  let cur = null;
  const map = { grid: cleanGrid(), bg: null, objs: [], terr: null };
  // WP59: tekenbare achtergronden per asset (sha → afbeelding; null = ontbreekt in de opslag), assets in het geheugen als
  // er geen opslag is (privémodus), en de uitlijnmodus
  const imgs = new Map(), memAssets = new Map();
  let aligning = false;
  let view = { x: 0, y: 0, z: 1 }, w = 0, h = 0, dpr = 1, col = readColors(), fitted = false, auto = false, queued = false;
  let gone = false, viewName = "edit";

  // ---- WP58: opslag, status ----
  const ok = claimTab(tabLost); // D11: nieuwste tabblad wint
  store.setWriteGuard(ok);
  const saver = createSaver({ write: () => (cur ? store.putMap(cur) : true), onStatus: paintStatus });
  const stat = $("m-stat");
  function paintStatus() {
    const s = saver.status, bad = s === "error" || s === "off";
    const txt = t(s === "off" ? "maps.status.off" : s === "error" ? "maps.status.error" : s === "saved" ? "maps.status.saved" : "maps.status.saving");
    stat.classList.toggle("bad", bad);
    stat.setAttribute("aria-live", bad ? "polite" : "off"); // alleen fout en privémodus voorlezen, niet elke Opslaan…/Opgeslagen
    stat.dataset.s = s;
    // fout: de regel is een knop (≥ 44 px) met uitleg en Opnieuw; anders gewone tekst
    stat.innerHTML = s === "error" ? `<button type="button" class="mstat-b"><svg class="li" aria-hidden="true" focusable="false"><use href="/icons/ui.svg#i-alert"/></svg>${esc(txt)}</button>` : esc(txt);
  }
  const failMsg = () => toast(t("maps.msg.saveFail"), { bad: true, btn: { label: t("maps.msg.retry"), run: () => saver.flush() } });
  stat.addEventListener("click", (e) => { if (e.target.closest("button")) failMsg(); });
  const changed = () => { if (cur) { cur.updatedAt = Date.now(); saver.touch(); } };
  const flushNow = () => { if (!gone) saver.flush(); };
  window.addEventListener("pagehide", flushNow);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushNow(); });

  const paint = () => {
    queued = false;
    fitCanvas(cv, w, h, dpr);
    draw(cv, map, view, w, h, dpr, col, { img: (map.bg && imgs.get(map.bg.asset)) || null, align: aligning, art, ghost,
      sel: selObj(), cursor: kbd && !selId && viewName === "edit" ? cellPoly(map.grid, kbd.c, kbd.r) : null,
      brush: brushAt && painting() ? brushAt.cells.map((q) => cellPoly(map.grid, q.c, q.r)) : null });
    const n = zoomPct(view), z = $("m-zoom");
    if (z.dataset.n !== String(n)) { z.dataset.n = n; z.textContent = t("maps.zoom.pct", { n }); z.setAttribute("aria-label", t("maps.zoom.fit", { n })); }
    $("m-out").disabled = view.z <= ZMIN;
    $("m-in").disabled = view.z >= ZMAX;
  };
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
  const set = (v) => { view = clampPan(v, bounds(map.grid), w, h); later(); };
  // Passend maken in het deel dat niet onder het paneel Kaart ligt (WP57). auto = de view is nog "passend": dan blijft hij
  // passend bij een ander raster, schermformaat of paneel; elke eigen pan/zoom zet auto uit.
  // WP61: het open paneel (Kaart of Bibliotheek; nooit allebei)
  const openSheet = () => [$("m-sheet"), $("m-lsheet"), $("m-osheet")].find((el) => !el.hidden) || null; // WP62: ook paneel Object
  // WP65: vanaf 768 px is een paneel een zijpaneel rechts (css/maps.css): dan is het vrije deel links ervan, anders erboven
  const sideMq = matchMedia("(min-width:768px)"), side = () => sideMq.matches;
  const freeH = () => { const el = openSheet(); return !el || side() ? h : Math.max(48, Math.min(h, el.getBoundingClientRect().top - wrap.getBoundingClientRect().top)); };
  const freeW = () => { const el = openSheet(); return !el || !side() ? w : Math.max(48, Math.min(w, el.getBoundingClientRect().left - wrap.getBoundingClientRect().left)); };
  const fit = () => { auto = true; set(fitView(bounds(map.grid), freeW(), freeH())); };
  const user = (v) => { auto = false; set(v); };
  const measure = () => {
    const r = wrap.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height); dpr = window.devicePixelRatio || 1;
    if (r.height > 0) { const bs = document.body.style; bs.setProperty("--m-top", r.top + "px"); bs.setProperty("--m-bot", Math.max(0, document.documentElement.clientHeight - r.bottom) + "px"); } // WP65: zijpaneel tussen kop en dock
    if ((!fitted || auto) && w > 50 && h > 50) { fitted = true; fit(); } else set(view); // 0×0 (tabblad op de achtergrond, lijst open): later passend maken
  };

  // WP65: zijpaneel open (strook en uitleg in het vrije deel) en de uitleg in een lege kaart (geen pop-up: alleen tekst
  // in het canvas, weg zodra er iets op staat of een paneel open is)
  const emptyEl = $("m-empty");
  function chrome() {
    const open = !!openSheet();
    document.body.classList.toggle("mside", open && side());
    const empty = viewName === "edit" && !!cur && !open && !aligning && !map.bg && !map.objs.length && !map.terr;
    if (emptyEl.hidden === empty) emptyEl.hidden = !empty;
  }
  const label = () => cv.setAttribute("aria-label", t(map.grid.type === "hex" ? "maps.canvasHex" : "maps.canvas", { cols: map.grid.cols, rows: map.grid.rows }));
  const head = () => { $("m-name").textContent = viewName === "list" ? t("maps.title") : cur?.name || t("maps.title"); };
  $("m-ver").textContent = VERSION;
  attachInput(cv, { get: () => view, set: user, drag: (dx, dy) => dragBg(dx, dy), dragging: () => aligning,
    tap: (x, y) => onTap(x, y), tapping: () => viewName === "edit" && !aligning && !!cur, hover: (x, y) => hoverAt(x, y), grab: (x, y, k) => grab(x, y, k) });
  $("m-in").addEventListener("click", () => user(zoomAt(view, ZOOM_STEP, w / 2, h / 2)));
  $("m-out").addEventListener("click", () => user(zoomAt(view, 1 / ZOOM_STEP, w / 2, h / 2)));
  $("m-fit").addEventListener("click", fit);
  $("m-zoom").addEventListener("click", fit); // WP61: het percentage is ook Hele kaart (onder 480 px de enige)
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
  const update = (patch) => edit({ grid: cleanGrid({ ...map.grid, ...patch }) }, { k: "grid" }); // nieuwe rasterwaarden: één undo-stap
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
  // WP58: naam in het paneel, toegepast bij blur/Enter; leeg (of alleen spaties) = vorige naam terug
  const nameInp = $("m-mname");
  const commitName = () => {
    if (!cur) return;
    const n = cleanName(nameInp.value);
    nameInp.value = n || cur.name;
    if (n && n !== cur.name) { cur.name = n; head(); changed(); }
  };
  nameInp.addEventListener("change", commitName);
  nameInp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commitName(); nameInp.blur(); } });
  for (const b of $("m-alpha").querySelectorAll("button")) b.textContent = t("maps.alpha.pct", { n: b.dataset.v });
  $("m-type").addEventListener("click", (e) => { const v = e.target.closest("button")?.dataset.v; if (v) update(v === "square" ? { type: "square" } : { type: "hex", orient: v }); });
  $("m-show").addEventListener("click", (e) => { const v = e.target.closest("button")?.dataset.v; if (v) update({ show: v === "on" }); });
  $("m-color").addEventListener("click", (e) => { const v = e.target.closest("button")?.dataset.v; if (v) update({ color: v }); });
  $("m-alpha").addEventListener("click", (e) => { const v = e.target.closest("button")?.dataset.v; if (v) update({ alpha: +v }); });
  // het paneel ligt over de dock: zolang het open is, zijn de dockknoppen niet met Tab bereikbaar (geen focus op iets onzichtbaars)
  const dockFocus = (on) => { for (const b of $("m-dock").querySelectorAll("button")) on ? b.removeAttribute("tabindex") : b.setAttribute("tabindex", "-1"); };
  // groeit of krimpt het paneel (foutregel, toetsenbord), dan blijft een passende kaart passend boven het paneel
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (auto && openSheet()) fit(); }); ro.observe(sheet); ro.observe($("m-lsheet")); ro.observe($("m-osheet")); }
  /** Kolommen/rijen in het paneel volgen het raster (na Ongedaan/Opnieuw); een veld in bewerking blijft staan */
  const syncFields = () => { for (const [id, k] of Object.entries(fields)) if (document.activeElement !== $(id)) { $(id).value = String(map.grid[k]); fieldErr($(id), false); } };
  const openPanel = () => {
    select(null, false); // WP62
    closeLib(false);
    for (const [id, k] of Object.entries(fields)) { $(id).value = String(map.grid[k]); fieldErr($(id), false); }
    nameInp.value = cur?.name || "";
    syncPanel();
    sheet.hidden = false; btnSet.setAttribute("aria-expanded", "true");
    dockFocus(side()); // WP65: naast een zijpaneel blijft de dock bereikbaar
    syncBg();
    chrome();
    sheet.focus(); // in de tik (iOS)
    if (auto) fit();
  };
  const closePanel = (focus = true) => {
    if (sheet.hidden) return;
    sheet.hidden = true; btnSet.setAttribute("aria-expanded", "false");
    dockFocus(true);
    chrome();
    if (focus) btnSet.focus();
    if (auto) fit();
  };
  btnSet.addEventListener("click", () => (sheet.hidden ? openPanel() : closePanel()));
  $("m-close").addEventListener("click", () => closePanel());

  // ---- WP59: achtergrond ----
  const bgSec = { set: $("m-bg-set"), miss: $("m-bg-miss"), pick: $("m-bg-pick"), hint: $("m-bg-hint"), row: $("m-bg-row"), rep: $("m-bg-rep"), del: $("m-bg-del"), fit: $("m-bg-fit"), align: $("m-bg-align"), err: $("m-bg-e"), file: $("m-bg-file") };
  const bgState = () => (!map.bg ? "none" : imgs.get(map.bg.asset) === null ? "missing" : "set");
  const fmt = (n) => i18n().num(n, { maximumFractionDigits: 2, useGrouping: false }); // geen duizendtalscheiding: het veld moet zijn eigen waarde weer kunnen lezen
  const bgFields = { "m-ppc": "ppc", "m-across": "across" };
  const bgFieldErr = (inp, bad) => {
    const e = $(inp.id + "-e");
    inp.setAttribute("aria-invalid", String(bad));
    e.hidden = !bad;
    // grenzen als tekst zonder duizendtalpunt ("16.384" zou het veld zelf als 16,384 lezen)
    e.textContent = !bad ? "" : inp.id === "m-ppc" ? t("maps.bg.numBad", { min: String(BG.minPpc), max: String(Math.min(BG.maxPpc, Math.max(map.bg.w, map.bg.h))) }) : t("maps.bg.numBad", { min: "1", max: String(LIMITS.maxCells) });
  };
  /** Sectie Achtergrond bijwerken (zichtbaarheid, velden die niet in bewerking zijn, knop Raster passend) */
  function syncBg() {
    const st = bgState(), b = map.bg;
    bgSec.set.hidden = st !== "set";
    bgSec.miss.hidden = st !== "missing";
    bgSec.pick.hidden = st === "set";
    bgSec.hint.hidden = st === "set";
    bgSec.row.hidden = st === "none";
    bgSec.rep.hidden = st !== "set";
    if (!bgSec.pick.getAttribute("aria-busy")) bgSec.pick.textContent = t(st === "missing" ? "maps.bg.again" : "maps.bg.choose");
    bgSec.hint.textContent = t("maps.bg.hint", { mb: IMG.maxBytes / 1048576 });
    if (st !== "set") return;
    const vals = { "m-ppc": fmt(b.ppc), "m-across": fmt(across(b)) };
    for (const [id, v] of Object.entries(vals)) if (document.activeElement !== $(id)) { $(id).value = v; bgFieldErr($(id), false); }
    const g = gridFor(b, map.grid);
    bgSec.fit.hidden = g.cols === map.grid.cols && g.rows === map.grid.rows;
    bgSec.fit.textContent = t("maps.bg.fit", { cols: g.cols, rows: g.rows });
  }
  function bgErr(code) {
    bgSec.err.hidden = !code;
    bgSec.err.textContent = code ? t("maps.bg.err." + code, { mb: IMG.maxBytes / 1048576, max: IMG.maxInSide }) : "";
  }
  /** Asset ophalen (geheugen of opslag) en als tekenbare afbeelding in imgs zetten; null = ontbreekt */
  const assetRec = async (sha) => memAssets.get(sha) || (saver.status !== "off" ? await store.getAsset(sha) : null);
  /** Bestaande asset bij hetzelfde originele bestand (geheugen of opslag): { sha, rec } of null */
  const findRec = async (src) => {
    for (const [sha, rec] of memAssets) if (rec.src === src) return { sha, rec };
    return saver.status !== "off" ? store.findAsset(src) : null;
  };
  /** Geheugen (oude iPad: een 4096²-afbeelding is ± 64 MB): alleen de afbeelding van de huidige achtergrond vasthouden.
   *  Ongedaan of terug naar een kaart laadt hem opnieuw uit de opslag; "ontbreekt" (null) mag blijven staan. */
  const trimImgs = () => {
    const keep = map.bg && map.bg.asset;
    for (const [sha, d] of imgs) if (d && sha !== keep) { if (d.close) d.close(); imgs.delete(sha); }
    // WP64: eigen assets: alleen die op de open kaart (en het gekozen item in Plaatsen) blijven gedecodeerd
    const own = new Set(usedAssets({ objs: map.objs }));
    if (isCustom(active)) own.add(active);
    art.trim(own);
  };
  const loading = new Set();
  async function loadBg() {
    const sha = map.bg && map.bg.asset;
    if (!sha || imgs.has(sha) || loading.has(sha)) return;
    loading.add(sha);
    const rec = await assetRec(sha);
    const d = rec ? await assetImage(rec) : null;
    loading.delete(sha);
    imgs.set(sha, d);
    if (map.bg && map.bg.asset === sha) { syncBg(); later(); }
  }
  /** Nieuwe achtergrond (of null) op de open kaart: tekenen en bewaren, als undo-stap (WP61; group = uitlijnsessie).
   *  Geeft de stap (teken voor de Ongedaan-knop in een melding). */
  const setBg = (next, meta = { k: "bg" }, group = null) => edit({ bg: (next && cleanBg(next)) || undefined }, meta, group);
  // Ongedaan in de melding = de gewone undo als de stap nog de laatste is, anders een nieuwe stap terug naar prev
  // (de asset staat tot de volgende start in de opslag)
  const restoreBg = (id, prev, step) => () => { if (!cur || cur.id !== id) return; if (hist.isTop(step) && !aligning) undo(); else setBg(prev); };
  for (const id of Object.keys(bgFields)) {
    const inp = $(id);
    const parse = () => (id === "m-ppc" ? parsePpc(inp.value, map.bg) : parseAcross(inp.value, map.bg));
    const commitBg = () => {
      if (!map.bg) return;
      const p = parse();
      bgFieldErr(inp, p === null);
      if (p !== null && Math.abs(p - map.bg.ppc) > 1e-6) { setBg(scaleBg(map.bg, p)); }
      // het andere veld volgt meteen (syncBg slaat het veld met focus over)
      const o = id === "m-ppc" ? $("m-across") : $("m-ppc");
      o.value = id === "m-ppc" ? fmt(across(map.bg)) : fmt(map.bg.ppc); bgFieldErr(o, false);
      if (p !== null) inp.value = id === "m-ppc" ? fmt(map.bg.ppc) : fmt(across(map.bg));
    };
    inp.addEventListener("input", () => bgFieldErr(inp, inp.value.trim() !== "" && parse() === null));
    inp.addEventListener("change", commitBg);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commitBg(); } });
  }
  bgSec.fit.addEventListener("click", () => { if (map.bg) { update(gridFor(map.bg, map.grid)); bgSec.align.focus(); } });
  // kiezen: verborgen input + echte knop (data-file), in de tik openen (iOS)
  let busyBg = false;
  for (const b of [bgSec.pick, bgSec.rep]) b.addEventListener("click", () => { if (!busyBg) { bgErr(null); bgSec.file.click(); } });
  bgSec.file.addEventListener("change", async () => {
    const f = bgSec.file.files && bgSec.file.files[0];
    bgSec.file.value = ""; // dezelfde keuze nog eens = opnieuw een change
    if (!f || busyBg || !cur) return;
    const id = cur.id, keep = bgState() === "missing", prev = map.bg;
    busyBg = true;
    const btn = keep || !prev ? bgSec.pick : bgSec.rep, label = btn.textContent;
    btn.disabled = true; btn.setAttribute("aria-busy", "true"); btn.textContent = t("maps.bg.busy");
    let res;
    try {
      res = await prepareImage(f, { find: findRec });
      if (res.ok && !res.again) {
        if (saver.status === "off") memAssets.set(res.sha, res.rec);
        else if (!(await store.putAsset(res.sha, res.rec))) res = { ok: false, code: "store" };
      }
      if (res.ok && !imgs.get(res.sha)) imgs.set(res.sha, await assetImage(res.rec));
      if (res.ok && !imgs.get(res.sha)) res = { ok: false, code: "broken" };
    } catch { res = { ok: false, code: "broken" }; }
    busyBg = false;
    btn.disabled = false; btn.removeAttribute("aria-busy"); btn.textContent = label;
    if (!cur || cur.id !== id) { syncBg(); return; } // intussen een andere kaart geopend: niets toepassen, geen foutregel daar
    if (!res.ok) { bgErr(res.code); syncBg(); return; }
    const r = res.rec, base = { asset: res.sha, w: r.ow, h: r.oh };
    const step = setBg(keep ? { ...prev, ...base } : { ...base, ppc: guessPpc(r.ow, r.oh, map.grid.cols), x: 0, y: 0 });
    bgSec.align.focus();
    if (prev && !keep) toast(t("maps.bg.replaced"), { btn: { label: t("maps.msg.undo"), run: restoreBg(id, prev, step) } });
  });
  bgSec.del.addEventListener("click", () => {
    if (!cur || !map.bg) return;
    const prev = map.bg, id = cur.id;
    const step = setBg(null); bgErr(null);
    bgSec.pick.focus();
    toast(t("maps.bg.removed"), { btn: { label: t("maps.msg.undo"), run: restoreBg(id, prev, step) } });
  });
  // uitlijnmodus: eigen dock, strook bovenin, één vinger sleept de afbeelding; Gereed = terug naar het paneel
  const adock = $("m-adock"), strip = $("m-astrip");
  let alignN = 0, alignGroup = null; // WP61: één uitlijnsessie (slepen + pijltjes tot Klaar) = één undo-stap
  function setAlign(on, back = true) {
    if (on === aligning) return;
    aligning = on;
    if (on) select(null, false); // WP62
    adock.hidden = !on; strip.hidden = !on; docks(); chrome();
    if (on) { alignGroup = "align" + ++alignN; closeLib(false); closePanel(false); $("m-adone").focus(); }
    else { hist.seal(); alignGroup = null; if (back) { openPanel(); bgSec.align.focus(); } }
    histBtns();
    later();
  }
  bgSec.align.addEventListener("click", () => { if (bgState() === "set") setAlign(true); });
  $("m-adone").addEventListener("click", () => setAlign(false));
  const nudge = (dir) => {
    if (!map.bg) return;
    const s = stepFor(map.bg, view.z, CELL), d = { left: [-s, 0], right: [s, 0], up: [0, -s], down: [0, s] }[dir];
    if (d) setBg(moveBg(map.bg, d[0], d[1]), { k: "align" }, alignGroup);
  };
  adock.addEventListener("click", (e) => { const d = e.target.closest("[data-nudge]")?.dataset.nudge; if (d) nudge(d); });
  const dragBg = (dx, dy) => { if (map.bg) setBg(moveBg(map.bg, dx / (CELL * view.z), dy / (CELL * view.z)), { k: "align" }, alignGroup); };

  // ---- WP61: undo/redo ----
  // Elke wijziging aan raster, achtergrond of objecten gaat via edit(): patch toepassen (put) en als stap vastleggen.
  // Ongedaan/Opnieuw passen de patch van de stap toe. Per geopende kaart, alleen in het geheugen (model/history.js).
  const hist = createHistory();
  const docField = (k) => (k === "grid" ? map.grid : k === "bg" ? map.bg || undefined : k === "terr" ? map.terr || undefined : map.objs.length ? map.objs : undefined);
  /** Patch toepassen op wat de render tekent en op het document (zonder geschiedenis) */
  function put(patch) {
    if ("grid" in patch) { map.grid = cleanGrid(patch.grid); if (cur) cur.grid = map.grid; }
    if ("bg" in patch) {
      const was = map.bg && map.bg.asset;
      map.bg = patch.bg || null;
      if (cur) { if (map.bg) cur.bg = map.bg; else delete cur.bg; }
      if ((map.bg && map.bg.asset) !== was) { trimImgs(); loadBg(); }
    }
    if ("objs" in patch) { map.objs = patch.objs || []; if (cur) { if (map.objs.length) cur.objs = map.objs; else delete cur.objs; } }
    if ("terr" in patch) { map.terr = patch.terr || null; if (cur) { if (map.terr) cur.terr = map.terr; else delete cur.terr; } } // WP63
  }
  /** Na een patch: panelen, label, bewaren, tekenen, knoppen */
  function refresh(patch) {
    if ("grid" in patch) { label(); syncPanel(); if (!sheet.hidden) syncFields(); }
    // slepen in de uitlijnmodus: paneel dicht, geen DOM-werk per pointermove (openPanel synct)
    if ("grid" in patch || (!sheet.hidden && "bg" in patch)) syncBg();
    changed();
    if ("bg" in patch || "objs" in patch || "terr" in patch) chrome(); // WP65: uitleg weg zodra er iets op de kaart staat
    if ("grid" in patch) { if (kbd) kbd = clampCell(kbd); if (auto) fit(); else set(view); } else later();
    if ("objs" in patch) { if (selId && !selObj()) select(null, false); else if (!osheet.hidden) syncObj(); } // WP62: na Ongedaan kan het object weg zijn
    if ("objs" in patch && !lsheet.hidden && libTab === "own") paintMyRow(); // WP64: gebruik in de beheerrij (plaatsen, Ongedaan)
    const pk = hist.peek(), hk = `${hist.canUndo}${hist.canRedo}`;
    if (pk.undo !== lastPeek.undo || pk.redo !== lastPeek.redo || hk !== lastPeek.k) histBtns(); // slepen in één groep: geen DOM-werk per beweging
  }
  let lastPeek = {};
  /** Wijziging als undo-stap; geeft de stap (of null als er niets veranderde) */
  function edit(after, meta, group = null) {
    const before = {};
    for (const k of Object.keys(after)) before[k] = docField(k);
    put(after);
    const step = hist.record(before, after, group, meta);
    refresh(after);
    return step;
  }
  const assetName = (id) => (builtin(id) ? t("maps.asset." + id) : isCustom(id) ? itemName(mineItem(id)) : id); // WP64: eigen = naam in Mijn assets
  const terrName = (id) => (TERRAINS.includes(id) ? t("maps.terr." + id) : id); // WP63: onbekend terrein (nieuwere versie) = id
  const stepName = (m) => (!m ? "" : m.id ? t("maps.hist." + m.k, { name: assetName(m.id) }) : m.t ? t("maps.hist." + m.k, { name: terrName(m.t) }) : t("maps.hist." + m.k)); // WP62: elke objectstap noemt het onderdeel
  const undoBtn = $("m-undo"), redoBtn = $("m-redo");
  function histBtns() {
    lastPeek = { ...hist.peek(), k: `${hist.canUndo}${hist.canRedo}` };
    const p = hist.peek(), off = aligning || viewName !== "edit" || !cur, had = document.activeElement;
    undoBtn.disabled = off || !hist.canUndo; redoBtn.disabled = off || !hist.canRedo;
    // een knop die uitgaat terwijl hij focus heeft: focus naar de andere knop (of Bibliotheek), niet naar body
    if ((had === undoBtn || had === redoBtn) && had.disabled) { const o = had === undoBtn ? redoBtn : undoBtn; if (!o.disabled) o.focus(); else if (viewName === "edit") (!odock.hidden ? $("m-odone") : $("m-lib")).focus(); }
    undoBtn.setAttribute("aria-label", p.undo ? t("maps.hist.undoStep", { step: stepName(p.undo) }) : t("maps.hist.undo"));
    redoBtn.setAttribute("aria-label", p.redo ? t("maps.hist.redoStep", { step: stepName(p.redo) }) : t("maps.hist.redo"));
  }
  const srEl = $("m-sr");
  const sr = (text) => { srEl.textContent = ""; requestAnimationFrame(() => { srEl.textContent = text; }); }; // ook dezelfde zin opnieuw voorlezen
  function undo() {
    if (aligning || stroking || viewName !== "edit" || !cur) return;
    const m = hist.peek().undo, p = hist.undo();
    if (!p) return;
    put(p); refresh(p);
    sr(t("maps.hist.undone", { step: stepName(m) }));
  }
  function redo() {
    if (aligning || stroking || viewName !== "edit" || !cur) return;
    const m = hist.peek().redo, p = hist.redo();
    if (!p) return;
    put(p); refresh(p);
    sr(t("maps.hist.redone", { step: stepName(m) }));
  }
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);

  // ---- WP61: Bibliotheek en Plaatsen ----
  // Een tegel kiezen zet Plaatsen aan (tik op de kaart = plaatsen, slepen = pannen); Plaatsen bestaat alleen zolang het
  // paneel open is. Sluiten of Esc = terug naar Kijken. "Op cel uitlijnen" (snap) staat in de kop van het paneel,
  // standaard aan, onthouden in localStorage maps-snap.
  const lsheet = $("m-lsheet"), btnLib = $("m-lib"), tiles = $("m-tiles"), pstrip = $("m-pstrip"), snapBtn = $("m-snap");
  // WP64: eigen assets komen uit de opslag (of het geheugen) en worden als afbeelding getekend
  const art = createArt(() => later(), { custom: async (sha) => { const rec = await assetRec(sha); return rec ? assetImage(rec) : null; } });
  let libCat = CATS[0], active = null, ghost = null, stripT = 0;
  let snap = true;
  try { snap = localStorage.getItem("maps-snap") !== "0"; } catch { /* geen opslag: standaard aan */ }
  const placing = () => !!active && (libTab === "parts" || libTab === "own") && !lsheet.hidden && !aligning && viewName === "edit" && !!cur;
  // WP63: tab Terrein. mat = gekozen terrein-id, "erase" (Wissen) of null (Kijken); tool onthouden in localStorage maps-ttool
  let libTab = "parts", mat = null, tool = "brush", brushAt = null, stroking = false; // stroking: een veeg loopt (geen undo tussendoor)
  try { const v = localStorage.getItem("maps-ttool"); if (TOOLS.includes(v)) tool = v; } catch { /* standaard Penseel */ }
  const painting = () => !!mat && libTab === "terrain" && !lsheet.hidden && !aligning && viewName === "edit" && !!cur;
  const pressTiles = () => { for (const b of lsheet.querySelectorAll(".mtile[data-id]")) b.setAttribute("aria-pressed", String(b.dataset.id === active)); paintMyRow(); };
  function paintTiles() {
    press("m-ltab", libTab);
    const terr = libTab === "terrain", own = libTab === "own";
    for (const id of ["m-cats", "m-tiles"]) $(id).hidden = terr || own;
    snapBtn.hidden = terr;
    $("m-terr").hidden = !terr; $("m-tools-f").hidden = !terr; $("m-my").hidden = !own;
    if (terr) { paintTerr(); return; }
    snapBtn.setAttribute("aria-pressed", String(snap));
    if (own) { paintMine(); return; }
    press("m-cats", libCat);
    tiles.innerHTML = inCat(libCat).map((id) => `<button type="button" class="mtile" data-id="${esc(id)}" aria-pressed="${id === active}"><img src="${esc(assetUrl(id))}" alt="" width="40" height="40"><span>${esc(assetName(id))}</span></button>`).join("");
  }
  function paintStrip() {
    $("m-terr-h").hidden = !(libTab === "terrain" && !lsheet.hidden && !mat); // WP65: uitleg tot er een terrein gekozen is
    if (stripT) return; // de korte melding "Tik binnen de kaart" staat er nog
    const on = placing(), pt = painting();
    pstrip.hidden = !on && !pt;
    if (on) pstrip.textContent = t("maps.lib.placing", { name: assetName(active) });
    else if (pt) pstrip.textContent = mat === "erase" ? t({ brush: "maps.paint.eraseBrush", wide: "maps.paint.eraseWide", fill: "maps.paint.eraseFill" }[tool]) : t("maps.paint." + tool, { name: terrName(mat) });
  }
  // WP63: terreintegels (kleurvlak + naam, 5 kolommen) en de gereedschap-seg
  function paintTerr() {
    press("m-tool", tool);
    const tile = (id, sw) => `<button type="button" class="mtile" data-t="${esc(id)}" aria-pressed="${id === mat}">${sw}<span>${esc(id === "erase" ? t("maps.terr.erase") : terrName(id))}</span></button>`;
    $("m-terr").innerHTML = `<span class="vh" id="m-terr-l">${esc(t("maps.lib.terrain"))}</span>`
      + TERRAINS.map((id) => tile(id, `<span class="mtsw" style="background:${TERR_COLORS[id]}" aria-hidden="true"></span>`)).join("")
      + tile("erase", `<span class="mtsw erase" aria-hidden="true"></span>`);
  }
  const pressTerr = () => { for (const b of $("m-terr").querySelectorAll(".mtile")) b.setAttribute("aria-pressed", String(b.dataset.t === mat)); };
  const setMat = (id) => { mat = id; brushAt = null; pressTerr(); paintStrip(); later(); };
  function setTab(v) {
    if (v === libTab) return;
    libTab = v; active = null; ghost = null; mat = null; brushAt = null; renaming = false;
    clearTimeout(stripT); stripT = 0;
    paintTiles(); paintStrip(); later();
  }
  const stripMsg = (text) => { clearTimeout(stripT); pstrip.hidden = false; pstrip.textContent = text; stripT = setTimeout(() => { stripT = 0; paintStrip(); }, 2000); };
  const setActive = (id) => { active = id; ghost = null; pressTiles(); paintStrip(); later(); };
  const setSnap = (v) => { // WP62: één instelling, schakelaar in Bibliotheek en in paneel Object
    snap = v;
    for (const b of [snapBtn, $("m-osnap")]) b.setAttribute("aria-pressed", String(snap));
    try { localStorage.setItem("maps-snap", snap ? "1" : "0"); } catch { /* alleen deze sessie */ }
  };
  function openLib() {
    select(null, false); // WP62: Plaatsen en selecteren gaan niet samen
    closePanel(false);
    lsheet.hidden = false; btnLib.setAttribute("aria-expanded", "true");
    dockFocus(side());
    chrome();
    paintTiles();
    art.preload(BUILTIN_IDS);
    lsheet.focus(); // in de tik (iOS)
    paintStrip();
    if (auto) fit();
  }
  function closeLib(focus = true) {
    if (lsheet.hidden) return;
    lsheet.hidden = true; btnLib.setAttribute("aria-expanded", "false");
    dockFocus(true);
    chrome();
    active = null; ghost = null; mat = null; brushAt = null; renaming = false; // WP63: ook Verven stopt
    clearTimeout(stripT); stripT = 0;
    paintStrip();
    if (focus) btnLib.focus();
    if (auto) fit(); else later();
  }
  btnLib.addEventListener("click", () => (lsheet.hidden ? openLib() : closeLib()));
  $("m-lclose").addEventListener("click", () => closeLib());
  $("m-cats").addEventListener("click", (e) => { const v = e.target.closest("button")?.dataset.v; if (v && v !== libCat) { libCat = v; paintTiles(); } });
  tiles.addEventListener("click", (e) => { const id = e.target.closest(".mtile")?.dataset.id; if (id) setActive(active === id ? null : id); });
  snapBtn.addEventListener("click", () => setSnap(!snap));
  $("m-ltab").addEventListener("click", (e) => { const v = e.target.closest("button")?.dataset.v; if (v) setTab(v); });
  $("m-terr").addEventListener("click", (e) => { const id = e.target.closest(".mtile")?.dataset.t; if (id) setMat(mat === id ? null : id); });
  $("m-tool").addEventListener("click", (e) => {
    const v = e.target.closest("button")?.dataset.v;
    if (!v || !TOOLS.includes(v)) return;
    tool = v; brushAt = null; press("m-tool", tool); paintStrip(); later();
    try { localStorage.setItem("maps-ttool", tool); } catch { /* alleen deze sessie */ }
  });
  // ---- WP64: Mijn assets (tab Eigen) ----
  // Eén bibliotheek per apparaat (store "mine"). Eerste tegel = Toevoegen; een eigen tegel kiezen zet Plaatsen aan en toont
  // de beheerrij (naam · gebruik, Hernoemen | Verwijderen). Verwijderen haalt alleen het item weg: kaarten houden de
  // afbeelding (gcAssets telt elke verwijzing). Opslag ≥ 80 % = strook bovenaan de tab (nooit bij het opstarten).
  let mine = [], addBusy = false, renaming = false;
  const thumbs = new Map(); // sha → object-URL van de miniatuur
  const mineItem = (sha) => (isCustom(sha) && mine.find((i) => i.sha === sha)) || null;
  const itemName = (it) => (it && it.name) || t("maps.my.unnamed");
  const mineNames = () => mine.map((i) => i.name).filter(Boolean);
  const sortMine = (l) => l.sort((a, b) => b.addedAt - a.addedAt || (a.sha < b.sha ? -1 : 1));
  /** Grootte en laag bij plaatsen: ingebouwd uit de catalogus, eigen uit Mijn assets; null = niet te plaatsen */
  const defOf = (id) => builtin(id) || ((it) => it && { w: it.w, h: it.h, layer: "object" })(mineItem(id));
  const dropThumb = (sha) => { const u = thumbs.get(sha); if (u) { URL.revokeObjectURL(u); thumbs.delete(sha); } };
  const thumbUrl = (it) => {
    if (!it.thumb) return "";
    let u = thumbs.get(it.sha);
    if (!u) { try { u = URL.createObjectURL(new Blob([it.thumb], { type: it.tmime })); thumbs.set(it.sha, u); } catch { return ""; } }
    return u;
  };
  /** Op hoeveel kaarten staat sha als object (de open kaart uit het geheugen) */
  const usedCount = (sha) => {
    const onThis = !!cur && map.objs.some((o) => o.asset === sha);
    return { onThis, n: usedOn(sha, maps.filter((m) => !cur || m.id !== cur.id)) + (onThis ? 1 : 0) };
  };
  const useText = (sha) => { const u = usedCount(sha); return !u.n ? t("maps.my.unused") : u.onThis && u.n === 1 ? t("maps.my.onThis") : t("maps.my.onN", { n: u.n }); };
  const myErr = (code) => {
    const e = $("m-myerr");
    e.hidden = !code;
    e.textContent = !code ? "" : ["quota", "max"].includes(code) ? t("maps.my.err." + code, { n: i18n().num(MINE.max) }) : t("maps.bg.err." + code, { mb: IMG.maxBytes / 1048576, max: IMG.maxInSide });
  };
  function paintMine() {
    const add = `<button type="button" class="mtile madd" id="m-myadd"><span class="mplus" aria-hidden="true">+</span><span>${esc(t("maps.my.add"))}</span></button>`;
    $("m-mytiles").innerHTML = add + mine.map((it) => {
      const u = thumbUrl(it);
      return `<button type="button" class="mtile" data-id="${esc(it.sha)}" aria-pressed="${it.sha === active}" aria-label="${esc(itemName(it))}"><span class="mtimg">${u ? `<img src="${esc(u)}" alt="" width="40" height="40">` : ""}</span><span aria-hidden="true">${esc(itemName(it))}</span></button>`;
    }).join("");
    if (addBusy) busyAdd(true);
    $("m-myhint").hidden = mine.length > 0;
    paintMyRow();
    paintQuota();
  }
  const busyAdd = (on) => {
    const b = $("m-myadd");
    if (!b) return;
    b.disabled = on;
    on ? b.setAttribute("aria-busy", "true") : b.removeAttribute("aria-busy");
    b.lastElementChild.textContent = t(on ? "maps.bg.busy" : "maps.my.add");
  };
  function paintMyRow() {
    const it = libTab === "own" && !lsheet.hidden ? mineItem(active) : null, row = $("m-myrow");
    row.hidden = !it;
    if (!it) { renaming = false; return; }
    const info = $("m-myinfo");
    info.hidden = renaming; $("m-myname-l").hidden = !renaming; $("m-myren").hidden = renaming;
    if (!renaming) info.textContent = t("maps.my.info", { name: itemName(it), use: useText(it.sha) });
  }
  let quotaN = 0;
  async function paintQuota() {
    const el = $("m-myq"), n = ++quotaN;
    const est = saver.status === "off" ? null : await store.estimate();
    if (n !== quotaN) return; // een nieuwere controle loopt al
    const lv = quotaLevel(est);
    el.hidden = !lv;
    if (lv) el.textContent = t("maps.my.quota", { pct: Math.min(100, Math.floor((est.usage / est.quota) * 100)) });
  }
  /** Item bewaren (geheugen of opslag); false = mislukt (melding) */
  const saveItem = async (it) => {
    if (saver.status !== "off" && !(await store.putMine(it))) { toast(t("maps.msg.opFail"), { bad: true }); return false; }
    mine = sortMine([it, ...mine.filter((x) => x.sha !== it.sha)]);
    return true;
  };
  $("m-mytiles").addEventListener("click", (e) => {
    const b = e.target.closest(".mtile");
    if (!b) return;
    if (b.id === "m-myadd") { if (!addBusy) { myErr(null); $("m-myfile").click(); } return; } // in de tik (iOS)
    const id = b.dataset.id;
    if (id) { renaming = false; setActive(active === id ? null : id); }
  });
  $("m-myfile").addEventListener("change", async () => {
    const fi = $("m-myfile"), f = fi.files && fi.files[0];
    fi.value = ""; // hetzelfde bestand nog eens = opnieuw een change
    if (!f || addBusy) return;
    if (mine.length >= MINE.max) { myErr("max"); return; } // vóór het decoderen
    addBusy = true; busyAdd(true);
    let res, item = null, dup = false;
    try {
      res = await prepareImage(f, { find: findRec, max: MINE.maxSide, kind: "mine", thumb: MINE.thumb });
      if (res.ok && mineItem(res.sha)) dup = true;
      else if (res.ok) {
        const r = res.rec, th = res.thumb || (await makeThumb(r, MINE.thumb));
        const base = [...nameFromFile(f.name)].slice(0, MINE.nameMax - 4).join("").trim();
        item = cleanItem({ sha: res.sha, name: base ? uniqueName(base, mineNames()) : newName(t("maps.my.base"), mineNames()),
          ...defaultCells(r.ow || r.w, r.oh || r.h), addedAt: Date.now(), ...(th ? { thumb: th.data, tmime: th.mime } : {}) });
        if (saver.status === "off") { if (!memAssets.has(res.sha)) memAssets.set(res.sha, res.rec); }
        else {
          const w = await store.addMine(item, res.sha, res.again ? null : res.rec);
          if (w !== true) res = { ok: false, code: w === "quota" ? "quota" : "store" };
        }
      }
    } catch { res = { ok: false, code: "broken" }; }
    addBusy = false; busyAdd(false);
    if (!res.ok) { myErr(res.code); return; }
    if (dup) { toast(t("maps.my.already", { name: itemName(mineItem(res.sha)) })); }
    else { mine = sortMine([item, ...mine]); }
    if (lsheet.hidden || libTab !== "own") return;
    paintMine();
    setActive(res.sha);
    const tile = $("m-mytiles").querySelector(`[data-id="${res.sha}"]`);
    if (tile) tile.focus();
  });
  const nameInpMy = $("m-myname");
  $("m-myren").addEventListener("click", () => {
    const it = mineItem(active);
    if (!it) return;
    renaming = true; paintMyRow();
    nameInpMy.value = it.name; nameInpMy.focus(); nameInpMy.select(); // in de tik (iOS)
  });
  async function commitRename(apply, focus) {
    if (!renaming) return;
    renaming = false;
    const it = mineItem(active), nm = cleanItemName(nameInpMy.value); // leeg = vorige naam
    if (apply && it && nm && nm !== it.name) { renSave = saveItem({ ...it, name: nm }); await renSave; }
    if (!lsheet.hidden && libTab === "own") {
      // geen nieuwe tegels (een tik op een tegel of Verwijderen laat het veld los: die klik moet blijven werken)
      const nt = mineItem(active), tile = nt && $("m-mytiles").querySelector(`[data-id="${nt.sha}"]`);
      if (tile) { tile.setAttribute("aria-label", itemName(nt)); tile.lastElementChild.textContent = itemName(nt); }
      paintMyRow();
      if (focus) $("m-myren").focus();
    }
  }
  nameInpMy.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitRename(true, true); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); commitRename(false, true); }
  });
  nameInpMy.addEventListener("blur", () => commitRename(true, false));
  let renSave = Promise.resolve();
  $("m-mydel").addEventListener("click", async () => {
    await renSave; // hernoemen (blur) en Verwijderen in één tik: eerst de nieuwe naam, zodat Ongedaan die terugzet
    const it = mineItem(active);
    if (!it) return;
    renaming = false;
    const u = usedCount(it.sha);
    if (saver.status !== "off" && !(await store.deleteMine(it.sha))) { toast(t("maps.msg.opFail"), { bad: true }); return; }
    mine = mine.filter((x) => x.sha !== it.sha);
    dropThumb(it.sha);
    setActive(null);
    paintMine();
    $("m-myadd").focus();
    const msg = u.n ? t("maps.my.deletedKept", { name: itemName(it), n: u.n }) : t("maps.my.deleted", { name: itemName(it) });
    sr(msg);
    toast(msg, { btn: { label: t("maps.msg.undo"), run: async () => { // Ongedaan: hetzelfde item terug (de afbeelding staat er nog tot de volgende start)
      if (mineItem(it.sha)) return;
      if (!(await saveItem(it))) return;
      dropThumb(it.sha); // nieuwe URL bij het tekenen (de oude is vrijgegeven)
      if (!lsheet.hidden && libTab === "own") paintMine();
    } } });
  });
  // ---- WP63: verven ----
  // Penseel/Breed: de veeg begint bij het neerzetten (de eerste cel kleurt meteen), elke cel waar vinger, muis of Pencil
  // overheen gaat wordt geverfd; tijdens de veeg alleen tekenen en bewaren (put), bij loslaten één undo-stap. Een tweede
  // vinger zet de stand van vóór de veeg terug zonder stap (knijpen zoomt). Vullen: tik vult het gebied, slepen pant.
  const terrMeta = (fill) => (mat === "erase" ? { k: fill ? "eraseFill" : "erase" } : { k: fill ? "fill" : "paint", t: mat });
  const matId = () => (mat === "erase" ? null : mat);
  function paintGrab(sx, sy) {
    const before = map.terr, meta = terrMeta(false), id = matId(), tl = tool, at = cur && cur.updatedAt;
    let last = toMap(view, sx, sy), live = true;
    stroking = true; brushAt = null; // omlijning volgt een ingedrukte muis niet: weg tijdens de veeg
    const apply = (cells) => {
      const next = paintCells(map.terr, footprint(map.grid, cells, tl), id);
      if (next !== map.terr) { put({ terr: next }); changed(); later(); }
    };
    apply(strokeCells(map.grid, last.x, last.y, last.x, last.y));
    return {
      move(x, y) { if (!live) return; const q = toMap(view, x, y); apply(strokeCells(map.grid, last.x, last.y, q.x, q.y)); last = q; },
      end() { if (!live) return; live = false; stroking = false; if (map.terr === before) return; const after = { terr: map.terr || undefined }; hist.record({ terr: before || undefined }, after, null, meta); refresh(after); },
      // terugzetten en bewaren, maar updatedAt zoals vóór de veeg (netto geen wijziging: de kaart springt niet bovenaan Mijn kaarten)
      cancel() { if (!live) return; live = false; stroking = false; if (map.terr !== before) { put({ terr: before || undefined }); if (cur) { cur.updatedAt = at; saver.touch(); } later(); } },
    };
  }
  function fillAt(sx, sy) {
    const p = toMap(view, sx, sy), c = cellAt(map.grid, p.x, p.y);
    if (!inside(map.grid, c.c, c.r)) { stripMsg(t("maps.lib.outside")); return; }
    const next = paintCells(map.terr, fillCells(map.grid, map.terr, c.c, c.r), matId());
    if (next !== map.terr) edit({ terr: next || undefined }, terrMeta(true));
  }
  /** Tik op de kaart in Plaatsen: het actieve onderdeel daar neerzetten (één undo-stap) */
  function place(sx, sy) {
    if (!placing()) return;
    const d = defOf(active), p = toMap(view, sx, sy), at = d && placeAt(map.grid, p.x, p.y, d.w, d.h, snap);
    if (!d) return;
    if (!at) { stripMsg(t("maps.lib.outside")); return; } // naast de kaart: niets plaatsen (niet stil naar de rand klemmen)
    if (map.objs.length >= OBJ.max) { toast(t("maps.lib.max", { n: i18n().num(OBJ.max) }), { bad: true }); return; }
    edit({ objs: [...map.objs, newObj(active, at, map.objs, Math.random, d)] }, { k: "place", id: active });
    sr(t("maps.lib.placed", { name: assetName(active) }));
  }
  /** Muis boven de kaart in Plaatsen: spookbeeld op de plek waar een klik het onderdeel zet */
  function hoverAt(sx, sy) {
    // WP63: omlijning van de cellen die een klik zou verven (Vullen: alleen de cel); alleen tekenen als hij verschuift
    let b = null;
    if (sx != null && painting()) {
      const p = toMap(view, sx, sy), c = cellAt(map.grid, p.x, p.y);
      const key = `${c.c},${c.r},${tool}`;
      if (inside(map.grid, c.c, c.r)) b = brushAt && brushAt.k === key ? brushAt : { k: key, cells: brushCells(map.grid, c.c, c.r, tool === "fill" ? "brush" : tool) };
    }
    if (b !== brushAt) { brushAt = b; later(); }
    let g = null;
    if (sx != null && placing()) {
      const d = defOf(active), p = toMap(view, sx, sy), at = d && placeAt(map.grid, p.x, p.y, d.w, d.h, snap);
      if (at) g = { asset: active, x: at.x, y: at.y, w: d.w, h: d.h, rot: 0, layer: d.layer };
    }
    const same = g && ghost && g.asset === ghost.asset && g.x === ghost.x && g.y === ghost.y;
    if (!same && (g || ghost)) { ghost = g; later(); } // alleen tekenen als het spookbeeld echt verschuift
    // WP62: muiswijzer laat zien wat een klik doet (greep, verplaatsen, selecteren)
    let c = "";
    if (sx != null && painting()) c = "crosshair";
    else if (sx != null && !placing() && editing()) {
      const o = selObj(), hd = o && handleAt(o, view, sx, sy), p = toMap(view, sx, sy);
      c = hd === "rot" ? "crosshair" : hd === "size" ? "nwse-resize" : o && onObj(o, p.x, p.y) ? "move" : hitAll(map.objs, p.x, p.y).length ? "pointer" : "";
    }
    if (cv.style.cursor !== c) cv.style.cursor = c;
  }

  // ---- WP62: selecteren en bewerken ----
  // Tik op een object (in Kijken) selecteert het; nog eens tikken kiest het object eronder; tik ernaast heft op. Touch:
  // alleen een sleep die op het geselecteerde object begint verplaatst het (de rest pant); muis: indrukken op elk object
  // selecteert en sleept. Handgrepen (draaien boven, schalen rechtsonder) hebben een vaste schermmaat (HANDLE). Eén sleep
  // = één undo-stap (group + seal). Zolang er een selectie is, vervangt #m-odock de dock; Meer opent paneel Object.
  const odock = $("m-odock"), osheet = $("m-osheet"), sstrip = $("m-sstrip"), btnMore = $("m-omore");
  let selId = null, kbd = null, justSel = false, gN = 0, nudgeG = null; // kbd = toetsenbordcel { c, r } of null
  const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
  const selObj = () => (selId && map.objs.find((o) => o.id === selId)) || null;
  const editing = () => viewName === "edit" && !!cur && !aligning;
  const objName = (o) => assetName(o.asset);
  const padNow = () => HANDLE / 2 / (CELL * view.z); // tikvlak minstens 44 × 44 px rond een klein object
  /** Welke dock zichtbaar is: lijst, uitlijnen, selectie of de gewone */
  function docks() {
    const isList = viewName === "list", s = !isList && !aligning && !!selObj();
    $("m-dock").hidden = isList || aligning || s;
    odock.hidden = !s;
  }
  const odockFocus = (on) => { for (const b of odock.querySelectorAll("button")) on ? b.removeAttribute("tabindex") : b.setAttribute("tabindex", "-1"); };
  function paintSel() {
    const o = selObj();
    docks();
    sstrip.hidden = !o || viewName !== "edit";
    if (o) { const txt = t("maps.sel.strip", { name: objName(o) }); if (sstrip.textContent !== txt) sstrip.textContent = txt; }
    if (!o) closeObj(false);
    else if (!osheet.hidden) syncObj();
  }
  /** Object selecteren (id) of de selectie opheffen (null); say = voorlezen */
  function select(id, say = true) {
    const was = selId, f = document.activeElement;
    selId = id && map.objs.some((o) => o.id === id) ? id : null;
    nudgeG = null; hist.seal();
    if (selId) kbd = null;
    paintSel(); later();
    if (!selId && f && (odock.contains(f) || osheet.contains(f))) cv.focus({ preventScroll: true }); // de knop met focus verdwijnt
    if (selId && selId !== was) { const o = selObj(), hy = o.y - o.h / 2 - (HANDLE_OFF + HANDLE / 2) / (CELL * view.z); reveal(o.x, Math.min(o.y, hy)); } // draaigreep in beeld
    if (say && selId !== was) sr(selId ? t("maps.sel.selected", { name: objName(selObj()) }) : t("maps.sel.cleared"));
  }
  const sameObj = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.rot === b.rot && a.layer === b.layer;
  /** Nieuw object n op zijn plek in de lijst als undo-stap (niets als het niet verandert) */
  function setObj(n, k, group = null) {
    const c = map.objs.find((x) => x.id === n.id);
    if (!c || sameObj(c, n)) return null;
    return edit({ objs: mapObj(map.objs, n.id, () => n) }, { k, id: n.asset }, group);
  }
  // Handvatten voor attachInput (grab): beweging in CSS-px, steeds gerekend vanaf het object bij het oppakken
  const moveGrab = (o, p0) => {
    const g = "drag" + ++gN, dx = p0.x - o.x, dy = p0.y - o.y;
    return { move(x, y) { const q = toMap(view, x, y); setObj(moveObj(map.grid, o, q.x - dx, q.y - dy, snap), "move", g); }, end: () => hist.seal() };
  };
  const rotGrab = (o) => {
    const g = "drag" + ++gN;
    return { move(x, y) {
      const q = toMap(view, x, y);
      let a = angleTo(o, q.x, q.y);
      if (snap) a = (Math.round(a / 15) * 15) % 360; // snap: per 15°; alleen een rechte hoek zet het object weer op de cellen
      setObj(rotateObj(map.grid, o, a, snap && a % 90 === 0), "rotate", g);
    }, end: () => hist.seal() };
  };
  const sizeGrab = (o, p0) => { // de tegenoverliggende hoek blijft staan (resizeFrom); snap: hele cellen, anders per 0,25
    // gerekend met de beweging sinds het oppakken (de greep ligt schuin buiten de hoek, niet op de hoek)
    const g = "drag" + ++gN, st = snap ? 1 : 0.25, l0 = toLocal(o, p0.x, p0.y);
    const f = (v) => Math.min(OBJ.maxSize, Math.max(st, Math.round(v / st) * st));
    return { move(x, y) {
      const q = toMap(view, x, y), l = toLocal(o, q.x, q.y);
      setObj(resizeFrom(map.grid, o, f(o.w + l.x - l0.x), f(o.h + l.y - l0.y), snap), "size", g);
    }, end: () => hist.seal() };
  };
  /** Begin van een gebaar: pakt het iets op? (greep, het geselecteerde object, met de muis elk object) */
  function grab(sx, sy, kind) {
    justSel = false;
    if (kind === "mouse" && document.activeElement !== cv) cv.focus({ preventScroll: true }); // toetsen werken daarna op de kaart
    if (painting()) return tool === "fill" ? null : paintGrab(sx, sy); // WP63: verven gaat voor selecteren (een veeg over een meubel breekt niet af)
    if (!editing() || placing()) return null;
    const p = toMap(view, sx, sy), o = selObj();
    if (o) {
      const hd = handleAt(o, view, sx, sy);
      if (hd === "rot") return rotGrab(o);
      if (hd === "size") return sizeGrab(o, p);
      if (onObj(o, p.x, p.y, padNow())) return moveGrab(o, p);
    }
    if (kind === "mouse") { const hit = hitAll(map.objs, p.x, p.y)[0]; if (hit) { select(hit.id); justSel = true; return moveGrab(hit, p); } }
    return null;
  }
  /** Tik (of klik zonder slepen): Plaatsen plaatst, anders selecteren */
  function onTap(sx, sy) {
    if (placing()) { place(sx, sy); return; }
    if (painting()) { // WP63: Penseel/Breed verfde al bij het neerzetten; naast de kaart even de strook
      if (tool === "fill") fillAt(sx, sy);
      else { const p = toMap(view, sx, sy), c = cellAt(map.grid, p.x, p.y); if (!inside(map.grid, c.c, c.r)) stripMsg(t("maps.lib.outside")); }
      return;
    }
    if (!editing()) return;
    if (justSel) { justSel = false; return; } // net met de muis geselecteerd: niet meteen doorschuiven
    const o = selObj();
    if (o && handleAt(o, view, sx, sy)) return;
    const p = toMap(view, sx, sy), hits = hitAll(map.objs, p.x, p.y);
    if (o && hits.includes(o)) { select(hits[(hits.indexOf(o) + 1) % hits.length].id); return; } // het object eronder
    const top = hits[0] || hitObj(map.objs, p.x, p.y, padNow());
    select(top ? top.id : null);
  }
  // acties (dock, paneel, toetsen)
  const turn = (dir) => { const o = selObj(); if (o) setObj(turn90(map.grid, o, dir, snap), "rotate"); };
  function order(dir) {
    const o = selObj();
    if (!o) return;
    const l = reorder(map.objs, o.id, dir);
    if (l !== map.objs) edit({ objs: l }, { k: "order", id: o.asset });
    const b = document.activeElement;
    if ((b === $("m-ofront") || b === $("m-oback")) && b.disabled) { const other = b === $("m-ofront") ? $("m-oback") : $("m-ofront"); (other.disabled ? osheet : other).focus(); }
  }
  function setLayer(v) { // naar een andere laag: bovenaan in die laag
    const o = selObj();
    if (!o || o.layer === v) return;
    edit({ objs: reorder(mapObj(map.objs, o.id, (x) => layerObj(x, v)), o.id, "front") }, { k: "layer", id: o.asset });
  }
  function dupSel() {
    const o = selObj();
    if (!o) return;
    const r = dupObj(map.grid, map.objs, o.id, snap);
    if (!r) { toast(t("maps.lib.max", { n: i18n().num(OBJ.max) }), { bad: true }); return; }
    edit({ objs: r.objs }, { k: "dup", id: o.asset });
    select(r.id);
  }
  function delSel() { // zonder bevestiging; melding met Ongedaan (de gewone undo als de stap nog bovenaan staat)
    const o = selObj();
    if (!o) return;
    const id = cur.id, idx = map.objs.indexOf(o);
    const step = edit({ objs: removeObj(map.objs, o.id) }, { k: "del", id: o.asset });
    select(null, false);
    sr(t("maps.sel.deleted", { name: objName(o) }));
    toast(t("maps.sel.deleted", { name: objName(o) }), { btn: { label: t("maps.msg.undo"), run: () => {
      if (!cur || cur.id !== id || map.objs.some((x) => x.id === o.id) || !editing()) return; // lijst open of uitlijnen: niets
      if (hist.isTop(step)) undo();
      else if (map.objs.length >= OBJ.max) { toast(t("maps.lib.max", { n: i18n().num(OBJ.max) }), { bad: true }); return; }
      else { const l = map.objs.slice(); l.splice(Math.min(idx, l.length), 0, o); edit({ objs: l }, { k: "undel", id: o.asset }); }
      select(o.id, false); // undo() las de stap al voor (één sr per frame)
    } } });
  }
  // toetsenbord: cursorcel zonder selectie, verplaatsen met selectie (opeenvolgende pijltjes = één stap)
  const clampCell = (c) => ({ c: Math.min(map.grid.cols - 1, Math.max(0, c.c)), r: Math.min(map.grid.rows - 1, Math.max(0, c.r)) });
  const centerCell = () => { const p = toMap(view, freeW() / 2, freeH() / 2); return clampCell(cellAt(map.grid, p.x, p.y)); };
  /** Kaartpunt in beeld houden (boven een open paneel), anders de kaart verschuiven */
  function reveal(x, y) {
    const s = toScreen(view, x, y), m = 56, H = freeH(), W = freeW();
    const dx = s.x < m ? m - s.x : s.x > W - m ? W - m - s.x : 0, dy = s.y < m ? m - s.y : s.y > H - m ? H - m - s.y : 0;
    if (dx || dy) user({ ...view, x: view.x + dx, y: view.y + dy });
  }
  function moveCursor(dx, dy) {
    kbd = kbd ? clampCell({ c: kbd.c + dx, r: kbd.r + dy }) : centerCell();
    const m = cellCenter(map.grid, kbd.c, kbd.r);
    reveal(m.x, m.y); later();
  }
  function nudgeSel(dx, dy, fine) {
    const o = selObj();
    if (!o) return;
    if (!nudgeG) nudgeG = "nudge" + ++gN;
    let n;
    if (fine) n = moveObj(map.grid, o, o.x + dx * 0.1, o.y + dy * 0.1, false); // Shift: 0,1 cel, zonder snap
    else if (snap && map.grid.type === "hex") { const c = clampCell(cellAt(map.grid, o.x, o.y)), d = clampCell({ c: c.c + dx, r: c.r + dy }), m = cellCenter(map.grid, d.c, d.r); n = moveObj(map.grid, o, m.x, m.y, true); }
    else n = moveObj(map.grid, o, o.x + dx, o.y + dy, snap);
    setObj(n, "move", nudgeG);
    reveal(n.x, n.y);
  }
  function enterKey() { // Enter/spatie op de kaart: plaatsen (Plaatsen) of het bovenste object op de cursorcel selecteren
    if (!kbd) kbd = centerCell();
    const m = cellCenter(map.grid, kbd.c, kbd.r);
    if (placing()) { const s = toScreen(view, m.x, m.y); place(s.x, s.y); later(); return; }
    const hit = hitAll(map.objs, m.x, m.y)[0];
    if (hit) select(hit.id); else { sr(t("maps.sel.none")); later(); }
  }
  /** WP65: Enter/spatie in Verven: Penseel/Breed verft de cel(len) op de cursor, Vullen vult het gebied; één undo-stap */
  function paintKey() {
    if (!kbd) kbd = centerCell();
    const fill = tool === "fill", meta = terrMeta(fill);
    const cells = fill ? fillCells(map.grid, map.terr, kbd.c, kbd.r) : footprint(map.grid, [{ c: kbd.c, r: kbd.r }], tool);
    const next = paintCells(map.terr, cells, matId());
    if (next !== map.terr) { edit({ terr: next || undefined }, meta); sr(stepName(meta)); }
    later();
  }
  function nextObj(dir) { // N / Shift+N: objecten aflopen in tekenvolgorde
    const { list } = drawOrder(map.objs);
    if (!list.length) return;
    const i = list.findIndex((o) => o.id === selId), n = list[i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length];
    select(n.id); reveal(n.x, n.y);
  }
  // paneel Object
  const num = (v) => { const x = String(v ?? "").trim().replace(",", "."); return /^-?(\d+(\.\d*)?|\.\d+)$/.test(x) ? +x : NaN; };
  const oErr = (inp, code) => {
    const e = $(inp.id + "-e");
    inp.setAttribute("aria-invalid", String(!!code));
    e.hidden = !code;
    e.textContent = !code ? "" : code === "rot" ? t("maps.obj.rotBad") : t("maps.obj.sizeBad", { min: fmt(OBJ.minSize), max: fmt(OBJ.maxSize) });
  };
  const sizeOk = (n) => n >= OBJ.minSize && n <= OBJ.maxSize;
  function syncObj() {
    const o = selObj();
    if (!o) return;
    $("m-o-t").textContent = objName(o);
    const vals = { "m-orot-v": fmt(o.rot), "m-ow": fmt(o.w), "m-oh": fmt(o.h) };
    for (const [id, v] of Object.entries(vals)) if (document.activeElement !== $(id)) { $(id).value = v; oErr($(id), null); }
    press("m-olayer", o.layer);
    $("m-oback").disabled = atEdge(map.objs, o.id, "back");
    $("m-ofront").disabled = atEdge(map.objs, o.id, "front");
    $("m-osnap").setAttribute("aria-pressed", String(snap));
  }
  function openObj() {
    if (!selObj()) return;
    osheet.hidden = false; btnMore.setAttribute("aria-expanded", "true");
    odockFocus(side());
    chrome();
    syncObj();
    osheet.focus(); // in de tik (iOS)
    if (auto) fit();
  }
  function closeObj(focus = true) {
    if (osheet.hidden) return;
    osheet.hidden = true; btnMore.setAttribute("aria-expanded", "false");
    odockFocus(true);
    chrome();
    if (focus && !odock.hidden) btnMore.focus();
    if (auto) fit(); else later();
  }
  const objFields = {
    "m-orot-v": (o, v) => { const n = num(v); return Number.isFinite(n) ? [rotateObj(map.grid, o, n, snap && n % 90 === 0), "rotate"] : "rot"; },
    "m-ow": (o, v) => { const n = num(v); return sizeOk(n) ? [sizeObj(map.grid, o, n, o.h, snap), "size"] : "size"; },
    "m-oh": (o, v) => { const n = num(v); return sizeOk(n) ? [sizeObj(map.grid, o, o.w, n, snap), "size"] : "size"; },
  };
  for (const [id, fn] of Object.entries(objFields)) {
    const inp = $(id);
    const commitO = () => {
      const o = selObj();
      if (!o) return;
      const r = fn(o, inp.value);
      if (typeof r === "string") { oErr(inp, r); return; }
      oErr(inp, null);
      setObj(r[0], r[1]);
      const n = selObj();
      if (n) inp.value = fmt(id === "m-orot-v" ? n.rot : id === "m-ow" ? n.w : n.h);
    };
    inp.addEventListener("input", () => { const o = selObj(); oErr(inp, o && inp.value.trim() !== "" && typeof fn(o, inp.value) === "string" ? (id === "m-orot-v" ? "rot" : "size") : null); });
    inp.addEventListener("change", commitO);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commitO(); } });
  }
  $("m-orot").addEventListener("click", () => turn(1));
  $("m-odup").addEventListener("click", dupSel);
  $("m-odel").addEventListener("click", delSel);
  btnMore.addEventListener("click", () => (osheet.hidden ? openObj() : closeObj()));
  $("m-odone").addEventListener("click", () => select(null));
  $("m-oclose").addEventListener("click", () => closeObj());
  $("m-oleft").addEventListener("click", () => turn(-1));
  $("m-oright").addEventListener("click", () => turn(1));
  $("m-olayer").addEventListener("click", (e) => { const v = e.target.closest("button")?.dataset.v; if (v) setLayer(v); });
  $("m-oback").addEventListener("click", () => order("back"));
  $("m-ofront").addEventListener("click", () => order("front"));
  $("m-osnap").addEventListener("click", () => setSnap(!snap));

  // ---- WP58: kaart openen en Mijn kaarten ----
  /** Kaart in de editor zetten (document uit de opslag of net gemaakt) */
  const openDoc = (doc) => {
    if (aligning) setAlign(false, false);
    selId = null; kbd = null; closeObj(false); // WP62: selectie hoort bij één kaart
    cur = doc;
    map.grid = cleanGrid(doc.grid);
    map.bg = cleanBg(doc.bg);
    map.objs = doc.objs || [];
    map.terr = doc.terr || null; // WP63
    hist.clear(); histBtns(); // WP61: geschiedenis hoort bij één kaart
    ghost = null;
    trimImgs();
    bgErr(null);
    loadBg(); syncBg();
    store.setLastId(doc.id);
    saver.reset();
    label(); head(); chrome();
    if (!sheet.hidden) { nameInp.value = doc.name; syncPanel(); }
    auto = true; fitted = false; measure();
  };
  const list = $("m-list"), ldock = $("m-ldock"), rows = $("m-lrows"), menu = $("m-menu"), menuS = $("m-menu-s");
  let maps = []; // laatst gelezen lijst (opgeschoond, gesorteerd)
  const names = (except) => maps.filter((m) => m.id !== except).map((m) => m.name);
  const when = (ts) => { const a = ago(ts); if (!a) return i18n().date(ts, { day: "numeric", month: "short", ...(new Date(ts).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) }); return a.k === "now" ? t("maps.ago.now") : t("maps.ago." + a.k, { n: a.n }); };
  const fill = (focusId) => {
    if (cur && saver.status !== "off") { const i = maps.findIndex((m) => m.id === cur.id); if (i >= 0) maps[i] = { ...cur }; } // wat nog niet bewaard is, toont al de nieuwste naam
    maps = sortMaps(maps);
    $("m-l-empty").hidden = maps.length > 0;
    rows.innerHTML = maps.map((m) => {
      const g = m.grid, sub = t(g.type === "hex" ? "maps.list.hex" : "maps.list.square", { cols: g.cols, rows: g.rows, when: when(m.updatedAt) });
      const open = cur && cur.id === m.id;
      return `<li class="mkl-row"><button type="button" class="mkl-o${open ? " cur" : ""}" data-id="${esc(m.id)}"><span class="mkl-n">${esc(m.name)}</span><span class="mkl-s">${esc(sub)}</span>${open ? `<span class="mkl-c">${esc(t("maps.list.current"))}</span>` : ""}</button>`
        + `<button type="button" class="btn mkl-m" data-id="${esc(m.id)}" aria-label="${esc(t("maps.list.more", { name: m.name }))}" aria-haspopup="dialog"><svg class="li" aria-hidden="true" focusable="false"><use href="/icons/ui.svg#i-more"/></svg></button></li>`;
    }).join("");
    $("m-back").hidden = !cur && !maps.length;
    if (focusId) rows.querySelector(`.mkl-o[data-id="${CSS.escape(focusId)}"]`)?.focus();
  };
  const reload = async (focusId) => { if (saver.status !== "off") maps = (await store.listMaps()) ?? maps; fill(focusId); };
  const setView = (v) => {
    viewName = v;
    const isList = v === "list";
    list.hidden = !isList; ldock.hidden = !isList;
    wrap.hidden = isList;
    if (isList) select(null, false); // WP62
    docks();
    head(); chrome();
    histBtns(); paintStrip();
    if (!isList) { fitted = false; requestAnimationFrame(measure); } // terug van de lijst: maat opnieuw (canvas was verborgen)
  };
  const showList = async () => {
    closePanel(false); closeLib(false);
    if (viewName !== "list") { try { history.pushState({ mapsList: 1 }, ""); } catch { /* geen history */ } }
    setView("list");
    $("m-l-off").hidden = saver.status !== "off";
    saver.flush(); // niet wachten: de lijst toont cur al uit het geheugen
    fill(); // meteen de bekende lijst, daarna de stand uit de opslag
    await reload();
    (rows.querySelector(".mkl-o.cur, .mkl-o") || $("m-new")).focus();
  };
  /** Weg uit de lijst naar de editor (met history.back als de lijst een eigen history-stap heeft) */
  const leaveList = () => {
    if (history.state && history.state.mapsList) history.back(); // popstate zet de editor terug
    else setView("edit");
  };
  window.addEventListener("popstate", () => {
    if (gone) return;
    if (viewName === "list" && cur) { closeMenu(false); setView("edit"); }
  });
  /** Eén actie tegelijk (dubbel tikken op Nieuwe kaart maakt geen twee kaarten) */
  let working = false;
  const busy = (fn) => async (...a) => { if (working) return; working = true; try { await fn(...a); } finally { working = false; } };
  const openId = busy(async (id) => {
    if (cur && cur.id === id) { leaveList(); return; }
    if (!(await saver.flush()) && saver.status !== "off") { failMsg(); return; } // niet wisselen: de wijzigingen zouden verloren gaan
    const doc = saver.status === "off" ? maps.find((m) => m.id === id) : await store.getMap(id);
    if (!doc) { toast(t("maps.msg.opFail"), { bad: true }); await reload(); return; }
    openDoc(doc);
    leaveList();
  });
  $("m-maps").addEventListener("click", showList);
  $("m-back").addEventListener("click", async () => {
    if (cur) { leaveList(); return; }
    const id = pickStart(maps, null);
    if (id) openId(id);
  });
  $("m-new").addEventListener("click", busy(async () => {
    if (!(await saver.flush()) && saver.status !== "off") { failMsg(); return; }
    const doc = newMap({ name: newName(t("maps.newBase"), names()) });
    if (saver.status !== "off" && !(await store.putMap(doc))) { toast(t("maps.msg.opFail"), { bad: true }); return; }
    if (saver.status === "off") maps.push(doc);
    openDoc(doc);
    leaveList();
  }));
  rows.addEventListener("click", (e) => {
    const o = e.target.closest(".mkl-o"), m = e.target.closest(".mkl-m");
    if (o) openId(o.dataset.id);
    else if (m) openMenu(m.dataset.id, m);
  });

  // menu per kaart (modaal, met dim): Hernoemen, Dupliceren, Verwijderen; Hernoemen wisselt de inhoud naar een veld
  let menuFor = null, menuBack = null;
  const others = () => [...document.body.children].filter((el) => el !== menu && !el.matches("script, .toast"));
  const openMenu = (id, from) => {
    const m = maps.find((x) => x.id === id);
    if (!m) return;
    menuFor = m; menuBack = from;
    menuS.innerHTML = `<div class="grab" aria-hidden="true"></div><div class="shead"><h3 id="m-menu-t">${esc(m.name)}</h3><button type="button" class="link" data-m="close">${esc(t("maps.panel.close"))}</button></div>`
      + `<div class="mmenu"><button type="button" class="btn" data-m="rename">${esc(t("maps.menu.rename"))}</button><button type="button" class="btn" data-m="dup">${esc(t("maps.menu.duplicate"))}</button><button type="button" class="btn" data-m="exp">${esc(t("maps.menu.export"))}</button><button type="button" class="btn mdel" data-m="del">${esc(t("maps.menu.delete"))}</button></div>`;
    menu.hidden = false;
    for (const el of others()) el.inert = true;
    menuS.querySelector('[data-m="rename"]').focus(); // in de tik (iOS)
  };
  const renameForm = () => {
    menuS.innerHTML = `<div class="grab" aria-hidden="true"></div><div class="shead"><h3 id="m-menu-t">${esc(t("maps.rename.title"))}</h3><button type="button" class="link" data-m="close">${esc(t("maps.panel.close"))}</button></div>`
      + `<form class="mrename" novalidate><label>${esc(t("maps.name"))}<input id="m-rn" type="text" enterkeyhint="done" autocomplete="off" maxlength="60" spellcheck="false" aria-describedby="m-rn-e"></label><span class="ferr" id="m-rn-e" hidden></span>`
      + `<button type="submit" class="btn primary">${esc(t("maps.rename.save"))}</button></form>`;
    const inp = $("m-rn");
    inp.value = menuFor.name;
    inp.focus(); inp.select(); // in de tik (iOS: toetsenbord)
    menuS.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); doRename(inp.value); });
  };
  function closeMenu(focus = true) {
    if (menu.hidden) return;
    menu.hidden = true; menuS.innerHTML = "";
    if (!gone) for (const el of others()) el.inert = false;
    const id = menuFor?.id;
    menuFor = null;
    if (focus) (rows.querySelector(`.mkl-m[data-id="${id && CSS.escape(id)}"]`) || menuBack?.isConnected && menuBack || $("m-new")).focus();
  }
  const save = async (doc) => saver.status === "off" || store.putMap(doc);
  const doRename = async (v) => {
    const n = cleanName(v), e = $("m-rn-e");
    if (!n) { e.hidden = false; e.textContent = t("maps.rename.empty"); $("m-rn").setAttribute("aria-invalid", "true"); return; }
    const m = menuFor;
    if (n !== m.name) {
      if (cur && cur.id === m.id) { cur.name = n; changed(); head(); if (!(await saver.flush()) && saver.status !== "off") failMsg(); }
      else {
        const doc = { ...m, name: n, updatedAt: Date.now() };
        if (!(await save(doc))) { toast(t("maps.msg.opFail"), { bad: true }); return; }
        Object.assign(m, doc);
      }
    }
    closeMenu();
    await reload(m.id);
    rows.querySelector(`.mkl-m[data-id="${CSS.escape(m.id)}"]`)?.focus();
  };
  const doDup = async () => {
    const m = cur && cur.id === menuFor.id ? cur : menuFor;
    const doc = copyMap(m, { name: uniqueName(t("maps.copyName", { name: m.name }), names()) });
    if (!doc || !(await save(doc))) { toast(t("maps.msg.opFail"), { bad: true }); return; }
    if (saver.status === "off") maps.push(doc);
    closeMenu(false);
    await reload(doc.id); // de kopie staat bovenaan (nieuwste) en krijgt de focus
  };
  const doDel = async () => {
    const m = menuFor, wasCur = cur && cur.id === m.id;
    const doc = wasCur ? { ...cur } : { ...m };
    if (wasCur) { await saver.flush(); cur = null; saver.reset(); histBtns(); }
    if (saver.status !== "off" && !(await store.deleteMap(m.id))) {
      if (wasCur) { cur = doc; saver.touch(); histBtns(); } // niet weg: weer de open kaart (met zijn geschiedenis), en opnieuw bewaren
      toast(t("maps.msg.opFail"), { bad: true }); return;
    }
    if (saver.status === "off") maps = maps.filter((x) => x.id !== m.id);
    if (wasCur) { store.setLastId(null); hist.clear(); histBtns(); } // pas na gelukt verwijderen
    closeMenu(false);
    await reload();
    (rows.querySelector(".mkl-o") || $("m-new")).focus();
    toast(t("maps.msg.deleted", { name: doc.name }), { btn: { label: t("maps.msg.undo"), run: async () => { // zelfde id en tijden terug
      doc.name = uniqueName(doc.name, names(doc.id)); // intussen een nieuwe "Kaart 1"? dan geen dubbele naam
      if (saver.status !== "off" && !(await store.putMap(doc))) { toast(t("maps.msg.opFail"), { bad: true }); return; }
      maps = [...maps.filter((x) => x.id !== doc.id), doc];
      if (viewName === "list") await reload(doc.id);
    } } });
  };
  menu.addEventListener("click", (e) => {
    const a = e.target.closest("[data-m]")?.dataset.m;
    if (a === "close") closeMenu();
    else if (a === "rename") renameForm();
    else if (a === "dup") doDup();
    else if (a === "del") doDel();
    else if (a === "exp") doExport();
  });

  // ---- WP60: projectbestand ----
  /** Kaart exporteren vanuit het menu. De open kaart uit het geheugen (ook wat nog niet bewaard is), anders uit de opslag. */
  let exporting = false;
  const doExport = async () => {
    const m = menuFor;
    if (!m || exporting) return; // dubbel tikken opent geen tweede deelmenu
    exporting = true;
    try { await exportOne(m); } catch { toast(t("maps.msg.opFail"), { bad: true }); } finally { exporting = false; } // bijv. geheugen of opslagfout
  };
  const exportOne = async (m) => {
    const doc = cur && cur.id === m.id ? cur : saver.status === "off" ? m : await store.getMap(m.id);
    if (!doc) { toast(t("maps.msg.opFail"), { bad: true }); return; }
    const assets = new Map(); // WP64: achtergrond + eigen assets op objecten (ongebruikte items uit Mijn assets nooit)
    for (const sha of usedAssets(doc)) { const rec = await assetRec(sha); if (rec) assets.set(sha, rec); }
    const names = new Map(mine.map((i) => [i.sha, i.name]));
    const { r, missing } = await exportMap(doc, assets, { app: `${APP} ${VERSION}`, title: t("maps.exp.title", { name: doc.name }), names });
    if (r === "big") { toast(t("maps.exp.big", { mb: FILE_MAX / 1048576 }), { bad: true }); return; }
    if (r === "missing") { toast(t(doc.bg && missing.includes(doc.bg.asset) ? "maps.exp.missing" : "maps.exp.missingOwn"), { bad: true }); return; }
    if (r === "done") { closeMenu(); toast(t("maps.exp.done")); }
  };
  /** WP64: eigen assets op een geïmporteerde kaart die nog niet in Mijn assets staan, daar toevoegen (naam uit het bestand,
   *  anders "Afbeelding N"; miniatuur opnieuw gemaakt). Lukt dat niet, dan werkt de kaart gewoon (het item ontbreekt).
   *  Geeft de toegevoegde sha's (Ongedaan haalt ze weer weg zolang geen kaart ze gebruikt). */
  async function adoptMine(doc, res) {
    const out = [];
    for (const sha of usedAssets({ objs: doc.objs })) {
      if (mineItem(sha) || mine.length >= MINE.max) continue;
      const rec = res.assets.get(sha);
      if (!rec) continue;
      const th = await makeThumb(rec, MINE.thumb), nm = res.names && res.names.get(sha);
      const it = cleanItem({ sha, name: nm ? uniqueName([...nm].slice(0, MINE.nameMax - 4).join("").trim(), mineNames()) : newName(t("maps.my.base"), mineNames()),
        ...defaultCells(rec.w, rec.h), addedAt: Date.now(), ...(th ? { thumb: th.data, tmime: th.mime } : {}) });
      if (!it || (saver.status !== "off" && (await store.addMine(it, sha, null)) !== true)) continue;
      mine = sortMine([it, ...mine]);
      out.push(sha);
    }
    return out;
  }
  // importeren: verborgen input + echte knop onder de lijst; altijd een nieuwe kaart (nieuwe id, naam uniek), nooit
  // overschrijven. Fout = regel onder de knop (blijft staan tot de volgende poging), gelukt = bovenaan met focus + Ongedaan.
  const imp = { btn: $("m-imp"), file: $("m-imp-file"), err: $("m-imp-e") };
  const impErr = (code) => { imp.err.hidden = !code; imp.err.textContent = code ? t("maps.imp.err." + code, { mb: FILE_MAX / 1048576 }) : ""; };
  let importing = false; // eigen vlag (niet busy): een gekozen bestand wordt nooit stil genegeerd omdat er net een lijstactie loopt
  imp.btn.addEventListener("click", () => { if (!importing) { impErr(null); imp.file.click(); } });
  imp.file.addEventListener("change", async () => {
    const f = imp.file.files && imp.file.files[0];
    imp.file.value = ""; // hetzelfde bestand nog eens = opnieuw een change
    if (!f || importing) return;
    importing = true;
    const label = imp.btn.textContent;
    imp.btn.disabled = true; imp.btn.setAttribute("aria-busy", "true"); imp.btn.textContent = t("maps.imp.busy");
    let res, doc, added = [];
    try {
      res = await importFile(f);
      if (res.ok) {
        const now = Date.now();
        doc = { ...res.map, id: mapId(), name: uniqueName(res.map.name || newName(t("maps.newBase"), names()), names()), createdAt: now, updatedAt: now };
        for (const [sha, rec] of res.assets) { // een bestaande asset (zelfde sha = zelfde bytes) blijft zoals hij is, met zijn eigen src
          if (saver.status === "off") { if (!memAssets.has(sha)) memAssets.set(sha, rec); }
          else if (!(await store.getAsset(sha)) && !(await store.putAsset(sha, rec))) { res = { ok: false, code: "store" }; break; }
        }
        if (res.ok && saver.status !== "off" && !(await store.putMap(doc))) res = { ok: false, code: "store" };
        if (res.ok) added = await adoptMine(doc, res); // WP64: eigen assets ook in Mijn assets op dit apparaat
      }
    } catch { res = { ok: false, code: "read" }; }
    imp.btn.disabled = false; imp.btn.removeAttribute("aria-busy"); imp.btn.textContent = label;
    importing = false;
    if (!res.ok) { impErr(res.code); return; } // een al bewaarde asset zonder kaart ruimt gcAssets bij de volgende start op
    if (saver.status === "off") maps.push(doc);
    await reload(doc.id); // bovenaan (nieuwste) met focus
    toast(t("maps.imp.done", { name: doc.name }), { btn: { label: t("maps.msg.undo"), run: async () => { // Ongedaan = de nieuwe kaart weer weg
      // intussen geopend of bewerkt: niet stil weggooien
      const now = cur && cur.id === doc.id ? cur : saver.status === "off" ? maps.find((x) => x.id === doc.id) : await store.getMap(doc.id);
      if (!now) return; // al weg
      if ((cur && cur.id === doc.id) || now.updatedAt !== doc.updatedAt) { toast(t("maps.imp.kept"), { bad: true }); return; }
      if (saver.status !== "off" && !(await store.deleteMap(doc.id))) { toast(t("maps.msg.opFail"), { bad: true }); return; }
      maps = maps.filter((x) => x.id !== doc.id);
      for (const sha of added) if (mineItem(sha) && !usedCount(sha).n) { if (saver.status === "off" || (await store.deleteMine(sha))) { mine = mine.filter((x) => x.sha !== sha); dropThumb(sha); } } // WP64: wat de import toevoegde
      if (viewName === "list") { await reload(); (rows.querySelector(".mkl-o") || $("m-new")).focus(); }
    } } });
  });

  // ---- WP65: sneltoetsenoverzicht (? of de link onderaan paneel Kaart; patroon van Initiative js/ui/keys.js, eigen kopie) ----
  const keysW = $("m-keysw"), MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ""), MOD = MAC ? "⌘" : "Ctrl";
  let keysBack = null;
  const kb = (...k) => k.map((x) => `<kbd>${esc(x)}</kbd>`).join(" ");
  const or = (...a) => a.join(` ${esc(t("maps.keys.or"))} `);
  const keyRows = () => [
    ["maps.keys.grpMap", [[or(kb("+"), kb("−")), "maps.keys.zoom"], [kb("0"), "maps.keys.fit"], [kb(MOD, "Z"), "maps.keys.undo"],
      [MAC ? kb("⌘", "Shift", "Z") : or(kb("Ctrl", "Y"), kb("Ctrl", "Shift", "Z")), "maps.keys.redo"], [kb("?"), "maps.keys.help"]]],
    ["maps.keys.grpCursor", [[kb("←", "↑", "↓", "→"), "maps.keys.cursor"], [or(kb("Enter"), kb(t("maps.keys.space"))), "maps.keys.enter"],
      [or(kb("N"), kb("Shift", "N")), "maps.keys.next"], [kb("Esc"), "maps.keys.esc"]]],
    ["maps.keys.grpSel", [[kb("←", "↑", "↓", "→"), "maps.keys.move"], [or(kb("R"), kb("Shift", "R")), "maps.keys.rot"], [or(kb("]"), kb("[")), "maps.keys.order"],
      [kb(MOD, "D"), "maps.keys.dup"], [or(kb("Delete"), kb("Backspace")), "maps.keys.del"]]],
  ];
  const keysOpen = () => !keysW.hidden;
  function openKeys() {
    if (keysOpen() || gone) return;
    keysBack = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    keysW.innerHTML = `<div class="dim" data-keys="close"></div><div class="sheet mkeysheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="m-k-t">`
      + `<div class="grab" aria-hidden="true"></div><div class="shead"><h3 id="m-k-t">${esc(t("maps.keys.title"))}</h3><button type="button" class="link" data-keys="close">${esc(t("maps.panel.close"))}</button></div>`
      + keyRows().map(([g, rows]) => `<h4 class="mkgrp">${esc(t(g))}</h4><dl class="keys">${rows.map(([k, l]) => `<dt>${k}</dt><dd>${esc(t(l))}</dd>`).join("")}</dl>`).join("")
      + `<p class="hint">${esc(t("maps.keys.hint"))}</p></div>`;
    keysW.hidden = false;
    for (const el of document.body.children) if (el !== keysW && !el.matches("script, .toast")) el.inert = true;
    keysW.querySelector(".sheet").focus({ preventScroll: true });
  }
  function closeKeys() {
    if (!keysOpen()) return;
    keysW.hidden = true; keysW.innerHTML = "";
    if (!gone) for (const el of document.body.children) el.inert = false; // alleen te openen zonder kaartmenu (? en de link in paneel Kaart)
    const f = keysBack && keysBack.isConnected ? keysBack : null;
    keysBack = null;
    (f || (viewName === "edit" ? cv : $("m-new"))).focus({ preventScroll: true });
  }
  keysW.addEventListener("click", (e) => { if (e.target.closest("[data-keys=close]")) closeKeys(); });
  $("m-keys").addEventListener("click", openKeys);

  document.addEventListener("keydown", (e) => {
    if (gone) return;
    if (keysOpen()) { if (e.key === "Escape") { e.preventDefault(); closeKeys(); } return; } // WP65: alles eronder is inert
    if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && menu.hidden && !aligning) { e.preventDefault(); openKeys(); return; }
    if (e.key === "Escape" && !menu.hidden) { e.preventDefault(); closeMenu(); return; }
    if (aligning && menu.hidden) { // WP59: pijltjes schuiven de afbeelding, Esc = Gereed
      const dir = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[e.key];
      if (e.key === "Escape") { e.preventDefault(); setAlign(false); return; }
      if (dir && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); nudge(dir); return; }
    }
    if (e.key === "Escape" && !sheet.hidden) { e.preventDefault(); closePanel(); return; }
    if (e.key === "Escape" && !osheet.hidden) { e.preventDefault(); closeObj(); return; } // WP62: eerst het paneel, dan de selectie
    if (e.key === "Escape" && !lsheet.hidden) { e.preventDefault(); closeLib(); return; } // WP61: Plaatsen stoppen
    if (viewName !== "edit" || !menu.hidden) return;
    const field = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    // WP61: ⌘Z/Ctrl+Z ongedaan, ⌘⇧Z/Ctrl+Shift+Z/Ctrl+Y opnieuw; niet in een tekstveld (eigen undo) en niet tijdens uitlijnen
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !field && !aligning && (k === "z" || (k === "y" && e.ctrlKey && !e.metaKey))) {
      e.preventDefault();
      if (k === "y" || e.shiftKey) redo(); else undo();
      return;
    }
 // WP62: objecttoetsen. Pijltjes, Enter/spatie en N alleen op de kaart (canvas met focus); de rest overal buiten tekstvelden.
    const o = selObj(), onCv = e.target === cv;
    if (o && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && !field && k === "d") { e.preventDefault(); dupSel(); return; } // Ctrl/⌘+D (niet de bladwijzer)
    if (!field && !e.metaKey && !e.ctrlKey && !e.altKey && !aligning && cur) {
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      let did = true;
      if (dir && onCv) { if (o) nudgeSel(dir[0], dir[1], e.shiftKey); else moveCursor(dir[0], dir[1]); }
      else if ((e.key === "Enter" || e.key === " ") && onCv && painting()) { if (!e.repeat) paintKey(); } // WP65: verven op de cursorcel (ingedrukt houden verft niet tien keer)
      else if (k === "n" && onCv && painting()) { /* WP63: in Verven niet selecteren */ }
      else if ((e.key === "Enter" || e.key === " ") && onCv) enterKey();
      else if (k === "n" && onCv) nextObj(e.shiftKey ? -1 : 1);
      else if (o && k === "r") turn(e.shiftKey ? -1 : 1);
      else if (o && e.key === "]") order("front");
      else if (o && e.key === "[") order("back");
      else if (o && (e.key === "Delete" || e.key === "Backspace")) delSel();
      else if (e.key === "Escape" && o) { kbd = onCv ? clampCell(cellAt(map.grid, o.x, o.y)) : null; select(null); if (kbd) later(); }
      else if (e.key === "Escape" && kbd) { kbd = null; later(); }
      else did = false;
      if (did) { e.preventDefault(); return; }
    }
    if (e.metaKey || e.ctrlKey || e.altKey || field) return;
    if (e.key === "+" || e.key === "=") user(zoomAt(view, ZOOM_STEP, w / 2, h / 2));
    else if (e.key === "-" || e.key === "_") user(zoomAt(view, 1 / ZOOM_STEP, w / 2, h / 2));
    else if (e.key === "0") fit();
    else return;
    e.preventDefault();
  });

  /* D11: een ander tabblad nam het over. Niets meer opslaan (de write-guard in store.js weigert al); alles eronder inert;
     "Hier verder werken" herlaadt: dan de nieuwste kaarten uit IndexedDB en dit tabblad claimt weer. Zelfde scherm als
     Initiative (.tabstop uit css/app.css). */
  function tabLost() {
    if (gone) return;
    gone = true;
    for (const el of document.body.children) el.inert = true;
    const d = document.createElement("div");
    d.className = "tabstop";
    d.setAttribute("role", "alertdialog");
    d.setAttribute("aria-modal", "true");
    d.setAttribute("aria-labelledby", "ts-t");
    d.setAttribute("aria-describedby", "ts-d");
    d.innerHTML = `<div class="tabstop-card"><h2 id="ts-t">${esc(t("maps.tab.title"))}</h2><p id="ts-d">${esc(t("maps.tab.text"))}</p>`
      + `<button type="button" class="btn primary">${esc(t("maps.tab.here"))}</button><p class="hint">${esc(t("maps.tab.hint"))}</p></div>`;
    d.querySelector("button").addEventListener("click", () => location.reload());
    document.body.append(d);
    d.querySelector("button").focus();
  }

  // WP65: draaien of venster smaller/breder over 768 px: zijpaneel ↔ paneel van onderen (dock bereikbaar, passend blijft passend)
  const onSide = () => { dockFocus(side() || (sheet.hidden && lsheet.hidden)); odockFocus(side() || osheet.hidden); chrome(); if (auto) fit(); else set(view); };
  try { sideMq.addEventListener("change", onSide); } catch { try { sideMq.addListener(onSide); } catch { /* geen live wissel */ } }
  if (window.ResizeObserver) new ResizeObserver(measure).observe(wrap);
  window.addEventListener("resize", measure);
  // themawissel (systeem): kleuren opnieuw lezen; een vaste keuze zet js/theme.js al vóór de eerste paint
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { col = readColors(); later(); }); } catch { /* Safari < 14: geen live wissel */ }

  // ---- start: laatste kaart heropenen; nog geen kaart = direct "Map 1"; geen opslag = in het geheugen ----
  const stored = (await store.available()) ? await store.listMaps() : undefined;
  if (stored) {
    maps = stored;
    const id = pickStart(maps, store.lastId());
    let doc = id && maps.find((m) => m.id === id), fresh = false;
    if (!doc) { doc = newMap({ name: newName(t("maps.newBase"), names()) }); fresh = !(await store.putMap(doc)); }
    mine = (await store.listMine()) || []; // WP64 (vóór openDoc: namen en tekenen van eigen assets)
    openDoc(doc);
    if (fresh) saver.touch(); // eerste kaart niet bewaard: autosave probeert opnieuw en toont zo nodig "Niet opgeslagen"
    store.persistStorage();
    store.gcAssets(); // WP59: assets zonder kaart (vervangen, verwijderd) opruimen, alleen bij de start
  } else { // geen IndexedDB (undefined), of lezen mislukt (null: niets aanmaken of overschrijven): alleen in het geheugen
    saver.off();
    const doc = newMap({ name: newName(t("maps.newBase"), []) });
    maps = [doc];
    openDoc(doc);
    toast(t(stored === null ? "maps.msg.readFail" : "maps.status.offLong"), { bad: true });
  }
  paintStatus();
  label(); head();
  measure();
  window.__maps = { view: () => ({ ...view }), size: () => ({ w, h, dpr }), grid: () => ({ ...map.grid }), // diagnose (browsercheck), alleen lezen
    map: () => cur && { ...cur, grid: { ...cur.grid }, ...(cur.bg ? { bg: { ...cur.bg } } : {}), ...(cur.objs ? { objs: cur.objs.map((o) => ({ ...o })) } : {}) }, status: () => saver.status, view$: () => viewName, flush: () => saver.flush(),
    bg: () => ({ state: bgState(), align: aligning, img: !!(map.bg && imgs.get(map.bg.asset)) }),
    hist: () => ({ undo: hist.canUndo, redo: hist.canRedo, size: hist.size }), tool: () => ({ placing: placing(), active, snap, ghost: !!ghost }),
    sel: () => selId, kbd: () => kbd && { ...kbd },
    bench: (n = 20) => { const t0 = performance.now(); for (let i = 0; i < n; i++) paint(); return (performance.now() - t0) / n; }, // WP63: tekentijd per frame (browsercheck)
    paint: () => ({ painting: painting(), tab: libTab, mat, tool, cells: countTerr(map.grid, map.terr), ids: map.terr ? [...map.terr.ids] : [] }),
    mine: () => mine.map((i) => ({ sha: i.sha, name: i.name, w: i.w, h: i.h, thumb: !!i.thumb })), // WP64
    art: (sha) => !!art.get(sha, 48) };

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }
}

boot().catch((e) => { console.error("Inn Sight: boot failed", e); });

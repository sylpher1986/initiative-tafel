// Inn the Grid (G4, WP56): opstarten van de kaartenmaker op /maps/ en /{taal}/maps/. Staat helemaal los van Initiative:
// alleen gedeelde infrastructuur (js/i18n/*, js/theme.js, tokens en letters uit css/app.css), nooit iets uit js/rules/,
// js/ui/, state.js, storage.js of tablock.js (tests/maps-boundary.test.js). WP56: pannen en zoomen; WP57: paneel Kaart
// (rastertype, kolommen/rijen, lijnen, kleur, dekking), werkt direct; WP58: kaarten bewaren (IndexedDB "kevs-inn-maps",
// js/maps/store.js), autosave met status in de kop, Mijn kaarten (nieuw, openen, hernoemen, dupliceren, verwijderen met
// Ongedaan), laatste kaart heropenen, één tabblad tegelijk; WP59: achtergrondafbeelding kiezen (controle, verkleinen,
// assetstore), schaal, raster passend, uitlijnmodus, vervangen/verwijderen met Ongedaan; WP60: projectbestand v1
// (exporteren in het menu per kaart, importeren onder de lijst als nieuwe kaart) (docs/g4-inn-the-grid.md).
import { initI18n, t, i18n } from "../i18n/boot.js";
import { APP, VERSION } from "./version.js";
import { cleanGrid, parseCells, bounds, LIMITS } from "./model/grid.js";
import { clampPan, fitView, zoomAt, zoomPct, ZMIN, ZMAX, CELL } from "./model/view.js";
import { cleanBg, guessPpc, gridFor, parsePpc, parseAcross, scaleBg, moveBg, across, stepFor, BG } from "./model/bg.js";
import { IMG } from "./model/image.js";
import { prepareImage, assetImage } from "./ui/upload.js";
import { newMap, mapId, cleanName, newName, uniqueName, copyMap, sortMaps, pickStart, ago } from "./model/map.js";
import { FILE_MAX } from "./model/file.js";
import { exportMap, importFile } from "./ui/export.js";
import { readColors, fitCanvas, draw } from "./render/canvas.js";
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
  const map = { grid: cleanGrid(), bg: null };
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
    draw(cv, map, view, w, h, dpr, col, { img: (map.bg && imgs.get(map.bg.asset)) || null, align: aligning });
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
    if ((!fitted || auto) && w > 50 && h > 50) { fitted = true; fit(); } else set(view); // 0×0 (tabblad op de achtergrond, lijst open): later passend maken
  };

  const label = () => cv.setAttribute("aria-label", t(map.grid.type === "hex" ? "maps.canvasHex" : "maps.canvas", { cols: map.grid.cols, rows: map.grid.rows }));
  const head = () => { $("m-name").textContent = viewName === "list" ? t("maps.title") : cur?.name || t("maps.title"); };
  $("m-ver").textContent = VERSION;
  attachInput(cv, { get: () => view, set: user, drag: (dx, dy) => dragBg(dx, dy), dragging: () => aligning });
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
  const update = (patch) => { // nieuwe rasterwaarden toepassen: opschonen, begrenzen, tekenen, bewaren
    map.grid = cleanGrid({ ...map.grid, ...patch });
    if (cur) cur.grid = map.grid;
    label(); syncPanel(); syncBg(); changed();
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
  if (window.ResizeObserver) new ResizeObserver(() => { if (auto && !sheet.hidden) fit(); }).observe(sheet);
  const openPanel = () => {
    for (const [id, k] of Object.entries(fields)) { $(id).value = String(map.grid[k]); fieldErr($(id), false); }
    nameInp.value = cur?.name || "";
    syncPanel();
    sheet.hidden = false; btnSet.setAttribute("aria-expanded", "true");
    dockFocus(false);
    syncBg();
    sheet.focus(); // in de tik (iOS)
    if (auto) fit();
  };
  const closePanel = (focus = true) => {
    if (sheet.hidden) return;
    sheet.hidden = true; btnSet.setAttribute("aria-expanded", "false");
    dockFocus(true);
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
  /** Nieuwe achtergrond (of null) op de open kaart: tekenen en bewaren */
  const setBg = (next) => {
    const was = map.bg && map.bg.asset;
    map.bg = next ? cleanBg(next) : null;
    if (cur) { if (map.bg) cur.bg = map.bg; else delete cur.bg; }
    if ((map.bg && map.bg.asset) !== was) trimImgs();
    changed();
    if (!sheet.hidden) syncBg(); // slepen in de uitlijnmodus: paneel dicht, geen DOM-werk per pointermove (openPanel synct)
    later();
  };
  const restoreBg = (id, prev) => () => { if (cur && cur.id === id) { setBg(prev); loadBg(); } }; // Ongedaan: asset staat tot de volgende start in de opslag
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
    setBg(keep ? { ...prev, ...base } : { ...base, ppc: guessPpc(r.ow, r.oh, map.grid.cols), x: 0, y: 0 });
    bgSec.align.focus();
    if (prev && !keep) toast(t("maps.bg.replaced"), { btn: { label: t("maps.msg.undo"), run: restoreBg(id, prev) } });
  });
  bgSec.del.addEventListener("click", () => {
    if (!cur || !map.bg) return;
    const prev = map.bg, id = cur.id;
    setBg(null); bgErr(null);
    bgSec.pick.focus();
    toast(t("maps.bg.removed"), { btn: { label: t("maps.msg.undo"), run: restoreBg(id, prev) } });
  });
  // uitlijnmodus: eigen dock, strook bovenin, één vinger sleept de afbeelding; Gereed = terug naar het paneel
  const adock = $("m-adock"), strip = $("m-astrip");
  function setAlign(on, back = true) {
    if (on === aligning) return;
    aligning = on;
    adock.hidden = !on; strip.hidden = !on; $("m-dock").hidden = on;
    if (on) { closePanel(false); $("m-adone").focus(); }
    else if (back) { openPanel(); bgSec.align.focus(); }
    later();
  }
  bgSec.align.addEventListener("click", () => { if (bgState() === "set") setAlign(true); });
  $("m-adone").addEventListener("click", () => setAlign(false));
  const nudge = (dir) => {
    if (!map.bg) return;
    const s = stepFor(map.bg, view.z, CELL), d = { left: [-s, 0], right: [s, 0], up: [0, -s], down: [0, s] }[dir];
    if (d) setBg(moveBg(map.bg, d[0], d[1]));
  };
  adock.addEventListener("click", (e) => { const d = e.target.closest("[data-nudge]")?.dataset.nudge; if (d) nudge(d); });
  const dragBg = (dx, dy) => { if (map.bg) setBg(moveBg(map.bg, dx / (CELL * view.z), dy / (CELL * view.z))); };

  // ---- WP58: kaart openen en Mijn kaarten ----
  /** Kaart in de editor zetten (document uit de opslag of net gemaakt) */
  const openDoc = (doc) => {
    if (aligning) setAlign(false, false);
    cur = doc;
    map.grid = cleanGrid(doc.grid);
    map.bg = cleanBg(doc.bg);
    trimImgs();
    bgErr(null);
    loadBg(); syncBg();
    store.setLastId(doc.id);
    saver.reset();
    label(); head();
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
    wrap.hidden = isList; $("m-dock").hidden = isList;
    head();
    if (!isList) { fitted = false; requestAnimationFrame(measure); } // terug van de lijst: maat opnieuw (canvas was verborgen)
  };
  const showList = async () => {
    closePanel(false);
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
    if (wasCur) { await saver.flush(); cur = null; saver.reset(); }
    if (saver.status !== "off" && !(await store.deleteMap(m.id))) {
      if (wasCur) { cur = doc; saver.touch(); } // niet weg: weer de open kaart, en opnieuw bewaren
      toast(t("maps.msg.opFail"), { bad: true }); return;
    }
    if (saver.status === "off") maps = maps.filter((x) => x.id !== m.id);
    if (wasCur) store.setLastId(null);
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
    const assets = new Map();
    if (doc.bg) { const rec = await assetRec(doc.bg.asset); if (rec) assets.set(doc.bg.asset, rec); }
    const r = await exportMap(doc, assets, { app: `${APP} ${VERSION}`, title: t("maps.exp.title", { name: doc.name }) });
    if (r === "missing") { toast(t("maps.exp.missing"), { bad: true }); return; }
    if (r === "done") { closeMenu(); toast(t("maps.exp.done")); }
  };
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
    let res, doc;
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
      if (viewName === "list") { await reload(); (rows.querySelector(".mkl-o") || $("m-new")).focus(); }
    } } });
  });

  document.addEventListener("keydown", (e) => {
    if (gone) return;
    if (e.key === "Escape" && !menu.hidden) { e.preventDefault(); closeMenu(); return; }
    if (aligning && menu.hidden) { // WP59: pijltjes schuiven de afbeelding, Esc = Gereed
      const dir = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[e.key];
      if (e.key === "Escape") { e.preventDefault(); setAlign(false); return; }
      if (dir && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); nudge(dir); return; }
    }
    if (e.key === "Escape" && !sheet.hidden) { e.preventDefault(); closePanel(); return; }
    if (viewName !== "edit" || !menu.hidden) return;
    if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
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
    map: () => cur && { ...cur, grid: { ...cur.grid }, ...(cur.bg ? { bg: { ...cur.bg } } : {}) }, status: () => saver.status, view$: () => viewName, flush: () => saver.flush(),
    bg: () => ({ state: bgState(), align: aligning, img: !!(map.bg && imgs.get(map.bg.asset)) }) };

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }
}

boot().catch((e) => { console.error("Inn the Grid: boot failed", e); });

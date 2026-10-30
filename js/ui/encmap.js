// WP69 (G4 fase 3): kaart uit Inn Sight kiezen bij een encounter (blok "Kaart" in Bewerken, js/ui/encounters.js).
// De encounter bewaart alleen een verwijzing { id, name } (js/rules/encounters.js, cleanMapRef); de kaart zelf blijft in
// de Inn Sight-bibliotheek (IndexedDB "kevs-inn-maps") en wordt daar bewerkt. Dit is het enige Initiative-bestand dat
// js/maps/ gebruikt, en alleen via dynamische import (tests/maps-boundary.test.js): Initiative laadt geen kaartcode bij
// het opstarten, en ontbreekt die offline (Maps-cache is best effort), dan zijn kaarten "niet bereikbaar" in plaats van
// dat Initiative breekt. Lezen gaat door store.listMaps (cleanMap); importeren door Inn Sights eigen controles
// (importFile) en komt in de Inn Sight-bibliotheek (Michiel, WP69), met een nieuwe id en unieke naam (importedDoc).
import { t, i18n } from "../i18n/boot.js";
import { normLang, DEFAULT, pathFor } from "../i18n/lang.js";
import { esc } from "./util.js";
import { ui } from "./render.js";

/** Datum als in de encounterlijst ("12 okt", ander jaar met jaartal) */
export const dateTxt = (ms) => i18n().date(ms, { day: "numeric", month: "short", ...(new Date(ms).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });

let mods = null, loaded = null; // loaded = de geladen store-module (synchroon bruikbaar in een tik)
const store = () => (mods ||= import("../maps/store.js").then((m) => (loaded = m))).catch((e) => { mods = null; throw e; });

/** Kaarten op dit apparaat → ui.encMaps (array, nieuwste eerst) of null (opslag of kaartcode niet bereikbaar). */
export async function loadMaps() {
  let list = null;
  try { const s = await store(); list = (await s.available()) ? await s.listMaps() : null; } catch { list = null; }
  ui.encMaps = list;
  return list;
}

const langNow = () => normLang(document.documentElement.lang) || DEFAULT;
const mapsUrl = () => pathFor(langNow(), "/maps/");
/** Inn Sight openen met deze kaart: Inn Sight heropent bij de start de laatste kaart (maps-last). Synchroon in de tik
 *  (vóór de link het nieuwe tabblad opent); de store is dan al geladen (de kaart staat in de lijst). */
export function openInSight(id) {
  if (loaded && id) loaded.setLastId(id);
}

const gridTxt = (m) => `${t(m.grid.type === "hex" ? "init.map.hex" : "init.map.square")} · ${m.grid.cols}×${m.grid.rows}`;
const findMap = (id) => (Array.isArray(ui.encMaps) ? ui.encMaps.find((m) => m.id === id) : null);
/** Actuele naam (hernoemd in Inn Sight), anders de bewaarde naam, anders "Kaart" */
export const mapName = (ref) => { const m = ref && findMap(ref.id); return (m && m.name) || (ref && ref.name) || t("init.map.title"); };

const errLine = () => (ui.encMapErr ? `<p class="hint encerr" role="alert">${esc(t("init.map.err." + ui.encMapErr.code, { mb: ui.encMapErr.mb }))}</p>` : "");
const impBtn = () => `<button type="button" class="btn" data-file="ee-map-file" ${ui.encMapBusy ? `disabled aria-busy="true"` : ""}>${esc(t(ui.encMapBusy ? "init.map.busy" : "init.map.import"))}</button>`;
const sightLink = (id, key) => `<a class="btn tap encsave" href="${esc(mapsUrl())}" target="_blank" rel="noopener" data-encmap="sight"${id ? ` data-id="${esc(id)}"` : ""}>${esc(t(key))} ↗</a>`;

/** Blok "Kaart" in Bewerken (x = ui.encEdit). Volgorde en gedrag: UX-advies WP69. */
export function mapBlockHtml(x) {
  const head = `<p class="vlbl">${esc(t("init.map.title"))}</p>`;
  if (ui.encPick) {
    const L = ui.encMaps;
    const rows = L === undefined ? `<p class="hint">${esc(t("init.map.loading"))}</p>`
      : L === null ? `<p class="empty">${esc(t("init.map.off"))}</p>`
      : !L.length ? `<p class="empty">${esc(t("init.map.none"))}</p>${sightLink("", "init.map.make")}`
      : `<div class="mlist emaps">${L.map((m) => `<button type="button" data-encmap="pick" data-id="${esc(m.id)}" aria-pressed="${!!(x.map && x.map.id === m.id)}"><b>${esc(m.name)}</b><small>${esc(`${gridTxt(m)} · ${dateTxt(m.updatedAt)}`)}</small></button>`).join("")}</div>`;
    return `${head}${rows}<div class="bar">${impBtn()}<button type="button" class="btn small" data-encmap="pick-no">${esc(t("common.cancel"))}</button></div>${errLine()}`;
  }
  if (!x.map) return `${head}<button type="button" class="btn tap encsave" data-encmap="open">${esc(t("init.map.choose"))}</button>`;
  const m = findMap(x.map.id);
  if (!m && ui.encMaps !== undefined) { // ontbreekt (verwijderd of van een ander apparaat), of opslag niet bereikbaar
    return `${head}<div class="confirmbox"><p style="margin:0"><b>${esc(mapName(x.map))}</b><br>${esc(t(ui.encMaps === null ? "init.map.off" : "init.map.gone"))}</p>
      <div class="bar"><button type="button" class="btn" data-encmap="open">${esc(t("init.map.pick"))}</button>${impBtn()}<button type="button" class="btn small ghost" data-encmap="rm">${esc(t("init.map.rm"))}</button></div>${errLine()}</div>`;
  }
  return `${head}<div class="erow emap"><span class="en"><b>${esc(mapName(x.map))}</b><small>${m ? esc(gridTxt(m)) : ""}</small></span></div>
    <div class="encmenu"><button type="button" class="btn small" data-encmap="open" id="ee-map-change">${esc(t("init.map.change"))}</button><button type="button" class="btn small ghost" data-encmap="rm">${esc(t("init.map.rm"))}</button></div>
    ${sightLink(x.map.id, "init.map.edit")}`;
}

/** Bestandskiezer buiten het paneel: een repaint (lijst klaar met laden) terwijl de kiezer open staat, vervangt hem zo niet;
 *  anders komt de change op een losgekoppeld element en gaat de import verloren. Eén keer aanmaken (bindEnc). */
export function mapFileInput(onFile) {
  const el = document.createElement("input");
  Object.assign(el, { id: "ee-map-file", type: "file", accept: ".json,application/json", hidden: true });
  el.addEventListener("change", () => { const f = el.files && el.files[0]; el.value = ""; if (f) onFile(f); });
  document.body.appendChild(el);
}

/** Kaartbestand importeren in de Inn Sight-bibliotheek → { doc } of { code, mb? } (tekst via init.map.err.<code>) */
export async function importMap(file) {
  let s, ex, mm, mb;
  try {
    let f;
    [s, ex, mm, f] = await Promise.all([store(), import("../maps/ui/export.js"), import("../maps/model/map.js"), import("../maps/model/file.js")]);
    mb = Math.round(f.FILE_MAX / 1048576);
  } catch { return { code: "off" }; }
  if (!(await s.available())) return { code: "off" };
  let res;
  try { res = await ex.importFile(file); } catch { return { code: "read" }; }
  if (!res.ok) return { code: ERR[res.code] || "broken", mb };
  const list = (await s.listMaps()) || [];
  const doc = mm.importedDoc(res.map, list.map((m) => m.name), t("init.map.base"));
  // kaart en assets in één transactie (putImport, net als Inn Sight): gcAssets van een Inn Sight-tabblad dat net start,
  // ziet nooit assets zonder kaart; een bestaande asset (zelfde sha = zelfde bytes) blijft zoals hij is
  if (!(await s.putImport(doc, res.assets))) return { code: "store" };
  return { doc };
}
/** Inn Sight-foutcodes → de kleinere set van Initiative (eigen catalogus; details staan in Inn Sight zelf) */
const ERR = { empty: "read", read: "read", notjson: "format", format: "format", newer: "newer", big: "big", store: "store" };

/* ---------- WP70: kaart bekijken (DM, alleen kijken) ---------- */
// Tekenen, pannen en zoomen met de modules van Inn Sight zelf (renderer met kaartbuffer, view, invoer), dynamisch geladen
// zoals de rest van deze brug: Initiative laadt pas kaartcode als de DM een kaart opent. Alleen lezen: nooit putMap,
// geen Inn Sight-tabbladslot (claimTab), dus een open Inn Sight-tabblad merkt hier niets van.
let vmods = null;
const viewMods = () => (vmods ||= Promise.all([store(), import("../maps/render/canvas.js"), import("../maps/render/art.js"),
  import("../maps/model/view.js"), import("../maps/model/grid.js"), import("../maps/ui/input.js"), import("../maps/ui/upload.js")])
  .then(([s, canvas, art, view, grid, input, upload]) => ({ s, canvas, art, view, grid, input, upload })))
  .catch((e) => { vmods = null; throw e; });

/**
 * Kaart met deze id op canvas cv tonen. on(state, map) bij elke toestandswissel: "loading" | "ok" | "gone" (kaart weg) |
 * "off" (opslag of kaartcode niet bereikbaar). v0 = onthouden view (UX: per kaart, alleen in ui) of null = passend.
 * Geeft { fit, zoom(f), size(), view(), close() }; size() na een maatwissel (midden en zoom blijven, daarna begrensd).
 * onZoom(min, max): zoomgrenzen bereikt (knoppen − en + uit).
 */
export function mapViewer(cv, id, { v0 = null, on = () => {}, onZoom = () => {} } = {}) {
  let M = null, map = null, img = null, art = null, layer = null, view = v0 ? { ...v0 } : null, w = 0, h = 0, dpr = 1, col = null;
  let queued = false, dead = false, settleT = 0, lim = "";
  const paint = () => {
    queued = false;
    if (dead || !map || !view || w < 2 || h < 2) return;
    M.canvas.fitCanvas(cv, w, h, dpr);
    const r = layer.paint(cv, map, view, w, h, dpr, col, { img, art }, [art.ver()]);
    if (r.settle) { clearTimeout(settleT); settleT = setTimeout(later, r.settle); }
    const lo = view.z <= M.view.ZMIN, hi = view.z >= M.view.ZMAX;
    if (lim !== `${lo}${hi}`) { lim = `${lo}${hi}`; onZoom(lo, hi); }
  };
  const later = () => { if (!queued && !dead) { queued = true; requestAnimationFrame(paint); } };
  const set = (v) => { if (dead || !map || !v) return; view = M.view.clampPan(v, M.grid.bounds(map.grid), w, h); later(); };
  const fit = () => { if (map && w > 1) set(M.view.fitView(M.grid.bounds(map.grid), w, h)); };
  const size = () => {
    const r = cv.getBoundingClientRect(), W = Math.max(1, r.width), H = Math.max(1, r.height);
    dpr = window.devicePixelRatio || 1;
    if (!map || W < 2 || H < 2) { w = W; h = H; return; }
    col = M.canvas.readColors(); // themawissel komt mee bij openen of een maatwissel
    const was = w; if (view && was > 1) view = { x: view.x + (W - w) / 2, y: view.y + (H - h) / 2, z: view.z }; // midden houden
    w = W; h = H;
    if (!view) fit(); else set(view);
  };
  (async () => {
    on("loading");
    try { M = await viewMods(); } catch { if (!dead) on("off"); return; }
    if (dead) return;
    if (!(await M.s.available())) { if (!dead) on("off"); return; }
    const doc = await M.s.getMap(id);
    if (dead) return;
    if (!doc) { on("gone"); return; }
    map = doc; layer = M.canvas.createLayer();
    const rec = async (sha) => { const r = await M.s.getAsset(sha); return r ? M.upload.assetImage(r) : null; };
    art = M.art.createArt(later, { custom: rec });
    M.input.attachInput(cv, { get: () => view || { x: 0, y: 0, z: 1 }, set }); // één vinger/muis = pannen, knijpen en wiel = zoomen (Inn Sight)
    on("ok", map);
    w = 0; size();
    if (map.bg && map.bg.asset) { const d = await rec(map.bg.asset).catch(() => null); if (dead) { if (d && d.close) d.close(); return; } img = d; later(); } // ontbreekt: raster zonder achtergrond
  })();
  return {
    fit, size,
    zoom(f) { if (map && view) set(M.view.zoomAt(view, f, w / 2, h / 2)); },
    view: () => (view ? { ...view } : null),
    /** Kleuren opnieuw lezen (themawissel terwijl de kaart open is) */
    theme() { if (!dead && M && map) { col = M.canvas.readColors(); later(); } },
    // attachInput hangt ook blur/visibilitychange aan window/document en kent geen loskoppelen: die houden deze closure
    // vast. Daarom hier alles groots loslaten (kaart, tekeningen, buffer, modules); er blijft per opening een kleine closure.
    close() {
      dead = true; clearTimeout(settleT);
      if (layer) layer.clear(); if (img && img.close) img.close(); if (art) art.trim(new Set());
      cv.width = cv.height = 0;
      M = map = img = art = layer = view = col = null;
    },
  };
}

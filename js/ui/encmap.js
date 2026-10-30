// WP69 (G4 fase 3): kaart uit Inn Sight kiezen bij een encounter (blok "Kaart" in Bewerken, js/ui/encounters.js).
// De encounter bewaart alleen een verwijzing { id, name } (js/rules/encounters.js, cleanMapRef); de kaart zelf blijft in
// de Inn Sight-bibliotheek (IndexedDB "kevs-inn-maps") en wordt daar bewerkt. Dit is het enige Initiative-bestand dat
// js/maps/ gebruikt, en alleen via dynamische import (tests/maps-boundary.test.js): Initiative laadt geen kaartcode bij
// het opstarten, en ontbreekt die offline (Maps-cache is best effort), dan zijn kaarten "niet bereikbaar" in plaats van
// dat Initiative breekt. Lezen gaat door store.listMaps (cleanMap); importeren door Inn Sights eigen controles
// (importFile) en komt in de Inn Sight-bibliotheek (Michiel, WP69), met een nieuwe id en unieke naam (importedDoc).
import { ROOM_MAP_MAX } from "../share.js";
import { t, i18n } from "../i18n/boot.js";
import { normLang, DEFAULT, pathFor } from "../i18n/lang.js";
import { esc } from "./util.js";
import { ui } from "./render.js";
import { decoSig as decoSigOf } from "../rules/maptoks.js";

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
  import("../maps/model/view.js"), import("../maps/model/grid.js"), import("../maps/ui/input.js"), import("../maps/ui/upload.js"), import("../maps/model/assets.js"),
  import("../maps/model/fog.js"), import("../maps/model/tokens.js")])
  .then(([s, canvas, art, view, grid, input, upload, assets, fog, tok]) => ({ s, canvas, art, view, grid, input, upload, assets, fog, tok })))
  .catch((e) => { vmods = null; throw e; });

/**
 * Kaart met deze id op canvas cv tonen. on(state, map) bij elke toestandswissel: "loading" | "ok" | "gone" (kaart weg) |
 * "off" (opslag of kaartcode niet bereikbaar). v0 = onthouden view (UX: per kaart, alleen in ui) of null = passend.
 * Geeft { fit, zoom(f), size(), view(), close(), fog(mode) }; size() na een maatwissel (midden en zoom blijven,
 * daarna begrensd). onZoom(min, max): zoomgrenzen bereikt (knoppen − en + uit).
 * WP73: fog(mode) met mode = { reveal, tool } zet de fogmodus aan (één vinger onthult of verbergt, fogStroke uit Inn
 * Sight), null = kijken. Na elke veeg alleen de fog naar de kaart in Inn Sight schrijven (putFog: de rest van de kaart blijft
 * zoals hij in de opslag staat); onFog(doc) met de opgeslagen kaart, of onFog(null) als schrijven mislukte (dan staat de
 * fog op het scherm terug zoals in de opslag).
 * WP74 (UX): tokens. Buiten de fogmodus sleept één vinger op een token dat token (pas na SLOP, snap altijd aan, het
 * dichtstbijzijnde middelpunt binnen 44 px telt); elders pant hij. Tijdens het slepen staat het token niet in de buffer
 * (lift) maar groter met schaduw boven de kaart, met een gestippelde ring op de oude plek en de doelcellen omlijnd. Bij
 * loslaten alleen de tokens naar de kaart (putToks). Een tik op een token selecteert het (ring): onTok(info) met
 * { id, l, c, fill, ink, known, hide, fog } (fog = middelpunt onder fog), onTok(null) = niets geselecteerd; hide(id) zet "verborgen voor
 * spelers" om. onToks(doc) na elke bewaarde tokenwijziging, onToks(null) als schrijven mislukte.
 * WP75: deco(list) legt de toestand van de deelnemers over gekoppelde tokens (decoDm: beurt-ring, kruis, verborgen) alleen
 * voor het tekenen; redeco() na elke render van Initiative. tapLinked(p) bij een tik op een gekoppeld token: true = de
 * viewer opende de deelnemer (geen selectie). place(entries) zet nieuwe gekoppelde tokens langs de bovenrand van het
 * zichtbare deel; remove(tid) haalt een token weg (wees-token).
 */
export function mapViewer(cv, id, { v0 = null, on = () => {}, onZoom = () => {}, onFog = () => {}, onTok = () => {}, onToks = () => {}, deco = (l) => l, tapLinked = () => false } = {}) {
  let M = null, map = null, img = null, art = null, layer = null, view = v0 ? { ...v0 } : null, w = 0, h = 0, dpr = 1, col = null;
  let queued = false, dead = false, settleT = 0, lim = "", fogMode = null, frame = null, writing = Promise.resolve();
  let lift = null, selT = null, tframe = null; // WP74: versleept token { t, from }, geselecteerd token-id, doelcellen
  let dsrc = null, dgen = 0, dfor = -1, dtoks = null, dsig = ""; // WP75: gedecoreerde tokens (alleen opnieuw bij nieuwe tokens of een render van Initiative)
  const shown = () => {
    if (map.toks !== dsrc || dgen !== dfor) {
      const L = M.tok.tokList(map.toks), D = deco(L), sig = D === L ? "" : decoSigOf(D);
      // review: zelfde tokens en zelfde decoratie (HP getypt, notitie) = zelfde object, dus de kaartbuffer blijft geldig
      if (map.toks !== dsrc || sig !== dsig) dtoks = D === L ? map.toks : { at: (map.toks && map.toks.at) || 0, list: D };
      dsrc = map.toks; dfor = dgen; dsig = sig;
    }
    return dtoks === map.toks ? map : { ...map, toks: dtoks }; // dezelfde lijst zolang niets verandert: de kaartbuffer blijft geldig
  };
  const paint = () => {
    queued = false;
    if (dead || !map || !view || w < 2 || h < 2) return;
    M.canvas.fitCanvas(cv, w, h, dpr);
    const ts = selT && !lift ? M.tok.tokList(map.toks).find((x) => x.id === selT) || null : null;
    const r = layer.paint(cv, shown(), view, w, h, dpr, col, { img, art, brush: frame ? [frame] : tframe ? [tframe] : null, lift: lift ? lift.from.id : null, tlift: lift, tsel: ts }, [art.ver()]);
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
    // één vinger/muis = pannen, knijpen en wiel = zoomen (Inn Sight); WP73: in de fogmodus pakt één vinger de fog op
    M.input.attachInput(cv, { get: () => view || { x: 0, y: 0, z: 1 }, set, grab: (x, y) => (dead ? null : fogMode ? fogGrab(x, y) : tokGrab(x, y)),
      tap: (x, y) => tokTap(x, y), tapping: () => !dead && !fogMode && !!map && M.tok.hasToks(map.toks) }); // WP74: tik op een token selecteert
    on("ok", map);
    // WP74 (review): terug naar dit tabblad (Inn Sight bewerkte de kaart): nieuwere tokens en fog overnemen
    document.addEventListener("visibilitychange", async () => {
      if (dead || document.visibilityState !== "visible" || lift) return;
      const d = await M.s.getMap(id).catch(() => null);
      if (dead || !d || lift) return;
      let ch = false;
      if (d.toks && (d.toks.at || 0) > ((map.toks && map.toks.at) || 0)) { map.toks = d.toks; ch = true; }
      if (d.fog && (d.fog.at || 0) > ((map.fog && map.fog.at) || 0)) { map.fog = d.fog; ch = true; }
      if (ch) { later(); tell(); on("ok", map); }
    });
    w = 0; size();
    if (map.bg && map.bg.asset) { const d = await rec(map.bg.asset).catch(() => null); if (dead) { if (d && d.close) d.close(); return; } img = d; later(); } // ontbreekt: raster zonder achtergrond
  })();
  // WP73: één veeg. Tekenen per beweging, schrijven bij loslaten (achter elkaar, nooit twee tegelijk); een tweede vinger
  // zet terug (knijpen zoomt). Het kader van Rechthoek gaat als brush mee naar drawOver.
  // Ook na sluiten (dead) wordt een veeg in de wachtrij nog bewaard en gemeld (een gedeelde kaart krijgt zo zijn nieuwe
  // beeld); alleen het tekenen valt dan weg. s = de store vastgelegd bij de veeg (close() laat M los).
  const save = (f) => {
    const s = M.s;
    writing = writing.then(async () => {
      const doc = await s.putFog(id, f).catch(() => null);
      if (doc) { if (!dead && map.fog === f) { map.fog = doc.fog; later(); } onFog(doc); return; } // intussen een nieuwe veeg: die blijft staan (wordt hierna bewaard)
      const now = await s.getMap(id).catch(() => null);
      if (!now) { if (!dead) on("gone"); return; } // kaart weg (of van een nieuwere versie): viewer zegt "ontbreekt", fogmodus uit
      if (!dead && map.fog === f) { map.fog = now.fog; later(); } // mislukt: terug naar wat er echt bewaard is
      onFog(null);
    }).catch(() => {});
  };
  // WP74: tokens. Schrijven zoals de fog (achter elkaar, ook na sluiten); mislukt = terug naar wat er bewaard is.
  // fn(lijst) → nieuwe lijst of null wordt hier meteen op het scherm toegepast en bij het schrijven nog eens binnen de
  // transactie op de OPGESLAGEN lijst (putToks met een functie): een token dat Inn Sight intussen plaatste of
  // verwijderde, blijft zo (de viewer kende alleen de lijst van bij het openen).
  const stamp = (list, old) => ({ at: Math.max(Date.now(), ((old && old.at) || 0) + 1), list });
  function change(fn) {
    const l = fn(M.tok.tokList(map.toks));
    if (!l) return;
    map.toks = stamp(l, map.toks);
    later(); tell();
    saveToks((k) => { const n = fn(M.tok.tokList(k)); return n ? stamp(n, k) : null; }, map.toks);
  }
  const saveToks = (fn, k) => {
    const s = M.s;
    writing = writing.then(async () => {
      const doc = await s.putToks(id, fn).catch(() => null);
      if (doc) { if (!dead && map.toks === k) { map.toks = doc.toks; later(); tell(); } onToks(doc); return; }
      const now = await s.getMap(id).catch(() => null);
      if (!now) { if (!dead) on("gone"); return; }
      if (!dead && map.toks === k) { map.toks = now.toks; later(); tell(); }
      onToks(null);
    }).catch(() => {});
  };
  /** Geselecteerd token aan de viewer melden (of null als het weg is) */
  function tell() {
    if (dead) return;
    const x = selT && M.tok.tokList(map.toks).find((y) => y.id === selT);
    if (selT && !x) selT = null;
    if (!x) { onTok(null); return; }
    const c = M.grid.cellAt(map.grid, x.x, x.y);
    const k = M.tok.tokColor(x.c);
    onTok({ id: x.id, l: x.l, c: x.c, fill: k.fill, ink: k.ink, known: !!M.tok.TOK_COLORS[x.c], hide: !!x.hide, fog: M.fog.hidden(map.fog, c.c, c.r), ...(x.p ? { p: x.p } : {}) });
  }
  const tokAtPt = (sx, sy) => { const p = M.view.toMap(view, sx, sy); return M.tok.nearTok(M.tok.tokList(map.toks), p.x, p.y, 22 / (M.view.CELL * view.z)); };
  function tokTap(sx, sy) {
    if (!map || !view || fogMode) return;
    const x = tokAtPt(sx, sy), id2 = x ? x.id : null;
    if (x && x.p && tapLinked(x.p)) { if (selT) { selT = null; later(); tell(); } return; } // WP75 (Michiel): tik opent de deelnemer
    if (id2 === selT) return;
    selT = id2; later(); tell();
  }
  function tokGrab(sx, sy) {
    if (!map || !view || !M.tok.hasToks(map.toks)) return null;
    const t0 = tokAtPt(sx, sy);
    if (!t0) return null;
    const p0 = M.view.toMap(view, sx, sy), dx = p0.x - t0.x, dy = p0.y - t0.y;
    const cells = (x) => { // doelcellen: de footprint (vierkant) of de cel (hex) onder het middelpunt
      if (map.grid.type === "hex") { const c = M.grid.cellAt(map.grid, x.x, x.y); return M.grid.cellPoly(map.grid, c.c, c.r); }
      const s = Math.max(1, x.s) / 2, cx = x.s < 1 ? Math.floor(x.x) + 0.5 : x.x, cy = x.s < 1 ? Math.floor(x.y) + 0.5 : x.y;
      return [{ x: cx - s, y: cy - s }, { x: cx + s, y: cy - s }, { x: cx + s, y: cy + s }, { x: cx - s, y: cy + s }];
    };
    return {
      move(x, y) {
        if (dead) return;
        const q = M.view.toMap(view, x, y), n = M.tok.moveTok(map.grid, t0, q.x - dx, q.y - dy, true); // snap altijd aan (UX)
        lift = { t: n, from: t0 }; tframe = cells(n); later();
      },
      end() {
        if (dead) return;
        const l = lift; lift = null; tframe = null; later();
        if (!l || (l.t.x === t0.x && l.t.y === t0.y)) return;
        change((list) => (list.some((y) => y.id === t0.id) ? M.tok.tokFront(M.tok.mapTok(list, t0.id, (y) => ({ ...y, x: l.t.x, y: l.t.y })), t0.id) : null)); // versleept = bovenop; intussen weg = niets
      },
      cancel() { if (!dead && lift) { lift = null; tframe = null; later(); } },
    };
  }
  function fogGrab(x, y) {
    if (!map || !view || !M.fog.fogOn(map.fog)) return null;
    const p = (sx, sy) => M.view.toMap(view, sx, sy);
    const st = M.fog.fogStroke({ grid: map.grid, get: () => map.fog, set: (f) => { map.fog = f; later(); }, tool: fogMode.tool, reveal: fogMode.reveal, at: p(x, y) });
    const show = () => { frame = st.frame(); later(); };
    show();
    return {
      move(sx, sy) { if (!dead) { st.move(p(sx, sy)); show(); } }, // viewer dicht tijdens een veeg (Esc, syncMap): niets meer
      end() { if (dead) return; const ch = st.end(); frame = null; later(); if (ch) save(map.fog); },
      cancel() { if (dead) return; st.cancel(); frame = null; later(); },
    };
  }
  return {
    fit, size,
    fog(mode) { fogMode = mode || null; if (!fogMode && frame) { frame = null; later(); } if (fogMode && selT) { selT = null; later(); tell(); } }, // WP74: fogmodus = geen tokenselectie
    /** WP74: tokenselectie opheffen (Klaar, Esc) */
    unsel() { if (selT && !dead) { selT = null; later(); tell(); } },
    /** WP74: "verborgen voor spelers" van token tid omzetten en bewaren */
    hide(tid) {
      if (dead || !map) return;
      const x = M.tok.tokList(map.toks).find((y) => y.id === tid);
      if (!x) return;
      const hide = !x.hide; // doelwaarde (niet omzetten: de opgeslagen waarde kan intussen anders zijn)
      change((list) => (list.some((y) => y.id === tid) ? M.tok.mapTok(list, tid, (y) => { const n = { ...y, hide }; if (!hide) delete n.hide; return n; }) : null));
    },
    zoom(f) { if (map && view) set(M.view.zoomAt(view, f, w / 2, h / 2)); },
    /** WP75: Initiative renderde opnieuw (beurt, HP, verborgen): decoratie opnieuw */
    redeco() { if (!dead && map) { dgen++; later(); } },
    /** WP75: tokens van de kaart zelf (zonder decoratie), null zolang de kaart niet geladen is */
    toks: () => (!dead && map ? M.tok.tokList(map.toks) : null),
    /** WP75: nieuwe gekoppelde tokens (entries = [{ p, l, c, s }], spelers eerst) langs de bovenrand van het zichtbare deel.
     *  → aantal geplaatst (0 = niets: kaart niet geladen of maximum bereikt) */
    place(entries) {
      if (dead || !map || !view || !entries.length) return 0;
      const L = M.tok.tokList(map.toks), room = M.tok.TOK.max - L.length;
      const put = placeRow(M, map.grid, L, entries.slice(0, Math.max(0, room)), M.view.toMap(view, 0, 0), M.view.toMap(view, w, h));
      if (!put.length) return 0;
      change((list) => { const have = new Set(list.map((y) => y.p).filter(Boolean)), used = new Set(list.map((y) => y.id)); const add = [];
        for (const n of put) { if (have.has(n.p) || list.length + add.length >= M.tok.TOK.max) continue; const tid = M.tok.tokId(used); used.add(tid); add.push(M.tok.cleanTok({ ...n, id: tid })); }
        return add.length ? [...list, ...add] : null; });
      return put.length;
    },
    /** WP75: token weghalen (wees-token: gekoppeld, maar de deelnemer staat niet meer in de lijst) */
    remove(tid) { if (!dead && map) { if (selT === tid) selT = null; change((list) => (list.some((y) => y.id === tid) ? M.tok.removeTok(list, tid) : null)); } },
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

/**
 * WP75 (UX): plekken voor nieuwe gekoppelde tokens. Een rij langs de bovenrand van het zichtbare deel (a = linksboven,
 * b = rechtsonder in kaarteenheden), binnen de kaart, op de cellen; past het niet, dan de volgende rij. Spelers links,
 * monsters rechts met één lege cel ertussen. Cellen met al een token worden overgeslagen. → [{ p, l, c, s, x, y }]
 */
function placeRow(M, grid, have, entries, a, b) {
  const hex = grid.type === "hex", cl = (v, n) => Math.max(0, Math.min(n - 1, v));
  const A = M.grid.cellAt(grid, a.x + 0.5, a.y + 0.5), Z = M.grid.cellAt(grid, b.x - 0.5, b.y - 0.5);
  const c0 = cl(A.c, grid.cols), r0 = cl(A.r, grid.rows), cEnd = Math.max(c0, cl(Z.c, grid.cols));
  const near = (L, x, y, s) => L.some((t) => Math.hypot(t.x - x, t.y - y) < ((t.s + s) / 2) * 0.9);
  const out = [];
  let col = c0, row = r0, rowH = 1, side = entries.length ? entries[0].pc : false;
  for (const n of entries) {
    if (n.pc !== side) { side = n.pc; col += 1; } // één lege cel tussen spelers en monsters
    const wc = hex ? 1 : Math.max(1, n.s); // breedte in cellen
    for (let tries = 0; tries < 500; tries++) {
      if (col + wc - 1 > cEnd && col > c0) { col = c0; row += rowH; rowH = 1; } // volgende rij
      if (row + wc - 1 > grid.rows - 1) row = Math.max(0, grid.rows - wc); // onderaan de kaart: niet verder
      const m = M.grid.cellCenter(grid, col, row);
      const p = M.tok.tokAt(grid, n.s, hex ? m.x : m.x + (wc - 1) / 2, hex ? m.y : m.y + (wc - 1) / 2, true);
      col += wc;
      if (near(have, p.x, p.y, n.s) || near(out, p.x, p.y, n.s)) continue;
      out.push({ p: n.p, l: n.l, c: n.c, s: n.s, x: p.x, y: p.y });
      rowH = Math.max(rowH, wc);
      break;
    }
  }
  return out;
}

/* ---------- WP71: plat spelersbeeld ---------- */
// Eén JPEG van de hele kaart (achtergrond, terrein, objecten, raster en rand) voor het spelersscherm. Alleen drawBase,
// nooit drawOver (selectie, spookbeeld, cursor). WP73: fog ondoorzichtig ingebakken (drawBase fog "player"): verborgen
// cellen verlaten het DM-apparaat nooit, ook niet als masker. Vaste kleuren (kaartinhoud, niet het thema van de DM): het beeld verandert niet als de DM van thema wisselt.
export const FLAT_MAX = 2048; // langste zijde in pixels
const FLAT_PPC = [8, 64];     // pixels per cel (onder- en bovengrens)
const FLAT_COL = { page: "#fffbf3", map: "#fffbf3", line: "#8c7d6b", edge: "#241811", sel: "#7a5512" };
/** Pixels per cel voor kaartgrenzen b (in cellen): de langste zijde ≤ FLAT_MAX, binnen FLAT_PPC */
export const flatPpc = (b) => Math.max(FLAT_PPC[0], Math.min(FLAT_PPC[1], Math.floor(FLAT_MAX / Math.max(1, b.w, b.h))));
let flatN = 0;
/**
 * Kaart met deze id als plat beeld → { flat: { k, w, h, img: Blob }, at: updatedAt } of null (kaart weg, opslag of kaartcode niet bereikbaar,
 * canvas te groot). Wacht tot de tekeningen geladen zijn (hooguit ± 4 s; wat dan nog ontbreekt wordt een plaatshouder).
 * WP75: deco(list) = gekoppelde tokens zoals spelers ze zien (decoPv: alleen zichtbare deelnemers, "?" bij naam onbekend,
 * kruis, beurt-ring), aangeroepen vlak voor het tekenen (de stand van dat moment); toks = de tokens van de kaart zelf.
 */
export async function flatMap(id, deco = (l) => l) {
  let M;
  try { M = await viewMods(); if (!(await M.s.available())) return null; } catch { return null; }
  const map = await M.s.getMap(id).catch(() => null);
  if (!map) return null;
  const own = new Map(); // eigen assets vooraf ophalen: createArt krijgt ze dan direct
  const rec = async (sha) => { const r = await M.s.getAsset(sha).catch(() => null); return r ? M.upload.assetImage(r).catch(() => null) : null; };
  const shas = [...new Set((map.objs || []).map((o) => o.asset).filter((a) => /^[0-9a-f]{64}$/.test(a)))];
  await Promise.all(shas.map(async (s) => own.set(s, await rec(s))));
  const img = map.bg && map.bg.asset ? await rec(map.bg.asset) : null;
  const b = M.grid.bounds(map.grid), ppc = flatPpc(b);
  const W = Math.max(1, Math.ceil(b.w * ppc)), H = Math.max(1, Math.ceil(b.h * ppc));
  const v = { x: -b.x * ppc, y: -b.y * ppc, z: ppc / M.view.CELL };
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  let ping = null;
  const art = M.art.createArt(() => ping && ping(), { custom: (sha) => own.get(sha) || null });
  const raw = M.tok.tokList(map.toks);
  let pm = map;
  const draw = () => { const g = cv.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); M.canvas.drawBase(g, pm, v, W, H, 1, FLAT_COL, W, H, { img, art, fog: "player" }); };
  const builtins = [...new Set((map.objs || []).map((o) => o.asset).filter((a) => !own.has(a)))];
  draw(); // start het laden van alle tekeningen
  const until = Date.now() + 4000;
  while (Date.now() < until && !art.done(builtins.filter((a) => M.assets.builtin(a)))) await new Promise((r) => { ping = r; setTimeout(r, 250); });
  await new Promise((r) => setTimeout(r, 0)); // eigen assets: createArt zet ze een microtask later klaar
  ping = null;
  const D = deco(raw); // WP75: de stand van nu (na het wachten op de tekeningen)
  if (D !== raw) pm = { ...map, toks: { at: (map.toks && map.toks.at) || 0, list: D } };
  draw();
  const fit = await fitJpeg(cv), blob = fit && fit.b;
  if (img && img.close) img.close();
  for (const x of own.values()) if (x && x.close) x.close();
  art.trim(new Set());
  cv.width = cv.height = 0;
  if (!blob) return null;
  return { flat: { k: `m${Date.now().toString(36)}${++flatN}`, w: fit.w, h: fit.h, img: blob }, at: map.updatedAt || 0, toks: raw, sig: D === raw ? "" : decoSigOf(D) };
}
/** WP72: JPEG ≤ ROOM_MAP_MAX (past in de kamer): eerst lagere kwaliteit, dan kleiner (± 75 % per stap). Eén beeld voor
 *  alle spelersschermen; bijna elke kaart past al op 0,85. → { b: Blob, w, h } of null (mislukt). */
export async function fitJpeg(cv) {
  const jpg = (c, q) => new Promise((r) => { try { c.toBlob(r, "image/jpeg", q); } catch { r(null); } });
  let b = null;
  for (const q of FLAT_Q) { b = await jpg(cv, q); if (!b) return null; if (b.size <= ROOM_MAP_MAX) return { b, w: cv.width, h: cv.height }; }
  for (let i = 0, c = cv; i < 4; i++) {
    const s = document.createElement("canvas");
    s.width = Math.max(1, Math.round(c.width * 0.75)); s.height = Math.max(1, Math.round(c.height * 0.75));
    s.getContext("2d").drawImage(c, 0, 0, s.width, s.height);
    if (c !== cv) c.width = c.height = 0; // vorige verkleining loslaten (het origineel ruimt flatMap op)
    c = s;
    b = await jpg(c, FLAT_Q.at(-1));
    const w = c.width, h = c.height;
    if (!b || b.size <= ROOM_MAP_MAX || i === 3) { c.width = c.height = 0; return b && b.size <= ROOM_MAP_MAX ? { b, w, h } : null; }
  }
  return null;
}
const FLAT_Q = [0.85, 0.72, 0.6];
/** updatedAt van kaart id (0 = weg of niet bereikbaar): is het gedeelde beeld nog actueel? */
export async function mapStamp(id) {
  try { const M = await viewMods(); const m = (await M.s.available()) ? await M.s.getMap(id) : null; return (m && m.updatedAt) || 0; } catch { return 0; }
}

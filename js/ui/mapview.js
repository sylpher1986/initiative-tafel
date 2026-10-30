// WP70 (G4 fase 3): kaart bekijken in Initiative (DM, alleen kijken). Knop "Kaart" in de encounterstrip (encStrip,
// js/ui/encounters.js) opent een viewer vol scherm tot aan de dock: de dock blijft zichtbaar en bruikbaar (Volgende,
// N/spatie), dus de kaart mag open blijven tijdens beurtwissels. Geen .sheet-wrap (het is geen paneel; sneltoetsen
// blijven werken), Esc sluit. Eén element buiten de lijst, één keer gemaakt: een repaint van de lijst bouwt het canvas
// niet opnieuw op. Tekenen/pannen/zoomen via de brug (mapViewer in js/ui/encmap.js); geen invloed op S, undo of opslag.
// Pan/zoom per kaart onthouden in het geheugen van deze sessie (views), niet in S, backup of spelersscherm (UX WP70).
import { t } from "../i18n/boot.js";
import { esc, toastBad } from "./util.js";
import { ico } from "./icons.js";
import { mapViewer, flatMap, mapStamp } from "./encmap.js";
import { encMaps } from "../rules/fight.js";
import { render } from "./render.js";
import { roomMap } from "./kamer.js";

const STEP = 1.25; // zoomstap van + en − (zoals Inn Sight)
let el = null, cv = null, ctl = null, cur = null, from = null, list = [];
const views = new Map(); // kaart-id → laatste view (sessie)
const names = new Map(); // kaart-id → actuele naam uit Inn Sight (na laden; de verwijzing kan een oude naam hebben)

export const mapOpen = () => !!(el && !el.hidden);

/* ---------- WP71: kaart tonen aan spelers (spelersvenster op dit apparaat) ---------- */
// Eén gedeelde kaart tegelijk, bewust aangezet met de schakelaar in de viewer (UX: nooit automatisch, een kaart kan de
// dungeon verklappen). Alleen in het geheugen van deze sessie (niet in S, opslag of backup): herladen = niet meer gedeeld.
// Blijft gedeeld als de viewer dicht gaat; stopt als de kaart niet meer ingeladen is (syncMap). flat = plat beeld
// (flatMap) dat toPlayerView als map meegeeft; null zolang het rendert of als het mislukte.
let shared = null; // { id, flat: { k, w, h, img } | null, at: updatedAt van het gerenderde document }
let shareErr = false;
/** Plat beeld voor de snapshot (js/main.js → toPlayerView opts.map), of null */
export const sharedMap = () => (shared && shared.flat) || null;
/** Id van de gedeelde kaart (knop in de encounterstrip), of null */
export const sharedId = () => (shared ? shared.id : null);
async function flatten(s) {
  if (s.busy) return; // al bezig voor dit object: geen tweede render van 2048 px tegelijk
  s.busy = true;
  const r = await flatMap(s.id).catch(() => null);
  s.busy = false;
  if (shared !== s) return; // intussen gestopt of opnieuw aangezet (aan → uit → aan = nieuw object)
  if (r) { s.flat = r.flat; s.at = r.at; }
  else if (!s.flat) { shared = null; shareErr = true; if (!mapOpen()) toastBad(t("init.map.share.fail")); }
  // her-render mislukt: het oude beeld blijft staan (geen stil stoppen met de viewer dicht)
  paintShare(); render(); // render: knop in de strip en een nieuwe snapshot (afterRender)
}
function toggleShare() {
  shareErr = false;
  if (shared && shared.id === cur) shared = null;
  else if (cur) { shared = { id: cur, flat: null, at: 0, busy: false }; flatten(shared); }
  paintShare(); render();
}
/** Kaart in een ander tabblad (Inn Sight) bewerkt: bij terugkomen opnieuw renderen als hij veranderde */
async function recheck() {
  if (!shared || !shared.flat) return;
  const s = shared, at = await mapStamp(s.id).catch(() => 0);
  if (shared !== s) return;
  if (!at) { shared = null; paintShare(); render(); return; } // kaart weg uit Inn Sight: niet meer tonen
  if (at !== s.at) flatten(s);
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recheck(); });
document.addEventListener("it-kamer", () => { if (mapOpen()) paintShare(); });
function paintShare() {
  if (!el) return;
  const b = el.querySelector("[data-mv=pv]"), on = !!shared && shared.id === cur;
  b.classList.toggle("on", on); // wisselend label, dus geen aria-pressed (anders "Getoond aan spelers, ingedrukt")
  b.textContent = t(on ? "init.map.share.on" : "init.map.share.off");
  // WP72 (UX): de hint volgt de kamer; tijdens het versturen van de gedeelde kaart "Versturen naar kamer …" (geen melding)
  const r = roomMap();
  el.querySelector(".mvthint").textContent = shareErr ? t("init.map.share.fail")
    : !r ? t("init.map.share.hint") : t(on && r.busy ? "init.map.share.sending" : "init.map.share.hintRoom", { code: r.code });
  el.querySelector(".mvthint").classList.toggle("err", shareErr);
}

function make() {
  el = document.createElement("div");
  el.id = "mapview"; el.className = "mapview"; el.hidden = true; el.tabIndex = -1; // focus op de viewer (niet op ✕): spatie blijft Volgende
  el.setAttribute("role", "dialog"); el.setAttribute("aria-labelledby", "mv-name");
  el.innerHTML = `<div class="mvhead"><button type="button" class="btn mvx" data-mv="close" aria-label="${esc(t("init.map.view.close"))}">${ico("x")}</button><h2 id="mv-name" class="mvname"></h2><button type="button" class="btn small mvfit" data-mv="fit"></button></div>
    <div class="mvchips" role="group" hidden></div>
    <div class="mvbody"><canvas class="mvcv" role="img"></canvas><div class="mvmsg" role="status"></div>
    <div class="mvtoon"><button type="button" class="btn mvtn" data-mv="pv" aria-describedby="mv-thint"></button><small class="mvthint" id="mv-thint"></small></div>
    <div class="mvzoom"><button type="button" class="btn mvz" data-mv="in" aria-label="${esc(t("init.map.view.in"))}">${ico("plus")}</button><button type="button" class="btn mvz" data-mv="out" aria-label="${esc(t("init.map.view.out"))}"><span aria-hidden="true">−</span></button></div></div>`;
  cv = el.querySelector("canvas");
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mv]"); if (!b) return;
    const k = b.dataset.mv;
    if (k === "close") close();
    else if (k === "fit") ctl?.fit();
    else if (k === "in") ctl?.zoom(STEP);
    else if (k === "out") ctl?.zoom(1 / STEP);
    else if (k === "pick") show(b.dataset.id);
    else if (k === "pv") toggleShare();
  });
  document.body.append(el);
  addEventListener("resize", () => { if (mapOpen()) ctl?.size(); });
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (mapOpen()) ctl?.theme(); }); } catch { /* Safari < 14: bij opnieuw openen */ }
  if (window.ResizeObserver) new ResizeObserver(() => { if (mapOpen()) ctl?.size(); }).observe(el.querySelector(".mvbody"));
}

/** Teksten en knoppen, bij elke opening (een taalwissel herlaadt de pagina) */
function labels() {
  const q = (s) => el.querySelector(s);
  q("[data-mv=close]").setAttribute("aria-label", t("init.map.view.close"));
  q("[data-mv=fit]").textContent = t("init.map.view.fit");
  q("[data-mv=in]").setAttribute("aria-label", t("init.map.view.in"));
  q("[data-mv=out]").setAttribute("aria-label", t("init.map.view.out"));
  q(".mvchips").setAttribute("aria-label", t("init.map.view.pick"));
}

function chips() {
  const c = el.querySelector(".mvchips"), bs = [...c.querySelectorAll("[data-id]")];
  c.hidden = list.length < 2;
  if (bs.length === list.length && bs.every((b, i) => b.dataset.id === list[i].map.id)) { // zelfde kaarten: alleen bijwerken (focus blijft)
    bs.forEach((b, i) => { const m = list[i]; b.setAttribute("aria-pressed", String(m.map.id === cur)); b.textContent = names.get(m.map.id) || m.map.name || m.name; });
    return;
  }
  c.innerHTML = list.length < 2 ? "" : list.map((m) => `<button type="button" class="btn small mvchip" data-mv="pick" data-id="${esc(m.map.id)}" aria-pressed="${m.map.id === cur}">${esc(names.get(m.map.id) || m.map.name || m.name)}</button>`).join("");
}

function msg(state, ref) {
  const p = el.querySelector(".mvmsg"), name = ref.name || t("init.map.title");
  p.hidden = state === "ok";
  el.querySelector(".mvzoom").hidden = state !== "ok";
  el.querySelector(".mvtoon").hidden = state !== "ok";
  el.querySelector("[data-mv=fit]").disabled = state !== "ok";
  cv.hidden = state !== "ok";
  p.innerHTML = state === "loading" ? `<p>${esc(t("init.map.view.loading"))}</p>`
    : state === "off" ? `<p>${esc(t("init.map.off"))}</p>`
    : state === "gone" ? `<p><b>${esc(t("init.map.view.gone", { name }))}</b></p><p>${esc(t("init.map.view.app"))}</p><p>${esc(t("init.map.view.where"))}</p>` : "";
}

/** Kaart met deze id tonen (wissel tussen kaarten: de view van de vorige onthouden) */
function show(id) {
  const ref = list.find((m) => m.map.id === id);
  if (!ref) return;
  stop();
  cur = id;
  // vers canvas per kaart: attachInput hangt zijn listeners aan het canvas en kent geen loskoppelen; het oude canvas
  // gaat met zijn listeners weg (geen dubbele pan/zoom na vaker openen of wisselen)
  const c = document.createElement("canvas");
  c.className = "mvcv"; c.setAttribute("role", "img"); c.hidden = true;
  cv.replaceWith(c); cv = c;
  const name = ref.map.name || ref.name;
  el.querySelector("#mv-name").textContent = name;
  cv.setAttribute("aria-label", t("init.map.view.canvas", { name }));
  chips();
  shareErr = false; paintShare();
  ctl = mapViewer(cv, id, {
    v0: views.get(id) || null,
    on: (state, doc) => { if (cur !== id) return; if (doc && shared && shared.id === id && shared.flat && doc.updatedAt && doc.updatedAt !== shared.at) flatten(shared); if (doc && doc.name) { names.set(id, doc.name); el.querySelector("#mv-name").textContent = doc.name; cv.setAttribute("aria-label", t("init.map.view.canvas", { name: doc.name })); chips(); } msg(state, ref.map); },
    onZoom: (lo, hi) => { el.querySelector("[data-mv=out]").disabled = lo; el.querySelector("[data-mv=in]").disabled = hi; },
  });
}

function stop() {
  if (!ctl) return;
  const v = ctl.view(); if (v && cur) views.set(cur, v);
  ctl.close(); ctl = null;
}

/** Openen vanuit de knop in de encounterstrip (b = die knop: focus terug na sluiten) */
export function openMap(S, b) {
  list = encMaps(S);
  if (!list.length) return;
  if (!el) make();
  labels();
  from = b || null;
  el.hidden = false;
  show(list.some((m) => m.map.id === cur) ? cur : list[0].map.id);
  el.focus({ preventScroll: true });
}

export function close() {
  if (!mapOpen()) return;
  stop();
  el.hidden = true;
  const f = from && from.isConnected ? from : document.querySelector("[data-enc=map]") || document.querySelector("#next, #start"); // knop weg (kaart niet meer ingeladen): naar de dock
  from = null;
  f?.focus({ preventScroll: true });
}

/** Na elke render: kaart weg uit de ingeladen encounters (undo, monsters gewist, andere encounter) = viewer dicht;
 *  onthouden views van kaarten die niet meer ingeladen zijn vergeten. Andere kaarten: chips bijwerken. */
export function syncMap(S) {
  const now = encMaps(S), ids = new Set(now.map((m) => m.map.id));
  // WP71: niet meer ingeladen = niet meer gedeeld; de snapshot van deze render (afterRender) heeft de kaart al niet meer
  if (shared && !ids.has(shared.id)) { shared = null; if (mapOpen()) paintShare(); }
  if (mapOpen()) {
    if (!ids.has(cur)) close(); // eerst sluiten (bewaart de view), daarna hieronder vergeten
    else if (now.length !== list.length || now.some((m, i) => m.map.id !== list[i].map.id)) { list = now; chips(); }
  }
  for (const m of [views, names]) for (const id of [...m.keys()]) if (!ids.has(id)) m.delete(id);
}

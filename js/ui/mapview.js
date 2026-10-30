// WP70 (G4 fase 3): kaart bekijken in Initiative (DM, alleen kijken). Knop "Kaart" in de encounterstrip (encStrip,
// js/ui/encounters.js) opent een viewer vol scherm tot aan de dock: de dock blijft zichtbaar en bruikbaar (Volgende,
// N/spatie), dus de kaart mag open blijven tijdens beurtwissels. Geen .sheet-wrap (het is geen paneel; sneltoetsen
// blijven werken), Esc sluit. Eén element buiten de lijst, één keer gemaakt: een repaint van de lijst bouwt het canvas
// niet opnieuw op. Tekenen/pannen/zoomen via de brug (mapViewer in js/ui/encmap.js); geen invloed op S, undo of opslag.
// Pan/zoom per kaart onthouden in het geheugen van deze sessie (views), niet in S, backup of spelersscherm (UX WP70).
import { t } from "../i18n/boot.js";
import { esc } from "./util.js";
import { ico } from "./icons.js";
import { mapViewer } from "./encmap.js";
import { encMaps } from "../rules/fight.js";

const STEP = 1.25; // zoomstap van + en − (zoals Inn Sight)
let el = null, cv = null, ctl = null, cur = null, from = null, list = [];
const views = new Map(); // kaart-id → laatste view (sessie)
const names = new Map(); // kaart-id → actuele naam uit Inn Sight (na laden; de verwijzing kan een oude naam hebben)

export const mapOpen = () => !!(el && !el.hidden);

function make() {
  el = document.createElement("div");
  el.id = "mapview"; el.className = "mapview"; el.hidden = true; el.tabIndex = -1; // focus op de viewer (niet op ✕): spatie blijft Volgende
  el.setAttribute("role", "dialog"); el.setAttribute("aria-labelledby", "mv-name");
  el.innerHTML = `<div class="mvhead"><button type="button" class="btn mvx" data-mv="close" aria-label="${esc(t("init.map.view.close"))}">${ico("x")}</button><h2 id="mv-name" class="mvname"></h2><button type="button" class="btn small mvfit" data-mv="fit"></button></div>
    <div class="mvchips" role="group" hidden></div>
    <div class="mvbody"><canvas class="mvcv" role="img"></canvas><div class="mvmsg" role="status"></div>
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
  ctl = mapViewer(cv, id, {
    v0: views.get(id) || null,
    on: (state, doc) => { if (cur !== id) return; if (doc && doc.name) { names.set(id, doc.name); el.querySelector("#mv-name").textContent = doc.name; cv.setAttribute("aria-label", t("init.map.view.canvas", { name: doc.name })); chips(); } msg(state, ref.map); },
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
  if (mapOpen()) {
    if (!ids.has(cur)) close(); // eerst sluiten (bewaart de view), daarna hieronder vergeten
    else if (now.length !== list.length || now.some((m, i) => m.map.id !== list[i].map.id)) { list = now; chips(); }
  }
  for (const m of [views, names]) for (const id of [...m.keys()]) if (!ids.has(id)) m.delete(id);
}

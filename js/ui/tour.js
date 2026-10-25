// OB1/OB2: rondleiding (spotlight + uitlegvak). Twee delen: "p" na de welkomstkaart (Voorbereiden), "f" bij de eerste
// keer Gevecht in dezelfde sessie. Nooit bij het opstarten, nooit over een open paneel heen (dan even verborgen).
// UX-agent koos twee delen boven één doorlopende tour (stops naar een beurtbalk die er nog niet is) en losse hints
// (die duiken op tijdens het spel). Logica en stops puur in js/tour.js; hier alleen DOM.
import { STOPS, seen, withSeen, silenceFor, placeTip, unionRect } from "../tour.js";
import { t as T } from "../i18n/boot.js"; // als T: in dit bestand is `t` de toestand van de tour

const KEY = "it-tour";
let armed = null;  // deel dat wacht op het juiste moment (alleen in het geheugen)
let t = null;      // lopende tour: { part, stops, i, root, spot, box, inert }
let modeNow = () => "prep";

const raw = () => { try { return localStorage.getItem(KEY); } catch { return undefined; } };
const markSeen = (part) => { try { localStorage.setItem(KEY, withSeen(raw(), part)); } catch { /* privémodus */ } };

/** Bij het opstarten: wie al data heeft, krijgt de rondleiding niet vanzelf (wel via Instellingen) */
export function initTour(getMode, hasData) {
  modeNow = getMode;
  const v = silenceFor(raw(), hasData);
  if (v != null) try { localStorage.setItem(KEY, v); } catch { /* privémodus */ }
}
/** Na "Start met voorbeeld"/"Begin leeg" (deel p) of na Start gevecht (deel f); toont pas bij de volgende render */
export function armTour(part) {
  const r = raw();
  if (r === undefined || seen(r).has(part)) return; // geen opslag: niet tonen (anders elke keer opnieuw)
  armed = part;
}
/** OB2: opnieuw bekijken; het deel dat bij de huidige modus hoort */
export function restartTour() { if (!t) armed = modeNow() === "fight" ? "f" : "p"; }
export const tourActive = () => !!t && !t.root.hidden;

const visible = (el) => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const targets = (stop) => stop.sel.map((s) => document.querySelector(s)).filter(visible);
const panelOpen = () => !!document.querySelector(".sheet-wrap:not([hidden])");
const partFits = (part) => (part === "f" ? modeNow() === "fight" : modeNow() === "prep" && !document.body.dataset.run);

/** Na elke render: tour starten als hij klaarstaat, verbergen bij een open paneel, stoppen als de modus wisselt */
export function tourTick() {
  if (t) {
    if (!partFits(t.part)) { end(true); return; }
    if (panelOpen()) { hide(true); return; }
    hide(false); show(false);
    return;
  }
  if (!armed || panelOpen() || !partFits(armed)) return;
  const part = armed; armed = null;
  begin(part);
}

function begin(part) {
  const stops = STOPS[part].filter((s) => targets(s).length);
  if (!stops.length) { markSeen(part); return; }
  const root = document.createElement("div");
  root.id = "tour"; root.className = "tour";
  root.innerHTML = `<div class="tspot" aria-hidden="true"></div>
    <div class="tbox" role="dialog" aria-modal="true" aria-labelledby="tour-t" aria-describedby="tour-x">
      <p class="thead"><b id="tour-t"></b><span class="tprog" id="tour-p"></span></p>
      <p id="tour-x" aria-live="polite"></p>
      <div class="tbtns"><button type="button" class="link" data-tour="skip"></button>
        <button type="button" class="btn" data-tour="back"></button><button type="button" class="btn primary" data-tour="next"></button></div>
    </div>`;
  root.addEventListener("click", (e) => {
    e.stopPropagation(); // niets doorgeven aan de app eronder (tik op de dim doet bewust niets)
    const a = e.target.closest("[data-tour]")?.dataset.tour;
    if (!e.target.closest(".tbox")) { t.box.querySelector('[data-tour="next"]').focus({ preventScroll: true }); return; } // focus niet kwijt
    if (a === "skip") end(true);
    else if (a === "back") go(t.i - 1, -1);
    else if (a === "next") go(t.i + 1, 1);
  });
  document.body.append(root);
  // de app eronder is niet te bedienen (ook niet met het toetsenbord of een screenreader)
  const inert = [...document.body.children].filter((el) => el !== root && !el.inert && !el.matches("script, .tabstop"));
  inert.forEach((el) => (el.inert = true));
  t = { part, stops, i: 0, root, spot: root.querySelector(".tspot"), box: root.querySelector(".tbox"), inert, sc: null };
  t.sc = () => { if (t && !t.root.hidden) requestAnimationFrame(() => t && place()); };
  addEventListener("scroll", t.sc, { passive: true, capture: true });
  addEventListener("resize", t.sc);
  window.visualViewport?.addEventListener("resize", t.sc);
  show(true);
}

/** Naar stop i; een stop waarvan het doel intussen weg is wordt overgeslagen (in de looprichting) */
function go(i, dir) {
  while (i >= 0 && i < t.stops.length && !targets(t.stops[i]).length) i += dir;
  if (i >= t.stops.length) { end(true); return; }
  if (i < 0) return;
  t.i = i; show(true);
}

function show(fresh) {
  const stop = t.stops[t.i], els = targets(stop);
  if (!els.length) { go(t.i + 1, 1); return; }
  const n = t.stops.length, last = t.i === n - 1;
  t.box.querySelector("#tour-t").textContent = T(stop.t);
  t.box.querySelector("#tour-p").textContent = `${t.i + 1}/${n}`;
  t.box.querySelector("#tour-x").textContent = T(stop.x);
  t.box.querySelector('[data-tour="skip"]').textContent = T("init.tour.skip");
  t.box.querySelector('[data-tour="back"]').textContent = T("init.tour.back");
  t.box.querySelector('[data-tour="back"]').hidden = t.i === 0;
  t.box.querySelector('[data-tour="next"]').textContent = T(last ? "init.tour.done" : "init.tour.next");
  if (fresh) {
    // vaste balken (beurtbalk, kop) staan al in beeld; de rest naar het midden scrollen
    // AF10: direct, niet smooth: anders schuift het vak mee en is Volgende pas na de animatie te raken
    if (!els[0].closest("#dock")) els[0].scrollIntoView({ block: "center", behavior: "auto" });
    t.box.classList.remove("fade"); void t.box.offsetWidth; t.box.classList.add("fade");
    t.box.querySelector('[data-tour="next"]').focus({ preventScroll: true });
  }
  place();
}

function place() {
  const els = targets(t.stops[t.i]);
  if (!els.length) return;
  const r = unionRect(els.map((el) => el.getBoundingClientRect()));
  Object.assign(t.spot.style, { top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px" });
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const p = placeTip(r, vw, vh, t.box.offsetWidth, t.box.offsetHeight);
  Object.assign(t.box.style, { left: p.x + "px", top: p.y + "px" });
}

function hide(on) {
  if (!t || t.root.hidden === on) return;
  t.root.hidden = on;
  t.inert.forEach((el) => (el.inert = !on));
}

/** Klaar, Overslaan, Escape of moduswissel: dit deel geldt als gezien; focus naar de volgende logische knop */
function end(done) {
  if (!t) return;
  const part = t.part;
  if (done) markSeen(part);
  removeEventListener("scroll", t.sc, { capture: true });
  removeEventListener("resize", t.sc);
  window.visualViewport?.removeEventListener("resize", t.sc);
  t.inert.forEach((el) => (el.inert = false));
  t.root.remove();
  t = null; armed = null;
  if (done) document.querySelector(part === "f" ? "#next" : "#start:not([disabled])")?.focus({ preventScroll: true });
}
/** DA3: tabblad overgenomen; de tour weg zonder iets op te slaan (het stopscherm zet daarna zelf alles inert) */
export function killTour() { end(false); }

/** Toetsen tijdens de tour: Escape = Overslaan, Tab blijft in het vak; de rest gaat niet naar de app. Geeft true als de tour ze afhandelt. */
export function tourKey(e) {
  if (!tourActive()) return false;
  if (e.key === "Escape") { e.preventDefault(); end(true); return true; }
  if (e.key === "Tab") {
    const bs = [...t.box.querySelectorAll("button")].filter((b) => !b.hidden);
    const i = bs.indexOf(document.activeElement), n = bs.length;
    e.preventDefault();
    bs[(i + (e.shiftKey ? -1 : 1) + n) % n].focus();
  }
  return true;
}

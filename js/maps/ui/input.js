// Inn the Grid (G4, WP56): invoer voor pannen en zoomen via Pointer Events (muis, pen, touch). WP56 kent alleen de
// modus Kijken: één vinger of de muis = pannen, knijpen = zoomen, wiel (en trackpad-knijpen) = zoomen rond de cursor.
// Later bepaalt de gereedschapsmodus wat één vinger doet; knijpen en twee vingers blijven altijd pannen/zoomen (§2.7).
// Geen pagina-scroll of iOS-paginazoom: touch-action:none op het canvas (css/maps.css) en gesture* geblokkeerd.
import { panBy, pinch, zoomAt, wheelFactor } from "../model/view.js";

/** Beweging (CSS-px) waaronder een aanraking een tik is en geen pan (WP61, Plaatsen) */
export const SLOP = 8;

/** Invoer aan het canvas hangen. get() = huidige view, set(v) = nieuwe view toepassen (begrenzen + tekenen).
 *  WP59: drag(dx, dy) (CSS-px) krijgt de beweging van één vinger/muis zolang dragging() waar is (uitlijnmodus: de
 *  afbeelding slepen); knijpen en wiel blijven zoomen/pannen. */
// WP61: tap(x, y) krijgt een tik (één vinger of de muis, minder dan SLOP bewogen, geen tweede vinger erbij) zolang
// tapping() waar is (Plaatsen); in die stand pant één vinger pas na SLOP px, zodat een tik de kaart niet verschuift.
// hover(x, y) volgt een muis zonder ingedrukte knop (spookbeeld op desktop), hover(null) bij verlaten.
// WP62: grab(x, y, kind) wordt bij het neerzetten van de eerste vinger/muis gevraagd of dit gebaar iets oppakt (object,
// draai- of schaalgreep). Geeft het { move(x, y), end() } terug, dan krijgt dat handvat de beweging (absolute CSS-px,
// pas voorbij SLOP: een tik verschuift niets) in plaats van pannen; end() bij loslaten, annuleren of een tweede vinger
// (knijpen zoomt dan zoals altijd). kind = pointerType ("mouse", "touch", "pen").
export function attachInput(cv, { get, set, drag = null, dragging = () => false, tap = null, tapping = () => false, hover = null, grab = null }) {
  const pts = new Map(); // pointerId → { x, y } (CSS-px binnen het canvas)
  let start = null, moved = false, multi = false, held = null; // huidig gebaar: beginpunt, voorbij SLOP, ooit twee vingers, opgepakt handvat
  const drop = () => { const h = held; held = null; if (h) h.end(); };
  const at = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  cv.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.isPrimary) { drop(); pts.clear(); start = at(e); moved = false; multi = false; } // nieuw gebaar: een gemiste pointerup laat geen spookvinger achter
    if (pts.size >= 2) return; // een derde vinger doet niets
    pts.set(e.pointerId, at(e));
    if (pts.size > 1) { multi = true; drop(); } // tweede vinger: niets meer slepen, knijpen zoomt
    else if (grab && !(drag && dragging())) { const p = at(e); held = grab(p.x, p.y, e.pointerType) || null; }
    try { cv.setPointerCapture(e.pointerId); } catch { /* oude browser */ }
    e.preventDefault();
  });
  cv.addEventListener("pointermove", (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev) { if (hover && e.pointerType === "mouse" && !e.buttons) { const p = at(e); hover(p.x, p.y); } return; }
    const now = at(e);
    if (pts.size === 1) {
      if (!moved && start && Math.hypot(now.x - start.x, now.y - start.y) >= SLOP) moved = true;
      if (!moved && !multi && (held || (tap && tapping()))) return; // binnen SLOP: nog een mogelijke tik, niet pannen (prev blijft het beginpunt)
      if (held) held.move(now.x, now.y);
      else if (drag && dragging()) drag(now.x - prev.x, now.y - prev.y); else set(panBy(get(), now.x - prev.x, now.y - prev.y));
    } else {
      const [other] = [...pts].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
      set(pinch(get(), prev, other, now, other));
    }
    pts.set(e.pointerId, now);
  });
  const end = (e) => { pts.delete(e.pointerId); };
  cv.addEventListener("pointerup", (e) => {
    const was = pts.has(e.pointerId), last = pts.size === 1;
    end(e);
    if (was && last) drop();
    if (was && last && !moved && !multi && tap && tapping()) { const p = at(e); tap(p.x, p.y); }
    if (hover && e.pointerType === "mouse") { const p = at(e); hover(p.x, p.y); }
  });
  if (hover) cv.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hover(null); });
  const cancel = (e) => { end(e); if (!pts.size) drop(); };
  cv.addEventListener("pointercancel", cancel);
  cv.addEventListener("lostpointercapture", cancel);
  window.addEventListener("blur", () => { pts.clear(); drop(); });
  document.addEventListener("visibilitychange", () => { pts.clear(); drop(); });

  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const p = at(e);
    // vooral zijwaarts (trackpad, kantelwiel): pannen; anders (wiel, trackpad-knijpen = ctrlKey) zoomen rond de cursor
    if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) set(panBy(get(), -e.deltaX, -e.deltaY));
    else set(zoomAt(get(), wheelFactor(e.deltaY, e.deltaMode), p.x, p.y));
  }, { passive: false });

  // iOS Safari: geen paginazoom tijdens knijpen op het canvas (kop en dock blijven zoombaar: toegankelijkheid)
  for (const t of ["gesturestart", "gesturechange", "gestureend"]) cv.addEventListener(t, (e) => e.preventDefault(), { passive: false });
}

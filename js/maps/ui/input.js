// Inn the Grid (G4, WP56): invoer voor pannen en zoomen via Pointer Events (muis, pen, touch). WP56 kent alleen de
// modus Kijken: één vinger of de muis = pannen, knijpen = zoomen, wiel (en trackpad-knijpen) = zoomen rond de cursor.
// Later bepaalt de gereedschapsmodus wat één vinger doet; knijpen en twee vingers blijven altijd pannen/zoomen (§2.7).
// Geen pagina-scroll of iOS-paginazoom: touch-action:none op het canvas (css/maps.css) en gesture* geblokkeerd.
import { panBy, pinch, zoomAt, wheelFactor } from "../model/view.js";

/** Invoer aan het canvas hangen. get() = huidige view, set(v) = nieuwe view toepassen (begrenzen + tekenen).
 *  WP59: drag(dx, dy) (CSS-px) krijgt de beweging van één vinger/muis zolang dragging() waar is (uitlijnmodus: de
 *  afbeelding slepen); knijpen en wiel blijven zoomen/pannen. */
export function attachInput(cv, { get, set, drag = null, dragging = () => false }) {
  const pts = new Map(); // pointerId → { x, y } (CSS-px binnen het canvas)
  const at = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  cv.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.isPrimary) pts.clear(); // eerste aanraking van een nieuw gebaar: een gemiste pointerup laat geen spookvinger achter
    if (pts.size >= 2) return; // een derde vinger doet niets
    pts.set(e.pointerId, at(e));
    try { cv.setPointerCapture(e.pointerId); } catch { /* oude browser */ }
    e.preventDefault();
  });
  cv.addEventListener("pointermove", (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const now = at(e);
    if (pts.size === 1) { if (drag && dragging()) drag(now.x - prev.x, now.y - prev.y); else set(panBy(get(), now.x - prev.x, now.y - prev.y)); }
    else {
      const [other] = [...pts].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
      set(pinch(get(), prev, other, now, other));
    }
    pts.set(e.pointerId, now);
  });
  const end = (e) => { pts.delete(e.pointerId); };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
  cv.addEventListener("lostpointercapture", end);
  window.addEventListener("blur", () => pts.clear());
  document.addEventListener("visibilitychange", () => pts.clear());

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

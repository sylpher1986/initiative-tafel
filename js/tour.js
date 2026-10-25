// OB1: rondleiding in twee delen (pure logica, geen DOM). Deel "p" in Voorbereiden na de welkomstkaart, deel "f" bij de
// eerste keer Gevecht in dezelfde sessie. Gezien = localStorage `it-tour` met de letters van de gezien delen ("p", "f",
// "pf"). Niet in undo of export. De UI staat in js/ui/tour.js.

/**
 * Stops per deel: `sel` = één of meer selectors (één kader om allemaal); `t` (titel, max 4 woorden) en `x` (tekst, kort)
 * zijn sleutels in de catalogus (WP26), vertaald bij het tonen in js/ui/tour.js.
 * Een stop zonder zichtbaar doel wordt overgeslagen (bijv. geen monsterkaart na "Begin leeg").
 */
export const STOPS = {
  p: [
    { sel: ["#modes .phase"], t: "init.tour.p1T", x: "init.tour.p1X" },
    { sel: ["#order li.c.mon .khead"], t: "init.tour.p2T", x: "init.tour.p2X" },
    { sel: ['#dock [data-prep="mon"]'], t: "init.tour.p3T", x: "init.tour.p3X" },
    { sel: ['#dock [data-prep="pc"]', '#dock [data-prep="party"]'], t: "init.tour.p4T", x: "init.tour.p4X" },
    { sel: ['#dock [data-prep="data"]'], t: "init.tour.p5T", x: "init.tour.p5X" },
    { sel: ["#start"], t: "init.tour.p6T", x: "init.tour.p6X" },
  ],
  f: [
    { sel: ["#dock .who"], t: "init.tour.f1T", x: "init.tour.f1X" },
    { sel: ["#order li.c.turn .khp"], t: "init.tour.f2T", x: "init.tour.f2X" },
    { sel: ["#next"], t: "init.tour.f3T", x: "init.tour.f3X" },
    { sel: ["#prev", "#undo"], t: "init.tour.f4T", x: "init.tour.f4X" },
    { sel: ["#aoe"], t: "init.tour.f5T", x: "init.tour.f5X" },
    { sel: ["#logopen"], t: "init.tour.f6T", x: "init.tour.f6X" },
  ],
};

/** Welke delen zijn gezien ("p", "f"); onbekende tekens tellen niet */
export const seen = (raw) => new Set(String(raw || "").split("").filter((k) => k === "p" || k === "f"));
/** Nieuwe waarde voor `it-tour` met dit deel erbij (vaste volgorde) */
export const withSeen = (raw, part) => { const s = seen(raw); s.add(part); return ["p", "f"].filter((k) => s.has(k)).join(""); };
/**
 * Eerste opstart met deze versie (`it-tour` ontbreekt): wie al data heeft, krijgt de rondleiding niet vanzelf (wel via
 * Instellingen) → "pf"; wie nog niets heeft → "" (zodat een herlaadbeurt midden in de tour, met het voorbeeld in de
 * lijst, hem niet alsnog stilzet). Geeft de waarde om op te slaan, of null als er al een waarde is.
 */
export const silenceFor = (raw, hasData) => (raw != null ? null : hasData ? "pf" : "");

/**
 * Plaats van het uitlegvak bij een doel (`r` = rect met top/bottom/left/right, viewport vw × vh, vak w × h).
 * Doel in de onderste 45 % (dock): vak erboven, anders eronder; altijd binnen het scherm met marge `m`.
 */
export function placeTip(r, vw, vh, w, h, m = 16, gap = 12) {
  const above = (r.top + r.bottom) / 2 > vh * 0.55;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
  const y = clamp(above ? r.top - gap - h : r.bottom + gap, m, vh - h - m);
  const x = clamp((r.left + r.right) / 2 - w / 2, m, vw - w - m);
  return { x: Math.round(x), y: Math.round(y), above };
}

/** Eén kader om meerdere rects (stop met twee knoppen), met `pad` ruimte rondom */
export function unionRect(rs, pad = 4) {
  const top = Math.min(...rs.map((r) => r.top)) - pad, left = Math.min(...rs.map((r) => r.left)) - pad;
  const bottom = Math.max(...rs.map((r) => r.bottom)) + pad, right = Math.max(...rs.map((r) => r.right)) + pad;
  return { top, left, bottom, right, width: right - left, height: bottom - top };
}

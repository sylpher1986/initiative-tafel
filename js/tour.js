// OB1: rondleiding in twee delen (pure logica, geen DOM). Deel "p" in Voorbereiden na de welkomstkaart, deel "f" bij de
// eerste keer Gevecht in dezelfde sessie. Gezien = localStorage `it-tour` met de letters van de gezien delen ("p", "f",
// "pf"). Niet in undo of export. De UI staat in js/ui/tour.js.

/**
 * Stops per deel: `sel` = één of meer selectors (één kader om allemaal), titel max 4 woorden, tekst kort.
 * Een stop zonder zichtbaar doel wordt overgeslagen (bijv. geen monsterkaart na "Begin leeg").
 */
export const STOPS = {
  p: [
    { sel: ["#modes .phase"], t: "Eerst voorbereiden", x: "Hier zet je alles klaar. Na Start gevecht ga je naar stap 2." },
    { sel: ["#order li.c.mon .khead"], t: "Tik = openen", x: "Open een kaart voor Init, Max HP, Conditie en Statblock. Er is één kaart tegelijk open." },
    { sel: ['#dock [data-prep="mon"]'], t: "Monsters toevoegen", x: "SRD-monsters zoeken op naam, type of CR. Je klaargezette encounters staan hier ook." },
    { sel: ['#dock [data-prep="pc"]', '#dock [data-prep="party"]'], t: "Spelers en party", x: "Via een D&D Beyond-link of met de hand. Je vaste party zet je in één tik aan tafel." },
    { sel: ['#dock [data-prep="data"]'], t: "Instellingen", x: "Thema, spelersscherm en export als backup. Ook deze rondleiding vind je hier." },
    { sel: ["#start"], t: "Start gevecht", x: "Vraagt eerst de initiative van de spelers. Monsters: houden of opnieuw rollen." },
  ],
  f: [
    { sel: ["#dock .who"], t: "Aan de beurt", x: "Wie nu speelt en wie daarna. Zijn kaart staat open." },
    { sel: ["#order li.c.turn .khp"], t: "Schade en heal", x: "Tik op de HP-balk voor het cijferpaneel." },
    { sel: ["#next"], t: "Volgende beurt", x: "Telt rondes, condities en effecten vanzelf af." },
    { sel: ["#prev", "#undo"], t: "Terug en ongedaan", x: "‹ Vorige gaat een beurt terug. De pijl-terug-knop draait je laatste actie terug, ook schade." },
    { sel: ["#aoe"], t: "AoE", x: "Eén schadeworp op meerdere doelen, met een save per doel. Of een spell als Bless." },
    { sel: ["#logopen"], t: "Logboek", x: "Tik op het rondeblok voor alles wat er gebeurde. Daar zet je ook een reden bij." },
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

// Eén DM-tabblad tegelijk (DA3). Twee tabbladen of vensters met de app schreven elkaars stand en undo-geschiedenis
// stil over. Zoals bij de kamer (sluitcode 4001): het nieuwste tabblad wint. Elk tabblad zet bij het opstarten zijn
// id in localStorage ("it-tab"); de andere krijgen een storage-event en stoppen. Bewust localStorage en geen
// BroadcastChannel: het event komt in alle andere tabbladen én de waarde blijft staan, zodat een tabblad dat een
// event miste (bevroren op de achtergrond, bfcache) het bij zichtbaar worden of de volgende opslag alsnog merkt.
// Niet in undo of export. Geen localStorage (privémodus): geen bewaking, de app werkt zoals vóór 1.31.8.
export const TAB_KEY = "it-tab";

/** Is dit tabblad (id) nog de eigenaar volgens de bewaarde waarde (puur)? Geen of onleesbare waarde: ja. */
export function stillMine(raw, id) {
  if (raw == null) return true;
  try { const o = JSON.parse(raw); return !(o && typeof o.id === "string") || o.id === id; } catch { return true; }
}

/**
 * Claimt de app voor dit tabblad. onLost() wordt één keer aangeroepen zodra een ander tabblad het overnam.
 * Geeft ok() terug: true zolang dit tabblad de eigenaar is (leest localStorage opnieuw; voor elke opslag).
 */
export function claimTab(onLost, { ls = globalThis.localStorage, win = globalThis, doc = globalThis.document, now = Date.now() } = {}) {
  const id = now.toString(36) + Math.random().toString(36).slice(2, 8);
  try { ls.setItem(TAB_KEY, JSON.stringify({ id, t: now })); } catch { return () => true; }
  let lost = false;
  const ok = () => {
    if (lost) return false;
    let raw;
    try { raw = ls.getItem(TAB_KEY); } catch { return true; }
    // de huidige waarde, niet e.newValue: claimen twee tabbladen tegelijk, dan wint de laatste schrijver en stopt alleen de ander
    if (stillMine(raw, id)) return true;
    lost = true;
    onLost();
    return false;
  };
  win.addEventListener?.("storage", (e) => { if (e.key === TAB_KEY || e.key === null) ok(); });
  win.addEventListener?.("pageshow", (e) => { if (e.persisted) ok(); });
  doc?.addEventListener?.("visibilitychange", () => { if (doc.visibilityState === "visible") ok(); });
  return ok;
}

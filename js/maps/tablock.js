// Inn Sight (G4, WP58, D11): één tabblad tegelijk, het nieuwste wint. Zelfde patroon als js/tablock.js van Initiative,
// maar een eigen sleutel ("maps-tab"), zodat Grid en Initiative elkaar nooit stoppen. Bewust een kopie en geen import:
// js/maps/ importeert niets van Initiative (tests/maps-boundary.test.js). localStorage en geen BroadcastChannel: het event
// komt in alle andere tabbladen én de waarde blijft staan, zodat een tabblad dat het event miste (bevroren, bfcache) het bij
// zichtbaar worden of de volgende opslag alsnog merkt. Geen localStorage (privémodus): geen bewaking.
export const TAB_KEY = "maps-tab";

/** Is dit tabblad (id) nog de eigenaar volgens de bewaarde waarde (puur)? Geen of onleesbare waarde: ja. */
export function stillMine(raw, id) {
  if (raw == null) return true;
  try { const o = JSON.parse(raw); return !(o && typeof o.id === "string") || o.id === id; } catch { return true; }
}

/**
 * Claimt de kaartenmaker voor dit tabblad. onLost() wordt één keer aangeroepen zodra een ander tabblad het overnam.
 * Geeft ok() terug: true zolang dit tabblad de eigenaar is (leest localStorage opnieuw; vóór elke opslag).
 */
export function claimTab(onLost, { ls = globalThis.localStorage, win = globalThis, doc = globalThis.document, now = Date.now() } = {}) {
  const id = now.toString(36) + Math.random().toString(36).slice(2, 8);
  try { ls.setItem(TAB_KEY, JSON.stringify({ id, t: now })); } catch { return () => true; }
  let lost = false;
  const ok = () => {
    if (lost) return false;
    let raw;
    try { raw = ls.getItem(TAB_KEY); } catch { return true; }
    if (stillMine(raw, id)) return true; // de huidige waarde: claimen twee tabbladen tegelijk, dan wint de laatste schrijver
    lost = true;
    onLost();
    return false;
  };
  win.addEventListener?.("storage", (e) => { if (e.key === TAB_KEY || e.key === null) ok(); });
  win.addEventListener?.("pageshow", (e) => { if (e.persisted) ok(); });
  doc?.addEventListener?.("visibilitychange", () => { if (doc.visibilityState === "visible") ok(); });
  return ok;
}

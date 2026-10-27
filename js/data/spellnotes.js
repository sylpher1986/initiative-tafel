// RE6b (WP42): eigen notitie bij een spell die niet in de SRD staat (Hex, Ray of Sickness). Puur, zonder DOM.
// Opslag: één object { [sleutel]: { n, t } }, sleutel = normSpell(naam) (zelfde normalisatie als het opzoeken).
// Gebruikersinhoud: nooit vertaald, altijd esc() bij tonen. Niet in undo; wel in export (versie 3).
import { normSpell } from "../rules/spells.js";

export const NOTE_MAX = 500;    // tekens per notitie
export const NOTES_MAX = 300;   // aantal notities
const NAME_MAX = 120;

const clip = (v, max) => String(v ?? "").replace(/\r\n?/g, "\n").slice(0, max);

/** Notitie bij een spellnaam, of null */
export const noteFor = (notes, n) => {
  const k = normSpell(n);
  return (k && notes && Object.hasOwn(notes, k) && notes[k]) || null;
};

/**
 * Nieuwe notities met deze notitie gezet (lege tekst = weg). Geeft een nieuw object terug; de oude blijft ongewijzigd.
 * Weigert stil (zelfde object terug) bij een lege naam of als het maximum aantal bereikt is.
 */
export function setNote(notes, n, text) {
  const k = normSpell(n), cur = notes || {};
  if (!k) return cur;
  const t = clip(text, NOTE_MAX).trim();
  if (!t) {
    if (!Object.hasOwn(cur, k)) return cur;
    const { [k]: _gone, ...rest } = cur;
    return rest;
  }
  if (!Object.hasOwn(cur, k) && Object.keys(cur).length >= NOTES_MAX) return cur;
  return { ...cur, [k]: { n: clip(String(n).trim(), NAME_MAX), t } };
}

/** Opschonen (opslag of import): alleen geldige namen en tekst, sleutel opnieuw berekend uit de naam, begrensd */
export function cleanSpellNotes(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return {};
  const seen = new Map(); // geen toewijzing op een object: een naam "__proto__" zou anders het prototype zetten
  for (const v of Object.values(x)) {
    if (seen.size >= NOTES_MAX) break;
    if (!v || typeof v !== "object" || typeof v.n !== "string" || typeof v.t !== "string") continue;
    const n = clip(v.n.trim(), NAME_MAX), k = normSpell(n), t = clip(v.t, NOTE_MAX).trim();
    if (k && t && !seen.has(k)) seen.set(k, { n, t });
  }
  return Object.fromEntries(seen);
}

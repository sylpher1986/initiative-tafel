// Lijn-iconen uit de sprite icons/ui.svg (WP17, HS7). Decoratief: de betekenis staat in de tekst of het aria-label van de knop.
export const UI_SPRITE = "/icons/ui.svg"; // absoluut: de pagina staat onder /{taal}/initiative/ (WP21)
/** Inline svg met <use>; id zonder voorvoegsel ("chev", "x"). cls voor draaien/maat ("dn", "up"). */
export const ico = (id, cls = "") => `<svg class="li${cls ? " " + cls : ""}" aria-hidden="true" focusable="false"><use href="${UI_SPRITE}#i-${id}"/></svg>`;
/** Uitklappijl: chevron naar rechts (dicht) of omlaag (open) */
export const chev = (open) => ico("chev", open ? "dn" : "");
/** Death saves in een badge: ✓1 ✗2 als iconen, voor schermlezers in woorden (WP17) */
export const dsMini = (s, f) => `<span aria-hidden="true">Death saves ${ico("check")}${s} ${ico("x")}${f}</span><span class="vh">Death saves: ${s} gelukt, ${f} mislukt</span>`;

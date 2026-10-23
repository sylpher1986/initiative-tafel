// Lijn-iconen uit de sprite icons/ui.svg (WP17, HS7). Decoratief: de betekenis staat in de tekst of het aria-label van de knop.
export const UI_SPRITE = "icons/ui.svg";
/** Inline svg met <use>; id zonder voorvoegsel ("chev", "x"). cls voor draaien/maat ("dn", "up"). */
export const ico = (id, cls = "") => `<svg class="li${cls ? " " + cls : ""}" aria-hidden="true" focusable="false"><use href="${UI_SPRITE}#i-${id}"/></svg>`;
/** Uitklappijl: chevron naar rechts (dicht) of omlaag (open) */
export const chev = (open) => ico("chev", open ? "dn" : "");

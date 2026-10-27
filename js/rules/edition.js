// G1 (WP46): regelset per tafel en editie per monster. Puur: geen DOM, geen opslag, geen instelling.
// S.rules: "2014" | "2024" (ontbreekt = 2014). Deelnemer en encounterregel: optioneel ed: "2024" (ontbreekt = huidig gedrag).
// Alleen "2024" wordt geschreven, zodat bestanden en undo-stappen van 2014-gebruikers byte-gelijk blijven.

export const EDS = ["2014", "2024"];
/** Regelset van de tafel; ontbreekt of onzin → "2014" */
export const rulesOf = (S) => (S && S.rules === "2024" ? "2024" : "2014");
/** B2: spells volgen regelset 2024; bij 2014 geldt de instelling Spells 2014 | 2024 */
export const spellEdOf = (rules, setting) => (rules === "2024" || setting === "2024" ? "2024" : "2014");
/** Editieveld opschonen: alleen "2024" blijft, anders undefined (= weglaten) */
export const cleanEd = (v) => (v === "2024" ? "2024" : undefined);
/** Om in een object te spreiden: { ed: "2024" } of {} */
export const edField = (v) => (cleanEd(v) ? { ed: "2024" } : {});
/** Regelset meenemen naar een nieuwe stand (reset, voorbeeld wissen, import): { rules: "2024" } of {} */
export const rulesField = (S) => (rulesOf(S) === "2024" ? { rules: "2024" } : {});
/** Zelfde editie (ontbrekend en onzin tellen als gelijk) */
export const sameEd = (a, b) => cleanEd(a) === cleanEd(b);
/** Ontbrekend monster als tekst voor een melding: "Zombie" of "Zombie · 2024" (editiecode, geen vertaling) */
export const refLabel = (x) => (cleanEd(x.ed) ? `${x.ref} · ${x.ed}` : x.ref);

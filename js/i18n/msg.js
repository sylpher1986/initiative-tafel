// Berichtdescriptoren (meertaligheid, WP19/TA3): pure code (js/rules/, log.js) geeft geen zinnen terug maar
// { k: sleutel, p: waarden }. De UI vertaalt pas bij het tonen (t in core.js), zodat een taalwissel ook
// meldingen en logregels in de nieuwe taal laat zien. Waarden mogen zelf weer een descriptor zijn.
// Plan: docs/i18n.md §3.1.

/** Descriptor maken: M("rules.save.lost", { name: "Lotte", dc: 13 }) → { k, p } (p alleen als er waarden zijn) */
export const M = (k, p) => (p && Object.keys(p).length ? { k, p } : { k });

/** Is dit een descriptor? (object met een string-sleutel k, geen array) */
export const isMsg = (x) => !!x && typeof x === "object" && !Array.isArray(x) && typeof x.k === "string" && x.k !== "";

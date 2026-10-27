// Berichtdescriptoren (meertaligheid, WP19/TA3): pure code (js/rules/, log.js) geeft geen zinnen terug maar
// { k: sleutel, p: waarden }. De UI vertaalt pas bij het tonen (t in core.js), zodat een taalwissel ook
// meldingen en logregels in de nieuwe taal laat zien. Waarden mogen zelf weer een descriptor zijn.
// Plan: docs/i18n.md §3.1.

/** Descriptor maken: M("rules.save.lost", { name: "Lotte", dc: 13 }) → { k, p } (p alleen als er waarden zijn) */
export const M = (k, p) => (p && Object.keys(p).length ? { k, p } : { k });

/**
 * Samengestelde tekst (WP27): delen (tekst of descriptoren) met een vast scheidingsteken, zonder "en"/"and".
 * J(["−7 HP", M("rules.x")], ", ") → { j: [...], s: ", " }; tr/t vertalen elk deel en voegen samen.
 */
export const J = (parts, s = ", ") => {
  const j = parts.filter((x) => x != null && x !== "");
  if (j.length === 1) return j[0]; // één deel: geen omhulsel (kleiner logboek); tr geeft dezelfde tekst
  return s === ", " ? { j } : { j, s }; // standaard-scheidingsteken niet opslaan
};
/** Is dit een samengestelde tekst uit J()? */
export const isJoin = (x) => !!x && typeof x === "object" && Array.isArray(x.j);

/** Is dit een descriptor? (object met een string-sleutel k, geen array) */
export const isMsg = (x) => !!x && typeof x === "object" && !Array.isArray(x) && typeof x.k === "string" && x.k !== "";

/**
 * TS5: zijn alle sleutels in deze descriptor (ook geneste waarden, J-delen en lijsten) bekend volgens has?
 * Tekst en getallen zijn altijd bekend. Zo valt een logregel met een sleutel uit een nieuwere app, of zonder geladen
 * catalogus, terug op zijn bewaarde tekst in plaats van de kale sleutel. Diepte begrensd zoals de vertaler (core.js).
 */
export function descKnown(x, has, depth = 0) {
  if (depth > 8) return false;
  if (isMsg(x)) return !!has(x.k) && (!x.p || typeof x.p !== "object" || Object.values(x.p).every((v) => descKnown(v, has, depth + 1)));
  if (isJoin(x)) return x.j.every((y) => descKnown(y, has, depth + 1));
  if (Array.isArray(x)) return x.every((y) => descKnown(y, has, depth + 1));
  return x == null || typeof x !== "object";
}

// Adres rechtzetten vanuit de niet-gevonden-pagina's (meertaligheid, WP21/WP30; sinds WP44 alleen op het pad):
// een oud "/en/…" (als de Worker het niet al deed), een verkeerd geschreven voorvoegsel ("/NL/…") of een ongeldig
// voorvoegsel ("/xx/…" → Engels, zonder voorvoegsel). Geen voorkeur of browsertaal (WP44: geen automatische taalredirect).
// Query en hash blijven (ook ?k=). Werkt offline: de 404-pagina's halen dit bestand en lang.js uit de cache van sw.js.
import { resolveLang, adoptExisting } from "./lang.js";

/** Doeladres voor een locatie, of null als de pagina al goed is. Puur op het meegegeven object. */
export function target(loc) {
  const { redirect } = resolveLang({ path: loc.pathname, search: loc.search, hash: loc.hash });
  return redirect && redirect !== loc.pathname + (loc.search || "") + (loc.hash || "") ? redirect : null;
}

/** Doorsturen zonder extra regel in de geschiedenis (terug-knop springt niet terug naar de 404) */
export function go(w = globalThis) {
  adoptExisting(); // WP33: zie js/i18n/lang.js
  const to = target(w.location);
  if (to) w.location.replace(to);
  return to;
}

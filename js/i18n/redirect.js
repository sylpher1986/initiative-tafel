// Doorverwijzer voor taalloze adressen (meertaligheid, WP21/TA5): /, /index.html, /initiative/, /speler(.html), /player.
// Die pagina's (gemaakt door tools/pages.mjs) laden alleen dit bestand en gaan meteen door naar /{taal}/initiative/(player/).
// Taal volgens resolveLang (docs/i18n.md §2.2): voorkeur → browsertaal → terugval; query en hash blijven (ook ?k=).
// Ook vanuit de 404-pagina's (WP30): een ongeldig prefix (/xx/…) gaat altijd naar Engels.
// Werkt offline: de doorverwijspagina's, dit bestand en lang.js staan in de cache van sw.js.
import { resolveLang, prefStore, offered, debugStored, adoptExisting } from "./lang.js";

/** Doeladres voor een locatie, of null als de pagina al goed is. Puur op de meegegeven objecten.
 *  live: talen voor voorkeur en browsertaal; in de debugstand alle ondersteunde (WP22), anders LIVE. */
export function target(loc, nav = {}, store = prefStore(), live = offered(debugStored())) {
  const languages = nav.languages && nav.languages.length ? nav.languages : [nav.language];
  const { redirect } = resolveLang({ path: loc.pathname, search: loc.search, hash: loc.hash, pref: store.get(), languages, live });
  return redirect && redirect !== loc.pathname + (loc.search || "") + (loc.hash || "") ? redirect : null;
}

/** Doorsturen zonder extra regel in de geschiedenis (terug-knop springt niet terug naar de doorverwijzer) */
export function go(w = globalThis) {
  adoptExisting(); // WP33: bestaande gebruiker zonder voorkeur blijft Nederlands
  const to = target(w.location, w.navigator);
  if (to) w.location.replace(to);
  return to;
}

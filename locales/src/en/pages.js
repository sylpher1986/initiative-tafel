// Statische paginateksten en SEO: title, description, Open Graph, homepage (WP23, WP30).
// Sleutels beginnen met "page." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
// Engelse tekst: D&D 5e (2014)-termen zoals in de PHB/SRD; nagelezen door de vertaalagent (docs/i18n.md §0, V6).
export default {
  "page.manifest.desc": "Initiative tracker for D&D 5e (2014)", // beschrijving van de geïnstalleerde app (manifest, tools/pages.mjs)
  "page.app.desc": "Initiative tracker for D&D 5e (2014): players, SRD monsters, conditions, spell slots and a combat log.", // meta description van de DM-app
  "page.err.bar": "Error (tap to close):", // foutbalk bovenaan (inline script); daarna volgt de technische fout
  "page.err.notLoaded": "failed to load", // foutbalk: "/js/main.js kon niet laden"
  "page.noscript.app": "Kev’s Inn itiative needs JavaScript.",
  "page.player.title": "Player view · Kev’s Inn itiative", // <title> van het spelersscherm
  "page.noscript.player": "The player view needs JavaScript.",
};

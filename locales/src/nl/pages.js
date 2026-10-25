// Statische paginateksten en SEO: title, description, Open Graph, homepage (WP23, WP30).
// Sleutels beginnen met "page." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
export default {
  "page.manifest.desc": "Initiative tracker voor D&D 5e (2014)", // beschrijving van de geïnstalleerde app (manifest, tools/pages.mjs)
  "page.app.desc": "Initiative tracker voor D&D 5e (2014): spelers, SRD-monsters, condities, spell slots en logboek.", // meta description van de DM-app
  "page.err.bar": "Fout (tik om te sluiten):", // foutbalk bovenaan (inline script); daarna volgt de technische fout
  "page.err.notLoaded": "kon niet laden", // foutbalk: "/js/main.js kon niet laden"
  "page.noscript.app": "Kev’s Inn itiative heeft JavaScript nodig.",
  "page.player.title": "Spelersscherm · Kev’s Inn itiative", // <title> van het spelersscherm
  "page.noscript.player": "Het spelersscherm heeft JavaScript nodig.",
};

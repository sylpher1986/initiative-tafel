// Statische paginateksten en SEO: title, description, Open Graph, homepage (WP23, WP30).
// Sleutels beginnen met "page." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
export default {
  "page.manifest.desc": "Initiative tracker voor D&D 5e (2014)", // beschrijving van de geïnstalleerde app (manifest, tools/pages.mjs)
};

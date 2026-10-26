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
  // Public homepage /en/ (WP30, pages/home.html). title/desc also for Open Graph (tools/pages.mjs seoHead).
  "page.home.title": "Kev’s Inn · initiative tracker for D&D 5e", // <title> en og:title van de homepage
  "page.home.desc": "Free initiative tracker for D&D 5e (2014): players, SRD monsters, conditions and a player view on the TV. Works offline, no account.", // meta description en og:description
  "page.home.ogAlt": "Kev’s Inn emblem with the text: Initiative tracker, D&D 5e", // og:image:alt
  "page.home.tagline": "Tools for the DM, at the table.",
  "page.home.lead": "Track initiative, hit points and conditions for D&D 5e. On your phone or tablet.", // onder "Kev’s Inn itiative" op de walnoot-kaart
  "page.home.open": "Open Initiative", // gouden knop naar de app; ook op de niet-gevonden-pagina
  "page.home.factFree": "Free",
  "page.home.factOffline": "Works offline",
  "page.home.factNoAccount": "No account",
  "page.home.featLabel": "What Initiative does", // aria-label van de lijst met kenmerken
  "page.home.featMonsters": "All 322 SRD monsters",
  "page.home.featMonstersText": "With stat blocks. Search, tap, done.",
  "page.home.featParty": "Your players in one tap",
  "page.home.featPartyText": "Manually or from a D&D Beyond link.",
  "page.home.featRules": "Rules at hand",
  "page.home.featRulesText": "Conditions explained. Concentration saves straight from the damage.",
  "page.home.featScreen": "Player view via QR code",
  "page.home.featScreenText": "Put the turn order on the TV or on the phones at the table.",
  "page.home.soon": "Coming later", // kopje: volgende tools van Kev’s Inn
  "page.home.soonText": "Characters, campaigns and a companion for your players.",
  "page.home.privacy": "Your data stays on your own device.",
  "page.home.legalSrd": "Includes material from the System Reference Document 5.1 and 5.2 by Wizards of the Coast LLC, available under", // gevolgd door de link "CC-BY-4.0."
  "page.home.legalTm": "Dungeons & Dragons is a trademark of Wizards of the Coast LLC.",
  "page.home.legalFan": "Kev’s Inn is unofficial Fan Content, not approved by or affiliated with Wizards of the Coast.",
  // Niet-gevonden-pagina (/404.html, /{taal}/404.html; WP30)
  "page.nf.title": "Page not found",
  "page.nf.text": "This address doesn’t exist (anymore).",
  "page.nf.home": "Go to the homepage",
};

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
  // Publieke homepage /nl/ (WP30, pages/home.html). title/desc ook voor Open Graph (tools/pages.mjs seoHead).
  "page.home.title": "Kev’s Inn · initiative tracker voor D&D 5e", // <title> en og:title van de homepage
  "page.home.desc": "Gratis initiative tracker voor D&D 5e (2014): spelers, SRD-monsters, condities en een spelersscherm op de tv. Werkt offline, zonder account.", // meta description en og:description
  "page.home.ogAlt": "Embleem van Kev’s Inn met de tekst: Initiative tracker, D&D 5e", // og:image:alt
  "page.home.tagline": "Gereedschap voor de DM, aan tafel.",
  "page.home.lead": "Houd initiative, HP en condities bij voor D&D 5e. Op je telefoon of tablet.", // onder "Kev’s Inn itiative" op de walnoot-kaart
  "page.home.open": "Open Initiative", // gouden knop naar de app; ook op de niet-gevonden-pagina
  "page.home.factFree": "Gratis",
  "page.home.factOffline": "Werkt offline",
  "page.home.factNoAccount": "Geen account",
  "page.home.featLabel": "Wat Initiative kan", // aria-label van de lijst met kenmerken
  "page.home.featMonsters": "Alle 322 SRD-monsters",
  "page.home.featMonstersText": "Met statblock. Zoeken, tikken, erin.",
  "page.home.featParty": "Je spelers in één tik",
  "page.home.featPartyText": "Handmatig of via een D&D Beyond-link.",
  "page.home.featRules": "Regels bij de hand",
  "page.home.featRulesText": "Condities met uitleg. Concentration save direct vanuit de schade.",
  "page.home.featScreen": "Spelersscherm via QR-code",
  "page.home.featScreenText": "Zet de volgorde op de tv of op de telefoons aan tafel.",
  "page.home.soon": "Komt nog", // kopje: volgende tools van Kev’s Inn
  "page.home.soonText": "Characters, campaigns en een companion voor je spelers.",
  "page.home.privacy": "Je gegevens blijven op je eigen apparaat.",
  "page.home.legalSrd": "Bevat materiaal uit het System Reference Document 5.1 en 5.2 van Wizards of the Coast LLC, beschikbaar onder", // gevolgd door de link "CC-BY-4.0."
  "page.home.legalTm": "Dungeons & Dragons is een merk van Wizards of the Coast LLC.",
  "page.home.legalFan": "Kev’s Inn is onofficiële fancontent, niet goedgekeurd door of verbonden aan Wizards of the Coast.",
  // Niet-gevonden-pagina (/404.html, /{taal}/404.html; WP30)
  "page.nf.title": "Pagina niet gevonden",
  "page.nf.text": "Dit adres bestaat niet (meer).",
  "page.nf.home": "Naar de homepage",
};

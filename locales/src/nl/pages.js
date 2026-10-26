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
  "page.home.ogAlt": "Kev’s Inn – Initiative tracker · D&D 5e – kevs-inn.com", // og:image:alt
  "page.home.tagline": "Your home between adventures", // merkregel, bewust Engels (zie en)
  "page.home.headline": "Bouw. Speel. Ontdek.",
  "page.home.lead": "Gratis hulpmiddelen voor de DM aan tafel bij D&D 5e. Zet een encounter klaar, leid het gevecht op je telefoon en laat je spelers meekijken.",
  "page.home.langNav": "Taal",
  "page.home.tools": "Hulpmiddelen",
  "page.home.toolSub": "Encounters bouwen en gevechten bijhouden",
  "page.home.toolText": "Voeg SRD-monsters en je party toe, rol initiative en houd HP, condities en beurten bij.",
  "page.home.open": "Open Initiative", // gouden knop naar de app; ook op de niet-gevonden-pagina
  "page.home.factFree": "Gratis",
  "page.home.factOffline": "Werkt offline",
  "page.home.factNoAccount": "Geen account nodig",
  "page.home.factDevice": "Werkt op elk apparaat",
  "page.home.featLabel": "Wat Initiative kan", // aria-label van de lijst met kenmerken
  "page.home.featMonsters": "Alle 322 monsters uit SRD 5.1",
  "page.home.featMonstersText": "Met statblocks. Zoeken, tikken, erin.",
  "page.home.featParty": "Je party in één tik",
  "page.home.featPartyText": "Eén keer invoeren, met de hand of via een D&D Beyond-link.",
  "page.home.featRules": "Regels bij de hand",
  "page.home.featRulesText": "Condities met uitleg. Concentration save direct bij schade.",
  "page.home.featScreen": "Spelersscherm via QR-code",
  "page.home.featScreenText": "Zet de beurtvolgorde op de tv of de telefoons van je spelers.",
  "page.home.privacy": "Je gegevens blijven op je eigen apparaat.",
  "page.home.legalSrd": "Bevat materiaal uit de System Reference Documents 5.1 en 5.2 van Wizards of the Coast LLC, beschikbaar onder", // gevolgd door de link "CC-BY-4.0."
  "page.home.legalTm": "Dungeons & Dragons is een handelsmerk van Wizards of the Coast LLC.",
  "page.home.legalFan": "Kev’s Inn is onofficiële fancontent, toegestaan onder de Fan Content Policy. Niet goedgekeurd of gesteund door Wizards. Delen van het gebruikte materiaal zijn eigendom van Wizards of the Coast. ©Wizards of the Coast LLC.",
  // Niet-gevonden-pagina (/404.html, /{taal}/404.html; WP30)
  "page.nf.title": "Pagina niet gevonden",
  "page.nf.text": "Dit adres bestaat niet (meer).",
  "page.nf.home": "Naar de homepage",
};

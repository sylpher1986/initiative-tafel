// Spelersscherm (speler.html, js/speler.js, js/playerview.js; WP28).
// Sleutels beginnen met "player." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
export default {
  "player.who": "Wie ben jij?", // knop; js/speler.js zet daarna "Jij: …"
  "player.full": "Volledig scherm",
  "player.log": "Wat er net gebeurde", // aria-label van de laatste regels
  "player.me": "Jouw personage", // aria-label van de eigen kaart
  "player.qr": "Meekijken op je telefoon", // aria-label van de QR-code op de tv
  "player.wait": "Wacht op het DM-scherm…",
  "player.code": "Code van de DM", // label bij het invoerveld
  "player.follow": "Volg", // knop naast de code
  "player.joinHint": "Of open Kev’s Inn itiative in een ander venster van deze browser.",
};

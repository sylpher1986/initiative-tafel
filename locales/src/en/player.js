// Spelersscherm (speler.html, js/speler.js, js/playerview.js; WP28).
// Sleutels beginnen met "player." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
// Engelse tekst: D&D 5e (2014)-termen zoals in de PHB/SRD; nagelezen door de vertaalagent (docs/i18n.md §0, V6).
export default {
  "player.who": "Who are you?", // knop; js/speler.js zet daarna "Jij: …"
  "player.full": "Full screen",
  "player.log": "What just happened", // aria-label van de laatste regels
  "player.me": "Your character", // aria-label van de eigen kaart
  "player.qr": "Follow along on your phone", // aria-label van de QR-code op de tv
  "player.wait": "Waiting for the DM screen…",
  "player.code": "Room code", // label bij het invoerveld
  "player.follow": "Join", // knop naast de code
  "player.joinHint": "Or open Kev’s Inn itiative in another window of this browser.",
};

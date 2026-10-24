// Gedeelde tekst voor alle tools van Kev’s Inn: knoppen, fouten, taal, tijd.
// Sleutels beginnen met "common." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
// Algemeen = één betekenis op elke plek. "Opnieuw" (rollen, delen, verbinden), "Terug naar …", "Kopieer als tekst" en
// "Verwijder" (een deelnemer = Remove, een encounter = Delete) krijgen eigen sleutels in hun tool (vertaalagent WP20).
export default {
  "common.close": "Sluit",
  "common.cancel": "Annuleer",
  "common.undo": "Ongedaan",
  "common.redo": "Opnieuw", // alleen de knop na Ongedaan (redo)
  "common.save": "Opslaan",
  "common.err.generic": "Er ging iets mis.",
  "common.err.load": "Laden mislukt ({reason}).", // reason: vertaalde tekst of descriptor, nooit een vaste NL-zin
  "common.lang.label": "Taal",
  "common.lang.en": "English",
  "common.lang.nl": "Nederlands",
  "common.time.today": "vandaag",
  "common.time.yesterday": "gisteren",
  "common.time.daysAgo": { one: "{n} dag geleden", other: "{n} dagen geleden" },
};

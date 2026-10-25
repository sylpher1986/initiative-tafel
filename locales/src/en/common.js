// Gedeelde tekst voor alle tools van Kev’s Inn: knoppen, fouten, taal, tijd.
// Sleutels beginnen met "common." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
// Engelse tekst: Amerikaanse spelling en D&D 5e (2014)-termen zoals in de PHB/SRD ("Armor Class"), sentence case,
// knoppen als korte imperatief; woordenlijst in docs/i18n.md §3.2. Nagelezen door de vertaalagent (V6).
// Algemeen = één betekenis op elke plek. "Opnieuw" (rollen, delen, verbinden), "Terug naar …", "Kopieer als tekst" en
// "Verwijder" (een deelnemer = Remove, een encounter = Delete) krijgen eigen sleutels in hun tool (vertaalagent WP20).
export default {
  "common.close": "Close",
  "common.cancel": "Cancel",
  "common.undo": "Undo",
  "common.redo": "Redo", // alleen de knop na Ongedaan (redo)
  "common.save": "Save",
  "common.err.generic": "Something went wrong.",
  "common.err.load": "Couldn't load ({reason}).", // reason: vertaalde tekst of descriptor, nooit een vaste NL-zin
  "common.lang.en": "English",
  "common.lang.nl": "Nederlands",
  "common.time.today": "today",
  "common.time.yesterday": "yesterday",
  "common.time.daysAgo": { one: "{n} day ago", other: "{n} days ago" },
};

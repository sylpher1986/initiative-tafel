// Labels en uitleg bij spelregeldata: conditie-uitleg, HP-status, editie-hints. Geen D&D-termen zelf: die blijven Engels (docs/i18n.md §4).
// Sleutels beginnen met "dnd." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
export default {
  // HP-status op het spelersscherm (code hs in de snapshot, js/playerview.js HS; WP28). Zelfde woorden als init.set.visHint.
  "dnd.hs.ok": "Ongedeerd",
  "dnd.hs.hurt": "Gewond",
  "dnd.hs.bloodied": "Bloodied",
  "dnd.hs.near": "Bijna dood",
  "dnd.hs.down": "Neer",
  "dnd.hs.unconscious": "Bewusteloos",
  "dnd.hs.stable": "Stabiel",
  "dnd.hs.dead": "Dood",
};

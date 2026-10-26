// Labels en uitleg bij spelregeldata: conditie-uitleg, HP-status, editie-hints. Geen D&D-termen zelf: die blijven Engels (docs/i18n.md §4).
// Sleutels beginnen met "dnd." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
// Engelse tekst: D&D 5e (2014)-termen zoals in de PHB/SRD; nagelezen door de vertaalagent (docs/i18n.md §0, V6).
export default {
  // HP-status op het spelersscherm (code hs in de snapshot, js/playerview.js HS; WP28). Zelfde woorden als init.set.visHint.
  "dnd.hs.ok": "Unhurt",
  "dnd.hs.hurt": "Hurt",
  "dnd.hs.bloodied": "Bloodied",
  "dnd.hs.near": "Near death",
  "dnd.hs.down": "Down",
  "dnd.hs.unconscious": "Unconscious",
  "dnd.hs.stable": "Stable",
  "dnd.hs.dead": "Dead",
};
